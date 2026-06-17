/* view-habits.js */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// --- STATE HELPERS ---
let _habitSort = 'default'; // 'default', 'time'
let _habitDayFilter = 'All';
let _habitShowTodayOnly = true; // Default to Today
let _expandedHabitId = null; // For collapsible cards
let _backDateMode = false; // For back-date marking mode
let _selectedBackDate = new Date().toISOString().slice(0, 10);

function getTodayDayName() {
  const d = new Date().getDay(); // 0=Sun, 1=Mon...
  return DAY_NAMES[d === 0 ? 6 : d - 1]; // Convert to Mon-based
}

function isHabitTimeInFuture(reminder_time) {
  if (!reminder_time) return false;
  const now = new Date();
  const habitTime = new Date(now);
  const rt = String(reminder_time);

  if (rt.startsWith('1899-12-30T')) {
    habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
  } else if (rt.match(/^\d{2}:\d{2}/)) {
    const parts = rt.split(':');
    habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  } else {
    return false;
  }
  return habitTime > now;
}

function isHabitScheduledToday(h) {
  return (typeof window.habitScheduledToday === 'function') ? window.habitScheduledToday(h) : true;
}

/* Stripe/Mercury desktop refinement for the Habits view — scoped to .hb-pro so
   nothing else is affected. Injected once with the rendered view. */
const HABITS_REFINE_CSS = `<style>
.hb-pro { max-width:1340px; }
.hb-pro .hb-workspace { display:flex; gap:20px; align-items:flex-start; }
.hb-pro .hb-list { flex:1; min-width:0; }
.hb-pro .hb-pane { flex:0 0 360px; position:sticky; top:14px; display:flex; flex-direction:column; gap:13px; }
.hb-pro .habit-card-new.hb-sel { border-color:var(--primary); box-shadow:0 0 0 1px var(--primary), var(--shadow-card); }

.hb-pro .hbp-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:16px; }
.hb-pro .hbp-h { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); font-weight:700; margin:0 0 2px; }
.hb-pro .hbp-today { display:flex; align-items:center; gap:16px; margin-top:12px; }
.hb-pro .hbp-ring { position:relative; width:92px; height:92px; flex-shrink:0; }
.hb-pro .hbp-ringc { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.hb-pro .hbp-ringc b { font-size:22px; font-weight:700; color:var(--text-1); letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.hb-pro .hbp-ringc span { font-size:10px; color:var(--text-3); }
.hb-pro .hbp-tmeta div { font-size:13px; color:var(--text-2); margin-bottom:6px; }
.hb-pro .hbp-tmeta b { color:var(--text-1); font-variant-numeric:tabular-nums; }
.hb-pro .hbp-streaks { margin-top:6px; }
.hb-pro .hbp-srow { display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer; }
.hb-pro .hbp-srow:last-child { border-bottom:none; }
.hb-pro .hbp-semoji { width:24px; text-align:center; }
.hb-pro .hbp-sname { flex:1; font-size:13px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hb-pro .hbp-srow:hover .hbp-sname { color:var(--text-1); }
.hb-pro .hbp-sval { font-size:12.5px; font-weight:600; color:var(--text-1); font-variant-numeric:tabular-nums; }
.hb-pro .hbp-empty { font-size:12.5px; color:var(--text-3); padding:6px 0; }
.hb-pro .hbp-routines { margin-top:8px; display:flex; flex-direction:column; gap:11px; }
.hb-pro .hbp-rtop { display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-2); margin-bottom:5px; }
.hb-pro .hbp-rtop b { color:var(--text-1); font-variant-numeric:tabular-nums; }
.hb-pro .hbp-rbar { height:6px; background:var(--surface-3); border-radius:999px; overflow:hidden; }
.hb-pro .hbp-rbar i { display:block; height:100%; background:var(--primary); border-radius:999px; }

.hb-pro .hbp-dhead { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:14px; }
.hb-pro .hbp-dtitle { display:flex; align-items:center; gap:11px; min-width:0; }
.hb-pro .hbp-demoji { width:38px; height:38px; display:flex; align-items:center; justify-content:center; background:var(--surface-2); border:1px solid var(--border-color); border-radius:10px; font-size:18px; flex-shrink:0; }
.hb-pro .hbp-dname { font-size:15px; font-weight:700; color:var(--text-1); letter-spacing:-.01em; }
.hb-pro .hbp-dmeta { font-size:11.5px; color:var(--text-3); margin-top:2px; }
.hb-pro .hbp-x { width:30px; height:30px; flex-shrink:0; border:1px solid var(--border-color); background:var(--surface-1); border-radius:8px; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.hb-pro .hbp-x:hover { background:var(--surface-2); color:var(--text-1); }
.hb-pro .hbp-done { width:100%; padding:11px; border:none; border-radius:10px; background:var(--success,#10B981); color:#fff; font:inherit; font-weight:600; font-size:13.5px; cursor:pointer; }
.hb-pro .hbp-done:hover { filter:brightness(.96); }
.hb-pro .hbp-done.on { background:var(--surface-2); color:var(--success,#10B981); border:1px solid var(--border-color); }
.hb-pro .hbp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px; }
.hb-pro .hbp-stat { text-align:center; padding:10px 4px; border:1px solid var(--border-color); border-radius:10px; }
.hb-pro .hbp-sn { font-size:18px; font-weight:700; color:var(--text-1); letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.hb-pro .hbp-sl { font-size:10px; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; font-weight:600; margin-top:3px; }
.hb-pro .hb-heat { display:flex; gap:3px; margin-top:8px; }
.hb-pro .hb-heat-col { display:flex; flex-direction:column; gap:3px; }
.hb-pro .hb-heat-cell { width:13px; height:13px; border-radius:3px; background:var(--surface-3); }
.hb-pro .hb-heat-cell.on { background:var(--success,#10B981); }
.hb-pro .hb-heat-cell.empty { background:transparent; }
.hb-pro .hb-heat-cell.today { box-shadow:0 0 0 1.5px var(--primary); }
.hb-pro .hbp-dfoot { display:flex; gap:8px; margin-top:16px; }
.hb-pro .hbp-edit { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:10px; font:inherit; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; }
.hb-pro .hbp-edit:hover { background:var(--surface-2); color:var(--text-1); }
.hb-pro .hbp-del { width:44px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:10px; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.hb-pro .hbp-del:hover { color:#B42318; background:rgba(220,38,38,.06); border-color:rgba(220,38,38,.2); }
.hb-pro .hb-head { align-items:center; margin-top:2px; padding-bottom:6px; }
.hb-pro .hb-stats { display:flex; align-items:center; gap:16px; flex:1; }
.hb-pro .hb-stat { display:inline-flex; align-items:baseline; gap:6px; }
.hb-pro .hb-stat b { font-size:17px; font-weight:700; color:var(--text-1); letter-spacing:-.02em; font-variant-numeric:tabular-nums lining-nums; }
.hb-pro .hb-stat span { font-size:12.5px; color:var(--text-3); }
.hb-pro .hb-sep { width:1px; height:15px; background:var(--border-color); }
.hb-pro .hb-add { background:var(--primary) !important; color:#fff !important; border:none !important; box-shadow:var(--shadow-xs); }
.hb-pro .hb-add:hover { filter:brightness(.96); transform:translateY(-1px); box-shadow:var(--shadow-md); }

/* Week strip */
.hb-pro .habit-scorecard-container { gap:6px; padding:10px; border-radius:14px; background:var(--surface-2); border:1px solid var(--border-color); box-shadow:none; margin-bottom:22px; }
.hb-pro .scorecard-item { flex-direction:column; gap:4px; padding:8px 4px; background:transparent; border:1px solid transparent; border-radius:10px; }
.hb-pro .scorecard-item.today { background:var(--surface-1); box-shadow:var(--shadow-xs); border-color:var(--border-color); }
.hb-pro .scorecard-day { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--text-3); }
.hb-pro .scorecard-item.today .scorecard-day { color:var(--primary); }
.hb-pro .scorecard-date { font-size:11px; font-weight:600; color:var(--text-3); font-variant-numeric:tabular-nums; }
.hb-pro .score-percent { font-size:8.5px; font-weight:700; color:var(--text-2); }

/* Routine headers + cards */
.hb-pro .habit-routine-header { font-size:11.5px !important; font-weight:700 !important; letter-spacing:.06em !important; color:var(--text-3) !important; }
.hb-pro .habit-card-new { border-radius:12px; box-shadow:var(--shadow-card); transition:box-shadow .16s ease, border-color .16s ease; }
.hb-pro .habit-card-new:hover { box-shadow:var(--shadow-md); border-color:var(--border-strong); }
.hb-pro .habit-card-new.habit-next-up { border-color:var(--primary); box-shadow:0 0 0 1px var(--primary), var(--shadow-card); }
.hb-pro .habit-card-header { padding:11px 14px; gap:12px; }
.hb-pro .habit-emoji-circle { width:38px; height:38px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border-color); font-size:18px; }
.hb-pro .habit-title-lg { font-size:14px; font-weight:650; gap:7px; }
.hb-pro .habit-meta { font-size:11.5px; color:var(--text-3); margin-top:3px; }

/* Right cluster: week dots + streak + complete + alarm + chevron */
.hb-pro .hb-right { display:flex; align-items:center; gap:10px; }
.hb-pro .hb-week { display:flex; gap:3px; align-items:center; }
.hb-pro .hwd { width:8px; height:8px; border-radius:3px; background:var(--surface-3); }
.hb-pro .hwd.on { background:var(--success,#10B981); }
.hb-pro .hwd.t { border-color:var(--primary); box-shadow:none; }
.hb-pro .hwd.t.on { border-color:var(--success,#10B981); box-shadow:none; }
.hb-pro .streak-pill { padding:4px 9px; background:var(--surface-2); border:1px solid var(--border-color); border-radius:999px; font-size:12px; font-weight:600; color:var(--text-2); }
.hb-pro .hb-check { width:30px; height:30px; border-radius:50%; border:2px solid var(--border-strong); background:var(--surface-1); cursor:pointer; display:flex; align-items:center; justify-content:center; color:transparent; transition:all .16s ease; flex-shrink:0; }
.hb-pro .hb-check:hover { border-color:var(--success,#10B981); background:rgba(16,185,129,.08); }
.hb-pro .hb-check.on { background:var(--success,#10B981); border-color:var(--success,#10B981); color:#fff; }
.hb-pro .habit-alarm-btn { width:30px; height:30px; border-radius:9px; color:var(--text-3); }
.hb-pro .collapse-icon { color:var(--text-3); opacity:.5; }
.hb-pro .up-next-badge { font-size:9px; padding:2px 7px; border-radius:999px; background:var(--primary-soft); color:var(--primary); }

/* Desktop-only additions — keep phones exactly as before (swipe to complete). */
@media (max-width:1099px){
  .hb-pro { max-width:none; }
  .hb-pro .hb-workspace { display:block; }
  .hb-pro .hb-pane { display:none; }
}
@media (max-width:768px){
  .hb-pro .hb-week { display:none; }
  .hb-pro .hb-check { display:none; }
}

/* Visibility pass: clearer week-dots + calmer "missed" treatment */
.hb-pro .hwd { width:9px; height:9px; background:var(--surface-2); border:1px solid var(--border-color); }
.hb-pro .hwd.on { background:var(--success,#10B981); border-color:var(--success,#10B981); }
.hb-pro .hb-miss { font-size:10px; font-weight:700; color:#B54708; background:rgba(245,158,11,.13); padding:2px 7px; border-radius:999px; letter-spacing:.01em; white-space:nowrap; }
@media (min-width:1100px){
  /* Desktop: replace the per-card red banner + red border with the compact amber chip */
  .hb-pro .habit-missed-banner { display:none; }
  .hb-pro .habit-card-warning { border-color:var(--border-color) !important; }
}
@media (max-width:1099px){ .hb-pro .hb-miss { display:none; } }
</style>`;

/* ══════════════════════════════════════════════════════
   MASTER-DETAIL HABITS WORKSPACE (desktop) — right pane: analytics ⇄ habit detail.
   Mobile (<900px) keeps the single column + inline card expand (toggleHabitCard).
══════════════════════════════════════════════════════ */
let _habitDetailId = null;
function _hbDesktop() {
  try { return window.matchMedia('(min-width:1100px)').matches; }
  catch (e) { return (window.innerWidth || 1280) >= 1100; }
}
window.hbRowOpen = function (id) {
  if (_hbDesktop()) hbSelectDetail(id);
  else toggleHabitCard(id);
};
window.hbSelectDetail = function (id) {
  _habitDetailId = (String(id) === String(_habitDetailId)) ? null : String(id);
  hbRenderPane();
  document.querySelectorAll('.habit-card-new.hb-sel').forEach(c => c.classList.remove('hb-sel'));
  if (_habitDetailId) { const c = document.getElementById('habit-card-' + _habitDetailId); if (c) c.classList.add('hb-sel'); }
};
window.hbCloseDetail = function () {
  _habitDetailId = null;
  hbRenderPane();
  document.querySelectorAll('.habit-card-new.hb-sel').forEach(c => c.classList.remove('hb-sel'));
};
function hbPaneHTML() {
  const h = _habitDetailId ? (state.data.habits || []).find(x => String(x.id) === String(_habitDetailId)) : null;
  return h ? hbDetailHTML(h) : hbOverviewHTML();
}
function hbRenderPane() {
  const p = document.querySelector('.hb-pane');
  if (!p) return;
  p.innerHTML = hbPaneHTML();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function _hbLongestStreak(doneSet) {
  const dates = [...doneSet].filter(Boolean).sort();
  let best = 0, cur = 0, prev = null;
  for (const ds of dates) {
    const d = new Date(ds + 'T00:00:00');
    if (prev && (d - prev) === 86400000) cur++; else cur = 1;
    if (cur > best) best = cur;
    prev = d;
  }
  return best;
}
function _hbHeatmap(doneSet) {
  const weeks = 13;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  const dow = (start.getDay() + 6) % 7;            // align column start to Monday
  start.setDate(start.getDate() - dow);
  let html = '<div class="hb-heat">';
  for (let w = 0; w < weeks + 1; w++) {
    html += '<div class="hb-heat-col">';
    for (let r = 0; r < 7; r++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + r);
      const iso = d.toISOString().slice(0, 10);
      if (d > today) { html += '<span class="hb-heat-cell empty"></span>'; continue; }
      html += `<span class="hb-heat-cell ${doneSet.has(iso) ? 'on' : ''} ${iso === todayIso ? 'today' : ''}" title="${iso}"></span>`;
    }
    html += '</div>';
  }
  return html + '</div>';
}

function hbOverviewHTML() {
  const allH = state.data.habits || [];
  const logs = state.data.habit_logs || [];
  const today = new Date().toISOString().slice(0, 10);
  const sched = allH.filter(h => isHabitScheduledToday(h));
  const isDone = h => logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today));
  const doneList = sched.filter(isDone);
  const pct = sched.length ? Math.round(doneList.length / sched.length * 100) : 0;
  const C = 2 * Math.PI * 42;

  const ranked = allH.map(h => ({ h, s: calculateHabitStats(logs.filter(l => String(l.habit_id) === String(h.id)), today, h).streak }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);

  const routines = {};
  sched.forEach(h => { const r = h.routine || h.category || 'General'; (routines[r] = routines[r] || { t: 0, d: 0 }).t++; if (isDone(h)) routines[r].d++; });

  const streakRows = ranked.length ? ranked.map(({ h, s }) =>
    `<div class="hbp-srow" onclick="hbSelectDetail('${h.id}')"><span class="hbp-semoji">${h.emoji || '✨'}</span><span class="hbp-sname">${escapeHtml(h.habit_name || '')}</span><span class="hbp-sval">${s >= 30 ? '🏆' : s >= 7 ? '🔥' : '⭐'} ${s}</span></div>`
  ).join('') : `<div class="hbp-empty">Complete a habit to start a streak.</div>`;

  const routineRows = Object.keys(routines).sort((a, b) => (window.routineRank ? window.routineRank(a) - window.routineRank(b) : 0)).map(r => {
    const { t, d } = routines[r]; const rp = t ? Math.round(d / t * 100) : 0;
    return `<div class="hbp-rrow"><div class="hbp-rtop"><span>${escapeHtml(r)}</span><b>${d}/${t}</b></div><div class="hbp-rbar"><i style="width:${rp}%"></i></div></div>`;
  }).join('');

  return `
  <div class="hbp-card">
    <div class="hbp-h">Today</div>
    <div class="hbp-today">
      <div class="hbp-ring">
        <svg width="92" height="92"><circle cx="46" cy="46" r="42" fill="none" stroke="var(--surface-3)" stroke-width="8"/>
          <circle cx="46" cy="46" r="42" fill="none" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 46 46)"/></svg>
        <div class="hbp-ringc"><b>${pct}%</b><span>done</span></div>
      </div>
      <div class="hbp-tmeta"><div><b>${doneList.length}</b> of ${sched.length} today</div><div>${sched.length - doneList.length} remaining</div></div>
    </div>
  </div>
  <div class="hbp-card">
    <div class="hbp-h">Top streaks</div>
    <div class="hbp-streaks">${streakRows}</div>
  </div>
  ${Object.keys(routines).length ? `<div class="hbp-card"><div class="hbp-h">Routines today</div><div class="hbp-routines">${routineRows}</div></div>` : ''}`;
}

function hbDetailHTML(h) {
  const logs = (state.data.habit_logs || []).filter(l => String(l.habit_id) === String(h.id));
  const today = new Date().toISOString().slice(0, 10);
  const stats = calculateHabitStats(logs, today, h);
  const doneSet = new Set(logs.map(l => (l.date || '').slice(0, 10)).filter(Boolean));
  const longest = _hbLongestStreak(doneSet);
  const isDoneToday = doneSet.has(today);
  let displayTime = (window.habitDayList && window.habitDayList(h).length) ? window.habitDayList(h).join(', ') : ((h.frequency && h.frequency.toLowerCase() !== 'daily') ? 'Weekly' : 'Daily');
  if (h.reminder_time) { const rt = String(h.reminder_time); if (rt.startsWith('1899-12-30T')) displayTime = `@ ${rt.slice(11, 16)}`; else if (rt.match(/^\d{2}:\d{2}/)) displayTime = `@ ${rt.slice(0, 5)}`; }
  return `
  <div class="hbp-card">
    <div class="hbp-dhead">
      <div class="hbp-dtitle"><span class="hbp-demoji">${h.emoji || '✨'}</span><div><div class="hbp-dname">${escapeHtml(h.habit_name || '')}</div><div class="hbp-dmeta">${escapeHtml(h.category || h.routine || 'General')} • ${displayTime}</div></div></div>
      <button class="hbp-x" onclick="hbCloseDetail()"><i data-lucide="x" style="width:14px;height:14px"></i></button>
    </div>
    <button class="hbp-done ${isDoneToday ? 'on' : ''}" onclick="toggleHabitOptimistic('${h.id}')">${isDoneToday ? '✓ Done today' : 'Mark done today'}</button>
    <div class="hbp-stats">
      <div class="hbp-stat"><div class="hbp-sn">${stats.streak}</div><div class="hbp-sl">Current</div></div>
      <div class="hbp-stat"><div class="hbp-sn">${longest}</div><div class="hbp-sl">Best</div></div>
      <div class="hbp-stat"><div class="hbp-sn">${stats.completionRate}%</div><div class="hbp-sl">Rate</div></div>
      <div class="hbp-stat"><div class="hbp-sn">${stats.total}</div><div class="hbp-sl">Total</div></div>
    </div>
    <div class="hbp-h" style="margin-top:16px">Last 13 weeks</div>
    ${_hbHeatmap(doneSet)}
    <div class="hbp-dfoot">
      <button class="hbp-edit" onclick="openEditHabit('${h.id}')"><i data-lucide="settings-2" style="width:14px;height:14px"></i> Edit</button>
      <button class="hbp-del" onclick="hbCloseDetail(); deleteHabit('${h.id}')" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
    </div>
  </div>`;
}

function renderHabits() {
  let habits = Array.isArray(state.data.habits) ? [...state.data.habits] : [];
  const logs = state.data.habit_logs || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = getTodayDayName();

  if (_habitShowTodayOnly) {
    habits = habits.filter(h => isHabitScheduledToday(h));
  } else if (_habitDayFilter !== 'All') {
    habits = habits.filter(h => {
      const f = String(h.frequency || '').toLowerCase().trim();
      if (!f || f === 'daily') return true;
      const days = (window.habitDayList ? window.habitDayList(h) : []);
      if (!days.length) return true;
      return days.map(s => s.slice(0, 3).toLowerCase()).includes(_habitDayFilter.slice(0, 3).toLowerCase());
    });
  }

  habits.sort((a, b) => {
    const isDoneA = logs.some(l => String(l.habit_id) === String(a.id) && (l.date || '').startsWith(today));
    const isDoneB = logs.some(l => String(l.habit_id) === String(b.id) && (l.date || '').startsWith(today));
    if (isDoneA && !isDoneB) return 1;
    if (!isDoneA && isDoneB) return -1;
    return 0;
  });

  // Determine the "next upcoming" habit: soonest future reminder among pending habits,
  // falling back to the first pending habit if none have a future reminder time.
  let nextUpHabitId = null;
  if (_habitShowTodayOnly) {
    const pendingHabits = habits.filter(h =>
      !logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today))
    );
    let soonestDiff = Infinity;
    pendingHabits.forEach(h => {
      if (h.reminder_time) {
        const now = new Date();
        const habitTime = new Date(now);
        const rt = String(h.reminder_time);
        if (rt.startsWith('1899-12-30T')) {
          habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
        } else if (rt.match(/^\d{2}:\d{2}/)) {
          const parts = rt.split(':');
          habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
        const diff = habitTime.getTime() - now.getTime();
        if (diff > 0 && diff < soonestDiff) {
          soonestDiff = diff;
          nextUpHabitId = h.id;
        }
      }
    });
    if (!nextUpHabitId && pendingHabits.length > 0) {
      nextUpHabitId = pendingHabits[0].id;
    }
  }

  const categoryEmojis = {
    'Health': 'health', 'Fitness': 'fitness', 'Learning': 'learning',
    'Productivity': 'productivity', 'Spiritual': 'spiritual', 'Other': 'default'
  };

  const _allHabits = Array.isArray(state.data.habits) ? state.data.habits : [];
  const _schedToday = _allHabits.filter(h => isHabitScheduledToday(h));
  const _doneToday = _schedToday.filter(h => logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today))).length;
  const _totalToday = _schedToday.length;
  const _pctToday = _totalToday ? Math.round(_doneToday / _totalToday * 100) : 0;

  document.getElementById('main').innerHTML = `
      <div class="habit-wrapper hb-pro">
        ${HABITS_REFINE_CSS}
        <div class="header-row hb-head" style="flex-wrap:wrap; gap:10px;">
          <div class="hb-stats">
            <div class="hb-stat"><b>${_doneToday}</b><span>of ${_totalToday} done today</span></div>
            <div class="hb-sep"></div>
            <div class="hb-stat"><b>${_pctToday}%</b><span>complete</span></div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <div class="segmented-control">
                <button class="range-btn ${_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=true; renderHabits()">Today</button>
                <button class="range-btn ${!_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=false; renderHabits()">All</button>
            </div>
            ${!_habitShowTodayOnly ? `<select class="input small" onchange="_habitDayFilter=this.value; renderHabits()" style="width: auto;">
              <option value="All" ${_habitDayFilter === 'All' ? 'selected' : ''}>All</option>
              ${DAY_NAMES.map(d => `<option value="${d}" ${_habitDayFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>` : ''}
            <button class="btn primary circle small hb-add" onclick="openHabitModal()">${renderIcon('plus', null, 'style="width:18px"')}</button>
          </div>
        </div>

        ${renderHabitScorecard()}    

        <div class="hb-workspace">
        <div class="habit-grid hb-list">
          ${habits.length === 0 ? '<div class="empty-state">No habits found.</div>' : ''}
          ${(() => {
    // Separate incomplete and complete habits
    const incompleteHabits = habits.filter(h => !logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today)));
    const completeHabits = habits.filter(h => logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today)));

    // Group INCOMPLETE habits by routine
    const grouped = incompleteHabits.reduce((acc, h) => {
      const r = h.routine || 'General';
      if (!acc[r]) acc[r] = [];
      acc[r].push(h);
      return acc;
    }, {});

    // Routine sorting logic (respect settings)
    const s = state.data.settings?.[0] || {};
    const settingsRoutines = (s.habit_routines || 'Morning,Work,Evening').split(',').map(r => r.trim()).filter(Boolean);

    const routines = Object.keys(grouped).sort((a, b) => {
      const idxA = settingsRoutines.indexOf(a);
      const idxB = settingsRoutines.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      const ra = window.routineRank ? window.routineRank(a) : 500;
      const rb = window.routineRank ? window.routineRank(b) : 500;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });

    const renderCard = (h) => {
      const hLogs = logs.filter(l => String(l.habit_id) === String(h.id));
      const stats = calculateHabitStats(hLogs, today, h);
      const isDoneToday = hLogs.some(l => (l.date || '').startsWith(today));
      const _wk = [];
      for (let i = 6; i >= 0; i--) { const wd = new Date(); wd.setDate(wd.getDate() - i); const wiso = wd.toISOString().slice(0, 10); _wk.push({ on: hLogs.some(l => (l.date || '').startsWith(wiso)), t: i === 0 }); }
      const weekDotsHtml = `<div class="hb-week" title="Last 7 days">${_wk.map(x => `<span class="hwd ${x.on ? 'on' : ''} ${x.t ? 't' : ''}"></span>`).join('')}</div>`;
      const _missedN = (stats.consecutiveMissed >= 3 && String(h.id) !== String(nextUpHabitId) && !isHabitTimeInFuture(h.reminder_time)) ? stats.consecutiveMissed : 0;
      const missedChip = _missedN ? `<span class="hb-miss" title="${_missedN} days missed in a row">⚠ ${_missedN}d missed</span>` : '';
      const isDoneSelectedDate = _backDateMode ? hLogs.some(l => (l.date || '').startsWith(_selectedBackDate)) : isDoneToday;
      const scheduledToday = isHabitScheduledToday(h);
      const isExpanded = _expandedHabitId === h.id;

      let displayTime = (window.habitDayList && window.habitDayList(h).length) ? window.habitDayList(h).join(', ') : ((h.frequency && h.frequency.toLowerCase() !== 'daily') ? 'Weekly' : 'Daily');
      if (h.reminder_time) {
        const rt = String(h.reminder_time);
        if (rt.startsWith('1899-12-30T')) displayTime = `@ ${rt.slice(11, 16)}`;
        else if (rt.match(/^\d{2}:\d{2}/)) displayTime = `@ ${rt.slice(0, 5)}`;
      }

      let comingInText = '';
      if (scheduledToday && !isDoneToday && h.reminder_time) {
        const now = new Date();
        const habitTime = new Date(now);
        const rt = String(h.reminder_time);
        if (rt.startsWith('1899-12-30T')) {
          habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
        } else if (rt.match(/^\d{2}:\d{2}/)) {
          const parts = rt.split(':');
          habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
        if (habitTime > now) {
          const diffMs = habitTime.getTime() - now.getTime();
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          comingInText = `<span style="background:rgba(245, 158, 11, 0.1); color:#D97706; padding:2px 6px; border-radius:6px; font-size:9px; font-weight:700;">in ${diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`}</span>`;
        }
      }

      return `
        <div class="swipe-reveal-container">
          <div class="swipe-bg swipe-bg-done">
            <div class="swipe-bg-inner"><span class="swipe-bg-icon">✅</span><span class="swipe-bg-label">Mark Done</span></div>
          </div>
          <div class="swipe-bg swipe-bg-delete">
            <div class="swipe-bg-inner"><span class="swipe-bg-icon">🗑️</span><span class="swipe-bg-label">Delete</span></div>
          </div>
          <div class="habit-card-new ${isExpanded ? 'habit-expanded' : ''} ${isDoneToday ? 'done' : 'pending'} ${stats.consecutiveMissed >= 3 && !isHabitTimeInFuture(h.reminder_time) ? 'habit-card-warning' : ''} ${String(h.id) === String(nextUpHabitId) ? 'habit-next-up' : ''} ${String(h.id) === String(_habitDetailId) ? 'hb-sel' : ''}" id="habit-card-${h.id}">
            <div class="habit-card-header" onclick="hbRowOpen('${h.id}')">
              <div class="habit-title-wrapper">
                <div class="habit-emoji-circle">${h.emoji || '✨'}</div>
                <div>
                  <div class="habit-title-lg">${h.habit_name} ${comingInText}${String(h.id) === String(nextUpHabitId) ? '<span class="up-next-badge">Up Next</span>' : ''}${missedChip}</div>
                  <div class="habit-meta">${h.category || 'General'} • ${displayTime}</div>
                </div>
              </div>
              <div class="hb-right">
                ${weekDotsHtml}
                <div class="streak-pill ${stats.streak >= 30 ? 'streak-30' : (stats.streak >= 7 ? 'streak-7' : '')}">
                  ${stats.streak >= 30 ? '🏆' : (stats.streak >= 7 ? '🔥' : '⭐')} ${stats.streak}
                </div>
                <button class="hb-check ${isDoneSelectedDate ? 'on' : ''}" title="${isDoneSelectedDate ? 'Done' : 'Mark done'}" onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}">${isDoneSelectedDate ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</button>
                ${h.reminder_time ? `<button class="habit-alarm-btn ${h.alarm_enabled === false ? 'off' : 'on'}" id="alarm-btn-${h.id}" onclick="event.stopPropagation(); toggleHabitAlarm('${h.id}')" title="${h.alarm_enabled === false ? 'Alarm off' : 'Alarm on'}">${renderIcon(h.alarm_enabled === false ? 'bell-off' : 'bell', null, 'style="width:14px;height:14px"')}</button>` : ''}
                ${renderIcon('down', null, 'class="collapse-icon"')}
              </div>
            </div>
            ${stats.consecutiveMissed >= 3 && String(h.id) !== String(nextUpHabitId) && !isHabitTimeInFuture(h.reminder_time) ? `<div class="habit-missed-banner">🔗 Don't break the chain! ${stats.consecutiveMissed} day${stats.consecutiveMissed > 1 ? 's' : ''} missed in a row</div>` : ''}
            <div class="habit-card-body">
              <div class="habit-date-grid">${stats.dateButtonsHtml}</div>
              <div class="habit-stats-row">
                <div class="habit-stat-item">
                  <div class="habit-stat-value">${stats.total}</div>
                  <div class="habit-stat-label">Total</div>
                </div>
                <div class="habit-stat-item">
                  <div class="habit-stat-value primary">${stats.completionRate}%</div>
                  <div class="habit-stat-label">Success</div>
                </div>
              </div>
              <div class="habit-action-row">
                <button class="btn secondary small" onclick="event.stopPropagation(); openEditHabit('${h.id}')">Edit</button>
                ${h.pomodoro_sessions > 0 ? `<button class="btn secondary small" onclick="event.stopPropagation(); quickStartPomodoro('habit', '${h.id}')">Focus</button>` : ''}
                <button class="btn primary small ${isDoneSelectedDate ? 'done' : ''}" onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}">${isDoneSelectedDate ? 'Done' : 'Mark Done'}</button>
              </div>
            </div>
          </div>
        </div>`;
    };

    let html = routines.map(r => `
      <div class="habit-routine-group" style="margin-bottom: 24px;">
        <div class="habit-routine-header" style="font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-left: 10px; border-left: 3px solid var(--primary); line-height: 1;">${r}</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${grouped[r].map(h => renderCard(h)).join('')}
        </div>
      </div>`).join('');

    if (completeHabits.length > 0) {
      html += `
        <div class="habit-routine-group completed-section" style="margin-top: 32px; margin-bottom: 24px;">
          <div class="habit-routine-header" style="font-size: 13px; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-left: 10px; border-left: 3px solid #10B981; line-height: 1;">COMPLETED</div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${completeHabits.map(h => renderCard(h)).join('')}
          </div>
        </div>`;
    }
    return html;
  })()}
        </div>
        <aside class="hb-pane">${hbPaneHTML()}</aside>
        </div>
      </div>
    `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  if (typeof window.syncNativeNotifications === 'function') window.syncNativeNotifications();
  _attachHabitSwipes();
}

function _attachHabitSwipes() {
  if (typeof window.addSwipeAction !== 'function') {
    console.log('[Habits] addSwipeAction not found!');
    return;
  }
  const cards = document.querySelectorAll('.habit-card-new');
  console.log('[Habits] Found ' + cards.length + ' habit cards for swipes');
  cards.forEach(row => {
    const habitId = row.id.replace('habit-card-', '');
    window.addSwipeAction(row,
      () => { console.log('[Habits] Swipe left on ' + habitId); window.deleteHabit(habitId); },
      () => { console.log('[Habits] Swipe right on ' + habitId); window.toggleHabitOptimistic(habitId); }
    );
  });
}

// Toggle habit card expansion
window.toggleHabitCard = function (habitId) {
  const card = document.getElementById('habit-card-' + habitId);
  if (card) {
    card.classList.toggle('habit-expanded');
  }
  _expandedHabitId = _expandedHabitId === habitId ? null : habitId;
};

// Toggle alarm on/off for a habit — saves to sheet immediately
window.toggleHabitAlarm = async function (habitId) {
  const habit = (state.data.habits || []).find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const newVal = habit.alarm_enabled === false ? true : false; // default is ON

  // Optimistic UI update
  habit.alarm_enabled = newVal;
  const btn = document.getElementById('alarm-btn-' + habitId);
  if (btn) {
    btn.className = 'habit-alarm-btn ' + (newVal ? 'on' : 'off');
    btn.title = newVal ? 'Alarm on — tap to disable' : 'Alarm off — tap to enable';
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      btn.innerHTML = newVal
        ? '<i data-lucide="bell" style="width:14px;height:14px"></i>'
        : '<i data-lucide="bell-off" style="width:14px;height:14px"></i>';
      lucide.createIcons({ nodes: [btn] });
    }
  }

  try {
    await apiCall('update', 'habits', { alarm_enabled: newVal }, habitId);
    // Update cache
    state.data.habits = state.data.habits.map(h =>
      String(h.id) === String(habitId) ? Object.assign({}, h, { alarm_enabled: newVal }) : h
    );
    // Re-sync notifications
    if (typeof window.syncNativeNotifications === 'function') {
      setTimeout(window.syncNativeNotifications, 300);
    }
    const label = newVal ? 'Alarm enabled 🔔' : 'Alarm disabled 🔕';
    if (typeof showToast === 'function') showToast(label, 'success');
  } catch (err) {
    console.error('[Habits] Failed to toggle alarm:', err);
    // Revert on failure
    habit.alarm_enabled = !newVal;
    if (btn) btn.className = 'habit-alarm-btn ' + (!newVal ? 'on' : 'off');
  }
};

// Toggle habit for a specific date (back-date marking)
window.toggleHabitForDate = async function (habitId, date) {
  const existingIdx = state.data.habit_logs.findIndex(
    l => String(l.habit_id) === String(habitId) && (l.date || '').startsWith(date)
  );

  if (existingIdx !== -1) {
    // Already done on this date — remove log
    const toDelete = state.data.habit_logs[existingIdx];
    state.data.habit_logs.splice(existingIdx, 1);
    renderHabits();
    await apiCall('delete', 'habit_logs', {}, toDelete.id);
    showToast(`Habit unmarked for ${date}`);
  } else {
    // Not done on this date — add log
    const newLog = { id: 'temp-' + Date.now(), habit_id: habitId, date: date, completed: true };
    state.data.habit_logs.push(newLog);
    renderHabits();
    await apiCall('create', 'habit_logs', { habit_id: habitId, date: date, completed: true });
    showToast(`Habit marked for ${date}`);
  }

  refreshData('habit_logs').then(() => {
    if (state.view === 'habits') renderHabits();
    if (typeof window.recalculateVisionProgressFromHabit === 'function') {
      window.recalculateVisionProgressFromHabit(habitId);
    }
  });
};

// Delete habit function
window.deleteHabit = async function (id) {
  const h = state.data.habits.find(x => String(x.id) === String(id));
  if (!h) return;

  const originalHabit = { ...h };
  const originalIndex = state.data.habits.indexOf(h);

  // Optimistic Remove
  state.data.habits.splice(originalIndex, 1);
  renderHabits();

  showToast('Habit deleted', 'default', async () => {
    // Undo logic
    state.data.habits.splice(originalIndex, 0, originalHabit);
    renderHabits();
    showToast('Habit restored');
  });

  // Delay actual deletion to allow undo
  setTimeout(async () => {
    // check if still deleted
    const stillDeleted = !state.data.habits.find(x => String(x.id) === String(id));
    if (stillDeleted) {
      await apiCall('delete', 'habits', {}, id);
    }
  }, 5000);
};

// Bug fix: This function was called in ogni habit card onclick but was never defined.
// Performs optimistic UI toggle (instant feedback) then syncs with backend.
window.toggleHabitOptimistic = async function (id) {
  const today = new Date().toISOString().slice(0, 10);
  const existingIdx = state.data.habit_logs.findIndex(
    l => String(l.habit_id) === String(id) && (l.date || '').startsWith(today)
  );

  if (existingIdx !== -1) {
    // Already done today — remove log (un-mark)
    const toDelete = state.data.habit_logs[existingIdx];
    state.data.habit_logs.splice(existingIdx, 1);

    // Haptic interaction
    if (typeof window.triggerHapticBuzz === 'function') window.triggerHapticBuzz();

    renderHabits(); // Instant re-render
    await apiCall('delete', 'habit_logs', {}, toDelete.id);
  } else {
    // Not done today — add log (mark done)
    const newLog = { id: 'temp-' + Date.now(), habit_id: id, date: today, completed: true };
    state.data.habit_logs.push(newLog);

    // Haptic interaction
    if (typeof window.triggerHapticBuzz === 'function') window.triggerHapticBuzz();

    // Cancel aggressive repeating native alarm (BURST MODE: 10 individual notifications)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      try {
        const numericRoot = parseInt(String(id).replace(/\D/g, '') || "0", 10);
        const notificationsToCancel = [];
        for (let i = 0; i < 10; i++) {
          notificationsToCancel.push({ id: (numericRoot * 100) + 10000 + i });
        }
        await window.Capacitor.Plugins.LocalNotifications.cancel({ notifications: notificationsToCancel });
        console.log('[Native] Cancelled 10 burst notifications for habit ID:', id);
      } catch (e) {
        console.warn('Failed to cancel native alarm', e);
      }
    }

    // Psychological Pattern: Variable Rewards / Operant Conditioning
    // Calculate new streak to see if we hit a milestone
    const hBlogs = state.data.habit_logs.filter(l => String(l.habit_id) === String(id));
    const hDef = state.data.habits.find(h => String(h.id) === String(id));
    const stats = calculateHabitStats(hBlogs, today, hDef);

    if (stats.streak === 7 || stats.streak === 30 || stats.streak === 100) {
      if (typeof window.triggerConfettiBurst === 'function') {
        setTimeout(() => window.triggerConfettiBurst(), 300); // slight delay for visual sync
      }
      if (stats.streak === 30 && typeof window.playSuccessSound === 'function') {
        window.playSuccessSound();
      }
    }

    renderHabits(); // Instant re-render
    await apiCall('create', 'habit_logs', { habit_id: id, date: today, status: 'completed', pomodoro_completed: false });
  }

  // Background sync to stay in sync with server
  refreshData('habit_logs').then(() => {
    if (state.view === 'habits') renderHabits();
    if (typeof window.recalculateVisionProgressFromHabit === 'function') {
      window.recalculateVisionProgressFromHabit(id);
    }
  });
};

// P1 Fix #13: Mark all today-scheduled habits as done with one click
window.markAllHabitsDone = async function () {
  const today = new Date().toISOString().slice(0, 10);
  const habits = state.data.habits || [];
  const logs = state.data.habit_logs || [];

  // Find habits scheduled today that aren't done yet
  const pending = habits.filter(h => {
    let isScheduled = isHabitScheduledToday(h);
    const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today));
    return isScheduled && !isDone;
  });

  if (pending.length === 0) {
    showToast('All habits already completed!');
    return;
  }

  // Optimistic update
  pending.forEach(h => {
    state.data.habit_logs.push({ id: 'temp-' + Date.now() + h.id, habit_id: h.id, date: today, completed: true });

    // Cancel aggressive repeating native alarm individually
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      try {
        const numericRoot = parseInt(String(h.id).replace(/\D/g, '') || "0", 10);
        const notificationsToCancel = [];
        for (let i = 0; i < 10; i++) {
          notificationsToCancel.push({ id: (numericRoot * 100) + 10000 + i });
        }
        window.Capacitor.Plugins.LocalNotifications.cancel({ notifications: notificationsToCancel }).catch(() => { });
      } catch (e) { }
    }
  });
  renderHabits();
  showToast(`Marked ${pending.length} habit${pending.length > 1 ? 's' : ''} as done!`);

  // Background sync
  await Promise.all(pending.map(h => apiCall('create', 'habit_logs', { habit_id: h.id, date: today, completed: true })));
  refreshData('habit_logs').then(() => {
    if (state.view === 'habits') renderHabits();
    if (typeof window.recalculateVisionProgressFromHabit === 'function') {
      pending.forEach(h => window.recalculateVisionProgressFromHabit(h.id));
    }
  });
};




/* --- CALCULATIONS --- */
function calculateHabitStats(logs, today, habit) {
  const doneDates = logs.map(l => (l.date || '').slice(0, 10)).sort().reverse();
  const unique = [...new Set(doneDates)];

  // Streak - for weekly habits, only count scheduled days
  let streak = 0;
  let checkDate = new Date();

  if (!unique.includes(today)) checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const iso = checkDate.toISOString().slice(0, 10);

    // For weekly habits, skip non-scheduled days in streak calc
    if (habit && window.habitDayList(habit).length) {
      const dayIdx = checkDate.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      if (!window.habitDayList(habit).includes(dayName)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
    }

    if (unique.includes(iso)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Smart History: Find last 7 scheduled occurrences
  let scheduledDates = [];
  let daySearchDate = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(daySearchDate);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    let isScheduled = true;
    if (habit && window.habitDayList(habit).length) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = window.habitDayList(habit).includes(dayName);
    }

    if (isScheduled) {
      scheduledDates.unshift({ iso, dateObj: d });
      if (scheduledDates.length === 7) break;
    }
  }

  let dateButtonsHtml = '';
  scheduledDates.forEach(({ iso, dateObj }) => {
    const isFilled = unique.includes(iso);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let btnClass = 'date-btn';
    if (isFilled) {
      btnClass += ' filled';
    } else {
      btnClass += ' missed';
    }

    dateButtonsHtml += `<button class="${btnClass}"
      onclick="event.stopPropagation(); toggleHabitForDate('${habit?.id || ''}', '${iso}')"
      title="${iso}${isFilled ? ' - Completed' : ' - Click to mark done'}">
      ${label}
    </button>`;
  });

  // Calculate missed scheduled times (for warning)
  let consecutiveMissed = 0;
  const isFutureToday = isHabitTimeInFuture(habit?.reminder_time);

  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const isToday = i === 0;

    let isScheduled = true;
    if (habit && window.habitDayList(habit).length) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = window.habitDayList(habit).includes(dayName);
    }

    if (isScheduled) {
      const isDone = unique.includes(iso);
      if (isDone) {
        break; // Found a completion, stop counting
      } else {
        // If it's today and the time hasn't passed yet, don't count it as a "missed scheduled time" yet
        if (isToday && isFutureToday) {
          continue;
        }
        consecutiveMissed++;
        if (consecutiveMissed >= 3) break;
      }
    }
  }

  const showWarning = consecutiveMissed >= 3;
  const warningMsg = showWarning ? `You haven't completed this habit for the last ${consecutiveMissed} scheduled times!` : '';

  // Completion Rate (last 30 days, only counting scheduled days)
  let scheduledDays = 0;
  let completedDays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    let isScheduled = true;
    if (habit && window.habitDayList(habit).length) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = window.habitDayList(habit).includes(dayName);
    }

    if (isScheduled) {
      scheduledDays++;
      if (unique.includes(iso)) completedDays++;
    }
  }

  const completionRate = scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : 0;

  return { streak, dateButtonsHtml, total: unique.length, completionRate, consecutiveMissed };
}

/* --- SCORECARD RENDERER --- */
function renderHabitScorecard() {
  const habits = state.data.habits || [];
  const logs = state.data.habit_logs || [];
  const today = new Date();

  let scorecardHtml = '<div class="habit-scorecard-container">';

  // Last 7 days (reverse order: oldest to newest)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  days.forEach(d => {
    const isoDate = d.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const isToday = isoDate === today.toISOString().slice(0, 10);
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Calculate scheduled vs completed for this specific date
    let scheduledCount = 0;
    let completedCount = 0;

    habits.forEach(h => {
      // Logic from isHabitScheduledToday but for a specific date
      let isScheduled = false;
      const _f = String(h.frequency || '').toLowerCase().trim();
      if (!_f || _f === 'daily') {
        isScheduled = true;
      } else {
        const _days = (window.habitDayList ? window.habitDayList(h) : []);
        isScheduled = _days.length ? _days.map(s => s.slice(0, 3).toLowerCase()).includes(dayName.slice(0, 3).toLowerCase()) : true;
      }

      if (isScheduled) {
        scheduledCount++;
        const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(isoDate));
        if (isDone) completedCount++;
      }
    });

    const percent = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;
    const circumference = 2 * Math.PI * 13; // r=13 for smaller circle
    const offset = circumference - (percent / 100) * circumference;

    scorecardHtml += `
      <div class="scorecard-item ${isToday ? 'today' : ''}" title="${dayName}, ${displayDate}: ${percent}%">
        <div class="scorecard-day">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div class="score-circle-container">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle class="score-circle-bg" cx="16" cy="16" r="13"></circle>
            <circle class="score-circle-progress" cx="16" cy="16" r="13" 
                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; ${percent === 100 ? 'stroke: var(--success);' : ''}"></circle>
          </svg>
          <div class="score-percent">${percent}%</div>
        </div>
        <div class="scorecard-date">${d.getDate()}</div>
      </div>
    `;
  });

  scorecardHtml += '</div>';
  return scorecardHtml;
}

/* --- DAY PICKER HTML --- */
function getDayPickerHtml(selectedDays = '', containerId = 'mHabitDays') {
  const selected = selectedDays ? selectedDays.split(',').map(s => s.trim()) : [];
  return `
    <div id="${containerId}" style="display:flex; gap:6px; margin:8px 0; flex-wrap:wrap;">
      ${DAY_NAMES.map(d => `
        <button type="button" class="day-pick-btn ${selected.includes(d) ? 'active' : ''}"
                onclick="this.classList.toggle('active')" data-day="${d}">
          ${d}
        </button>
      `).join('')}
    </div>
  `;
}

function getSelectedDays(containerId = 'mHabitDays') {
  const btns = document.querySelectorAll(`#${containerId} .day-pick-btn.active`);
  return Array.from(btns).map(b => b.dataset.day).join(',');
}

// --- MODAL INJECTOR ---
window.openHabitModal = function () {
  const modal = document.getElementById('universalModal');
  modal.classList.add('bottom-sheet');
  const box = modal.querySelector('.modal-box');
  const s = state.data.settings?.[0] || {};
  const routinesStr = s.habit_routines || 'Morning,Work,Evening';
  const routines = routinesStr.split(',').map(r => r.trim()).filter(Boolean);
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];

  box.innerHTML = `
      <div class="modal-header-bar">
          <i data-icon="streak"></i>
          <h3>New Habit</h3>
      </div>
      
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <!-- Identity Section -->
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Habit Details</label>
          <div style="display:flex; gap:12px; align-items:center">
             <div style="position: relative;">
               <select class="input" id="mHabitEmoji" style="width:64px; font-size:20px; padding:0 8px; height: 48px; appearance: none; text-align: center;">
                   <option value="✨">✨</option>
                   <option value="💪">💪</option>
                   <option value="📚">📚</option>
                   <option value="🧘">🧘</option>
                   <option value="💧">💧</option>
                   <option value="🍎">🍎</option>
                   <option value="🏃">🏃</option>
                   <option value="💤">💤</option>
               </select>
             </div>
             <input class="input" id="mHabitName" placeholder="What habit do you want to build?" style="flex:1; height: 48px; font-size: 15px;">
          </div>
        </div>

        <!-- Schedule Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Frequency</label>
            <select class="input" id="mHabitFreq" style="width: 100%;" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Reminder Time</label>
            <input type="time" class="input" id="mHabitTime" style="width: 100%;" required>
          </div>
        </div>

        <div id="dayPickerWrap" style="display:none; margin-top: -4px;">
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Which days?</label>
          ${getDayPickerHtml()}
        </div>

        <!-- Metadata Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Category</label>
            <select class="input" id="mHabitCat" style="width: 100%;">
                <option value="" disabled selected>Select...</option>
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Routine</label>
            <select class="input" id="mHabitRoutine" style="width: 100%;">
              <option value="">None</option>
              ${routines.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Duration</label>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input type="number" class="input" id="mHabitDuration" value="45" style="flex:1; width: 40px;" min="5" step="5">
              <span style="font-size: 12px; color: var(--text-3);">m</span>
            </div>
          </div>
        </div>
        
        <!-- Pomodoro Section -->
        <div style="padding:16px; background:var(--primary-soft); border-radius:16px; border:1px solid var(--primary-light); opacity: 0.9;">
          <label style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
              <i data-icon="timer" style="width:16px; height:16px;"></i> Pomodoro Integration
          </label>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:20px;">
              <div style="flex:1;">
                <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Sessions / day</span>
                <input type="number" class="input" id="mHabitPomoSessions" placeholder="0" value="0" style="width:100%; background: var(--surface-1);" min="0">
              </div>
              <div style="flex:1;">
                <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Length (min)</span>
                <input type="number" class="input" id="mHabitPomoLength" placeholder="25" value="25" style="width:100%; background: var(--surface-1);" min="5" step="5">
              </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button class="btn secondary" style="min-width: 100px;" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
            <button class="btn primary" style="min-width: 120px;" data-action="save-habit-modal">Create Habit</button>
        </div>
      </div>
    `;

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};



// Helper to parse reminder_time from various formats to HH:mm
function parseReminderTimeToHHMM(val) {
  if (!val) return '';
  const s = String(val);

  // Handle Google Sheets datetime format: "1899-12-30T02:54:00"
  // The time portion is what we want
  if (s.startsWith('1899-12-30T')) {
    const timePart = s.slice(11, 16); // Extract "02:54" from "1899-12-30T02:54:00"
    if (timePart.match(/^\d{2}:\d{2}$/)) {
      return timePart;
    }
  }

  // Handle other ISO-like formats with T
  if (s.includes('T')) {
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '';
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }

  // Already HH:mm or HH:mm:ss
  if (s.match(/^\d{2}:\d{2}/)) {
    return s.slice(0, 5);
  }

  return '';
}

window.openEditHabit = function (id) {
  const h = (state.data.habits || []).find(x => String(x.id) === String(id));
  if (!h) return;
  const modal = document.getElementById('universalModal');
  modal.classList.add('bottom-sheet');
  const box = modal.querySelector('.modal-box');
  const isWeekly = (typeof window.habitIsWeekly === 'function') ? window.habitIsWeekly(h) : (h.frequency === 'weekly');
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];
  const reminderTimeValue = parseReminderTimeToHHMM(h.reminder_time);
  const s = state.data.settings?.[0] || {};
  const routinesStr = s.habit_routines || 'Morning,Work,Evening';
  const routines = routinesStr.split(',').map(r => r.trim()).filter(Boolean);

  box.innerHTML = `
    <div class="modal-header-bar">
        <i data-icon="edit"></i>
        <h3>Edit Habit</h3>
    </div>

    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
      <!-- Identity Section -->
      <div>
        <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Habit Details</label>
        <div style="display:flex; gap:12px; align-items:center">
           <select class="input" id="mHabitEmoji" style="width:64px; font-size:20px; padding:0 8px; height: 48px; text-align: center; appearance: none;">
               <option value="✨" ${h.emoji === '✨' ? 'selected' : ''}>✨</option>
               <option value="💪" ${h.emoji === '💪' ? 'selected' : ''}>💪</option>
               <option value="📚" ${h.emoji === '📚' ? 'selected' : ''}>📚</option>
               <option value="🧘" ${h.emoji === '🧘' ? 'selected' : ''}>🧘</option>
               <option value="💧" ${h.emoji === '💧' ? 'selected' : ''}>💧</option>
               <option value="🍎" ${h.emoji === '🍎' ? 'selected' : ''}>🍎</option>
               <option value="🏃" ${h.emoji === '🏃' ? 'selected' : ''}>🏃</option>
               <option value="💤" ${h.emoji === '💤' ? 'selected' : ''}>💤</option>
           </select>
           <input class="input" id="mHabitName" value="${(h.habit_name || h.name || '').replace(/"/g, '"')}" placeholder="What habit do you want to build?" style="flex:1; height: 48px; font-size: 15px;">
        </div>
      </div>

      <!-- Schedule Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Frequency</label>
          <select class="input" id="mHabitFreq" style="width: 100%;" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
              <option value="daily" ${!isWeekly ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${isWeekly ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Reminder Time</label>
          <input type="time" class="input" id="mHabitTime" value="${reminderTimeValue}" style="width: 100%;" required>
        </div>
      </div>

      <div id="dayPickerWrap" style="display:${isWeekly ? 'block' : 'none'}; margin-top: -4px;">
        <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Which days?</label>
        ${getDayPickerHtml((window.habitDayList ? window.habitDayList(h) : []).join(','))}
      </div>

      <!-- Metadata Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Category</label>
          <select class="input" id="mHabitCat" style="width: 100%;">
              ${categories.map(c => `<option value="${c}" ${h.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Routine</label>
          <select class="input" id="mHabitRoutine" style="width: 100%;">
            <option value="">None</option>
            ${routines.map(r => `<option value="${r}" ${h.routine === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Duration</label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" class="input" id="mHabitDuration" value="${h.duration || 45}" style="flex:1; width: 40px;" min="5" step="5">
            <span style="font-size: 12px; color: var(--text-3);">m</span>
          </div>
        </div>
      </div>
      
      <!-- Pomodoro Section -->
      <div style="padding:16px; background:var(--primary-soft); border-radius:16px; border:1px solid var(--primary-light); opacity: 0.9;">
        <label style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
            <i data-icon="timer" style="width:16px; height:16px;"></i> Pomodoro Integration
        </label>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:20px;">
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Sessions / day</span>
              <input type="number" class="input" id="mHabitPomoSessions" value="${h.pomodoro_sessions || 0}" style="width:100%; background: var(--surface-1);" min="0">
            </div>
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Length (min)</span>
              <input type="number" class="input" id="mHabitPomoLength" value="${h.pomodoro_length || 25}" style="width:100%; background: var(--surface-1);" min="5" step="5">
            </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
          <button class="btn secondary" style="min-width: 100px;" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" style="min-width: 120px;" data-action="update-habit-modal" data-edit-id="${h.id}">Update Habit</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};
