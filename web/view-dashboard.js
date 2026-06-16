/* view-dashboard.js */

// Default dashboard section config
const DEFAULT_DASH_CONFIG = [
  { id: 'morning', label: 'Morning Greeting', visible: true },
  { id: 'theNow', label: 'The Now Focus', visible: true },
  { id: 'aiBriefing', label: 'Daily Briefing', visible: true },
  { id: 'vision', label: 'Vision Banner', visible: true },
  { id: 'kpis', label: 'KPI Cards', visible: true },
  { id: 'budget', label: 'Budget Alert', visible: true },
  { id: 'pinnedNotes', label: 'Pinned Notes', visible: true },
  { id: 'yearProgress', label: 'Year/Life Progress', visible: true },
  { id: 'tasks', label: 'High Priority Tasks', visible: true },
  { id: 'habits', label: 'Habit Tracker', visible: true },
  { id: 'habitsGrid', label: 'Habits Grid (7-day)', visible: true },
  { id: 'tasksList', label: 'Tasks List', visible: true },
  { id: 'dailyAffirmation', label: 'Daily Affirmation', visible: true },
  { id: 'dailyTools', label: 'Daily Tools', visible: true }
];

// Default KPI visibility config
const DEFAULT_KPI_CONFIG = [
  { id: 'netWorth', label: 'Net Worth', visible: true, category: 'financial' },
  { id: 'monthSpend', label: 'Month Spend', visible: true, category: 'financial' },
  { id: 'tasksDone', label: 'Tasks Done', visible: true, category: 'productivity' },
  { id: 'monthlyBurnRate', label: 'Burn Rate', visible: true, category: 'financial' },
  { id: 'incomeExpenseRatio', label: 'Income/Spend', visible: true, category: 'financial' },
  { id: 'investmentReturns', label: 'Inv. Returns', visible: true, category: 'financial' },
  { id: 'ytdSpending', label: 'YTD Spend', visible: true, category: 'financial' },
  { id: 'taskVelocity', label: 'Task Velocity', visible: true, category: 'productivity' },
  { id: 'priorityDist', label: 'Priority Mix', visible: true, category: 'productivity' },
  { id: 'habitConsistency', label: 'Habit Score', visible: true, category: 'habits' },
  { id: 'bestHabit', label: 'Best Habit', visible: true, category: 'habits' },
  { id: 'strugglingHabits', label: 'Struggling', visible: true, category: 'habits' },
  { id: 'habitDiversity', label: 'Habits Active', visible: true, category: 'habits' },
  { id: 'weeklyPattern', label: 'Best Day', visible: true, category: 'habits' },
  { id: 'networkGrowth', label: 'New Contacts', visible: true, category: 'lifestyle' },
  { id: 'interactionFreq', label: 'Contact Freq', visible: true, category: 'lifestyle' },
  { id: 'notesVolume', label: 'Notes', visible: true, category: 'lifestyle' },
  { id: 'projectedBalance', label: 'Proj. Balance', visible: true, category: 'predictive' },
  { id: 'goalRisk', label: 'Goal Risk', visible: true, category: 'predictive' }
];

function getKpiConfig() {
  const settings = state.data.settings?.[0];
  if (settings && settings.kpi_config) {
    try {
      let parsed = settings.kpi_config;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) { parsed = null; }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const savedIds = parsed.map(s => s.id);
        const merged = [...parsed];
        DEFAULT_KPI_CONFIG.forEach(d => {
          if (!savedIds.includes(d.id)) merged.push({ ...d });
        });
        return merged;
      }
    } catch (e) { console.log('Invalid kpi_config:', e); }
  }
  return DEFAULT_KPI_CONFIG.map(s => ({ ...s }));
}

async function saveKpiConfig(config) {
  const settings = state.data.settings?.[0] || {};
  const cleanConfig = config.map(s => ({
    id: s.id,
    label: s.label,
    visible: s.visible,
    category: s.category
  }));
  const configStr = JSON.stringify(cleanConfig);

  try {
    const local = JSON.parse(localStorage.getItem('localSettingsOverride') || '{}');
    local.kpi_config = configStr;
    localStorage.setItem('localSettingsOverride', JSON.stringify(local));
  } catch (e) { console.error('Local save failed', e); }

  if (state.data.settings && state.data.settings[0]) {
    state.data.settings[0].kpi_config = configStr;
  }

  try {
    if (settings.id) {
      await apiCall('update', 'settings', { kpi_config: configStr }, settings.id);
    } else {
      await apiCall('create', 'settings', { kpi_config: configStr });
    }
  } catch (e) { console.error('API save failed', e); }
}

// Persistent Widget States (Collapsed/Expanded)
window.dashWidgetStates = window.dashWidgetStates || {};

function getDashConfig() {
  const settings = state.data.settings?.[0];
  if (settings && settings.dashboard_config) {
    try {
      // Handle case where it might be already parsed or double-stringified
      let parsed = settings.dashboard_config;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          console.warn("Failed to parse dashboard_config string", e);
          parsed = null;
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge: keep saved order/visibility but ensure all sections exist
        const savedIds = parsed.map(s => s.id);
        const merged = [...parsed];
        DEFAULT_DASH_CONFIG.forEach(d => {
          if (!savedIds.includes(d.id)) merged.push({ ...d });
        });
        // Sanity check: Ensure each item has an ID and Label, filter out 'today' widget
        return merged.filter(i => i && i.id && i.id !== 'today');
      }
    } catch (e) { console.log('Invalid dashboard_config processing:', e); }
  }
  return DEFAULT_DASH_CONFIG.map(s => ({ ...s }));
}

async function saveDashConfig(config) {
  const settings = state.data.settings?.[0] || {};

  // Sanitize config to remove any DOM nodes or circular refs potentially added by libs
  const cleanConfig = config.map(s => ({
    id: s.id,
    label: s.label,
    visible: s.visible
  }));

  const configStr = JSON.stringify(cleanConfig);

  // 1. Save to Local Storage (Robust Fallback)
  try {
    const local = JSON.parse(localStorage.getItem('localSettingsOverride') || '{}');
    local.dashboard_config = configStr;
    localStorage.setItem('localSettingsOverride', JSON.stringify(local));
  } catch (e) {
    console.error("Local storage save failed", e);
  }

  // 2. Update State
  if (state.data.settings && state.data.settings[0]) {
    state.data.settings[0].dashboard_config = configStr;
  }

  // 3. Sync to Google Sheet
  try {
    if (settings.id) {
      await apiCall('update', 'settings', { dashboard_config: configStr }, settings.id);
    } else {
      await apiCall('create', 'settings', { dashboard_config: configStr });
    }
  } catch (e) {
    // Silent fail on sheet sync is okay, we have local storage
  }
}

// ============================================================================
// BENTO LAYOUT — Option C (config-driven)
// Desktop ≥1024px restructures .dash-grid into a 12-col bento.
// Config is stored in localStorage under 'bentoConfig' and edited via
// openBentoCustomize().
// ============================================================================

const BENTO_DEFAULTS = {
    enabled: true,
    row1: { left: 'morning',     right: 'yearProgress' },
    row3: { left: 'aiBriefing',  right: 'dailyTools'   },
    hero: [
        { stat: 'tasksDone',  label: 'TASKS DONE',  accent: false, route: 'tasks'   },
        { stat: 'monthSpend', label: 'MONTH SPEND', accent: false, route: 'finance' },
        { stat: 'habits',     label: 'HABITS',      accent: false, route: 'habits'  },
        { stat: 'streak',     label: 'STREAK',      accent: true,  route: 'diary'   }
    ]
};

const BENTO_WIDGET_OPTIONS = [
    { id: 'empty',           label: '(empty)' },
    { id: 'morning',         label: 'Morning Greeting' },
    { id: 'yearProgress',    label: 'Year / Life Progress' },
    { id: 'aiBriefing',      label: 'Daily Briefing' },
    { id: 'dailyTools',      label: 'Daily Tools' },
    { id: 'habitsGrid',      label: 'Habits Grid' },
    { id: 'tasksList',       label: 'Tasks List' },
    { id: 'vision',          label: 'Vision Banner' },
    { id: 'theNow',          label: 'The Now Focus' },
    { id: 'today',           label: 'Today' },
    { id: 'cashflow',        label: 'Cashflow Chart' },
    { id: 'dailyAffirmation',label: 'Daily Affirmation' }
];

const BENTO_HERO_STATS = [
    { id: 'tasksDone',    label: 'TASKS DONE',    route: 'tasks'   },
    { id: 'monthSpend',   label: 'MONTH SPEND',   route: 'finance' },
    { id: 'weeklySpend',  label: 'THIS WEEK',     route: 'finance' },
    { id: 'habits',       label: 'HABITS',        route: 'habits'  },
    { id: 'habitScore',   label: 'HABIT SCORE',   route: 'habits'  },
    { id: 'streak',       label: 'STREAK',        route: 'diary'   },
    { id: 'yearProgress', label: 'YEAR PROGRESS', route: 'lifeCalendar' },
    { id: 'netWorth',     label: 'NET WORTH',     route: 'finance' }
];

// ============================================================================
// LUMIA TILE SYSTEM — replaces bento
//   Persistence:  settings.dashboard_tiles (sheet) + localStorage.lumiaTiles
//   Catalog:      LUMIA_TILE_CATALOG below — what's addable
//   Sizes:        small / medium / wide / large
//   Colors:       9 Lumia palette swatches + 'theme' (var(--primary))
// ============================================================================
const LUMIA_COLORS = [
    { id: 'theme',   label: 'Theme',   bg: 'var(--primary, #4F46E5)' },
    { id: 'blue',    label: 'Blue',    bg: '#2563EB' },
    { id: 'purple',  label: 'Purple',  bg: '#7C3AED' },
    { id: 'green',   label: 'Green',   bg: '#059669' },
    { id: 'red',     label: 'Red',     bg: '#DC2626' },
    { id: 'orange',  label: 'Orange',  bg: '#EA580C' },
    { id: 'teal',    label: 'Teal',    bg: '#0D9488' },
    { id: 'magenta', label: 'Magenta', bg: '#BE185D' },
    { id: 'slate',   label: 'Slate',   bg: '#334155' }
];

// Tiles use flexible W×H sizing — up to 8 cols × 8 rows.
// On smaller grids (mobile = 4 cols), CSS Grid naturally caps the span at the
// column count, so picking 1×8 on a 4-col layout still works.
const LUMIA_MAX_W = 8;
const LUMIA_MAX_H = 8;

// Maps legacy preset sizes (from earlier builds) → {w,h} so old saved configs migrate.
const LUMIA_LEGACY_SIZE_MAP = {
    small:  { w: 1, h: 1 },
    medium: { w: 2, h: 2 },
    wide:   { w: 4, h: 2 },
    large:  { w: 4, h: 4 }
};

// Quick-pick swatches (the HTML5 color input handles full-spectrum picking too)
const LUMIA_SWATCHES = [
    '#2563EB', '#3B82F6', '#06B6D4', '#0D9488', '#10B981', '#22C55E',
    '#84CC16', '#EAB308', '#F59E0B', '#EA580C', '#DC2626', '#EF4444',
    '#EC4899', '#BE185D', '#A855F7', '#7C3AED', '#6366F1', '#1E293B',
    '#475569', '#94A3B8'
];

// Catalog — what can be added as a tile (grouped by category).
// minW/minH = minimum size before we fall back to a compact (icon + label + value) render.
const LUMIA_TILE_CATALOG = [
    // Quick Actions (routes) — always fine at 1×1
    { id: 'route-tasks',     kind: 'route', route: 'tasks',     icon: 'priority', label: 'Tasks',     category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-habits',    kind: 'route', route: 'habits',    icon: 'streak',   label: 'Habits',    category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-finance',   kind: 'route', route: 'finance',   icon: 'wallet',   label: 'Finance',   category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-diary',     kind: 'route', route: 'diary',     icon: 'entries',  label: 'Diary',     category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-calendar',  kind: 'route', route: 'calendar',  icon: 'calendar', label: 'Planner',   category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-vision',    kind: 'route', route: 'vision',    icon: 'goals',    label: 'Vision',    category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-notes',     kind: 'route', route: 'notes',     icon: 'entries',  label: 'Notes',     category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-people',    kind: 'route', route: 'people',    icon: 'chat',     label: 'People',    category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-books',     kind: 'route', route: 'books',     icon: 'open',     label: 'Books',     category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-mural',     kind: 'route', route: 'mural',     icon: 'sparkle',  label: 'Mural',     category: 'Quick Actions', minW: 1, minH: 1 },
    { id: 'route-lifeCal',   kind: 'route', route: 'lifeCalendar', icon: 'goals', label: 'Life',     category: 'Quick Actions', minW: 1, minH: 1 },
    // KPI live tiles — minimum 1×1 (compact icon+value), great at 2×2
    { id: 'kpi-tasksDone',   kind: 'kpi', stat: 'tasksDone',   icon: 'priority', label: 'Tasks Done',    category: 'KPIs', route: 'tasks',   minW: 1, minH: 1 },
    { id: 'kpi-monthSpend',  kind: 'kpi', stat: 'monthSpend',  icon: 'wallet',   label: 'Month Spend',   category: 'KPIs', route: 'finance', minW: 1, minH: 1 },
    { id: 'kpi-weeklySpend', kind: 'kpi', stat: 'weeklySpend', icon: 'wallet',   label: 'This Week',     category: 'KPIs', route: 'finance', minW: 1, minH: 1 },
    { id: 'kpi-habits',      kind: 'kpi', stat: 'habits',      icon: 'streak',   label: 'Habits Today',  category: 'KPIs', route: 'habits',  minW: 1, minH: 1 },
    { id: 'kpi-habitScore',  kind: 'kpi', stat: 'habitScore',  icon: 'streak',   label: 'Habit Score',   category: 'KPIs', route: 'habits',  minW: 1, minH: 1 },
    { id: 'kpi-streak',      kind: 'kpi', stat: 'streak',      icon: 'goals',    label: 'Streak',        category: 'KPIs', route: 'diary',   minW: 1, minH: 1 },
    { id: 'kpi-yearProgress',kind: 'kpi', stat: 'yearProgress',icon: 'calendar', label: 'Year Progress', category: 'KPIs', route: 'lifeCalendar', minW: 1, minH: 1 },
    { id: 'kpi-netWorth',    kind: 'kpi', stat: 'netWorth',    icon: 'insights', label: 'Net Worth',     category: 'KPIs', route: 'finance', minW: 1, minH: 1 },
    // Daily tools (in-app routes/actions) — 1×1 fine
    { id: 'tool-focus',      kind: 'route', route: 'pomodoro',     icon: 'focus',   label: 'Focus',    category: 'Daily Tools', minW: 1, minH: 1 },
    { id: 'tool-gym',        kind: 'route', route: 'gym',          icon: 'goals',   label: 'Gym',      category: 'Daily Tools', minW: 1, minH: 1 },
    { id: 'tool-chimes',     kind: 'route', route: 'chimes',       icon: 'bell',    label: 'Chimes',   category: 'Daily Tools', minW: 1, minH: 1 },
    { id: 'tool-tutor',      kind: 'route', route: 'tutor',        icon: 'chat',    label: 'Tutor',    category: 'Daily Tools', minW: 1, minH: 1 },
    { id: 'tool-meditate',   kind: 'route', route: 'meditation',   icon: 'goals',   label: 'Meditate', category: 'Daily Tools', minW: 1, minH: 1 },
    // Widgets — minimum sizes below which we render a compact tile instead.
    { id: 'widget-greeting',     kind: 'widget', widget: 'morning',      icon: 'sunrise',  label: 'Greeting',       category: 'Widgets', minW: 3, minH: 2 },
    { id: 'widget-aiBriefing',   kind: 'widget', widget: 'aiBriefing',   icon: 'sparkle',  label: 'Daily Briefing', category: 'Widgets', minW: 3, minH: 2 },
    { id: 'widget-yearProgress', kind: 'widget', widget: 'yearProgress', icon: 'calendar', label: 'Year Progress',  category: 'Widgets', minW: 2, minH: 2, route: 'lifeCalendar' },
    { id: 'widget-habitsGrid',   kind: 'widget', widget: 'habitsGrid',   icon: 'streak',   label: 'Habits Grid',    category: 'Widgets', minW: 4, minH: 3, route: 'habits' },
    { id: 'widget-tasksList',    kind: 'widget', widget: 'tasksList',    icon: 'priority', label: 'Tasks List',     category: 'Widgets', minW: 3, minH: 3, route: 'tasks' },
    { id: 'widget-dailyTools',   kind: 'widget', widget: 'dailyTools',   icon: 'sparkle',  label: 'Daily Tools',    category: 'Widgets', minW: 3, minH: 2 },
    { id: 'widget-vision',       kind: 'widget', widget: 'vision',       icon: 'goals',    label: 'Vision Banner',  category: 'Widgets', minW: 3, minH: 2, route: 'vision' },
    { id: 'widget-cashflow',     kind: 'widget', widget: 'cashflow',     icon: 'insights', label: 'Cashflow',       category: 'Widgets', minW: 3, minH: 2, route: 'finance' },

    // ─────────────────────────────────────────────────────────────────
    // QUICK ADD — tap the tile to open the existing form modal
    // ─────────────────────────────────────────────────────────────────
    { id: 'add-task',     kind: 'add', icon: 'priority', label: 'Add Task',    category: 'Quick Add', minW: 1, minH: 1, action: 'openTaskModal' },
    { id: 'add-expense',  kind: 'add', icon: 'wallet',   label: 'Add Expense', category: 'Quick Add', minW: 1, minH: 1, action: 'openFinanceAction' },
    { id: 'add-journal',  kind: 'add', icon: 'entries',  label: 'Add Journal', category: 'Quick Add', minW: 1, minH: 1, action: 'openDiaryModal' },
    { id: 'add-habit',    kind: 'add', icon: 'streak',   label: 'Add Habit',   category: 'Quick Add', minW: 1, minH: 1, action: 'openHabitModal' },
    { id: 'add-event',    kind: 'add', icon: 'calendar', label: 'Add Event',   category: 'Quick Add', minW: 1, minH: 1, action: '_addEventToday' },
    { id: 'add-note',     kind: 'add', icon: 'entries',  label: 'Add Note',    category: 'Quick Add', minW: 1, minH: 1, action: '_addNoteQuick' },
    { id: 'add-goal',     kind: 'add', icon: 'goals',    label: 'Add Goal',    category: 'Quick Add', minW: 1, minH: 1, action: 'openVisionModal' },
    { id: 'add-person',   kind: 'add', icon: 'chat',     label: 'Add Person',  category: 'Quick Add', minW: 1, minH: 1, action: 'openPersonModal' },
    { id: 'add-book',     kind: 'add', icon: 'open',     label: 'Add Book',    category: 'Quick Add', minW: 1, minH: 1, action: 'openBookSuggestionModal' },

    // ─────────────────────────────────────────────────────────────────
    // RECENT / LIST — rows click → open the item's edit modal
    // ─────────────────────────────────────────────────────────────────
    { id: 'list-recentTransactions', kind: 'list', icon: 'wallet',   label: 'Recent Transactions', category: 'Lists', minW: 2, minH: 2 },
    { id: 'list-upcomingEvents',     kind: 'list', icon: 'calendar', label: 'Upcoming Events',     category: 'Lists', minW: 2, minH: 2 },
    { id: 'list-upcomingBirthdays',  kind: 'list', icon: 'chat',     label: 'Upcoming Birthdays',  category: 'Lists', minW: 2, minH: 2 },
    { id: 'list-recentDiary',        kind: 'list', icon: 'entries',  label: 'Recent Diary',        category: 'Lists', minW: 2, minH: 2 },
    { id: 'list-recentNotes',        kind: 'list', icon: 'entries',  label: 'Recent Notes',        category: 'Lists', minW: 2, minH: 2 },
    { id: 'list-recentTasks',        kind: 'list', icon: 'priority', label: 'Recent Tasks',        category: 'Lists', minW: 2, minH: 2 },

    // ─────────────────────────────────────────────────────────────────
    // TODAY / STATUS
    // ─────────────────────────────────────────────────────────────────
    { id: 'status-todaySchedule',  kind: 'status', icon: 'calendar', label: "Today's Schedule",  category: 'Today', minW: 2, minH: 2 },
    { id: 'status-todaySpending',  kind: 'status', icon: 'wallet',   label: "Today's Spending",  category: 'Today', minW: 2, minH: 2 },
    { id: 'status-pinnedNotes',    kind: 'status', icon: 'entries',  label: 'Pinned Notes',      category: 'Today', minW: 2, minH: 2 },
    { id: 'status-activeGoals',    kind: 'status', icon: 'goals',    label: 'Active Goals',      category: 'Today', minW: 2, minH: 2 },
    { id: 'status-currentlyReading', kind: 'status', icon: 'open',   label: 'Currently Reading', category: 'Today', minW: 2, minH: 2 },

    // ─────────────────────────────────────────────────────────────────
    // ACTION LAUNCH — tap the tile to start a session
    // ─────────────────────────────────────────────────────────────────
    { id: 'action-startFocus',     kind: 'add', icon: 'focus',   label: 'Start Focus',     category: 'Actions', minW: 1, minH: 1, action: '_startFocusSession' },
    { id: 'action-startMeditate',  kind: 'add', icon: 'goals',   label: 'Start Meditate',  category: 'Actions', minW: 1, minH: 1, action: '_startMeditate' },
    { id: 'action-startManifest',  kind: 'add', icon: 'sparkle', label: 'Start Manifest',  category: 'Actions', minW: 1, minH: 1, action: '_startManifest' },

    // ─────────────────────────────────────────────────────────────────
    // VISUAL — charts and visualizations
    // ─────────────────────────────────────────────────────────────────
    { id: 'visual-budgetBar',         kind: 'visual', icon: 'wallet',   label: 'Budget Bar',        category: 'Visuals', minW: 2, minH: 1 },
    { id: 'visual-categoryBreakdown', kind: 'visual', icon: 'insights', label: 'Spend Breakdown',   category: 'Visuals', minW: 2, minH: 2 },
    { id: 'visual-moodLast7',         kind: 'visual', icon: 'entries',  label: 'Mood Last 7 Days',  category: 'Visuals', minW: 2, minH: 1 },
    { id: 'visual-topStreaks',        kind: 'visual', icon: 'streak',   label: 'Top Habit Streaks', category: 'Visuals', minW: 2, minH: 2 }
];

// For a widget tile too small to show full content, compute a small live value
function _computeWidgetCompact(cat) {
    const data = window.state?.data || {};
    switch (cat.widget) {
        case 'morning': {
            const hr = new Date().getHours();
            const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
            return { value: greet, sub: data.settings?.[0]?.name || '' };
        }
        case 'aiBriefing':
            return { value: 'Briefing', sub: 'Tap to open' };
        case 'yearProgress': {
            const s = computeBentoStat('yearProgress');
            return s;
        }
        case 'habitsGrid': {
            const total = (data.habits || []).length;
            const today = new Date().toISOString().slice(0, 10);
            const done = new Set((data.habit_logs || []).filter(l => (l.date || '').startsWith(today)).map(l => String(l.habit_id))).size;
            return { value: `${done}/${total}`, sub: 'habits today' };
        }
        case 'tasksList': {
            const pending = (data.tasks || []).filter(t => t.status !== 'completed').length;
            return { value: String(pending), sub: 'open tasks' };
        }
        case 'dailyTools':
            return { value: 'Tools', sub: 'Tap to open' };
        case 'vision':
            return { value: 'Vision', sub: 'Tap to open' };
        case 'cashflow': {
            const s = computeBentoStat('monthSpend');
            return { value: s.value, sub: 'this month' };
        }
        default:
            return { value: cat.label, sub: '' };
    }
}

// Helper to look up catalog entry
function getCatalogEntry(catalogId) {
    return LUMIA_TILE_CATALOG.find(c => c.id === catalogId) || null;
}

// ============================================================================
// WIDGET RENDERERS — produce HTML for the body of each catalog entry
// Each renderer signature: (tile, cat) => HTML string
// renderLumiaTile dispatches to WIDGET_RENDERERS[cat.id] for new widgets.
// ============================================================================
const _fmtINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const _shortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const _emptyState = (msg) => `<div class="lw-empty">${msg}</div>`;

const WIDGET_RENDERERS = {
    // ─────── QUICK-ADD (kind: 'add') ───────
    'add-task':     (t, c) => _renderAddTile(c, 'New task',     'Tap to add a task'),
    'add-expense':  (t, c) => _renderAddTile(c, 'New expense',  'Tap to log spending'),
    'add-journal':  (t, c) => _renderAddTile(c, 'New entry',    'Write today’s diary'),
    'add-habit':    (t, c) => _renderAddTile(c, 'New habit',    'Build a routine'),
    'add-event':    (t, c) => _renderAddTile(c, 'New event',    'Schedule something'),
    'add-note':     (t, c) => _renderAddTile(c, 'Quick note',   'Jot it down'),
    'add-goal':     (t, c) => _renderAddTile(c, 'New goal',     'What do you want?'),
    'add-person':   (t, c) => _renderAddTile(c, 'New contact',  'Add to your circle'),
    'add-book':     (t, c) => _renderAddTile(c, 'Add a book',   'Track your reading'),
    'action-startFocus':    (t, c) => _renderAddTile(c, 'Focus',    'Start a Pomodoro'),
    'action-startMeditate': (t, c) => _renderAddTile(c, 'Meditate', 'Start a session'),
    'action-startManifest': (t, c) => _renderAddTile(c, 'Manifest', 'Affirmation ritual'),

    // ─────── RECENT / LIST (kind: 'list') ───────
    'list-recentTransactions': (t, c) => {
        const tx = [...(state.data.expenses || [])]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 10);
        const total = tx.reduce((s, e) => s + Number(e.amount || 0), 0);
        if (tx.length === 0) return _listShell(c, 0, _emptyState('No transactions yet.'), null);
        const rows = tx.map(e => {
            const isIncome = (e.type || 'expense') === 'income';
            return `
                <button class="lw-row" onclick="event.stopPropagation();openEditTransaction('${e.id}')">
                    <span class="lw-row__dot" style="background:${isIncome ? '#10B981' : '#EF4444'}"></span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(e.description || e.category || 'Untitled')}</span>
                        <span class="lw-row__sub">${escapeHtml(e.category || 'General')} · ${_shortDate(e.date)}</span>
                    </span>
                    <span class="lw-row__amt ${isIncome ? 'lw-row__amt--pos' : ''}">${isIncome ? '+' : '−'}${_fmtINR(e.amount)}</span>
                </button>`;
        }).join('');
        return _listShell(c, tx.length, rows, `Total ${_fmtINR(total)}`);
    },

    'list-upcomingEvents': (t, c) => {
        const today = new Date(); today.setHours(0,0,0,0);
        const horizon = new Date(today); horizon.setDate(horizon.getDate() + 7);
        const events = (state.data.planner_events || [])
            .filter(e => e.start_datetime)
            .filter(e => { const d = new Date(e.start_datetime); return d >= today && d <= horizon; })
            .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
            .slice(0, 10);
        if (events.length === 0) return _listShell(c, 0, _emptyState('Nothing in the next 7 days.'));
        const rows = events.map(e => {
            const d = new Date(e.start_datetime);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <button class="lw-row" onclick="event.stopPropagation();routeTo('calendar')">
                    <span class="lw-row__dot" style="background:var(--saas-accent, var(--primary))"></span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(e.title || 'Untitled event')}</span>
                        <span class="lw-row__sub">${_shortDate(e.start_datetime)} · ${timeStr}</span>
                    </span>
                </button>`;
        }).join('');
        return _listShell(c, events.length, rows);
    },

    'list-upcomingBirthdays': (t, c) => {
        const people = (state.data.people || []).filter(p => p.birthday);
        const today = new Date(); today.setHours(0,0,0,0);
        const ranked = people.map(p => {
            const b = new Date(p.birthday);
            const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
            if (next < today) next.setFullYear(today.getFullYear() + 1);
            const days = Math.round((next - today) / 86400000);
            return { p, next, days };
        }).filter(r => r.days <= 30).sort((a, b) => a.days - b.days).slice(0, 10);
        if (ranked.length === 0) return _listShell(c, 0, _emptyState('No birthdays in 30 days.'));
        const rows = ranked.map(({ p, next, days }) => `
            <button class="lw-row" onclick="event.stopPropagation();openContactOptions('${p.id}')">
                <span class="lw-row__dot" style="background:#EC4899"></span>
                <span class="lw-row__main">
                    <span class="lw-row__title">${escapeHtml(p.name || 'Unknown')}</span>
                    <span class="lw-row__sub">${_shortDate(next.toISOString())} · ${days === 0 ? 'today!' : days + 'd'}</span>
                </span>
            </button>`).join('');
        return _listShell(c, ranked.length, rows);
    },

    'list-recentDiary': (t, c) => {
        const entries = [...(state.data.diary || [])]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 10);
        if (entries.length === 0) return _listShell(c, 0, _emptyState('No diary entries yet.'));
        const moodEmoji = { happy: '😄', good: '🙂', neutral: '😐', sad: '😞', angry: '😠', anxious: '😟' };
        const rows = entries.map(e => {
            const preview = (e.content || '').replace(/<[^>]+>/g, '').slice(0, 60);
            return `
                <button class="lw-row" onclick="event.stopPropagation();(typeof openEditDiary === 'function' ? openEditDiary('${e.id}') : routeTo('diary'))">
                    <span class="lw-row__emoji">${moodEmoji[e.mood] || '✨'}</span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(preview || 'Untitled entry')}</span>
                        <span class="lw-row__sub">${_shortDate(e.date)}</span>
                    </span>
                </button>`;
        }).join('');
        return _listShell(c, entries.length, rows);
    },

    'list-recentNotes': (t, c) => {
        const notes = [...(state.data.notes || [])]
            .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))
            .slice(0, 10);
        if (notes.length === 0) return _listShell(c, 0, _emptyState('No notes yet.'));
        const rows = notes.map(n => {
            const preview = (n.content || '').replace(/<[^>]+>/g, '').slice(0, 70);
            return `
                <button class="lw-row" onclick="event.stopPropagation();routeTo('notes')">
                    <span class="lw-row__dot" style="background:#6366F1"></span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(n.title || 'Untitled')}</span>
                        <span class="lw-row__sub">${escapeHtml(preview)}</span>
                    </span>
                </button>`;
        }).join('');
        return _listShell(c, notes.length, rows);
    },

    'list-recentTasks': (t, c) => {
        const tasks = [...(state.data.tasks || [])]
            .filter(x => x.status !== 'completed')
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .slice(0, 10);
        if (tasks.length === 0) return _listShell(c, 0, _emptyState('No pending tasks.'));
        const prioColor = { P1: '#EF4444', P2: '#F59E0B', P3: '#10B981' };
        const rows = tasks.map(x => `
            <button class="lw-row" onclick="event.stopPropagation();_dashOpenModal('tasks','openTaskModal','${x.id}')">
                <span class="lw-row__dot" style="background:${prioColor[x.priority] || '#9CA3AF'}"></span>
                <span class="lw-row__main">
                    <span class="lw-row__title">${escapeHtml(x.title || 'Untitled')}</span>
                    <span class="lw-row__sub">${x.due_date ? _shortDate(x.due_date) : 'No due date'}${x.category ? ' · ' + escapeHtml(x.category) : ''}</span>
                </span>
            </button>`).join('');
        return _listShell(c, tasks.length, rows);
    },

    // ─────── TODAY / STATUS ───────
    'status-todaySchedule': (t, c) => {
        const today = new Date().toISOString().slice(0, 10);
        const events = (state.data.planner_events || [])
            .filter(e => (e.start_datetime || '').startsWith(today))
            .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        if (events.length === 0) return _listShell(c, 0, _emptyState("Today's schedule is clear."));
        const rows = events.map(e => {
            const d = new Date(e.start_datetime);
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <button class="lw-row" onclick="event.stopPropagation();routeTo('calendar')">
                    <span class="lw-row__time">${time}</span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(e.title || 'Event')}</span>
                        ${e.category ? `<span class="lw-row__sub">${escapeHtml(e.category)}</span>` : ''}
                    </span>
                </button>`;
        }).join('');
        return _listShell(c, events.length, rows);
    },

    'status-todaySpending': (t, c) => {
        const today = new Date().toISOString().slice(0, 10);
        const expenses = (state.data.expenses || [])
            .filter(e => (e.type || 'expense') === 'expense' && (e.date || '').startsWith(today));
        const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const byCat = {};
        expenses.forEach(e => { const k = e.category || 'General'; byCat[k] = (byCat[k] || 0) + Number(e.amount || 0); });
        const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (expenses.length === 0) return _listShell(c, 0, _emptyState('Nothing spent today.'), 'Total ₹0');
        const rows = cats.map(([cat, amt]) => {
            const pct = total ? Math.round((amt / total) * 100) : 0;
            return `
                <div class="lw-row lw-row--static">
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(cat)}</span>
                        <span class="lw-row__sub">${pct}%</span>
                    </span>
                    <span class="lw-row__amt">${_fmtINR(amt)}</span>
                </div>`;
        }).join('');
        return _listShell(c, expenses.length, rows, `Total ${_fmtINR(total)} · ${expenses.length} transactions`);
    },

    'status-pinnedNotes': (t, c) => {
        const notes = (state.data.notes || []).filter(n => n.is_pinned === true || n.is_pinned === 'true' || n.is_pinned === 'TRUE' || n.pinned === true || n.pinned === 'true');
        if (notes.length === 0) return _listShell(c, 0, _emptyState('Pin some notes to see them here.'));
        const rows = notes.slice(0, 10).map(n => `
            <button class="lw-row" onclick="event.stopPropagation();routeTo('notes')">
                <span class="lw-row__emoji">📌</span>
                <span class="lw-row__main">
                    <span class="lw-row__title">${escapeHtml(n.title || 'Untitled')}</span>
                    <span class="lw-row__sub">${escapeHtml((n.content || '').replace(/<[^>]+>/g, '').slice(0, 60))}</span>
                </span>
            </button>`).join('');
        return _listShell(c, notes.length, rows);
    },

    'status-activeGoals': (t, c) => {
        const goals = (state.data.vision_board || []).filter(g => g.status === 'in_progress' || g.status === 'active' || !g.status || g.status === 'open');
        if (goals.length === 0) return _listShell(c, 0, _emptyState('No active goals.'));
        const rows = goals.slice(0, 10).map(g => {
            const pct = Math.max(0, Math.min(100, Number(g.progress) || 0));
            return `
                <button class="lw-row" onclick="event.stopPropagation();routeTo('vision')">
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(g.title || 'Untitled goal')}</span>
                        <span class="lw-row__sub">${escapeHtml(g.category || '')} ${g.target_date ? '· ' + _shortDate(g.target_date) : ''}</span>
                        <div class="lw-progress"><div class="lw-progress__bar" style="width:${pct}%"></div></div>
                    </span>
                    <span class="lw-row__amt">${pct}%</span>
                </button>`;
        }).join('');
        return _listShell(c, goals.length, rows);
    },

    'status-currentlyReading': (t, c) => {
        const books = (state.data.book_library || []).filter(b => (b.status || '').toLowerCase() === 'reading' || (b.status || '').toLowerCase() === 'in_progress');
        if (books.length === 0) return _listShell(c, 0, _emptyState("You're not reading anything right now."));
        const rows = books.slice(0, 10).map(b => `
            <button class="lw-row" onclick="event.stopPropagation();(typeof openBookDetail === 'function' ? openBookDetail('${b.id}') : routeTo('books'))">
                <span class="lw-row__emoji">📖</span>
                <span class="lw-row__main">
                    <span class="lw-row__title">${escapeHtml(b.title || 'Untitled')}</span>
                    <span class="lw-row__sub">${escapeHtml(b.author || '')}</span>
                </span>
            </button>`).join('');
        return _listShell(c, books.length, rows);
    },

    // ─────── VISUAL ───────
    'visual-budgetBar': (t, c) => {
        const budget = Number(state.data.settings?.[0]?.monthly_budget) || 0;
        const today = new Date(); const monthKey = today.toISOString().slice(0, 7);
        const spent = (state.data.expenses || [])
            .filter(e => (e.type || 'expense') === 'expense' && (e.date || '').startsWith(monthKey))
            .reduce((s, e) => s + Number(e.amount || 0), 0);
        const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        const remaining = Math.max(0, budget - spent);
        const overBudget = spent > budget && budget > 0;
        return `
            <div class="lw-card">
                <div class="lw-card__head">
                    <div>
                        <div class="lw-card__label">${c.label}</div>
                        <div class="lw-card__title">${_fmtINR(spent)} <span class="lw-card__title-sub">of ${_fmtINR(budget) || '—'}</span></div>
                    </div>
                    <div class="lw-card__big-stat ${overBudget ? 'is-danger' : ''}">${pct}%</div>
                </div>
                <div class="lw-progress lw-progress--lg"><div class="lw-progress__bar ${overBudget ? 'is-danger' : ''}" style="width:${pct}%"></div></div>
                <div class="lw-card__foot">${overBudget ? 'Over budget by ' + _fmtINR(spent - budget) : remaining ? _fmtINR(remaining) + ' remaining' : 'Set a budget in Settings'}</div>
            </div>`;
    },

    'visual-categoryBreakdown': (t, c) => {
        const today = new Date(); const monthKey = today.toISOString().slice(0, 7);
        const monthEx = (state.data.expenses || [])
            .filter(e => (e.type || 'expense') === 'expense' && (e.date || '').startsWith(monthKey));
        const total = monthEx.reduce((s, e) => s + Number(e.amount || 0), 0);
        if (monthEx.length === 0) return _listShell(c, 0, _emptyState('No spending this month.'));
        const byCat = {};
        monthEx.forEach(e => { const k = e.category || 'General'; byCat[k] = (byCat[k] || 0) + Number(e.amount || 0); });
        const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
        const rows = cats.map(([cat, amt], i) => {
            const pct = total ? Math.round((amt / total) * 100) : 0;
            return `
                <div class="lw-row lw-row--static">
                    <span class="lw-row__dot" style="background:${colors[i % colors.length]}"></span>
                    <span class="lw-row__main">
                        <span class="lw-row__title">${escapeHtml(cat)}</span>
                        <div class="lw-progress"><div class="lw-progress__bar" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
                    </span>
                    <span class="lw-row__amt">${_fmtINR(amt)}</span>
                </div>`;
        }).join('');
        return _listShell(c, cats.length, rows, `Total ${_fmtINR(total)} this month`);
    },

    'visual-moodLast7': (t, c) => {
        const moodValues = { happy: 5, good: 4, neutral: 3, sad: 2, angry: 1, anxious: 2 };
        const moodEmoji = { happy: '😄', good: '🙂', neutral: '😐', sad: '😞', angry: '😠', anxious: '😟' };
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().slice(0, 10);
            const entry = (state.data.diary || []).find(x => (x.date || '').startsWith(iso));
            days.push({ iso, mood: entry?.mood, val: entry?.mood ? moodValues[entry.mood] : 0, label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
        }
        const max = Math.max(...days.map(d => d.val), 5);
        return `
            <div class="lw-card">
                <div class="lw-card__head">
                    <div>
                        <div class="lw-card__label">${c.label}</div>
                        <div class="lw-card__title-sub">Tap to view diary</div>
                    </div>
                </div>
                <div class="lw-moodchart">
                    ${days.map(d => `
                        <button class="lw-moodbar" onclick="event.stopPropagation();routeTo('diary')" title="${d.mood || 'No entry'}">
                            <div class="lw-moodbar__col"><div class="lw-moodbar__fill" style="height:${(d.val / max) * 100}%"></div></div>
                            <div class="lw-moodbar__emoji">${moodEmoji[d.mood] || '·'}</div>
                            <div class="lw-moodbar__day">${d.label[0]}</div>
                        </button>
                    `).join('')}
                </div>
            </div>`;
    },

    'visual-topStreaks': (t, c) => {
        const habits = state.data.habits || [];
        const logs = state.data.habit_logs || [];
        const ranked = habits.map(h => {
            // Walk back from today, count consecutive completion days
            let streak = 0;
            const cursor = new Date();
            for (let i = 0; i < 365; i++) {
                const iso = cursor.toISOString().slice(0, 10);
                const done = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(iso));
                if (done) { streak++; cursor.setDate(cursor.getDate() - 1); }
                else break;
            }
            return { h, streak };
        }).filter(r => r.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 5);
        if (ranked.length === 0) return _listShell(c, 0, _emptyState('No active streaks yet. Start one today!'));
        const rows = ranked.map(({ h, streak }) => `
            <div class="lw-row lw-row--static">
                <span class="lw-row__emoji">${h.emoji || h.icon || '🔥'}</span>
                <span class="lw-row__main">
                    <span class="lw-row__title">${escapeHtml(h.habit_name || h.name || 'Habit')}</span>
                </span>
                <span class="lw-row__amt"><span class="lw-streak-pill">${streak}d</span></span>
            </div>`).join('');
        return _listShell(c, ranked.length, rows);
    }
};

// Quick-Add tile template
function _renderAddTile(cat, title, hint) {
    return `
        <div class="lw-addtile">
            <div class="lw-addtile__icon">${renderIcon(cat.icon || 'sparkle', null, 'style="width:24px;height:24px"')}</div>
            <div class="lw-addtile__plus">+</div>
            <div class="lw-addtile__title">${title}</div>
            <div class="lw-addtile__hint">${hint}</div>
        </div>`;
}

// Header + scrollable list + footer wrapper
function _listShell(cat, count, rows, footer) {
    return `
        <div class="lw-card">
            <div class="lw-card__head">
                <div>
                    <div class="lw-card__label">${cat.label}</div>
                    ${count > 0 ? `<div class="lw-card__count">${count} ${count === 1 ? 'item' : 'items'}</div>` : ''}
                </div>
                <div class="lw-card__icon">${renderIcon(cat.icon || 'sparkle', null, 'style="width:18px"')}</div>
            </div>
            <div class="lw-card__body">${rows}</div>
            ${footer ? `<div class="lw-card__foot">${footer}</div>` : ''}
        </div>`;
}

// Action handlers — wrappers so catalog can reference them by name
window._addEventToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window.openEventModal === 'function') window.openEventModal(today);
    else routeTo('calendar');
};
window._addNoteQuick = () => {
    if (typeof window.showQuickLog === 'function') window.showQuickLog('note');
    else routeTo('notes');
};
window._startFocusSession = () => routeTo('pomodoro');
window._startMeditate = () => {
    if (typeof window.startGuidedMeditation === 'function') window.startGuidedMeditation();
    else routeTo('meditation');
};
window._startManifest = () => {
    if (typeof window.startManifestationRitual === 'function') window.startManifestationRitual();
    else routeTo('vision');
};

// Default layout — no colors (tiles render in their original widget look).
// User can recolor any tile via the editor.
// Detect phone-sized viewport (under 768px). Used to pick the right config.
function _isMobile() {
    try { return window.matchMedia && window.matchMedia('(max-width: 767px)').matches; }
    catch (e) { return window.innerWidth < 768; }
}

// Allow the user to TEMPORARILY override which layout they're editing
// (e.g. preview/edit mobile config from desktop or vice versa).
window._lumiaEditTarget = null;   // 'mobile' | 'desktop' | null (auto = current device)
function _currentLayoutKey() {
    if (window._lumiaEditTarget === 'mobile') return 'mobile';
    if (window._lumiaEditTarget === 'desktop') return 'desktop';
    return _isMobile() ? 'mobile' : 'desktop';
}

const DEFAULT_LUMIA_TILES = [
    { uid: 't1',  catalogId: 'widget-greeting',      w: 4, h: 2 },
    { uid: 't2',  catalogId: 'widget-yearProgress',  w: 2, h: 2 },
    { uid: 't3',  catalogId: 'kpi-tasksDone',        w: 2, h: 2 },
    { uid: 't4',  catalogId: 'kpi-monthSpend',       w: 2, h: 2 },
    { uid: 't5',  catalogId: 'kpi-habits',           w: 2, h: 2 },
    { uid: 't6',  catalogId: 'kpi-streak',           w: 2, h: 2 },
    { uid: 't7',  catalogId: 'widget-aiBriefing',    w: 4, h: 2 },
    { uid: 't8',  catalogId: 'widget-habitsGrid',    w: 4, h: 4 },
    { uid: 't9',  catalogId: 'widget-tasksList',     w: 4, h: 3 },
    { uid: 't10', catalogId: 'tool-focus',           w: 1, h: 1 },
    { uid: 't11', catalogId: 'tool-gym',             w: 1, h: 1 },
    { uid: 't12', catalogId: 'tool-chimes',          w: 1, h: 1 },
    { uid: 't13', catalogId: 'tool-meditate',        w: 1, h: 1 },
    { uid: 't14', catalogId: 'route-diary',          w: 1, h: 1 },
    { uid: 't15', catalogId: 'route-notes',          w: 1, h: 1 },
    { uid: 't16', catalogId: 'route-vision',         w: 1, h: 1 }
];

// Mobile defaults — phone has only 4 cols, so tiles capped at width 4.
// Curated to give a compact, scannable first impression on a phone.
const DEFAULT_LUMIA_TILES_MOBILE = [
    { uid: 'm1',  catalogId: 'widget-greeting',     w: 4, h: 2 },
    { uid: 'm2',  catalogId: 'kpi-tasksDone',       w: 2, h: 2 },
    { uid: 'm3',  catalogId: 'kpi-habits',          w: 2, h: 2 },
    { uid: 'm4',  catalogId: 'kpi-monthSpend',      w: 2, h: 2 },
    { uid: 'm5',  catalogId: 'kpi-streak',          w: 2, h: 2 },
    { uid: 'm6',  catalogId: 'add-task',            w: 1, h: 1 },
    { uid: 'm7',  catalogId: 'add-expense',         w: 1, h: 1 },
    { uid: 'm8',  catalogId: 'add-journal',         w: 1, h: 1 },
    { uid: 'm9',  catalogId: 'add-habit',           w: 1, h: 1 },
    { uid: 'm10', catalogId: 'list-recentTasks',    w: 4, h: 3 },
    { uid: 'm11', catalogId: 'list-recentTransactions', w: 4, h: 3 },
    { uid: 'm12', catalogId: 'route-tasks',         w: 1, h: 1 },
    { uid: 'm13', catalogId: 'route-habits',        w: 1, h: 1 },
    { uid: 'm14', catalogId: 'route-finance',       w: 1, h: 1 },
    { uid: 'm15', catalogId: 'route-diary',         w: 1, h: 1 }
];

// Normalize a tile: migrate legacy `size`, clamp w/h, drop nullish fields
function _normalizeTile(t) {
    if (!t || !t.catalogId) return null;
    let w = Number(t.w), h = Number(t.h);
    if (!w || !h) {
        const legacy = LUMIA_LEGACY_SIZE_MAP[t.size];
        if (legacy) { w = legacy.w; h = legacy.h; }
        else { w = 2; h = 2; }
    }
    w = Math.max(1, Math.min(LUMIA_MAX_W, w));
    h = Math.max(1, Math.min(LUMIA_MAX_H, h));
    const out = { uid: t.uid || ('t' + Date.now() + Math.floor(Math.random() * 1000)), catalogId: t.catalogId, w, h };
    if (t.color && /^#[0-9A-Fa-f]{6}$/.test(t.color)) out.color = t.color.toUpperCase();
    if (t.customLabel) out.customLabel = String(t.customLabel).slice(0, 60);
    return out;
}

// Resolve which fields/keys to read+write based on current layout target.
function _layoutKeys() {
    const isMobile = _currentLayoutKey() === 'mobile';
    return {
        isMobile,
        sheetField: isMobile ? 'mobile_dashboard_tiles' : 'dashboard_tiles',
        localKey:   isMobile ? 'lumiaTilesMobile'      : 'lumiaTiles',
        defaultArr: isMobile ? DEFAULT_LUMIA_TILES_MOBILE : DEFAULT_LUMIA_TILES
    };
}

function getLumiaConfig() {
    const tryParse = (raw) => {
        if (!raw) return null;
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
    };
    const normalize = (arr) => (Array.isArray(arr) ? arr.map(_normalizeTile).filter(Boolean) : null);
    const k = _layoutKeys();
    // 1. Settings (source of truth — per-device column)
    const settings = state.data?.settings?.[0];
    const fromSheet = normalize(tryParse(settings?.[k.sheetField]));
    if (fromSheet && fromSheet.length > 0) return fromSheet;
    // 2. Local cache (per-device)
    const fromLocal = normalize(tryParse(localStorage.getItem(k.localKey)));
    if (fromLocal && fromLocal.length > 0) return fromLocal;
    // 3. Defaults (per-device)
    return k.defaultArr.map(t => _normalizeTile(t));
}

async function saveLumiaConfig(tiles) {
    const clean = (tiles || []).map(_normalizeTile).filter(Boolean);
    const json = JSON.stringify(clean);
    const k = _layoutKeys();
    // 1. localStorage
    try { localStorage.setItem(k.localKey, json); } catch (e) {}
    // 2. State
    if (state.data?.settings?.[0]) {
        state.data.settings[0][k.sheetField] = json;
    }
    // 3. Backend
    try {
        const settings = state.data?.settings?.[0] || {};
        const payload = { [k.sheetField]: json };
        if (settings.id) {
            await apiCall('update', 'settings', payload, settings.id);
        } else {
            await apiCall('create', 'settings', payload);
        }
    } catch (e) { /* offline-safe */ }
}

function resetLumiaConfig() {
    const k = _layoutKeys();
    try { localStorage.removeItem(k.localKey); } catch (e) {}
    if (state.data?.settings?.[0]) state.data.settings[0][k.sheetField] = '';
    return k.defaultArr.map(t => ({ ...t }));
}

// Toggle which layout the user is editing (mobile vs desktop).
// Re-renders the dashboard so they see the layout they're now editing.
window.toggleLumiaLayoutTarget = function () {
    const current = _currentLayoutKey();
    window._lumiaEditTarget = current === 'mobile' ? 'desktop' : 'mobile';
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof showToast === 'function') {
        showToast(`Now editing ${window._lumiaEditTarget} layout`, 'info');
    }
};

// Render the INNER content of a tile, preserving original widget look
function _renderTileContent(cat, tile, sectionRenderers) {
    const label = tile.customLabel || cat.label;
    const iconKey = cat.icon || 'sparkle';

    // -------- WIDGETS: use the existing sectionRenderer (full original styling)
    if (cat.kind === 'widget' && cat.widget && sectionRenderers && sectionRenderers[cat.widget]) {
        try {
            return sectionRenderers[cat.widget]();
        } catch (e) {
            return `<div class="lumia-fallback">${label}</div>`;
        }
    }

    // -------- KPIs: render a single KPI card matching .kpi-card style
    if (cat.kind === 'kpi') {
        let value = '—', sub = '';
        if (typeof computeBentoStat === 'function') {
            try { ({ value, sub } = computeBentoStat(cat.stat)); } catch (e) {}
        }
        return `
            <div class="kpi-card kpi-tile" data-widget-id="kpi-${cat.stat}">
                <div class="kpi-icon">${renderIcon(iconKey, null, 'style="width:20px"')}</div>
                <div class="kpi-label">${label}</div>
                <div class="kpi-value">${value || '—'}</div>
                ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
            </div>`;
    }

    // -------- DAILY TOOL / ROUTE: gradient icon card matching original Daily Tools
    // Each tool/route gets the colored gradient tile look + label below
    const toolGradients = {
        'tool-focus':    'linear-gradient(135deg, #FB923C, #EA580C)',
        'tool-gym':      'linear-gradient(135deg, #F87171, #EF4444)',
        'tool-chimes':   'linear-gradient(135deg, #34D399, #10B981)',
        'tool-tutor':    'linear-gradient(135deg, #22D3EE, #06B6D4)',
        'tool-meditate': 'linear-gradient(135deg, #C084FC, #A855F7)',
        'route-tasks':   'linear-gradient(135deg, #60A5FA, #2563EB)',
        'route-habits':  'linear-gradient(135deg, #FB923C, #EA580C)',
        'route-finance': 'linear-gradient(135deg, #34D399, #059669)',
        'route-diary':   'linear-gradient(135deg, #C084FC, #7C3AED)',
        'route-calendar':'linear-gradient(135deg, #5EEAD4, #0D9488)',
        'route-vision':  'linear-gradient(135deg, #F472B6, #BE185D)',
        'route-notes':   'linear-gradient(135deg, #94A3B8, #475569)',
        'route-people':  'linear-gradient(135deg, #F0ABFC, #C026D3)',
        'route-books':   'linear-gradient(135deg, #60A5FA, #1D4ED8)',
        'route-mural':   'linear-gradient(135deg, #F472B6, #DB2777)',
        'route-lifeCal': 'linear-gradient(135deg, #818CF8, #4338CA)'
    };
    const gradient = toolGradients[cat.id] || 'linear-gradient(135deg, var(--primary-light, #818CF8), var(--primary, #4F46E5))';
    return `
        <div class="tool-tile" data-widget-id="tool-${cat.id}">
            <div class="tool-tile__icon" style="background:${gradient}">
                ${renderIcon(iconKey, null, 'style="width:22px; color:white"')}
            </div>
            <div class="tool-tile__label">${label}</div>
        </div>`;
}

// Compact tile rendering (used when:
//   a) tile.color is set (Lumia colored mode), or
//   b) the tile is smaller than the widget's minimum size.
// Renders: icon + label + value/sub in a KPI-card-style layout.
function _renderCompactTileInner(cat, tile, opts) {
    const label = tile.customLabel || cat.label;
    const iconKey = cat.icon || 'sparkle';
    const isXS = tile.w === 1 && tile.h === 1;
    const colored = !!(opts && opts.colored);

    // Pull a value: KPI uses computeBentoStat, widget uses _computeWidgetCompact, others none
    let value = '', sub = '';
    if (cat.kind === 'kpi' && typeof computeBentoStat === 'function') {
        try { ({ value, sub } = computeBentoStat(cat.stat) || {}); } catch (e) {}
    } else if (cat.kind === 'widget') {
        try { ({ value, sub } = _computeWidgetCompact(cat) || {}); } catch (e) {}
    }

    if (isXS) {
        return `
            <div class="lumia-compact lumia-compact--xs ${colored ? 'lumia-compact--colored' : ''}">
                <div class="lumia-compact__icon">${renderIcon(iconKey, null, 'style="width:24px;height:24px"')}</div>
                <div class="lumia-compact__label">${label}</div>
            </div>`;
    }
    return `
        <div class="lumia-compact ${colored ? 'lumia-compact--colored' : ''}">
            <div class="lumia-compact__top">
                <div class="lumia-compact__icon">${renderIcon(iconKey, null, 'style="width:28px;height:28px"')}</div>
                ${value ? `<div class="lumia-compact__value">${value}</div>` : ''}
            </div>
            <div class="lumia-compact__bottom">
                <div class="lumia-compact__label">${label}</div>
                ${sub ? `<div class="lumia-compact__sub">${sub}</div>` : ''}
            </div>
        </div>`;
}

// Outer tile = transparent wrapper with W×H grid spans + edit handles + click routing
function renderLumiaTile(tile, sectionRenderers) {
    const cat = getCatalogEntry(tile.catalogId);
    if (!cat) return '';
    const w = tile.w || 2, h = tile.h || 2;
    const minW = cat.minW || 1, minH = cat.minH || 1;
    const fitsFull = w >= minW && h >= minH;

    // Resolve outer-click action (varies by kind)
    let routeJS = '';
    if (cat.kind === 'route' && cat.route) routeJS = `routeTo('${cat.route}')`;
    else if (cat.kind === 'kpi' && cat.route) routeJS = `routeTo('${cat.route}')`;
    else if (cat.kind === 'action' && cat.action) routeJS = `${cat.action}()`;
    else if (cat.kind === 'add' && cat.action) routeJS = `${cat.action}()`;
    else if (cat.kind === 'widget' && cat.route && !fitsFull) routeJS = `routeTo('${cat.route}')`;

    // Rendering mode (color is a TINT, not a content swap):
    //   widget at/above min size  → original widget card via sectionRenderers
    //   widget below min size     → compact KPI-style fallback
    //   kpi/tool/route            → original .kpi-card or gradient .tool-tile
    //   add/list/status/visual    → custom WIDGET_RENDERERS entry
    const colored = !!tile.color;
    const isWidget = cat.kind === 'widget';
    const NEW_KINDS = new Set(['add', 'list', 'status', 'visual']);

    let innerHTML;
    if (NEW_KINDS.has(cat.kind) && WIDGET_RENDERERS[cat.id]) {
        try { innerHTML = WIDGET_RENDERERS[cat.id](tile, cat); }
        catch (e) { console.error('Widget render failed', cat.id, e); innerHTML = _renderCompactTileInner(cat, tile, { colored }); }
    } else if (isWidget && fitsFull) {
        innerHTML = _renderTileContent(cat, tile, sectionRenderers);
    } else if (isWidget && !fitsFull) {
        innerHTML = _renderCompactTileInner(cat, tile, { colored });
    } else {
        innerHTML = _renderTileContent(cat, tile, sectionRenderers);
    }

    // Click model (per user: list/status/visual tiles have NO outer click):
    //  - add/action      → whole tile clickable (opens modal / starts action)
    //  - kpi/route       → outer click routes
    //  - widget at full  → no outer click (inner widget handles clicks)
    //  - widget compact  → outer click routes to its page
    //  - list/status/visual → NO outer click — only inner row clicks
    //  - In edit mode, the click shield catches all events and opens the editor.
    const NO_OUTER_CLICK_KINDS = new Set(['list', 'status', 'visual']);
    const tileHasOuterClick = !NO_OUTER_CLICK_KINDS.has(cat.kind)
        && !(isWidget && fitsFull && !colored);
    const onclickAttr = tileHasOuterClick
        ? `onclick="if(document.body.classList.contains('tiles-editing'))openLumiaTileEditor('${tile.uid}');else { ${routeJS}; }"`
        : '';

    const inlineStyle = `grid-column: span ${w}; grid-row: span ${h};` +
        (colored ? ` background:${tile.color}; --lumia-tile-bg:${tile.color};` : '');

    return `
        <div class="lumia-tile ${colored ? 'lumia-tile--colored' : 'lumia-tile--plain'} ${(isWidget && fitsFull && !colored) ? 'lumia-tile--mode-full' : 'lumia-tile--mode-compact'} lumia-tile--kind-${cat.kind}"
             data-tile-uid="${tile.uid}"
             data-tile-kind="${cat.kind}"
             data-tile-catalog="${cat.id}"
             data-tile-w="${w}" data-tile-h="${h}"
             style="${inlineStyle}"
             ${onclickAttr}>
            <button class="lumia-tile__edit-handle" title="Edit tile"
                onclick="event.stopPropagation();openLumiaTileEditor('${tile.uid}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="lumia-tile__remove-handle" title="Remove tile"
                onclick="event.stopPropagation();removeLumiaTile('${tile.uid}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="lumia-tile__shield" onclick="event.stopPropagation();openLumiaTileEditor('${tile.uid}')"></div>
            <div class="lumia-tile__body">${innerHTML}</div>
        </div>`;
}

function renderLumiaGrid(sectionRenderers) {
    const tiles = getLumiaConfig();
    const tilesHtml = tiles.map(t => renderLumiaTile(t, sectionRenderers)).join('');
    return `
        <div class="lumia-grid" id="lumiaGrid">
            ${tilesHtml}
            <button class="lumia-tile lumia-tile--add" onclick="openLumiaTilePicker()" title="Add a tile">
                <div class="lumia-tile__icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div class="lumia-tile__label lumia-tile__label--xs">Add tile</div>
            </button>
        </div>`;
}

// Toggle edit mode
window.toggleLumiaEditMode = function () {
    document.body.classList.toggle('tiles-editing');
    // Re-init Sortable when toggled on
    if (document.body.classList.contains('tiles-editing')) {
        _initLumiaSortable();
    } else if (window._lumiaSortable) {
        try { window._lumiaSortable.destroy(); } catch (e) {}
        window._lumiaSortable = null;
    }
};

function _initLumiaSortable() {
    const grid = document.getElementById('lumiaGrid');
    if (!grid || typeof Sortable === 'undefined') return;
    if (window._lumiaSortable) {
        try { window._lumiaSortable.destroy(); } catch (e) {}
    }
    window._lumiaSortable = new Sortable(grid, {
        animation: 180,
        ghostClass: 'lumia-tile--ghost',
        filter: '.lumia-tile--add, .lumia-tile__edit-handle, .lumia-tile__remove-handle',
        preventOnFilter: false,
        onEnd: async () => {
            // Read order from DOM, persist
            const order = [...grid.querySelectorAll('.lumia-tile[data-tile-uid]')]
                .map(el => el.dataset.tileUid);
            const current = getLumiaConfig();
            const byUid = Object.fromEntries(current.map(t => [t.uid, t]));
            const reordered = order.map(uid => byUid[uid]).filter(Boolean);
            await saveLumiaConfig(reordered);
        }
    });
}

// Open editor for a tile
window.openLumiaTileEditor = function (uid) {
    const tiles = getLumiaConfig();
    const tile = tiles.find(t => t.uid === uid);
    if (!tile) return;
    const cat = getCatalogEntry(tile.catalogId);
    if (!cat) return;
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    const currentLabel = tile.customLabel ?? cat.label;

    // Build W×H grid picker — clicking a cell sets w=col, h=row
    const sizeCells = [];
    for (let h = 1; h <= LUMIA_MAX_H; h++) {
        for (let w = 1; w <= LUMIA_MAX_W; w++) {
            sizeCells.push(`
                <button class="lumia-sz-cell ${tile.w === w && tile.h === h ? 'is-selected' : ''}"
                    data-w="${w}" data-h="${h}"
                    onmouseover="_lumiaSzHover(${w},${h})"
                    onmouseleave="_lumiaSzHover(0,0)"
                    onclick="_lumiaPickWH(${w},${h})"
                    title="${w} × ${h}"></button>`);
        }
    }

    const swatchHtml = LUMIA_SWATCHES.map(c => `
        <button class="lumia-color-opt ${tile.color === c ? 'is-selected' : ''}"
            data-color="${c}" title="${c}"
            style="background:${c}"
            onclick="_lumiaPickColor('${c}')"></button>
    `).join('');

    const currentColor = tile.color || '#4F46E5';

    box.innerHTML = `
        <h3 style="margin:0 0 4px 0;font-weight:700">Edit tile</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 18px 0">${cat.label} · ${cat.category}</p>

        <div style="margin-bottom:18px">
            <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px;display:block">Name</label>
            <input id="lumiaEditLabel" class="input" value="${escapeHtml(currentLabel)}" style="width:100%;padding:10px 12px;border:1px solid var(--saas-border, #ddd);border-radius:8px;font-size:14px" />
        </div>

        <div style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
                <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Size</label>
                <span id="lumiaSzReadout" style="font-size:13px;font-weight:600;color:var(--text-1)">${tile.w} × ${tile.h}</span>
            </div>
            <div class="lumia-sz-picker" id="lumiaSzPicker" style="grid-template-columns:repeat(${LUMIA_MAX_W}, 1fr);grid-template-rows:repeat(${LUMIA_MAX_H}, 1fr)">
                ${sizeCells.join('')}
            </div>
            <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">Hover to preview · click bottom-right cell of your size</div>
        </div>

        <div style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Color</label>
                <button class="btn" onclick="_lumiaPickColor(null)" style="font-size:11px;padding:4px 10px">Default (no color)</button>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <label class="lumia-color-input-wrap" style="background:${currentColor}">
                    <span style="color:#fff;font-size:11px;font-weight:600;letter-spacing:.05em">PICK COLOR</span>
                    <input type="color" id="lumiaColorInput" value="${currentColor}" onchange="_lumiaPickColor(this.value)" oninput="_lumiaPickColor(this.value)" />
                </label>
                <div id="lumiaColorReadout" style="font-family:monospace;font-size:13px;color:var(--text-1)">${tile.color || 'Default'}</div>
            </div>
            <div class="lumia-color-picker">${swatchHtml}</div>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px">
            <button class="btn" style="color:var(--danger);" onclick="removeLumiaTile('${uid}', true)">Remove tile</button>
            <div style="display:flex;gap:10px">
                <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
                <button class="btn primary" onclick="_lumiaSaveTileEdits('${uid}')">Save</button>
            </div>
        </div>
    `;
    window._lumiaEditDraft = { w: tile.w, h: tile.h, color: tile.color || null };
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Highlight a W×H rectangle on hover in the size picker
window._lumiaSzHover = function (w, h) {
    const picker = document.getElementById('lumiaSzPicker');
    if (!picker) return;
    picker.querySelectorAll('.lumia-sz-cell').forEach(cell => {
        const cw = Number(cell.dataset.w), ch = Number(cell.dataset.h);
        cell.classList.toggle('is-hover', w > 0 && cw <= w && ch <= h);
    });
};

window._lumiaPickWH = function (w, h) {
    window._lumiaEditDraft = window._lumiaEditDraft || {};
    window._lumiaEditDraft.w = w;
    window._lumiaEditDraft.h = h;
    const readout = document.getElementById('lumiaSzReadout');
    if (readout) readout.textContent = `${w} × ${h}`;
    document.querySelectorAll('#lumiaSzPicker .lumia-sz-cell').forEach(cell => {
        const cw = Number(cell.dataset.w), ch = Number(cell.dataset.h);
        cell.classList.toggle('is-selected', cw <= w && ch <= h);
    });
};

window._lumiaPickColor = function (color) {
    window._lumiaEditDraft = window._lumiaEditDraft || {};
    window._lumiaEditDraft.color = color ? color.toUpperCase() : null;
    const readout = document.getElementById('lumiaColorReadout');
    if (readout) readout.textContent = color ? color.toUpperCase() : 'Default';
    const input = document.getElementById('lumiaColorInput');
    const wrap = input?.closest('.lumia-color-input-wrap');
    if (color && input) {
        input.value = color;
        if (wrap) wrap.style.background = color;
    } else if (wrap) {
        wrap.style.background = '#E5E7EB';
    }
    document.querySelectorAll('.lumia-color-opt').forEach(el => {
        el.classList.toggle('is-selected', color && el.dataset.color.toUpperCase() === color.toUpperCase());
    });
};

window._lumiaSaveTileEdits = async function (uid) {
    const tiles = getLumiaConfig();
    const tile = tiles.find(t => t.uid === uid);
    if (!tile) return;
    const labelInput = document.getElementById('lumiaEditLabel');
    const newLabel = labelInput ? labelInput.value.trim() : '';
    const draft = window._lumiaEditDraft || {};
    if (draft.w) tile.w = draft.w;
    if (draft.h) tile.h = draft.h;
    if (draft.color === null) delete tile.color;
    else if (draft.color) tile.color = draft.color;
    const cat = getCatalogEntry(tile.catalogId);
    if (newLabel && cat && newLabel !== cat.label) tile.customLabel = newLabel;
    else delete tile.customLabel;
    await saveLumiaConfig(tiles);
    document.getElementById('universalModal').classList.add('hidden');
    if (typeof renderDashboard === 'function') renderDashboard();
};

window.removeLumiaTile = async function (uid, fromModal) {
    if (fromModal && !confirm('Remove this tile?')) return;
    const tiles = getLumiaConfig().filter(t => t.uid !== uid);
    await saveLumiaConfig(tiles);
    if (fromModal) document.getElementById('universalModal').classList.add('hidden');
    if (typeof renderDashboard === 'function') renderDashboard();
};

window.openLumiaTilePicker = function () {
    const tiles = getLumiaConfig();
    // Map catalogId → uid of the FIRST instance on the dashboard
    const usedMap = new Map();
    tiles.forEach(t => { if (!usedMap.has(t.catalogId)) usedMap.set(t.catalogId, t.uid); });
    const categories = [...new Set(LUMIA_TILE_CATALOG.map(c => c.category))];
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    box.innerHTML = `
        <h3 style="margin:0 0 4px 0;font-weight:700">Manage tiles</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px 0">Tap to add. Items already on your dashboard show a Remove button.</p>
        <div style="max-height:60vh;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${categories.map(cat => `
            <div style="margin-bottom:14px">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">${cat}</div>
                <div class="lumia-picker-grid">
                    ${LUMIA_TILE_CATALOG.filter(c => c.category === cat).map(c => {
                        const usedUid = usedMap.get(c.id);
                        if (usedUid) {
                            // Already on dashboard → show row with Remove button
                            return `
                            <div class="lumia-picker-opt lumia-picker-opt--used">
                                <span class="lumia-picker-opt__icon">
                                    ${renderIcon(c.icon || 'sparkle', null, 'style="width:18px"')}
                                </span>
                                <span class="lumia-picker-opt__label">${c.label}</span>
                                <button class="lumia-picker-opt__remove" title="Remove from dashboard"
                                    onclick="event.stopPropagation();_lumiaRemoveFromPicker('${usedUid}')">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    <span>Remove</span>
                                </button>
                            </div>`;
                        }
                        return `
                        <button class="lumia-picker-opt" onclick="_lumiaAddTile('${c.id}')">
                            <span class="lumia-picker-opt__icon">
                                ${renderIcon(c.icon || 'sparkle', null, 'style="width:18px"')}
                            </span>
                            <span class="lumia-picker-opt__label">${c.label}</span>
                            <span class="lumia-picker-opt__add-hint">+ Add</span>
                        </button>`;
                    }).join('')}
                </div>
            </div>
        `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
            <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
        </div>
    `;
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Remove called from the picker — re-renders the picker after so the user
// sees the change and can keep managing tiles in one place.
window._lumiaRemoveFromPicker = async function (uid) {
    const tiles = getLumiaConfig().filter(t => t.uid !== uid);
    await saveLumiaConfig(tiles);
    if (typeof renderDashboard === 'function') renderDashboard();
    // Re-open picker so user can continue managing
    setTimeout(() => window.openLumiaTilePicker(), 0);
};

window._lumiaAddTile = async function (catalogId) {
    const cat = getCatalogEntry(catalogId);
    if (!cat) return;
    const tiles = getLumiaConfig();
    const uid = 't' + Date.now() + Math.floor(Math.random() * 1000);
    // Default W×H by kind — picked to look reasonable on first add
    let w = 2, h = 2;
    if (cat.kind === 'widget') { w = 4; h = 2; }
    else if (cat.kind === 'kpi') { w = 2; h = 2; }
    else { w = 1; h = 1; }
    tiles.push({ uid, catalogId, w, h });
    await saveLumiaConfig(tiles);
    document.getElementById('universalModal').classList.add('hidden');
    if (typeof renderDashboard === 'function') renderDashboard();
};

window.resetLumiaTiles = async function () {
    if (!confirm('Reset dashboard tiles to defaults?')) return;
    const def = resetLumiaConfig();
    await saveLumiaConfig(def);
    if (typeof renderDashboard === 'function') renderDashboard();
};

// ─── Instant-feedback handlers for dashboard tiles ────────────────────────
// The base toggleHabitOptimistic / toggleTaskOptimistic functions re-render
// the dedicated Habits / Tasks pages, but NOT the dashboard widget. So the
// dashboard checkbox visual stays stale until something else triggers a render.
// These helpers flip the DOM synchronously for instant feedback, then hand
// off to the original optimistic toggle for data + sheet sync.

window._tileHabitToggle = async function (cellEl, habitId) {
    console.log('[HabitToggle] click', { habitId, cellEl });
    if (!cellEl) { console.warn('[HabitToggle] no cellEl'); return; }
    const check = cellEl.querySelector('.hg-check');
    if (!check) { console.warn('[HabitToggle] no .hg-check inside cell'); return; }
    const goingDone = !check.classList.contains('is-done');
    // Instant visual flip
    check.classList.toggle('is-done', goingDone);
    check.innerHTML = goingDone
        ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
    console.log('[HabitToggle] visual flipped, goingDone=', goingDone);
    // Update day-score % for today's row
    const row = cellEl.closest('.hg-row');
    if (row) {
        const cells = row.querySelectorAll('.hg-cell .hg-check');
        const done = row.querySelectorAll('.hg-check.is-done').length;
        const total = cells.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const pctEl = row.querySelector('.hg-score-pct');
        if (pctEl) pctEl.textContent = pct + '%';
        const fillEl = row.querySelector('.hg-score-fill');
        if (fillEl) fillEl.style.width = pct + '%';
    }
    // Do the data write DIRECTLY (not via view-habits.js's toggleHabitOptimistic).
    try {
        if (typeof window.apiCall !== 'function') {
            console.error('[HabitToggle] window.apiCall is not a function!');
            return;
        }
        if (!state.data.habit_logs) state.data.habit_logs = [];
        const today = new Date().toISOString().slice(0, 10);
        const existingIdx = state.data.habit_logs.findIndex(
            l => String(l.habit_id) === String(habitId) && (l.date || '').startsWith(today)
        );
        if (existingIdx !== -1) {
            const toDelete = state.data.habit_logs[existingIdx];
            console.log('[HabitToggle] DELETING habit_log id=', toDelete.id);
            state.data.habit_logs.splice(existingIdx, 1);
            const r = await window.apiCall('delete', 'habit_logs', {}, toDelete.id);
            console.log('[HabitToggle] delete result:', r);
        } else {
            const tempId = 'temp-' + Date.now() + Math.floor(Math.random() * 1000);
            const payload = { habit_id: habitId, date: today, status: 'completed' };
            console.log('[HabitToggle] CREATING habit_log', payload);
            state.data.habit_logs.push({ id: tempId, ...payload });
            const result = await window.apiCall('create', 'habit_logs', payload);
            console.log('[HabitToggle] create result:', result);
            const log = state.data.habit_logs.find(l => l.id === tempId);
            if (log && result && result.data && result.data.id) log.id = result.data.id;
        }
        if (typeof window.triggerHapticBuzz === 'function') window.triggerHapticBuzz();
    } catch (e) {
        console.error('[HabitToggle] WRITE FAILED', e);
    }
};

// Lazy-load a view module's JS, then call one of its modal/export functions.
// Lets dashboard widgets open Tasks/Habits/etc. modals without leaving the page.
window._dashOpenModal = async function (viewName, modalFn, ...args) {
    try {
        if (typeof window.ensureViewLoaded === 'function') {
            await window.ensureViewLoaded(viewName);
        }
        const fn = window[modalFn];
        if (typeof fn === 'function') {
            fn(...args);
        } else {
            console.warn('[Dashboard] modal function not loaded yet:', modalFn);
            if (typeof showToast === 'function') showToast('Loading…');
        }
    } catch (e) {
        console.error('[Dashboard] _dashOpenModal failed', e);
    }
};

window._tileTaskToggle = async function (checkEl, taskId) {
    console.log('[TaskToggle] click', { taskId, checkEl });
    if (!checkEl) { console.warn('[TaskToggle] no checkEl'); return; }
    const goingDone = !checkEl.classList.contains('is-done');
    checkEl.classList.toggle('is-done', goingDone);
    checkEl.innerHTML = goingDone
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
    const row = checkEl.closest('.tl-row');
    if (row) row.style.opacity = goingDone ? '0.45' : '1';
    console.log('[TaskToggle] visual flipped, goingDone=', goingDone);
    try {
        if (typeof window.apiCall !== 'function') {
            console.error('[TaskToggle] window.apiCall is not a function!');
            return;
        }
        const t = (state.data.tasks || []).find(x => String(x.id) === String(taskId));
        if (!t) { console.warn('[TaskToggle] task not in state.data.tasks, id=', taskId); return; }
        const newStatus = goingDone ? 'completed' : 'pending';
        t.status = newStatus;
        console.log('[TaskToggle] UPDATING task id=', taskId, 'status=', newStatus);
        const result = await window.apiCall('update', 'tasks', { status: newStatus }, taskId);
        console.log('[TaskToggle] update result:', result);
        if (typeof window.triggerHapticBuzz === 'function') window.triggerHapticBuzz();
        if (!result || result.success === false) {
            t.status = goingDone ? 'pending' : 'completed';
            checkEl.classList.toggle('is-done', !goingDone);
            checkEl.innerHTML = '';
            if (row) row.style.opacity = '1';
            if (typeof showToast === 'function') showToast('Error updating task');
        }
    } catch (e) {
        console.error('[TaskToggle] WRITE FAILED', e);
    }
};

/* Reads from (in priority order):
 *  1. state.data.settings[0].bento_config  (Google Sheet — source of truth)
 *  2. localStorage.bentoConfig             (fast cache + offline)
 *  3. BENTO_DEFAULTS                       (built-in fallback)
 * The Sheet wins so cross-device sync works, but localStorage gives instant
 * apply before the sheet round-trips. */
function getBentoConfig() {
    const tryParse = (raw) => {
        if (!raw) return null;
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!parsed || typeof parsed !== 'object') return null;
            return {
                enabled: parsed.enabled !== undefined ? parsed.enabled : BENTO_DEFAULTS.enabled,
                row1: { ...BENTO_DEFAULTS.row1, ...(parsed.row1 || {}) },
                row3: { ...BENTO_DEFAULTS.row3, ...(parsed.row3 || {}) },
                hero: Array.isArray(parsed.hero) && parsed.hero.length === 4
                    ? parsed.hero
                    : JSON.parse(JSON.stringify(BENTO_DEFAULTS.hero))
            };
        } catch (e) { return null; }
    };
    // 1. Sheet
    const sheetCfg = tryParse(window.state?.data?.settings?.[0]?.bento_config);
    if (sheetCfg) return sheetCfg;
    // 2. localStorage
    try {
        const localCfg = tryParse(localStorage.getItem('bentoConfig'));
        if (localCfg) return localCfg;
    } catch (e) {}
    // 3. Defaults
    return JSON.parse(JSON.stringify(BENTO_DEFAULTS));
}

/* Saves bento config to BOTH localStorage (instant) and the Google Sheet
 * (via the existing settings update endpoint). */
function saveBentoConfig(config) {
    // Local cache — applies immediately
    try { localStorage.setItem('bentoConfig', JSON.stringify(config)); } catch (e) {}

    // Sheet persistence
    const settings = window.state?.data?.settings?.[0];
    const settingsId = settings?.id;
    if (settingsId && typeof apiCall === 'function') {
        const payload = { bento_config: JSON.stringify(config) };
        // Optimistic local update
        if (settings) settings.bento_config = payload.bento_config;
        apiCall('update', 'settings', payload, settingsId)
            .then(() => {
                if (typeof showToast === 'function') showToast('Bento saved');
            })
            .catch(err => {
                console.warn('[Bento] Sheet save failed:', err?.message || err);
                if (typeof showToast === 'function') showToast('Saved locally (sheet sync failed)');
            });
    } else {
        if (typeof showToast === 'function') showToast('Bento saved (local only)');
    }
}

window.resetBentoConfig = function () {
    try { localStorage.removeItem('bentoConfig'); } catch (e) {}
    const settings = window.state?.data?.settings?.[0];
    if (settings) settings.bento_config = '';
    const settingsId = settings?.id;
    if (settingsId && typeof apiCall === 'function') {
        apiCall('update', 'settings', { bento_config: '' }, settingsId).catch(() => {});
    }
    renderDashboard();
    if (typeof showToast === 'function') showToast('Bento reset to defaults');
};

// Finds a widget in the grid by ID (data-widget-id first, then class fallback)
function findBentoWidget(grid, widgetId) {
    if (!widgetId || widgetId === 'empty') return null;
    let el = grid.querySelector(`[data-widget-id="${widgetId}"]`);
    if (el) return el;
    const classMap = {
        morning:      '.morning-hero',
        yearProgress: '.year-progress-widget, #yearProgressCard',
        aiBriefing:   '#aiBriefingCard',
        dailyTools:   '.daily-tools-widget',
        vision:       '.vision-banner',
        theNow:       '#theNowCard',
        cashflow:     '#widget-cashflow',
        today:        '#widget-today',
        dailyAffirmation: '.affirmation-widget-card'
    };
    if (classMap[widgetId]) {
        el = grid.querySelector(classMap[widgetId]);
        if (el) return el;
    }
    return null;
}

/* Find the direct child of `grid` that contains `descendant`, or descendant
 * itself if it is already a direct child. Returns null if descendant isn't
 * inside grid at all. */
function getGridDirectChild(grid, descendant) {
    let node = descendant;
    while (node && node.parentNode !== grid) node = node.parentNode;
    return node;
}

function positionBentoWidget(grid, widgetId, gridColumn) {
    const el = findBentoWidget(grid, widgetId);
    if (!el) return null;
    // CSS Grid only honors grid-column on DIRECT children. If the widget is
    // wrapped, we must set the style on the wrapper instead.
    const target = getGridDirectChild(grid, el) || el;
    target.style.gridColumn = gridColumn;
    target.dataset.bentoSlotted = '1';
    return target;  // Return the slotted (top-level) element for anchor use
}

function applyBentoLayout() {
    const grid = document.querySelector('.dash-grid');
    if (!grid) return;

    const config = getBentoConfig();

    // If disabled, strip any bento-specific bits and bail
    if (!config.enabled) {
        grid.classList.remove('dash-grid--bento');
        grid.querySelectorAll('.bento-hero-stats').forEach(el => el.remove());
        grid.querySelectorAll('.kpi-collapsible').forEach(wrap => {
            const inner = wrap.querySelector('.kpi-grid, .kpi-scroll');
            if (inner) wrap.parentNode.insertBefore(inner, wrap);
            wrap.remove();
        });
        // Clear all inline gridColumn we may have set
        grid.querySelectorAll('[data-bento-slotted="1"]').forEach(el => {
            el.style.gridColumn = '';
            delete el.dataset.bentoSlotted;
        });
        return;
    }

    grid.classList.add('dash-grid--bento');

    // Clear previous inline positioning so a reconfigure works
    grid.querySelectorAll('[data-bento-slotted="1"]').forEach(el => {
        el.style.gridColumn = '';
        delete el.dataset.bentoSlotted;
    });

    // ---- Row 1: pin widgets to absolute cells ----
    const r1Left  = positionBentoWidget(grid, config.row1.left,  '1 / 9');
    const r1Right = positionBentoWidget(grid, config.row1.right, '9 / 13');

    // ---- Row 2: hero stats (rebuild every apply so config edits show) ----
    let heroRow = grid.querySelector('.bento-hero-stats');
    if (!heroRow) {
        heroRow = document.createElement('div');
        heroRow.className = 'bento-hero-stats';

        // The widget anchor returned by positionBentoWidget might be nested
        // inside a wrapper — not a direct child of grid. Walk up the tree
        // until we reach a direct child of grid (or null). THAT is the node
        // we can call grid.insertBefore() with.
        const findDirectChildOfGrid = (el) => {
            let node = el;
            while (node && node.parentNode !== grid) node = node.parentNode;
            return node;  // null if el isn't inside grid at all
        };
        const anchorTopLevel = findDirectChildOfGrid(r1Right) || findDirectChildOfGrid(r1Left);

        if (anchorTopLevel && anchorTopLevel.nextSibling) {
            grid.insertBefore(heroRow, anchorTopLevel.nextSibling);
        } else if (anchorTopLevel) {
            grid.appendChild(heroRow);
        } else if (grid.firstChild) {
            // No anchor found — drop the hero strip at the top of the grid.
            grid.insertBefore(heroRow, grid.firstChild);
        } else {
            grid.appendChild(heroRow);
        }
    }
    heroRow.innerHTML = config.hero.map(renderBentoHeroCell).join('');

    // ---- Row 3: pin widgets to absolute cells ----
    positionBentoWidget(grid, config.row3.left,  '1 / 7');
    positionBentoWidget(grid, config.row3.right, '7 / 13');

    // ---- Collapsible KPI section ----
    const kpiGrid = grid.querySelector('.kpi-grid, .kpi-scroll');
    if (kpiGrid && !kpiGrid.closest('.kpi-collapsible')) {
        const wrap = document.createElement('div');
        wrap.className = 'kpi-collapsible collapsed';
        const btn = document.createElement('button');
        btn.className = 'kpi-show-more';
        btn.type = 'button';
        btn.innerHTML = '<span>+ Show all metrics</span>';
        btn.addEventListener('click', () => {
            wrap.classList.toggle('collapsed');
            btn.querySelector('span').textContent =
                wrap.classList.contains('collapsed') ? '+ Show all metrics' : '− Hide metrics';
        });
        kpiGrid.parentNode.insertBefore(wrap, kpiGrid);
        wrap.appendChild(btn);
        wrap.appendChild(kpiGrid);
    }
}

function renderBentoHeroCell(cell) {
    const data = computeBentoStat(cell.stat);
    const accentCls = cell.accent ? ' hero-stat--accent' : '';
    const route = cell.route || 'dashboard';
    return `
        <div class="hero-stat${accentCls}" onclick="routeTo('${route}')" role="button" tabindex="0">
            <div class="hero-stat__label">${cell.label || ''}</div>
            <div class="hero-stat__value">${data.value}</div>
            <div class="hero-stat__sub">${data.sub}</div>
        </div>`;
}

function computeBentoStat(statId) {
    const s = window.state?.data || {};
    const tasks = s.tasks || [];
    const expenses = s.expenses || [];
    const habits = s.habits || [];
    const habitLogs = s.habit_logs || [];
    const diary = s.diary || [];
    const today = new Date().toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);

    switch (statId) {
        case 'tasksDone': {
            const monthTasks = tasks.filter(t => t.due_date && t.due_date >= monthKey + '-01' && t.due_date <= today);
            const done = monthTasks.filter(t => t.status === 'completed').length;
            const pct = monthTasks.length ? Math.round((done / monthTasks.length) * 100) : 0;
            return { value: pct + '%', sub: `${done} of ${monthTasks.length} this month` };
        }
        case 'monthSpend': {
            const total = expenses
                .filter(e => (e.type || 'expense') === 'expense' && e.date && e.date.startsWith(monthKey))
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            return { value: '₹' + total.toLocaleString('en-IN'), sub: monthKey };
        }
        case 'weeklySpend': {
            const ws = new Date(); ws.setDate(ws.getDate() - 6);
            const wsKey = ws.toISOString().slice(0, 10);
            const total = expenses
                .filter(e => (e.type || 'expense') === 'expense' && e.date && e.date >= wsKey && e.date <= today)
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            return { value: '₹' + total.toLocaleString('en-IN'), sub: 'last 7 days' };
        }
        case 'habits': {
            const total = habits.length;
            const seen = new Set();
            habitLogs.forEach(l => {
                if (l.date && l.date.startsWith(today)) seen.add(String(l.habit_id));
            });
            return { value: `${seen.size}/${total}`, sub: 'today' };
        }
        case 'habitScore': {
            const last7 = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(); d.setDate(d.getDate() - i);
                last7.push(d.toISOString().slice(0, 10));
            }
            const total7 = habits.length * 7;
            const done7 = habitLogs.filter(l => l.date && last7.some(d => l.date.startsWith(d))).length;
            const pct = total7 ? Math.round((done7 / total7) * 100) : 0;
            return { value: pct + '%', sub: 'last 7 days' };
        }
        case 'streak': {
            const dates = new Set(diary.map(d => (d.date || '').slice(0, 10)).filter(Boolean));
            let streak = 0;
            let cursor = new Date();
            while (dates.has(cursor.toISOString().slice(0, 10))) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            }
            return { value: String(streak), sub: 'days journaling' };
        }
        case 'yearProgress': {
            const start = new Date(new Date().getFullYear(), 0, 1);
            const day = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
            const yr = new Date().getFullYear();
            const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || (yr % 400 === 0);
            const total = isLeap ? 366 : 365;
            return { value: Math.round((day / total) * 100) + '%', sub: `${day}/${total}` };
        }
        case 'netWorth': {
            const assets = (s.assets || []).reduce((sum, a) => sum + (Number(a.value) || 0), 0);
            const funds = (s.funds || []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
            return { value: '₹' + (assets + funds).toLocaleString('en-IN'), sub: 'assets + funds' };
        }
        default:
            return { value: '—', sub: '' };
    }
}

// ============================================================================
// BENTO CUSTOMIZE MODAL
// ============================================================================
window.openBentoCustomize = function () {
    const cfg = getBentoConfig();
    const widgetOpts = (selected) => BENTO_WIDGET_OPTIONS.map(o =>
        `<option value="${o.id}"${o.id === selected ? ' selected' : ''}>${o.label}</option>`).join('');
    const statOpts = (selected) => BENTO_HERO_STATS.map(o =>
        `<option value="${o.id}"${o.id === selected ? ' selected' : ''}>${o.label}</option>`).join('');
    const routeOpts = (selected) => [
        'dashboard','tasks','finance','habits','diary','vision','lifeCalendar','notes','people','books','mural'
    ].map(r => `<option value="${r}"${r === selected ? ' selected' : ''}>${r}</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay bento-customize-overlay';
    modal.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index:10000;';
    modal.innerHTML = `
        <div class="modal-box bento-customize-modal" style="max-width:640px; width:92%; max-height:88vh; overflow-y:auto;">
            <div class="bento-cust-header">
                <h2>Customize Bento</h2>
                <button class="bento-cust-close" onclick="this.closest('.modal-overlay').remove()" aria-label="Close">✕</button>
            </div>

            <label class="bento-cust-toggle">
                <input type="checkbox" id="bento-enabled" ${cfg.enabled ? 'checked' : ''}>
                <span>Enable bento layout on desktop</span>
            </label>

            <div class="bento-cust-section">
                <div class="bento-cust-label">Row 1 — Greeting strip (8 + 4 cols)</div>
                <div class="bento-cust-row2">
                    <div>
                        <div class="bento-cust-mini">Left (8 cols)</div>
                        <select id="bento-r1-left">${widgetOpts(cfg.row1.left)}</select>
                    </div>
                    <div>
                        <div class="bento-cust-mini">Right (4 cols)</div>
                        <select id="bento-r1-right">${widgetOpts(cfg.row1.right)}</select>
                    </div>
                </div>
            </div>

            <div class="bento-cust-section">
                <div class="bento-cust-label">Row 2 — Hero stat strip (4 equal cells)</div>
                ${cfg.hero.map((h, i) => `
                    <div class="bento-cust-hero">
                        <div class="bento-cust-mini">Stat ${i + 1}</div>
                        <div class="bento-cust-hero-grid">
                            <select id="bento-hero-${i}-stat">${statOpts(h.stat)}</select>
                            <input type="text" id="bento-hero-${i}-label" value="${h.label || ''}" placeholder="Label" maxlength="20">
                            <select id="bento-hero-${i}-route">${routeOpts(h.route)}</select>
                            <label class="bento-cust-accent-toggle">
                                <input type="checkbox" id="bento-hero-${i}-accent" ${h.accent ? 'checked' : ''}>
                                <span>Yellow</span>
                            </label>
                        </div>
                    </div>`).join('')}
            </div>

            <div class="bento-cust-section">
                <div class="bento-cust-label">Row 3 — Briefing + Tools (6 + 6 cols)</div>
                <div class="bento-cust-row2">
                    <div>
                        <div class="bento-cust-mini">Left (6 cols)</div>
                        <select id="bento-r3-left">${widgetOpts(cfg.row3.left)}</select>
                    </div>
                    <div>
                        <div class="bento-cust-mini">Right (6 cols)</div>
                        <select id="bento-r3-right">${widgetOpts(cfg.row3.right)}</select>
                    </div>
                </div>
            </div>

            <div class="bento-cust-footer">
                <button class="btn secondary" onclick="resetBentoConfig(); this.closest('.modal-overlay').remove();">Reset to defaults</button>
                <button class="btn primary" onclick="saveBentoCustomize()">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window.saveBentoCustomize = function () {
    const $ = (sel) => document.querySelector(sel);
    const cfg = {
        enabled: $('#bento-enabled').checked,
        row1: { left: $('#bento-r1-left').value, right: $('#bento-r1-right').value },
        row3: { left: $('#bento-r3-left').value, right: $('#bento-r3-right').value },
        hero: [0, 1, 2, 3].map(i => ({
            stat:   $(`#bento-hero-${i}-stat`).value,
            label:  $(`#bento-hero-${i}-label`).value.trim() ||
                    (BENTO_HERO_STATS.find(s => s.id === $(`#bento-hero-${i}-stat`).value) || {}).label || '',
            accent: $(`#bento-hero-${i}-accent`).checked,
            route:  $(`#bento-hero-${i}-route`).value
        }))
    };
    saveBentoConfig(cfg);
    document.querySelector('.bento-customize-overlay')?.remove();
    renderDashboard();
};

function renderDashboard() {
  const main = document.getElementById('main');
  const config = getDashConfig();


  // --- DATA AGGREGATION ---
  const tasks = state.data.tasks || [];
  const pending = tasks.filter(t => t.status !== 'completed');
  const highPriority = pending.filter(t => t.priority === 'P1').slice(0, 3);
  const completionRate = tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0;

  const expenses = state.data.expenses || [];
  const assets = state.data.assets || [];

  const currentMonth = new Date().getMonth();
  const monthExp = expenses
    .filter(e => e.type === 'expense' && new Date(e.date).getMonth() === currentMonth)
    .reduce((s, e) => s + Number(e.amount), 0);

  const netWorth = assets.reduce((s, a) => s + Number(a.value), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const events = (state.data.planner || [])
    .filter(e => e.start_datetime)
    .filter(e => {
      const d = new Date(e.start_datetime);
      if (isNaN(d.getTime())) return false;
      const eventDate = d.toISOString().split('T')[0];
      return eventDate === todayStr;
    })
    .sort((a, b) => (a.start_datetime || 0) - (b.start_datetime || 0));

  const goals = state.data.vision || [];
  const nextGoal = [...goals].sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))[0];

  // --- SECTION RENDERERS ---
  const sectionRenderers = {
    yearProgress: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const diff = now - start;
      const oneDay = 1000 * 60 * 60 * 24;
      const daysPassed = Math.floor(diff / oneDay);
      const isLeap = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || (now.getFullYear() % 400 === 0);
      const totalDays = isLeap ? 366 : 365;

      return `
      <div class="widget-card year-progress-widget" id="yearProgressCard" data-widget-id="yearProgress" style="margin-bottom: 16px; background: linear-gradient(135deg, var(--surface-1), var(--surface-2)); border: 1px solid var(--border-color); border-radius: 20px; overflow: hidden; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
         <div style="position: absolute; top:0; left:0; width:100%; height:4px; background: var(--surface-3);">
            <div style="height:100%; width: ${(daysPassed / totalDays) * 100}%; background: var(--primary); border-radius: 4px;"></div>
         </div>
         <div class="widget-body" style="display:flex; align-items:center; justify-content:space-between; padding: 20px;">
            <div style="display:flex; align-items:center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 14px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                   ${renderIcon('calendar', null, 'style="width:22px;"')}
                </div>
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); font-weight: 700;">Year Progress</div>
                  <div style="font-size: 22px; font-weight: 800; margin-top: 2px; color: var(--text-main);"><span style="color:var(--primary);">${daysPassed}</span><span style="font-size:16px; color:var(--text-muted);">/${totalDays}</span></div>
                </div>
            </div>
            <button class="btn primary ui-polish hover-lift" onclick="routeTo('lifeCalendar')" style="padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 700; display:flex; align-items:center; gap:8px; box-shadow: 0 4px 12px var(--primary-glow);">
               View Life ${renderIcon('insights', null, 'style="width:16px; color:white;"')}
            </button>
         </div>
      </div>
      `;
    },

    theNow: () => {
      // Tasks: P1 or due today
      const nowTasks = pending.filter(t => t.priority === 'P1' || (t.due_date && t.due_date <= todayStr)).slice(0, 3);
      const tasksStr = nowTasks.length > 0 ? nowTasks.map(t => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="routeTo('tasks')">
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <div style="width:12px; height:12px; flex-shrink:0; border-radius:50%; border:2px solid var(--primary);"></div>
            <span style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.title}</span>
          </div>
          <span style="font-size:10px; font-weight:700; color:var(--primary); background:var(--primary-soft); padding:2px 6px; border-radius:4px; flex-shrink:0;">${t.priority}</span>
        </div>
      `).join('') : '<div style="font-size:13px; color:var(--text-muted); padding:8px 0; font-style:italic;">No urgent tasks.</div>';

      // Habits: Due today & not completed
      const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      const nowHabits = (state.data.habits || []).filter(h => {
        if (h.frequency && h.frequency !== 'daily' && !h.frequency.includes(todayDayName)) return false;
        if (!h.history) return true;
        try {
          const hist = typeof h.history === 'string' ? JSON.parse(h.history) : h.history;
          return !hist.includes(todayStr);
        } catch (e) { return true; }
      }).slice(0, 3);
      const habitsStr = nowHabits.length > 0 ? nowHabits.map(h => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="routeTo('habits')">
          <div style="font-size:16px; flex-shrink:0;">${h.icon || '🔥'}</div>
          <span style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.habit_name || h.name || 'Unnamed Habit'}</span>
        </div>
      `).join('') : '<div style="font-size:13px; color:var(--text-muted); padding:8px 0; font-style:italic;">All habits done!</div>';

      // Events: Next 3 today
      const nowEvents = events.slice(0, 3);
      const eventsStr = nowEvents.length > 0 ? nowEvents.map(e => {
        let timeStr = 'All Day';
        if (e.start_datetime) {
          const d = new Date(e.start_datetime);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase().replace(' ', '');
        }
        return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="routeTo('calendar')">
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <div style="width:4px; height:12px; border-radius:2px; background:var(--info); flex-shrink:0;"></div>
            <span style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.title}</span>
          </div>
          <span style="font-size:10px; font-weight:700; color:var(--text-muted); flex-shrink:0;">${timeStr}</span>
        </div>
        `;
      }).join('') : '<div style="font-size:13px; color:var(--text-muted); padding:8px 0; font-style:italic;">No upcoming events.</div>';

      const isCollapsed = window.dashWidgetStates['theNow'] === 'collapsed';
      const stateClass = isCollapsed ? 'collapsed' : '';

      // Only show if there is actually something to do, but typically you always want to show it.
      return `
      <div class="widget-card ${stateClass}" id="theNowCard" data-widget-id="theNow" style="margin-bottom: 16px;">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('goals', null, 'style="width:18px; margin-right:6px; color:var(--primary);"')} The Now</div>
            <div style="display:flex; align-items:center; gap:10px">
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body">
            <div style="background:var(--surface-1); border-radius:var(--bento-radius-xl); padding:2px 4px; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:24px;">
              
              <!-- Tasks Col -->
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                  ${renderIcon('check', null, 'style="width:16px; color:var(--primary);"')}
                  <span style="font-size:14px; font-weight:700;">Tasks</span>
                </div>
                <div style="display:flex; flex-direction:column;">${tasksStr}</div>
              </div>

              <!-- Habits Col -->
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                  ${renderIcon('repeat', null, 'style="width:16px; color:var(--warning);"')}
                  <span style="font-size:14px; font-weight:700;">Habits</span>
                </div>
                <div style="display:flex; flex-direction:column;">${habitsStr}</div>
              </div>

               <!-- Events Col -->
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                  ${renderIcon('calendar', null, 'style="width:16px; color:var(--info);"')}
                  <span style="font-size:14px; font-weight:700;">Events</span>
                </div>
                <div style="display:flex; flex-direction:column;">${eventsStr}</div>
              </div>

            </div>
         </div>
      </div>
      `;
    },

    morning: () => {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
      const settings = state.data.settings?.[0] || {};
      const name = settings.name || settings.user_name || "User";

      // Get custom messages or use defaults
      let message;
      if (h < 12) {
        message = settings.morning_message || "Review your plan for the day.";
      } else if (h < 18) {
        message = settings.afternoon_message || "Stay focused on your goals.";
      } else {
        message = settings.evening_message || "Great work today!";
      }

      return `
        <div class="morning-hero" style="min-height:0; display:flex; flex-direction:column; justify-content:center; padding:14px 20px; background: linear-gradient(135deg, var(--surface-1), var(--surface-2)); border-radius:20px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08); position:relative; overflow:hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div style="flex:1; min-width:0;">
                  <h1 class="fade-in" style="font-size:clamp(18px, 3vw, 24px); margin:0; letter-spacing:-0.5px; background: linear-gradient(90deg, var(--text-1), var(--primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${greeting}, ${name}.</h1>
                  <p class="fade-in stagger-1" style="font-size:12px; color:var(--text-3); margin:3px 0 0 0; opacity: 0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${message}</p>
                </div>
                 <!-- Compact Focus Button -->
                <button class="glass-panel fade-in stagger-2" style="padding:8px 14px; border-radius:12px; background:var(--primary); border:1px solid rgba(255,255,255,0.2); display:inline-flex; align-items:center; gap:8px; cursor:pointer; box-shadow: 0 4px 12px var(--primary-glow); color:white; flex-shrink:0; position:relative; z-index:3; touch-action:manipulation; -webkit-tap-highlight-color:transparent;" onclick="openFocusMode()">
                    ${renderIcon('goals', null, 'style="width:16px; color:white;"')}
                    <div style="pointer-events:none;">
                        <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.7px; color:rgba(255,255,255,0.8); font-weight:700;">Focus</div>
                        <div style="font-size:12px; font-weight:700;">Start</div>
                    </div>
                </button>
                
            </div>

            <!-- Background Decoration -->
            <div style="position:absolute; top:-50%; right:-10%; width:180px; height:180px; background:var(--primary); filter:blur(80px); opacity:0.12; border-radius:50%; pointer-events:none; z-index:0;"></div>
        </div>
      `;
    },

    vision: () => nextGoal ? `
      <div class="vision-banner" style="background-image: url('${nextGoal.image_url || 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80'}'); box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 12px 40px rgba(0,0,0,0.1); border-radius: 20px; overflow: hidden; margin-bottom: 16px;">
         <div class="vb-content" style="padding: 20px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:rgba(255,255,255,0.8); letter-spacing: 1px;">Primary Focus</div>
            <div style="font-size:22px; font-weight:700; margin:4px 0 6px 0;">${nextGoal.title}</div>
            <div style="font-size:13px; opacity:0.9">Target: ${nextGoal.target_date || 'Someday'}</div>
         </div>
      </div>` : '',

    aiBriefing: () => {
      const isCollapsed = window.dashWidgetStates['aiBriefing'] === 'collapsed';
      const stateClass = window.dashWidgetStates['aiBriefing'] === 'expanded' ? '' : 'collapsed';

      return `
      <div class="widget-card ai-widget ${stateClass}" id="aiBriefingCard" data-widget-id="aiBriefing" style="position:relative; overflow:hidden;">
         <!-- Animated Border -->
         <div style="position:absolute; inset:0; border-radius:inherit; padding:1px; background:linear-gradient(135deg, var(--primary), #818cf8, #c084fc, var(--primary)); background-size:300% 300%; animation: aiBorderFlow 3s ease infinite; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events:none;"></div>
         
         <!-- AI Glow Effect -->
         <div style="position:absolute; top:-50px; right:-50px; width:150px; height:150px; background:radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); border-radius:50%; pointer-events:none; animation: aiPulse 4s ease-in-out infinite;"></div>
         
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">
                <span style="position:relative;">
                    ${renderIcon('default', null, 'style="width:20px; margin-right:8px; color:var(--primary); animation: aiSparkle 2s ease-in-out infinite;"')}
                    <span style="position:absolute; top:0; left:0; width:100%; height:100%; background:var(--primary); filter:blur(8px); opacity:0.3; animation: aiGlow 2s ease-in-out infinite alternate;"></span>
                </span>
                Daily Briefing
            </div>
            <div style="display:flex; align-items:center; gap:12px">
                <button class="btn icon" onclick="event.stopPropagation(); generateDashboardInsight()" title="Refresh Insight" style="transition:transform 0.3s;">${renderIcon('refresh', null, 'style="width:14px"')}</button>
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body" style="padding-top: 8px;">
             <div id="aiContent" style="font-size:14px; line-height:1.7; color:var(--text-secondary)">
                <div style="display:flex; flex-direction:column; gap:12px; align-items:center; padding:12px 0;">
                   <div style="position:relative;">
                       <p style="text-align:center; color:var(--text-muted); margin:0;">Ready for your daily analysis?</p>
                   </div>
                   <button class="btn primary" onclick="generateDashboardInsight()" style="padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, var(--primary), #818cf8); box-shadow: 0 4px 15px rgba(99,102,241,0.4), 0 2px 4px rgba(0,0,0,0.1); position:relative; overflow:hidden; animation: aiFloat 3s ease-in-out infinite;">
                       <span style="position:relative; z-index:1; display:flex; align-items:center; gap:8px;">
                           ${renderIcon('priority', null, 'style="width:16px; animation: aiBolt 1.5s ease-in-out infinite;"')} 
                           Generate Insight
                       </span>
                       <span style="position:absolute; top:0; left:-100%; width:200%; height:100%; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: aiShine 3s ease-in-out infinite;"></span>
                   </button>
                </div>
             </div>
         </div>
      </div>
      <style>
        @keyframes aiBorderFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        @keyframes aiPulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes aiSparkle {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(10deg); }
        }
        @keyframes aiGlow {
            0% { opacity: 0.2; }
            100% { opacity: 0.5; }
        }
        @keyframes aiFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }
        @keyframes aiBolt {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        @keyframes aiShine {
            0% { left: -100%; }
            50%, 100% { left: 100%; }
        }
      </style>`;
    },

    kpis: () => {
      // Get KPI visibility config
      const kpiConfig = getKpiConfig();
      const visibleKpis = kpiConfig.filter(k => k.visible);

      // --- ADVANCED KPI CALCULATIONS ---
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      // Financial KPIs
      const monthIncome = expenses
        .filter(e => e.type === 'income' && new Date(e.date).getMonth() === currentMonth)
        .reduce((s, e) => s + Number(e.amount), 0);

      const avgDailySpend = monthExp > 0 ? Math.round(monthExp / (today.getDate())) : 0;

      const incomeExpenseRatio = monthIncome > 0 ? Math.round((monthIncome - monthExp) / monthIncome * 100) : 0;

      // Investment returns (if assets have purchase value)
      const totalInvestments = assets.filter(a => a.type === 'investment' || a.category?.toLowerCase().includes('investment'));
      const invCurrentValue = totalInvestments.reduce((s, a) => s + Number(a.value || 0), 0);
      const invPurchaseValue = totalInvestments.reduce((s, a) => s + Number(a.purchase_value || a.value || 0), 0);
      const invReturns = invPurchaseValue > 0 ? Math.round((invCurrentValue - invPurchaseValue) / invPurchaseValue * 100) : 0;

      // YTD Spending
      const ytdSpending = expenses
        .filter(e => e.type === 'expense' && new Date(e.date).getFullYear() === currentYear)
        .reduce((s, e) => s + Number(e.amount), 0);

      // Productivity KPIs
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const tasksThisWeek = completedTasks.filter(t => t.completed_at && new Date(t.completed_at) >= weekAgo).length;
      const taskVelocity = tasksThisWeek; // Tasks completed this week

      // Priority distribution
      const p1Tasks = pending.filter(t => t.priority === 'P1').length;
      const p2Tasks = pending.filter(t => t.priority === 'P2').length;
      const p3Tasks = pending.filter(t => t.priority === 'P3').length;
      const totalPending = p1Tasks + p2Tasks + p3Tasks;
      const p1Percent = totalPending > 0 ? Math.round(p1Tasks / totalPending * 100) : 0;

      // Habit KPIs
      const habits = state.data.habits || [];
      const habitCompletions = habits.map(h => {
        if (!h.history) return { id: h.id, name: h.habit_name || h.name, completed: 0, total: 30 };
        try {
          const hist = typeof h.history === 'string' ? JSON.parse(h.history) : h.history;
          const thisMonth = hist.filter(d => d.startsWith(currentYear + '-' + String(currentMonth + 1).padStart(2, '0'))).length;
          return { id: h.id, name: h.habit_name || h.name, completed: thisMonth, total: 30 };
        } catch (e) { return { id: h.id, name: h.habit_name || h.name, completed: 0, total: 30 }; }
      });

      const avgHabitScore = habitCompletions.length > 0
        ? Math.round(habitCompletions.reduce((s, h) => s + (h.completed / h.total * 100), 0) / habitCompletions.length)
        : 0;

      const bestHabit = habitCompletions.length > 0
        ? habitCompletions.reduce((best, h) => h.completed > (best?.completed || 0) ? h : best, habitCompletions[0])
        : null;

      const strugglingHabits = habitCompletions.filter(h => h.completed / h.total < 0.5).length;
      const habitDiversity = habits.length;

      // Weekly pattern - find best day
      const dayStats = {};
      habits.forEach(h => {
        if (!h.history) return;
        try {
          const hist = typeof h.history === 'string' ? JSON.parse(h.history) : h.history;
          hist.forEach(date => {
            const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
            dayStats[day] = (dayStats[day] || 0) + 1;
          });
        } catch (e) { }
      });
      const bestDay = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Lifestyle KPIs
      const people = state.data.people || [];
      const monthStart = new Date(currentYear, currentMonth, 1);
      const newContacts = people.filter(p => p.created_at && new Date(p.created_at) >= monthStart).length;

      // Interaction frequency (avg days between contacts)
      const contactsWithHistory = people.filter(p => p.interactions && p.interactions.length > 0);
      let avgInteractionDays = 0;
      if (contactsWithHistory.length > 0) {
        const totalDays = contactsWithHistory.reduce((s, p) => {
          const inters = typeof p.interactions === 'string' ? JSON.parse(p.interactions) : p.interactions;
          if (inters.length < 2) return s;
          const sorted = inters.sort();
          const daysDiff = (new Date(sorted[sorted.length - 1]) - new Date(sorted[0])) / (1000 * 60 * 60 * 24);
          return s + (daysDiff / (inters.length - 1));
        }, 0);
        avgInteractionDays = Math.round(totalDays / contactsWithHistory.length);
      }

      // Notes volume
      const notes = state.data.notes || [];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const notesThisWeek = notes.filter(n => n.created_at && new Date(n.created_at) >= weekStart).length;

      // Predictive KPIs
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const projectedMonthEnd = monthIncome - (avgDailySpend * daysInMonth);

      // Goal deadline risk
      const activeGoals = goals.filter(g => g.status !== 'achieved' && g.target_date);
      const atRiskGoals = activeGoals.filter(g => {
        if (!g.target_date || !g.progress) return false;
        const daysLeft = getDaysLeft(g.target_date);
        const progressNeeded = 100 - g.progress;
        const dailyNeeded = progressNeeded / (daysLeft || 1);
        return dailyNeeded > 5; // More than 5% per day = risk
      }).length;

      // --- TREND CALCULATIONS ---
      // Previous month expenses for comparison
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonthExp = expenses
        .filter(e => e.type === 'expense' && new Date(e.date).getMonth() === prevMonth && new Date(e.date).getFullYear() === prevYear)
        .reduce((s, e) => s + Number(e.amount), 0);
      const spendTrend = prevMonthExp > 0 ? Math.round((monthExp - prevMonthExp) / prevMonthExp * 100) : 0;

      // Previous week task velocity
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const tasksLastWeek = completedTasks.filter(t => t.completed_at && new Date(t.completed_at) >= twoWeeksAgo && new Date(t.completed_at) < weekAgo).length;
      const velocityTrend = tasksLastWeek > 0 ? Math.round((taskVelocity - tasksLastWeek) / tasksLastWeek * 100) : 0;

      // Category config
      const catMeta = {
        financial: { label: 'Finance', color: 'var(--primary)', bg: 'var(--primary-soft)' },
        productivity: { label: 'Productivity', color: 'var(--success)', bg: 'var(--success-soft)' },
        habits: { label: 'Habits', color: 'var(--warning)', bg: 'var(--warning-soft)' },
        lifestyle: { label: 'Lifestyle', color: 'var(--info, #0EA5E9)', bg: 'rgba(14, 165, 233, 0.15)' },
        predictive: { label: 'Predictive', color: 'var(--accent)', bg: 'rgba(167, 139, 250, 0.15)' }
      };

      // Render premium KPI card
      const renderKpiCard = (id, label, value, subValue, icon, color, route, opts = {}) => {
        if (!visibleKpis.find(k => k.id === id)) return '';
        const kpiCfg = kpiConfig.find(k => k.id === id);
        const cat = kpiCfg?.category || 'financial';
        const cm = catMeta[cat] || catMeta.financial;
        const trend = opts.trend;
        const trendUp = trend > 0;
        const trendDown = trend < 0;
        const trendIcon = trendUp ? '↑' : trendDown ? '↓' : '';
        const trendColor = opts.trendInvert
          ? (trendUp ? 'var(--danger)' : trendDown ? 'var(--success)' : 'var(--text-muted)')
          : (trendUp ? 'var(--success)' : trendDown ? 'var(--danger)' : 'var(--text-muted)');
        const trendBg = opts.trendInvert
          ? (trendUp ? 'var(--danger-soft, rgba(220,38,38,0.12))' : trendDown ? 'var(--success-soft)' : 'transparent')
          : (trendUp ? 'var(--success-soft)' : trendDown ? 'var(--danger-soft, rgba(220,38,38,0.12))' : 'transparent');
        const progress = opts.progress; // 0-100
        const sparkData = opts.spark; // array of numbers for mini sparkline

        return `<div class="kpi-card kpi-card--${color}" style="--kpi-accent: var(--${color}); --kpi-accent-soft: var(--${color}-soft, rgba(99,102,241,0.12)); cursor:pointer;" onclick="${route ? "routeTo('" + route + "')" : ''}">
          <div class="kpi-card__header">
            <div class="kpi-icon" style="background:var(--${color}-soft, rgba(99,102,241,0.12)); color:var(--${color});">${icon}</div>
            ${trend !== undefined && trend !== 0 ? `<div class="kpi-trend" style="color:${trendColor}; background:${trendBg};">
              <span class="kpi-trend__icon">${trendIcon}</span>${Math.abs(trend)}%
            </div>` : ''}
          </div>
          <div class="kpi-card__body">
            <div class="kpi-label">${label}</div>
            <div class="kpi-value">${value}</div>
            ${subValue ? `<div class="kpi-sub">${subValue}</div>` : ''}
          </div>
          ${progress !== undefined ? `<div class="kpi-progress"><div class="kpi-progress__bar" style="width:${Math.min(progress, 100)}%; background:var(--${color});"></div></div>` : ''}
          ${sparkData ? `<div class="kpi-spark" data-spark='${JSON.stringify(sparkData)}'></div>` : ''}
          <div class="kpi-card__cat" style="color:${cm.color}; background:${cm.bg};">${cm.label}</div>
        </div>`;
      };

      // Build last-7-day spend sparkline data
      const spendSparkData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const dayTotal = expenses.filter(e => e.type === 'expense' && e.date === ds).reduce((s, e) => s + Number(e.amount), 0);
        spendSparkData.push(dayTotal);
      }

      // Build task completion sparkline (last 7 days)
      const taskSparkData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const dayTasks = completedTasks.filter(t => t.completed_at && t.completed_at.slice(0, 10) === ds).length;
        taskSparkData.push(dayTasks);
      }

      return `<div class="kpi-grid kpi-scroll">
        ${renderKpiCard('netWorth', 'Net Worth', '₹' + netWorth.toLocaleString(), null, renderIcon('money', null, 'style="width:18px;"'), 'primary', 'finance', {})}
        ${renderKpiCard('monthSpend', 'Month Spend', '₹' + monthExp.toLocaleString(), prevMonthExp > 0 ? 'vs ₹' + prevMonthExp.toLocaleString() + ' last mo' : null, renderIcon('loss', null, 'style="width:18px;"'), 'danger', 'finance', { trend: spendTrend, trendInvert: true, spark: spendSparkData })}
        ${renderKpiCard('tasksDone', 'Tasks Done', completionRate + '%', completedTasks.length + ' of ' + tasks.length + ' tasks', renderIcon('check-circle', null, 'style="width:18px;"'), 'primary', 'tasks', { progress: completionRate, spark: taskSparkData })}
        ${renderKpiCard('monthlyBurnRate', 'Burn Rate', '₹' + avgDailySpend.toLocaleString(), '/day avg · ' + (daysInMonth - today.getDate()) + 'd left', renderIcon('trending-down', null, 'style="width:18px;"'), 'warning', 'finance', { trend: spendTrend, trendInvert: true })}
        ${renderKpiCard('incomeExpenseRatio', 'Savings Rate', incomeExpenseRatio + '%', monthIncome > 0 ? '₹' + (monthIncome - monthExp).toLocaleString() + ' saved' : 'No income', renderIcon('percent', null, 'style="width:18px;"'), incomeExpenseRatio >= 0 ? 'success' : 'danger', 'finance', { progress: Math.max(0, incomeExpenseRatio) })}
        ${renderKpiCard('investmentReturns', 'Inv. Returns', (invReturns > 0 ? '+' : '') + invReturns + '%', '₹' + invCurrentValue.toLocaleString() + ' portfolio', renderIcon('chart', null, 'style="width:18px;"'), invReturns >= 0 ? 'success' : 'danger', 'finance', { trend: invReturns })}
        ${renderKpiCard('ytdSpending', 'YTD Spend', '₹' + ytdSpending.toLocaleString(), Math.round(ytdSpending / (currentMonth + 1)).toLocaleString() + '/mo avg', renderIcon('calendar', null, 'style="width:18px;"'), 'primary', 'finance', {})}
        ${renderKpiCard('taskVelocity', 'Task Velocity', taskVelocity + ' tasks', 'this week', renderIcon('zap', null, 'style="width:18px;"'), 'primary', 'tasks', { trend: velocityTrend, spark: taskSparkData })}
        ${renderKpiCard('priorityDist', 'Priority Mix', p1Percent + '% P1', p1Tasks + ' critical · ' + p2Tasks + ' P2 · ' + p3Tasks + ' P3', renderIcon('flag', null, 'style="width:18px;"'), 'warning', 'tasks', {})}
        ${renderKpiCard('habitConsistency', 'Habit Score', avgHabitScore + '%', habitCompletions.length + ' habits tracked', renderIcon('activity', null, 'style="width:18px;"'), avgHabitScore >= 70 ? 'success' : avgHabitScore >= 40 ? 'warning' : 'danger', 'habits', { progress: avgHabitScore })}
        ${renderKpiCard('bestHabit', 'Best Habit', bestHabit?.name?.substring(0, 12) || 'N/A', bestHabit ? Math.round(bestHabit.completed / 30 * 100) + '% · ' + bestHabit.completed + '/30 days' : '', renderIcon('award', null, 'style="width:18px;"'), 'success', 'habits', { progress: bestHabit ? Math.round(bestHabit.completed / 30 * 100) : 0 })}
        ${renderKpiCard('strugglingHabits', 'Struggling', strugglingHabits + ' habits', strugglingHabits > 0 ? 'need attention' : 'all on track!', renderIcon('alert-triangle', null, 'style="width:18px;"'), strugglingHabits > 0 ? 'warning' : 'success', 'habits', {})}
        ${renderKpiCard('habitDiversity', 'Habits Active', habitDiversity, 'tracked', renderIcon('layers', null, 'style="width:18px;"'), 'primary', 'habits', {})}
        ${renderKpiCard('weeklyPattern', 'Best Day', bestDay, 'strongest day for habits', renderIcon('calendar', null, 'style="width:18px;"'), 'success', 'habits', {})}
        ${renderKpiCard('networkGrowth', 'New Contacts', newContacts, 'this month', renderIcon('user-plus', null, 'style="width:18px;"'), 'primary', 'people', {})}
        ${renderKpiCard('interactionFreq', 'Contact Freq', avgInteractionDays > 0 ? avgInteractionDays + ' days' : 'N/A', 'avg interval', renderIcon('clock', null, 'style="width:18px;"'), 'primary', 'people', {})}
        ${renderKpiCard('notesVolume', 'Notes', notesThisWeek, 'this week', renderIcon('file-text', null, 'style="width:18px;"'), 'primary', 'notes', {})}
        ${renderKpiCard('projectedBalance', 'Proj. Balance', '₹' + projectedMonthEnd.toLocaleString(), 'end of ' + new Date().toLocaleString('en-US', { month: 'short' }), renderIcon('trending-up', null, 'style="width:18px;"'), projectedMonthEnd >= 0 ? 'success' : 'danger', 'finance', {})}
        ${renderKpiCard('goalRisk', 'Goal Risk', atRiskGoals + ' at risk', atRiskGoals > 0 ? 'deadline pressure' : 'all clear', renderIcon('alert-circle', null, 'style="width:18px;"'), atRiskGoals > 0 ? 'danger' : 'success', 'vision', {})}
      </div>`;
    },

    cashflow: () => {
      const stateClass = window.dashWidgetStates['cashflow'] === 'expanded' ? '' : 'collapsed';
      return `
      <div class="widget-card ${stateClass}" id="widget-cashflow" data-widget-id="cashflow" style="min-height:auto">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('insights', null, 'style="width:18px; margin-right:6px"')} Cash Flow</div>
            <div style="display:flex; align-items:center; gap:10px">
                <button class="btn icon" onclick="event.stopPropagation(); routeTo('finance')">→</button>
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body">
            <div style="height:220px; position:relative"><canvas id="mainDashChart"></canvas></div>
         </div>
      </div>`;
    },

    tasks: () => {
      const allTasks = state.data.tasks || [];
      const todayStr = new Date().toISOString().slice(0, 10);

      // Filter: Due today or overdue, and not completed
      const displayedTasks = allTasks.filter(t => {
        if (t.status === 'completed') return false;
        // If no due date, maybe show? For now, stick to today's dashboard philosophy: Actionable NOW.
        // Let's show Due Today or Overdue.
        if (!t.due_date) return false;
        return t.due_date <= todayStr;
      }).sort((a, b) => (a.priority || 'P3').localeCompare(b.priority || 'P3'));

      return `
      <div class="widget-card collapsed">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('priority', null, 'style="width:18px; margin-right:6px"')} Tasks</div>
            <div style="display:flex; align-items:center; gap:10px" onclick="event.stopPropagation()">
                <button class="btn icon" onclick="routeTo('tasks')">+</button>
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body">
            <div>
                ${displayedTasks.length === 0 ? '<div class="text-muted">No tasks for today.</div>' :
          displayedTasks.map(t => `
                <div class="list-item">
                    <div class="habit-check" onclick="quickCompleteTask('${t.id}')"></div>
                    <div style="flex:1">
                    <div style="font-weight:500;">${t.title}</div>
                    <div style="font-size:11px; color:var(--danger)">${t.due_date || ''}</div>
                    </div>
                </div>`).join('')}
            </div>
         </div>
      </div>`;
    },


    today: () => {
      const stateClass = window.dashWidgetStates['today'] === 'expanded' ? '' : 'collapsed';
      const todayStr = new Date().toISOString().slice(0, 10);

      const events = (state.data.planner || [])
        .filter(e => e && e.start_datetime)
        .filter(e => {
          try {
            const eventDate = new Date(e.start_datetime).toISOString().split('T')[0];
            return eventDate === todayStr;
          } catch (err) { return false; }
        })
        .sort((a, b) => (a.start_datetime || 0) - (b.start_datetime || 0));

      // Birthdays Logic
      const people = state.data.people || [];
      const birthdays = people.filter(p => {
        if (!p.birthday) return false;
        const bdate = p.birthday.slice(5); // MM-DD
        return bdate === todayStr.slice(5);
      });

      return `
      <div class="widget-card ${stateClass}" id="widget-today" data-widget-id="today">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('calendar', null, 'style="width:18px; margin-right:6px"')} Schedule & Events</div>
            <div style="display:flex; align-items:center; gap:10px">
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body">
             <div style="display:flex; flex-direction:column; gap:12px;">
                ${birthdays.map(p => `
                  <div style="display:flex; align-items:center; gap:10px; padding:10px; background:linear-gradient(to right, var(--warning-soft, #FFF7ED), var(--warning-bg, #FFEDD5)); border-radius:8px; border:1px solid var(--warning-border, #FED7AA)">
                    <div style="font-size:16px">${renderIcon('birthday', null, '')}</div>
                    <div style="flex:1; font-weight:600; color:var(--warning-dark, #9A3412); font-size:13px">It's ${p.name}'s birthday!</div>
                    <button class="btn small" style="background:var(--warning, #F97316); color:white; border:none; padding:4px 10px" onclick="openPersonModal('${p.id}')">View</button>
                  </div>
                `).join('')}

                ${events.length === 0 && birthdays.length === 0 ? '<div class="text-muted">No events scheduled.</div>' :
          events.map(e => {
            const time = new Date(e.start_datetime).toTimeString().slice(0, 5);
            return `
                    <div class="timeline-item">
                    <div>
                        <div class="timeline-time">${time}</div>
                        <div class="timeline-title">${e.title}</div>
                    </div>
                    </div>`;
          }).join('')}
             </div>
         </div>
      </div>`;
    },

    habits: () => {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const d = new Date().getDay();
      const todayDay = dayNames[d === 0 ? 6 : d - 1];

      // Filter: Scheduled for Today
      const displayedHabits = (state.data.habits || []).filter(h => {
        if (!h.frequency || h.frequency === 'daily') return true;
        if (h.frequency === 'weekly' && h.days) {
          return h.days.split(',').map(s => s.trim()).includes(todayDay);
        }
        return true;
      });

      const logs = state.data.habit_logs || [];
      const todayStr = new Date().toISOString().slice(0, 10);

      return `
      <div class="widget-card collapsed">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('streak', null, 'style="width:18px; margin-right:6px"')} Habits</div>
            <div style="display:flex; align-items:center; gap:10px" onclick="event.stopPropagation()">
                ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
            </div>
         </div>
         <div class="widget-body">
            <div>
                ${displayedHabits.length === 0 ? '<div class="text-muted" style="font-size:13px">No habits for today.</div>' :
          (() => {
            const grouped = displayedHabits.reduce((acc, h) => {
              const r = h.routine || 'General';
              if (!acc[r]) acc[r] = [];
              acc[r].push(h);
              return acc;
            }, {});

            const routines = Object.keys(grouped).sort((a, b) => {
              if (a === 'General') return 1;
              if (b === 'General') return -1;
              return a.localeCompare(b);
            });

            return routines.map(r => {
              const habitsInRoutine = grouped[r];
              return `
                <div style="margin-bottom: 16px;">
                  <div style="font-size: 10px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; opacity: 0.8; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${r}</div>
                  ${habitsInRoutine.map(h => {
                const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(todayStr));
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px;">
                        <span style="${isDone ? 'text-decoration:line-through; color:var(--text-muted)' : ''}">${h.habit_name}</span>
                        <div class="habit-check ${isDone ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}">
                            ${isDone ? renderIcon('save', null, 'style="width:12px; color:white"') : ''}
                        </div>
                    </div>
                `;
              }).join('')}
                </div>
              `;
            }).join('');
          })()}
            </div>
         </div>
      </div>`;
    },

    // ─── BUDGET ALERT WIDGET ───
    budget: () => {
      const settings = state.data.settings?.[0] || {};
      const monthlyBudget = Number(settings.monthly_budget) || 0;
      if (!monthlyBudget) return ''; // Don't show if no budget set
      const currentMonth = new Date().getMonth();
      const monthExp = (state.data.expenses || [])
        .filter(e => e.type === 'expense' && new Date(e.date).getMonth() === currentMonth)
        .reduce((s, e) => s + Number(e.amount), 0);
      const pct = Math.min(100, Math.round((monthExp / monthlyBudget) * 100));
      const isWarning = pct >= 80;
      const isOver = pct >= 100;
      const barColor = isOver ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';
      const remaining = Math.max(0, monthlyBudget - monthExp);
      return `
      <div class="widget-card" style="padding:0;overflow:hidden;">
        <div style="padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;">
              ${isOver ? '🚨' : isWarning ? '⚠️' : '💰'} Monthly Budget
            </div>
            <div style="font-size:12px;color:var(--text-muted);">₹${monthExp.toLocaleString()} / ₹${monthlyBudget.toLocaleString()}</div>
          </div>
          <div style="height:8px;background:var(--surface-3);border-radius:4px;overflow:hidden;margin-bottom:8px;">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.8s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;">
            <span style="color:${barColor};font-weight:600;">${pct}% used</span>
            <span style="color:var(--text-muted);">₹${remaining.toLocaleString()} left</span>
          </div>
          ${isWarning ? `<div style="margin-top:8px;padding:6px 10px;background:${isOver ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'};border-radius:8px;font-size:12px;color:${isOver ? '#DC2626' : '#D97706'};font-weight:600;">
            ${isOver ? '🚨 Budget exceeded! Watch your spending.' : '⚠️ Approaching your monthly limit.'}
          </div>` : ''}
        </div>
      </div>`;
    },

    // ─── DAILY TOOLS WIDGET ───
    dailyTools: () => {
      const tools = [
        { id: 'gym', label: 'Gym', icon: 'fitness', bg: 'linear-gradient(135deg,#ef4444,#dc2626)', shadow: 'rgba(239,68,68,0.25)' },
        { id: 'notes', label: 'Notes', icon: 'entries', bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', shadow: 'rgba(99,102,241,0.25)' },
        { id: 'pomodoro', label: 'Focus', icon: 'clock', bg: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.25)' },
        { id: 'manifest', label: 'Manifest', icon: 'sparkles', bg: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', shadow: 'rgba(139,92,246,0.25)' },
        { id: 'chimes', label: 'Chimes', icon: 'bell', bg: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.25)' },
        { id: 'books', label: 'Books', icon: 'book', bg: 'linear-gradient(135deg,#60a5fa,#2563eb)', shadow: 'rgba(96,165,250,0.25)' },
        { id: 'mural', label: 'Mural', icon: 'layout', bg: 'linear-gradient(135deg,#ec4899,#db2777)', shadow: 'rgba(236,72,153,0.25)' },
        { id: 'tutor', label: 'Tutor', icon: 'languages', bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', shadow: 'rgba(6,182,212,0.25)' },
        { id: 'meditate', label: 'Meditate', icon: 'spiritual', bg: 'linear-gradient(135deg,#7C3AED,#5B21B6)', shadow: 'rgba(124,58,237,0.25)' },
      ];
      return `
        <div class="widget-card daily-tools-widget" data-widget-id="dailyTools">
          <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('wrench', null, 'style="width:16px;height:16px;margin-right:8px"')} Daily Tools</div>
            ${renderIcon('down', null, 'class="widget-chevron"')}
          </div>
          <div class="widget-body">
            <div class="dt-grid">
              ${tools.map(t => {
                const clickAction = t.id === 'manifest' ? 'startManifestationRitual()' : t.id === 'meditate' ? 'startGuidedMeditation()' : `routeTo('${t.id}')`;
                return `
                <button class="dt-tool" onclick="${clickAction}" style="--dt-shadow:${t.shadow}">
                  <div class="dt-icon-wrap" style="background:${t.bg}">
                    ${renderIcon(t.icon, null, 'style="width:22px;height:22px;color:#fff"')}
                  </div>
                  <span class="dt-label">${t.label}</span>
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    },

    // ─── PINNED NOTES WIDGET ───
    pinnedNotes: () => {
      const notes = (state.data.notes || []).filter(n => n.pinned === true || n.pinned === 'true');
      if (notes.length === 0) return '';
      return `
      <div class="widget-card collapsed">
        <div class="widget-header" onclick="toggleWidget(this)">
          <div class="widget-title">📌 Pinned Notes</div>
          <div style="display:flex;align-items:center;gap:10px" onclick="event.stopPropagation()">
            <button class="btn icon" onclick="showQuickLog('note'); event.stopPropagation()" title="Quick Note">+</button>
            ${renderIcon('down', null, 'class="widget-chevron" style="width:20px"')}
          </div>
        </div>
        <div class="widget-body">
          ${notes.slice(0, 3).map(n => `
            <div style="padding:10px;background:var(--surface-2);border-radius:10px;margin-bottom:8px;cursor:pointer;" onclick="routeTo('notes')">
              <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${n.title || 'Untitled'}</div>
              <div style="font-size:12px;color:var(--text-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${n.content || ''}</div>
            </div>`).join('')}
          ${notes.length > 3 ? `<div style="font-size:12px;color:var(--primary);cursor:pointer;text-align:center;" onclick="routeTo('notes')">+${notes.length - 3} more notes</div>` : ''}
        </div>
      </div>`;
    },

    // ─── DAILY AFFIRMATION WIDGET ───
    dailyAffirmation: () => {
      const affirmations = state.data.vision_affirmations || [];
      if (affirmations.length === 0) {
        return `
        <div class="widget-card" style="background: linear-gradient(135deg, var(--surface-1), var(--surface-2)); border: 1px solid var(--border-color);">
           <div class="widget-body" style="padding: 24px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 12px;">✨</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">No affirmations yet.</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Create personal manifestos to focus your mind.</div>
              <button class="btn primary small" onclick="routeTo('vision')" style="margin: 0 auto;">Go to Vision Board</button>
           </div>
        </div>`;
      }

      // Pick a random pinned one, or a random one from all
      const pinned = affirmations.filter(a => a.is_pinned === true || a.is_pinned === 'true' || a.is_pinned === 'TRUE');
      const pool = pinned.length > 0 ? pinned : affirmations;
      const affirmation = pool[Math.floor(Math.random() * pool.length)];

      const bgMap = {
        dawn: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)',
        ocean: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
        deep: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
      };
      const bgStyle = bgMap[(affirmation.bg_style || '').toLowerCase()] || bgMap.dawn;

      return `
      <div class="widget-card affirmation-widget-card" data-widget-id="dailyAffirmation" style="background: ${bgStyle}; color: white; border: none; overflow: hidden; position: relative;">
         <!-- Subtle pattern overlay -->
         <div style="position: absolute; inset: 0; opacity: 0.1; background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 20px 20px;"></div>
         
         <div class="widget-body" style="padding: 28px 24px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; opacity: 0.8; color: white;">Daily Focus</div>
            <div style="font-size: 18px; font-weight: 700; line-height: 1.5; margin-bottom: 24px; font-style: ${affirmation.text.includes('*') ? 'italic' : 'normal'};">
               "${escapeHtml(affirmation.text).replace(/\*(.*?)\*/g, '<span style="color:var(--warning);">$1</span>')}"
            </div>
            <div style="display: flex; gap: 12px; width: 100%; justify-content: center;">
               <button class="btn" onclick="startManifestationRitual()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 12px; padding: 10px 20px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);">
                  <span style="font-size: 16px;">🧘</span> Manifest
               </button>
            </div>
         </div>
      </div>
      <style>
         .affirmation-widget-card {
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
         }
         .affirmation-widget-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
         }
      </style>`;
    },

    // ----- HABITS GRID (Notion-style: days × habits) -----
    habitsGrid: () => {
      const allHabits = (state.data.habits || []).filter(h => h && (h.habit_name || h.name));
      if (allHabits.length === 0) {
        return `
          <div class="widget-card habits-grid-widget" data-widget-id="habitsGrid">
            <div class="hg-header">
              <span class="hg-title">Habits</span>
              <button class="hg-newbtn" onclick="event.stopPropagation();_dashOpenModal('habits','openHabitModal')">+ New habit</button>
            </div>
            <div class="hg-empty">No habits yet. Tap + New habit above.</div>
          </div>`;
      }

      // Build last 7 days (today on top)
      const dayRows = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        let label;
        if (i === 0) label = 'Today';
        else if (i === 1) label = 'Yesterday';
        else label = d.toLocaleDateString('en-US', { weekday: 'long' });
        dayRows.push({ iso, label });
      }

      const logs = state.data.habit_logs || [];
      const isDone = (habitId, iso) => logs.some(l =>
        String(l.habit_id) === String(habitId) && (l.date || '').startsWith(iso)
      );

      // Cap visible habits to 8 so grid doesn't overflow
      const habits = allHabits.slice(0, 8);

      const headerCells = habits.map(h => `
        <div class="hg-col-head" title="${escapeHtml(h.habit_name || h.name)}">
          <span class="hg-col-icon">${h.icon || '✦'}</span>
        </div>
      `).join('');

      const bodyRows = dayRows.map((day, dayIdx) => {
        const doneCount = habits.filter(h => isDone(h.id, day.iso)).length;
        const pct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;
        const cells = habits.map(h => {
          const done = isDone(h.id, day.iso);
          const isToday = dayIdx === 0;
          const onclick = isToday
            ? `onclick="event.stopPropagation(); _tileHabitToggle(this, '${h.id}');"`
            : '';
          return `
            <div class="hg-cell ${isToday ? 'hg-cell--today' : ''}" ${onclick}>
              <span class="hg-check ${done ? 'is-done' : ''}">
                ${done ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </span>
            </div>`;
        }).join('');
        return `
          <div class="hg-row ${dayIdx === 0 ? 'hg-row--today' : ''}">
            <div class="hg-day-label">${day.label}</div>
            ${cells}
            <div class="hg-score">
              <span class="hg-score-pct">${pct}%</span>
              <div class="hg-score-bar"><div class="hg-score-fill" style="width:${pct}%"></div></div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="widget-card habits-grid-widget" data-widget-id="habitsGrid">
          <div class="hg-header">
            <span class="hg-title">Habits</span>
            <button class="hg-newbtn" onclick="event.stopPropagation();_dashOpenModal('habits','openHabitModal')">+ New habit</button>
          </div>
          <div class="hg-scroll">
            <div class="hg-grid" style="--hg-cols: ${habits.length};">
              <div class="hg-row hg-row--head">
                <div class="hg-day-label hg-day-label--head">Day</div>
                ${headerCells}
                <div class="hg-score hg-score--head">Day Score</div>
              </div>
              ${bodyRows}
            </div>
          </div>
        </div>`;
    },

    // ----- TASKS LIST (Notion-style compact list) -----
    tasksList: () => {
      const all = (state.data.tasks || []).filter(t => t.status !== 'completed');
      // Sort: priority (P1 > P2 > P3) then due date asc
      const prioRank = { P1: 0, P2: 1, P3: 2 };
      const sorted = [...all].sort((a, b) => {
        const pa = prioRank[a.priority] ?? 3;
        const pb = prioRank[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
      });
      const visible = sorted.slice(0, 6);

      const PRIO_META = {
        P1: { label: 'Urgent', cls: 'tl-prio--urgent' },
        P2: { label: 'Medium', cls: 'tl-prio--medium' },
        P3: { label: 'Low',    cls: 'tl-prio--low'    }
      };

      const formatDue = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      const rows = visible.length > 0 ? visible.map(t => {
        const meta = PRIO_META[t.priority] || PRIO_META.P3;
        const safeTitle = escapeHtml(t.title || 'Untitled');
        return `
          <div class="tl-row" onclick="_dashOpenModal('tasks','openTaskModal','${t.id}')">
            <span class="tl-check" onclick="event.stopPropagation(); _tileTaskToggle(this, '${t.id}');"></span>
            <span class="tl-name">${safeTitle}</span>
            <span class="tl-prio ${meta.cls}"><span class="tl-prio-dot"></span>${meta.label}</span>
            <span class="tl-due">${formatDue(t.due_date)}</span>
          </div>`;
      }).join('') : `<div class="tl-empty">No pending tasks. Nice work.</div>`;

      return `
        <div class="widget-card tasks-list-widget" data-widget-id="tasksList">
          <div class="tl-header">
            <span class="tl-title">Tasks</span>
            <button class="tl-newbtn" onclick="event.stopPropagation();_dashOpenModal('tasks','openTaskModal')">+ New task</button>
          </div>
          <div class="tl-col-heads">
            <span class="tl-col-name">Name</span>
            <span class="tl-col-prio">Priority</span>
            <span class="tl-col-due">Due</span>
          </div>
          <div class="tl-body">${rows}</div>
          ${all.length > visible.length ? `
            <div class="tl-footer"><span class="tl-allbtn-static">+${all.length - visible.length} more tasks</span></div>
          ` : ''}
        </div>`;
    },
  };

  // --- BUILD VISIBLE SECTIONS ---
  const visibleSections = config.filter(s => s.visible);

  // Define which sections should span full width on desktop

  const fullWidthSections = ['morning', 'vision', 'kpis', 'aiBriefing'];

  let gridHtml = '';
  let staggerIndex = 1;

  visibleSections.forEach(sec => {
    try {
      const renderer = sectionRenderers[sec.id];
      if (!renderer) return;
      const html = renderer();
      if (!html) return;

      const isFull = fullWidthSections.includes(sec.id);
      const spanClass = isFull ? 'span-full' : '';

      // P2 Polish: Staggered Entrance
      const delayClass = `stagger-${Math.min(staggerIndex, 5)}`;
      staggerIndex++;

      gridHtml += `<div class="${spanClass} animate-enter ${delayClass}" style="min-width:0; opacity:0; animation-fill-mode:forwards;">${html}</div>`;
    } catch (err) {
      console.error(`Error rendering dashboard section ${sec.id}:`, err);
    }
  });

  // --- RENDER (Lumia tile grid replaces bento) ---
  main.innerHTML = `
    <div class="dash-wrapper">
      ${renderLumiaGrid(sectionRenderers)}
      <div class="lumia-editing-bar">
        <span class="lumia-editing-bar__layout-pill">Editing: <strong>${_currentLayoutKey()}</strong> layout</span>
        <button class="lumia-editing-bar__btn" onclick="toggleLumiaLayoutTarget()" title="Switch to the other layout">Switch</button>
        <button class="lumia-editing-bar__btn" onclick="openLumiaTilePicker()">+ Add tile</button>
        <button class="lumia-editing-bar__btn" onclick="resetLumiaTiles()">Reset</button>
        <button class="lumia-editing-bar__btn lumia-editing-bar__btn--done" onclick="toggleLumiaEditMode()">Done</button>
      </div>
    </div>
  `;

  // Hydrate dynamic content inside any large widget tiles (charts, sparklines, AI insight)
  setTimeout(() => {
    // KPI/cashflow hooks only if the user has surfaced those widgets as large tiles
    if (document.querySelector('.lumia-tile--large [data-widget-id="kpis"]')) {
      renderDashSparkline(expenses);
      document.querySelectorAll('.kpi-value').forEach(el => animateValue(el));
      renderKpiSparklines();
      requestAnimationFrame(() => {
        document.querySelectorAll('.kpi-progress__bar').forEach(bar => {
          const w = bar.style.width;
          bar.style.width = '0%';
          requestAnimationFrame(() => { bar.style.width = w; });
        });
      });
    }
    if (document.querySelector('.lumia-tile--large [data-widget-id="cashflow"]')) {
      renderDashMainChart(expenses);
    }
    if (document.querySelector('.lumia-tile--large [data-widget-id="aiBriefing"]') && typeof checkAndShowInsight === 'function') {
      checkAndShowInsight();
    }
    // Initialize Sortable if we re-rendered while in edit mode
    if (document.body.classList.contains('tiles-editing')) {
      _initLumiaSortable();
    }
  }, 50);
}

// P2 Polish: Number Tween Animation
function animateValue(obj) {
  const raw = obj.textContent.replace(/[^0-9.-]/g, '');
  if (!raw) return;
  const end = parseFloat(raw);
  const original = obj.textContent;
  const isCurrency = original.includes('₹') || original.includes('$');
  const isPercent = original.includes('%');

  let startTimestamp = null;
  const duration = 2000;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // Smooth cubic easing
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    const current = ease * end;

    if (isCurrency) {
      obj.textContent = '₹' + Math.floor(current).toLocaleString();
    } else if (isPercent) {
      obj.textContent = Math.round(current) + '%';
    } else {
      obj.textContent = Math.floor(current).toLocaleString();
    }

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = original;
    }
  };
  window.requestAnimationFrame(step);
}

// Mini sparkline renderer for KPI cards
function renderKpiSparklines() {
  document.querySelectorAll('.kpi-spark[data-spark]').forEach(container => {
    try {
      const data = JSON.parse(container.dataset.spark);
      if (!data || data.length < 2) return;

      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const range = max - min || 1;
      const pad = 2;

      // Get accent color from parent card
      const card = container.closest('.kpi-card');
      const accentColor = card ? getComputedStyle(card).getPropertyValue('--kpi-accent').trim() || '#818CF8' : '#818CF8';

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(0, h);
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = ((i - 1) / (data.length - 1)) * w;
          const cpx = (px + x) / 2;
          const py = h - pad - ((data[i - 1] - min) / range) * (h - pad * 2);
          ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
        }
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(129, 140, 248, 0.2)');
      grad.addColorStop(1, 'rgba(129, 140, 248, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = ((i - 1) / (data.length - 1)) * w;
          const cpx = (px + x) / 2;
          const py = h - pad - ((data[i - 1] - min) / range) * (h - pad * 2);
          ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
        }
      });
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw end dot
      const lastX = w;
      const lastY = h - pad - ((data[data.length - 1] - min) / range) * (h - pad * 2);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
    } catch (e) { /* silent */ }
  });
}

// --- CUSTOMIZE MODAL ---
// Temp config stored here during editing
window._dashEditConfig = null;
window._dashSortable = null;

window.openDashCustomize = function () {
  if (!window._dashEditConfig) {
    window._dashEditConfig = getDashConfig().map(s => ({ ...s }));
  }
  _renderDashConfigModal();
};

function _renderDashConfigModal() {
  const config = window._dashEditConfig;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  box.innerHTML = `
    <h3>Customize Dashboard</h3>
    <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Drag handle to reorder. Toggle ON/OFF.</p>
    <div id="dashConfigList">
      ${config.map((sec, i) => `
        <div class="dash-sort-item" data-id="${sec.id}" style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--surface-2); border-radius:10px; margin-bottom:8px; touch-action:none;">
          <div class="dash-handle" style="cursor:grab; padding:4px; color:var(--text-muted);">${renderIcon('drag')}</div>
          <div style="flex:1; font-weight:600; font-size:15px; padding:0 8px;">${sec.label}</div>
          <button class="btn" style="min-width:60px; font-size:12px; padding:6px 12px; border-radius:20px; background:${sec.visible ? 'var(--primary)' : 'var(--surface-3)'}; color:white; border:none; cursor:pointer;"
                  onclick="toggleDashSection(${i})">
            ${sec.visible ? 'ON' : 'OFF'}
          </button>
        </div>
      `).join('')}
    </div>
    <div style="display:flex; justify-content:space-between; gap:10px; margin-top:16px;">
      <button class="btn" style="color:var(--danger);" onclick="resetDashConfig()">Reset</button>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="cancelDashCustomize()">Cancel</button>
        <button class="btn primary" onclick="saveDashCustomize()">Save Layout</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();

  // Initialize Sortable
  const el = document.getElementById('dashConfigList');
  if (window._dashSortable) window._dashSortable.destroy();

  window._dashSortable = new Sortable(el, {
    handle: '.dash-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: function (evt) {
      // Update config order
      const itemEl = evt.item;
      const oldIndex = evt.oldIndex;
      const newIndex = evt.newIndex;

      if (oldIndex !== newIndex) {
        const movedItem = window._dashEditConfig.splice(oldIndex, 1)[0];
        window._dashEditConfig.splice(newIndex, 0, movedItem);
        // Note: we don't re-render here to keep the Sortable animation smooth
        // The DOM is already updated by Sortable
        // We only need to ensure the toggle buttons still map correct index? 
        // Actually, toggle calls specific index. If we reorder, indices shift. 
        // Better to re-render to update onclick indices OR use data-id lookup.
        // For simplicity, let's re-render after a tiny delay or just update the onclicks?
        // Safest: Re-render. It might snap but ensures correctness.
        // Alternative: Use ID identifiers for toggling.
        // Let's rely on re-render for now. Sortable handles the visual drop, then we snap to clean state.
        setTimeout(_renderDashConfigModal, 50);
      }
    }
  });
}

window.toggleDashSection = function (currentIndex) {
  // Toggle the visible state
  window._dashEditConfig[currentIndex].visible = !window._dashEditConfig[currentIndex].visible;
  _renderDashConfigModal();
};

window.cancelDashCustomize = function () {
  window._dashEditConfig = null;
  document.getElementById('universalModal').classList.add('hidden');
};

window.resetDashConfig = function () {
  window._dashEditConfig = DEFAULT_DASH_CONFIG.map(s => ({ ...s }));
  _renderDashConfigModal();
};

window.saveDashCustomize = async function () {
  const config = window._dashEditConfig;
  const modal = document.getElementById('universalModal');
  const saveBtn = modal.querySelector('.btn.primary');

  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    await saveDashConfig(config);
  } catch (e) {
    console.error("Save failed:", e);
  }

  window._dashEditConfig = null;
  modal.classList.add('hidden');
  renderDashboard();
  showToast("Dashboard updated & saved!");
};

// Robust Save Function
async function saveDashConfig(config) {
  const settings = state.data.settings?.[0] || {};
  const configStr = JSON.stringify(config);

  // 1. Save to Local Storage (Robust Fallback)
  try {
    const local = JSON.parse(localStorage.getItem('localSettingsOverride') || '{}');
    local.dashboard_config = configStr;
    localStorage.setItem('localSettingsOverride', JSON.stringify(local));
    console.log("Saved dashboard config to localStorage");
  } catch (e) {
    console.error("Local storage save failed", e);
  }

  // 2. Update State
  if (state.data.settings && state.data.settings[0]) {
    state.data.settings[0].dashboard_config = configStr;
  }

  // 3. Sync to Google Sheet
  try {
    if (settings.id) {
      await apiCall('update', 'settings', { dashboard_config: configStr }, settings.id);
    } else {
      await apiCall('create', 'settings', { dashboard_config: configStr });
    }
  } catch (e) {
    console.warn("Sheet sync failed (column might be missing), but local save worked.", e);
  }
}

// --- DASHBOARD HELPERS ---

window.toggleWidget = function (headerEl) {
  const card = headerEl.closest('.widget-card');
  if (card) {
    card.classList.toggle('collapsed');

    // Save state
    const widgetId = card.getAttribute('data-widget-id');
    if (widgetId) {
      const isCollapsed = card.classList.contains('collapsed');
      window.dashWidgetStates[widgetId] = isCollapsed ? 'collapsed' : 'expanded';
    }
  }
};



// Chart instance registry — prevents memory leak on dashboard re-render
const _dashChartInstances = {};

function renderDashSparkline(expenses) {
  const ctx = document.getElementById('sparkSpend');
  if (!ctx) return;

  // Destroy existing instance
  if (_dashChartInstances.sparkline) {
    _dashChartInstances.sparkline.destroy();
    _dashChartInstances.sparkline = null;
  }

  const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(-10);
  const data = sorted.map(e => Number(e.amount));
  const labels = sorted.map(e => '');

  _dashChartInstances.sparkline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: data, borderColor: '#EF4444', borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, pointRadius: 0, tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: false }, scales: { x: { display: false }, y: { display: false } }
    }
  });
}

function renderDashMainChart(expenses) {
  const ctx = document.getElementById('mainDashChart');
  if (!ctx) return;

  // Destroy existing instance
  if (_dashChartInstances.main) {
    _dashChartInstances.main.destroy();
    _dashChartInstances.main = null;
  }

  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4F46E5';
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0';

  // Daily data for the last 30 days
  const days = {};
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Initialize all days in range with 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const k = d.toISOString().slice(0, 10); // YYYY-MM-DD
    days[k] = 0;
  }

  // Fill in actual expense data
  expenses.forEach(e => {
    if (e.type !== 'expense') return;
    const d = new Date(e.date);
    if (d >= thirtyDaysAgo && d <= today) {
      const k = d.toISOString().slice(0, 10);
      if (days.hasOwnProperty(k)) {
        days[k] = (days[k] || 0) + Number(e.amount);
      }
    }
  });

  // Convert to chart format - show last 14 days for readability
  const last14Days = Object.keys(days).slice(-14);
  const labels = last14Days.map(d => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const data = last14Days.map(d => days[d]);

  _dashChartInstances.main = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Expense', data: data,
        backgroundColor: primaryColor, borderRadius: 4, barThickness: 12
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: false },
      scales: { y: { beginAtZero: true, grid: { color: borderColor } }, x: { grid: { display: false } } }
    }
  });
}

window.quickCompleteTask = async function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (t) {
    t.status = 'completed';
    renderDashboard();
    await apiCall('update', 'tasks', { status: 'completed' }, id);
  }
}

// --- AI INSIGHT LOGIC ---

// Save insight to Google Sheet settings
async function saveInsightToSheet(insightText) {
  const settings = state.data.settings?.[0];
  const timestamp = new Date().toISOString();
  try {
    if (settings && settings.id) {
      await apiCall('update', 'settings', {
        ai_insights: insightText,
        ai_insight_date: timestamp
      }, settings.id);
    } else {
      await apiCall('create', 'settings', {
        ai_insights: insightText,
        ai_insight_date: timestamp
      });
    }
    // Update local state
    if (state.data.settings && state.data.settings[0]) {
      state.data.settings[0].ai_insights = insightText;
      state.data.settings[0].ai_insight_date = timestamp;
    }
    console.log('AI Insight saved to sheet');
  } catch (e) {
    console.error('Failed to save insight to sheet:', e);
  }
}

// Check if insight is stale (> 24 hours)
function isInsightStale() {
  const settings = state.data.settings?.[0];
  if (!settings || !settings.ai_insight_date) return true;
  const lastDate = new Date(settings.ai_insight_date);
  const now = new Date();
  const hoursDiff = (now - lastDate) / (1000 * 60 * 60);
  return hoursDiff >= 24;
}

// Show cached insight or auto-generate
window.checkAndShowInsight = function () {
  const settings = state.data.settings?.[0];
  const contentDiv = document.getElementById('aiContent');
  if (!contentDiv) return;

  // If we have a cached insight and it's fresh, show it
  if (settings && settings.ai_insights && !isInsightStale()) {
    const formatted = settings.ai_insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    contentDiv.innerHTML = `
    <div style="animation: fadeIn 0.5s ease-in;">
      ${formatted}
  <div style="font-size:11px; color:var(--text-muted); margin-top:12px; text-align:right;">
    Last updated: ${new Date(settings.ai_insight_date).toLocaleString()}
  </div>
      </div>
    `;
    return;
  }

  // If stale, auto-generate
  if (isInsightStale() && settings?.ai_api_key) {
    generateDashboardInsight();
  }
};

window.generateDashboardInsight = async function () {
  const contentDiv = document.getElementById('aiContent');
  if (!contentDiv) return;

  // Show Loading State
  contentDiv.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; padding:20px 0; color:var(--text-muted)">
      ${renderIcon('loading', null, 'class="spin" style="width:24px; margin-bottom:10px"')}
      <span>Analyzing your day...</span>
    </div>
    `;
  lucide.createIcons();

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Aggregate FULL Context for Chief of Staff Analysis
    const contextData = {
      settings: state.data.settings?.[0] || {},
      vision: state.data.vision || [],
      diary: (state.data.diary || []).slice(-3), // Last 3 entries for mood context
      tasks: (state.data.tasks || []).filter(t => t.status !== 'completed' || t.due_date === today), // Pending + completed today
      planner: (state.data.planner || []).filter(e => e.start_datetime && new Date(e.start_datetime) >= new Date(today)).slice(0, 10), // Next 10 events
      habits: state.data.habits || [],
      habit_logs: (state.data.habit_logs || []).slice(-30), // Last ~month of logs
      expenses: (state.data.expenses || []).slice(-15), // Last 15 transactions
      funds: state.data.funds || [],
      assets: state.data.assets || []
    };

    const insight = await AI_SERVICE.generateInsight('dashboard', contextData);

    // Save to Google Sheet
    await saveInsightToSheet(insight);

    // Render Insight
    const formatted = insight
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    contentDiv.innerHTML = `
    <div style="animation: fadeIn 0.5s ease-in;">
      ${formatted}
  <div style="font-size:11px; color:var(--text-muted); margin-top:12px; text-align:right;">
    Just now · Saved to sheet ${renderIcon('save', null, '')}
  </div>
      </div>
    `;

    showToast("Insight generated & saved!");

  } catch (err) {
    contentDiv.innerHTML = `
    <div style="color:var(--danger); text-align:center; padding:10px">
      ${renderIcon('info', null, 'style="width:20px; display:inline-block; vertical-align:middle"')}
        ${err.message || 'Failed to generate insight.'}
      </div>
    `;
    console.error(err);
  } finally {
    lucide.createIcons();
  }
};