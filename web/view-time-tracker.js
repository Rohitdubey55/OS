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

// Same, but keeps the sign — a hand-entered correction logs a negative stretch.
function ttFormatSigned(sec) {
    sec = Math.floor(sec || 0);
    return (sec < 0 ? '−' : '') + ttFormatDuration(Math.abs(sec));
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
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    timer: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 13"/><line x1="9" y1="2" x2="15" y2="2"/></svg>',
    plusClock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 0-8.5 8.5"/><polyline points="12 7 12 12 15 13.5"/><line x1="18.5" y1="16" x2="18.5" y2="23"/><line x1="15" y1="19.5" x2="22" y2="19.5"/></svg>'
};

/* ═══════════════════════════════════════════════════════
   TASKS BRIDGE — each card is linked to one of the Tasks app's categories and
   shows that category's live tasks, rather than keeping a private to-do list.
═══════════════════════════════════════════════════════ */

const TT_DEFAULT_TASK_CATEGORIES = ['Work', 'Personal', 'Health', 'Finance', 'Study', 'Other'];
let ttShowUndated = {};   // slot_index -> include tasks with no due date

// The one category vocabulary Tasks, Habits and this page share. main.js owns
// it; this is the standalone fallback for when that hasn't loaded.
function ttTaskCategories() {
    if (typeof window.appCategories === 'function') return window.appCategories();
    const settings = state.data.settings && state.data.settings[0] || {};
    let list = [];
    if (settings.task_categories) {
        let raw = settings.task_categories;
        if (String(raw).startsWith('VIEW:')) raw = String(raw).split('|')[1] || '';
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) list = parsed;
        } catch (e) { }
        if (!list.length) list = String(raw).split(',').map(c => c.trim()).filter(Boolean);
    }
    if (!list.length) list = [...TT_DEFAULT_TASK_CATEGORIES];
    // Include any category already in use, so nothing is unreachable.
    (state.data.tasks || []).forEach(t => {
        if (t.category && !list.includes(t.category)) list.push(t.category);
    });
    (state.data.habits || []).forEach(h => {
        if (h.category && !list.includes(h.category)) list.push(h.category);
    });
    return list;
}

function ttTaskIsOpen(t) {
    return t && t.status !== 'completed';
}

// Open tasks in this card's category that are due today or overdue. Undated tasks
// are held back (they'd swamp a day view) but counted, so they can be revealed.
function ttTasksFor(cat) {
    const linked = cat.task_category;
    if (!linked) return { tasks: [], undated: 0 };
    const today = ttTodayStr();
    const all = (state.data.tasks || []).filter(t => ttTaskIsOpen(t) && String(t.category || '') === String(linked));
    const dated = all.filter(t => t.due_date && String(t.due_date).slice(0, 10) <= today);
    const undated = all.filter(t => !t.due_date);
    const show = ttShowUndated[cat.slot_index] ? dated.concat(undated) : dated;
    show.sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
    return { tasks: show, undated: undated.length };
}

function ttTaskTracked(taskId) {
    return ttItemTracked('task', taskId);
}

function ttFindTask(taskId) {
    return (state.data.tasks || []).find(t => String(t.id) === String(taskId));
}

/* ── Habits ── A habit carries the SAME category as a task (set on the habit's
   edit form), so one picker per card pulls in both. A habit's "routine" is a
   different axis — where in the day it sits — and stays on the Habits page. */

function ttHabitDoneToday(habitId) {
    const today = ttTodayStr();
    return (state.data.habit_logs || []).some(l =>
        String(l.habit_id) === String(habitId) && String(l.date || '').slice(0, 10) === today);
}

function ttHabitScheduledToday(h) {
    if (typeof window.habitScheduledToday === 'function') {
        try { return window.habitScheduledToday(h); } catch (e) { return true; }
    }
    return true;
}

// Habits filed under this card's category that are due today. Completed ones
// drop to the bottom rather than vanishing mid-session.
function ttHabitsFor(cat) {
    const linked = cat.task_category;
    if (!linked) return [];
    const all = (state.data.habits || []).filter(h =>
        String(h.category || '') === String(linked) && ttHabitScheduledToday(h));
    return all.sort((a, b) => (ttHabitDoneToday(a.id) ? 1 : 0) - (ttHabitDoneToday(b.id) ? 1 : 0));
}

// Habits due today that have no category yet. They'd be invisible here, so the
// card says so once rather than leaving you wondering where they went.
function ttUncategorisedHabitCount() {
    return (state.data.habits || []).filter(h => !h.category && ttHabitScheduledToday(h)).length;
}

function ttFindHabit(habitId) {
    return (state.data.habits || []).find(h => String(h.id) === String(habitId));
}

// Time tracked today against one task or habit, including the running interval.
const TT_LOG_KEY = { habit: 'habit_id', tdp: 'tdp_item_id', task: 'task_id' };
const TT_ACTIVE_KEY = { habit: 'active_habit_id', tdp: 'active_tdp_item_id', task: 'active_task_id' };

function ttItemTracked(kind, id) {
    const today = ttTodayStr();
    const key = TT_LOG_KEY[kind] || 'task_id';
    let sec = (ttLogs || []).reduce((s, l) =>
        s + (String(l[key] || '') === String(id) && l.date === today ? (l.duration_seconds || 0) : 0), 0);
    const activeKey = TT_ACTIVE_KEY[kind] || 'active_task_id';
    const live = ttCategories.find(c => c.running && String(c[activeKey] || '') === String(id));
    if (live && live.running_since) {
        sec += Math.max(0, Math.floor((Date.now() - new Date(live.running_since).getTime()) / 1000));
    }
    return sec;
}

/* ── Ten Days Plan ── The TDP page files its items under the same categories, so
   a card pulls in the active plan's items for its category alongside the tasks
   and habits. view-tdp.js owns the plan model and is lazy-loaded on render. */

function ttTdpFor(cat) {
    if (!cat.task_category || typeof window.tdpItemsForCategory !== 'function') return [];
    try { return window.tdpItemsForCategory(cat.task_category) || []; }
    catch (e) { return []; }
}

function ttJsStr(v) {
    return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function ttTdpFind(itemId) {
    if (typeof window.tdpItemsForCategory !== 'function') return null;
    for (const c of ttCategories) {
        if (!c.task_category) continue;
        const hit = ttTdpFor(c).find(i => String(i.id) === String(itemId));
        if (hit) return hit;
    }
    return null;
}

function ttTdpPlanLabel() {
    if (typeof window.tdpActivePlanSummary !== 'function') return '';
    try {
        const s = window.tdpActivePlanSummary();
        return s ? `10 days plan · day ${s.day}` : '';
    } catch (e) { return ''; }
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

// Anything written here is the freshest truth for a few seconds, so a poll that
// was already in flight can't roll it back.
let ttLocalTouch = {};

function ttPersistCategory(cat, fields) {
    ttLocalTouch[cat.id] = Date.now();
    apiPost({ action: 'update', sheet: 'time_categories', id: cat.id, payload: fields })
        .catch(e => console.error('ttPersistCategory failed:', e));
}

function ttScheduleSave(cat, fields, delay = 700) {
    Object.assign(cat, fields);
    ttLocalTouch[cat.id] = Date.now();
    ttPendingFields[cat.id] = Object.assign(ttPendingFields[cat.id] || {}, fields);
    ttSetSaveState(cat, 'dirty');
    clearTimeout(ttSaveTimers[cat.id]);
    ttSaveTimers[cat.id] = setTimeout(() => {
        const toSave = ttPendingFields[cat.id];
        delete ttPendingFields[cat.id];
        ttPersistCategory(cat, toSave);
        ttFlashSaved(cat);
    }, delay);
}

// The Save button doubles as the save indicator: muted "Saved" when everything is
// stored, accent "Save" the moment something is edited, green tick right after a write.
function ttSetSaveState(cat, stateName) {
    const btn = document.getElementById('ttSave_' + cat.slot_index);
    if (!btn) return;
    const label = btn.querySelector('span');
    btn.classList.remove('dirty', 'done');
    if (stateName === 'dirty') { btn.classList.add('dirty'); if (label) label.textContent = 'Save'; }
    else if (stateName === 'saving') { if (label) label.textContent = 'Saving…'; }
    else if (stateName === 'done') { btn.classList.add('done'); if (label) label.textContent = 'Saved'; }
    else if (label) label.textContent = 'Saved';
}

function ttFlashSaved(cat) {
    ttSetSaveState(cat, 'done');
    clearTimeout(ttSaveTimers['flash_' + cat.id]);
    ttSaveTimers['flash_' + cat.id] = setTimeout(() => ttSetSaveState(cat, 'clean'), 1800);
}

// Explicit Save: flush this card's pending name / goal / to-do edits right now
// instead of waiting for the debounce.
async function ttSaveCard(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    clearTimeout(ttSaveTimers[cat.id]);
    const pending = ttPendingFields[cat.id];
    delete ttPendingFields[cat.id];
    if (!pending || !Object.keys(pending).length) { ttFlashSaved(cat); return; }

    ttSetSaveState(cat, 'saving');
    try {
        await apiPost({ action: 'update', sheet: 'time_categories', id: cat.id, payload: pending });
        ttFlashSaved(cat);
    } catch (e) {
        console.error('ttSaveCard failed:', e);
        ttPendingFields[cat.id] = Object.assign(pending, ttPendingFields[cat.id] || {});
        ttSetSaveState(cat, 'dirty');
        if (typeof toast === 'function') toast('Save failed — try again');
    }
}

async function ttCreateLog(cat, startedAt, endedAt, durationSeconds, taskId, habitId, dateStr, tdpItemId) {
    const task = taskId ? ttFindTask(taskId) : null;
    const habit = habitId ? ttFindHabit(habitId) : null;
    const payload = {
        category_id: cat.id, category_name: cat.name, date: dateStr || ttTodayStr(),
        duration_seconds: durationSeconds, started_at: startedAt, ended_at: endedAt
    };
    if (taskId) {
        payload.task_id = String(taskId);
        payload.task_title = task ? task.title : '';
    }
    if (habitId) {
        payload.habit_id = String(habitId);
        payload.task_title = habit ? (habit.habit_name || '') : '';   // shared label column
    }
    if (tdpItemId) {
        payload.tdp_item_id = String(tdpItemId);
        const tdpItem = ttTdpFind(tdpItemId);
        payload.task_title = tdpItem ? tdpItem.text : '';             // same label column
    }
    // Keep the local list in step so per-task totals update without a refetch.
    ttLogs.unshift({ id: 'local-' + Date.now(), ...payload });
    try {
        await apiPost({ action: 'create', sheet: 'time_logs', payload });
        ttLogsLoaded = false; // refetch next time the Log or Analysis opens
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

// Bank the interval that's running: add it to today's total and log it against
// whichever task was active. Shared by pause, task switching and reset.
function ttCloseInterval(cat) {
    if (!cat.running || !cat.running_since) return 0;
    const startedAt = cat.running_since;
    const endedAt = new Date();
    const deltaSec = Math.max(0, Math.floor((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
    cat.elapsed_seconds = (cat.elapsed_seconds || 0) + deltaSec;
    if (deltaSec >= 1) {
        ttCreateLog(cat, startedAt, endedAt.toISOString(), deltaSec,
            cat.active_task_id, cat.active_habit_id, null, cat.active_tdp_item_id);
    }
    return deltaSec;
}

/* ── Countdown ── A card can be given a target for THIS sitting: type minutes,
   press Enter, and the stopwatch starts with the clock reading down instead of
   up. Time still accrues to the category exactly as a normal run does; at zero
   the run is banked and paused for you. The target lives on the row, so a phone
   and a laptop show the same countdown. */

const ttFinishedRuns = new Set();   // cat.id + running_since, so a tick fires once

function ttCountdownRemaining(cat) {
    if (!cat || !cat.running || !cat.running_since || !cat.timer_target_seconds) return null;
    const ran = Math.floor((Date.now() - new Date(cat.running_since).getTime()) / 1000);
    return (cat.timer_target_seconds || 0) - Math.max(0, ran);
}

function ttCountdownEndsAt(cat) {
    if (!cat || !cat.running_since || !cat.timer_target_seconds) return null;
    return new Date(new Date(cat.running_since).getTime() + cat.timer_target_seconds * 1000);
}

// Type a number of minutes and press Enter. Starts the clock if it's paused;
// re-times the current sitting from now if it's already running.
async function ttStartCountdown(slotIndex, minutes) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    const mins = Math.round(Number(minutes));
    if (!mins || mins <= 0 || mins > 600) {
        if (typeof showToast === 'function') showToast('Enter a timer between 1 and 600 minutes');
        return;
    }

    document.activeElement?.blur?.();
    if (cat.running) ttCloseInterval(cat);   // bank what's on the clock, then re-time
    cat.running = true;
    cat.running_since = new Date().toISOString();
    cat.timer_target_seconds = mins * 60;
    ttFinishedRuns.delete(cat.id + cat.running_since);

    ttPersistCategory(cat, {
        running: true, running_since: cat.running_since,
        elapsed_seconds: cat.elapsed_seconds, timer_target_seconds: cat.timer_target_seconds
    });
    ttStartTicker();
    ttSyncCardState(cat);
    ttTick();
    if (typeof showToast === 'function') showToast(`${mins}m timer running on ${cat.name || 'this category'}`);
}

// Drop the target but keep the stopwatch going — back to counting up.
function ttCancelCountdown(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat || !cat.timer_target_seconds) return;
    cat.timer_target_seconds = null;
    ttPersistCategory(cat, { timer_target_seconds: null });
    ttSyncCardState(cat);
    ttTick();
}

// The countdown hit zero: bank the sitting, pause, and say so.
function ttFinishCountdown(cat) {
    const key = cat.id + cat.running_since;
    if (ttFinishedRuns.has(key)) return;
    ttFinishedRuns.add(key);

    const ran = cat.timer_target_seconds;
    ttCloseInterval(cat);
    cat.running = false;
    cat.running_since = null;
    cat.timer_target_seconds = null;
    cat.active_task_id = null;
    cat.active_habit_id = null;
    cat.active_tdp_item_id = null;
    ttPersistCategory(cat, {
        running: false, running_since: null, elapsed_seconds: cat.elapsed_seconds,
        timer_target_seconds: null, active_task_id: null, active_habit_id: null, active_tdp_item_id: null
    });
    ttSyncCardState(cat);
    ttRenderTasksInto(cat);
    ttChime();
    if (typeof showToast === 'function') {
        showToast(`${Math.round(ran / 60)}m up on ${cat.name || 'this category'} — paused`);
    }
}

// A short two-note chime, so a finished timer registers without the page open.
function ttChime() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [880, 1174].forEach((freq, i) => {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.18;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.36);
        });
        setTimeout(() => ctx.close && ctx.close(), 1200);
    } catch (e) { /* audio is a nicety, never a failure */ }
}

async function ttToggle(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;

    if (!cat.running) {
        cat.running = true;
        cat.running_since = new Date().toISOString();
        cat.active_task_id = null;
        cat.active_habit_id = null;
        cat.active_tdp_item_id = null;
        ttPersistCategory(cat, { running: true, running_since: cat.running_since, active_task_id: null, active_habit_id: null, active_tdp_item_id: null });
        ttStartTicker();
    } else {
        ttCloseInterval(cat);
        cat.running = false;
        cat.running_since = null;
        cat.timer_target_seconds = null;
        cat.active_task_id = null;
        cat.active_habit_id = null;
        cat.active_tdp_item_id = null;
        ttPersistCategory(cat, { running: false, running_since: null, elapsed_seconds: cat.elapsed_seconds, timer_target_seconds: null, active_task_id: null, active_habit_id: null, active_tdp_item_id: null });
    }

    ttSyncCardState(cat);
    ttRenderTasksInto(cat);
    ttTick();
}

// Play on a task or habit: the category's stopwatch runs with that item as the
// thing being worked on. Pressing play on another item hands the clock over
// without stopping it; pressing it on the running item pauses everything.
async function ttToggleItem(slotIndex, kind, id) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;

    const activeKey = TT_ACTIVE_KEY[kind] || 'active_task_id';
    const allKeys = ['active_task_id', 'active_habit_id', 'active_tdp_item_id'];
    const isActive = cat.running && String(cat[activeKey] || '') === String(id);
    ttCloseInterval(cat);

    allKeys.forEach(k => { cat[k] = null; });   // only one thing is being worked on
    if (isActive) {
        cat.running = false;
        cat.running_since = null;
        cat.timer_target_seconds = null;
    } else {
        cat.running = true;
        cat.running_since = new Date().toISOString();
        cat[activeKey] = String(id);
        ttStartTicker();
    }

    ttPersistCategory(cat, {
        running: cat.running,
        running_since: cat.running_since,
        elapsed_seconds: cat.elapsed_seconds,
        timer_target_seconds: cat.timer_target_seconds || null,
        active_task_id: cat.active_task_id || null,
        active_habit_id: cat.active_habit_id || null,
        active_tdp_item_id: cat.active_tdp_item_id || null
    });

    ttSyncCardState(cat);
    ttRenderTasksInto(cat);
    ttTick();
}

function ttToggleTask(slotIndex, taskId) { return ttToggleItem(slotIndex, 'task', taskId); }
function ttToggleHabit(slotIndex, habitId) { return ttToggleItem(slotIndex, 'habit', habitId); }
function ttToggleTdp(slotIndex, itemId) { return ttToggleItem(slotIndex, 'tdp', itemId); }

// Zero today's accumulated time for one stopwatch. Logged intervals are
// untouched — the Log and Analysis keep everything already recorded.
async function ttResetTimer(slotIndex) {
    const cat = ttFindCat(slotIndex);
    if (!cat) return;
    if (!confirm(`Reset "${cat.name}" back to 00:00:00 for today?\n\nAlready-logged time stays in your Log and Analysis.`)) return;

    ttCloseInterval(cat);
    cat.elapsed_seconds = 0;
    cat.running = false;
    cat.running_since = null;
    cat.timer_target_seconds = null;
    cat.active_task_id = null;
    cat.active_habit_id = null;
    cat.active_tdp_item_id = null;
    ttPersistCategory(cat, { elapsed_seconds: 0, running: false, running_since: null, timer_target_seconds: null, active_task_id: null, active_habit_id: null, active_tdp_item_id: null });
    ttSyncCardState(cat);
    ttRenderTasksInto(cat);
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
        // A countdown that has run out banks itself and pauses, here on the tick.
        const remaining = ttCountdownRemaining(cat);
        if (remaining !== null && remaining <= 0) { ttFinishCountdown(cat); }

        if (cat.running) anyRunning = true;
        const elapsed = ttLiveElapsed(cat);
        todayTotal += elapsed;

        // While a timer is set the big clock reads down; the goal bar below still
        // shows the day's total, so nothing is hidden.
        const left = ttCountdownRemaining(cat);
        const el = document.getElementById('ttTime_' + cat.slot_index);
        if (el) el.innerHTML = ttTimeHTML(left !== null ? Math.max(0, left) : elapsed);
        const cardEl = document.getElementById('ttCard_' + cat.slot_index);
        if (cardEl) cardEl.classList.toggle('counting', left !== null);
        ttPaintTimerRow(cat);

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

    // Task rows: live tracked time, and the card's planned-vs-tracked summary.
    ttCategories.forEach(cat => {
        const sumEl = document.getElementById('ttTaskSum_' + cat.slot_index);
        if (!sumEl) return;
        if (!cat.task_category) { sumEl.innerHTML = ''; return; }
        const { tasks } = ttTasksFor(cat);
        const habits = ttHabitsFor(cat);
        let planned = 0, tracked = 0;
        tasks.forEach(t => {
            planned += (Number(t.duration) || 0) * 60;
            const sec = ttItemTracked('task', t.id);
            tracked += sec;
            const el = document.getElementById(`ttTaskTracked_${cat.slot_index}_${t.id}`);
            if (el) el.textContent = sec ? ttFormatDuration(sec) : '—';
        });
        habits.forEach(h => {
            planned += (Number(h.duration) || 0) * 60;
            const sec = ttItemTracked('habit', h.id);
            tracked += sec;
            const el = document.getElementById(`ttHabitTracked_${cat.slot_index}_${h.id}`);
            if (el) el.textContent = sec ? ttFormatDuration(sec) : '—';
        });
        const tdpItems = ttTdpFor(cat);
        tdpItems.forEach(i => {
            planned += (Number(i.minutes) || 0) * 60;
            const sec = ttItemTracked('tdp', i.id);
            tracked += sec;
            const el = document.getElementById(`ttTdpTracked_${cat.slot_index}_${i.id}`);
            if (el) el.textContent = sec ? ttFormatDuration(sec) : '—';
        });
        sumEl.innerHTML = (tasks.length + habits.length + tdpItems.length)
            ? `<span>Planned <b>${ttFormatDuration(planned)}</b></span><span>tracked <b>${ttFormatDuration(tracked)}</b></span>`
            : '';
    });

    const totalEl = document.getElementById('ttTodayTotal');
    if (totalEl) totalEl.textContent = ttFormatDuration(todayTotal);

    // Overview: today's total against the sum of every category's daily goal.
    const goalTotalSec = ttCategories.reduce((s, c) => s + (c.goal_minutes || 0) * 60, 0);
    const spentEl = document.getElementById('ttTotalSpent');
    if (spentEl) spentEl.textContent = ttFormatDuration(todayTotal);
    const goalEl = document.getElementById('ttTotalGoal');
    if (goalEl) goalEl.textContent = goalTotalSec ? ttFormatDuration(goalTotalSec) : '—';
    const ovBar = document.getElementById('ttTotalBar');
    const ovCap = document.getElementById('ttTotalCap');
    if (ovBar && ovCap) {
        if (goalTotalSec > 0) {
            const pct = Math.min(100, Math.round((todayTotal / goalTotalSec) * 100));
            ovBar.style.width = pct + '%';
            ovBar.parentElement.classList.toggle('hit', pct >= 100);
            ovCap.innerHTML = `<span>${pct}% of today's goal</span><span>${ttFormatDuration(Math.max(0, goalTotalSec - todayTotal))} left</span>`;
        } else {
            ovBar.style.width = '0%';
            ovCap.innerHTML = `<span>Set a goal on a card to track progress</span><span></span>`;
        }
    }

    if (!anyRunning) ttStopTicker();
}

/* ═══════════════════════════════════════════════════════
   CROSS-DEVICE SYNC — a stopwatch lives on the server, not in this tab. Elapsed
   time is derived from running_since, so it stays correct while the app is shut;
   these pull the *state* across too, so starting on a laptop and pausing on a
   phone agree both ways.
═══════════════════════════════════════════════════════ */

const TT_SYNC_FIELDS = ['name', 'goal_minutes', 'elapsed_seconds', 'running', 'running_since',
    'day', 'todos_json', 'task_category', 'active_task_id', 'active_habit_id', 'active_tdp_item_id', 'timer_target_seconds'];
const TT_TOUCH_GRACE_MS = 6000;
let ttSyncTimer = null;
let ttRealtimeChannel = null;
let ttSyncing = false;

// Pull the server's copy and fold in anything this device didn't just change.
async function ttSyncFromCloud() {
    if (ttSyncing || !ttCategories.length) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    ttSyncing = true;
    try {
        const rows = await apiGet('time_categories');
        if (!Array.isArray(rows) || !rows.length) return;
        let changed = false;
        rows.forEach(row => {
            const local = ttCategories.find(c => String(c.id) === String(row.id));
            if (!local) return;
            if (Date.now() - (ttLocalTouch[local.id] || 0) < TT_TOUCH_GRACE_MS) return;
            TT_SYNC_FIELDS.forEach(k => {
                const incoming = row[k] === undefined ? null : row[k];
                const current = local[k] === undefined ? null : local[k];
                if (String(incoming === null ? '' : incoming) !== String(current === null ? '' : current)) {
                    local[k] = incoming;
                    changed = true;
                }
            });
        });
        if (changed) ttApplyRemoteChange();
    } catch (e) {
        console.warn('ttSyncFromCloud failed:', e && e.message);
    } finally {
        ttSyncing = false;
    }
}

// Repaint what a remote change can affect, without stealing focus from a field
// this device is typing in.
function ttApplyRemoteChange() {
    const active = document.activeElement;
    ttCategories.forEach(cat => {
        ttSyncCardState(cat);
        const nameEl = document.querySelector(`#ttCard_${cat.slot_index} .tt-name`);
        if (nameEl && nameEl !== active && nameEl.value !== (cat.name || '')) nameEl.value = cat.name || '';
        const goalEl = document.querySelector(`#ttCard_${cat.slot_index} .tt-goal input`);
        if (goalEl && goalEl !== active) goalEl.value = cat.goal_minutes || '';
        const wrap = document.getElementById('ttTasksWrap_' + cat.slot_index);
        if (wrap && !wrap.contains(active)) ttRenderTasksInto(cat);
    });
    ttTick();
    if (ttCategories.some(c => c.running)) ttStartTicker();
    if (typeof ttRenderMini === 'function') ttRenderMini();
}

// Poll while the page is in use, and catch up the moment it regains focus —
// that's the common case (phone in pocket, laptop reopened).
function ttStartSync(intervalMs) {
    ttStopSync();
    ttSyncTimer = setInterval(ttSyncFromCloud, intervalMs || 20000);
    if (!window._ttSyncHooked) {
        window._ttSyncHooked = true;
        window.addEventListener('focus', () => ttSyncFromCloud());
        document.addEventListener('visibilitychange', () => { if (!document.hidden) ttSyncFromCloud(); });
    }
    ttSubscribeRealtime();
}

function ttStopSync() {
    if (ttSyncTimer) clearInterval(ttSyncTimer);
    ttSyncTimer = null;
}

// Instant updates when Realtime is enabled for the table; harmless no-op if not.
function ttSubscribeRealtime() {
    if (ttRealtimeChannel || !window.supabase || typeof window.supabase.channel !== 'function') return;
    try {
        ttRealtimeChannel = window.supabase
            .channel('tt-time-categories')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_categories' }, () => ttSyncFromCloud())
            .subscribe();
    } catch (e) {
        ttRealtimeChannel = null;
    }
}

// Called by routeTo() (main.js) whenever the user navigates away from any view —
// stops the grid's interval. The background chip keeps its own ticker, and elapsed
// time is derived from running_since, so a stopwatch keeps accruing even while the
// app is closed.
function ttStopAllTimers() {
    ttStopTicker();
    // Leaving the page: keep a slower heartbeat so the floating chip still
    // reflects a stopwatch paused on another device.
    if (ttCategories.some(c => c.running)) ttStartSync(60000);
    else ttStopSync();
}
window.ttStopAllTimers = ttStopAllTimers;

/* ── Background chip: shows the running stopwatch on every other page ── */

let ttMiniTimer = null;

function ttMiniCSS() {
    if (document.getElementById('ttMiniStyles')) return;
    const st = document.createElement('style');
    st.id = 'ttMiniStyles';
    st.textContent = `
    .tt-mini {
        position: fixed; left: 20px; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); z-index: 1400;
        display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 14px;
        border: 1px solid var(--border-color, #e2e8f0); border-radius: 999px;
        background: var(--surface-1, #fff); cursor: pointer; max-width: 260px;
        box-shadow: 0 8px 28px rgba(15,23,42,.16), 0 2px 8px rgba(15,23,42,.08);
        animation: ttMiniIn .25s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes ttMiniIn { from { opacity: 0; transform: translateY(8px) scale(.94); } to { opacity: 1; transform: none; } }
    .tt-mini:hover { box-shadow: 0 10px 32px rgba(15,23,42,.2); }
    .tt-mini-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary, #4F46E5); flex: none; animation: ttPulseMini 1.6s ease-in-out infinite; }
    @keyframes ttPulseMini { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
    .tt-mini-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .tt-mini-name { font-size: 10.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tt-mini-time { font-size: 14.5px; font-weight: 850; color: var(--text-1, #0f172a); font-variant-numeric: tabular-nums; line-height: 1.1; }
    .tt-mini-time.counting { color: var(--primary, #4F46E5); }
    .tt-mini-pause { width: 30px; height: 30px; flex: none; border: none; border-radius: 50%; background: var(--surface-3, #e2e8f0); color: var(--text-1, #0f172a); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
    .tt-mini-pause:hover { background: var(--primary, #4F46E5); color: #fff; }
    @media (max-width: 640px) { .tt-mini { left: 12px; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); } }
    `;
    document.head.appendChild(st);
}

// Rendered from routeTo() on every page: a running stopwatch stays visible (and
// keeps counting) no matter where you are in the app.
function ttRenderMini() {
    if (!ttCategories.length && Array.isArray(state.data.time_categories)) {
        ttCategories = state.data.time_categories;
    }
    const running = ttCategories.find(c => c.running);
    const onTrackerPage = state.view === 'timeTracker';
    let mini = document.getElementById('ttMini');

    if (!running || onTrackerPage) {
        if (mini) mini.remove();
        if (ttMiniTimer) { clearInterval(ttMiniTimer); ttMiniTimer = null; }
        return;
    }

    ttMiniCSS();
    if (!mini) {
        mini = document.createElement('div');
        mini.id = 'ttMini';
        mini.className = 'tt-mini';
        mini.title = 'Open Time Spent On';
        mini.onclick = () => routeTo('timeTracker');
        mini.innerHTML = `
            <span class="tt-mini-dot"></span>
            <span class="tt-mini-text">
                <span class="tt-mini-name" id="ttMiniName"></span>
                <span class="tt-mini-time" id="ttMiniTime">00:00:00</span>
            </span>
            <button class="tt-mini-pause" id="ttMiniPause" title="Pause">${TT_ICON.pause}</button>`;
        document.body.appendChild(mini);
        document.getElementById('ttMiniPause').onclick = (e) => { e.stopPropagation(); ttMiniPause(); };
    }

    ttMiniPaint();
    if (!ttMiniTimer) ttMiniTimer = setInterval(ttMiniPaint, 1000);
}
window.ttRenderMini = ttRenderMini;

function ttMiniPaint() {
    const running = ttCategories.find(c => c.running);
    if (!running) { ttRenderMini(); return; }
    const nameEl = document.getElementById('ttMiniName');
    const timeEl = document.getElementById('ttMiniTime');
    const activeTask = running.active_task_id ? ttFindTask(running.active_task_id) : null;
    const activeHabit = running.active_habit_id ? ttFindHabit(running.active_habit_id) : null;
    const activeTdp = running.active_tdp_item_id ? ttTdpFind(running.active_tdp_item_id) : null;
    const itemName = activeTask ? activeTask.title
        : (activeHabit ? activeHabit.habit_name : (activeTdp ? activeTdp.text : ''));
    if (nameEl) nameEl.textContent = itemName ? `${running.name} · ${itemName}` : (running.name || 'Tracking');

    // A countdown finishes even with the page shut, and the chip reads down too.
    const left = ttCountdownRemaining(running);
    if (left !== null && left <= 0) { ttFinishCountdown(running); ttRenderMini(); return; }
    if (timeEl) {
        timeEl.textContent = ttFormatHMS(left !== null ? Math.max(0, left) : ttLiveElapsed(running));
        timeEl.classList.toggle('counting', left !== null);
    }
}

async function ttMiniPause() {
    const running = ttCategories.find(c => c.running);
    if (!running) return;
    await ttToggle(Number(running.slot_index));
    ttRenderMini();
}

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
    // Drop a sheet hoisted onto <body> on a previous visit, so ids stay unique.
    ['ttLogModal', 'ttManualModal'].forEach(id => {
        const stale = document.getElementById(id);
        if (stale && stale.parentElement === document.body) stale.remove();
    });
    main.innerHTML = `<div class="tt-wrap" style="padding:60px 20px;text-align:center;color:var(--text-3);font-size:13.5px">Loading your stopwatches…</div>`;
    try {
        await ttLoadCategories();
        await ttLoadLogs(true);   // per-task tracked time comes from today's logs
        // view-tdp.js owns the 10-days-plan model; a card needs it to list items.
        if (typeof window.tdpItemsForCategory !== 'function' && typeof ensureViewLoaded === 'function') {
            try { await ensureViewLoaded('tdp'); } catch (e) { }
        }
    } catch (e) {
        console.error('renderTimeTracker: load failed', e);
    }
    main.innerHTML = ttPageHTML();
    if (typeof renderAllIcons === 'function') renderAllIcons();
    else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    ttTick();
    if (ttCategories.some(c => c.running)) ttStartTicker();
    ttStartSync(20000);
}

function ttPageHTML() {
    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return `
    <style>${ttSharedCSS()}
        .tt-overview {
            display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
            background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 18px;
            padding: 16px 20px; margin-bottom: 16px; box-shadow: var(--shadow-card, 0 4px 15px rgba(15,23,42,.05));
        }
        .tt-ov-stat { display: flex; flex-direction: column; gap: 3px; flex: none; }
        .tt-ov-stat b { font-size: 21px; font-weight: 850; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1.1; }
        .tt-ov-stat span { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
        .tt-ov-stat.goal b { color: var(--text-2); }
        .tt-ov-bar { flex: 1 1 200px; min-width: 160px; }
        .tt-ov-track { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
        .tt-ov-track i { display: block; height: 100%; width: 0; border-radius: 999px; background: var(--primary); transition: width .5s cubic-bezier(.4,0,.2,1); }
        .tt-ov-track.hit i { background: var(--success, #10B981); }
        .tt-ov-cap { display: flex; justify-content: space-between; margin-top: 7px; font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--text-3); font-variant-numeric: tabular-nums; }

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

        .tt-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; row-gap: 8px; }
        .tt-live { width: 7px; height: 7px; border-radius: 50%; background: var(--border-color); flex: none; transition: background .2s ease; }
        .tt-card.running .tt-live { background: var(--primary); animation: ttPulse 1.6s ease-in-out infinite; }
        @keyframes ttPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.82); } }

        /* styles/saas.css sets border/background/padding/font-size with !important on
           every input[type=...]. These two live inside their own chrome, so they need
           a more specific selector to strip that decoration back off. */
        .tt-card input.tt-name,
        .tt-card input.tt-name:hover,
        .tt-card input.tt-name:focus {
            flex: 1 1 130px; min-width: 0; height: 34px; padding: 0 9px !important; margin: 0;
            border: 1px solid transparent !important; border-radius: 9px !important;
            background: transparent !important; box-shadow: none !important; outline: none !important;
            color: var(--text-1) !important; font-size: 15px !important; font-weight: 800;
            font-family: inherit !important; line-height: 34px; text-overflow: ellipsis;
            transition: background .15s ease, border-color .15s ease;
        }
        .tt-card input.tt-name::placeholder { color: var(--text-3) !important; font-weight: 700; }
        .tt-card input.tt-name:hover { background: var(--surface-2) !important; }
        .tt-card input.tt-name:focus { background: var(--surface-1) !important; border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-soft, rgba(99,102,241,.14)) !important; }

        .tt-goal {
            display: inline-flex; align-items: center; gap: 6px; flex: none; height: 34px; padding: 0 12px;
            border: 1px solid var(--border-color); border-radius: 999px; background: var(--surface-2);
            transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
        }
        .tt-goal:focus-within { border-color: var(--primary); background: var(--surface-1); box-shadow: 0 0 0 3px var(--primary-soft, rgba(99,102,241,.14)); }
        .tt-goal > svg { color: var(--text-3); flex: none; }
        .tt-card .tt-goal input[type="number"],
        .tt-card .tt-goal input[type="number"]:hover,
        .tt-card .tt-goal input[type="number"]:focus {
            width: 58px; height: 26px; line-height: 26px; padding: 0 !important; margin: 0; flex: none;
            border: none !important; border-radius: 0 !important;
            background: transparent !important; box-shadow: none !important; outline: none !important;
            text-align: right; color: var(--text-1) !important; font-size: 13.5px !important; font-weight: 800;
            font-family: inherit !important; font-variant-numeric: tabular-nums;
            -moz-appearance: textfield; appearance: textfield;
        }
        .tt-card .tt-goal input[type="number"]::-webkit-outer-spin-button,
        .tt-card .tt-goal input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .tt-card .tt-goal input::placeholder { color: var(--text-3) !important; font-weight: 700; }
        .tt-goal em { font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--text-3); }

        .tt-save {
            display: inline-flex; align-items: center; gap: 5px; flex: none; height: 30px; padding: 0 11px;
            border: 1px solid var(--border-color); border-radius: 999px; background: var(--surface-2);
            color: var(--text-3); font-size: 11.5px; font-weight: 800; font-family: inherit; cursor: pointer;
            transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .tt-save svg { opacity: .7; }
        .tt-save:hover { background: var(--surface-3); color: var(--text-2); }
        .tt-save.dirty { background: var(--primary); border-color: var(--primary); color: #fff; }
        .tt-save.dirty svg { opacity: 1; }
        .tt-save.dirty:hover { filter: brightness(1.07); background: var(--primary); color: #fff; }
        .tt-save.done { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.35); color: var(--success, #059669); }
        .tt-save.done svg { opacity: 1; }

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
        .tt-manual {
            flex: none; height: 42px; padding: 0 13px; gap: 5px;
            border: 1px solid var(--border-color); border-radius: 12px;
            background: var(--surface-2); color: var(--text-2); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-family: inherit; font-size: 13px; font-weight: 700;
            transition: color .15s ease, background .15s ease, border-color .15s ease;
        }
        .tt-manual b { font-size: 15px; font-weight: 800; line-height: 1; }
        .tt-manual:hover { color: var(--primary); border-color: var(--primary); background: var(--primary-soft); }

        .tt-timer-row { display: flex; align-items: center; gap: 6px; margin-top: 9px; min-height: 30px; }
        .tt-timer-ico { display: flex; align-items: center; color: var(--text-3); flex: none; }
        .tt-timer-input {
            width: 56px; height: 30px; flex: none; text-align: center;
            border: 1px solid var(--border-color) !important; border-radius: 9px !important;
            background: var(--surface-2) !important; color: var(--text-1);
            font-family: inherit; font-size: 12.5px !important; font-weight: 700;
            padding: 0 6px !important; box-sizing: border-box;
        }
        .tt-timer-input:focus { border-color: var(--primary) !important; box-shadow: none !important; outline: none; }
        .tt-timer-input::-webkit-outer-spin-button, .tt-timer-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .tt-timer-preset {
            height: 30px; min-width: 32px; padding: 0 8px; flex: none;
            border: 1px solid var(--border-color); border-radius: 9px; background: transparent;
            color: var(--text-3); font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
            transition: color .15s ease, background .15s ease, border-color .15s ease;
        }
        .tt-timer-preset:hover { color: var(--primary); border-color: var(--primary); background: var(--primary-soft); }
        .tt-timer-live {
            display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; height: 30px;
            padding: 0 10px; border-radius: 9px; background: var(--primary-soft); color: var(--primary);
        }
        .tt-timer-live b { font-size: 12.5px; font-weight: 800; }
        .tt-timer-live em { font-style: normal; font-size: 11.5px; font-weight: 600; opacity: .75;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tt-timer-cancel {
            width: 30px; height: 30px; flex: none; border: 1px solid var(--border-color); border-radius: 9px;
            background: var(--surface-2); color: var(--text-3); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }
        .tt-timer-cancel:hover { color: var(--text-1); background: var(--surface-3); }
        /* Counting down reads as a different mode, not just a different number. */
        .tt-card.counting .tt-time { color: var(--primary); }

        .tt-man-form { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; }
        .tt-man-row { display: flex; flex-direction: column; gap: 6px; }
        .tt-man-row > span { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
        .tt-man-form select, .tt-man-form input[type="number"], .tt-man-form input[type="date"] {
            height: 42px; width: 100%; border: 1px solid var(--border-color) !important; border-radius: 12px !important;
            background: var(--surface-2) !important; color: var(--text-1); font-family: inherit; font-size: 14px !important;
            font-weight: 600; padding: 0 12px !important; box-sizing: border-box;
        }
        .tt-man-quick { display: flex; gap: 8px; flex-wrap: wrap; }
        .tt-man-quick button {
            height: 32px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 10px;
            background: var(--surface-2); color: var(--text-2); font-family: inherit; font-size: 12.5px;
            font-weight: 700; cursor: pointer;
        }
        .tt-man-quick button:hover { background: var(--surface-3); color: var(--text-1); }
        .tt-man-save {
            height: 44px; border: none; border-radius: 12px; background: var(--primary); color: #fff;
            font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; margin-top: 2px;
        }
        .tt-man-save:hover { filter: brightness(1.07); }
        .tt-man-note { font-size: 12px; color: var(--text-3); font-weight: 600; line-height: 1.5; margin: 0; }
        .tt-man-seg { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--surface-2); }
        .tt-man-seg button {
            flex: 1; height: 34px; border: none; border-radius: 9px; background: transparent;
            color: var(--text-3); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
            transition: background .15s ease, color .15s ease;
        }
        .tt-man-seg button.on { background: var(--surface-1); color: var(--text-1); box-shadow: 0 1px 3px rgba(15,23,42,.1); }
        .tt-log-row.negative .tt-log-dur { color: var(--danger, #EF4444); }

        .tt-todos { display: flex; flex-direction: column; flex: 1; margin-top: 16px; padding-top: 13px; border-top: 1px solid var(--border-color); }
        .tt-todos-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .tt-todos-head b { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }

        .tt-task-sum { display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); }
        .tt-task-sum b { color: var(--text-1); font-variant-numeric: tabular-nums; }

        .tt-pickers { display: flex; align-items: center; gap: 5px; flex: none; }
        .tt-row-label {
            margin: 9px 0 3px; padding: 0 6px; font-size: 10px; font-weight: 800;
            letter-spacing: .06em; text-transform: uppercase; color: var(--text-3);
        }
        .tt-task.done .tt-task-title { text-decoration: line-through; color: var(--text-3); }

        .tt-card select.tt-cat-picker {
            max-width: 92px; height: 26px; padding: 0 20px 0 8px !important; margin: 0;
            border: 1px solid var(--border-color) !important; border-radius: 999px !important;
            background: var(--surface-2) !important; color: var(--text-2) !important;
            font-size: 11px !important; font-weight: 700; font-family: inherit !important;
            text-overflow: ellipsis; box-shadow: none !important; outline: none !important; cursor: pointer;
            appearance: none; -webkit-appearance: none;
            background-image: linear-gradient(45deg, transparent 50%, var(--text-3) 50%), linear-gradient(135deg, var(--text-3) 50%, transparent 50%) !important;
            background-position: calc(100% - 12px) 11px, calc(100% - 8px) 11px !important;
            background-size: 4px 4px, 4px 4px !important; background-repeat: no-repeat !important;
        }
        .tt-card select.tt-cat-picker:focus { border-color: var(--primary) !important; color: var(--text-1) !important; }

        .tt-task { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 9px; transition: background .12s ease; }
        .tt-task:hover { background: var(--surface-2); }
        .tt-task.active { background: var(--primary-soft, rgba(99,102,241,.1)); }
        .tt-card .tt-task input[type=checkbox] { width: 15px; height: 15px; flex: none; margin: 0; cursor: pointer; accent-color: var(--primary); }
        .tt-task-title { flex: 1; min-width: 0; font-size: 13px; line-height: 1.3; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tt-task-time { display: inline-flex; align-items: center; gap: 3px; flex: none; font-size: 11.5px; font-weight: 700; color: var(--text-3); font-variant-numeric: tabular-nums; }
        .tt-task-time b { color: var(--text-2); font-weight: 800; }
        .tt-task-time i { font-style: normal; opacity: .5; }
        .tt-task-est { display: inline-flex; align-items: center; color: var(--text-3); }
        .tt-card .tt-task-est input[type="number"] {
            width: 30px; height: 22px; padding: 0 !important; margin: 0; text-align: right;
            border: none !important; border-radius: 0 !important; background: transparent !important;
            box-shadow: none !important; outline: none !important;
            color: var(--text-2) !important; font-size: 11.5px !important; font-weight: 800;
            font-family: inherit !important; font-variant-numeric: tabular-nums;
            -moz-appearance: textfield; appearance: textfield;
        }
        .tt-card .tt-task-est input[type="number"]::-webkit-outer-spin-button,
        .tt-card .tt-task-est input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .tt-card .tt-task-est input[type="number"]:focus { color: var(--text-1) !important; }
        .tt-task-play {
            width: 26px; height: 26px; flex: none; display: flex; align-items: center; justify-content: center;
            border: 1px solid var(--border-color); border-radius: 50%; background: var(--surface-1);
            color: var(--text-2); cursor: pointer; padding: 0;
            transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .tt-task-play svg { width: 11px; height: 11px; }
        .tt-task-play:hover { border-color: var(--primary); color: var(--primary); }
        .tt-task-play.on { background: var(--primary); border-color: var(--primary); color: #fff; }
        .tt-undated {
            width: 100%; margin-bottom: 8px; padding: 6px; border: none; border-radius: 8px;
            background: transparent; color: var(--text-3); font-size: 11.5px; font-weight: 700;
            font-family: inherit; cursor: pointer;
        }
        .tt-undated:hover { background: var(--surface-2); color: var(--text-1); }
        .tt-todos-head span { font-size: 11px; font-weight: 800; color: var(--text-3); font-variant-numeric: tabular-nums; }
        /* Tall enough for a day's tasks plus its habits — the old 136px cap hid
           whatever came after the first few rows inside a silent scroll area. */
        .tt-todo-list { display: flex; flex-direction: column; gap: 1px; max-height: 280px; overflow-y: auto; margin-bottom: 9px; }
        .tt-todo-list::-webkit-scrollbar { width: 5px; }
        .tt-todo-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 999px; }
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
        .tt-card .tt-add input[type="text"],
        .tt-card .tt-add input[type="text"]:focus {
            flex: 1; min-width: 0; height: 36px; padding: 0 12px !important; margin: 0;
            border: 1px solid var(--border-color) !important; border-radius: 10px !important;
            background: var(--surface-2) !important; color: var(--text-1) !important;
            font-size: 13px !important; font-family: inherit !important;
            box-shadow: none !important; outline: none !important;
        }
        .tt-card .tt-add input[type="text"]:focus { border-color: var(--primary) !important; background: var(--surface-1) !important; box-shadow: 0 0 0 3px var(--primary-soft, rgba(99,102,241,.14)) !important; }
        .tt-add button {
            display: inline-flex; align-items: center; gap: 5px; flex: none; height: 36px; padding: 0 13px;
            border: none; border-radius: 10px; background: var(--surface-3); color: var(--text-2);
            font-size: 12.5px; font-weight: 800; font-family: inherit; cursor: pointer;
            transition: background .15s ease, color .15s ease;
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
        .tt-log-cat em { display: block; font-style: normal; font-size: 11.5px; font-weight: 600; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; }
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

        <div class="tt-overview">
            <div class="tt-ov-stat"><b id="ttTotalSpent">0s</b><span>Total spent today</span></div>
            <div class="tt-ov-stat goal"><b id="ttTotalGoal">—</b><span>Total daily goal</span></div>
            <div class="tt-ov-bar">
                <div class="tt-ov-track" id="ttTotalTrack"><i id="ttTotalBar"></i></div>
                <div class="tt-ov-cap" id="ttTotalCap"></div>
            </div>
        </div>

        <div class="tt-grid">
            ${ttCategories.slice(0, TT_SLOT_COUNT).map(cat => ttRenderCard(cat)).join('')}
        </div>
    </div>

    <div class="tt-sheet hidden" id="ttManualModal" onclick="ttCloseManualBg(event)">
        <div class="tt-sheet-inner">
            <div class="tt-sheet-head">
                <div>
                    <h3 id="ttManualTitle">Add time</h3>
                    <p id="ttManualSub">Log a stretch you didn't run the stopwatch for</p>
                </div>
                <button class="tt-sheet-close" onclick="ttCloseManual()">${TT_ICON.close}</button>
            </div>
            <div id="ttManualBody" class="tt-sheet-body"></div>
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
    const slot = cat.slot_index;

    return `
    <div class="tt-card ${cat.running ? 'running' : ''}" id="ttCard_${slot}">
        <div class="tt-head">
            <span class="tt-live"></span>
            <input class="tt-name" type="text" maxlength="60" placeholder="Name this category"
                   value="${ttEscape(cat.name || '')}" oninput="ttUpdateName(${slot}, this.value)"
                   onkeydown="if(event.key==='Enter'){this.blur(); ttSaveCard(${slot});}" />
            <label class="tt-goal" title="Daily goal for this category, in minutes">
                ${TT_ICON.target}
                <input type="number" min="0" max="1440" placeholder="0" value="${cat.goal_minutes || ''}"
                       oninput="ttUpdateGoal(${slot}, this.value)"
                       onkeydown="if(event.key==='Enter'){this.blur(); ttSaveCard(${slot});}" />
                <em>min</em>
            </label>
            <button class="tt-save" id="ttSave_${slot}" onclick="ttSaveCard(${slot})" title="Save this card's name, goal and to-dos">
                ${TT_ICON.check}<span>Saved</span>
            </button>
        </div>

        <div class="tt-time" id="ttTime_${slot}">${ttTimeHTML(elapsed)}</div>

        <div class="tt-track" id="ttTrack_${slot}"><i id="ttProg_${slot}"></i></div>
        <div class="tt-prog-label" id="ttProgLabel_${slot}"></div>
        <div class="tt-task-sum" id="ttTaskSum_${slot}"></div>

        <div class="tt-controls">
            <button class="tt-play" id="ttPlayBtn_${slot}" onclick="ttToggle(${slot})"
                    title="${cat.running ? 'Pause this stopwatch' : 'Start this stopwatch'}">
                ${cat.running ? TT_ICON.pause : TT_ICON.play}<span>${cat.running ? 'Pause' : 'Start'}</span>
            </button>
            <button class="tt-manual" onclick="ttOpenManual(${slot})"
                    title="Add time you tracked elsewhere, or take back time the clock ran on without you"><b>±</b> Time</button>
            <button class="tt-reset" onclick="ttResetTimer(${slot})" title="Reset today's time">${TT_ICON.reset}</button>
        </div>

        <div class="tt-timer-row" id="ttTimerRow_${slot}">${ttTimerRowHTML(cat)}</div>

        <div class="tt-todos" id="ttTasksWrap_${slot}">
            ${ttRenderTasksSection(cat)}
        </div>
    </div>
    `;
}

// The lower half of a card: which task category feeds it, that category's live
// tasks (each with an estimate, time tracked today and its own play button), and
// a box that adds a new task straight into the Tasks app.
// Either the "run for N minutes" box, or — while a countdown is live — what it
// is and when it lands, with a way out.
function ttTimerRowHTML(cat) {
    const slot = cat.slot_index;
    const left = ttCountdownRemaining(cat);
    if (left !== null) {
        const ends = ttCountdownEndsAt(cat);
        const endStr = ends ? ends.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
        return `
            <span class="tt-timer-live">${TT_ICON.timer}
                <b>${Math.round((cat.timer_target_seconds || 0) / 60)}m timer</b>
                <em>ends ${endStr}</em>
            </span>
            <button class="tt-timer-cancel" onclick="ttCancelCountdown(${slot})" title="Keep counting up instead">${TT_ICON.close}</button>`;
    }
    return `
        <span class="tt-timer-ico" title="Run this stopwatch for a set number of minutes">${TT_ICON.timer}</span>
        <input type="number" class="tt-timer-input" id="ttTimerInput_${slot}" min="1" max="600" placeholder="min"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); ttStartCountdown(${slot}, this.value); this.value='';}" />
        ${[5, 15, 25, 45].map(m => `<button class="tt-timer-preset" onclick="ttStartCountdown(${slot}, ${m})">${m}</button>`).join('')}`;
}

// Repaint just that row, so the "ends at" line and the input swap cleanly
// without the tick stealing focus from whatever you're typing.
function ttPaintTimerRow(cat) {
    const row = document.getElementById('ttTimerRow_' + cat.slot_index);
    if (!row) return;
    const live = ttCountdownRemaining(cat) !== null;
    const shows = row.getAttribute('data-live') === '1';
    if (live === shows) return;                       // nothing structural changed
    // Only mid-typing is worth protecting; a preset button keeps focus after the
    // click and must not pin the row on the input it just replaced.
    const el = document.activeElement;
    if (el && el.classList && el.classList.contains('tt-timer-input') && row.contains(el)) return;
    row.setAttribute('data-live', live ? '1' : '0');
    row.innerHTML = ttTimerRowHTML(cat);
}

function ttRenderTasksSection(cat) {
    const slot = cat.slot_index;
    const cats = ttTaskCategories();
    const linked = cat.task_category || '';

    const picker = `
        <select class="tt-cat-picker" onchange="ttSetCardCategory(${slot}, this.value)" title="Which category feeds this card — its tasks and its habits">
            <option value="" ${linked ? '' : 'selected'}>Pick a category…</option>
            ${cats.map(c => `<option value="${ttEscape(c)}" ${String(c) === String(linked) ? 'selected' : ''}>${ttEscape(c)}</option>`).join('')}
        </select>`;

    const head = `<div class="tt-todos-head"><b>Tasks, habits &amp; plan</b><span class="tt-pickers">${picker}</span></div>`;

    if (!linked) {
        return head + '<div class="tt-empty">Pick a category to pull in its tasks, habits and plan items.</div>';
    }

    const { tasks, undated } = ttTasksFor(cat);
    const habits = ttHabitsFor(cat);

    const tdpItems = ttTdpFor(cat);

    let rows = tasks.map(t => ttRenderTaskRow(slot, t, cat)).join('');
    if (habits.length) {
        rows += `<div class="tt-row-label">Habits</div>` + habits.map(h => ttRenderHabitRow(slot, h, cat)).join('');
    }
    if (tdpItems.length) {
        rows += `<div class="tt-row-label">${ttEscape(ttTdpPlanLabel() || '10 days plan')}</div>`
             + tdpItems.map(i => ttRenderTdpRow(slot, i, cat)).join('');
    }
    if (!rows) {
        rows = `<div class="tt-empty">Nothing due today in ${ttEscape(linked)}.</div>`;
    }

    // Habits predate the shared category, so say where the missing ones are.
    const orphanHabits = habits.length ? 0 : ttUncategorisedHabitCount();
    const orphanLine = orphanHabits
        ? `<button class="tt-undated" onclick="routeTo('habits')" title="Open Habits to file them">${orphanHabits} habit${orphanHabits !== 1 ? 's have' : ' has'} no category yet — set one in Habits</button>`
        : '';

    const undatedLine = undated
        ? `<button class="tt-undated" onclick="ttToggleUndated(${slot})">${ttShowUndated[slot] ? 'Hide' : 'Show'} ${undated} undated task${undated !== 1 ? 's' : ''}</button>`
        : '';

    const addBox = linked ? `
        <div class="tt-add">
            <input type="text" maxlength="200" placeholder="Add a task…" id="ttTaskInput_${slot}"
                   onkeydown="if(event.key==='Enter'){ttAddTask(${slot}); event.preventDefault();}" />
            <button onclick="ttAddTask(${slot})" title="Add to ${ttEscape(linked)}">${TT_ICON.plus} Add</button>
        </div>` : '';

    return `${head}
        <div class="tt-todo-list" id="ttTaskList_${slot}">${rows}</div>
        ${orphanLine}
        ${undatedLine}
        ${addBox}`;
}

function ttRenderHabitRow(slot, habit, cat) {
    const isActive = cat.running && String(cat.active_habit_id || '') === String(habit.id);
    const done = ttHabitDoneToday(habit.id);
    const tracked = ttItemTracked('habit', habit.id);
    return `
    <div class="tt-task tt-habit ${isActive ? 'active' : ''} ${done ? 'done' : ''}" id="ttHabit_${slot}_${habit.id}">
        <input type="checkbox" ${done ? 'checked' : ''} title="Mark done for today" onchange="ttToggleHabitDone(${slot}, '${habit.id}')" />
        <span class="tt-task-title" title="${ttEscape(habit.habit_name || '')}">${ttEscape(habit.habit_name || 'Habit')}</span>
        <span class="tt-task-time">
            <b id="ttHabitTracked_${slot}_${habit.id}">${tracked ? ttFormatDuration(tracked) : '—'}</b>
            <i>/</i>
            <label class="tt-task-est" title="Planned minutes for this habit">
                <input type="number" min="0" max="1440" placeholder="0" value="${habit.duration || ''}"
                       onchange="ttUpdateHabitEstimate(${slot}, '${habit.id}', this.value)" />m
            </label>
        </span>
        <button class="tt-task-play ${isActive ? 'on' : ''}" onclick="ttToggleHabit(${slot}, '${habit.id}')"
                title="${isActive ? 'Pause' : 'Start this habit'}">${isActive ? TT_ICON.pause : TT_ICON.play}</button>
    </div>`;
}

// Ticking a habit writes the same habit_logs row the Habits page uses.
async function ttToggleHabitDone(slot, habitId) {
    const cat = ttFindCat(slot);
    if (!cat) return;
    const today = ttTodayStr();
    if (!Array.isArray(state.data.habit_logs)) state.data.habit_logs = [];
    const idx = state.data.habit_logs.findIndex(l =>
        String(l.habit_id) === String(habitId) && String(l.date || '').slice(0, 10) === today);

    try {
        if (idx !== -1) {
            const existing = state.data.habit_logs[idx];
            state.data.habit_logs.splice(idx, 1);
            ttRenderTasksInto(cat); ttTick();
            await apiPost({ action: 'delete', sheet: 'habit_logs', id: existing.id });
        } else {
            const payload = { habit_id: String(habitId), date: today, status: 'completed' };
            state.data.habit_logs.push({ id: 'temp-' + Date.now(), ...payload });
            ttRenderTasksInto(cat); ttTick();
            const res = await apiPost({ action: 'create', sheet: 'habit_logs', payload });
            if (res && res.success && res.id) {
                const temp = state.data.habit_logs.find(l => String(l.id).startsWith('temp-') && String(l.habit_id) === String(habitId));
                if (temp) temp.id = res.id;
            }
        }
    } catch (e) {
        console.error('ttToggleHabitDone failed:', e);
        if (typeof toast === 'function') toast('Could not update habit');
    }
}

function ttUpdateHabitEstimate(slot, habitId, value) {
    const habit = ttFindHabit(habitId);
    if (!habit) return;
    const mins = Math.max(0, Math.min(1440, parseInt(value, 10) || 0));
    habit.duration = mins;
    ttTick();
    apiPost({ action: 'update', sheet: 'habits', id: habitId, payload: { duration: mins } })
        .catch(e => console.error('ttUpdateHabitEstimate failed:', e));
}

function ttRenderTaskRow(slot, task, cat) {
    const isActive = cat.running && String(cat.active_task_id || '') === String(task.id);
    const tracked = ttTaskTracked(task.id);
    return `
    <div class="tt-task ${isActive ? 'active' : ''}" id="ttTask_${slot}_${task.id}">
        <input type="checkbox" title="Mark complete" onchange="ttToggleTaskDone(${slot}, '${task.id}')" />
        <span class="tt-task-title" title="${ttEscape(task.title || '')}">${ttEscape(task.title || 'Untitled')}</span>
        <span class="tt-task-time">
            <b id="ttTaskTracked_${slot}_${task.id}">${tracked ? ttFormatDuration(tracked) : '—'}</b>
            <i>/</i>
            <label class="tt-task-est" title="Planned minutes for this task">
                <input type="number" min="0" max="1440" placeholder="0" value="${task.duration || ''}"
                       onchange="ttUpdateTaskEstimate(${slot}, '${task.id}', this.value)" />m
            </label>
        </span>
        <button class="tt-task-play ${isActive ? 'on' : ''}" onclick="ttToggleTask(${slot}, '${task.id}')"
                title="${isActive ? 'Pause' : 'Start this task'}">${isActive ? TT_ICON.pause : TT_ICON.play}</button>
    </div>`;
}

// Re-render one card's task area only, so other cards keep their state and focus.
function ttRenderTasksInto(cat) {
    const wrap = document.getElementById('ttTasksWrap_' + cat.slot_index);
    if (wrap) wrap.innerHTML = ttRenderTasksSection(cat);
}

// A 10-days-plan item: same shape as a task row, but ticking it writes back into
// the plan's categories_json rather than a row of its own.
function ttRenderTdpRow(slot, item, cat) {
    const isActive = cat.running && String(cat.active_tdp_item_id || '') === String(item.id);
    const tracked = ttItemTracked('tdp', item.id);
    return `
    <div class="tt-task tt-tdp ${isActive ? 'active' : ''} ${item.completed ? 'done' : ''}" id="ttTdp_${slot}_${ttEscape(item.id)}">
        <input type="checkbox" ${item.completed ? 'checked' : ''} title="Tick off in the 10 days plan"
               onchange="ttToggleTdpDone(${slot}, '${ttEscape(ttJsStr(item.id))}')" />
        <span class="tt-task-title" title="${ttEscape(item.text)}">${ttEscape(item.text || 'Item')}</span>
        <span class="tt-task-time">
            <b id="ttTdpTracked_${slot}_${ttEscape(item.id)}">${tracked ? ttFormatDuration(tracked) : '—'}</b>
            <i>/</i>
            <label class="tt-task-est" title="Minutes you mean to give this">
                <input type="number" min="0" max="1440" placeholder="0" value="${item.minutes || ''}"
                       onchange="ttUpdateTdpEstimate(${slot}, '${ttEscape(ttJsStr(item.id))}', this.value)" />m
            </label>
        </span>
        <button class="tt-task-play ${isActive ? 'on' : ''}" onclick="ttToggleTdp(${slot}, '${ttEscape(ttJsStr(item.id))}')"
                title="${isActive ? 'Pause' : 'Start on this'}">${isActive ? TT_ICON.pause : TT_ICON.play}</button>
    </div>`;
}

async function ttToggleTdpDone(slot, itemId) {
    const cat = ttFindCat(slot);
    if (!cat || typeof window.tdpToggleItemById !== 'function') return;
    await window.tdpToggleItemById(itemId);
    ttRenderTasksInto(cat);
    ttTick();
}

async function ttUpdateTdpEstimate(slot, itemId, value) {
    const cat = ttFindCat(slot);
    if (!cat || typeof window.tdpSetItemMinutes !== 'function') return;
    await window.tdpSetItemMinutes(itemId, value);
    ttTick();
}

function ttSetCardCategory(slot, value) {
    const cat = ttFindCat(slot);
    if (!cat) return;
    cat.task_category = value || null;
    ttScheduleSave(cat, { task_category: cat.task_category }, 0);
    ttRenderTasksInto(cat);
    ttTick();
}

function ttToggleUndated(slot) {
    ttShowUndated[slot] = !ttShowUndated[slot];
    const cat = ttFindCat(slot);
    if (cat) { ttRenderTasksInto(cat); ttTick(); }
}

async function ttAddTask(slot) {
    const cat = ttFindCat(slot);
    if (!cat || !cat.task_category) return;
    const input = document.getElementById('ttTaskInput_' + slot);
    const title = input ? input.value.trim() : '';
    if (!title) return;
    if (input) input.value = '';

    const payload = {
        title: title.slice(0, 200), priority: 'P2', status: 'pending',
        category: cat.task_category, due_date: ttTodayStr(), subtasks: '[]'
    };
    try {
        const res = await apiPost({ action: 'create', sheet: 'tasks', payload });
        if (res && res.success) {
            if (!Array.isArray(state.data.tasks)) state.data.tasks = [];
            state.data.tasks.push({ id: res.id, ...payload });
            ttRenderTasksInto(cat);
            ttTick();
        }
    } catch (e) {
        console.error('ttAddTask failed:', e);
        if (typeof toast === 'function') toast('Could not add task');
    }
}

async function ttToggleTaskDone(slot, taskId) {
    const cat = ttFindCat(slot);
    const task = ttFindTask(taskId);
    if (!cat || !task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    task.status = newStatus;
    task.completed_at = newStatus === 'completed' ? new Date().toISOString() : null;
    ttRenderTasksInto(cat);
    ttTick();
    try {
        await apiPost({ action: 'update', sheet: 'tasks', id: taskId, payload: { status: newStatus, completed_at: task.completed_at } });
    } catch (e) {
        console.error('ttToggleTaskDone failed:', e);
        task.status = newStatus === 'completed' ? 'pending' : 'completed';
        ttRenderTasksInto(cat);
        if (typeof toast === 'function') toast('Could not update task');
    }
}

function ttUpdateTaskEstimate(slot, taskId, value) {
    const task = ttFindTask(taskId);
    if (!task) return;
    const mins = Math.max(0, Math.min(1440, parseInt(value, 10) || 0));
    task.duration = mins;
    ttTick();
    apiPost({ action: 'update', sheet: 'tasks', id: taskId, payload: { duration: mins } })
        .catch(e => console.error('ttUpdateTaskEstimate failed:', e));
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

/* ═══════════════════════════════════════════════════════
   MANUAL TIME — for the stretch you did away from the app, or the hour you
   forgot to start the clock on. It writes the same time_logs row a tracked
   interval does, so the card, the per-item totals and Analysis all pick it up.
═══════════════════════════════════════════════════════ */

let ttManualSlot = null;
let ttManualMode = 'add';       // 'add' | 'remove' — the same sheet both ways

function ttOpenManual(slot) {
    const cat = ttFindCat(slot);
    if (!cat) return;
    ttManualSlot = slot;
    const modal = document.getElementById('ttManualModal');
    if (!modal) return;
    // Same containing-block trap as the log sheet: #main is transformed.
    if (modal.parentElement !== document.body) document.body.appendChild(modal);

    ttManualMode = 'add';
    const title = document.getElementById('ttManualTitle');
    if (title) title.textContent = 'Add time';
    const sub = document.getElementById('ttManualSub');
    if (sub) sub.textContent = cat.name || 'this category';

    const { tasks } = cat.task_category ? ttTasksFor(cat) : { tasks: [] };
    const habits = ttHabitsFor(cat);
    const tdpItems = ttTdpFor(cat);
    const itemOptions = [
        '<option value="">The category itself</option>',
        ...tasks.map(t => `<option value="task:${ttEscape(t.id)}">${ttEscape(t.title || 'Task')}</option>`),
        ...habits.map(h => `<option value="habit:${ttEscape(h.id)}">${ttEscape(h.habit_name || 'Habit')}</option>`),
        ...tdpItems.map(i => `<option value="tdp:${ttEscape(i.id)}">${ttEscape(i.text || 'Plan item')}</option>`)
    ].join('');

    const body = document.getElementById('ttManualBody');
    if (body) body.innerHTML = `
        <div class="tt-man-form">
            <div class="tt-man-seg" id="ttManualSeg">
                <button type="button" class="on" data-mode="add" onclick="ttManualSetMode('add')">Add time</button>
                <button type="button" data-mode="remove" onclick="ttManualSetMode('remove')">Remove time</button>
            </div>
            <div class="tt-man-row">
                <span>How long</span>
                <input type="number" id="ttManualMins" min="1" max="1440" step="5" placeholder="Minutes"
                       onkeydown="if(event.key==='Enter'){event.preventDefault(); ttSubmitManual();}" />
                <div class="tt-man-quick">
                    <button type="button" onclick="ttManualQuick(15)">15m</button>
                    <button type="button" onclick="ttManualQuick(30)">30m</button>
                    <button type="button" onclick="ttManualQuick(45)">45m</button>
                    <button type="button" onclick="ttManualQuick(60)">1h</button>
                    <button type="button" onclick="ttManualQuick(120)">2h</button>
                </div>
            </div>
            <div class="tt-man-row">
                <span>Against</span>
                <select id="ttManualItem">${itemOptions}</select>
            </div>
            <div class="tt-man-row">
                <span>Day</span>
                <input type="date" id="ttManualDate" value="${ttTodayStr()}" max="${ttTodayStr()}" />
            </div>
            <button class="tt-man-save" id="ttManualSave" onclick="ttSubmitManual()">Add to ${ttEscape(cat.name || 'category')}</button>
            <p class="tt-man-note" id="ttManualNote">Time added for today counts toward the card's clock and its goal. An earlier day only shows up in the Log and Analysis.</p>
        </div>`;

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('ttManualMins')?.focus(), 50);
}

// Left the clock running through lunch? Remove mode takes the overrun back off
// the card and logs the correction, so the day's totals stay honest.
function ttManualSetMode(mode) {
    ttManualMode = mode === 'remove' ? 'remove' : 'add';
    const cat = ttFindCat(ttManualSlot);
    const seg = document.getElementById('ttManualSeg');
    if (seg) seg.querySelectorAll('button').forEach(b =>
        b.classList.toggle('on', b.getAttribute('data-mode') === ttManualMode));

    const title = document.getElementById('ttManualTitle');
    if (title) title.textContent = ttManualMode === 'remove' ? 'Remove time' : 'Add time';

    const save = document.getElementById('ttManualSave');
    if (save) save.textContent = (ttManualMode === 'remove' ? 'Remove from ' : 'Add to ')
        + (cat && cat.name ? cat.name : 'category');

    const note = document.getElementById('ttManualNote');
    if (note) note.textContent = ttManualMode === 'remove'
        ? "Taken off today's clock and logged as a correction, so the Log and Analysis agree with the card. It can't go below zero."
        : "Time added for today counts toward the card's clock and its goal. An earlier day only shows up in the Log and Analysis.";

    document.getElementById('ttManualMins')?.focus();
}

function ttManualQuick(mins) {
    const el = document.getElementById('ttManualMins');
    if (!el) return;
    el.value = (parseInt(el.value, 10) || 0) + mins;
    el.focus();
}

function ttCloseManual() {
    document.getElementById('ttManualModal')?.classList.add('hidden');
    ttManualSlot = null;
}

function ttCloseManualBg(e) {
    if (e.target && e.target.id === 'ttManualModal') ttCloseManual();
}

async function ttSubmitManual() {
    const cat = ttFindCat(ttManualSlot);
    if (!cat) return;
    const removing = ttManualMode === 'remove';

    const mins = parseInt(document.getElementById('ttManualMins')?.value, 10);
    if (!mins || mins <= 0) {
        if (typeof showToast === 'function') {
            showToast(removing ? 'Enter how many minutes to remove' : 'Enter how many minutes to add');
        }
        return;
    }
    let seconds = Math.min(mins, 1440) * 60;

    const raw = document.getElementById('ttManualItem')?.value || '';
    const sep = raw.indexOf(':');                       // TDP handles contain colons
    const kind = sep === -1 ? null : raw.slice(0, sep);
    const id = sep === -1 ? null : raw.slice(sep + 1);
    const dateStr = document.getElementById('ttManualDate')?.value || ttTodayStr();
    const today = ttTodayStr();

    ttCloseManual();

    if (dateStr === today) {
        // Bank whatever is on the clock first, so the correction applies to a
        // settled number and running_since can't double-count it afterwards.
        if (cat.running) {
            ttCloseInterval(cat);
            cat.running_since = new Date().toISOString();
        }
        const before = cat.elapsed_seconds || 0;
        const after = Math.max(0, before + (removing ? -seconds : seconds));
        cat.elapsed_seconds = after;
        // Never log away more than the card actually held.
        if (removing) seconds = before - after;
        ttPersistCategory(cat, cat.running
            ? { elapsed_seconds: after, running_since: cat.running_since }
            : { elapsed_seconds: after });
    }

    if (seconds > 0) {
        // The log row wants a plausible window; back-date it from the end of the
        // day it belongs to, so the Log reads sensibly and the ordering holds.
        const endedAt = dateStr === today ? new Date() : new Date(dateStr + 'T18:00:00');
        const startedAt = new Date(endedAt.getTime() - seconds * 1000);
        await ttCreateLog(cat, startedAt.toISOString(), endedAt.toISOString(),
            removing ? -seconds : seconds,
            kind === 'task' ? id : null, kind === 'habit' ? id : null, dateStr,
            kind === 'tdp' ? id : null);
    }

    ttSyncCardState(cat);
    ttRenderTasksInto(cat);
    ttTick();
    if (typeof showToast === 'function') {
        const label = cat.name || 'this category';
        showToast(seconds > 0
            ? (removing ? `Removed ${ttFormatDuration(seconds)} from ${label}`
                        : `Added ${ttFormatDuration(seconds)} to ${label}`)
            : `${label} was already at zero`);
    }
}

async function ttOpenLogModal() {
    const modal = document.getElementById('ttLogModal');
    if (!modal) return;
    // #main carries the page-transition transform, and a transformed ancestor becomes
    // the containing block for position:fixed children — so the sheet has to sit on
    // <body> to cover the viewport instead of being clipped to the content column.
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
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
            <div class="tt-log-date">${ttFormatDateLabel(date)} · ${ttFormatSigned(dayTotal)}</div>
            ${rows.map(l => {
                const started = l.started_at ? new Date(l.started_at) : null;
                const timeStr = started && !isNaN(started.getTime())
                    ? started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
                const negative = (l.duration_seconds || 0) < 0;
                return `
                <div class="tt-log-row${negative ? ' negative' : ''}">
                    <span class="tt-log-swatch" style="background:${ttLogColor(l)}"></span>
                    <span class="tt-log-cat">${ttEscape(l.category_name || 'Category')}${l.task_title ? `<em>${ttEscape(l.task_title)}</em>` : ''}${negative ? '<em>correction</em>' : ''}</span>
                    <span class="tt-log-time">${timeStr}</span>
                    <span class="tt-log-dur">${ttFormatSigned(l.duration_seconds)}</span>
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
