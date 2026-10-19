/* view-gym.js — Gym (v3)
   A training log built for the gym floor:
   • Today: what to train next, this week against your goal, one tap to start.
   • Live workout: previous numbers on every set, tap to copy them, automatic
     rest timer after each set, timed sets with a countdown, and a full-screen
     Follow-along mode for interval / circuit workouts (40s on, 20s off…).
   • Plans: builder with sets × reps × kg or timed sets, rest per exercise,
     reorder, duplicate, and import from text.
   • History and Exercises: every session, personal records and progress.
   Storage is unchanged: gym_plans.exercises_json, gym_sessions.workout_json. */

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
  'Chest': '#6366F1', 'Back': '#3B82F6', 'Shoulders': '#8B5CF6', 'Biceps': '#EC4899',
  'Triceps': '#F43F5E', 'Quads': '#10B981', 'Hamstrings': '#059669', 'Glutes': '#F59E0B',
  'Calves': '#84CC16', 'Core': '#EF4444', 'Cardio': '#06B6D4', 'Full Body': '#F97316',
  'Mobility': '#14B8A6',
};
const GX_MUSCLES = Object.keys(GYM_MUSCLE_COLORS);
const gxColor = m => GYM_MUSCLE_COLORS[m] || '#64748B';

/* ── tiny helpers ── */
function gymTodayStr(d) { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
function gxDate(ds) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ds || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(ds); }
function gxEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function gxQ(s) { return gxEsc(String(s)).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }   // safe inside onclick='...'
function gxParse(j, fb) { try { const v = JSON.parse(j || ''); return v == null ? fb : v; } catch (e) { return fb; } }
function gxDone(row) { return row && (row.completed === true || row.completed === 'true' || row.completed == 1); }
function gxNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function gxShort(ds) { const d = gxDate(ds); return isNaN(d) ? ds : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function gxLong(ds) { const d = gxDate(ds); return isNaN(d) ? ds : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function gxAgo(ds) {
  if (!ds) return 'never';
  const days = Math.round((gxDate(gymTodayStr()) - gxDate(ds)) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : days < 14 ? 'last week' : `${Math.round(days / 7)} weeks ago`;
}
function gxClock(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; }
function gxKg(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(1) + 't' : n.toLocaleString() + ' kg'; }
function gxMode(ex) { return ex && (ex.mode === 'time' || (ex.sets || []).some(s => s.secs)) ? 'time' : 'reps'; }

/* ── preferences (this device) ── */
const GX_PREF_KEY = 'os.gym.prefs';
function gxPrefs() { let p = {}; try { p = JSON.parse(localStorage.getItem(GX_PREF_KEY) || '{}'); } catch (e) { } return Object.assign({ goal: 4, rest: 90, sound: true }, p); }
function gxSetPref(k, v) { const p = gxPrefs(); p[k] = v; try { localStorage.setItem(GX_PREF_KEY, JSON.stringify(p)); } catch (e) { } }

const GX_I = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13a1 1 0 0 0 1.6.8l8.7-6.5a1 1 0 0 0 0-1.6L6.6 4.7A1 1 0 0 0 5 5.5z"/><rect x="16.5" y="5" width="3" height="14" rx="1"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5.5v13a1 1 0 0 1-1.6.8l-8.7-6.5a1 1 0 0 1 0-1.6l8.7-6.5a1 1 0 0 1 1.6.8z"/><rect x="4.5" y="5" width="3" height="14" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
};
const gxI = (n, cls = '') => `<span class="gx-i ${cls}">${GX_I[n] || ''}</span>`;

/* ═══ STATE ═══ */
let gymPlans = [], gymSessions = [], gymCustomExercises = [];
let gxTab = 'today';
let gxRow = null;          // the session row being trained / edited
let gxW = null;            // its parsed workout { exercises, started_at, completed_at, notes }
let gxOpen = {};           // exercise index → expanded? (active workout)
let gxSaveT = 0, gxTickT = 0;
let gxRest = null;         // { end, total, label }
let gxSummaryFor = null;   // session id whose summary is showing
let gxBuilder = null;      // { id, name, notes, exercises[] }
let gxHistMonth = null;    // 'YYYY-MM'
let gxExSearch = '', gxExMuscle = 'All';
let gxPickCb = null;


/* ═══ ANALYTICS ═══ */
function gxSorted() { return [...gymSessions].filter(s => s.date).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))); }
function gxWorkoutOf(row) { return gxParse(row && row.workout_json, { exercises: [] }) || { exercises: [] }; }
function gxSetsDone(w) { return (w.exercises || []).reduce((n, e) => n + (e.sets || []).filter(s => s.done).length, 0); }
function gxSetsTotal(w) { return (w.exercises || []).reduce((n, e) => n + (e.sets || []).length, 0); }
function gxVolume(w) { return (w.exercises || []).reduce((t, e) => t + (e.sets || []).reduce((s, st) => s + (st.done ? gxNum(st.reps) * gxNum(st.weight) : 0), 0), 0); }
function gxMinutes(w) { if (!w.started_at) return null; const a = new Date(w.started_at), b = w.completed_at ? new Date(w.completed_at) : null; if (!b || isNaN(a) || isNaN(b)) return null; const m = Math.round((b - a) / 60000); return m > 0 && m < 600 ? m : null; }
function gxE1rm(w, r) { w = gxNum(w); r = gxNum(r); return w > 0 && r > 0 ? w * (1 + Math.min(r, 12) / 30) : 0; }

/* Every past appearance of an exercise, newest first (excluding the session being edited). */
function gxExHistory(name) {
  const key = String(name || '').toLowerCase(), out = [];
  gxSorted().forEach(row => {
    if (gxRow && (String(row.id) === String(gxRow.id) || String(row.date) > String(gxRow.date))) return;   // only what came before
    const ex = (gxWorkoutOf(row).exercises || []).find(e => String(e.name || '').toLowerCase() === key);
    if (!ex) return;
    const sets = (ex.sets || []).filter(s => s.done);
    if (sets.length) out.push({ date: row.date, sets, mode: gxMode(ex), row });
  });
  return out;
}
function gxRecords(name) {
  const r = { weight: 0, e1rm: 0, reps: 0, volume: 0, secs: 0 };
  gxExHistory(name).forEach(h => {
    let vol = 0;
    h.sets.forEach(s => {
      r.weight = Math.max(r.weight, gxNum(s.weight)); r.reps = Math.max(r.reps, gxNum(s.reps));
      r.e1rm = Math.max(r.e1rm, gxE1rm(s.weight, s.reps)); r.secs = Math.max(r.secs, gxNum(s.secs));
      vol += gxNum(s.weight) * gxNum(s.reps);
    });
    r.volume = Math.max(r.volume, vol);
  });
  return r;
}
/* "Try 62.5 kg": if every set last time hit its reps, add a small step. */
function gxSuggest(ex) {
  const h = gxExHistory(ex.name)[0];
  if (!h || gxMode(ex) === 'time') return null;
  const top = h.sets.reduce((a, b) => gxNum(b.weight) > gxNum(a.weight) ? b : a, h.sets[0]);
  const w = gxNum(top.weight);
  if (!w) return { text: `Last: ${h.sets.length} × ${gxNum(top.reps)} reps — try ${gxNum(top.reps) + 1}` };
  const target = Math.max(...(ex.sets || []).map(s => gxNum(s.reps)), 0);
  const hit = h.sets.every(s => gxNum(s.reps) >= (target || gxNum(top.reps)));
  const step = w >= 40 ? 2.5 : 1;
  return hit ? { text: `All sets hit last time — try ${w + step} kg`, weight: w + step } : { text: `Stay at ${w} kg and beat ${gxNum(top.reps)} reps`, weight: w };
}

function gxPlanLast(plan) {
  const s = gxSorted().find(r => gxDone(r) && (String(r.plan_id) === String(plan.id) || (r.plan_name && r.plan_name === plan.name)));
  return s ? s.date : null;
}
function gxPlanExercises(plan) { return gxParse(plan && plan.exercises_json, []) || []; }
function gxPlanMinutes(exs) {
  const rest = gxPrefs().rest;
  const sec = (exs || []).reduce((t, e) => t + (e.sets || []).reduce((s, st) => s + (gxMode(e) === 'time' ? gxNum(st.secs || st.reps) : 40) + gxNum(e.rest || rest), 0), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}
function gxPlanMuscles(exs) { const c = {}; (exs || []).forEach(e => { if (e.muscle_group) c[e.muscle_group] = (c[e.muscle_group] || 0) + (e.sets || []).length; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
/* Up next: the plan you haven't done for the longest (never-done first). */
function gxNextPlan() {
  if (!gymPlans.length) return null;
  return [...gymPlans].sort((a, b) => String(gxPlanLast(a) || '0000').localeCompare(String(gxPlanLast(b) || '0000')))[0];
}
function gxWeekStart(d) { const x = gxDate(gymTodayStr(d)); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function gxWeekStats() {
  const start = gymTodayStr(gxWeekStart()), done = gxSorted().filter(gxDone);
  const week = done.filter(r => r.date >= start);
  const days = new Set(week.map(r => r.date));
  // streak: consecutive weeks (before this one) that met the goal, plus this one if met
  const goal = gxPrefs().goal; let streak = 0;
  const ws = gxWeekStart();
  for (let i = 0; i < 52; i++) {
    const a = new Date(ws); a.setDate(a.getDate() - 7 * i);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const n = new Set(done.filter(r => r.date >= gymTodayStr(a) && r.date < gymTodayStr(b)).map(r => r.date)).size;
    if (n >= goal) streak++; else if (i > 0) break;
  }
  return { count: days.size, goal, streak, volume: week.reduce((t, r) => t + gxVolume(gxWorkoutOf(r)), 0), minutes: week.reduce((t, r) => t + (gxMinutes(gxWorkoutOf(r)) || 0), 0), last: done[0] ? done[0].date : null };
}

/* ═══ DATA ═══ */
async function gymLoadData() {
  if (Array.isArray(state.data.gym_plans) && Array.isArray(state.data.gym_sessions) && (state.data.gym_plans.length || state.data.gym_sessions.length || state.data._gymLoaded)) {
    gymPlans = state.data.gym_plans; gymSessions = state.data.gym_sessions; gymCustomExercises = state.data.gym_exercises || [];
  } else {
    if (typeof initToolsSheets === 'function') { try { await initToolsSheets(); } catch (e) { } }
    const [p, s, c] = await Promise.all([apiGet('gym_plans'), apiGet('gym_sessions'), apiGet('gym_exercises')]);
    gymPlans = p || []; gymSessions = s || []; gymCustomExercises = c || [];
    state.data.gym_plans = gymPlans; state.data.gym_sessions = gymSessions; state.data.gym_exercises = gymCustomExercises; state.data._gymLoaded = true;
  }
  gxPickActive();
}
/* The session to show on Today: an unfinished one from today (or any day), else none. */
function gxPickActive() {
  if (gxRow && gymSessions.some(r => String(r.id) === String(gxRow.id)) && (gxEditing || !gxDone(gxRow))) return;
  const today = gymTodayStr();
  const open = gxSorted().find(r => !gxDone(r) && r.date === today);
  gxRow = open || null; gxW = open ? gxWorkoutOf(open) : null; gxOpen = {};
}

/* ═══ SHELL ═══ */
async function renderGym() {
  const main = document.getElementById('main');
  gxInjectCss();
  ['gxOverlay', 'gxSheet', 'gxFollow', 'gxRestBar'].forEach(id => document.getElementById(id)?.remove());
  main.innerHTML = `<div class="gx" id="gx"><div class="gx-loading">Loading your training…</div></div>`;
  try { await gymLoadData(); } catch (e) { console.error(e); main.innerHTML = `<div class="gx"><div class="gx-empty">Couldn't load gym data. Check your connection and reopen Gym.</div></div>`; return; }
  gxRender();
}
function gxRender() {
  const root = document.getElementById('gx');
  if (!root) return;
  clearInterval(gxTickT); gxTickT = 0;
  const wk = gxWeekStats();
  const tabs = [['today', 'Today'], ['plans', 'Plans'], ['history', 'History'], ['exercises', 'Exercises']];
  const live = gxRow && gxW && (gxEditing || !gxDone(gxRow));
  root.innerHTML = `
    <div class="gx-top">
      <div class="gx-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="gx-tab ${gxTab === k ? 'on' : ''}" onclick="gxGo('${k}')">${l}${k === 'today' && live ? '<i class="gx-live"></i>' : ''}</button>`).join('')}</div>
      <button class="gx-goal" onclick="gxEditGoal()" title="Weekly goal — click to change">
        <span class="gx-goal-ring" style="--p:${Math.min(100, wk.count / wk.goal * 100)}"></span>
        <span><b>${wk.count}/${wk.goal}</b> this week</span>
      </button>
    </div>
    <div class="gx-body" id="gxBody"></div>`;
  const body = document.getElementById('gxBody');
  if (gxTab === 'today') (live ? gxRenderLive(body) : gxRenderToday(body));
  else if (gxTab === 'plans') gxRenderPlans(body);
  else if (gxTab === 'history') gxRenderHistory(body);
  else gxRenderExercises(body);
}
function gxGo(t) { gxTab = t; gxRender(); window.scrollTo && document.getElementById('gx')?.scrollIntoView({ block: 'start' }); }
function gymSwitchTab(t) { gxGo(t === 'library' ? 'exercises' : t); }   // old name, kept for links
function gxEditGoal() {
  const v = prompt('How many workouts a week are you aiming for?', gxPrefs().goal);
  const n = parseInt(v, 10);
  if (n > 0 && n <= 14) { gxSetPref('goal', n); gxRender(); }
}


/* ═══ TODAY ═══ */
function gxPlanCard(p, big) {
  const exs = gxPlanExercises(p), last = gxPlanLast(p), mus = gxPlanMuscles(exs);
  const timed = exs.length && exs.filter(e => gxMode(e) === 'time').length >= exs.length / 2;
  return `
    <div class="gx-pcard ${big ? 'big' : ''}" onclick="gxStartPlan('${gxQ(p.id)}')" role="button" tabindex="0">
      <div class="gx-pcard-top">
        <div class="gx-pcard-name">${gxEsc(p.name)}</div>
        ${timed ? `<span class="gx-tag">${gxI('bolt')}Intervals</span>` : ''}
      </div>
      <div class="gx-pcard-meta">${exs.length} exercises · ~${gxPlanMinutes(exs)} min · ${last ? 'last ' + gxAgo(last) : 'not done yet'}</div>
      <div class="gx-chips">${mus.slice(0, 4).map(m => `<span class="gx-chip" style="--c:${gxColor(m)}">${gxEsc(m)}</span>`).join('')}</div>
      <span class="gx-pcard-go">${gxI('play')}${big ? 'Start workout' : ''}</span>
    </div>`;
}
function gxRenderToday(el) {
  const wk = gxWeekStats(), next = gxNextPlan();
  const today = gymTodayStr();
  const doneToday = gxSorted().filter(r => gxDone(r) && r.date === today);
  const summary = gxSummaryFor ? gymSessions.find(r => String(r.id) === String(gxSummaryFor)) : null;
  // this week Mon..Sun
  const ws = gxWeekStart(), byDate = {};
  gxSorted().filter(gxDone).forEach(r => { (byDate[r.date] = byDate[r.date] || []).push(r); });
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return gymTodayStr(d); });
  const recent = gxSorted().filter(gxDone).slice(0, 5);
  el.innerHTML = `
    ${summary ? gxSummaryHTML(summary) : ''}
    <div class="gx-hero">
      <div class="gx-hero-main">
        ${next ? `
          <div class="gx-eyebrow">${doneToday.length ? 'Trained today ✓ — up next' : 'Up next'}</div>
          ${gxPlanCard(next, true)}
          <div class="gx-hero-alt">
            ${gymPlans.length > 1 ? `<button class="gx-btn ghost" onclick="gxGo('plans')">Choose another plan</button>` : ''}
            <button class="gx-btn ghost" onclick="gxStartBlank()">${gxI('plus')}Empty workout</button>
          </div>` : `
          <div class="gx-eyebrow">Get started</div>
          <div class="gx-first">
            <h2>Build your first plan</h2>
            <p>Make a plan once — Push, Pull, Legs, a home circuit — and start it here with one tap. Every set you log becomes the number to beat next time.</p>
            <div class="gx-hero-alt">
              <button class="gx-btn primary" onclick="gxOpenBuilder(null)">${gxI('plus')}New plan</button>
              <button class="gx-btn" onclick="gxOpenImport()">${gxI('import')}Import a workout</button>
              <button class="gx-btn ghost" onclick="gxStartBlank()">Empty workout</button>
            </div>
          </div>`}
      </div>
      <div class="gx-stats">
        <div class="gx-stat"><span class="gx-stat-ic" style="--c:#6366F1">${gxI('calendar')}</span><b>${wk.count}<small>/${wk.goal}</small></b><em>This week</em></div>
        <div class="gx-stat"><span class="gx-stat-ic" style="--c:#F97316">${gxI('flame')}</span><b>${wk.streak}<small> wk</small></b><em>Goal streak</em></div>
        <div class="gx-stat"><span class="gx-stat-ic" style="--c:#10B981">${gxI('dumbbell')}</span><b>${wk.volume ? gxKg(wk.volume) : '—'}</b><em>Lifted this week</em></div>
        <div class="gx-stat"><span class="gx-stat-ic" style="--c:#0EA5E9">${gxI('clock')}</span><b>${wk.minutes ? wk.minutes + '<small> min</small>' : '—'}</b><em>Trained this week</em></div>
      </div>
    </div>
    <div class="gx-week">
      ${week.map(d => {
        const rs = byDate[d] || [], isT = d === today, fut = d > today;
        return `<button class="gx-wday ${rs.length ? 'done' : ''} ${isT ? 'today' : ''} ${fut ? 'future' : ''}" ${rs.length ? `onclick="gxOpenSession('${gxQ(rs[0].id)}')"` : 'disabled'} title="${gxLong(d)}${rs.length ? ' · ' + gxEsc(rs.map(r => r.plan_name || 'Workout').join(', ')) : ''}">
          <em>${gxDate(d).toLocaleDateString(undefined, { weekday: 'short' })}</em>
          <span>${rs.length ? gxI('check') : gxDate(d).getDate()}</span>
          <small>${rs.length ? gxEsc((rs[0].plan_name || 'Workout').slice(0, 12)) : ''}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="gx-cols">
      <section>
        <div class="gx-h"><h3>Your plans</h3><button class="gx-link" onclick="gxGo('plans')">Manage</button></div>
        ${gymPlans.length ? `<div class="gx-pgrid">${gymPlans.map(p => gxPlanCard(p)).join('')}</div>` : `<div class="gx-empty sm">No plans yet.</div>`}
      </section>
      <section>
        <div class="gx-h"><h3>Recent workouts</h3><button class="gx-link" onclick="gxGo('history')">All history</button></div>
        ${recent.length ? `<div class="gx-list">${recent.map(gxSessionRowHTML).join('')}</div>` : `<div class="gx-empty sm">Your finished workouts will show up here.</div>`}
      </section>
    </div>`;
}
function gxSessionRowHTML(r) {
  const w = gxWorkoutOf(r), m = gxMinutes(w), v = gxVolume(w);
  return `<button class="gx-srow" onclick="gxOpenSession('${gxQ(r.id)}')">
    <span class="gx-srow-date"><b>${gxDate(r.date).getDate()}</b><em>${gxDate(r.date).toLocaleDateString(undefined, { month: 'short' })}</em></span>
    <span class="gx-srow-main"><b>${gxEsc(r.plan_name || 'Workout')}</b><em>${(w.exercises || []).length} exercises · ${gxSetsDone(w)} sets${m ? ' · ' + m + ' min' : ''}${v ? ' · ' + gxKg(v) : ''}</em></span>
    ${gxI('down', 'gx-srow-chev')}
  </button>`;
}

/* Finish screen: totals, records and how it compares with last time. */
function gxSummaryHTML(row) {
  const w = gxWorkoutOf(row), m = gxMinutes(w), v = gxVolume(w);
  const prs = (w.exercises || []).map(e => {
    const done = (e.sets || []).filter(s => s.done);
    if (!done.length) return null;
    const prevRow = gxRow; gxRow = row; const had = gxExHistory(e.name).length; const rec = gxRecords(e.name); gxRow = prevRow;
    if (!had) return null;
    const best = done.reduce((a, b) => gxE1rm(b.weight, b.reps) > gxE1rm(a.weight, a.reps) ? b : a, done[0]);
    const maxW = Math.max(...done.map(s => gxNum(s.weight)));
    if (maxW > 0 && maxW > rec.weight) return `${gxEsc(e.name)} — heaviest ever: ${maxW} kg`;
    if (gxE1rm(best.weight, best.reps) > rec.e1rm && rec.e1rm) return `${gxEsc(e.name)} — best set: ${best.weight} kg × ${best.reps}`;
    if (!maxW && Math.max(...done.map(s => gxNum(s.reps))) > rec.reps && rec.reps) return `${gxEsc(e.name)} — most reps: ${Math.max(...done.map(s => gxNum(s.reps)))}`;
    return null;
  }).filter(Boolean);
  return `
    <div class="gx-summary">
      <button class="gx-x" onclick="gxSummaryFor=null;gxRender()" aria-label="Close">${gxI('x')}</button>
      <div class="gx-summary-badge">${gxI('check')}</div>
      <h2>Workout done</h2>
      <p>${gxEsc(row.plan_name || 'Workout')} · ${gxLong(row.date)}</p>
      <div class="gx-summary-stats">
        <div><b>${m != null ? m + ' min' : '—'}</b><em>Duration</em></div>
        <div><b>${gxSetsDone(w)}</b><em>Sets</em></div>
        <div><b>${v ? gxKg(v) : '—'}</b><em>Volume</em></div>
        <div><b>${prs.length}</b><em>Records</em></div>
      </div>
      ${prs.length ? `<div class="gx-prs">${prs.map(p => `<div>${gxI('trophy')}${p}</div>`).join('')}</div>` : ''}
    </div>`;
}


/* ═══ START / SAVE ═══ */
let gxEditing = false;      // true when a finished session is opened for corrections
function gxFromPlan(exs) {
  return (exs || []).map((e, i) => {
    const mode = gxMode(e), last = gxExHistory(e.name)[0];
    const sets = (e.sets && e.sets.length ? e.sets : [{ reps: 10, weight: 0 }]).map((s, si) => {
      const prev = last && (last.sets[si] || last.sets[last.sets.length - 1]);
      return mode === 'time'
        ? { secs: gxNum(s.secs || s.reps) || 40, done: false }
        : { reps: gxNum(s.reps) || (prev ? gxNum(prev.reps) : 0), weight: gxNum(s.weight) || (prev ? gxNum(prev.weight) : 0), done: false };
    });
    return { name: e.name, muscle_group: e.muscle_group, category: e.category || 'strength', mode, rest: e.rest || null, note: e.note || '', order: i, sets };
  });
}
async function gxStartPlan(planId) {
  const plan = gymPlans.find(p => String(p.id) === String(planId));
  if (!plan) return;
  if (gxRow && !gxDone(gxRow)) { if (!confirm('You already have a workout in progress. Discard it and start "' + plan.name + '"?')) { gxGo('today'); return; } await gxDiscard(true); }
  await gxCreate(plan.id, plan.name, { exercises: gxFromPlan(gxPlanExercises(plan)), started_at: new Date().toISOString(), rest_default: plan.rest || null });
}
async function gxStartBlank() {
  if (gxRow && !gxDone(gxRow)) { gxGo('today'); return; }
  await gxCreate('', 'Workout', { exercises: [], started_at: new Date().toISOString() });
}
async function gxCreate(planId, planName, w) {
  const date = gymTodayStr();
  const payload = { date, plan_id: planId || '', plan_name: planName, workout_json: JSON.stringify(w), completed: false };
  try {
    const res = await apiPost({ action: 'create', sheet: 'gym_sessions', payload });
    if (!res || res.success === false) throw new Error((res && res.message) || 'save failed');
    gxRow = { id: res.id || (res.data && res.data.id), ...payload }; gxW = w; gxOpen = {}; gxEditing = false; gxSummaryFor = null;
    gymSessions.push(gxRow);
    gxTab = 'today'; gxRender();
    if (typeof toast === 'function') toast('Workout started — have a good one 💪');
  } catch (e) { console.error(e); if (typeof toast === 'function') toast('Could not start the workout'); }
}
function gxQueueSave() { clearTimeout(gxSaveT); gxSaveT = setTimeout(gxSave, 1200); gxSetSaved('Saving…'); }
async function gxSave(completed) {
  clearTimeout(gxSaveT);
  if (!gxRow || !gxW) return;
  const done = completed == null ? gxDone(gxRow) : completed;
  const payload = { date: gxRow.date, plan_id: gxRow.plan_id || '', plan_name: gxRow.plan_name || 'Workout', workout_json: JSON.stringify(gxW), completed: done };
  try {
    await apiPost({ action: 'update', sheet: 'gym_sessions', id: gxRow.id, payload });
    Object.assign(gxRow, payload); gxSetSaved('Saved');
  } catch (e) { console.error(e); gxSetSaved('Not saved — will retry'); gxSaveT = setTimeout(gxSave, 5000); }
}
function gxSetSaved(t) { const el = document.getElementById('gxSaved'); if (el) el.textContent = t; }
document.addEventListener('visibilitychange', () => { if (document.hidden && gxSaveT) gxSave(); });

async function gxFinish() {
  if (!gxRow || !gxW) return;
  const left = gxSetsTotal(gxW) - gxSetsDone(gxW);
  if (!gxSetsDone(gxW)) { if (!confirm('No sets are ticked yet. Finish anyway?')) return; }
  else if (left > 0 && !confirm(`${left} set${left > 1 ? 's are' : ' is'} not ticked. Finish the workout anyway?`)) return;
  if (!gxEditing) gxW.completed_at = new Date().toISOString();
  gxStopRest(); gxCloseFollow();
  await gxSave(true);
  gxSummaryFor = gxEditing ? null : gxRow.id;
  if (typeof toast === 'function') toast(gxEditing ? 'Changes saved' : 'Workout saved 🎉');
  gxRow = null; gxW = null; gxEditing = false; gxTab = gxSummaryFor ? 'today' : gxTab;
  gxRender();
}
async function gxDiscard(silent) {
  if (!gxRow) return;
  if (!silent && !confirm(gxEditing ? 'Stop editing without saving the latest changes?' : 'Discard this workout? Logged sets will be deleted.')) return;
  gxStopRest(); gxCloseFollow(); clearTimeout(gxSaveT);
  if (!gxEditing) {
    try { await apiPost({ action: 'delete', sheet: 'gym_sessions', id: gxRow.id }); } catch (e) { }
    gymSessions.splice(0, gymSessions.length, ...gymSessions.filter(r => String(r.id) !== String(gxRow.id)));
  }
  gxRow = null; gxW = null; gxEditing = false;
  if (!silent) gxRender();
}

/* ═══ LIVE WORKOUT ═══ */
function gxCurrentEx() { return (gxW.exercises || []).findIndex(e => (e.sets || []).some(s => !s.done)); }
function gxRenderLive(el) {
  const w = gxW, exs = w.exercises || [];
  const total = gxSetsTotal(w), done = gxSetsDone(w), cur = gxCurrentEx();
  const timed = exs.some(e => gxMode(e) === 'time');
  el.innerHTML = `
    <div class="gx-live-bar">
      <div class="gx-live-title">
        <b>${gxEsc(gxRow.plan_name || 'Workout')}</b>
        <em>${gxEditing ? 'Editing ' + gxLong(gxRow.date) : `<span id="gxElapsed">0:00</span> · <span id="gxSaved">Saved</span>`}</em>
      </div>
      <div class="gx-live-actions">
        ${timed && !gxEditing ? `<button class="gx-btn" onclick="gxOpenFollow()">${gxI('play')}Follow along</button>` : ''}
        <button class="gx-btn primary" onclick="gxFinish()">${gxI('check')}${gxEditing ? 'Save' : 'Finish'}</button>
        <button class="gx-iconbtn" onclick="gxDiscard()" title="${gxEditing ? 'Cancel editing' : 'Discard workout'}">${gxI('trash')}</button>
      </div>
      <div class="gx-live-prog"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
      <div class="gx-live-meta"><span id="gxSetsLbl">${done}/${total} sets</span><span id="gxVolLbl">${gxVolume(w) ? gxKg(gxVolume(w)) : ''}</span></div>
    </div>
    <div class="gx-exlist" id="gxExList">
      ${exs.length ? exs.map((e, i) => gxExCardHTML(e, i, cur)).join('') : `<div class="gx-empty">Add your first exercise to get going.</div>`}
    </div>
    <button class="gx-addex" onclick="gxOpenPicker()">${gxI('plus')}Add exercise</button>`;
  gxTickStart();
}
function gxExCardHTML(e, i, cur) {
  const mode = gxMode(e), sets = e.sets || [];
  const doneN = sets.filter(s => s.done).length, all = sets.length && doneN === sets.length;
  const open = gxOpen[i] != null ? gxOpen[i] : (i === cur || (cur === -1 && i === 0));
  const last = gxExHistory(e.name)[0], sug = gxSuggest(e);
  const prevSets = last ? last.sets : [];
  const rest = e.rest || gxPrefs().rest;
  return `
    <div class="gx-ex ${all ? 'complete' : ''} ${i === cur ? 'current' : ''} ${open ? 'open' : ''}" id="gxEx${i}" style="--c:${gxColor(e.muscle_group)}">
      <div class="gx-ex-head" onclick="gxToggleEx(${i})">
        <span class="gx-ex-num">${all ? gxI('check') : i + 1}</span>
        <span class="gx-ex-title">
          <b>${gxEsc(e.name)}</b>
          <em>${gxEsc(e.muscle_group || '')}${mode === 'time' ? ' · timed' : ''} · ${doneN}/${sets.length} sets</em>
        </span>
        <span class="gx-ex-tools" onclick="event.stopPropagation()">
          <button class="gx-iconbtn sm" onclick="gxMoveEx(${i},-1)" title="Move up" ${i === 0 ? 'disabled' : ''}>${gxI('up')}</button>
          <button class="gx-iconbtn sm" onclick="gxMoveEx(${i},1)" title="Move down" ${i === gxW.exercises.length - 1 ? 'disabled' : ''}>${gxI('down')}</button>
          <button class="gx-iconbtn sm" onclick="gxRemoveEx(${i})" title="Remove exercise">${gxI('x')}</button>
        </span>
      </div>
      <div class="gx-ex-body">
        ${last ? `<div class="gx-ex-hint">${gxI('chart')}<span>Last time ${gxShort(last.date)}: ${gxEsc(last.sets.map(s => mode === 'time' ? (gxNum(s.secs) || gxNum(s.reps)) + 's' : (gxNum(s.weight) ? gxNum(s.weight) + '×' : '') + gxNum(s.reps)).join(', '))}${sug ? ` · <b>${gxEsc(sug.text)}</b>` : ''}</span></div>` : `<div class="gx-ex-hint muted">${gxI('chart')}<span>First time logging this — today sets your baseline.</span></div>`}
        ${e.note ? `<div class="gx-ex-note">${gxI('note')}<span>${gxEsc(e.note)}</span></div>` : ''}
        <div class="gx-sets ${mode}">
          <div class="gx-sets-head"><span>Set</span><span>Previous</span>${mode === 'time' ? '<span>Seconds</span><span></span>' : '<span>kg</span><span>Reps</span>'}<span></span></div>
          ${sets.map((s, si) => gxSetRowHTML(e, i, si, s, prevSets[si])).join('')}
        </div>
        <div class="gx-ex-foot">
          <button class="gx-link" onclick="gxAddSet(${i})">${gxI('plus')}Add set</button>
          <button class="gx-link" onclick="gxEditNote(${i})">${gxI('note')}${e.note ? 'Edit note' : 'Note'}</button>
          <button class="gx-link" onclick="gxSetRest(${i})" title="Rest after each set">${gxI('clock')}Rest ${rest}s</button>
        </div>
      </div>
    </div>`;
}
function gxSetRowHTML(e, i, si, s, prev) {
  const mode = gxMode(e);
  const prevTxt = prev ? (mode === 'time' ? (gxNum(prev.secs) || gxNum(prev.reps)) + 's' : (gxNum(prev.weight) ? gxNum(prev.weight) + ' × ' : '') + gxNum(prev.reps)) : '—';
  return `
    <div class="gx-set ${s.done ? 'done' : ''}" id="gxSet${i}_${si}">
      <span class="gx-set-n">${si + 1}</span>
      <button class="gx-set-prev" ${prev ? `onclick="gxCopyPrev(${i},${si})" title="Use last time's numbers"` : 'disabled'}>${prevTxt}</button>
      ${mode === 'time' ? `
        <input class="gx-in" type="number" inputmode="numeric" min="0" value="${gxNum(s.secs) || ''}" placeholder="40" onchange="gxSetVal(${i},${si},'secs',this.value)" aria-label="Seconds">
        <button class="gx-set-timer" onclick="gxRunSet(${i},${si})" title="Start ${gxNum(s.secs) || 40}s timer">${gxI('play')}</button>` : `
        <input class="gx-in" type="number" inputmode="decimal" min="0" step="0.5" value="${gxNum(s.weight) || ''}" placeholder="${prev && gxNum(prev.weight) ? gxNum(prev.weight) : '0'}" onchange="gxSetVal(${i},${si},'weight',this.value)" aria-label="Weight in kg">
        <input class="gx-in" type="number" inputmode="numeric" min="0" value="${gxNum(s.reps) || ''}" placeholder="${prev ? gxNum(prev.reps) : '0'}" onchange="gxSetVal(${i},${si},'reps',this.value)" aria-label="Reps">`}
      <button class="gx-tick ${s.done ? 'on' : ''}" onclick="gxTick(${i},${si})" aria-label="Set done">${gxI('check')}</button>
    </div>`;
}
function gxRerenderEx(i) {
  const old = document.getElementById('gxEx' + i);
  if (!old) return gxRender();
  const tmp = document.createElement('div');
  tmp.innerHTML = gxExCardHTML(gxW.exercises[i], i, gxCurrentEx());
  old.replaceWith(tmp.firstElementChild);
}
function gxRefreshTop() {
  const t = gxSetsTotal(gxW), d = gxSetsDone(gxW);
  const bar = document.querySelector('.gx-live-prog i'); if (bar) bar.style.width = (t ? d / t * 100 : 0) + '%';
  const a = document.getElementById('gxSetsLbl'); if (a) a.textContent = `${d}/${t} sets`;
  const b = document.getElementById('gxVolLbl'); if (b) b.textContent = gxVolume(gxW) ? gxKg(gxVolume(gxW)) : '';
}
function gxToggleEx(i) { const el = document.getElementById('gxEx' + i); const open = !el.classList.contains('open'); gxOpen[i] = open; el.classList.toggle('open', open); }
function gxSetVal(i, si, f, v) { gxW.exercises[i].sets[si][f] = gxNum(v); gxRefreshTop(); gxQueueSave(); }
function gxCopyPrev(i, si) {
  const e = gxW.exercises[i], prev = (gxExHistory(e.name)[0] || {}).sets || [];
  const p = prev[si]; if (!p) return;
  const s = e.sets[si];
  if (gxMode(e) === 'time') s.secs = gxNum(p.secs) || gxNum(p.reps); else { s.weight = gxNum(p.weight); s.reps = gxNum(p.reps); }
  gxRerenderEx(i); gxQueueSave();
}
function gxTick(i, si) {
  const e = gxW.exercises[i], s = e.sets[si];
  s.done = !s.done;
  // ticking an empty set uses the placeholder (last time's numbers)
  if (s.done && gxMode(e) !== 'time') {
    const prev = ((gxExHistory(e.name)[0] || {}).sets || [])[si];
    if (!gxNum(s.reps) && prev) s.reps = gxNum(prev.reps);
    if (!gxNum(s.weight) && prev) s.weight = gxNum(prev.weight);
  }
  const wasCur = gxCurrentEx();
  gxQueueSave();
  if (s.done) {
    const more = gxCurrentEx() !== -1;
    if (more) gxStartRest(e.rest || gxPrefs().rest, gxNextLabel());
    else { gxStopRest(); if (typeof toast === 'function') toast('Last set done — tap Finish to save 🎉'); }
  }
  const nowCur = gxCurrentEx();
  if (nowCur !== wasCur) { delete gxOpen[i]; if (nowCur >= 0) delete gxOpen[nowCur]; gxRender(); const nx = document.getElementById('gxEx' + nowCur); if (nx) nx.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else { gxRerenderEx(i); gxRefreshTop(); }
}
function gxNextLabel() {
  const i = gxCurrentEx(); if (i < 0) return '';
  const e = gxW.exercises[i], si = e.sets.findIndex(s => !s.done);
  return `Next: ${e.name} · set ${si + 1}`;
}
function gxAddSet(i) {
  const e = gxW.exercises[i], last = e.sets[e.sets.length - 1] || {};
  e.sets.push(gxMode(e) === 'time' ? { secs: gxNum(last.secs) || 40, done: false } : { reps: gxNum(last.reps), weight: gxNum(last.weight), done: false });
  gxOpen[i] = true; gxRerenderEx(i); gxRefreshTop(); gxQueueSave();
}
function gxMoveEx(i, d) {
  const a = gxW.exercises, j = i + d; if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; gxOpen = {}; gxQueueSave(); gxRender();
}
function gxRemoveEx(i) {
  const e = gxW.exercises[i];
  if (e.sets.some(s => s.done) && !confirm(`Remove ${e.name} and its logged sets?`)) return;
  gxW.exercises.splice(i, 1); gxOpen = {}; gxQueueSave(); gxRender();
}
function gxEditNote(i) {
  const e = gxW.exercises[i]; const v = prompt(`Note for ${e.name} (seat height, grip, how it felt…)`, e.note || '');
  if (v == null) return; e.note = v.trim(); gxRerenderEx(i); gxQueueSave();
}
function gxSetRest(i) {
  const e = gxW.exercises[i]; const v = prompt(`Rest after each set of ${e.name} (seconds)`, e.rest || gxPrefs().rest);
  const n = parseInt(v, 10); if (!(n >= 0)) return; e.rest = n; gxRerenderEx(i); gxQueueSave();
}
function gxTickStart() {
  clearInterval(gxTickT);
  const tick = () => {
    const el = document.getElementById('gxElapsed');
    if (!el) { clearInterval(gxTickT); gxTickT = 0; return; }
    if (gxW && gxW.started_at) el.textContent = gxClock((Date.now() - new Date(gxW.started_at)) / 1000);
  };
  tick(); gxTickT = setInterval(tick, 1000);
}


/* ═══ TIMERS: rest bar, timed sets, sounds ═══ */
let gxT = null, gxTT = 0, gxAudio = null;   // gxT = { phase, end, total, label, onEnd, paused, left }
function gxBeep(f = 880, ms = 160, n = 1) {
  if (!gxPrefs().sound) return;
  try {
    gxAudio = gxAudio || new (window.AudioContext || window.webkitAudioContext)();
    for (let k = 0; k < n; k++) {
      const o = gxAudio.createOscillator(), g = gxAudio.createGain(), t = gxAudio.currentTime + k * (ms / 1000 + 0.08);
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g); g.connect(gxAudio.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
    }
  } catch (e) { }
  try { navigator.vibrate && navigator.vibrate(n > 1 ? [120, 80, 120] : 80); } catch (e) { }
}
function gxStartTimer(phase, secs, label, onEnd) {
  gxT = { phase, end: Date.now() + secs * 1000, total: secs, label, onEnd, paused: false, left: secs, warned: {} };
  clearInterval(gxTT); gxTT = setInterval(gxTimerTick, 250); gxTimerTick();
}
function gxStartRest(secs, label) { if (!(secs > 0)) return gxStopRest(); gxStartTimer('rest', secs, label, () => { gxBeep(988, 180, 2); gxStopRest(); }); }
function gxStopRest() { clearInterval(gxTT); gxTT = 0; gxT = null; document.getElementById('gxRestBar')?.remove(); }
function gxTimerLeft() { return gxT ? (gxT.paused ? gxT.left : Math.max(0, (gxT.end - Date.now()) / 1000)) : 0; }
function gxTimerTick() {
  if (!gxT) return;
  const left = gxTimerLeft();
  const s = Math.ceil(left);
  if (s <= 3 && s > 0 && !gxT.warned[s] && !gxT.paused) { gxT.warned[s] = 1; gxBeep(660, 90); }
  if (left <= 0 && !gxT.paused) { const cb = gxT.onEnd; cb && cb(); return; }
  let bar = document.getElementById('gxRestBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'gxRestBar'; bar.className = 'gx-restbar'; document.body.appendChild(bar); }
  const pct = gxT.total ? (1 - left / gxT.total) * 100 : 0;
  bar.className = 'gx-restbar ' + gxT.phase;
  bar.innerHTML = `
    <div class="gx-rb-fill" style="width:${pct}%"></div>
    <div class="gx-rb-main"><em>${gxT.phase === 'rest' ? 'Rest' : 'Work'}</em><b>${gxClock(left)}</b><span>${gxEsc(gxT.label || '')}</span></div>
    <div class="gx-rb-btns">
      ${gxT.phase === 'rest' ? `<button onclick="gxAdjRest(-15)">−15</button><button onclick="gxAdjRest(15)">+15</button>` : `<button onclick="gxPauseTimer()">${gxT.paused ? 'Resume' : 'Pause'}</button>`}
      <button class="go" onclick="${gxT.phase === 'rest' ? 'gxStopRest()' : 'gxFinishWork()'}">${gxT.phase === 'rest' ? 'Skip' : 'Done'}</button>
    </div>`;
}
function gxAdjRest(d) { if (!gxT) return; gxT.end += d * 1000; gxT.total = Math.max(1, gxT.total + d); gxTimerTick(); }
function gxPauseTimer() { if (!gxT) return; if (gxT.paused) { gxT.end = Date.now() + gxT.left * 1000; gxT.paused = false; } else { gxT.left = gxTimerLeft(); gxT.paused = true; } gxTimerTick(); }
function gxFinishWork() { if (gxT && gxT.onEnd) gxT.onEnd(); }
/* A timed set: count it down, tick it, then rest. */
function gxRunSet(i, si) {
  const e = gxW.exercises[i], s = e.sets[si];
  const secs = gxNum(s.secs) || 40;
  gxBeep(880, 140);
  gxStartTimer('work', secs, `${e.name} · set ${si + 1}`, () => {
    clearInterval(gxTT); gxT = null; document.getElementById('gxRestBar')?.remove();
    gxBeep(988, 180, 2);
    if (!s.done) gxTick(i, si);
  });
}

/* ═══ FOLLOW ALONG (interval / circuit mode) ═══ */
let gxF = null, gxFT = 0, gxWake = null;
function gxOpenFollow() {
  const q = [];
  gxW.exercises.forEach((e, i) => e.sets.forEach((s, si) => { if (!s.done) q.push({ i, si }); }));
  if (!q.length) { if (typeof toast === 'function') toast('Everything is ticked already'); return; }
  gxStopRest();
  gxF = { q, k: 0, phase: 'ready', end: Date.now() + 5000, total: 5, paused: false, left: 5, warned: {} };
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(l => { gxWake = l; }).catch(() => { }); } catch (e) { }
  clearInterval(gxFT); gxFT = setInterval(gxFollowTick, 200); gxFollowTick();
}
function gxCloseFollow() {
  clearInterval(gxFT); gxFT = 0; gxF = null; document.getElementById('gxFollow')?.remove();
  try { gxWake && gxWake.release(); } catch (e) { } gxWake = null;
  if (gxTab === 'today' && gxRow && document.getElementById('gxExList')) gxRender();
}
function gxFItem(k) { const it = gxF.q[k]; if (!it) return null; const e = gxW.exercises[it.i]; return e ? { ...it, e, s: e.sets[it.si] } : null; }
function gxFLeft() { return gxF.paused ? gxF.left : Math.max(0, (gxF.end - Date.now()) / 1000); }
function gxFPhase(phase, secs) { gxF.phase = phase; gxF.total = secs; gxF.left = secs; gxF.end = Date.now() + secs * 1000; gxF.warned = {}; gxF.paused = false; }
function gxFollowTick() {
  if (!gxF) return;
  const cur = gxFItem(gxF.k);
  if (!cur) { gxF.phase = 'done'; }
  const timedWork = cur && gxF.phase === 'work' && gxMode(cur.e) === 'time';
  const counting = gxF.phase === 'ready' || gxF.phase === 'rest' || timedWork;
  const left = gxFLeft(), s = Math.ceil(left);
  if (counting && !gxF.paused) {
    if (s <= 3 && s > 0 && !gxF.warned[s]) { gxF.warned[s] = 1; gxBeep(660, 90); }
    if (left <= 0) return gxFNext();
  }
  let el = document.getElementById('gxFollow');
  if (!el) { el = document.createElement('div'); el.id = 'gxFollow'; el.className = 'gx-follow'; document.body.appendChild(el); }
  if (gxF.phase === 'done') {
    el.innerHTML = `<div class="gx-f-done"><div class="gx-summary-badge">${gxI('check')}</div><h2>All done!</h2><p>${gxSetsDone(gxW)} sets ticked. Great work.</p>
      <div class="gx-f-row"><button class="gx-btn" onclick="gxCloseFollow()">Back to workout</button><button class="gx-btn primary" onclick="gxCloseFollow();gxFinish()">${gxI('check')}Finish & save</button></div></div>`;
    return;
  }
  const next = gxFItem(gxF.k + (gxF.phase === 'rest' || gxF.phase === 'ready' ? 0 : 1));
  const show = gxF.phase === 'rest' || gxF.phase === 'ready' ? next : cur;
  const after = gxFItem(gxF.k + (gxF.phase === 'rest' || gxF.phase === 'ready' ? 1 : 1));
  const pct = counting ? (gxF.total ? left / gxF.total : 0) : 1;
  const R = 108, C = 2 * Math.PI * R;
  const phaseLbl = gxF.phase === 'ready' ? 'Get ready' : gxF.phase === 'rest' ? 'Rest' : 'Work';
  const color = gxF.phase === 'work' ? gxColor(show.e.muscle_group) : gxF.phase === 'rest' ? '#10B981' : '#F59E0B';
  const sec = gxMode(show.e) === 'time';
  el.style.setProperty('--fc', color);
  el.innerHTML = `
    <div class="gx-f-top">
      <button class="gx-iconbtn" onclick="gxCloseFollow()" aria-label="Close">${gxI('x')}</button>
      <div class="gx-f-count">${gxF.k + 1} / ${gxF.q.length}</div>
      <button class="gx-iconbtn" onclick="gxSetPref('sound',!gxPrefs().sound);gxFollowTick()" title="Sound">${gxPrefs().sound ? '🔔' : '🔕'}</button>
    </div>
    <div class="gx-f-prog"><i style="width:${gxF.k / gxF.q.length * 100}%"></i></div>
    <div class="gx-f-mid">
      <div class="gx-f-phase">${phaseLbl}</div>
      <div class="gx-f-name">${gxEsc(show.e.name)}</div>
      <div class="gx-f-sub">${gxEsc(show.e.muscle_group || '')} · set ${show.si + 1} of ${show.e.sets.length}${!sec && gxF.phase !== 'work' ? '' : ''}</div>
      <div class="gx-f-ring">
        <svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="${R}" class="bg"/><circle cx="120" cy="120" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct)}"/></svg>
        <div class="gx-f-time">${counting ? Math.ceil(left) : (gxNum(show.s.weight) ? gxNum(show.s.weight) + '<small>kg</small>' : '')}${!counting ? `<span>${gxNum(show.s.reps) || ''} reps</span>` : ''}</div>
      </div>
      ${!counting ? `<button class="gx-btn primary big" onclick="gxFNext()">${gxI('check')}Set done</button>` : ''}
      <div class="gx-f-next">${(gxF.phase === 'work' ? (next ? 'Up next: ' + gxEsc(next.e.name) : 'Last one!') : (after ? 'Then: ' + gxEsc(after.e.name) + (after.e === show.e ? ' · set ' + (after.si + 1) : '') : 'Last one!'))}</div>
    </div>
    <div class="gx-f-ctrl">
      <button class="gx-iconbtn lg" onclick="gxFBack()" title="Previous">${gxI('back')}</button>
      <button class="gx-iconbtn xl" onclick="gxFPause()" title="${gxF.paused ? 'Resume' : 'Pause'}">${gxI(gxF.paused ? 'play' : 'pause')}</button>
      <button class="gx-iconbtn lg" onclick="gxFNext(true)" title="Skip">${gxI('skip')}</button>
    </div>`;
}
/* ready → work → (tick set) → rest → work of the next … */
function gxFNext(skip) {
  const cur = gxFItem(gxF.k);
  if (!cur) { gxF.phase = 'done'; return gxFollowTick(); }
  if (gxF.phase === 'ready' || gxF.phase === 'rest') {
    gxBeep(988, 220);
    gxFPhase('work', gxMode(cur.e) === 'time' ? (gxNum(cur.s.secs) || 40) : 0);
  } else {
    if (!skip && !cur.s.done) { cur.s.done = true; gxQueueSave(); }
    gxF.k++;
    const nxt = gxFItem(gxF.k);
    if (!nxt) { gxF.phase = 'done'; gxBeep(988, 200, 3); }
    else { const r = cur.e.rest != null ? cur.e.rest : (gxW.rest_default || gxPrefs().rest); gxBeep(523, 220); r > 0 ? gxFPhase('rest', r) : gxFPhase('work', gxMode(nxt.e) === 'time' ? (gxNum(nxt.s.secs) || 40) : 0); }
  }
  gxFollowTick();
}
function gxFBack() {
  if (gxF.phase === 'work' || gxF.k === 0) { gxFPhase('ready', 5); }
  else { gxF.k--; const it = gxFItem(gxF.k); if (it && it.s.done) { it.s.done = false; gxQueueSave(); } gxFPhase('ready', 5); }
  gxFollowTick();
}
function gxFPause() { if (gxF.paused) { gxF.end = Date.now() + gxF.left * 1000; gxF.paused = false; } else { gxF.left = gxFLeft(); gxF.paused = true; } gxFollowTick(); }
document.addEventListener('keydown', e => {
  if (!gxF) return;
  if (e.key === ' ') { e.preventDefault(); gxFPause(); } else if (e.key === 'ArrowRight') gxFNext(true); else if (e.key === 'ArrowLeft') gxFBack(); else if (e.key === 'Escape') gxCloseFollow();
});


/* ═══ PLANS ═══ */
function gxRenderPlans(el) {
  el.innerHTML = `
    <div class="gx-h big"><div><h2>Plans</h2><p>Your routines. Start one and the sets, reps and weights come with it.</p></div>
      <div class="gx-row"><button class="gx-btn" onclick="gxOpenImport()">${gxI('import')}Import</button><button class="gx-btn primary" onclick="gxOpenBuilder(null)">${gxI('plus')}New plan</button></div></div>
    ${gymPlans.length ? `<div class="gx-plans">${gymPlans.map(p => {
      const exs = gxPlanExercises(p), last = gxPlanLast(p), mus = gxPlanMuscles(exs);
      const sets = exs.reduce((n, e) => n + (e.sets || []).length, 0);
      return `<div class="gx-plan" style="--c:${gxColor(mus[0])}">
        <div class="gx-plan-head"><b>${gxEsc(p.name)}</b>${exs.length && exs.filter(e => gxMode(e) === 'time').length >= exs.length / 2 ? `<span class="gx-tag">${gxI('bolt')}Intervals</span>` : ''}</div>
        <div class="gx-plan-meta"><span>${exs.length} exercises</span><span>${sets} sets</span><span>~${gxPlanMinutes(exs)} min</span><span>${last ? 'Last ' + gxAgo(last) : 'Not done yet'}</span></div>
        <ol class="gx-plan-list">${exs.slice(0, 6).map(e => `<li><i style="--c:${gxColor(e.muscle_group)}"></i>${gxEsc(e.name)}<em>${gxPlanSetText(e)}</em></li>`).join('')}${exs.length > 6 ? `<li class="more">+${exs.length - 6} more</li>` : ''}</ol>
        <div class="gx-plan-actions">
          <button class="gx-btn primary" onclick="gxStartPlan('${gxQ(p.id)}')">${gxI('play')}Start</button>
          <button class="gx-btn" onclick="gxOpenBuilder('${gxQ(p.id)}')">${gxI('edit')}Edit</button>
          <button class="gx-iconbtn" onclick="gxDuplicatePlan('${gxQ(p.id)}')" title="Duplicate">${gxI('copy')}</button>
          <button class="gx-iconbtn danger" onclick="gxDeletePlan('${gxQ(p.id)}')" title="Delete">${gxI('trash')}</button>
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="gx-empty">No plans yet — create one, or import a workout from a video or a coach's sheet.</div>`}`;
}
function gxPlanSetText(e) {
  const s = e.sets || [], f = s[0] || {};
  if (gxMode(e) === 'time') return `${s.length} × ${gxNum(f.secs || f.reps) || 40}s`;
  return `${s.length} × ${gxNum(f.reps) || '—'}${gxNum(f.weight) ? ' @ ' + gxNum(f.weight) + 'kg' : ''}`;
}
async function gxDeletePlan(id) {
  const p = gymPlans.find(x => String(x.id) === String(id)); if (!p) return;
  if (!confirm(`Delete the plan "${p.name}"? Past workouts stay in your history.`)) return;
  try { await apiPost({ action: 'delete', sheet: 'gym_plans', id: p.id }); gymPlans.splice(0, gymPlans.length, ...gymPlans.filter(x => String(x.id) !== String(id))); gxRender(); } catch (e) { if (typeof toast === 'function') toast('Could not delete the plan'); }
}
async function gxDuplicatePlan(id) {
  const p = gymPlans.find(x => String(x.id) === String(id)); if (!p) return;
  const payload = { name: p.name + ' (copy)', exercises_json: p.exercises_json || '[]' };
  try { const r = await apiPost({ action: 'create', sheet: 'gym_plans', payload }); gymPlans.push({ id: r.id || (r.data && r.data.id), ...payload }); gxRender(); } catch (e) { if (typeof toast === 'function') toast('Could not duplicate'); }
}
function gymOpenBuilder(id) { gxOpenBuilder(id); }

/* ── Builder ── */
function gxOpenBuilder(id) {
  const p = id ? gymPlans.find(x => String(x.id) === String(id)) : null;
  const exs = p ? gxPlanExercises(p) : [];
  gxBuilder = { id: p ? p.id : null, name: p ? p.name : '', exercises: exs.map(e => gxBRow(e)) };
  gxRenderBuilder();
  if (!p) setTimeout(() => document.getElementById('gxBName')?.focus(), 30);
}
function gxBRow(e) {
  const mode = gxMode(e), s = (e.sets && e.sets.length ? e.sets : [{}]), f = s[0] || {};
  return { name: e.name, muscle_group: e.muscle_group || 'Full Body', category: e.category || 'strength', mode, note: e.note || '', rest: e.rest != null ? e.rest : '',
    n: s.length, reps: gxNum(f.reps) || (mode === 'time' ? 0 : 10), weight: gxNum(f.weight), secs: gxNum(f.secs || (mode === 'time' ? f.reps : 0)) || 40, orig: e.sets, dirty: false };
}
function gxBSets(b) {
  if (!b.dirty && b.orig && b.orig.length) return b.orig.map(s => b.mode === 'time' ? { secs: gxNum(s.secs || s.reps) || b.secs } : { reps: gxNum(s.reps), weight: gxNum(s.weight) });
  return Array.from({ length: Math.max(1, b.n) }, () => b.mode === 'time' ? { secs: b.secs } : { reps: b.reps, weight: b.weight });
}
function gxRenderBuilder() {
  let ov = document.getElementById('gxOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'gxOverlay'; ov.className = 'gx-overlay'; document.body.appendChild(ov); }
  const b = gxBuilder;
  const totalSets = b.exercises.reduce((n, e) => n + Math.max(1, e.n), 0);
  ov.innerHTML = `
    <div class="gx-sheet-box gx-builder">
      <header class="gx-b-bar">
        <button class="gx-iconbtn" onclick="gxCloseBuilder()" aria-label="Close">${gxI('x')}</button>
        <input id="gxBName" class="gx-b-name" placeholder="Plan name — e.g. Push day" value="${gxEsc(b.name)}" oninput="gxBuilder.name=this.value" autocomplete="off">
        <span class="gx-b-meta">${b.exercises.length} exercises · ${totalSets} sets · ~${gxPlanMinutes(b.exercises.map(e => ({ ...e, sets: gxBSets(e) })))} min</span>
        <button class="gx-btn primary" onclick="gxSaveBuilder()">${gxI('check')}Save plan</button>
      </header>
      <div class="gx-b-body">
        <main class="gx-b-list">
          ${b.exercises.length ? b.exercises.map((e, i) => `
            <div class="gx-b-ex" style="--c:${gxColor(e.muscle_group)}">
              <div class="gx-b-ex-top">
                <span class="gx-b-idx">${i + 1}</span>
                <div class="gx-b-ex-name"><b>${gxEsc(e.name)}</b><em>${gxEsc(e.muscle_group)}</em></div>
                <div class="gx-seg sm"><button class="${e.mode === 'reps' ? 'on' : ''}" onclick="gxBSet(${i},'mode','reps')">Reps</button><button class="${e.mode === 'time' ? 'on' : ''}" onclick="gxBSet(${i},'mode','time')">Timed</button></div>
                <button class="gx-iconbtn sm" onclick="gxBMove(${i},-1)" ${i === 0 ? 'disabled' : ''} title="Move up">${gxI('up')}</button>
                <button class="gx-iconbtn sm" onclick="gxBMove(${i},1)" ${i === b.exercises.length - 1 ? 'disabled' : ''} title="Move down">${gxI('down')}</button>
                <button class="gx-iconbtn sm danger" onclick="gxBRemove(${i})" title="Remove">${gxI('x')}</button>
              </div>
              <div class="gx-b-fields">
                <label><span>Sets</span><div class="gx-step"><button onclick="gxBStep(${i},-1)">${gxI('minus')}</button><b>${e.n}</b><button onclick="gxBStep(${i},1)">${gxI('plus')}</button></div></label>
                ${e.mode === 'time'
                  ? `<label><span>Seconds</span><input type="number" min="5" value="${e.secs}" onchange="gxBSet(${i},'secs',this.value)"></label>`
                  : `<label><span>Reps</span><input type="number" min="0" value="${e.reps || ''}" placeholder="10" onchange="gxBSet(${i},'reps',this.value)"></label>
                     <label><span>kg</span><input type="number" min="0" step="0.5" value="${e.weight || ''}" placeholder="—" onchange="gxBSet(${i},'weight',this.value)"></label>`}
                <label><span>Rest (s)</span><input type="number" min="0" value="${e.rest}" placeholder="${gxPrefs().rest}" onchange="gxBSet(${i},'rest',this.value)"></label>
                <label class="grow"><span>Note</span><input value="${gxEsc(e.note)}" placeholder="Cue, seat height, tempo…" onchange="gxBuilder.exercises[${i}].note=this.value"></label>
              </div>
            </div>`).join('') : `<div class="gx-empty">Pick exercises from the list${window.innerWidth < 900 ? ' below' : ' on the right'} — they're added in order. You can reorder and set sets × reps for each.</div>`}
        </main>
        <aside class="gx-b-pick" id="gxBPick">${gxPickerHTML('gxBuilderAdd')}</aside>
      </div>
    </div>`;
  gxPickerFilter();
}
function gxBSet(i, f, v) {
  const e = gxBuilder.exercises[i];
  if (f === 'mode') { if (e.mode === v) return; e.mode = v; if (v === 'time' && !e.secs) e.secs = 40; }
  else if (f === 'rest') e.rest = v === '' ? '' : Math.max(0, parseInt(v, 10) || 0);
  else e[f] = gxNum(v);
  e.dirty = true; gxRenderBuilder();
}
function gxBStep(i, d) { const e = gxBuilder.exercises[i]; e.n = Math.max(1, Math.min(20, e.n + d)); e.dirty = true; gxRenderBuilder(); }
function gxBMove(i, d) { const a = gxBuilder.exercises, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; gxRenderBuilder(); }
function gxBRemove(i) { gxBuilder.exercises.splice(i, 1); gxRenderBuilder(); }
function gxBuilderAdd(ex) {
  const timed = ex.category === 'cardio' || ex.category === 'hiit' || ex.muscle_group === 'Mobility';
  gxBuilder.exercises.push(gxBRow({ name: ex.name, muscle_group: ex.muscle_group, category: ex.category, mode: timed ? 'time' : 'reps', sets: timed ? [{ secs: 40 }, { secs: 40 }, { secs: 40 }] : [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }] }));
  gxBuilder.exercises[gxBuilder.exercises.length - 1].dirty = true;
  const keep = document.getElementById('gxPickQ')?.value || '';
  gxRenderBuilder();
  const q = document.getElementById('gxPickQ'); if (q) { q.value = keep; gxPickerFilter(); }
  const list = document.querySelector('.gx-b-list'); if (list) list.scrollTop = list.scrollHeight;
}
function gxCloseBuilder() {
  if (gxBuilder && (gxBuilder.exercises.length || gxBuilder.name) && !confirm('Close the plan without saving?')) return;
  gxBuilder = null; document.getElementById('gxOverlay')?.remove();
}
async function gxSaveBuilder() {
  const b = gxBuilder; if (!b) return;
  const name = (document.getElementById('gxBName')?.value || b.name || '').trim();
  if (!name) { document.getElementById('gxBName')?.focus(); if (typeof toast === 'function') toast('Give the plan a name'); return; }
  if (!b.exercises.length) { if (typeof toast === 'function') toast('Add at least one exercise'); return; }
  const exercises = b.exercises.map((e, i) => {
    const o = { name: e.name, muscle_group: e.muscle_group, category: e.category, mode: e.mode, order: i, sets: gxBSets(e) };
    if (e.rest !== '' && e.rest != null) o.rest = e.rest;
    if (e.note) o.note = e.note;
    return o;
  });
  const payload = { name, exercises_json: JSON.stringify(exercises) };
  try {
    if (b.id) {
      await apiPost({ action: 'update', sheet: 'gym_plans', id: b.id, payload });
      const p = gymPlans.find(x => String(x.id) === String(b.id)); if (p) Object.assign(p, payload);
    } else {
      const r = await apiPost({ action: 'create', sheet: 'gym_plans', payload });
      if (!r || r.success === false) throw new Error('save failed');
      gymPlans.push({ id: r.id || (r.data && r.data.id), ...payload });
    }
    gxBuilder = null; document.getElementById('gxOverlay')?.remove();
    if (typeof toast === 'function') toast(b.id ? 'Plan saved' : 'Plan created');
    if (gxTab !== 'today' || !(gxRow && !gxDone(gxRow))) gxTab = gxTab === 'today' ? 'today' : 'plans';
    gxRender();
  } catch (e) { console.error(e); if (typeof toast === 'function') toast('Could not save the plan'); }
}

/* ── Exercise picker (builder side panel, or sheet during a workout) ── */
function gxAllExercises() {
  const seen = new Set(), out = [];
  [...gymCustomExercises.map(e => ({ ...e, custom: true })), ...GYM_BUILTIN_EXERCISES].forEach(e => { const k = String(e.name).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(e); } });
  // anything you've logged before but isn't in the lists
  gymSessions.forEach(r => (gxWorkoutOf(r).exercises || []).forEach(e => { const k = String(e.name || '').toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push({ name: e.name, muscle_group: e.muscle_group || 'Full Body', category: e.category || 'strength', logged: true }); } }));
  return out;
}
let gxPickMuscle = 'All';
function gxPickerHTML(cb) {
  gxPickCb = cb;
  const mus = ['All', ...GX_MUSCLES];
  return `
    <div class="gx-pick">
      <div class="gx-pick-search">${gxI('search')}<input id="gxPickQ" placeholder="Search or type a new exercise" oninput="gxPickerFilter()" onkeydown="if(event.key==='Enter'){gxPickFirst()}"></div>
      <div class="gx-pick-chips">${mus.map(m => `<button class="${gxPickMuscle === m ? 'on' : ''}" style="--c:${m === 'All' ? 'var(--primary)' : gxColor(m)}" onclick="gxPickMuscle='${m}';document.querySelectorAll('.gx-pick-chips button').forEach(b=>b.classList.toggle('on',b.textContent==='${m}'));gxPickerFilter()">${m}</button>`).join('')}</div>
      <div class="gx-pick-list" id="gxPickList"></div>
    </div>`;
}
function gxPickerFilter() {
  const list = document.getElementById('gxPickList'); if (!list) return;
  const q = (document.getElementById('gxPickQ')?.value || '').trim().toLowerCase();
  const all = gxAllExercises().filter(e => (gxPickMuscle === 'All' || e.muscle_group === gxPickMuscle) && (!q || String(e.name).toLowerCase().includes(q)));
  const exact = all.some(e => String(e.name).toLowerCase() === q);
  // matches first (names starting with the query on top); "add new" goes last
  if (q) all.sort((a, b) => (String(b.name).toLowerCase().startsWith(q) ? 1 : 0) - (String(a.name).toLowerCase().startsWith(q) ? 1 : 0));
  const newBtn = q && !exact ? `<button class="gx-pick-it new" onclick="gxPickNew()">${gxI('plus')}<span><b>Add "${gxEsc(q)}"</b><em>${gxPickMuscle === 'All' ? 'Full Body' : gxPickMuscle} · new exercise</em></span></button>` : '';
  list.innerHTML = all.slice(0, 120).map(e => `<button class="gx-pick-it" onclick="gxPicked('${gxQ(e.name)}')"><i style="--c:${gxColor(e.muscle_group)}"></i><span><b>${gxEsc(e.name)}</b><em>${gxEsc(e.muscle_group)}${e.custom ? ' · custom' : ''}</em></span>${gxI('plus')}</button>`).join('') + newBtn ||
    `<div class="gx-empty sm">No match.</div>`;
}
function gxPickFirst() { const b = document.querySelector('#gxPickList .gx-pick-it'); if (b) b.click(); }
function gxPicked(name) { const e = gxAllExercises().find(x => x.name === name); if (e && gxPickCb && window[gxPickCb]) window[gxPickCb](e); }
async function gxPickNew() {
  const name = (document.getElementById('gxPickQ')?.value || '').trim(); if (!name) return;
  const muscle = gxPickMuscle === 'All' ? 'Full Body' : gxPickMuscle;
  const ex = { name: name.replace(/\b\w/g, c => c.toUpperCase()), muscle_group: muscle, category: 'strength' };
  try { const r = await apiPost({ action: 'create', sheet: 'gym_exercises', payload: { name: ex.name, muscle_group: muscle } }); gymCustomExercises.push({ id: r && r.id, ...ex }); } catch (e) { }
  if (gxPickCb && window[gxPickCb]) window[gxPickCb](ex);
}
/* during a workout */
function gxOpenPicker() {
  let sh = document.getElementById('gxSheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'gxSheet'; sh.className = 'gx-overlay'; document.body.appendChild(sh); }
  sh.innerHTML = `<div class="gx-sheet-box gx-pick-sheet"><header class="gx-b-bar"><b>Add exercise</b><button class="gx-iconbtn" onclick="document.getElementById('gxSheet').remove()">${gxI('x')}</button></header>${gxPickerHTML('gxLiveAdd')}</div>`;
  sh.onclick = e => { if (e.target === sh) sh.remove(); };
  gxPickerFilter(); setTimeout(() => document.getElementById('gxPickQ')?.focus(), 30);
}
function gxLiveAdd(ex) {
  const last = gxExHistory(ex.name)[0];
  const timed = ex.category === 'cardio' || ex.category === 'hiit' || ex.muscle_group === 'Mobility';
  const sets = last ? last.sets.map(s => timed ? { secs: gxNum(s.secs) || 40, done: false } : { reps: gxNum(s.reps), weight: gxNum(s.weight), done: false })
    : Array.from({ length: 3 }, () => timed ? { secs: 40, done: false } : { reps: 10, weight: 0, done: false });
  gxW.exercises.push({ name: ex.name, muscle_group: ex.muscle_group, category: ex.category || 'strength', mode: timed ? 'time' : 'reps', order: gxW.exercises.length, sets });
  document.getElementById('gxSheet')?.remove();
  gxOpen[gxW.exercises.length - 1] = true; gxQueueSave(); gxRender();
  document.getElementById('gxEx' + (gxW.exercises.length - 1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


/* ═══ IMPORT ═══
   First line: plan name. "## Section | Muscle | rest 20" starts a section.
   Exercise lines: "Name | Muscle | 40s" (timed), "| 3x10" or "| 3x10@60" (sets × reps @ kg),
   "| 12" (one set). Muscle and amount are optional. */
function gymParsePlanText(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const name = lines.shift().replace(/^(#+\s*|name\s*:\s*)/i, '').trim();
  const fix = m => GX_MUSCLES.find(k => k.toLowerCase() === String(m || '').trim().toLowerCase()) || '';
  let group = '', cat = 'strength', rest = null;
  const exercises = [];
  lines.forEach(raw => {
    if (/^#{1,6}\s/.test(raw)) {
      const parts = raw.replace(/^#+\s*/, '').split('|').map(x => x.trim());
      group = ''; rest = null;
      parts.slice(1).forEach(x => { const r = /^rest\s*(\d+)/i.exec(x); if (r) rest = +r[1]; else if (fix(x)) group = fix(x); });
      cat = /hiit|cardio|finisher|intensity/i.test(parts[0]) ? 'hiit' : 'strength';
      if (!group && /warm|mobil|stretch/i.test(parts[0])) group = 'Mobility';
      return;
    }
    const parts = raw.replace(/^(\d+[.)]|[-*•])\s*/, '').split('|').map(x => x.trim());
    if (!parts[0]) return;
    let muscle = group, amount = '', exRest = rest;
    parts.slice(1).forEach(x => { const r = /^rest\s*(\d+)/i.exec(x); if (r) exRest = +r[1]; else if (/^\d/.test(x)) amount = x; else if (fix(x)) muscle = fix(x); });
    let mode = 'reps', sets = [{ reps: 10, weight: 0 }], m;
    if ((m = /^(?:(\d+)\s*[x×]\s*)?(\d+)\s*s(?:ec)?$/i.exec(amount))) { mode = 'time'; sets = Array.from({ length: +(m[1] || 1) }, () => ({ secs: +m[2] })); }
    else if ((m = /^(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+))?/i.exec(amount))) sets = Array.from({ length: +m[1] }, () => ({ reps: +m[2], weight: gxNum(m[3]) }));
    else if ((m = /^(\d+)$/.exec(amount))) sets = [{ reps: +m[1], weight: 0 }];
    const ex = { name: parts[0], muscle_group: muscle || 'Full Body', category: cat, mode, order: exercises.length, sets };
    if (exRest != null) ex.rest = exRest;
    exercises.push(ex);
  });
  return exercises.length ? { name: name || 'Imported plan', exercises } : null;
}
function gxOpenImport() {
  let sh = document.getElementById('gxSheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'gxSheet'; sh.className = 'gx-overlay'; document.body.appendChild(sh); }
  sh.innerHTML = `
    <div class="gx-sheet-box gx-import">
      <header class="gx-b-bar"><b>Import a workout</b><button class="gx-iconbtn" onclick="document.getElementById('gxSheet').remove()">${gxI('x')}</button></header>
      <div class="gx-import-body">
        <p>Paste a routine — from a video, a coach or a note. The first line is the plan's name. Then one exercise per line; add <b>| 40s</b> for timed sets or <b>| 3x10</b> / <b>| 3x8@60</b> for sets × reps @ kg. <b>## Section | Muscle | rest 20</b> starts a section.</p>
        <textarea id="gxImportText" spellcheck="false" placeholder="Push day&#10;## Chest | Chest | rest 90&#10;Bench Press | 4x8@60&#10;Incline Dumbbell Press | 3x10@22.5&#10;## Finisher | Cardio | rest 20&#10;Burpees | 40s" oninput="gxImportPreview()"></textarea>
        <div class="gx-import-prev" id="gxImportPrev">Nothing yet.</div>
      </div>
      <footer class="gx-import-foot"><button class="gx-btn" onclick="document.getElementById('gxSheet').remove()">Cancel</button><button class="gx-btn primary" onclick="gymRunImport()">Review in plan builder</button></footer>
    </div>`;
  sh.onclick = e => { if (e.target === sh) sh.remove(); };
  setTimeout(() => document.getElementById('gxImportText')?.focus(), 30);
}
function gymOpenImport() { gxOpenImport(); }
function gxImportPreview() {
  const p = gymParsePlanText(document.getElementById('gxImportText')?.value), el = document.getElementById('gxImportPrev');
  if (!el) return;
  el.innerHTML = p ? `<b>${gxEsc(p.name)}</b> · ${p.exercises.length} exercises · ~${gxPlanMinutes(p.exercises)} min<div class="gx-chips">${gxPlanMuscles(p.exercises).map(m => `<span class="gx-chip" style="--c:${gxColor(m)}">${m}</span>`).join('')}</div>` : 'Nothing yet.';
}
function gymRunImport() {
  const p = gymParsePlanText(document.getElementById('gxImportText')?.value);
  if (!p) { if (typeof toast === 'function') toast('Add a name line and at least one exercise'); return; }
  document.getElementById('gxSheet')?.remove();
  gxBuilder = { id: null, name: p.name, exercises: p.exercises.map(e => Object.assign(gxBRow(e), { dirty: false })) };
  gxRenderBuilder();
  if (typeof toast === 'function') toast(`${p.exercises.length} exercises imported — check them and Save`);
}

/* ═══ HISTORY ═══ */
function gxRenderHistory(el) {
  const today = gymTodayStr();
  gxHistMonth = gxHistMonth || today.slice(0, 7);
  const [y, mo] = gxHistMonth.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), daysIn = new Date(y, mo, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const rows = gxSorted().filter(r => gxDone(r) && String(r.date).startsWith(gxHistMonth));
  const by = {}; rows.forEach(r => (by[r.date] = by[r.date] || []).push(r));
  const vol = rows.reduce((t, r) => t + gxVolume(gxWorkoutOf(r)), 0), min = rows.reduce((t, r) => t + (gxMinutes(gxWorkoutOf(r)) || 0), 0);
  const cells = [];
  for (let k = 0; k < lead; k++) cells.push('<span class="gx-cal-d pad"></span>');
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${gxHistMonth}-${String(d).padStart(2, '0')}`, rs = by[ds] || [];
    cells.push(`<button class="gx-cal-d ${rs.length ? 'on' : ''} ${ds === today ? 'today' : ''}" ${rs.length ? `onclick="gxOpenSession('${gxQ(rs[0].id)}')" title="${gxEsc(rs.map(r => r.plan_name || 'Workout').join(', '))}"` : 'disabled'}>${d}${rs.length ? `<i style="--c:${gxColor(gxPlanMuscles(gxWorkoutOf(rs[0]).exercises)[0])}"></i>` : ''}</button>`);
  }
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  el.innerHTML = `
    <div class="gx-hist">
      <div class="gx-cal">
        <div class="gx-cal-head"><button class="gx-iconbtn" onclick="gxHistNav(-1)">${gxI('up', 'rot-l')}</button><b>${label}</b><button class="gx-iconbtn" onclick="gxHistNav(1)" ${gxHistMonth >= today.slice(0, 7) ? 'disabled' : ''}>${gxI('up', 'rot-r')}</button></div>
        <div class="gx-cal-wd">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="gx-cal-grid">${cells.join('')}</div>
        <div class="gx-cal-stats"><div><b>${rows.length}</b><em>Workouts</em></div><div><b>${vol ? gxKg(vol) : '—'}</b><em>Volume</em></div><div><b>${min ? Math.round(min / 60 * 10) / 10 + ' h' : '—'}</b><em>Time</em></div></div>
      </div>
      <div class="gx-hist-list">
        <div class="gx-h"><h3>${label}</h3></div>
        ${rows.length ? `<div class="gx-list">${rows.map(gxSessionRowHTML).join('')}</div>` : `<div class="gx-empty sm">No workouts logged this month.</div>`}
      </div>
    </div>`;
}
function gxHistNav(d) { const [y, m] = gxHistMonth.split('-').map(Number); const x = new Date(y, m - 1 + d, 1); gxHistMonth = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; gxRender(); }

function gxOpenSession(id) {
  const r = gymSessions.find(x => String(x.id) === String(id)); if (!r) return;
  const w = gxWorkoutOf(r), m = gxMinutes(w), v = gxVolume(w);
  let sh = document.getElementById('gxSheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'gxSheet'; sh.className = 'gx-overlay'; document.body.appendChild(sh); }
  sh.innerHTML = `
    <div class="gx-sheet-box gx-sess">
      <header class="gx-b-bar"><div class="gx-sess-t"><b>${gxEsc(r.plan_name || 'Workout')}</b><em>${gxLong(r.date)}</em></div><button class="gx-iconbtn" onclick="document.getElementById('gxSheet').remove()">${gxI('x')}</button></header>
      <div class="gx-sess-body">
        <div class="gx-summary-stats"><div><b>${m != null ? m + ' min' : '—'}</b><em>Duration</em></div><div><b>${gxSetsDone(w)}</b><em>Sets</em></div><div><b>${v ? gxKg(v) : '—'}</b><em>Volume</em></div><div><b>${(w.exercises || []).length}</b><em>Exercises</em></div></div>
        ${(w.exercises || []).map(e => `
          <div class="gx-sess-ex" style="--c:${gxColor(e.muscle_group)}">
            <div class="gx-sess-ex-h"><i></i><b>${gxEsc(e.name)}</b><em>${gxEsc(e.muscle_group || '')}</em></div>
            <div class="gx-sess-sets">${(e.sets || []).map((s, si) => `<span class="${s.done ? '' : 'skip'}">${si + 1}. ${gxMode(e) === 'time' ? (gxNum(s.secs) || gxNum(s.reps)) + 's' : (gxNum(s.weight) ? gxNum(s.weight) + ' kg × ' : '') + gxNum(s.reps)}</span>`).join('')}</div>
            ${e.note ? `<div class="gx-ex-note">${gxI('note')}<span>${gxEsc(e.note)}</span></div>` : ''}
          </div>`).join('') || '<div class="gx-empty sm">No exercises.</div>'}
      </div>
      <footer class="gx-import-foot">
        <button class="gx-btn danger" onclick="gxDeleteSession('${gxQ(r.id)}')">${gxI('trash')}Delete</button>
        <span style="flex:1"></span>
        <button class="gx-btn" onclick="gxSaveAsPlan('${gxQ(r.id)}')">${gxI('copy')}Save as plan</button>
        <button class="gx-btn" onclick="gxEditSession('${gxQ(r.id)}')">${gxI('edit')}Edit</button>
        <button class="gx-btn primary" onclick="gxRepeatSession('${gxQ(r.id)}')">${gxI('play')}Do again</button>
      </footer>
    </div>`;
  sh.onclick = e => { if (e.target === sh) sh.remove(); };
}
async function gxDeleteSession(id) {
  if (!confirm('Delete this workout from your history?')) return;
  try { await apiPost({ action: 'delete', sheet: 'gym_sessions', id }); } catch (e) { }
  gymSessions.splice(0, gymSessions.length, ...gymSessions.filter(r => String(r.id) !== String(id)));
  document.getElementById('gxSheet')?.remove(); gxRender();
}
function gxEditSession(id) {
  const r = gymSessions.find(x => String(x.id) === String(id)); if (!r) return;
  if (gxRow && !gxDone(gxRow) && !gxEditing) { if (typeof toast === 'function') toast('Finish the workout in progress first'); return; }
  gxRow = r; gxW = gxWorkoutOf(r); gxEditing = true; gxOpen = {}; (gxW.exercises || []).forEach((e, i) => gxOpen[i] = true);
  document.getElementById('gxSheet')?.remove(); gxTab = 'today'; gxRenderLiveEdit();
}
function gxRenderLiveEdit() { const root = document.getElementById('gx'); if (!root) return; gxRender(); }
async function gxRepeatSession(id) {
  const r = gymSessions.find(x => String(x.id) === String(id)); if (!r) return;
  if (gxRow && !gxDone(gxRow)) { if (typeof toast === 'function') toast('Finish the workout in progress first'); return; }
  document.getElementById('gxSheet')?.remove();
  await gxCreate(r.plan_id || '', r.plan_name || 'Workout', { exercises: gxFromPlan(gxWorkoutOf(r).exercises), started_at: new Date().toISOString() });
}
async function gxSaveAsPlan(id) {
  const r = gymSessions.find(x => String(x.id) === String(id)); if (!r) return;
  const name = prompt('Name for the new plan', r.plan_name || 'My workout'); if (!name) return;
  const exs = (gxWorkoutOf(r).exercises || []).map((e, i) => ({ name: e.name, muscle_group: e.muscle_group, category: e.category, mode: gxMode(e), order: i, rest: e.rest, note: e.note, sets: (e.sets || []).map(s => gxMode(e) === 'time' ? { secs: gxNum(s.secs) || 40 } : { reps: gxNum(s.reps), weight: gxNum(s.weight) }) }));
  const payload = { name, exercises_json: JSON.stringify(exs) };
  try { const res = await apiPost({ action: 'create', sheet: 'gym_plans', payload }); gymPlans.push({ id: res.id || (res.data && res.data.id), ...payload }); document.getElementById('gxSheet')?.remove(); if (typeof toast === 'function') toast('Saved as a plan'); gxRender(); } catch (e) { }
}

/* ═══ EXERCISES (progress & records) ═══ */
function gxRenderExercises(el) {
  const stats = {};
  gxSorted().filter(gxDone).forEach(r => (gxWorkoutOf(r).exercises || []).forEach(e => {
    const k = String(e.name || '').toLowerCase(); if (!k || !(e.sets || []).some(s => s.done)) return;
    const st = stats[k] = stats[k] || { n: 0, last: r.date };
    st.n++;
  }));
  const all = gxAllExercises().filter(e => (gxExMuscle === 'All' || e.muscle_group === gxExMuscle) && (!gxExSearch || String(e.name).toLowerCase().includes(gxExSearch.toLowerCase())))
    .sort((a, b) => ((stats[String(b.name).toLowerCase()] || {}).n || 0) - ((stats[String(a.name).toLowerCase()] || {}).n || 0) || String(a.name).localeCompare(String(b.name)));
  el.innerHTML = `
    <div class="gx-h big"><div><h2>Exercises</h2><p>Your records and progress, exercise by exercise.</p></div></div>
    <div class="gx-ex-tools-row">
      <div class="gx-pick-search">${gxI('search')}<input placeholder="Search exercises" value="${gxEsc(gxExSearch)}" oninput="gxExSearch=this.value;gxRenderExercisesList()"></div>
      <div class="gx-pick-chips">${['All', ...GX_MUSCLES].map(m => `<button class="${gxExMuscle === m ? 'on' : ''}" style="--c:${m === 'All' ? 'var(--primary)' : gxColor(m)}" onclick="gxExMuscle='${m}';gxRender()">${m}</button>`).join('')}</div>
    </div>
    <div class="gx-exgrid" id="gxExGrid"></div>`;
  gxExStats = stats; gxRenderExercisesList();
}
let gxExStats = {};
function gxRenderExercisesList() {
  const grid = document.getElementById('gxExGrid'); if (!grid) return;
  const all = gxAllExercises().filter(e => (gxExMuscle === 'All' || e.muscle_group === gxExMuscle) && (!gxExSearch || String(e.name).toLowerCase().includes(gxExSearch.toLowerCase())))
    .sort((a, b) => ((gxExStats[String(b.name).toLowerCase()] || {}).n || 0) - ((gxExStats[String(a.name).toLowerCase()] || {}).n || 0) || String(a.name).localeCompare(String(b.name)));
  grid.innerHTML = all.map(e => {
    const st = gxExStats[String(e.name).toLowerCase()];
    let best = '';
    if (st) { const r = gxRecords(e.name); best = r.weight ? `Best ${r.weight} kg` : r.secs ? `Best ${r.secs}s` : r.reps ? `Best ${r.reps} reps` : ''; }
    return `<button class="gx-exrow ${st ? '' : 'never'}" style="--c:${gxColor(e.muscle_group)}" onclick="gxOpenExercise('${gxQ(e.name)}')">
      <i></i><span class="gx-exrow-main"><b>${gxEsc(e.name)}</b><em>${gxEsc(e.muscle_group)}${e.custom ? ' · custom' : ''}</em></span>
      <span class="gx-exrow-st">${st ? `<b>${best}</b><em>${st.n}× · last ${gxAgo(st.last)}</em>` : '<em>Not logged yet</em>'}</span></button>`;
  }).join('') || `<div class="gx-empty sm">No exercises match.</div>`;
}
function gxOpenExercise(name) {
  const hist = gxExHistory(name).slice().reverse();   // oldest → newest
  const rec = gxRecords(name);
  const e = gxAllExercises().find(x => x.name === name) || { muscle_group: '' };
  const timed = hist.some(h => h.mode === 'time');
  const pts = hist.slice(-20).map(h => ({ d: h.date, v: timed ? Math.max(...h.sets.map(s => gxNum(s.secs) || gxNum(s.reps))) : (Math.max(...h.sets.map(s => gxE1rm(s.weight, s.reps))) || Math.max(...h.sets.map(s => gxNum(s.reps)))) }));
  const metric = timed ? 'Longest set (s)' : (rec.e1rm ? 'Estimated 1-rep max (kg)' : 'Most reps in a set');
  let chart = '<div class="gx-empty sm">Log it twice to see a progress line.</div>';
  if (pts.length >= 2) {
    const W = 560, H = 170, P = 26, max = Math.max(...pts.map(p => p.v)), min = Math.min(...pts.map(p => p.v)), span = max - min || 1;
    const xy = pts.map((p, k) => [P + k * (W - 2 * P) / (pts.length - 1), H - P - (p.v - min) / span * (H - 2 * P)]);
    chart = `<svg class="gx-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="M${xy.map(p => p.join(',')).join(' L')} L${xy[xy.length - 1][0]},${H - P} L${xy[0][0]},${H - P} Z" class="area"/>
      <path d="M${xy.map(p => p.join(',')).join(' L')}" class="line"/>
      ${xy.map((p, k) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5"><title>${gxShort(pts[k].d)}: ${Math.round(pts[k].v * 10) / 10}</title></circle>`).join('')}
      <text x="${P}" y="14">${Math.round(max * 10) / 10}</text><text x="${P}" y="${H - 6}">${Math.round(min * 10) / 10}</text></svg>`;
  }
  let sh = document.getElementById('gxSheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'gxSheet'; sh.className = 'gx-overlay'; document.body.appendChild(sh); }
  sh.innerHTML = `
    <div class="gx-sheet-box gx-sess" style="--c:${gxColor(e.muscle_group)}">
      <header class="gx-b-bar"><div class="gx-sess-t"><b>${gxEsc(name)}</b><em>${gxEsc(e.muscle_group || '')} · logged ${hist.length}×</em></div><button class="gx-iconbtn" onclick="document.getElementById('gxSheet').remove()">${gxI('x')}</button></header>
      <div class="gx-sess-body">
        <div class="gx-summary-stats">
          ${timed ? `<div><b>${rec.secs || '—'}${rec.secs ? 's' : ''}</b><em>Longest set</em></div>` : `<div><b>${rec.weight ? rec.weight + ' kg' : '—'}</b><em>Heaviest</em></div><div><b>${rec.e1rm ? Math.round(rec.e1rm) + ' kg' : '—'}</b><em>Est. 1RM</em></div><div><b>${rec.volume ? gxKg(rec.volume) : '—'}</b><em>Best session</em></div>`}
          <div><b>${rec.reps || '—'}</b><em>Most reps</em></div>
        </div>
        <div class="gx-h"><h3>${metric}</h3></div>
        ${chart}
        <div class="gx-h"><h3>History</h3></div>
        ${hist.length ? `<div class="gx-list">${hist.slice().reverse().slice(0, 30).map(h => `<div class="gx-hrow"><b>${gxShort(h.date)}</b><span>${h.sets.map(s => timed ? (gxNum(s.secs) || gxNum(s.reps)) + 's' : (gxNum(s.weight) ? gxNum(s.weight) + '×' : '') + gxNum(s.reps)).join(' · ')}</span></div>`).join('')}</div>` : `<div class="gx-empty sm">Not logged yet.</div>`}
      </div>
    </div>`;
  sh.onclick = ev => { if (ev.target === sh) sh.remove(); };
}

/* ═══ STYLES ═══ */
const GX_CSS = `
.gx { max-width:1180px; margin:0 auto; padding:4px 20px 120px; color:var(--text-1); }
.gx button { font-family:inherit; -webkit-tap-highlight-color:transparent; }
.gx-i { display:inline-flex; width:16px; height:16px; flex:none; }
.gx-i svg { width:100%; height:100%; }
.gx-i.rot-l { transform:rotate(-90deg); } .gx-i.rot-r { transform:rotate(90deg); }
.gx-loading, .gx-empty { padding:40px 20px; text-align:center; color:var(--text-3); font-size:14px; border:1px dashed var(--border-color); border-radius:14px; background:var(--surface-1); }
.gx-empty.sm { padding:18px; font-size:13px; text-align:left; }

/* top bar */
.gx-top { display:flex; align-items:center; gap:12px; margin:0 0 18px; flex-wrap:wrap; }
.gx-tabs { display:inline-flex; gap:2px; padding:3px; background:var(--surface-2); border:1px solid var(--border-color); border-radius:11px; }
.gx-tab { position:relative; padding:7px 15px; border:none; background:transparent; border-radius:8px; font-size:13.5px; font-weight:600; color:var(--text-2); cursor:pointer; }
.gx-tab:hover { color:var(--text-1); }
.gx-tab.on { background:var(--surface-1); color:var(--text-1); box-shadow:0 1px 2px rgba(0,0,0,.06), 0 0 0 1px var(--border-color); }
.gx-live { position:absolute; top:6px; right:5px; width:7px; height:7px; border-radius:50%; background:#EF4444; box-shadow:0 0 0 0 rgba(239,68,68,.5); animation:gxPulse 1.6s infinite; }
@keyframes gxPulse { 70% { box-shadow:0 0 0 7px rgba(239,68,68,0); } 100% { box-shadow:0 0 0 0 rgba(239,68,68,0); } }
.gx-goal { margin-left:auto; display:inline-flex; align-items:center; gap:9px; height:38px; padding:0 14px 0 8px; border-radius:99px; border:1px solid var(--border-color); background:var(--surface-1); font-size:13px; color:var(--text-2); cursor:pointer; }
.gx-goal b { color:var(--text-1); }
.gx-goal-ring { width:24px; height:24px; border-radius:50%; background:conic-gradient(var(--primary) calc(var(--p) * 1%), var(--surface-2) 0); position:relative; }
.gx-goal-ring::after { content:''; position:absolute; inset:4px; border-radius:50%; background:var(--surface-1); }

/* buttons */
.gx-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:38px; padding:0 15px; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); font-size:13.5px; font-weight:650; cursor:pointer; white-space:nowrap; transition:filter .15s, background .15s, border-color .15s, transform .1s; }
.gx-btn:hover { border-color:var(--text-3); }
.gx-btn:active { transform:scale(.98); }
.gx-btn.primary { background:var(--primary); border-color:var(--primary); color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.1); }
.gx-btn.primary:hover { filter:brightness(.94); }
.gx-btn.ghost { background:transparent; border-color:transparent; color:var(--text-2); }
.gx-btn.ghost:hover { background:var(--surface-2); color:var(--text-1); }
.gx-btn.danger { color:#DC2626; }
.gx-btn.danger:hover { border-color:rgba(220,38,38,.4); background:rgba(220,38,38,.05); }
.gx-btn.big { height:52px; padding:0 26px; font-size:16px; border-radius:14px; }
.gx-iconbtn { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid transparent; background:transparent; color:var(--text-2); cursor:pointer; flex:none; }
.gx-iconbtn:hover:not(:disabled) { background:var(--surface-2); color:var(--text-1); }
.gx-iconbtn:disabled { opacity:.3; cursor:default; }
.gx-iconbtn.sm { width:30px; height:30px; border-radius:8px; }
.gx-iconbtn.sm .gx-i { width:15px; height:15px; }
.gx-iconbtn.danger:hover { color:#DC2626; background:rgba(220,38,38,.07); }
.gx-iconbtn.lg { width:56px; height:56px; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; }
.gx-iconbtn.lg .gx-i { width:22px; height:22px; }
.gx-iconbtn.xl, .gx-follow .gx-iconbtn.xl, .gx-follow .gx-iconbtn.xl:hover { width:78px; height:78px; border-radius:50%; background:#fff; color:#0F172A; }
.gx-iconbtn.xl .gx-i { width:30px; height:30px; }
.gx-link { display:inline-flex; align-items:center; gap:5px; border:none; background:none; color:var(--primary); font-size:13px; font-weight:650; cursor:pointer; padding:4px 2px; }
.gx-link .gx-i { width:14px; height:14px; }
.gx-row { display:flex; gap:8px; flex-wrap:wrap; }
.gx-h { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:22px 0 10px; }
.gx-h h3 { margin:0; font-size:12px; font-weight:750; letter-spacing:.07em; text-transform:uppercase; color:var(--text-3); }
.gx-h.big { margin:4px 0 18px; align-items:flex-end; flex-wrap:wrap; }
.gx-h.big h2 { margin:0; font-size:24px; font-weight:780; letter-spacing:-.5px; }
.gx-h.big p { margin:4px 0 0; color:var(--text-3); font-size:13.5px; }
.gx-chips { display:flex; flex-wrap:wrap; gap:5px; }
.gx-chip { font-size:11.5px; font-weight:650; padding:3px 9px; border-radius:99px; color:var(--c); background:color-mix(in srgb, var(--c) 12%, transparent); }
.gx-tag { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:3px 8px; border-radius:99px; color:#B45309; background:rgba(245,158,11,.14); }
.gx-tag .gx-i { width:12px; height:12px; }
.gx-eyebrow { font-size:11.5px; font-weight:750; letter-spacing:.07em; text-transform:uppercase; color:var(--text-3); margin-bottom:8px; }

/* today */
.gx-hero { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr); gap:14px; }
.gx-hero-main { min-width:0; }
.gx-hero-alt { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
.gx-pcard { position:relative; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:14px 16px; cursor:pointer; transition:transform .15s, box-shadow .15s, border-color .15s; box-shadow:var(--shadow-card, 0 1px 3px rgba(0,0,0,.04)); }
.gx-pcard:hover { transform:translateY(-2px); box-shadow:var(--shadow-md, 0 8px 20px rgba(0,0,0,.08)); border-color:color-mix(in srgb, var(--primary) 35%, var(--border-color)); }
.gx-pcard-top { display:flex; align-items:center; gap:8px; justify-content:space-between; padding-right:40px; }
.gx-pcard-name { font-size:15px; font-weight:720; letter-spacing:-.2px; }
.gx-pcard-meta { font-size:12.5px; color:var(--text-3); margin:4px 0 10px; }
.gx-pcard-go { position:absolute; top:12px; right:12px; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--primary) 12%, transparent); color:var(--primary); }
.gx-pcard-go .gx-i { width:13px; height:13px; }
.gx-pcard.big { padding:22px 22px 20px; background:linear-gradient(135deg, color-mix(in srgb, var(--primary) 9%, var(--surface-1)), var(--surface-1) 60%); border-color:color-mix(in srgb, var(--primary) 25%, var(--border-color)); }
.gx-pcard.big .gx-pcard-name { font-size:24px; font-weight:800; letter-spacing:-.6px; }
.gx-pcard.big .gx-pcard-meta { font-size:13.5px; margin:6px 0 14px; }
.gx-pcard.big .gx-pcard-top { padding-right:0; }
.gx-pcard.big .gx-pcard-go { position:static; width:auto; height:44px; padding:0 20px; margin-top:16px; border-radius:12px; background:var(--primary); color:#fff; display:inline-flex; gap:8px; font-weight:700; font-size:14.5px; box-shadow:0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent); }
.gx-first { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:22px; }
.gx-first h2 { margin:0 0 6px; font-size:22px; font-weight:800; letter-spacing:-.5px; }
.gx-first p { margin:0 0 6px; color:var(--text-2); font-size:14px; line-height:1.55; max-width:520px; }
.gx-stats { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; align-content:start; margin-top:26px; }
.gx-stat { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; padding:12px 14px; display:grid; grid-template-columns:auto 1fr; grid-template-rows:auto auto; column-gap:10px; align-items:center; }
.gx-stat-ic { grid-row:1 / span 2; width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--c); background:color-mix(in srgb, var(--c) 13%, transparent); }
.gx-stat b { font-size:20px; font-weight:780; letter-spacing:-.4px; font-variant-numeric:tabular-nums; }
.gx-stat b small { font-size:12px; font-weight:600; color:var(--text-3); }
.gx-stat em { font-style:normal; font-size:11.5px; color:var(--text-3); font-weight:600; }
.gx-week { display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; margin:16px 0 4px; }
.gx-wday { display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 4px; border-radius:12px; border:1px solid var(--border-color); background:var(--surface-1); cursor:pointer; min-width:0; }
.gx-wday:disabled { cursor:default; }
.gx-wday em { font-style:normal; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; }
.gx-wday > span { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:var(--text-2); background:var(--surface-2); }
.gx-wday small { font-size:10.5px; color:var(--text-3); height:13px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:100%; }
.gx-wday.done > span { background:var(--primary); color:#fff; }
.gx-wday.done > span .gx-i { width:16px; height:16px; }
.gx-wday.today { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.gx-wday.today em { color:var(--primary); }
.gx-wday.future { opacity:.55; }
.gx-cols { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr); gap:20px; }
.gx-pgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
.gx-list { display:flex; flex-direction:column; gap:6px; }
.gx-srow { display:flex; align-items:center; gap:12px; width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--border-color); background:var(--surface-1); text-align:left; cursor:pointer; }
.gx-srow:hover { border-color:var(--text-3); }
.gx-srow-date { width:40px; display:flex; flex-direction:column; align-items:center; line-height:1.1; }
.gx-srow-date b { font-size:17px; font-weight:780; }
.gx-srow-date em { font-style:normal; font-size:10.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; }
.gx-srow-main { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-srow-main b { font-size:14px; font-weight:680; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-srow-main em { font-style:normal; font-size:12px; color:var(--text-3); }
.gx-srow-chev { transform:rotate(-90deg); color:var(--text-3); }

/* summary */
.gx-summary { position:relative; text-align:center; padding:26px 22px 22px; margin-bottom:18px; border-radius:16px; border:1px solid color-mix(in srgb, #10B981 30%, var(--border-color)); background:linear-gradient(180deg, rgba(16,185,129,.08), var(--surface-1)); }
.gx-summary h2 { margin:10px 0 2px; font-size:22px; font-weight:800; }
.gx-summary p { margin:0 0 16px; color:var(--text-3); font-size:13.5px; }
.gx-summary .gx-x, .gx-x { position:absolute; top:10px; right:10px; width:32px; height:32px; border:none; background:transparent; color:var(--text-3); border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.gx-summary-badge { width:54px; height:54px; margin:0 auto; border-radius:50%; background:#10B981; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(16,185,129,.35); }
.gx-summary-badge .gx-i { width:26px; height:26px; }
.gx-summary-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(100px,1fr)); gap:8px; }
.gx-summary-stats > div { background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; padding:10px; }
.gx-summary-stats b { display:block; font-size:18px; font-weight:780; }
.gx-summary-stats em { font-style:normal; font-size:11.5px; color:var(--text-3); font-weight:600; }
.gx-prs { margin-top:12px; display:flex; flex-direction:column; gap:6px; text-align:left; }
.gx-prs > div { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px; background:rgba(245,158,11,.1); color:#92400E; font-size:13.5px; font-weight:600; }

/* live workout */
.gx-live-bar { position:sticky; top:0; z-index:5; display:grid; grid-template-columns:1fr auto; gap:6px 12px; align-items:center; padding:12px 16px 10px; margin:0 -4px 14px; background:color-mix(in srgb, var(--surface-1) 92%, transparent); backdrop-filter:blur(10px); border:1px solid var(--border-color); border-radius:14px; box-shadow:0 6px 20px rgba(15,23,42,.06); }
.gx-live-title { display:flex; flex-direction:column; min-width:0; }
.gx-live-title b { font-size:18px; font-weight:780; letter-spacing:-.3px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-live-title em { font-style:normal; font-size:12.5px; color:var(--text-3); font-variant-numeric:tabular-nums; }
.gx-live-actions { display:flex; gap:6px; align-items:center; }
.gx-live-prog { grid-column:1 / -1; height:6px; border-radius:99px; background:var(--surface-2); overflow:hidden; }
.gx-live-prog i { display:block; height:100%; background:linear-gradient(90deg, var(--primary), #10B981); border-radius:inherit; transition:width .4s; }
.gx-live-meta { grid-column:1 / -1; display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:var(--text-3); }
.gx-exlist { display:flex; flex-direction:column; gap:10px; }
.gx-ex { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; overflow:hidden; transition:border-color .2s, box-shadow .2s; }
.gx-ex.current { border-color:color-mix(in srgb, var(--c) 55%, var(--border-color)); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 12%, transparent); }
.gx-ex-head { display:flex; align-items:center; gap:12px; padding:12px 12px 12px 14px; cursor:pointer; }
.gx-ex-num { width:30px; height:30px; border-radius:9px; flex:none; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:780; color:var(--c); background:color-mix(in srgb, var(--c) 13%, transparent); }
.gx-ex.complete .gx-ex-num { background:#10B981; color:#fff; }
.gx-ex-num .gx-i { width:15px; height:15px; }
.gx-ex-title { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-ex-title b { font-size:15px; font-weight:700; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-ex-title em { font-style:normal; font-size:12px; color:var(--text-3); }
.gx-ex.complete .gx-ex-title b { color:var(--text-2); }
.gx-ex-tools { display:flex; gap:2px; opacity:0; transition:opacity .15s; }
.gx-ex:hover .gx-ex-tools, .gx-ex.open .gx-ex-tools { opacity:1; }
@media (hover:none) { .gx-ex-tools { opacity:1; } }
.gx-ex-body { display:none; padding:0 14px 12px; }
.gx-ex.open .gx-ex-body { display:block; }
.gx-ex-hint, .gx-ex-note { display:flex; gap:7px; align-items:flex-start; font-size:12.5px; color:var(--text-2); background:var(--surface-2); border-radius:9px; padding:7px 10px; margin-bottom:8px; line-height:1.45; }
.gx-ex-hint .gx-i, .gx-ex-note .gx-i { width:14px; height:14px; margin-top:2px; color:var(--text-3); }
.gx-ex-hint b { color:var(--primary); font-weight:650; }
.gx-ex-hint.muted { color:var(--text-3); }
.gx-ex-note { background:rgba(245,158,11,.1); }
.gx-sets { max-width:680px; }
.gx-sets-head, .gx-set { display:grid; grid-template-columns:34px minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) 44px; gap:8px; align-items:center; }
.gx-sets-head { font-size:11px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; color:var(--text-3); padding:2px 0 6px; }
.gx-sets-head span:nth-child(n+2) { text-align:center; }
.gx-set { padding:5px 0; border-radius:10px; transition:background .15s; }
.gx-set.done { background:rgba(16,185,129,.08); }
.gx-set-n { text-align:center; font-size:13px; font-weight:750; color:var(--text-3); }
.gx-set-prev { height:36px; border:none; background:transparent; border-radius:8px; color:var(--text-3); font-size:13px; font-weight:600; cursor:pointer; font-variant-numeric:tabular-nums; }
.gx-set-prev:not(:disabled):hover { background:var(--surface-2); color:var(--text-1); }
.gx-set-prev:disabled { cursor:default; }
.gx .gx-in { width:100% !important; height:40px !important; margin:0 !important; padding:0 6px !important; border-radius:9px !important; border:1px solid var(--border-color) !important; background:var(--surface-2) !important; text-align:center; font-size:16px !important; font-weight:700; color:var(--text-1) !important; font-variant-numeric:tabular-nums; -moz-appearance:textfield; box-shadow:none !important; }
.gx .gx-in::-webkit-inner-spin-button, .gx .gx-in::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
.gx .gx-in:focus { outline:none; border-color:var(--primary) !important; background:var(--surface-1) !important; box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent) !important; }
.gx .gx-in::placeholder { color:var(--text-3); opacity:.6; font-weight:600; }
.gx-set.done .gx-in { background:transparent !important; border-color:transparent !important; }
.gx-set-timer { height:40px; border-radius:9px; border:1px solid color-mix(in srgb, var(--primary) 35%, transparent); background:color-mix(in srgb, var(--primary) 9%, transparent); color:var(--primary); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.gx-set-timer .gx-i { width:14px; height:14px; }
.gx-tick { width:44px; height:40px; border-radius:10px; border:1.5px solid var(--border-color); background:var(--surface-1); color:color-mix(in srgb, var(--text-3) 45%, transparent); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
.gx-tick:hover { border-color:#10B981; color:color-mix(in srgb, #10B981 50%, transparent); }
.gx-tick.on { background:#10B981; border-color:#10B981; color:#fff; }
.gx-tick .gx-i { width:18px; height:18px; }
.gx-ex-foot { display:flex; gap:14px; flex-wrap:wrap; padding-top:8px; }
.gx-addex { width:100%; margin-top:10px; height:48px; border-radius:14px; border:1.5px dashed var(--border-color); background:transparent; color:var(--text-2); font-size:14px; font-weight:650; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; }
.gx-addex:hover { border-color:var(--primary); color:var(--primary); }

/* rest bar */
.gx-restbar { position:fixed; left:50%; bottom:calc(18px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); z-index:9000; width:min(560px, calc(100vw - 24px)); display:flex; align-items:center; gap:12px; padding:10px 10px 10px 18px; border-radius:16px; overflow:hidden; color:#fff; background:#0F172A; box-shadow:0 18px 40px rgba(15,23,42,.35); animation:gxUp .25s ease-out; }
@keyframes gxUp { from { transform:translate(-50%, 20px); opacity:0; } }
.gx-restbar.work { background:#1E1B4B; }
.gx-rb-fill { position:absolute; inset:0 auto 0 0; background:rgba(255,255,255,.09); transition:width .25s linear; pointer-events:none; }
.gx-rb-main { position:relative; flex:1; min-width:0; display:flex; align-items:baseline; gap:10px; }
.gx-rb-main em { font-style:normal; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#A5B4FC; }
.gx-restbar.rest .gx-rb-main em { color:#6EE7B7; }
.gx-rb-main b { font-size:26px; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-.5px; }
.gx-rb-main span { font-size:12.5px; color:rgba(255,255,255,.7); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-rb-btns { position:relative; display:flex; gap:6px; }
.gx-rb-btns button { height:38px; min-width:46px; padding:0 12px; border-radius:10px; border:none; background:rgba(255,255,255,.12); color:#fff; font-weight:700; font-size:13px; cursor:pointer; }
.gx-rb-btns button.go { background:#fff; color:#0F172A; }

/* follow along */
.gx-follow { position:fixed; inset:0; z-index:10000; display:flex; flex-direction:column; color:#fff; background:radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--fc) 45%, #0B1020), #0B1020 70%); padding:calc(env(safe-area-inset-top,0px) + 12px) 18px calc(env(safe-area-inset-bottom,0px) + 22px); transition:background .4s; }
.gx-follow .gx-iconbtn { color:#fff; }
.gx-follow .gx-iconbtn:hover { background:rgba(255,255,255,.12); color:#fff; }
.gx-f-top { display:flex; align-items:center; justify-content:space-between; }
.gx-f-count { font-weight:750; font-size:14px; opacity:.85; font-variant-numeric:tabular-nums; }
.gx-f-prog { height:4px; border-radius:99px; background:rgba(255,255,255,.15); margin:10px 0 0; overflow:hidden; }
.gx-f-prog i { display:block; height:100%; background:#fff; transition:width .3s; }
.gx-f-mid { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; }
.gx-f-phase { font-size:13px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--fc); filter:brightness(1.4); }
.gx-f-name { font-size:clamp(26px, 5vw, 46px); font-weight:800; letter-spacing:-1px; line-height:1.1; max-width:900px; }
.gx-f-sub { font-size:14px; opacity:.7; }
.gx-f-ring { position:relative; width:min(62vw, 300px); aspect-ratio:1; margin:18px 0 8px; }
.gx-f-ring svg { width:100%; height:100%; transform:rotate(-90deg); }
.gx-f-ring circle { fill:none; stroke-width:12; }
.gx-f-ring .bg { stroke:rgba(255,255,255,.12); }
.gx-f-ring .fg { stroke:var(--fc); stroke-linecap:round; transition:stroke-dashoffset .2s linear; filter:brightness(1.25); }
.gx-f-time { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:clamp(56px, 11vw, 92px); font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-2px; }
.gx-f-time small { font-size:.35em; opacity:.7; margin-left:4px; }
.gx-f-time span { font-size:18px; font-weight:700; opacity:.8; letter-spacing:0; }
.gx-f-next { font-size:15px; opacity:.75; margin-top:6px; }
.gx-f-ctrl { display:flex; align-items:center; justify-content:center; gap:26px; }
.gx-f-done { margin:auto; text-align:center; }
.gx-f-done h2 { font-size:34px; margin:14px 0 4px; }
.gx-f-done p { opacity:.75; margin:0 0 20px; }
.gx-f-row { display:flex; gap:10px; justify-content:center; }

/* overlays / sheets */
.gx-overlay { position:fixed; inset:0; z-index:9500; background:rgba(15,23,42,.45); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; padding:24px; animation:gxFade .15s; }
@keyframes gxFade { from { opacity:0; } }
.gx-sheet-box { width:min(760px, 100%); max-height:calc(100vh - 48px); display:flex; flex-direction:column; background:var(--surface-1); color:var(--text-1); border-radius:18px; overflow:hidden; box-shadow:0 30px 80px rgba(15,23,42,.3); }
.gx-sheet-box.gx-builder { width:min(1180px, 100%); height:min(880px, calc(100vh - 48px)); }
.gx-b-bar { flex:none; display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--border-color); }
.gx-b-bar > b { flex:1; font-size:16px; }
.gx-b-name { flex:1; min-width:0; border:none !important; outline:none; background:transparent !important; box-shadow:none !important; font-size:20px !important; font-weight:780; letter-spacing:-.4px; color:var(--text-1); padding:4px 0 !important; height:auto !important; }
.gx-b-meta { font-size:12.5px; color:var(--text-3); white-space:nowrap; }
.gx-b-body { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 340px; }
.gx-b-list { min-height:0; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; background:var(--surface-base, #F7F8FA); }
.gx-b-pick { min-height:0; border-left:1px solid var(--border-color); display:flex; flex-direction:column; }
.gx-b-ex { background:var(--surface-1); border:1px solid var(--border-color); border-left:3px solid var(--c); border-radius:12px; padding:10px 12px; }
.gx-b-ex-top { display:flex; align-items:center; gap:8px; }
.gx-b-idx { width:24px; height:24px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:780; color:var(--c); background:color-mix(in srgb, var(--c) 13%, transparent); flex:none; }
.gx-b-ex-name { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-b-ex-name b { font-size:14px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-b-ex-name em { font-style:normal; font-size:11.5px; color:var(--text-3); }
.gx-seg { display:inline-flex; padding:2px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border-color); }
.gx-seg button { border:none; background:transparent; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:650; color:var(--text-3); cursor:pointer; }
.gx-seg button.on { background:var(--surface-1); color:var(--text-1); box-shadow:0 1px 2px rgba(0,0,0,.08); }
.gx-b-fields { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; padding-left:32px; }
.gx-b-fields label { display:flex; flex-direction:column; gap:4px; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--text-3); }
.gx-b-fields label.grow { flex:1; min-width:160px; }
.gx-b-fields input { height:34px !important; width:84px; padding:0 8px !important; border-radius:8px !important; border:1px solid var(--border-color) !important; background:var(--surface-2) !important; font-size:14px !important; font-weight:650; color:var(--text-1) !important; text-transform:none; letter-spacing:0; box-shadow:none !important; margin:0 !important; }
.gx-b-fields label.grow input { width:100%; font-weight:500; }
.gx-b-fields input:focus { outline:none; border-color:var(--primary) !important; background:var(--surface-1) !important; }
.gx-step { display:inline-flex; align-items:center; height:34px; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-2); }
.gx-step button { width:30px; height:32px; border:none; background:transparent; color:var(--text-2); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.gx-step button .gx-i { width:13px; height:13px; }
.gx-step b { min-width:22px; text-align:center; font-size:14px; color:var(--text-1); letter-spacing:0; }
.gx-pick { flex:1; min-height:0; display:flex; flex-direction:column; padding:12px; gap:10px; }
.gx-pick-search { display:flex; align-items:center; gap:8px; height:40px; padding:0 12px; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-1); }
.gx-pick-search:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.gx-pick-search .gx-i { color:var(--text-3); width:15px; height:15px; }
.gx-pick-search input { flex:1; min-width:0; border:none !important; outline:none; background:transparent !important; box-shadow:none !important; padding:0 !important; height:auto !important; font-size:14px !important; color:var(--text-1); margin:0 !important; }
.gx-pick-chips { display:flex; flex-wrap:wrap; gap:5px; }
.gx-pick-chips button { height:26px; padding:0 10px; border-radius:99px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-2); font-size:12px; font-weight:600; cursor:pointer; }
.gx-pick-chips button.on { border-color:var(--c); color:var(--c); background:color-mix(in srgb, var(--c) 10%, var(--surface-1)); }
.gx-pick-list { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:2px; margin:0 -4px; }
.gx-pick-it { display:flex; align-items:center; gap:10px; width:100%; padding:8px; border:none; background:transparent; border-radius:9px; text-align:left; cursor:pointer; color:var(--text-1); }
.gx-pick-it:hover { background:var(--surface-2); }
.gx-pick-it > i { width:8px; height:8px; border-radius:50%; background:var(--c); flex:none; }
.gx-pick-it > span:not(.gx-i) { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-pick-it b { font-size:13.5px; font-weight:650; }
.gx-pick-it em { font-style:normal; font-size:11.5px; color:var(--text-3); }
.gx-pick-it > .gx-i { color:var(--text-3); width:15px; height:15px; }
.gx-pick-it.new { background:color-mix(in srgb, var(--primary) 7%, transparent); color:var(--primary); }
.gx-pick-it.new > .gx-i:first-child { color:var(--primary); }
.gx-pick-sheet { height:min(720px, calc(100vh - 48px)); width:min(520px, 100%); }
.gx-import-body { padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }
.gx-import-body p { margin:0; font-size:13.5px; color:var(--text-2); line-height:1.55; }
.gx-import-body textarea { width:100%; min-height:280px; resize:vertical; border-radius:12px !important; border:1px solid var(--border-color) !important; background:var(--surface-2) !important; padding:12px !important; font:13px/1.55 ui-monospace, Menlo, monospace !important; color:var(--text-1) !important; }
.gx-import-prev { font-size:13px; color:var(--text-2); display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px; background:var(--surface-2); }
.gx-import-foot { flex:none; display:flex; gap:8px; justify-content:flex-end; padding:12px 14px; border-top:1px solid var(--border-color); }
.gx-sess-t { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-sess-t b { font-size:17px; font-weight:750; }
.gx-sess-t em { font-style:normal; font-size:12.5px; color:var(--text-3); }
.gx-sess-body { flex:1; min-height:0; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
.gx-sess-ex { border:1px solid var(--border-color); border-radius:12px; padding:10px 12px; }
.gx-sess-ex-h { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.gx-sess-ex-h i { width:8px; height:8px; border-radius:50%; background:var(--c); }
.gx-sess-ex-h b { font-size:14px; }
.gx-sess-ex-h em { font-style:normal; font-size:12px; color:var(--text-3); }
.gx-sess-sets { display:flex; flex-wrap:wrap; gap:6px; }
.gx-sess-sets span { font-size:12.5px; font-weight:600; padding:4px 9px; border-radius:7px; background:var(--surface-2); font-variant-numeric:tabular-nums; }
.gx-sess-sets span.skip { opacity:.45; text-decoration:line-through; }

/* plans tab */
.gx-plans { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }
.gx-plan { display:flex; flex-direction:column; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:16px; position:relative; overflow:hidden; box-shadow:var(--shadow-card, 0 1px 3px rgba(0,0,0,.04)); }
.gx-plan::before { content:''; position:absolute; inset:0 0 auto 0; height:3px; background:var(--c); }
.gx-plan-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.gx-plan-head b { font-size:16.5px; font-weight:750; letter-spacing:-.2px; }
.gx-plan-meta { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:12px; color:var(--text-3); margin:6px 0 10px; }
.gx-plan-list { list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:5px; flex:1; }
.gx-plan-list li { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-2); }
.gx-plan-list li i { width:6px; height:6px; border-radius:50%; background:var(--c); flex:none; }
.gx-plan-list li em { margin-left:auto; font-style:normal; font-size:12px; color:var(--text-3); white-space:nowrap; font-variant-numeric:tabular-nums; }
.gx-plan-list li.more { color:var(--text-3); padding-left:14px; }
.gx-plan-actions { display:flex; gap:6px; align-items:center; }
.gx-plan-actions .gx-btn.primary { flex:1; }

/* history */
.gx-hist { display:grid; grid-template-columns:360px minmax(0,1fr); gap:20px; align-items:start; }
.gx-cal { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:14px; position:sticky; top:8px; }
.gx-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.gx-cal-head b { font-size:15px; }
.gx-cal-wd, .gx-cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; }
.gx-cal-wd span { text-align:center; font-size:11px; font-weight:700; color:var(--text-3); padding:4px 0; }
.gx-cal-d { position:relative; aspect-ratio:1; border:none; border-radius:9px; background:var(--surface-2); font-size:12.5px; font-weight:650; color:var(--text-3); cursor:default; }
.gx-cal-d.pad { background:transparent; }
.gx-cal-d.on { background:color-mix(in srgb, var(--primary) 14%, var(--surface-1)); color:var(--text-1); cursor:pointer; }
.gx-cal-d.on:hover { background:color-mix(in srgb, var(--primary) 24%, var(--surface-1)); }
.gx-cal-d.on i { position:absolute; left:50%; bottom:5px; width:5px; height:5px; margin-left:-2.5px; border-radius:50%; background:var(--c); }
.gx-cal-d.today { box-shadow:inset 0 0 0 2px var(--primary); }
.gx-cal-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:12px; }
.gx-cal-stats div { text-align:center; padding:8px 4px; border-radius:10px; background:var(--surface-2); }
.gx-cal-stats b { display:block; font-size:15px; }
.gx-cal-stats em { font-style:normal; font-size:11px; color:var(--text-3); }
.gx-hist-list .gx-h { margin-top:0; }

/* exercises tab */
.gx-ex-tools-row { display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.gx-ex-tools-row .gx-pick-search { max-width:420px; }
.gx-exgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:8px; }
.gx-exrow { display:flex; align-items:center; gap:12px; padding:11px 14px; border-radius:12px; border:1px solid var(--border-color); background:var(--surface-1); text-align:left; cursor:pointer; color:var(--text-1); }
.gx-exrow:hover { border-color:color-mix(in srgb, var(--c) 50%, var(--border-color)); }
.gx-exrow > i { width:9px; height:9px; border-radius:50%; background:var(--c); flex:none; }
.gx-exrow-main { flex:1; min-width:0; display:flex; flex-direction:column; }
.gx-exrow-main b { font-size:14px; font-weight:650; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gx-exrow-main em, .gx-exrow-st em { font-style:normal; font-size:11.5px; color:var(--text-3); }
.gx-exrow-st { display:flex; flex-direction:column; align-items:flex-end; text-align:right; }
.gx-exrow-st b { font-size:13px; color:var(--text-1); }
.gx-exrow.never { opacity:.7; }
.gx-chart { width:100%; height:180px; }
.gx-chart .line { fill:none; stroke:var(--c, var(--primary)); stroke-width:2.5; vector-effect:non-scaling-stroke; }
.gx-chart .area { fill:color-mix(in srgb, var(--c, var(--primary)) 12%, transparent); }
.gx-chart circle { fill:var(--surface-1); stroke:var(--c, var(--primary)); stroke-width:2; }
.gx-chart text { font-size:11px; fill:var(--text-3); }
.gx-hrow { display:flex; gap:14px; padding:8px 10px; border-radius:9px; background:var(--surface-2); font-size:13px; }
.gx-hrow b { width:64px; flex:none; }
.gx-hrow span { color:var(--text-2); font-variant-numeric:tabular-nums; }

/* responsive */
@media (max-width:980px) {
  .gx-hero, .gx-cols, .gx-hist { grid-template-columns:1fr; }
  .gx-stats { margin-top:0; grid-template-columns:repeat(4, minmax(0,1fr)); }
  .gx-cal { position:static; }
  .gx-b-body { grid-template-columns:1fr; grid-template-rows:minmax(0,1.3fr) minmax(220px,1fr); }
  .gx-b-pick { border-left:none; border-top:1px solid var(--border-color); }
}
@media (max-width:640px) {
  .gx { padding:0 12px 120px; }
  .gx-goal { margin-left:0; }
  .gx-stats { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .gx-week { gap:4px; }
  .gx-wday { padding:8px 2px; } .gx-wday small { display:none; } .gx-wday > span { width:30px; height:30px; }
  .gx-live-bar { grid-template-columns:1fr; }
  .gx-live-actions .gx-btn:not(.primary) { padding:0 10px; }
  .gx-sets-head, .gx-set { grid-template-columns:26px minmax(54px,1fr) minmax(60px,1fr) minmax(60px,1fr) 42px; gap:6px; }
  .gx-overlay { padding:0; align-items:stretch; }
  .gx-sheet-box, .gx-sheet-box.gx-builder, .gx-pick-sheet { width:100%; height:100%; max-height:none; border-radius:0; }
  .gx-b-meta { display:none; }
  .gx-b-fields { padding-left:0; }
  .gx-b-ex-top { flex-wrap:wrap; }
  .gx-b-ex-name { flex:1 1 calc(100% - 34px); }
  .gx-b-ex-top .gx-seg { margin-right:auto; }
  .gx-pcard.big .gx-pcard-name { font-size:21px; }
}
`;
function gxInjectCss() {
  let st = document.getElementById('gxStyles');
  if (!st) { st = document.createElement('style'); st.id = 'gxStyles'; document.head.appendChild(st); }
  if (st.textContent !== GX_CSS) st.textContent = GX_CSS;
}
window.renderGym = renderGym;
