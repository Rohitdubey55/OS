/* view-gym.js — Gym Workout Tracker (Revamped v2)
   4-tab structure: Today | Plans | History | Library
   All functions are global (no modules).
*/

/* ═══════════════════════════════════════════════════════
   CONSTANTS & CONFIG
═══════════════════════════════════════════════════════ */

const GYM_BUILTIN_EXERCISES = [
  // Chest
  { name: 'Bench Press', muscle_group: 'Chest', category: 'strength' },
  { name: 'Incline Bench Press', muscle_group: 'Chest', category: 'strength' },
  { name: 'Decline Bench Press', muscle_group: 'Chest', category: 'strength' },
  { name: 'Push-ups', muscle_group: 'Chest', category: 'strength' },
  { name: 'Cable Fly', muscle_group: 'Chest', category: 'strength' },
  { name: 'Dumbbell Fly', muscle_group: 'Chest', category: 'strength' },
  { name: 'Chest Dip', muscle_group: 'Chest', category: 'strength' },
  // Back
  { name: 'Deadlift', muscle_group: 'Back', category: 'strength' },
  { name: 'Pull-ups', muscle_group: 'Back', category: 'strength' },
  { name: 'Lat Pulldown', muscle_group: 'Back', category: 'strength' },
  { name: 'Seated Cable Row', muscle_group: 'Back', category: 'strength' },
  { name: 'Barbell Row', muscle_group: 'Back', category: 'strength' },
  { name: 'Dumbbell Row', muscle_group: 'Back', category: 'strength' },
  { name: 'T-Bar Row', muscle_group: 'Back', category: 'strength' },
  { name: 'Face Pull', muscle_group: 'Back', category: 'strength' },
  // Shoulders
  { name: 'Overhead Press', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Dumbbell Shoulder Press', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Lateral Raise', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Front Raise', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Rear Delt Fly', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Arnold Press', muscle_group: 'Shoulders', category: 'strength' },
  { name: 'Upright Row', muscle_group: 'Shoulders', category: 'strength' },
  // Biceps
  { name: 'Barbell Curl', muscle_group: 'Biceps', category: 'strength' },
  { name: 'Dumbbell Curl', muscle_group: 'Biceps', category: 'strength' },
  { name: 'Hammer Curl', muscle_group: 'Biceps', category: 'strength' },
  { name: 'Preacher Curl', muscle_group: 'Biceps', category: 'strength' },
  { name: 'Cable Curl', muscle_group: 'Biceps', category: 'strength' },
  { name: 'Concentration Curl', muscle_group: 'Biceps', category: 'strength' },
  // Triceps
  { name: 'Tricep Dips', muscle_group: 'Triceps', category: 'strength' },
  { name: 'Skull Crushers', muscle_group: 'Triceps', category: 'strength' },
  { name: 'Cable Pushdown', muscle_group: 'Triceps', category: 'strength' },
  { name: 'Overhead Tricep Extension', muscle_group: 'Triceps', category: 'strength' },
  { name: 'Close-Grip Bench Press', muscle_group: 'Triceps', category: 'strength' },
  { name: 'Tricep Kickback', muscle_group: 'Triceps', category: 'strength' },
  // Quads
  { name: 'Squat', muscle_group: 'Quads', category: 'strength' },
  { name: 'Leg Press', muscle_group: 'Quads', category: 'strength' },
  { name: 'Lunges', muscle_group: 'Quads', category: 'strength' },
  { name: 'Leg Extension', muscle_group: 'Quads', category: 'strength' },
  { name: 'Goblet Squat', muscle_group: 'Quads', category: 'strength' },
  { name: 'Bulgarian Split Squat', muscle_group: 'Quads', category: 'strength' },
  { name: 'Hack Squat', muscle_group: 'Quads', category: 'strength' },
  // Hamstrings
  { name: 'Romanian Deadlift', muscle_group: 'Hamstrings', category: 'strength' },
  { name: 'Leg Curl', muscle_group: 'Hamstrings', category: 'strength' },
  { name: 'Stiff-Leg Deadlift', muscle_group: 'Hamstrings', category: 'strength' },
  // Glutes
  { name: 'Hip Thrust', muscle_group: 'Glutes', category: 'strength' },
  { name: 'Glute Bridge', muscle_group: 'Glutes', category: 'strength' },
  { name: 'Sumo Squat', muscle_group: 'Glutes', category: 'strength' },
  // Calves
  { name: 'Calf Raise', muscle_group: 'Calves', category: 'strength' },
  { name: 'Seated Calf Raise', muscle_group: 'Calves', category: 'strength' },
  // Core
  { name: 'Plank', muscle_group: 'Core', category: 'strength' },
  { name: 'Crunches', muscle_group: 'Core', category: 'strength' },
  { name: 'Russian Twist', muscle_group: 'Core', category: 'strength' },
  { name: 'Leg Raise', muscle_group: 'Core', category: 'strength' },
  { name: 'Ab Rollout', muscle_group: 'Core', category: 'strength' },
  { name: 'Cable Crunch', muscle_group: 'Core', category: 'strength' },
  { name: 'Hanging Knee Raise', muscle_group: 'Core', category: 'strength' },
  { name: 'Side Plank', muscle_group: 'Core', category: 'strength' },
  // Cardio
  { name: 'Treadmill Run', muscle_group: 'Cardio', category: 'cardio' },
  { name: 'Stationary Bike', muscle_group: 'Cardio', category: 'cardio' },
  { name: 'Rowing Machine', muscle_group: 'Cardio', category: 'cardio' },
  { name: 'Jump Rope', muscle_group: 'Cardio', category: 'cardio' },
  { name: 'Stairmaster', muscle_group: 'Cardio', category: 'cardio' },
  { name: 'Elliptical', muscle_group: 'Cardio', category: 'cardio' },
  // Full Body
  { name: 'Kettlebell Swing', muscle_group: 'Full Body', category: 'hiit' },
  { name: 'Burpees', muscle_group: 'Full Body', category: 'hiit' },
  { name: 'Clean and Press', muscle_group: 'Full Body', category: 'strength' },
];

const GYM_MUSCLE_COLORS = {
  'Chest': '#6366F1',
  'Back': '#3B82F6',
  'Shoulders': '#8B5CF6',
  'Biceps': '#EC4899',
  'Triceps': '#F43F5E',
  'Quads': '#10B981',
  'Hamstrings': '#059669',
  'Glutes': '#F59E0B',
  'Calves': '#84CC16',
  'Core': '#EF4444',
  'Cardio': '#06B6D4',
  'Full Body': '#F97316',
};

const GYM_CATEGORY_ICONS = {
  strength: '🏋️',
  cardio: '🏃',
  hiit: '⚡',
};

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */

let gymPlans = [];
let gymSessions = [];
let gymCustomExercises = [];
let gymActiveTab = 'today';
let gymTodaySession = null;   // parsed session object (workout_json)
let gymTodaySessionRow = null;   // raw API row for today
let gymSelectedHistoryDate = null;
let gymLibrarySearch = '';
let gymLibraryMuscle = 'All';
let gymPlanBuilder = null;   // { id, name, exercises[] } while in builder
let gymSessionSaveTimer = null;
let gymExPickerCallback = null;   // function called when exercise picked
let gymElapsedInterval = null;   // interval id for elapsed timer

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
═══════════════════════════════════════════════════════ */

async function renderGym() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="gym-shell" id="gymShell">
      <!-- Persistent 7-day history strip -->
      <div class="gym-week-strip" id="gymWeekStrip"></div>

      <!-- 3-tab bar -->
      <div class="gym-tab-bar">
        <button class="gym-tab-btn active" data-tab="today"   onclick="gymSwitchTab('today')">Today</button>
        <button class="gym-tab-btn"        data-tab="plans"   onclick="gymSwitchTab('plans')">Plans</button>
        <button class="gym-tab-btn"        data-tab="library" onclick="gymSwitchTab('library')">Library</button>
      </div>

      <div class="gym-content" id="gymContent">
        <div class="gym-loading-state">Loading…</div>
      </div>
    </div>

    <!-- History day detail modal -->
    <div class="gym-history-modal hidden" id="gymHistoryModal" onclick="gymCloseHistoryModal(event)">
      <div class="gym-history-modal-inner" id="gymHistoryModalInner"></div>
    </div>
  `;

  await gymLoadData();
}

/* ═══════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════ */

async function gymLoadData() {
  try {
    if (typeof initToolsSheets === 'function') await initToolsSheets();

    // Prefer pre-loaded global state if available
    if (state.data.gym_plans && state.data.gym_plans.length > 0) {
      gymPlans = state.data.gym_plans;
      gymSessions = state.data.gym_sessions || [];
      gymCustomExercises = state.data.gym_exercises || [];
    } else {
      const [plansRes, sessionsRes, customRes] = await Promise.all([
        apiGet('gym_plans'),
        apiGet('gym_sessions'),
        apiGet('gym_exercises'),
      ]);

      gymPlans = plansRes || [];
      gymSessions = sessionsRes || [];
      gymCustomExercises = customRes || [];

      // Cache back to state
      state.data.gym_plans = gymPlans;
      state.data.gym_sessions = gymSessions;
      state.data.gym_exercises = gymCustomExercises;
    }

    // Resolve today's session
    const todayStr = gymTodayStr();
    const rawToday = gymSessions.find(s => s.date === todayStr);
    if (rawToday) {
      gymTodaySessionRow = rawToday;
      try {
        gymTodaySession = JSON.parse(rawToday.workout_json || '{"exercises":[]}');
      } catch (e) {
        gymTodaySession = { exercises: [] };
      }
    } else {
      gymTodaySessionRow = null;
      gymTodaySession = null;
    }

    // Default history date
    if (!gymSelectedHistoryDate) {
      const sorted = [...gymSessions]
        .filter(s => s.date)
        .sort((a, b) => b.date.localeCompare(a.date));
      gymSelectedHistoryDate = sorted.length ? sorted[0].date : todayStr;
    }

    gymRenderWeekStrip();
    gymRenderTab(gymActiveTab);
  } catch (err) {
    console.error('gymLoadData error:', err);
    const c = document.getElementById('gymContent');
    if (c) c.innerHTML = `<div class="gym-error-state">Failed to load gym data. Check connection.</div>`;
  }
}

/* ═══════════════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════════════ */

function gymSwitchTab(tab) {
  gymActiveTab = tab;
  document.querySelectorAll('.gym-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  gymRenderTab(tab);
}

function gymRenderTab(tab) {
  // Stop elapsed timer if leaving Today tab
  if (tab !== 'today' && gymElapsedInterval) {
    clearInterval(gymElapsedInterval);
    gymElapsedInterval = null;
  }

  const c = document.getElementById('gymContent');
  if (!c) return;

  if (tab === 'today') gymRenderToday(c);
  else if (tab === 'plans') gymRenderPlans(c);
  else if (tab === 'library') gymRenderLibrary(c);
}

/* ═══════════════════════════════════════════════════════
   TAB 1: TODAY
═══════════════════════════════════════════════════════ */

function gymRenderToday(container) {
  if (!gymTodaySessionRow) {
    gymRenderNoPlan(container);
  } else if (gymTodaySessionRow.completed == 'true' || gymTodaySessionRow.completed === true || gymTodaySessionRow.completed == 1) {
    gymRenderSessionSummary(container);
  } else {
    gymRenderActiveWorkout(container);
  }
}

/* ── No session yet: plan picker ── */
function gymRenderNoPlan(container) {
  const planCards = gymPlans.map(p => {
    let exercises = [];
    try { exercises = JSON.parse(p.exercises_json || '[]'); } catch (e) { }
    const muscles = [...new Set(exercises.map(e => e.muscle_group))].filter(Boolean);
    const chips = muscles.slice(0, 4).map(m =>
      `<span class="gym-muscle-chip" style="--chip-color:${GYM_MUSCLE_COLORS[m] || '#6366F1'}">${m}</span>`
    ).join('');
    return `
      <div class="gym-pick-plan-card" onclick="gymStartFromPlan('${p.id}')">
        <div class="gym-ppc-name">${escapeHtml(p.name)}</div>
        <div class="gym-ppc-meta">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div>
        <div class="gym-ppc-chips">${chips}</div>
        <div class="gym-ppc-arrow">→</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="gym-no-session">
      <div class="gym-no-session-hero">
        <span class="gym-no-session-emoji">🏋️</span>
        <h2>Ready to train?</h2>
        <p>Pick a plan or start a blank session.</p>
      </div>
      <div class="gym-plan-picker-grid" id="gymPlanPickerGrid">
        ${planCards}
        <div class="gym-pick-plan-card gym-pick-blank" onclick="gymStartBlank()">
          <div class="gym-ppc-name">Blank Session</div>
          <div class="gym-ppc-meta">Build as you go</div>
          <div class="gym-ppc-arrow">＋</div>
        </div>
      </div>
    </div>
  `;
}

/* ── Start from a plan ── */
async function gymStartFromPlan(planId) {
  const plan = gymPlans.find(p => String(p.id) === String(planId));
  if (!plan) return;

  let exercises = [];
  try { exercises = JSON.parse(plan.exercises_json || '[]'); } catch (e) { }

  // Copy exercises and add done:false to each set
  const workoutExercises = exercises.map((ex, idx) => ({
    name: ex.name,
    muscle_group: ex.muscle_group,
    category: ex.category || 'strength',
    order: idx,
    sets: (ex.sets || []).map(s => ({ reps: s.reps || 0, weight: s.weight || 0, done: false })),
  }));

  const workout = {
    exercises: workoutExercises,
    started_at: new Date().toISOString(),
  };

  await gymCreateSession(plan.id, plan.name, workout);
}

/* ── Start blank ── */
async function gymStartBlank() {
  const workout = { exercises: [], started_at: new Date().toISOString() };
  await gymCreateSession('', 'Blank Session', workout);
}

async function gymCreateSession(planId, planName, workout) {
  const todayStr = gymTodayStr();
  try {
    const res = await apiPost({
      action: 'create',
      sheet: 'gym_sessions',
      payload: {
        date: todayStr,
        plan_id: planId,
        plan_name: planName,
        workout_json: JSON.stringify(workout),
        completed: false,
      }
    });
    if (res.success) {
      gymTodaySessionRow = { id: res.id, date: todayStr, plan_id: planId, plan_name: planName, workout_json: JSON.stringify(workout), completed: false };
      gymTodaySession = workout;
      gymSessions.push(gymTodaySessionRow);
      gymRenderTab('today');
      toast('Workout started! 💪');
    }
  } catch (err) {
    console.error('gymCreateSession error:', err);
    toast('Failed to start session');
  }
}

/* ── Active workout checklist ── */
function gymRenderActiveWorkout(container) {
  if (!gymTodaySession) return;

  const session = gymTodaySession;
  const exercises = session.exercises || [];
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets || []).length, 0);
  const doneSets = exercises.reduce((s, ex) => s + (ex.sets || []).filter(st => st.done).length, 0);
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  const planName = gymTodaySessionRow.plan_name || 'Workout';

  const exCards = exercises.map((ex, ei) => gymRenderExerciseCard(ex, ei)).join('');

  container.innerHTML = `
    <div class="gym-workout-header">
      <div class="gym-workout-header-top">
        <div class="gym-workout-plan-name">${escapeHtml(planName)}</div>
        <div class="gym-elapsed-timer" id="gymElapsedTimer">--:--</div>
      </div>
      <div class="gym-progress-bar-wrap">
        <div class="gym-progress-bar" id="gymProgressBar" style="width:${pct}%"></div>
      </div>
      <div class="gym-progress-label" id="gymProgressLabel">${doneSets} / ${totalSets} sets done</div>
    </div>

    <div id="gymExerciseList">
      ${exCards}
    </div>

    <button class="gym-add-ex-btn" onclick="gymOpenExPicker()">＋ Add Exercise</button>
    <button class="gym-complete-btn" onclick="gymCompleteWorkout()">Complete Workout ✓</button>

    <!-- Exercise picker overlay (rendered inside content area) -->
    <div id="gymExPickerOverlay" style="display:none"></div>
  `;

  // Start the elapsed timer
  gymStartElapsedTimer();
}

function gymRenderExerciseCard(ex, ei) {
  const color = GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1';
  const icon = GYM_CATEGORY_ICONS[ex.category || 'strength'] || '💪';
  const sets = ex.sets || [];

  const setRows = sets.map((set, si) => `
    <div class="gym-set-row ${set.done ? 'done' : ''}" id="gymSetRow-${ei}-${si}">
      <span class="gym-set-num">Set ${si + 1}</span>
      <input type="number" class="gym-set-input" value="${set.reps || ''}" placeholder="0"
             min="0" onchange="gymUpdateSet(${ei}, ${si}, 'reps', this.value)" title="Reps">
      <span class="gym-set-x">×</span>
      <input type="number" class="gym-set-input" value="${set.weight || ''}" placeholder="0"
             min="0" step="0.5" onchange="gymUpdateSet(${ei}, ${si}, 'weight', this.value)" title="Weight">
      <span class="gym-set-unit">kg</span>
      <button class="gym-set-check ${set.done ? 'done' : ''}" onclick="gymToggleSet(${ei}, ${si})" title="Mark done">✓</button>
    </div>
  `).join('');

  return `
    <div class="gym-exercise-card" id="gymExCard-${ei}">
      <div class="gym-ex-header">
        <div class="gym-ex-title">
          <span class="gym-ex-icon">${icon}</span>
          <span class="gym-ex-name">${escapeHtml(ex.name)}</span>
          <span class="gym-muscle-chip" style="--chip-color:${color}">${escapeHtml(ex.muscle_group || '')}</span>
        </div>
        <button class="gym-ex-remove-btn" onclick="gymRemoveExercise(${ei})" title="Remove exercise">×</button>
      </div>
      <div class="gym-sets-list" id="gymSetsList-${ei}">
        ${setRows}
      </div>
      <button class="gym-add-set-btn" onclick="gymAddSet(${ei})">＋ Set</button>
    </div>
  `;
}

/* ── Set toggle & update ── */
function gymToggleSet(ei, si) {
  if (!gymTodaySession) return;
  const set = gymTodaySession.exercises[ei].sets[si];
  set.done = !set.done;
  gymScheduleSave();
  gymRefreshSetRow(ei, si);
  gymRefreshProgress();
}

function gymUpdateSet(ei, si, field, value) {
  if (!gymTodaySession) return;
  gymTodaySession.exercises[ei].sets[si][field] = field === 'weight'
    ? parseFloat(value) || 0
    : parseInt(value) || 0;
  gymScheduleSave();
}

function gymRefreshSetRow(ei, si) {
  const set = gymTodaySession.exercises[ei].sets[si];
  const row = document.getElementById(`gymSetRow-${ei}-${si}`);
  if (!row) return;
  row.classList.toggle('done', !!set.done);
  const btn = row.querySelector('.gym-set-check');
  if (btn) btn.classList.toggle('done', !!set.done);
}

function gymRefreshProgress() {
  const exercises = gymTodaySession.exercises || [];
  const totalSets = exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const doneSets = exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  const bar = document.getElementById('gymProgressBar');
  const label = document.getElementById('gymProgressLabel');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `${doneSets} / ${totalSets} sets done`;
}

/* ── Add / Remove exercise / set ── */
function gymAddSet(ei) {
  if (!gymTodaySession) return;
  const ex = gymTodaySession.exercises[ei];
  ex.sets.push({ reps: 0, weight: 0, done: false });
  gymScheduleSave();

  const list = document.getElementById(`gymSetsList-${ei}`);
  if (!list) return;
  const si = ex.sets.length - 1;
  const frag = document.createElement('div');
  frag.innerHTML = `
    <div class="gym-set-row" id="gymSetRow-${ei}-${si}">
      <span class="gym-set-num">Set ${si + 1}</span>
      <input type="number" class="gym-set-input" value="" placeholder="0"
             min="0" onchange="gymUpdateSet(${ei}, ${si}, 'reps', this.value)" title="Reps">
      <span class="gym-set-x">×</span>
      <input type="number" class="gym-set-input" value="" placeholder="0"
             min="0" step="0.5" onchange="gymUpdateSet(${ei}, ${si}, 'weight', this.value)" title="Weight">
      <span class="gym-set-unit">kg</span>
      <button class="gym-set-check" onclick="gymToggleSet(${ei}, ${si})" title="Mark done">✓</button>
    </div>
  `;
  list.appendChild(frag.firstElementChild);
  gymRefreshProgress();
}

function gymRemoveExercise(ei) {
  if (!gymTodaySession) return;
  gymTodaySession.exercises.splice(ei, 1);
  gymScheduleSave();
  // Re-render exercise list
  const listEl = document.getElementById('gymExerciseList');
  if (listEl) {
    listEl.innerHTML = gymTodaySession.exercises.map((ex, i) => gymRenderExerciseCard(ex, i)).join('');
    gymRefreshProgress();
  }
}

/* ── Exercise picker overlay ── */
function gymOpenExPicker(callback) {
  gymExPickerCallback = callback || null;
  const overlay = document.getElementById('gymExPickerOverlay');
  if (!overlay) return;

  const allExercises = [
    ...GYM_BUILTIN_EXERCISES,
    ...gymCustomExercises.map(e => ({ name: e.name, muscle_group: e.muscle_group, category: e.category || 'strength', custom: true })),
  ];

  const groups = {};
  allExercises.forEach(ex => {
    const mg = ex.muscle_group || 'Other';
    if (!groups[mg]) groups[mg] = [];
    groups[mg].push(ex);
  });

  const groupsHtml = Object.entries(groups).map(([mg, exList]) => {
    const color = GYM_MUSCLE_COLORS[mg] || '#6366F1';
    const items = exList.map(ex => `
      <div class="gym-ex-item" onclick="gymPickExercise('${escapeHtml(ex.name)}', '${escapeHtml(ex.muscle_group)}', '${ex.category || 'strength'}')">
        <div class="gym-ex-item-info">
          <span class="gym-ex-item-name">${escapeHtml(ex.name)}</span>
          ${ex.custom ? '<span class="gym-ex-item-custom">custom</span>' : ''}
        </div>
        <button class="gym-ex-item-add">＋</button>
      </div>
    `).join('');
    return `
      <div class="gym-ex-group">
        <div class="gym-ex-group-label" style="--chip-color:${color}">${mg}</div>
        ${items}
      </div>
    `;
  }).join('');

  overlay.style.display = 'block';
  overlay.innerHTML = `
    <div class="gym-ex-picker-panel">
      <div class="gym-ex-picker-header">
        <span>Add Exercise</span>
        <button class="gym-ex-picker-close" onclick="gymCloseExPicker()">✕</button>
      </div>
      <input type="text" class="gym-ex-picker-search" placeholder="Search exercises…"
             oninput="gymFilterExPicker(this.value)" id="gymExPickerSearch">
      <div class="gym-ex-picker-list" id="gymExPickerList">
        ${groupsHtml}
      </div>
    </div>
  `;
}

function gymCloseExPicker() {
  const overlay = document.getElementById('gymExPickerOverlay');
  if (overlay) overlay.style.display = 'none';
  gymExPickerCallback = null;
}

function gymFilterExPicker(query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById('gymExPickerList');
  if (!list) return;

  list.querySelectorAll('.gym-ex-item').forEach(item => {
    const name = item.querySelector('.gym-ex-item-name')?.textContent?.toLowerCase() || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  list.querySelectorAll('.gym-ex-group').forEach(group => {
    const visible = [...group.querySelectorAll('.gym-ex-item')].some(i => i.style.display !== 'none');
    group.style.display = visible ? '' : 'none';
  });
}

function gymPickExercise(name, muscleGroup, category) {
  if (gymExPickerCallback) {
    gymExPickerCallback({ name, muscle_group: muscleGroup, category });
    gymCloseExPicker();
    return;
  }

  // Default: add to today's workout
  if (!gymTodaySession) return;
  gymTodaySession.exercises.push({
    name: name,
    muscle_group: muscleGroup,
    category: category || 'strength',
    order: gymTodaySession.exercises.length,
    sets: [{ reps: 0, weight: 0, done: false }],
  });
  gymScheduleSave();
  gymCloseExPicker();

  const listEl = document.getElementById('gymExerciseList');
  if (listEl) {
    listEl.innerHTML = gymTodaySession.exercises.map((ex, i) => gymRenderExerciseCard(ex, i)).join('');
    gymRefreshProgress();
  }
}

/* ── Auto-save (debounced 2s) ── */
function gymScheduleSave() {
  if (gymSessionSaveTimer) clearTimeout(gymSessionSaveTimer);
  gymSessionSaveTimer = setTimeout(() => gymSaveSession(), 2000);
}

async function gymSaveSession(completed = false) {
  if (!gymTodaySessionRow || !gymTodaySession) return;
  const payload = {
    date: gymTodaySessionRow.date,
    plan_id: gymTodaySessionRow.plan_id,
    plan_name: gymTodaySessionRow.plan_name,
    workout_json: JSON.stringify(gymTodaySession),
    completed: completed,
  };
  try {
    await apiPost({ action: 'update', sheet: 'gym_sessions', id: gymTodaySessionRow.id, payload });
    gymTodaySessionRow.completed = completed;
    gymTodaySessionRow.workout_json = payload.workout_json;
  } catch (err) {
    console.error('gymSaveSession error:', err);
  }
}

/* ── Complete workout ── */
async function gymCompleteWorkout() {
  if (!gymTodaySession) return;
  if (!confirm('Mark this workout as complete?')) return;
  gymTodaySession.completed_at = new Date().toISOString();
  if (gymSessionSaveTimer) clearTimeout(gymSessionSaveTimer);
  await gymSaveSession(true);
  toast('Workout completed! 🎉');
  gymRenderTab('today');
}

/* ── Session summary ── */
function gymRenderSessionSummary(container) {
  const session = gymTodaySession || (() => {
    try { return JSON.parse(gymTodaySessionRow.workout_json || '{"exercises":[]}'); } catch (e) { return { exercises: [] }; }
  })();

  const exercises = session.exercises || [];
  const totalSets = exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const doneSets = exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
  const totalVol = exercises.reduce((s, ex) =>
    s + ex.sets.filter(st => st.done).reduce((sv, st) => sv + (st.reps || 0) * (st.weight || 0), 0), 0);
  const startedAt = session.started_at ? new Date(session.started_at) : null;
  const completedAt = session.completed_at ? new Date(session.completed_at) : new Date();
  const durationMin = startedAt ? Math.round((completedAt - startedAt) / 60000) : null;

  const planName = gymTodaySessionRow.plan_name || 'Session';

  container.innerHTML = `
    <div class="gym-session-summary">
      <div class="gym-summary-checkmark">✓</div>
      <h2 class="gym-summary-title">Workout Complete!</h2>
      <p class="gym-summary-plan">${escapeHtml(planName)}</p>
      <div class="gym-summary-stats">
        <div class="gym-summary-stat">
          <div class="gym-summary-stat-val">${exercises.length}</div>
          <div class="gym-summary-stat-lbl">Exercises</div>
        </div>
        <div class="gym-summary-stat">
          <div class="gym-summary-stat-val">${doneSets}</div>
          <div class="gym-summary-stat-lbl">Sets Done</div>
        </div>
        <div class="gym-summary-stat">
          <div class="gym-summary-stat-val">${totalVol > 0 ? Math.round(totalVol).toLocaleString() + 'kg' : '—'}</div>
          <div class="gym-summary-stat-lbl">Volume</div>
        </div>
        ${durationMin !== null ? `
        <div class="gym-summary-stat">
          <div class="gym-summary-stat-val">${durationMin}m</div>
          <div class="gym-summary-stat-lbl">Duration</div>
        </div>` : ''}
      </div>
      <div class="gym-summary-exercises">
        ${exercises.map(ex => `
          <div class="gym-summary-ex-row">
            <span class="gym-muscle-chip" style="--chip-color:${GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1'}">${escapeHtml(ex.muscle_group || '')}</span>
            <span class="gym-summary-ex-name">${escapeHtml(ex.name)}</span>
            <span class="gym-summary-ex-sets">${ex.sets.filter(s => s.done).length}/${ex.sets.length} sets</span>
          </div>
        `).join('')}
      </div>
      <button class="gym-summary-restart-btn" onclick="gymResetToday()">Start New Session</button>
    </div>
  `;
}

function gymResetToday() {
  gymTodaySession = null;
  gymTodaySessionRow = null;
  gymSessions = gymSessions.filter(s => s.date !== gymTodayStr());
  gymRenderTab('today');
}

/* ── Elapsed Timer ── */
function gymStartElapsedTimer() {
  if (gymElapsedInterval) clearInterval(gymElapsedInterval);
  const update = () => {
    const el = document.getElementById('gymElapsedTimer');
    if (!el) { clearInterval(gymElapsedInterval); return; }
    if (!gymTodaySession?.started_at) { el.textContent = '--:--'; return; }
    const diff = Math.floor((Date.now() - new Date(gymTodaySession.started_at).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    el.textContent = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  update();
  gymElapsedInterval = setInterval(update, 1000);
}

/* ═══════════════════════════════════════════════════════
   TAB 2: PLANS
═══════════════════════════════════════════════════════ */

function gymRenderPlans(container) {
  const cards = gymPlans.map(p => {
    let exercises = [];
    try { exercises = JSON.parse(p.exercises_json || '[]'); } catch (e) { }
    const muscles = [...new Set(exercises.map(e => e.muscle_group))].filter(Boolean);
    const chips = muscles.slice(0, 5).map(m =>
      `<span class="gym-muscle-chip" style="--chip-color:${GYM_MUSCLE_COLORS[m] || '#6366F1'}">${m}</span>`
    ).join('');
    return `
      <div class="gym-plan-card">
        <div class="gym-plan-card-name">${escapeHtml(p.name)}</div>
        <div class="gym-plan-card-meta">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div>
        <div class="gym-plan-card-muscles">${chips}</div>
        <div class="gym-plan-card-actions">
          <button class="gym-plan-action-btn gym-plan-start-btn" onclick="gymStartFromPlan('${p.id}');gymSwitchTab('today')" title="Start today">▶ Start</button>
          <button class="gym-plan-action-btn" onclick="gymOpenBuilder('${p.id}')" title="Edit plan">✎ Edit</button>
          <button class="gym-plan-action-btn gym-plan-delete-btn" onclick="gymDeletePlan('${p.id}')" title="Delete plan">✕</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="gym-plans-grid" id="gymPlansGrid">
      ${cards}
      <div class="gym-plan-card gym-plan-card-new" onclick="gymOpenBuilder(null)">
        <div class="gym-plan-new-icon">＋</div>
        <div class="gym-plan-new-label">New Plan</div>
      </div>
    </div>
    <!-- Plan builder overlay rendered here -->
    <div id="gymBuilderOverlay" style="display:none"></div>
  `;
}

async function gymDeletePlan(id) {
  if (!confirm('Delete this plan?')) return;
  try {
    const res = await apiPost({ action: 'delete', sheet: 'gym_plans', id });
    if (res.success) {
      gymPlans = gymPlans.filter(p => String(p.id) !== String(id));
      gymRenderPlans(document.getElementById('gymContent'));
      toast('Plan deleted');
    }
  } catch (err) {
    toast('Failed to delete plan');
  }
}

/* ── Plan Builder Overlay ── */
function gymOpenBuilder(planId) {
  if (planId) {
    const plan = gymPlans.find(p => String(p.id) === String(planId));
    if (!plan) return;
    let exercises = [];
    try { exercises = JSON.parse(plan.exercises_json || '[]'); } catch (e) { }
    gymPlanBuilder = { id: plan.id, name: plan.name, exercises: exercises.map(e => JSON.parse(JSON.stringify(e))) };
  } else {
    gymPlanBuilder = { id: null, name: '', exercises: [] };
  }
  gymRenderBuilder();
}

function gymRenderBuilder() {
  const overlay = document.getElementById('gymBuilderOverlay');
  if (!overlay) return;

  const { name, exercises } = gymPlanBuilder;

  const exCards = exercises.map((ex, ei) => {
    const color = GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1';
    const sets = ex.sets || [];
    const setRows = sets.map((set, si) => `
      <div class="gym-builder-set-row">
        <span class="gym-set-num">Set ${si + 1}</span>
        <input type="number" class="gym-set-input" value="${set.reps || ''}" placeholder="Reps" min="0"
               onchange="gymBuilderUpdateSet(${ei}, ${si}, 'reps', this.value)">
        <span class="gym-set-x">×</span>
        <input type="number" class="gym-set-input" value="${set.weight || ''}" placeholder="kg" min="0" step="0.5"
               onchange="gymBuilderUpdateSet(${ei}, ${si}, 'weight', this.value)">
        <button class="gym-builder-remove-set" onclick="gymBuilderRemoveSet(${ei}, ${si})">−</button>
      </div>
    `).join('');

    return `
      <div class="gym-builder-ex-card" id="gymBuilderEx-${ei}">
        <div class="gym-ex-header">
          <div class="gym-ex-title">
            <span class="gym-ex-name">${escapeHtml(ex.name)}</span>
            <span class="gym-muscle-chip" style="--chip-color:${color}">${escapeHtml(ex.muscle_group || '')}</span>
          </div>
          <div class="gym-builder-ex-controls">
            ${ei > 0 ? `<button class="gym-builder-order-btn" onclick="gymBuilderMoveEx(${ei}, -1)" title="Move up">↑</button>` : '<span class="gym-builder-order-btn"></span>'}
            ${ei < exercises.length - 1 ? `<button class="gym-builder-order-btn" onclick="gymBuilderMoveEx(${ei}, 1)" title="Move down">↓</button>` : '<span class="gym-builder-order-btn"></span>'}
            <button class="gym-ex-remove-btn" onclick="gymBuilderRemoveEx(${ei})">×</button>
          </div>
        </div>
        <div class="gym-builder-sets" id="gymBuilderSets-${ei}">
          ${setRows}
        </div>
        <button class="gym-add-set-btn" onclick="gymBuilderAddSet(${ei})">＋ Set</button>
      </div>
    `;
  }).join('');

  // Exercise picker for builder
  const allEx = [
    ...GYM_BUILTIN_EXERCISES,
    ...gymCustomExercises.map(e => ({ name: e.name, muscle_group: e.muscle_group, category: e.category || 'strength' })),
  ];
  const pickerGroups = {};
  allEx.forEach(ex => {
    const mg = ex.muscle_group || 'Other';
    if (!pickerGroups[mg]) pickerGroups[mg] = [];
    pickerGroups[mg].push(ex);
  });
  const pickerHtml = Object.entries(pickerGroups).map(([mg, list]) => {
    const color = GYM_MUSCLE_COLORS[mg] || '#6366F1';
    return `
      <div class="gym-ex-group">
        <div class="gym-ex-group-label" style="--chip-color:${color}">${mg}</div>
        ${list.map(ex => `
          <div class="gym-ex-item" onclick="gymBuilderAddExercise('${escapeHtml(ex.name)}', '${escapeHtml(ex.muscle_group)}', '${ex.category || 'strength'}')">
            <div class="gym-ex-item-info"><span class="gym-ex-item-name">${escapeHtml(ex.name)}</span></div>
            <button class="gym-ex-item-add">＋</button>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  overlay.style.display = 'block';
  overlay.innerHTML = `
    <div class="gym-builder-overlay">
      <div class="gym-builder-inner">
        <div class="gym-builder-header">
          <h2>${gymPlanBuilder.id ? 'Edit Plan' : 'New Plan'}</h2>
          <button class="gym-ex-picker-close" onclick="gymCloseBuilder()">✕</button>
        </div>
        <div class="gym-builder-name-row">
          <input type="text" class="gym-builder-name-input" id="gymBuilderNameInput"
                 value="${escapeHtml(name)}" placeholder="Plan name…" oninput="gymPlanBuilder.name = this.value">
        </div>
        <div id="gymBuilderExList">
          ${exCards}
        </div>
        <div class="gym-ex-picker-panel" style="position:static;box-shadow:none;border-top:1px solid var(--border);margin-top:12px">
          <div class="gym-ex-picker-header"><span>Add Exercise</span></div>
          <input type="text" class="gym-ex-picker-search" placeholder="Search…"
                 oninput="gymFilterBuilderPicker(this.value)" id="gymBuilderPickerSearch">
          <div class="gym-ex-picker-list" id="gymBuilderPickerList" style="max-height:220px">
            ${pickerHtml}
          </div>
        </div>
        <div class="gym-builder-footer">
          <button class="gym-builder-cancel-btn" onclick="gymCloseBuilder()">Cancel</button>
          <button class="gym-builder-save-btn" onclick="gymSavePlan()">Save Plan</button>
        </div>
      </div>
    </div>
  `;
}

function gymCloseBuilder() {
  gymPlanBuilder = null;
  const overlay = document.getElementById('gymBuilderOverlay');
  if (overlay) overlay.style.display = 'none';
}

function gymBuilderAddExercise(name, muscleGroup, category) {
  if (!gymPlanBuilder) return;
  gymPlanBuilder.exercises.push({
    name: name,
    muscle_group: muscleGroup,
    category: category || 'strength',
    order: gymPlanBuilder.exercises.length,
    sets: [{ reps: 10, weight: 0 }],
  });
  gymRenderBuilder();
}

function gymBuilderRemoveEx(ei) {
  if (!gymPlanBuilder) return;
  gymPlanBuilder.exercises.splice(ei, 1);
  gymRenderBuilder();
}

function gymBuilderMoveEx(ei, dir) {
  if (!gymPlanBuilder) return;
  const exs = gymPlanBuilder.exercises;
  const target = ei + dir;
  if (target < 0 || target >= exs.length) return;
  [exs[ei], exs[target]] = [exs[target], exs[ei]];
  gymRenderBuilder();
}

function gymBuilderAddSet(ei) {
  if (!gymPlanBuilder) return;
  gymPlanBuilder.exercises[ei].sets.push({ reps: 0, weight: 0 });
  gymRenderBuilder();
}

function gymBuilderRemoveSet(ei, si) {
  if (!gymPlanBuilder) return;
  gymPlanBuilder.exercises[ei].sets.splice(si, 1);
  gymRenderBuilder();
}

function gymBuilderUpdateSet(ei, si, field, value) {
  if (!gymPlanBuilder) return;
  gymPlanBuilder.exercises[ei].sets[si][field] = field === 'weight'
    ? parseFloat(value) || 0
    : parseInt(value) || 0;
}

function gymFilterBuilderPicker(query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById('gymBuilderPickerList');
  if (!list) return;
  list.querySelectorAll('.gym-ex-item').forEach(item => {
    const name = item.querySelector('.gym-ex-item-name')?.textContent?.toLowerCase() || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  list.querySelectorAll('.gym-ex-group').forEach(group => {
    const visible = [...group.querySelectorAll('.gym-ex-item')].some(i => i.style.display !== 'none');
    group.style.display = visible ? '' : 'none';
  });
}

async function gymSavePlan() {
  if (!gymPlanBuilder) return;
  const nameInput = document.getElementById('gymBuilderNameInput');
  const name = (nameInput ? nameInput.value : gymPlanBuilder.name).trim();
  if (!name) { toast('Plan needs a name'); return; }

  gymPlanBuilder.exercises.forEach((ex, i) => { ex.order = i; });

  const payload = {
    name: name,
    exercises_json: JSON.stringify(gymPlanBuilder.exercises),
  };

  try {
    if (gymPlanBuilder.id) {
      const res = await apiPost({ action: 'update', sheet: 'gym_plans', id: gymPlanBuilder.id, payload });
      if (res.success) {
        const idx = gymPlans.findIndex(p => String(p.id) === String(gymPlanBuilder.id));
        if (idx !== -1) gymPlans[idx] = { ...gymPlans[idx], ...payload };
        toast('Plan updated!');
      }
    } else {
      const res = await apiPost({ action: 'create', sheet: 'gym_plans', payload });
      if (res.success) {
        gymPlans.push({ id: res.id, ...payload });
        toast('Plan created!');
      }
    }
    gymCloseBuilder();
    gymRenderPlans(document.getElementById('gymContent'));
  } catch (err) {
    console.error('gymSavePlan error:', err);
    toast('Failed to save plan');
  }
}

/* ═══════════════════════════════════════════════════════
   TAB 3: HISTORY
═══════════════════════════════════════════════════════ */

function gymRenderWeekStrip() {
  const strip = document.getElementById('gymWeekStrip');
  if (!strip) return;

  const today = gymTodayStr();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const sessionsByDate = {};
  gymSessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });

  strip.innerHTML = days.map(d => {
    const hasSessions = !!sessionsByDate[d];
    const isToday = d === today;
    const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = new Date(d + 'T00:00:00').getDate();
    return `
      <div class="gym-strip-day ${hasSessions ? 'has-workout' : ''} ${isToday ? 'today' : ''}"
           onclick="gymOpenHistoryModal('${d}')">
        <div class="gym-strip-name">${dayName}</div>
        <div class="gym-strip-num">${dayNum}</div>
        ${hasSessions ? `<div class="gym-strip-dot"></div>` : '<div class="gym-strip-dot-empty"></div>'}
      </div>
    `;
  }).join('');
}

function gymOpenHistoryModal(d) {
  gymSelectedHistoryDate = d;
  const modal = document.getElementById('gymHistoryModal');
  const inner = document.getElementById('gymHistoryModalInner');
  if (!modal || !inner) return;

  const sessionsByDate = {};
  gymSessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });

  const sessions = sessionsByDate[d] || [];
  const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let content;
  if (!sessions.length) {
    content = `<div class="gym-history-rest"><span class="gym-history-rest-emoji">💤</span><p>Rest day</p><small>${dayLabel}</small></div>`;
  } else {
    const sessionCards = sessions.map(s => {
      let workout = { exercises: [] };
      try { workout = JSON.parse(s.workout_json || '{"exercises":[]}'); } catch (e) { }
      const exercises = workout.exercises || [];
      const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
      const doneSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st.done).length, 0);
      const totalVol = exercises.reduce((acc, ex) =>
        acc + ex.sets.filter(st => st.done).reduce((sv, st) => sv + (st.reps || 0) * (st.weight || 0), 0), 0);
      const exRows = exercises.map(ex => {
        const color = GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1';
        const doneSetsEx = ex.sets.filter(st => st.done);
        const setsDetail = doneSetsEx.length
          ? doneSetsEx.map(st => `<span class="gym-history-set-chip">${st.reps}×${st.weight}kg</span>`).join('')
          : '<span class="gym-history-set-chip gym-history-set-skipped">—</span>';
        return `<div class="gym-history-ex-row">
          <span class="gym-muscle-chip" style="--chip-color:${color}">${escapeHtml(ex.muscle_group || '')}</span>
          <span class="gym-history-ex-name">${escapeHtml(ex.name)}</span>
          <div class="gym-history-sets">${setsDetail}</div>
        </div>`;
      }).join('');
      const status = (s.completed == 'true' || s.completed === true || s.completed == 1)
        ? '<span class="gym-history-badge gym-history-badge-done">Completed</span>'
        : '<span class="gym-history-badge gym-history-badge-partial">Partial</span>';
      return `<div class="gym-history-session-card">
        <div class="gym-history-session-header">
          <div>
            <div class="gym-history-session-name">${escapeHtml(s.plan_name || 'Session')}</div>
            <div class="gym-history-session-meta">${doneSets}/${totalSets} sets · ${totalVol > 0 ? Math.round(totalVol).toLocaleString() + 'kg vol' : '—'}</div>
          </div>${status}
        </div>
        <div class="gym-history-exercises">${exRows}</div>
      </div>`;
    }).join('');
    content = `<div class="gym-history-day-label">${dayLabel}</div>${sessionCards}`;
  }

  inner.innerHTML = `
    <div class="gym-history-modal-header">
      <span>${dayLabel}</span>
      <button class="gym-history-modal-close" onclick="gymCloseHistoryModal()">✕</button>
    </div>
    <div class="gym-history-modal-body">${content}</div>
  `;
  modal.classList.remove('hidden');
}

function gymCloseHistoryModal(e) {
  if (e && e.target !== document.getElementById('gymHistoryModal')) return;
  document.getElementById('gymHistoryModal')?.classList.add('hidden');
}

function gymSelectHistoryDay(d) {
  gymOpenHistoryModal(d);
}

function gymRenderHistoryDetail(d, sessionsByDate) {
  const el = document.getElementById('gymHistoryDetail');
  if (!el) return;

  const sessions = sessionsByDate[d] || [];
  const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!sessions.length) {
    el.innerHTML = `
      <div class="gym-history-rest">
        <span class="gym-history-rest-emoji">💤</span>
        <p>Rest day</p>
        <small>${dayLabel}</small>
      </div>
    `;
    return;
  }

  const sessionCards = sessions.map(s => {
    let workout = { exercises: [] };
    try { workout = JSON.parse(s.workout_json || '{"exercises":[]}'); } catch (e) { }

    const exercises = workout.exercises || [];
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const doneSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st.done).length, 0);
    const totalVol = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(st => st.done).reduce((sv, st) => sv + (st.reps || 0) * (st.weight || 0), 0), 0);

    const exRows = exercises.map(ex => {
      const color = GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1';
      const doneSetsEx = ex.sets.filter(st => st.done);
      const setsDetail = doneSetsEx.length
        ? doneSetsEx.map((st, i) => `<span class="gym-history-set-chip">${st.reps}×${st.weight}kg</span>`).join('')
        : '<span class="gym-history-set-chip gym-history-set-skipped">—</span>';
      return `
        <div class="gym-history-ex-row">
          <span class="gym-muscle-chip" style="--chip-color:${color}">${escapeHtml(ex.muscle_group || '')}</span>
          <span class="gym-history-ex-name">${escapeHtml(ex.name)}</span>
          <div class="gym-history-sets">${setsDetail}</div>
        </div>
      `;
    }).join('');

    const status = (s.completed == 'true' || s.completed === true || s.completed == 1)
      ? '<span class="gym-history-badge gym-history-badge-done">Completed</span>'
      : '<span class="gym-history-badge gym-history-badge-partial">Partial</span>';

    return `
      <div class="gym-history-session-card">
        <div class="gym-history-session-header">
          <div>
            <div class="gym-history-session-name">${escapeHtml(s.plan_name || 'Session')}</div>
            <div class="gym-history-session-meta">${doneSets}/${totalSets} sets · ${totalVol > 0 ? Math.round(totalVol).toLocaleString() + 'kg' : '—'}</div>
          </div>
          ${status}
        </div>
        <div class="gym-history-exercises">${exRows}</div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="gym-history-day-label">${dayLabel}</div>
    ${sessionCards}
  `;
}

/* ═══════════════════════════════════════════════════════
   TAB 4: LIBRARY
═══════════════════════════════════════════════════════ */

function gymRenderLibrary(container) {
  const allMuscles = ['All', ...Object.keys(GYM_MUSCLE_COLORS)];
  const filterPills = allMuscles.map(m => `
    <button class="gym-lib-filter ${gymLibraryMuscle === m ? 'active' : ''}"
            onclick="gymSetLibraryMuscle('${m}')"
            style="${m !== 'All' ? `--chip-color:${GYM_MUSCLE_COLORS[m]}` : ''}">${m}</button>
  `).join('');

  container.innerHTML = `
    <div class="gym-lib-top">
      <div class="gym-lib-filters" id="gymLibFilters">${filterPills}</div>
      <input type="text" class="gym-lib-search" id="gymLibSearch"
             value="${escapeHtml(gymLibrarySearch)}" placeholder="Search exercises…"
             oninput="gymSetLibrarySearch(this.value)">
    </div>
    <div class="gym-lib-grid" id="gymLibGrid"></div>
    <button class="gym-lib-add-custom-btn" onclick="gymOpenAddCustom()">＋ Add Custom Exercise</button>
    <div id="gymCustomModal" style="display:none"></div>
  `;

  gymRenderLibraryGrid();
}

function gymRenderLibraryGrid() {
  const grid = document.getElementById('gymLibGrid');
  if (!grid) return;

  const q = gymLibrarySearch.toLowerCase().trim();
  const muscle = gymLibraryMuscle;

  const customIds = new Set(gymCustomExercises.map(e => e.name.toLowerCase()));
  const all = [
    ...GYM_BUILTIN_EXERCISES,
    ...gymCustomExercises.map(e => ({ name: e.name, muscle_group: e.muscle_group, category: e.category || 'strength', custom: true, id: e.id })),
  ];

  const filtered = all.filter(ex => {
    const matchMuscle = muscle === 'All' || ex.muscle_group === muscle;
    const matchQuery = !q || ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q);
    return matchMuscle && matchQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="gym-lib-empty">No exercises found</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ex => {
    const color = GYM_MUSCLE_COLORS[ex.muscle_group] || '#6366F1';
    const icon = GYM_CATEGORY_ICONS[ex.category || 'strength'] || '💪';
    const deleteBtn = ex.custom
      ? `<button class="gym-lib-delete-btn" onclick="gymDeleteCustomExercise('${ex.id}')" title="Delete">✕</button>`
      : '';
    return `
      <div class="gym-lib-card ${ex.custom ? 'gym-lib-card-custom' : ''}">
        <div class="gym-lib-card-icon">${icon}</div>
        <div class="gym-lib-card-body">
          <div class="gym-lib-card-name">${escapeHtml(ex.name)}</div>
          <span class="gym-muscle-chip" style="--chip-color:${color}">${escapeHtml(ex.muscle_group || '')}</span>
        </div>
        <div class="gym-lib-card-actions">
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');
}

function gymSetLibraryMuscle(m) {
  gymLibraryMuscle = m;
  document.querySelectorAll('.gym-lib-filter').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === m);
  });
  gymRenderLibraryGrid();
}

function gymSetLibrarySearch(q) {
  gymLibrarySearch = q;
  gymRenderLibraryGrid();
}

/* ── Custom exercise modal ── */
function gymOpenAddCustom() {
  const modal = document.getElementById('gymCustomModal');
  if (!modal) return;

  const muscleOptions = Object.keys(GYM_MUSCLE_COLORS).map(m =>
    `<option value="${m}">${m}</option>`
  ).join('');

  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="gym-custom-modal-backdrop" onclick="gymCloseCustomModal()"></div>
    <div class="gym-custom-modal-box">
      <div class="gym-custom-modal-header">
        <h3>Add Custom Exercise</h3>
        <button class="gym-ex-picker-close" onclick="gymCloseCustomModal()">✕</button>
      </div>
      <div class="gym-custom-modal-form">
        <div class="gym-form-group">
          <label>Exercise Name</label>
          <input type="text" id="gymCustomName" placeholder="e.g. Pec Deck" class="gym-form-input">
        </div>
        <div class="gym-form-group">
          <label>Muscle Group</label>
          <select id="gymCustomMuscle" class="gym-form-input">${muscleOptions}</select>
        </div>
        <div class="gym-form-group">
          <label>Category</label>
          <select id="gymCustomCategory" class="gym-form-input">
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="hiit">HIIT</option>
          </select>
        </div>
        <div class="gym-custom-modal-actions">
          <button class="gym-builder-cancel-btn" onclick="gymCloseCustomModal()">Cancel</button>
          <button class="gym-builder-save-btn" onclick="gymSaveCustomExercise()">Add Exercise</button>
        </div>
      </div>
    </div>
  `;
}

function gymCloseCustomModal() {
  const modal = document.getElementById('gymCustomModal');
  if (modal) modal.style.display = 'none';
}

async function gymSaveCustomExercise() {
  const name = (document.getElementById('gymCustomName')?.value || '').trim();
  const muscle = document.getElementById('gymCustomMuscle')?.value || 'Core';
  const category = document.getElementById('gymCustomCategory')?.value || 'strength';

  if (!name) { toast('Exercise needs a name'); return; }

  try {
    const res = await apiPost({ action: 'create', sheet: 'gym_exercises', payload: { name, muscle_group: muscle, category } });
    if (res.success) {
      gymCustomExercises.push({ id: res.id, name, muscle_group: muscle, category });
      gymCloseCustomModal();
      gymRenderLibraryGrid();
      toast('Custom exercise added!');
    }
  } catch (err) {
    console.error('gymSaveCustomExercise error:', err);
    toast('Failed to add exercise');
  }
}

async function gymDeleteCustomExercise(id) {
  if (!confirm('Delete this custom exercise?')) return;
  try {
    const res = await apiPost({ action: 'delete', sheet: 'gym_exercises', id });
    if (res.success) {
      gymCustomExercises = gymCustomExercises.filter(e => String(e.id) !== String(id));
      gymRenderLibraryGrid();
      toast('Exercise deleted');
    }
  } catch (err) {
    toast('Failed to delete exercise');
  }
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */

function gymTodayStr() {
  return new Date().toISOString().split('T')[0];
}
