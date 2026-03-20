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

function isHabitTimeInFuture(reminder_time) {
  if (!reminder_time) return false;
  const now = new Date();
  const habitTime = new Date(now);
  const rt = String(reminder_time);

  if (rt.startsWith('1899-12-30T')) {
    habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
  } else if (rt.match(/^\d{2}:\d{2}/)) {
    const parts = rt.split(':');
    habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  } else {
    return false;
  }
  return habitTime > now;
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

  // Determine the "next upcoming" habit: soonest future reminder among pending habits,
  // falling back to the first pending habit if none have a future reminder time.
  let nextUpHabitId = null;
  if (_habitShowTodayOnly) {
    const pendingHabits = habits.filter(h =>
      !logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today))
    );
    let soonestDiff = Infinity;
    pendingHabits.forEach(h => {
      if (h.reminder_time) {
        const now = new Date();
        const habitTime = new Date(now);
        const rt = String(h.reminder_time);
        if (rt.startsWith('1899-12-30T')) {
          habitTime.setHours(parseInt(rt.slice(11, 13), 10), parseInt(rt.slice(14, 16), 10), 0, 0);
        } else if (rt.match(/^\d{2}:\d{2}/)) {
          const parts = rt.split(':');
          habitTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
        const diff = habitTime.getTime() - now.getTime();
        if (diff > 0 && diff < soonestDiff) {
          soonestDiff = diff;
          nextUpHabitId = h.id;
        }
      }
    });
    if (!nextUpHabitId && pendingHabits.length > 0) {
      nextUpHabitId = pendingHabits[0].id;
    }
  }

  const categoryEmojis = {
    'Health': 'health', 'Fitness': 'fitness', 'Learning': 'learning',
    'Productivity': 'productivity', 'Spiritual': 'spiritual', 'Other': 'default'
  };

  document.getElementById('main').innerHTML = `
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
          ${(() => {
    // Separate incomplete and complete habits
    const incompleteHabits = habits.filter(h => !logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today)));
    const completeHabits = habits.filter(h => logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(today)));

    // Group INCOMPLETE habits by routine
    const grouped = incompleteHabits.reduce((acc, h) => {
      const r = h.routine || 'General';
      if (!acc[r]) acc[r] = [];
      acc[r].push(h);
      return acc;
    }, {});

    // Routine sorting logic (respect settings)
    const s = state.data.settings?.[0] || {};
    const settingsRoutines = (s.habit_routines || 'Morning,Work,Evening').split(',').map(r => r.trim()).filter(Boolean);

    const routines = Object.keys(grouped).sort((a, b) => {
      const idxA = settingsRoutines.indexOf(a);
      const idxB = settingsRoutines.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    });

    const renderCard = (h) => {
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
          comingInText = `<span style="background:rgba(245, 158, 11, 0.1); color:#D97706; padding:2px 6px; border-radius:6px; font-size:9px; font-weight:700;">in ${diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`}</span>`;
        }
      }

      return `
        <div class="swipe-reveal-container">
          <div class="swipe-bg swipe-bg-done">
            <div class="swipe-bg-inner"><span class="swipe-bg-icon">✅</span><span class="swipe-bg-label">Mark Done</span></div>
          </div>
          <div class="swipe-bg swipe-bg-delete">
            <div class="swipe-bg-inner"><span class="swipe-bg-icon">🗑️</span><span class="swipe-bg-label">Delete</span></div>
          </div>
          <div class="habit-card-new ${isExpanded ? 'habit-expanded' : ''} ${isDoneToday ? 'done' : 'pending'} ${stats.consecutiveMissed >= 3 && !isHabitTimeInFuture(h.reminder_time) ? 'habit-card-warning' : ''} ${String(h.id) === String(nextUpHabitId) ? 'habit-next-up' : ''}" id="habit-card-${h.id}">
            <div class="habit-card-header" onclick="toggleHabitCard('${h.id}')">
              <div class="habit-title-wrapper">
                <div class="habit-emoji-circle">${h.emoji || '✨'}</div>
                <div>
                  <div class="habit-title-lg">${h.habit_name} ${comingInText}${String(h.id) === String(nextUpHabitId) ? '<span class="up-next-badge">Up Next</span>' : ''}</div>
                  <div class="habit-meta">${h.category || 'General'} • ${displayTime}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="streak-pill ${stats.streak >= 30 ? 'streak-30' : (stats.streak >= 7 ? 'streak-7' : '')}">
                  ${stats.streak >= 30 ? '🏆' : (stats.streak >= 7 ? '🔥' : '⭐')} ${stats.streak}
                </div>
                ${h.reminder_time ? `<button class="habit-alarm-btn ${h.alarm_enabled === false ? 'off' : 'on'}" id="alarm-btn-${h.id}" onclick="event.stopPropagation(); toggleHabitAlarm('${h.id}')" title="${h.alarm_enabled === false ? 'Alarm off' : 'Alarm on'}">${renderIcon(h.alarm_enabled === false ? 'bell-off' : 'bell', null, 'style="width:14px;height:14px"')}</button>` : ''}
                ${renderIcon('down', null, 'class="collapse-icon"')}
              </div>
            </div>
            ${stats.consecutiveMissed >= 3 && String(h.id) !== String(nextUpHabitId) && !isHabitTimeInFuture(h.reminder_time) ? `<div class="habit-missed-banner">🔗 Don't break the chain! ${stats.consecutiveMissed} day${stats.consecutiveMissed > 1 ? 's' : ''} missed in a row</div>` : ''}
            <div class="habit-card-body">
              <div class="habit-date-grid">${stats.dateButtonsHtml}</div>
              <div class="habit-stats-row">
                <div class="habit-stat-item">
                  <div class="habit-stat-value">${stats.total}</div>
                  <div class="habit-stat-label">Total</div>
                </div>
                <div class="habit-stat-item">
                  <div class="habit-stat-value primary">${stats.completionRate}%</div>
                  <div class="habit-stat-label">Success</div>
                </div>
              </div>
              <div class="habit-action-row">
                <button class="btn secondary small" onclick="event.stopPropagation(); openEditHabit('${h.id}')">Edit</button>
                ${h.pomodoro_sessions > 0 ? `<button class="btn secondary small" onclick="event.stopPropagation(); quickStartPomodoro('habit', '${h.id}')">Focus</button>` : ''}
                <button class="btn primary small ${isDoneSelectedDate ? 'done' : ''}" onclick="event.stopPropagation(); ${_backDateMode ? `toggleHabitForDate('${h.id}', '${_selectedBackDate}')` : `toggleHabitOptimistic('${h.id}')`}">${isDoneSelectedDate ? 'Done' : 'Mark Done'}</button>
              </div>
            </div>
          </div>
        </div>`;
    };

    let html = routines.map(r => `
      <div class="habit-routine-group" style="margin-bottom: 24px;">
        <div class="habit-routine-header" style="font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-left: 10px; border-left: 3px solid var(--primary); line-height: 1;">${r}</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${grouped[r].map(h => renderCard(h)).join('')}
        </div>
      </div>`).join('');

    if (completeHabits.length > 0) {
      html += `
        <div class="habit-routine-group completed-section" style="margin-top: 32px; margin-bottom: 24px;">
          <div class="habit-routine-header" style="font-size: 13px; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-left: 10px; border-left: 3px solid #10B981; line-height: 1;">COMPLETED</div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${completeHabits.map(h => renderCard(h)).join('')}
          </div>
        </div>`;
    }
    return html;
  })()}
        </div>
      </div>
    `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  if (typeof window.syncNativeNotifications === 'function') window.syncNativeNotifications();
  _attachHabitSwipes();
}

function _attachHabitSwipes() {
  if (typeof window.addSwipeAction !== 'function') {
    console.log('[Habits] addSwipeAction not found!');
    return;
  }
  const cards = document.querySelectorAll('.habit-card-new');
  console.log('[Habits] Found ' + cards.length + ' habit cards for swipes');
  cards.forEach(row => {
    const habitId = row.id.replace('habit-card-', '');
    window.addSwipeAction(row,
      () => { console.log('[Habits] Swipe left on ' + habitId); window.deleteHabit(habitId); },
      () => { console.log('[Habits] Swipe right on ' + habitId); window.toggleHabitOptimistic(habitId); }
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

// Toggle alarm on/off for a habit — saves to sheet immediately
window.toggleHabitAlarm = async function (habitId) {
  const habit = (state.data.habits || []).find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const newVal = habit.alarm_enabled === false ? true : false; // default is ON

  // Optimistic UI update
  habit.alarm_enabled = newVal;
  const btn = document.getElementById('alarm-btn-' + habitId);
  if (btn) {
    btn.className = 'habit-alarm-btn ' + (newVal ? 'on' : 'off');
    btn.title = newVal ? 'Alarm on — tap to disable' : 'Alarm off — tap to enable';
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      btn.innerHTML = newVal
        ? '<i data-lucide="bell" style="width:14px;height:14px"></i>'
        : '<i data-lucide="bell-off" style="width:14px;height:14px"></i>';
      lucide.createIcons({ nodes: [btn] });
    }
  }

  try {
    await apiCall('update', 'habits', { alarm_enabled: newVal }, habitId);
    // Update cache
    state.data.habits = state.data.habits.map(h =>
      String(h.id) === String(habitId) ? Object.assign({}, h, { alarm_enabled: newVal }) : h
    );
    // Re-sync notifications
    if (typeof window.syncNativeNotifications === 'function') {
      setTimeout(window.syncNativeNotifications, 300);
    }
    const label = newVal ? 'Alarm enabled 🔔' : 'Alarm disabled 🔕';
    if (typeof showToast === 'function') showToast(label, 'success');
  } catch (err) {
    console.error('[Habits] Failed to toggle alarm:', err);
    // Revert on failure
    habit.alarm_enabled = !newVal;
    if (btn) btn.className = 'habit-alarm-btn ' + (!newVal ? 'on' : 'off');
  }
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

  // Smart History: Find last 7 scheduled occurrences
  let scheduledDates = [];
  let daySearchDate = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(daySearchDate);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    let isScheduled = true;
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
    }

    if (isScheduled) {
      scheduledDates.unshift({ iso, dateObj: d });
      if (scheduledDates.length === 7) break;
    }
  }

  let dateButtonsHtml = '';
  scheduledDates.forEach(({ iso, dateObj }) => {
    const isFilled = unique.includes(iso);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let btnClass = 'date-btn';
    if (isFilled) {
      btnClass += ' filled';
    } else {
      btnClass += ' missed';
    }

    dateButtonsHtml += `<button class="${btnClass}"
      onclick="event.stopPropagation(); toggleHabitForDate('${habit?.id || ''}', '${iso}')"
      title="${iso}${isFilled ? ' - Completed' : ' - Click to mark done'}">
      ${label}
    </button>`;
  });

  // Calculate missed scheduled times (for warning)
  let consecutiveMissed = 0;
  const isFutureToday = isHabitTimeInFuture(habit?.reminder_time);

  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const isToday = i === 0;

    let isScheduled = true;
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
    }

    if (isScheduled) {
      const isDone = unique.includes(iso);
      if (isDone) {
        break; // Found a completion, stop counting
      } else {
        // If it's today and the time hasn't passed yet, don't count it as a "missed scheduled time" yet
        if (isToday && isFutureToday) {
          continue;
        }
        consecutiveMissed++;
        if (consecutiveMissed >= 3) break;
      }
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
  modal.classList.add('bottom-sheet');
  const box = modal.querySelector('.modal-box');
  const s = state.data.settings?.[0] || {};
  const routinesStr = s.habit_routines || 'Morning,Work,Evening';
  const routines = routinesStr.split(',').map(r => r.trim()).filter(Boolean);
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];

  box.innerHTML = `
      <div class="modal-header-bar">
          <i data-icon="streak"></i>
          <h3>New Habit</h3>
      </div>
      
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <!-- Identity Section -->
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Habit Details</label>
          <div style="display:flex; gap:12px; align-items:center">
             <div style="position: relative;">
               <select class="input" id="mHabitEmoji" style="width:64px; font-size:20px; padding:0 8px; height: 48px; appearance: none; text-align: center;">
                   <option value="✨">✨</option>
                   <option value="💪">💪</option>
                   <option value="📚">📚</option>
                   <option value="🧘">🧘</option>
                   <option value="💧">💧</option>
                   <option value="🍎">🍎</option>
                   <option value="🏃">🏃</option>
                   <option value="💤">💤</option>
               </select>
             </div>
             <input class="input" id="mHabitName" placeholder="What habit do you want to build?" style="flex:1; height: 48px; font-size: 15px;">
          </div>
        </div>

        <!-- Schedule Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Frequency</label>
            <select class="input" id="mHabitFreq" style="width: 100%;" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Reminder Time</label>
            <input type="time" class="input" id="mHabitTime" style="width: 100%;" required>
          </div>
        </div>

        <div id="dayPickerWrap" style="display:none; margin-top: -4px;">
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Which days?</label>
          ${getDayPickerHtml()}
        </div>

        <!-- Metadata Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Category</label>
            <select class="input" id="mHabitCat" style="width: 100%;">
                <option value="" disabled selected>Select...</option>
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Routine</label>
            <select class="input" id="mHabitRoutine" style="width: 100%;">
              <option value="">None</option>
              ${routines.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Duration</label>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input type="number" class="input" id="mHabitDuration" value="45" style="flex:1; width: 40px;" min="5" step="5">
              <span style="font-size: 12px; color: var(--text-3);">m</span>
            </div>
          </div>
        </div>
        
        <!-- Pomodoro Section -->
        <div style="padding:16px; background:var(--primary-soft); border-radius:16px; border:1px solid var(--primary-light); opacity: 0.9;">
          <label style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
              <i data-icon="timer" style="width:16px; height:16px;"></i> Pomodoro Integration
          </label>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:20px;">
              <div style="flex:1;">
                <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Sessions / day</span>
                <input type="number" class="input" id="mHabitPomoSessions" placeholder="0" value="0" style="width:100%; background: var(--surface-1);" min="0">
              </div>
              <div style="flex:1;">
                <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Length (min)</span>
                <input type="number" class="input" id="mHabitPomoLength" placeholder="25" value="25" style="width:100%; background: var(--surface-1);" min="5" step="5">
              </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button class="btn secondary" style="min-width: 100px;" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
            <button class="btn primary" style="min-width: 120px;" data-action="save-habit-modal">Create Habit</button>
        </div>
      </div>
    `;

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
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
  modal.classList.add('bottom-sheet');
  const box = modal.querySelector('.modal-box');
  const isWeekly = h.frequency === 'weekly';
  const categories = ['Health', 'Fitness', 'Learning', 'Productivity', 'Spiritual', 'Other'];
  const reminderTimeValue = parseReminderTimeToHHMM(h.reminder_time);
  const s = state.data.settings?.[0] || {};
  const routinesStr = s.habit_routines || 'Morning,Work,Evening';
  const routines = routinesStr.split(',').map(r => r.trim()).filter(Boolean);

  box.innerHTML = `
    <div class="modal-header-bar">
        <i data-icon="edit"></i>
        <h3>Edit Habit</h3>
    </div>

    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
      <!-- Identity Section -->
      <div>
        <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Habit Details</label>
        <div style="display:flex; gap:12px; align-items:center">
           <select class="input" id="mHabitEmoji" style="width:64px; font-size:20px; padding:0 8px; height: 48px; text-align: center; appearance: none;">
               <option value="✨" ${h.emoji === '✨' ? 'selected' : ''}>✨</option>
               <option value="💪" ${h.emoji === '💪' ? 'selected' : ''}>💪</option>
               <option value="📚" ${h.emoji === '📚' ? 'selected' : ''}>📚</option>
               <option value="🧘" ${h.emoji === '🧘' ? 'selected' : ''}>🧘</option>
               <option value="💧" ${h.emoji === '💧' ? 'selected' : ''}>💧</option>
               <option value="🍎" ${h.emoji === '🍎' ? 'selected' : ''}>🍎</option>
               <option value="🏃" ${h.emoji === '🏃' ? 'selected' : ''}>🏃</option>
               <option value="💤" ${h.emoji === '💤' ? 'selected' : ''}>💤</option>
           </select>
           <input class="input" id="mHabitName" value="${(h.habit_name || h.name || '').replace(/"/g, '"')}" placeholder="What habit do you want to build?" style="flex:1; height: 48px; font-size: 15px;">
        </div>
      </div>

      <!-- Schedule Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Frequency</label>
          <select class="input" id="mHabitFreq" style="width: 100%;" onchange="document.getElementById('dayPickerWrap').style.display = this.value === 'weekly' ? 'block' : 'none'">
              <option value="daily" ${h.frequency === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${h.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Reminder Time</label>
          <input type="time" class="input" id="mHabitTime" value="${reminderTimeValue}" style="width: 100%;" required>
        </div>
      </div>

      <div id="dayPickerWrap" style="display:${isWeekly ? 'block' : 'none'}; margin-top: -4px;">
        <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Which days?</label>
        ${getDayPickerHtml(h.days)}
      </div>

      <!-- Metadata Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Category</label>
          <select class="input" id="mHabitCat" style="width: 100%;">
              ${categories.map(c => `<option value="${c}" ${h.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Routine</label>
          <select class="input" id="mHabitRoutine" style="width: 100%;">
            <option value="">None</option>
            ${routines.map(r => `<option value="${r}" ${h.routine === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Duration</label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" class="input" id="mHabitDuration" value="${h.duration || 45}" style="flex:1; width: 40px;" min="5" step="5">
            <span style="font-size: 12px; color: var(--text-3);">m</span>
          </div>
        </div>
      </div>
      
      <!-- Pomodoro Section -->
      <div style="padding:16px; background:var(--primary-soft); border-radius:16px; border:1px solid var(--primary-light); opacity: 0.9;">
        <label style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
            <i data-icon="timer" style="width:16px; height:16px;"></i> Pomodoro Integration
        </label>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:20px;">
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Sessions / day</span>
              <input type="number" class="input" id="mHabitPomoSessions" value="${h.pomodoro_sessions || 0}" style="width:100%; background: var(--surface-1);" min="0">
            </div>
            <div style="flex:1;">
              <span style="font-size:12px; color:var(--text-2); display:block; margin-bottom: 6px; font-weight: 500;">Length (min)</span>
              <input type="number" class="input" id="mHabitPomoLength" value="${h.pomodoro_length || 25}" style="width:100%; background: var(--surface-1);" min="5" step="5">
            </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
          <button class="btn secondary" style="min-width: 100px;" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" style="min-width: 120px;" data-action="update-habit-modal" data-edit-id="${h.id}">Update Habit</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};
