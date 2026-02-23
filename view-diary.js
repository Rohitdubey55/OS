/* view-diary.js - Enhanced Diary UI with Bento Design */

// Diary view state
let currentDiaryView = 'home'; // 'home', 'list', 'weekly', 'monthly', 'yearly', 'tags', 'insights'
let currentSearchQuery = '';
let currentDateFilter = 'all';
let currentTagFilter = '';

let _diaryChartInstance = null;
let touchStartX = 0;
let touchEndX = 0;

// Greeting based on time of day
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Get motivational prompt
function getDailyPrompt() {
  const prompts = [
    "Today is a fresh start. How are you feeling?",
    "What's one thing you're grateful for today?",
    "Take a moment to reflect on your day.",
    "How did today go? What's on your mind?",
    "A new day, a new opportunity to reflect.",
    "What's the best thing that happened today?",
    "Write about what's weighing on your mind.",
    "Describe how you're feeling right now."
  ];
  return prompts[new Date().getDate() % prompts.length];
}

function renderDiary() {
  const entries = state.data.diary || [];
  
  let filteredEntries = filterEntries(entries);
  const sorted = [...filteredEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calculate Stats
  const validMoods = sorted.filter(e => e.mood_score).map(e => Number(e.mood_score));
  const avgMood = validMoods.length ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1) : '-';
  const streak = calculateStreak(entries);
  const totalEntries = entries.length;
  const totalWords = entries.reduce((acc, e) => acc + (e.text ? e.text.split(/\s+/).length : 0), 0);
  const achievements = getAchievements(entries);
  
  // Calculate this week's entries
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const thisWeekEntries = entries.filter(e => {
    const entryDate = new Date(e.date);
    return entryDate >= startOfWeek;
  });
  const weekDaysWritten = new Set(thisWeekEntries.map(e => e.date)).size;
  
  // Get mood insights
  const moodStats = getMoodStats(entries);

  document.getElementById('main').innerHTML = `
    <div class="diary-wrapper diary-new-ui">
      <!-- Hero Section -->
      <div class="diary-hero">
        <div class="hero-content">
          <h1 class="hero-greeting">${getGreeting()}, ${state.userName || 'Friend'} ${renderIcon('default', null, '')}</h1>
          <p class="hero-prompt">"${getDailyPrompt()}"</p>
        </div>
        <button class="quick-write-btn" onclick="openDiaryModal()">
          ${renderIcon('write', null, 'quick-write-icon')}
          <span class="quick-write-text">Start Writing</span>
        </button>
      </div>
      
      <!-- Stats Bento Grid -->
      <div class="diary-stats-grid">
        <div class="stat-card stat-card-fire ${streak > 0 ? 'active' : ''}">
          <div class="stat-card-glow"></div>
          ${renderIcon('streak', null, 'stat-icon')}
          <div class="stat-value">${streak}</div>
          <div class="stat-label">Day Streak</div>
          ${streak > 0 ? `<div class="stat-badge">Keep it up!</div>` : ''}
        </div>
        
        <div class="stat-card stat-card-mood">
          ${renderIcon('mood', null, 'stat-icon')}
          <div class="stat-value">${avgMood !== '-' ? avgMood : '-'}</div>
          <div class="stat-label">Avg Mood</div>
          ${validMoods.length > 0 ? `<div class="stat-trend ${moodStats.trend === 'up' ? 'up' : moodStats.trend === 'down' ? 'down' : ''}">${moodStats.trend === 'up' ? '↑' : moodStats.trend === 'down' ? '↓' : '→'}</div>` : ''}
        </div>
        
        <div class="stat-card stat-card-entries">
          ${renderIcon('entries', null, 'stat-icon')}
          <div class="stat-value">${totalEntries}</div>
          <div class="stat-label">Total Entries</div>
        </div>
        
        <div class="stat-card stat-card-badges ${achievements.length > 0 ? 'has-badges' : ''}">
          ${renderIcon('achievements', null, 'stat-icon')}
          <div class="stat-value">${achievements.length}</div>
          <div class="stat-label">Achievements</div>
        </div>
      </div>
      
      <!-- Quick Actions & Overview Row -->
      <div class="diary-overview-row">
        <!-- This Week Card -->
        <div class="overview-card week-overview">
          <div class="overview-header">
            ${renderIcon('calendar', null, 'overview-icon')}
            <h3>This Week</h3>
          </div>
          <div class="week-dots">
            ${getWeekDots(entries)}
          </div>
          <div class="week-stat">${weekDaysWritten}/7 days written</div>
          <div class="week-progress">
            <div class="week-progress-bar" style="width: ${(weekDaysWritten/7)*100}%"></div>
          </div>
        </div>
        
        <!-- Mood Insights Card -->
        <div class="overview-card mood-insights">
          <div class="overview-header">
            <span class="overview-icon">🧠</span>
            <h3>Mood Insights</h3>
          </div>
          <div class="mood-sparkline">
            <canvas id="moodSparkline"></canvas>
          </div>
          <div class="mood-insight-text">
            ${moodStats.peak ? `✨ Best: ${moodStats.peak.day} (${moodStats.peak.mood}/10)` : 'Start writing to see insights'}
          </div>
        </div>
      </div>
      
      <!-- Navigation Tabs -->
      <div class="diary-nav-tabs">
        <button class="nav-tab ${currentDiaryView === 'home' ? 'active' : ''}" onclick="switchDiaryView('home')">
          ${renderIcon('home', null, 'nav-icon')} Home
        </button>
        <button class="nav-tab ${currentDiaryView === 'list' ? 'active' : ''}" onclick="switchDiaryView('list')">
          ${renderIcon('list', null, 'nav-icon')} All Entries
        </button>
        <button class="nav-tab ${currentDiaryView === 'calendar' ? 'active' : ''}" onclick="switchDiaryView('calendar')">
          ${renderIcon('calendar', null, 'nav-icon')} Calendar
        </button>
        <button class="nav-tab ${currentDiaryView === 'yearly' ? 'active' : ''}" onclick="switchDiaryView('yearly')">
          ${renderIcon('yearly', null, 'nav-icon')} Yearly
        </button>
        <button class="nav-tab ${currentDiaryView === 'insights' ? 'active' : ''}" onclick="switchDiaryView('insights')">
          ${renderIcon('insights', null, '')} Insights
        </button>
        <button class="nav-tab ${currentDiaryView === 'tags' ? 'active' : ''}" onclick="switchDiaryView('tags')">
          ${renderIcon('tags', null, '')} Tags
        </button>
      </div>
      
      <!-- Content Area -->
      <div class="diary-content">
        ${currentDiaryView === 'home' ? renderHomeContent(sorted) : ''}
        ${currentDiaryView === 'list' ? renderListView(sorted) : ''}
        ${currentDiaryView === 'calendar' ? renderCalendarView(entries) : ''}
        ${currentDiaryView === 'yearly' ? renderYearlyView(entries) : ''}
        ${currentDiaryView === 'insights' ? renderInsightsView(entries) : ''}
        ${currentDiaryView === 'tags' ? renderTagsView() : ''}
      </div>
      
      <!-- Search & Filter Bar (Always Visible) -->
      <div class="diary-search-bar">
        <div class="search-wrapper">
          ${renderIcon('search', null, 'search-icon')}
          <input type="text" class="search-input" placeholder="Search your journal..." 
                 value="${currentSearchQuery}" oninput="handleDiarySearch(this.value)">
          ${currentSearchQuery ? `<button class="search-clear" onclick="handleDiarySearch('')">×</button>` : ''}
        </div>
        <select class="filter-select" onchange="handleDateFilter(this.value)">
          <option value="all" ${currentDateFilter === 'all' ? 'selected' : ''}>All Time</option>
          <option value="week" ${currentDateFilter === 'week' ? 'selected' : ''}>This Week</option>
          <option value="month" ${currentDateFilter === 'month' ? 'selected' : ''}>This Month</option>
          <option value="last7" ${currentDateFilter === 'last7' ? 'selected' : ''}>Last 7 Days</option>
        </select>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  
  // Render sparkline for any view that has it
  setTimeout(() => {
    const sparklineCanvas = document.getElementById('moodSparkline');
    if (sparklineCanvas) {
      renderMoodSparkline(entries);
    }
  }, 100);
}

// Generate week dots
function getWeekDots(entries) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const dateStr = day.toISOString().slice(0, 10);
    const entry = entries.find(e => e.date === dateStr);
    const isToday = dateStr === today.toISOString().slice(0, 10);
    
    dots.push(`
      <div class="week-dot ${entry ? 'has-entry' : ''} ${isToday ? 'today' : ''}" 
           title="${days[i]}${entry ? ` - Mood: ${entry.mood_score}/10` : ''}"
           onclick="openDiaryModal('${dateStr}')" style="cursor:pointer;">
        <span class="dot-label">${days[i].charAt(0)}</span>
        ${entry ? `<span class="dot-mood">${getMoodEmoji(entry.mood_score)}</span>` : ''}
      </div>
    `);
  }
  return dots.join('');
}

// Get mood statistics
function getMoodStats(entries) {
  const last30 = entries.slice(-30);
  const moods = last30.filter(e => e.mood_score).map(e => Number(e.mood_score));
  
  if (moods.length < 2) {
    return { 
      trend: 'stable', 
      peak: null,
      avgMood: moods.length > 0 ? moods[0].toFixed(1) : null
    };
  }
  
  const recent = moods.slice(-7);
  const older = moods.slice(-14, -7);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
  
  let trend = 'stable';
  if (recentAvg > olderAvg + 0.5) trend = 'up';
  else if (recentAvg < olderAvg - 0.5) trend = 'down';
  
  // Find peak day
  const last7Days = entries.slice(-7);
  const peakEntry = last7Days.reduce((max, e) => 
    (!max || Number(e.mood_score) > Number(max.mood_score)) ? e : max, null);
  
  // Calculate overall average
  const allMoods = entries.filter(e => e.mood_score).map(e => Number(e.mood_score));
  const avgMood = allMoods.length > 0 ? (allMoods.reduce((a, b) => a + b, 0) / allMoods.length).toFixed(1) : null;
  
  return {
    trend,
    peak: peakEntry ? {
      day: new Date(peakEntry.date).toLocaleDateString('default', { weekday: 'short' }),
      mood: peakEntry.mood_score
    } : null,
    avgMood
  };
}

// Render home content (recent entries)
function renderHomeContent(sorted) {
  const recentEntries = sorted.slice(0, 5);
  
  if (recentEntries.length === 0) {
    return `
      <div class="empty-home">
        ${renderIcon('no-diary', null, 'empty-illustration')}
        <h2>Start Your Journal</h2>
        <p>Your journey begins with a single entry. Take a moment to reflect on your day.</p>
        <button class="btn primary btn-large" onclick="openDiaryModal()">
          Write Your First Entry
        </button>
      </div>
    `;
  }
  
  return `
    <div class="recent-entries-section">
      <div class="section-header">
        ${renderIcon('entries', null, '')} Entries
        <button class="view-all-btn" onclick="switchDiaryView('list')">View All →</button>
      </div>
      <div class="entries-list">
        ${recentEntries.map(entry => renderEntryCard(entry)).join('')}
      </div>
    </div>
  `;
}

// Render entry card (new design)
function renderEntryCard(entry) {
  const dateObj = new Date(entry.date);
  const dateStr = getRelativeDate(entry.date);
  const score = Number(entry.mood_score || 5);
  const wordCount = entry.text ? entry.text.split(/\s+/).length : 0;
  
  let moodColor = '#F59E0B';
  if (score >= 8) moodColor = '#10B981';
  else if (score <= 4) moodColor = '#EF4444';
  
  const tags = entry.tags ? entry.tags.split(',').map(t => t.trim()) : [];
  
  return `
    <div class="entry-card" onclick="openEditDiary('${entry.id}')">
      <div class="entry-mood-indicator" style="background: ${moodColor}"></div>
      <div class="entry-content">
        <div class="entry-header">
          <span class="entry-date">${dateStr}</span>
          <span class="entry-mood">
            <span class="mood-emoji">${getMoodEmoji(score)}</span>
            <span class="mood-score">${score}/10</span>
          </span>
        </div>
        <p class="entry-preview">${(entry.text || '').substring(0, 150)}${(entry.text || '').length > 150 ? '...' : ''}</p>
        ${tags.length > 0 ? `
          <div class="entry-tags">
            ${tags.slice(0, 4).map(tag => `<span class="tag">#${tag}</span>`).join('')}
            ${tags.length > 4 ? `<span class="tag-more">+${tags.length - 4}</span>` : ''}
          </div>
        ` : ''}
        <div class="entry-meta">
          ${renderIcon('words', null, '')}
        </div>
      </div>
      <div class="entry-actions">
        <button class="action-btn" onclick="event.stopPropagation(); openEditDiary('${entry.id}')">
          ${renderIcon('edit', null, '')}
        </button>
        <button class="action-btn" onclick="event.stopPropagation(); deleteEntry('${entry.id}')">
          ${renderIcon('delete', null, '')}
        </button>
      </div>
    </div>
  `;
}

// Get relative date string
function getRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Delete entry
window.deleteEntry = async function(id) {
  if (confirm('Delete this entry?')) {
    await apiCall('delete', 'diary', null, id);
    await refreshData('diary');
    renderDiary();
  }
};

// Render list view
function renderListView(sorted) {
  if (sorted.length === 0) {
    return `
      <div class="empty-list">
        <p>No entries match your search/filter.</p>
      </div>
    `;
  }
  
  const moodStats = getMoodStats(sorted);
  const streak = calculateStreak(sorted);
  
  return `
    <div class="list-view-header">
      <div class="list-stats">
        ${renderIcon('entries', null, 'stat-badge')} entries
        <span class="stat-badge">🔥 ${streak} day streak</span>
        ${moodStats.avgMood ? `<span class="stat-badge">😊 ${moodStats.avgMood}/10 avg</span>` : ''}
        ${moodStats.peak ? `${renderIcon('default', null, 'stat-badge')} ${moodStats.peak.day} (${moodStats.peak.mood}/10)</span>` : ''}
      </div>
    </div>
    <div class="entries-list-full">
      ${sorted.map(entry => renderEntryCard(entry)).join('')}
    </div>
  `;
}

// Render calendar view
function renderCalendarView(entries) {
  const entryMap = {};
  entries.forEach(e => entryMap[e.date] = e);
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  
  const monthName = firstDay.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  
  // Get mood stats for current month
  const monthEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const moodStats = getMoodStats(monthEntries);
  const streak = calculateStreak(entries);
  
  let days = [];
  
  // Previous month days
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ date: prevMonthLast - i, isOtherMonth: true });
  }
  
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const entry = entryMap[dateStr];
    days.push({ 
      date: i, 
      isOtherMonth: false, 
      entry,
      isToday: dateStr === today.toISOString().slice(0, 10)
    });
  }
  
  // Next month days
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: i, isOtherMonth: true });
  }
  
  return `
    <div class="calendar-view">
      <div class="calendar-header">
        <h2>${monthName}</h2>
        <div class="calendar-stats">
          ${renderIcon('entries', null, 'stat-badge')} this month
          ${moodStats.avgMood ? `<span class="stat-badge">😊 ${moodStats.avgMood}/10</span>` : ''}
        </div>
      </div>
      <div class="calendar-weekdays">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="calendar-grid">
        ${days.map(d => {
          if (d.isOtherMonth) return `<div class="calendar-day other-month"></div>`;
          
          const moodLevel = d.entry ? Math.ceil(Number(d.entry.mood_score || 5) / 2) : 0;
          const moodColors = ['', '#FEE2E2', '#FEF3C7', '#FEF9C3', '#D1FAE5', '#A7F3D0'];
          
          return `
            <div class="calendar-day ${d.isToday ? 'today' : ''} ${d.entry ? 'has-entry' : ''}" 
                 style="${moodLevel > 0 ? `background: ${moodColors[moodLevel]}20` : ''}"
                 onclick="${d.entry ? `openEditDiary('${d.entry.id}')` : `openDiaryModal('${year}-${String(month + 1).padStart(2, '0')}-${String(d.date).padStart(2, '0')}')`}">
              <span class="day-number">${d.date}</span>
              ${d.entry ? `
                <span class="day-mood">${getMoodEmoji(d.entry.mood_score)}</span>
                <div class="day-indicator" style="background: ${moodColors[moodLevel]}"></div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Render yearly view
function renderYearlyView(entries) {
  const entryMap = {};
  entries.forEach(e => entryMap[e.date] = e);
  
  const today = new Date();
  const year = today.getFullYear();
  const months = [];
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    let days = [];
    
    // Empty cells for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, entry: null });
    }
    
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = entryMap[dateStr];
      const isToday = dateStr === today.toISOString().slice(0, 10);
      days.push({ day: d, entry, isToday });
    }
    
    // Count entries this month
    const monthEntries = days.filter(d => d.entry).length;
    
    months.push({
      name: monthNames[m],
      days,
      entryCount: monthEntries
    });
  }
  
  // Calculate yearly stats
  const totalEntries = entries.length;
  const streak = calculateStreak(entries);
  const moodStats = getMoodStats(entries);
  
  return `
    <div class="yearly-view">
      <div class="yearly-header">
        <h2>${year} Overview</h2>
        <div class="yearly-stats">
          📝 ${totalEntries} entries
          <span class="stat-badge">🔥 ${streak} day streak</span>
          ${moodStats.avgMood ? `<span class="stat-badge">😊 ${moodStats.avgMood}/10 avg</span>` : ''}
        </div>
      </div>
      <div class="yearly-grid">
        ${months.map(m => `
          <div class="month-card">
            <div class="month-header">
              <span class="month-name">${m.name}</span>
              <span class="month-count">${m.entryCount}</span>
            </div>
            <div class="month-days">
              ${m.days.map(d => {
                if (!d.day) return '<div class="day-cell empty"></div>';
                const moodScore = d.entry ? Number(d.entry.mood_score || 5) : 0;
                const moodLevel = Math.ceil(moodScore / 2);
                const moodColors = ['', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981'];
                const bgColor = d.entry ? moodColors[moodLevel] : 'transparent';
                return `
                  <div class="day-cell ${d.entry ? 'has-entry' : ''} ${d.isToday ? 'today' : ''}"
                       style="background-color: ${bgColor} !important;"
                       onclick="${d.entry ? `openEditDiary('${d.entry.id}')` : `openDiaryModal('${year}-${String(monthNames.indexOf(m.name) + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}')`}"
                       title="${d.day}${d.entry ? ` - Mood: ${d.entry.mood_score}/10` : ''}">
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render insights view
function renderInsightsView(entries) {
  const moodStats = getMoodStats(entries);
  const achievements = state.data.diary_achievements || [];
  const streak = calculateStreak(entries);
  
  // Calculate writing frequency
  const thisMonth = entries.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
  });
  
  const totalWords = entries.reduce((acc, e) => acc + (e.text ? e.text.split(/\s+/).length : 0), 0);
  
  return `
    <div class="insights-view">
      <div class="insights-header">
        <h2>Insights</h2>
        <button class="export-btn" onclick="window.exportDiary()">
          ${renderIcon('export', null, '')} Export
        </button>
      </div>
      <div class="insights-grid">
        <!-- Mood Chart -->
        <div class="insight-card insight-chart">
          ${renderIcon('chart', null, '')} Mood Over Time
          <canvas id="insightsChart"></canvas>
        </div>
        
        <!-- Writing Frequency -->
        <div class="insight-card">
          ${renderIcon('calendar', null, '')} Writing Frequency
          <div class="frequency-stat">
            <div class="frequency-value">${thisMonth.length}</div>
            <div class="frequency-label">entries this month</div>
          </div>
          <div class="frequency-stat">
            <div class="frequency-value">${totalWords.toLocaleString()}</div>
            <div class="frequency-label">total words written</div>
          </div>
        </div>
        
        <!-- Achievements -->
        <div class="insight-card achievements-card">
          ${renderIcon('achievements', null, '')} Achievements
          <div class="achievements-list">
            ${achievements.map(a => {
              let unlocked = false;
              const totalEntries = entries.length;
              const goodMoodCount = entries.filter(e => Number(e.mood_score) >= 8).length;
              
              if (a.type === 'streak' && streak >= Number(a.target_value)) unlocked = true;
              if (a.type === 'entries' && totalEntries >= Number(a.target_value)) unlocked = true;
              if (a.type === 'mood' && goodMoodCount >= Number(a.target_value)) unlocked = true;
              
              return `
                <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
                  <span class="achievement-icon">Achieved</div>
                  <div class="achievement-info">
                    <span class="achievement-name">${a.name}</span>
                    <span class="achievement-desc">${a.description}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render mood sparkline
function renderMoodSparkline(entries) {
  const canvas = document.getElementById('moodSparkline');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const last14 = entries.slice(-14);
  
  if (last14.length < 2) {
    // Show placeholder
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  
  const width = canvas.parentElement.offsetWidth;
  const height = 80;
  canvas.width = width;
  canvas.height = height;
  
  const moods = last14.map(e => Number(e.mood_score || 5));
  
  // Use actual min/max for better visualization
  const dataMin = Math.min(...moods);
  const dataMax = Math.max(...moods);
  // Add some padding to the range
  const min = Math.max(0, dataMin - 2);
  const max = Math.min(10, dataMax + 1);
  
  const padding = 15;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Draw gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.02)');
  
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  
  moods.forEach((mood, i) => {
    const x = padding + (i / Math.max(1, moods.length - 1)) * chartWidth;
    const y = height - padding - ((mood - min) / Math.max(1, max - min)) * chartHeight;
    ctx.lineTo(x, y);
  });
  
  ctx.lineTo(width - padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  moods.forEach((mood, i) => {
    const x = padding + (i / Math.max(1, moods.length - 1)) * chartWidth;
    const y = height - padding - ((mood - min) / Math.max(1, max - min)) * chartHeight;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Draw points with value labels
  moods.forEach((mood, i) => {
    const x = padding + (i / Math.max(1, moods.length - 1)) * chartWidth;
    const y = height - padding - ((mood - min) / Math.max(1, max - min)) * chartHeight;
    
    // Point
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#4F46E5';
    ctx.fill();
    
    // White center
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Value label above point
    if (moods.length <= 7) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mood.toFixed(0), x, y - 10);
    }
  });
  
  // Draw y-axis labels
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(max.toFixed(0), 2, padding + 4);
  ctx.fillText(min.toFixed(0), 2, height - padding);
  
  moods.forEach((mood, i) => {
    const x = padding + (i / Math.max(1, moods.length - 1)) * chartWidth;
    const y = height - padding - ((mood - min) / Math.max(1, max - min)) * chartHeight;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Draw points with value labels
  moods.forEach((mood, i) => {
    const x = padding + (i / Math.max(1, moods.length - 1)) * chartWidth;
    const y = height - padding - ((mood - min) / Math.max(1, max - min)) * chartHeight;
    
    // Point
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#4F46E5';
    ctx.fill();
    
    // White center
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Value label above point
    if (moods.length <= 7) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mood.toFixed(0), x, y - 10);
    }
  });
  
  // Draw y-axis labels
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(max.toFixed(0), 2, padding + 4);
  ctx.fillText(min.toFixed(0), 2, height - padding);
}

// Filter entries
function filterEntries(entries) {
  let filtered = entries;
  
  if (currentDateFilter !== 'all') {
    const today = new Date();
    const cutoff = new Date();
    
    if (currentDateFilter === 'week') {
      cutoff.setDate(today.getDate() - today.getDay());
    } else if (currentDateFilter === 'month') {
      cutoff.setDate(1);
    } else if (currentDateFilter === 'last7') {
      cutoff.setDate(today.getDate() - 7);
    }
    
    filtered = filtered.filter(e => new Date(e.date) >= cutoff);
  }
  
  if (currentSearchQuery) {
    const query = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(e => 
      (e.text && e.text.toLowerCase().includes(query)) ||
      (e.tags && e.tags.toLowerCase().includes(query))
    );
  }
  
  if (currentTagFilter) {
    filtered = filtered.filter(e => 
      e.tags && e.tags.toLowerCase().includes(currentTagFilter.toLowerCase())
    );
  }
  
  return filtered;
}

window.handleDiarySearch = function(query) {
  currentSearchQuery = query;
  renderDiary();
};

window.handleDateFilter = function(filter) {
  currentDateFilter = filter;
  renderDiary();
};

function calculateStreak(entries) {
  if (!entries.length) return 0;
  
  const dates = entries.map(e => e.date).filter(d => d).sort((a, b) => b.localeCompare(a));
  if (!dates.length) return 0;
  
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  
  let currentDate = dates[0] === today ? new Date() : new Date(Date.now() - 86400000);
  
  for (const dateStr of dates) {
    const entryDate = new Date(dateStr).toISOString().slice(0, 10);
    const checkDate = currentDate.toISOString().slice(0, 10);
    
    if (entryDate === checkDate) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (entryDate < checkDate) {
      break;
    }
  }
  
  return streak;
}

function getAchievements(entries) {
  const achievements = state.data.diary_achievements || [];
  const unlocked = [];
  
  const totalEntries = entries.length;
  const streak = calculateStreak(entries);
  const goodMoodCount = entries.filter(e => Number(e.mood_score) >= 8).length;
  
  achievements.forEach(a => {
    let isUnlocked = false;
    if (a.type === 'streak' && streak >= Number(a.target_value)) isUnlocked = true;
    if (a.type === 'entries' && totalEntries >= Number(a.target_value)) isUnlocked = true;
    if (a.type === 'mood' && goodMoodCount >= Number(a.target_value)) isUnlocked = true;
    if (isUnlocked) unlocked.push(a);
  });
  
  return unlocked;
}

window.switchDiaryView = function(view) {
  currentDiaryView = view;
  renderDiary();
};

function renderTagsView() {
  const tagsData = state.data.diary_tags || [];
  const entries = state.data.diary || [];
  
  const tagCounts = {};
  entries.forEach(e => {
    if (e.tags) {
      e.tags.split(',').forEach(tag => {
        const t = tag.trim().toLowerCase();
        if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });
  
  const allTags = [...new Set([...Object.keys(tagCounts), ...tagsData.map(t => t.name.toLowerCase())])];
  
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  
  const moodStats = getMoodStats(entries);
  const streak = calculateStreak(entries);
  
  return `
    <div class="tags-view">
      <div class="tags-header-row">
        ${renderIcon('tags', null, '')} Your Tags
        <div class="tags-stats">
          <span class="stat-badge">📝 ${entries.length} entries</span>
          <span class="stat-badge">🔥 ${streak} day streak</span>
          ${moodStats.avgMood ? `<span class="stat-badge">😊 ${moodStats.avgMood}/10 avg</span>` : ''}
        </div>
      </div>
      
      <div class="tags-grid">
        ${allTags.length === 0 ? `
          <div class="empty-tags">
            <p>No tags yet. Tags will appear when you use them.</p>
          </div>
        ` : allTags.map((tag, idx) => {
          const count = tagCounts[tag] || 0;
          const color = colors[idx % colors.length];
          return `
            <div class="tag-chip" style="--tag-color: ${color}" onclick="filterByTag('${tag}')">
              <span class="tag-name">#${tag}</span>
              <span class="tag-count">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Templates Section -->
      <div class="templates-section">
        ${renderIcon('template', null, '')} Templates
        <button class="btn" onclick="openTemplateModal()">+ New Template</button>
        ${renderTemplatesList()}
      </div>
    </div>
  `;
}

function renderTemplatesList() {
  const templates = state.data.diary_templates || [];
  if (!templates.length) return '<p class="text-muted">No templates yet</p>';
  
  return `
    <div class="templates-grid">
      ${templates.map(t => `
        <div class="template-card">
          <span class="template-category">${t.category || 'general'}</span>
          <h4>${t.title}</h4>
          <p>${(t.content || '').substring(0, 80)}...</p>
          <div class="template-actions">
            <button class="btn btn-sm" onclick="useTemplate(${t.id})">Use</button>
            <button class="btn btn-sm" onclick="editTemplate(${t.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${t.id})">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.useTemplate = function(id) {
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id === id);
  if (t) openDiaryModal(null, t.content);
};

window.editTemplate = function(id) {
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id === id);
  openTemplateModal(t);
};

window.deleteTemplate = async function(id) {
  if (confirm('Delete this template?')) {
    await apiCall('delete', 'diary_templates', null, id);
    await refreshData('diary_templates');
    renderDiary();
  }
};

window.openTemplateModal = function(template = null) {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  
  box.innerHTML = `
    <h3>${template ? 'Edit Template' : 'New Template'}</h3>
    <input class="input" id="mTemplateTitle" placeholder="Title" value="${template?.title || ''}">
    <select class="input" id="mTemplateCategory">
      <option value="reflection" ${template?.category === 'reflection' ? 'selected' : ''}>Reflection</option>
      <option value="goals" ${template?.category === 'goals' ? 'selected' : ''}>Goals</option>
      <option value="gratitude" ${template?.category === 'gratitude' ? 'selected' : ''}>Gratitude</option>
    </select>
    <textarea class="input" id="mTemplateContent" style="min-height:120px">${template?.content || ''}</textarea>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="saveTemplate(${template?.id || 'null'})">Save</button>
    </div>
  `;
  modal.classList.remove('hidden');
};

window.saveTemplate = async function(existingId) {
  const title = document.getElementById('mTemplateTitle').value;
  const category = document.getElementById('mTemplateCategory').value;
  const content = document.getElementById('mTemplateContent').value;
  
  if (!title || !content) return alert('Fill all fields');
  
  const payload = { title, category, content, is_default: false, sort_order: 1 };
  
  if (existingId && existingId !== 'null') {
    await apiCall('update', 'diary_templates', payload, existingId);
  } else {
    await apiCall('create', 'diary_templates', payload);
  }
  
  document.getElementById('universalModal').classList.add('hidden');
  await refreshData('diary_templates');
  renderDiary();
};

window.openTagModal = function() {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  
  box.innerHTML = `
    <h3>New Tag</h3>
    <input class="input" id="mTagName" placeholder="Tag name">
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="saveNewTag()">Save</button>
    </div>
  `;
  modal.classList.remove('hidden');
};

window.saveNewTag = async function() {
  const name = document.getElementById('mTagName').value.toLowerCase().trim();
  if (!name) return;
  
  await apiCall('create', 'diary_tags', { name, color: '#4F46E5', usage_count: 0 });
  document.getElementById('universalModal').classList.add('hidden');
  await refreshData('diary_tags');
  renderDiary();
};

window.filterByTag = function(tag) {
  currentTagFilter = tag;
  currentDiaryView = 'list';
  renderDiary();
};

// Modal functions
window.openDiaryModal = function(dateStr, templateContent = '') {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const defaultDate = dateStr || new Date().toISOString().slice(0, 10);
  
  // Get settings
  const settings = state.data.settings?.[0] || {};
  const defaultMood = settings.diary_default_mood || '5';
  const showTasks = settings.diary_show_tasks !== false;
  const showHabits = settings.diary_show_habits !== false;
  const showExpenses = settings.diary_show_expenses !== false;
  
  const templates = state.data.diary_templates || [];
  const contextData = getContextData(defaultDate);

  box.innerHTML = `
    <div class="diary-modal-new">
      <h2>✍️ ${dateStr ? 'Edit Entry' : 'New Entry'}</h2>
      
      <!-- Template Selector -->
      ${templates.length > 0 ? `
      <div class="template-selector-modal">
        <select class="input" id="templateSelect" onchange="loadTemplateInModal(this.value)">
          <option value="">-- Use a Template --</option>
          ${templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
        </select>
      </div>
      ` : ''}
      
      <!-- Context Quick View -->
      <div class="context-quick-view">
        ${showTasks && contextData.tasks?.length ? `<span class="context-item">✓ ${contextData.tasks.length} task(s) done</span>` : ''}
        ${showHabits && contextData.habits?.length ? `<span class="context-item">✓ ${contextData.habits.length} habit(s) logged</span>` : ''}
        ${showExpenses && contextData.expenses > 0 ? `<span class="context-item">${renderIcon('money', null, '')}(contextData.expenses || 0).toFixed(2)} spent</span>` : ''}
      </div>
      
      <!-- Mood Selector -->
      <div class="mood-selector">
        <label>How are you feeling?</label>
        <div class="mood-slider-container">
          <input type="range" min="1" max="10" value="${defaultMood}" class="mood-slider" id="mMoodScore"
            oninput="updateMoodDisplay(this.value)">
          <div class="mood-display">
            ${renderIcon('mood-okay', null, 'mood-emoji-large')}
            <span id="moodVal" class="mood-number">${defaultMood}</span>
          </div>
        </div>
        <div class="mood-labels">
          <span>Awful</span>
          <span>Amazing</span>
        </div>
      </div>
      
      <!-- Writing Area -->
      <div class="rich-text-toolbar">
        <button type="button" class="toolbar-btn" onclick="formatText('bold')"><b>B</b></button>
        <button type="button" class="toolbar-btn" onclick="formatText('italic')"><i>I</i></button>
        <button type="button" class="toolbar-btn" onclick="formatText('insertUnorderedList')">•</button>
        <button type="button" class="toolbar-btn" onclick="formatText('insertOrderedList')">1.</button>
      </div>
      <div class="rich-editor" id="mDiaryText" contenteditable="true" 
           placeholder="Start writing...">${templateContent}</div>
      
      <!-- Tags -->
      <input class="input" id="mDiaryTags" placeholder="#tags (comma separated)">
      
      <!-- Date -->
      <input type="date" class="input" id="mDiaryDate" value="${defaultDate}">
      
      <!-- Word Count -->
      <div class="word-count" id="diaryWordCount">0 words</div>
      
      <div class="modal-actions">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary btn-save" data-action="save-diary-modal">Save Entry</button>
      </div>
    </div>
  `;
  
  // Word count listener
  const editor = document.getElementById('mDiaryText');
  editor.addEventListener('input', () => {
    const text = editor.innerText || '';
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('diaryWordCount').textContent = `${count} words`;
  });

  modal.classList.remove('hidden');
};

// Load template in modal
window.loadTemplateInModal = function(templateId) {
  if (!templateId) return;
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id == templateId);
  if (t && t.content) {
    const editor = document.getElementById('mDiaryText');
    if (editor) editor.innerText = t.content;
  }
};

window.updateMoodDisplay = function(value) {
  document.getElementById('moodEmoji').textContent = getMoodEmoji(value);
  document.getElementById('moodVal').textContent = value;
};

window.formatText = function(cmd) {
  document.execCommand(cmd, false, null);
};

window.openEditDiary = function(id) {
  const e = (state.data.diary || []).find(x => String(x.id) === String(id));
  if (!e) return;
  
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const score = Number(e.mood_score || 5);
  
  box.innerHTML = `
    <div class="diary-modal-new">
      <h2>✍️ Edit Entry</h2>
      
      <div class="mood-selector">
        <label>How are you feeling?</label>
        <div class="mood-slider-container">
          <input type="range" min="1" max="10" value="${score}" class="mood-slider" id="mMoodScore"
            oninput="updateMoodDisplay(this.value)">
          <div class="mood-display">
            <span id="moodEmoji" class="mood-emoji-large">${getMoodEmoji(score)}</span>
            <span id="moodVal" class="mood-number">${score}</span>
          </div>
        </div>
      </div>
      
      <div class="rich-editor" id="mDiaryText" contenteditable="true">${(e.text || '').replace(/</g, '<')}</div>
      <input class="input" id="mDiaryTags" value="${(e.tags || '')}">
      <input type="date" class="input" id="mDiaryDate" value="${(e.date || '').slice(0, 10)}">
      <div class="word-count">${e.text ? e.text.split(/\s+/).length : 0} words</div>
      
      <div class="modal-actions">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary btn-save" data-action="update-diary-modal" data-edit-id="${e.id}">Update</button>
      </div>
    </div>
  `;
  
  const editor = document.getElementById('mDiaryText');
  editor.addEventListener('input', () => {
    const text = editor.innerText || '';
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.querySelector('.word-count').textContent = `${count} words`;
  });

  modal.classList.remove('hidden');
};

function getContextData(dateStr) {
  const context = {};
  const tasks = state.data.tasks || [];
  context.tasks = tasks.filter(t => t.due_date === dateStr && t.status === 'completed');
  
  const habits = state.data.habit_logs || [];
  context.habits = habits.filter(h => h.log_date === dateStr);
  
  const expenses = state.data.expenses || [];
  const dayExpenses = expenses.filter(e => e.date === dateStr);
  context.expenses = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  
  return context;
}

function getMoodEmoji(score) {
  if (score <= 2) return '😞';
  if (score <= 4) return '😕';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  if (score === 9) return '😄';
  return '🤩';
}

window.exportDiary = function() {
  const entries = state.data.diary || [];
  if (!entries.length) return alert('No entries');
  
  const data = {
    exported_at: new Date().toISOString(),
    total_entries: entries.length,
    entries: entries.map(e => ({
      date: e.date,
      mood_score: e.mood_score,
      tags: e.tags,
      text: e.text
    }))
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
