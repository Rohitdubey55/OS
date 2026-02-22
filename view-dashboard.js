/* view-dashboard.js */

// Default dashboard section config
const DEFAULT_DASH_CONFIG = [
  { id: 'morning', label: '☀️ Morning Greeting', visible: true },
  { id: 'aiBriefing', label: '✨ Daily Briefing', visible: true },
  { id: 'vision', label: 'Vision Banner', visible: true },
  { id: 'kpis', label: 'KPI Cards', visible: true },
  { id: 'tasks', label: 'High Priority Tasks', visible: true },
  { id: 'today', label: 'Today\'s Schedule', visible: true },
  { id: 'habits', label: 'Habit Tracker', visible: true }
];

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
        // Sanity check: Ensure each item has an ID and Label
        return merged.filter(i => i && i.id);
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
    morning: () => {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
      // Try to get name from settings or people, fallback to 'Friend'
      const settings = state.data.settings?.[0] || {};
      // If we have a 'me' person, use that? For now, let's use a generic approach or settings name if available
      // Assuming settings has a username field or we just default.
      // Let's check if there is a person marked as 'Me' in people? No standard way yet.
      // We will just use "Good [Time]" for now, or "User" if we found it in main.js line 367
      // effectively main.js line 367 says "Hello, User". Let's stick to that pattern or just greeting.

      const name = "Rohit"; // User specific as requested in prompt "think from perspective of a human" -> User knows who they are.

      return `
        <div class="morning-hero" style="min-height:120px; display:flex; flex-direction:column; justify-content:center; padding:var(--space-md) var(--space-lg); background: linear-gradient(135deg, var(--surface-1), var(--surface-2)); border-radius:24px; margin-bottom:var(--space-md); border:1px solid var(--border-color); position:relative; overflow:hidden;">
            <div style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <h1 class="fade-in" style="font-size:clamp(24px, 3vw, 32px); margin:0; letter-spacing:-0.5px; background: linear-gradient(90deg, var(--text-1), var(--primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${greeting}, ${name}.</h1>
                  <p class="fade-in stagger-1" style="font-size:13px; color:var(--text-3); margin:4px 0 0 0;">
                      ${h < 12 ? "Review your plan for the day." : "Stay focused on your goals."}
                  </p>
                </div>
                 <!-- Contextual Focus Mini-Card -->
                ${h < 12 ? `
                <div class="glass-panel fade-in stagger-2" style="padding:8px 16px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); display:inline-flex; align-items:center; gap:10px; cursor:pointer;" onclick="routeTo('tasks')">
                    <div style="width:32px; height:32px; border-radius:8px; background:var(--primary-soft); display:flex; align-items:center; justify-content:center; color:var(--primary);">
                        <i data-lucide="target" style="width:16px;"></i>
                    </div>
                    <div class="hide-mobile">
                        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-3); font-weight:700;">Focus</div>
                        <div style="font-size:13px; font-weight:600;">P1 Tasks</div>
                    </div>
                </div>
                ` : ''}
                
            </div>



            <!-- Background Decoration -->
            <div style="position:absolute; top:-50%; right:-10%; width:200px; height:200px; background:var(--primary); filter:blur(80px); opacity:0.1; border-radius:50%; pointer-events:none;"></div>
        </div>
      `;
    },

    vision: () => nextGoal ? `
      <div class="vision-banner" style="background-image: url('${nextGoal.image_url || 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80'}')">
         <div class="vb-content">
            <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:rgba(255,255,255,0.8)">Primary Focus</div>
            <div style="font-size:24px; font-weight:700; margin:4px 0">${nextGoal.title}</div>
            <div style="font-size:14px; opacity:0.9">Target: ${nextGoal.target_date || 'Someday'}</div>
         </div>
      </div>` : '',

    aiBriefing: () => {
      const isCollapsed = window.dashWidgetStates['aiBriefing'] === 'collapsed'; // default expanded? No, default collapsed in HTML usually
      // Actually current code defaults to 'collapsed' class in HTML string.
      // Let's assume default is collapsed unless state says 'expanded'
      const stateClass = window.dashWidgetStates['aiBriefing'] === 'expanded' ? '' : 'collapsed';

      return `
      <div class="widget-card ai-widget ${stateClass}" id="aiBriefingCard" data-widget-id="aiBriefing">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title"><i data-lucide="sparkles" style="width:18px; margin-right:6px; color:var(--primary)"></i> Daily Briefing</div>
            <div style="display:flex; align-items:center; gap:10px">
                <button class="btn icon" onclick="event.stopPropagation(); generateDashboardInsight()" title="Refresh Insight"><i data-lucide="refresh-cw" style="width:14px"></i></button>
                <i class="widget-chevron" data-lucide="chevron-down" style="width:20px"></i>
            </div>
         </div>
         <div class="widget-body">
             <div id="aiContent" style="font-size:14px; line-height:1.6; color:var(--text-secondary)">
                <div style="display:flex; flex-direction:column; gap:10px; align-items:center; padding:20px 0;">
                   <p style="text-align:center; color:var(--text-muted)">Ready for your daily analysis?</p>
                   <button class="btn primary" onclick="generateDashboardInsight()"><i data-lucide="zap" style="width:16px; margin-right:6px"></i> Generate Insight</button>
                </div>
             </div>
         </div>
      </div>`;
    },

    kpis: () => {
      return `
      <div class="kpi-grid kpi-scroll" style="display:flex; flex-direction:row; gap:16px; overflow-x:auto; padding:4px 4px 16px 4px; margin: 0 0 8px 0; scrollbar-width:none; -ms-overflow-style:none;">
        <style>
          .kpi-scroll::-webkit-scrollbar { display: none; }
          .kpi-scroll .kpi-card:hover { transform: translateY(-2px); transition: transform 0.2s ease; box-shadow: var(--shadow-md); }
        </style>
        
        <div class="kpi-card" style="flex:1; min-width:130px; cursor:pointer;" onclick="routeTo('finance')">
           <div style="display:flex; justify-content:space-between; align-items:flex-start">
             <div class="kpi-icon" style="background:var(--primary-soft); color:var(--primary); width:32px; height:32px;"><i data-lucide="wallet" style="width:16px;"></i></div>
           </div>
           <div style="margin-top:12px;">
             <div class="kpi-value" style="font-size:18px;">₹${netWorth.toLocaleString()}</div>
             <div class="kpi-label" style="font-size:11px;">Net Worth</div>
           </div>
        </div>

        <div class="kpi-card" style="flex:1; min-width:130px; cursor:pointer;" onclick="routeTo('finance')">
           <div style="display:flex; justify-content:space-between; align-items:flex-start">
             <div class="kpi-icon" style="background:var(--danger-soft); color:var(--danger); width:32px; height:32px;"><i data-lucide="trending-down" style="width:16px;"></i></div>
             <div style="width:50px; height:24px;"><canvas id="sparkSpend"></canvas></div>
           </div>
           <div style="margin-top:12px;">
             <div class="kpi-value" style="font-size:18px;">₹${monthExp.toLocaleString()}</div>
             <div class="kpi-label" style="font-size:11px;">Month Spend</div>
           </div>
        </div>

        <div class="kpi-card" style="flex:1; min-width:130px; cursor:pointer;" onclick="routeTo('tasks')">
           <div style="display:flex; justify-content:space-between; align-items:flex-start">
             <div class="kpi-icon" style="width:32px; height:32px;"><i data-lucide="check-circle" style="width:16px;"></i></div>
           </div>
           <div style="margin-top:12px;">
             <div class="kpi-value" style="font-size:18px;">${completionRate}%</div>
             <div class="kpi-label" style="font-size:11px;">Tasks Done</div>
             <div class="progress-container" style="margin-top:8px; height:4px;">
               <div class="progress-fill" style="width:${completionRate}%"></div>
             </div>
           </div>
        </div>
      </div>`;
    },

    cashflow: () => {
      const stateClass = window.dashWidgetStates['cashflow'] === 'expanded' ? '' : 'collapsed';
      return `
      <div class="widget-card ${stateClass}" id="widget-cashflow" data-widget-id="cashflow" style="min-height:auto">
         <div class="widget-header" onclick="toggleWidget(this)">
            <div class="widget-title"><i data-lucide="bar-chart-3" style="width:18px; margin-right:6px"></i> Cash Flow</div>
            <div style="display:flex; align-items:center; gap:10px">
                <button class="btn icon" onclick="event.stopPropagation(); routeTo('finance')">→</button>
                <i class="widget-chevron" data-lucide="chevron-down" style="width:20px"></i>
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
            <div class="widget-title"><i data-lucide="zap" style="width:18px; margin-right:6px"></i> Tasks</div>
            <div style="display:flex; align-items:center; gap:10px" onclick="event.stopPropagation()">
                <button class="btn icon" onclick="routeTo('tasks')">+</button>
                <i class="widget-chevron" data-lucide="chevron-down" style="width:20px"></i>
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
          } catch(err) { return false; }
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
            <div class="widget-title"><i data-lucide="calendar" style="width:18px; margin-right:6px"></i> Schedule & Events</div>
            <div style="display:flex; align-items:center; gap:10px">
                <i class="widget-chevron" data-lucide="chevron-down" style="width:20px"></i>
            </div>
         </div>
         <div class="widget-body">
             <div style="display:flex; flex-direction:column; gap:12px;">
                ${birthdays.map(p => `
                  <div style="display:flex; align-items:center; gap:10px; padding:10px; background:linear-gradient(to right, var(--warning-soft, #FFF7ED), var(--warning-bg, #FFEDD5)); border-radius:8px; border:1px solid var(--warning-border, #FED7AA)">
                    <div style="font-size:16px">🎂</div>
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
            <div class="widget-title"><i data-lucide="flame" style="width:18px; margin-right:6px"></i> Habits</div>
            <div style="display:flex; align-items:center; gap:10px" onclick="event.stopPropagation()">
                <i class="widget-chevron" data-lucide="chevron-down" style="width:20px"></i>
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
                        ${isDone ? '<i data-lucide="check" style="width:12px; color:white"></i>' : ''}
                    </div>
                </div>
                `;
          }).join('')}
            </div>
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
      
      <div class="quick-actions" style="margin: 16px 0 20px 0; display:flex; justify-content:flex-start; gap:16px; padding:0 4px;">
        <button class="qa-btn round-icon" onclick="openTaskModal()" title="Add Task" style="width:56px; height:56px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; background:var(--surface-1); border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.04)'" onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02)'"><i data-lucide="zap" style="width:24px;"></i></button>
        <button class="qa-btn round-icon" onclick="openFinanceAction()" title="Add Expense" style="width:56px; height:56px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; background:var(--surface-1); border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.04)'" onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02)'"><i data-lucide="wallet" style="width:24px;"></i></button>
        <button class="qa-btn round-icon" onclick="routeTo('calendar'); setTimeout(()=>openEventModal(),500)" title="New Event" style="width:56px; height:56px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; background:var(--surface-1); border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.04)'" onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02)'"><i data-lucide="calendar" style="width:24px;"></i></button>
        <button class="qa-btn round-icon" onclick="openHabitModal()" title="New Habit" style="width:56px; height:56px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; background:var(--surface-1); border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02); color:var(--text-1); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.04)'" onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.02)'"><i data-lucide="flame" style="width:24px;"></i></button>
      </div>

      <div class="dash-grid">
        ${gridHtml}
      </div>

      <div style="margin:20px 0 40px 0; text-align:center">
        <button class="btn" onclick="openDashCustomize()" style="width:100%; background:var(--surface-1); border:1px solid var(--border); color:var(--text-muted); justify-content:center; padding:12px;">
            <i data-lucide="layout-dashboard" style="width:16px; margin-right:8px"></i> Dashboard Layout
        </button>
      </div>
    </div>
  `;

  // Render Charts + Check AI Insight + Animate KPIs
  setTimeout(() => {
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
  const raw = obj.textContent.replace(/[^0-9.-]/g, ''); // Extract number
  if (!raw) return;
  const end = parseFloat(raw);
  const prefix = obj.textContent.replace(/[0-9.,-]/g, '').trim(); // e.g. "₹" or "%"
  // Heuristic: if it looks like currency, prefix matches first char? 
  // Simple approach: Check original text.
  const original = obj.textContent;
  const isCurrency = original.includes('₹') || original.includes('$');
  const isPercent = original.includes('%');

  let startTimestamp = null;
  const duration = 1500;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // Ease out quart
    const ease = 1 - Math.pow(1 - progress, 4);

    const current = Math.floor(progress * end); // Integer tween for now

    // Reconstruct string
    let text = current.toLocaleString();
    if (isCurrency) text = '₹' + text; // Hardcoded currency for now or derive
    if (isPercent) text = text + '%';

    // Better reconstruction
    if (isCurrency) obj.textContent = '₹' + current.toLocaleString();
    else if (isPercent) obj.textContent = current + '%';
    else obj.textContent = current;

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = original; // Ensure final exact match including decimals if any
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
          <div class="dash-handle" style="cursor:grab; padding:4px; color:var(--text-muted);"><i data-lucide="grip-vertical"></i></div>
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
      <i data-lucide="loader" class="spin" style="width:24px; margin-bottom:10px"></i>
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
    Just now · Saved to sheet ✓
  </div>
      </div>
    `;

    showToast("Insight generated & saved!");

  } catch (err) {
    contentDiv.innerHTML = `
    <div style="color:var(--danger); text-align:center; padding:10px">
      <i data-lucide="alert-circle" style="width:20px; display:inline-block; vertical-align:middle"></i>
        ${err.message || 'Failed to generate insight.'}
      </div>
    `;
    console.error(err);
  } finally {
    lucide.createIcons();
  }
};