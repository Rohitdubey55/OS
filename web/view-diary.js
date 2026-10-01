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

/* Strip markdown + HTML for clean previews (entries are stored as markdown,
   so raw "###", "**", "-" etc. must not leak into the list). */
function _drStripMd(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$2')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Read a numeric mood from an entry — the DB column is `mood`; older code/exports
   used `mood_score`. Returns null when no mood is set (so we never fake a 5/10). */
function _drMood(e) {
  const v = (e && e.mood_score != null && e.mood_score !== '') ? e.mood_score : (e ? e.mood : null);
  const n = Number(v);
  return (v == null || v === '' || isNaN(n)) ? null : n;
}

/* Desktop insights rail beside the entry list (mood trend, total written, top tags). */
function renderDiaryRail(entries) {
  const all = entries || [];
  const totalWords = all.reduce((s, e) => s + _drStripMd(e.content).split(/\s+/).filter(Boolean).length, 0);
  const byDateAsc = [...all].filter(e => e.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const recent = byDateAsc.slice(-14);
  const pairs = recent.map(e => ({ e, m: _drMood(e) }));
  const moodNums = pairs.map(p => p.m).filter(m => m != null);
  const avg = moodNums.length ? (moodNums.reduce((a, b) => a + b, 0) / moodNums.length) : null;
  const mc = m => m >= 8 ? '#10B981' : m >= 6 ? '#84CC16' : m >= 4 ? '#F59E0B' : m >= 2 ? '#F97316' : '#EF4444';
  const bars = pairs.map(({ e, m }) => `<div class="drr-bar" style="height:${m != null ? (12 + (m / 10) * 42) : 6}px;background:${m != null ? mc(m) : 'var(--surface-3)'}" title="${e.date}: ${m != null ? m : '—'}/10"></div>`).join('');
  const tagCount = {};
  all.forEach(e => String(e.tags || '').split(/[,\s]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return `
  <div class="drr-card">
    <div class="drr-h">Mood trend</div>
    ${moodNums.length >= 2
      ? `<div class="drr-mood">${bars}</div><div class="drr-mavg"><b>${avg.toFixed(1)}</b><span>avg · last ${moodNums.length}</span></div>`
      : `<div class="drr-empty">Set a mood when you write to see your trend.</div>`}
  </div>
  <div class="drr-card">
    <div class="drr-h">Total written</div>
    <div class="drr-month"><b>${totalWords.toLocaleString()}</b><span>words · ${all.length} ${all.length === 1 ? 'entry' : 'entries'}</span></div>
  </div>
  <div class="drr-card">
    <div class="drr-h">Top tags</div>
    ${topTags.length
      ? `<div class="drr-tags">${topTags.map(([t, n]) => `<span class="drr-tag" onclick="handleDiarySearch('${String(t).replace(/'/g, "\\'")}')">#${t}<b>${n}</b></span>`).join('')}</div>`
      : `<div class="drr-empty">Add #tags to your entries.</div>`}
  </div>`;
}

function renderDiary() {
  const entries = state.data.diary || [];

  let filteredEntries = filterEntries(entries);
  const sorted = [...filteredEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calculate Stats
  const validMoods = sorted.map(_drMood).filter(v => v != null);
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
/* ═══ DIARY SHELL — Premium Mobile-First Journal ═══ */
.dr-shell { display:flex; flex-direction:column; height:calc(100vh - env(safe-area-inset-top,44px) - 80px); overflow:hidden; background:var(--surface-base,#F7F8FA); -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }

/* ═══ HEADER ═══ */
.dr-header { display:flex; align-items:center; justify-content:space-between; padding:20px 20px 16px; flex-shrink:0; }
.dr-greeting { font-size:26px; font-weight:800; color:var(--text-1); letter-spacing:-.8px; line-height:1.1; margin:0; }
.dr-header-date { font-size:13px; color:var(--text-3); margin:4px 0 0; font-weight:500; letter-spacing:-.1px; }
.dr-write-btn { display:inline-flex; align-items:center; gap:7px; padding:12px 20px; background:var(--primary); color:#fff; border:none; border-radius:14px; font-size:14px; font-weight:700; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); flex-shrink:0; box-shadow:0 2px 8px rgba(79,70,229,.25); -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.dr-write-btn:active { opacity:.85; transform:scale(.96); box-shadow:0 1px 4px rgba(79,70,229,.2); }

/* ═══ STATS STRIP ═══ */
.dr-stats-strip { display:flex; align-items:center; padding:20px 18px; flex-shrink:0; background:var(--surface-1); border-radius:18px; margin:0 20px 14px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,.04); }
.dr-stat-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
.dr-stat-n { font-size:28px; font-weight:800; color:var(--text-1); letter-spacing:-1px; line-height:1; }
.dr-stat-l { font-size:10px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.8px; }
.dr-stat-div { width:1px; height:32px; background:var(--border-color); flex-shrink:0; opacity:.6; }

/* ═══ OVERVIEW CARDS ═══ */
.dr-overview-row { display:flex; gap:10px; padding:0 20px 14px; flex-shrink:0; }
.dr-overview-card { flex:1; background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:14px 15px; min-width:0; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.dr-card-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--text-3); margin-bottom:12px; display:flex; align-items:center; gap:5px; }
.dr-week-dots { display:flex; justify-content:space-between; margin-bottom:10px; gap:4px; }
.dr-week-dot { display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; flex:1; }
.dr-week-dot-circle { width:28px; height:28px; border-radius:50%; background:var(--surface-2); border:2px solid var(--border-color); transition:all .2s cubic-bezier(.4,0,.2,1); }
.dr-week-dot.has-entry .dr-week-dot-circle { background:var(--primary); border-color:var(--primary); box-shadow:0 2px 6px rgba(79,70,229,.25); }
.dr-week-dot.today:not(.has-entry) .dr-week-dot-circle { border-color:var(--primary); border-width:2.5px; background:rgba(79,70,229,.08); }
.dr-week-dot.today.has-entry .dr-week-dot-circle { box-shadow:0 0 0 3px rgba(79,70,229,.18), 0 2px 6px rgba(79,70,229,.25); }
.dr-week-dot-day { font-size:9px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.3px; }
.dr-week-progress { height:4px; background:var(--surface-2); border-radius:99px; margin-top:4px; overflow:hidden; }
.dr-week-progress-fill { height:100%; background:linear-gradient(90deg, var(--primary), #8B5CF6); border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }
.dr-week-stat { font-size:11px; color:var(--text-3); font-weight:500; margin-top:6px; }
.dr-week-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:14px 16px 12px; margin:0 20px 14px; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.dr-week-card-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }
.dr-week-card-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--text-3); margin-bottom:4px; }
.dr-week-written { font-size:15px; font-weight:800; color:var(--text-1); line-height:1; }
.dr-week-written span { font-size:12px; font-weight:500; color:var(--text-3); }
.dr-week-streak-badge { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#F97316; background:rgba(249,115,22,.06); border:1px solid rgba(249,115,22,.12); padding:6px 14px; border-radius:99px; }

/* ═══ NAV TABS ═══ */
.dr-tabs { display:flex; padding:0 20px; flex-shrink:0; border-bottom:1.5px solid var(--border-color); overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; gap:0; }
.dr-tabs::-webkit-scrollbar { display:none; }
.dr-tab { flex-shrink:0; padding:12px 16px; font-size:14px; font-weight:600; color:var(--text-3); background:transparent; border:none; border-bottom:2.5px solid transparent; cursor:pointer; transition:color .2s, border-color .2s; white-space:nowrap; margin-bottom:-1.5px; -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:44px; }
.dr-tab.active { color:var(--primary); border-bottom-color:var(--primary); font-weight:700; }
.dr-tab:active { opacity:.6; }

/* ═══ SCROLLABLE BODY ═══ */
.dr-body { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-top:4px; overscroll-behavior-y:contain; }

/* ═══ SEARCH BAR ═══ */
.dr-search-bar { padding:10px 20px; padding-bottom:calc(10px + env(safe-area-inset-bottom,0px)); flex-shrink:0; display:flex; gap:8px; background:var(--surface-base,#F7F8FA); border-top:1px solid var(--border-color); }
.dr-search-wrap { flex:1; display:flex; align-items:center; gap:8px; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:12px; padding:0 14px; transition:border-color .2s; }
.dr-search-wrap:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.08); }
.dr-search-input { flex:1; border:none; background:transparent; outline:none; font-size:14px; color:var(--text-1); padding:11px 0; -webkit-tap-highlight-color:transparent; }
.dr-search-input::placeholder { color:var(--text-3); }
.dr-search-clear { border:none; background:none; cursor:pointer; color:var(--text-3); font-size:18px; padding:6px; min-width:32px; min-height:32px; display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; }
.dr-filter-select { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:12px; padding:0 12px; font-size:13px; color:var(--text-2); outline:none; cursor:pointer; font-weight:600; height:44px; -webkit-tap-highlight-color:transparent; -webkit-appearance:none; }

/* ═══ ENTRIES ═══ */
.dr-entries { padding:14px 20px 20px; }
.dr-section-header { display:flex; align-items:center; justify-content:space-between; padding:0 2px 12px; }
.dr-section-title { font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.6px; }
.dr-section-meta { font-size:11px; color:var(--text-3); font-weight:500; }

/* ═══ ENTRY CARD ═══ */
.dr-entry-card { background:var(--surface-1); border:1px solid var(--border-color); border-left:4px solid; border-radius:14px; margin-bottom:10px; overflow:hidden; cursor:pointer; transition:transform .2s cubic-bezier(.4,0,.2,1), box-shadow .2s; animation:drCardIn .35s cubic-bezier(.4,0,.2,1) both; -webkit-tap-highlight-color:transparent; touch-action:manipulation; box-shadow:0 1px 3px rgba(0,0,0,.04); }
@keyframes drCardIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.dr-entry-card:active { transform:scale(.985); box-shadow:0 4px 16px rgba(0,0,0,.08); }
.dr-entry-main { padding:16px 16px 10px; }
.dr-entry-date { font-size:11px; font-weight:700; color:var(--text-3); margin-bottom:6px; text-transform:uppercase; letter-spacing:.4px; }
.dr-entry-preview { font-size:15px; color:var(--text-1); line-height:1.55; margin:0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; letter-spacing:-.1px; }
.dr-entry-tags-row { display:flex; flex-wrap:wrap; gap:5px; padding:0 16px 10px; }
.dr-entry-tag { font-size:11px; font-weight:600; padding:3px 9px; border-radius:99px; background:rgba(79,70,229,.06); color:var(--primary); }
.dr-entry-foot { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-top:1px solid var(--border-color); }
.dr-entry-foot-left { display:flex; align-items:center; gap:10px; }
.dr-mood-pill { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; }
.dr-entry-wc { font-size:11.5px; color:var(--text-3); font-weight:500; }
.dr-entry-actions { display:flex; gap:4px; }
.dr-entry-btn { width:36px; height:36px; border-radius:10px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-3); transition:all .15s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.dr-entry-btn:active { background:var(--surface-2); color:var(--text-1); transform:scale(.9); }
.dr-entry-btn.danger:active { background:rgba(220,38,38,.07); color:#DC2626; }

/* ═══ EMPTY STATE ═══ */
.dr-empty { display:flex; flex-direction:column; align-items:center; padding:60px 24px; text-align:center; }
.dr-empty-icon { width:56px; height:56px; border-radius:16px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; margin-bottom:16px; font-size:24px; }
.dr-empty-title { font-size:18px; font-weight:700; color:var(--text-1); margin-bottom:8px; letter-spacing:-.2px; }
.dr-empty-sub { font-size:14px; color:var(--text-3); line-height:1.5; margin-bottom:24px; max-width:280px; }
.dr-empty-btn { padding:12px 28px; background:var(--primary); color:#fff; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(79,70,229,.25); -webkit-tap-highlight-color:transparent; touch-action:manipulation; transition:all .2s; }
.dr-empty-btn:active { transform:scale(.97); }

/* ═══ CALENDAR VIEW ═══ */
.dr-calendar { padding:16px 20px 20px; }
.dr-cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.dr-cal-title { font-size:18px; font-weight:700; color:var(--text-1); letter-spacing:-.3px; }
.dr-cal-stat { font-size:12px; font-weight:600; color:var(--text-3); }
.dr-cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:6px; }
.dr-cal-weekday { text-align:center; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; padding:6px 0; }
.dr-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
.dr-cal-day { aspect-ratio:1; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; border:1.5px solid transparent; transition:all .15s cubic-bezier(.4,0,.2,1); background:var(--surface-2); position:relative; gap:2px; -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:40px; }
.dr-cal-day.other-month { opacity:.12; pointer-events:none; }
.dr-cal-day.today { border-color:var(--primary); }
.dr-cal-day.has-entry { background:rgba(79,70,229,.08); border-color:rgba(79,70,229,.18); }
.dr-cal-day.today.has-entry { border-color:var(--primary); border-width:2px; }
.dr-cal-day:active { transform:scale(.88); }
.dr-cal-day-num { font-size:12px; font-weight:600; color:var(--text-2); line-height:1; }
.dr-cal-day.today .dr-cal-day-num { color:var(--primary); font-weight:800; }
.dr-cal-day-dot { width:5px; height:5px; border-radius:50%; background:var(--primary); }

/* ═══ YEARLY VIEW ═══ */
.dr-yearly { padding:16px 20px 20px; }
.dr-yearly-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.dr-yearly-title { font-size:18px; font-weight:700; color:var(--text-1); letter-spacing:-.3px; }
.dr-months-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.dr-month-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,.03); }
.dr-month-name { font-size:11px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
.dr-month-count { font-size:9px; font-weight:700; padding:2px 6px; border-radius:99px; background:rgba(79,70,229,.08); color:var(--primary); }
.dr-month-days { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.dr-day-cell { aspect-ratio:1; border-radius:3px; background:var(--surface-2); cursor:pointer; transition:all .15s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.dr-day-cell.has-entry { background:var(--primary); opacity:.6; }
.dr-day-cell.today { outline:2px solid var(--primary); outline-offset:0; opacity:1; }
.dr-day-cell:active { transform:scale(.75); }

/* ═══ INSIGHTS VIEW ═══ */
.dr-insights { padding:16px 20px 20px; }
.dr-insights-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.dr-insights-title { font-size:18px; font-weight:700; color:var(--text-1); letter-spacing:-.3px; }
.dr-export-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:12px; border:1.5px solid var(--border-color); background:transparent; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; min-height:44px; -webkit-tap-highlight-color:transparent; touch-action:manipulation; transition:all .15s; }
.dr-export-btn:active { background:var(--surface-2); }
.dr-insight-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; padding:18px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.dr-insight-card-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--text-3); margin-bottom:14px; }
.dr-stat-row { display:flex; align-items:center; gap:14px; padding:10px 0; border-bottom:1px solid var(--border-color); }
.dr-stat-row:last-child { border-bottom:none; }
.dr-stat-row-val { font-size:22px; font-weight:800; color:var(--text-1); min-width:56px; letter-spacing:-.5px; }
.dr-stat-row-lbl { font-size:14px; color:var(--text-3); font-weight:500; }
.dr-achievement-item { display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--border-color); }
.dr-achievement-item:last-child { border-bottom:none; }
.dr-achievement-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.dr-achievement-item.unlocked .dr-achievement-icon { background:rgba(245,158,11,.08); }
.dr-achievement-item.locked .dr-achievement-icon { background:var(--surface-2); filter:grayscale(1); opacity:.5; }
.dr-achievement-name { font-size:14px; font-weight:700; color:var(--text-1); }
.dr-achievement-desc { font-size:12px; color:var(--text-3); margin-top:2px; }

/* ═══ TAGS VIEW ═══ */
.dr-tags { padding:16px 20px 20px; }
.dr-tags-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
.dr-tag-chip { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:99px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:36px; }
.dr-tag-chip:active { transform:scale(.93); }
.dr-tag-count { font-size:11px; opacity:.6; font-weight:700; }
.dr-section-sep { font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.7px; margin-bottom:14px; display:flex; align-items:center; gap:10px; }
.dr-section-sep::after { content:''; flex:1; height:1px; background:var(--border-color); }
.dr-templates-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:18px; }
.dr-template-card { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:14px; padding:14px; cursor:pointer; transition:all .2s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; box-shadow:0 1px 3px rgba(0,0,0,.03); }
.dr-template-card:active { border-color:var(--primary); transform:scale(.98); }
.dr-template-cat { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--primary); margin-bottom:5px; }
.dr-template-title { font-size:14px; font-weight:700; color:var(--text-1); margin-bottom:5px; }
.dr-template-preview { font-size:12px; color:var(--text-3); line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.dr-template-actions { display:flex; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-color); }
.dr-template-btn { flex:1; padding:8px 0; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-2); font-size:12px; font-weight:600; color:var(--text-2); cursor:pointer; text-align:center; min-height:36px; -webkit-tap-highlight-color:transparent; touch-action:manipulation; transition:all .15s; }
.dr-template-btn:active { transform:scale(.96); }
.dr-template-btn.primary { border-color:rgba(79,70,229,.2); background:rgba(79,70,229,.06); color:var(--primary); }
.dr-template-btn.danger { border-color:rgba(220,38,38,.12); background:rgba(220,38,38,.03); color:#DC2626; }

/* ═══ FULL-SCREEN WRITING MODAL ═══ */
.dr-modal { display:flex; flex-direction:column; height:100%; }
.dr-modal-title { font-size:20px; font-weight:800; color:var(--text-1); letter-spacing:-.4px; margin-bottom:18px; }

/* Mood Section */
.dr-mood-section { margin-bottom:16px; }
.dr-mood-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--text-3); margin-bottom:10px; display:block; }
.dr-mood-slider-row { display:flex; align-items:center; gap:16px; }
.dr-mood-display { display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0; min-width:48px; }
.dr-mood-emoji { font-size:32px; line-height:1; transition:transform .15s; }
.dr-mood-num { font-size:14px; font-weight:800; color:var(--primary); }
.dr-mood-slider { flex:1; -webkit-appearance:none; height:6px; border-radius:99px; background:linear-gradient(90deg, #EF4444, #F59E0B, #10B981); outline:none; touch-action:manipulation; }
.dr-mood-slider::-webkit-slider-thumb { -webkit-appearance:none; width:28px; height:28px; border-radius:50%; background:white; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.15), 0 4px 12px rgba(0,0,0,.1); border:2px solid var(--primary); transition:transform .15s; }
.dr-mood-slider::-webkit-slider-thumb:active { transform:scale(1.15); }
.dr-mood-labels { display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:var(--text-3); font-weight:600; }

/* Toolbar */
.dr-toolbar { display:flex; align-items:center; gap:2px; padding:8px 12px; background:var(--surface-2); border-radius:12px 12px 0 0; border:1.5px solid var(--border-color); border-bottom:none; }
.dr-toolbar-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:10px; border:none; background:transparent; color:var(--text-2); font-size:14px; font-weight:700; cursor:pointer; transition:all .15s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.dr-toolbar-btn:active { background:var(--surface-3); transform:scale(.92); }
.dr-toolbar-btn.recording { color:#EF4444 !important; background:rgba(239, 68, 68, 0.1) !important; animation:pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
.dr-toolbar-ai { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:10px; border:1px solid rgba(79,70,229,.15); background:rgba(79,70,229,.05); font-size:12px; font-weight:700; color:var(--primary); cursor:pointer; margin-left:auto; white-space:nowrap; -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:36px; transition:all .15s; }
.dr-toolbar-ai:active { background:rgba(79,70,229,.12); transform:scale(.96); }

/* Editor — THE KEY AREA: generous space for writing */
.dr-editor { flex:1; min-height:200px; max-height:none; overflow-y:auto; background:var(--surface-1); border:1.5px solid var(--border-color); border-top:none; border-radius:0 0 12px 12px; padding:16px 18px; font-size:16px; color:var(--text-1); line-height:1.75; outline:none; -webkit-overflow-scrolling:touch; letter-spacing:-.1px; }
.dr-editor:focus { border-color:var(--primary); }
.dr-editor[placeholder]:empty::before { content:attr(placeholder); color:var(--text-3); pointer-events:none; font-style:italic; }

/* Fields */
.dr-field-row { display:flex; gap:8px; margin-top:12px; }
.dr-field { flex:1; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:12px; padding:12px 14px; font-size:14px; color:var(--text-1); outline:none; transition:border-color .2s; min-height:44px; -webkit-tap-highlight-color:transparent; }
.dr-field:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.08); }
.dr-word-count { font-size:12px; color:var(--text-3); font-weight:500; text-align:right; margin-top:6px; }
.dr-context-bar { display:flex; flex-wrap:wrap; gap:6px; padding:10px 0; margin-bottom:4px; }
.dr-context-chip { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:99px; font-size:12px; font-weight:600; background:rgba(5,150,105,.06); color:var(--success,#059669); border:1px solid rgba(5,150,105,.12); }
.dr-template-select { width:100%; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:12px; padding:12px 14px; font-size:14px; color:var(--text-1); outline:none; cursor:pointer; margin-bottom:14px; min-height:44px; -webkit-tap-highlight-color:transparent; -webkit-appearance:none; }

/* Modal Actions */
.dr-modal-actions { display:flex; gap:10px; padding-top:18px; border-top:1px solid var(--border-color); margin-top:auto; flex-shrink:0; }
.dr-modal-save { flex:1; padding:14px; border-radius:14px; border:none; background:var(--primary); color:#fff; font-size:15px; font-weight:700; cursor:pointer; transition:all .2s; box-shadow:0 2px 8px rgba(79,70,229,.25); -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:48px; }
.dr-modal-save:active { opacity:.85; transform:scale(.98); }
.dr-modal-cancel { padding:14px 20px; border-radius:14px; border:1.5px solid var(--border-color); background:transparent; color:var(--text-2); font-size:14px; font-weight:600; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:48px; transition:all .15s; }
.dr-modal-cancel:active { background:var(--surface-2); }

/* ═══ REDESIGNED WRITE MODAL ═══ */
.dr-modal-bar { display:flex; align-items:center; justify-content:space-between; padding-bottom:16px; border-bottom:1px solid var(--border-color); margin-bottom:16px; }
.dr-modal-dismiss { font-size:14px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; padding:8px 0; min-height:44px; display:flex; align-items:center; -webkit-tap-highlight-color:transparent; }
.dr-modal-save-top { padding:10px 22px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; transition:all .15s; min-height:44px; box-shadow:0 2px 6px rgba(79,70,229,.2); -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.dr-modal-save-top:active { opacity:.85; transform:scale(.97); }
.dr-modal-date-chip { font-size:13px; font-weight:700; color:var(--text-2); background:var(--surface-2); padding:7px 14px; border-radius:99px; border:1px solid var(--border-color); cursor:pointer; min-height:36px; display:inline-flex; align-items:center; -webkit-tap-highlight-color:transparent; }
.dr-mood-strip { display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--surface-2); border-radius:14px; margin-bottom:14px; border:1px solid var(--border-color); }
.dr-mood-big-emoji { font-size:28px; line-height:1; flex-shrink:0; }
.dr-mood-big-num { font-size:18px; font-weight:800; color:var(--primary); min-width:26px; text-align:right; flex-shrink:0; }
.dr-mood-slider-col { flex:1; display:flex; flex-direction:column; gap:4px; }
.dr-mood-ends { display:flex; justify-content:space-between; font-size:10px; color:var(--text-3); font-weight:600; margin-top:3px; }
.dr-write-zone { border-radius:14px; overflow:hidden; border:1.5px solid var(--border-color); margin-bottom:12px; transition:border-color .2s; flex:1; display:flex; flex-direction:column; }
.dr-write-zone:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.06); }
.dr-zone-toolbar { display:flex; align-items:center; gap:2px; padding:6px 10px; border-bottom:1px solid var(--border-color); background:var(--surface-2); flex-shrink:0; }
.dr-zone-toolbar .dr-toolbar-btn { width:36px; height:32px; font-size:14px; }
.dr-zone-editor { flex:1; min-height:220px; max-height:none; overflow-y:auto; background:var(--surface-1); padding:16px 18px; font-size:16px; color:var(--text-1); line-height:1.75; outline:none; -webkit-overflow-scrolling:touch; letter-spacing:-.1px; }
.dr-zone-editor[placeholder]:empty::before { content:attr(placeholder); color:var(--text-3); pointer-events:none; font-style:italic; }
.dr-zone-footer { display:flex; align-items:center; gap:10px; padding:10px 14px; border-top:1px solid var(--border-color); background:var(--surface-2); flex-shrink:0; }
.dr-zone-tags { flex:1; background:transparent; border:none; outline:none; font-size:13px; color:var(--text-2); min-width:0; min-height:36px; padding:4px 0; }
.dr-zone-tags::placeholder { color:var(--text-3); }
.dr-zone-wc { font-size:12px; color:var(--text-3); font-weight:500; white-space:nowrap; flex-shrink:0; }
.dr-context-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }

/* ═══ MODAL BOX OVERRIDE — Full writing space ═══ */
.modal-box:has(.dr-modal) { max-height:calc(100vh - 40px) !important; height:calc(100vh - 40px) !important; max-width:640px !important; display:flex !important; flex-direction:column !important; border-radius:20px !important; padding:20px !important; overflow:hidden !important; }
.modal-box:has(.dr-modal)::before { display:none !important; }
@media (max-width:768px) {
  .modal-box:has(.dr-modal) { max-height:100vh !important; height:100vh !important; max-width:100% !important; width:100% !important; border-radius:0 !important; margin:0 !important; padding:20px !important; padding-top:calc(20px + env(safe-area-inset-top,0px)) !important; padding-bottom:calc(20px + env(safe-area-inset-bottom,0px)) !important; }
}

/* Context chips — color-coded by type, clearer labels */
.dr-context-chip.is-task  { background:rgba(5,150,105,.07);  color:#059669;        border-color:rgba(5,150,105,.16); }
.dr-context-chip.is-habit { background:rgba(79,70,229,.07);  color:var(--primary); border-color:rgba(79,70,229,.16); }
.dr-context-chip.is-spend { background:rgba(217,119,6,.09);  color:#B45309;        border-color:rgba(217,119,6,.18); }

/* Meta wrapper — transparent on mobile (children stack exactly as before),
   becomes the right rail on desktop. */
.dr-side { display:contents; }

/* ═══ DESKTOP: two-column writer (editor + meta rail) ═══ */
@media (min-width:769px) {
  .modal-box:has(.dr-modal) { max-width:940px !important; }
  .dr-modal { display:grid; grid-template-columns:minmax(0,1fr) 300px; grid-template-rows:auto minmax(0,1fr); column-gap:22px; }
  .dr-modal-bar { grid-column:1 / -1; }
  .dr-write-zone { grid-column:1; grid-row:2; margin-bottom:0; min-height:0; }
  .dr-side { display:flex; flex-direction:column; gap:14px; grid-column:2; grid-row:2; align-self:start; }
  .dr-side > * { margin-bottom:0 !important; }
  .dr-side-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--text-3); margin:2px 0 -4px; }
}
/* The little rail labels only make sense in the desktop rail */
.dr-side-label { display:none; }
@media (min-width:769px){ .dr-side-label { display:block; } }

/* ═══ STAGGERED CARD ANIMATIONS ═══ */
.dr-entry-card:nth-child(1) { animation-delay:.02s; }
.dr-entry-card:nth-child(2) { animation-delay:.06s; }
.dr-entry-card:nth-child(3) { animation-delay:.1s; }
.dr-entry-card:nth-child(4) { animation-delay:.14s; }
.dr-entry-card:nth-child(5) { animation-delay:.18s; }
.dr-entry-card:nth-child(6) { animation-delay:.22s; }
.dr-entry-card:nth-child(7) { animation-delay:.26s; }
.dr-entry-card:nth-child(8) { animation-delay:.3s; }

/* ═══ RESPONSIVE MOBILE REFINEMENTS ═══ */
@media (max-width:480px) {
  .dr-header { padding:16px 16px 12px; }
  .dr-greeting { font-size:22px; }
  .dr-stats-strip { margin:0 16px 12px; padding:16px 14px; }
  .dr-stat-n { font-size:24px; }
  .dr-stat-l { font-size:9px; letter-spacing:.5px; }
  .dr-overview-row { padding:0 16px 12px; }
  .dr-tabs { padding:0 16px; }
  .dr-tab { padding:10px 12px; font-size:13px; }
  .dr-entries { padding:12px 16px 16px; }
  .dr-search-bar { padding:8px 16px; }
  .dr-months-grid { grid-template-columns:repeat(2,1fr); }
  .dr-templates-grid { grid-template-columns:1fr; }
  .dr-entry-preview { font-size:14px; -webkit-line-clamp:2; }
}

/* ════════════════════════════════════════════════════════════════════
   STRIPE / MERCURY DESKTOP REFINEMENT — scoped to .dr-pro (Diary only).
   ════════════════════════════════════════════════════════════════════ */
.dr-pro { max-width:1240px; margin:0 auto; }
.dr-pro .dr-greeting { display:none; }                 /* "Diary" page title already labels the view */
.dr-pro .dr-header { justify-content:flex-end; padding:8px 20px 10px; }
.dr-pro .dr-stats-strip { padding:12px 18px; margin:0 20px 10px; }
.dr-pro .dr-overview-row { padding:0 20px 10px; }
.dr-pro .dr-overview-card { padding:10px 14px; }
.dr-pro .dr-week-dots { margin-bottom:6px; }
.dr-pro .dr-write-btn { border-radius:9px; box-shadow:var(--shadow-xs); }
.dr-pro .dr-write-btn:hover { filter:brightness(.97); transform:translateY(-1px); box-shadow:var(--shadow-md); }
.dr-pro .dr-stats-strip { border-radius:14px; box-shadow:var(--shadow-card); }
.dr-pro .dr-overview-card { border-radius:14px; box-shadow:var(--shadow-card); }
.dr-pro .dr-entry-card { border-left-width:3px; border-radius:12px; box-shadow:var(--shadow-card); transition:box-shadow .16s ease, transform .16s ease, border-color .16s ease; }
.dr-pro .dr-entry-card:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
.dr-pro .dr-entry-card:active { transform:translateY(0); }

/* Two-pane List: entries (left) + insights rail (right) */
/* Independent scroll: entries scroll on the left, the insights rail scrolls on the
   right — so the rail's lower cards (e.g. Top Tags) are always reachable. */
.dr-pro .dr-body-split { display:flex; gap:20px; align-items:stretch; overflow:hidden; }
.dr-pro .dr-list-main { flex:1; min-width:0; min-height:0; overflow-y:auto; padding-right:6px; padding-bottom:20px; }
.dr-pro .dr-rail { flex:0 0 300px; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-bottom:20px; }
.dr-pro .drr-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:15px; }
.dr-pro .drr-h { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); font-weight:700; margin:0 0 12px; }
.dr-pro .drr-mood { display:flex; align-items:flex-end; gap:4px; height:54px; }
.dr-pro .drr-bar { flex:1; border-radius:3px 3px 0 0; min-height:4px; }
.dr-pro .drr-mavg { display:flex; align-items:baseline; gap:6px; margin-top:10px; }
.dr-pro .drr-mavg b { font-size:20px; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; }
.dr-pro .drr-mavg span { font-size:12px; color:var(--text-3); }
.dr-pro .drr-month { display:flex; align-items:baseline; gap:8px; }
.dr-pro .drr-month b { font-size:26px; font-weight:700; color:var(--text-1); letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.dr-pro .drr-month span { font-size:12.5px; color:var(--text-3); }
.dr-pro .drr-tags { display:flex; flex-wrap:wrap; gap:6px; }
.dr-pro .drr-tag { font-size:12px; padding:4px 10px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-2); cursor:pointer; }
.dr-pro .drr-tag:hover { border-color:var(--primary); color:var(--primary); background:var(--primary-soft); }
.dr-pro .drr-tag b { color:var(--text-3); font-weight:600; margin-left:3px; }
.dr-pro .drr-empty { font-size:12.5px; color:var(--text-3); }

/* Tablet/phone: single column, no rail (mobile layout untouched) */
@media (max-width:1023px){
  .dr-pro { max-width:none; }
  .dr-pro .dr-body-split { display:block; }
  .dr-pro .dr-rail { display:none; }
}
</style>`;

  if (_drIsPhone()) {
    document.getElementById('main').innerHTML = DIARY_CSS + DRP_CSS + renderDiaryPhoneHTML(entries, sorted, streak);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    return;
  }

  document.getElementById('main').innerHTML = `
    ${DIARY_CSS}
    <div class="dr-shell dr-pro">

      <!-- Header action ("New Entry") lives in the app header bar (#pageActions),
           inline with the "Diary" page title — see main.js view-switch logic. -->

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
      <div class="dr-body ${currentDiaryView === 'list' ? 'dr-body-split' : ''}">
        ${currentDiaryView === 'list' ? `<div class="dr-list-main">${renderListView(sorted)}</div><aside class="dr-rail">${renderDiaryRail(entries)}</aside>` : ''}
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

// Local YYYY-MM-DD (NEVER UTC). Using toISOString() shifts the date by a day for
// any user not on UTC (e.g. an evening entry got tomorrow's date), which made
// today's entry light up the NEXT day's dot. Pass a Date object or nothing (= now);
// do NOT pass a "YYYY-MM-DD" string (that would re-parse as UTC and shift again).
function diaryLocalDate(d) {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    const dateStr = diaryLocalDate(day);
    const entry = entries.find(e => e.date === dateStr);
    const isToday = dateStr === diaryLocalDate(today);

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
  const moodVal = _drMood(entry);
  const score = moodVal != null ? moodVal : 5;
  const wordCount = entry.content ? _drStripMd(entry.content).split(/\s+/).filter(Boolean).length : 0;
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
    <div class="dr-entry-card" style="border-left-color:${moodVal != null ? moodColor : 'var(--border-color)'}" onclick="openEditDiary('${entry.id}')">
      <div class="dr-entry-main">
        <div class="dr-entry-date">${dateStr}</div>
        <p class="dr-entry-preview">${_drStripMd(entry.content).substring(0, 200)}</p>
      </div>
      ${hasTags ? `
        <div class="dr-entry-tags-row">
          ${tags.slice(0, 4).map(tag => `<span class="dr-entry-tag">#${tag}</span>`).join('')}
          ${tags.length > 4 ? `<span class="dr-entry-tag">+${tags.length - 4}</span>` : ''}
        </div>
      ` : ''}
      <div class="dr-entry-foot">
        <div class="dr-entry-foot-left">
          ${moodVal != null ? `<span class="dr-mood-pill" style="background:${moodBg};color:${moodColor}">${getMoodEmoji(score)} ${score}/10</span>` : ''}
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

  if (dateStr === diaryLocalDate(today)) return 'Today';
  if (dateStr === diaryLocalDate(yesterday)) return 'Yesterday';

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
    const preview = _drStripMd(entry.content).substring(0, 200);
    const tags = entry.tags ? entry.tags.split(/[,\s]+/).filter(t => t).slice(0, 3) : [];

    return `
          <div class="timeline-entry" style="border-left-color:${moodColor}; background:${moodBg}; animation-delay:${i * 0.05}s;">
            <div class="timeline-entry-date">${dateStr}</div>
            <div class="timeline-entry-text">${preview}${(entry.content || '').length > 200 ? '...' : ''}</div>
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
      isToday: dateStr === diaryLocalDate(today)
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
      const isToday = dateStr === diaryLocalDate(today);
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

  const totalWords = entries.reduce((acc, e) => acc + (e.content ? e.content.split(/\s+/).length : 0), 0);

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
      (e.content && e.content.toLowerCase().includes(query)) ||
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
  const today = diaryLocalDate();
  const yesterday = diaryLocalDate(new Date(Date.now() - 86400000));

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let currentDate = dates[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (const dateStr of dates) {
    const entryDate = dateStr; // already YYYY-MM-DD; don't re-parse (would shift via UTC)
    const checkDate = diaryLocalDate(currentDate);

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
  const defaultDate = dateStr || diaryLocalDate();

  // Get settings
  const settings = state.data.settings?.[0] || {};
  const defaultMood = settings.diary_default_mood || '5';
  const showTasks = settings.diary_show_tasks !== false;
  const showHabits = settings.diary_show_habits !== false;
  const showExpenses = settings.diary_show_expenses !== false;

  const templates = state.data.diary_templates || [];
  const contextData = getContextData(defaultDate);
  const ex = drpEditorExtrasHTML(null, false);

  box.innerHTML = `
    <div class="dr-modal">
      <!-- Top Bar: Cancel / Date / Save -->
      <div class="dr-modal-bar">
        <button class="dr-modal-dismiss" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <input type="date" class="dr-modal-date-chip" id="mDiaryDate" value="${defaultDate}">
        <button class="dr-modal-save-top" data-action="save-diary-modal">Save</button>
      </div>

      <div class="dr-side">
        ${ex.moods}
        ${ex.prompt}
        ${templates.length > 0 ? `
        <select class="dr-template-select" id="templateSelect" onchange="loadTemplateInModal(this.value)">
          <option value="">Use a template...</option>
          ${templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
        </select>
        ` : ''}

        ${((showTasks && contextData.tasks?.length) || (showHabits && contextData.habits?.length) || (showExpenses && contextData.expenses > 0)) ? `
        <div class="dr-side-label">Today</div>
        <div class="dr-context-chips">
          ${showTasks && contextData.tasks?.length ? `<span class="dr-context-chip is-task">✓ ${contextData.tasks.length} task${contextData.tasks.length > 1 ? 's' : ''} done</span>` : ''}
          ${showHabits && contextData.habits?.length ? `<span class="dr-context-chip is-habit">◎ ${contextData.habits.length} habit${contextData.habits.length > 1 ? 's' : ''}</span>` : ''}
          ${showExpenses && contextData.expenses > 0 ? `<span class="dr-context-chip is-spend">💸 ₹${(contextData.expenses || 0).toFixed(2)} spent</span>` : ''}
        </div>` : ''}

        <div class="dr-side-label">Mood</div>
        <!-- Compact Mood Strip -->
        <div class="dr-mood-strip">
          <span id="moodEmoji" class="dr-mood-big-emoji">${getMoodEmoji(defaultMood)}</span>
          <div class="dr-mood-slider-col">
            <input type="range" min="1" max="10" value="${defaultMood}" class="mood-slider dr-mood-slider" id="mMoodScore"
              oninput="updateMoodDisplay(this.value)">
            <div class="dr-mood-ends"><span>Awful</span><span>Amazing</span></div>
          </div>
          <span id="moodVal" class="dr-mood-big-num">${defaultMood}</span>
        </div>
      </div>

      <!-- Write Zone — Full Space Editor -->
      <div class="dr-write-zone">
        <div class="dr-zone-toolbar">
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('bold')" title="Bold"><b>B</b></button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('italic')" title="Italic"><i>I</i></button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertUnorderedList')" title="Bullet List">•</button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertOrderedList')" title="Numbered List">1.</button>
          <button type="button" class="dr-toolbar-ai" onmousedown="event.preventDefault();" onclick="insertDiarySummary('${defaultDate}')" title="Auto-Summarize Day">
            ✨ Summary
          </button>
          <button type="button" class="dr-toolbar-btn" id="speechBtn" onmousedown="event.preventDefault();" onclick="toggleSpeechToText()" title="Speak to Write" style="margin-left:8px">
            <i data-lucide="mic" style="width:16px;height:16px"></i>
          </button>
        </div>
        <div class="rich-editor dr-zone-editor" id="mDiaryText" contenteditable="true"
             placeholder="${_drIsPhone() ? 'Write freely — one line is enough.' : "What's on your mind..."}">${templateContent}</div>
        <div class="dr-zone-footer">
          <input class="dr-zone-tags" id="mDiaryTags" placeholder="#tags (comma separated)">
          <span class="dr-zone-wc" id="diaryWordCount">0 words</span>
        </div>
      </div>
      ${ex.tags}
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
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
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
  const score = _drMood(e) != null ? _drMood(e) : 5;
  const ex = drpEditorExtrasHTML(_drMood(e), true);

  box.innerHTML = `
    <div class="dr-modal">
      <!-- Top Bar: Cancel / Date / Update -->
      <div class="dr-modal-bar">
        <button class="dr-modal-dismiss" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <input type="date" class="dr-modal-date-chip" id="mDiaryDate" value="${(e.date || '').slice(0, 10)}">
        <button class="dr-modal-save-top" data-action="update-diary-modal" data-edit-id="${e.id}">Update</button>
      </div>

      <div class="dr-side">
        ${ex.moods}
        <div class="dr-side-label">Mood</div>
        <!-- Compact Mood Strip -->
        <div class="dr-mood-strip">
          <span id="moodEmoji" class="dr-mood-big-emoji">${getMoodEmoji(score)}</span>
          <div class="dr-mood-slider-col">
            <input type="range" min="1" max="10" value="${score}" class="mood-slider dr-mood-slider" id="mMoodScore"
              oninput="updateMoodDisplay(this.value)">
            <div class="dr-mood-ends"><span>Awful</span><span>Amazing</span></div>
          </div>
          <span id="moodVal" class="dr-mood-big-num">${score}</span>
        </div>
      </div>

      <!-- Write Zone — Full Space Editor -->
      <div class="dr-write-zone">
        <div class="dr-zone-toolbar">
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('bold')" title="Bold"><b>B</b></button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('italic')" title="Italic"><i>I</i></button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertUnorderedList')" title="Bullet List">•</button>
          <button type="button" class="dr-toolbar-btn" onmousedown="event.preventDefault();" onclick="formatText('insertOrderedList')" title="Numbered List">1.</button>
          <button type="button" class="dr-toolbar-ai" onmousedown="event.preventDefault();" onclick="insertDiarySummary('${(e.date || '').slice(0, 10)}')" title="Auto-Summarize Day">
            ✨ Summary
          </button>
          <button type="button" class="dr-toolbar-btn" id="speechBtn" onmousedown="event.preventDefault();" onclick="toggleSpeechToText()" title="Speak to Write" style="margin-left:8px">
            <i data-lucide="mic" style="width:16px;height:16px"></i>
          </button>
        </div>
        <div class="rich-editor dr-zone-editor" id="mDiaryText" contenteditable="true">${(e.content || '').replace(/</g, '<')}</div>
        <div class="dr-zone-footer">
          <input class="dr-zone-tags" id="mDiaryTags" value="${(e.tags || '')}" placeholder="#tags (comma separated)">
          <span class="dr-zone-wc" id="diaryWordCount">${e.content ? e.content.split(/\s+/).length : 0} words</span>
        </div>
      </div>
      ${ex.tags}
      <button type="button" class="drp-ed-del" onclick="document.getElementById('universalModal').classList.add('hidden'); deleteEntry('${e.id}')">Delete entry</button>
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
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

function getContextData(dateStr) {
  const context = {};
  const tasks = state.data.tasks || [];
  context.tasks = tasks.filter(t => (t.due_date || '').startsWith(dateStr) && t.status === 'completed');

  const habits = state.data.habit_logs || [];
  context.habits = habits.filter(h => (h.date || '').startsWith(dateStr));

  const expenses = state.data.expenses || [];
  const dayExpenses = expenses.filter(e => (e.type || 'expense') === 'expense' && (e.date || '').startsWith(dateStr));
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

let _recognition = null;
window.toggleSpeechToText = function() {
  const btn = document.getElementById('speechBtn');
  const editor = document.getElementById('mDiaryText');
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast("Speech recognition not supported in this browser.");
    return;
  }

  if (_recognition) {
    _recognition.stop();
    return;
  }

  _recognition = new SpeechRecognition();
  _recognition.continuous = true;
  _recognition.interimResults = false;
  _recognition.lang = 'en-US';

  _recognition.onstart = () => {
    btn.classList.add('recording');
    showToast("Listening...");
  };

  _recognition.onend = () => {
    btn.classList.remove('recording');
    _recognition = null;
  };

  _recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    btn.classList.remove('recording');
    _recognition = null;
    showToast("Speech recognition error: " + event.error);
  };

  _recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    
    if (finalTranscript) {
      insertAtCursor(editor, finalTranscript + ' ');
    }
  };

  _recognition.start();
};

function insertAtCursor(editor, text) {
  editor.focus();
  const selection = window.getSelection();
  if (selection.getRangeAt && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Trigger input event to update word count
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // If editor is empty or cursor not found
    const currentText = editor.innerText;
    editor.innerText = currentText + (currentText.length > 0 && !currentText.endsWith(' ') ? ' ' : '') + text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

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
      text: e.content
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

/* ═══ PHONE JOURNAL ═════════════════════════════════════════════════════════
   Under 769px the journal gets its own layout: a "Today" card that starts an
   entry with one tap (pick a mood face, or Write / Speak), a mood-coloured
   week strip, compact stats, pill tabs and month-grouped entry cards. Search
   sits behind an icon instead of a bar that fights the bottom navigation.
   The writing screen goes full screen with mood faces, a prompt and sentence
   starters you can tap in. Desktop keeps its own layout. */

const DRP_MOODS = [
  { v: 2, e: '😢', l: 'Awful', c: '#EF4444' },
  { v: 4, e: '😕', l: 'Low', c: '#F97316' },
  { v: 6, e: '😐', l: 'Okay', c: '#EAB308' },
  { v: 8, e: '🙂', l: 'Good', c: '#22C55E' },
  { v: 10, e: '😄', l: 'Great', c: '#10B981' },
];
const DRP_STARTERS = [
  "Today I'm proud that ",
  'I kept thinking about ',
  "I'm grateful for ",
  'What drained me today was ',
  'Tomorrow will be good if ',
  'One thing I learned: ',
];
let _drpSearchOpen = false;
let _drpPromptIdx = null;

function _drIsPhone() { try { return window.matchMedia('(max-width: 768px)').matches; } catch (e) { return false; } }
function _drpEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function _drpFace(score) {
  if (score == null) return null;
  return DRP_MOODS.reduce((best, m) => Math.abs(m.v - score) < Math.abs(best.v - score) ? m : best, DRP_MOODS[0]);
}
function _drpParse(dateStr) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(dateStr); }
function _drpPrompts() {
  // The rotating daily prompt first, then a few that make you look at the day.
  const base = getDailyPrompt();
  return [base, 'What gave you energy today, and what took it?', 'What would you do differently if today happened again?',
    'What are you avoiding right now?', 'Who made your day better?', 'What small win deserves credit?', 'What is one worry you can let go of?'];
}
function _drpPrompt() {
  const list = _drpPrompts();
  if (_drpPromptIdx == null) _drpPromptIdx = 0;
  return list[_drpPromptIdx % list.length];
}

function renderDiaryPhoneHTML(entries, sorted, streak) {
  const todayStr = diaryLocalDate();
  const todayEntry = entries.find(e => (e.date || '').slice(0, 10) === todayStr);
  const now = new Date();
  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'long' }) + ' · ' + now.getDate() + ' ' + now.toLocaleDateString('en-US', { month: 'short' });
  const name = (state.data.settings && state.data.settings[0] && state.data.settings[0].name) || '';

  // ── Today card ──
  let todayCard;
  if (todayEntry) {
    const f = _drpFace(_drMood(todayEntry));
    const txt = _drStripMd(todayEntry.content);
    todayCard = `
    <section class="drp-today done" onclick="openEditDiary('${todayEntry.id}')">
      <div class="drp-today-top"><span>${_drpEsc(dayLabel)}</span><span class="drp-done-pill">✓ Written today</span></div>
      <div class="drp-today-entry">
        ${f ? `<span class="drp-today-face" style="--c:${f.c}">${f.e}</span>` : ''}
        <p>${_drpEsc(txt.slice(0, 160))}${txt.length > 160 ? '…' : ''}</p>
      </div>
      <button class="drp-btn ghost" onclick="event.stopPropagation(); openEditDiary('${todayEntry.id}')">Continue writing</button>
    </section>`;
  } else {
    todayCard = `
    <section class="drp-today">
      <div class="drp-today-top"><span>${_drpEsc(dayLabel)}</span><span>${_drpEsc(getGreeting())}${name ? ', ' + _drpEsc(String(name).split(' ')[0]) : ''}</span></div>
      <h2 class="drp-prompt">${_drpEsc(_drpPrompt())}</h2>
      <div class="drp-faces" role="group" aria-label="How was today?">
        ${DRP_MOODS.map(m => `<button class="drp-face" style="--c:${m.c}" onclick="drpStart(${m.v})" aria-label="${m.l}"><span>${m.e}</span><em>${m.l}</em></button>`).join('')}
      </div>
      <div class="drp-today-acts">
        <button class="drp-btn primary" onclick="drpStart()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Write</button>
        <button class="drp-btn" onclick="drpStart(null, true)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></svg> Speak</button>
      </div>
    </section>`;
  }

  // ── Stats ──
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));   // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const written = weekDays.filter(d => entries.some(e => (e.date || '').slice(0, 10) === diaryLocalDate(d))).length;
  const since = new Date(now); since.setDate(since.getDate() - 30);
  const recentMoods = entries.filter(e => _drpParse(e.date) >= since).map(_drMood).filter(v => v != null);
  const avg = recentMoods.length ? recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length : null;
  const avgFace = _drpFace(avg);
  const stats = `
    <div class="drp-stats">
      <div class="drp-stat"><b>🔥 ${streak}</b><span>day streak</span></div>
      <div class="drp-stat"><b>${written}<small>/7</small></b><span>this week</span></div>
      <div class="drp-stat"><b>${avgFace ? avgFace.e + ' ' : ''}${avg != null ? avg.toFixed(1) : '—'}</b><span>mood · 30d</span></div>
    </div>`;

  // ── Week strip ──
  const week = `
    <div class="drp-week">
      ${weekDays.map(d => {
        const ds = diaryLocalDate(d);
        const e = entries.find(x => (x.date || '').slice(0, 10) === ds);
        const f = e ? _drpFace(_drMood(e)) : null;
        const isToday = ds === todayStr, future = d > now;
        return `<button class="drp-day ${isToday ? 'today' : ''} ${e ? 'has' : ''} ${future ? 'future' : ''}" ${future ? 'disabled' : ''}
                  onclick="${e ? `openEditDiary('${e.id}')` : `drpStart(null, false, '${ds}')`}">
          <em>${d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</em>
          <span class="drp-day-dot" style="${f ? `--c:${f.c}` : ''}">${f ? f.e : (e ? '•' : d.getDate())}</span>
        </button>`;
      }).join('')}
    </div>`;

  // ── Tabs + search ──
  const tabs = [['list', 'Entries'], ['calendar', 'Calendar'], ['insights', 'Insights'], ['yearly', 'Year'], ['tags', 'Tags']];
  const tabBar = `
    <div class="drp-tabsrow">
      <div class="drp-tabs">${tabs.map(([k, l]) => `<button class="${currentDiaryView === k ? 'on' : ''}" onclick="switchDiaryView('${k}')">${l}</button>`).join('')}</div>
      ${currentDiaryView === 'list' ? `<button class="drp-iconbtn ${_drpSearchOpen || currentSearchQuery ? 'on' : ''}" onclick="drpToggleSearch()" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>` : ''}
    </div>
    ${currentDiaryView === 'list' && (_drpSearchOpen || currentSearchQuery || currentDateFilter !== 'all') ? `
    <div class="drp-search">
      <div class="drp-search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="drpSearch" value="${_drpEsc(currentSearchQuery)}" placeholder="Search your journal" oninput="drpSearchInput(this.value)" autocomplete="off">
        ${currentSearchQuery ? `<button onclick="handleDiarySearch('')" aria-label="Clear">×</button>` : ''}
      </div>
      <div class="drp-chips">
        ${[['all', 'All time'], ['week', 'This week'], ['last7', 'Last 7 days'], ['month', 'This month']].map(([k, l]) => `<button class="${currentDateFilter === k ? 'on' : ''}" onclick="handleDateFilter('${k}')">${l}</button>`).join('')}
      </div>
    </div>` : ''}`;

  // ── Body ──
  let body = '';
  if (currentDiaryView === 'list') body = _drpListHTML(sorted);
  else if (currentDiaryView === 'calendar') body = renderCalendarView(entries);
  else if (currentDiaryView === 'yearly') body = renderYearlyView(entries);
  else if (currentDiaryView === 'insights') body = renderInsightsView(entries);
  else if (currentDiaryView === 'tags') body = renderTagsView();

  return `<div class="drp">${todayCard}${stats}${week}${tabBar}<div class="drp-body drp-view-${currentDiaryView}">${body}</div></div>`;
}

function _drpListHTML(sorted) {
  if (!sorted.length) {
    return `<div class="drp-empty"><div>📖</div><b>${currentSearchQuery || currentDateFilter !== 'all' ? 'Nothing matches' : 'Your journal starts today'}</b>
      <span>${currentSearchQuery || currentDateFilter !== 'all' ? 'Try another word or time range.' : 'Tap a mood above — one line is enough.'}</span></div>`;
  }
  let out = '', month = '';
  sorted.forEach(e => {
    const d = _drpParse(e.date);
    const m = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (m !== month) {
      const n = sorted.filter(x => _drpParse(x.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === m).length;
      out += `<div class="drp-month"><b>${m}</b><span>${n} ${n === 1 ? 'entry' : 'entries'}</span></div>`;
      month = m;
    }
    out += _drpCardHTML(e, d);
  });
  return `<div class="drp-list">${out}</div>`;
}

function _drpCardHTML(e, d) {
  const f = _drpFace(_drMood(e));
  const txt = _drStripMd(e.content);
  const firstStop = txt.search(/[.!?](\s|$)/);
  const title = firstStop > 8 && firstStop < 90 ? txt.slice(0, firstStop + 1) : (txt.length > 70 ? txt.slice(0, 70).replace(/\s+\S*$/, '') + '…' : txt);
  const rest = txt.slice(title.replace(/…$/, '').length).trim();
  const words = txt ? txt.split(/\s+/).length : 0;
  const tags = String(e.tags || '').split(/[,\s]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean);
  const isToday = (e.date || '').slice(0, 10) === diaryLocalDate();
  return `
    <article class="drp-card" onclick="openEditDiary('${e.id}')" style="${f ? `--c:${f.c}` : ''}">
      <div class="drp-date ${isToday ? 'today' : ''}"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-US', { weekday: 'short' })}</span></div>
      <div class="drp-card-main">
        <div class="drp-card-top">
          <h3>${_drpEsc(title || 'Untitled')}</h3>
          ${f ? `<span class="drp-mood" title="${_drMood(e)}/10">${f.e}</span>` : ''}
        </div>
        ${rest ? `<p>${_drpEsc(rest.slice(0, 160))}</p>` : ''}
        <div class="drp-card-meta">
          ${tags.slice(0, 3).map(t => `<span class="drp-tag">#${_drpEsc(t)}</span>`).join('')}
          ${tags.length > 3 ? `<span class="drp-tag">+${tags.length - 3}</span>` : ''}
          <span class="drp-words">${words} word${words === 1 ? '' : 's'}</span>
        </div>
      </div>
    </article>`;
}

window.drpToggleSearch = function () {
  _drpSearchOpen = !_drpSearchOpen;
  if (!_drpSearchOpen) { currentSearchQuery = ''; currentDateFilter = 'all'; }
  renderDiary();
  if (_drpSearchOpen) setTimeout(() => document.getElementById('drpSearch')?.focus(), 30);
};
let _drpSearchT = 0;
window.drpSearchInput = function (v) {
  clearTimeout(_drpSearchT);
  _drpSearchT = setTimeout(() => {
    handleDiarySearch(v);
    const el = document.getElementById('drpSearch');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 250);
};

// Start an entry: optional mood preset, optional "speak" (opens the mic), optional date.
window.drpStart = function (mood, speak, dateStr) {
  if (_drIsPhone()) {
    openDiaryChat(dateStr || undefined, mood);
    if (speak) setTimeout(() => { try { drcMic(); } catch (e) { } }, 300);
    return;
  }
  openDiaryModal(dateStr || undefined);
  if (mood != null) drpSetMood(mood);
  if (speak && typeof toggleSpeechToText === 'function') setTimeout(() => { try { toggleSpeechToText(); } catch (e) { } }, 250);
  else setTimeout(() => document.getElementById('mDiaryText')?.focus(), 200);
};

/* ── Writing screen extras (phone) ── */
function drpEditorExtrasHTML(score, isEdit) {
  const sel = _drpFace(score);
  const tagCount = {};
  (state.data.diary || []).forEach(e => String(e.tags || '').split(/[,\s]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  return {
    moods: `
      <div class="drp-ed-moods" role="group" aria-label="Mood">
        ${DRP_MOODS.map(m => `<button type="button" class="drp-ed-face ${sel && sel.v === m.v && score != null ? 'on' : ''}" data-v="${m.v}" style="--c:${m.c}" onclick="drpSetMood(${m.v})"><span>${m.e}</span><em>${m.l}</em></button>`).join('')}
      </div>`,
    prompt: isEdit ? '' : `
      <div class="drp-ed-prompt">
        <button type="button" class="drp-ed-q" onclick="drpInsertText(this.dataset.q + '\\n')" data-q="${_drpEsc(_drpPrompt())}" id="drpEdQ">${_drpEsc(_drpPrompt())}</button>
        <button type="button" class="drp-ed-shuffle" onclick="drpShufflePrompt()" aria-label="Another question">↻</button>
      </div>
      <div class="drp-ed-starters">
        ${DRP_STARTERS.map(s => `<button type="button" onmousedown="event.preventDefault()" onclick="drpInsertText(${JSON.stringify(s).replace(/"/g, '&quot;')})">${_drpEsc(s.trim())}…</button>`).join('')}
      </div>`,
    tags: topTags.length ? `<div class="drp-ed-tags">${topTags.map(t => `<button type="button" onclick="drpAddTag('${_drpEsc(t).replace(/'/g, "\\'")}')">#${_drpEsc(t)}</button>`).join('')}</div>` : ''
  };
}
window.drpSetMood = function (v) {
  const inp = document.getElementById('mMoodScore');
  if (inp) inp.value = v;
  if (typeof updateMoodDisplay === 'function') updateMoodDisplay(v);
  document.querySelectorAll('.drp-ed-face').forEach(b => b.classList.toggle('on', +b.dataset.v === +v));
};
window.drpShufflePrompt = function () {
  _drpPromptIdx = (_drpPromptIdx || 0) + 1;
  const q = _drpPrompt(), el = document.getElementById('drpEdQ');
  if (el) { el.textContent = q; el.dataset.q = q; }
};
window.drpInsertText = function (text) {
  const ed = document.getElementById('mDiaryText');
  if (!ed) return;
  ed.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount || !ed.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
  }
  const needsBreak = (ed.innerText || '').trim().length > 0 && !/\n$/.test(ed.innerText);
  document.execCommand('insertText', false, (needsBreak ? '\n' : '') + text);
  ed.dispatchEvent(new Event('input'));
};
window.drpAddTag = function (t) {
  const inp = document.getElementById('mDiaryTags');
  if (!inp) return;
  const list = inp.value.split(',').map(x => x.trim()).filter(Boolean);
  if (!list.map(x => x.replace(/^#/, '')).includes(t)) list.push(t);
  inp.value = list.join(', ');
};

// Re-render when the window crosses the phone/desktop line.
(function () {
  let wasPhone = _drIsPhone();
  window.addEventListener('resize', () => {
    const p = _drIsPhone();
    if (p !== wasPhone) { wasPhone = p; if (state.view === 'diary' && document.getElementById('universalModal')?.classList.contains('hidden') !== false) renderDiary(); }
  });
})();

const DRP_CSS = `<style>
.drp { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 24px; color: var(--text-1); -webkit-font-smoothing: antialiased; }
.drp button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
.drp-today { position: relative; overflow: hidden; border-radius: 22px; padding: 18px 18px 16px; color: #fff;
  background: radial-gradient(120% 140% at 0% 0%, #6366F1 0%, #4F46E5 38%, #312E81 100%); box-shadow: 0 10px 30px rgba(49,46,129,.28); }
.drp-today::after { content: ''; position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,.08); pointer-events: none; }
.drp-today-top { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; font-weight: 700; opacity: .85; position: relative; z-index: 1; }
.drp-prompt { position: relative; z-index: 1; margin: 12px 0 16px; font-size: 21px; line-height: 1.3; font-weight: 800; letter-spacing: -.02em; }
.drp-faces { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 14px; }
.drp-face { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 9px 0 7px; border-radius: 14px; border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.1); color: #fff; cursor: pointer; transition: transform .12s, background .15s; }
.drp-face span { font-size: 26px; line-height: 1; }
.drp-face em { font-style: normal; font-size: 11px; font-weight: 700; opacity: .9; }
.drp-face:active { transform: scale(.92); background: rgba(255,255,255,.22); }
.drp-today-acts { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.drp-btn { height: 44px; border-radius: 13px; border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.12); color: #fff; font-size: 14.5px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.drp-btn.primary { background: #fff; color: #312E81; border-color: #fff; }
.drp-btn:active { transform: scale(.97); }
.drp-today.done { cursor: pointer; }
.drp-done-pill { background: rgba(255,255,255,.18); padding: 3px 10px; border-radius: 99px; opacity: 1 !important; }
.drp-today-entry { position: relative; z-index: 1; display: flex; gap: 12px; align-items: flex-start; margin: 12px 0 14px; }
.drp-today-face { flex: none; width: 46px; height: 46px; border-radius: 14px; background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; font-size: 26px; }
.drp-today-entry p { margin: 0; font-size: 15px; line-height: 1.5; font-weight: 600; opacity: .95; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.drp-btn.ghost { width: 100%; }

.drp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.drp-stat { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.drp-stat b { font-size: 19px; font-weight: 850; letter-spacing: -.02em; white-space: nowrap; }
.drp-stat b small { font-size: 13px; color: var(--text-3); font-weight: 700; }
.drp-stat span { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }

.drp-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 18px; padding: 10px 8px; }
.drp-day { display: flex; flex-direction: column; align-items: center; gap: 6px; border: none; background: none; padding: 2px 0; cursor: pointer; }
.drp-day em { font-style: normal; font-size: 10.5px; font-weight: 800; color: var(--text-3); }
.drp-day-dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;
  color: var(--text-2); background: var(--surface-2); border: 1.5px solid transparent; box-sizing: border-box; }
.drp-day.has .drp-day-dot { font-size: 19px; background: color-mix(in srgb, var(--c, var(--primary)) 16%, var(--surface-1)); border-color: color-mix(in srgb, var(--c, var(--primary)) 45%, transparent); }
.drp-day.today .drp-day-dot { border: 2px solid var(--primary); }
.drp-day.today em { color: var(--primary); }
.drp-day.future { opacity: .4; cursor: default; }

.drp-tabsrow { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.drp-tabs { flex: 1; min-width: 0; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 3px; background: var(--surface-2); border-radius: 13px; }
.drp-tabs::-webkit-scrollbar { display: none; }
.drp-tabs button { flex: 1 0 auto; height: 34px; padding: 0 12px; border: none; border-radius: 10px; background: none; color: var(--text-3); font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.drp-tabs button.on { background: var(--surface-1); color: var(--text-1); box-shadow: 0 1px 3px rgba(16,24,40,.1); }
.drp-iconbtn { flex: none; width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-2);
  display: flex; align-items: center; justify-content: center; cursor: pointer; }
.drp-iconbtn.on { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 45%, transparent); }
.drp-search { display: flex; flex-direction: column; gap: 8px; }
.drp-search-box { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 13px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-3); }
.drp-search-box input { flex: 1; min-width: 0; border: none !important; background: transparent !important; outline: none; box-shadow: none !important; font: inherit; font-size: 15px; color: var(--text-1); padding: 0 !important; height: 100%; }
.drp-search-box button { border: none; background: none; font-size: 20px; color: var(--text-3); cursor: pointer; padding: 0 2px; }
.drp-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.drp-chips::-webkit-scrollbar { display: none; }
.drp-chips button { flex: none; height: 32px; padding: 0 13px; border-radius: 99px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-2); font-size: 12.5px; font-weight: 700; cursor: pointer; }
.drp-chips button.on { background: var(--text-1); border-color: var(--text-1); color: var(--surface-1); }

.drp-list { display: flex; flex-direction: column; gap: 10px; }
.drp-month { display: flex; align-items: baseline; justify-content: space-between; padding: 8px 2px 0; }
.drp-month b { font-size: 15px; font-weight: 850; letter-spacing: -.01em; }
.drp-month span { font-size: 12px; font-weight: 600; color: var(--text-3); }
.drp-card { display: flex; gap: 12px; padding: 13px 14px; border-radius: 18px; background: var(--surface-1); border: 1px solid var(--border-color); cursor: pointer;
  box-shadow: 0 1px 2px rgba(16,24,40,.04); transition: transform .12s; }
.drp-card:active { transform: scale(.985); }
.drp-date { flex: none; width: 46px; height: 52px; border-radius: 13px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c, #94A3B8) 13%, var(--surface-1)); color: var(--text-1); }
.drp-date b { font-size: 19px; font-weight: 850; line-height: 1; }
.drp-date span { font-size: 10.5px; font-weight: 800; color: var(--text-3); text-transform: uppercase; margin-top: 3px; }
.drp-date.today { background: var(--primary); color: #fff; }
.drp-date.today span { color: rgba(255,255,255,.8); }
.drp-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.drp-card-top { display: flex; align-items: flex-start; gap: 8px; }
.drp-card-top h3 { flex: 1; min-width: 0; margin: 0; font-size: 15px; font-weight: 750; line-height: 1.35; letter-spacing: -.01em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.drp-mood { flex: none; font-size: 20px; line-height: 1; }
.drp-card-main p { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.drp-card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.drp-tag { font-size: 11.5px; font-weight: 700; color: var(--primary); background: color-mix(in srgb, var(--primary) 9%, transparent); padding: 2px 8px; border-radius: 99px; }
.drp-words { margin-left: auto; font-size: 11.5px; font-weight: 600; color: var(--text-3); }
.drp-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 34px 20px; text-align: center; color: var(--text-3); font-size: 13.5px; }
.drp-empty div { font-size: 34px; }
.drp-empty b { color: var(--text-1); font-size: 15px; }
.drp-body > * { max-width: 100%; }
.drp-view-calendar .dr-cal, .drp-view-insights > *, .drp-view-yearly > *, .drp-view-tags > * { padding-left: 0 !important; padding-right: 0 !important; }

/* ── Writing screen, phone ── */
@media (max-width: 768px) {
  .modal-overlay:has(.dr-modal) { padding: 0 !important; align-items: stretch !important; }
  .modal-overlay:has(.dr-modal) .modal-box { width: 100% !important; max-width: none !important; height: 100% !important; max-height: none !important; margin: 0 !important;
    border-radius: 0 !important; padding: calc(env(safe-area-inset-top, 0px) + 8px) 16px calc(env(safe-area-inset-bottom, 0px) + 10px) !important; box-sizing: border-box;
    display: flex; flex-direction: column; overflow: hidden; animation: drpUp .22s ease-out; }
  @keyframes drpUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .dr-modal { flex: 1; min-height: 0; display: flex !important; flex-direction: column; gap: 12px; }
  .dr-modal-bar { margin: 0 !important; padding: 4px 0 10px !important; flex: none; }
  .dr-modal-dismiss { font-size: 15px !important; }
  .dr-modal-date-chip { font-size: 13.5px !important; }
  .dr-modal-save-top { border-radius: 99px !important; padding: 9px 20px !important; min-height: 40px !important; }
  .dr-side { display: flex; flex-direction: column; gap: 10px; flex: none; }
  .dr-mood-strip { display: none !important; }
  .dr-template-select { order: 5; }
  .dr-context-chips { order: 4; }
  .drp-ed-moods { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .drp-ed-face { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 0 6px; border-radius: 14px; border: 1.5px solid var(--border-color);
    background: var(--surface-1); cursor: pointer; transition: transform .12s, border-color .15s, background .15s; }
  .drp-ed-face span { font-size: 24px; line-height: 1; filter: grayscale(.35); transition: filter .15s; }
  .drp-ed-face em { font-style: normal; font-size: 10.5px; font-weight: 800; color: var(--text-3); }
  .drp-ed-face.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, var(--surface-1)); }
  .drp-ed-face.on span { filter: none; }
  .drp-ed-face.on em { color: var(--text-1); }
  .drp-ed-face:active { transform: scale(.93); }
  .drp-ed-prompt { display: flex; align-items: stretch; gap: 6px; }
  .drp-ed-q { flex: 1; text-align: left; border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent); background: color-mix(in srgb, var(--primary) 6%, var(--surface-1));
    color: var(--text-1); border-radius: 13px; padding: 10px 12px; font: inherit; font-size: 14px; font-weight: 700; line-height: 1.35; cursor: pointer; }
  .drp-ed-q::before { content: 'PROMPT · TAP TO ADD'; display: block; font-size: 10px; letter-spacing: .06em; font-weight: 800; color: var(--primary); margin-bottom: 3px; }
  .drp-ed-shuffle { flex: none; width: 42px; border-radius: 13px; border: 1px solid var(--border-color); background: var(--surface-1); font-size: 18px; color: var(--text-2); cursor: pointer; }
  .drp-ed-starters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
  .drp-ed-starters::-webkit-scrollbar { display: none; }
  .drp-ed-starters button { flex: none; height: 32px; padding: 0 12px; border-radius: 99px; border: 1px solid var(--border-color); background: var(--surface-1);
    color: var(--text-2); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .dr-write-zone { flex: 1; min-height: 0; margin: 0 !important; border-radius: 16px !important; display: flex; flex-direction: column; }
  .dr-zone-toolbar { order: 3; border-top: 1px solid var(--border-color); border-bottom: none !important; padding: 6px 8px !important; gap: 2px; }
  .dr-zone-editor { order: 1; flex: 1; min-height: 0 !important; font-size: 17px !important; line-height: 1.65 !important; padding: 14px 16px !important; }
  .dr-zone-footer { order: 2; padding: 8px 14px !important; gap: 8px; border-top: 1px solid var(--border-color); background: var(--surface-1) !important; }
  .dr-zone-tags { font-size: 14px !important; background: transparent !important; }
  .dr-zone-toolbar { background: var(--surface-1) !important; }
  #speechBtn { margin-left: auto !important; width: 40px; height: 40px; border-radius: 50% !important; background: var(--primary) !important; color: #fff !important; }
  #speechBtn svg, #speechBtn i { color: #fff !important; stroke: #fff !important; }
  .drp-ed-tags { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; flex: none; }
  .drp-ed-tags::-webkit-scrollbar { display: none; }
  .drp-ed-tags button { flex: none; height: 28px; padding: 0 10px; border-radius: 99px; border: none; background: color-mix(in srgb, var(--primary) 9%, transparent);
    color: var(--primary); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
  .drp-ed-del { flex: none; height: 40px; border: none; background: none; color: #DC2626; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
}
.drp-ed-moods, .drp-ed-prompt, .drp-ed-starters, .drp-ed-tags, .drp-ed-del { display: none; }
@media (max-width: 768px) { .drp-ed-moods { display: grid; } .drp-ed-prompt, .drp-ed-starters, .drp-ed-tags { display: flex; } .drp-ed-del { display: block; } }
</style>`;

/* ═══ JOURNAL CHAT (phone) ══════════════════════════════════════════════════
   New entries on a phone are written as a conversation: the journal asks,
   you answer in a message bar that sits on top of the keyboard, and the
   questions scroll away above — so the space to write never shrinks. Your
   answers become the entry (the first answer leads, later ones keep their
   question above them). The draft is kept on this device until you save, so
   closing by accident loses nothing. "Editor" switches to the full editor
   with everything written so far. */

const drc = { date: '', mood: null, turns: [], asked: [], pending: null, tags: [], rec: null };
function _drcDraftKey(d) { return 'os.diary.chat.' + d; }
function _drcSaveDraft() { try { localStorage.setItem(_drcDraftKey(drc.date), JSON.stringify({ mood: drc.mood, turns: drc.turns, asked: drc.asked, tags: drc.tags })); } catch (e) { } }
function _drcClearDraft() { try { localStorage.removeItem(_drcDraftKey(drc.date)); } catch (e) { } }

// Questions drawn from the day first, then the daily prompt, then a reflective set.
function _drcQuestions() {
  const ctx = typeof getContextData === 'function' ? getContextData(drc.date) : {};
  const qs = [];
  if (ctx.tasks && ctx.tasks.length) qs.push(ctx.tasks.length === 1 ? `You finished “${ctx.tasks[0].title}”. How did that feel?` : `You finished ${ctx.tasks.length} tasks. Which one mattered most?`);
  if (ctx.habits && ctx.habits.length) qs.push(`${ctx.habits.length} habit${ctx.habits.length === 1 ? '' : 's'} done today. Which one was hardest to show up for?`);
  if (ctx.expenses > 0) qs.push(`You spent ₹${Math.round(ctx.expenses).toLocaleString('en-IN')} today. Anything you'd rather not have bought?`);
  _drpPrompts().forEach(q => qs.push(q));
  qs.push("What's one thing you want tomorrow to have?");
  return qs;
}
function _drcNextQuestion() {
  return _drcQuestions().find(q => !drc.asked.includes(q)) || 'Anything else on your mind?';
}

function _drcBubbles() {
  const name = (state.data.settings && state.data.settings[0] && state.data.settings[0].name) || '';
  const first = String(name).split(' ')[0];
  const isToday = drc.date === diaryLocalDate();
  const dayWord = isToday ? 'today' : _drpParse(drc.date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
  const out = [];
  out.push({ who: 'bot', html: `${_drpEsc(getGreeting())}${first ? ', ' + _drpEsc(first) : ''} 👋<br>How was ${_drpEsc(dayWord)}?` });
  if (drc.mood == null) {
    out.push({ who: 'chips', html: DRP_MOODS.map(m => `<button class="drc-chip mood" style="--c:${m.c}" onclick="drcMood(${m.v})">${m.e} ${m.l}</button>`).join('') });
  } else {
    const f = _drpFace(drc.mood);
    out.push({ who: 'me', html: `${f.e} ${f.l}` });
  }
  drc.turns.forEach(t => {
    if (t.q) out.push({ who: 'bot', html: _drpEsc(t.q) });
    out.push({ who: 'me', html: _drpEsc(t.a).replace(/\n/g, '<br>'), edit: t.id });
  });
  if (drc.pending) out.push({ who: 'bot', html: _drpEsc(drc.pending.q) + (drc.pending.ctx ? `<div class="drc-ctx">${drc.pending.ctx}</div>` : '') });
  if (drc.turns.length) out.push({ who: 'chips', html: `
      <button class="drc-chip" onclick="drcAnother()">↻ Ask me another</button>
      <button class="drc-chip done" onclick="drcDone()">✓ That's it for ${isToday ? 'today' : 'this day'}</button>` });
  return out;
}

function _drcRender(scroll = true) {
  const box = document.getElementById('drcThread');
  if (!box) return;
  box.innerHTML = _drcBubbles().map(b =>
    b.who === 'chips' ? `<div class="drc-chips">${b.html}</div>`
      : `<div class="drc-msg ${b.who}"${b.edit ? ` onclick="drcEditTurn('${b.edit}')"` : ''}>${b.html}</div>`).join('');
  const words = drc.turns.map(t => t.a).join(' ').trim();
  const n = words ? words.split(/\s+/).length : 0;
  const wc = document.getElementById('drcWords');
  if (wc) wc.textContent = n ? `${n} word${n === 1 ? '' : 's'}` : '';
  if (scroll) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function _drcFirstQuestion() {
  const ctx = typeof getContextData === 'function' ? getContextData(drc.date) : {};
  const bits = [];
  if (ctx.tasks && ctx.tasks.length) bits.push(`✓ ${ctx.tasks.length} task${ctx.tasks.length === 1 ? '' : 's'} done`);
  if (ctx.habits && ctx.habits.length) bits.push(`◎ ${ctx.habits.length} habit${ctx.habits.length === 1 ? '' : 's'}`);
  if (ctx.expenses > 0) bits.push(`₹${Math.round(ctx.expenses).toLocaleString('en-IN')} spent`);
  const lead = drc.mood == null ? '' : drc.mood <= 4 ? 'Sorry it was a hard one. ' : drc.mood >= 8 ? 'Love that. ' : '';
  return { q: lead + 'What happened? Start anywhere.', ctx: bits.length ? bits.map(b => `<span>${_drpEsc(b)}</span>`).join('') : '', first: true };
}

window.openDiaryChat = function (dateStr, mood) {
  drc.date = dateStr || diaryLocalDate();
  drc.mood = null; drc.turns = []; drc.asked = []; drc.tags = []; drc.pending = null;
  let restored = false;
  try {
    const d = JSON.parse(localStorage.getItem(_drcDraftKey(drc.date)) || 'null');
    if (d && (d.turns || []).length) { Object.assign(drc, { mood: d.mood, turns: d.turns, asked: d.asked || [], tags: d.tags || [] }); restored = true; }
  } catch (e) { }
  if (mood != null && drc.mood == null) drc.mood = mood;
  drc.pending = drc.turns.length ? { q: restored ? 'Picked up where you left off. Anything to add?' : _drcNextQuestion() } : _drcFirstQuestion();

  const settings = state.data.settings?.[0] || {};
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const tagCount = {};
  (state.data.diary || []).forEach(e => String(e.tags || '').split(/[,\s]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  box.innerHTML = `
    <div class="drc">
      <div class="drc-bar">
        <button class="drc-x" onclick="drcClose()" aria-label="Close">✕</button>
        <label class="drc-date"><input type="date" id="drcDate" value="${drc.date}" onchange="drcChangeDate(this.value)"><span id="drcDateLbl">${_drpEsc(_drpParse(drc.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }))}</span> ▾</label>
        <span class="drc-words" id="drcWords"></span>
        <button class="drc-editor" onclick="drcToEditor()">Editor</button>
        <button class="drc-save" onclick="drcDone()">Save</button>
      </div>
      <div class="drc-thread" id="drcThread"></div>
      <div class="drc-tags" id="drcTags" hidden>
        ${topTags.map(t => `<button class="drc-tag ${drc.tags.includes(t) ? 'on' : ''}" onclick="drcTag('${_drpEsc(t).replace(/'/g, "\\'")}', this)">#${_drpEsc(t)}</button>`).join('') || '<span class="drc-note">Type #word in a message to tag it.</span>'}
      </div>
      <div class="drc-starters">
        <button onclick="drcToggleTags()" class="drc-st-tag">#</button>
        ${DRP_STARTERS.map(s => `<button onmousedown="event.preventDefault()" onclick="drcStarter(${JSON.stringify(s).replace(/"/g, '&quot;')})">${_drpEsc(s.trim())}…</button>`).join('')}
      </div>
      <form class="drc-composer" onsubmit="event.preventDefault(); drcSend();">
        <button type="button" class="drc-mic" id="drcMic" onclick="drcMic()" aria-label="Speak">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></svg></button>
        <textarea id="drcInput" rows="1" placeholder="Type your answer…" oninput="drcGrow(this)" onkeydown="if(event.key==='Enter' && !event.shiftKey && window.innerWidth > 768){event.preventDefault(); drcSend();}"></textarea>
        <button type="submit" class="drc-send" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button>
      </form>
      <!-- the existing save action reads these -->
      <div hidden>
        <div id="mDiaryText"></div>
        <input id="mMoodScore" value="${settings.diary_default_mood || 5}">
        <input id="mDiaryTags" value="">
        <input id="mDiaryDate" value="${drc.date}">
        <button id="drcSaveBtn" data-action="save-diary-modal"></button>
      </div>
    </div>`;
  modal.classList.remove('hidden');
  _drcFitViewport(true);
  _drcRender();
  setTimeout(() => { if (drc.mood != null || drc.turns.length) document.getElementById('drcInput')?.focus(); }, 250);
};

window.drcMood = function (v) {
  drc.mood = v;
  if (drc.pending && drc.pending.first) drc.pending = _drcFirstQuestion();
  _drcSaveDraft(); _drcRender();
  setTimeout(() => document.getElementById('drcInput')?.focus(), 60);
};
window.drcGrow = function (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; };
window.drcStarter = function (s) {
  const el = document.getElementById('drcInput'); if (!el) return;
  el.value = (el.value && !/\s$/.test(el.value) ? el.value + ' ' : el.value) + s;
  el.focus(); el.setSelectionRange(el.value.length, el.value.length); drcGrow(el);
};
window.drcSend = function () {
  const el = document.getElementById('drcInput');
  const text = String(el && el.value || '').trim();
  if (!text) return;
  // #words in a message become tags
  (text.match(/#([\w-]+)/g) || []).forEach(h => { const t = h.slice(1); if (!drc.tags.includes(t)) drc.tags.push(t); });
  const q = drc.pending && !drc.pending.first && !/^Picked up/.test(drc.pending.q) ? drc.pending.q : '';
  drc.turns.push({ id: 't' + Date.now().toString(36), q, a: text });
  if (drc.pending && drc.pending.q) drc.asked.push(drc.pending.q);
  const nq = _drcNextQuestion();
  drc.pending = { q: nq };
  el.value = ''; drcGrow(el);
  _drcSaveDraft(); _drcRender();
  el.focus();
};
window.drcAnother = function () {
  if (drc.pending && drc.pending.q) drc.asked.push(drc.pending.q);
  drc.pending = { q: _drcNextQuestion() };
  _drcRender();
  document.getElementById('drcInput')?.focus();
};
window.drcEditTurn = function (id) {
  const t = drc.turns.find(x => x.id === id);
  if (!t) return;
  const v = prompt('Edit your answer (leave empty to remove it):', t.a);
  if (v === null) return;
  if (!v.trim()) drc.turns = drc.turns.filter(x => x.id !== id); else t.a = v.trim();
  _drcSaveDraft(); _drcRender(false);
};
window.drcToggleTags = function () { const t = document.getElementById('drcTags'); if (t) t.hidden = !t.hidden; };
window.drcTag = function (t, btn) {
  if (drc.tags.includes(t)) drc.tags = drc.tags.filter(x => x !== t); else drc.tags.push(t);
  btn.classList.toggle('on', drc.tags.includes(t));
  _drcSaveDraft();
};
window.drcChangeDate = function (v) {
  if (!v) return;
  _drcClearDraft(); drc.date = v; _drcSaveDraft();
  const l = document.getElementById('drcDateLbl');
  if (l) l.textContent = _drpParse(v).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const d = document.getElementById('mDiaryDate'); if (d) d.value = v;
};
function _drcText() {
  return drc.turns.map((t, i) => (t.q && i > 0 ? `— ${t.q}\n` : (t.q && i === 0 ? `— ${t.q}\n` : '')) + t.a).join('\n\n').trim();
}
window.drcDone = function () {
  // Anything still in the message bar counts.
  const el = document.getElementById('drcInput');
  if (el && el.value.trim()) drcSend();
  const text = _drcText();
  if (!text) { showToast('Write at least one line first'); return; }
  _drcStopMic();
  document.getElementById('mDiaryText').textContent = text;
  document.getElementById('mMoodScore').value = drc.mood != null ? drc.mood : (document.getElementById('mMoodScore').value || 5);
  document.getElementById('mDiaryTags').value = drc.tags.join(', ');
  document.getElementById('mDiaryDate').value = drc.date;
  _drcClearDraft();
  _drcFitViewport(false);
  document.getElementById('drcSaveBtn').click();     // same save path as the editor
};
window.drcClose = function () {
  _drcStopMic();
  _drcFitViewport(false);
  document.getElementById('universalModal').classList.add('hidden');
  if (drc.turns.length) showToast('Draft kept — open the journal to finish it');
};
window.drcToEditor = function () {
  const el = document.getElementById('drcInput');
  if (el && el.value.trim()) drcSend();
  const text = _drcText();
  const mood = drc.mood, date = drc.date, tags = drc.tags.join(', ');
  _drcStopMic(); _drcFitViewport(false);
  _drcForceEditor = true;
  try { openDiaryModal(date, _drpEsc(text).replace(/\n/g, '<br>')); } finally { _drcForceEditor = false; }
  if (mood != null) drpSetMood(mood);
  const t = document.getElementById('mDiaryTags'); if (t) t.value = tags;
  _drcClearDraft();
};

// Voice: dictation goes into the message bar.
function _drcStopMic() { try { if (drc.rec) drc.rec.stop(); } catch (e) { } drc.rec = null; document.getElementById('drcMic')?.classList.remove('on'); }
window.drcMic = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice typing isn’t supported here — use the keyboard mic'); return; }
  if (drc.rec) { _drcStopMic(); return; }
  const rec = new SR();
  rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || 'en-US';
  rec.onresult = ev => {
    let t = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript;
    if (t) { const el = document.getElementById('drcInput'); if (el) { el.value = (el.value ? el.value.replace(/\s*$/, ' ') : '') + t.trim(); drcGrow(el); } }
  };
  rec.onend = () => { drc.rec = null; document.getElementById('drcMic')?.classList.remove('on'); };
  rec.onerror = () => { drc.rec = null; document.getElementById('drcMic')?.classList.remove('on'); };
  drc.rec = rec; rec.start();
  document.getElementById('drcMic')?.classList.add('on');
  showToast('Listening… tap the mic again to stop');
};

/* Keep the writing screens inside the visible area when the keyboard is up
   (iOS keeps the layout viewport full height and slides the keyboard over it). */
let _drcVV = null;
function _drcFitViewport(on) {
  const ov = document.getElementById('universalModal');
  const vv = window.visualViewport;
  if (!ov || !vv) return;
  if (_drcVV) { vv.removeEventListener('resize', _drcVV); vv.removeEventListener('scroll', _drcVV); _drcVV = null; }
  if (!on) { ov.style.removeProperty('height'); ov.style.removeProperty('top'); return; }
  _drcVV = () => {
    if (!_drIsPhone()) return;
    ov.style.height = vv.height + 'px';
    ov.style.top = vv.offsetTop + 'px';
    const th = document.getElementById('drcThread');
    if (th && document.activeElement && document.activeElement.id === 'drcInput') th.scrollTop = th.scrollHeight;
  };
  vv.addEventListener('resize', _drcVV); vv.addEventListener('scroll', _drcVV);
  _drcVV();
}
// The classic editor: hide the extras while typing and keep it above the keyboard.
document.addEventListener('focusin', e => {
  if (!_drIsPhone() || !e.target || e.target.id !== 'mDiaryText') return;
  const m = e.target.closest('.dr-modal'); if (m) m.classList.add('typing');
  _drcFitViewport(true);
});
document.addEventListener('focusout', e => {
  if (!e.target || e.target.id !== 'mDiaryText') return;
  const m = e.target.closest('.dr-modal');
  setTimeout(() => { if (m && document.activeElement !== e.target) m.classList.remove('typing'); }, 150);
});
// Any close of the shared modal releases the viewport fit.
(function () {
  const ov = document.getElementById('universalModal');
  if (!ov || !window.MutationObserver) return;
  new MutationObserver(() => { if (ov.classList.contains('hidden')) { _drcStopMic(); _drcFitViewport(false); } }).observe(ov, { attributes: true, attributeFilter: ['class'] });
})();

const DRC_CSS = `<style>
@media (max-width: 768px) {
  .modal-overlay:has(.drc) { padding: 0 !important; align-items: stretch !important; }
  .modal-overlay:has(.drc) .modal-box { width: 100% !important; max-width: none !important; height: 100% !important; max-height: none !important; margin: 0 !important;
    border-radius: 0 !important; padding: 0 !important; display: flex; flex-direction: column; overflow: hidden; background: var(--surface-base, #F7F8FA) !important; }
  /* classic editor while typing: only the text, the toolbar and Save */
  .dr-modal.typing .dr-side, .dr-modal.typing .drp-ed-tags, .dr-modal.typing .drp-ed-del { display: none !important; }
  .dr-modal.typing .dr-modal-bar { padding-bottom: 6px !important; }
}
.drc { flex: 1; min-height: 0; display: flex; flex-direction: column; color: var(--text-1); padding: 0 !important; margin: 0 !important; width: 100%; }
.modal-overlay:has(.drc) .modal-box::before { display: none !important; }
.drc button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
.drc-bar { flex: none; display: flex; align-items: center; gap: 8px; padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px; background: var(--surface-1); border-bottom: 1px solid var(--border-color); }
.drc-x { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--surface-2); color: var(--text-2); font-size: 15px; cursor: pointer; }
.drc-date { position: relative; flex: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px; border-radius: 99px; background: var(--surface-2); font-size: 13.5px; font-weight: 750; color: var(--text-1); cursor: pointer; }
.drc-date input { position: absolute; inset: 0; opacity: 0; width: 100%; }
.drc-words { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; font-size: 12px; font-weight: 600; color: var(--text-3); }
.drc-editor { height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-2); font-size: 12.5px; font-weight: 700; cursor: pointer; }
.drc-save { height: 36px; padding: 0 16px; border-radius: 99px; border: none; background: var(--primary); color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; }
.drc-thread { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 16px 14px 10px; display: flex; flex-direction: column; gap: 8px; }
.drc-msg { max-width: 84%; padding: 10px 14px; border-radius: 18px; font-size: 15.5px; line-height: 1.45; word-wrap: break-word; animation: drcIn .18s ease-out; }
@keyframes drcIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.drc-msg.bot { align-self: flex-start; background: var(--surface-1); border: 1px solid var(--border-color); border-bottom-left-radius: 6px; font-weight: 600; }
.drc-msg.me { align-self: flex-end; background: var(--primary); color: #fff; border-bottom-right-radius: 6px; cursor: pointer; }
.drc-ctx { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.drc-ctx span { font-size: 12px; font-weight: 700; color: var(--text-2); background: var(--surface-2); padding: 3px 9px; border-radius: 99px; }
.drc-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0 4px; }
.drc-chip { height: 36px; padding: 0 13px; border-radius: 99px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-1); font-size: 13.5px; font-weight: 700; cursor: pointer; }
.drc-chip.mood { border-color: color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 9%, var(--surface-1)); }
.drc-chip.done { background: var(--text-1); color: var(--surface-1); border-color: var(--text-1); }
.drc-chip:active { transform: scale(.96); }
.drc-tags { flex: none; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 8px 12px 0; }
.drc-tags[hidden] { display: none; }
.drc-tag { flex: none; height: 30px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--primary); font-size: 12.5px; font-weight: 700; cursor: pointer; }
.drc-tag.on { background: var(--primary); color: #fff; border-color: var(--primary); }
.drc-note { font-size: 12.5px; color: var(--text-3); }
.drc-starters { flex: none; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 8px 12px 6px; }
.drc-starters::-webkit-scrollbar, .drc-tags::-webkit-scrollbar { display: none; }
.drc-starters button { flex: none; height: 30px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--border-color); background: var(--surface-1); color: var(--text-2); font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.drc-starters .drc-st-tag { color: var(--primary); font-weight: 850; min-width: 34px; }
.drc-composer { flex: none; display: flex; align-items: flex-end; gap: 8px; padding: 6px 10px calc(env(safe-area-inset-bottom, 0px) + 8px); background: var(--surface-1); border-top: 1px solid var(--border-color); }
.drc-composer textarea { flex: 1; min-width: 0; resize: none; max-height: 160px; min-height: 42px; box-sizing: border-box; padding: 10px 14px !important; border-radius: 21px !important;
  border: 1px solid var(--border-color) !important; background: var(--surface-2) !important; color: var(--text-1); font: inherit; font-size: 16px; line-height: 1.4; outline: none; box-shadow: none !important; }
.drc-mic, .drc-send { flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.drc-mic { background: var(--surface-2); color: var(--text-2); }
.drc-mic.on { background: #EF4444; color: #fff; animation: drcPulse 1.2s ease-in-out infinite; }
@keyframes drcPulse { 50% { box-shadow: 0 0 0 6px rgba(239,68,68,.2); } }
.drc-send { background: var(--primary); color: #fff; }
</style>`;

// Chat + writing-screen styles live in <head> so the chat works from anywhere
// (dashboard "New entry", the page header), not only the journal page.
(function () {
  if (document.getElementById('drcStyles')) return;
  const holder = document.createElement('div');
  holder.innerHTML = DRC_CSS + DRP_CSS;
  [...holder.querySelectorAll('style')].forEach((st, i) => { st.id = i ? 'drpStyles' : 'drcStyles'; document.head.appendChild(st); });
})();
// On a phone a new entry is the chat; the full editor opens when there's
// already text to edit (templates, "Editor" from the chat) or it's asked for.
let _drcForceEditor = false;
(function () {
  const classic = window.openDiaryModal;
  window.openDiaryModal = function (dateStr, templateContent = '') {
    if (_drIsPhone() && !templateContent && !_drcForceEditor) return openDiaryChat(dateStr);
    return classic(dateStr, templateContent);
  };
})();
