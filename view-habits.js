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

  // 2. Sort
  if (_habitSort === 'time') {
    habits.sort((a, b) => (a.reminder_time || '23:59').localeCompare(b.reminder_time || '23:59'));
  }

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
      </style>

      <div class="habit-wrapper">
        <div class="header-row" style="flex-wrap:wrap; gap:10px;">
          <h2 class="page-title" style="margin:0; flex:1">Habit Tracker</h2>
          
          <div style="display:flex; gap:8px; align-items:center;">
            
            <div class="segmented-control">
                <button class="range-btn ${_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=true; renderHabits()">Today</button>
                <button class="range-btn ${!_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=false; renderHabits()">All</button>
            </div>

            ${!_habitShowTodayOnly ? `
            <select class="input" style="width:auto; margin:0; padding:0 8px; height:28px; font-size:12px; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-1); box-shadow:0 1px 2px rgba(0,0,0,0.05);" onchange="_habitDayFilter=this.value; renderHabits()">
               <option value="All" ${_habitDayFilter === 'All' ? 'selected' : ''}>All Days</option>
               ${DAY_NAMES.map(d => `<option value="${d}" ${_habitDayFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            ` : ''}

            <div class="segmented-control">
                <button class="range-btn ${_habitSort === 'default' ? 'active' : ''}" onclick="_habitSort='default'; renderHabits()">Default</button>
                <button class="range-btn ${_habitSort === 'time' ? 'active' : ''}" onclick="_habitSort='time'; renderHabits()">Time</button>
            </div>

            <button class="btn secondary small" onclick="markAllHabitsDone()" title="Mark all today's habits as done">
              ${renderIcon('check-circle', null, 'style="width:14px; margin-right:4px"')}All Done
            </button>
            <button class="btn primary small" onclick="openHabitModal()">${renderIcon('add', null, 'style="width:14px; margin-right:4px"')} Add Habit</button>
          </div>
        </div>

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

    return `
              <div class="habit-card-new ${isExpanded ? 'habit-expanded' : ''} ${stats.consecutiveMissed >= 3 ? 'habit-card-warning' : ''}" id="habit-card-${h.id}" ${stats.consecutiveMissed >= 3 ? 'style="border:2px solid #EF4444 !important; background:linear-gradient(135deg, #FEF2F2, #FEE2E2) !important;"' : ''}>
              
                <div class="habit-card-header" onclick="toggleHabitCard('${h.id}')">
                  <div style="display:flex; align-items:center;">
                    ${habitIconHtml}
                    <div>
                      <div class="habit-title-lg">${h.habit_name}</div>
                      <div class="habit-meta">${h.category || 'General'} • ${displayTime}</div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div class="streak-pill">
                      ${renderIcon('streak', null, 'style="width:16px;"')} ${stats.streak}
                    </div>
                    ${renderIcon('down', null, 'class="collapse-icon" style="width:20px; color:var(--text-muted);"')}
                  </div>
                </div>

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
            
                  <div class="habit-action-row">
                    <button class="habit-action-btn secondary" onclick="event.stopPropagation(); openEditHabit('${h.id}')">
                      ${renderIcon('edit', null, 'style="width:14px;"')} Edit
                    </button>
                    <button class="habit-action-btn secondary" onclick="event.stopPropagation(); deleteHabit('${h.id}')">
                      ${renderIcon('delete', null, 'style="width:14px;"')}
                    </button>
                    ${scheduledToday || _backDateMode ? `
                    <button class="habit-action-btn primary ${isDoneSelectedDate ? 'done' : ''}" 
                            onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}">
                      ${isDoneSelectedDate ? `${renderIcon('save', null, 'style="width:14px;"')} Done` : `${renderIcon('circle', null, 'style="width:14px;"')} Mark Done`}
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
  });
};

// Delete habit function
window.deleteHabit = async function (id) {
  if (!confirm('Delete this habit?')) return;
  await apiCall('delete', 'habits', {}, id);
  showToast('Habit deleted');
  await refreshData('habits');
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
    renderHabits(); // Instant re-render
    await apiCall('delete', 'habit_logs', {}, toDelete.id);
  } else {
    // Not done today — add log (mark done)
    const newLog = { id: 'temp-' + Date.now(), habit_id: id, date: today, completed: true };
    state.data.habit_logs.push(newLog);
    renderHabits(); // Instant re-render
    await apiCall('create', 'habit_logs', { habit_id: id, date: today, completed: true });
  }

  // Background sync to stay in sync with server
  refreshData('habit_logs').then(() => {
    if (state.view === 'habits') renderHabits();
  });
};

// P1 Fix #13: Mark all today-scheduled habits as done with one click
window.markAllHabitsDone = async function () {
  const today = new Date().toISOString().slice(0, 10);
  const habits = state.data.habits || [];
  const logs = state.data.habit_logs || [];

  // Find habits scheduled today that aren't done yet
  const pending = habits.filter(h => {
    const isScheduled = isHabitScheduledToday(h);
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
  });
  renderHabits();
  showToast(`Marked ${pending.length} habit${pending.length > 1 ? 's' : ''} as done!`);

  // Background sync
  await Promise.all(pending.map(h => apiCall('create', 'habit_logs', { habit_id: h.id, date: today, completed: true })));
  refreshData('habit_logs').then(() => {
    if (state.view === 'habits') renderHabits();
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
          <input type="time" class="input" id="mHabitTime">
      </div>
      <div id="dayPickerWrap" style="display:none">
        <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-top:8px; display:block;">Which days?</label>
        ${getDayPickerHtml()}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" data-action="save-habit-modal">Save Habit</button>
      </div>
    `;

  modal.classList.remove('hidden');
}

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
      <input type="time" class="input" id="mHabitTime" value="${reminderTimeValue}">
    </div>
    <div id="dayPickerWrap" style="display:${isWeekly ? 'block' : 'none'}">
      <label style="font-size:12px; font-weight:600; color:var(--text-muted); margin-top:8px; display:block;">Which days?</label>
      ${getDayPickerHtml(h.days || '')}
    </div>
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-habit-modal" data-edit-id="${h.id}">Update Habit</button>
    </div>
  `;
  modal.classList.remove('hidden');
}
