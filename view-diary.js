/* view-diary.js - Enhanced Diary UI with Bento Design */

// Diary view state
let currentDiaryView = 'list'; // 'list', 'weekly', 'monthly', 'yearly', 'tags', 'insights'
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

  const DIARY_CSS = `<style>
/* ═══ DIARY SHELL ═══ */
.dr-shell { display:flex; flex-direction:column; height:calc(100vh - env(safe-area-inset-top,44px) - 80px); overflow:hidden; background:var(--surface-base,#F7F8FA); }

/* ═══ HEADER ═══ */
.dr-header { display:flex; align-items:center; justify-content:space-between; padding:18px 18px 14px; flex-shrink:0; }
.dr-greeting { font-size:21px; font-weight:800; color:var(--text-1); letter-spacing:-.5px; line-height:1; margin:0; }
.dr-header-date { font-size:12.5px; color:var(--text-3); margin:3px 0 0; font-weight:500; }
.dr-write-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 15px; background:var(--primary); color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; flex-shrink:0; }
.dr-write-btn:active { opacity:.85; transform:scale(.97); }

/* ═══ STATS STRIP ═══ */
.dr-stats-strip { display:flex; align-items:center; padding:0 18px 14px; flex-shrink:0; }
.dr-stat-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:1px; }
.dr-stat-n { font-size:19px; font-weight:800; color:var(--text-1); letter-spacing:-.5px; line-height:1; }
.dr-stat-l { font-size:9.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.3px; margin-top:2px; }
.dr-stat-div { width:1px; height:26px; background:var(--border-color); flex-shrink:0; }

/* ═══ OVERVIEW CARDS ═══ */
.dr-overview-row { display:flex; gap:10px; padding:0 16px 12px; flex-shrink:0; }
.dr-overview-card { flex:1; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:12px 13px; min-width:0; }
.dr-card-label { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--text-3); margin-bottom:10px; display:flex; align-items:center; gap:5px; }
.dr-week-dots { display:flex; justify-content:space-between; margin-bottom:8px; }
.dr-week-dot { display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; }
.dr-week-dot-circle { width:20px; height:20px; border-radius:50%; background:var(--surface-2); border:1.5px solid var(--border-color); transition:all .15s; }
.dr-week-dot.has-entry .dr-week-dot-circle { background:var(--primary); border-color:var(--primary); }
.dr-week-dot.today:not(.has-entry) .dr-week-dot-circle { border-color:var(--primary); border-width:2px; background:rgba(79,70,229,.1); }
.dr-week-dot.today.has-entry .dr-week-dot-circle { box-shadow:0 0 0 2.5px rgba(79,70,229,.2); }
.dr-week-dot-day { font-size:8.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; }
.dr-week-progress { height:3px; background:var(--surface-2); border-radius:99px; margin-top:2px; overflow:hidden; }
.dr-week-progress-fill { height:100%; background:var(--primary); border-radius:99px; transition:width .5s ease; }
.dr-week-stat { font-size:10.5px; color:var(--text-3); font-weight:500; margin-top:5px; }
/* ═══ WEEK CARD (full-width single card) ═══ */
.dr-week-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:14px 16px 12px; margin:0 16px 12px; flex-shrink:0; }
.dr-week-card-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }
.dr-week-card-label { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--text-3); margin-bottom:4px; }
.dr-week-written { font-size:15px; font-weight:800; color:var(--text-1); line-height:1; }
.dr-week-written span { font-size:12px; font-weight:500; color:var(--text-3); }
.dr-week-streak-badge { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#F97316; background:rgba(249,115,22,.08); border:1px solid rgba(249,115,22,.15); padding:5px 12px; border-radius:99px; }

/* ═══ NAV TABS ═══ */
.dr-tabs { display:flex; padding:0 16px; flex-shrink:0; border-bottom:1.5px solid var(--border-color); overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.dr-tabs::-webkit-scrollbar { display:none; }
.dr-tab { flex-shrink:0; padding:10px 14px; font-size:13px; font-weight:600; color:var(--text-3); background:transparent; border:none; border-bottom:2.5px solid transparent; cursor:pointer; transition:color .15s, border-color .15s; white-space:nowrap; margin-bottom:-1.5px; }
.dr-tab.active { color:var(--primary); border-bottom-color:var(--primary); }
.dr-tab:active { opacity:.7; }

/* ═══ SCROLLABLE BODY ═══ */
.dr-body { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-top:2px; }

/* ═══ SEARCH BAR ═══ */
.dr-search-bar { padding:10px 16px; padding-bottom:calc(10px + env(safe-area-inset-bottom,0px)); flex-shrink:0; display:flex; gap:8px; background:var(--surface-base,#F7F8FA); border-top:1px solid var(--border-color); }
.dr-search-wrap { flex:1; display:flex; align-items:center; gap:8px; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:0 12px; transition:border-color .15s; }
.dr-search-wrap:focus-within { border-color:var(--primary); }
.dr-search-input { flex:1; border:none; background:transparent; outline:none; font-size:13.5px; color:var(--text-1); padding:9px 0; }
.dr-search-input::placeholder { color:var(--text-3); }
.dr-search-clear { border:none; background:none; cursor:pointer; color:var(--text-3); font-size:16px; padding:4px; }
.dr-filter-select { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:0 10px; font-size:12px; color:var(--text-2); outline:none; cursor:pointer; font-weight:600; height:38px; }

/* ═══ ENTRIES ═══ */
.dr-entries { padding:12px 16px 16px; }
.dr-section-header { display:flex; align-items:center; justify-content:space-between; padding:0 2px 10px; }
.dr-section-title { font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.5px; }
.dr-section-meta { font-size:11px; color:var(--text-3); font-weight:500; }

/* ═══ ENTRY CARD ═══ */
.dr-entry-card { background:var(--surface-1); border:1px solid var(--border-color); border-left-width:3px; border-radius:12px; margin-bottom:8px; overflow:hidden; cursor:pointer; transition:box-shadow .15s, transform .15s; animation:drCardIn .2s ease both; }
@keyframes drCardIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
.dr-entry-card:active { transform:scale(.99); box-shadow:0 3px 12px rgba(0,0,0,.07); }
.dr-entry-main { padding:13px 14px 9px; }
.dr-entry-date { font-size:10.5px; font-weight:700; color:var(--text-3); margin-bottom:5px; text-transform:uppercase; letter-spacing:.3px; }
.dr-entry-preview { font-size:13.5px; color:var(--text-1); line-height:1.5; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.dr-entry-tags-row { display:flex; flex-wrap:wrap; gap:4px; padding:0 14px 9px; }
.dr-entry-tag { font-size:10.5px; font-weight:600; padding:2px 7px; border-radius:99px; background:rgba(79,70,229,.07); color:var(--primary); }
.dr-entry-foot { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; border-top:1px solid var(--border-color); }
.dr-entry-foot-left { display:flex; align-items:center; gap:8px; }
.dr-mood-pill { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:99px; }
.dr-entry-wc { font-size:11px; color:var(--text-3); font-weight:500; }
.dr-entry-actions { display:flex; gap:2px; }
.dr-entry-btn { width:28px; height:28px; border-radius:7px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-3); transition:all .12s; }
.dr-entry-btn:active { background:var(--surface-2); color:var(--text-1); }
.dr-entry-btn.danger:active { background:rgba(220,38,38,.07); color:#DC2626; }

/* ═══ EMPTY STATE ═══ */
.dr-empty { display:flex; flex-direction:column; align-items:center; padding:56px 24px; text-align:center; }
.dr-empty-icon { width:48px; height:48px; border-radius:14px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
.dr-empty-title { font-size:17px; font-weight:700; color:var(--text-1); margin-bottom:6px; }
.dr-empty-sub { font-size:13px; color:var(--text-3); line-height:1.55; margin-bottom:20px; max-width:260px; }
.dr-empty-btn { padding:10px 22px; background:var(--primary); color:#fff; border:none; border-radius:10px; font-size:13.5px; font-weight:700; cursor:pointer; }

/* ═══ CALENDAR VIEW ═══ */
.dr-calendar { padding:14px 16px 16px; }
.dr-cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.dr-cal-title { font-size:16px; font-weight:700; color:var(--text-1); }
.dr-cal-stat { font-size:11.5px; font-weight:600; color:var(--text-3); }
.dr-cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px; }
.dr-cal-weekday { text-align:center; font-size:10px; font-weight:700; color:var(--text-3); text-transform:uppercase; padding:4px 0; }
.dr-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
.dr-cal-day { aspect-ratio:1; border-radius:9px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; border:1px solid transparent; transition:all .12s; background:var(--surface-2); position:relative; gap:2px; }
.dr-cal-day.other-month { opacity:.15; pointer-events:none; }
.dr-cal-day.today { border-color:var(--primary); }
.dr-cal-day.has-entry { background:rgba(79,70,229,.08); border-color:rgba(79,70,229,.2); }
.dr-cal-day.today.has-entry { border-color:var(--primary); border-width:2px; }
.dr-cal-day:active { transform:scale(.9); }
.dr-cal-day-num { font-size:11px; font-weight:600; color:var(--text-2); line-height:1; }
.dr-cal-day.today .dr-cal-day-num { color:var(--primary); font-weight:800; }
.dr-cal-day-dot { width:4px; height:4px; border-radius:50%; background:var(--primary); }

/* ═══ YEARLY VIEW ═══ */
.dr-yearly { padding:14px 16px 16px; }
.dr-yearly-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.dr-yearly-title { font-size:16px; font-weight:700; color:var(--text-1); }
.dr-months-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.dr-month-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; padding:10px; }
.dr-month-name { font-size:10px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.4px; margin-bottom:7px; display:flex; align-items:center; justify-content:space-between; }
.dr-month-count { font-size:9px; font-weight:700; padding:1px 5px; border-radius:99px; background:rgba(79,70,229,.1); color:var(--primary); }
.dr-month-days { display:grid; grid-template-columns:repeat(7,1fr); gap:1.5px; }
.dr-day-cell { aspect-ratio:1; border-radius:2px; background:var(--surface-2); cursor:pointer; transition:all .12s; }
.dr-day-cell.has-entry { background:var(--primary); opacity:.65; }
.dr-day-cell.today { outline:1.5px solid var(--primary); outline-offset:0; opacity:1; }
.dr-day-cell:active { transform:scale(.8); }

/* ═══ INSIGHTS VIEW ═══ */
.dr-insights { padding:14px 16px 16px; }
.dr-insights-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.dr-insights-title { font-size:16px; font-weight:700; color:var(--text-1); }
.dr-export-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 12px; border-radius:9px; border:1.5px solid var(--border-color); background:transparent; font-size:12px; font-weight:600; color:var(--text-2); cursor:pointer; }
.dr-insight-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:16px; margin-bottom:10px; }
.dr-insight-card-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-3); margin-bottom:12px; }
.dr-stat-row { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-color); }
.dr-stat-row:last-child { border-bottom:none; }
.dr-stat-row-val { font-size:20px; font-weight:800; color:var(--text-1); min-width:52px; letter-spacing:-.5px; }
.dr-stat-row-lbl { font-size:13px; color:var(--text-3); font-weight:500; }
.dr-achievement-item { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color); }
.dr-achievement-item:last-child { border-bottom:none; }
.dr-achievement-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.dr-achievement-item.unlocked .dr-achievement-icon { background:rgba(245,158,11,.1); }
.dr-achievement-item.locked .dr-achievement-icon { background:var(--surface-2); filter:grayscale(1); opacity:.5; }
.dr-achievement-name { font-size:13px; font-weight:700; color:var(--text-1); }
.dr-achievement-desc { font-size:12px; color:var(--text-3); margin-top:1px; }

/* ═══ TAGS VIEW ═══ */
.dr-tags { padding:14px 16px 16px; }
.dr-tags-grid { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:20px; }
.dr-tag-chip { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:99px; font-size:12.5px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .15s; }
.dr-tag-chip:active { transform:scale(.95); }
.dr-tag-count { font-size:11px; opacity:.7; }
.dr-section-sep { font-size:10.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.6px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
.dr-section-sep::after { content:''; flex:1; height:1px; background:var(--border-color); }
.dr-templates-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:16px; }
.dr-template-card { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:12px; padding:12px; cursor:pointer; transition:all .15s; }
.dr-template-card:active { border-color:var(--primary); }
.dr-template-cat { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--primary); margin-bottom:4px; }
.dr-template-title { font-size:13px; font-weight:700; color:var(--text-1); margin-bottom:4px; }
.dr-template-preview { font-size:11px; color:var(--text-3); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.dr-template-actions { display:flex; gap:6px; margin-top:10px; padding-top:8px; border-top:1px solid var(--border-color); }
.dr-template-btn { flex:1; padding:5px 0; border-radius:7px; border:1px solid var(--border-color); background:var(--surface-2); font-size:11px; font-weight:600; color:var(--text-2); cursor:pointer; text-align:center; }
.dr-template-btn.primary { border-color:rgba(79,70,229,.25); background:rgba(79,70,229,.07); color:var(--primary); }
.dr-template-btn.danger { border-color:rgba(220,38,38,.15); background:rgba(220,38,38,.04); color:#DC2626; }

/* ═══ MODAL ═══ */
.dr-modal-title { font-size:18px; font-weight:800; color:var(--text-1); letter-spacing:-.3px; margin-bottom:16px; }
.dr-mood-section { margin-bottom:14px; }
.dr-mood-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-3); margin-bottom:8px; display:block; }
.dr-mood-slider-row { display:flex; align-items:center; gap:12px; }
.dr-mood-display { display:flex; flex-direction:column; align-items:center; gap:1px; flex-shrink:0; min-width:40px; }
.dr-mood-emoji { font-size:26px; line-height:1; }
.dr-mood-num { font-size:12px; font-weight:800; color:var(--primary); }
.dr-mood-slider { flex:1; -webkit-appearance:none; height:5px; border-radius:99px; background:var(--surface-3); outline:none; }
.dr-mood-slider::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:var(--primary); cursor:pointer; box-shadow:0 2px 6px rgba(79,70,229,.3); }
.dr-mood-labels { display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:var(--text-3); font-weight:600; }
.dr-toolbar { display:flex; align-items:center; gap:3px; padding:7px 10px; background:var(--surface-2); border-radius:9px 9px 0 0; border:1.5px solid var(--border-color); border-bottom:none; }
.dr-toolbar-btn { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; border:none; background:transparent; color:var(--text-2); font-size:13px; font-weight:700; cursor:pointer; transition:all .12s; }
.dr-toolbar-btn:active { background:var(--surface-3); }
.dr-toolbar-ai { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; border:1px solid rgba(79,70,229,.2); background:rgba(79,70,229,.06); font-size:11.5px; font-weight:700; color:var(--primary); cursor:pointer; margin-left:auto; white-space:nowrap; }
.dr-editor { min-height:140px; max-height:220px; overflow-y:auto; background:var(--surface-2); border:1.5px solid var(--border-color); border-top:none; border-radius:0 0 9px 9px; padding:11px 13px; font-size:14px; color:var(--text-1); line-height:1.65; outline:none; }
.dr-editor:focus { border-color:var(--primary); }
.dr-editor[placeholder]:empty::before { content:attr(placeholder); color:var(--text-3); pointer-events:none; }
.dr-field-row { display:flex; gap:8px; margin-top:10px; }
.dr-field { flex:1; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:9px; padding:9px 12px; font-size:13px; color:var(--text-1); outline:none; transition:border-color .15s; }
.dr-field:focus { border-color:var(--primary); }
.dr-word-count { font-size:11px; color:var(--text-3); font-weight:500; text-align:right; margin-top:5px; }
.dr-context-bar { display:flex; flex-wrap:wrap; gap:5px; padding:8px 0; margin-bottom:4px; }
.dr-context-chip { display:inline-flex; align-items:center; gap:4px; padding:4px 9px; border-radius:99px; font-size:11.5px; font-weight:600; background:rgba(5,150,105,.07); color:var(--success,#059669); border:1px solid rgba(5,150,105,.15); }
.dr-template-select { width:100%; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:9px; padding:9px 12px; font-size:13px; color:var(--text-1); outline:none; cursor:pointer; margin-bottom:12px; }
.dr-modal-actions { display:flex; gap:10px; padding-top:16px; border-top:1px solid var(--border-color); margin-top:8px; }
.dr-modal-save { flex:1; padding:11px; border-radius:10px; border:none; background:var(--primary); color:#fff; font-size:14px; font-weight:700; cursor:pointer; transition:all .15s; }
.dr-modal-save:active { opacity:.85; transform:scale(.99); }
.dr-modal-cancel { padding:11px 16px; border-radius:10px; border:1.5px solid var(--border-color); background:transparent; color:var(--text-2); font-size:13px; font-weight:600; cursor:pointer; }

/* ═══ REDESIGNED WRITE MODAL ═══ */
.dr-modal-bar { display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; border-bottom:1px solid var(--border-color); margin-bottom:14px; }
.dr-modal-dismiss { font-size:13.5px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; padding:6px 0; }
.dr-modal-save-top { padding:8px 18px; background:var(--primary); color:#fff; border:none; border-radius:9px; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .15s; }
.dr-modal-save-top:active { opacity:.85; transform:scale(.98); }
.dr-modal-date-chip { font-size:12.5px; font-weight:700; color:var(--text-2); background:var(--surface-2); padding:5px 12px; border-radius:99px; border:1px solid var(--border-color); cursor:pointer; }
.dr-mood-strip { display:flex; align-items:center; gap:10px; padding:10px 13px; background:var(--surface-2); border-radius:11px; margin-bottom:12px; border:1px solid var(--border-color); }
.dr-mood-big-emoji { font-size:26px; line-height:1; flex-shrink:0; }
.dr-mood-big-num { font-size:16px; font-weight:800; color:var(--primary); min-width:24px; text-align:right; flex-shrink:0; }
.dr-mood-slider-col { flex:1; display:flex; flex-direction:column; gap:4px; }
.dr-mood-ends { display:flex; justify-content:space-between; font-size:9.5px; color:var(--text-3); font-weight:600; margin-top:2px; }
.dr-write-zone { border-radius:12px; overflow:hidden; border:1.5px solid var(--border-color); margin-bottom:10px; transition:border-color .15s; }
.dr-write-zone:focus-within { border-color:var(--primary); }
.dr-zone-toolbar { display:flex; align-items:center; gap:1px; padding:6px 9px; border-bottom:1px solid var(--border-color); background:var(--surface-2); }
.dr-zone-toolbar .dr-toolbar-btn { width:30px; height:26px; font-size:13px; }
.dr-zone-editor { min-height:160px; max-height:240px; overflow-y:auto; background:var(--surface-1); padding:13px 14px; font-size:14.5px; color:var(--text-1); line-height:1.7; outline:none; }
.dr-zone-editor[placeholder]:empty::before { content:attr(placeholder); color:var(--text-3); pointer-events:none; }
.dr-zone-footer { display:flex; align-items:center; gap:8px; padding:8px 13px; border-top:1px solid var(--border-color); background:var(--surface-2); }
.dr-zone-tags { flex:1; background:transparent; border:none; outline:none; font-size:12.5px; color:var(--text-2); min-width:0; }
.dr-zone-tags::placeholder { color:var(--text-3); }
.dr-zone-wc { font-size:11px; color:var(--text-3); font-weight:500; white-space:nowrap; flex-shrink:0; }
.dr-context-chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; }
</style>`;

  document.getElementById('main').innerHTML = `
    ${DIARY_CSS}
    <div class="dr-shell">

      <!-- Header -->
      <div class="dr-header">
        <div>
          <h1 class="dr-greeting">${getGreeting()}, ${state.userName || 'Friend'}</h1>
          <p class="dr-header-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button class="dr-write-btn" onclick="openDiaryModal()">
          <i data-lucide="pen" style="width:14px;height:14px"></i>
          New Entry
        </button>
      </div>

      <!-- Stats Strip -->
      <div class="dr-stats-strip">
        <div class="dr-stat-item">
          <span class="dr-stat-n">${streak}</span>
          <span class="dr-stat-l">Streak</span>
        </div>
        <div class="dr-stat-div"></div>
        <div class="dr-stat-item">
          <span class="dr-stat-n">${avgMood !== '-' ? avgMood : '—'}</span>
          <span class="dr-stat-l">Avg Mood</span>
        </div>
        <div class="dr-stat-div"></div>
        <div class="dr-stat-item">
          <span class="dr-stat-n">${totalEntries}</span>
          <span class="dr-stat-l">Entries</span>
        </div>
        <div class="dr-stat-div"></div>
        <div class="dr-stat-item">
          <span class="dr-stat-n">${achievements.length}</span>
          <span class="dr-stat-l">Badges</span>
        </div>
      </div>

      <!-- Overview Row: This Week -->
      <div class="dr-overview-row">
        <div class="dr-overview-card" style="flex:1">
          <div class="dr-card-label">
            <i data-lucide="calendar-days" style="width:11px;height:11px"></i>
            This Week
          </div>
          <div class="dr-week-dots">
            ${getWeekDots(entries)}
          </div>
          <div class="dr-week-progress">
            <div class="dr-week-progress-fill" style="width:${(weekDaysWritten / 7) * 100}%"></div>
          </div>
          <div class="dr-week-stat">${weekDaysWritten}/7 days written</div>
        </div>
      </div>

      <!-- Nav Tabs -->
      <div class="dr-tabs">
        <button class="dr-tab ${currentDiaryView === 'list' ? 'active' : ''}" onclick="switchDiaryView('list')">List</button>
        <button class="dr-tab ${currentDiaryView === 'calendar' ? 'active' : ''}" onclick="switchDiaryView('calendar')">Month</button>
        <button class="dr-tab ${currentDiaryView === 'yearly' ? 'active' : ''}" onclick="switchDiaryView('yearly')">Year</button>
        <button class="dr-tab ${currentDiaryView === 'insights' ? 'active' : ''}" onclick="switchDiaryView('insights')">Stats</button>
        <button class="dr-tab ${currentDiaryView === 'tags' ? 'active' : ''}" onclick="switchDiaryView('tags')">Tags</button>
      </div>

      <!-- Scrollable Body -->
      <div class="dr-body">
        ${currentDiaryView === 'list' ? renderListView(sorted) : ''}
        ${currentDiaryView === 'calendar' ? renderCalendarView(entries) : ''}
        ${currentDiaryView === 'yearly' ? renderYearlyView(entries) : ''}
        ${currentDiaryView === 'insights' ? renderInsightsView(entries) : ''}
        ${currentDiaryView === 'tags' ? renderTagsView() : ''}
      </div>

      <!-- Search & Filter Bar -->
      <div class="dr-search-bar">
        <div class="dr-search-wrap">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-3);flex-shrink:0"></i>
          <input type="text" class="dr-search-input" placeholder="Search entries..."
                 value="${currentSearchQuery}" oninput="handleDiarySearch(this.value)">
          ${currentSearchQuery ? `<button class="dr-search-clear" onclick="handleDiarySearch('')">×</button>` : ''}
        </div>
        <select class="dr-filter-select" onchange="handleDateFilter(this.value)">
          <option value="all" ${currentDateFilter === 'all' ? 'selected' : ''}>All Time</option>
          <option value="week" ${currentDateFilter === 'week' ? 'selected' : ''}>This Week</option>
          <option value="month" ${currentDateFilter === 'month' ? 'selected' : ''}>Month</option>
          <option value="last7" ${currentDateFilter === 'last7' ? 'selected' : ''}>Last 7d</option>
        </select>
      </div>

    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

}

// Generate week dots (new dr- classes)
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
      <div class="dr-week-dot ${entry ? 'has-entry' : ''} ${isToday ? 'today' : ''}"
           title="${days[i]}${entry ? ` - Mood: ${entry.mood_score}/10` : ''}"
           onclick="openDiaryModal('${dateStr}')">
        <div class="dr-week-dot-circle"></div>
        <span class="dr-week-dot-day">${days[i].charAt(0)}</span>
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

// Render entry card (new dr- classes)
function renderEntryCard(entry) {
  const score = Number(entry.mood_score || 5);
  const wordCount = entry.text ? entry.text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;
  const dateStr = getRelativeDate(entry.date);

  let moodColor = '#F59E0B';
  let moodBg = 'rgba(245,158,11,.1)';
  if (score >= 8) { moodColor = '#10B981'; moodBg = 'rgba(16,185,129,.1)'; }
  else if (score <= 4) { moodColor = '#EF4444'; moodBg = 'rgba(239,68,68,.1)'; }

  const tags = entry.tags
    ? entry.tags.split(/[,\s]+/).map(t => t.trim().replace(/^#+/, '')).filter(t => t.length > 0)
    : [];
  const hasTags = tags.length > 0;

  return `
    <div class="dr-entry-card" style="border-left-color:${moodColor}" onclick="openEditDiary('${entry.id}')">
      <div class="dr-entry-main">
        <div class="dr-entry-date">${dateStr}</div>
        <p class="dr-entry-preview">${(entry.text || '').replace(/<[^>]*>/g, '').substring(0, 200)}</p>
      </div>
      ${hasTags ? `
        <div class="dr-entry-tags-row">
          ${tags.slice(0, 4).map(tag => `<span class="dr-entry-tag">#${tag}</span>`).join('')}
          ${tags.length > 4 ? `<span class="dr-entry-tag">+${tags.length - 4}</span>` : ''}
        </div>
      ` : ''}
      <div class="dr-entry-foot">
        <div class="dr-entry-foot-left">
          <span class="dr-mood-pill" style="background:${moodBg};color:${moodColor}">${getMoodEmoji(score)} ${score}/10</span>
          <span class="dr-entry-wc">${wordCount} words</span>
        </div>
        <div class="dr-entry-actions">
          <button class="dr-entry-btn" onclick="event.stopPropagation(); openEditDiary('${entry.id}')" title="Edit">
            <i data-lucide="pencil" style="width:13px;height:13px"></i>
          </button>
          <button class="dr-entry-btn danger" onclick="event.stopPropagation(); deleteEntry('${entry.id}')" title="Delete">
            <i data-lucide="trash-2" style="width:13px;height:13px"></i>
          </button>
        </div>
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
window.deleteEntry = async function (id) {
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
      <div class="dr-empty">
        <div class="dr-empty-icon">📖</div>
        <div class="dr-empty-title">No entries yet</div>
        <div class="dr-empty-sub">No entries match your search or filter.<br>Try adjusting your filters or write a new entry.</div>
        <button class="dr-empty-btn" onclick="openDiaryModal()">Write First Entry</button>
      </div>
    `;
  }

  const moodStats = getMoodStats(sorted);
  const streak = calculateStreak(sorted);

  return `
    <div class="dr-entries">
      <div class="dr-section-header">
        <span class="dr-section-title">${sorted.length} ${sorted.length === 1 ? 'Entry' : 'Entries'}</span>
        ${moodStats.avgMood ? `<span class="dr-section-meta">${moodStats.avgMood}/10 avg mood</span>` : ''}
      </div>
      ${sorted.map(entry => renderEntryCard(entry)).join('')}
    </div>
  `;
}

// Render timeline view — mood colored vertical timeline
function renderTimelineView(sorted) {
  if (sorted.length === 0) {
    return `<div class="dr-empty"><div class="dr-empty-icon">📖</div><div class="dr-empty-title">No entries yet</div><div class="dr-empty-sub">Start writing to see your timeline.</div></div>`;
  }

  const getMoodColor = (score) => {
    const s = Number(score || 5);
    if (s >= 8) return '#10B981';
    if (s >= 5) return '#F59E0B';
    return '#EF4444';
  };

  const getMoodBg = (score) => {
    const s = Number(score || 5);
    if (s >= 8) return 'rgba(16,185,129,0.10)';
    if (s >= 5) return 'rgba(245,158,11,0.10)';
    return 'rgba(239,68,68,0.10)';
  };

  return `
    <div class="dr-entries">
      <div class="dr-section-header">
        <span class="dr-section-title">🕐 Timeline</span>
        <span style="font-size:11px;color:var(--text-3);font-weight:600;">📝 ${sorted.length} entries</span>
      </div>
      <div class="diary-timeline">
        ${sorted.map((entry, i) => {
    const moodColor = getMoodColor(entry.mood_score);
    const moodBg = getMoodBg(entry.mood_score);
    const score = Number(entry.mood_score || 5);
    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const preview = (entry.text || '').substring(0, 200);
    const tags = entry.tags ? entry.tags.split(/[,\s]+/).filter(t => t).slice(0, 3) : [];

    return `
          <div class="timeline-entry" style="border-left-color:${moodColor}; background:${moodBg}; animation-delay:${i * 0.05}s;">
            <div class="timeline-entry-date">${dateStr}</div>
            <div class="timeline-entry-text">${preview}${(entry.text || '').length > 200 ? '...' : ''}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:6px;">
              <div style="display:flex;gap:4px;">
                ${tags.map(t => `<span style="font-size:10px;padding:2px 7px;background:var(--surface-2);border-radius:10px;color:var(--text-muted);">#${t}</span>`).join('')}
              </div>
              <div class="timeline-entry-mood" style="background:${moodBg};color:${moodColor};">
                ${getMoodEmoji(score)} ${score}/10
              </div>
            </div>
            <button style="position:absolute;top:10px;right:10px;border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:14px;" onclick="openEditDiary('${entry.id}')">✏️</button>
          </div>`;
  }).join('')}
      </div>
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

  const moodColors = ['', '#FEE2E2', '#FEF3C7', '#FEF9C3', '#D1FAE5', '#A7F3D0'];

  return `
    <div class="dr-calendar">
      <div class="dr-cal-header">
        <span class="dr-cal-title">${monthName}</span>
        <span class="dr-cal-stat">${monthEntries.length} entries${moodStats.avgMood ? ` · ${moodStats.avgMood}/10 avg` : ''}</span>
      </div>
      <div class="dr-cal-weekdays">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="dr-cal-weekday">${d}</div>`).join('')}
      </div>
      <div class="dr-cal-grid">
        ${days.map(d => {
    if (d.isOtherMonth) return `<div class="dr-cal-day other-month"><span class="dr-cal-day-num">${d.date}</span></div>`;

    const moodLevel = d.entry ? Math.ceil(Number(d.entry.mood_score || 5) / 2) : 0;
    const bgStyle = moodLevel > 0 ? `background:${moodColors[moodLevel]}20` : '';

    return `
            <div class="dr-cal-day ${d.isToday ? 'today' : ''} ${d.entry ? 'has-entry' : ''}"
                 style="${bgStyle}"
                 onclick="${d.entry ? `openEditDiary('${d.entry.id}')` : `openDiaryModal('${year}-${String(month + 1).padStart(2, '0')}-${String(d.date).padStart(2, '0')}')`}">
              <span class="dr-cal-day-num">${d.date}</span>
              ${d.entry ? `<div class="dr-cal-day-dot"></div>` : ''}
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
      monthIndex: m,
      days,
      entryCount: monthEntries
    });
  }

  // Calculate yearly stats
  const totalEntries = entries.length;
  const streak = calculateStreak(entries);
  const moodStats = getMoodStats(entries);

  const moodColors = ['', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981'];

  return `
    <div class="dr-yearly">
      <div class="dr-yearly-header">
        <span class="dr-yearly-title">${year} Overview</span>
        <span style="font-size:11px;color:var(--text-3);font-weight:600;">${totalEntries} entries · ${streak} streak${moodStats.avgMood ? ` · ${moodStats.avgMood}/10` : ''}</span>
      </div>
      <div class="dr-months-grid">
        ${months.map(m => `
          <div class="dr-month-card">
            <div class="dr-month-name">
              ${m.name}
              ${m.entryCount > 0 ? `<span class="dr-month-count">${m.entryCount}</span>` : ''}
            </div>
            <div class="dr-month-days">
              ${m.days.map(d => {
    if (!d.day) return '<div class="dr-day-cell" style="background:transparent;pointer-events:none;"></div>';
    const moodScore = d.entry ? Number(d.entry.mood_score || 5) : 0;
    const moodLevel = Math.ceil(moodScore / 2);
    const bgColor = d.entry ? moodColors[moodLevel] : 'var(--surface-2)';
    return `
                  <div class="dr-day-cell ${d.entry ? 'has-entry' : ''} ${d.isToday ? 'today' : ''}"
                       style="background-color:${bgColor} !important;"
                       onclick="${d.entry ? `openEditDiary('${d.entry.id}')` : `openDiaryModal('${year}-${String(m.monthIndex + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}')`}"
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
    <div class="dr-insights">
      <div class="dr-insights-header">
        <span class="dr-insights-title">Insights</span>
        <button class="dr-export-btn" onclick="window.exportDiary()">
          <i data-lucide="download" style="width:13px;height:13px"></i>
          Export
        </button>
      </div>


      <!-- Writing Stats -->
      <div class="dr-insight-card">
        <div class="dr-insight-card-label">Writing Stats</div>
        <div class="dr-stat-row">
          <div class="dr-stat-row-val">${thisMonth.length}</div>
          <div class="dr-stat-row-lbl">entries this month</div>
        </div>
        <div class="dr-stat-row">
          <div class="dr-stat-row-val">${totalWords.toLocaleString()}</div>
          <div class="dr-stat-row-lbl">total words written</div>
        </div>
        <div class="dr-stat-row">
          <div class="dr-stat-row-val">${streak}</div>
          <div class="dr-stat-row-lbl">day streak</div>
        </div>
        ${moodStats.avgMood ? `
        <div class="dr-stat-row">
          <div class="dr-stat-row-val">${moodStats.avgMood}</div>
          <div class="dr-stat-row-lbl">average mood score</div>
        </div>
        ` : ''}
      </div>

      <!-- Achievements -->
      ${achievements.length > 0 ? `
      <div class="dr-insight-card">
        <div class="dr-insight-card-label">Achievements</div>
        ${achievements.map(a => {
    let unlocked = false;
    const totalEntries = entries.length;
    const goodMoodCount = entries.filter(e => Number(e.mood_score) >= 8).length;

    if (a.type === 'streak' && streak >= Number(a.target_value)) unlocked = true;
    if (a.type === 'entries' && totalEntries >= Number(a.target_value)) unlocked = true;
    if (a.type === 'mood' && goodMoodCount >= Number(a.target_value)) unlocked = true;

    return `
            <div class="dr-achievement-item ${unlocked ? 'unlocked' : 'locked'}">
              <div class="dr-achievement-icon">${unlocked ? '🏆' : '🔒'}</div>
              <div>
                <div class="dr-achievement-name">${a.name}</div>
                <div class="dr-achievement-desc">${a.description}</div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
      ` : ''}
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
    const filter = currentTagFilter.toLowerCase();
    filtered = filtered.filter(e => {
      if (!e.tags) return false;
      const entryTags = e.tags.split(/[,\s]+/).map(t => t.trim().toLowerCase().replace(/^#+/, ''));
      return entryTags.includes(filter.replace(/^#+/, ''));
    });
  }

  return filtered;
}

window.handleDiarySearch = function (query) {
  currentSearchQuery = query;
  renderDiary();
};

window.handleDateFilter = function (filter) {
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

window.switchDiaryView = function (view) {
  currentDiaryView = view;
  renderDiary();
};

function renderTagsView() {
  const tagsData = state.data.diary_tags || [];
  const entries = state.data.diary || [];

  const tagCounts = {};
  entries.forEach(e => {
    if (e.tags) {
      // Robust split by comma or space, remove extra hashtags
      e.tags.split(/[,\s]+/).forEach(tag => {
        const t = tag.trim().toLowerCase().replace(/^#+/, '');
        if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });

  const allTags = [...new Set([...Object.keys(tagCounts), ...tagsData.map(t => t.name.toLowerCase())])];

  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  return `
    <div class="dr-tags">
      <div class="dr-section-header" style="padding:4px 0 14px;">
        <span class="dr-section-title">Your Tags</span>
        <button style="font-size:11px;font-weight:700;padding:5px 11px;border-radius:10px;border:1.5px solid var(--border-color);background:var(--surface-2);color:var(--text-2);cursor:pointer;" onclick="openTagModal()">+ New Tag</button>
      </div>

      <div class="dr-tags-grid">
        ${allTags.length === 0 ? `
          <div class="dr-empty" style="padding:30px 0;">
            <div class="dr-empty-icon">🏷️</div>
            <div class="dr-empty-title" style="font-size:14px;">No tags yet</div>
            <div class="dr-empty-sub" style="font-size:12px;">Tags will appear when you add them to entries.</div>
          </div>
        ` : allTags.map((tag, idx) => {
    const count = tagCounts[tag] || 0;
    const color = colors[idx % colors.length];
    return `
            <div class="dr-tag-chip" style="background:${color}14;color:${color};border-color:${color}30;" onclick="filterByTag('${tag}')">
              #${tag}
              <span class="dr-tag-count">${count}</span>
            </div>
          `;
  }).join('')}
      </div>

      <!-- Templates Section -->
      <div class="dr-section-sep">
        Templates
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:12px;color:var(--text-3);font-weight:500;">${(state.data.diary_templates || []).length} templates</span>
        <div style="display:flex;gap:6px;">
          ${(state.data.diary_templates || []).length === 0 ? `
            <button style="font-size:11px;font-weight:700;padding:5px 11px;border-radius:10px;border:1.5px solid var(--border-color);background:var(--surface-2);color:var(--text-2);cursor:pointer;" onclick="seedDefaultTemplates()">Seed Defaults</button>
          ` : ''}
          <button style="font-size:11px;font-weight:700;padding:5px 11px;border-radius:10px;border:none;background:var(--primary);color:#fff;cursor:pointer;" onclick="openTemplateModal()">+ New Template</button>
        </div>
      </div>
      ${renderTemplatesList()}
    </div>
  `;
}

window.seedDefaultTemplates = async function () {
  const defaults = [
    { title: "Standard Reflection", category: "reflection", content: "### Today's Highlights\n- \n\n### Challenges Overcome\n- \n\n### One Thing To Improve\n- " },
    { title: "Gratitude Journal", category: "gratitude", content: "### Today, I am grateful for:\n1. \n2. \n3. \n\n### What would have made today even better?\n- " },
    { title: "Evening Wind-down", category: "reflection", content: "### What's on my mind right now?\n\n\n### Am I holding onto any stress? How can I let it go?\n\n\n### Intention for tomorrow:\n- " },
    { title: "Weekly Goals Check-in", category: "goals", content: "### Progress on Main Goal\n\n\n### Sub-tasks Completed\n- \n\n### Adjustments for Next Week\n- " },
    { title: "Brain Dump", category: "reflection", content: "### Unfiltered Thoughts\n\n\n### Actionable Items from this Dump\n- \n- " }
  ];

  if (confirm('Add 5 default templates to your spreadsheet?')) {
    const btn = document.querySelector('.btn-seed');
    if (btn) btn.disabled = true;

    for (const t of defaults) {
      await apiCall('create', 'diary_templates', {
        ...t,
        is_default: false,
        sort_order: 1
      });
    }

    await refreshData('diary_templates');
    renderDiary();
  }
};

function renderTemplatesList() {
  const templates = state.data.diary_templates || [];
  if (!templates.length) return '<p style="font-size:13px;color:var(--text-3);margin:0;">No templates yet</p>';

  return `
    <div class="dr-templates-grid">
      ${templates.map(t => `
        <div class="dr-template-card">
          <div class="dr-template-cat">${t.category || 'general'}</div>
          <div class="dr-template-title">${t.title}</div>
          <div class="dr-template-preview">${(t.content || '').substring(0, 80)}...</div>
          <div class="dr-template-actions">
            <button class="dr-template-btn primary" onclick="useTemplate(${t.id})">Use</button>
            <button class="dr-template-btn" onclick="editTemplate(${t.id})">Edit</button>
            <button class="dr-template-btn danger" onclick="deleteTemplate(${t.id})">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.useTemplate = function (id) {
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id === id);
  if (t) openDiaryModal(null, t.content);
};

window.editTemplate = function (id) {
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id === id);
  openTemplateModal(t);
};

window.deleteTemplate = async function (id) {
  if (confirm('Delete this template?')) {
    await apiCall('delete', 'diary_templates', null, id);
    await refreshData('diary_templates');
    renderDiary();
  }
};

window.openTemplateModal = function (template = null) {
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

window.saveTemplate = async function (existingId) {
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

window.openTagModal = function () {
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

window.saveNewTag = async function () {
  const name = document.getElementById('mTagName').value.toLowerCase().trim();
  if (!name) return;

  await apiCall('create', 'diary_tags', { name, color: '#4F46E5', usage_count: 0 });
  document.getElementById('universalModal').classList.add('hidden');
  await refreshData('diary_tags');
  renderDiary();
};

window.filterByTag = function (tag) {
  currentTagFilter = tag;
  currentDiaryView = 'list';
  renderDiary();
};

// Modal functions
window.openDiaryModal = function (dateStr, templateContent = '') {
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
    <div class="dr-modal">
      <div class="dr-modal-title">${dateStr ? 'Edit Entry' : 'New Entry'}</div>

      ${templates.length > 0 ? `
      <select class="dr-template-select" id="templateSelect" onchange="loadTemplateInModal(this.value)">
        <option value="">— Use a Template —</option>
        ${templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
      </select>
      ` : ''}

      ${((showTasks && contextData.tasks?.length) || (showHabits && contextData.habits?.length) || (showExpenses && contextData.expenses > 0)) ? `
      <div class="dr-context-bar">
        ${showTasks && contextData.tasks?.length ? `<span class="dr-context-chip">✓ ${contextData.tasks.length} task(s) done</span>` : ''}
        ${showHabits && contextData.habits?.length ? `<span class="dr-context-chip">✓ ${contextData.habits.length} habit(s) logged</span>` : ''}
        ${showExpenses && contextData.expenses > 0 ? `<span class="dr-context-chip">💸 ${(contextData.expenses || 0).toFixed(2)} spent</span>` : ''}
      </div>` : ''}

      <div class="dr-mood-section">
        <span class="dr-mood-label">How are you feeling?</span>
        <div class="dr-mood-slider-row">
          <div class="dr-mood-display">
            <span id="moodEmoji" class="dr-mood-emoji">${getMoodEmoji(defaultMood)}</span>
            <span id="moodVal" class="dr-mood-num">${defaultMood}</span>
          </div>
          <input type="range" min="1" max="10" value="${defaultMood}" class="mood-slider dr-mood-slider" id="mMoodScore"
            oninput="updateMoodDisplay(this.value)">
        </div>
        <div class="dr-mood-labels">
          <span>Awful</span>
          <span>Amazing</span>
        </div>
      </div>

      <div class="dr-toolbar">
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('bold')" title="Bold"><b>B</b></button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('italic')" title="Italic"><i>I</i></button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertUnorderedList')" title="Bullet List">•</button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertOrderedList')" title="Numbered List">1.</button>
        <button type="button" class="dr-toolbar-ai" onmousedown="event.preventDefault();" onclick="insertDiarySummary('${defaultDate}')" title="Auto-Summarize Day">
          ✨ Auto-Summary
        </button>
      </div>
      <div class="rich-editor dr-editor" id="mDiaryText" contenteditable="true"
           placeholder="Start writing...">${templateContent}</div>

      <div class="dr-field-row">
        <input class="dr-field" id="mDiaryTags" placeholder="#tags (comma separated)">
        <input type="date" class="dr-field" id="mDiaryDate" value="${defaultDate}" style="max-width:160px;">
      </div>
      <div class="dr-word-count" id="diaryWordCount">0 words</div>

      <div class="dr-modal-actions">
        <button class="dr-modal-cancel" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="dr-modal-save" data-action="save-diary-modal">Save Entry</button>
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
window.loadTemplateInModal = function (templateId) {
  if (!templateId) return;
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id == templateId);
  if (t && t.content) {
    const editor = document.getElementById('mDiaryText');
    if (editor) editor.innerText = t.content;
  }
};

window.updateMoodDisplay = function (value) {
  const emojiEl = document.getElementById('moodEmoji');
  const valEl = document.getElementById('moodVal');
  if (emojiEl) {
    emojiEl.textContent = getMoodEmoji(value);
  }
  if (valEl) {
    valEl.textContent = value;
  }
};

window.formatText = function (cmd) {
  document.execCommand(cmd, false, null);
};

window.openEditDiary = function (id) {
  const e = (state.data.diary || []).find(x => String(x.id) === String(id));
  if (!e) return;

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const score = Number(e.mood_score || 5);

  box.innerHTML = `
    <div class="dr-modal">
      <div class="dr-modal-title">Edit Entry</div>

      <div class="dr-mood-section">
        <span class="dr-mood-label">How are you feeling?</span>
        <div class="dr-mood-slider-row">
          <div class="dr-mood-display">
            <span id="moodEmoji" class="dr-mood-emoji">${getMoodEmoji(score)}</span>
            <span id="moodVal" class="dr-mood-num">${score}</span>
          </div>
          <input type="range" min="1" max="10" value="${score}" class="mood-slider dr-mood-slider" id="mMoodScore"
            oninput="updateMoodDisplay(this.value)">
        </div>
        <div class="dr-mood-labels">
          <span>Awful</span>
          <span>Amazing</span>
        </div>
      </div>

      <div class="dr-toolbar">
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('bold')" title="Bold"><b>B</b></button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('italic')" title="Italic"><i>I</i></button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertUnorderedList')" title="Bullet List">•</button>
        <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertOrderedList')" title="Numbered List">1.</button>
        <button type="button" class="dr-toolbar-ai" onmousedown="event.preventDefault();" onclick="insertDiarySummary('${(e.date || '').slice(0, 10)}')" title="Auto-Summarize Day">
          ✨ Auto-Summary
        </button>
      </div>
      <div class="rich-editor dr-editor" id="mDiaryText" contenteditable="true">${(e.text || '').replace(/</g, '<')}</div>

      <div class="dr-field-row">
        <input class="dr-field" id="mDiaryTags" value="${(e.tags || '')}">
        <input type="date" class="dr-field" id="mDiaryDate" value="${(e.date || '').slice(0, 10)}" style="max-width:160px;">
      </div>
      <div class="dr-word-count" id="diaryWordCount">${e.text ? e.text.split(/\s+/).length : 0} words</div>

      <div class="dr-modal-actions">
        <button class="dr-modal-cancel" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="dr-modal-save" data-action="update-diary-modal" data-edit-id="${e.id}">Update</button>
      </div>
    </div>
  `;

  const editor = document.getElementById('mDiaryText');
  editor.addEventListener('input', () => {
    const text = editor.innerText || '';
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    const wc = document.getElementById('diaryWordCount');
    if (wc) wc.textContent = `${count} words`;
  });

  modal.classList.remove('hidden');
};

function getContextData(dateStr) {
  const context = {};
  const tasks = state.data.tasks || [];
  context.tasks = tasks.filter(t => (t.due_date || '').startsWith(dateStr) && t.status === 'completed');

  const habits = state.data.habit_logs || [];
  context.habits = habits.filter(h => (h.date || '').startsWith(dateStr));

  const expenses = state.data.expenses || [];
  const dayExpenses = expenses.filter(e => (e.date || '').startsWith(dateStr));
  context.expenses = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return context;
}

window.insertDiarySummary = function (dateStr) {
  const context = getContextData(dateStr);
  const editor = document.getElementById('mDiaryText');
  if (!editor) return;

  let summaryParts = [];

  if (context.tasks && context.tasks.length > 0) {
    summaryParts.push('<b>Tasks Completed:</b><br>' + context.tasks.map(t => '• ' + t.title).join('<br>'));
  }

  if (context.habits && context.habits.length > 0) {
    const habitMap = new Map();
    (state.data.habits || []).forEach(h => habitMap.set(String(h.id), h.habit_name));
    const habitNames = context.habits.map(h => '• ' + (habitMap.get(String(h.habit_id)) || 'Habit')).join('<br>');
    summaryParts.push('<b>Habits Done:</b><br>' + habitNames);
  }

  if (context.expenses > 0) {
    summaryParts.push('<b>Expenses:</b> 💸 ' + context.expenses.toFixed(2));
  }

  if (summaryParts.length === 0) {
    showToast("No tasks, habits, or expenses to summarize for this day.");
    return;
  }

  const htmlToInsert = '<br><br><b>--- Day Summary ---</b><br>' + summaryParts.join('<br><br>') + '<br><br>';

  editor.focus();

  // Use Selection API for robust HTML insertion on iOS without dismissing keyboard
  const selection = window.getSelection();
  if (selection.getRangeAt && selection.rangeCount > 0) {
    let range = selection.getRangeAt(0);
    // Ensure the cursor is actually inside the diary editor
    if (editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();

      const el = document.createElement('div');
      el.innerHTML = htmlToInsert;

      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }

      range.insertNode(frag);

      // Move cursor after the inserted content
      if (lastNode) {
        range = range.cloneRange();
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      // Fallback if cursor isn't active inside editor
      if (editor.innerHTML === '<br>' || editor.innerHTML === '') editor.innerHTML = htmlToInsert;
      else editor.innerHTML += htmlToInsert;
    }
  } else {
    // Ultimate fallback
    if (editor.innerHTML === '<br>' || editor.innerHTML === '') editor.innerHTML = htmlToInsert;
    else editor.innerHTML += htmlToInsert;
  }

  // Trigger input event to update word count
  const event = new Event('input', { bubbles: true });
  editor.dispatchEvent(event);
  showToast("Summary added!");
};

function getMoodEmoji(score) {
  if (score <= 2) return '😞';
  if (score <= 4) return '😕';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  if (score === 9) return '😄';
  return '🤩';
}

window.exportDiary = function () {
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
