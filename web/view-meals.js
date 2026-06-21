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

/* ── Weekly stats + lifetime insight ── */
function _mealWeekStats(dates) {
  const today = _mealToday();
  let plannedSlots = 0, followed = 0, healthyDays = 0, checkedDays = 0, energySum = 0, energyN = 0, moodSum = 0, moodN = 0;
  dates.forEach(dt => {
    MEAL_SLOTS.forEach(s => {
      const mp = _mpFor(dt, s.key);
      if (mp && mp.planned && mp.planned.trim()) {
        plannedSlots++;
        if (mp.status === 'as_planned') followed++;
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
.ml-wrap { max-width:1180px; margin:0 auto; padding-bottom:40px; }
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

.ml-thead { display:grid; grid-template-columns:148px 1fr 1fr 1fr 150px; gap:14px; padding:2px 18px 7px; }
.ml-thead span { font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--text-3); }
.ml-table { display:flex; flex-direction:column; gap:10px; }
.ml-row { display:grid; grid-template-columns:148px 1fr 1fr 1fr 150px; gap:14px; align-items:center; background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:11px 18px; box-shadow:0 1px 2px rgba(0,0,0,.03); transition:box-shadow .16s; }
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
</style>`;

/* ── Render ── */
function renderMeals() {
  const main = document.getElementById('main');
  if (!main) return;
  const dates = _mealWeekDates(_mealWeekOffset);
  const today = _mealToday();
  const st = _mealWeekStats(dates);
  const insight = _mealInsight();

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
      const mp = _mpFor(dt, s.key);
      const planned = mp && mp.planned ? mp.planned.trim() : '';
      const status = mp && mp.status;
      let cls, txt, lead = '<span class="dot"></span>';
      if (status === 'as_planned') { cls = 'ok'; txt = planned || 'Eaten'; lead = '<span class="ck">✓</span>'; }
      else if (status === 'different') { cls = 'off'; txt = (mp.eaten && mp.eaten.trim()) || 'Ate something else'; }
      else if (status === 'skipped') { cls = 'skip'; txt = planned || 'Skipped'; lead = ''; }
      else if (planned) { cls = 'planned'; txt = planned; }
      else { cls = 'empty'; txt = '+ Add meal'; lead = ''; }
      return `<div class="ml-row-meal">
          <span class="ml-mlabel">${s.label}</span>
          <button class="ml-pill ${cls}" title="${escapeHtml(txt)}" onclick="openMealEditor('${dt}','${s.key}')">${lead}<span class="tx">${escapeHtml(txt)}</span></button>
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

    return `<div class="ml-row ${isToday ? 'today' : ''}">
        <div class="ml-rd"><div class="d-wd">${wd}${isToday ? '<span class="ml-today-pill">Today</span>' : ''}</div><div class="d-sub">${dsub}</div></div>
        ${mealCells}
        <div class="ml-row-ci"><span class="ml-mlabel">Mood / energy</span><button class="ml-rci ${checked ? 'done' : ''}" onclick="openMealCheckin('${dt}')">${ciInner}</button></div>
      </div>`;
  }).join('');

  main.innerHTML = `${MEALS_CSS}
    <div class="ml-wrap">
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
        ${insightHtml}
      </div>
      <div class="ml-thead"><span>Day</span><span>Breakfast</span><span>Lunch</span><span>Dinner</span><span>Mood / Energy</span></div>
      <div class="ml-table">${rowsHtml}</div>
    </div>`;
  if (window.lucide) lucide.createIcons();
}
window.renderMeals = renderMeals;

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
  window._mealDraft = { date, slot, planned: mp.planned || '', eaten: mp.eaten || '', status: mp.status || '' };
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
        <input class="ml-input" id="mealPlanned" placeholder="e.g. Oats with fruit & nuts" value="${escapeHtml(window._mealDraft.planned)}" oninput="window._mealDraft.planned=this.value">
        <div class="ml-field-l">Did you eat it?</div>
        <div class="ml-seg" id="mealStatusSeg">
          <button class="s-ok ${window._mealDraft.status === 'as_planned' ? 'on' : ''}" data-s="as_planned" onclick="mealSetStatus('as_planned')"><span class="em">✅</span>Ate it</button>
          <button class="s-diff ${window._mealDraft.status === 'different' ? 'on' : ''}" data-s="different" onclick="mealSetStatus('different')"><span class="em">🔁</span>Ate other</button>
          <button class="s-skip ${window._mealDraft.status === 'skipped' ? 'on' : ''}" data-s="skipped" onclick="mealSetStatus('skipped')"><span class="em">⏭️</span>Skipped</button>
        </div>
        <div id="mealEatenWrap" style="display:${window._mealDraft.status === 'different' ? 'block' : 'none'}">
          <div class="ml-field-l">What did you eat instead?</div>
          <input class="ml-input" id="mealEaten" placeholder="e.g. Toast & eggs out" value="${escapeHtml(window._mealDraft.eaten)}" oninput="window._mealDraft.eaten=this.value">
        </div>
        <div class="ml-actions">
          ${(mp.planned || mp.status) ? `<button class="ml-btn ghost" onclick="clearMealEntry()">Clear</button>` : ''}
          <button class="ml-btn primary" onclick="saveMealEntry()">Save</button>
        </div>
      </div>
    </div>`);
  setTimeout(() => { const i = document.getElementById('mealPlanned'); if (i && window._mealDraft && !window._mealDraft.planned) i.focus(); }, 60);
};
window.mealSetStatus = function (s) {
  const d = window._mealDraft; if (!d) return;
  d.status = d.status === s ? '' : s;
  document.querySelectorAll('#mealStatusSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === d.status));
  const w = document.getElementById('mealEatenWrap'); if (w) w.style.display = d.status === 'different' ? 'block' : 'none';
};
window.saveMealEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  const fields = { planned: (d.planned || '').trim(), status: d.status || null };
  if (d.status === 'as_planned') fields.eaten = fields.planned;
  else if (d.status === 'different') fields.eaten = (d.eaten || '').trim();
  else fields.eaten = '';
  _mealCloseModal();
  await _mpSave(d.date, d.slot, fields);
  renderMeals();
  if (typeof showToast === 'function') showToast('Saved');
};
window.clearMealEntry = async function () {
  const d = window._mealDraft; if (!d) return;
  _mealCloseModal();
  await _mpSave(d.date, d.slot, { planned: '', eaten: '', status: null });
  renderMeals();
};

/* ── Daily check-in: mood + energy + healthy ── */
window.openMealCheckin = function (date) {
  const md = _mdFor(date) || {};
  window._mealDraft = { date, mood: +md.mood || 0, energy: +md.energy || 0, ate_healthy: _mealHealthy(md) ? true : (md.ate_healthy === false ? false : null), note: md.note || '' };
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
