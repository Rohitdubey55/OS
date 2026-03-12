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

      // Render KPI card helper
      const renderKpiCard = (id, label, value, subValue, icon, color, route) => {
        if (!visibleKpis.find(k => k.id === id)) return '';
        return `<div class="kpi-card" style="flex:1; min-width:150px; cursor:pointer;" onclick="${route ? "routeTo('" + route + "')" : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-icon" style="background:${color}-soft; color:var(--${color}); width:36px; height:36px; border-radius: 12px;">${icon}</div>
          </div>
          <div style="margin-top:16px;">
            <div class="kpi-value" style="font-size:20px; font-weight: 700;">${value}</div>
            <div class="kpi-label" style="font-size:12px; margin-top: 4px;">${label}</div>
            ${subValue ? `<div class="kpi-sub" style="font-size:10px; color:var(--text-muted); margin-top:2px;">${subValue}</div>` : ''}
          </div>
        </div>`;
      };

      return `<div class="kpi-grid kpi-scroll" style="display:flex; flex-direction:row; gap:16px; overflow-x:auto; padding:6px 6px 16px 6px; margin: 0 0 8px 0; scrollbar-width:none; -ms-overflow-style:none;">
        <style>
          .kpi-scroll::-webkit-scrollbar { display: none; }
          .kpi-scroll .kpi-card:hover { transform: translateY(-6px); transition: transform 0.3s ease; }
        </style>
        ${renderKpiCard('netWorth', 'Net Worth', '₹' + netWorth.toLocaleString(), null, renderIcon('money', null, 'style="width:18px;"'), 'primary', 'finance')}
        ${renderKpiCard('monthSpend', 'Month Spend', '₹' + monthExp.toLocaleString(), null, renderIcon('loss', null, 'style="width:18px;"'), 'danger', 'finance')}
        ${renderKpiCard('tasksDone', 'Tasks Done', completionRate + '%', null, renderIcon('check-circle', null, 'style="width:18px;"'), 'primary', 'tasks')}
        ${renderKpiCard('monthlyBurnRate', 'Burn Rate', '₹' + avgDailySpend.toLocaleString(), '/day avg', renderIcon('trending-down', null, 'style="width:18px;"'), 'warning', 'finance')}
        ${renderKpiCard('incomeExpenseRatio', 'Savings Rate', incomeExpenseRatio + '%', monthIncome > 0 ? '₹' + (monthIncome - monthExp).toLocaleString() + ' saved' : 'No income', renderIcon('percent', null, 'style="width:18px;"'), incomeExpenseRatio >= 0 ? 'success' : 'danger', 'finance')}
        ${renderKpiCard('investmentReturns', 'Inv. Returns', (invReturns > 0 ? '+' : '') + invReturns + '%', '₹' + invCurrentValue.toLocaleString(), renderIcon('chart', null, 'style="width:18px;"'), invReturns >= 0 ? 'success' : 'danger', 'finance')}
        ${renderKpiCard('ytdSpending', 'YTD Spend', '₹' + ytdSpending.toLocaleString(), null, renderIcon('calendar', null, 'style="width:18px;"'), 'primary', 'finance')}
        ${renderKpiCard('taskVelocity', 'Task Velocity', taskVelocity + ' tasks', 'this week', renderIcon('zap', null, 'style="width:18px;"'), 'primary', 'tasks')}
        ${renderKpiCard('priorityDist', 'Priority Mix', p1Percent + '% P1', p2Tasks + ' P2, ' + p3Tasks + ' P3', renderIcon('flag', null, 'style="width:18px;"'), 'warning', 'tasks')}
        ${renderKpiCard('habitConsistency', 'Habit Score', avgHabitScore + '%', null, renderIcon('activity', null, 'style="width:18px;"'), 'primary', 'habits')}
        ${renderKpiCard('bestHabit', 'Best Habit', bestHabit?.name?.substring(0, 12) || 'N/A', bestHabit ? bestHabit.completed + '/30 days' : '', renderIcon('award', null, 'style="width:18px;"'), 'success', 'habits')}
        ${renderKpiCard('strugglingHabits', 'Struggling', strugglingHabits + ' habits', 'below 50%', renderIcon('alert-triangle', null, 'style="width:18px;"'), strugglingHabits > 0 ? 'warning' : 'success', 'habits')}
        ${renderKpiCard('habitDiversity', 'Habits Active', habitDiversity, 'tracked', renderIcon('layers', null, 'style="width:18px;"'), 'primary', 'habits')}
        ${renderKpiCard('weeklyPattern', 'Best Day', bestDay, 'for habits', renderIcon('calendar', null, 'style="width:18px;"'), 'success', 'habits')}
        ${renderKpiCard('networkGrowth', 'New Contacts', newContacts, 'this month', renderIcon('user-plus', null, 'style="width:18px;"'), 'primary', 'people')}
        ${renderKpiCard('interactionFreq', 'Contact Freq', avgInteractionDays > 0 ? avgInteractionDays + ' days' : 'N/A', 'avg interval', renderIcon('clock', null, 'style="width:18px;"'), 'primary', 'people')}
        ${renderKpiCard('notesVolume', 'Notes', notesThisWeek, 'this week', renderIcon('file-text', null, 'style="width:18px;"'), 'primary', 'notes')}
        ${renderKpiCard('projectedBalance', 'Proj. Balance', '₹' + projectedMonthEnd.toLocaleString(), 'month end', renderIcon('trending-up', null, 'style="width:18px;"'), projectedMonthEnd >= 0 ? 'success' : 'danger', 'finance')}
        ${renderKpiCard('goalRisk', 'Goal Risk', atRiskGoals + ' at risk', 'deadline warning', renderIcon('alert-circle', null, 'style="width:18px;"'), atRiskGoals > 0 ? 'danger' : 'success', 'vision')}
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
          displayedHabits.map(h => {
            const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(todayStr));
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:14px;">
                    <span style="${isDone ? 'text-decoration:line-through; color:var(--text-muted)' : ''}">${h.habit_name}</span>
                    <div class="habit-check ${isDone ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}">
                        ${isDone ? renderIcon('save', null, 'style="width:12px; color:white"') : ''}
                    </div>
                </div>
                `;
          }).join('')}
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
        { id: 'gym',      label: 'Gym',      icon: 'fitness',  bg: 'linear-gradient(135deg,#ef4444,#dc2626)', shadow: 'rgba(239,68,68,0.25)' },
        { id: 'notes',    label: 'Notes',    icon: 'entries',  bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', shadow: 'rgba(99,102,241,0.25)' },
        { id: 'pomodoro', label: 'Focus',    icon: 'clock',    bg: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.25)' },
        { id: 'chimes',   label: 'Chimes',   icon: 'bell',     bg: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.25)' },
        { id: 'books',    label: 'Books',    icon: 'book',     bg: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', shadow: 'rgba(139,92,246,0.25)' },
      ];
      return `
        <div class="widget-card daily-tools-widget" data-widget-id="dailyTools">
          <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title">${renderIcon('wrench', null, 'style="width:16px;height:16px;margin-right:8px"')} Daily Tools</div>
            ${renderIcon('down', null, 'class="widget-chevron"')}
          </div>
          <div class="widget-body">
            <div class="dt-grid">
              ${tools.map(t => `
                <button class="dt-tool" onclick="routeTo('${t.id}')" style="--dt-shadow:${t.shadow}">
                  <div class="dt-icon-wrap" style="background:${t.bg}">
                    ${renderIcon(t.icon, null, 'style="width:22px;height:22px;color:#fff"')}
                  </div>
                  <span class="dt-label">${t.label}</span>
                </button>`).join('')}
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

  // --- RENDER ---
  main.innerHTML = `
    <div class="dash-wrapper">
      
      <div class="quick-actions" style="margin: 4px 0 8px 0; display:flex; justify-content:space-between; gap:8px; padding:4px 4px; overflow:visible;">
        <button id="qa-task" class="qa-btn round-icon" onclick="openTaskModal()" title="Add Task" style="flex:1; height:52px; border-radius:14px; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--surface-1); border:1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s; font-size:9px; font-weight:600; color:var(--text-muted); overflow:visible;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"> ${renderIcon('priority', null, 'style="width:20px;"')} <span>Task</span></button>
        <button id="qa-expense" class="qa-btn round-icon" onclick="showQuickLog('expense')" title="Quick Expense" style="flex:1; height:52px; border-radius:14px; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--surface-1); border:1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s; font-size:9px; font-weight:600; color:var(--text-muted);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"> ${renderIcon('wallet', null, 'style="width:20px;"')} <span>Expense</span></button>
        <button id="qa-habit" class="qa-btn round-icon" onclick="showQuickLog('habit')" title="Quick Habit" style="flex:1; height:52px; border-radius:14px; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--surface-1); border:1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s; font-size:9px; font-weight:600; color:var(--text-muted);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"> ${renderIcon('streak', null, 'style="width:20px;"')} <span>Habit</span></button>
        <button id="qa-note" class="qa-btn round-icon" onclick="showQuickLog('note')" title="Quick Note" style="flex:1; height:52px; border-radius:14px; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--surface-1); border:1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s; font-size:9px; font-weight:600; color:var(--text-muted);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"> ${renderIcon('entries', null, 'style="width:20px;"')} <span>Note</span></button>
        <button class="qa-btn round-icon" onclick="openWeeklyReview()" title="Weekly Review" style="flex:1; height:52px; border-radius:14px; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--surface-1); border:1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s; font-size:9px; font-weight:600; color:var(--text-muted);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"> 📊 <span>Review</span></button>
      </div>

      <div class="dash-grid">
        ${gridHtml}
      </div>

      <div style="margin:0 0 24px 0; text-align:center">
        <button class="btn" onclick="openDashCustomize()" style="width:100%; background:var(--surface-1); border:1px solid var(--border); color:var(--text-muted); justify-content:center; padding:12px;">
            ${renderIcon('dashboard', null, 'style="width:16px; margin-right:8px"')} Dashboard Layout
        </button>
      </div>
    </div>
  `;

  // Render Charts + Check AI Insight + Animate KPIs
  setTimeout(() => {
    // Attach Long Press Actions
    if (typeof addLongPressAction === 'function') {
      addLongPressAction('qa-task', () => routeTo('tasks'));
      addLongPressAction('qa-expense', () => routeTo('finance'));
      addLongPressAction('qa-habit', () => routeTo('habits'));
      addLongPressAction('qa-note', () => routeTo('notes'));
    }

    if (visibleSections.some(s => s.id === 'kpis')) {
      renderDashSparkline(expenses);
      // P2 Polish: Animate KPI Counters
      document.querySelectorAll('.kpi-value').forEach(el => animateValue(el));
    }
    if (visibleSections.some(s => s.id === 'cashflow')) renderDashMainChart(expenses);
    if (visibleSections.some(s => s.id === 'aiBriefing') && typeof checkAndShowInsight === 'function') {
      checkAndShowInsight();
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