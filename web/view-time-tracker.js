/* view-time-tracker.js — "Time Spent On": a 3x2 grid of category stopwatches
   linked from the Pomodoro page, plus a Log of every play→pause interval and
   an Analysis page with charts. Mirrors the apiGet/apiPost + lazy-view
   conventions used by view-gym.js / view-pomodoro.js. */

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

function ttFormatDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec % 60}s`;
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

async function ttToggle(slotIndex) {
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
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

    const btn = document.getElementById('ttPlayBtn_' + slotIndex);
    if (btn) {
        btn.classList.toggle('is-running', cat.running);
        btn.title = cat.running ? 'Pause' : 'Play';
        btn.innerHTML = cat.running ? ttIconPause() : ttIconPlay();
    }
    const timeEl = document.getElementById('ttTime_' + slotIndex);
    if (timeEl) timeEl.textContent = ttFormatHMS(ttLiveElapsed(cat));
}

function ttStartTicker() {
    if (ttTickTimer) return;
    ttTickTimer = setInterval(ttTick, 1000);
}

function ttStopTicker() {
    if (ttTickTimer) clearInterval(ttTickTimer);
    ttTickTimer = null;
}

function ttTick() {
    let anyRunning = false;
    ttCategories.forEach(cat => {
        if (cat.running) anyRunning = true;
        const el = document.getElementById('ttTime_' + cat.slot_index);
        if (el) el.textContent = ttFormatHMS(ttLiveElapsed(cat));
    });
    if (!anyRunning) ttStopTicker();
}

// Called by routeTo() (main.js) whenever the user navigates away from any view —
// stops the interval so it doesn't keep ticking (and doesn't leak) in the background.
function ttStopAllTimers() {
    ttStopTicker();
}
window.ttStopAllTimers = ttStopAllTimers;

function ttIconPlay() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
}
function ttIconPause() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>';
}

/* ═══════════════════════════════════════════════════════
   NAME / GOAL EDITING
═══════════════════════════════════════════════════════ */

function ttUpdateName(slotIndex, value) {
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
    if (!cat) return;
    const name = String(value || '').slice(0, 60);
    ttScheduleSave(cat, { name });
}

function ttUpdateGoal(slotIndex, value) {
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
    if (!cat) return;
    const n = Math.max(0, Math.min(1440, parseInt(value, 10) || 0));
    ttScheduleSave(cat, { goal_minutes: n }, 300);
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
    if (listEl) listEl.innerHTML = todos.map(t => ttRenderTodoItem(slotIndex, t)).join('') || '<div class="tt-todo-empty">No to-dos yet</div>';
}

function ttAddTodo(slotIndex) {
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
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
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
    if (!cat) return;
    const todos = ttParseTodos(cat.todos_json);
    const t = todos.find(x => String(x.id) === String(todoId));
    if (!t) return;
    t.done = !t.done;
    ttSaveTodos(cat, todos);
    ttRerenderTodos(slotIndex, todos);
}

function ttDeleteTodo(slotIndex, todoId) {
    const cat = ttCategories.find(c => Number(c.slot_index) === slotIndex);
    if (!cat) return;
    const todos = ttParseTodos(cat.todos_json).filter(x => String(x.id) !== String(todoId));
    ttSaveTodos(cat, todos);
    ttRerenderTodos(slotIndex, todos);
}

/* ═══════════════════════════════════════════════════════
   TRACKER PAGE (the 3x2 stopwatch grid)
═══════════════════════════════════════════════════════ */

async function renderTimeTracker() {
    const main = document.getElementById('main');
    main.innerHTML = '<div class="tt-container"><p style="padding:60px 20px;text-align:center;color:var(--text-3)">Loading your stopwatches…</p></div>';
    try {
        await ttLoadCategories();
    } catch (e) {
        console.error('renderTimeTracker: load failed', e);
    }
    main.innerHTML = ttPageHTML();
    if (typeof renderAllIcons === 'function') renderAllIcons();
    else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    if (ttCategories.some(c => c.running)) ttStartTicker();
}

function ttPageHTML() {
    return `
    <style>${ttSharedCSS()}
        .tt-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 20px;
        }
        @media (max-width: 900px) { .tt-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .tt-grid { grid-template-columns: 1fr; } }

        .tt-card {
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 16px;
            box-shadow: var(--shadow-sm, 0 1px 2px rgba(16,24,40,.05));
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .tt-card-top { display: flex; gap: 8px; align-items: center; }
        .tt-goal-input {
            width: 56px; flex-shrink: 0; text-align: center;
            border: 1px solid var(--border-color); border-radius: 8px;
            background: var(--surface-2); color: var(--text-2);
            font-size: 12px; font-weight: 600; padding: 6px 2px;
        }
        .tt-goal-input:focus { outline: none; border-color: var(--primary); color: var(--text-1); }
        .tt-name-input {
            flex: 1; min-width: 0; border: none; background: transparent;
            color: var(--text-1); font-size: 15px; font-weight: 700; padding: 6px 4px;
            border-radius: 8px;
        }
        .tt-name-input:focus { outline: none; background: var(--surface-2); }
        .tt-time-display {
            font-family: 'SF Mono', 'Menlo', monospace;
            font-size: 30px; font-weight: 700; text-align: center;
            color: var(--text-1); letter-spacing: 1px; padding: 4px 0;
        }
        .tt-play-btn {
            width: 48px; height: 48px; border-radius: 50%; border: none;
            background: var(--primary); color: #fff; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 4px; transition: transform .15s, background .15s;
        }
        .tt-play-btn:hover { transform: scale(1.06); }
        .tt-play-btn.is-running { background: var(--danger); }
        .tt-todo-section { border-top: 1px solid var(--border-color); padding-top: 10px; }
        .tt-todo-list { display: flex; flex-direction: column; gap: 4px; max-height: 130px; overflow-y: auto; margin-bottom: 8px; }
        .tt-todo-empty { font-size: 12px; color: var(--text-3); text-align: center; padding: 8px 0; }
        .tt-todo-item { display: flex; align-items: center; gap: 8px; padding: 4px 2px; border-radius: 6px; cursor: default; }
        .tt-todo-item:hover { background: var(--surface-2); }
        .tt-todo-item input[type=checkbox] { flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; }
        .tt-todo-item span { flex: 1; min-width: 0; font-size: 13px; color: var(--text-1); word-break: break-word; }
        .tt-todo-item.done span { text-decoration: line-through; color: var(--text-3); }
        .tt-todo-del { flex-shrink: 0; border: none; background: none; color: var(--text-3); cursor: pointer; font-size: 14px; opacity: 0; padding: 0 4px; }
        .tt-todo-item:hover .tt-todo-del { opacity: 1; }
        .tt-todo-add { display: flex; gap: 6px; }
        .tt-todo-add input {
            flex: 1; min-width: 0; border: 1px solid var(--border-color); border-radius: 8px;
            background: var(--surface-2); color: var(--text-1); font-size: 13px; padding: 7px 10px;
        }
        .tt-todo-add input:focus { outline: none; border-color: var(--primary); }
        .tt-todo-add button {
            width: 32px; border: none; border-radius: 8px; background: var(--surface-3);
            color: var(--text-2); font-size: 16px; font-weight: 700; cursor: pointer;
        }
        .tt-todo-add button:hover { background: var(--primary); color: #fff; }

        .tt-footer-actions { display: flex; gap: 10px; margin-top: 24px; justify-content: flex-start; }
        .tt-footer-btn {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 11px 18px; border-radius: 12px; border: 1px solid var(--border-color);
            background: var(--surface-1); color: var(--text-1); font-size: 13.5px; font-weight: 700;
            cursor: pointer; box-shadow: var(--shadow-sm, 0 1px 2px rgba(16,24,40,.05));
        }
        .tt-footer-btn:hover { background: var(--surface-2); }

        .tt-log-modal {
            position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200;
            display: flex; align-items: flex-end; justify-content: center;
        }
        .tt-log-modal.hidden { display: none; }
        .tt-log-modal-inner {
            background: var(--surface-1); border-radius: 18px 18px 0 0; width: 100%; max-width: 520px;
            max-height: 78vh; display: flex; flex-direction: column; box-shadow: 0 -8px 30px rgba(0,0,0,.2);
        }
        @media (min-width: 640px) {
            .tt-log-modal { align-items: center; }
            .tt-log-modal-inner { border-radius: 18px; max-height: 70vh; }
        }
        .tt-log-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border-color); }
        .tt-log-modal-header h3 { margin: 0; font-size: 16px; color: var(--text-1); }
        .tt-log-modal-header button { border: none; background: var(--surface-2); color: var(--text-2); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-size: 15px; }
        .tt-log-modal-body { overflow-y: auto; padding: 8px 18px 18px; }
        .tt-log-group { margin-top: 14px; }
        .tt-log-date { font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
        .tt-log-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border-color); }
        .tt-log-cat { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--text-1); }
        .tt-log-dur { font-size: 13px; color: var(--text-2); font-variant-numeric: tabular-nums; }
        .tt-log-del { border: none; background: none; color: var(--text-3); cursor: pointer; font-size: 14px; }
        .tt-log-del:hover { color: var(--danger); }
        .tt-log-empty { text-align: center; color: var(--text-3); font-size: 13.5px; padding: 30px 10px; }
    </style>
    <div class="tt-container">
        ${ttHeaderHTML('Time Spent On', 'pomodoro')}
        <div class="tt-grid">
            ${ttCategories.slice(0, TT_SLOT_COUNT).map(cat => ttRenderCard(cat)).join('')}
        </div>
        <div class="tt-footer-actions">
            <button class="tt-footer-btn" onclick="routeTo('timeAnalysis')">📊 View Analysis</button>
            <button class="tt-footer-btn" onclick="ttOpenLogModal()">🕒 Log</button>
        </div>
    </div>
    <div class="tt-log-modal hidden" id="ttLogModal" onclick="ttCloseLogModalBg(event)">
        <div class="tt-log-modal-inner">
            <div class="tt-log-modal-header">
                <h3>Time Log</h3>
                <button onclick="ttCloseLogModal()">✕</button>
            </div>
            <div id="ttLogModalBody" class="tt-log-modal-body">Loading…</div>
        </div>
    </div>
    `;
}

function ttHeaderHTML(title, backView) {
    return `
        <div class="tt-header">
            <button class="tt-back-btn" onclick="routeTo('${backView}')" title="Back">←</button>
            <h1 class="tt-title">${title}</h1>
            <div style="width:36px"></div>
        </div>
    `;
}

function ttSharedCSS() {
    return `
        .tt-container { max-width: 980px; margin: 0 auto; padding: 20px 20px 60px; }
        .tt-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .tt-title { font-size: 22px; font-weight: 800; color: var(--text-1); margin: 0; }
        .tt-back-btn {
            width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border-color);
            background: var(--surface-2); color: var(--text-2); font-size: 16px; cursor: pointer;
        }
        .tt-back-btn:hover { background: var(--surface-3); color: var(--text-1); }
    `;
}

function ttRenderCard(cat) {
    const elapsed = ttLiveElapsed(cat);
    const todos = ttParseTodos(cat.todos_json);
    return `
    <div class="tt-card" data-slot="${cat.slot_index}">
        <div class="tt-card-top">
            <input class="tt-goal-input" type="number" min="0" max="1440" placeholder="Goal" value="${cat.goal_minutes || ''}"
                   title="Daily goal (minutes) for this category"
                   onchange="ttUpdateGoal(${cat.slot_index}, this.value)" />
            <input class="tt-name-input" type="text" value="${ttEscape(cat.name || '')}" maxlength="60"
                   oninput="ttUpdateName(${cat.slot_index}, this.value)" />
        </div>
        <div class="tt-time-display" id="ttTime_${cat.slot_index}">${ttFormatHMS(elapsed)}</div>
        <button class="tt-play-btn ${cat.running ? 'is-running' : ''}" id="ttPlayBtn_${cat.slot_index}"
                onclick="ttToggle(${cat.slot_index})" title="${cat.running ? 'Pause' : 'Play'}">
            ${cat.running ? ttIconPause() : ttIconPlay()}
        </button>
        <div class="tt-todo-section">
            <div class="tt-todo-list" id="ttTodoList_${cat.slot_index}">
                ${todos.map(t => ttRenderTodoItem(cat.slot_index, t)).join('') || '<div class="tt-todo-empty">No to-dos yet</div>'}
            </div>
            <div class="tt-todo-add">
                <input type="text" placeholder="Add a to-do…" id="ttTodoInput_${cat.slot_index}" maxlength="200"
                       onkeydown="if(event.key==='Enter'){ttAddTodo(${cat.slot_index}); event.preventDefault();}" />
                <button onclick="ttAddTodo(${cat.slot_index})" title="Add to-do">+</button>
            </div>
        </div>
    </div>
    `;
}

function ttRenderTodoItem(slotIndex, t) {
    return `
    <label class="tt-todo-item ${t.done ? 'done' : ''}">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="ttToggleTodo(${slotIndex}, '${t.id}')" />
        <span>${ttEscape(t.text)}</span>
        <button type="button" class="tt-todo-del" onclick="ttDeleteTodo(${slotIndex}, '${t.id}')" title="Remove">✕</button>
    </label>
    `;
}

/* ═══════════════════════════════════════════════════════
   LOG MODAL
═══════════════════════════════════════════════════════ */

async function ttOpenLogModal() {
    const modal = document.getElementById('ttLogModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const body = document.getElementById('ttLogModalBody');
    if (body) body.innerHTML = 'Loading…';
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

function ttRenderLogList() {
    if (!ttLogs.length) return '<div class="tt-log-empty">No time logged yet. Press play on a stopwatch, then pause it — the interval shows up here.</div>';
    const groups = {};
    ttLogs.forEach(l => { (groups[l.date] = groups[l.date] || []).push(l); });
    const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return dates.map(date => `
        <div class="tt-log-group">
            <div class="tt-log-date">${ttFormatDateLabel(date)}</div>
            ${groups[date].map(l => `
                <div class="tt-log-row">
                    <span class="tt-log-cat">${ttEscape(l.category_name || 'Category')}</span>
                    <span class="tt-log-dur">${ttFormatDuration(l.duration_seconds)}</span>
                    <button class="tt-log-del" onclick="ttDeleteLog('${l.id}')" title="Delete entry">✕</button>
                </div>
            `).join('')}
        </div>
    `).join('');
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
    main.innerHTML = '<div class="tt-container"><p style="padding:60px 20px;text-align:center;color:var(--text-3)">Crunching your time data…</p></div>';
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
    return `
    <style>${ttSharedCSS()}
        .tt-range-bar { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
        .tt-range-btn {
            padding: 8px 16px; border-radius: 10px; border: 1px solid var(--border-color);
            background: var(--surface-1); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .tt-range-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
        .tt-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
        @media (max-width: 640px) { .tt-stats-row { grid-template-columns: 1fr; } }
        .tt-stat { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px; text-align: center; }
        .tt-stat-val { font-size: 20px; font-weight: 800; color: var(--text-1); }
        .tt-stat-label { font-size: 12px; color: var(--text-3); margin-top: 4px; }
        .tt-charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
        @media (max-width: 760px) { .tt-charts-grid { grid-template-columns: 1fr; } }
        .tt-chart-card { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; padding: 16px; }
        .tt-chart-card h3 { margin: 0 0 12px; font-size: 14px; color: var(--text-1); }
        .tt-chart-card canvas { max-height: 260px; }
    </style>
    <div class="tt-container">
        ${ttHeaderHTML('Time Analysis', 'timeTracker')}
        <div class="tt-range-bar">
            ${['today', 'week', 'month', 'all'].map(r => `<button class="tt-range-btn ${ttRange === r ? 'active' : ''}" onclick="ttSetRange('${r}')">${ttRangeLabel(r)}</button>`).join('')}
        </div>
        <div class="tt-stats-row" id="ttStatsRow"></div>
        <div class="tt-charts-grid">
            <div class="tt-chart-card"><h3>Share of Time by Category</h3><canvas id="ttChartShare"></canvas></div>
            <div class="tt-chart-card"><h3>Daily Trend</h3><canvas id="ttChartTrend"></canvas></div>
            <div class="tt-chart-card"><h3>Total Minutes by Category</h3><canvas id="ttChartBar"></canvas></div>
            <div class="tt-chart-card"><h3>Goal vs. Daily Average</h3><canvas id="ttChartGoal"></canvas></div>
        </div>
    </div>
    `;
}

function ttRangeLabel(r) { return { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' }[r] || r; }

function ttSetRange(r) {
    ttRange = r;
    document.querySelectorAll('.tt-range-btn').forEach(b => b.classList.toggle('active', b.textContent === ttRangeLabel(r)));
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

function ttChartTextColor() {
    try { return getComputedStyle(document.body).getPropertyValue('--text-2').trim() || '#666'; }
    catch (e) { return '#666'; }
}

function ttChartGridColor() {
    try { return getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#e5e7eb'; }
    catch (e) { return '#e5e7eb'; }
}

function ttChartAxisOptions() {
    const text = ttChartTextColor(), grid = ttChartGridColor();
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { labels: { color: text } } },
        scales: {
            x: { ticks: { color: text }, grid: { color: grid } },
            y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true }
        }
    };
}

function ttDestroyCharts() {
    Object.values(ttAnalysisCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
    ttAnalysisCharts = {};
}

function ttRenderAnalysisCharts() {
    ttDestroyCharts();
    const logs = ttFilteredLogs();
    const byCat = ttAggregateByCategory(logs);
    const byDay = ttAggregateByDay(logs);
    const activeDays = new Set(logs.map(l => l.date)).size;
    const totalSec = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0);

    const statsRow = document.getElementById('ttStatsRow');
    if (statsRow) {
        statsRow.innerHTML = `
            <div class="tt-stat"><div class="tt-stat-val">${ttFormatDuration(totalSec)}</div><div class="tt-stat-label">Total tracked</div></div>
            <div class="tt-stat"><div class="tt-stat-val">${byCat[0] ? ttEscape(byCat[0].name) : '—'}</div><div class="tt-stat-label">Top category</div></div>
            <div class="tt-stat"><div class="tt-stat-val">${activeDays}</div><div class="tt-stat-label">Active days</div></div>
        `;
    }

    if (typeof Chart === 'undefined') return; // Chart.js CDN not ready yet — stats row still renders

    const shareCtx = document.getElementById('ttChartShare');
    if (shareCtx && byCat.length) {
        ttAnalysisCharts.share = new Chart(shareCtx, {
            type: 'doughnut',
            data: {
                labels: byCat.map(c => c.name),
                datasets: [{ data: byCat.map(c => Math.round(c.seconds / 60)), backgroundColor: byCat.map(c => TT_COLORS[c.slotIndex % TT_COLORS.length]), borderWidth: 0 }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { color: ttChartTextColor() } } } }
        });
    }

    const trendCtx = document.getElementById('ttChartTrend');
    if (trendCtx) {
        ttAnalysisCharts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: byDay.dates.map(d => ttFormatDateLabel(d)),
                datasets: [{ label: 'Minutes tracked', data: byDay.seconds.map(s => Math.round(s / 60)), borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3 }]
            },
            options: ttChartAxisOptions()
        });
    }

    const barCtx = document.getElementById('ttChartBar');
    if (barCtx && byCat.length) {
        ttAnalysisCharts.bar = new Chart(barCtx, {
            type: 'bar',
            data: { labels: byCat.map(c => c.name), datasets: [{ label: 'Minutes', data: byCat.map(c => Math.round(c.seconds / 60)), backgroundColor: byCat.map(c => TT_COLORS[c.slotIndex % TT_COLORS.length]) }] },
            options: ttChartAxisOptions()
        });
    }

    const goalCtx = document.getElementById('ttChartGoal');
    if (goalCtx) {
        const dayCount = ttRange === 'today' ? 1 : ttRange === 'week' ? 7 : ttRange === 'month' ? 30 : Math.max(1, activeDays);
        const labels = ttCategories.map(c => c.name);
        const actualAvg = ttCategories.map(c => {
            const found = byCat.find(b => String(b.id) === String(c.id));
            return found ? Math.round((found.seconds / 60) / dayCount) : 0;
        });
        const goals = ttCategories.map(c => c.goal_minutes || 0);
        ttAnalysisCharts.goal = new Chart(goalCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Daily avg (min)', data: actualAvg, backgroundColor: '#6366F1' },
                    { label: 'Goal (min)', data: goals, backgroundColor: '#D1D5DB' }
                ]
            },
            options: ttChartAxisOptions()
        });
    }
}
