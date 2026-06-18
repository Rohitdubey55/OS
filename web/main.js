/* main.js */

// REPLACE THIS URL with your deployed Web App URL

const API_BASE = "https://script.google.com/macros/s/AKfycbzA4TVNQO42M3r6notPSFgEqZZgVJ8ge66Gl7dbW06tCmCkaif6qkVsiK820AB4a5nSrg/exec";
const SCRIPT_URL = API_BASE; // Alias for compatibility


window.state = {

    view: "dashboard",

    data: { planner: [], tasks: [], expenses: [], habits: [], habit_logs: [], diary: [], vision: [], settings: [], funds: [], assets: [], people: [], reminders: [], vision_images: [], vision_affirmations: [], ritual_logs: [], vision_tdp: [], gym_plans: [], gym_sessions: [], gym_exercises: [], notes: [], book_library: [], book_summaries: [], reader_settings: [], mural: [], language_projects: [], language_sessions: [] },

    loading: false

};

// Keep a reference for convenience
const state = window.state;

// --- TOAST NOTIFICATION ---
function toast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = msg;
        t.style.opacity = 1;
        t.style.display = 'block';
        // Clear any existing timeout
        if (t._toastTimeout) clearTimeout(t._toastTimeout);
        t._toastTimeout = setTimeout(() => {
            t.style.opacity = 0;
            t.style.display = 'none';
        }, duration);
    } else {
        console.log('Toast:', msg);
    }
}

// Alias for compatibility with other code
window.showToast = toast;

// --- REFRESH ALL DATA ---
async function refreshAll() {
    console.log('Refreshing all data (forced)...');
    showToast('Refreshing...');
    try {
        await loadAllData(true); // Pass true to force refresh
        // Re-render current view
        if (state.view) {
            routeTo(state.view);
        }
        showToast('Data refreshed');
    } catch (e) {
        console.error('Refresh failed:', e);
        showToast('Refresh failed');
    }
}

window.refreshAll = refreshAll;

// --- UTILITIES ---

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatReminderDateTime(date) {
    const now = new Date();
    const diff = date - now;
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();

    if (isToday) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isTomorrow) {
        return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getDaysLeft(target) {
    if (!target) return 0;
    const diff = new Date(target) - new Date();
    return Math.max(0, Math.ceil(diff / 86400000));
}



// --- LONG PRESS ACTION HELPER ---
window.addLongPressAction = function (el, callback) {
    // Accept either a DOM element or a string ID
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return; // Guard: element doesn't exist

    // Ensure iOS doesn't add a 300ms tap delay
    el.style.touchAction = 'manipulation';
    el.style.webkitTapHighlightColor = 'transparent';

    let timer = null;
    let didLongPress = false;

    const start = (e) => {
        didLongPress = false;
        timer = setTimeout(() => {
            didLongPress = true;
            if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();
            callback(e);
        }, 600);
    };

    const cancel = () => {
        clearTimeout(timer);
        timer = null;
    };

    const touchEnd = (e) => {
        // Only cancel — if it was a short tap, native onclick fires automatically
        cancel();
        // If long press fired, don't let click also fire
        if (didLongPress) {
            e.preventDefault();
            e.stopPropagation();
            didLongPress = false;
        }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('touchend', touchEnd);
    el.addEventListener('touchmove', cancel, { passive: true });
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
};


// --- API HANDLING ---

/* Habit scheduling helpers — the DB has no `days` column, so a weekly habit's
   scheduled days are persisted inside the `frequency` field as "weekly:Mon,Sat".
   These read that (with fallbacks for legacy data) so weekly habits only appear
   on their scheduled days. Defined here (always loaded) and reused by view-habits.js. */
window.habitDayList = function (h) {
    if (!h) return [];
    let raw = (h.days != null && h.days !== '') ? String(h.days) : '';
    if (!raw) {
        const f = String(h.frequency || '');
        const ci = f.indexOf(':');
        if (ci >= 0) raw = f.slice(ci + 1);
        else if (/^(mon|tue|wed|thu|fri|sat|sun)/i.test(f.trim())) raw = f; // legacy day-list
    }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
};
window.habitIsWeekly = function (h) {
    const f = String((h && h.frequency) || '').toLowerCase().trim();
    return f.startsWith('weekly') || window.habitDayList(h).length > 0;
};
window.habitScheduledOn = function (h, date) {
    const f = String((h && h.frequency) || '').toLowerCase().trim();
    if (!f || f === 'daily') return true;
    const days = window.habitDayList(h);
    if (!days.length) return true;
    const D = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const wd = (date instanceof Date ? date : new Date()).getDay();
    const dn = D[wd === 0 ? 6 : wd - 1];
    return days.map(s => s.slice(0, 3).toLowerCase()).includes(dn.slice(0, 3).toLowerCase());
};
window.habitScheduledToday = function (h) { return window.habitScheduledOn(h, new Date()); };

/* ── Habit icons (line icons instead of emojis) ───────────────────────────── */
window.HABIT_ICONS = ['dumbbell','activity','heart','book-open','brain','droplet','apple','moon','sun','coffee','pencil','music','bike','leaf','target','flame','smile','laptop','wallet','phone','footprints','bed','sparkles','star','alarm-clock','glass-water','palette','code'];
// Migrate the old emoji choices to the closest line icon.
window._HABIT_EMOJI_MAP = {
    '💪':'dumbbell','🏋':'dumbbell','🏋️':'dumbbell','📚':'book-open','📖':'book-open','📓':'book-open','📔':'book-open','📝':'pencil','✏️':'pencil','✍️':'pencil',
    '🧘':'activity','🧘‍♂️':'activity','🧘‍♀️':'activity','🏃':'footprints','🏃‍♂️':'footprints','🚶':'footprints','👣':'footprints',
    '💧':'droplet','🚿':'droplet','🛁':'droplet','🧴':'droplet','🧼':'sparkles','🧹':'sparkles','🧽':'sparkles','🪥':'sparkles','✨':'sparkles','🌟':'star','⭐':'star','🏆':'star',
    '🍎':'apple','🥗':'leaf','🥦':'leaf','🌿':'leaf','☀️':'sun','🌞':'sun','😴':'moon','💤':'moon','🌙':'moon','🛏️':'bed','🛌':'bed',
    '🔥':'flame','☕':'coffee','🎵':'music','🎶':'music','🎸':'music','🚴':'bike','🚲':'bike','💻':'laptop','🖥️':'laptop','👨‍💻':'code','💼':'wallet','💰':'wallet','💵':'wallet',
    '📞':'phone','📱':'phone','🎨':'palette','🧠':'brain','❤️':'heart','🫀':'heart','😀':'smile','😊':'smile','🙂':'smile','⏰':'alarm-clock','🎯':'target','🥤':'glass-water'
};
window.habitIconKey = function (val) {
    if (val && window.HABIT_ICONS.indexOf(val) !== -1) return val;
    if (val && window._HABIT_EMOJI_MAP[val]) return window._HABIT_EMOJI_MAP[val];
    return 'sparkles';
};
// Render a habit's icon as an inline lucide <i> (falls back to a legacy emoji char).
window.habitIconHTML = function (val, size) {
    size = size || 18;
    const key = (val && window.HABIT_ICONS.indexOf(val) !== -1) ? val : (window._HABIT_EMOJI_MAP[val] || null);
    if (key) return `<i data-lucide="${key}" style="width:${size}px;height:${size}px;vertical-align:middle"></i>`;
    if (val) return val;
    return `<i data-lucide="sparkles" style="width:${size}px;height:${size}px;vertical-align:middle"></i>`;
};
// The picker grid used in the habit modal.
window.habitIconPickerHTML = function (current) {
    const cur = window.habitIconKey(current);
    return `<div class="hb-iconpick">${window.HABIT_ICONS.map(k =>
        `<button type="button" class="hb-icon-opt ${cur === k ? 'sel' : ''}" data-key="${k}" onclick="selectHabitIcon('${k}')" title="${k.replace(/-/g, ' ')}"><i data-lucide="${k}"></i></button>`
    ).join('')}</div>`;
};
window.selectHabitIcon = function (key) {
    const inp = document.getElementById('mHabitEmoji'); if (inp) inp.value = key;
    document.querySelectorAll('.hb-iconpick .hb-icon-opt').forEach(b => b.classList.toggle('sel', b.dataset.key === key));
};

/* Chronological rank for habit routine names so groups order Morning → Night
   (not alphabetically). Unknown names sort in the middle; "General" sorts last. */
window.routineRank = function (name) {
    const n = String(name || '').toLowerCase().trim();
    const order = ['dawn', 'early morning', 'morning', 'forenoon', 'noon', 'midday', 'afternoon', 'evening', 'night', 'late night', 'bedtime'];
    for (let i = 0; i < order.length; i++) if (n === order[i]) return i;
    for (let i = 0; i < order.length; i++) if (n.includes(order[i])) return i;
    if (n === 'general' || n === '') return 900;
    return 500;
};

async function apiCall(action, sheet, payload = {}, id = null) {

    let url = API_BASE;

    let options = {};



    if (action === 'get') {
        // Append timestamp to prevent caching
        url = `${API_BASE}?sheet=${sheet}&action=${action}&t=${Date.now()}`;
        options = { method: "GET" };
    } else {
        // For POST, send everything in the body to ensure GAS receives it correctly
        url = API_BASE;

        // Construct the full payload expected by the backend
        const bodyData = {
            action,
            sheet,
            id,
            payload
        };

        options = {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(bodyData)
        };
    }



    try {
        console.log(`API Request [${action} ${sheet}]:`, url, options);
        const res = await fetch(url, options);
        const json = await res.json();
        console.log(`API Response [${action} ${sheet}]:`, json);

        if (!json.success) {
            console.error(`[API Debug] Action failed [${action} ${sheet}]:`, json.message);
            throw new Error(json.message);
        }

        console.log(`[API Debug] Action success [${action} ${sheet}]. Data type:`, Array.isArray(json.data) ? `Array(${json.data.length})` : typeof json.data);

        // For 'get' requests, return the data array directly for compatibility
        if (action === 'get') {
            return json.data || [];
        }

        // For all other actions (create, update, delete, init), return the full JSON response
        return json;

    } catch (e) {
        console.error("API Error:", e);
        showToast("Error: " + e.message);
        return [];
    }
}

// --- LEGACY API WRAPPERS (For view-gym, view-notes etc) ---
async function apiGet(sheet, opts = {}) {
    // opts may contain month: "YYYY-MM"
    // apiCall(action, sheet, payload = {}, id = null)
    return await apiCall('get', sheet);
}

async function apiPost(sheetOrData, maybePayload) {
    if (!sheetOrData) return { success: false, message: 'No data' };

    let action, sheet, payload, id;

    if (typeof sheetOrData === 'string') {
        // Handle apiPost(sheet, payload)
        sheet = sheetOrData;
        payload = maybePayload;
        action = payload && payload.id ? 'update' : 'create';
        id = payload ? payload.id : null;
    } else {
        // Handle legacy apiPost({ action, sheet, payload, id })
        action = sheetOrData.action;
        sheet = sheetOrData.sheet;
        payload = sheetOrData.payload;
        id = sheetOrData.id;
    }

    const res = await apiCall(action, sheet, payload, id);
    return res;
}

async function initToolsSheets() {
    try {
        // Use apiCall instead of raw fetch to ensure POST request and proper error handling
        return await apiCall('init', 'tools');
    } catch (err) {
        console.error('Error initializing tools:', err);
    }
}

window.apiGet = apiGet;
window.apiPost = apiPost;
window.initToolsSheets = initToolsSheets;



// --- UTILS ---

function addLongPressListener(selector, callback) {
    document.addEventListener('mousedown', (_e) => { /* delegate? no, simpler to attach to body for dynamic items? */ });

    // Delegate approach for dynamic content
    let timer;
    const start = (e) => {
        const el = e.target.closest(selector);
        if (!el) return;
        timer = setTimeout(() => callback(el), 600);
    };
    const end = () => clearTimeout(timer);

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchmove', end); // Cancel on scroll

    document.addEventListener('mousedown', start);
    document.addEventListener('mouseup', end);
    document.addEventListener('mouseleave', end);
}

// --- ROUTING ---

// --- LAZY VIEW LOADING ---
// Each view's JS is loaded on demand the first time the user navigates to it.
// This drops the cold-start payload from ~2.7 MB to ~200 KB.
const VIEW_MAP = {
    dashboard:     { src: 'view-dashboard.js',     render: 'renderDashboard' },
    calendar:      { src: 'view-calendar.js',      render: 'renderCalendar' },
    tasks:         { src: 'view-tasks.js?v=2',     render: 'renderTasks' },
    finance:       { src: 'view-finance.js',       render: 'renderFinance' },
    habits:        { src: 'view-habits.js?v=3',    render: 'renderHabits' },
    diary:         { src: 'view-diary.js',         render: 'renderDiary' },
    vision:        { src: 'view-vision.js',        render: 'renderVision' },
    settings:      { src: 'view-settings.js',      render: 'renderSettings' },
    people:        { src: 'view-people.js',        render: 'renderPeople' },
    gym:           { src: 'view-gym.js',           render: 'renderGym' },
    notes:         { src: 'view-notes.js',         render: 'renderNotes' },
    chimes:        { src: 'view-chimes.js',        render: 'renderChimesView' },
    lifeCalendar:  { src: 'view-life-calendar.js', render: 'renderLifeCalendar' },
    pomodoro:      { src: 'view-pomodoro.js',      render: 'renderPomodoro' },
    books:         { src: 'view-books.js',         render: 'renderBooks' },
    reader:        { src: 'view-reader.js',        render: 'renderReader' },
    mural:         { src: 'view-mural.js?v=20260314-v3', render: 'renderMural' },
    tutor:         { src: 'view-tutor.js',         render: 'renderTutor' },
    meditation:    { src: 'view-meditation.js',    render: 'renderMeditation' }
};

const _loadedScripts = new Set();
function loadScript(src) {
    if (_loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        // Order matters because views attach to window globals
        s.async = false;
        s.onload = () => { _loadedScripts.add(src); resolve(); };
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
    });
}

async function ensureViewLoaded(viewName) {
    const entry = VIEW_MAP[viewName];
    if (!entry) return false;
    if (typeof window[entry.render] === 'function') return true;
    try {
        await loadScript(entry.src);
    } catch (e) {
        console.error('ensureViewLoaded:', e);
        return false;
    }
    return typeof window[entry.render] === 'function';
}
window.ensureViewLoaded = ensureViewLoaded;

async function routeTo(viewName) {
    // Cleanup any active intervals from specialized views
    if (typeof clearLifeTimer === 'function') clearLifeTimer();


    // Hash Routing
    if (window.location.hash !== '#' + viewName) {
        history.pushState(null, null, '#' + viewName);
    }

    // Back-stack: push the previous view so the Android back button can pop
    // through navigation history instead of jumping straight to dashboard.
    // routeTo(view, { fromBack: true }) is used by the back handler itself
    // to avoid pushing onto the stack while popping.
    if (!window._viewStack) window._viewStack = [];
    const opts = arguments[1] || {};
    if (!opts.fromBack && state.view && state.view !== viewName) {
        // Cap history at 20 entries to avoid unbounded growth on long sessions.
        window._viewStack.push(state.view);
        if (window._viewStack.length > 20) window._viewStack.shift();
    }

    state.view = viewName;

    // Publish the view change so any subscribers (analytics, breadcrumb,
    // future per-view stores) react without us calling them by name.
    if (window.personalStore) window.personalStore.notify('view');

    // Inject big page title into header bar (saas.css ::before reads this attr)
    const PAGE_TITLES = {
        dashboard: 'Dashboard', calendar: 'Planner', tasks: 'Tasks',
        finance: 'Finance', habits: 'Habits', diary: 'Diary',
        vision: 'Vision', people: 'People', books: 'Books',
        mural: 'Mural', settings: 'Settings', pomodoro: 'Pomodoro',
        notes: 'Notes', gym: 'Gym', chimes: 'Chimes', tutor: 'Tutor',
        meditation: 'Meditate', reader: 'Reader', lifeCalendar: 'Life'
    };
    const headerBar = document.querySelector('.main-header-bar');
    if (headerBar) headerBar.setAttribute('data-page-title', PAGE_TITLES[viewName] || '');

    // Inject contextual page-action icons — only on Dashboard.
    // Lumia: single Edit Tiles button (pencil); toggles tile edit mode.
    const pageActions = document.getElementById('pageActions');
    if (pageActions) {
        if (viewName === 'dashboard') {
            pageActions.innerHTML = `
                <button class="page-action-btn" id="lumiaEditBtn" onclick="toggleLumiaEditMode()" title="Edit tiles" aria-label="Edit tiles">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>
            `;
        } else if (viewName === 'diary') {
            pageActions.innerHTML = `
                <button onclick="openDiaryModal()" title="New entry" aria-label="New entry"
                    style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:9px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    New Entry
                </button>
            `;
        } else if (viewName === 'vision') {
            pageActions.innerHTML = `
                <button class="page-action-btn" onclick="openAffirmationManager()" title="Affirmations" aria-label="Affirmations">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button class="page-action-btn" onclick="startManifestationRitual()" title="Daily ritual" aria-label="Daily ritual">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2L12 3z"/></svg>
                </button>
                <button onclick="openVisionModal()" title="New goal" aria-label="New goal"
                    style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:9px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New goal
                </button>
            `;
        } else if (viewName === 'people') {
            pageActions.innerHTML = `
                <button onclick="openPersonModal()" title="Add person" aria-label="Add person"
                    style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:9px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add person
                </button>
            `;
        } else if (viewName === 'calendar') {
            pageActions.innerHTML = `
                <button onclick="openEventModal()" title="Add event" aria-label="Add event"
                    style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:9px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add event
                </button>
            `;
        } else if (viewName === 'finance') {
            pageActions.innerHTML = `
                <button onclick="openFinanceAction()" title="Add" aria-label="Add"
                    style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:9px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add new
                </button>
            `;
        } else {
            pageActions.innerHTML = '';
        }
    }


    // Re-apply tab visibility on every navigation — defensive against any code
    // path that re-renders the sidebar without re-applying the hidden list.
    if (typeof window.updateTabVisibility === 'function') {
        try { window.updateTabVisibility(); } catch (e) { console.warn('updateTabVisibility failed:', e); }
    }

    // Update Nav Active States
    document.querySelectorAll('.nav-item, .mob-item, .tab').forEach(el => {

        const target = el.dataset.target || (() => {
            const match = el.getAttribute('onclick')?.match(/'([^']+)'/);
            return match ? match[1] : null;
        })();

        el.classList.toggle('active', target === viewName);

    });




    const main = document.getElementById('main');

    // Guard: if main not found, wait and retry (max 5 times)
    if (!main) {
        if (!window._routeRetryCount) window._routeRetryCount = 0;
        if (window._routeRetryCount < 5) {
            window._routeRetryCount++;
            console.log('Main element not found, retrying... (' + window._routeRetryCount + ')');
            setTimeout(() => routeTo(viewName), 100);
        }
        return;
    }
    window._routeRetryCount = 0;

    // Page Transition
    main.classList.add('page-exit');
    main.classList.add('page-exit-active');

    setTimeout(async () => {
        main.innerHTML = `<div class="skeleton-container">
          <div class="skeleton-card">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line subtitle"></div>
            <div class="skeleton-row"><div class="skeleton-circle"></div><div class="skeleton-line body"></div></div>
            <div class="skeleton-row"><div class="skeleton-circle"></div><div class="skeleton-line body short"></div></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton-line body"></div>
            <div class="skeleton-line body short"></div>
            <div class="skeleton-line body"></div>
          </div>
        </div>`;

        main.classList.remove('page-exit', 'page-exit-active');
        main.classList.add('page-enter');

        // Lazy-load this view's JS, then call its render function.
        try {
            const entry = VIEW_MAP[viewName];
            if (!entry) {
                console.warn('Unknown view:', viewName);
                return;
            }
            const ready = await ensureViewLoaded(viewName);
            if (!ready) throw new Error('View module did not define ' + entry.render);
            // Guard: user may have routed away while the script was loading.
            if (state.view !== viewName) return;
            window[entry.render]();
        } catch (e) {
            console.error('Error rendering view ' + viewName + ':', e);
            main.innerHTML = '<div style="padding:20px; color:red">Error loading view: ' + viewName + '<br><small>' + e.message + '</small></div>';
        }

        // Initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            requestAnimationFrame(() => lucide.createIcons());
        }

        // Enter Animation
        requestAnimationFrame(() => {
            main.classList.add('page-enter-active');
            setTimeout(() => {
                main.classList.remove('page-enter', 'page-enter-active');
            }, 300);
        });

    }, 200); // Wait for exit animation

}



async function initApp() {

    if (document.getElementById('dateToday')) {

        document.getElementById('dateToday').innerText = new Date().toDateString();

    }

    console.log('initApp: Starting...');

    // Register Service Worker (PWA only — disabled on Capacitor native because
    // SW + capacitor:// asset scheme is a known conflict that breaks asset loading)
    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNative && 'serviceWorker' in navigator) {
        try {
            const swPath = `${window.location.pathname.replace(/\/$/, '')}/sw.js`;
            const registration = await navigator.serviceWorker.register(swPath, {
                scope: `${window.location.pathname.replace(/\/$/, '')}/`
            });
            console.log('[SW] Registered:', registration.scope);
        } catch (error) {
            console.error('[SW] Registration failed:', error.message);
        }
    }

    // Render shell IMMEDIATELY with cached/empty state — do not block first paint
    // on a network round-trip to Apps Script.
    if (typeof renderAllIcons === 'function') renderAllIcons();
    routeTo('dashboard');

    // Hydrate path:
    //   1. Try the WorkManager-cached server data FIRST (instant — already on disk
    //      from the last background sync). This lets the dashboard show real numbers
    //      before any network request finishes.
    //   2. Then kick off a fresh network fetch.
    //   3. Configure + schedule the WorkManager periodic sync so next time the
    //      app opens (or when widgets update) the data is already fresh.
    hydrateFromBackgroundCache();
    loadAllData()
        .then(() => {
            console.log('initApp: Data loaded.');
            state._lastLoadedAt = Date.now();
            if (state.view) routeTo(state.view);
        })
        .catch(e => console.error('initApp: background load failed:', e));

    // Schedule WorkManager periodic sync (Android only — no-op elsewhere)
    scheduleBackgroundSync();

    // Hide native splash screen as soon as the shell is up
    if (window.Capacitor?.Plugins?.SplashScreen) {
        window.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
    }

    // Initialize Long Press for Context Menus (Future Proofing)
    console.log('initApp: Initializing helpers...');
    try {
        addLongPressListener('.dash-card, .list-item', (el) => {
            el.style.transform = 'scale(0.98)';
            setTimeout(() => el.style.transform = '', 200);
            if (navigator.vibrate) navigator.vibrate(50);
        });
    } catch (e) { console.error('Error initializing long press:', e); }

    // Update widgets when app returns to foreground
    // Refresh data on resume:
    //   - widget data: every time we come back
    //   - full data: only if > 5 minutes since last load (avoid hammering
    //     Apps Script every time the user briefly checks another app)
    const STALE_AFTER_MS = 5 * 60 * 1000;
    state._lastLoadedAt = Date.now();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (typeof updateWidgetData === 'function') updateWidgetData();

        const elapsed = Date.now() - (state._lastLoadedAt || 0);
        if (elapsed > STALE_AFTER_MS) {
            console.log('[Resume] Data is', Math.round(elapsed / 1000), 's old — refreshing in background');
            loadAllData()
                .then(() => {
                    state._lastLoadedAt = Date.now();
                    if (state.view) routeTo(state.view);
                })
                .catch(e => console.warn('[Resume] Background refresh failed:', e?.message));
        }
    });

    // Deep linking from widgets, app shortcuts, and shared content.
    // Supported URI shapes:
    //   personalos://tasks                  → just route
    //   personalos://tasks?action=add       → route + open the "add" modal
    //   personalos://diary?action=add&text=...  → route + prefill body
    //   personalos://pomodoro?action=start  → route + start a session
    if (window.Capacitor?.Plugins?.App) {
        window.Capacitor.Plugins.App.addListener('appUrlOpen', (event) => {
            const url = event.url || '';
            console.log('[DeepLink] Opening:', url);
            if (!url.startsWith('personalos://')) return;
            const rest = url.replace('personalos://', '');
            const [path, query = ''] = rest.split('?');
            const params = Object.fromEntries(new URLSearchParams(query).entries());
            if (!path) return;

            // Route first; views look at window._pendingDeepLinkAction after render.
            window._pendingDeepLinkAction = { view: path, action: params.action, params };
            routeTo(path);
            // After a brief delay (let the lazy-loaded view define its render fn
            // and finish initial render), give the view a chance to react.
            setTimeout(() => handlePendingDeepLinkAction(), 300);
        });

        // Android hardware/gesture back button handling.
        // Priority: 1) close open overlay, 2) pop view stack, 3) exit if on root.
        window.Capacitor.Plugins.App.addListener('backButton', () => {
            // 1) If a modal/overlay is open, close it first
            const overlay = document.querySelector(
                '.modal-overlay[style*="flex"], .modal[style*="flex"], ' +
                '#activeHabitAlarmOverlay, .bottom-sheet.open, .drawer.open'
            );
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('open');
                return;
            }

            // 2) Pop the view stack
            const stack = window._viewStack || [];
            if (stack.length > 0) {
                const previous = stack.pop();
                routeTo(previous, { fromBack: true });
                return;
            }

            // 3) On root view with empty stack — exit
            if (state.view !== 'dashboard') {
                routeTo('dashboard', { fromBack: true });
            } else {
                window.Capacitor.Plugins.App.exitApp();
            }
        });
    }
}

// --- ACTIVE HABIT ALARM (Forces Typing to Dismiss) ---
// Moved to main.js to ensure it's globally available before any specific view script loads
window.openActiveHabitAlarm = function (habitId, habitName) {
    // Remove existing if any
    const existing = document.getElementById('activeHabitAlarmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'activeHabitAlarmOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: var(--surface-1); z-index: 100000;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px; text-align: center; animation: pulse-bg 2s infinite alternate;
    `;

    // Start blaring sound via Native Audio to bypass iOS WebKit AutoPlay Sandbox
    let hasNativeAudio = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeAudio;
    let fallbackAudio = null;

    // Use user-selected sound or default to urgency alarm
    let activeSound = (window.notificationState && window.notificationState.sound && window.notificationState.sound !== 'default')
        ? window.notificationState.sound
        : 'alarm_fast_10s.wav';

    // Verify sound exists, fallback to classic if unknown
    const knownSounds = ['beep', 'chime', 'classic'];
    const soundName = activeSound.split('.')[0];
    if (!knownSounds.includes(soundName.toLowerCase())) {
        console.warn(`Sound "${activeSound}" not found in local assets. Falling back to classic.`);
        activeSound = 'classic.wav';
    }

    // For iOS, convert .wav to .caf format
    if (activeSound.includes('.wav')) {
        activeSound = activeSound.replace('.wav', '.caf');
    } else if (!activeSound.includes('.')) {
        activeSound += '.caf';
    }

    if (hasNativeAudio) {
        window.Capacitor.Plugins.NativeAudio.preload({
            assetId: 'habit_alarm',
            assetPath: 'assets/sounds/' + activeSound,
            audioChannelNum: 1,
            isUrl: false
        }).catch(e => {
            console.error("NativeAudio preload failed", e);
            fallbackAudio = new Audio('assets/sounds/' + activeSound.replace('.caf', '.wav'));
            fallbackAudio.loop = true;
            fallbackAudio.play().catch(err => console.error("Fallback audio play blocked", err));
        });
    } else {
        fallbackAudio = new Audio('assets/sounds/' + activeSound.replace('.caf', '.wav'));
        fallbackAudio.loop = true;
        fallbackAudio.play().catch(e => console.error("Audio auto-play blocked", e));
    }

    overlay.innerHTML = `
      <style>
        @keyframes pulse-bg { 0% { background: var(--surface-1); } 100% { background: #fee2e2; } }
        .alarm-title { font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 16px; animation: shake 0.5s infinite; }
        @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } 100% { transform: translateX(0); } }
        .alarm-input { width: 100%; max-width: 300px; padding: 16px; font-size: 18px; text-align: center; border-radius: 12px; border: 2px solid #ef4444; margin-bottom: 24px; }
        .alarm-label { color: var(--text-2); font-size: 14px; margin-bottom: 8px; font-weight: 600; }
      </style>
      <div style="font-size: 64px; margin-bottom: 16px;">⏰</div>
      <div class="alarm-title">It's Time!</div>
      <div style="font-size: 20px; font-weight: 600; margin-bottom: 32px;">${habitName}</div>
      <div class="alarm-label">Type the habit name above exactly to dismiss:</div>
      <div style="font-weight: 800; font-size: 16px; margin-bottom: 16px; user-select: none; background: var(--surface-2); padding: 8px 16px; border-radius: 8px;">${habitName}</div>
      <input type="text" id="alarmDismissInput" class="alarm-input" placeholder="Type here..." autocomplete="off">
      <button id="alarmEmergencyBtn" class="btn secondary" style="opacity: 0.5; margin-top: 32px;">Emergency Override (Skip)</button>
    `;

    document.body.appendChild(overlay);

    // Enforce infinite looping for fallback audio explicitly in case standard .loop fails on older Safari
    if (fallbackAudio) {
        fallbackAudio.addEventListener('ended', function () {
            this.currentTime = 0;
            this.play();
        }, false);
    }

    const input = document.getElementById('alarmDismissInput');
    input.focus();

    input.addEventListener('input', function () {
        if (this.value === habitName) {
            if (hasNativeAudio) {
                window.Capacitor.Plugins.NativeAudio.stop({ assetId: 'habit_alarm' }).catch(() => { });
                window.Capacitor.Plugins.NativeAudio.unload({ assetId: 'habit_alarm' }).catch(() => { });
            }
            if (fallbackAudio) fallbackAudio.pause();
            overlay.remove();

            showToast("Habit alarm dismissed", "success");
        }
    });

    // Assign audio object to local variable so arrow functions can access it
    const btn = document.getElementById('alarmEmergencyBtn');
    btn.onclick = () => {
        if (hasNativeAudio) {
            window.Capacitor.Plugins.NativeAudio.stop({ assetId: 'habit_alarm' }).catch(() => { });
            window.Capacitor.Plugins.NativeAudio.unload({ assetId: 'habit_alarm' }).catch(() => { });
        }
        if (fallbackAudio) fallbackAudio.pause();
        overlay.remove();
    };
};

// IMMEDIATELY ATTACH LISTENER (Prevents missing events on cold start)
// If Capacitor is loading injecting late, we poll for a split second to attach right when it's ready.
(function attachCapacitorListener() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
            console.log('Notification action performed (Cold Start Safe Hook)', notificationAction);
            try {
                let extra = notificationAction.notification.extra;
                console.log('[Notification Debug] Raw extra:', extra);

                if (typeof extra === 'string') {
                    try { extra = JSON.parse(extra); } catch (e) { }
                }

                if (extra && extra.habit_id && extra.habit_name) {
                    console.log('[Notification Debug] Habit Match! Name:', extra.habit_name);
                    setTimeout(() => {
                        if (state.view !== 'habits') routeTo('habits');
                        setTimeout(() => {
                            if (typeof window.openActiveHabitAlarm === 'function') {
                                window.openActiveHabitAlarm(extra.habit_id, extra.habit_name);
                            }
                        }, 800);
                    }, 1000);
                } else if (notificationAction.notification.title === '⏰ Habit Alarm' || (notificationAction.notification.body && notificationAction.notification.body.includes('Time for your habit'))) {
                    console.log('[Notification Debug] Match via Title/Body fallback!');
                    const bodyStr = notificationAction.notification.body || '';
                    const nameParts = bodyStr.split('Time for your habit: ');
                    const derivedName = nameParts.length > 1 ? nameParts[1].trim() : 'Habit';
                    const derivedId = 'system_recovered_id';
                    setTimeout(() => {
                        if (state.view !== 'habits') routeTo('habits');
                        setTimeout(() => {
                            if (typeof window.openActiveHabitAlarm === 'function') {
                                window.openActiveHabitAlarm(derivedId, derivedName);
                            }
                        }, 800);
                    }, 1000);
                }
            } catch (e) { console.error("[Notification Debug] Action error", e); }
        });
    } else {
        // Poll for Capacitor (in case script ordering places this before capacitor.js)
        setTimeout(attachCapacitorListener, 100);
    }
})();

function showToast(msg, type = 'default', undoCallback = null) {
    let t = document.getElementById('toast');
    if (!t) { console.log('Toast:', msg); return; }

    // Type styles
    const colors = {
        success: 'linear-gradient(135deg,#10B981,#059669)',
        error: 'linear-gradient(135deg,#EF4444,#DC2626)',
        default: null
    };

    if (undoCallback) {
        t.innerHTML = `<span>${msg}</span> <button id="toast-undo-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; font-weight:700; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px; margin-left:12px;">UNDO</button>`;
    } else {
        t.innerText = msg;
    }

    t.style.background = colors[type] || '';
    t.style.color = colors[type] ? 'white' : '';

    // Spring slide-up animation
    t.classList.remove('toast-visible');
    void t.offsetWidth; // force reflow
    t.classList.add('toast-visible');

    if (undoCallback) {
        document.getElementById('toast-undo-btn').onclick = () => {
            t.classList.remove('toast-visible'); // Hide immediately immediately
            undoCallback();
        }
    }

    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('toast-visible'), undoCallback ? 5000 : 3000);
}

// Micro-interaction: Save flash
window.showSaveLock = function () {
    let lock = document.getElementById('save-lock-flash');
    if (!lock) {
        lock = document.createElement('div');
        lock.id = 'save-lock-flash';
        lock.innerHTML = typeof renderIcon === 'function' ? renderIcon('save', null, 'style="width:48px; color:white;"') : '💾';
        Object.assign(lock.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%) scale(0)',
            background: 'rgba(0,0,0,0.7)', borderRadius: '24px', padding: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: '9999', opacity: '0', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });
        document.body.appendChild(lock);
    }

    // Trigger animation
    lock.style.opacity = '1';
    lock.style.transform = 'translate(-50%, -50%) scale(1)';

    if (navigator.vibrate) navigator.vibrate(20);

    setTimeout(() => {
        lock.style.opacity = '0';
        lock.style.transform = 'translate(-50%, -50%) scale(0.5)';
    }, 600);
};

/* ─── CONFETTI HELPER ─── */
window.triggerConfetti = function (duration = 1500) {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const pieces = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: 8 + Math.random() * 8,
        h: 4 + Math.random() * 4,
        color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9A3C'][Math.floor(Math.random() * 6)],
        rot: Math.random() * 360,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        vr: (Math.random() - 0.5) * 6
    }));
    const start = Date.now();
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
            p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        });
        if (Date.now() - start < duration) requestAnimationFrame(draw);
        else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); }
    }
    draw();
};
window.triggerConfettiBurst = window.triggerConfetti; // Alias for compatibility

/* ─── FOCUS MODE ─── */
window.openFocusMode = function () {
    // NOTE: Actual implementation is defined below (line ~593)
    // This stub is kept to avoid ReferenceError before the full definition loads.
    // The second definition overwrites this one.
};

window.closeFocusMode = function () {
    const focusOverlay = document.getElementById('focusModeOverlay') || document.getElementById('focus-overlay');
    if (focusOverlay) focusOverlay.remove();
};

function renderFocusContent() {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = (state.data.tasks || []).filter(t => t.status !== 'completed' && (t.priority === 'P1' || t.due_date === today)).slice(0, 5);
    const habits = (state.data.habits || []).filter(h => {
        const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        if (h.frequency && h.frequency !== 'daily' && !h.frequency.includes(todayDayName)) return false;
        const exists = (state.data.habit_logs || []).some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today));
        return !exists;
    }).slice(0, 5);

    const taskItems = tasks.map(t => `
        <div class="focus-item" onclick="closeFocusMode(); routeTo('tasks')">
            <div class="focus-item-checkbox"></div>
            <div class="focus-item-text">${t.title}</div>
            <div class="focus-priority">${t.priority}</div>
        </div>
    `).join('');

    const habitItems = habits.map(h => `
        <div class="focus-item" onclick="closeFocusMode(); routeTo('habits')">
            <div class="focus-item-icon">${h.icon || '🔥'}</div>
            <div class="focus-item-text">${h.habit_name}</div>
        </div>
    `).join('');

    return `
        <section class="focus-section">
            <div class="section-label">Critical Tasks</div>
            ${taskItems || '<div class="focus-empty">No urgent tasks for today</div>'}
        </section>
        <section class="focus-section">
            <div class="section-label">Habits to Complete</div>
            ${habitItems || '<div class="focus-empty">All habits for today are done!</div>'}
        </section>
        <div style="margin-top:auto; padding:20px; text-align:center;">
             <button class="btn primary" style="width:100%" onclick="closeFocusMode()">I'm Ready</button>
        </div>
    `;
}
window.triggerConfettiBurst = window.triggerConfetti; // Alias for compatibility

/* ─── SWIPE ACTION HELPER ─── */
window.addSwipeAction = function (el, onSwipeLeft, onSwipeRight) {
    let startX = 0, startY = 0, moved = false;
    let threshold = 60;

    el.addEventListener('touchstart', e => {
        console.log('[Swipe] touchstart on', el.id);
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        moved = false;
        el.style.transition = '';
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) return; // ignore vertical scrolls

        // Prevent the page from panning horizontally while swiping a card
        e.preventDefault();

        moved = true;
        const container = el.closest('.swipe-reveal-container');
        const bgDone = container ? container.querySelector('.swipe-bg-done') : null;
        const bgDelete = container ? container.querySelector('.swipe-bg-delete') : null;
        const progress = Math.min(Math.abs(dx) / threshold, 1);

        if (dx > 0 && onSwipeRight) {
            el.style.transform = `translateX(${Math.min(dx, 120)}px)`;
            if (bgDone) {
                bgDone.style.opacity = progress;
                bgDone.style.transform = `scale(${0.6 + progress * 0.4})`;
            }
            if (bgDelete) bgDelete.style.opacity = '0';
        } else if (dx < 0 && onSwipeLeft) {
            el.style.transform = `translateX(${Math.max(dx, -120)}px)`;
            if (bgDelete) {
                bgDelete.style.opacity = progress;
                bgDelete.style.transform = `scale(${0.6 + progress * 0.4})`;
            }
            if (bgDone) bgDone.style.opacity = '0';
        }
    }, { passive: false });

    el.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        console.log('[Swipe] touchend dx:', dx, 'threshold:', threshold);
        el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = 'translateX(0)';

        const container = el.closest('.swipe-reveal-container');
        if (container) {
            const bgs = container.querySelectorAll('.swipe-bg');
            bgs.forEach(bg => {
                bg.style.transition = 'opacity 0.3s, transform 0.3s';
                bg.style.opacity = '0';
                bg.style.transform = 'scale(0.5)';
            });
        }

        setTimeout(() => {
            el.style.transition = '';
            if (container) {
                container.querySelectorAll('.swipe-bg').forEach(bg => bg.style.transition = '');
            }
        }, 300);

        if (!moved) return;
        if (dx < -threshold && onSwipeLeft) {
            console.log('[Swipe] Triggering swipe left');
            if (window.Capacitor && window.Capacitor.Plugins.Haptics) window.Capacitor.Plugins.Haptics.impact({ style: 'medium' });
            setTimeout(onSwipeLeft, 200);
        }
        if (dx > threshold && onSwipeRight) {
            console.log('[Swipe] Triggering swipe right');
            if (window.Capacitor && window.Capacitor.Plugins.Haptics) window.Capacitor.Plugins.Haptics.impact({ style: 'medium' });
            setTimeout(onSwipeRight, 200);
        }
    });
};



function isoDate() { return new Date().toISOString().slice(0, 10); }

/* ═══════════════════════════════════════════════
   🎯  FOCUS MODE — today's habits + tasks + event
═══════════════════════════════════════════════ */
window.openFocusMode = function () {
    const todayStr = isoDate();
    const habits = (state.data.habits || []).filter(h => window.habitScheduledToday(h));
    const logs = state.data.habit_logs || [];
    const tasks = (state.data.tasks || []).filter(t => t.status !== 'completed' && t.due_date <= todayStr && t.due_date);
    const events = (state.data.planner || []).filter(e => {
        if (!e.start_datetime) return false;
        const d = new Date(e.start_datetime);
        if (isNaN(d.getTime())) return false;
        return d.toISOString().slice(0, 10) === todayStr;
    }).sort((a, b) => (a.start_datetime || '').localeCompare(b.start_datetime || ''));

    const overlay = document.createElement('div');
    overlay.id = 'focus-overlay';
    overlay.className = 'focus-overlay';
    overlay.innerHTML = `
    <div class="focus-header">
      <h2>⚡ Focus Mode</h2>
      <button class="focus-close-btn" onclick="document.getElementById('focus-overlay').remove()">✕</button>
    </div>
    ${events.length > 0 ? `
    <div class="focus-section">
      <div class="focus-section-title">📅 Next Event</div>
      <div style="font-weight:600; font-size:15px;">${events[0].title}</div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${new Date(events[0].start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>` : ''}
    <div class="focus-section">
      <div class="focus-section-title">✅ Due Tasks (${tasks.length})</div>
      ${tasks.length === 0 ? '<div style="color:var(--text-muted);font-size:13px;">All done! 🎉</div>' :
            tasks.slice(0, 5).map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color);">
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid var(--primary);cursor:pointer;flex-shrink:0;" onclick="toggleTaskOptimistic('${t.id}');this.style.background='var(--primary)';"></div>
          <span style="font-size:14px;font-weight:500;">${t.title}</span>
          <span style="font-size:11px;color:var(--danger);margin-left:auto;">${t.due_date}</span>
        </div>`).join('')}
    </div>
    <div class="focus-section">
      <div class="focus-section-title">🔥 Today's Habits (${habits.length})</div>
      ${habits.length === 0 ? '<div style="color:var(--text-muted);font-size:13px;">No habits today.</div>' :
            habits.map(h => {
                const done = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(todayStr));
                return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color);">
            <div style="width:18px;height:18px;border-radius:50%;${done ? 'background:var(--primary);border:2px solid var(--primary);' : 'border:2px solid var(--border-color);'}cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;" onclick="toggleHabitOptimistic('${h.id}');this.style.background='var(--primary)';this.style.borderColor='var(--primary)';">
              ${done ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
            <span style="font-size:14px;font-weight:500;${done ? 'text-decoration:line-through;opacity:0.5;' : ''}">${h.habit_name}</span>
          </div>`;
            }).join('')}
    </div>
  `;
    document.body.appendChild(overlay);
};

/* ═══════════════════════════════════════════════
   🧾  QUICK LOG — log without navigating
═══════════════════════════════════════════════ */
window.showQuickLog = function (type = 'expense') {
    document.getElementById('quick-log-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.id = 'quick-log-sheet';
    sheet.className = 'quick-log-sheet';

    const content = {
        expense: `
      <div class="quick-log-handle"></div>
      <div style="font-weight:700;font-size:16px;margin-bottom:14px;">💸 Quick Expense</div>
      <input type="number" id="ql-amount" class="input" placeholder="Amount (₹)" autofocus style="margin-bottom:8px;">
      <input type="text" id="ql-note" class="input" placeholder="What for? (e.g. Coffee)" style="margin-bottom:14px;">
      <div style="display:flex;gap:8px;">
        <button class="btn secondary" style="flex:1;" onclick="document.getElementById('quick-log-sheet').remove()">Cancel</button>
        <button class="btn primary" style="flex:1;" onclick="window._quickSaveExpense()">Save ₹</button>
      </div>`,
        note: `
      <div class="quick-log-handle"></div>
      <div style="font-weight:700;font-size:16px;margin-bottom:14px;">📌 Quick Note</div>
      <input type="text" id="ql-title" class="input" placeholder="Title" style="margin-bottom:8px;">
      <textarea id="ql-note" class="input" placeholder="Note content..." rows="3" style="margin-bottom:14px;"></textarea>
      <div style="display:flex;gap:8px;">
        <button class="btn secondary" style="flex:1;" onclick="document.getElementById('quick-log-sheet').remove()">Cancel</button>
        <button class="btn primary" style="flex:1;" onclick="window._quickSaveNote()">Save Note</button>
      </div>`,
        habit: `
      <div class="quick-log-handle"></div>
      <div style="font-weight:700;font-size:16px;margin-bottom:12px;">🔥 Quick Habit Log</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:250px;overflow-y:auto;margin-bottom:14px;">
        ${(state.data.habits || []).map(h => {
            const done = (state.data.habit_logs || []).some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(isoDate()));
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--surface-2);border-radius:10px;cursor:pointer;${done ? 'opacity:0.5' : ''}" onclick="toggleHabitOptimistic('${h.id}'); showToast('${h.habit_name} logged!','success'); this.style.opacity='0.5';">
            <div style="font-size:20px;">${done ? '✅' : '⬜'}</div>
            <div style="font-weight:500;">${h.habit_name}</div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn secondary" style="width:100%;" onclick="document.getElementById('quick-log-sheet').remove()">Done</button>`
    };

    sheet.innerHTML = content[type] || content.expense;
    document.body.appendChild(sheet);

    window._quickSaveExpense = async () => {
        const amount = document.getElementById('ql-amount')?.value;
        const note = document.getElementById('ql-note')?.value || 'Quick expense';
        if (!amount) { showToast('Enter amount', 'error'); return; }
        await apiCall('create', 'expenses', { amount: Number(amount), type: 'expense', date: isoDate(), description: note, category: 'General' });
        const newExp = { id: 'tmp-' + Date.now(), amount: Number(amount), type: 'expense', date: isoDate(), notes: note, category: 'General' };
        if (!state.data.expenses) state.data.expenses = [];
        state.data.expenses.push(newExp);
        document.getElementById('quick-log-sheet').remove();
        showToast('₹' + amount + ' logged!', 'success');
    };

    window._quickSaveNote = async () => {
        const title = document.getElementById('ql-title')?.value || 'Quick Note';
        const note = document.getElementById('ql-note')?.value || '';
        if (!note.trim()) { showToast('Enter note content', 'error'); return; }
        await apiCall('create', 'notes', { title, content: note, pinned: true, date: isoDate() });
        if (!state.data.notes) state.data.notes = [];
        state.data.notes.push({ id: 'tmp-' + Date.now(), title, content: note, pinned: true, date: isoDate() });
        document.getElementById('quick-log-sheet').remove();
        showToast('Note saved & pinned!', 'success');
    };

    // Close on outside tap — use non-transparent backdrop so iOS registers the tap
    setTimeout(() => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop-ios';
        backdrop.onclick = () => { sheet.remove(); backdrop.remove(); };
        document.body.insertBefore(backdrop, sheet);
        sheet.style.zIndex = '10000';
        backdrop.style.zIndex = '9999';
    }, 50);
};

/* ═══════════════════════════════════════════════
   📊  WEEKLY REVIEW — Sunday summary modal
═══════════════════════════════════════════════ */
window.openWeeklyReview = function () {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);
    const startStr = startOfWeek.toISOString().slice(0, 10);
    const todayStr = isoDate();

    const tasks = state.data.tasks || [];
    const habits = state.data.habits || [];
    const logs = state.data.habit_logs || [];
    const expenses = state.data.expenses || [];
    const diary = state.data.diary || [];

    const doneTasksThisWeek = tasks.filter(t => t.status === 'completed' && t.due_date >= startStr && t.due_date <= todayStr).length;
    const weekHabitsTotal = logs.filter(l => (l.date || '').slice(0, 10) >= startStr).length;
    const weekSpend = expenses.filter(e => e.type === 'expense' && (e.date || '').slice(0, 10) >= startStr).reduce((s, e) => s + Number(e.amount), 0);
    const weekDiary = diary.filter(d => (d.date || '').slice(0, 10) >= startStr).length;

    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    const dateRange = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    box.innerHTML = `
    <div class="modal-header-bar" style="background:linear-gradient(135deg,#7C3AED,#4F46E5); border-radius:20px 20px 0 0; display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div>
        <h3 style="margin:0 0 2px 0;">📊 Weekly Review</h3>
        <span style="color:rgba(255,255,255,0.75);font-size:12px;">${dateRange}</span>
      </div>
      <button onclick="document.getElementById('universalModal').classList.add('hidden')" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:36px;height:36px;font-size:18px;color:white;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:20px;">
      <div style="background:var(--surface-2);border-radius:16px;padding:20px;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:var(--success);line-height:1;">${doneTasksThisWeek}</div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Tasks Done</div>
      </div>
      <div style="background:var(--surface-2);border-radius:16px;padding:20px;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#FF6B35;line-height:1;">${weekHabitsTotal}</div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Habit Logs</div>
      </div>
      <div style="background:var(--surface-2);border-radius:16px;padding:20px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--danger);line-height:1;">₹${weekSpend.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Spent</div>
      </div>
      <div style="background:var(--surface-2);border-radius:16px;padding:20px;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:var(--primary);line-height:1;">${weekDiary}</div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Diary Entries</div>
      </div>
    </div>
    <div style="padding:0 20px 10px;text-align:center;font-size:14px;color:var(--text-muted);">
      ${doneTasksThisWeek === 0 && weekHabitsTotal < 3 ? "Let's do better next week 💪" :
            doneTasksThisWeek >= 5 ? "Incredible week! 🚀 You crushed it!" :
                "Good progress this week! Keep it up 🌟"}
    </div>
    <div style="padding:0 20px 20px;">
      <button class="btn primary" style="width:100%;border-radius:14px;padding:14px;font-size:15px;touch-action:manipulation;" onclick="document.getElementById('universalModal').classList.add('hidden')">
        Close Review
      </button>
    </div>
  `;
    modal.classList.remove('hidden');

};

/* ═══════════════════════════════════════════════
   🌅  MORNING BRIEFING — 8am push notification
═══════════════════════════════════════════════ */
function scheduleMorningBriefing() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const delay = target - now;

    setTimeout(() => {
        const todayStr = isoDate();
        const pendingTasks = (state.data.tasks || []).filter(t => t.status !== 'completed' && t.due_date === todayStr).slice(0, 3);
        const pendingHabits = (state.data.habits || []).filter(h => window.habitScheduledToday(h));

        const taskNames = pendingTasks.map(t => t.title).join(', ') || 'No tasks due today';
        const body = `${pendingHabits.length} habits to do. Tasks: ${taskNames}`;

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('☀️ Good morning! Your daily briefing:', { body, icon: '/icon-192.png' });
        }
        // Also re-schedule for tomorrow
        scheduleMorningBriefing();
    }, delay);
}

// Auto-trigger Weekly Review on Sundays (once per session)
function checkWeeklyReview() {
    const day = new Date().getDay(); // 0 = Sunday
    const lastShown = localStorage.getItem('weeklyReviewShown');
    const todayStr = (typeof isoDate === 'function') ? isoDate() : new Date().toISOString().slice(0, 10);
    if (day === 0 && lastShown !== todayStr) {
        setTimeout(() => {
            if (typeof openWeeklyReview === 'function') {
                openWeeklyReview();
                localStorage.setItem('weeklyReviewShown', todayStr);
            }
        }, 3000);
    }
}

// Still call it immediately for new sessions (if it's Sunday)
checkWeeklyReview();



window.addEventListener('hashchange', () => {
    const view = window.location.hash.slice(1);
    if (view && view !== state.view) {
        routeTo(view);
    }
});

// Initial Route Check
const initialHash = window.location.hash.slice(1);
if (initialHash) {
    // Override default dashboard view if hash exists
    state.view = initialHash;
}

// --- GLOBAL EVENT LISTENER ---

document.addEventListener('click', async (e) => {

    const btn = e.target.closest('[data-action]');

    if (!btn) return;



    const action = btn.dataset.action;

    const id = btn.dataset.id;

    const sheet = btn.dataset.sheet;



    /* TASKS */

    if (action === 'add-task') {

        const input = document.getElementById('inputTask');

        if (input && input.value) {

            const title = input.value;

            input.value = '';

            await apiCall('create', 'tasks', { title, status: 'pending', created_at: isoDate() });

            await refreshData('tasks');

        }

    }

    else if (action === 'add-task-rich') {

        const title = document.getElementById('newTaskTitle').value;

        const prio = document.getElementById('newTaskPriority').value;

        const date = document.getElementById('newTaskDate').value;



        if (!title) { alert("Task title required"); return; }



        document.getElementById('newTaskTitle').value = '';

        document.getElementById('addTaskForm').classList.add('hidden');

        showToast("Adding task...");



        await apiCall('create', 'tasks', {

            title: title, priority: prio, due_date: date, status: 'pending', created_at: new Date().toISOString()

        });

        await refreshData('tasks');

    }

    else if (action === 'toggle-task') {

        const task = state.data.tasks.find(t => String(t.id) === String(id));

        if (task) {

            const newStatus = task.status === 'completed' ? 'pending' : 'completed';

            task.status = newStatus;

            if (state.view === 'tasks') renderTasks(document.querySelector('input[placeholder="Search..."]')?.value || '');

            await apiCall('update', 'tasks', { status: newStatus }, id);

        }

    }

    else if (action === 'add-task-modal') {

        const title = document.getElementById('mTaskTitle').value;

        const prio = document.getElementById('mTaskPriority').value;


        if (!title) return;

        document.getElementById('universalModal').classList.add('hidden');

        document.getElementById('mTaskTitle').value = '';

        showToast("Adding task...");


        await apiCall('create', 'tasks', { title, priority: prio, status: 'pending', created_at: new Date().toISOString() });

        await refreshData('tasks');

    }



    /* FINANCE */

    else if (action === 'add-expense') {

        const amt = document.getElementById('inputExpAmt').value;

        const cat = document.getElementById('inputExpCat').value;

        if (!amt) return;

        document.getElementById('inputExpAmt').value = '';

        await apiCall('create', 'expenses', { amount: amt, category: cat, date: isoDate() });

        await refreshData('finance');

    }



    /* HABITS */

    else if (action === 'add-habit') {

        const name = document.getElementById('inputHabit').value;

        if (!name) return;

        document.getElementById('inputHabit').value = '';

        await apiCall('create', 'habits', { habit_name: name, created_at: isoDate() });

        await refreshData('habits');

    }

    else if (action === 'toggle-habit') {

        const today = isoDate();
        const existingIdx = state.data.habit_logs.findIndex(l => String(l.habit_id) === String(id) && l.date.startsWith(today));

        // 1. Optimistic Update
        if (existingIdx !== -1) {
            // Remove locally
            const toDelete = state.data.habit_logs[existingIdx];
            state.data.habit_logs.splice(existingIdx, 1);
            if (state.view === 'habits') renderHabits(); // Re-render immediately

            // API Call
            await apiCall('delete', 'habit_logs', {}, toDelete.id);
        } else {
            // Add locally
            const newLog = { id: 'temp-' + Date.now(), habit_id: id, date: today, completed: true };
            state.data.habit_logs.push(newLog);
            if (state.view === 'habits') renderHabits(); // Re-render immediately

            // API Call
            await apiCall('create', 'habit_logs', { habit_id: id, date: today, completed: true });
        }

        // 2. Background Refresh to Ensure Sync
        // We don't await this to keep UI responsive, but we trigger it
        refreshData('habit_logs').then(() => {
            if (state.view === 'habits') renderHabits();
        });

    }



    /* DIARY & VISION */

    else if (action === 'save-diary') {

        const text = document.getElementById('inputDiary').value;

        if (!text) return;

        document.getElementById('inputDiary').value = '';

        await apiCall('create', 'diary', { content: text, date: isoDate() });

        await refreshData('diary');

    }

    else if (action === 'add-vision') {

        const title = document.getElementById('inputVisTitle').value;

        const img = document.getElementById('inputVisImg').value;

        if (!title) return;

        await apiCall('create', 'vision_board', { title, image_url: img, created_at: isoDate() });

        await refreshData('vision');

    }



    /* CALENDAR */

    else if (action === 'open-event-modal') {

        document.getElementById('eventModal').classList.remove('hidden');

    }

    else if (action === 'save-event') {

        const title = document.getElementById('evtTitle').value;

        const date = document.getElementById('evtDate').value;

        const start = document.getElementById('evtStart').value;

        const end = document.getElementById('evtEnd').value;
        const category = document.getElementById('evtCategory')?.value || 'General';

        if (!title || !date || !start || !end) { alert("Please fill all fields"); return; }

        document.getElementById('eventModal').classList.add('hidden');

        showToast("Saving event...");

        // Postgres timestamp columns need an ISO datetime string, NOT epoch ms.
        // A bare number like 1781773200000 fails with "date/time field value out of range".
        const startEpoch = `${date}T${start}:00`;
        const endEpoch = `${date}T${end}:00`;
        const color = document.getElementById('evtColor')?.value || '';

        // Optimistic UI Update
        const tempId = 'temp-' + Date.now();
        const newEvent = {
            id: tempId,
            title: title,
            start_datetime: startEpoch,
            end_datetime: endEpoch,
            category: category,
            color: color
        };
        state.data.planner = state.data.planner || [];
        state.data.planner.push(newEvent);
        if (state.view === 'calendar' && typeof renderCalendar === 'function') {
            renderCalendar();
        }

        try {
            await apiCall('create', 'planner_events', {
                title: title, start_datetime: startEpoch, end_datetime: endEpoch, category: category, color: color
            });
            await refreshData('planner_events');
        } catch (e) {
            console.error("Failed to save event", e);
            state.data.planner = state.data.planner.filter(e => e.id !== tempId);
            if (state.view === 'calendar') renderCalendar();
            showToast("Failed to save event");
        }
    }



    /* Add inside main.js click listener */

    // --- SAVE PEOPLE MODAL ---
    else if (action === 'save-person-modal') {
        const name = document.getElementById('mPersonName').value;
        const rel = document.getElementById('mPersonRel').value;
        const bday = document.getElementById('mPersonBday').value;
        const nextInt = document.getElementById('mPersonNextInt').value;
        const phone = document.getElementById('mPersonPhone')?.value || '';
        const email = document.getElementById('mPersonEmail')?.value || '';
        const notes = document.getElementById('mPersonNotes').value;

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Adding person...");

        await apiCall('create', 'people', {
            name: name, relationship: rel, birthday: bday, next_interaction: nextInt,
            phone: phone, email: email, notes: notes,
            created_at: new Date().toISOString()
        });
        await refreshData('people');
    }

    // --- SAVE FINANCE TRANSACTION ---



    // --- SAVE FINANCE TRANSACTION ---

    else if (action === 'save-tx-modal') {

        const amt = document.getElementById('mTxAmount').value;
        const cat = document.getElementById('mTxCategory').value;
        const type = document.getElementById('mTxType').value;
        const date = document.getElementById('mTxDate').value;
        const source = document.getElementById('mTxSource')?.value || '';
        const notes = document.getElementById('mTxNote')?.value || '';
        const payment_mode = document.getElementById('mTxPaymentMode')?.value || '';

        if (!amt) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast(`Adding ${type}...`);

        await apiCall('create', 'expenses', {
            amount: amt,
            category: cat,
            type: type,
            date: date,
            source: source,
            description: notes,
            payment_mode: payment_mode
        });

        await refreshData('finance');

    }



    // --- SAVE FUND ---

    else if (action === 'save-fund-modal') {

        const name = document.getElementById('mFundName').value;

        const target = document.getElementById('mFundTarget').value;

        const current = document.getElementById('mFundCurrent').value;



        if (!name) return;

        document.getElementById('universalModal').classList.add('hidden');

        showToast("Adding fund...");



        await apiCall('create', 'funds', {

            fund_name: name,

            target_amount: target,

            current_amount: current

        });

        await refreshData('finance');

    }



    // --- SAVE ASSET ---

    else if (action === 'save-asset-modal') {

        const name = document.getElementById('mAssetName').value;

        const type = document.getElementById('mAssetType').value;

        const value = document.getElementById('mAssetValue').value;



        if (!name) return;

        document.getElementById('universalModal').classList.add('hidden');

        showToast("Adding asset...");



        await apiCall('create', 'assets', {

            asset_name: name,

            type: type,

            value: value

        });

        await refreshData('finance');

    }





    /* Add this inside the document.addEventListener('click') block in main.js */



    // --- SAVE VISION MODAL ---

    else if (action === 'save-vision-modal') {

        const title = document.getElementById('mVisTitle').value;

        const img = document.getElementById('mVisImg').value;

        const cat = document.getElementById('mVisCat').value;

        const date = document.getElementById('mVisDate').value;

        const notes = document.getElementById('mVisNotes').value;



        if (!title) { alert("Give your goal a title!"); return; }


        document.getElementById('universalModal').classList.add('hidden');

        showToast("Manifesting goal...");



        await apiCall('create', 'vision_board', {

            title: title,

            image_url: img,

            category: cat,

            target_date: date,

            notes: notes,

            created_at: new Date().toISOString()

        });


        await refreshData('vision');

    }





    /* Add this inside the document.addEventListener('click') block in main.js */



    // --- SAVE DIARY MODAL ---

    else if (action === 'save-diary-modal') {

        // Handle rich text editor (contenteditable)
        const diaryTextEl = document.getElementById('mDiaryText');
        const text = diaryTextEl ? diaryTextEl.innerText : '';

        const mood = document.getElementById('mMoodScore').value;

        const tags = document.getElementById('mDiaryTags').value;

        const date = document.getElementById('mDiaryDate').value;



        if (!text || !text.trim()) { alert("Please write something!"); return; }


        document.getElementById('universalModal').classList.add('hidden');

        showToast("Saving entry...");



        await apiCall('create', 'diary', {

            content: text,

            mood: mood,

            tags: tags,

            date: date

        });


        await refreshData('diary');

    }



    /* Add this inside the document.addEventListener('click', ...) block in main.js */



    // ... previous blocks ...



    // --- SAVE HABIT MODAL ---

    // --- SAVE HABIT MODAL ---

    else if (action === 'save-habit-modal') {
        const name = document.getElementById('mHabitName').value;
        const cat = document.getElementById('mHabitCat').value;
        const freq = document.getElementById('mHabitFreq').value;
        const days = typeof getSelectedDays === 'function' ? getSelectedDays('mHabitDays') : '';

        // Debug: find ALL elements with mHabitTime in the modal
        const modal = document.getElementById('universalModal');
        const allTimeInputs = modal ? modal.querySelectorAll('#mHabitTime') : [];
        console.log('[Habit Save] All #mHabitTime elements in modal:', allTimeInputs.length, allTimeInputs);

        const timeEl = document.getElementById('mHabitTime');
        const time = timeEl ? timeEl.value : '';
        const emoji = document.getElementById('mHabitEmoji')?.value || '✨';

        console.log('[Habit Save] Current mHabitTime value:', time, 'element:', timeEl);

        const durationEl = document.getElementById('mHabitDuration');
        const duration = durationEl ? parseInt(durationEl.value, 10) || 45 : 45;
        const pomoEl = document.getElementById('mHabitPomoSessions');
        const pomoSessions = pomoEl ? parseInt(pomoEl.value, 10) || 0 : 0;
        const pomoLenEl = document.getElementById('mHabitPomoLength');
        const pomoLength = pomoLenEl ? parseInt(pomoLenEl.value, 10) || 25 : 25;
        const routineEl = document.getElementById('mHabitRoutine');
        const routine = routineEl ? routineEl.value.trim() : '';

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Creating habit...");
        const habitPayload = {
            habit_name: name, category: cat,
            frequency: freq === 'weekly' ? ('weekly:' + days) : (freq || 'daily'),
            reminder_time: time,
            duration: duration,
            emoji: emoji,
            pomodoro_sessions: pomoSessions,
            pomodoro_length: pomoLength,
            routine: routine,
            created_at: new Date().toISOString()
        };
        console.log('[Habit Save] Final payload:', habitPayload);
        await apiCall('create', 'habits', habitPayload);
        await refreshData('habits');
        // Sync native alarms so new habit's reminder is registered with iOS immediately
        if (typeof window.syncNativeNotifications === 'function') setTimeout(window.syncNativeNotifications, 500);
    }

    // --- SAVE TASK MODAL (from openTaskModal) ---
    else if (action === 'save-task-modal') {
        const title = document.getElementById('mTaskTitle').value;
        const desc = document.getElementById('mTaskDesc').value;
        const cat = document.getElementById('mTaskCategory').value;
        const tags = document.getElementById('mTaskTags').value;

        // Collect Subtasks (Robust)
        const subtasks = [];
        document.querySelectorAll('#mSubtaskList > div').forEach(div => {
            const txtInput = div.querySelector('.subtask-text');
            const chkInput = div.querySelector('.subtask-check');
            if (txtInput && txtInput.value.trim()) {
                subtasks.push({
                    text: txtInput.value.trim(),
                    done: chkInput ? chkInput.checked : false
                });
            }
        });

        const prio = document.getElementById('mTaskPriority').value;
        const date = document.getElementById('mTaskDate')?.value;
        const time = document.getElementById('mTaskTime')?.value;
        const duration = parseInt(document.getElementById('mTaskDuration')?.value) || 30;
        const recurrence = document.getElementById('mTaskRecurrence')?.value || 'none';
        const recurrenceEnd = document.getElementById('mTaskRecurrenceEnd')?.value || '';
        const pomoEstimate = parseInt(document.getElementById('mTaskPomoEstimate')?.value) || 0;
        const pomoLength = parseInt(document.getElementById('mTaskPomoLength')?.value) || 25;
        let recurrenceDays = '';
        if (recurrence === 'weekly') {
            const checkedBoxes = document.getElementById('universalModal').querySelectorAll('.task-day-check:checked');
            recurrenceDays = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        }

        const visionId = document.getElementById('mTaskVisionGoal')?.value || '';

        if (!title) { showToast("Title required"); return; }

        document.getElementById('universalModal').classList.add('hidden');
        showToast("Creating task...");
        await apiCall('create', 'tasks', {
            title, description: desc, category: cat, tags: tags,
            vision_id: visionId,
            subtasks: JSON.stringify(subtasks),
            priority: prio, due_date: date || '', due_time: time || '',
            duration: duration,
            recurrence, recurrence_days: recurrenceDays, recurrence_end: recurrenceEnd,
            pomodoro_estimate: pomoEstimate,
            pomodoro_length: pomoLength,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        await refreshData('tasks');
    }




    // ============================================================
    // UPDATE HANDLERS (edit existing entries)
    // ============================================================

    else if (action === 'update-task-modal') {
        const editId = btn.dataset.editId; // from button
        const title = document.getElementById('mTaskTitle').value;
        const desc = document.getElementById('mTaskDesc').value;
        const cat = document.getElementById('mTaskCategory').value;
        const tags = document.getElementById('mTaskTags').value;

        // Collect Subtasks
        const subtasks = [];
        document.querySelectorAll('#mSubtaskList > div').forEach(div => {
            const txtInput = div.querySelector('.subtask-text');
            const chkInput = div.querySelector('.subtask-check');
            if (txtInput && txtInput.value.trim()) {
                subtasks.push({
                    text: txtInput.value.trim(),
                    done: chkInput ? chkInput.checked : false
                });
            }
        });

        const prio = document.getElementById('mTaskPriority').value;
        const date = document.getElementById('mTaskDate')?.value;
        const time = document.getElementById('mTaskTime')?.value || '';
        const duration = parseInt(document.getElementById('mTaskDuration')?.value) || 30;
        // Note: If time input is missing in Edit Modal, this will be empty. 
        // Ideally we should preserve original time if not changing?
        // But for now, empty is safer than null error.

        const recurrence = document.getElementById('mTaskRecurrence')?.value || 'none';
        const recurrenceEnd = document.getElementById('mTaskRecurrenceEnd')?.value || '';
        const pomoEstimate = parseInt(document.getElementById('mTaskPomoEstimate')?.value) || 0;
        const pomoLength = parseInt(document.getElementById('mTaskPomoLength')?.value) || 25;

        let recurrenceDays = '';
        if (recurrence === 'weekly') {
            const checkedBoxes = document.getElementById('universalModal').querySelectorAll('.task-day-check:checked');
            recurrenceDays = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        }

        const visionId = document.getElementById('mTaskVisionGoal')?.value || '';

        if (!title) return;

        document.getElementById('universalModal').classList.add('hidden');
        if (typeof window.showSaveLock === 'function') window.showSaveLock();
        showToast("Updating task...");

        await apiCall('update', 'tasks', {
            title, description: desc, category: cat, tags: tags,
            vision_id: visionId,
            subtasks: JSON.stringify(subtasks),
            priority: prio, due_date: date || '', due_time: time,
            duration: duration,
            recurrence, recurrence_days: recurrenceDays, recurrence_end: recurrenceEnd,
            pomodoro_estimate: pomoEstimate,
            pomodoro_length: pomoLength
        }, editId);

        await refreshData('tasks');
    }

    else if (action === 'update-tx-modal') {
        const editId = btn.dataset.editId;
        const amt = document.getElementById('mTxAmount').value;
        const cat = document.getElementById('mTxCategory').value;
        const type = document.getElementById('mTxType').value;
        const date = document.getElementById('mTxDate').value;
        const source = document.getElementById('mTxSource')?.value || '';
        const notes = document.getElementById('mTxNote')?.value || '';
        const payment_mode = document.getElementById('mTxPaymentMode')?.value || '';

        if (!amt) return;
        document.getElementById('universalModal').classList.add('hidden');
        if (typeof window.showSaveLock === 'function') window.showSaveLock();
        showToast("Updating transaction...");
        await apiCall('update', 'expenses', { amount: amt, category: cat, type: type, date: date, source: source, description: notes, payment_mode: payment_mode }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-fund-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mFundName').value;
        const target = document.getElementById('mFundTarget').value;
        const current = document.getElementById('mFundCurrent').value;
        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        if (typeof window.showSaveLock === 'function') window.showSaveLock();
        showToast("Updating fund...");
        await apiCall('update', 'funds', { fund_name: name, target_amount: target, current_amount: current }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-asset-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mAssetName').value;
        const type = document.getElementById('mAssetType').value;
        const value = document.getElementById('mAssetValue').value;
        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        if (typeof window.showSaveLock === 'function') window.showSaveLock();
        showToast("Updating asset...");
        await apiCall('update', 'assets', { asset_name: name, type: type, value: value }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-vision-modal') {
        const editId = btn.dataset.editId;
        const title = document.getElementById('mVisTitle').value;
        const img = document.getElementById('mVisImg').value;
        const cat = document.getElementById('mVisCat').value;
        const date = document.getElementById('mVisDate').value;
        const notes = document.getElementById('mVisNotes').value;
        if (!title) { alert("Give your goal a title!"); return; }
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating goal...");
        await apiCall('update', 'vision_board', { title, image_url: img, category: cat, target_date: date, notes: notes }, editId);
        await refreshData('vision');
    }

    else if (action === 'update-diary-modal') {
        const editId = btn.dataset.editId;
        // Handle rich text editor (contenteditable)
        const diaryTextEl = document.getElementById('mDiaryText');
        const text = diaryTextEl ? diaryTextEl.innerText : '';
        const mood = document.getElementById('mMoodScore').value;
        const tags = document.getElementById('mDiaryTags').value;
        const date = document.getElementById('mDiaryDate').value;
        if (!text || !text.trim()) { alert("Please write something!"); return; }
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating entry...");
        await apiCall('update', 'diary', { content: text, mood: mood, tags: tags, date: date }, editId);
        await refreshData('diary');
    }

    else if (action === 'update-habit-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mHabitName').value;
        const cat = document.getElementById('mHabitCat').value;
        const freq = document.getElementById('mHabitFreq').value;
        const days = typeof getSelectedDays === 'function' ? getSelectedDays('mHabitDays') : '';

        // Debug: find ALL elements with mHabitTime in the modal
        const modal = document.getElementById('universalModal');
        const allTimeInputs = modal ? modal.querySelectorAll('#mHabitTime') : [];
        console.log('[Habit Update] All #mHabitTime elements in modal:', allTimeInputs.length, allTimeInputs);

        const timeEl = document.getElementById('mHabitTime');
        const time = timeEl ? timeEl.value : '';
        const emoji = document.getElementById('mHabitEmoji')?.value || '✨';

        console.log('[Habit Update] Current mHabitTime value:', time, 'element:', timeEl);

        const durationEl = document.getElementById('mHabitDuration');
        const duration = durationEl ? parseInt(durationEl.value, 10) || 45 : 45;
        const pomoEl = document.getElementById('mHabitPomoSessions');
        const pomoSessions = pomoEl ? parseInt(pomoEl.value, 10) || 0 : 0;
        const pomoLenEl = document.getElementById('mHabitPomoLength');
        const pomoLength = pomoLenEl ? parseInt(pomoLenEl.value, 10) || 25 : 25;
        const routineEl = document.getElementById('mHabitRoutine');
        const routine = routineEl ? routineEl.value.trim() : '';

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating habit...");
        const updatePayload = {
            habit_name: name, category: cat,
            frequency: freq === 'weekly' ? ('weekly:' + days) : (freq || 'daily'),
            reminder_time: time,
            duration: duration,
            emoji: emoji,
            pomodoro_sessions: pomoSessions,
            pomodoro_length: pomoLength,
            routine: routine
        };
        console.log('[Habit Update] Final payload:', updatePayload);
        await apiCall('update', 'habits', updatePayload, editId);
        await refreshData('habits');
        // Sync native alarms so updated reminder_time is registered with iOS immediately
        if (typeof window.syncNativeNotifications === 'function') setTimeout(window.syncNativeNotifications, 500);
    }

    else if (action === 'update-event-modal') {
        const editId = btn.dataset.editId;
        const title = document.getElementById('evtTitle').value;
        const date = document.getElementById('evtDate').value;
        const start = document.getElementById('evtStart').value;
        const end = document.getElementById('evtEnd').value;
        const category = document.getElementById('evtCategory')?.value || 'General';

        if (!title || !date || !start || !end) { alert("Please fill all fields"); return; }
        document.getElementById('eventModal').classList.add('hidden');
        showToast("Updating event...");

        // ISO datetime string (not epoch ms) — see save-event above.
        const startEpoch = `${date}T${start}:00`;
        const endEpoch = `${date}T${end}:00`;
        const color = document.getElementById('evtColor')?.value || '';

        // Optimistic UI Update
        const eventIndex = state.data.planner.findIndex(e => String(e.id) === String(editId));
        let originalEvent = null;
        if (eventIndex > -1) {
            originalEvent = { ...state.data.planner[eventIndex] };
            state.data.planner[eventIndex] = {
                ...state.data.planner[eventIndex],
                title: title,
                start_datetime: startEpoch,
                end_datetime: endEpoch,
                category: category,
                color: color
            };
            if (state.view === 'calendar' && typeof renderCalendar === 'function') {
                renderCalendar();
            }
        }

        try {
            await apiCall('update', 'planner_events', { title, start_datetime: startEpoch, end_datetime: endEpoch, category, color }, editId);
            await refreshData('planner_events');
        } catch (e) {
            console.error("Failed to update event", e);
            if (originalEvent && eventIndex > -1) {
                state.data.planner[eventIndex] = originalEvent;
                if (state.view === 'calendar') renderCalendar();
            }
            showToast("Failed to update event");
        }
    }

    else if (action === 'update-person-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mPersonName').value;
        const rel = document.getElementById('mPersonRel').value;
        const bday = document.getElementById('mPersonBday').value;
        const nextInt = document.getElementById('mPersonNextInt').value;
        const phone = document.getElementById('mPersonPhone')?.value || '';
        const email = document.getElementById('mPersonEmail')?.value || '';
        const notes = document.getElementById('mPersonNotes').value;

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating person...");

        await apiCall('update', 'people', {
            name: name, relationship: rel, birthday: bday, next_interaction: nextInt,
            phone: phone, email: email, notes: notes
        }, editId);
        await refreshData('people');
    }




    else if (action === 'delete') {

        if (confirm('Delete this item?')) {

            await apiCall('delete', sheet, {}, id);

            await refreshData(state.view);

        }

    }

});



async function refreshData(viewContext) {

    // --- Special case: 'finance' needs to refresh expenses, funds, AND assets ---
    if (viewContext === 'finance') {
        try {
            const [expenses, funds, assets] = await Promise.all([
                apiCall('get', 'expenses'),
                apiCall('get', 'funds'),
                apiCall('get', 'assets')
            ]);
            state.data.expenses = expenses;
            state.data.funds = funds;
            state.data.assets = assets;
            if (state.view === 'finance') routeTo('finance');
        } catch (e) {
            console.error('Failed to refresh finance:', e);
        }
        return;
    }

    // Map view context to sheet names
    const sheetMap = {
        'settings': 'settings',
        'calendar': 'planner_events',
        'habits': 'habits',
        'tasks': 'tasks',
        'diary': 'diary',
        'vision': 'vision_board',
        'people': 'people',
        'books': 'book_library',
        'reader': 'book_summaries'
    };

    const sheetName = sheetMap[viewContext] || viewContext;

    // Map sheet names to state keys

    const stateKeyMap = {
        'settings': 'settings',
        'planner_events': 'planner',
        'expenses': 'expenses',
        'habits': 'habits',
        'tasks': 'tasks',
        'diary': 'diary',
        'vision_board': 'vision',
        'habit_logs': 'habit_logs',
        'people': 'people',
        'book_library': 'book_library',
        'book_summaries': 'book_summaries'
    };

    const stateKey = stateKeyMap[sheetName] || sheetName;

    try {
        const data = await apiCall('get', sheetName);
        state.data[stateKey] = data;

        // Debug: Log habits data after refresh
        if (viewContext === 'habits') {
            console.log('[Debug] Habits data from API:', JSON.stringify(data, null, 2));
        }

        // If settings were refreshed, apply them immediately
        if (viewContext === 'settings' && typeof applySettings === 'function') {
            applySettings();
            if (typeof updateTabVisibility === 'function') {
                updateTabVisibility();
            }
        }

        console.log(`Refreshed ${viewContext}:`, data);

        // Re-render the current view after data refresh
        if (viewContext === state.view || sheetName === state.view) {
            routeTo(state.view);
        }
    } catch (e) {
        console.error(`Failed to refresh ${viewContext}:`, e);
    }

}



/* --- LOADER --- */
function updateLoader(percent, text) {
    const bar = document.querySelector('.loader-progress-bar');
    const status = document.querySelector('.loader-status');
    if (bar) bar.style.width = percent + '%';
    if (status && text) status.textContent = text;
}

// ── Cache helpers (Removed as per request) ──

// Sheet name → state key mapping (where they differ)
const SHEET_TO_KEY = {
    'planner_events': 'planner',
    'vision_board': 'vision'
};

function applyBulkDataToState(bulkData) {
    Object.keys(bulkData).forEach(sheetName => {
        const key = SHEET_TO_KEY[sheetName] || sheetName;
        state.data[key] = bulkData[sheetName] || [];
    });
}

// Minimal tab visibility implementation. ALWAYS available (defined in main.js,
// not in lazy-loaded view-settings.js). view-settings.js's richer version
// overrides this when the user visits Settings — but on initial app load this
// fallback ensures hidden tabs are hidden from the first paint.
if (typeof window.updateTabVisibility !== 'function') {
    window.updateTabVisibility = function () {
        const settings = state.data?.settings?.[0];
        if (!settings) return;
        const layoutStr = settings.nav_layout || '';
        let orderList = [];
        let hiddenList = [];
        if (layoutStr) {
            try {
                const layoutData = typeof layoutStr === 'string' ? JSON.parse(layoutStr) : layoutStr;
                if (Array.isArray(layoutData)) {
                    orderList = layoutData.map(i => i.id);
                    hiddenList = layoutData.filter(i => !i.visible).map(i => i.id);
                }
            } catch (e) { console.error('[Tab Visibility/main.js] parse failed:', e); }
        }
        const apply = (containerSelector, itemSelector) => {
            const container = document.querySelector(containerSelector);
            if (!container) return;
            const items = Array.from(container.querySelectorAll(itemSelector));
            items.sort((a, b) => {
                const ta = a.dataset.target, tb = b.dataset.target;
                if (ta === 'dashboard') return -1;
                if (tb === 'dashboard') return 1;
                const ia = orderList.indexOf(ta), ib = orderList.indexOf(tb);
                if (ia === -1 && ib === -1) return 0;
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
            items.forEach(item => {
                container.appendChild(item);
                const target = item.dataset.target;
                if (target && target !== 'dashboard') {
                    if (hiddenList.includes(target)) {
                        item.classList.add('tab-hidden');
                        item.style.display = 'none';
                    } else {
                        item.classList.remove('tab-hidden');
                        item.style.removeProperty('display');
                    }
                }
            });
        };
        apply('.sidebar nav', '.nav-item');
        apply('.mobile-nav', '.mob-item');
        console.log('[Tab Visibility/main.js] hiding:', hiddenList);
    };
}

function applyPostLoadSettings() {
    applyThemeOnLoad();
    if (state.data.settings && state.data.settings.length > 0) {
        if (typeof applySettings === 'function') applySettings();
        if (typeof updateTabVisibility === 'function') updateTabVisibility();
        if (typeof loadNotificationSettings === 'function') {
            loadNotificationSettings();
            if (typeof syncNativeNotifications === 'function') syncNativeNotifications();
        }
    }
}

async function loadAllData(force = false) {
    console.log(`loadAllData: Starting (force=${force})...`);
    state.loading = true;
    updateLoader(5, 'Connecting...');

    try {
        await fetchFreshData(force);
    } catch (e) {
        console.error('loadAllData: fetchFreshData threw:', e);
    }

    state.loading = false;
    updateLoader(95, 'Processing & Rendering...');
    console.log("Data Loaded:", state.data);
    try {
        applyPostLoadSettings();
    } catch (e) {
        console.error('loadAllData: applyPostLoadSettings threw:', e);
    }

    updateLoader(100, 'Ready!');
    // ALWAYS hide the loader, even on error
    setTimeout(() => {
        const loader = document.getElementById('appLoader');
        if (loader) {
            loader.classList.add('hidden');
            loader.style.display = 'none';   // belt-and-suspenders for cases where the class isn't enough
        }
    }, 500);
}

/**
 * Fetch fresh data (bulk or fallback), save to cache.
 */
async function fetchFreshData(force = false) {
    const startTime = performance.now();

    // ─── Supabase path: use apiCall('init') which does a parallel SELECT * on
    // every table. Skips the slow Google Apps Script bulk endpoint entirely.
    const useSupabase = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.enabled;
    if (useSupabase) {
        // If not signed in yet, bail immediately — the auth gate will take over.
        // Avoids the loader covering the auth gate on mobile.
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session?.user) {
                console.log('loadAllData: not signed in — skipping data fetch, auth gate handles it');
                return;
            }
        } catch (e) { /* session lookup failed; still try the init below */ }

        updateLoader(10, 'Loading your data…');
        try {
            const result = await Promise.race([
                apiCall('init', null, {}),
                // 10-second safety timeout so the loader can't hang forever
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 10000))
            ]);
            if (result && result.success && result.data) {
                updateLoader(80, 'Processing data…');
                applyBulkDataToState(result.data);
                console.log(`loadAllData: ✅ Supabase init in ${Math.round(performance.now() - startTime)}ms`);
                if (typeof updateWidgetData === 'function') updateWidgetData();
                if (window.personalStore && state.data) {
                    for (const k of Object.keys(state.data)) window.personalStore.notify(k);
                }
                return;
            }
        } catch (e) {
            console.warn('loadAllData: Supabase init failed:', e.message);
        }
        return;
    }

    // ─── Legacy path: Google Apps Script bulk fetch
    try {
        updateLoader(10, 'Fetching all data...');
        const forceParam = force ? '&force=true' : '';
        const url = `${API_BASE}?action=getAll&t=${Date.now()}${forceParam}`;
        console.log(`loadAllData: Attempting bulk fetch (force=${force})...`);
        const res = await fetch(url, { method: 'GET', redirect: 'follow' });
        const text = await res.text();
        const elapsed = Math.round(performance.now() - startTime);
        console.log(`loadAllData: Bulk response in ${elapsed}ms, ${text.length} chars`);

        let json;
        try { json = JSON.parse(text); } catch (parseErr) {
            throw new Error('Invalid JSON from getAll');
        }

        if (json.success && json.data) {
            updateLoader(80, 'Processing data...');
            applyBulkDataToState(json.data);
            console.log(`loadAllData: ✅ Bulk fetch SUCCESS in ${elapsed}ms`);
            if (typeof updateWidgetData === 'function') updateWidgetData();
            // Publish all data slices to the store at once so subscribers
            // can react incrementally rather than full-rerender via routeTo.
            if (window.personalStore && state.data) {
                for (const k of Object.keys(state.data)) window.personalStore.notify(k);
            }
            return;
        }
    } catch (e) {
        console.warn('loadAllData: Bulk fetch failed, using fallback:', e.message);
    }

    // Fallback: individual requests
    console.log('loadAllData: Fallback (individual requests)...');
    const sheets = ['planner_events', 'tasks', 'expenses', 'habits', 'habit_logs', 'diary', 'diary_templates', 'diary_tags', 'diary_achievements', 'vision_board', 'settings', 'funds', 'assets', 'people', 'people_debts', 'reminders', 'vision_images', 'vision_affirmations', 'ritual_logs', 'vision_tdp', 'gym_plans', 'gym_sessions', 'gym_exercises', 'notes', 'book_library', 'book_summaries', 'reader_settings', 'mural_projects', 'mural_categories', 'mural_elements'];
    const keys = ['planner', 'tasks', 'expenses', 'habits', 'habit_logs', 'diary', 'diary_templates', 'diary_tags', 'diary_achievements', 'vision', 'settings', 'funds', 'assets', 'people', 'people_debts', 'reminders', 'vision_images', 'vision_affirmations', 'ritual_logs', 'vision_tdp', 'gym_plans', 'gym_sessions', 'gym_exercises', 'notes', 'book_library', 'book_summaries', 'reader_settings', 'mural_projects', 'mural_categories', 'mural_elements'];

    let loaded = 0;
    const total = sheets.length;
    const promises = sheets.map(s => {
        return apiCall('get', s).then(res => {
            loaded++;
            updateLoader(10 + Math.round((loaded / total) * 80), `Fetching data... (${loaded}/${total})`);
            return res;
        });
    });
    const results = await Promise.all(promises);
    results.forEach((res, i) => { state.data[keys[i]] = res; });

    console.log(`loadAllData: Fallback done in ${Math.round(performance.now() - startTime)}ms`);
    if (typeof updateWidgetData === 'function') updateWidgetData();
}

/**
 * Background refresh — fetch fresh data silently and update state + cache.
 * If data changed, re-render the current view.
 */
async function fetchFreshDataInBackground() {
    console.log('Background refresh: Starting...');
    const startTime = performance.now();

    try {
        const url = `${API_BASE}?action=getAll&t=${Date.now()}`;
        const res = await fetch(url, { method: 'GET', redirect: 'follow' });
        const text = await res.text();
        const elapsed = Math.round(performance.now() - startTime);

        let json;
        try { json = JSON.parse(text); } catch (e) { return; }

        if (json.success && json.data) {
            applyBulkDataToState(json.data);
            applyPostLoadSettings();

            // Re-render current view with fresh data
            const view = state.view;
            if (view === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
            else if (view === 'tasks' && typeof renderTasks === 'function') renderTasks();
            else if (view === 'habits' && typeof renderHabits === 'function') renderHabits();
            else if (view === 'finance' && typeof renderFinance === 'function') renderFinance();

            console.log(`Background refresh: ✅ Done in ${elapsed}ms`);
        }
    } catch (e) {
        console.warn('Background refresh: Failed:', e.message);
    }
}





function toggleSidebar() {

    const sidebar = document.querySelector('.sidebar');

    if (sidebar) sidebar.classList.toggle('collapsed');

}

// Apply theme settings when app loads
function applyThemeOnLoad() {
    const settings = state.data.settings?.[0];
    if (!settings) return;

    // Apply theme color
    const color = settings.theme_color || '#4F46E5';
    document.documentElement.style.setProperty('--primary', color);

    // Apply theme mode (light/dark/forest/midnight)
    const [mode] = (settings.theme_mode || 'light').split('|');
    document.documentElement.setAttribute('data-theme', mode || 'light');

    // Sync the native status bar / nav bar with the web theme.
    syncNativeChromeToTheme(mode || 'light');

    console.log('Theme applied:', mode, color);
}

// --- Background sync (WorkManager) -------------------------------------------
// Configures the Android WorkManager plugin with the API endpoint and
// schedules a periodic fetch every 60 minutes. Subject to Android's normal
// WorkManager constraints (battery, network, doze). No-op on iOS / PWA.
async function scheduleBackgroundSync() {
    const plugin = window.BackgroundSync || window.Capacitor?.Plugins?.BackgroundSync;
    if (!plugin?.configure) return;
    try {
        await plugin.configure({ apiBase: API_BASE });
        const res = await plugin.schedule({ intervalMinutes: 60 });
        console.log('[BackgroundSync] Scheduled every', res?.intervalMinutes, 'min');
    } catch (e) {
        console.warn('[BackgroundSync] Schedule failed:', e?.message || e);
    }
}

// Hydrate state.data synchronously-ish from whatever the WorkManager Worker
// fetched the last time it ran. This gives the dashboard real numbers
// before the network call completes (stale-while-revalidate).
async function hydrateFromBackgroundCache() {
    const plugin = window.BackgroundSync || window.Capacitor?.Plugins?.BackgroundSync;
    if (!plugin?.getCachedData) return;
    try {
        const { data, fetchedAt } = await plugin.getCachedData();
        if (!data) return;
        const ageMin = fetchedAt ? Math.round((Date.now() - fetchedAt) / 60000) : -1;
        const parsed = JSON.parse(data);
        // The Apps Script response shape is { tables: { tasks: [...], habits: [...] } }
        // or similar. We let loadAllData() do the real merge but seed state.data
        // optimistically with whatever it has.
        if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
                if (Array.isArray(parsed[k]) && state.data[k] !== undefined) {
                    state.data[k] = parsed[k];
                }
            }
            console.log('[BackgroundSync] Hydrated from cache (' + ageMin + ' min old)');
            if (state.view) routeTo(state.view);
        }
    } catch (e) {
        console.warn('[BackgroundSync] Hydrate failed:', e?.message || e);
    }
}

// --- Share-target handler ---------------------------------------------------
// MainActivity.java listens for ACTION_SEND, extracts EXTRA_TEXT, and calls
// window.handleSharedIntent({ text, subject, ts }). The default behavior:
// route to Notes and prefill a new note with the shared text. Views can
// override by registering window.openNewNoteWithText(text) etc.
window.handleSharedIntent = function (payload) {
    if (!payload || !payload.text) return;
    const text = (payload.subject ? payload.subject + '\n\n' : '') + payload.text;
    window._sharedDraft = text;

    // Route to notes; the view's render function will look for _sharedDraft.
    routeTo('notes');
    setTimeout(() => {
        if (typeof window.openNewNoteWithText === 'function') {
            try { window.openNewNoteWithText(text); } catch (e) { console.error(e); }
        } else if (typeof window.openNewNote === 'function') {
            try { window.openNewNote(); } catch (e) { console.error(e); }
        } else {
            // Last-resort UX: copy to clipboard and toast so it's not lost.
            try {
                if (navigator.clipboard) navigator.clipboard.writeText(text);
                if (typeof showToast === 'function') showToast('Shared text copied — open Notes to paste');
            } catch (e) { /* ignore */ }
        }
        window._sharedDraft = null;
    }, 400);
};

// On startup, if MainActivity injected before our JS was ready, the global
// is already populated — pick it up now.
if (window._sharedIntent && !window._sharedIntentConsumed) {
    window._sharedIntentConsumed = true;
    // Defer until the app has booted (so routeTo works)
    setTimeout(() => window.handleSharedIntent(window._sharedIntent), 600);
}

// --- Sidebar toggle (desktop-only SaaS shell) -------------------------------
// Toggles body.sidebar-collapsed which saas.css uses to compact the sidebar.
// Persists across sessions in localStorage.
window.toggleSaasSidebar = function () {
    const next = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', next);
    try { localStorage.setItem('sidebarCollapsed', next ? '1' : '0'); } catch (e) {}
};

// Restore sidebar state on boot
(function restoreSidebarState() {
    try {
        if (localStorage.getItem('sidebarCollapsed') === '1') {
            document.body.classList.add('sidebar-collapsed');
        }
    } catch (e) { /* ignore */ }
})();

// Scroll-aware page header shadow (subtle elevation when content scrolls)
(function wirePageHeaderShadow() {
    function attach() {
        const main = document.querySelector('.main-content');
        const header = document.querySelector('.main-header-bar');
        if (!main || !header) return;
        const onScroll = () => header.classList.toggle('scrolled', main.scrollTop > 8);
        main.addEventListener('scroll', onScroll, { passive: true });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();

// --- PWA URL-param dispatcher -----------------------------------------------
// Mirrors the native Android intent handlers but for the web/PWA install.
// Triggered by manifest.json's "shortcuts" (?action=add&view=tasks) and
// "share_target" (?share_text=...&share_title=...).
//
// Manifest shortcut URL example: ./index.html?action=add&view=tasks#tasks
// Share target URL example:       ./index.html?share_text=hello&share_title=...
//
// Native Android paths still go through MainActivity (appUrlOpen + share
// intent injection) — this only fires on the web/PWA.
function dispatchPwaUrlParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (![...params.keys()].length) return;

        // 1) Share target: PWA was opened as a share recipient.
        const shareText = params.get('share_text') || params.get('text');
        const shareTitle = params.get('share_title') || params.get('title');
        const shareUrl = params.get('share_url') || params.get('url');
        if (shareText || shareUrl) {
            const text = [shareTitle, shareText, shareUrl].filter(Boolean).join('\n');
            if (typeof window.handleSharedIntent === 'function') {
                window.handleSharedIntent({ text, subject: shareTitle || '' });
            }
        }

        // 2) Shortcut deep link: ?action=add&view=tasks
        const action = params.get('action');
        const view = params.get('view');
        if (action && view) {
            window._pendingDeepLinkAction = { view, action, params: {} };
            routeTo(view);
            setTimeout(() => {
                if (typeof window.handlePendingDeepLinkAction === 'function') {
                    window.handlePendingDeepLinkAction();
                }
            }, 300);
        }

        // 3) Custom protocol handler: ?deeplink=web+personalos://tasks
        const dl = params.get('deeplink');
        if (dl) {
            const path = dl.replace(/^(web\+)?personalos:\/\//, '').split('?')[0];
            if (path) routeTo(path);
        }

        // Clean the URL so refresh doesn't re-dispatch the same params.
        if (history.replaceState) {
            const cleanHash = window.location.hash || '';
            history.replaceState(null, '', window.location.pathname + cleanHash);
        }
    } catch (e) {
        console.warn('[PWA] URL dispatch failed:', e);
    }
}
// Run once after the app boots — defer so routeTo + handlers exist.
setTimeout(dispatchPwaUrlParams, 800);

// --- Deep-link action dispatcher --------------------------------------------
// App Shortcuts and external deep links can include ?action=add (and friends).
// After the target view has loaded, we look for a matching window-level handler
// and call it. Views expose handlers by attaching them to window, e.g.
//     window.openAddTaskModal = function() { ... }
// If a view doesn't expose a handler yet, the deep link still routes them to
// the right tab — the action is just a no-op.
const DEEP_LINK_HANDLERS = {
    'tasks:add':      () => window.openAddTaskModal && window.openAddTaskModal(),
    'diary:add':      () => window.openNewDiaryEntry && window.openNewDiaryEntry(),
    'notes:add':      () => window.openNewNote && window.openNewNote(),
    'pomodoro:start': () => window.startPomodoroSession && window.startPomodoroSession(),
    'habits:checkin': () => window.openTodaysHabits && window.openTodaysHabits()
};

function handlePendingDeepLinkAction() {
    const pending = window._pendingDeepLinkAction;
    if (!pending) return;
    const { view, action } = pending;
    if (!action) { window._pendingDeepLinkAction = null; return; }
    const key = view + ':' + action;
    const handler = DEEP_LINK_HANDLERS[key];
    if (handler) {
        try { handler(); } catch (e) { console.error('Deep-link handler failed:', e); }
    } else {
        console.log('[DeepLink] No handler registered for', key);
    }
    window._pendingDeepLinkAction = null;
}
window.handlePendingDeepLinkAction = handlePendingDeepLinkAction;

// --- Native chrome sync (status bar / system bars) ---------------------------
// Reads the current CSS theme and pushes matching colors to the Android
// status bar via the Capacitor StatusBar plugin. Called whenever the web
// theme changes so the system bars never look out of place.
const THEME_CHROME = {
    light:    { bg: '#FFFFFF', style: 'LIGHT' },  // dark icons on light bg
    dark:     { bg: '#0B0E14', style: 'DARK'  },  // light icons on dark bg
    midnight: { bg: '#05060A', style: 'DARK'  },
    forest:   { bg: '#0E1F14', style: 'DARK'  },
    sunset:   { bg: '#1A0E08', style: 'DARK'  },
    ocean:    { bg: '#06121C', style: 'DARK'  },
    lavender: { bg: '#120A1E', style: 'DARK'  },
    rose:     { bg: '#1A0612', style: 'DARK'  }
};

function syncNativeChromeToTheme(mode) {
    const StatusBar = window.Capacitor?.Plugins?.StatusBar;
    if (!StatusBar) return; // Plugin not installed yet, or PWA context.
    const chrome = THEME_CHROME[mode] || THEME_CHROME.light;
    try {
        StatusBar.setBackgroundColor({ color: chrome.bg }).catch(() => {});
        StatusBar.setStyle({ style: chrome.style }).catch(() => {});
    } catch (e) { /* swallow — StatusBar is a non-essential polish call */ }
}
window.syncNativeChromeToTheme = syncNativeChromeToTheme;

// -----------------------------------------------------
// AUTO-PROGRESS: Vision Goal Automations
// -----------------------------------------------------
window.recalculateVisionProgressFromHabit = async function (habitId) {
    if (!state.data.vision || !state.data.habit_logs) return;

    const habitIdStr = String(habitId);
    let visionDocsToUpdate = [];

    // 1. Find all Vision goals linked to this habit
    for (const v of state.data.vision) {
        if (!v.linked_habits) continue;

        let linkedArray = [];
        try {
            if (String(v.linked_habits).trim().startsWith('[')) {
                linkedArray = JSON.parse(v.linked_habits);
            }
        } catch (e) { continue; } // Legacy strings won't auto-calculate

        const habitConfig = linkedArray.find(h => String(h.id) === habitIdStr);

        // This vision goal depends on this habit and has a target recurrence set
        if (habitConfig && habitConfig.target > 0) {

            // Calculate progress for ALL linked habits in this goal
            let totalPct = 0;
            let habitsCount = linkedArray.length;

            for (const hConfig of linkedArray) {
                // Count how many times this specific habit was completed since its startDate
                let completions = 0;
                const startEpoch = new Date(hConfig.startDate || 0).getTime();

                state.data.habit_logs.forEach(log => {
                    if (String(log.habit_id) === String(hConfig.id) && log.completed) {
                        const logEpoch = new Date(log.date).getTime();
                        if (logEpoch >= startEpoch) {
                            completions++;
                        }
                    }
                });

                // Cap the habit's individual contribution to 100%
                let habitPct = (completions / hConfig.target) * 100;
                if (habitPct > 100) habitPct = 100;
                totalPct += habitPct;
            }

            // Average out the percentage
            let newGoalProgress = Math.floor(totalPct / habitsCount);
            if (newGoalProgress > 100) newGoalProgress = 100;
            if (newGoalProgress < 0) newGoalProgress = 0;

            // If the progress has changed, we must update the backend
            if (parseInt(v.progress) !== newGoalProgress) {
                v.progress = newGoalProgress;
                visionDocsToUpdate.push(v);
            }
        }
    }

    // 2. Dispatch updates to the API
    if (visionDocsToUpdate.length > 0) {
        console.log(`Recalculating vision progress triggered by habit ${habitId}. Updating ${visionDocsToUpdate.length} goals...`);
        for (const v of visionDocsToUpdate) {
            await apiCall('update', 'vision_board', { progress: v.progress }, v.id);
        }

        // Re-render the Vision view if it's currently active so the user sees the bar jump
        if (window.renderVision && document.getElementById('main').querySelector('.vision-wrapper')) {
            window.renderVision();
        }
    }
}


// Apply settings after saving in Settings view
function applySettings() {
    const settings = state.data.settings?.[0];
    if (!settings) return;

    // 1. Theme color
    const color = settings.theme_color || '#4F46E5';
    document.documentElement.style.setProperty('--primary', color);

    // 2. Theme mode + icon pack (theme_mode is stored as "mode|iconpack", e.g. "dark|lucide")
    const [mode, iconPack] = (settings.theme_mode || 'light').split('|');
    document.documentElement.setAttribute('data-theme', mode || 'light');

    // 3. Icon pack — persist to localStorage so getCurrentIconPack picks it up
    if (iconPack) {
        try {
            const appSettings = JSON.parse(localStorage.getItem('app_settings') || '{}');
            appSettings.icon_pack = iconPack;
            localStorage.setItem('app_settings', JSON.stringify(appSettings));
        } catch (e) { /* ignore */ }
    }

    // 4. Sync the native status bar / nav bar with the web theme.
    syncNativeChromeToTheme(mode || 'light');

    // 5. Orientation lock
    const orientation = settings.orientation_lock || 'auto';
    if (orientation !== 'auto' && screen.orientation) {
        screen.orientation.lock(orientation + '-primary').catch(e => console.log('Orientation lock failed:', e));
    } else if (orientation === 'auto' && screen.orientation) {
        screen.orientation.unlock();
    }

    // 6. Notification state
    if (window.notificationState) {
        if (settings.notification_enabled !== undefined) window.notificationState.enabled = settings.notification_enabled;
        if (settings.notification_sound) window.notificationState.sound = settings.notification_sound;
        if (settings.notification_method) window.notificationState.defaultMethod = settings.notification_method;
    }

    console.log('Theme applied:', mode, color, 'icon pack:', iconPack || 'default');
}

// Refresh all data and re-render current view
window.refreshAll = async function () {
    showToast('Refreshing...');
    await loadAllData();
    // Re-render current view
    if (state.view === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    else if (state.view === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
    else if (state.view === 'tasks' && typeof renderTasks === 'function') renderTasks();
    else if (state.view === 'finance' && typeof renderFinance === 'function') renderFinance();
    else if (state.view === 'habits' && typeof renderHabits === 'function') renderHabits();
    else if (state.view === 'diary' && typeof renderDiary === 'function') renderDiary();
    else if (state.view === 'vision' && typeof renderVision === 'function') renderVision();
    else if (state.view === 'people' && typeof renderPeople === 'function') renderPeople();
    showToast('Data refreshed!');
};

/* --- NOTIFICATIONS & ALARMS --- */
let notifiedItems = JSON.parse(localStorage.getItem('notifiedItems') || '[]');

/* --- AI MODAL LOGIC --- */
/* --- AI MODAL LOGIC --- */
window.openAIModal = function () {
    const modal = document.getElementById('aiModal');
    const content = document.getElementById('aiModalContent');
    if (!modal || !content) return;

    modal.classList.add('active');

    // Initial Menu View
    content.innerHTML = `
        <div class="ai-menu-view">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:24px; font-weight:800; background:linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px">AI Assistant</div>
                <div style="font-size:14px; color:var(--text-muted)">How can I help you with this page?</div>
            </div>
            
            <div style="display:grid; gap:12px;">
                <button class="btn large" style="justify-content:flex-start; height:60px; background:var(--bg); color:var(--text-main); border:1px solid var(--border)" onclick="triggerAIAnalysis()">
                    <div style="width:32px; height:32px; background:var(--primary-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:12px">
                        ${renderIcon('priority', null, 'style="width:16px; color:var(--primary)"')}
                    </div>
                    <div style="text-align:left">
                        <div style="font-weight:600">Deep Analysis</div>
                        <div style="font-size:11px; color:var(--text-muted)">Get insights & next steps</div>
                    </div>
                </button>

                <button class="btn large" style="justify-content:flex-start; height:60px; background:var(--bg); color:var(--text-main); border:1px solid var(--border)" onclick="showAIChatView()">
                    <div style="width:32px; height:32px; background:var(--primary-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:12px">
                        ${renderIcon('chat', null, 'style="width:16px; color:var(--primary)"')}
                    </div>
                    <div style="text-align:left">
                        <div style="font-weight:600">Ask a Question</div>
                        <div style="font-size:11px; color:var(--text-muted)">Chat about this data</div>
                    </div>
                </button>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.triggerAIAnalysis = async function () {
    const content = document.getElementById('aiModalContent');
    content.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted)">
            ${renderIcon('loading', null, 'class="spin" style="width:32px; height:32px; margin-bottom:16px; color:var(--primary)"')}
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <div style="margin-top:16px; font-weight:500">Analyzing ${state.view.charAt(0).toUpperCase() + state.view.slice(1)}...</div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const contextData = getAIContextData();
        const response = await AI_SERVICE.generateInsight(state.view, contextData);
        renderAIContent(response);
    } catch (e) {
        content.innerHTML = `<div style="color:var(--danger); text-align:center; padding:20px">Failed: ${e.message}</div>`;
    }
};

window.showAIChatView = function () {
    const content = document.getElementById('aiModalContent');
    content.innerHTML = `
        <div class="ai-chat-view" style="height:400px; display:flex; flex-direction:column">
            <div id="aiChatHistory" style="flex:1; overflow-y:auto; padding:10px; margin-bottom:10px; border:1px solid var(--border); border-radius:12px; background:var(--bg)">
                <div style="font-size:13px; color:var(--text-muted); text-align:center; margin-top:20px">Ask anything about your ${state.view}...</div>
            </div>
            <div style="display:flex; gap:8px">
                <input id="aiChatInput" class="input" style="margin:0" placeholder="Type your question..." onkeypress="if(event.key==='Enter') sendAIQuestion()">
                <button class="btn primary" onclick="sendAIQuestion()">${renderIcon('send', null, 'style="width:16px"')}</button>
            </div>
        </div>
    `;
    setTimeout(() => document.getElementById('aiChatInput').focus(), 100);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.sendAIQuestion = async function () {
    const input = document.getElementById('aiChatInput');
    const history = document.getElementById('aiChatHistory');
    const question = input.value.trim();
    if (!question) return;

    // User Msg
    history.innerHTML += `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px">
            <div style="background:var(--primary-soft); color:var(--primary-dark); padding:8px 12px; border-radius:12px 12px 0 12px; max-width:80%; font-size:14px">
                ${question}
            </div>
        </div>
    `;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    // Loading Bubble
    const loadId = 'ai-load-' + Date.now();
    history.innerHTML += `
        <div id="${loadId}" style="display:flex; justify-content:flex-start; margin-bottom:12px">
            <div style="background:var(--card-bg); border:1px solid var(--border); padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%">
                <div class="typing-indicator" style="transform:scale(0.8)"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;

    try {
        const contextData = getAIContextData();
        const answer = await AI_SERVICE.generateAnswer(question, state.view, contextData);

        document.getElementById(loadId).remove();

        history.innerHTML += `
            <div style="display:flex; justify-content:flex-start; margin-bottom:12px">
                <div style="background:var(--card-bg); border:1px solid var(--border); padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%; font-size:14px; line-height:1.5">
                    ${matchMd(answer)}
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById(loadId).remove();
        history.innerHTML += `<div style="color:var(--danger); font-size:12px; margin-bottom:10px">Error: ${e.message}</div>`;
    }
    history.scrollTop = history.scrollHeight;
};

// Helper for both analysis and chat
function getAIContextData() {
    if (state.view === 'dashboard') return { tasks: state.data.tasks, habits: state.data.habits };
    if (state.view === 'people') return { people: state.data.people };
    if (state.view === 'finance') return { expenses: state.data.expenses, budget: state.data.settings };
    return state.data[state.view] || {};
}

function matchMd(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function renderAIContent(mdText) {
    const content = document.getElementById('aiModalContent');
    // Parse headers, bullets, etc
    let html = mdText
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--primary);">$1</strong>')
        .replace(/### (.*?)\n/g, `<div class="ai-section-title">${renderIcon('hash', null, 'style="width:12px"')} $1</div>`)
        .replace(/## (.*?)\n/g, '<div class="ai-title" style="font-size:18px; margin:16px 0 8px 0">$1</div>')
        .replace(/- (.*?)\n/g, `<div style="display:flex; gap:8px; margin-bottom:6px">${renderIcon('right', null, 'style="width:14px; margin-top:4px; flex-shrink:0; color:var(--accent)"')} <span>$1</span></div>`)
        .replace(/\n\n/g, '<div style="height:12px"></div>');

    content.innerHTML = `<div class="ai-content-box">${html}</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



window.closeAIModal = function () {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.remove('active');
};

// Universal Modal Functions
window.openUniversalModal = function () {
    const modal = document.getElementById('universalModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeUniversalModal = function () {
    const modal = document.getElementById('universalModal');
    if (modal) modal.classList.add('hidden');
};

// Notification service is now in notification-service.js
// The old checkAlarms is kept for backwards compatibility but uses notification-service.js now

// This function is kept for backwards compatibility but delegated to notification-service
function startNotificationService() {
    // Delegated to notification-service.js which handles reminders
    console.log('Notification service loaded from notification-service.js');
    if (typeof initNotificationService === 'function') {
        initNotificationService();
    }
}

// Universal Modal Functions
function openUniversalModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeUniversalModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function checkAlarms() {
    const now = new Date();
    // Round down to current minute
    const currentWait = now.toISOString().slice(0, 16);
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Check Tasks (Due Today + Time matches)
    const tasks = state.data.tasks || [];
    tasks.forEach(t => {
        if (t.status !== 'completed' && t.due_date === todayStr && t.due_time === currentTime) {
            triggerAlarm(`Task Due: ${t.title}`, `It's ${t.due_time}, time to work on this!`, 'task-' + t.id);
        }
    });

    // 2. Check Habits (Scheduled Today + Time matches)
    const habits = state.data.habits || [];
    habits.forEach(h => {
        if (h.reminder_time === currentTime) {
            // Check if scheduled for today
            let isScheduled = window.habitScheduledToday(h);

            if (isScheduled) {
                // Check if already done today
                const logs = state.data.habit_logs || [];
                const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(todayStr));

                if (!isDone) {
                    triggerAlarm(`Habit Reminder: ${h.habit_name}`, `Time to build your habit!`, 'habit-' + h.id);
                }
            }
        }
    });

    // 3. Check Planner Events (Starts within 1 min)
    const events = state.data.planner || [];
    events.forEach(e => {
        if (e.start_datetime) {
            const eventISO = new Date(e.start_datetime).toISOString().slice(0, 16);
            if (eventISO === currentWait) {
                triggerAlarm(`Event: ${e.title}`, `Starting now!`, 'event-' + e.id);
            }
        }
    });

    // 4. Schedule Native Alarms (Next 15 mins) - For Background Reliability
    scheduleNativeAlarms();
}

function scheduleNativeAlarms() {
    if (!window.AppInventor || !window.AppInventor.scheduleAlarm) return;

    const now = new Date();
    const tasks = state.data.tasks || [];

    tasks.forEach(t => {
        if (t.status !== 'completed' && t.due_date === now.toISOString().slice(0, 10)) {
            const [h, m] = t.due_time.split(':');
            const due = new Date();
            due.setHours(h, m, 0, 0);

            const diffSec = (due - now) / 1000;
            // Schedule if between 1 and 15 minutes from now
            if (diffSec > 0 && diffSec < 900) {
                window.AppInventor.scheduleAlarm(t.id, t.title, Math.floor(diffSec));
            }
        }
    });
}

function triggerAlarm(title, body, uniqueId) {
    const key = `${new Date().toISOString().slice(0, 10)}-${uniqueId}`;
    if (notifiedItems.includes(key)) return;

    // 1. Audio
    playAlarmSound();

    // 2. Browser / ServiceWorker Notification
    if ('serviceWorker' in navigator && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body: body,
                icon: './icon-192.png',
                badge: './icon-192.png',
                vibrate: [200, 100, 200],
                tag: uniqueId,
                requireInteraction: true
            });
        });
    } else if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: './icon-192.png' });
    }

    // 3. In-App Modal
    showAlarmModal(title, body);

    // 4. MIT App Inventor Bridge (WebViewString)
    if (window.AppInventor && window.AppInventor.setWebViewString) {
        window.AppInventor.setWebViewString("ALARM:" + title + "|" + body);
    } else if (window.Android && window.Android.showToast) {
        window.Android.showToast(title + ": " + body);
    }

    // Save state
    notifiedItems.push(key);
    localStorage.setItem('notifiedItems', JSON.stringify(notifiedItems));
}

function playAlarmSound() {
    const audio = document.getElementById('alarmSound');
    if (!audio) return;

    const settings = state.data.settings?.[0] || { volume: 100, sound: 'classic' };

    // Map sound names to files
    const sounds = {
        'classic': 'assets/sounds/classic.wav',
        'digital': 'assets/sounds/digital_clock_20s.wav',
        'gentle': 'assets/sounds/gentle_wake_30s.wav',
        'chime': 'assets/sounds/chime.wav',
        'beep': 'assets/sounds/beep.wav',
        'system': 'default'
    };

    let src = sounds[settings.sound] || ('assets/sounds/' + settings.sound);
    if (!src.includes('.') && src !== 'default') src += '.wav';

    if (audio.src !== src) audio.src = src;

    audio.volume = (settings.volume || 100) / 100;
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Audio play failed", e));
}

window.playSuccessSound = function () {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'); // Cheery win sound
    const settings = state.data.settings?.[0] || { volume: 100 };
    audio.volume = (settings.volume || 100) / 100;
    audio.play().catch(e => console.log("Success sound play failed", e));
};

// Global test function for Settings page
window.testAlarmSound = function () {
    // Read directly from inputs for live preview
    const volume = Number(document.getElementById('alertVolume').value);
    const sound = document.getElementById('alertSound').value;

    // Mock state for playAlarmSound to use
    const originalSettings = state.data.settings?.[0];
    state.data.settings = [{ volume, sound }];

    playAlarmSound();

    // Restore state after short delay
    setTimeout(() => {
        if (state.data.settings && state.data.settings[0]) {
            state.data.settings[0] = originalSettings;
        }
    }, 1000);
}

function showAlarmModal(title, body) {
    // Check if modal already exists
    if (document.querySelector('.alarm-modal-overlay')) return;

    const modal = document.createElement('div');
    modal.className = 'alarm-modal-overlay';
    modal.innerHTML = `
        <div class="alarm-modal-box">
            <div style="font-size:48px; margin-bottom:16px">⏰</div>
            <h2 style="margin:0 0 10px 0; color:var(--text-main)">${title}</h2>
            <p style="margin:0 0 24px 0; color:var(--text-secondary); line-height:1.5">${body}</p>
            <button class="btn primary" style="width:100%; padding:12px; font-size:16px" onclick="this.closest('.alarm-modal-overlay').remove(); stopAlarmSound()">Dismiss</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function stopAlarmSound() {
    const audio = document.getElementById('alarmSound');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

// Start on init
// Wait for DOM to be ready before starting notification service
function waitAndStart() {
    const mainEl = document.getElementById('main');
    if (!mainEl) {
        setTimeout(waitAndStart, 100);
        return;
    }
    startNotificationService();
}
setTimeout(waitAndStart, 500);
