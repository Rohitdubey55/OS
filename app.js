/* ========= CONFIG ========= */
// Replace with your Apps Script Web App exec URL
const API_BASE = "https://script.google.com/macros/s/AKfycbxIirP2116jaZfKi8_SjAqlKi2c1IZ-9dx_7QHmlYbRhclX0QDtRYoC6u073WjaeXLHKQ/exec";

/* Sheets used */
const SHEETS = {
  planner: "planner_events",
  tasks: "tasks",
  expenses: "expenses",
  funds: "funds",
  assets: "assets",
  diary: "diary",
  vision: "vision_board",
  habits: "habits",
  habit_logs: "habit_logs"
};

const CACHE_TTL = 1000 * 60 * 60 * 6; // 6h

/* ========= STATE ========= */
let state = {
  currentView: "dashboard",
  data: {
    planner: [],
    tasks: [],
    expenses: [],
    funds: [],
    assets: [],
    diary: [],
    vision: [],
    habits: [],
    habit_logs: []
  },
  charts: {}
};

/* ========= UTIL ========= */
function toast(msg, t = 3000) {
  const el = document.getElementById("toast");
  if (!el) return console.log("Toast:", msg);
  el.textContent = msg;
  el.style.opacity = 1;
  el.style.display = "block";
  clearTimeout(el._to);
  el._to = setTimeout(() => {
    el.style.opacity = 0;
    el.style.display = "none";
  }, t);
}

function isoDateStr(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toISOString().slice(0, 10);
}

function isoDateTime(d, t) {
  // d = YYYY-MM-DD, t = HH:MM
  if (!d) return "";
  return `${d}T${t || '00:00'}`;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[s]);
}

// Format epoch milliseconds to readable datetime string
function formatEpochDateTime(epoch) {
  if (!epoch) return '';
  if (typeof epoch === 'string' && epoch.includes('T')) return epoch; // Already ISO string
  const date = new Date(epoch);
  if (isNaN(date.getTime())) return String(epoch);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

// Extract date from epoch for date inputs
function extractEpochDate(epoch) {
  if (!epoch) return '';
  if (typeof epoch === 'string' && epoch.includes('T')) return epoch.slice(0, 10);
  const date = new Date(epoch);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

// Extract time from epoch for time inputs
function extractEpochTime(epoch) {
  if (!epoch) return '';
  if (typeof epoch === 'string' && epoch.includes('T')) return epoch.slice(11, 16);
  const date = new Date(epoch);
  if (isNaN(date.getTime())) return '';
  return date.toTimeString().slice(0, 5);
}

/* ========= API HELPERS ========= */
async function apiGet(sheet, opts = {}) {
  const month = opts.month ? `&month=${encodeURIComponent(opts.month)}` : "";
  const url = `${API_BASE}?action=get&sheet=${encodeURIComponent(sheet)}${month}`;
  const cacheKey = `cache_${sheet}_${opts.month || "all"}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "API GET failed");

    // Cache successful response
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: json.data }));
    } catch (e) { }

    return json.data || [];
  } catch (err) {
    // Try cache fallback
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < CACHE_TTL) {
          toast(`Offline: using cached ${sheet}`);
          return parsed.data;
        }
      } catch (e) { }
    }
    console.error("apiGet error", err);
    throw err;
  }
}

async function apiPost(payload) {
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // creating text/plain avoids CORS preflight issues in some cases
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "API POST failed");
    return json;
  } catch (err) {
    console.error("apiPost error", err);
    throw err;
  }
}

/* ========= DATA LOADING ========= */
async function loadAllData() {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const [
      planner, tasks, expenses, funds, assets, diary, vision, habits, habit_logs
    ] = await Promise.all([
      apiGet(SHEETS.planner, { month }),
      apiGet(SHEETS.tasks),
      apiGet(SHEETS.expenses, { month }),
      apiGet(SHEETS.funds),
      apiGet(SHEETS.assets),
      apiGet(SHEETS.diary, { month }),
      apiGet(SHEETS.vision),
      apiGet(SHEETS.habits),
      apiGet(SHEETS.habit_logs)
    ]);

    state.data = { planner, tasks, expenses, funds, assets, diary, vision, habits, habit_logs };
    return true;
  } catch (err) {
    toast("Failed to load data. See console.");
    return false;
  }
}

/* ========= RENDERERS ========= */
function mountStaggered() {
  document.querySelectorAll('.card.pre-enter').forEach((el, i) => {
    setTimeout(() => el.classList.add('enter'), 80 * i);
  });
}

/* ---------- DASHBOARD (Bento grid) ---------- */
function renderDashboard() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <section class="grid" id="bento">
      <article class="card pre-enter" id="card-planner">
        <h3>Planner <span class="pill">${(state.data.planner || []).length}</span></h3>
        <div class="meta">Upcoming this month</div>
        <div id="mini-planner">${renderMiniPlanner()}</div>
      </article>

      <article class="card pre-enter" id="card-tasks">
        <h3>Tasks <span class="pill">${(state.data.tasks || []).filter(t => t.status !== 'completed').length} active</span></h3>
        <div class="meta">Today & upcoming</div>
        <div id="mini-tasks">${renderMiniTasks()}</div>
      </article>

      <article class="card pre-enter" id="card-expenses">
        <h3>Expenses <span class="pill">This month</span></h3>
        <div class="meta">Monthly snapshot</div>
        <div id="mini-expenses">
          <div class="chart-wrap"><canvas id="chart-expenses"></canvas></div>
        </div>
      </article>

      <article class="card pre-enter" id="card-habits">
        <h3>Habits <span class="pill">${(state.data.habits || []).length}</span></h3>
        <div class="meta">Streaks & progress</div>
        <div id="mini-habits">${renderMiniHabits()}</div>
      </article>

      <article class="card pre-enter" id="card-diary">
        <h3>Diary</h3>
        <div class="meta">Recent</div>
        <div id="mini-diary">${renderMiniDiary()}</div>
      </article>

      <article class="card pre-enter" id="card-vision">
        <h3>Vision Board</h3>
        <div class="meta">Pinned goals</div>
        <div id="mini-vision">${renderMiniVision()}</div>
      </article>
    </section>
  `;
  mountStaggered();
  // Small delay to ensure canvas is in DOM
  setTimeout(renderExpensesChart, 100);
}

function renderMiniPlanner() {
  const items = (state.data.planner || []).slice(0, 5);
  if (!items.length) return `<div class="small">No events</div>`;
  return items.map(e => `<div class="list-item"><div>
    <div class="editable" contenteditable="true" data-sheet="${SHEETS.planner}" data-id="${e.id}" data-field="title">${escapeHtml(e.title || 'Untitled')}</div>
    <div class="small">${formatEpochDateTime(e.start_datetime)} → ${formatEpochDateTime(e.end_datetime)}</div>
      </div><div class="small">${e.category || ''}</div></div>`).join("");
}

function renderMiniTasks() {
  const items = (state.data.tasks || []).filter(t => t.status !== 'completed').slice(0, 6);
  if (!items.length) return `<div class="small">No tasks</div>`;
  return items.map(t => `<div class="list-item">
    <div>
      <div class="editable" contenteditable="true" data-sheet="${SHEETS.tasks}" data-id="${t.id}" data-field="title">${escapeHtml(t.title || 'Untitled')}</div>
      <div class="small">${t.due_date || ''} · ${t.priority || ''}</div>
    </div>
    <div class="row">
      <button class="btn" data-action="toggleTask" data-id="${t.id}">${renderIcon('save', null, '')}</button>
      <button class="btn" data-action="editTask" data-id="${t.id}">${renderIcon('edit', null, '')}</button>
    </div>
  </div>`).join("");
}

function renderMiniHabits() {
  const habits = state.data.habits || [];
  if (!habits.length) return `<div class="small">No habits</div>`;
  return habits.map(h => {
    const streak = calcStreak(h.id);
    return `<div class="list-item">
      <div>
        <div><b>${escapeHtml(h.habit_name || 'Habit')}</b></div>
        <div class="small">Streak: ${streak.current} — Best: ${streak.longest}</div>
      </div>
      <div class="row">
        <button class="btn" data-action="toggleHabit" data-id="${h.id}">${streak.doneToday ? 'Done' : 'Mark'}</button>
      </div>
    </div>`;
  }).join("");
}

function renderMiniDiary() {
  const arr = (state.data.diary || []).slice().sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 3);
  if (!arr.length) return `<div class="small">No entries</div>`;
  return arr.map(d => `<div class="list-item"><div><div><b>${d.date}</b></div><div class="small">${escapeHtml((d.text || '').slice(0, 120))}</div></div></div>`).join("");
}

function renderMiniVision() {
  const arr = (state.data.vision || []).slice(0, 6);
  if (!arr.length) return `<div class="small">No visions</div>`;
  return arr.map(v => `<div class="list-item"><div style="display:flex;gap:10px;align-items:center;">
    <div style="width:52px;height:36px;border-radius:8px;background-image:url('${v.image_url || ''}');background-size:cover;background-position:center;border:1px solid rgba(0,0,0,0.03)"></div>
    <div><div>${escapeHtml(v.title || 'Vision')}</div><div class="small">${v.target_date || ''}</div></div>
  </div></div>`).join("");
}

/* ---------- CALENDAR ---------- */
function renderCalendarView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3>Planner — Month</h3>
        <div>
          <button class="btn ghost" id="prevM">‹</button>
          <span id="currentMonthLabel" class="small"></span>
          <button class="btn ghost" id="nextM">›</button>
        </div>
      </div>
      <div id="calendar"></div>
    </div>

    <div id="eventsList" class="card">
      <h3>Events</h3>
      <div id="dayEvents">Select a date in calendar</div>
    </div>
  `;
  setupMonthControls();
  buildCalendar();
}

let currentMonthOffset = 0;

function setupMonthControls() {
  const label = document.getElementById("currentMonthLabel");
  const updateLabel = () => {
    const base = new Date();
    const dt = new Date(base.getFullYear(), base.getMonth() + currentMonthOffset, 1);
    label.textContent = dt.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  };
  document.getElementById("prevM").onclick = () => { currentMonthOffset--; buildCalendar(); updateLabel(); };
  document.getElementById("nextM").onclick = () => { currentMonthOffset++; buildCalendar(); updateLabel(); };
  updateLabel();
}

function buildCalendar() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";
  const base = new Date();
  const monthDate = new Date(base.getFullYear(), base.getMonth() + currentMonthOffset, 1);
  const year = monthDate.getFullYear(), month = monthDate.getMonth();
  const startDay = new Date(year, month, 1).getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // header row
  const header = document.createElement("div");
  header.style.display = "grid";
  header.style.gridTemplateColumns = "repeat(7,1fr)";
  header.style.gap = "8px";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => {
    const el = document.createElement("div");
    el.textContent = d;
    el.className = "small";
    header.appendChild(el);
  });
  cal.appendChild(header);

  // grid
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7,1fr)";
  grid.style.gap = "8px";

  // blanks
  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement("div");
    blank.style.minHeight = "84px";
    grid.appendChild(blank);
  }

  // days
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = new Date(year, month, d);
    const dateStr = isoDateStr(dd);
    const dayCell = document.createElement("div");
    dayCell.className = "card";
    dayCell.style.minHeight = "84px";
    dayCell.style.padding = "10px";
    dayCell.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700">${d}</div><div class="small">${dateStr}</div></div><div id="cell-${dateStr}" style="margin-top:8px"></div>`;

    // events for date
    const events = (state.data.planner || []).filter(ev => {
      const evDate = extractEpochDate(ev.start_datetime);
      return evDate === dateStr;
    });
    const cellList = dayCell.querySelector(`#cell-${dateStr}`);
    events.slice(0, 3).forEach(ev => {
      const b = document.createElement("div");
      b.className = "list-item";
      b.innerHTML = `<div style="flex:1"><div class="editable" contenteditable="true" data-sheet="${SHEETS.planner}" data-id="${ev.id}" data-field="title">${escapeHtml(ev.title || 'Untitled')}</div></div>`;
      cellList.appendChild(b);
    });

    // click handler
    dayCell.addEventListener('click', () => showDayEvents(dateStr));
    grid.appendChild(dayCell);
  }
  cal.appendChild(grid);
}

function showDayEvents(dateStr) {
  const list = document.getElementById("dayEvents");
  const events = (state.data.planner || [])
    .filter(ev => extractEpochDate(ev.start_datetime) === dateStr)
    .sort((a, b) => (a.start_datetime || 0) - (b.start_datetime || 0));
  list.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn primary" id="addEventBtn">Add Event</button>
      <div class="small">Events for ${dateStr}</div>
    </div>
    ${events.map(e => `<div class="list-item">
      <div style="flex:1">
        <div class="editable" contenteditable="true" data-sheet="${SHEETS.planner}" data-id="${e.id}" data-field="title">${escapeHtml(e.title || 'Untitled')}</div>
        <div class="small">${e.start_datetime || ''} → ${e.end_datetime || ''}</div>
        <div class="small">${escapeHtml(e.description || '')}</div>
      </div>
      <div>
        <button class="btn" data-action="editEvent" data-id="${e.id}">${renderIcon('edit', null, '')}</button>
        <button class="btn" data-action="deleteEvent" data-id="${e.id}">${renderIcon('delete', null, '')}</button>
      </div>
    </div>`).join("")}
  `;
  document.getElementById("addEventBtn").onclick = () => openEventModal({ date: dateStr });
}

/* --------- TASKS VIEW ---------- */
function renderTasksView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <h3>Tasks</h3>
      <div style="display:flex;gap:10px">
        <input id="newTaskTitle" class="input" placeholder="New task title" />
        <button class="btn primary" data-action="addTaskGlobal">Add Task</button>
      </div>
    </div>
    <section id="tasksList" class="grid"></section>`;

  // Use 'keydown' for Enter key support
  document.getElementById("newTaskTitle")?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddTask();
  });

  renderTasksList();
}

function renderTasksList() {
  const wrap = document.getElementById("tasksList");
  const rows = (state.data.tasks || []).slice().sort((a, b) => (a.priority || '').localeCompare(b.priority || '') || (a.title || '').localeCompare(b.title || ''));
  wrap.innerHTML = rows.map(t => `
    <article class="card pre-enter" style="${t.status === 'completed' ? 'opacity:0.6' : ''}">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="flex:1">
          <div contenteditable="true" class="editable" data-sheet="${SHEETS.tasks}" data-id="${t.id}" data-field="title" style="${t.status === 'completed' ? 'text-decoration:line-through' : ''}">${escapeHtml(t.title || 'Untitled')}</div>
          <div class="small">${t.due_date || ''} · ${t.priority || ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn" data-action="toggleTask" data-id="${t.id}">${t.status === 'completed' ? 'Undo' : 'Done'}</button>
          <button class="btn" data-action="deleteTask" data-id="${t.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
  mountStaggered();
}

/* ---------- FINANCE ---------- */
function renderFinanceView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <h3>Expenses</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <input id="expAmount" type="number" placeholder="Amount" class="input" style="width:100px" />
        <input id="expCategory" placeholder="Category" class="input" style="width:120px" />
        <input id="expPaymentMode" placeholder="Payment Mode" class="input" style="width:120px" list="paymentModeOptions" />
        <datalist id="paymentModeOptions">
          <option value="Cash">
          <option value="UPI">
          <option value="Card">
          <option value="Bank Transfer">
          <option value="Other">
        </datalist>
        <input id="expNotes" placeholder="Notes (optional)" class="input" style="width:150px" />
        <button class="btn primary" data-action="addExpenseGlobal">Add Expense</button>
      </div>
    </div>

    <div class="card">
      <h3>Monthly Trend (last 6 months)</h3>
      <div class="chart-wrap"><canvas id="chartMonthly"></canvas></div>
    </div>

    <section id="expList" class="grid"></section>
  `;
  renderExpenseList();
  setTimeout(renderExpensesChart, 100);
}

function renderExpenseList() {
  const wrap = document.getElementById("expList");
  const rows = (state.data.expenses || []).slice().sort((a, b) => (b.date || '') - (a.date || ''));
  wrap.innerHTML = rows.map(e => `
    <article class="card pre-enter">
      <div class="row" style="justify-content:space-between">
        <div>
          <div><b>₹${Number(e.amount || 0).toLocaleString()}</b></div>
          <div class="small">${e.category || ''} · ${e.date || ''}</div>
        </div>
        <div>
          <button class="btn" data-action="deleteExpense" data-id="${e.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
  mountStaggered();
}

function getMonthlyTotals(lastMonths = 6) {
  const res = [];
  const now = new Date();
  for (let i = lastMonths - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = dt.toISOString().slice(0, 7); // YYYY-MM
    // FIXED: Parse float properly to avoid NaN on strings like "100" or "₹100"
    const total = (state.data.expenses || [])
      .filter(r => String(r.date || '').startsWith(key))
      .reduce((s, r) => {
        const val = String(r.amount).replace(/[^0-9.-]+/g, "");
        return s + (parseFloat(val) || 0);
      }, 0);
    res.push({ key, total });
  }
  return res;
}

function renderExpensesChart() {
  const ctx = document.getElementById("chart-expenses") || document.getElementById("chartMonthly");
  if (!ctx) return;
  if (typeof Chart === 'undefined') return console.warn("Chart.js not loaded");

  const data = getMonthlyTotals(6);
  const labels = data.map(d => {
    const [y, m] = d.key.split("-");
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleString(undefined, { month: 'short', year: '2-digit' });
  });
  const values = data.map(d => d.total);

  // Safe destroy
  if (state.charts.expenseChart) state.charts.expenseChart.destroy();

  state.charts.expenseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Expenses',
        data: values,
        tension: 0.35,
        fill: true,
        backgroundColor: 'rgba(88,102,255,0.10)',
        borderColor: 'rgba(88,102,255,1)',
        pointRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(15,23,36,0.05)' } } },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* ---------- HABITS ---------- */
function renderHabitsView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <h3>Habits</h3>
      <div style="display:flex;gap:10px">
        <input id="habitName" placeholder="Habit name" class="input" />
        <select id="habitFreq" class="input"><option value="daily">daily</option><option value="weekly">weekly</option></select>
        <button class="btn primary" data-action="addHabitGlobal">Add</button>
      </div>
    </div>
    <section id="habitList" class="grid"></section>
  `;
  renderHabitList();
}

function renderHabitList() {
  const wrap = document.getElementById("habitList");
  const items = (state.data.habits || []);
  if (!items.length) { wrap.innerHTML = `<div class="card"><div class="small">No habits</div></div>`; return; }
  wrap.innerHTML = items.map(h => {
    const streak = calcStreak(h.id);
    return `<article class="card pre-enter">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div><b>${escapeHtml(h.habit_name || 'Habit')}</b></div>
          <div class="small">Streak: ${streak.current} • Best: ${streak.longest} • ${streak.doneToday ? 'Done today' : 'Pending'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn" data-action="toggleHabit" data-id="${h.id}">${streak.doneToday ? 'Undo' : 'Mark'}</button>
          <button class="btn" data-action="deleteHabit" data-id="${h.id}">Delete</button>
        </div>
      </div>
    </article>`;
  }).join("");
  mountStaggered();
}

function calcStreak(habitId) {
  // Loose equality check for habit_id, check for boolean or string "true"
  const logs = (state.data.habit_logs || []).filter(l =>
    String(l.habit_id) === String(habitId) &&
    (l.completed === true || String(l.completed).toLowerCase() === 'true')
  );

  const dates = new Set(logs.map(l => (l.date || '').slice(0, 10)));
  const today = new Date();
  let cur = 0;

  // count backward
  for (let i = 0; ; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = isoDateStr(dt);
    if (dates.has(key)) cur++;
    // If today is not done, allowing streak to continue from yesterday? 
    // Simplified logic: if not today and not yesterday, break.
    // However, for strict daily streak: break if missing.
    else if (i === 0) continue; // if today missing, streak might still be valid from yesterday
    else break;
  }

  // Longest streak calculation
  let longest = 0;
  const uniqueDates = Array.from(dates).sort();
  if (uniqueDates.length > 0) {
    let count = 1;
    let d0 = new Date(uniqueDates[0]);
    longest = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const d1 = new Date(uniqueDates[i]);
      const diff = (d1 - d0) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        count++;
      } else {
        count = 1;
      }
      if (count > longest) longest = count;
      d0 = d1;
    }
  }

  const doneToday = dates.has(isoDateStr(new Date()));
  // If not done today, the current streak is effectively the count ending yesterday
  if (!doneToday && cur > 0) cur = cur - 1; // Correction if loop counted today as miss

  // Re-calc current strictly
  let strictCur = 0;
  let dCheck = new Date();
  if (!doneToday) dCheck.setDate(dCheck.getDate() - 1); // Start checking from yesterday

  while (true) {
    if (dates.has(isoDateStr(dCheck))) {
      strictCur++;
      dCheck.setDate(dCheck.getDate() - 1);
    } else {
      break;
    }
  }

  return { current: doneToday ? strictCur + 1 : strictCur, longest: Math.max(longest, strictCur), doneToday };
}

/* ---------- DIARY ---------- */
function renderDiaryView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <h3>Write Diary</h3>
      <input id="diaryDate" type="date" class="input" value="${isoDateStr(new Date())}" />
      <textarea id="diaryText" placeholder="Write something..."></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="diaryClear">Clear</button>
        <button class="btn primary" data-action="saveDiaryGlobal">Save</button>
      </div>
    </div>
    <section id="diaryList" class="grid"></section>
  `;
  document.getElementById("diaryClear").onclick = () => { document.getElementById("diaryText").value = ''; };
  renderDiaryList();
}

function renderDiaryList() {
  const wrap = document.getElementById("diaryList");
  const rows = (state.data.diary || []).slice().sort((a, b) => (b.date > a.date ? 1 : -1));
  wrap.innerHTML = rows.map(d => `
    <article class="card pre-enter">
      <div>
        <div style="display:flex;justify-content:space-between"><div><b>${d.date}</b></div><div class="small">Mood: ${d.mood_score || '-'}</div></div>
        <div class="small editable" contenteditable="true" data-sheet="${SHEETS.diary}" data-id="${d.id}" data-field="text">${escapeHtml(d.text || '')}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button class="btn" data-action="deleteDiary" data-id="${d.id}">Delete</button>
      </div>
    </article>
  `).join("");
  mountStaggered();
}

/* ---------- VISION ---------- */
function renderVisionView() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="card">
      <h3>Vision Board — Add</h3>
      <input id="visionTitle" class="input" placeholder="Title" />
      <input id="visionImage" class="input" placeholder="Image URL" />
      <input id="visionTarget" type="date" class="input" />
      <button class="btn primary" data-action="addVisionGlobal">Add Vision</button>
    </div>
    <section id="visionList" class="grid"></section>
  `;
  renderVisionList();
}

function renderVisionList() {
  const wrap = document.getElementById("visionList");
  const rows = (state.data.vision || []).slice();
  if (!rows.length) wrap.innerHTML = `<div class="card"><div class="small">No visions</div></div>`;
  else wrap.innerHTML = rows.map(v => `
    <article class="card pre-enter">
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="width:84px;height:56px;border-radius:10px;background-image:url('${v.image_url || ''}');background-size:cover;background-position:center;border:1px solid rgba(0,0,0,0.04)"></div>
        <div style="flex:1">
          <div contenteditable="true" class="editable" data-sheet="${SHEETS.vision}" data-id="${v.id}" data-field="title">${escapeHtml(v.title || '')}</div>
          <div class="small">${v.target_date || ''}</div>
        </div>
        <div>
          <button class="btn" data-action="deleteVision" data-id="${v.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
  mountStaggered();
}

/* ========= GLOBAL EVENT DELEGATION ========= */
document.addEventListener('click', async (ev) => {
  const action = ev.target.dataset?.action;
  const id = ev.target.dataset?.id;

  if (action) {
    if (action === 'toggleTask') await handleToggleTask(id);
    else if (action === 'deleteTask') await handleDeleteTask(id);
    else if (action === 'toggleHabit') await handleToggleHabit(id);
    else if (action === 'deleteHabit') await handleDeleteHabit(id);
    else if (action === 'deleteExpense') await handleDeleteExpense(id);
    else if (action === 'deleteDiary') await handleDeleteDiary(id);
    else if (action === 'editEvent') openEventModal({ id });
    else if (action === 'deleteEvent') { await handleDeleteEvent(id); closeModal(); }
    else if (action === 'deleteVision') await handleDeleteVision(id);

    // Global Add Buttons
    else if (action === 'addTaskGlobal') await handleAddTask();
    else if (action === 'addExpenseGlobal') await handleAddExpense();
    else if (action === 'addHabitGlobal') await handleAddHabit();
    else if (action === 'saveDiaryGlobal') await handleSaveDiary();
    else if (action === 'addVisionGlobal') await handleAddVision();
  }
});

// Contenteditable save on blur
document.addEventListener('focusout', async (ev) => {
  const el = ev.target;
  if (el && el.getAttribute && el.getAttribute('contenteditable') === "true") {
    const sheet = el.dataset.sheet;
    const id = el.dataset.id;
    const field = el.dataset.field;
    const value = el.textContent.trim();
    if (sheet && id && field) {
      try {
        await apiPost({ action: "update", sheet, id, payload: { [field]: value } });
        toast("Saved");
        // Update local state implicitly or refresh? 
        // We will just let it be, as user sees the change.
      } catch (e) {
        toast("Save failed");
        console.error(e);
      }
    }
  }
});

/* ========= ACTIONS ========= */

async function handleAddTask() {
  const titleEl = document.getElementById("newTaskTitle");
  const title = titleEl ? titleEl.value.trim() : "";
  if (!title) { toast("Enter task title"); return; }

  // Optimistic UI could be added here, but simple refresh is safer for Create
  try {
    titleEl.value = "";
    await apiPost({ action: "create", sheet: SHEETS.tasks, payload: { title, status: "pending", created_at: isoDateStr(new Date()) } });
    toast("Task added");
    await refreshAll();
  } catch (e) { toast("Create failed"); }
}

async function handleToggleTask(id) {
  // FIXED: No recursion here.
  const task = (state.data.tasks || []).find(t => String(t.id) === String(id));
  if (!task) return;

  const newStatus = task.status === 'completed' ? 'pending' : 'completed';

  // Optimistic update
  task.status = newStatus;
  if (state.currentView === 'tasks') renderTasksList(); // Re-render list immediately
  else if (state.currentView === 'dashboard') renderDashboard();

  try {
    await apiPost({ action: "update", sheet: SHEETS.tasks, id, payload: { status: newStatus } });
    toast("Updated");
    // We don't need to refreshAll if optimistic worked, but good for sync
  } catch (e) {
    // Revert
    task.status = newStatus === 'completed' ? 'pending' : 'completed';
    toast("Failed to update task");
    console.error(e);
    await refreshAll();
  }
}

async function handleDeleteTask(id) {
  if (!confirm("Delete task?")) return;
  try {
    await apiPost({ action: "delete", sheet: SHEETS.tasks, id });
    toast("Deleted");
    await refreshAll();
  } catch (e) { toast("Delete failed"); }
}

async function handleAddExpense() {
  const a = document.getElementById("expAmount");
  const c = document.getElementById("expCategory");
  const p = document.getElementById("expPaymentMode");
  const n = document.getElementById("expNotes");
  const f = document.getElementById("expFund");
  if (!a || !c) return;
  const amount = parseFloat(a.value || 0);
  const category = c.value || 'General';
  const payment_mode = p ? p.value : '';
  const notes = n ? n.value : '';
  const fund = f ? f.value : '';

  if (!amount) { toast("Enter amount"); return; }

  try {
    a.value = ''; c.value = ''; if (p) p.value = ''; if (n) n.value = '';
    await apiPost({ action: "create", sheet: SHEETS.expenses, payload: { amount, category, date: isoDateStr(new Date()), fund_type: fund, payment_mode, notes } });
    toast("Expense added");
    await refreshAll();
  } catch (e) { toast("Failed"); console.error(e); }
}

async function handleDeleteExpense(id) {
  if (!confirm("Delete expense?")) return;
  try { await apiPost({ action: "delete", sheet: SHEETS.expenses, id }); toast("Deleted"); await refreshAll(); } catch (e) { toast("Failed"); }
}

async function handleAddHabit() {
  const name = document.getElementById("habitName")?.value;
  const freq = document.getElementById("habitFreq")?.value || 'daily';
  if (!name) { toast("Enter habit name"); return; }

  try {
    document.getElementById("habitName").value = '';
    await apiPost({ action: "create", sheet: SHEETS.habits, payload: { habit_name: name, frequency: freq, created_at: isoDateStr(new Date()) } });
    toast("Habit added");
    await refreshAll();
  } catch (e) { toast("Failed"); }
}

async function handleToggleHabit(hid) {
  try {
    const today = isoDateStr(new Date());
    const logs = state.data.habit_logs || [];
    const found = logs.find(l => String(l.habit_id) === String(hid) && (l.date || '').startsWith(today));

    if (found) {
      await apiPost({ action: "delete", sheet: SHEETS.habit_logs, id: found.id });
      toast("Unchecked");
    } else {
      await apiPost({ action: "create", sheet: SHEETS.habit_logs, payload: { habit_id: hid, date: today, completed: true } });
      toast("Marked done");
    }
    await refreshAll();
  } catch (e) { toast("Failed habit toggle"); console.error(e); }
}

async function handleDeleteHabit(id) {
  if (!confirm("Delete habit?")) return;
  try { await apiPost({ action: "delete", sheet: SHEETS.habits, id }); toast("Deleted"); await refreshAll(); } catch (e) { toast("Failed"); }
}

async function handleSaveDiary() {
  const date = document.getElementById("diaryDate").value || isoDateStr(new Date());
  const text = document.getElementById("diaryText").value || '';
  if (!text) return;
  try {
    await apiPost({ action: "create", sheet: SHEETS.diary, payload: { date, text, created_at: isoDateStr(new Date()) } });
    toast("Saved diary");
    document.getElementById("diaryText").value = '';
    await refreshAll();
  } catch (e) { toast("Diary save failed"); }
}

async function handleDeleteDiary(id) {
  if (!confirm("Delete entry?")) return;
  try { await apiPost({ action: "delete", sheet: SHEETS.diary, id }); toast("Deleted"); await refreshAll(); } catch (e) { toast("Failed"); }
}

async function handleAddVision() {
  const title = document.getElementById("visionTitle").value.trim();
  const image = document.getElementById("visionImage").value.trim();
  const target = document.getElementById("visionTarget").value || '';
  if (!title) { toast("Enter title"); return; }
  try {
    await apiPost({ action: "create", sheet: SHEETS.vision, payload: { title, image_url: image, target_date: target, created_at: isoDateStr(new Date()) } });
    toast("Vision added");
    document.getElementById("visionTitle").value = ''; document.getElementById("visionImage").value = '';
    await refreshAll();
  } catch (e) { toast("Fail"); }
}

async function handleDeleteVision(id) {
  if (!confirm("Delete vision?")) return;
  try { await apiPost({ action: "delete", sheet: SHEETS.vision, id }); toast("Deleted"); await refreshAll(); } catch (e) { toast("Fail"); }
}

/* EVENTS (Modal) */
function openEventModal(opts = {}) {
  const root = document.getElementById("modal-root");
  const ev = opts.id ? (state.data.planner || []).find(x => String(x.id) === String(opts.id)) : null;

  root.innerHTML = `<div class="modal-back" id="modal-back">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${ev ? 'Edit Event' : 'Add Event'}</h3>
      <div class="form-row"><input id="evTitle" class="input" placeholder="Title" value="${ev ? escapeHtml(ev.title || '') : ''}"></div>
      <div style="display:flex;gap:8px" class="form-row">
        <input id="evDate" type="date" class="input" value="${opts.date || (ev ? extractEpochDate(ev.start_datetime) : isoDateStr(new Date()))}" />
        <input id="evStart" type="time" class="input" value="${ev ? extractEpochTime(ev.start_datetime) : '09:00'}" />
        <input id="evEnd" type="time" class="input" value="${ev ? extractEpochTime(ev.end_datetime) : '10:00'}" />
      </div>
      <div class="form-row"><input id="evCategory" class="input" placeholder="Category" value="${ev ? escapeHtml(ev.category || '') : ''}"></div>
      <div class="form-row"><textarea id="evDesc" placeholder="Description">${ev ? escapeHtml(ev.description || '') : ''}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" id="cancelEvent">Cancel</button>
        <button class="btn primary" id="saveEvent">${ev ? 'Save' : 'Add'}</button>
      </div>
    </div></div>`;

  document.getElementById("cancelEvent").onclick = closeModal;
  document.getElementById("saveEvent").onclick = async () => {
    const title = document.getElementById("evTitle").value.trim();
    const date = document.getElementById("evDate").value;
    const start = document.getElementById("evStart").value;
    const end = document.getElementById("evEnd").value;
    const category = document.getElementById("evCategory").value;
    const description = document.getElementById("evDesc").value;
    if (!title) { toast("Enter title"); return; }

    const payload = {
      title, description,
      start_datetime: isoDateTime(date, start),
      end_datetime: isoDateTime(date, end),
      category, created_at: isoDateStr(new Date())
    };

    try {
      if (ev) {
        await apiPost({ action: "update", sheet: SHEETS.planner, id: ev.id, payload });
        toast("Event updated");
      } else {
        await apiPost({ action: "create", sheet: SHEETS.planner, payload });
        toast("Event added");
      }
      closeModal();
      await refreshAll();
    } catch (e) { toast("Save failed"); console.error(e); }
  };

  // click background to close
  document.getElementById("modal-back").addEventListener('click', (e) => {
    if (e.target.id === 'modal-back') closeModal();
  });
}

async function handleDeleteEvent(id) {
  if (!confirm("Delete event?")) return;
  try { await apiPost({ action: "delete", sheet: SHEETS.planner, id }); toast("Deleted"); await refreshAll(); } catch (e) { toast("Fail"); }
}

function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

/* ========= ROUTING & INIT ========= */
async function refreshAll() {
  await loadAllData();
  routeTo(state.currentView);
}

function routeTo(view) {
  state.currentView = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));

  if (view === 'dashboard') renderDashboard();
  else if (view === 'calendar') renderCalendarView();
  else if (view === 'tasks') renderTasksView();
  else if (view === 'finance') renderFinanceView();
  else if (view === 'habits') renderHabitsView();
  else if (view === 'diary') renderDiaryView();
  else if (view === 'vision') renderVisionView();
}

async function init() {
  document.getElementById("dateToday").textContent = new Date().toLocaleDateString();

  // Tabs
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => routeTo(t.dataset.view)));

  // FAB (Floating Action Button) Logic
  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      if (state.currentView === 'tasks') {
        document.getElementById('newTaskTitle')?.focus();
      } else if (state.currentView === 'calendar') {
        openEventModal({ date: isoDateStr(new Date()) });
      } else if (state.currentView === 'finance') {
        document.getElementById('expAmount')?.focus();
      } else {
        // Default to adding event
        openEventModal({ date: isoDateStr(new Date()) });
      }
    });
  }

  // Initial load
  await loadAllData();
  routeTo('dashboard');
}

init().catch(e => { console.error(e); toast("Initialization error"); });
