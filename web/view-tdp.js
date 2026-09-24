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

function tdpFindPlan(id) {
    return tdpPlans().find(p => String(p.id) === String(id)) || null;
}

function tdpCats(plan) {
    if (!plan || !plan.categories_json) return {};
    try {
        return typeof plan.categories_json === 'string'
            ? JSON.parse(plan.categories_json) : (plan.categories_json || {});
    } catch (e) { return {}; }
}

// The categories you curate in the Tasks category manager, plus any this plan
// already carries — so a plan written under the old fixed names keeps showing
// its items after the switch.
//
// Deliberately the CURATED list, not window.appCategories(): that one also
// includes any category still filed on some old task or habit, which is right
// for a filter or a picker (hiding it would strand those items) and wrong here.
// A planning page asks you to pick focus areas for ten days; it shouldn't hand
// you a card for a category you retired months ago because one task still
// mentions it.
function tdpCategoriesFor(plan) {
    let list = [];
    if (typeof window.appSavedCategories === 'function') {
        try { list = window.appSavedCategories().slice(); } catch (e) { list = []; }
    } else if (typeof window.appCategories === 'function') {
        try { list = window.appCategories().slice(); } catch (e) { list = []; }
    }
    if (!list.length) list = TDP_LEGACY_CATEGORIES.slice();
    // A plan's own categories always show, even ones no longer on the list —
    // otherwise items already typed into it would vanish.
    Object.keys(tdpCats(plan)).forEach(k => {
        if (!list.includes(k) && (tdpCats(plan)[k] || []).length) list.push(k);
    });
    return list;
}

function tdpProgress(plan) {
    const cats = tdpCats(plan);
    let total = 0, done = 0;
    Object.values(cats).forEach(items => (items || []).forEach(i => {
        total++; if (i && i.completed) done++;
    }));
    return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
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

// A stable handle for one item, so time logged against it survives a reorder.
// Items created from here carry their own id; older ones fall back to their slot.
function tdpItemId(plan, cat, idx) {
    const item = (tdpCats(plan)[cat] || [])[idx];
    if (item && item.id) return String(item.id);
    return `${plan.id}::${cat}::${idx}`;
}

// The inverse: find an item anywhere in the active plan from that handle.
function tdpFindItem(itemId) {
    const plan = tdpActivePlan();
    if (!plan || !itemId) return null;
    const cats = tdpCats(plan);
    for (const cat of Object.keys(cats)) {
        const items = cats[cat] || [];
        for (let i = 0; i < items.length; i++) {
            if (tdpItemId(plan, cat, i) === String(itemId)) {
                return { plan, cat, idx: i, item: items[i] };
            }
        }
    }
    return null;
}

// Open items in one category of the active plan, for the Time Spent On cards.
// Completed ones stay on, at the bottom, so ticking one doesn't yank the row out
// from under the cursor mid-session.
window.tdpItemsForCategory = function (category) {
    const plan = tdpActivePlan();
    if (!plan || !category) return [];
    const items = (tdpCats(plan)[category] || []).map((item, idx) => ({
        id: tdpItemId(plan, category, idx),
        text: item.text || '',
        completed: !!item.completed,
        minutes: Number(item.minutes) || 0
    }));
    return items.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
};

// Planned minutes for a TDP item, set from a stopwatch card — the TDP page
// itself stays a plain checklist, so this rides along in the same blob.
window.tdpSetItemMinutes = async function (itemId, minutes) {
    const found = tdpFindItem(itemId);
    if (!found) return false;
    const cats = tdpCats(found.plan);
    const mins = Math.max(0, Math.min(1440, parseInt(minutes, 10) || 0));
    if (mins) cats[found.cat][found.idx].minutes = mins;
    else delete cats[found.cat][found.idx].minutes;
    await tdpSavePlan(found.plan, cats);
    return true;
};

// Add an item to the active plan from elsewhere in the app.
window.tdpAddItemToCategory = async function (category, text) {
    const plan = tdpActivePlan();
    if (!plan || !category || !String(text || '').trim()) return null;
    const cats = tdpCats(plan);
    if (!Array.isArray(cats[category])) cats[category] = [];
    const item = {
        id: 'tdpi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: String(text).trim(), completed: false
    };
    cats[category].push(item);
    await tdpSavePlan(plan, cats);
    return item.id;
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

async function tdpSavePlan(plan, cats) {
    if (cats) plan.categories_json = JSON.stringify(cats);
    try {
        await apiPost('vision_tdp', plan);
    } catch (e) {
        console.error('tdpSavePlan failed:', e);
        if (typeof showToast === 'function') showToast('Could not save — check your connection');
    }
}

window.tdpToggleItem = async function (planId, cat, idx, silent) {
    const plan = tdpFindPlan(planId);
    if (!plan) return;
    const cats = tdpCats(plan);
    if (!cats[cat] || !cats[cat][idx]) return;
    cats[cat][idx].completed = !cats[cat][idx].completed;
    await tdpSavePlan(plan, cats);
    if (!silent) tdpRepaint();
};

// Ticking a TDP item from a stopwatch card, by the handle that card holds.
window.tdpToggleItemById = async function (itemId) {
    const found = tdpFindItem(itemId);
    if (!found) return false;
    const cats = tdpCats(found.plan);
    cats[found.cat][found.idx].completed = !cats[found.cat][found.idx].completed;
    await tdpSavePlan(found.plan, cats);
    return true;
};

window.tdpAddItem = async function (planId, cat, inputEl) {
    const text = (inputEl && inputEl.value || '').trim();
    if (!text) return;
    const plan = tdpFindPlan(planId);
    if (!plan) return;
    const cats = tdpCats(plan);
    if (!Array.isArray(cats[cat])) cats[cat] = [];
    cats[cat].push({
        id: 'tdpi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text, completed: false
    });
    if (inputEl) inputEl.value = '';
    await tdpSavePlan(plan, cats);
    tdpRepaint(cat);
};

window.tdpDeleteItem = async function (planId, cat, idx) {
    const plan = tdpFindPlan(planId);
    if (!plan) return;
    const cats = tdpCats(plan);
    if (!cats[cat]) return;
    cats[cat].splice(idx, 1);
    await tdpSavePlan(plan, cats);
    tdpRepaint();
};

window.tdpUpdateStart = async function (val) {
    const plan = tdpActivePlan();
    if (!plan || !val) return;
    plan.start_date = val;
    plan.end_date = tdpPlusDays(val, 9);
    await tdpSavePlan(plan);
    tdpRepaint();
    if (typeof showToast === 'function') showToast('Start date updated');
};

window.tdpCreatePlan = async function () {
    const start = document.getElementById('tdpNewStart')?.value || tdpLocalDateStr();
    for (const p of tdpPlans()) {
        if (p.status === 'active') { p.status = 'archived'; await tdpSavePlan(p); }
    }
    const cats = {};
    tdpCategoriesFor(null).forEach(c => { cats[c] = []; });
    const plan = {
        start_date: start,
        end_date: tdpPlusDays(start, 9),
        status: 'active',
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
    tdpCloseSheet();
    renderTDP();
    if (typeof showToast === 'function') showToast('New 10 days plan started');
};

// A plan whose ten days are up archives itself the next time you look.
async function tdpAutoArchive() {
    const plan = tdpActivePlan();
    if (!plan) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (tdpParseLocal(plan.end_date) < today) {
        plan.status = 'archived';
        await tdpSavePlan(plan);
        if (typeof showToast === 'function') showToast('Your last 10 days plan has ended');
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
    .tdp-arch { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--border-color); border-radius: 13px; margin-bottom: 9px; }
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

function tdpCardHTML(plan, cat) {
    const items = tdpCats(plan)[cat] || [];
    const done = items.filter(i => i && i.completed).length;
    const rows = items.map((item, idx) => `
        <div class="tdp-item ${item.completed ? 'done' : ''}">
            <div class="tdp-box" onclick="tdpToggleItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', ${idx})"
                 title="${item.completed ? 'Mark as not done' : 'Mark done'}">${TDP_ICON.check}</div>
            <div class="tdp-text">${tdpEscape(item.text || '')}</div>
            <button class="tdp-del" onclick="tdpDeleteItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', ${idx})" title="Remove">${TDP_ICON.trash}</button>
        </div>`).join('');

    return `
    <div class="tdp-card" id="tdpCard_${tdpEscape(cat)}">
        <div class="tdp-card-head">
            <span class="tdp-dot" style="background:${tdpColor(cat)}"></span>
            <span class="tdp-card-name">${tdpEscape(cat)}</span>
            <span class="tdp-count">${done}/${items.length}</span>
        </div>
        <div class="tdp-items">${rows || `<div class="tdp-empty">Nothing here for these ten days.</div>`}</div>
        <div class="tdp-add">
            <input type="text" maxlength="200" placeholder="Add to ${tdpEscape(cat)}…"
                   onkeydown="if(event.key==='Enter'){event.preventDefault(); tdpAddItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', this);}" />
            <button onclick="tdpAddItem('${tdpEscape(plan.id)}', '${tdpEscape(cat)}', this.previousElementSibling)" title="Add">${TDP_ICON.plus}</button>
        </div>
    </div>`;
}

function tdpPageHTML() {
    const plan = tdpActivePlan();

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

    return tdpCSS() + `
    <div class="tdp-wrap">
        <div class="tdp-bar">
            <div class="tdp-bar-day">
                <b>Day ${info.day}</b>
                <span>of 10 · ${info.remaining} left</span>
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
                <button class="tdp-btn" onclick="routeTo('timeTracker')" title="These items show up on the matching stopwatch card">${TDP_ICON.clock} Time spent on</button>
                <button class="tdp-btn" onclick="tdpOpenArchive()">${TDP_ICON.archive} Past</button>
                <button class="tdp-btn primary" onclick="tdpOpenCreate()">${TDP_ICON.plus} New plan</button>
            </div>
        </div>

        <div class="tdp-grid" id="tdpGrid">
            ${cats.map(cat => tdpCardHTML(plan, cat)).join('')}
        </div>
    </div>` + sheets;
}

// Repaint in place. With a category given, only that card is rebuilt, so adding
// an item doesn't blur the box you're still typing in elsewhere.
function tdpRepaint(onlyCat) {
    const plan = tdpActivePlan();
    if (!plan) { renderTDP(); return; }

    if (onlyCat) {
        const card = document.getElementById('tdpCard_' + onlyCat);
        if (card) {
            const input = card.querySelector('.tdp-add input');
            const hadFocus = document.activeElement === input;
            card.outerHTML = tdpCardHTML(plan, onlyCat);
            if (hadFocus) document.getElementById('tdpCard_' + onlyCat)?.querySelector('.tdp-add input')?.focus();
        }
    } else {
        const grid = document.getElementById('tdpGrid');
        if (grid) grid.innerHTML = tdpCategoriesFor(plan).map(c => tdpCardHTML(plan, c)).join('');
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

window.tdpOpenArchive = function () {
    const modal = tdpSheet();
    if (!modal) return;
    const past = tdpPlans().filter(p => p.status === 'archived')
        .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    document.getElementById('tdpSheetTitle').textContent = 'Past plans';
    document.getElementById('tdpSheetSub').textContent = past.length ? `${past.length} finished` : '';
    document.getElementById('tdpSheetBody').innerHTML = past.length
        ? past.map(p => {
            const pr = tdpProgress(p);
            return `<div class="tdp-arch">
                <div class="tdp-arch-main">
                    <b>${tdpNiceDate(p.start_date)} – ${tdpNiceDate(p.end_date)}</b>
                    <span>${pr.done} of ${pr.total} done</span>
                </div>
                <span class="tdp-arch-pct">${pr.pct}%</span>
            </div>`;
        }).join('')
        : '<p class="tdp-note">Nothing archived yet. A plan lands here when its ten days are up, or when you start a new one.</p>';
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
    await tdpAutoArchive();

    main.innerHTML = tdpPageHTML();
}

window.renderTDP = renderTDP;
