/* view-diary.js */

// Diary view state
let currentDiaryView = 'list'; // 'list', 'weekly', 'monthly', 'yearly'

// Chart instance registry — prevents memory leak on re-render
let _diaryChartInstance = null;

function renderDiary() {
  const entries = state.data.diary || [];

  // Sort descending (newest first)
  const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calculate Avg Mood
  const validMoods = sorted.filter(e => e.mood_score).map(e => Number(e.mood_score));
  const avgMood = validMoods.length ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1) : '-';

  document.getElementById('main').innerHTML = `
      <div class="diary-wrapper">
        <div class="header-row">
          <h2 class="page-title">Diary</h2>
          <button class="btn primary" onclick="openDiaryModal()">+ New Entry</button>
        </div>



  
        <!-- View Tabs -->
        <div class="diary-view-tabs">
          <button class="diary-tab ${currentDiaryView === 'list' ? 'active' : ''}" onclick="switchDiaryView('list')">
            <i data-lucide="list" style="width:16px; margin-right:6px"></i> List
          </button>
          <button class="diary-tab ${currentDiaryView === 'weekly' ? 'active' : ''}" onclick="switchDiaryView('weekly')">
            <i data-lucide="calendar" style="width:16px; margin-right:6px"></i> Weekly
          </button>
          <button class="diary-tab ${currentDiaryView === 'monthly' ? 'active' : ''}" onclick="switchDiaryView('monthly')">
            <i data-lucide="calendar-days" style="width:16px; margin-right:6px"></i> Monthly
          </button>
          <button class="diary-tab ${currentDiaryView === 'yearly' ? 'active' : ''}" onclick="switchDiaryView('yearly')">
            <i data-lucide="calendar-range" style="width:16px; margin-right:6px"></i> Yearly
          </button>
        </div>
  
        ${currentDiaryView === 'list' ? renderListView(sorted, avgMood) : ''}
        ${currentDiaryView === 'weekly' ? renderWeeklyView(entries) : ''}
        ${currentDiaryView === 'monthly' ? renderMonthlyView(entries) : ''}
        ${currentDiaryView === 'yearly' ? renderYearlyView(entries) : ''}
      </div>
    `;

  // Render Chart only for list view
  if (currentDiaryView === 'list') {
    setTimeout(() => renderMoodChart(sorted), 50);
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Switch view function  
window.switchDiaryView = function (view) {
  currentDiaryView = view;
  renderDiary();
};

function renderListView(sorted, avgMood) {
  return `
    <div class="diary-stats-row">
       <div class="mood-stat-card">
          <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:600">Average Mood</div>
          <div style="font-size:42px; font-weight:800; color:var(--primary); margin:10px 0">${avgMood}</div>
          <div style="font-size:12px; color:var(--text-muted)">Last ${sorted.length} entries</div>
       </div>
       <div class="mood-chart-card">
          <canvas id="moodChart"></canvas>
       </div>
     </div>

     <div id="diaryList">
       ${sorted.length === 0 ? '<div class="empty-state">No entries yet. Write about your day!</div>' : ''}
       ${sorted.map(entry => renderDiaryCard(entry)).join('')}
     </div>
  `;
}

// Placeholder functions for other views
let currentWeekOffset = 0;
let currentMonthOffset = 0;
let currentYear = new Date().getFullYear();

function renderWeeklyView(entries) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7));

  const weekDays = [];
  const entryMap = {};

  // Create entry map by date
  entries.forEach(e => {
    entryMap[e.date] = e;
  });

  // Generate 7 days
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const dateStr = day.toISOString().slice(0, 10);
    const entry = entryMap[dateStr];

    weekDays.push({
      date: day,
      dateStr,
      entry
    });
  }

  const weekStart = weekDays[0].date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const weekEnd = weekDays[6].date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

  return `
    <div class="weekly-calendar">
      <div class="week-header">
        <button class="week-nav-btn" onclick="navigateWeek(-1)">←</button>
        <h3>${weekStart} - ${weekEnd}</h3>
        <button class="week-nav-btn" onclick="navigateWeek(1)">→</button>
      </div>
      <div class="week-grid">
        ${weekDays.map(day => `
          <div class="week-day ${day.entry ? 'has-entry' : ''}" onclick="${day.entry ? `openEditDiary('${day.entry.id}')` : `openDiaryModal('${day.dateStr}')`}">
            <div class="week-day-header">${day.date.toLocaleDateString('default', { weekday: 'short' })}</div>
            <div class="week-day-date">${day.date.getDate()}</div>
            ${day.entry ? `
              <div class="week-day-mood"><i data-lucide="smile" style="width:14px; margin-right:4px; display:inline-block; vertical-align:middle"></i> ${day.entry.mood_score}/10</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; line-height: 1.4;">
                ${day.entry.text.substring(0, 60)}${day.entry.text.length > 60 ? '...' : ''}
              </div>
            ` : `<div style="font-size: 12px; color: var(--text-muted); margin-top: auto;">No entry</div>`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.navigateWeek = function (offset) {
  currentWeekOffset += offset;
  renderDiary();
};

function renderMonthlyView(entries) {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() + currentMonthOffset, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();

  const entryMap = {};
  entries.forEach(e => {
    entryMap[e.date] = e;
  });

  const days = [];

  // Previous month days
  const prevMonthLastDate = new Date(year, month, 0);
  const prevMonthDays = prevMonthLastDate.getDate();

  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dateObj = new Date(year, month - 1, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    days.push({
      date: d,
      dateStr: dateStr,
      isOtherMonth: true,
      entry: null // entries for other months not loaded in this view usually, or should look up
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({
      date: i,
      dateStr: dateStr,
      isOtherMonth: false,
      entry: entryMap[dateStr]
    });
  }

  // Next month days
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const dateObj = new Date(year, month + 1, i);
    const dateStr = dateObj.toISOString().slice(0, 10);
    days.push({
      date: i,
      dateStr: dateStr,
      isOtherMonth: true,
      entry: null
    });
  }

  const monthName = firstDay.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  return `
    <div class="monthly-calendar">
      <div class="month-header">
        <button class="month-nav-btn" onclick="navigateMonth(-1)">← Previous</button>
        <h3>${monthName}</h3>
        <button class="month-nav-btn" onclick="navigateMonth(1)">Next →</button>
      </div>
      <div class="month-weekdays">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `
          <div class="month-weekday">${d}</div>
        `).join('')}
      </div>
      <div class="month-grid">
        ${days.map(day => `
          <div class="month-day ${day.isOtherMonth ? 'other-month' : ''} ${day.entry ? 'has-entry' : ''}"
               onclick="${day.entry ? `openEditDiary('${day.entry.id}')` : `openDiaryModal('${day.dateStr}')`}">
            <div class="month-day-number">${day.date}</div>
            ${day.entry && !day.isOtherMonth ? `<div class="month-day-indicator"></div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.navigateMonth = function (offset) {
  currentMonthOffset += offset;
  renderDiary();
};

function renderYearlyView(entries) {
  const entryMap = {};
  const entryCountMap = {};

  entries.forEach(e => {
    entryMap[e.date] = e;
    const monthKey = e.date.slice(0, 7); // YYYY-MM
    entryCountMap[monthKey] = (entryCountMap[monthKey] || 0) + 1;
  });

  // Get max entries per month for color scaling
  const maxEntries = Math.max(...Object.values(entryCountMap), 1);

  const months = [];
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(currentYear, m, 1);
    const monthStr = monthDate.toLocaleDateString('default', { month: 'short' });
    const monthKey = `${currentYear}-${String(m + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, m, 1);
    const lastDay = new Date(currentYear, m + 1, 0);

    const weeks = [];
    let currentWeek = [];

    // Start from the first day of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(currentYear, m, d);
      const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = entryMap[dateStr];

      currentWeek.push({
        date: d,
        dateStr,
        entry,
        dayOfWeek: dateObj.getDay()
      });

      if (currentWeek.length === 7 || d === lastDay.getDate()) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }

    months.push({
      name: monthStr,
      weeks
    });
  }

  const totalEntries = entries.filter(e => e.date.startsWith(currentYear.toString())).length;

  return `
    <div class="yearly-dashboard">
      <div class="year-header">
        <button class="month-nav-btn" onclick="navigateYear(-1)">← ${currentYear - 1}</button>
        <h3>${currentYear} - ${totalEntries} Entries</h3>
        <button class="month-nav-btn" onclick="navigateYear(1)">${currentYear + 1} →</button>
      </div>
      
      <div class="year-grid">
        ${months.map(month => `
          <div class="year-month-card">
            <div class="heatmap-month-label">${month.name}</div>
            <div class="mini-month-grid">
              ${month.weeks.map(week => `
                ${week.map(day => {
    let level = 0;
    if (day.entry) {
      const mood = Number(day.entry.mood_score || 5);
      level = Math.ceil(mood / 2); // 1-10 -> 1-5
    }
    const isToday = day.dateStr === new Date().toISOString().slice(0, 10);
    return `<div class="mini-day ${level > 0 ? `level-${level}` : ''} ${isToday ? 'today-indicator' : ''}" 
                               title="${day.dateStr}${day.entry ? `: ${day.entry.mood_score}/10` : ''}"
                               onclick="${day.entry ? `openEditDiary('${day.entry.id}')` : `openDiaryModal('${day.dateStr}')`}"></div>`;
  }).join('')}
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="heatmap-legend">
        <span>Less</span>
        ${[1, 2, 3, 4, 5].map(l => `<div class="heatmap-day level-${l}"></div>`).join('')}
        <span>More</span>
      </div>
    </div>
  `;
}

window.navigateYear = function (offset) {
  currentYear += offset;
  renderDiary();
};

function renderDiaryCard(e) {
  const dateObj = new Date(e.date);
  const day = dateObj.getDate();
  const mon = dateObj.toLocaleString('default', { month: 'short' });

  // Mood Logic
  const score = Number(e.mood_score || 5);
  let moodClass = 'mood-mid';
  let moodLabel = 'Neutral';
  if (score >= 8) { moodClass = 'mood-high'; moodLabel = 'Great'; }
  if (score <= 4) { moodClass = 'mood-low'; moodLabel = 'Low'; }

  // Tags Logic
  const tags = e.tags ? e.tags.split(',').map(t => `<span class="tag-pill">#${t.trim()}</span>`).join('') : '';

  return `
      <div class="diary-card">
        <div class="diary-date-box">
          <span class="dd-day">${day}</span>
          <span class="dd-mon">${mon}</span>
        </div>
        <div class="diary-content">
          <div class="diary-header">
             <span class="mood-badge ${moodClass}">${moodLabel} (${score}/10)</span>
             <div>
               <button class="btn icon" onclick="openEditDiary('${e.id}')" title="Edit"><i data-lucide="pencil" style="width:14px"></i></button>
               <button class="btn icon" data-action="delete" data-sheet="diary" data-id="${e.id}"><i data-lucide="trash-2" style="width:14px"></i></button>
             </div>
          </div>
          <div style="font-size:15px; line-height:1.5; color:var(--text-main); white-space:pre-wrap;">${(e.text || '').replace(/</g, '&lt;')}</div>
          <div class="diary-tags">${tags}</div>
        </div>
      </div>
    `;
}

function renderMoodChart(entries) {
  const ctx = document.getElementById('moodChart');
  if (!ctx) return;

  // P1 Fix #9: Destroy existing instance to prevent memory leak
  if (_diaryChartInstance) {
    _diaryChartInstance.destroy();
    _diaryChartInstance = null;
  }

  // Take last 14 entries for chart, reverse to show chronological left-to-right
  const chartData = entries.slice(0, 14).reverse();

  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4F46E5';
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0';

  _diaryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map(e => e.date.slice(5)), // MM-DD
      datasets: [{
        label: 'Mood',
        data: chartData.map(e => e.mood_score),
        borderColor: primaryColor,
        backgroundColor: primaryColor + '22',
        tension: 0.4,
        fill: true,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 10, grid: { color: borderColor } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* --- MODAL INJECTOR --- */
window.openDiaryModal = function (dateStr) {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const defaultDate = dateStr || new Date().toISOString().slice(0, 10);

  box.innerHTML = `
      <h3>Write Journal</h3>
      
      <div style="margin-bottom:15px">
        <label style="font-size:12px; font-weight:600; color:var(--text-muted)">Mood</label>
        <div style="display:flex; align-items:center; gap:12px; margin-top:8px">
          <input type="range" min="1" max="10" value="5" class="mood-slider" id="mMoodScore"
            oninput="document.getElementById('moodEmoji').textContent=getMoodEmoji(+this.value); document.getElementById('moodVal').textContent=this.value">
          <span id="moodEmoji" style="font-size:28px">😐</span>
          <span id="moodVal" style="font-weight:bold; color:var(--primary); min-width:20px">5</span>
        </div>
      </div>
  
      <textarea class="input" id="mDiaryText" style="min-height:120px; resize:vertical" placeholder="How was your day?"></textarea>
      
      <input class="input" id="mDiaryTags" placeholder="Tags (e.g. work, family, idea)">
      <input type="date" class="input" id="mDiaryDate" value="${defaultDate}">
  
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" data-action="save-diary-modal">Save Entry</button>
      </div>
    `;

  modal.classList.remove('hidden');
}

window.openEditDiary = function (id) {
  const e = (state.data.diary || []).find(x => String(x.id) === String(id));
  if (!e) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const score = Number(e.mood_score || 5);
  box.innerHTML = `
    <h3>Edit Journal Entry</h3>
    <div style="margin-bottom:15px">
      <label style="font-size:12px; font-weight:600; color:var(--text-muted)">Mood</label>
      <div style="display:flex; align-items:center; gap:12px; margin-top:8px">
        <input type="range" min="1" max="10" value="${score}" class="mood-slider" id="mMoodScore"
          oninput="document.getElementById('moodEmoji').textContent=getMoodEmoji(+this.value); document.getElementById('moodVal').textContent=this.value">
        <span id="moodEmoji" style="font-size:28px">${getMoodEmoji(score)}</span>
        <span id="moodVal" style="font-weight:bold; color:var(--primary); min-width:20px">${score}</span>
      </div>
    </div>
    <textarea class="input" id="mDiaryText" style="min-height:120px; resize:vertical" placeholder="How was your day?">${(e.text || '').replace(/</g, '&lt;')}</textarea>
    <input class="input" id="mDiaryTags" placeholder="Tags" value="${(e.tags || '').replace(/"/g, '&quot;')}">
    <input type="date" class="input" id="mDiaryDate" value="${(e.date || '').slice(0, 10)}">
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-diary-modal" data-edit-id="${e.id}">Update Entry</button>
    </div>
  `;
  modal.classList.remove('hidden');
}

// P1 Fix #14: Emoji helper for mood slider
function getMoodEmoji(score) {
  if (score <= 2) return '😞';
  if (score <= 4) return '😕';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  if (score === 9) return '😄';
  return '🤩';
}
