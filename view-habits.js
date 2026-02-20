/* view-habits.js */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// --- STATE HELPERS ---
let _habitSort = 'default'; // 'default', 'time'
let _habitDayFilter = 'All';
let _habitShowTodayOnly = true; // Default to Today

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
    'Health': '❤️', 'Fitness': '💪', 'Learning': '📚',
    'Productivity': '🚀', 'Spiritual': '🧘', 'Other': '✨'
  };

  document.getElementById('main').innerHTML = `
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
              <i data-lucide="check-circle" style="width:14px; margin-right:4px"></i>All Done
            </button>
            <button class="btn primary small" onclick="openHabitModal()">+ New</button>
          </div>
        </div>



        <div class="habit-grid">
          ${habits.length === 0 ? '<div class="empty-state" style="grid-column:1/-1">No habits found.</div>' : ''}
                    ${habits.map(h => {
    const hLogs = logs.filter(l => String(l.habit_id) === String(h.id));
    const stats = calculateHabitStats(hLogs, today, h);
    const isDoneToday = hLogs.some(l => (l.date || '').startsWith(today));
    const scheduledToday = isHabitScheduledToday(h);
    const emoji = h.emoji || categoryEmojis[h.category] || '✨';
    const daysList = h.days ? h.days.split(',').map(s => s.trim()) : [];

    // Parse Time (Handle 1899 date from Sheets)
    let displayTime = h.frequency || 'Daily';
    if (h.reminder_time) {
      // If it's the specific Sheets base date (effectively null time), ignore it
      if (String(h.reminder_time).startsWith('1899')) {
        displayTime = h.frequency || 'Daily';
      }
      // If it includes 'T', parse as ISO
      else if (h.reminder_time.includes('T')) {
        const dt = new Date(h.reminder_time);
        const hours = String(dt.getHours()).padStart(2, '0');
        const mins = String(dt.getMinutes()).padStart(2, '0');
        displayTime = `@ ${hours}:${mins}`;
      }
      // Otherwise assume it's a simple time string like "10:00"
      else {
        displayTime = `@ ${h.reminder_time.slice(0, 5)}`;
      }
    }

    return `
              <div class="habit-card ${!scheduledToday ? 'habit-off-day' : ''}">
              
                <div class="habit-header">
                  <div>
                    <div class="habit-title"><span style="margin-right:6px; font-size:1.2em">${emoji}</span> ${h.habit_name}</div>
                    <div class="habit-cat">${h.category || 'General'} • ${displayTime}</div>
                  </div>
                  <div class="streak-badge">
                    <span><i data-lucide="flame" style="width:14px; fill:currentColor"></i></span> ${stats.streak}
                  </div>
                </div>

                ${h.frequency === 'weekly' && daysList.length > 0 ? `
                <div style="display:flex; gap:4px; margin:8px 0; flex-wrap:wrap;">
                  ${DAY_NAMES.map(d => `
                    <span style="font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600;
                      background:${daysList.includes(d) ? (d === todayDay ? 'var(--primary)' : 'var(--primary-soft)') : 'var(--surface-2)'}};
                      color:${daysList.includes(d) ? (d === todayDay ? 'white' : 'var(--primary)') : 'var(--text-muted)'};">
                      ${d}
                    </span>
                  `).join('')}
                </div>
                ` : ''}
          
                <div class="heatmap-container">
                  <div class="stat-mini" style="margin-bottom:4px">Last 14 Days History</div>
                  <div class="heatmap-row" style="display:flex; gap:6px;">
                    ${stats.heatmapHtml}
                  </div>
                </div>
          
                <div class="habit-stats">
                  <div>
                    <div class="stat-value-lg">${stats.total}</div>
                    <div class="stat-mini">Total Days</div>
                  </div>
                  <div style="text-align:right">
                    <div class="stat-value-lg">${stats.completionRate}%</div>
                    <div class="stat-mini">Success Rate</div>
                  </div>
                </div>
          
                <div class="habit-footer">
                  <div>
                    <button style="border:none;background:none;font-size:16px;cursor:pointer" onclick="openEditHabit('${h.id}')" title="Edit"><i data-lucide="pencil" style="width:16px"></i></button>
                    <!-- FIXED: Use data-action for delete -->
                    <button style="border:none;background:none;font-size:16px;cursor:pointer" data-action="delete" data-sheet="habits" data-id="${h.id}"><i data-lucide="trash-2" style="width:16px"></i></button>
                  </div>
                  
                  ${scheduledToday ? `
                  <!-- FIXED: Use data-action for toggle -->
                  <!-- OPTIMISTIC TOGGLE -->
                  <button class="check-btn ${isDoneToday ? 'done' : ''}" 
                          onclick="toggleHabitOptimistic('${h.id}')">
                    ${isDoneToday ? '<i data-lucide="check" style="width:16px; margin-right:4px"></i> Completed' : '<i data-lucide="circle" style="width:16px; margin-right:4px"></i> Mark Done'}
                  </button>
                  ` : `
                  <span style="font-size:12px; color:var(--text-muted); font-style:italic;">Not scheduled today</span>
                  `}
                </div>
          
              </div>
            `;
  }).join('')}
        </div>
      </div>
    `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

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
    showToast('✅ All habits already completed!');
    return;
  }

  // Optimistic update
  pending.forEach(h => {
    state.data.habit_logs.push({ id: 'temp-' + Date.now() + h.id, habit_id: h.id, date: today, completed: true });
  });
  renderHabits();
  showToast(`🔥 Marked ${pending.length} habit${pending.length > 1 ? 's' : ''} as done!`);

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

  // Heatmap (Last 14 days)
  let heatmapHtml = '';
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const isFilled = unique.includes(iso);
    const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

    // For weekly habits, check if this day was scheduled
    let isScheduled = true;
    if (habit && habit.frequency === 'weekly' && habit.days) {
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
      isScheduled = habit.days.split(',').map(s => s.trim()).includes(dayName);
    }

    const cellClass = isFilled ? 'filled' : (!isScheduled ? 'skipped' : '');
    heatmapHtml += `<div class="heatmap-cell ${cellClass}" data-date="${label}" title="${iso}"></div>`;
  }

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

  return { streak, heatmapHtml, total: unique.length, completionRate };
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
  if (s.startsWith('1899') || s === '') return '';
  if (s.includes('T')) {
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '';
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }
  // Already HH:mm or HH:mm:ss
  return s.slice(0, 5);
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
         <input class="input" id="mHabitName" value="${(h.habit_name || '').replace(/"/g, '&quot;')}" placeholder="Habit Name" style="flex:1">
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
