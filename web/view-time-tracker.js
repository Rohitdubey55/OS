/* view-time-tracker.js — "Time Spent On": a 3x2 grid of category stopwatches
   linked from the Pomodoro page, plus a Log of every play→pause interval and
   an Analysis page with charts. Styled against the app's SaaS design language
   (surface/border/text tokens, 20px cards, tabular numerals, soft shadows). */

const TT_SLOT_COUNT = 6;
const TT_DEFAULT_NAMES = ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6'];
const TT_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899'];

let ttCategories = [];      // 6 rows (one per slot) from time_categories
let ttLogs = [];            // rows from time_logs, loaded on demand
let ttLogsLoaded = false;
let ttTickTimer = null;     // setInterval driving the live time displays
let ttSaveTimers = {};      // cat.id -> debounce timer for text-field saves
let ttPendingFields = {};   // cat.id -> fields queued for the next debounced save
let ttRange = 'week';       // Analysis page date filter
let ttAnalysisCharts = {};  // Chart.js instances, so we can destroy() before re-render

/* ═══════════════════════════════════════════════════════
   DATE / FORMAT HELPERS
═══════════════════════════════════════════════════════ */

function ttTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function ttFormatHMS(totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec || 0));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// Same clock, but leading zero groups are dimmed so the meaningful digits lead.
function ttTimeHTML(totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec || 0));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    if (h > 0) return `${hh}<span class="tt-sep">:</span>${mm}<span class="tt-sep">:</span>${ss}`;
    if (m > 0) return `<span class="tt-dim">${hh}<span class="tt-sep">:</span></span>${mm}<span class="tt-sep">:</span>${ss}`;
    return `<span class="tt-dim">${hh}<span class="tt-sep">:</span>${mm}<span class="tt-sep">:</span></span>${ss}`;
}

function ttFormatDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
}

function ttFormatDateLabel(dateStr) {
    if (!dateStr) return '';
    const today = ttTodayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    if (dateStr === today) return 'Today';
    if (dateStr === yStr) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function ttEscape(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ttParseTodos(json) {
    try { const arr = JSON.parse(json || '[]'); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}

/* ═══════════════════════════════════════════════════════
   ICONS (inline SVG — matches the app's stroke-icon style)
═══════════════════════════════════════════════════════ */

const TT_ICON = {
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5"/></svg>',
    reset: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/></svg>',
    target: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></svg>',
    back: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="10"/></svg>',
    log: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
    close: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'
};

/* ═══════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════ */

async function ttLoadCategories() {
    if (Array.isArray(state.data.time_categories) && state.data.time_categories.length) {
        ttCategories = state.data.time_categories;
    } else {
        ttCategories = await apiGet('time_categories').catch(() => []);
        state.data.time_categories = ttCategories;
    }
    await ttEnsureSlots();
    ttCategories.sort((a, b) => a.slot_index - b.slot_index);
    ttHandleDayRollover();
}

// The grid always shows exactly 6 slots — create any that don't exist yet
// (first-ever visit) with a default name so the page never looks broken.
async function ttEnsureSlots() {
    const bySlot = {};
    ttCategories.forEach(c => { bySlot[Number(c.slot_index)] = c; });
    const todayStr = ttTodayStr();
    for (let idx = 0; idx < TT_SLOT_COUNT; idx++) {
        if (bySlot[idx]) continue;
        try {
            const payload = { slot_index: idx, name: TT_DEFAULT_NAMES[idx], goal_minutes: 0, elapsed_seconds: 0, running: false, day: todayStr, todos_json: '[]' };
            const res = await apiPost({ action: 'create', sheet: 'time_categories', payload });
            if (res && res.success) {
                ttCategories.push({ id: res.id, running_since: null, ...payload });
            }
        } catch (e) { console.error('ttEnsureSlots: failed to create slot', idx, e); }
    }
    state.data.time_categories = ttCategories;
}

// A category's `elapsed_seconds` accumulates across every play/pause within a
// single calendar day. On the first render of a new day, zero it out locally
// and on the server — the day's history is already safe in time_logs.
function ttHandleDayRollover() {
    const today = ttTodayStr();
    ttCategories.forEach(cat => {
        if (cat.day === today) return;
        if (cat.running && cat.running_since) {
            const startedAt = cat.running_since;
            const endedAt = new Date().toISOString();
            const deltaSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
            if (deltaSec > 0) ttCreateLog(cat, startedAt, endedAt, deltaSec);
            cat.running_since = endedAt;
        }
        cat.elapsed_seconds = 0;
        cat.day = today;
        ttPersistCategory(cat, { elapsed_seconds: 0, day: today, running_since: cat.running_since });
    });
}

/* ═══════════════════════════════════════════════════════
   PERSISTENCE (debounced for text fields, immediate for play/pause)
═══════════════════════════════════════════════════════ */

function ttPersistCategory(cat, fields) {
    apiPost({ action: 'update', sheet: 'time_categories', id: cat.id, payload: fields })
        .catch(e => console.error('ttPersistCategory failed:', e));
}

function ttScheduleSave(cat, fields, delay = 700) {
    Object.assign(cat, fields);
    ttPendingFields[cat.id] = Object.assign(ttPendingFields[cat.id] || {}, fields);
    clearTimeout(ttSaveTimers[cat.id]);
    ttSaveTimers[cat.id] = setTimeout(() => {
        const toSave = ttPendingFields[cat.id];
        delete ttPendingFields[cat.id];
        ttPersistCategory(cat, toSave);
    }, delay);
}

async function ttCreateLog(cat, startedAt, endedAt, durationSeconds) {
    try {
        await apiPost({
            action: 'create', sheet: 'time_logs',
            payload: {
                category_id: cat.id, category_name: cat.name, date: ttTodayStr(),
                duration_seconds: durationSeconds, started_at: startedAt, ended_at: endedAt
            }
        });
        ttLogsLoaded = false; // invalidate the cached log list so Log/Analysis refetch
    } catch (e) { console.error('ttCreateLog failed:', e); }
}

/* ═══════════════════════════════════════════════════════
   TIMER ENGINE
═══════════════════════════════════════════════════════ */

function ttLiveElapsed(cat) {
    let sec = cat.elapsed_seconds || 0;
    if (cat.running && cat.running_since) {
        sec += Math.max(0, Math.floor((Date.now() - new Date(cat.running_since).getTime()) / 1000));
    }
    return sec;
}

function ttFindCat(slotIndex) {
    return ttCategories.find(c => Number(c.slot_index) === Number(slotIndex));
}

async function ttToggle(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;

    if (!cat.running) {
        cat.running = true;
        cat.running_since = new Date().toISOString();
        ttPersistCategory(cat, { running: true, running_since: cat.running_since });
        ttStartTicker();
    } else {
        const startedAt = cat.running_since;
        const endedAtDate = new Date();
        const deltaSec = Math.max(0, Math.floor((endedAtDate.getTime() - new Date(startedAt).getTime()) / 1000));
        cat.elapsed_seconds = (cat.elapsed_seconds || 0) + deltaSec;
        cat.running = false;
        cat.running_since = null;
        ttPersistCategory(cat, { running: false, running_since: null, elapsed_seconds: cat.elapsed_seconds });
        if (deltaSec >= 1) ttCreateLog(cat, startedAt, endedAtDate.toISOString(), deltaSec);
    }

    ttSyncCardState(cat);
    ttTick();
}

// Zero today's accumulated time for one stopwatch. Logged intervals are
// untouched — the Log and Analysis keep everything already recorded.
async function ttResetTimer(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    if (!confirm(`Reset "${cat.name}" back to 00:00:00 for today?\n\nAlready-logged time stays in your Log and Analysis.`)) return;

    if (cat.running && cat.running_since) {
        const startedAt = cat.running_since;
        const endedAtDate = new Date();
        const deltaSec = Math.max(0, Math.floor((endedAtDate.getTime() - new Date(startedAt).getTime()) / 1000));
        if (deltaSec >= 1) ttCreateLog(cat, startedAt, endedAtDate.toISOString(), deltaSec);
    }
    cat.elapsed_seconds = 0;
    cat.running = false;
    cat.running_since = null;
    ttPersistCategory(cat, { elapsed_seconds: 0, running: false, running_since: null });
    ttSyncCardState(cat);
    ttTick();
}

// Repaint the bits of a card that depend on running state (without blowing away
// the to-do list or stealing focus from the name field).
function ttSyncCardState(cat) {
    const card = document.getElementById('ttCard_' + cat.slot_index);
    if (card) card.classList.toggle('running', !!cat.running);
    const btn = document.getElementById('ttPlayBtn_' + cat.slot_index);
    if (btn) {
        btn.innerHTML = (cat.running ? TT_ICON.pause : TT_ICON.play) + '<span>' + (cat.running ? 'Pause' : 'Start') + '</span>';
        btn.title = cat.running ? 'Pause this stopwatch' : 'Start this stopwatch';
    }
}

function ttStartTicker() {
    if (ttTickTimer) return;
    ttTickTimer = setInterval(ttTick, 1000);
}

function ttStopTicker() {
    if (ttTickTimer) clearInterval(ttTickTimer);
    ttTickTimer = null;
}

// One pass over every card: clock, goal progress, and the day's running total.
function ttTick() {
    let anyRunning = false;
    let todayTotal = 0;

    ttCategories.forEach(cat => {
        if (cat.running) anyRunning = true;
        const elapsed = ttLiveElapsed(cat);
        todayTotal += elapsed;

        const el = document.getElementById('ttTime_' + cat.slot_index);
        if (el) el.innerHTML = ttTimeHTML(elapsed);

        const goalSec = (cat.goal_minutes || 0) * 60;
        const bar = document.getElementById('ttProg_' + cat.slot_index);
        const lbl = document.getElementById('ttProgLabel_' + cat.slot_index);
        if (bar && lbl) {
            if (goalSec > 0) {
                const pct = Math.min(100, Math.round((elapsed / goalSec) * 100));
                bar.style.width = pct + '%';
                bar.parentElement.classList.toggle('hit', pct >= 100);
                lbl.innerHTML = `<span>${ttFormatDuration(elapsed)} of ${cat.goal_minutes}m</span><span>${pct}%</span>`;
            } else {
                bar.style.width = '0%';
                lbl.innerHTML = `<span>No daily goal set</span><span></span>`;
            }
        }
    });

    const totalEl = document.getElementById('ttTodayTotal');
    if (totalEl) totalEl.textContent = ttFormatDuration(todayTotal);

    if (!anyRunning) ttStopTicker();
}

// Called by routeTo() (main.js) whenever the user navigates away from any view —
// stops the interval so it doesn't keep ticking (and doesn't leak) in the background.
function ttStopAllTimers() {
    ttStopTicker();
}
window.ttStopAllTimers = ttStopAllTimers;

/* ═══════════════════════════════════════════════════════
   NAME / GOAL EDITING
═══════════════════════════════════════════════════════ */

function ttUpdateName(slotIndex, value) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    ttScheduleSave(cat, { name: String(value || '').slice(0, 60) });
}

function ttUpdateGoal(slotIndex, value) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    const n = Math.max(0, Math.min(1440, parseInt(value, 10) || 0));
    ttScheduleSave(cat, { goal_minutes: n }, 300);
    ttTick(); // reflect the new goal in the progress bar immediately
}

/* ═══════════════════════════════════════════════════════
   TO-DO LIST (per category, stored as JSON on time_categories)
═══════════════════════════════════════════════════════ */

function ttSaveTodos(cat, todos) {
    cat.todos_json = JSON.stringify(todos);
    ttScheduleSave(cat, { todos_json: cat.todos_json }, 400);
}

function ttRerenderTodos(slotIndex, todos) {
    const listEl = document.getElementById('ttTodoList_' + slotIndex);
    if (listEl) {
        listEl.innerHTML = todos.length
            ? todos.map(t => ttRenderTodoItem(slotIndex, t)).join('')
            : '<div class="tt-empty">Nothing planned yet</div>';
    }
    const countEl = document.getElementById('ttTodoCount_' + slotIndex);
    if (countEl) countEl.textContent = todos.length ? `${todos.filter(t => t.done).length}/${todos.length}` : '';
}

function ttAddTodo(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    const input = document.getElementById('ttTodoInput_' + slotIndex);
    const text = input ? input.value.trim() : '';
    if (!text) return;
    const todos = ttParseTodos(cat.todos_json);
    todos.push({ id: String(Date.now()) + Math.floor(Math.random() * 1000), text: text.slice(0, 200), done: false });
    ttSaveTodos(cat, todos);
    if (input) input.value = '';
    ttRerenderTodos(slotIndex, todos);
}

function ttToggleTodo(slotIndex, todoId) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    const todos = ttParseTodos(cat.todos_json);
    const t = todos.find(x => String(x.id) === String(todoId));
    if (!t) return;
    t.done = !t.done;
    ttSaveTodos(cat, todos);
    ttRerenderTodos(slotIndex, todos);
}

function ttDeleteTodo(slotIndex, todoId) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    const todos = ttParseTodos(cat.todos_json).filter(x => String(x.id) !== String(todoId));
    ttSaveTodos(cat, todos);
    ttRerenderTodos(slotIndex, todos);
}

/* ═══════════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════════ */

function ttSharedCSS() {
    return `
    .tt-wrap { max-width: 1300px; margin: 0 auto; padding-bottom: 48px; }
    .tt-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .tt-toolbar-left { display: flex; align-items: center; gap: 10px; }
    .tt-back {
        display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px 0 10px;
        border: 1px solid var(--border-color); border-radius: 10px; background: var(--surface-1);
        color: var(--text-2); font-size: 13px; font-weight: 700; cursor: pointer;
        transition: background .15s ease, color .15s ease;
    }
    .tt-back:hover { background: var(--surface-2); color: var(--text-1); }
    .tt-summary { display: inline-flex; align-items: baseline; gap: 7px; padding: 0 4px; font-size: 12px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--text-3); }
    .tt-summary b { font-size: 17px; font-weight: 850; letter-spacing: 0; text-transform: none; color: var(--text-1); font-variant-numeric: tabular-nums; }
    .tt-actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .tt-btn {
        display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px;
        border: 1px solid var(--border-color); border-radius: 11px; background: var(--surface-1);
        color: var(--text-1); font-size: 13px; font-weight: 700; cursor: pointer;
        box-shadow: 0 1px 2px rgba(15,23,42,.04); transition: background .15s ease, transform .15s ease;
    }
    .tt-btn:hover { background: var(--surface-2); }
    .tt-btn:active { transform: translateY(1px); }
    .tt-btn svg { color: var(--text-3); }
    .tt-btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
    .tt-btn.primary svg { color: rgba(255,255,255,.85); }
    .tt-btn.primary:hover { filter: brightness(1.06); background: var(--primary); }
    `;
}

/* ═══════════════════════════════════════════════════════
   TRACKER PAGE (the 3x2 stopwatch grid)
═══════════════════════════════════════════════════════ */

async function renderTimeTracker() {
    const main = document.getElementById('main');
    main.innerHTML = `<div class="tt-wrap" style="padding:60px 20px;text-align:center;color:var(--text-3);font-size:13.5px">Loading your stopwatches…</div>`;
    try {
        await ttLoadCategories();
    } catch (e) {
        console.error('renderTimeTracker: load failed', e);
    }
    main.innerHTML = ttPageHTML();
    if (typeof renderAllIcons === 'function') renderAllIcons();
    else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    ttTick();
    if (ttCategories.some(c => c.running)) ttStartTicker();
}

function ttPageHTML() {
    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return `
    <style>${ttSharedCSS()}
        .tt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1150px) { .tt-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px)  { .tt-grid { grid-template-columns: 1fr; } }

        .tt-card {
            position: relative; display: flex; flex-direction: column;
            background: var(--surface-1); border: 1px solid var(--border-color);
            border-radius: 20px; padding: 18px;
            box-shadow: var(--shadow-card, 0 4px 15px rgba(15,23,42,.05));
            transition: border-color .2s ease, box-shadow .2s ease;
        }
        .tt-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,.08); }
        .tt-card.running { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft, rgba(99,102,241,.14)), 0 8px 22px rgba(15,23,42,.06); }

        .tt-head { display: flex; align-items: center; gap: 8px; }
        .tt-live { width: 7px; height: 7px; border-radius: 50%; background: var(--border-color); flex: none; transition: background .2s ease; }
        .tt-card.running .tt-live { background: var(--primary); animation: ttPulse 1.6s ease-in-out infinite; }
        @keyframes ttPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.82); } }

        .tt-name {
            flex: 1; min-width: 0; height: 32px; padding: 0 8px;
            border: 1px solid transparent; border-radius: 9px; background: transparent;
            color: var(--text-1); font-size: 15px; font-weight: 800; font-family: inherit;
            text-overflow: ellipsis; transition: background .15s ease, border-color .15s ease;
        }
        .tt-name::placeholder { color: var(--text-3); font-weight: 700; }
        .tt-name:hover { background: var(--surface-2); }
        .tt-name:focus { outline: none; background: var(--surface-1); border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft, rgba(99,102,241,.14)); }

        .tt-goal {
            display: inline-flex; align-items: center; gap: 5px; flex: none; height: 30px; padding: 0 10px;
            border: 1px solid var(--border-color); border-radius: 999px; background: var(--surface-2);
            transition: border-color .15s ease, background .15s ease;
        }
        .tt-goal:focus-within { border-color: var(--primary); background: var(--surface-1); }
        .tt-goal > svg { color: var(--text-3); flex: none; }
        .tt-goal input {
            width: 30px; border: none; background: transparent; padding: 0; text-align: right;
            color: var(--text-1); font-size: 12.5px; font-weight: 800; font-family: inherit;
            font-variant-numeric: tabular-nums; -moz-appearance: textfield;
        }
        .tt-goal input::-webkit-outer-spin-button, .tt-goal input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .tt-goal input:focus { outline: none; }
        .tt-goal input::placeholder { color: var(--text-3); font-weight: 700; }
        .tt-goal em { font-style: normal; font-size: 11px; font-weight: 700; color: var(--text-3); }

        .tt-time {
            text-align: center; margin: 16px 0 12px; font-size: 36px; font-weight: 800;
            letter-spacing: -.5px; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1;
        }
        .tt-time .tt-dim { color: var(--text-3); opacity: .45; }
        .tt-time .tt-sep { opacity: .35; margin: 0 1px; }

        .tt-track { height: 6px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
        .tt-track i { display: block; height: 100%; width: 0; border-radius: 999px; background: var(--primary); transition: width .5s cubic-bezier(.4,0,.2,1); }
        .tt-track.hit i { background: var(--success, #10B981); }
        .tt-prog-label { display: flex; justify-content: space-between; gap: 8px; margin-top: 7px; font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--text-3); font-variant-numeric: tabular-nums; }

        .tt-controls { display: flex; gap: 8px; margin: 14px 0 2px; }
        .tt-play {
            flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            height: 42px; border: none; border-radius: 12px; background: var(--primary); color: #fff;
            font-size: 13.5px; font-weight: 800; font-family: inherit; cursor: pointer;
            transition: filter .15s ease, transform .12s ease, background .15s ease, color .15s ease;
        }
        .tt-play:hover { filter: brightness(1.07); }
        .tt-play:active { transform: translateY(1px); }
        .tt-card.running .tt-play { background: var(--surface-3); color: var(--text-1); }
        .tt-reset {
            width: 42px; flex: none; border: 1px solid var(--border-color); border-radius: 12px;
            background: var(--surface-2); color: var(--text-3); cursor: pointer;
            display: flex; align-items: center; justify-content: center; transition: color .15s ease, background .15s ease;
        }
        .tt-reset:hover { color: var(--danger, #EF4444); background: var(--surface-3); }

        .tt-todos { display: flex; flex-direction: column; flex: 1; margin-top: 16px; padding-top: 13px; border-top: 1px solid var(--border-color); }
        .tt-todos-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .tt-todos-head b { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
        .tt-todos-head span { font-size: 11px; font-weight: 800; color: var(--text-3); font-variant-numeric: tabular-nums; }
        .tt-todo-list { display: flex; flex-direction: column; gap: 1px; max-height: 136px; overflow-y: auto; margin-bottom: 9px; }
        .tt-todo { display: flex; align-items: center; gap: 9px; padding: 5px 6px; border-radius: 9px; transition: background .12s ease; }
        .tt-todo:hover { background: var(--surface-2); }
        .tt-todo input[type=checkbox] { width: 15px; height: 15px; flex: none; cursor: pointer; accent-color: var(--primary); }
        .tt-todo span { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; color: var(--text-1); word-break: break-word; }
        .tt-todo.done span { text-decoration: line-through; color: var(--text-3); }
        .tt-todo button { flex: none; opacity: 0; border: none; background: none; color: var(--text-3); cursor: pointer; padding: 2px 3px; display: flex; transition: opacity .12s ease, color .12s ease; }
        .tt-todo:hover button { opacity: 1; }
        .tt-todo button:hover { color: var(--danger, #EF4444); }
        .tt-empty { padding: 12px 0 14px; text-align: center; font-size: 12.5px; color: var(--text-3); }

        .tt-add { display: flex; gap: 6px; margin-top: auto; padding-top: 4px; }
        .tt-add input {
            flex: 1; min-width: 0; height: 36px; padding: 0 12px;
            border: 1px solid var(--border-color); border-radius: 10px; background: var(--surface-2);
            color: var(--text-1); font-size: 13px; font-family: inherit;
        }
        .tt-add input:focus { outline: none; border-color: var(--primary); background: var(--surface-1); }
        .tt-add button {
            width: 36px; height: 36px; flex: none; border: none; border-radius: 10px;
            background: var(--surface-3); color: var(--text-2); font-size: 19px; font-weight: 600; line-height: 1;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s ease, color .15s ease;
        }
        .tt-add button:hover { background: var(--primary); color: #fff; }

        /* Log sheet */
        .tt-sheet { position: fixed; inset: 0; z-index: 200; background: rgba(15,23,42,.45); backdrop-filter: blur(2px); display: flex; align-items: flex-end; justify-content: center; }
        .tt-sheet.hidden { display: none; }
        .tt-sheet-inner { width: 100%; max-width: 540px; max-height: 80vh; display: flex; flex-direction: column; background: var(--surface-1); border-radius: 22px 22px 0 0; box-shadow: 0 -12px 40px rgba(15,23,42,.22); }
        @media (min-width: 640px) { .tt-sheet { align-items: center; } .tt-sheet-inner { border-radius: 22px; max-height: 72vh; } }
        .tt-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border-color); }
        .tt-sheet-head h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--text-1); }
        .tt-sheet-head p { margin: 3px 0 0; font-size: 12px; color: var(--text-3); font-weight: 600; }
        .tt-sheet-close { width: 32px; height: 32px; flex: none; border: 1px solid var(--border-color); border-radius: 10px; background: var(--surface-2); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .tt-sheet-close:hover { background: var(--surface-3); color: var(--text-1); }
        .tt-sheet-body { overflow-y: auto; padding: 6px 20px 22px; }
        .tt-log-group { margin-top: 16px; }
        .tt-log-date { margin-bottom: 4px; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
        .tt-log-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
        .tt-log-swatch { width: 8px; height: 8px; border-radius: 50%; flex: none; }
        .tt-log-cat { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tt-log-time { font-size: 11.5px; color: var(--text-3); font-weight: 600; font-variant-numeric: tabular-nums; }
        .tt-log-dur { min-width: 56px; text-align: right; font-size: 13px; font-weight: 800; color: var(--text-1); font-variant-numeric: tabular-nums; }
        .tt-log-del { flex: none; border: none; background: none; color: var(--text-3); cursor: pointer; padding: 3px; display: flex; opacity: .55; }
        .tt-log-del:hover { color: var(--danger, #EF4444); opacity: 1; }
        .tt-log-empty { padding: 44px 16px; text-align: center; font-size: 13px; line-height: 1.6; color: var(--text-3); }
    </style>
    <div class="tt-wrap">
        <div class="tt-toolbar">
            <div class="tt-toolbar-left">
                <button class="tt-back" onclick="routeTo('pomodoro')" title="Back to Pomodoro">${TT_ICON.back} Pomodoro</button>
                <div class="tt-summary">${ttEscape(todayLabel)} · <b id="ttTodayTotal">0s</b></div>
            </div>
            <div class="tt-actions-row">
                <button class="tt-btn" onclick="ttOpenLogModal()">${TT_ICON.log} Log</button>
                <button class="tt-btn primary" onclick="routeTo('timeAnalysis')">${TT_ICON.chart} View Analysis</button>
            </div>
        </div>

        <div class="tt-grid">
            ${ttCategories.slice(0, TT_SLOT_COUNT).map(cat => ttRenderCard(cat)).join('')}
        </div>
    </div>

    <div class="tt-sheet hidden" id="ttLogModal" onclick="ttCloseLogModalBg(event)">
        <div class="tt-sheet-inner">
            <div class="tt-sheet-head">
                <div>
                    <h3>Time Log</h3>
                    <p>Every stretch you tracked, newest first</p>
                </div>
                <button class="tt-sheet-close" onclick="ttCloseLogModal()">${TT_ICON.close}</button>
            </div>
            <div id="ttLogModalBody" class="tt-sheet-body"></div>
        </div>
    </div>
    `;
}

function ttRenderCard(cat) {
    const elapsed = ttLiveElapsed(cat);
    const todos = ttParseTodos(cat.todos_json);
    const doneCount = todos.filter(t => t.done).length;
    const slot = cat.slot_index;

    return `
    <div class="tt-card ${cat.running ? 'running' : ''}" id="ttCard_${slot}">
        <div class="tt-head">
            <span class="tt-live"></span>
            <input class="tt-name" type="text" maxlength="60" placeholder="Name this category"
                   value="${ttEscape(cat.name || '')}" oninput="ttUpdateName(${slot}, this.value)" />
            <label class="tt-goal" title="Daily goal for this category, in minutes">
                ${TT_ICON.target}
                <input type="number" min="0" max="1440" placeholder="0" value="${cat.goal_minutes || ''}"
                       onchange="ttUpdateGoal(${slot}, this.value)" />
                <em>min</em>
            </label>
        </div>

        <div class="tt-time" id="ttTime_${slot}">${ttTimeHTML(elapsed)}</div>

        <div class="tt-track" id="ttTrack_${slot}"><i id="ttProg_${slot}"></i></div>
        <div class="tt-prog-label" id="ttProgLabel_${slot}"></div>

        <div class="tt-controls">
            <button class="tt-play" id="ttPlayBtn_${slot}" onclick="ttToggle(${slot})"
                    title="${cat.running ? 'Pause this stopwatch' : 'Start this stopwatch'}">
                ${cat.running ? TT_ICON.pause : TT_ICON.play}<span>${cat.running ? 'Pause' : 'Start'}</span>
            </button>
            <button class="tt-reset" onclick="ttResetTimer(${slot})" title="Reset today's time">${TT_ICON.reset}</button>
        </div>

        <div class="tt-todos">
            <div class="tt-todos-head">
                <b>To-dos</b>
                <span id="ttTodoCount_${slot}">${todos.length ? `${doneCount}/${todos.length}` : ''}</span>
            </div>
            <div class="tt-todo-list" id="ttTodoList_${slot}">
                ${todos.length ? todos.map(t => ttRenderTodoItem(slot, t)).join('') : '<div class="tt-empty">Nothing planned yet</div>'}
            </div>
            <div class="tt-add">
                <input type="text" maxlength="200" placeholder="Add a to-do…" id="ttTodoInput_${slot}"
                       onkeydown="if(event.key==='Enter'){ttAddTodo(${slot}); event.preventDefault();}" />
                <button onclick="ttAddTodo(${slot})" title="Add to-do">+</button>
            </div>
        </div>
    </div>
    `;
}

function ttRenderTodoItem(slotIndex, t) {
    return `
    <label class="tt-todo ${t.done ? 'done' : ''}">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="ttToggleTodo(${slotIndex}, '${t.id}')" />
        <span>${ttEscape(t.text)}</span>
        <button type="button" onclick="ttDeleteTodo(${slotIndex}, '${t.id}')" title="Remove">${TT_ICON.trash}</button>
    </label>
    `;
}

/* ═══════════════════════════════════════════════════════
   LOG SHEET
═══════════════════════════════════════════════════════ */

async function ttOpenLogModal() {
    const modal = document.getElementById('ttLogModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const body = document.getElementById('ttLogModalBody');
    if (body) body.innerHTML = '<div class="tt-log-empty">Loading…</div>';
    await ttLoadLogs();
    if (body) body.innerHTML = ttRenderLogList();
}

function ttCloseLogModal() {
    document.getElementById('ttLogModal')?.classList.add('hidden');
}

function ttCloseLogModalBg(e) {
    if (e.target && e.target.id === 'ttLogModal') ttCloseLogModal();
}

async function ttLoadLogs(force = false) {
    if (ttLogsLoaded && !force) return;
    try {
        ttLogs = await apiGet('time_logs');
    } catch (e) {
        console.error('ttLoadLogs failed:', e);
        ttLogs = ttLogs || [];
    }
    ttLogs.sort((a, b) => new Date(b.started_at || b.created_at || 0) - new Date(a.started_at || a.created_at || 0));
    ttLogsLoaded = true;
}

function ttLogColor(log) {
    const cat = ttCategories.find(c => String(c.id) === String(log.category_id));
    return TT_COLORS[(cat ? Number(cat.slot_index) : 0) % TT_COLORS.length];
}

function ttRenderLogList() {
    if (!ttLogs.length) {
        return '<div class="tt-log-empty">Nothing logged yet.<br>Press <b>Start</b> on a stopwatch, then <b>Pause</b> — that stretch lands here.</div>';
    }
    const groups = {};
    ttLogs.forEach(l => { (groups[l.date] = groups[l.date] || []).push(l); });
    const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return dates.map(date => {
        const rows = groups[date];
        const dayTotal = rows.reduce((s, l) => s + (l.duration_seconds || 0), 0);
        return `
        <div class="tt-log-group">
            <div class="tt-log-date">${ttFormatDateLabel(date)} · ${ttFormatDuration(dayTotal)}</div>
            ${rows.map(l => {
                const started = l.started_at ? new Date(l.started_at) : null;
                const timeStr = started && !isNaN(started.getTime())
                    ? started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
                return `
                <div class="tt-log-row">
                    <span class="tt-log-swatch" style="background:${ttLogColor(l)}"></span>
                    <span class="tt-log-cat">${ttEscape(l.category_name || 'Category')}</span>
                    <span class="tt-log-time">${timeStr}</span>
                    <span class="tt-log-dur">${ttFormatDuration(l.duration_seconds)}</span>
                    <button class="tt-log-del" onclick="ttDeleteLog('${l.id}')" title="Delete entry">${TT_ICON.trash}</button>
                </div>`;
            }).join('')}
        </div>`;
    }).join('');
}

async function ttDeleteLog(id) {
    if (!confirm('Delete this log entry?')) return;
    try {
        await apiPost({ action: 'delete', sheet: 'time_logs', id });
        ttLogs = ttLogs.filter(l => String(l.id) !== String(id));
        const body = document.getElementById('ttLogModalBody');
        if (body) body.innerHTML = ttRenderLogList();
    } catch (e) {
        console.error('ttDeleteLog failed:', e);
        if (typeof toast === 'function') toast('Delete failed');
    }
}

/* ═══════════════════════════════════════════════════════
   ANALYSIS PAGE
═══════════════════════════════════════════════════════ */

async function renderTimeAnalysis() {
    const main = document.getElementById('main');
    main.innerHTML = `<div class="tt-wrap" style="padding:60px 20px;text-align:center;color:var(--text-3);font-size:13.5px">Crunching your time data…</div>`;
    try {
        await ttLoadCategories();
        await ttLoadLogs(true);
    } catch (e) {
        console.error('renderTimeAnalysis: load failed', e);
    }
    main.innerHTML = ttAnalysisHTML();
    ttRenderAnalysisCharts();
}

function ttAnalysisHTML() {
    const ranges = ['today', 'week', 'month', 'all'];
    return `
    <style>${ttSharedCSS()}
        .tt-seg { display: inline-flex; padding: 4px; gap: 2px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--surface-2); }
        .tt-seg button {
            height: 30px; padding: 0 14px; border: none; border-radius: 9px; background: transparent;
            color: var(--text-3); font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer;
            transition: background .15s ease, color .15s ease;
        }
        .tt-seg button:hover { color: var(--text-1); }
        .tt-seg button.active { background: var(--surface-1); color: var(--text-1); box-shadow: 0 1px 2px rgba(15,23,42,.08); }

        .tt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        @media (max-width: 900px) { .tt-stats { grid-template-columns: repeat(2, 1fr); } }
        .tt-stat { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 18px; padding: 16px 18px; box-shadow: var(--shadow-card, 0 4px 15px rgba(15,23,42,.05)); }
        .tt-stat-v { font-size: 24px; font-weight: 850; line-height: 1.1; color: var(--text-1); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tt-stat-l { margin-top: 6px; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }

        .tt-charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (max-width: 900px) { .tt-charts { grid-template-columns: 1fr; } }
        .tt-chart-card { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 20px; padding: 18px; box-shadow: var(--shadow-card, 0 4px 15px rgba(15,23,42,.05)); }
        .tt-chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .tt-chart-head h3 { margin: 0; font-size: 14px; font-weight: 800; color: var(--text-1); }
        .tt-chart-head span { font-size: 11px; font-weight: 700; color: var(--text-3); }
        .tt-chart-body { position: relative; height: 250px; }
        .tt-chart-empty { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12.5px; color: var(--text-3); text-align: center; }
    </style>
    <div class="tt-wrap">
        <div class="tt-toolbar">
            <div class="tt-toolbar-left">
                <button class="tt-back" onclick="routeTo('timeTracker')" title="Back to stopwatches">${TT_ICON.back} Stopwatches</button>
            </div>
            <div class="tt-seg">
                ${ranges.map(r => `<button class="${ttRange === r ? 'active' : ''}" data-range="${r}" onclick="ttSetRange('${r}')">${ttRangeLabel(r)}</button>`).join('')}
            </div>
        </div>

        <div class="tt-stats" id="ttStatsRow"></div>

        <div class="tt-charts">
            <div class="tt-chart-card">
                <div class="tt-chart-head"><h3>Share of time</h3><span>by category</span></div>
                <div class="tt-chart-body" id="ttWrapShare"><canvas id="ttChartShare"></canvas></div>
            </div>
            <div class="tt-chart-card">
                <div class="tt-chart-head"><h3>Daily trend</h3><span>minutes tracked</span></div>
                <div class="tt-chart-body" id="ttWrapTrend"><canvas id="ttChartTrend"></canvas></div>
            </div>
            <div class="tt-chart-card">
                <div class="tt-chart-head"><h3>Total by category</h3><span>minutes</span></div>
                <div class="tt-chart-body" id="ttWrapBar"><canvas id="ttChartBar"></canvas></div>
            </div>
            <div class="tt-chart-card">
                <div class="tt-chart-head"><h3>Goal vs. actual</h3><span>daily average</span></div>
                <div class="tt-chart-body" id="ttWrapGoal"><canvas id="ttChartGoal"></canvas></div>
            </div>
        </div>
    </div>
    `;
}

function ttRangeLabel(r) { return { today: 'Today', week: 'Week', month: 'Month', all: 'All time' }[r] || r; }

function ttSetRange(r) {
    ttRange = r;
    document.querySelectorAll('.tt-seg button').forEach(b => b.classList.toggle('active', b.dataset.range === r));
    ttRenderAnalysisCharts();
}

function ttFilteredLogs() {
    const now = new Date();
    return ttLogs.filter(l => {
        if (!l.date) return false;
        if (ttRange === 'today') return l.date === ttTodayStr();
        const d = new Date(l.date + 'T00:00:00');
        if (isNaN(d.getTime())) return false;
        const diffDays = (now - d) / 86400000;
        if (ttRange === 'week') return diffDays >= 0 && diffDays < 7;
        if (ttRange === 'month') return diffDays >= 0 && diffDays < 30;
        return true; // all
    });
}

function ttAggregateByCategory(logs) {
    const map = {};
    logs.forEach(l => {
        const key = String(l.category_id || l.category_name || 'unknown');
        if (!map[key]) map[key] = { id: l.category_id, fallbackName: l.category_name, seconds: 0 };
        map[key].seconds += (l.duration_seconds || 0);
    });
    return Object.values(map).map(entry => {
        const cat = ttCategories.find(c => String(c.id) === String(entry.id));
        return {
            id: entry.id,
            name: cat ? cat.name : (entry.fallbackName || 'Category'),
            slotIndex: cat ? Number(cat.slot_index) : 0,
            seconds: entry.seconds
        };
    }).sort((a, b) => b.seconds - a.seconds);
}

function ttAggregateByDay(logs) {
    const map = {};
    logs.forEach(l => { map[l.date] = (map[l.date] || 0) + (l.duration_seconds || 0); });
    const dates = Object.keys(map).sort();
    return { dates, seconds: dates.map(d => map[d]) };
}

function ttCssVar(name, fallback) {
    try { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; }
    catch (e) { return fallback; }
}

function ttChartAxisOptions(horizontal = false) {
    const text = ttCssVar('--text-3', '#9097A1');
    const grid = ttCssVar('--border-color', 'rgba(15,23,42,.08)');
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
            legend: { display: false },
            tooltip: { padding: 10, cornerRadius: 8, displayColors: false }
        },
        scales: {
            x: { ticks: { color: text, font: { size: 11 } }, grid: { color: grid, drawBorder: false }, border: { display: false } },
            y: { ticks: { color: text, font: { size: 11 } }, grid: { color: grid, drawBorder: false }, border: { display: false }, beginAtZero: true }
        }
    };
}

function ttDestroyCharts() {
    Object.values(ttAnalysisCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
    ttAnalysisCharts = {};
}

function ttChartEmpty(wrapId, message) {
    const wrap = document.getElementById(wrapId);
    if (wrap) wrap.innerHTML = `<div class="tt-chart-empty">${message}</div>`;
}

function ttRenderAnalysisCharts() {
    ttDestroyCharts();
    const logs = ttFilteredLogs();
    const byCat = ttAggregateByCategory(logs);
    const byDay = ttAggregateByDay(logs);
    const activeDays = new Set(logs.map(l => l.date)).size;
    const totalSec = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const dayCount = ttRange === 'today' ? 1 : ttRange === 'week' ? 7 : ttRange === 'month' ? 30 : Math.max(1, activeDays);

    const statsRow = document.getElementById('ttStatsRow');
    if (statsRow) {
        statsRow.innerHTML = `
            <div class="tt-stat"><div class="tt-stat-v">${ttFormatDuration(totalSec)}</div><div class="tt-stat-l">Total tracked</div></div>
            <div class="tt-stat"><div class="tt-stat-v">${byCat[0] ? ttEscape(byCat[0].name) : '—'}</div><div class="tt-stat-l">Top category</div></div>
            <div class="tt-stat"><div class="tt-stat-v">${ttFormatDuration(Math.round(totalSec / dayCount))}</div><div class="tt-stat-l">Daily average</div></div>
            <div class="tt-stat"><div class="tt-stat-v">${activeDays}</div><div class="tt-stat-l">Active days</div></div>
        `;
    }

    if (typeof Chart === 'undefined') return; // Chart.js CDN not ready — stat tiles still render

    const text = ttCssVar('--text-2', '#5B6470');

    // Share of time — doughnut
    if (!byCat.length) {
        ttChartEmpty('ttWrapShare', 'No time tracked in this range yet.');
    } else {
        ttAnalysisCharts.share = new Chart(document.getElementById('ttChartShare'), {
            type: 'doughnut',
            data: {
                labels: byCat.map(c => c.name),
                datasets: [{
                    data: byCat.map(c => Math.round(c.seconds / 60)),
                    backgroundColor: byCat.map(c => TT_COLORS[c.slotIndex % TT_COLORS.length]),
                    borderWidth: 0, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: text, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11.5 } } },
                    tooltip: { padding: 10, cornerRadius: 8, callbacks: { label: c => ` ${c.parsed} min` } }
                }
            }
        });
    }

    // Daily trend — line
    if (!byDay.dates.length) {
        ttChartEmpty('ttWrapTrend', 'Nothing to chart yet.');
    } else {
        ttAnalysisCharts.trend = new Chart(document.getElementById('ttChartTrend'), {
            type: 'line',
            data: {
                labels: byDay.dates.map(d => ttFormatDateLabel(d)),
                datasets: [{
                    data: byDay.seconds.map(s => Math.round(s / 60)),
                    borderColor: TT_COLORS[0], backgroundColor: 'rgba(99,102,241,.14)',
                    fill: true, tension: .35, borderWidth: 2.5,
                    pointRadius: 3, pointBackgroundColor: TT_COLORS[0], pointBorderColor: '#fff', pointBorderWidth: 1.5
                }]
            },
            options: ttChartAxisOptions()
        });
    }

    // Total by category — horizontal bars
    if (!byCat.length) {
        ttChartEmpty('ttWrapBar', 'No time tracked in this range yet.');
    } else {
        ttAnalysisCharts.bar = new Chart(document.getElementById('ttChartBar'), {
            type: 'bar',
            data: {
                labels: byCat.map(c => c.name),
                datasets: [{
                    data: byCat.map(c => Math.round(c.seconds / 60)),
                    backgroundColor: byCat.map(c => TT_COLORS[c.slotIndex % TT_COLORS.length]),
                    borderRadius: 7, borderSkipped: false, barThickness: 18
                }]
            },
            options: ttChartAxisOptions(true)
        });
    }

    // Goal vs. actual — grouped bars over all six slots
    const goalOpts = ttChartAxisOptions();
    goalOpts.plugins.legend = { display: true, position: 'bottom', labels: { color: text, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11.5 } } };
    ttAnalysisCharts.goal = new Chart(document.getElementById('ttChartGoal'), {
        type: 'bar',
        data: {
            labels: ttCategories.map(c => c.name),
            datasets: [
                {
                    label: 'Actual', borderRadius: 6, borderSkipped: false, backgroundColor: TT_COLORS[0],
                    data: ttCategories.map(c => {
                        const found = byCat.find(b => String(b.id) === String(c.id));
                        return found ? Math.round((found.seconds / 60) / dayCount) : 0;
                    })
                },
                {
                    label: 'Goal', borderRadius: 6, borderSkipped: false, backgroundColor: ttCssVar('--surface-3', '#E5E7EB'),
                    data: ttCategories.map(c => c.goal_minutes || 0)
                }
            ]
        },
        options: goalOpts
    });
}
