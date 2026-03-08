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

  habits.sort((a, b) => {
    const isDoneA = logs.some(l => String(l.habit_id) === String(a.id) && (l.date || '').startsWith(today));
    const isDoneB = logs.some(l => String(l.habit_id) === String(b.id) && (l.date || '').startsWith(today));
    if (isDoneA && !isDoneB) return 1;
    if (!isDoneA && isDoneB) return -1;
    return 0;
  });

  const categoryEmojis = {
    'Health': 'health', 'Fitness': 'fitness', 'Learning': 'learning',
    'Productivity': 'productivity', 'Spiritual': 'spiritual', 'Other': 'default'
  };

  document.getElementById('main').innerHTML = `
      <style>
        .habit-wrapper { padding: 12px; padding-bottom: 100px; }
        .habit-grid { display: grid; gap: 8px; }
        .habit-card-new {
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-color);
          overflow: hidden;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          z-index: 1;
        }
        .habit-card-new.pending { animation: bentoIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @keyframes bentoIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .habit-card-header {
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }
        .habit-title-wrapper { display: flex; align-items: center; gap: 10px; }
        .habit-emoji-circle {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-2);
          border-radius: 8px;
          font-size: 18px;
          flex-shrink: 0;
          border: 1px solid var(--border-color);
        }
        .habit-title-lg { font-weight: 700; font-size: 0.95rem; color: var(--text-1); letter-spacing: -0.01em; display:flex; align-items:center; }
        .habit-meta { font-size: 9px; color: var(--text-muted); margin-top: 1px; }
        .habit-card-body { display: none; padding: 0 12px 12px 12px; border-top: 1px solid var(--border-color); padding-top: 10px; }
        .habit-expanded .habit-card-body { display: block; }
        .collapse-icon { transition: transform 0.3s; width: 14px; color: var(--text-muted); }
        .habit-expanded .collapse-icon { transform: rotate(180deg); }
        .swipe-reveal-container { position: relative; overflow: hidden; border-radius: 12px; margin-bottom: 8px; }
        .swipe-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; font-size: 24px; padding: 0 24px; color: white; z-index: 0; pointer-events: none; opacity: 0; }
        .swipe-bg-done { background: var(--success); justify-content: flex-start; }
        .swipe-bg-delete { background: var(--danger); justify-content: flex-end; }
        
        /* Premium Streak Pill */
        .streak-pill { 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          padding: 3px 8px; 
          background: var(--surface-2); 
          border-radius: 20px; 
          font-size: 10px; 
          font-weight: 700; 
          color: var(--text-2); 
          border: 1px solid var(--border-color);
          transition: all 0.3s ease;
        }
        .streak-7 { background: linear-gradient(135deg, #FF9D6C, #FF6B35); color: white; border: none; box-shadow: 0 2px 8px rgba(255,107,53,0.3); }
        .streak-30 { background: linear-gradient(135deg, #F7931E, #FF9D6C); color: white; border: none; box-shadow: 0 0 15px rgba(247,147,30,0.5); animation: pulse-gold 2s infinite; }
        @keyframes pulse-gold {
          0% { box-shadow: 0 0 0 0 rgba(247,147,30, 0.6); }
          70% { box-shadow: 0 0 0 10px rgba(247,147,30, 0); }
          100% { box-shadow: 0 0 0 0 rgba(247,147,30, 0); }
        }

        .habit-card-warning { border: 1px solid #EF4444 !important; }

        /* Scorecard Styles Restoration */
        .habit-scorecard-container {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 16px;
          background: var(--surface-2);
          border-radius: 16px;
          padding: 10px;
          border: 1px solid var(--border-color);
        }
        .scorecard-item {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--surface-1);
          aspect-ratio: 1;
          max-width: 45px;
          position: relative;
          border: 1px solid var(--border-color);
        }
        .score-circle-container { position: relative; width: 32px; height: 32px; }
        .score-circle-bg { fill: none; stroke: var(--surface-3); stroke-width: 3; }
        .score-circle-progress { 
          fill: none; 
          stroke: var(--primary); 
          stroke-width: 3; 
          stroke-linecap: round; 
          transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1); 
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
        .scorecard-item.today { border-color: var(--primary); box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.2); }
      </style>

      <div class="habit-wrapper">
        <div class="header-row" style="flex-wrap:wrap; gap:10px; margin-top:8px;">
          <h2 class="page-title" style="margin:0; flex:1">Habits</h2>
          <div style="display:flex; gap:8px; align-items:center;">
            <div class="segmented-control">
                <button class="range-btn ${_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=true; renderHabits()">Today</button>
                <button class="range-btn ${!_habitShowTodayOnly ? 'active' : ''}" onclick="_habitShowTodayOnly=false; renderHabits()">All</button>
            </div>
            ${!_habitShowTodayOnly ? `<select class="input small" onchange="_habitDayFilter=this.value; renderHabits()" style="width: auto;">
              <option value="All" ${_habitDayFilter === 'All' ? 'selected' : ''}>All</option>
              ${DAY_NAMES.map(d => `<option value="${d}" ${_habitDayFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>` : ''}
            <button class="btn primary circle small" onclick="openHabitModal()">${renderIcon('plus', null, 'style="width:18px"')}</button>
          </div>
        </div>

        ${renderHabitScorecard()}    

        <div class="habit-grid">
          ${habits.length === 0 ? '<div class="empty-state">No habits found.</div>' : ''}
          ${habits.map(h => {
    const hLogs = logs.filter(l => String(l.habit_id) === String(h.id));
    const stats = calculateHabitStats(hLogs, today, h);
    const isDoneToday = hLogs.some(l => (l.date || '').startsWith(today));
    const isDoneSelectedDate = _backDateMode ? hLogs.some(l => (l.date || '').startsWith(_selectedBackDate)) : isDoneToday;
    const scheduledToday = isHabitScheduledToday(h);
    const isExpanded = _expandedHabitId === h.id;

    let displayTime = h.frequency || 'Daily';
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
        const text = diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`;
        comingInText = `<span style="background:rgba(245, 158, 11, 0.1); color:#D97706; padding:2px 4px; border-radius:4px; font-size:9px; font-weight:700; margin-left:4px;">in ${text}</span>`;
      }
    }

    return `
              <div class="swipe-reveal-container">
                <div class="swipe-bg swipe-bg-done">✅</div>
                <div class="swipe-bg swipe-bg-delete">🗑️</div>
                <div class="habit-card-new ${isExpanded ? 'habit-expanded' : ''} ${!isDoneToday ? 'pending' : ''} ${stats.consecutiveMissed >= 3 ? 'habit-card-warning' : ''}" id="habit-card-${h.id}">
                  <div class="habit-card-header" onclick="toggleHabitCard('${h.id}')">
                    <div class="habit-title-wrapper">
                      <div class="habit-emoji-circle">${h.emoji || '✨'}</div>
                      <div>
                        <div class="habit-title-lg">${h.habit_name} ${comingInText}</div>
                        <div class="habit-meta">${h.category || 'General'} • ${displayTime}</div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div class="streak-pill ${stats.streak >= 30 ? 'streak-30' : (stats.streak >= 7 ? 'streak-7' : '')}">
                        ${stats.streak >= 30 ? '🏆' : (stats.streak >= 7 ? '🔥' : '⭐')} ${stats.streak}
                      </div>
                      ${renderIcon('down', null, 'class="collapse-icon"')}
                    </div>
                  </div>

                  <div class="habit-card-body">
                    <div style="display:flex; gap:3px; flex-wrap:wrap; margin-bottom:10px;">
                      ${stats.dateButtonsHtml}
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; background:var(--surface-2); padding:8px; border-radius:10px; border:1px solid var(--border-color);">
                      <div style="text-align:center; flex:1;">
                        <div style="font-size:16px; font-weight:800;">${stats.total}</div>
                        <div style="font-size:8px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total</div>
                      </div>
                      <div style="text-align:center; flex:1; border-left:1px solid var(--border-color);">
                        <div style="font-size:16px; font-weight:800; color:var(--primary);">${stats.completionRate}%</div>
                        <div style="font-size:8px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Success</div>
                      </div>
                    </div>
                    <div class="habit-action-row" style="display:flex; flex-wrap:wrap; gap:6px;">
                      <button class="btn secondary small" onclick="event.stopPropagation(); openEditHabit('${h.id}')" style="flex:1; padding:6px; font-size:10px;">Edit</button>
                      ${h.pomodoro_sessions > 0 ? `<button class="btn secondary small" onclick="event.stopPropagation(); quickStartPomodoro('habit', '${h.id}')" style="flex:1; padding:6px; font-size:10px;">Focus</button>` : ''}
                      <button class="btn primary small ${isDoneSelectedDate ? 'done' : ''}" onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}" style="flex:2; padding:6px; font-size:10px;">${isDoneSelectedDate ? 'Done' : 'Mark Done'}</button>
                    </div>
                  </div>
                </div>
              </div>`;
  }).join('')}
        </div>
      </div>
    `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  if (typeof window.syncNativeNotifications === 'function') window.syncNativeNotifications();
  _attachHabitSwipes();
}

function _attachHabitSwipes() {
  if (typeof window.addSwipeAction !== 'function') return;
  document.querySelectorAll('.habit-card-new').forEach(row => {
    const habitId = row.id.replace('habit-card-', '');
    window.addSwipeAction(row,
      () => window.deleteHabit(habitId),
      () => window.toggleHabitOptimistic(habitId)
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
