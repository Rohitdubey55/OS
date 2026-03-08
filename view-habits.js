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

function isHabitScheduledToday(h) {
  if (!h.frequency || h.frequency === 'daily') return true;
  if (h.frequency === 'weekly' && h.days) {
    const today = getTodayDayName();
    return h.days.split(',').map(s => s.trim()).includes(today);
  }
  return true; // default: show
}

function renderHabits() {
  let habits = Array.isArray(state.data.habits) ? [...state.data.habits] : [];
  const logs = state.data.habit_logs || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = getTodayDayName();

  // 1. Filter by Day
  if (_habitShowTodayOnly) {
    habits = habits.filter(h => isHabitScheduledToday(h));
  } else if (_habitDayFilter !== 'All') {
    habits = habits.filter(h => {
      if (h.frequency === 'daily') return true;
      if (h.frequency === 'weekly' && h.days) {
        return h.days.split(',').map(s => s.trim()).includes(_habitDayFilter);
      }
      return false;
    });
  }

  // 2. Sort - Removed as requested


  // Common Emoji Map (Fallback if user doesn't select one)
  const categoryEmojis = {
    'Health': 'health', 'Fitness': 'fitness', 'Learning': 'learning',
    'Productivity': 'productivity', 'Spiritual': 'spiritual', 'Other': 'default'
  };

  document.getElementById('main').innerHTML = `
      <style>
        /* Floating Habit Cards with Multi-layer Shadows */
        .habit-card-new {
          background: var(--surface-1);
          border-radius: 20px;
          padding: 0;
          margin-bottom: 16px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 2px 4px rgba(0,0,0,0.02),
            0 4px 8px rgba(0,0,0,0.04),
            0 8px 16px rgba(0,0,0,0.06),
            0 16px 32px rgba(0,0,0,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
        }
        .habit-card-new:hover {
          transform: translateY(-4px);
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.04),
            0 8px 16px rgba(0,0,0,0.06),
            0 16px 32px rgba(0,0,0,0.08),
            0 32px 64px rgba(0,0,0,0.12);
        }
        .habit-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          cursor: pointer;
          background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%);
          user-select: none;
        }
        .habit-card-body {
          display: none;
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }
        .habit-card-new.habit-expanded .habit-card-body {
          display: block;
        }
        .habit-emoji-lg {
          font-size: 32px;
          margin-right: 12px;
        }
        .habit-title-lg {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-1);
        }
        .habit-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .streak-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          background: linear-gradient(135deg, #FF6B35, #F7931E);
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(255,107,53,0.3);
        }
        @keyframes pulse-gold {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .habit-action-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .habit-action-btn {
          flex: 1;
          padding: 10px;
          border-radius: 12px;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .habit-action-btn.primary {
          background: var(--primary);
          color: white;
        }
        .habit-action-btn.primary:hover {
          filter: brightness(1.1);
          transform: scale(1.02);
        }
        .habit-action-btn.primary.done {
          background: var(--success);
        }
        .habit-action-btn.secondary {
          background: var(--surface-2);
          color: var(--text-1);
        }
        .habit-action-btn.secondary:hover {
          background: var(--surface-3);
        }
        .back-date-picker {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--surface-2);
          border-radius: 12px;
          margin-bottom: 12px;
        }
        .back-date-picker input {
          flex: 1;
        }
        .heatmap-cell-new {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: var(--surface-3);
          transition: all 0.2s;
          cursor: pointer;
        }
        .heatmap-cell-new.filled {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark, #3730A3));
        }
        .heatmap-cell-new.skipped {
          background: var(--surface-2);
          opacity: 0.5;
        }
        .heatmap-cell-new:hover {
          transform: scale(1.2);
        }
        .date-btn {
          font-family: inherit;
          font-weight: 500;
          transition: all 0.2s;
        }
        .date-btn:hover {
          transform: scale(1.05);
          filter: brightness(0.95);
        }
        .date-btn.filled {
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .date-btn.missed:hover {
          background: linear-gradient(135deg, var(--primary-soft, #E0E7FF), var(--primary)) !important;
          color: white !important;
          border-color: var(--primary) !important;
        }
        .back-date-picker-inline {
          display: flex;
          flex-direction: column;
        }
        .back-date-picker-inline label {
          cursor: pointer;
        }
        .habit-card-warning {
          border: 2px solid #EF4444 !important;
          animation: pulse-warning 2s infinite;
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        .collapse-icon {
          transition: transform 0.3s;
        }
        .habit-expanded .collapse-icon {
          transform: rotate(180deg);
        }
        /* Scorecard Styles */
        .habit-scorecard-container {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          padding: 12px 0;
          margin-bottom: 16px;
          background: var(--surface-2);
          border-radius: 16px;
          padding: 12px;
          border: 1px solid var(--border-color);
        }
        .scorecard-item {
          flex: 1;
          aspect-ratio: 1/1;
          background: var(--surface-1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.05);
          position: relative;
          max-width: 45px;
        }
        .scorecard-item.today {
          background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%);
          border: 1px solid var(--primary-soft);
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
          transform: scale(1.05);
          z-index: 1;
        }
        .score-day {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .score-circle-container {
          position: relative;
          width: 32px;
          height: 32px;
        }
        .score-circle-bg {
          fill: none;
          stroke: var(--surface-3);
          stroke-width: 3;
        }
        .score-circle-progress {
          fill: none;
          stroke: var(--primary);
          stroke-width: 3;
          stroke-linecap: round;
          transition: stroke-dashoffset 1s ease-out;
        }
        .score-percent {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 8px;
          font-weight: 800;
          color: var(--text-1);
        }
      </style>

      <div class="habit-wrapper">
        <div class="header-row" style="flex-wrap:wrap; gap:10px; margin-top:8px;">
          <h2 class="page-title" style="margin:0; flex:1">Habit Tracker</h2>
          
          <div style="display:flex; gap:8px; align-items:center;">
            
            <div class="segmented-control">
                <button class="range-btn ${_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=true; renderHabits()">Today</button>
                <button class="range-btn ${!_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=false; renderHabits()">All</button>
            </div>

            ${!_habitShowTodayOnly ? `
            <select class="input small" onchange="_habitDayFilter=this.value; renderHabits()" style="width: auto;">
              <option value="All" ${_habitDayFilter === 'All' ? 'selected' : ''}>All Days</option>
              ${DAY_NAMES.map(d => `<option value="${d}" ${_habitDayFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            ` : ''}

            <button class="btn primary circle small" onclick="openHabitModal()" title="Add Habit">
              ${renderIcon('plus', null, 'style="width:20px"')}
            </button>
          </div>
        </div>

        ${renderHabitScorecard()}    

        <!-- Back Date Mode Toggle - Now inside each card -->

        <div class="habit-grid" style="display:block;">
          ${habits.length === 0 ? '<div class="empty-state">No habits found.</div>' : ''}
          ${habits.map(h => {
    const hLogs = logs.filter(l => String(l.habit_id) === String(h.id));
    const stats = calculateHabitStats(hLogs, today, h);
    const isDoneToday = hLogs.some(l => (l.date || '').startsWith(today));
    const isDoneSelectedDate = _backDateMode ? hLogs.some(l => (l.date || '').startsWith(_selectedBackDate)) : isDoneToday;
    const scheduledToday = isHabitScheduledToday(h);

    // Resolve icon from emoji or category
    const iconName = resolveLegacyEmoji(h.emoji) || categoryEmojis[h.category] || 'default';
    const habitIconHtml = renderIcon(iconName, null, 'class="habit-emoji-lg"');

    const daysList = h.days ? h.days.split(',').map(s => s.trim()) : [];
    const isExpanded = _expandedHabitId === h.id;

    // Parse Time
    let displayTime = h.frequency || 'Daily';
    if (h.reminder_time) {
      const rt = String(h.reminder_time);
      if (rt.startsWith('1899-12-30T')) {
        const timePart = rt.slice(11, 16);
        if (timePart.match(/^\d{2}:\d{2}$/)) {
          displayTime = `@ ${timePart}`;
        }
      } else if (rt.includes('T') && !rt.startsWith('1899')) {
        const dt = new Date(rt);
        if (!isNaN(dt.getTime())) {
          displayTime = `@ ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        }
      } else if (rt.match(/^\d{2}:\d{2}/)) {
        displayTime = `@ ${rt.slice(0, 5)}`;
      }
    }

    // Calculate "Coming in X hours"
    let comingInText = '';
    if (scheduledToday && !isDoneToday && h.reminder_time) {
      const now = new Date();
      const habitTime = new Date(now);

      const rt = String(h.reminder_time);
      if (rt.startsWith('1899-12-30T')) {
        habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
      } else if (rt.includes('T') && !rt.startsWith('1899')) {
        const dt = new Date(rt);
        habitTime.setHours(dt.getHours(), dt.getMinutes(), 0, 0);
      } else if (rt.match(/^\d{2}:\d{2}/)) {
        const parts = rt.split(':');
        habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      }

      if (habitTime > now) {
        const diffMs = habitTime.getTime() - now.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHrs > 0) {
          comingInText = `<span style="background:rgba(245, 158, 11, 0.15); color:#D97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-left:6px;">in ${diffHrs}h ${diffMins}m</span>`;
        } else if (diffMins > 0) {
          comingInText = `<span style="background:rgba(245, 158, 11, 0.15); color:#D97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-left:6px;">in ${diffMins}m</span>`;
        } else {
          comingInText = `<span style="background:rgba(245, 158, 11, 0.15); color:#D97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-left:6px;">Now</span>`;
        }
      }
    }

    return `
              <div class="habit-card-new ${isExpanded ? 'habit-expanded' : ''} ${stats.consecutiveMissed >= 3 ? 'habit-card-warning' : ''}" id="habit-card-${h.id}" ${stats.consecutiveMissed >= 3 ? 'style="border:2px solid #EF4444 !important; background:linear-gradient(135deg, #FEF2F2, #FEE2E2) !important;"' : ''}>
              
                <div class="habit-card-header" onclick="toggleHabitCard('${h.id}')">
                  <div style="display:flex; align-items:center;">
                    ${habitIconHtml}
                    <div>
                      <div class="habit-title-lg" style="display:flex; align-items:center;">${h.habit_name} ${comingInText}</div>
                      <div class="habit-meta">${h.category || 'General'} • ${displayTime}</div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div class="streak-pill ${stats.streak >= 30 ? 'milestone-30' : (stats.streak >= 7 ? 'milestone-7' : '')}" style="${stats.streak >= 7 ? 'background:linear-gradient(135deg, #FEF08A, #F59E0B); color:#78350F;' : ''} ${stats.streak >= 30 ? 'box-shadow: 0 0 15px rgba(245, 158, 11, 0.5); animation: pulse-gold 2s infinite;' : ''}">
                      ${stats.streak >= 30 ? '🏆' : (stats.streak >= 7 ? '🔥' : renderIcon('streak', null, 'style="width:16px;"'))} ${stats.streak}
                    </div>
                    ${renderIcon('down', null, 'class="collapse-icon" style="width:20px; color:var(--text-muted);"')}
                  </div>
                </div>

                ${scheduledToday && !isDoneToday && new Date().getHours() >= 20 ? `
                  <div style="padding: 0 16px 12px 16px; font-size: 11px; font-weight: 700; color: #EF4444; letter-spacing: 0.5px; text-transform: uppercase;">
                     <i data-lucide="alert-circle" style="width:12px; vertical-align:middle; margin-right:4px;"></i> Don't break the chain!
                  </div>
                ` : ''}

                <div class="habit-card-body">
                  ${h.frequency === 'weekly' && daysList.length > 0 ? `
                  <div style="display:flex; gap:4px; margin-bottom:12px; flex-wrap:wrap;">
                    ${DAY_NAMES.map(d => `
                      <span style="font-size:11px; padding:4px 10px; border-radius:12px; font-weight:600;
                        background:${daysList.includes(d) ? (d === todayDay ? 'var(--primary)' : 'var(--primary-soft)') : 'var(--surface-2)'};
                        color:${daysList.includes(d) ? (d === todayDay ? 'white' : 'var(--primary)') : 'var(--text-muted)'};">
                        ${d}
                      </span>
                    `).join('')}
                  </div>
                  ` : ''}

                  <!-- Back Date Picker inside card -->
                  <div style="margin-bottom:12px; padding:10px; background:var(--surface-2); border-radius:8px; display:none;">
                    
                    ${_backDateMode ? `
                    <input type="date" class="input" id="backDateInput" value="${_selectedBackDate}" max="${today}" 
                           onchange="_selectedBackDate=this.value; renderHabits()" style="flex:1; max-width:200px; margin-top:8px;">
                    ` : ''}
                  </div>
            
                  <!-- Date buttons instead of heatmap dots -->
                  <div class="date-buttons-container" style="margin-bottom:12px;">
                    <div class="stat-mini" style="margin-bottom:6px; font-weight:600;">Last 14 Days</div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                      ${stats.dateButtonsHtml}
                    </div>
                  </div>
            
                  <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <div style="text-align:center;">
                      <div style="font-size:24px; font-weight:800; color:var(--text-1);">${stats.total}</div>
                      <div style="font-size:11px; color:var(--text-muted);">Total Days</div>
                    </div>
                    <div style="text-align:center;">
                      <div style="font-size:24px; font-weight:800; color:var(--primary);">${stats.completionRate}%</div>
                      <div style="font-size:11px; color:var(--text-muted);">Success Rate</div>
                    </div>
                  </div>
            
                  <div class="habit-action-row" style="display:flex; flex-wrap:wrap; gap:8px;">
                    <button class="habit-action-btn secondary" onclick="event.stopPropagation(); openEditHabit('${h.id}')" style="flex:1">
                      ${renderIcon('edit', null, 'style="width:14px;"')} Edit
                    </button>
                    <button class="habit-action-btn secondary" onclick="event.stopPropagation(); deleteHabit('${h.id}')">
                      ${renderIcon('delete', null, 'style="width:14px;"')}
                    </button>
                    
                    ${h.pomodoro_sessions > 0 ? `
                    <button class="habit-action-btn secondary" onclick="event.stopPropagation(); quickStartPomodoro('habit', '${h.id}')" style="width:100%; gap:6px; background:var(--surface-3); margin-top:4px; display:flex; align-items:center; justify-content:center;">
                      ${renderIcon('timer', null, 'style="width:16px;"')} Focus Mode
                    </button>
                    ` : ''}

                    ${scheduledToday || _backDateMode ? `
                    <button class="habit-action-btn primary ${isDoneSelectedDate ? 'done' : ''}" 
                            onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}"
                            style="width:100%; margin-top:4px;">
                      ${isDoneSelectedDate ? renderIcon('check', null, 'style="width:16px; margin-right:4px;"') + ' Completed' : 'Mark Done'}
                    </button>
                    ` : ''}
                  </div>
                </div>
          
              </div>
            `;
  }).join('')}
        </div>
      </div>
    `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  // Re-sync native alarms whenever habits are rendered (data is fresh)
  if (typeof window.syncNativeNotifications === 'function') {
    window.syncNativeNotifications();
  }

  // Attach swipe actions
  _attachHabitSwipes();
}

function _attachHabitSwipes() {
  if (typeof window.addSwipeAction !== 'function') return;
  document.querySelectorAll('.habit-card-new').forEach(row => {
    const habitId = row.id.replace('habit-card-', '');
    window.addSwipeAction(row,
      () => { // Swipe Left -> Delete
        window.deleteHabit(habitId);
      },
      () => { // Swipe Right -> Toggle Done
        window.toggleHabitOptimistic(habitId);
      }
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
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = checkDate.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      if (!habit.days.split(',').map(s => s.trim()).includes(dayName)) {
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

  // Date buttons (Last 14 days) - Clickable dates showing completion status
  let dateButtonsHtml = '';
  let missedCount = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const isFilled = unique.includes(iso);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // For weekly habits, check if this day was scheduled
    let isScheduled = true;
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
    }

    // Count missed scheduled days (only in last 14 days for warning)
    if (isScheduled && !isFilled && i <= 13) {
      missedCount++;
    }

    // For daily habits, count all missed days; for weekly only scheduled days
    if (!isFilled && isScheduled) {
      missedCount++;
    }

    let btnClass = 'date-btn ';
    let btnStyle = 'font-size:10px; padding:4px 6px; border-radius:4px; cursor:pointer; ';
    if (isFilled) {
      btnClass += 'filled';
      btnStyle += 'background:linear-gradient(135deg, var(--primary), var(--primary-dark, #3730A3)); color:white; border:none;';
    } else if (!isScheduled) {
      btnClass += 'skipped';
      btnStyle += 'background:var(--surface-2); color:var(--text-muted); border:1px dashed var(--border-color); opacity:0.5;';
    } else {
      btnClass += 'missed';
      btnStyle += 'background:var(--surface-1); color:var(--text-2); border:1px solid var(--border-color);';
    }

    // Clickable to toggle habit for that date
    dateButtonsHtml += `<button class="${btnClass}" style="${btnStyle}" 
      onclick="event.stopPropagation(); toggleHabitForDate('${habit?.id || ''}', '${iso}')" 
      title="${iso}${isFilled ? ' - Completed' : (isScheduled ? ' - Click to mark done' : ' - Not scheduled')}">
      ${label}
    </button>`;
  }

  // Calculate missed scheduled times (for warning)
  let consecutiveMissed = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    let isScheduled = true;
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
    }

    if (isScheduled && !unique.includes(iso)) {
      consecutiveMissed++;
      if (consecutiveMissed >= 3) break;
    } else if (isScheduled && unique.includes(iso)) {
      break; // Found a completion, stop counting
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
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
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
      if (!h.frequency || h.frequency === 'daily') {
        isScheduled = true;
      } else if (h.frequency === 'weekly' && h.days) {
        const scheduledDays = h.days.split(',').map(s => s.trim());
        if (scheduledDays.includes(dayName)) isScheduled = true;
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
        <div class="score-circle-container">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle class="score-circle-bg" cx="16" cy="16" r="13"></circle>
            <circle class="score-circle-progress" cx="16" cy="16" r="13" 
                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; ${percent === 100 ? 'stroke: var(--success);' : ''}"></circle>
          </svg>
          <div class="score-percent">${percent}%</div>
        </div>
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
  const box = modal.querySelector('.modal-box');

  // Categories list
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];

  box.innerHTML = `
      <h3>New Habit</h3>
      
      <div style="display:flex; gap:10px; align-items:center">
         <select class="input" id="mHabitEmoji" style="width:60px; font-size:20px; padding:0 8px;">
             <option value="✨">✨</option>
             <option value="💪">💪</option>
             <option value="📚">📚</option>
             <option value="🧘">🧘</option>
             <option value="💧">💧</option>
             <option value="🍎">🍎</option>
             <option value="🏃">🏃</option>
             <option value="💤">💤</option>
         </select>
         <input class="input" id="mHabitName" placeholder="Habit Name (e.g. Read 10 pages)" style="flex:1">
      </div>

      <div style="display:flex; gap:10px">
          <select class="input" id="mHabitCat">
              <option value="" disabled selected>Category</option>
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="input" id="mHabitFreq" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
          </select>
          <input type="time" class="input" id="mHabitTime" required title="Time is required for Planner integration">
          <input type="number" class="input" id="mHabitDuration" placeholder="Mins" value="45" style="width:70px" min="5" step="5" title="Duration in minutes">
      </div>
      <div id="dayPickerWrap" style="display:none">
        <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-top:8px; display:block;">Which days?</label>
        ${getDayPickerHtml()}
      </div>
      
      <div style="margin-top:16px; padding:12px; background:var(--surface-2); border-radius:12px; border:1px solid var(--border-color);">
        <label style="font-size:11px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
            <i data-icon="timer" style="width:14px"></i> Pomodoro Integration
        </label>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; gap:10px;">
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block;">Sessions / day</span>
              <input type="number" class="input" id="mHabitPomoSessions" placeholder="0" value="0" style="width:100%" min="0">
            </div>
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block;">Length (min)</span>
              <input type="number" class="input" id="mHabitPomoLength" placeholder="25" value="25" style="width:100%" min="5" step="5">
            </div>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" data-action="save-habit-modal">Save Habit</button>
      </div>
    `;

  modal.classList.remove('hidden');
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
  const box = modal.querySelector('.modal-box');
  const isWeekly = h.frequency === 'weekly';
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];
  const reminderTimeValue = parseReminderTimeToHHMM(h.reminder_time);

  box.innerHTML = `
    <h3>Edit Habit</h3>

    <div style="display:flex; gap:10px; align-items:center">
         <select class="input" id="mHabitEmoji" style="width:60px; font-size:20px; padding:0 8px;">
             <option value="✨" ${h.emoji === '✨' ? 'selected' : ''}>✨</option>
             <option value="💪" ${h.emoji === '💪' ? 'selected' : ''}>💪</option>
             <option value="📚" ${h.emoji === '📚' ? 'selected' : ''}>📚</option>
             <option value="🧘" ${h.emoji === '🧘' ? 'selected' : ''}>🧘</option>
             <option value="💧" ${h.emoji === '💧' ? 'selected' : ''}>💧</option>
             <option value="🍎" ${h.emoji === '🍎' ? 'selected' : ''}>🍎</option>
             <option value="🏃" ${h.emoji === '🏃' ? 'selected' : ''}>🏃</option>
             <option value="💤" ${h.emoji === '💤' ? 'selected' : ''}>💤</option>
         </select>
         <input class="input" id="mHabitName" value="${(h.habit_name || '').replace(/"/g, '"')}" placeholder="Habit Name" style="flex:1">
    </div>

    <div style="display:flex; gap:10px">
      <select class="input" id="mHabitCat">
        ${categories.map(c => `<option value="${c}" ${h.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="input" id="mHabitFreq" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
        <option value="daily" ${h.frequency === 'daily' ? 'selected' : ''}>Daily</option>
        <option value="weekly" ${h.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
      </select>
      <input type="time" class="input" id="mHabitTime" value="${reminderTimeValue}" required title="Time is required for Planner integration">
      <input type="number" class="input" id="mHabitDuration" placeholder="Mins" value="${h.duration || 45}" style="width:70px" min="5" step="5" title="Duration in minutes">
    </div>
    <div id="dayPickerWrap" style="display:${isWeekly ? 'block' : 'none'}">
      <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-top:8px; display:block;">Which days?</label>
      ${getDayPickerHtml(h.days || '')}
    </div>

    <div style="margin-top:16px; padding:12px; background:var(--surface-2); border-radius:12px; border:1px solid var(--border-color);">
      <label style="font-size:11px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
          <i data-icon="timer" style="width:14px"></i> Pomodoro Integration
      </label>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; gap:10px;">
          <div style="flex:1;">
            <span style="font-size:12px; color:var(--text-2); display:block;">Sessions / day</span>
            <input type="number" class="input" id="mHabitPomoSessions" placeholder="0" value="${h.pomodoro_sessions || 0}" style="width:100%" min="0">
          </div>
          <div style="flex:1;">
            <span style="font-size:12px; color:var(--text-2); display:block;">Length (min)</span>
            <input type="number" class="input" id="mHabitPomoLength" placeholder="25" value="${h.pomodoro_length || 25}" style="width:100%" min="5" step="5">
          </div>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-habit-modal" data-edit-id="${h.id}">Update Habit</button>
    </div>
  `;
  modal.classList.remove('hidden');
}
