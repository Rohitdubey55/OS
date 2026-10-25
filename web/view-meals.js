/* ============================================================================
   MEALS — Weekly Food Planner
   Plan Breakfast/Lunch/Dinner for 7 days at a glance, log what you actually ate
   (planned vs eaten), and a daily Mood + Energy + "ate healthy?" check-in so you
   can see, over time, how food affects your energy and mood.

   Psychology baked in:
   • Implementation intentions — planning the week ahead makes follow-through likely.
   • Self-monitoring — logging plan vs eaten is itself a proven behavior-change lever.
   • Goal-gradient + positive framing — a weekly health score & adherence %, always
     phrased encouragingly (never shaming).
   • Personalized feedback loop — "on days you ate well your energy averaged +X",
     the single strongest motivator to keep eating well.

   Data: state.data.meal_plan (one row per date+slot) and state.data.meal_day
   (one row per date). CRUD via apiCall('create'|'update'|'delete', table, payload, id).
   ============================================================================ */

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', cls: 'm-breakfast', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M5.6 8.6 4.2 7.2M18.4 8.6l1.4-1.4M2 16h3M19 16h3M22 20H2M16 16a4 4 0 0 0-8 0"/></svg>' },
  { key: 'lunch', label: 'Lunch', cls: 'm-lunch', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' },
  { key: 'snacks', label: 'Snacks', cls: 'm-snacks', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a6 6 0 0 0 6-6c0-3-2-5-6-5s-6 2-6 5a6 6 0 0 0 6 6z"/><path d="M12 9V5M12 5c0-1.7 1.3-3 3-3"/></svg>' },
  { key: 'dinner', label: 'Dinner', cls: 'm-dinner', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6.5 6.5 0 1 0 9 9 8 8 0 1 1-9-9z"/></svg>' }
];
const MEAL_MOODS = [
  { v: 1, e: '😞', l: 'Low' }, { v: 2, e: '😕', l: 'Meh' }, { v: 3, e: '😐', l: 'Okay' },
  { v: 4, e: '🙂', l: 'Good' }, { v: 5, e: '😄', l: 'Great' }
];
const MEAL_ENERGY = [
  { v: 1, l: 'Drained' }, { v: 2, l: 'Low' }, { v: 3, l: 'Okay' }, { v: 4, l: 'High' }, { v: 5, l: 'Charged' }
];

let _mealWeekOffset = 0;     // 0 = current week, -1 = last week, etc.
let _mealTab = 'week';       // 'week' | 'foods'
window._mealDraft = null;    // working copy while a modal is open

/* ── Local-date helpers (never use toISOString → that shifts the day in non-UTC zones) ── */
function _mealLocalDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function _mealParse(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN);
}
function _mealToday() { return _mealLocalDate(new Date()); }
function _mealWeekStart(offset) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                 // 0=Sun..6=Sat
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + offset * 7); // Monday-based
  return d;
}
function _mealWeekDates(offset) {
  const start = _mealWeekStart(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return _mealLocalDate(d);
  });
}

/* ── Data accessors ── */
function _mpAll() { return (window.state && state.data && state.data.meal_plan) || []; }
function _mdAll() { return (window.state && state.data && state.data.meal_day) || []; }
function _mpFor(date, slot) { return _mpAll().find(r => r.date === date && r.slot === slot); }
function _mdFor(date) { return _mdAll().find(r => r.date === date); }
const _mealHealthy = r => r && (r.ate_healthy === true || r.ate_healthy === 'true' || r.ate_healthy === 'TRUE' || r.ate_healthy === 1);

function _mealId(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Upsert a meal_plan row for (date, slot): update in place if it exists, else create.
async function _mpSave(date, slot, fields) {
  if (!state.data.meal_plan) state.data.meal_plan = [];
  let row = _mpFor(date, slot);
  if (row) {
    Object.assign(row, fields);
    try { await apiCall('update', 'meal_plan', fields, row.id); } catch (e) { console.error('meal_plan update', e); }
  } else {
    const id = _mealId('mp');
    row = { id, date, slot, ...fields };
    state.data.meal_plan.push(row);
    try { await apiCall('create', 'meal_plan', { id, date, slot, ...fields }); } catch (e) { console.error('meal_plan create', e); }
  }
  return row;
}
async function _mdSave(date, fields) {
  if (!state.data.meal_day) state.data.meal_day = [];
  let row = _mdFor(date);
  if (row) {
    Object.assign(row, fields);
    try { await apiCall('update', 'meal_day', fields, row.id); } catch (e) { console.error('meal_day update', e); }
  } else {
    const id = _mealId('md');
    row = { id, date, ...fields };
    state.data.meal_day.push(row);
    try { await apiCall('create', 'meal_day', { id, date, ...fields }); } catch (e) { console.error('meal_day create', e); }
  }
  return row;
}

/* ── Weekly template ("My week") ──────────────────────────────────────────────
   One row per (weekday 0=Mon..6=Sun, slot): the meal you normally eat that day.
   The week grid falls back to this whenever a date+slot has no explicit
   meal_plan row, so every week starts fully planned and only needs marking.
   ────────────────────────────────────────────────────────────────────────── */
const MEAL_WEEKDAYS = [
  { i: 0, short: 'Mon', long: 'Monday' }, { i: 1, short: 'Tue', long: 'Tuesday' },
  { i: 2, short: 'Wed', long: 'Wednesday' }, { i: 3, short: 'Thu', long: 'Thursday' },
  { i: 4, short: 'Fri', long: 'Friday' }, { i: 5, short: 'Sat', long: 'Saturday' },
  { i: 6, short: 'Sun', long: 'Sunday' }
];
function _mtAll() { return (window.state && state.data && state.data.meal_template) || []; }
function _mtFor(weekday, slot) { return _mtAll().find(r => +r.weekday === +weekday && r.slot === slot); }
function _mtPlanned(weekday, slot) { const r = _mtFor(weekday, slot); return r && r.planned ? String(r.planned).trim() : ''; }
function _mtCount() { return _mtAll().filter(r => r.planned && String(r.planned).trim()).length; }
// Monday-based weekday index for a 'YYYY-MM-DD' string (0=Mon .. 6=Sun).
function _mealWeekdayIdx(dateStr) { const dow = _mealParse(dateStr).getDay(); return dow === 0 ? 6 : dow - 1; }

async function _mtSave(weekday, slot, planned) {
  if (!state.data.meal_template) state.data.meal_template = [];
  const fields = { planned: (planned || '').trim() };
  let row = _mtFor(weekday, slot);
  if (row) {
    Object.assign(row, fields);
    try { await apiCall('update', 'meal_template', fields, row.id); } catch (e) { console.error('meal_template update', e); }
  } else {
    const id = _mealId('mt');
    row = { id, weekday: +weekday, slot, ...fields };
    state.data.meal_template.push(row);
    try { await apiCall('create', 'meal_template', { id, weekday: +weekday, slot, ...fields }); } catch (e) { console.error('meal_template create', e); }
  }
  return row;
}

/* The meal that actually applies to a date+slot: an explicit plan if one exists,
   otherwise the weekly template. `fromTemplate` marks the auto-filled case, which
   renders as a soft "suggested" pill until the user marks or edits it. */
function _mealEffective(date, slot) {
  const mp = _mpFor(date, slot);
  const explicit = mp && mp.planned ? String(mp.planned).trim() : '';
  if (explicit) return { text: explicit, fromTemplate: false, mp };
  const t = _mtPlanned(_mealWeekdayIdx(date), slot);
  return { text: t, fromTemplate: !!t, mp };
}

/* ── Food library ("Things I can eat") ── */
const MEAL_HEALTH = [
  { key: 'healthy', label: 'Healthy', emo: '🥗', color: '#16a34a' },
  { key: 'ok', label: 'OK', emo: '🍽️', color: '#64748b' },
  { key: 'treat', label: 'Treat', emo: '🍰', color: '#d97706' }
];
const _mealHealthMeta = k => MEAL_HEALTH.find(h => h.key === k) || MEAL_HEALTH[1];
const _mealFav = it => !!(it && (it.favorite === true || it.favorite === 'true' || it.favorite === 1));

function _miAll() { return (window.state && state.data && state.data.meal_items) || []; }
function _miSlots(it) { const s = (it.slots || '').trim(); return s ? s.split(',').map(x => x.trim()).filter(Boolean) : []; }
function _miSuitsSlot(it, slot) { const s = _miSlots(it); return s.length === 0 || s.includes(slot); }
function _miRank(a, b) {
  return (_mealFav(b) ? 1 : 0) - (_mealFav(a) ? 1 : 0)
    || (Number(b.use_count) || 0) - (Number(a.use_count) || 0)
    || (a.name || '').localeCompare(b.name || '');
}
function _miForSlot(slot) { return _miAll().filter(it => _miSuitsSlot(it, slot)).sort(_miRank); }
function _miByName(name) { const n = (name || '').trim().toLowerCase(); return _miAll().find(i => (i.name || '').trim().toLowerCase() === n); }

// Foods typed in the past that aren't in the library yet — history suggestions.
function _miHistory(slot) {
  const lib = new Set(_miAll().map(i => (i.name || '').trim().toLowerCase()));
  const counts = {};
  _mpAll().forEach(mp => {
    if (slot && mp.slot !== slot) return;
    [mp.planned, mp.eaten].forEach(t => {
      t = (t || '').trim();
      if (t && !lib.has(t.toLowerCase())) counts[t] = (counts[t] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 8);
}

async function _miCreate(fields) {
  if (!state.data.meal_items) state.data.meal_items = [];
  const id = _mealId('mi');
  const row = { id, favorite: false, use_count: 0, ...fields };
  state.data.meal_items.push(row);
  try { await apiCall('create', 'meal_items', row); } catch (e) { console.error('meal_items create', e); }
  return row;
}
async function _miUpdate(id, fields) {
  const it = _miAll().find(i => String(i.id) === String(id)); if (!it) return;
  Object.assign(it, fields);
  try { await apiCall('update', 'meal_items', fields, id); } catch (e) { console.error('meal_items update', e); }
}
function _miBumpUse(name) {
  const it = _miByName(name); if (!it) return;
  _miUpdate(it.id, { use_count: (Number(it.use_count) || 0) + 1 });
}
window.deleteMealItem = async function (id) {
  if (typeof confirm === 'function' && !confirm('Remove this food from your list?')) return;
  state.data.meal_items = _miAll().filter(i => String(i.id) !== String(id));
  renderMeals();
  try { await apiCall('delete', 'meal_items', {}, id); } catch (e) { console.error(e); }
};
window.toggleMealItemFav = async function (id) {
  const it = _miAll().find(i => String(i.id) === String(id)); if (!it) return;
  await _miUpdate(id, { favorite: !_mealFav(it) });
  renderMeals();
};


/* ── Nutrition: calories + protein ───────────────────────────────────────────
   Numbers come from three places, most specific first:
     1. a number typed on that meal (meal_plan.kcal / .protein)
     2. the food in "My foods" (meal_items.kcal / .protein) — so a meal you plan
        or mark from your foods counts automatically
     3. nothing (shown as "add calories")
   A meal marked Ate it / Ate other counts as EATEN; one not yet marked counts
   as PLANNED; skipped counts as zero. Extras (snacks, drinks, anything not in
   a slot) live on the day row (meal_day.extra_kcal / .extra_protein).
   ────────────────────────────────────────────────────────────────────────── */
const _mNum = v => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;
const _mFmtK = v => v == null ? '—' : Math.round(v).toLocaleString('en-IN');
const _mFmtP = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-IN');
function _miNums(name) {
  const it = _miByName(name);
  return it ? { kcal: _mNum(it.kcal), protein: _mNum(it.protein), item: it } : { kcal: null, protein: null, item: null };
}
function _mealNums(date, slot) {
  const eff = _mealEffective(date, slot), mp = eff.mp, st = mp && mp.status;
  if (st === 'skipped') return { kcal: 0, protein: 0, state: 'skipped', src: '', food: eff.text };
  const food = st === 'different' ? ((mp.eaten || '').trim()) : eff.text;
  let kcal = mp ? _mNum(mp.kcal) : null, protein = mp ? _mNum(mp.protein) : null, src = (kcal != null || protein != null) ? 'meal' : '';
  if (kcal == null && protein == null && food) {
    const n = _miNums(food); kcal = n.kcal; protein = n.protein;
    if (kcal != null || protein != null) src = 'food';
  }
  const state = (st === 'as_planned' || st === 'different') ? 'eaten' : (food ? 'planned' : 'none');
  return { kcal, protein, state, src, food };
}
function _mealDayNut(date) {
  const r = { eatK: 0, eatP: 0, planK: 0, planP: 0, extraK: 0, extraP: 0, missing: 0, eatenN: 0, plannedN: 0, hasAny: false };
  MEAL_SLOTS.forEach(s => {
    const n = _mealNums(date, s.key);
    if (n.state === 'eaten') { r.eatK += n.kcal || 0; r.eatP += n.protein || 0; r.eatenN++; }
    else if (n.state === 'planned') { r.planK += n.kcal || 0; r.planP += n.protein || 0; r.plannedN++; }
    if ((n.state === 'eaten' || n.state === 'planned') && n.kcal == null && n.protein == null) r.missing++;
    if (n.kcal || n.protein) r.hasAny = true;
  });
  const md = _mdFor(date);
  r.extraK = (md && _mNum(md.extra_kcal)) || 0; r.extraP = (md && _mNum(md.extra_protein)) || 0;
  if (r.extraK || r.extraP) r.hasAny = true;
  r.eatK += r.extraK; r.eatP += r.extraP;
  r.totK = r.eatK + r.planK; r.totP = r.eatP + r.planP;
  r.logged = r.eatenN > 0 || r.extraK > 0 || r.extraP > 0;
  return r;
}
const MEAL_GOALS_KEY = 'os.meal.goals';
function _mealGoals() {
  let g = null;
  try { const s = state.data.settings && state.data.settings[0]; if (s && s.nutrition_goals) g = typeof s.nutrition_goals === 'string' ? JSON.parse(s.nutrition_goals) : s.nutrition_goals; } catch (e) { }
  if (!g) { try { g = JSON.parse(localStorage.getItem(MEAL_GOALS_KEY) || 'null'); } catch (e) { } }
  return { kcal: _mNum(g && g.kcal), protein: _mNum(g && g.protein) };
}
async function _mealSaveGoals(g) {
  const json = JSON.stringify({ kcal: _mNum(g.kcal), protein: _mNum(g.protein) });
  try { localStorage.setItem(MEAL_GOALS_KEY, json); } catch (e) { }
  const s = state.data.settings && state.data.settings[0];
  if (s) {
    s.nutrition_goals = json;
    if (s.id) { try { await apiCall('update', 'settings', { nutrition_goals: json }, s.id); } catch (e) { console.error('goals save', e); } }
  }
}
// A meal's typed numbers are only stored when they differ from the food's own,
// so fixing a food in My foods updates every meal that uses it.
function _mealOverride(food, kcal, protein) {
  const n = _miNums(food);
  kcal = _mNum(kcal); protein = _mNum(protein);
  if (n.item && kcal === n.kcal && protein === n.protein) return { kcal: null, protein: null };
  return { kcal, protein };
}
// If the food is in My foods but has no numbers yet, remember these for next time.
function _mealTeachFood(food, kcal, protein) {
  const n = _miNums(food);
  if (!n.item || (n.kcal != null || n.protein != null)) return false;
  kcal = _mNum(kcal); protein = _mNum(protein);
  if (kcal == null && protein == null) return false;
  _miUpdate(n.item.id, { kcal, protein });
  return true;
}
// Small progress meter vs a goal (or a plain number with no goal).
function _mealMeter(val, goal, unit, cls) {
  const pct = goal ? Math.max(0, Math.min(100, Math.round(val / goal * 100))) : 0;
  const over = goal && val > goal * 1.08;
  return `<div class="ml-meter ${cls} ${over ? 'over' : ''}"><div class="ml-meter-t"><b>${unit === 'g' ? _mFmtP(val) : _mFmtK(val)}</b>${goal ? `<span>/ ${unit === 'g' ? _mFmtP(goal) : _mFmtK(goal)}</span>` : ''}<em>${unit === 'g' ? 'g protein' : 'kcal'}</em></div>${goal ? `<div class="ml-meter-b"><i style="width:${pct}%"></i></div>` : ''}</div>`;
}

/* ── Weekly stats + lifetime insight ── */
function _mealWeekStats(dates) {
  const today = _mealToday();
  let plannedSlots = 0, followed = 0, healthyDays = 0, checkedDays = 0, energySum = 0, energyN = 0, moodSum = 0, moodN = 0;
  dates.forEach(dt => {
    MEAL_SLOTS.forEach(s => {
      const eff = _mealEffective(dt, s.key);
      if (eff.text) {
        plannedSlots++;
        if (eff.mp && eff.mp.status === 'as_planned') followed++;
      }
    });
    const md = _mdFor(dt);
    if (md && (md.mood || md.energy || md.ate_healthy != null)) checkedDays++;
    if (_mealHealthy(md)) healthyDays++;
    if (md && md.energy) { energySum += +md.energy; energyN++; }
    if (md && md.mood) { moodSum += +md.mood; moodN++; }
  });
  const elapsed = dates.filter(d => d <= today).length || 7;
  return {
    plannedSlots, followed,
    adherence: plannedSlots ? Math.round(followed / plannedSlots * 100) : 0,
    healthyDays, elapsed, checkedDays,
    avgEnergy: energyN ? (energySum / energyN) : null,
    avgMood: moodN ? (moodSum / moodN) : null
  };
}
// Lifetime: how much better is energy/mood on days you ate well vs not.
function _mealInsight() {
  const md = _mdAll();
  const well = md.filter(r => _mealHealthy(r));
  const notWell = md.filter(r => r.ate_healthy === false || r.ate_healthy === 'false' || r.ate_healthy === 'FALSE' || r.ate_healthy === 0);
  const avg = (arr, k) => { const v = arr.filter(r => r[k]).map(r => +r[k]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const eW = avg(well, 'energy'), eN = avg(notWell, 'energy');
  const mW = avg(well, 'mood'), mN = avg(notWell, 'mood');
  const enoughE = well.filter(r => r.energy).length >= 2 && notWell.filter(r => r.energy).length >= 2;
  const enoughM = well.filter(r => r.mood).length >= 2 && notWell.filter(r => r.mood).length >= 2;
  if (enoughE && eW != null && eN != null) return { metric: 'energy', well: eW, not: eN, delta: eW - eN };
  if (enoughM && mW != null && mN != null) return { metric: 'mood', well: mW, not: mN, delta: mW - mN };
  return null;
}

/* ── Styling ── */
const MEALS_CSS = `<style>
.ml-wrap { max-width:1300px; margin:0 auto; padding-bottom:40px; }
.ml-hero { background:var(--surface-1); border:1px solid var(--border-color); border-radius:20px; box-shadow:var(--shadow-card,0 4px 15px rgba(0,0,0,.05)); padding:18px 20px; margin-bottom:18px; }
.ml-hero-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.ml-week-nav { display:flex; align-items:center; gap:8px; }
.ml-navbtn { width:34px; height:34px; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-1); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.ml-navbtn:hover { background:var(--surface-3); }
.ml-week-label { font-size:15px; font-weight:800; color:var(--text-1); min-width:160px; text-align:center; }
.ml-today-btn { font-size:12.5px; font-weight:700; color:var(--primary); background:var(--primary-soft,rgba(99,102,241,.12)); border:none; border-radius:9px; padding:8px 12px; cursor:pointer; }
.ml-headline { font-size:14px; color:var(--text-2); font-weight:600; }
.ml-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.ml-stat { background:var(--surface-2); border-radius:14px; padding:12px 14px; }
.ml-stat__v { font-size:22px; font-weight:850; color:var(--text-1); line-height:1; font-variant-numeric:tabular-nums; }
.ml-stat__v small { font-size:13px; color:var(--text-3); font-weight:700; }
.ml-stat__l { font-size:11.5px; color:var(--text-3); font-weight:600; margin-top:5px; text-transform:uppercase; letter-spacing:.03em; }
.ml-insight { display:flex; align-items:center; gap:12px; margin-top:14px; padding:12px 14px; border-radius:14px; background:linear-gradient(135deg,rgba(34,197,94,.14),rgba(34,197,94,.05)); border:1px solid rgba(34,197,94,.22); }
.ml-insight .ic { width:34px; height:34px; border-radius:10px; background:#16a34a; color:#fff; display:flex; align-items:center; justify-content:center; flex:none; }
.ml-insight .tx { font-size:13px; color:var(--text-1); font-weight:600; line-height:1.4; }
.ml-insight .tx b { color:#15803d; }

.ml-thead { display:grid; grid-template-columns:140px repeat(4,minmax(0,1fr)) 132px; gap:10px; padding:2px 18px 7px; }
.ml-thead span { font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--text-3); }
.ml-table { display:flex; flex-direction:column; gap:10px; }
.ml-row { display:grid; grid-template-columns:140px repeat(4,minmax(0,1fr)) 132px; gap:10px; align-items:center; background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:11px 18px; box-shadow:0 1px 2px rgba(0,0,0,.03); transition:box-shadow .16s; }
.ml-row:hover { box-shadow:0 8px 22px rgba(0,0,0,.07); }
.ml-row.today { border-color:rgba(22,163,74,.42); background:linear-gradient(90deg, rgba(22,163,74,.06), var(--surface-1) 26%); }
.ml-rd .d-wd { display:flex; align-items:center; gap:7px; font-size:16px; font-weight:800; color:var(--text-1); }
.ml-row.today .ml-rd .d-wd { color:#16a34a; }
.ml-rd .d-sub { font-size:12px; color:var(--text-3); font-weight:600; margin-top:1px; }
.ml-today-pill { font-size:8.5px; font-weight:900; letter-spacing:.06em; color:#fff; background:#16a34a; padding:2px 6px; border-radius:999px; }
.ml-mlabel { display:none; }
.ml-pill { width:100%; text-align:left; border:1px solid var(--border-color); background:var(--surface-2); border-radius:11px; padding:0 12px; height:42px; font-size:13px; font-weight:650; color:var(--text-2); cursor:pointer; white-space:nowrap; overflow:hidden; display:flex; align-items:center; gap:8px; transition:all .14s; box-sizing:border-box; }
.ml-pill:hover { filter:brightness(.97); }
.ml-pill .dot { width:8px; height:8px; border-radius:50%; flex:none; }
.ml-pill .ck { font-weight:900; flex:none; }
.ml-pill .tx { overflow:hidden; text-overflow:ellipsis; }
.ml-pill.empty { color:var(--text-3); font-weight:500; border-style:dashed; background:transparent; }
.ml-pill.planned { background:rgba(22,163,74,.10); border-color:rgba(22,163,74,.30); color:#15803d; }
.ml-pill.planned .dot { background:#16a34a; }
.ml-pill.ok { background:#16a34a; border-color:#16a34a; color:#fff; }
.ml-pill.off { background:rgba(239,68,68,.10); border-color:rgba(239,68,68,.34); color:#dc2626; }
.ml-pill.off .dot { background:#ef4444; }
.ml-pill.skip { color:var(--text-3); border-style:dashed; background:transparent; }
.ml-pill.skip .tx { text-decoration:line-through; }
.ml-rci { width:100%; height:42px; border:1px solid var(--border-color); background:var(--surface-2); border-radius:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-size:15px; transition:all .14s; box-sizing:border-box; }
.ml-rci:hover { border-color:var(--primary); }
.ml-rci.done { background:rgba(22,163,74,.08); border-color:rgba(22,163,74,.22); }
.ml-rci .ci-en { font-size:11px; font-weight:800; color:var(--text-2); }
.ml-rci .ci-h { width:8px; height:8px; border-radius:50%; background:#16a34a; }
.ml-rci .ci-add { font-size:12.5px; font-weight:700; color:var(--text-3); }
@media (max-width:920px){
  .ml-thead { display:none; }
  .ml-row { grid-template-columns:1fr; gap:9px; padding:14px 14px 15px; }
  .ml-rd { display:flex; align-items:baseline; gap:9px; margin-bottom:3px; }
  .ml-rd .d-sub { margin-top:0; }
  .ml-mlabel { display:block; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); margin-bottom:5px; }
}

/* Modal */
.ml-modal-ov { position:fixed; inset:0; z-index:11000; background:rgba(15,23,42,.55); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; }
.ml-modal { width:100%; max-width:440px; background:var(--surface-1); border-radius:20px; box-shadow:0 24px 60px rgba(0,0,0,.3); overflow:hidden; max-height:92vh; display:flex; flex-direction:column; }
.ml-modal-h { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 0; }
.ml-modal-title { font-size:17px; font-weight:850; color:var(--text-1); }
.ml-modal-sub { font-size:12.5px; color:var(--text-3); font-weight:600; margin-top:2px; }
.ml-modal-x { width:32px; height:32px; border:none; border-radius:9px; background:var(--surface-2); color:var(--text-2); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.ml-modal-b { padding:16px 20px 20px; overflow-y:auto; }
.ml-field-l { font-size:12px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.03em; margin:14px 0 7px; }
.ml-input { width:100%; border:1px solid var(--border-color); background:var(--surface-2); border-radius:12px; padding:11px 13px; font-size:14px; color:var(--text-1); font-family:inherit; box-sizing:border-box; }
.ml-input:focus { outline:none; border-color:var(--primary); }
.ml-seg { display:flex; gap:8px; }
.ml-seg button { flex:1; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); font-size:13px; font-weight:700; padding:11px 6px; border-radius:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all .14s; }
.ml-seg button .em { font-size:18px; }
.ml-seg button:hover { border-color:var(--border-strong,var(--text-3)); }
.ml-seg button.on { color:#fff; border-color:transparent; }
.ml-seg button.on.s-ok { background:#16a34a; }
.ml-seg button.on.s-diff { background:#d97706; }
.ml-seg button.on.s-skip { background:#64748b; }
.ml-scale { display:flex; gap:7px; }
.ml-scale button { flex:1; border:1px solid var(--border-color); background:var(--surface-2); border-radius:11px; padding:9px 4px; cursor:pointer; font-size:18px; line-height:1.1; transition:all .14s; }
.ml-scale button .lb { display:block; font-size:9.5px; font-weight:700; color:var(--text-3); margin-top:3px; }
.ml-scale button.on { border-color:var(--primary); background:var(--primary-soft,rgba(99,102,241,.14)); }
.ml-scale.energy button.on { border-color:#16a34a; background:rgba(34,197,94,.14); }
.ml-toggle { display:flex; gap:8px; }
.ml-toggle button { flex:1; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); font-size:14px; font-weight:800; padding:13px; border-radius:13px; cursor:pointer; transition:all .14s; }
.ml-toggle button.yes.on { background:#16a34a; color:#fff; border-color:transparent; }
.ml-toggle button.no.on { background:#ef4444; color:#fff; border-color:transparent; }
.ml-actions { display:flex; gap:10px; margin-top:20px; }
.ml-btn { flex:1; border:none; border-radius:13px; padding:13px; font-size:14px; font-weight:800; cursor:pointer; }
.ml-btn.primary { background:var(--primary); color:#fff; }
.ml-btn.ghost { background:var(--surface-2); color:var(--text-2); flex:0 0 auto; padding:13px 18px; }

@media (max-width:920px){
  .ml-week { grid-template-columns:1fr; }
  .ml-day { flex-direction:column; }
  .ml-stats { grid-template-columns:repeat(2,1fr); }
  .ml-modal { max-width:520px; align-self:flex-end; border-bottom-left-radius:0; border-bottom-right-radius:0; }
  .ml-modal-ov { align-items:flex-end; padding:0; }
}
/* tabs + top actions */
.ml-topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
.ml-tabs { display:inline-flex; background:var(--surface-2); border:1px solid var(--border-color); border-radius:12px; padding:3px; gap:2px; }
.ml-tab { border:none; background:transparent; color:var(--text-3); font-size:13.5px; font-weight:700; padding:8px 16px; border-radius:9px; cursor:pointer; }
.ml-tab.on { background:var(--surface-1); color:var(--text-1); box-shadow:0 1px 2px rgba(0,0,0,.08); }
.ml-top-actions { display:flex; gap:8px; flex-wrap:wrap; }
.ml-tbtn { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--text-2); background:var(--surface-1); border:1px solid var(--border-color); border-radius:10px; padding:8px 12px; cursor:pointer; }
.ml-tbtn:hover { border-color:var(--text-3); color:var(--text-1); }
.ml-tbtn.primary { background:var(--primary); color:#fff; border-color:transparent; }
/* picker */
.ml-pick { margin-top:10px; }
.ml-pick-lbl { font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--text-3); margin:10px 0 6px; }
.ml-pick-lbl:first-child { margin-top:0; }
.ml-chips { display:flex; flex-wrap:wrap; gap:7px; }
.ml-chip { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text-1); background:var(--surface-2); border:1px solid var(--border-color); border-radius:999px; padding:7px 12px; cursor:pointer; transition:all .12s; max-width:100%; }
.ml-chip:hover { border-color:var(--primary); background:var(--surface-1); }
.ml-chip .cd { width:8px; height:8px; border-radius:50%; flex:none; }
.ml-chip .fv { color:#f59e0b; }
.ml-chip.hist { color:var(--text-2); font-weight:500; border-style:dashed; }
.ml-pick-empty { font-size:12.5px; color:var(--text-3); padding:6px 2px; }
.ml-pick-add { display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:13px; font-weight:700; color:var(--primary); background:color-mix(in srgb,var(--primary) 12%, transparent); border:1px dashed color-mix(in srgb,var(--primary) 40%, transparent); border-radius:11px; padding:9px 13px; cursor:pointer; }
/* food editor segments */
.ml-pickslot { flex:1; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); font-size:13px; font-weight:700; padding:11px 6px; border-radius:11px; cursor:pointer; }
.ml-pickslot.on { background:var(--primary); color:#fff; border-color:transparent; }
.ml-pickhealth { flex:1; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); font-size:13px; font-weight:700; padding:11px 4px; border-radius:11px; cursor:pointer; }
.ml-pickhealth.on { background:var(--hc); color:#fff; border-color:transparent; }
.ml-fav-row { display:flex; align-items:center; gap:9px; margin-top:16px; font-size:13.5px; font-weight:600; color:var(--text-2); cursor:pointer; }
.ml-fav-row input { width:18px; height:18px; accent-color:var(--primary); }
/* My foods manager */
.ml-foods-head { font-size:12.5px; font-weight:700; color:var(--text-3); margin-bottom:10px; }
.ml-foods-list { display:flex; flex-direction:column; gap:9px; }
.ml-food { display:flex; align-items:center; gap:12px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:11px 14px; box-shadow:0 1px 2px rgba(0,0,0,.03); }
.ml-food-fav { border:none; background:transparent; font-size:19px; line-height:1; color:var(--text-3); cursor:pointer; flex:none; }
.ml-food-fav.on { color:#f59e0b; }
.ml-food-main { flex:1; min-width:0; }
.ml-food-name { font-size:15px; font-weight:700; color:var(--text-1); }
.ml-food-meta { display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-top:4px; }
.ml-hb { font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; }
.ml-ft { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--text-3); background:var(--surface-2); border:1px solid var(--border-color); padding:2px 7px; border-radius:6px; }
.ml-uc { font-size:11px; color:var(--text-3); font-weight:600; }
.ml-food-x { width:34px; height:34px; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); border-radius:9px; cursor:pointer; flex:none; display:flex; align-items:center; justify-content:center; }
.ml-food-x:hover { color:var(--text-1); }
.ml-food-x.danger:hover { color:#dc2626; border-color:#dc2626; }
.ml-foods-empty { text-align:center; padding:40px 20px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.ml-foods-empty .t { font-size:17px; font-weight:800; color:var(--text-1); }
.ml-foods-empty .s { font-size:13px; color:var(--text-3); max-width:380px; }
.ml-foods-starters { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:12px; }
.ml-starter { font-size:13px; font-weight:600; color:var(--text-1); background:var(--surface-2); border:1px solid var(--border-color); border-radius:999px; padding:8px 14px; cursor:pointer; }
.ml-starter:hover { border-color:var(--primary); }
/* shopping list + hint */
.ml-shop { display:flex; flex-direction:column; }
.ml-shop-row { display:flex; align-items:center; gap:10px; padding:9px 4px; border-bottom:1px solid var(--border-color); font-size:14px; color:var(--text-1); cursor:pointer; }
.ml-shop-row input { width:18px; height:18px; accent-color:var(--primary); }
.ml-shop-row span { flex:1; }
.ml-shop-c { font-size:12px; color:var(--text-3); font-weight:700; }
.ml-hint { font-size:11.5px; color:var(--text-3); font-weight:600; margin-top:8px; text-align:center; }

/* ── Meal cell: tap the pill to mark, tap the pencil to edit ── */
.ml-cell { display:flex; align-items:center; gap:6px; }
.ml-cell .ml-pill { flex:1; min-width:0; }
.ml-edit { flex:none; width:30px; height:42px; border:1px solid transparent; background:transparent; color:var(--text-3); border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .14s, color .14s, border-color .14s; }
.ml-row:hover .ml-edit, .ml-tgrid-row:hover .ml-edit { opacity:1; }
.ml-edit:hover { color:var(--text-1); border-color:var(--border-color); background:var(--surface-2); }
.ml-edit:focus-visible { opacity:1; outline:2px solid var(--primary); }
@media (hover:none){ .ml-edit { opacity:1; } }
/* Auto-filled from the weekly template — planned, but not yet committed. */
.ml-pill.tmpl { background:transparent; border-style:dashed; border-color:rgba(22,163,74,.38); color:#15803d; font-weight:600; }
.ml-pill.tmpl .dot { background:rgba(22,163,74,.5); }
.ml-pill.tmpl .tm { font-size:10px; font-weight:800; letter-spacing:.04em; color:var(--text-3); flex:none; margin-left:auto; }

/* ── "My week" template tab ── */
.ml-tintro { display:flex; align-items:center; gap:12px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:14px 16px; margin-bottom:14px; }
.ml-tintro .ic { width:34px; height:34px; border-radius:10px; background:#16a34a; color:#fff; display:flex; align-items:center; justify-content:center; flex:none; font-size:17px; }
.ml-tintro .tx { font-size:13px; color:var(--text-2); font-weight:600; line-height:1.45; flex:1; }
.ml-tintro .tx b { color:var(--text-1); }
.ml-thead.tmpl, .ml-tgrid-row { grid-template-columns:140px repeat(4,minmax(0,1fr)); }
.ml-tgrid { display:flex; flex-direction:column; gap:10px; }
.ml-tgrid-row { display:grid; gap:10px; align-items:center; background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:11px 18px; box-shadow:0 1px 2px rgba(0,0,0,.03); }
.ml-tgrid-row .d-wd { font-size:16px; font-weight:800; color:var(--text-1); }
@media (max-width:920px){
  .ml-tgrid-row { grid-template-columns:1fr; gap:9px; padding:14px; }
  .ml-tgrid-row .d-wd { margin-bottom:3px; }
}
/* ── Calories & protein ── */
.ml-thead { grid-template-columns:140px repeat(4,minmax(0,1fr)) 168px 132px; }
.ml-row { grid-template-columns:140px repeat(4,minmax(0,1fr)) 168px 132px; }
.ml-pill .kc { margin-left:auto; flex:none; font-size:11px; font-weight:800; opacity:.72; font-variant-numeric:tabular-nums; }
.ml-pill.ok .kc { opacity:.9; }
.ml-pill .kc::after { content:' kcal'; font-weight:600; font-size:9.5px; }
.ml-nut { width:100%; min-height:42px; border:1px solid var(--border-color); background:var(--surface-2); border-radius:11px; cursor:pointer; display:flex; flex-direction:column; justify-content:center; gap:4px; padding:6px 10px; box-sizing:border-box; text-align:left; transition:border-color .14s; font:inherit; }
.ml-nut:hover { border-color:var(--primary); }
.ml-nut.logged { background:rgba(22,163,74,.07); border-color:rgba(22,163,74,.24); }
.ml-nut.empty { align-items:center; border-style:dashed; background:transparent; }
.ml-nut .ci-add { font-size:12px; font-weight:700; color:var(--text-3); }
.ml-nut-s { font-size:9.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.03em; }
.ml-meter-t { display:flex; align-items:baseline; gap:3px; font-size:11px; color:var(--text-3); font-variant-numeric:tabular-nums; white-space:nowrap; }
.ml-meter-t b { font-size:13px; font-weight:850; color:var(--text-1); }
.ml-meter-t em { font-style:normal; margin-left:auto; font-size:10px; font-weight:700; }
.ml-meter-b { height:4px; background:var(--surface-3,#e5e7eb); border-radius:999px; overflow:hidden; margin-top:2px; }
.ml-meter-b i { display:block; height:100%; border-radius:999px; background:#f59e0b; }
.ml-meter.p .ml-meter-b i { background:#6366f1; }
.ml-meter.over .ml-meter-b i { background:#ef4444; }
.ml-nutbar { margin-top:14px; }
.ml-nutbar-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); }
.ml-link { border:none; background:none; color:var(--primary); font:inherit; font-size:12px; font-weight:700; text-transform:none; letter-spacing:0; cursor:pointer; padding:0; }
.ml-nutin { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
.ml-nutin label > span { display:block; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.03em; margin-bottom:5px; }
.ml-unit { position:relative; }
.ml-unit em { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-style:normal; font-size:12px; font-weight:700; color:var(--text-3); pointer-events:none; }
.ml-unit .ml-input { padding-right:28px; }
.ml-nut-hint { font-size:11.5px; color:var(--text-3); margin-top:6px; line-height:1.4; min-height:0; }
.ml-nut-hint b { color:var(--text-2); }
.ml-fn { font-size:11px; font-weight:700; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border-color); padding:2px 8px; border-radius:999px; font-variant-numeric:tabular-nums; }
.ml-fn.add { color:var(--primary); border-style:dashed; background:transparent; cursor:pointer; font:inherit; font-size:11px; font-weight:700; }
/* day sheet */
.ml-dn-row { display:grid; grid-template-columns:minmax(0,1fr) 84px 76px; gap:8px; align-items:center; padding:9px 0; border-bottom:1px solid var(--border-color); }
.ml-dn-row:last-of-type { border-bottom:none; }
.ml-dn-l { min-width:0; }
.ml-dn-slot { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); display:flex; gap:6px; align-items:center; }
.ml-dn-food { font-size:13.5px; font-weight:650; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ml-dn-food.none { color:var(--text-3); font-weight:500; }
.ml-dn-st { font-size:9.5px; font-weight:800; padding:1px 6px; border-radius:999px; background:var(--surface-2); color:var(--text-3); text-transform:none; letter-spacing:0; }
.ml-dn-st.eaten { background:rgba(22,163,74,.12); color:#15803d; }
.ml-dn-st.skipped { text-decoration:line-through; }
.ml-dn-row .ml-input { padding:9px 10px; font-size:14px; text-align:right; }
.ml-dn-row .ml-unit .ml-input { padding-right:24px; }
.ml-dn-head { display:grid; grid-template-columns:minmax(0,1fr) 84px 76px; gap:8px; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); padding-bottom:4px; }
.ml-dn-head span:not(:first-child) { text-align:right; padding-right:4px; }
.ml-dn-tot { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; padding:12px; border-radius:14px; background:var(--surface-2); }
.ml-dn-tot .ml-meter-t b { font-size:18px; }
.ml-dn-note { font-size:11.5px; color:var(--text-3); margin-top:8px; line-height:1.4; }
@media (max-width:920px){
  .ml-row { grid-template-columns:1fr; }
  .ml-thead { display:none; }
}
</style>`;

/* ── Render ── */
function _mealTabsBar() {
  return `<div class="ml-topbar">
      <div class="ml-tabs">
        <button class="ml-tab ${_mealTab === 'week' ? 'on' : ''}" onclick="mealSetTab('week')">This week</button>
        <button class="ml-tab ${_mealTab === 'template' ? 'on' : ''}" onclick="mealSetTab('template')">My week</button>
        <button class="ml-tab ${_mealTab === 'foods' ? 'on' : ''}" onclick="mealSetTab('foods')">My foods</button>
      </div>
      ${_mealTab === 'week' ? `<div class="ml-top-actions">
        <button class="ml-tbtn" onclick="mealRepeatLastWeek()" title="Copy last week's plan into empty slots">${renderIcon('refresh', null, 'style="width:14px"')} Repeat last week</button>
        <button class="ml-tbtn" onclick="mealShoppingList()" title="Everything planned this week">🛒 Shopping list</button>
      </div>`
      : _mealTab === 'template' ? `<div class="ml-top-actions">
        <button class="ml-tbtn" onclick="mealTemplateFromWeek()" title="Use the week you're looking at as your usual week">${renderIcon('refresh', null, 'style="width:14px"')} Copy from this week</button>
        ${_mtCount() ? `<button class="ml-tbtn" onclick="mealTemplateClear()" title="Clear the whole template">Clear all</button>` : ''}
      </div>`
      : `<button class="ml-tbtn primary" onclick="openFoodEditor()">${renderIcon('plus', null, 'style="width:15px"')} Add food</button>`}
    </div>`;
}
window.mealSetTab = function (t) { _mealTab = t; renderMeals(); };

function renderMeals() {
  const main = document.getElementById('main');
  if (!main) return;
  if (_mealTab === 'foods') {
    main.innerHTML = `${MEALS_CSS}<div class="ml-wrap">${_mealTabsBar()}${_renderFoodsManager()}</div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  if (_mealTab === 'template') {
    main.innerHTML = `${MEALS_CSS}<div class="ml-wrap">${_mealTabsBar()}${_renderTemplate()}</div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  const dates = _mealWeekDates(_mealWeekOffset);
  const today = _mealToday();
  const st = _mealWeekStats(dates);
  const insight = _mealInsight();
  const goals = _mealGoals();
  // Nutrition across the days you logged this week (falls back to the plan).
  const nutDays = dates.map(dt => ({ dt, n: _mealDayNut(dt) }));
  const loggedDays = nutDays.filter(x => x.dt <= today && x.n.logged);
  const avgK = loggedDays.length ? loggedDays.reduce((a, x) => a + x.n.eatK, 0) / loggedDays.length : null;
  const avgP = loggedDays.length ? loggedDays.reduce((a, x) => a + x.n.eatP, 0) / loggedDays.length : null;
  const protHit = goals.protein ? loggedDays.filter(x => x.n.eatP >= goals.protein * 0.95).length : null;
  const planDays = nutDays.filter(x => x.n.totK || x.n.totP);
  const planAvgK = planDays.length ? planDays.reduce((a, x) => a + x.n.totK, 0) / planDays.length : null;
  const planAvgP = planDays.length ? planDays.reduce((a, x) => a + x.n.totP, 0) / planDays.length : null;

  const startD = _mealParse(dates[0]), endD = _mealParse(dates[6]);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = _mealWeekOffset === 0 ? 'This week'
    : _mealWeekOffset === -1 ? 'Last week'
      : _mealWeekOffset === 1 ? 'Next week' : `${fmt(startD)} – ${fmt(endD)}`;

  // Encouraging, never-shaming headline.
  let headline;
  if (st.checkedDays === 0 && st.plannedSlots === 0) headline = 'Plan your week — a little intention goes a long way. 🌱';
  else if (st.healthyDays >= 5) headline = `${st.healthyDays} healthy days — you're on a roll! 🔥`;
  else if (st.healthyDays >= 1) headline = `${st.healthyDays} healthy day${st.healthyDays > 1 ? 's' : ''} so far — keep the momentum.`;
  else headline = 'Fresh start — make today a healthy one. 💪';

  const insightHtml = insight
    ? `<div class="ml-insight"><div class="ic">${renderIcon('insights', null, 'style="width:18px;color:#fff"')}</div>
        <div class="tx">On days you ate well, your <b>${insight.metric}</b> averaged <b>${insight.well.toFixed(1)}</b> vs ${insight.not.toFixed(1)} on other days${insight.delta > 0.1 ? ` — that's <b>+${insight.delta.toFixed(1)}</b>. Eating well clearly lifts you.` : '.'}</div></div>`
    : `<div class="ml-insight" style="background:var(--surface-2);border-color:var(--border-color);"><div class="ic" style="background:var(--text-3)">${renderIcon('insights', null, 'style="width:18px;color:#fff"')}</div>
        <div class="tx" style="color:var(--text-2)">Log a few daily check-ins to unlock your personal <b style="color:var(--text-1)">food → energy</b> insight.</div></div>`;

  const rowsHtml = dates.map(dt => {
    const d = _mealParse(dt);
    const isToday = dt === today;
    const md = _mdFor(dt);
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dsub = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const mealCells = MEAL_SLOTS.map(s => {
      const eff = _mealEffective(dt, s.key);
      const mp = eff.mp;
      const planned = eff.text;
      const status = mp && mp.status;
      let cls, txt, lead = '<span class="dot"></span>', tail = '';
      if (status === 'as_planned') { cls = 'ok'; txt = planned || 'Eaten'; lead = '<span class="ck">✓</span>'; }
      else if (status === 'different') { cls = 'off'; txt = (mp.eaten && mp.eaten.trim()) || 'Ate something else'; }
      else if (status === 'skipped') { cls = 'skip'; txt = planned || 'Skipped'; lead = ''; }
      else if (planned && eff.fromTemplate) { cls = 'tmpl'; txt = planned; tail = '<span class="tm">USUAL</span>'; }
      else if (planned) { cls = 'planned'; txt = planned; }
      else { cls = 'empty'; txt = '+ Add meal'; lead = ''; }
      const nn = _mealNums(dt, s.key);
      if (cls !== 'empty' && cls !== 'skip' && nn.kcal != null) tail = `<span class="kc">${_mFmtK(nn.kcal)}</span>`;
      const act = planned ? `mealCycleStatus('${dt}','${s.key}')` : `openMealEditor('${dt}','${s.key}')`;
      const tip = planned ? `${escapeHtml(txt)} — tap to mark, pencil to edit` : 'Add a meal';
      return `<div class="ml-row-meal">
          <span class="ml-mlabel">${s.label}</span>
          <div class="ml-cell">
            <button class="ml-pill ${cls}" title="${tip}" onclick="${act}">${lead}<span class="tx">${escapeHtml(txt)}</span>${tail}</button>
            ${planned ? `<button class="ml-edit" title="Edit ${s.label.toLowerCase()}" aria-label="Edit ${s.label.toLowerCase()} for ${dsub}" onclick="openMealEditor('${dt}','${s.key}')">${renderIcon('edit', null, 'style="width:14px"')}</button>` : ''}
          </div>
        </div>`;
    }).join('');

    const checked = !!(md && (md.mood || md.energy || md.ate_healthy != null));
    let ciInner;
    if (checked) {
      const mood = MEAL_MOODS.find(m => m.v === +md.mood);
      ciInner = `${mood ? `<span title="Mood: ${mood.l}">${mood.e}</span>` : ''}${md.energy ? `<span class="ci-en" title="Energy">⚡${md.energy}</span>` : ''}${_mealHealthy(md) ? '<span class="ci-h" title="Ate healthy"></span>' : ''}`;
    } else {
      ciInner = '<span class="ci-add">+ Check in</span>';
    }

    const nut = _mealDayNut(dt);
    const past = dt <= today;
    const showK = past && nut.logged ? nut.eatK : nut.totK, showP = past && nut.logged ? nut.eatP : nut.totP;
    const nutLabel = past && nut.logged ? (nut.planK || nut.planP ? `+${_mFmtK(nut.planK)} planned` : 'eaten') : (nut.hasAny ? 'planned' : '');
    const nutCell = nut.hasAny
      ? `<button class="ml-nut ${past && nut.logged ? 'logged' : 'plan'}" onclick="openMealDayNutrition('${dt}')" title="Calories & protein for ${dsub}">
          ${_mealMeter(showK, goals.kcal, 'kcal', 'k')}${_mealMeter(showP, goals.protein, 'g', 'p')}
          ${nutLabel ? `<span class="ml-nut-s">${nutLabel}${nut.missing ? ` · ${nut.missing} without numbers` : ''}</span>` : ''}
        </button>`
      : `<button class="ml-nut empty" onclick="openMealDayNutrition('${dt}')"><span class="ci-add">+ Calories & protein</span></button>`;

    return `<div class="ml-row ${isToday ? 'today' : ''}">
        <div class="ml-rd"><div class="d-wd">${wd}${isToday ? '<span class="ml-today-pill">Today</span>' : ''}</div><div class="d-sub">${dsub}</div></div>
        ${mealCells}
        <div class="ml-row-nut"><span class="ml-mlabel">Calories / protein</span>${nutCell}</div>
        <div class="ml-row-ci"><span class="ml-mlabel">Mood / energy</span><button class="ml-rci ${checked ? 'done' : ''}" onclick="openMealCheckin('${dt}')">${ciInner}</button></div>
      </div>`;
  }).join('');

  main.innerHTML = `${MEALS_CSS}
    <div class="ml-wrap">
      ${_mealTabsBar()}
      <div class="ml-hero">
        <div class="ml-hero-top">
          <div class="ml-week-nav">
            <button class="ml-navbtn" onclick="mealNavWeek(-1)" title="Previous week">${renderIcon('arrow-left', null, 'style="width:18px"')}</button>
            <span class="ml-week-label">${weekLabel}</span>
            <button class="ml-navbtn" onclick="mealNavWeek(1)" title="Next week">${renderIcon('arrow-right', null, 'style="width:18px"')}</button>
            ${_mealWeekOffset !== 0 ? `<button class="ml-today-btn" onclick="mealGotoToday()">Today</button>` : ''}
          </div>
          <div class="ml-headline">${headline}</div>
        </div>
        <div class="ml-stats">
          <div class="ml-stat"><div class="ml-stat__v">${st.healthyDays}<small>/${st.elapsed}</small></div><div class="ml-stat__l">Healthy days</div></div>
          <div class="ml-stat"><div class="ml-stat__v">${st.plannedSlots ? st.adherence + '%' : '—'}</div><div class="ml-stat__l">Stuck to plan</div></div>
          <div class="ml-stat"><div class="ml-stat__v">${st.avgEnergy != null ? st.avgEnergy.toFixed(1) : '—'}<small>${st.avgEnergy != null ? '/5' : ''}</small></div><div class="ml-stat__l">Avg energy</div></div>
          <div class="ml-stat"><div class="ml-stat__v">${st.avgMood != null ? (MEAL_MOODS.find(m => m.v === Math.round(st.avgMood)) || {}).e || st.avgMood.toFixed(1) : '—'}</div><div class="ml-stat__l">Avg mood</div></div>
        </div>
        <div class="ml-nutbar">
          <div class="ml-nutbar-h"><span>Calories & protein</span><button class="ml-link" onclick="openMealGoals()">${goals.kcal || goals.protein ? 'Edit daily goals' : 'Set daily goals'}</button></div>
          <div class="ml-stats">
            <div class="ml-stat"><div class="ml-stat__v">${avgK != null ? _mFmtK(avgK) : (planAvgK ? _mFmtK(planAvgK) : '—')}${goals.kcal ? `<small>/${_mFmtK(goals.kcal)}</small>` : ''}</div><div class="ml-stat__l">${avgK != null ? 'Avg kcal / day eaten' : 'Avg kcal / day planned'}</div></div>
            <div class="ml-stat"><div class="ml-stat__v">${avgP != null ? _mFmtP(avgP) : (planAvgP ? _mFmtP(planAvgP) : '—')}<small>${goals.protein ? '/' + _mFmtP(goals.protein) : ''} g</small></div><div class="ml-stat__l">${avgP != null ? 'Avg protein / day eaten' : 'Avg protein / day planned'}</div></div>
            <div class="ml-stat"><div class="ml-stat__v">${protHit != null ? protHit + `<small>/${loggedDays.length}</small>` : '—'}</div><div class="ml-stat__l">${goals.protein ? 'Days protein goal hit' : 'Set a protein goal'}</div></div>
            <div class="ml-stat"><div class="ml-stat__v">${loggedDays.length}<small>/${st.elapsed}</small></div><div class="ml-stat__l">Days logged</div></div>
          </div>
        </div>
        ${insightHtml}
      </div>
      <div class="ml-thead"><span>Day</span>${MEAL_SLOTS.map(s => `<span>${s.label}</span>`).join('')}<span>Calories / Protein</span><span>Mood / Energy</span></div>
      <div class="ml-table">${rowsHtml}</div>
      ${_mtCount() === 0 ? `<div class="ml-hint" style="margin-top:16px">Eat roughly the same things each week? Set them once in <b style="color:var(--primary);cursor:pointer" onclick="mealSetTab('template')">My week</b> and every week fills in automatically.</div>` : ''}
    </div>`;
  if (window.lucide) lucide.createIcons();
}
window.renderMeals = renderMeals;

/* ── "My week" template grid ── */
function _renderTemplate() {
  const n = _mtCount();
  const rows = MEAL_WEEKDAYS.map(wd => {
    const cells = MEAL_SLOTS.map(sl => {
      const txt = _mtPlanned(wd.i, sl.key);
      return `<div class="ml-row-meal">
          <span class="ml-mlabel">${sl.label}</span>
          <div class="ml-cell">
            <button class="ml-pill ${txt ? 'planned' : 'empty'}" title="${escapeHtml(txt || 'Set your usual ' + sl.label.toLowerCase())}" onclick="openTemplateEditor(${wd.i},'${sl.key}')">
              ${txt ? '<span class="dot"></span>' : ''}<span class="tx">${escapeHtml(txt || '+ Set usual ' + sl.label.toLowerCase())}</span>
            </button>
          </div>
        </div>`;
    }).join('');
    return `<div class="ml-tgrid-row"><div class="ml-rd"><div class="d-wd">${wd.short}</div></div>${cells}</div>`;
  }).join('');

  return `
    <div class="ml-tintro">
      <div class="ic">🔁</div>
      <div class="tx">Set the meals you <b>usually</b> eat on each day. Every week fills in from this automatically — you just mark what you actually ate.${n ? ` <b>${n}</b> of ${MEAL_WEEKDAYS.length * MEAL_SLOTS.length} set.` : ''}</div>
    </div>
    <div class="ml-thead tmpl"><span>Day</span>${MEAL_SLOTS.map(s => `<span>${s.label}</span>`).join('')}</div>
    <div class="ml-tgrid">${rows}</div>`;
}

window.openTemplateEditor = function (weekday, slot) {
  const slotDef = MEAL_SLOTS.find(s => s.key === slot) || MEAL_SLOTS[0];
  const wd = MEAL_WEEKDAYS.find(w => w.i === +weekday) || MEAL_WEEKDAYS[0];
  const cur = _mtPlanned(weekday, slot);
  window._mealDraft = { _tmpl: true, weekday: +weekday, slot, planned: cur };
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">${slotDef.label}</div><div class="ml-modal-sub">Every ${wd.long}</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-field-l">What do you usually eat?</div>
        <input class="ml-input" id="mealPlanned" placeholder="Type, or pick from your foods…" value="${escapeHtml(cur)}" oninput="mealOnPlanInput(this.value)" autocomplete="off">
        <div class="ml-pick" id="mealPick"></div>
        <div class="ml-hint" style="margin-top:14px">This fills in every ${wd.long} automatically.</div>
        <div class="ml-actions">
          ${cur ? `<button class="ml-btn ghost" onclick="clearTemplateEntry()">Clear</button>` : ''}
          <button class="ml-btn primary" onclick="saveTemplateEntry()">Save</button>
        </div>
      </div>
    </div>`);
  mealRenderPick();
  setTimeout(() => { const i = document.getElementById('mealPlanned'); if (i && !cur) i.focus(); }, 60);
};
window.saveTemplateEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  const { weekday, slot, planned } = d;
  _mealCloseModal();
  await _mtSave(weekday, slot, planned);
  renderMeals();
  if (typeof showToast === 'function') showToast('Saved to your usual week');
};
window.clearTemplateEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  const { weekday, slot } = d;
  _mealCloseModal();
  await _mtSave(weekday, slot, '');
  renderMeals();
};

// Seed the template from the week currently on screen — the fastest way to make
// a week you already like repeatable.
window.mealTemplateFromWeek = async function () {
  const dates = _mealWeekDates(_mealWeekOffset);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    for (const s of MEAL_SLOTS) {
      const mp = _mpFor(dates[i], s.key);
      const pv = mp && mp.planned ? String(mp.planned).trim() : '';
      if (pv && pv !== _mtPlanned(i, s.key)) { await _mtSave(i, s.key, pv); n++; }
    }
  }
  renderMeals();
  if (typeof showToast === 'function') showToast(n ? `Set ${n} usual meal${n > 1 ? 's' : ''} from that week` : 'Nothing planned that week to copy');
};
window.mealTemplateClear = async function () {
  if (typeof confirm === 'function' && !confirm('Clear every meal in your usual week?')) return;
  for (const wd of MEAL_WEEKDAYS) for (const s of MEAL_SLOTS) if (_mtPlanned(wd.i, s.key)) await _mtSave(wd.i, s.key, '');
  renderMeals();
  if (typeof showToast === 'function') showToast('Template cleared');
};

/* ── "My foods" manager ── */
function _renderFoodsManager() {
  const items = _miAll().slice().sort(_miRank);
  if (items.length === 0) {
    const starters = ['Oats & fruit', 'Eggs & toast', 'Dal & rice', 'Salad bowl', 'Grilled chicken', 'Paneer & roti', 'Fruit & nuts', 'Veg stir-fry'];
    return `<div class="ml-foods">
      <div class="ml-foods-empty">
        <div style="font-size:36px">🥗</div>
        <div class="t">Build your “things I can eat” list</div>
        <div class="s">Add foods once, then pick them in a tap when planning meals. Start with a few:</div>
        <div class="ml-foods-starters">${starters.map(n => `<button class="ml-starter" onclick="mealAddStarter(${JSON.stringify(n)})">+ ${escapeHtml(n)}</button>`).join('')}</div>
        <button class="ml-btn primary" style="margin-top:18px;max-width:240px" onclick="openFoodEditor()">Add your own food</button>
      </div>
    </div>`;
  }
  const rows = items.map(it => {
    const hm = _mealHealthMeta(it.healthy);
    const slots = _miSlots(it);
    const slotTags = slots.length ? slots.map(s => `<span class="ml-ft">${(MEAL_SLOTS.find(x => x.key === s) || {}).label || s}</span>`).join('') : '<span class="ml-ft any">Any meal</span>';
    return `<div class="ml-food">
        <button class="ml-food-fav ${_mealFav(it) ? 'on' : ''}" title="Favorite" onclick="toggleMealItemFav('${it.id}')">${_mealFav(it) ? '★' : '☆'}</button>
        <div class="ml-food-main">
          <div class="ml-food-name">${escapeHtml(it.name || '')}</div>
          <div class="ml-food-meta"><span class="ml-hb" style="color:${hm.color};background:${hm.color}1f">${hm.emo} ${hm.label}</span>${(_mNum(it.kcal) != null || _mNum(it.protein) != null) ? `<span class="ml-fn">${_mNum(it.kcal) != null ? _mFmtK(_mNum(it.kcal)) + ' kcal' : ''}${_mNum(it.kcal) != null && _mNum(it.protein) != null ? ' · ' : ''}${_mNum(it.protein) != null ? _mFmtP(_mNum(it.protein)) + ' g protein' : ''}</span>` : `<button class="ml-fn add" onclick="openFoodEditor('${it.id}')">+ calories</button>`}${slotTags}${Number(it.use_count) ? `<span class="ml-uc">${it.use_count}× used</span>` : ''}</div>
        </div>
        <button class="ml-food-x" title="Edit" onclick="openFoodEditor('${it.id}')">${renderIcon('edit', null, 'style="width:15px"')}</button>
        <button class="ml-food-x danger" title="Delete" onclick="deleteMealItem('${it.id}')">${renderIcon('trash', null, 'style="width:15px"')}</button>
      </div>`;
  }).join('');
  const fav = items.filter(_mealFav).length;
  return `<div class="ml-foods">
      <div class="ml-foods-head"><span>${items.length} food${items.length > 1 ? 's' : ''}${fav ? ` · ${fav} favorite${fav > 1 ? 's' : ''}` : ''}</span></div>
      <div class="ml-foods-list">${rows}</div>
    </div>`;
}
window.mealAddStarter = async function (name) { await _miCreate({ name, slots: '', healthy: 'healthy', favorite: false }); renderMeals(); };

window.openFoodEditor = function (id) {
  const it = id ? _miAll().find(i => String(i.id) === String(id)) : null;
  window._mealDraft = { _food: true, id: it ? it.id : null, name: it ? (it.name || '') : '', slots: it ? _miSlots(it) : [], healthy: it ? (it.healthy || 'ok') : 'healthy', favorite: it ? _mealFav(it) : false, kcal: it ? _mNum(it.kcal) : null, protein: it ? _mNum(it.protein) : null };
  const d = window._mealDraft;
  const slotBtns = MEAL_SLOTS.map(s => `<button class="ml-pickslot ${d.slots.includes(s.key) ? 'on' : ''}" data-s="${s.key}" onclick="foodToggleSlot('${s.key}')">${s.label}</button>`).join('');
  const healthBtns = MEAL_HEALTH.map(h => `<button class="ml-pickhealth ${d.healthy === h.key ? 'on' : ''}" data-h="${h.key}" style="--hc:${h.color}" onclick="foodSetHealth('${h.key}')">${h.emo} ${h.label}</button>`).join('');
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">${it ? 'Edit food' : 'Add food'}</div><div class="ml-modal-sub">Things I can eat</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-field-l">Food name</div>
        <input class="ml-input" id="foodName" placeholder="e.g. Oats with fruit & nuts" value="${escapeHtml(d.name)}" oninput="window._mealDraft.name=this.value">
        <div class="ml-field-l">Per usual serving <span style="font-weight:500;text-transform:none;color:var(--text-3)">(optional)</span></div>
        <div class="ml-nutin">
          <label><span>Calories</span><input class="ml-input" type="number" inputmode="numeric" min="0" step="10" placeholder="kcal" value="${d.kcal ?? ''}" oninput="window._mealDraft.kcal=this.value"></label>
          <label><span>Protein</span><div class="ml-unit"><input class="ml-input" type="number" inputmode="decimal" min="0" step="1" placeholder="g" value="${d.protein ?? ''}" oninput="window._mealDraft.protein=this.value"><em>g</em></div></label>
        </div>
        <div class="ml-field-l">Good for <span style="font-weight:500;text-transform:none;color:var(--text-3)">(leave all off = any meal)</span></div>
        <div class="ml-seg" id="foodSlotSeg">${slotBtns}</div>
        <div class="ml-field-l">How healthy is it?</div>
        <div class="ml-seg" id="foodHealthSeg">${healthBtns}</div>
        <label class="ml-fav-row"><input type="checkbox" id="foodFav" ${d.favorite ? 'checked' : ''} onchange="window._mealDraft.favorite=this.checked"> <span>⭐ Favorite — show first when picking</span></label>
        <div class="ml-actions">
          ${it ? `<button class="ml-btn ghost" onclick="deleteMealItem('${it.id}');closeMealModal()">Delete</button>` : ''}
          <button class="ml-btn primary" onclick="saveFoodItem()">Save</button>
        </div>
      </div>
    </div>`);
  setTimeout(() => { const i = document.getElementById('foodName'); if (i && !d.name) i.focus(); }, 60);
};
window.foodToggleSlot = function (s) {
  const d = window._mealDraft; if (!d) return;
  const i = d.slots.indexOf(s); if (i >= 0) d.slots.splice(i, 1); else d.slots.push(s);
  document.querySelectorAll('#foodSlotSeg .ml-pickslot').forEach(b => b.classList.toggle('on', d.slots.includes(b.dataset.s)));
};
window.foodSetHealth = function (h) {
  window._mealDraft.healthy = h;
  document.querySelectorAll('#foodHealthSeg .ml-pickhealth').forEach(b => b.classList.toggle('on', b.dataset.h === h));
};
window.saveFoodItem = async function () {
  const d = window._mealDraft; if (!d) return;
  const name = (d.name || '').trim();
  if (!name) { if (typeof showToast === 'function') showToast('Name the food first', 'error'); return; }
  const fields = { name, slots: (d.slots || []).join(','), healthy: d.healthy || 'ok', favorite: !!d.favorite, kcal: _mNum(d.kcal), protein: _mNum(d.protein) };
  _mealCloseModal();
  if (d.id) await _miUpdate(d.id, fields); else await _miCreate(fields);
  renderMeals();
  if (typeof showToast === 'function') showToast('Saved to My foods');
};

/* ── Week navigation ── */
window.mealNavWeek = function (dir) { _mealWeekOffset += dir; renderMeals(); };
window.mealGotoToday = function () { _mealWeekOffset = 0; renderMeals(); };

/* ── Modal plumbing ── */
function _mealCloseModal() { const o = document.getElementById('mealModalOv'); if (o) o.remove(); window._mealDraft = null; }
window.closeMealModal = _mealCloseModal;
function _mealMountModal(html) {
  // Remove a previous overlay WITHOUT nulling _mealDraft (the caller has just set it).
  const old = document.getElementById('mealModalOv'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'ml-modal-ov'; ov.id = 'mealModalOv';
  ov.innerHTML = html;
  ov.addEventListener('pointerdown', e => { if (e.target === ov) _mealCloseModal(); });
  document.body.appendChild(ov);
  if (window.lucide) lucide.createIcons();
}

/* ── Meal editor: planned + did-you-eat-it ── */
window.openMealEditor = function (date, slot) {
  const slotDef = MEAL_SLOTS.find(s => s.key === slot) || MEAL_SLOTS[0];
  const mp = _mpFor(date, slot) || {};
  const _n0 = _mealNums(date, slot);
  window._mealDraft = { date, slot, planned: mp.planned || _mealEffective(date, slot).text || '', eaten: mp.eaten || '', status: mp.status || '', kcal: _n0.kcal, protein: _n0.protein, numsTouched: false };
  const d = _mealParse(date);
  const dateLbl = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">${slotDef.label}</div><div class="ml-modal-sub">${dateLbl}</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-field-l">What's the plan?</div>
        <input class="ml-input" id="mealPlanned" placeholder="Type, or pick from your foods…" value="${escapeHtml(window._mealDraft.planned)}" oninput="mealOnPlanInput(this.value)" autocomplete="off">
        <div class="ml-pick" id="mealPick"></div>
        <div class="ml-nutin">
          <label><span>Calories</span><input class="ml-input" id="mealKcal" type="number" inputmode="numeric" min="0" step="10" placeholder="kcal" value="${window._mealDraft.kcal ?? ''}" oninput="mealNumInput('kcal',this.value)"></label>
          <label><span>Protein</span><div class="ml-unit"><input class="ml-input" id="mealProt" type="number" inputmode="decimal" min="0" step="1" placeholder="g" value="${window._mealDraft.protein ?? ''}" oninput="mealNumInput('protein',this.value)"><em>g</em></div></label>
        </div>
        <div class="ml-nut-hint" id="mealNutHint"></div>
        <div class="ml-field-l">Did you eat it?</div>
        <div class="ml-seg" id="mealStatusSeg">
          <button class="s-ok ${window._mealDraft.status === 'as_planned' ? 'on' : ''}" data-s="as_planned" onclick="mealSetStatus('as_planned')"><span class="em">✅</span>Ate it</button>
          <button class="s-diff ${window._mealDraft.status === 'different' ? 'on' : ''}" data-s="different" onclick="mealSetStatus('different')"><span class="em">🔁</span>Ate other</button>
          <button class="s-skip ${window._mealDraft.status === 'skipped' ? 'on' : ''}" data-s="skipped" onclick="mealSetStatus('skipped')"><span class="em">⏭️</span>Skipped</button>
        </div>
        <div id="mealEatenWrap" style="display:${window._mealDraft.status === 'different' ? 'block' : 'none'}">
          <div class="ml-field-l">What did you eat instead?</div>
          <input class="ml-input" id="mealEaten" placeholder="e.g. Toast & eggs out" value="${escapeHtml(window._mealDraft.eaten)}" oninput="window._mealDraft.eaten=this.value;_mealDraftAutofill()">
        </div>
        <div class="ml-actions">
          ${(mp.planned || mp.status) ? `<button class="ml-btn ghost" onclick="clearMealEntry()">Clear</button>` : ''}
          <button class="ml-btn primary" onclick="saveMealEntry()">Save</button>
        </div>
      </div>
    </div>`);
  mealRenderPick();
  _mealNutHint();
  setTimeout(() => { const i = document.getElementById('mealPlanned'); if (i && window._mealDraft && !window._mealDraft.planned) i.focus(); }, 60);
};
window.mealNumInput = function (k, v) { const d = window._mealDraft; if (!d) return; d[k] = _mNum(v); d.numsTouched = true; _mealNutHint(); };
// The food the numbers belong to: what you ate instead, else the plan.
function _mealDraftFood(d) { return ((d.status === 'different' ? d.eaten : d.planned) || '').trim(); }
// Pull numbers from My foods unless the user has typed their own.
function _mealDraftAutofill() {
  const d = window._mealDraft; if (!d || d.numsTouched || d._tmpl) return;
  const n = _miNums(_mealDraftFood(d));
  d.kcal = n.kcal; d.protein = n.protein;
  const k = document.getElementById('mealKcal'), p = document.getElementById('mealProt');
  if (k) k.value = n.kcal ?? ''; if (p) p.value = n.protein ?? '';
  _mealNutHint();
}
function _mealNutHint() {
  const el = document.getElementById('mealNutHint'); const d = window._mealDraft; if (!el || !d) return;
  const food = _mealDraftFood(d); const n = _miNums(food);
  if (!food) { el.textContent = ''; return; }
  if (n.item && (n.kcal != null || n.protein != null)) {
    const same = _mNum(d.kcal) === n.kcal && _mNum(d.protein) === n.protein;
    el.innerHTML = same ? `From <b>My foods</b> — change it there to update every day you eat it.` : `Just for this meal · My foods says ${_mFmtK(n.kcal)} kcal, ${_mFmtP(n.protein)} g.`;
  } else if (n.item) el.innerHTML = `Type the numbers once — they'll be saved to <b>${escapeHtml(n.item.name)}</b> in My foods.`;
  else el.innerHTML = `Optional. Save this food to My foods and the numbers fill in by themselves next time.`;
}

/* Picker: chips of your foods (slot-aware, favorites & most-used first) + live search
   + "recently eaten" history + save-new-to-library. */
function _mealChip(it) {
  const hm = _mealHealthMeta(it.healthy);
  return `<button class="ml-chip" data-food="${escapeHtml(it.name || '')}" onclick="mealPickFoodEl(this)" title="${hm.label}"><span class="cd" style="background:${hm.color}"></span>${escapeHtml(it.name || '')}${_mealFav(it) ? ' <span class="fv">★</span>' : ''}</button>`;
}
function _mealHistChip(n) {
  return `<button class="ml-chip hist" data-food="${escapeHtml(n)}" onclick="mealPickFoodEl(this)">${escapeHtml(n)}</button>`;
}
window.mealRenderPick = function () {
  const el = document.getElementById('mealPick'); if (!el) return;
  const d = window._mealDraft; if (!d) return;
  const q = (d.planned || '').trim().toLowerCase();
  const lib = _miForSlot(d.slot);
  let html = '';
  if (!q) {
    const top = lib.slice(0, 10);
    if (top.length) html += `<div class="ml-pick-lbl">Your foods${lib.length > 10 ? ' · top picks' : ''}</div><div class="ml-chips">${top.map(_mealChip).join('')}</div>`;
    const hist = _miHistory(d.slot);
    if (hist.length) html += `<div class="ml-pick-lbl">Recently eaten</div><div class="ml-chips">${hist.map(_mealHistChip).join('')}</div>`;
    if (!top.length && !hist.length) html += `<div class="ml-pick-empty">No saved foods yet — type one above, or add some in <b>My foods</b>.</div>`;
  } else {
    const matches = lib.filter(it => (it.name || '').toLowerCase().includes(q)).slice(0, 8);
    const hist = _miHistory(d.slot).filter(n => n.toLowerCase().includes(q)).slice(0, 5);
    if (matches.length) html += `<div class="ml-chips">${matches.map(_mealChip).join('')}</div>`;
    if (hist.length) html += `<div class="ml-chips">${hist.map(_mealHistChip).join('')}</div>`;
    if (!_miByName(d.planned) && (d.planned || '').trim()) {
      html += `<button class="ml-pick-add" onclick="mealAddPlannedToLibrary()">${renderIcon('plus', null, 'style="width:14px"')} Save “${escapeHtml((d.planned || '').trim())}” to My foods</button>`;
    }
  }
  el.innerHTML = html;
  if (window.lucide) lucide.createIcons();
};
window.mealOnPlanInput = function (val) { if (window._mealDraft) window._mealDraft.planned = val; mealRenderPick(); _mealDraftAutofill(); };
window.mealPickFood = function (name) {
  const d = window._mealDraft; if (!d) return;
  d.planned = name;
  const inp = document.getElementById('mealPlanned'); if (inp) inp.value = name;
  _miBumpUse(name);
  if (d.status !== 'different') { d.numsTouched = false; _mealDraftAutofill(); }
  mealRenderPick();
};
window.mealPickFoodEl = function (el) { if (el && el.dataset) mealPickFood(el.dataset.food || ''); };
window.mealAddPlannedToLibrary = async function () {
  const d = window._mealDraft; if (!d) return;
  const name = (d.planned || '').trim(); if (!name) return;
  await _miCreate({ name, slots: d.slot, healthy: 'ok', favorite: false, kcal: _mNum(d.kcal), protein: _mNum(d.protein) });
  mealRenderPick(); _mealNutHint();
  if (typeof showToast === 'function') showToast('Added to My foods');
};

/* Inline marking: one tap on a meal cell walks it through the states, so a normal
   day is three taps and never opens a modal. A template-filled cell is committed
   to a real plan row on the first tap; walking it back to unmarked drops that copy
   again so the cell keeps tracking the template. */
window.mealCycleStatus = async function (date, slot) {
  const eff = _mealEffective(date, slot);
  const text = eff.text;
  if (!text) { openMealEditor(date, slot); return; }
  const cur = (eff.mp && eff.mp.status) || '';
  const next = cur === '' ? 'as_planned'
    : cur === 'as_planned' ? 'different'
      : cur === 'different' ? 'skipped' : '';
  if (!next) {
    const tmpl = _mtPlanned(_mealWeekdayIdx(date), slot);
    if (tmpl && text === tmpl) await _mpSave(date, slot, { planned: '', eaten: '', status: null });
    else await _mpSave(date, slot, { status: null, eaten: '' });
  } else if (next === 'as_planned') {
    await _mpSave(date, slot, { planned: text, eaten: text, status: 'as_planned' });
    _miBumpUse(text);
  } else {
    const f = { planned: text, eaten: '', status: next };
    if (next === 'different') { f.kcal = null; f.protein = null; }
    await _mpSave(date, slot, f);
  }
  renderMeals();
};

window.mealSetStatus = function (s) {
  const d = window._mealDraft; if (!d) return;
  d.status = d.status === s ? '' : s;
  document.querySelectorAll('#mealStatusSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === d.status));
  const w = document.getElementById('mealEatenWrap'); if (w) w.style.display = d.status === 'different' ? 'block' : 'none';
  d.numsTouched = false; _mealDraftAutofill();
};
window.saveMealEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  const fields = { planned: (d.planned || '').trim(), status: d.status || null };
  if (d.status === 'as_planned') fields.eaten = fields.planned;
  else if (d.status === 'different') fields.eaten = (d.eaten || '').trim();
  else fields.eaten = '';
  const food = _mealDraftFood(d);
  const taught = _mealTeachFood(food, d.kcal, d.protein);
  Object.assign(fields, _mealOverride(food, d.kcal, d.protein));
  _mealCloseModal();
  await _mpSave(d.date, d.slot, fields);
  renderMeals();
  if (typeof showToast === 'function') showToast(taught ? `Saved — numbers remembered for ${food}` : 'Saved');
};
window.clearMealEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  _mealCloseModal();
  await _mpSave(d.date, d.slot, { planned: '', eaten: '', status: null, kcal: null, protein: null });
  renderMeals();
};

/* ── Daily check-in: mood + energy + healthy ── */
window.openMealCheckin = function (date) {
  const md = _mdFor(date) || {};
  window._mealDraft = { date, mood: +md.mood || 0, energy: +md.energy || 0, ate_healthy: _mealHealthy(md) ? true : (md.ate_healthy === false ? false : null), note: md.note || '' };
  // Smart: if not checked in yet, pre-fill the "ate healthy?" toggle from today's foods.
  let healthHint = '';
  if (window._mealDraft.ate_healthy === null) {
    const hint = _mealDayHealthHint(date);
    if (hint !== null) { window._mealDraft.ate_healthy = hint; healthHint = 'Suggested from today’s meals — tap to change'; }
  }
  const d = _mealParse(date);
  const dateLbl = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const moodBtns = MEAL_MOODS.map(m => `<button class="${window._mealDraft.mood === m.v ? 'on' : ''}" data-v="${m.v}" onclick="mealSetMood(${m.v})">${m.e}<span class="lb">${m.l}</span></button>`).join('');
  const enBtns = MEAL_ENERGY.map(e => `<button class="${window._mealDraft.energy === e.v ? 'on' : ''}" data-v="${e.v}" onclick="mealSetEnergy(${e.v})">${'⚡'}<span class="lb">${e.v}</span></button>`).join('');
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">Daily check-in</div><div class="ml-modal-sub">${dateLbl}</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-field-l">How's your mood?</div>
        <div class="ml-scale" id="mealMoodScale">${moodBtns}</div>
        <div class="ml-field-l">Energy level</div>
        <div class="ml-scale energy" id="mealEnergyScale">${enBtns}</div>
        <div class="ml-field-l">Did you eat healthy today?</div>
        <div class="ml-toggle" id="mealHealthyTg">
          <button class="yes ${window._mealDraft.ate_healthy === true ? 'on' : ''}" onclick="mealSetHealthy(true)">Yes 🥗</button>
          <button class="no ${window._mealDraft.ate_healthy === false ? 'on' : ''}" onclick="mealSetHealthy(false)">Not really</button>
        </div>
        ${healthHint ? `<div class="ml-hint">${healthHint}</div>` : ''}
        <div class="ml-actions">
          <button class="ml-btn primary" onclick="saveMealCheckin()">Save check-in</button>
        </div>
      </div>
    </div>`);
};
window.mealSetMood = function (v) { window._mealDraft.mood = v; document.querySelectorAll('#mealMoodScale button').forEach(b => b.classList.toggle('on', +b.dataset.v === v)); };
window.mealSetEnergy = function (v) { window._mealDraft.energy = v; document.querySelectorAll('#mealEnergyScale button').forEach(b => b.classList.toggle('on', +b.dataset.v === v)); };
window.mealSetHealthy = function (val) {
  const d = window._mealDraft; d.ate_healthy = d.ate_healthy === val ? null : val;
  const tg = document.getElementById('mealHealthyTg');
  if (tg) { tg.querySelector('.yes').classList.toggle('on', d.ate_healthy === true); tg.querySelector('.no').classList.toggle('on', d.ate_healthy === false); }
};
window.saveMealCheckin = async function () {
  const d = window._mealDraft; if (!d) return;
  const fields = { mood: d.mood || null, energy: d.energy || null, ate_healthy: d.ate_healthy };
  _mealCloseModal();
  await _mdSave(d.date, fields);
  renderMeals();
  if (typeof showToast === 'function') showToast('Check-in saved ✓');
};

// Does today's actual eating lean healthy? Looks up each meal's food in the library.
// Returns true (lean healthy) / false (lean treat) / null (not enough tagged foods).
function _mealDayHealthHint(date) {
  let healthy = 0, treat = 0, n = 0;
  MEAL_SLOTS.forEach(s => {
    const eff = _mealEffective(date, s.key);
    const mp = eff.mp;
    const food = ((mp && mp.status === 'different') ? mp.eaten : eff.text) || '';
    const it = _miByName(food); if (!it || !it.healthy) return;
    n++;
    if (it.healthy === 'healthy') healthy++; else if (it.healthy === 'treat') treat++;
  });
  if (n === 0) return null;
  return healthy >= treat && healthy > 0;
}

/* ── Extras: shopping list + repeat last week ── */
window.mealShoppingList = function () {
  const dates = _mealWeekDates(_mealWeekOffset);
  const counts = {};
  dates.forEach(dt => MEAL_SLOTS.forEach(s => { const t = _mealEffective(dt, s.key).text; if (t) counts[t] = (counts[t] || 0) + 1; }));
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  window._mealShopText = items.map(([n, c]) => `• ${n}${c > 1 ? ` (x${c})` : ''}`).join('\n');
  const body = items.length
    ? `<div class="ml-shop">${items.map(([n, c]) => `<label class="ml-shop-row"><input type="checkbox"><span>${escapeHtml(n)}</span>${c > 1 ? `<span class="ml-shop-c">×${c}</span>` : ''}</label>`).join('')}</div>`
    : `<div class="ml-pick-empty" style="padding:24px 12px;text-align:center">Nothing planned this week yet — add some meals first.</div>`;
  _mealMountModal(`<div class="ml-modal">
      <div class="ml-modal-h"><div><div class="ml-modal-title">🛒 Shopping list</div><div class="ml-modal-sub">${items.length} item${items.length !== 1 ? 's' : ''} planned this week</div></div><button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button></div>
      <div class="ml-modal-b">${body}${items.length ? `<div class="ml-actions"><button class="ml-btn primary" onclick="mealCopyShop()">Copy list</button></div>` : ''}</div>
    </div>`);
};
window.mealCopyShop = function () { try { navigator.clipboard.writeText(window._mealShopText || ''); if (typeof showToast === 'function') showToast('List copied'); } catch (e) { } };

window.mealRepeatLastWeek = async function () {
  const cur = _mealWeekDates(_mealWeekOffset);
  const prev = _mealWeekDates(_mealWeekOffset - 1);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    for (const s of MEAL_SLOTS) {
      const curMp = _mpFor(cur[i], s.key);
      if (curMp && curMp.planned && curMp.planned.trim()) continue; // never overwrite
      const prevMp = _mpFor(prev[i], s.key);
      const pv = prevMp && prevMp.planned ? prevMp.planned.trim() : '';
      if (pv) { await _mpSave(cur[i], s.key, { planned: pv }); n++; }
    }
  }
  renderMeals();
  if (typeof showToast === 'function') showToast(n ? `Copied ${n} meal${n > 1 ? 's' : ''} from last week` : 'Nothing to copy from last week');
};


/* ── Day sheet: every meal's calories & protein, plus extras ─────────────── */
window.openMealDayNutrition = function (date) {
  const d = _mealParse(date);
  const dateLbl = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const md = _mdFor(date) || {};
  const rows = MEAL_SLOTS.map(s => {
    const n = _mealNums(date, s.key);
    return { slot: s.key, label: s.label, food: n.food || '', state: n.state, kcal: n.kcal, protein: n.protein, k0: n.kcal, p0: n.protein };
  });
  window._mealDraft = { _day: true, date, rows, extraK: _mNum(md.extra_kcal), extraP: _mNum(md.extra_protein) };
  const stLbl = { eaten: 'eaten', planned: 'planned', skipped: 'skipped', none: '' };
  const rowHtml = (r, i) => `<div class="ml-dn-row">
      <div class="ml-dn-l"><div class="ml-dn-slot">${r.label}${stLbl[r.state] ? `<span class="ml-dn-st ${r.state}">${stLbl[r.state]}</span>` : ''}</div>
        <div class="ml-dn-food ${r.food ? '' : 'none'}">${r.food ? escapeHtml(r.food) : 'Nothing planned'}</div></div>
      <input class="ml-input" type="number" inputmode="numeric" min="0" step="10" placeholder="kcal" value="${r.state === 'skipped' ? '' : (r.kcal ?? '')}" ${r.state === 'skipped' ? 'disabled' : ''} oninput="mealDayNum(${i},'kcal',this.value)">
      <div class="ml-unit"><input class="ml-input" type="number" inputmode="decimal" min="0" step="1" placeholder="g" value="${r.state === 'skipped' ? '' : (r.protein ?? '')}" ${r.state === 'skipped' ? 'disabled' : ''} oninput="mealDayNum(${i},'protein',this.value)"><em>g</em></div>
    </div>`;
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">Calories & protein</div><div class="ml-modal-sub">${dateLbl}</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-dn-head"><span>Meal</span><span>kcal</span><span>Protein</span></div>
        ${rows.map(rowHtml).join('')}
        <div class="ml-dn-row">
          <div class="ml-dn-l"><div class="ml-dn-slot">Extras</div><div class="ml-dn-food none">Snacks, drinks, anything else</div></div>
          <input class="ml-input" type="number" inputmode="numeric" min="0" step="10" placeholder="kcal" value="${window._mealDraft.extraK ?? ''}" oninput="mealDayNum(-1,'kcal',this.value)">
          <div class="ml-unit"><input class="ml-input" type="number" inputmode="decimal" min="0" step="1" placeholder="g" value="${window._mealDraft.extraP ?? ''}" oninput="mealDayNum(-1,'protein',this.value)"><em>g</em></div>
        </div>
        <div class="ml-dn-tot" id="mealDayTot"></div>
        <div class="ml-dn-note">Meals not marked yet count as <b>planned</b>. Numbers for a food in My foods fill in by themselves; typing here changes just this day (and teaches the food if it has none yet).</div>
        <div class="ml-actions">
          <button class="ml-btn ghost" onclick="openMealGoals('${date}')">Goals</button>
          <button class="ml-btn primary" onclick="saveMealDayNutrition()">Save</button>
        </div>
      </div>
    </div>`);
  _mealDayTotals();
};
window.mealDayNum = function (i, k, v) {
  const d = window._mealDraft; if (!d || !d._day) return;
  if (i < 0) d[k === 'kcal' ? 'extraK' : 'extraP'] = _mNum(v);
  else d.rows[i][k] = _mNum(v);
  _mealDayTotals();
};
function _mealDayTotals() {
  const d = window._mealDraft, el = document.getElementById('mealDayTot'); if (!d || !el) return;
  let k = d.extraK || 0, p = d.extraP || 0, pk = 0, pp = 0;
  d.rows.forEach(r => { if (r.state === 'eaten') { k += r.kcal || 0; p += r.protein || 0; } else if (r.state === 'planned') { pk += r.kcal || 0; pp += r.protein || 0; } });
  const g = _mealGoals();
  el.innerHTML = `${_mealMeter(k + pk, g.kcal, 'kcal', 'k')}${_mealMeter(p + pp, g.protein, 'g', 'p')}
    ${pk || pp ? `<div class="ml-nut-s" style="grid-column:1/-1">Includes ${_mFmtK(pk)} kcal · ${_mFmtP(pp)} g still planned</div>` : ''}
    ${g.kcal || g.protein ? `<div class="ml-nut-s" style="grid-column:1/-1">${g.protein ? (p + pp >= g.protein ? 'Protein goal reached 💪' : `${_mFmtP(g.protein - p - pp)} g protein to go`) : ''}${g.kcal && g.protein ? ' · ' : ''}${g.kcal ? (k + pk > g.kcal ? `${_mFmtK(k + pk - g.kcal)} kcal over` : `${_mFmtK(g.kcal - k - pk)} kcal left`) : ''}</div>` : ''}`;
}
window.saveMealDayNutrition = async function () {
  const d = window._mealDraft; if (!d || !d._day) return;
  const date = d.date;
  _mealCloseModal();
  let taught = 0;
  for (const r of d.rows) {
    if (r.state === 'skipped') continue;
    if (_mNum(r.kcal) === r.k0 && _mNum(r.protein) === r.p0) continue;   // untouched
    if (!r.food && r.kcal == null && r.protein == null) continue;
    if (_mealTeachFood(r.food, r.kcal, r.protein)) taught++;
    const o = _mealOverride(r.food, r.kcal, r.protein);
    const mp = _mpFor(date, r.slot);
    const f = Object.assign({}, o);
    if (!mp || !mp.planned) { f.planned = r.food || ''; }
    await _mpSave(date, r.slot, f);
  }
  const md = _mdFor(date) || {};
  if (_mNum(md.extra_kcal) !== d.extraK || _mNum(md.extra_protein) !== d.extraP) await _mdSave(date, { extra_kcal: d.extraK, extra_protein: d.extraP });
  renderMeals();
  if (typeof showToast === 'function') showToast(taught ? `Saved — numbers remembered for ${taught} food${taught > 1 ? 's' : ''}` : 'Saved');
};

/* ── Daily goals ── */
window.openMealGoals = function (backToDate) {
  const g = _mealGoals();
  window._mealDraft = { _goals: true, kcal: g.kcal, protein: g.protein, back: backToDate || null };
  _mealMountModal(`
    <div class="ml-modal">
      <div class="ml-modal-h">
        <div><div class="ml-modal-title">Daily goals</div><div class="ml-modal-sub">What you aim for each day</div></div>
        <button class="ml-modal-x" onclick="closeMealModal()">${renderIcon('x', null, 'style="width:18px"')}</button>
      </div>
      <div class="ml-modal-b">
        <div class="ml-nutin">
          <label><span>Calories</span><input class="ml-input" type="number" inputmode="numeric" min="0" step="50" placeholder="e.g. 2200" value="${g.kcal ?? ''}" oninput="window._mealDraft.kcal=_mNum(this.value)"></label>
          <label><span>Protein</span><div class="ml-unit"><input class="ml-input" type="number" inputmode="decimal" min="0" step="5" placeholder="e.g. 120" value="${g.protein ?? ''}" oninput="window._mealDraft.protein=_mNum(this.value)"><em>g</em></div></label>
        </div>
        <div class="ml-dn-note">A common starting point for someone training regularly is about 1.6–2 g of protein per kg of body weight. Leave a box empty if you don't want to track it.</div>
        <div class="ml-actions"><button class="ml-btn primary" onclick="saveMealGoals()">Save goals</button></div>
      </div>
    </div>`);
};
window.saveMealGoals = async function () {
  const d = window._mealDraft; if (!d || !d._goals) return;
  const back = d.back;
  _mealCloseModal();
  await _mealSaveGoals({ kcal: d.kcal, protein: d.protein });
  renderMeals();
  if (back) openMealDayNutrition(back);
  if (typeof showToast === 'function') showToast('Goals saved');
};
