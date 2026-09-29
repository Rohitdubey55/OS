/* ============================================================================
   TEN DAYS PLAN (TDP) — a standalone Daily Tools page.
   
   Ten days is short enough to see the end of and long enough to move something.
   A plan is one row in `vision_tdp`: a start date, an end date ten days later,
   and a categories_json blob of { "<Category>": [ {id, text, completed} ] }.
   Only one plan is active at a time; starting a new one archives the old.

   This used to live inside the Vision page as a modal. It's a daily tool, not a
   long-horizon one, so it now has its own page — and, more to the point, its
   categories are the SAME ones Tasks, Habits and Time Spent On use, so an item
   here shows up on the matching stopwatch card. main.js owns that shared list as
   window.appCategories(); a plan written under the old fixed names keeps them.
   ============================================================================ */

const TDP_LEGACY_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

const TDP_ICON = {
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    close: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    archive: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',
    forward: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>',
    more: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
    comment: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5a8.4 8.4 0 0 1-.9-3.8 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 8.2z"/></svg>',
    star: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2.5 15,9 22,9.8 17,14.5 18.3,21.5 12,18.2 5.7,21.5 7,14.5 2,9.8 9,9"/></svg>',
    left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    today: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>'
};

function tdpEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════════════
   DATES — local calendar maths. toISOString() is UTC and shifts the day for
   anyone not on GMT, which is what once made plans start "yesterday".
═══════════════════════════════════════════════════════ */

function tdpLocalDateStr(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tdpParseLocal(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s); d.setHours(0, 0, 0, 0); return d;
}

function tdpPlusDays(dateStr, days) {
    const d = tdpParseLocal(dateStr);
    return tdpLocalDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

function tdpNiceDate(s) {
    const d = tdpParseLocal(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ═══════════════════════════════════════════════════════
   PLAN MODEL
═══════════════════════════════════════════════════════ */

function tdpPlans() {
    return Array.isArray(state.data.vision_tdp) ? state.data.vision_tdp : [];
}

function tdpActivePlan() {
    return tdpPlans().find(p => p.status === 'active') || null;
}

/* ── Which plan is on screen ──────────────────────────────────────────────
   The page opens on the running plan, but you can step back through finished
   ones and forward into any you've lined up. tdpViewId is just what's being
   looked at; the plan that's actually RUNNING is always tdpActivePlan(), so
   browsing never changes which one the stopwatch cards read from. */

let tdpViewId = null;

// Every plan in date order — the spine the arrows walk along.
function tdpTimeline() {
    return tdpPlans().slice().sort((a, b) =>
        String(a.start_date || '').localeCompare(String(b.start_date || '')));
}

function tdpViewedPlan() {
    if (tdpViewId) {
        const hit = tdpFindPlan(tdpViewId);
        if (hit) return hit;
        tdpViewId = null;                    // it was deleted out from under us
    }
    return tdpActivePlan() || tdpTimeline().slice(-1)[0] || null;
}

function tdpNeighbours(plan) {
    const line = tdpTimeline();
    const i = line.findIndex(p => String(p.id) === String(plan && plan.id));
    return { prev: i > 0 ? line[i - 1] : null, next: i >= 0 && i < line.length - 1 ? line[i + 1] : null };
}

window.tdpGoToPlan = function (id) {
    tdpViewId = id || null;
    tdpCloseSheet();
    renderTDP();
};

window.tdpStep = function (dir) {
    const { prev, next } = tdpNeighbours(tdpViewedPlan());
    const target = dir < 0 ? prev : next;
    if (target) tdpGoToPlan(target.id);
};

// Where a plan sits relative to today. 'upcoming' is a real status: a plan you
// wrote before its start date, which becomes the active one when the day comes.
function tdpPhase(plan) {
    if (!plan) return 'none';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (tdpParseLocal(plan.start_date) > today) return 'upcoming';
    if (tdpParseLocal(plan.end_date) < today) return 'past';
    return 'current';
}

function tdpFindPlan(id) {
    return tdpPlans().find(p => String(p.id) === String(id)) || null;
}

function tdpCats(plan) {
    if (!plan || !plan.categories_json) return {};
    try {
        const parsed = typeof plan.categories_json === 'string'
            ? JSON.parse(plan.categories_json) : (plan.categories_json || {});
        const out = {};
        Object.keys(parsed || {}).forEach(k => { if (k !== '__converted') out[k] = parsed[k]; });
        return out;
    } catch (e) { return {}; }
}

/* ── Items are tasks ──────────────────────────────────────────────────────
   A plan item used to be an object inside categories_json, which meant the
   Tasks app couldn't see it, it had no deadline, and comments or a vision link
   would each have needed inventing from scratch. An item is now an ordinary
   task carrying tdp_plan_id, due on the day its plan ends. One record, so
   ticking it in the plan, in Tasks or on a stopwatch card is the same act. */

function tdpTasks() {
    return Array.isArray(state.data.tasks) ? state.data.tasks : [];
}

function tdpTasksOf(plan, category) {
    if (!plan) return [];
    return tdpTasks()
        .filter(t => String(t.tdp_plan_id || '') === String(plan.id)
                  && (category == null || String(t.category || '') === String(category)))
        .sort((a, b) => {
            const d = (tdpTaskDone(a) ? 1 : 0) - (tdpTaskDone(b) ? 1 : 0);
            return d || String(a.created_at || '').localeCompare(String(b.created_at || ''));
        });
}

function tdpTaskDone(t) {
    return !!t && t.status === 'completed';
}

function tdpFindTask(id) {
    return tdpTasks().find(t => String(t.id) === String(id)) || null;
}

function tdpComments(t) {
    if (!t || !t.comments_json) return [];
    try {
        const parsed = typeof t.comments_json === 'string' ? JSON.parse(t.comments_json) : t.comments_json;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
}

// Every category this plan touches: the curated list plus any that its own
// tasks are filed under, so an item can't go missing because you retired its
// category mid-block.
function tdpCategoriesFor(plan) {
    let list = [];
    if (typeof window.appSavedCategories === 'function') {
        try { list = window.appSavedCategories().slice(); } catch (e) { list = []; }
    } else if (typeof window.appCategories === 'function') {
        try { list = window.appCategories().slice(); } catch (e) { list = []; }
    }
    if (!list.length) list = TDP_LEGACY_CATEGORIES.slice();
    tdpTasksOf(plan).forEach(t => {
        const c = t.category || '';
        if (c && !list.includes(c)) list.push(c);
    });
    Object.keys(tdpCats(plan)).forEach(k => {
        if (!list.includes(k) && (tdpCats(plan)[k] || []).length) list.push(k);
    });
    return list;
}

function tdpProgress(plan) {
    // A carried-over stub is a record of where something went, not an item you
    // failed to do — counting it would punish you twice for one move.
    const items = tdpTasksOf(plan).filter(t => t.status !== 'cancelled');
    const done = items.filter(tdpTaskDone).length;
    return { total: items.length, done, pct: items.length ? Math.round(done / items.length * 100) : 0 };
}

function tdpDayInfo(plan) {
    if (!plan) return { day: 0, remaining: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = tdpParseLocal(plan.start_date);
    const end = tdpParseLocal(plan.end_date);
    return {
        day: Math.max(0, Math.min(10, Math.floor((today - start) / 86400000) + 1)),
        remaining: Math.max(0, Math.ceil((end - today) / 86400000))
    };
}

/* ── Conversion ───────────────────────────────────────────────────────────
   Plans written before this change still hold their items in categories_json.
   Convert one item at a time, clearing each from the blob only once its task
   exists, so a failure halfway leaves the rest intact to try again rather than
   dropping them on the floor. */

async function tdpConvertPlan(plan) {
    const cats = tdpCats(plan);
    const names = Object.keys(cats);
    if (!names.length) return false;

    let moved = 0;
    for (const cat of names) {
        const items = (cats[cat] || []).slice();
        for (const item of items) {
            if (!item || !String(item.text || '').trim()) continue;
            const payload = {
                title: String(item.text).trim(),
                status: item.completed ? 'completed' : 'pending',
                priority: 'P2',
                category: cat,
                due_date: plan.end_date,
                duration: Number(item.minutes) || null,
                tdp_plan_id: String(plan.id),
                subtasks: '[]',
                created_at: new Date().toISOString()
            };
            if (item.completed) payload.completed_at = new Date().toISOString();
            try {
                const res = await apiPost('tasks', payload);
                const id = (res && (res.id || (res.data && res.data.id))) || ('tk-' + Date.now() + moved);
                if (!Array.isArray(state.data.tasks)) state.data.tasks = [];
                state.data.tasks.push({ id, ...payload });
            } catch (e) {
                console.error('tdpConvertPlan: could not move an item, leaving it in place', e);
                continue;                       // stays in the blob for next time
            }
            // Only now is it safe to drop it from the old home.
            cats[cat] = (cats[cat] || []).filter(x => x !== item);
            moved++;
        }
    }

    const leftovers = {};
    Object.keys(cats).forEach(k => { if ((cats[k] || []).length) leftovers[k] = cats[k]; });
    if (!Object.keys(leftovers).length) leftovers.__converted = true;
    plan.categories_json = JSON.stringify(leftovers);
    await tdpSavePlan(plan);
    return moved > 0;
}

// Items in this plan's category, for the Time Spent On cards.
window.tdpItemsForCategory = function (category) {
    const plan = tdpActivePlan();
    if (!plan || !category) return [];
    // Skip the carried-over stubs: they're a note about where something went,
    // not work you can start a clock on.
    return tdpTasksOf(plan, category).filter(t => t.status !== 'cancelled').map(t => ({
        id: String(t.id),
        text: t.title || '',
        completed: tdpTaskDone(t),
        minutes: Number(t.duration) || 0
    }));
};

// The ids a stopwatch card should NOT also list under plain Tasks.
window.tdpActivePlanTaskIds = function () {
    const plan = tdpActivePlan();
    if (!plan) return [];
    return tdpTasksOf(plan).filter(t => t.status !== 'cancelled').map(t => String(t.id));
};

window.tdpSetItemMinutes = async function (itemId, minutes) {
    const t = tdpFindTask(itemId);
    if (!t) return false;
    const mins = Math.max(0, Math.min(1440, parseInt(minutes, 10) || 0));
    t.duration = mins || null;
    await tdpSaveTask(t, { duration: t.duration });
    return true;
};

window.tdpToggleItemById = async function (itemId) {
    const t = tdpFindTask(itemId);
    if (!t) return false;
    await tdpSetTaskDone(t, !tdpTaskDone(t));
    return true;
};

window.tdpAddItemToCategory = async function (category, text) {
    const plan = tdpActivePlan();
    if (!plan || !category || !String(text || '').trim()) return null;
    return await tdpCreateItem(plan, category, text);
};

window.tdpActivePlanSummary = function () {
    const plan = tdpActivePlan();
    if (!plan) return null;
    const info = tdpDayInfo(plan);
    return { id: plan.id, day: info.day, remaining: info.remaining, ...tdpProgress(plan) };
};

/* ═══════════════════════════════════════════════════════
   PERSISTENCE — one row, written whole. Every mutation goes through here so the
   optimistic repaint and the save can't drift apart.
═══════════════════════════════════════════════════════ */

// The whole row goes every time — a plan is four fields and a blob, and
// guessing which ones changed is how the blob gets clobbered.
async function tdpSavePlan(plan) {
    try {
        await apiPost('vision_tdp', plan);
    } catch (e) {
        console.error('tdpSavePlan failed:', e);
        if (typeof showToast === 'function') showToast('Could not save — check your connection');
    }
}

async function tdpSaveTask(task, fields) {
    try {
        await apiPost({ action: 'update', sheet: 'tasks', id: task.id, payload: fields || task });
    } catch (e) {
        console.error('tdpSaveTask failed:', e);
        if (typeof showToast === 'function') showToast('Could not save — check your connection');
    }
}

// One new plan item = one new task, due the day the plan ends.
async function tdpCreateItem(plan, category, text) {
    const payload = {
        title: String(text).trim(),
        status: 'pending',
        priority: 'P2',
        category,
        due_date: plan.end_date,
        tdp_plan_id: String(plan.id),
        subtasks: '[]',
        created_at: new Date().toISOString()
    };
    let id;
    try {
        const res = await apiPost('tasks', payload);
        id = (res && (res.id || (res.data && res.data.id))) || ('tk-' + Date.now());
    } catch (e) {
        console.error('tdpCreateItem failed:', e);
        if (typeof showToast === 'function') showToast('Could not add that');
        return null;
    }
    if (!Array.isArray(state.data.tasks)) state.data.tasks = [];
    state.data.tasks.push({ id, ...payload });
    return id;
}

async function tdpSetTaskDone(task, done) {
    task.status = done ? 'completed' : 'pending';
    task.completed_at = done ? new Date().toISOString() : null;
    await tdpSaveTask(task, { status: task.status, completed_at: task.completed_at });
    // A goal this item feeds gets its plan contribution recounted.
    if (task.vision_id && typeof window.tdpRecountVision === 'function') {
        window.tdpRecountVision(task.vision_id);
    }
}

window.tdpToggleItem = async function (taskId) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    await tdpSetTaskDone(t, !tdpTaskDone(t));
    tdpRepaint();
};

window.tdpAddItem = async function (planId, cat, inputEl) {
    const text = (inputEl && inputEl.value || '').trim();
    if (!text) return;
    const plan = tdpFindPlan(planId);
    if (!plan) return;
    if (inputEl) inputEl.value = '';
    await tdpCreateItem(plan, cat, text);
    tdpRepaint(cat);
};

// Deleting a plan item deletes the task — it was only ever the one record.
window.tdpDeleteItem = async function (taskId) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    if (!confirm(`Delete "${t.title}"?\n\nIt's a task, so this removes it from Tasks too.`)) return;
    state.data.tasks = tdpTasks().filter(x => String(x.id) !== String(taskId));
    tdpCloseSheet();
    tdpRepaint();
    try { await apiPost({ action: 'delete', sheet: 'tasks', id: taskId }); }
    catch (e) { console.error('tdpDeleteItem failed:', e); }
};

/* ── Carry over ───────────────────────────────────────────────────────────
   An unfinished item moves to the next plan and takes that plan's end date as
   its new deadline. The block it left keeps a greyed line saying where it went,
   so a plan's history still shows what you set out to do, not just what
   survived. That line is a real task too — cancelled, marked with where it
   landed — which is why the score counts only items still in play. */

function tdpNextPlanFor(plan) {
    const { next } = tdpNeighbours(plan);
    return next || null;
}

window.tdpCarryItem = async function (taskId) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    const from = tdpFindPlan(t.tdp_plan_id);
    const to = tdpNextPlanFor(from);
    if (!to) {
        if (typeof showToast === 'function') showToast('No later plan to move it to — make one first');
        return;
    }

    // The stub left behind: same title, cancelled, pointing forward.
    const stub = {
        title: t.title,
        status: 'cancelled',
        priority: t.priority || 'P2',
        category: t.category || '',
        due_date: from ? from.end_date : t.due_date,
        tdp_plan_id: String(from ? from.id : t.tdp_plan_id),
        tdp_carried_from: 'to:' + String(to.id),
        subtasks: '[]',
        created_at: new Date().toISOString()
    };

    t.tdp_plan_id = String(to.id);
    t.tdp_carried_from = 'from:' + String(from ? from.id : '');
    t.due_date = to.end_date;

    await tdpSaveTask(t, {
        tdp_plan_id: t.tdp_plan_id, tdp_carried_from: t.tdp_carried_from, due_date: t.due_date
    });
    try {
        const res = await apiPost('tasks', stub);
        const id = (res && (res.id || (res.data && res.data.id))) || ('tk-' + Date.now());
        state.data.tasks.push({ id, ...stub });
    } catch (e) { console.error('tdpCarryItem: stub failed', e); }

    tdpCloseSheet();
    tdpRepaint();
    if (typeof showToast === 'function') showToast(`Moved to the plan starting ${tdpNiceDate(to.start_date)}`);
};

/* ── Comments ── a running log, not a description. Ten days is long enough
   that "day 3: waiting on the vendor" is worth keeping. */

window.tdpAddComment = async function (taskId, inputEl) {
    const text = (inputEl && inputEl.value || '').trim();
    if (!text) return;
    const t = tdpFindTask(taskId);
    if (!t) return;
    const list = tdpComments(t);
    list.push({ at: new Date().toISOString(), text });
    t.comments_json = JSON.stringify(list);
    if (inputEl) inputEl.value = '';
    await tdpSaveTask(t, { comments_json: t.comments_json });
    tdpPaintDetail(taskId);
    tdpRepaint();
};

window.tdpDeleteComment = async function (taskId, idx) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    const list = tdpComments(t);
    list.splice(idx, 1);
    t.comments_json = JSON.stringify(list);
    await tdpSaveTask(t, { comments_json: t.comments_json });
    tdpPaintDetail(taskId);
    tdpRepaint();
};

/* ── Vision link ── tasks already carry vision_id, so an item can point at a
   goal without a new column. Deliberately a read-out, not a writer: habits
   already drive vision progress, and two systems writing one number is how a
   number stops meaning anything. The goal shows how much of it this block
   carried; it doesn't overwrite the goal's own figure. */

window.tdpSetVision = async function (taskId, visionId) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    const was = t.vision_id;
    t.vision_id = visionId || null;
    await tdpSaveTask(t, { vision_id: t.vision_id });
    if (was && typeof window.tdpRecountVision === 'function') window.tdpRecountVision(was);
    if (t.vision_id && typeof window.tdpRecountVision === 'function') window.tdpRecountVision(t.vision_id);
    tdpPaintDetail(taskId);
    tdpRepaint();
};

// How this plan is feeding one goal — read by the detail sheet and Vision.
window.tdpVisionContribution = function (visionId, planId) {
    const plan = planId ? tdpFindPlan(planId) : tdpActivePlan();
    if (!plan || !visionId) return { total: 0, done: 0 };
    const items = tdpTasksOf(plan).filter(t => String(t.vision_id || '') === String(visionId));
    return { total: items.length, done: items.filter(tdpTaskDone).length };
};

window.tdpRecountVision = function (visionId) {
    // Nothing to write — the figure is derived. Kept as a hook so callers read
    // naturally and a future change has one obvious place to live.
    return window.tdpVisionContribution(visionId);
};

/* ── Retro ── */

window.tdpSaveRetro = async function (planId, text) {
    const plan = tdpFindPlan(planId);
    if (!plan) return;
    plan.retro = String(text || '');
    await tdpSavePlan(plan);
    if (typeof showToast === 'function') showToast('Saved');
};

window.tdpUpdateStart = async function (val) {
    const plan = tdpViewedPlan();
    if (!plan || !val) return;
    plan.start_date = val;
    plan.end_date = tdpPlusDays(val, 9);
    await tdpSavePlan(plan);
    tdpRepaint();
    if (typeof showToast === 'function') showToast('Start date updated');
};

window.tdpCreatePlan = async function () {
    const start = document.getElementById('tdpNewStart')?.value || tdpLocalDateStr();
    const today = tdpLocalDateStr();
    const startsLater = start > today;

    // A plan dated ahead is queued, not swapped in: the one running now keeps
    // running until its ten days are up. Only a plan starting today (or earlier)
    // takes over, and that's the only case that archives what it replaces.
    if (!startsLater) {
        for (const p of tdpPlans()) {
            if (p.status === 'active') { p.status = 'archived'; await tdpSavePlan(p); }
        }
    }

    const cats = {};
    tdpCategoriesFor(null).forEach(c => { cats[c] = []; });
    const plan = {
        start_date: start,
        end_date: tdpPlusDays(start, 9),
        status: startsLater ? 'upcoming' : 'active',
        categories_json: JSON.stringify(cats),
        created_at: new Date().toISOString()
    };
    try {
        const res = await apiPost('vision_tdp', plan);
        plan.id = (res && (res.id || (res.data && res.data.id))) || ('tdp-' + Date.now());
    } catch (e) {
        console.error('tdpCreatePlan failed:', e);
        plan.id = 'tdp-' + Date.now();
    }
    if (!Array.isArray(state.data.vision_tdp)) state.data.vision_tdp = [];
    state.data.vision_tdp.push(plan);
    tdpViewId = plan.id;
    tdpCloseSheet();
    renderTDP();
    if (typeof showToast === 'function') {
        showToast(startsLater
            ? `Lined up for ${tdpNiceDate(start)}`
            : 'New 10 days plan started');
    }
};

// Roll the timeline forward on each visit: a plan whose ten days are up
// archives itself, and one you queued takes over the day it starts. Doing it
// here rather than on a timer means it's right whenever you actually look,
// including after the app has been shut for a week.
async function tdpRollOver() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let ended = null, started = null;

    for (const p of tdpPlans()) {
        if (p.status === 'active' && tdpParseLocal(p.end_date) < today) {
            p.status = 'archived';
            await tdpSavePlan(p);
            ended = p;
        }
    }
    // Only one can be running; if several came due, the earliest wins and the
    // rest stay queued behind it.
    if (!tdpActivePlan()) {
        const due = tdpTimeline().filter(p =>
            p.status === 'upcoming' && tdpParseLocal(p.start_date) <= today && tdpParseLocal(p.end_date) >= today);
        if (due.length) {
            due[0].status = 'active';
            await tdpSavePlan(due[0]);
            started = due[0];
        }
    }
    // A queued plan whose window passed entirely without ever starting is just
    // history now.
    for (const p of tdpPlans()) {
        if (p.status === 'upcoming' && tdpParseLocal(p.end_date) < today) {
            p.status = 'archived';
            await tdpSavePlan(p);
        }
    }

    if (typeof showToast === 'function') {
        if (started) showToast('Your next 10 days plan has begun');
        else if (ended) showToast('Your last 10 days plan has ended');
    }
}

/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */

function tdpCSS() {
    return `<style>
    .tdp-wrap { max-width: 1120px; margin: 0 auto; padding-bottom: 40px; }

    .tdp-bar {
        display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
        padding: 18px 22px; margin-bottom: 18px;
        border: 1px solid var(--border-color); border-radius: 18px;
        background: var(--surface-1); box-shadow: var(--shadow-card);
    }
    .tdp-bar--away { border-style: dashed; }
    .tdp-nav { display: flex; gap: 4px; flex: none; }
    .tdp-arrow {
        width: 32px; height: 32px; border: 1px solid var(--border-color); border-radius: 9px;
        background: var(--surface-1); color: var(--text-2); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .tdp-arrow:hover:not(:disabled) { background: var(--primary-soft); color: var(--primary); border-color: var(--primary); }
    .tdp-arrow:disabled { opacity: .3; cursor: default; }

    .tdp-banner {
        display: block; padding: 10px 14px; margin-bottom: 14px;
        border-radius: 12px; font-size: 12.5px; font-weight: 700; line-height: 1.5;
    }
    .tdp-banner.past { background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border-color); }
    .tdp-banner.next { background: var(--primary-soft); color: var(--primary); }

    .tdp-item .tdp-text { cursor: pointer; }
    .tdp-item.locked .tdp-text { cursor: default; }
    .tdp-text em { font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .03em;
        padding: 1px 5px; border-radius: 5px; margin-left: 5px; vertical-align: 1px;
        display: inline-flex; align-items: center; gap: 3px; }
    .tdp-text em.in { background: var(--surface-3); color: var(--text-3); text-transform: uppercase; }
    .tdp-text em.vis { background: transparent; color: var(--warning, #F59E0B); padding: 0; }
    .tdp-text em.note { background: var(--surface-3); color: var(--text-3); }
    .tdp-item.carried { opacity: .55; }
    .tdp-item.carried .tdp-text { text-decoration: line-through; cursor: default; }
    .tdp-item.carried .tdp-text em { text-decoration: none; }
    .tdp-box.ghost { border-style: dashed; cursor: default; color: var(--text-3); }
    .tdp-more { flex: none; border: none; background: none; color: var(--text-3); cursor: pointer;
        padding: 4px; opacity: 0; transition: opacity .15s ease, color .15s ease; }
    .tdp-item:hover .tdp-more { opacity: 1; }
    .tdp-more:hover { color: var(--primary); }

    .tdp-retro { margin: 0 0 16px; padding: 14px 16px; border: 1px solid var(--border-color);
        border-radius: 16px; background: var(--surface-1); }
    .tdp-retro label { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .06em;
        text-transform: uppercase; color: var(--text-3); margin-bottom: 7px; }
    .tdp-retro textarea {
        width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px;
        border: 1px solid var(--border-color) !important; border-radius: 12px !important;
        background: var(--surface-2) !important; color: var(--text-1);
        font-family: inherit; font-size: 13.5px !important; font-weight: 500; line-height: 1.55;
        padding: 10px 12px !important;
    }
    .tdp-retro textarea:focus { border-color: var(--primary) !important; box-shadow: none !important; outline: none; }

    .tdp-comments { display: flex; flex-direction: column; gap: 7px; max-height: 240px; overflow-y: auto; }
    .tdp-comment { display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px;
        border-radius: 11px; background: var(--surface-2); }
    .tdp-comment > div { flex: 1; min-width: 0; }
    .tdp-comment b { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .04em;
        text-transform: uppercase; color: var(--text-3); margin-bottom: 3px; }
    .tdp-comment p { margin: 0; font-size: 13.5px; font-weight: 500; color: var(--text-1);
        line-height: 1.5; overflow-wrap: anywhere; }
    .tdp-comment button { flex: none; border: none; background: none; color: var(--text-3);
        cursor: pointer; padding: 2px; }
    .tdp-comment button:hover { color: var(--danger, #EF4444); }

    .tdp-detail-acts { display: flex; gap: 8px; margin-top: 4px; }
    .tdp-detail-acts .tdp-btn { flex: 1; justify-content: center; }
    .tdp-btn.danger:hover { color: var(--danger, #EF4444); border-color: var(--danger, #EF4444); background: transparent; }
    .tdp-btn:disabled { opacity: .45; cursor: default; }

    .tdp-arch-bar { height: 5px; border-radius: 99px; background: var(--surface-3);
        overflow: hidden; margin: 6px 0 5px; }
    .tdp-arch-bar i { display: block; height: 100%; border-radius: 99px; }

    .tdp-card.locked .tdp-box { cursor: default; }
    .tdp-card.locked .tdp-item:hover { background: transparent; }

    .tdp-bar-day { display: flex; flex-direction: column; gap: 2px; flex: none; }
    .tdp-bar-day b { font-size: 24px; font-weight: 850; color: var(--text-1); line-height: 1; font-variant-numeric: tabular-nums; }
    .tdp-bar-day span { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
    .tdp-bar-range { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: var(--text-2); flex: none; }
    .tdp-bar-range button { border: none; background: none; color: var(--text-3); cursor: pointer; padding: 3px; display: inline-flex; }
    .tdp-bar-range button:hover { color: var(--primary); }
    .tdp-bar-prog { flex: 1; min-width: 190px; display: flex; flex-direction: column; gap: 6px; }
    .tdp-bar-meta { display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-3); }
    .tdp-bar-meta b { color: var(--text-1); }
    .tdp-track { height: 7px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
    .tdp-track i { display: block; height: 100%; border-radius: 99px; background: var(--primary); transition: width .3s ease; }
    .tdp-track.hit i { background: var(--success, #10B981); }
    .tdp-bar-acts { display: flex; gap: 8px; flex: none; }
    .tdp-btn {
        display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 15px;
        border: 1px solid var(--border-color); border-radius: 11px; background: var(--surface-1);
        color: var(--text-2); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
        transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .tdp-btn:hover { background: var(--surface-2); color: var(--text-1); border-color: var(--border-strong, var(--border-color)); }
    .tdp-btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
    .tdp-btn.primary:hover { filter: brightness(1.07); background: var(--primary); color: #fff; }

    .tdp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 980px) { .tdp-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 620px) { .tdp-grid { grid-template-columns: 1fr; } }

    .tdp-card {
        display: flex; flex-direction: column; padding: 16px 16px 14px;
        border: 1px solid var(--border-color); border-radius: 18px;
        background: var(--surface-1); box-shadow: var(--shadow-card);
    }
    .tdp-card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 11px; }
    .tdp-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
    .tdp-card-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 800; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tdp-count { font-size: 11px; font-weight: 800; color: var(--text-3); font-variant-numeric: tabular-nums; flex: none; }

    .tdp-items { display: flex; flex-direction: column; gap: 2px; margin-bottom: 9px; }
    .tdp-item { display: flex; align-items: center; gap: 9px; padding: 7px 4px; border-radius: 9px; }
    .tdp-item:hover { background: var(--surface-2); }
    .tdp-item:hover .tdp-del { opacity: 1; }
    .tdp-box {
        width: 18px; height: 18px; flex: none; border-radius: 6px; cursor: pointer;
        border: 1.8px solid var(--border-strong, #cbd5e1); background: var(--surface-1);
        display: flex; align-items: center; justify-content: center; color: transparent;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
    }
    .tdp-item.done .tdp-box { background: var(--primary); border-color: var(--primary); color: #fff; }
    .tdp-text { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--text-1); line-height: 1.35; overflow-wrap: anywhere; }
    .tdp-item.done .tdp-text { color: var(--text-3); text-decoration: line-through; }
    .tdp-del { flex: none; border: none; background: none; color: var(--text-3); cursor: pointer; padding: 4px; opacity: 0; transition: opacity .15s ease, color .15s ease; }
    .tdp-del:hover { color: var(--danger, #EF4444); }
    .tdp-empty { font-size: 12.5px; color: var(--text-3); font-weight: 600; padding: 8px 4px 10px; }

    .tdp-add { display: flex; gap: 7px; margin-top: auto; }
    .tdp-add input {
        flex: 1; min-width: 0; height: 36px;
        border: 1px dashed var(--border-strong, #cbd5e1) !important; border-radius: 10px !important;
        background: transparent !important; color: var(--text-1);
        font-family: inherit; font-size: 13px !important; font-weight: 600; padding: 0 11px !important;
        box-sizing: border-box;
    }
    .tdp-add input:focus { border-style: solid !important; border-color: var(--primary) !important; box-shadow: none !important; outline: none; }
    .tdp-add button {
        width: 36px; height: 36px; flex: none; border: 1px solid var(--border-color); border-radius: 10px;
        background: var(--surface-2); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .tdp-add button:hover { background: var(--primary); border-color: var(--primary); color: #fff; }

    .tdp-blank { text-align: center; padding: 64px 20px; border: 1px solid var(--border-color); border-radius: 20px; background: var(--surface-1); }
    .tdp-blank h3 { margin: 0 0 7px; font-size: 19px; font-weight: 800; color: var(--text-1); }
    .tdp-blank p { margin: 0 auto 22px; max-width: 420px; font-size: 13.5px; color: var(--text-3); font-weight: 600; line-height: 1.6; }

    .tdp-sheet { position: fixed; inset: 0; z-index: 200; background: rgba(15,23,42,.45); backdrop-filter: blur(2px); display: flex; align-items: flex-end; justify-content: center; }
    .tdp-sheet.hidden { display: none; }
    .tdp-sheet-inner { width: 100%; max-width: 520px; max-height: 80vh; display: flex; flex-direction: column; background: var(--surface-1); border-radius: 22px 22px 0 0; box-shadow: 0 -12px 40px rgba(15,23,42,.22); }
    @media (min-width: 640px) { .tdp-sheet { align-items: center; } .tdp-sheet-inner { border-radius: 22px; max-height: 72vh; } }
    .tdp-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border-color); }
    .tdp-sheet-head h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--text-1); }
    .tdp-sheet-head p { margin: 3px 0 0; font-size: 12px; color: var(--text-3); font-weight: 600; }
    .tdp-sheet-close { width: 32px; height: 32px; flex: none; border: 1px solid var(--border-color); border-radius: 10px; background: var(--surface-2); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .tdp-sheet-body { overflow-y: auto; padding: 16px 20px 22px; }
    .tdp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .tdp-field > span { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
    .tdp-field input[type="date"] {
        height: 42px; border: 1px solid var(--border-color) !important; border-radius: 12px !important;
        background: var(--surface-2) !important; color: var(--text-1);
        font-family: inherit; font-size: 14px !important; font-weight: 600; padding: 0 12px !important; box-sizing: border-box;
    }
    .tdp-note { font-size: 12.5px; color: var(--text-3); font-weight: 600; line-height: 1.55; margin: 0 0 18px; }
    .tdp-note b { color: var(--text-1); }
    .tdp-arch {
        display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
        padding: 13px 14px; border: 1px solid var(--border-color); border-radius: 13px;
        margin-bottom: 9px; background: var(--surface-1); font-family: inherit; cursor: pointer;
        transition: border-color .15s ease, background .15s ease;
    }
    .tdp-arch:hover { border-color: var(--primary); background: var(--primary-soft); }
    .tdp-arch.here { border-color: var(--primary); }
    .tdp-arch em { font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .05em;
        text-transform: uppercase; padding: 2px 6px; border-radius: 6px; margin-left: 6px; vertical-align: 1px; }
    .tdp-arch em.now { background: var(--primary); color: #fff; }
    .tdp-arch em.next { background: var(--surface-3); color: var(--text-2); }
    .tdp-arch-main { flex: 1; min-width: 0; }
    .tdp-arch-main b { display: block; font-size: 13.5px; font-weight: 800; color: var(--text-1); }
    .tdp-arch-main span { font-size: 12px; color: var(--text-3); font-weight: 600; }
    .tdp-arch-pct { font-size: 15px; font-weight: 850; color: var(--text-2); font-variant-numeric: tabular-nums; }
    </style>`;
}

// One stable colour per category name, so the same category reads the same on
// every card without anyone having to pick colours.
const TDP_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#A855F7', '#EF4444', '#14B8A6'];
function tdpColor(name) {
    let h = 0;
    for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
    return TDP_PALETTE[h % TDP_PALETTE.length];
}

// `locked` is a finished plan: you can read it, not rewrite it. Ten days that
// already happened aren't a to-do list any more, and quietly letting a stray
// click change last month's score would make the history worth nothing.
function tdpCardHTML(plan, cat, locked) {
    const items = tdpTasksOf(plan, cat);
    const live = items.filter(t => t.status !== 'cancelled');
    const done = live.filter(tdpTaskDone).length;

    const rows = items.map(t => {
        const carriedAway = t.status === 'cancelled' && String(t.tdp_carried_from || '').startsWith('to:');
        if (carriedAway) {
            const to = tdpFindPlan(String(t.tdp_carried_from).slice(3));
            return `<div class="tdp-item carried" title="Moved to a later plan">
                <div class="tdp-box ghost">${TDP_ICON.forward}</div>
                <div class="tdp-text">${tdpEscape(t.title || '')}
                    <em>carried${to ? ' to ' + tdpNiceDate(to.start_date) : ''}</em></div>
            </div>`;
        }
        const carriedIn = String(t.tdp_carried_from || '').startsWith('from:');
        const notes = tdpComments(t).length;
        return `
        <div class="tdp-item ${tdpTaskDone(t) ? 'done' : ''} ${locked ? 'locked' : ''}">
            <div class="tdp-box" ${locked ? '' : `onclick="tdpToggleItem('${tdpEscape(t.id)}')"`}
                 title="${locked ? '' : (tdpTaskDone(t) ? 'Mark as not done' : 'Mark done')}">${TDP_ICON.check}</div>
            <div class="tdp-text" onclick="tdpOpenDetail('${tdpEscape(t.id)}')">${tdpEscape(t.title || '')}
                ${carriedIn ? '<em class="in">carried over</em>' : ''}
                ${t.vision_id ? `<em class="vis">${TDP_ICON.star}</em>` : ''}
                ${notes ? `<em class="note">${TDP_ICON.comment}${notes}</em>` : ''}
            </div>
            <button class="tdp-more" onclick="tdpOpenDetail('${tdpEscape(t.id)}')" title="Comments, vision goal, move">${TDP_ICON.more}</button>
        </div>`;
    }).join('');

    return `
    <div class="tdp-card ${locked ? 'locked' : ''}" id="tdpCard_${tdpEscape(cat)}">
        <div class="tdp-card-head">
            <span class="tdp-dot" style="background:${tdpColor(cat)}"></span>
            <span class="tdp-card-name">${tdpEscape(cat)}</span>
            <span class="tdp-count">${done}/${live.length}</span>
        </div>
        <div class="tdp-items">${rows || `<div class="tdp-empty">Nothing here for these ten days.</div>`}</div>
        ${locked ? '' : `<div class="tdp-add">
            <input type="text" maxlength="200" placeholder="Add to ${tdpEscape(cat)}…"
                   onkeydown="if(event.key==='Enter'){event.preventDefault(); tdpAddItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', this);}" />
            <button onclick="tdpAddItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', this.previousElementSibling)" title="Add">${TDP_ICON.plus}</button>
        </div>`}
    </div>`;
}

/* ── One item, opened up: its comments, the goal it serves, where it can go ── */

let tdpDetailId = null;

window.tdpOpenDetail = function (taskId) {
    const t = tdpFindTask(taskId);
    if (!t) return;
    tdpDetailId = taskId;
    const modal = tdpSheet();
    if (!modal) return;
    document.getElementById('tdpSheetTitle').textContent = t.title || 'Item';
    document.getElementById('tdpSheetSub').textContent =
        `${t.category || 'No category'} · due ${tdpNiceDate(t.due_date)}`;
    tdpPaintDetail(taskId);
    modal.classList.remove('hidden');
};

function tdpPaintDetail(taskId) {
    if (String(tdpDetailId) !== String(taskId)) return;
    const body = document.getElementById('tdpSheetBody');
    const t = tdpFindTask(taskId);
    if (!body || !t) return;

    const goals = (state.data.vision || []).filter(v => v.status !== 'achieved');
    const contribution = t.vision_id ? window.tdpVisionContribution(t.vision_id, t.tdp_plan_id) : null;
    const comments = tdpComments(t);
    const to = tdpNextPlanFor(tdpFindPlan(t.tdp_plan_id));

    body.innerHTML = `
        <div class="tdp-field">
            <span>Works toward</span>
            <select onchange="tdpSetVision('${tdpEscape(t.id)}', this.value)">
                <option value="">Nothing in particular</option>
                ${goals.map(v => `<option value="${tdpEscape(v.id)}" ${String(t.vision_id || '') === String(v.id) ? 'selected' : ''}>${tdpEscape(v.title || 'Goal')}</option>`).join('')}
            </select>
            ${contribution && contribution.total
                ? `<p class="tdp-note" style="margin:2px 0 0">This block carries <b>${contribution.done} of ${contribution.total}</b> items toward it.</p>` : ''}
        </div>

        <div class="tdp-field">
            <span>Comments</span>
            <div class="tdp-comments">
                ${comments.length ? comments.map((c, i) => `
                    <div class="tdp-comment">
                        <div>
                            <b>${tdpNiceDateTime(c.at)}</b>
                            <p>${tdpEscape(c.text)}</p>
                        </div>
                        <button onclick="tdpDeleteComment('${tdpEscape(t.id)}', ${i})" title="Remove">${TDP_ICON.trash}</button>
                    </div>`).join('')
                : '<p class="tdp-note" style="margin:0">Nothing noted yet.</p>'}
            </div>
            <div class="tdp-add" style="margin-top:8px">
                <input type="text" maxlength="500" placeholder="What's happening with this…"
                       onkeydown="if(event.key==='Enter'){event.preventDefault(); tdpAddComment('${tdpEscape(t.id)}', this);}" />
                <button onclick="tdpAddComment('${tdpEscape(t.id)}', this.previousElementSibling)" title="Add">${TDP_ICON.plus}</button>
            </div>
        </div>

        <div class="tdp-detail-acts">
            <button class="tdp-btn" onclick="tdpCarryItem('${tdpEscape(t.id)}')" ${to ? '' : 'disabled'}
                    title="${to ? 'Move to the plan starting ' + tdpNiceDate(to.start_date) : 'Make a later plan first'}">
                ${TDP_ICON.forward} ${to ? 'Move to next plan' : 'No later plan'}
            </button>
            <button class="tdp-btn danger" onclick="tdpDeleteItem('${tdpEscape(t.id)}')">${TDP_ICON.trash} Delete</button>
        </div>`;
}

function tdpNiceDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function tdpPageHTML() {
    const plan = tdpViewedPlan();

    const sheets = `
    <div class="tdp-sheet hidden" id="tdpSheet" onclick="if(event.target.id==='tdpSheet') tdpCloseSheet()">
        <div class="tdp-sheet-inner">
            <div class="tdp-sheet-head">
                <div><h3 id="tdpSheetTitle">New plan</h3><p id="tdpSheetSub"></p></div>
                <button class="tdp-sheet-close" onclick="tdpCloseSheet()">${TDP_ICON.close}</button>
            </div>
            <div class="tdp-sheet-body" id="tdpSheetBody"></div>
        </div>
    </div>`;

    if (!plan) {
        return tdpCSS() + `
        <div class="tdp-wrap">
            <div class="tdp-blank">
                <h3>No plan running</h3>
                <p>Ten days is long enough to shift something and short enough to still see the end of it. Pick a handful of things per category and go.</p>
                <button class="tdp-btn primary" onclick="tdpOpenCreate()">${TDP_ICON.plus} Start a 10 days plan</button>
                <button class="tdp-btn" onclick="tdpOpenArchive()" style="margin-left:8px">${TDP_ICON.archive} Past plans</button>
            </div>
        </div>` + sheets;
    }

    const info = tdpDayInfo(plan);
    const prog = tdpProgress(plan);
    const cats = tdpCategoriesFor(plan);
    const phase = tdpPhase(plan);
    const { prev, next } = tdpNeighbours(plan);
    const active = tdpActivePlan();
    const away = active && String(active.id) !== String(plan.id);

    // The headline says where you are without you having to work it out from
    // dates: a day count while it's running, a countdown before it starts, and
    // the score once it's over.
    let headline, subline;
    if (phase === 'current') {
        headline = `Day ${info.day}`;
        subline = `of 10 · ${info.remaining} left`;
    } else if (phase === 'upcoming') {
        const days = Math.max(0, Math.ceil((tdpParseLocal(plan.start_date) - new Date().setHours(0, 0, 0, 0)) / 86400000));
        headline = 'Next';
        subline = days === 0 ? 'starts today' : `starts in ${days} day${days === 1 ? '' : 's'}`;
    } else {
        headline = 'Done';
        subline = `${prog.done} of ${prog.total} finished`;
    }

    return tdpCSS() + `
    <div class="tdp-wrap">
        <div class="tdp-bar ${phase !== 'current' ? 'tdp-bar--away' : ''}">
            <div class="tdp-nav">
                <button class="tdp-arrow" ${prev ? '' : 'disabled'} onclick="tdpStep(-1)"
                        title="${prev ? 'Previous plan · ' + tdpNiceDate(prev.start_date) : 'Nothing before this'}">${TDP_ICON.left}</button>
                <button class="tdp-arrow" ${next ? '' : 'disabled'} onclick="tdpStep(1)"
                        title="${next ? 'Next plan · ' + tdpNiceDate(next.start_date) : 'Nothing after this'}">${TDP_ICON.right}</button>
            </div>
            <div class="tdp-bar-day">
                <b>${headline}</b>
                <span>${subline}</span>
            </div>
            <div class="tdp-bar-range">
                ${tdpNiceDate(plan.start_date)} – ${tdpNiceDate(plan.end_date)}
                <button onclick="tdpPickStart()" title="Change the start date">${TDP_ICON.edit}</button>
                <input type="date" id="tdpStartEdit" value="${tdpEscape(plan.start_date)}"
                       onchange="tdpUpdateStart(this.value)"
                       style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" />
            </div>
            <div class="tdp-bar-prog">
                <div class="tdp-bar-meta">
                    <span><b>${prog.done}</b> of <b>${prog.total}</b> done</span>
                    <span>${prog.pct}%</span>
                </div>
                <div class="tdp-track ${prog.pct >= 100 ? 'hit' : ''}"><i style="width:${prog.pct}%"></i></div>
            </div>
            <div class="tdp-bar-acts">
                ${away ? `<button class="tdp-btn" onclick="tdpGoToPlan('${tdpEscape(active.id)}')">${TDP_ICON.today} Back to now</button>`
                       : `<button class="tdp-btn" onclick="routeTo('timeTracker')" title="These items show up on the matching stopwatch card">${TDP_ICON.clock} Time spent on</button>`}
                <button class="tdp-btn" onclick="tdpOpenArchive()">${TDP_ICON.archive} All plans</button>
                <button class="tdp-btn primary" onclick="tdpOpenCreate()">${TDP_ICON.plus} New plan</button>
            </div>
        </div>

        ${phase === 'past' ? `<div class="tdp-banner past">Looking at a finished plan — ${tdpNiceDate(plan.start_date)} to ${tdpNiceDate(plan.end_date)}. The list is read-only; the retro below isn't.</div>` : ''}
        ${phase !== 'upcoming' ? `
        <div class="tdp-retro">
            <label for="tdpRetro">What worked, what didn't</label>
            <textarea id="tdpRetro" rows="3" placeholder="Worth two lines while it's fresh — what moved, what stalled, what you'd do differently."
                      onblur="tdpSaveRetro('${tdpEscape(plan.id)}', this.value)">${tdpEscape(plan.retro || '')}</textarea>
        </div>` : ''}
        ${phase === 'upcoming' ? `<div class="tdp-banner next">Looking ahead — this one starts ${tdpNiceDate(plan.start_date)}. Write it now; it takes over once the plan before it finishes.</div>` : ''}

        <div class="tdp-grid" id="tdpGrid">
            ${cats.map(cat => tdpCardHTML(plan, cat, phase === 'past')).join('')}
        </div>
    </div>` + sheets;
}

// Repaint in place. With a category given, only that card is rebuilt, so adding
// an item doesn't blur the box you're still typing in elsewhere.
function tdpRepaint(onlyCat) {
    const plan = tdpViewedPlan();
    if (!plan) { renderTDP(); return; }

    if (onlyCat) {
        const card = document.getElementById('tdpCard_' + onlyCat);
        if (card) {
            const input = card.querySelector('.tdp-add input');
            const hadFocus = document.activeElement === input;
            card.outerHTML = tdpCardHTML(plan, onlyCat, tdpPhase(plan) === 'past');
            if (hadFocus) document.getElementById('tdpCard_' + onlyCat)?.querySelector('.tdp-add input')?.focus();
        }
    } else {
        const grid = document.getElementById('tdpGrid');
        if (grid) grid.innerHTML = tdpCategoriesFor(plan).map(c => tdpCardHTML(plan, c, tdpPhase(plan) === 'past')).join('');
    }

    // The header numbers move with every tick, whichever card it came from.
    const prog = tdpProgress(plan);
    const meta = document.querySelector('.tdp-bar-meta');
    if (meta) meta.innerHTML = `<span><b>${prog.done}</b> of <b>${prog.total}</b> done</span><span>${prog.pct}%</span>`;
    const track = document.querySelector('.tdp-track');
    if (track) {
        track.classList.toggle('hit', prog.pct >= 100);
        const fill = track.querySelector('i');
        if (fill) fill.style.width = prog.pct + '%';
    }
}
window.tdpRepaint = tdpRepaint;

window.tdpPickStart = function () {
    const el = document.getElementById('tdpStartEdit');
    if (!el) return;
    if (el.showPicker) el.showPicker(); else el.focus();
};

/* ── Sheets ── */

function tdpSheet() {
    const modal = document.getElementById('tdpSheet');
    // #main carries the page-transition transform, which makes it the containing
    // block for position:fixed — the sheet has to sit on <body> to cover the page.
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
    return modal;
}

window.tdpCloseSheet = function () {
    document.getElementById('tdpSheet')?.classList.add('hidden');
    tdpDetailId = null;
};

window.tdpOpenCreate = function () {
    const modal = tdpSheet();
    if (!modal) return;
    const active = tdpActivePlan();
    const today = tdpLocalDateStr();
    document.getElementById('tdpSheetTitle').textContent = 'New 10 days plan';
    document.getElementById('tdpSheetSub').textContent = active ? 'This archives the one running now' : 'Pick a start date';
    document.getElementById('tdpSheetBody').innerHTML = `
        <div class="tdp-field">
            <span>Starts</span>
            <input type="date" id="tdpNewStart" value="${today}" onchange="tdpPreviewEnd()" />
        </div>
        <p class="tdp-note" id="tdpNewPreview">Runs through <b>${tdpNiceDate(tdpPlusDays(today, 9))}</b>. Categories come from the same list Tasks, Habits and Time Spent On use, so anything you put here lands on the matching stopwatch card.</p>
        <button class="tdp-btn primary" style="width:100%;height:44px;justify-content:center" onclick="tdpCreatePlan()">Start the plan</button>`;
    modal.classList.remove('hidden');
};

window.tdpPreviewEnd = function () {
    const val = document.getElementById('tdpNewStart')?.value;
    const el = document.getElementById('tdpNewPreview');
    if (!val || !el) return;
    el.innerHTML = `Runs through <b>${tdpNiceDate(tdpPlusDays(val, 9))}</b>. Categories come from the same list Tasks, Habits and Time Spent On use, so anything you put here lands on the matching stopwatch card.`;
};

// Every plan, newest first, as a jump list — the arrows are for stepping one at
// a time, this is for when you know roughly when something was.
window.tdpOpenArchive = function () {
    const modal = tdpSheet();
    if (!modal) return;
    const all = tdpTimeline().reverse();
    const viewing = tdpViewedPlan();

    document.getElementById('tdpSheetTitle').textContent = 'All plans';
    document.getElementById('tdpSheetSub').textContent =
        all.length ? `${all.length} plan${all.length === 1 ? '' : 's'}` : '';
    // Only plans that have actually run: a queued one is all zeros by definition
    // and would drag the average down for no reason.
    const scored = all.filter(p => tdpPhase(p) !== 'upcoming' && tdpProgress(p).total);
    const avg = scored.length
        ? Math.round(scored.reduce((n, p) => n + tdpProgress(p).pct, 0) / scored.length) : 0;
    const trend = scored.length >= 4
        ? (() => {
            const half = Math.floor(scored.length / 2);
            const recent = scored.slice(0, half), older = scored.slice(half);
            const m = xs => Math.round(xs.reduce((n, p) => n + tdpProgress(p).pct, 0) / xs.length);
            const d = m(recent) - m(older);
            return d >= 8 ? `up ${d} points on your earlier ones`
                 : d <= -8 ? `down ${Math.abs(d)} points on your earlier ones`
                 : 'about level with your earlier ones';
        })() : '';

    document.getElementById('tdpSheetBody').innerHTML = (all.length
        ? (scored.length ? `<p class="tdp-note"><b>${avg}%</b> average across ${scored.length} plan${scored.length === 1 ? '' : 's'}${trend ? ' — ' + trend : ''}.</p>` : '')
        : '') + (all.length
        ? all.map(p => {
            const pr = tdpProgress(p);
            const ph = tdpPhase(p);
            const tag = ph === 'current' ? '<em class="now">Running</em>'
                : ph === 'upcoming' ? '<em class="next">Lined up</em>' : '';
            const here = viewing && String(viewing.id) === String(p.id);
            return `<button class="tdp-arch ${here ? 'here' : ''}" onclick="tdpGoToPlan('${tdpEscape(p.id)}')">
                <div class="tdp-arch-main">
                    <b>${tdpNiceDate(p.start_date)} – ${tdpNiceDate(p.end_date)} ${tag}</b>
                    <div class="tdp-arch-bar"><i style="width:${pr.pct}%;background:${pr.pct >= 70 ? 'var(--success,#10B981)' : pr.pct >= 40 ? 'var(--primary)' : 'var(--warning,#F59E0B)'}"></i></div>
                    <span>${pr.total ? `${pr.done} of ${pr.total} done` : 'nothing written down'}${p.retro ? ' · has a retro' : ''}</span>
                </div>
                <span class="tdp-arch-pct">${pr.total ? pr.pct + '%' : '—'}</span>
            </button>`;
        }).join('')
        : '<p class="tdp-note">No plans yet.</p>');
    modal.classList.remove('hidden');
};

/* ═══════════════════════════════════════════════════════
   ENTRY
═══════════════════════════════════════════════════════ */

async function renderTDP() {
    const main = document.getElementById('main');
    // Drop a sheet hoisted onto <body> last visit, so ids stay unique.
    const stale = document.getElementById('tdpSheet');
    if (stale && stale.parentElement === document.body) stale.remove();

    main.innerHTML = `<div class="tdp-wrap" style="padding:60px 20px;text-align:center;color:var(--text-3);font-size:13.5px">Loading your plan…</div>`;

    if (!Array.isArray(state.data.vision_tdp) || !state.data.vision_tdp.length) {
        try { state.data.vision_tdp = await apiGet('vision_tdp') || []; }
        catch (e) { console.error('renderTDP: load failed', e); state.data.vision_tdp = state.data.vision_tdp || []; }
    }
    // Items are tasks now, so the page needs them.
    if (!Array.isArray(state.data.tasks) || !state.data.tasks.length) {
        try { state.data.tasks = await apiGet('tasks') || []; }
        catch (e) { console.error('renderTDP: tasks load failed', e); state.data.tasks = state.data.tasks || []; }
    }
    await tdpRollOver();

    // One-off: lift any plan still holding its items in the old blob.
    for (const plan of tdpPlans()) {
        if (Object.keys(tdpCats(plan)).length) {
            main.innerHTML = `<div class="tdp-wrap" style="padding:60px 20px;text-align:center;color:var(--text-3);font-size:13.5px">Moving your plan items into Tasks…</div>`;
            await tdpConvertPlan(plan);
        }
    }

    main.innerHTML = tdpPageHTML();
}

window.renderTDP = renderTDP;
