/* view-calendar.js — the Planner.
   One readable list of your day: plan blocks (planner_events), habits and tasks
   in time order. Habits/tasks that fall inside a plan block sit inside it,
   finished early items fold away, gaps show as free time, and a side panel
   shows what you should be doing now. Week and Month show how each day went. */

let calState = {
  view: 'day', // 'day', 'week', 'month'
  cursor: new Date(),
};

const _pl = { showFold: false, dismissed: {}, timer: null, focusTimer: null, off: new Set() };
try { JSON.parse(localStorage.getItem('plFilters') || '[]').forEach(k => _pl.off.add(k)); } catch (e) { }

const PL_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const _plEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _plHM = m => { m = Math.max(0, Math.min(1439, Math.round(m))); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const _plMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const _plDur = n => n >= 60 ? (n % 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n / 60} h`) : `${n} min`;
const _plIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _plDate = ds => { const [y, m, d] = String(ds).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const _plAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const _plToday = () => _plIso(new Date());
const _plNowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

/* ── gather a day ─────────────────────────────────────────────── */
function _plHabitTime(h) {
  const rt = String(h.reminder_time || '');
  if (!rt) return null;
  if (rt.startsWith('1899-12-30T')) return _plMin(rt.slice(11, 16));
  if (/^\d{1,2}:\d{2}/.test(rt)) return _plMin(rt);
  if (rt.includes('T')) { const d = new Date(rt); if (!isNaN(d)) return d.getHours() * 60 + d.getMinutes(); }
  return null;
}
function _plHabitOn(h, ds) { return typeof window.habitScheduledOn === 'function' ? window.habitScheduledOn(h, _plDate(ds)) : true; }
function _plHabitLog(id, ds) { return (state.data.habit_logs || []).find(l => String(l.habit_id) === String(id) && String(l.date || '').startsWith(ds)); }
function _plStreak(h, ds) {
  let n = 0, d = _plHabitLog(h.id, ds) ? _plDate(ds) : _plAdd(_plDate(ds), -1);
  for (let i = 0; i < 400; i++, d = _plAdd(d, -1)) {
    const k = _plIso(d);
    if (!_plHabitOn(h, k)) continue;
    if (_plHabitLog(h.id, k)) n++; else break;
  }
  return n;
}
function _plTaskRecurring(t) { return t.recurrence && t.recurrence !== 'none'; }
function _plTaskDates(t) {
  const v = t.completed_dates; if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  const s = String(v).trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).map(String); } catch (e) { } }
  return s.split(',').map(x => x.trim()).filter(Boolean);
}
function _plTaskOn(t, ds) {
  const due = String(t.due_date || '').slice(0, 10);
  if (!_plTaskRecurring(t)) return due === ds;
  if (t.recurrence_end && String(t.recurrence_end).slice(0, 10) < ds) return false;
  if (due && due > ds) return false;
  const d = _plDate(ds);
  if (t.recurrence === 'daily') return true;
  if (t.recurrence === 'weekly') {
    if (!t.recurrence_days) return true;
    const wd = d.getDay(), name = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][wd === 0 ? 6 : wd - 1];
    return String(t.recurrence_days).split(',').map(s => s.trim().slice(0, 3).toLowerCase()).includes(name);
  }
  if (t.recurrence === 'monthly') return due ? _plDate(due).getDate() === d.getDate() : true;
  return true;
}
function _plTaskDone(t, ds) { return _plTaskRecurring(t) ? _plTaskDates(t).includes(ds) : t.status === 'completed'; }

function _plItems(ds) {
  const out = [];
  (state.data.planner || []).forEach(e => {
    const sd = extractDatetime(e.start_datetime);
    if (sd.date !== ds) return;
    const ed = extractDatetime(e.end_datetime);
    const s = sd.time ? _plMin(sd.time) : 540;
    let en = ed.time ? _plMin(ed.time) : s + 60;
    if (en <= s) en = s + 30;
    out.push({ k: 'plan', id: String(e.id), t: e.title || 'Untitled', s, e: en, done: _plannerIsDone(e), ref: e });
  });
  (state.data.habits || []).forEach(h => {
    if (!_plHabitOn(h, ds)) return;
    const s = _plHabitTime(h), d = parseInt(h.duration, 10) || 30;
    out.push({ k: 'habit', id: String(h.id), t: h.habit_name || 'Habit', s, e: s == null ? null : Math.min(1440, s + d), done: !!_plHabitLog(h.id, ds), ref: h });
  });
  (state.data.tasks || []).forEach(t => {
    if (!_plTaskOn(t, ds)) return;
    const tm = String(t.due_time || '').slice(0, 5);
    const s = /^\d{1,2}:\d{2}$/.test(tm) ? _plMin(tm) : null;
    out.push({ k: 'task', id: String(t.id), t: t.title || 'Task', s, e: s == null ? null : Math.min(1440, s + (parseInt(t.duration, 10) || 30)), done: _plTaskDone(t, ds), ref: t });
  });
  return out;
}

/* ── actions ─────────────────────────────────────────────────── */
window.plToggle = function (k, id) {
  const ds = _plIso(calState.cursor);
  if (k === 'plan') return plannerToggleEventDone(id);
  if (k === 'habit') return _plToggleHabit(id, ds);
  if (k === 'task') return _plToggleTask(id, ds);
};
async function _plToggleHabit(id, ds) {
  if (!Array.isArray(state.data.habit_logs)) state.data.habit_logs = [];
  const log = _plHabitLog(id, ds);
  try {
    if (log) {
      state.data.habit_logs = state.data.habit_logs.filter(l => l !== log);
      renderCalendar();
      if (log.id && !String(log.id).startsWith('temp-')) await apiCall('delete', 'habit_logs', {}, log.id);
    } else {
      const temp = { id: 'temp-' + Date.now(), habit_id: id, date: ds, status: 'completed' };
      state.data.habit_logs.push(temp);
      renderCalendar();
      const res = await apiCall('create', 'habit_logs', { habit_id: id, date: ds, status: 'completed', pomodoro_completed: 0 });
      const nid = res && ((res.data && res.data.id) || res.id);
      if (nid) temp.id = String(nid);
    }
  } catch (e) { showToast('Couldn’t update the habit'); }
  try { if (typeof refreshData === 'function') await refreshData('habit_logs'); } catch (e) { }
  if (state.view === 'calendar') renderCalendar();
}
async function _plToggleTask(id, ds) {
  const t = (state.data.tasks || []).find(x => String(x.id) === String(id));
  if (!t) return;
  const before = { status: t.status, completed_at: t.completed_at, completed_dates: t.completed_dates };
  let payload;
  if (_plTaskRecurring(t)) {
    let d = _plTaskDates(t);
    d = d.includes(ds) ? d.filter(x => x !== ds) : d.concat(ds);
    t.completed_dates = d.join(',');
    payload = { completed_dates: t.completed_dates };
  } else {
    t.status = t.status === 'completed' ? 'pending' : 'completed';
    t.completed_at = t.status === 'completed' ? new Date().toISOString() : null;
    payload = { status: t.status, completed_at: t.completed_at };
  }
  renderCalendar();
  try {
    const res = await apiCall('update', 'tasks', payload, id);
    if (res && res.success === false) throw new Error(res.message);
  } catch (e) { Object.assign(t, before); renderCalendar(); showToast('Couldn’t update the task'); }
}
window.plEdit = async function (k, id) {
  if (k === 'plan') return openEditEvent(id);
  const view = k === 'habit' ? 'habits' : 'tasks';
  const fn = k === 'habit' ? 'openEditHabit' : 'openEditTask';
  try { if (typeof window[fn] !== 'function' && typeof ensureViewLoaded === 'function') await ensureViewLoaded(view); } catch (e) { }
  if (typeof window[fn] === 'function') window[fn](id);
  else if (typeof routeTo === 'function') routeTo(view);
};
window.plAddAt = function (startMin) { openEventModal(_plIso(calState.cursor), _plHM(startMin)); };
window.plFilter = function (k) {
  _pl.off.has(k) ? _pl.off.delete(k) : _pl.off.add(k);
  try { localStorage.setItem('plFilters', JSON.stringify([..._pl.off])); } catch (e) { }
  renderCalendar();
};
window.plFold = function (v) { _pl.showFold = !!v; renderCalendar(); };
window.plDismissLate = function (id) { _pl.dismissed[id] = 1; renderCalendar(); };
window.plShiftDay = async function (id) {
  const ds = _plIso(calState.cursor);
  const list = _plItems(ds);
  const late = list.find(x => x.k === 'plan' && x.id === String(id));
  if (!late) return;
  const by = Math.max(15, Math.ceil((_plNowMin() - late.e) / 15) * 15);
  const from = late.e;
  const moves = [{ x: late, s: late.s, e: late.e + by }];
  list.forEach(x => { if (x.k === 'plan' && x !== late && !x.done && x.s >= from) moves.push({ x, s: x.s + by, e: x.e + by }); });
  moves.forEach(m => { m.x.ref.start_datetime = `${ds}T${_plHM(m.s)}:00`; m.x.ref.end_datetime = `${ds}T${_plHM(Math.min(1439, m.e))}:00`; });
  _pl.dismissed[id] = 1;
  renderCalendar();
  showToast(`Rest of the day moved ${by} min later`);
  for (const m of moves) {
    try { await apiCall('update', 'planner_events', { start_datetime: m.x.ref.start_datetime, end_datetime: m.x.ref.end_datetime }, m.x.id); } catch (e) { }
  }
  try { await refreshData('planner_events'); } catch (e) { }
  if (state.view === 'calendar') renderCalendar();
};

/* ── focus + wrap up (in-page layers) ─────────────────────────── */
function _plLayer(html) {
  let l = document.getElementById('plLayer');
  if (!l) { l = document.createElement('div'); l.id = 'plLayer'; document.body.appendChild(l); }
  l.innerHTML = html;
  return l;
}
window.plCloseLayer = function () {
  const l = document.getElementById('plLayer'); if (l) l.innerHTML = '';
  if (_pl.focusTimer) { clearInterval(_pl.focusTimer); _pl.focusTimer = null; }
};
window.plFocus = function (id) {
  const x = _plItems(_plToday()).find(i => i.k === 'plan' && i.id === String(id));
  if (!x) return;
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const left = () => Math.max(0, x.e * 60 - (_plNowMin() * 60 + new Date().getSeconds()));
  _plLayer(`<div class="pl-focus" role="dialog" aria-modal="true" aria-label="Focus">
    <span class="k">Focus</span><h2>${_plEsc(x.t)}</h2><div class="t" id="plFocusT">${fmt(left())}</div>
    <div class="fb"><button type="button" class="go" onclick="plFocusDone('${_plEsc(x.id)}', ${x.done})">✓ Done</button><button type="button" onclick="plCloseLayer()">Leave focus</button></div>
    <p>Counts down to ${_plHM(x.e)}.</p></div>`);
  _pl.focusTimer = setInterval(() => { const el = document.getElementById('plFocusT'); if (el) el.textContent = fmt(left()); else plCloseLayer(); }, 1000);
};
window.plFocusDone = function (id, wasDone) { plCloseLayer(); if (!wasDone) plannerToggleEventDone(id); showToast('Done · nice work'); };
window.plWrapUp = function () {
  const ds = _plToday();
  const open = _plItems(ds).filter(x => !x.done && x.k !== 'habit' && !(x.k === 'task' && _plTaskRecurring(x.ref)));
  _plLayer(`<div class="pl-scrim" onclick="if(event.target===this)plCloseLayer()"><div class="pl-sheet" role="dialog" aria-modal="true" aria-label="Wrap up the day">
    <h2>Wrap up the day</h2>
    <p class="pl-note">Choose what moves to tomorrow. Habits and repeating tasks reset on their own.</p>
    <ul class="pl-ul">${open.map(x => `<li><label><input type="checkbox" data-wk="${x.k}" data-wid="${_plEsc(x.id)}" ${x.k === 'task' ? 'checked' : ''}><span class="t">${_plEsc(x.t)}</span><span class="k">${x.k === 'task' ? 'Task' : 'Plan block'}</span></label></li>`).join('') || '<li class="pl-note">Everything is done. Nice day.</li>'}</ul>
    <div class="pl-foot"><button type="button" class="pl-btn" onclick="plCloseLayer()">Not now</button><button type="button" class="pl-btn primary" onclick="plWrapGo()">${open.length ? 'Move and open journal' : 'Open journal'}</button></div>
  </div></div>`);
};
window.plWrapGo = async function () {
  const tm = _plIso(_plAdd(new Date(), 1));
  const picks = [...document.querySelectorAll('#plLayer [data-wk]:checked')].map(c => ({ k: c.dataset.wk, id: c.dataset.wid }));
  plCloseLayer();
  const tomorrowPlan = _plItems(tm).filter(x => x.k === 'plan');
  let n = 0;
  for (const p of picks) {
    try {
      if (p.k === 'task') {
        const t = (state.data.tasks || []).find(x => String(x.id) === p.id);
        if (!t) continue;
        t.due_date = tm;
        await apiCall('update', 'tasks', { due_date: tm }, p.id); n++;
      } else {
        const e = (state.data.planner || []).find(x => String(x.id) === p.id);
        if (!e) continue;
        const s = extractDatetime(e.start_datetime).time, en = extractDatetime(e.end_datetime).time;
        if (tomorrowPlan.some(x => _plHM(x.s) === s && x.t.trim().toLowerCase() === String(e.title || '').trim().toLowerCase())) continue;
        await apiCall('create', 'planner_events', { title: e.title, start_datetime: `${tm}T${s}:00`, end_datetime: `${tm}T${en || s}:00`, category: e.category || 'Other', color: e.color || '' }); n++;
      }
    } catch (err) { }
  }
  if (n) { try { await refreshData('planner_events'); await refreshData('tasks'); } catch (e) { } }
  showToast(n ? `${n} moved to tomorrow` : 'Day wrapped up');
  if (typeof routeTo === 'function') routeTo('diary');
};

/* ── day view ─────────────────────────────────────────────────── */
function _plStructure(list) {
  const vis = list.filter(x => !_pl.off.has(x.k));
  const timed = vis.filter(x => x.s != null).sort((a, b) => a.s - b.s || (a.k === 'plan' ? -1 : b.k === 'plan' ? 1 : 0));
  const plans = timed.filter(x => x.k === 'plan');
  const top = [], kids = new Map();
  timed.forEach(x => {
    const p = x.k === 'plan' ? null : plans.find(pl => x.s >= pl.s && x.e <= pl.e);
    if (p) { if (!kids.has(p.id)) kids.set(p.id, []); kids.get(p.id).push(x); } else top.push(x);
  });
  return { top, kids, anytime: vis.filter(x => x.s == null) };
}
function _plMeta(x, ds) {
  let kind;
  if (x.k === 'habit') { const st = _plStreak(x.ref, ds); kind = 'Habit' + (st > 1 ? ` · ${st}-day streak` : ''); }
  else if (x.k === 'task') kind = 'Task' + (x.ref.priority === 'P1' ? ' · High priority' : '');
  else kind = _plDur(x.e - x.s);
  return `${_plHM(x.s)} – ${_plHM(x.e)} · ${_plEsc(kind)}`;
}
function _plTick(x) {
  return `<button type="button" class="pl-tick${x.k === 'habit' ? ' round' : ''}" onclick="event.stopPropagation(); plToggle('${x.k}','${_plEsc(x.id)}')" aria-label="${x.done ? 'Mark not done' : 'Mark done'}: ${_plEsc(x.t)}" aria-pressed="${x.done}">${PL_CHECK}</button>`;
}
function _plCard(x, kids, isNow, ds) {
  const subs = (kids || []).map(c => `<div class="pl-sub ${c.k}${c.done ? ' done' : ''}" role="button" tabindex="0" onclick="event.stopPropagation(); plEdit('${c.k}','${_plEsc(c.id)}')">
      ${_plTick(c)}<span class="ttl">${_plEsc(c.t)}</span><span class="meta">${c.k === 'habit' ? 'Habit' : 'Task'} · ${_plHM(c.s)}</span></div>`).join('');
  return `<div class="pl-card ${x.k}${x.done ? ' done' : ''}${isNow ? ' now' : ''}" role="button" tabindex="0" onclick="plEdit('${x.k}','${_plEsc(x.id)}')">
    ${_plTick(x)}<span class="ttl">${_plEsc(x.t)}${isNow ? '<span class="pl-badge">NOW</span>' : ''}</span>
    <span class="meta">${_plMeta(x, ds)}</span>${subs ? `<div class="pl-subs">${subs}</div>` : ''}</div>`;
}
function _plCurrent(list, n) { return _pl.off.has('plan') ? null : list.find(x => x.k === 'plan' && x.s <= n && n < x.e); }
function _plAnytimeHTML(any) {
  return `<p class="pl-h">Anytime</p>${any.length ? any.map(x => `<div class="pl-mini ${x.k}${x.done ? ' done' : ''}">${_plTick(x)}<button type="button" class="ttl" onclick="plEdit('${x.k}','${_plEsc(x.id)}')">${_plEsc(x.t)}</button><span class="k">${x.k === 'habit' ? 'Habit' : 'Task'}</span></div>`).join('')
    : '<p class="pl-note">Nothing without a time.</p>'}`;
}
function _plDayHTML(ds) {
  const list = _plItems(ds), today = ds === _plToday();
  const n = today ? _plNowMin() : (ds < _plToday() ? 1440 : -1);
  const { top, kids, anytime } = _plStructure(list);
  const cur = today ? _plCurrent(list, n) : null;
  let h = `<div class="pl-legend">${['plan', 'habit', 'task'].map(k => `<button type="button" class="pl-chip${_pl.off.has(k) ? ' off' : ''}" onclick="plFilter('${k}')" aria-pressed="${!_pl.off.has(k)}"><i class="dot ${k}"></i><span>${k === 'plan' ? 'Plan' : k === 'habit' ? 'Habits' : 'Tasks'}</span></button>`).join('')}<span class="pl-hint">Tick to complete · tap to edit</span></div>`;
  if (today) {
    const late = list.filter(x => x.k === 'plan' && !x.done && x.e <= n && n - x.e <= 90 && !_pl.dismissed[x.id]).sort((a, b) => b.e - a.e)[0];
    if (late) {
      const over = n - late.e, by = Math.max(15, Math.ceil(over / 15) * 15);
      h += `<div class="pl-banner" role="status"><span>⏱ <b>${_plEsc(late.t)}</b> ended ${_plDur(over)} ago and isn't ticked.</span><span class="acts">
        <button type="button" onclick="plannerToggleEventDone('${_plEsc(late.id)}')">It's done</button>
        <button type="button" onclick="plShiftDay('${_plEsc(late.id)}')">Shift rest of day +${by} min</button>
        <button type="button" onclick="plDismissLate('${_plEsc(late.id)}')" aria-label="Dismiss">✕</button></span></div>`;
    }
  }
  if (!top.length && !anytime.length) {
    h += `<div class="pl-empty"><h3>Nothing planned yet</h3><p>Add a block, or set a default journal template with a day plan to fill every day automatically.</p><button type="button" class="pl-btn primary" onclick="openEventModal('${ds}')">+ Add a block</button></div>`;
    return h;
  }
  h += '<div class="pl-tl">';
  const lead = [];
  for (const x of top) { const ks = kids.get(x.id) || []; if (x.done && ks.every(k => k.done) && x.e <= n) lead.push(x); else break; }
  let start = 0;
  if (lead.length >= 2) {
    if (_pl.showFold) h += `<div class="pl-row"><span class="pl-tm"></span><button type="button" class="pl-fold" onclick="plFold(0)"><span class="ok">${PL_CHECK}</span><span><b>${lead.length} done</b></span><span class="more">Hide</span></button></div>`;
    else { h += `<div class="pl-row"><span class="pl-tm">${_plHM(lead[0].s)}</span><button type="button" class="pl-fold" onclick="plFold(1)"><span class="ok">${PL_CHECK}</span><span><b>${lead.length} done</b> · ${_plEsc(lead.map(x => x.t).join(', '))}</span><span class="more">Show</span></button></div>`; start = lead.length; }
  }
  let nowDrawn = n < 0 || n >= 1440;
  let prevEnd = start > 0 ? Math.max(...lead.map(x => x.e)) : null;
  for (let i = start; i < top.length; i++) {
    const x = top[i];
    if (prevEnd != null && x.s - prevEnd >= 30) {
      if (!nowDrawn && prevEnd > n) { h += `<div class="pl-nowline"><span>${_plHM(n)}</span><i></i></div>`; nowDrawn = true; }
      h += `<div class="pl-row"><span class="pl-tm">${_plHM(prevEnd)}</span><button type="button" class="pl-gap" onclick="plAddAt(${prevEnd})"><span>${_plDur(x.s - prevEnd)} free</span><span class="add">+ Add here</span></button></div>`;
    }
    if (!nowDrawn && x.s > n) { h += `<div class="pl-nowline"><span>${_plHM(n)}</span><i></i></div>`; nowDrawn = true; }
    h += `<div class="pl-row"><span class="pl-tm">${_plHM(x.s)}</span>${_plCard(x, kids.get(x.id), cur && cur.id === x.id, ds)}</div>`;
    prevEnd = Math.max(prevEnd || 0, x.e);
  }
  if (!nowDrawn) h += `<div class="pl-nowline"><span>${_plHM(n)}</span><i></i></div>`;
  h += '</div>';
  h += `<div class="pl-box pl-any-phone">${_plAnytimeHTML(anytime)}</div>`;
  if (today && n >= 1200) {
    const openN = list.filter(x => !x.done && x.k !== 'habit').length;
    h += `<div class="pl-wrap"><span>🌙 <b>Wrap up the day</b> · ${openN} still open</span><button type="button" onclick="plWrapUp()">Wrap up</button></div>`;
  }
  return h;
}
function _plSideHTML(ds) {
  const list = _plItems(ds), today = ds === _plToday(), n = _plNowMin();
  const timed = list.filter(x => x.s != null && !_pl.off.has(x.k)).sort((a, b) => a.s - b.s);
  let h = '';
  if (today) {
    const cur = _plCurrent(list, n);
    const nxt = timed.find(x => x.k === 'plan' && x.s >= (cur ? cur.e : n)) || timed.find(x => x.s > n);
    if (cur) {
      const pct = Math.round((n - cur.s) / (cur.e - cur.s) * 100);
      h += `<div class="pl-box pl-nowbox"><p class="pl-h">Now · until ${_plHM(cur.e)}</p><p class="big">${_plEsc(cur.t)}</p><div class="cd">${_plDur(cur.e - n)} left</div><div class="pbar"><i style="width:${pct}%"></i></div>
        <div class="two"><button type="button" class="fill" onclick="plFocus('${_plEsc(cur.id)}')">▶ Focus</button><button type="button" onclick="plannerToggleEventDone('${_plEsc(cur.id)}')">${cur.done ? 'Undo' : '✓ Done'}</button></div>
        ${nxt ? `<p class="next">Next at ${_plHM(nxt.s)} · ${_plEsc(nxt.t)}</p>` : ''}</div>`;
    } else {
      h += `<div class="pl-box pl-nowbox"><p class="pl-h">Now · ${_plHM(n)}</p><p class="big">${nxt ? 'Free until ' + _plHM(nxt.s) : 'Nothing else planned'}</p>${nxt ? `<p class="next">Next · ${_plEsc(nxt.t)}</p>` : ''}</div>`;
    }
  }
  const c = k => { const a = list.filter(x => x.k === k); return [a.filter(x => x.done).length, a.length]; };
  const [pd, pt] = c('plan'), [hd, ht] = c('habit'), [td, tt] = c('task');
  const done = pd + hd + td, all = pt + ht + tt, frac = all ? done / all : 0, C = 2 * Math.PI * 15.5;
  h += `<div class="pl-box"><div class="pl-ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--pl-line2)" stroke-width="4"/>${frac > 0 ? `<circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--pl-habit)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 18 18)"/>` : ''}</svg>
    <div><p class="pl-h">${today ? 'Today' : ds < _plToday() ? 'This day' : 'Planned'}</p><p class="big">${done} of ${all} done</p><p class="split">Plan ${pd}/${pt} · Habits ${hd}/${ht}${tt ? ` · Tasks ${td}/${tt}` : ''}</p></div></div></div>`;
  h += `<div class="pl-box pl-any-desk">${_plAnytimeHTML(list.filter(x => x.s == null && !_pl.off.has(x.k)))}<p class="pl-note">Give an item a time to put it on the timeline.</p></div>`;
  return h;
}

/* ── week + month ─────────────────────────────────────────────── */
function _plStats(ds) { const l = _plItems(ds); return { d: l.filter(x => x.done).length, n: l.length, p: l.filter(x => x.k === 'plan').length, h: l.filter(x => x.k === 'habit').length, t: l.filter(x => x.k === 'task').length }; }
function _plWeekHTML() {
  const c = calState.cursor, st = _plAdd(c, -((c.getDay() + 6) % 7)), td = _plToday();
  const defTpl = (state.data.diary_templates || []).find(t => (t.is_default === true || t.is_default === 'true') && t.plan_json && String(t.plan_json).length > 2);
  let h = '<div class="pl-week">';
  for (let i = 0; i < 7; i++) {
    const d = _plAdd(st, i), k = _plIso(d), s = _plStats(k), isT = k === td, past = k < td;
    const pct = s.n ? Math.round(s.d / s.n * 100) : 0;
    h += `<button type="button" class="pl-wd${isT ? ' today' : ''}" onclick="plOpenDay('${k}')"><span class="d"><b>${d.toLocaleDateString(undefined, { weekday: 'short' })}</b><span>${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></span>
      <span class="bars"><span class="bar"><i style="width:${past || isT ? pct : 0}%"></i></span><span class="sub">${!s.p && k > td && defTpl ? `Plan fills from “${_plEsc(defTpl.title || 'your template')}” on the day · ${s.h} habits` : `${s.p} plan · ${s.h} habits${s.t ? ` · ${s.t} tasks` : ''}`}</span></span>
      <span class="n">${past || isT ? `${s.d}/${s.n} done` : (s.n ? `${s.n} planned` : 'Empty')}</span></button>`;
  }
  return h + '</div><p class="pl-note">Tap a day to open it.</p>';
}
function _plMonthHTML() {
  const c = calState.cursor, f = new Date(c.getFullYear(), c.getMonth(), 1), st = _plAdd(f, -((f.getDay() + 6) % 7)), td = _plToday();
  let h = '<div class="pl-month">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="dn">${d}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = _plAdd(st, i), k = _plIso(d), out = d.getMonth() !== f.getMonth(), isT = k === td;
    const s = _plStats(k), pct = k <= td && s.n ? Math.round(s.d / s.n * 100) : 0;
    h += `<button type="button" class="pl-mc${out ? ' out' : ''}${isT ? ' today' : ''}" onclick="plOpenDay('${k}')" aria-label="${d.toDateString()}"><b>${d.getDate()}</b>${s.p ? `<span class="cnt">${s.p}</span>` : ''}<span class="heat"><i style="width:${pct}%"></i></span></button>`;
  }
  return h + '</div><p class="pl-note">The number is how many plan blocks a day has; the green bar is how much got done.</p>';
}
window.plOpenDay = function (k) { calState.cursor = _plDate(k); calState.view = 'day'; renderCalendar(); };

/* ── shell ─────────────────────────────────────────────────────── */
function renderCalendar() {
  if (window._plannerJumpTo) {
    const [y, m, d] = String(window._plannerJumpTo).split('-').map(Number);
    if (y && m && d) { calState.cursor = new Date(y, m - 1, d); calState.view = 'day'; }
    window._plannerJumpTo = null;
  }
  if (!['day', 'week', 'month'].includes(calState.view)) calState.view = 'day';
  _plStyles();
  const main = document.getElementById('main');
  const c = calState.cursor, ds = _plIso(c), v = calState.view;
  const title = v === 'month' ? c.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : v === 'week' ? 'Week of ' + _plAdd(c, -((c.getDay() + 6) % 7)).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
      : c.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const isToday = ds === _plToday();
  main.innerHTML = `<div class="pl">
    <header class="pl-top">
      <div class="pl-title"><h2>${_plEsc(title)}</h2>${v === 'day' && isToday ? '<p>Today</p>' : ''}</div>
      <div class="pl-seg" role="group" aria-label="View">${['day', 'week', 'month'].map(x => `<button type="button" class="${x === v ? 'on' : ''}" onclick="switchCalView('${x}')">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>
      <div class="pl-nav"><button type="button" class="pl-ib" onclick="navCal(-1)" aria-label="Previous">‹</button><button type="button" class="pl-btn" onclick="navCal(0)">Today</button><button type="button" class="pl-ib" onclick="navCal(1)" aria-label="Next">›</button></div>
    </header>
    <div class="pl-body${v === 'day' ? '' : ' wide'}">
      <section class="pl-main">${v === 'day' ? _plDayHTML(ds) : v === 'week' ? _plWeekHTML() : _plMonthHTML()}</section>
      ${v === 'day' ? `<aside class="pl-side">${_plSideHTML(ds)}</aside>` : ''}
    </div>
  </div>`;
  // Keep "now" fresh while today's day view is open.
  if (_pl.timer) clearInterval(_pl.timer);
  if (v === 'day' && isToday) _pl.timer = setInterval(() => {
    if (state.view !== 'calendar' || document.getElementById('plLayer')?.innerHTML) return;
    if (document.querySelector('#eventModal:not(.hidden)')) return;
    renderCalendar();
  }, 60000);
}

function _plStyles() {
  if (document.getElementById('plStyles')) return;
  const st = document.createElement('style');
  st.id = 'plStyles';
  st.textContent = `
.pl{--pl-plan:#6D5DE7;--pl-habit:#10B981;--pl-task:#F59E0B;--pl-now:#EF4444;
  --pl-line:var(--border-color,#E5E7EB);--pl-line2:color-mix(in srgb,var(--border-color,#E5E7EB) 60%,transparent);
  --pl-plan-bg:color-mix(in srgb,var(--pl-plan) 8%,var(--surface-1,#fff));--pl-plan-ln:color-mix(in srgb,var(--pl-plan) 22%,var(--surface-1,#fff));--pl-plan-fg:color-mix(in srgb,var(--pl-plan) 82%,var(--text-1,#0F172A));
  --pl-habit-bg:color-mix(in srgb,var(--pl-habit) 9%,var(--surface-1,#fff));--pl-habit-ln:color-mix(in srgb,var(--pl-habit) 24%,var(--surface-1,#fff));--pl-habit-fg:color-mix(in srgb,var(--pl-habit) 78%,var(--text-1,#0F172A));
  --pl-task-bg:color-mix(in srgb,var(--pl-task) 10%,var(--surface-1,#fff));--pl-task-ln:color-mix(in srgb,var(--pl-task) 28%,var(--surface-1,#fff));--pl-task-fg:color-mix(in srgb,var(--pl-task) 70%,var(--text-1,#0F172A));
  max-width:1280px;margin:0 auto;background:var(--surface-1,#fff);border:1px solid var(--pl-line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-card,0 1px 2px rgba(15,23,42,.05));color:var(--text-1)}
.pl button{font-family:inherit;-webkit-tap-highlight-color:transparent}
.pl-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid var(--pl-line)}
.pl-title{margin-right:auto;min-width:0}
.pl-title h2{margin:0;font-size:21px;font-weight:750;letter-spacing:-.02em;color:var(--text-1)}
.pl-title p{margin:2px 0 0;font-size:12.5px;color:var(--text-2)}
.pl-seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--pl-line);border-radius:11px;padding:3px}
.pl-seg button{border:0;background:transparent;font-size:13px;font-weight:600;padding:6px 14px;border-radius:8px;color:var(--text-2);cursor:pointer}
.pl-seg button.on{background:var(--surface-1);color:var(--text-1);box-shadow:0 1px 2px rgba(15,23,42,.12)}
.pl-nav{display:flex;gap:6px}
.pl-ib,.pl-btn{height:36px;border:1px solid var(--pl-line);background:var(--surface-1);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;color:var(--text-2);cursor:pointer}
.pl-ib{width:36px;font-size:18px}.pl-btn{padding:0 14px}
.pl-btn.primary{background:var(--primary);border-color:var(--primary);color:#fff;font-weight:700}
.pl-ib:hover,.pl-btn:hover{border-color:var(--text-3)}
.pl-body{display:grid;grid-template-columns:minmax(0,1fr) 330px}
.pl-body.wide{grid-template-columns:minmax(0,1fr)}
.pl-main{padding:14px 20px 22px;min-width:0}
.pl-body:not(.wide) .pl-main{border-right:1px solid var(--pl-line)}
.pl-side{padding:14px 16px 22px;display:flex;flex-direction:column;gap:12px;background:var(--surface-2);min-width:0}
.pl-legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pl-chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:99px;border:1px solid var(--pl-line);background:var(--surface-1);font-size:12.5px;font-weight:600;color:var(--text-2);cursor:pointer}
.pl-chip .dot{width:9px;height:9px;border-radius:50%}
.dot.plan{background:var(--pl-plan)}.dot.habit{background:var(--pl-habit)}.dot.task{background:var(--pl-task)}
.pl-chip.off{opacity:.45}.pl-chip.off span{text-decoration:line-through}
.pl-hint{margin-left:auto;font-size:12px;color:var(--text-3)}
.pl-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:color-mix(in srgb,#F59E0B 12%,var(--surface-1));border:1px solid color-mix(in srgb,#F59E0B 35%,var(--surface-1));color:color-mix(in srgb,#B45309 80%,var(--text-1));border-radius:12px;padding:9px 10px 9px 14px;margin-top:12px;font-size:13px}
.pl-banner b{font-weight:700}
.pl-banner .acts{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.pl-banner button{height:30px;border-radius:8px;border:1px solid color-mix(in srgb,#F59E0B 35%,var(--surface-1));background:var(--surface-1);font-size:12px;font-weight:700;padding:0 10px;color:inherit;cursor:pointer}
.pl-tl{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.pl-row{display:flex;gap:12px;align-items:stretch}
.pl-tm{width:46px;flex:none;text-align:right;font-size:12px;color:var(--text-3);padding-top:12px;font-variant-numeric:tabular-nums}
.pl-card{position:relative;flex:1;min-width:0;border-radius:12px;border:1px solid;border-left-width:4px;padding:10px 12px 10px 42px;font-size:13.5px;cursor:pointer;transition:box-shadow .15s}
.pl-card.plan{background:var(--pl-plan-bg);border-color:var(--pl-plan-ln);border-left-color:var(--pl-plan);color:var(--pl-plan-fg)}
.pl-card.habit{background:var(--pl-habit-bg);border-color:var(--pl-habit-ln);border-left-color:var(--pl-habit);color:var(--pl-habit-fg)}
.pl-card.task{background:var(--pl-task-bg);border-color:var(--pl-task-ln);border-left-color:var(--pl-task);color:var(--pl-task-fg)}
.pl-card:hover{box-shadow:0 2px 10px rgba(15,23,42,.08)}
.pl-card.now{box-shadow:0 0 0 2px var(--surface-1),0 0 0 4px var(--pl-plan-ln)}
.pl-card .ttl{display:block;font-weight:650;color:var(--text-1);overflow-wrap:anywhere}
.pl-card .meta{display:block;font-size:12px;color:var(--text-2);margin-top:2px}
.pl-card.done{opacity:.62}.pl-card.done>.ttl{text-decoration:line-through;color:var(--text-2)}
.pl-tick{position:absolute;left:12px;top:11px;width:19px;height:19px;border-radius:6px;border:2px solid currentColor;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;color:inherit;cursor:pointer}
.pl-tick.round{border-radius:50%}
.pl-tick svg{width:12px;height:12px;opacity:0}
.done>.pl-tick{background:currentColor}.done>.pl-tick svg{opacity:1;color:var(--surface-1)}
.pl-badge{display:inline-block;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:99px;background:var(--pl-now);color:#fff;vertical-align:2px}
.pl-subs{display:flex;flex-direction:column;gap:5px;margin-top:9px}
.pl-sub{position:relative;display:flex;align-items:center;gap:8px;min-height:34px;border-radius:9px;padding:5px 10px 5px 36px;background:var(--surface-1);border:1px solid var(--pl-line);font-size:12.5px;cursor:pointer}
.pl-sub.habit{color:var(--pl-habit-fg)}.pl-sub.task{color:var(--pl-task-fg)}
.pl-sub .pl-tick{left:9px;top:50%;transform:translateY(-50%);width:17px;height:17px}
.pl-sub .ttl{font-weight:600;color:var(--text-1);min-width:0;overflow-wrap:anywhere}
.pl-sub .meta{margin-left:auto;font-size:11.5px;color:var(--text-2);white-space:nowrap}
.pl-sub.done .ttl{text-decoration:line-through;color:var(--text-2)}
.pl-fold{flex:1;display:flex;align-items:center;gap:10px;border:1px dashed var(--pl-line);background:var(--surface-2);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text-2);text-align:left;cursor:pointer;min-width:0}
.pl-fold .ok{width:22px;height:22px;flex:none;border-radius:50%;background:var(--pl-habit);color:#fff;display:flex;align-items:center;justify-content:center}
.pl-fold .ok svg{width:12px;height:12px}
.pl-fold b{color:var(--text-1);font-weight:700}
.pl-fold>span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-fold .more{margin-left:auto;color:var(--pl-plan-fg);font-weight:600;white-space:nowrap}
.pl-gap{flex:1;display:flex;align-items:center;gap:8px;border:0;border-top:1px dashed var(--pl-line);background:none;margin-top:6px;padding:6px 0 0;font-size:12px;color:var(--text-3);text-align:left;cursor:pointer}
.pl-gap .add{margin-left:auto;color:var(--pl-plan-fg);font-weight:600}
.pl-gap:hover .add{text-decoration:underline}
.pl-nowline{display:flex;align-items:center;gap:12px}
.pl-nowline span{width:46px;text-align:right;font-size:11px;font-weight:800;color:var(--pl-now);font-variant-numeric:tabular-nums}
.pl-nowline i{flex:1;height:2px;background:var(--pl-now);position:relative}
.pl-nowline i::before{content:"";position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:var(--pl-now)}
.pl-empty{border:1px dashed var(--pl-line);border-radius:14px;padding:28px 20px;text-align:center;color:var(--text-2);margin-top:12px}
.pl-empty h3{margin:0 0 6px;color:var(--text-1);font-size:16px}
.pl-empty p{margin:0 0 14px;font-size:13px}
.pl-wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--text-1);color:var(--surface-1);border-radius:14px;padding:12px 14px;margin-top:12px;font-size:13px}
.pl-wrap b{font-weight:700}
.pl-wrap button{margin-left:auto;height:32px;border:0;border-radius:9px;background:var(--surface-1);color:var(--text-1);font-weight:700;font-size:12.5px;padding:0 12px;cursor:pointer}
.pl-box{background:var(--surface-1);border:1px solid var(--pl-line);border-radius:14px;padding:14px}
.pl-h{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2);margin:0}
.pl-note{font-size:12px;color:var(--text-3);margin:8px 0 0}
.pl-nowbox{background:var(--pl-plan-bg);border-color:var(--pl-plan-ln)}
.pl-nowbox .pl-h{color:var(--pl-plan-fg)}
.pl-box .big{font-size:16.5px;font-weight:700;margin:6px 0 0;overflow-wrap:anywhere;color:var(--text-1)}
.pl-nowbox .cd{font-size:28px;font-weight:800;letter-spacing:-.03em;margin-top:6px;color:var(--pl-plan-fg);font-variant-numeric:tabular-nums}
.pl-nowbox .pbar{height:6px;border-radius:99px;background:var(--pl-plan-ln);margin-top:8px;overflow:hidden}
.pl-nowbox .pbar i{display:block;height:100%;background:var(--pl-plan);border-radius:99px}
.pl-nowbox .two{display:flex;gap:8px;margin-top:12px}
.pl-nowbox .two button{flex:1;height:36px;border-radius:10px;font-weight:700;font-size:13px;border:1px solid var(--pl-plan-ln);background:var(--surface-1);color:var(--pl-plan-fg);cursor:pointer}
.pl-nowbox .two button.fill{background:var(--pl-plan);border-color:var(--pl-plan);color:#fff}
.pl-nowbox .next{font-size:12.5px;color:var(--text-2);margin:10px 0 0}
.pl-ring{display:flex;align-items:center;gap:14px}
.pl-ring svg{width:62px;height:62px;flex:none}
.pl-ring .big{margin-top:2px}
.pl-ring .split{font-size:12px;color:var(--text-2);margin:3px 0 0}
.pl-mini{position:relative;display:flex;align-items:center;gap:10px;padding:8px 0 8px 28px;border-bottom:1px solid var(--pl-line2);font-size:13px}
.pl-mini:last-of-type{border-bottom:0}
.pl-mini .pl-tick{left:0;top:50%;transform:translateY(-50%);width:17px;height:17px}
.pl-mini.task{color:var(--pl-task-fg)}.pl-mini.habit{color:var(--pl-habit-fg)}
.pl-mini .ttl{flex:1;min-width:0;border:0;background:none;padding:0;text-align:left;color:var(--text-1);font-size:13px;cursor:pointer}
.pl-mini.done .ttl{text-decoration:line-through;color:var(--text-2)}
.pl-mini .k{font-size:11px;font-weight:600}
.pl-box .pl-mini:first-of-type{margin-top:4px}
.pl-any-phone{display:none;margin-top:14px}
.pl-week{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.pl-wd{display:flex;align-items:center;gap:14px;border:1px solid var(--pl-line);border-radius:12px;padding:12px 14px;background:var(--surface-1);text-align:left;width:100%;cursor:pointer;color:var(--text-1)}
.pl-wd:hover{border-color:var(--text-3)}
.pl-wd.today{border-color:var(--pl-plan-ln);background:var(--pl-plan-bg)}
.pl-wd .d{width:70px;flex:none}.pl-wd .d b{display:block;font-size:15px}.pl-wd .d span{font-size:12px;color:var(--text-2)}
.pl-wd .bars{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}
.pl-wd .bar{height:6px;border-radius:99px;background:var(--pl-line2);overflow:hidden}
.pl-wd .bar i{display:block;height:100%;border-radius:99px;background:var(--pl-habit)}
.pl-wd .sub{font-size:12px;color:var(--text-2)}
.pl-wd .n{font-size:12.5px;color:var(--text-2);width:90px;text-align:right;font-variant-numeric:tabular-nums}
.pl-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:4px}
.pl-month .dn{font-size:11px;font-weight:700;color:var(--text-3);text-align:center;padding:4px 0}
.pl-mc{position:relative;aspect-ratio:1/1;max-width:100%;border:1px solid var(--pl-line);border-radius:10px;background:var(--surface-1);padding:6px;text-align:left;display:flex;flex-direction:column;gap:4px;min-width:0;cursor:pointer;color:var(--text-1)}
.pl-mc:hover{border-color:var(--text-3)}
.pl-mc.out{opacity:.4}
.pl-mc.today{border-color:var(--pl-plan);box-shadow:inset 0 0 0 1px var(--pl-plan)}
.pl-mc b{font-size:12.5px}
.pl-mc .cnt{position:absolute;top:6px;right:7px;font-size:10.5px;font-weight:700;color:var(--pl-plan-fg)}
.pl-mc .heat{margin-top:auto;height:5px;border-radius:99px;background:var(--pl-line2);overflow:hidden}
.pl-mc .heat i{display:block;height:100%;background:var(--pl-habit)}
#plLayer .pl-scrim{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:10050;padding:16px}
#plLayer .pl-sheet{width:min(460px,100%);max-height:100%;overflow:auto;background:var(--surface-1);color:var(--text-1);border:1px solid var(--border-color);border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
#plLayer h2{margin:0 0 6px;font-size:17px}
#plLayer .pl-note{font-size:12.5px;color:var(--text-2);margin:0 0 12px}
#plLayer .pl-ul{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:6px}
#plLayer .pl-ul label{display:flex;align-items:center;gap:10px;border:1px solid var(--border-color);border-radius:10px;padding:9px 12px;font-size:13.5px;cursor:pointer}
#plLayer .pl-ul input{width:16px;height:16px;accent-color:var(--primary);margin:0}
#plLayer .pl-ul .t{flex:1;min-width:0}
#plLayer .pl-ul .k{font-size:11.5px;color:var(--text-3)}
#plLayer .pl-foot{display:flex;justify-content:flex-end;gap:8px}
#plLayer .pl-btn{height:36px;border:1px solid var(--border-color);background:var(--surface-1);border-radius:10px;font-weight:600;font-size:13px;color:var(--text-2);padding:0 14px;cursor:pointer;font-family:inherit}
#plLayer .pl-btn.primary{background:var(--primary);border-color:var(--primary);color:#fff;font-weight:700}
#plLayer .pl-focus{position:fixed;inset:0;z-index:10060;background:#0F172A;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;padding-top:calc(24px + env(safe-area-inset-top,0px))}
#plLayer .pl-focus .k{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
#plLayer .pl-focus h2{font-size:24px;max-width:22ch;margin:0}
#plLayer .pl-focus .t{font-size:72px;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
#plLayer .pl-focus .fb{display:flex;gap:10px;margin-top:8px}
#plLayer .pl-focus button{height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:700;padding:0 18px;cursor:pointer;font-family:inherit}
#plLayer .pl-focus button.go{background:#10B981;border-color:#10B981}
#plLayer .pl-focus p{opacity:.6;font-size:13px;margin:6px 0 0}
@media (max-width:860px){
  .pl{border-radius:14px}
  .pl-top{padding:12px 14px}
  .pl-title{flex:1 1 auto}
  .pl-title h2{font-size:18px}
  .pl-seg{order:5;flex:1 1 100%;display:flex}.pl-seg button{flex:1}
  .pl-body{grid-template-columns:minmax(0,1fr)}
  .pl-body:not(.wide) .pl-main{border-right:0}
  .pl-main{padding:12px 14px 18px;order:2}
  .pl-side{order:1;padding:12px 14px 0;background:var(--surface-1)}
  .pl-any-desk{display:none}
  .pl-any-phone{display:block}
  .pl-hint{display:none}
  .pl-tm,.pl-nowline span{width:40px}
  .pl-row{gap:10px}
  .pl-wd .n{width:auto}
  .pl-sub .meta{display:none}
}
@media (prefers-reduced-motion:reduce){.pl *{transition:none!important}}
`;
  document.head.appendChild(st);
}

/* --- DONE STATE (shared with the journal's Day plan) --- */
function _plannerIsDone(e) { return !!e && (e.done === true || e.done === 'true' || e.done === 1 || e.done === '1'); }

window.plannerToggleEventDone = async function (id) {
  const e = (state.data.planner || []).find(x => String(x.id) === String(id));
  if (!e) return;
  const prev = e.done;
  const next = !_plannerIsDone(e);
  e.done = next;
  if (state.view === 'calendar') renderCalendar();
  try {
    const res = await apiCall('update', 'planner_events', { done: next }, id);
    if (res && res.success === false) throw new Error(res.message || 'failed');
    if (res && (res.skipped || (res.data && !('done' in res.data)))) showToast('Ticks won’t save until the planner “done” migration is run in Supabase');
  } catch (err) {
    e.done = prev;
    if (state.view === 'calendar') renderCalendar();
    showToast('Couldn’t update the event');
  }
};

/* --- LOGIC --- */
function switchCalView(v) { calState.view = v; renderCalendar(); }

function navCal(dir) {
  const d = new Date(calState.cursor);
  if (dir === 0) {
    calState.cursor = new Date();
  } else {
    if (calState.view === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
    else if (calState.view === 'week') d.setDate(d.getDate() + (dir * 7));
    else d.setDate(d.getDate() + dir);
    calState.cursor = d;
  }
  renderCalendar();
}

window.openEventModal = function (dateIso = null, startTime = "09:00") {
  const modal = document.getElementById('universalModal');
  if (modal) modal.classList.remove('bottom-sheet');
  const box = modal ? modal.querySelector('.modal-box') : null;
  // 1. Inject Modal if missing (Lazy Load)
  if (!document.getElementById('eventModal')) {
    const modalHTML = `
      <div id="eventModal" class="modal-overlay hidden" onclick="if(event.target === this) closeModal()">
        <div class="modal-box" style="padding:0; overflow:hidden;">
          <div style="background:linear-gradient(135deg, var(--surface-2), var(--surface-1)); padding:24px; border-bottom:1px solid var(--border-color);">
            <h3 style="margin:0; text-align:center; font-size:18px; color:var(--text-1);">Add New Event</h3>
          </div>
          <div style="padding:24px;">
            <div style="margin-bottom:20px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Event Title</label>
              <div class="input-group" style="position:relative;">
                ${renderIcon('tag', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                <input class="input" id="evtTitle" placeholder="e.g., Team Sync" style="padding-left:36px; font-weight:600; font-size:1.1em; width:100%;">
              </div>
            </div>

            <!-- Category Pills -->
            <div style="margin-bottom:20px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Category</label>
              <div id="evtCatPills" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${Object.keys(CATEGORY_COLORS).map(c => `
                  <div class="cat-pill" data-val="${c}" onclick="selectCategoryPill(this)" style="cursor:pointer; padding:6px 12px; border-radius:16px; font-size:12px; font-weight:500; border:1px solid var(--border-color); background:var(--surface-base); color:var(--text-2); transition:all 0.2s;">
                    ${c}
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="evtCategory" value="Other">
            </div>

            <!-- Color picker -->
            <div style="margin-bottom:20px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Color</label>
              <div id="evtColorSwatches" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                <div class="evt-color-opt" data-color="" onclick="selectEventColor(this)" title="Auto (match category)"
                     style="cursor:pointer; height:26px; padding:0 12px; display:flex; align-items:center; border-radius:14px; font-size:12px; font-weight:600; color:var(--text-2); border:1px solid var(--border-color); background:var(--surface-base);">Auto</div>
                ${EVENT_COLORS.map(c => `
                  <div class="evt-color-opt" data-color="${c}" onclick="selectEventColor(this)" title="${c}"
                       style="cursor:pointer; width:26px; height:26px; border-radius:50%; background:${c}; border:2px solid transparent; box-shadow:0 1px 2px rgba(0,0,0,0.15);"></div>
                `).join('')}
              </div>
              <input type="hidden" id="evtColor" value="">
            </div>

            <!-- Date & Time Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
              <div style="grid-column: 1 / -1;">
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Date</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('calendar', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input type="date" class="input" id="evtDate" style="padding-left:36px; width:100%;">
                </div>
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Start Time</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('clock', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input class="input" type="time" id="evtStart" style="padding-left:36px; width:100%;">
                </div>
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">End Time</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('clock', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input class="input" type="time" id="evtEnd" style="padding-left:36px; width:100%;">
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
              <button class="btn" style="flex:1;" onclick="closeModal()">Cancel</button>
              <button class="btn primary" style="flex:1;" data-action="save-event">Save Event</button>
              <button id="evtDelete" class="btn hidden" style="flex:0; background:var(--danger); color:white; border:none; padding:8px;" onclick="deleteEventFromModal()">${renderIcon('delete', null, 'style="width:18px;height:18px;"')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Add logic for pill selection
    window.selectCategoryPill = function (el) {
      document.querySelectorAll('#evtCatPills .cat-pill').forEach(p => {
        p.style.background = 'var(--surface-base)';
        p.style.color = 'var(--text-2)';
        p.style.borderColor = 'var(--border-color)';
      });
      const val = el.dataset.val;
      document.getElementById('evtCategory').value = val;
      const color = CATEGORY_COLORS[val] || 'var(--primary)';
      el.style.background = color + '20'; // roughly 12% opacity
      el.style.color = color;
      el.style.borderColor = color;
    };

    // Color swatch selection — sets the hidden #evtColor and rings the choice.
    window.selectEventColor = function (el) {
      document.querySelectorAll('#evtColorSwatches .evt-color-opt').forEach(o => {
        if (o.dataset.color === '') { o.style.borderColor = 'var(--border-color)'; o.style.color = 'var(--text-2)'; }
        else { o.style.borderColor = 'transparent'; o.style.transform = 'none'; }
      });
      const val = el.dataset.color || '';
      document.getElementById('evtColor').value = val;
      if (val === '') { el.style.borderColor = 'var(--primary)'; el.style.color = 'var(--primary)'; }
      else { el.style.borderColor = 'var(--text-1)'; el.style.transform = 'scale(1.12)'; }
    };
  }

  const today = _plIso(calState.cursor || new Date());

  // Set values
  document.getElementById('evtDate').value = dateIso || today;
  document.getElementById('evtStart').value = startTime;

  // Auto-set end time to +1 hour
  const [sh, sm] = startTime.split(':').map(Number);
  const endH = (sh + 1) % 24;
  const endHStr = endH < 10 ? '0' + endH : endH;
  document.getElementById('evtEnd').value = `${endHStr}:${startTime.split(':')[1]}`;

  document.getElementById('evtTitle').value = ''; // Clear title
  document.getElementById('evtCategory').value = 'Other'; // Default category
  // Reset color to Auto
  const colorInput = document.getElementById('evtColor');
  if (colorInput) {
    colorInput.value = '';
    const autoSwatch = document.querySelector('#evtColorSwatches .evt-color-opt[data-color=""]');
    if (autoSwatch && typeof selectEventColor === 'function') selectEventColor(autoSwatch);
  }

  // Reset button to create mode (in case it was in edit mode)
  const saveBtn = document.querySelector('[data-action="update-event-modal"], [data-action="save-event"]');
  if (saveBtn) {
    saveBtn.setAttribute('data-action', 'save-event');
    saveBtn.removeAttribute('data-edit-id');
    saveBtn.textContent = 'Save Event';
  }

  // Hide delete button in create mode
  const deleteBtn = document.getElementById('evtDelete');
  if (deleteBtn) deleteBtn.classList.add('hidden');

  document.getElementById('eventModal').classList.remove('hidden');
  document.getElementById('evtTitle').focus();
}

window.deleteEventFromModal = async function () {
  const editId = document.querySelector('[data-action="update-event-modal"]')?.dataset?.editId;
  if (!editId) return;

  if (!confirm('Delete this event?')) return;

  try {
    await apiCall('delete', 'planner_events', null, editId);
    await refreshData('planner_events');
    closeModal();
    if (typeof renderCalendar === 'function') renderCalendar();
    showToast('Event deleted');
  } catch (e) {
    showToast('Failed to delete event');
  }
};

window.closeModal = function () {
  document.getElementById('eventModal').classList.add('hidden');
}

// --- CONSTANTS ---
const CATEGORY_COLORS = {
  'Work': 'var(--primary, #4F46E5)',
  'Personal': 'var(--success, #10B981)',
  'Health': 'var(--danger, #EF4444)',
  'Social': 'var(--warning, #F59E0B)',
  'Finance': 'var(--info, #3B82F6)',
  'Other': 'var(--gray-500, #6B7280)'
};

// Curated palette for the per-event color picker. '' = Auto (fall back to category color).
const EVENT_COLORS = ['#4F46E5', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5E9', '#64748B'];

// Resolve an event's display color: explicit color wins, else category color.
function eventColor(e) {
  return (e && e.color) ? e.color : (CATEGORY_COLORS[e && e.category] || CATEGORY_COLORS['Other']);
}

function isSameDate(d1, d2) {
  return d1.toDateString() === d2.toDateString();
}

// Robust datetime extractor — handles 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD' and epoch milliseconds
function extractDatetime(dtStr) {
  if (!dtStr) return { date: '', time: '' };

  // Handle epoch milliseconds (number) or epoch string
  if (typeof dtStr === 'number' || (/^\d+$/.test(String(dtStr).trim()))) {
    const date = new Date(Number(dtStr));
    if (!isNaN(date.getTime())) {
      // Use local time instead of UTC to avoid timezone offset issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }
  }

  const s = String(dtStr).trim();
  // Try T separator first
  const tIdx = s.indexOf('T');
  if (tIdx !== -1) {
    return { date: s.slice(0, tIdx), time: s.slice(tIdx + 1, tIdx + 6) };
  }
  // Try space separator
  const spIdx = s.indexOf(' ');
  if (spIdx !== -1) {
    return { date: s.slice(0, spIdx), time: s.slice(spIdx + 1, spIdx + 6) };
  }
  // Date only
  return { date: s.slice(0, 10), time: '' };
}

// Toggle a habit's completion for a specific day FROM THE PLANNER. Defined here so
// it always exists on the calendar view (toggleHabitOptimistic lives in the lazily
// loaded view-habits.js — undefined here on a fresh planner visit — and it also
// re-renders the Habits view, which would yank you off the Planner).
window.plannerToggleHabit = async function (habitId, iso) {
  iso = iso || new Date().toISOString().slice(0, 10);
  if (!Array.isArray(state.data.habit_logs)) state.data.habit_logs = [];
  const idx = state.data.habit_logs.findIndex(
    l => String(l.habit_id) === String(habitId) && (l.date || '').startsWith(iso)
  );
  try {
    if (idx !== -1) {
      const del = state.data.habit_logs[idx];
      state.data.habit_logs.splice(idx, 1);
      renderCalendar();
      if (del && del.id) await apiCall('delete', 'habit_logs', {}, del.id);
    } else {
      state.data.habit_logs.push({ id: 'temp-' + Date.now(), habit_id: habitId, date: iso, completed: true });
      renderCalendar();
      await apiCall('create', 'habit_logs', { habit_id: habitId, date: iso, status: 'completed', pomodoro_completed: 0 });
    }
    if (typeof refreshData === 'function') refreshData('habit_logs');
  } catch (e) { console.warn('plannerToggleHabit failed', e); }
};

window.openEditEvent = function (id) {
  const e = (state.data.planner || []).find(x => String(x.id) === String(id));
  if (!e) return;

  // Must open modal first if it doesn't exist yet
  if (!document.getElementById('eventModal')) {
    openEventModal(); // Creates the modal skeleton
    document.getElementById('eventModal').classList.add('hidden');
  }

  const startDt = extractDatetime(e.start_datetime);
  const endDt = extractDatetime(e.end_datetime);

  const date = startDt.date || new Date().toISOString().slice(0, 10);
  const startT = startDt.time || '09:00';
  const endT = endDt.time || '10:00';

  document.getElementById('evtDate').value = date;
  document.getElementById('evtStart').value = startT;
  document.getElementById('evtEnd').value = endT;
  document.getElementById('evtTitle').value = e.title || '';
  document.getElementById('evtCategory').value = e.category || 'Other';

  // Highlight the correct pill if pills exist
  const pills = document.querySelectorAll('#evtCatPills .cat-pill');
  if (pills.length > 0) {
    pills.forEach(p => {
      p.style.background = 'var(--surface-base)';
      p.style.color = 'var(--text-2)';
      p.style.borderColor = 'var(--border-color)';
      if (p.dataset.val === (e.category || 'Other')) {
        const color = CATEGORY_COLORS[p.dataset.val] || 'var(--primary)';
        p.style.background = color + '20';
        p.style.color = color;
        p.style.borderColor = color;
      }
    });
  }

  // Pre-select the saved color (or Auto)
  const colorInput = document.getElementById('evtColor');
  if (colorInput) {
    const want = e.color || '';
    const swatch = document.querySelector(`#evtColorSwatches .evt-color-opt[data-color="${want}"]`)
      || document.querySelector('#evtColorSwatches .evt-color-opt[data-color=""]');
    if (swatch && typeof selectEventColor === 'function') selectEventColor(swatch);
    else colorInput.value = want;
  }

  document.getElementById('eventModal').classList.remove('hidden');

  // Change Save button to Update
  const saveBtn = document.querySelector('[data-action="save-event"], [data-action="update-event-modal"]');
  if (saveBtn) {
    saveBtn.setAttribute('data-action', 'update-event-modal');
    saveBtn.setAttribute('data-edit-id', e.id);
    saveBtn.textContent = 'Update Event';
  }

  // Show delete button in edit mode
  const deleteBtn = document.getElementById('evtDelete');
  if (deleteBtn) deleteBtn.classList.remove('hidden');

  document.getElementById('evtTitle').focus();
}
