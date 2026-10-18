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
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
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
  const _wkStart = diaryLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()));
  const thisWeekEntries = entries.filter(e => String(e.date || '').slice(0, 10) >= _wkStart);
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

/* ═══ DIARY POLISH 2026-10 — summary, tabs, tags & templates ═══ */
.dr-pro .drh { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(300px,1fr); gap:12px; margin:2px 20px 14px; flex-shrink:0; }
.drh-stats, .drh-week { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; box-shadow:var(--shadow-card, 0 1px 3px rgba(0,0,0,.04)); }
.drh-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
.drh-stat { display:flex; gap:12px; align-items:flex-start; padding:16px; min-width:0; }
.drh-stat + .drh-stat { border-left:1px solid var(--border-color); }
.drh-txt { min-width:0; }
.drh-ic { width:34px; height:34px; border-radius:10px; flex:none; display:flex; align-items:center; justify-content:center; color:var(--ic); background:color-mix(in srgb, var(--ic) 13%, transparent); }
.drh-ic svg { width:17px; height:17px; }
.drh-n { font-size:24px; font-weight:750; color:var(--text-1); letter-spacing:-.6px; line-height:1.05; font-variant-numeric:tabular-nums; white-space:nowrap; }
.drh-n small { font-size:12px; font-weight:600; color:var(--text-3); margin-left:3px; letter-spacing:0; }
.drh-l { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); margin-top:5px; }
.drh-sub { font-size:12px; color:var(--text-3); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.drh-sub.ok { color:#059669; font-weight:600; }
.drh-week { padding:14px 16px; display:flex; flex-direction:column; gap:10px; justify-content:center; }
.drh-week-top { display:flex; justify-content:space-between; align-items:baseline; }
.drh-week-top .drh-l { margin:0; }
.drh-week-count { font-size:12px; color:var(--text-3); }
.drh-week-count b { font-size:15px; color:var(--text-1); font-weight:750; }
.drh-days { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
.drh-day { display:flex; flex-direction:column; align-items:center; gap:5px; background:none; border:none; padding:2px 0; cursor:pointer; font:inherit; }
.drh-day:disabled { cursor:default; }
.drh-dow { font-size:10px; font-weight:700; color:var(--text-3); }
.drh-dot { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:650; color:var(--text-2); background:var(--surface-2); border:1.5px solid transparent; transition:transform .15s, box-shadow .15s; font-variant-numeric:tabular-nums; }
.drh-day:not(:disabled):hover .drh-dot { transform:translateY(-1px); box-shadow:var(--shadow-md, 0 4px 12px rgba(0,0,0,.08)); }
.drh-day.has .drh-dot { background:var(--m); color:#fff; }
.drh-day.today .drh-dot { border-color:var(--primary); color:var(--primary); font-weight:800; }
.drh-day.today .drh-dow { color:var(--primary); }
.drh-day.today.has .drh-dot { color:#fff; border-color:transparent; box-shadow:0 0 0 2px var(--surface-1), 0 0 0 4px var(--m); }
.drh-day.future .drh-dot { opacity:.45; }
.drh-bar { height:4px; border-radius:99px; background:var(--surface-2); overflow:hidden; }
.drh-bar i { display:block; height:100%; border-radius:inherit; background:var(--primary); transition:width .5s cubic-bezier(.4,0,.2,1); }
@media (max-width:1240px) { .dr-pro .drh { grid-template-columns:1fr; } }
@media (max-width:900px) {
  .drh-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .drh-stat:nth-child(3) { border-left:none; }
  .drh-stat:nth-child(n+3) { border-top:1px solid var(--border-color); }
}

.drt-row { display:flex; align-items:center; gap:10px 12px; margin:0 20px 12px; flex-shrink:0; flex-wrap:wrap; }
.drt-seg { display:inline-flex; gap:2px; padding:3px; background:var(--surface-2); border:1px solid var(--border-color); border-radius:11px; max-width:100%; overflow-x:auto; scrollbar-width:none; }
.drt-seg::-webkit-scrollbar { display:none; }
.drt-tab { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border:none; background:transparent; border-radius:8px; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; white-space:nowrap; transition:background .15s, color .15s, box-shadow .15s; }
.drt-tab svg { width:14px; height:14px; }
.drt-tab:hover { color:var(--text-1); }
.drt-tab.active { background:var(--surface-1); color:var(--text-1); box-shadow:0 1px 2px rgba(0,0,0,.06), 0 0 0 1px var(--border-color); }
.drt-tab.active svg { color:var(--primary); }
.drt-tools { margin-left:auto; display:flex; gap:8px; align-items:center; }
.drt-search { display:flex; align-items:center; gap:7px; height:36px; padding:0 10px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:10px; width:240px; cursor:text; transition:border-color .15s, box-shadow .15s; }
.drt-search:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.drt-search input { flex:1; min-width:0; height:auto !important; min-height:0 !important; margin:0 !important; padding:0 !important; border:none !important; outline:none; background:transparent !important; box-shadow:none !important; border-radius:0 !important; font-size:13px !important; color:var(--text-1); }
.drt-search input::placeholder { color:var(--text-3); }
.drt-search svg { width:14px; height:14px; color:var(--text-3); flex:none; }
.drt-clear { border:none; background:none; color:var(--text-3); cursor:pointer; font-size:17px; line-height:1; padding:0 2px; }
.drt-clear:hover { color:var(--text-1); }
.drt-select { height:36px !important; min-height:0 !important; width:auto !important; margin:0 !important; padding:0 30px 0 11px !important; border:1px solid var(--border-color) !important; border-radius:10px !important; box-shadow:none !important; background:var(--surface-1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center !important; font-size:13px !important; font-weight:600; color:var(--text-2); -webkit-appearance:none; appearance:none; cursor:pointer; outline:none; }
.drt-select:focus { border-color:var(--primary); }
.drt-filter { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 8px 0 11px; border-radius:99px; border:1px solid color-mix(in srgb, var(--primary) 30%, transparent); background:color-mix(in srgb, var(--primary) 9%, transparent); color:var(--primary); font-size:12.5px; font-weight:700; cursor:pointer; }
.drt-filter span { font-size:15px; line-height:1; opacity:.7; }
@media (max-width:900px) { .drt-tools { margin-left:0; width:100%; } .drt-search { flex:1; width:auto; } }

.drtg { padding:6px 20px 28px; display:flex; flex-direction:column; gap:28px; }
.drtg-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.drtg-head h3 { margin:0; font-size:15px; font-weight:750; color:var(--text-1); letter-spacing:-.2px; display:flex; align-items:center; gap:7px; }
.drtg-head h3 span { font-size:11px; font-weight:700; color:var(--text-3); background:var(--surface-2); border-radius:99px; padding:2px 8px; letter-spacing:0; }
.drtg-head p { margin:3px 0 0; font-size:12.5px; color:var(--text-3); }
.drtg-actions { display:flex; gap:6px; }
.drtg-btn { display:inline-flex; align-items:center; gap:5px; height:32px; padding:0 12px; border-radius:9px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-2); font-size:12.5px; font-weight:650; cursor:pointer; white-space:nowrap; transition:border-color .15s, color .15s, filter .15s; }
.drtg-btn svg { width:14px; height:14px; }
.drtg-btn:hover { border-color:var(--text-3); color:var(--text-1); }
.drtg-btn.primary { background:var(--primary); border-color:var(--primary); color:#fff; }
.drtg-btn.primary:hover { filter:brightness(.95); color:#fff; }
.drtg-chips { display:flex; flex-wrap:wrap; gap:8px; }
.drtg-chip { display:inline-flex; align-items:center; gap:7px; height:34px; padding:0 7px 0 12px; border-radius:99px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); font-size:13px; font-weight:600; cursor:pointer; transition:border-color .15s, background .15s, transform .15s; }
.drtg-chip:hover { border-color:var(--c); background:color-mix(in srgb, var(--c) 7%, var(--surface-1)); }
.drtg-chip:active { transform:scale(.96); }
.drtg-dot { width:8px; height:8px; border-radius:50%; background:var(--c); flex:none; }
.drtg-n { min-width:22px; height:22px; padding:0 6px; border-radius:99px; background:var(--surface-2); color:var(--text-3); font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
.drtg-empty { font-size:13px; color:var(--text-3); padding:14px 16px; border:1px dashed var(--border-color); border-radius:12px; }

.drtp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px; }
.drtp-card { position:relative; display:flex; flex-direction:column; text-align:left; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; padding:15px 16px 12px; cursor:pointer; box-shadow:var(--shadow-card, 0 1px 3px rgba(0,0,0,.04)); transition:transform .16s, box-shadow .16s, border-color .16s; overflow:hidden; font:inherit; color:inherit; min-height:200px; -webkit-tap-highlight-color:transparent; }
.drtp-card::before { content:''; position:absolute; inset:0 0 auto 0; height:3px; background:var(--c); }
.drtp-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md, 0 8px 20px rgba(0,0,0,.08)); border-color:color-mix(in srgb, var(--c) 35%, var(--border-color)); }
.drtp-card:focus-visible { outline:2px solid var(--c); outline-offset:2px; }
.drtp-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; min-height:28px; }
.drtp-cat { display:inline-flex; align-items:center; gap:5px; padding:3px 9px 3px 7px; border-radius:99px; font-size:11px; font-weight:700; text-transform:capitalize; color:var(--c); background:color-mix(in srgb, var(--c) 11%, transparent); }
.drtp-cat svg { width:12px; height:12px; }
.drtp-acts { display:flex; gap:2px; opacity:0; transition:opacity .15s; }
.drtp-card:hover .drtp-acts, .drtp-card:focus-within .drtp-acts { opacity:1; }
@media (hover:none) { .drtp-acts { opacity:1; } }
.drtp-act { width:28px; height:28px; border-radius:8px; border:none; background:transparent; color:var(--text-3); display:flex; align-items:center; justify-content:center; cursor:pointer; }
.drtp-act svg { width:14px; height:14px; }
.drtp-act:hover { background:var(--surface-2); color:var(--text-1); }
.drtp-act.del:hover { background:rgba(220,38,38,.08); color:#DC2626; }
.drtp-title { font-size:15px; font-weight:700; color:var(--text-1); letter-spacing:-.2px; margin-bottom:9px; }
.drtp-outline { list-style:none; margin:0 0 12px; padding:0; display:flex; flex-direction:column; gap:6px; flex:1; }
.drtp-outline li { position:relative; padding-left:14px; font-size:12.5px; color:var(--text-2); line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.drtp-outline li::before { content:''; position:absolute; left:2px; top:.48em; width:5px; height:5px; border-radius:2px; background:color-mix(in srgb, var(--c) 60%, transparent); }
.drtp-outline li.more { color:var(--text-3); font-size:12px; padding-left:0; }
.drtp-outline li.more::before { display:none; }
.drtp-use { display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-color); font-size:12.5px; font-weight:700; color:var(--c); }
.drtp-use svg { width:15px; height:15px; transition:transform .15s; }
.drtp-card:hover .drtp-use svg { transform:translateX(3px); }
.drtp-new { align-items:center; justify-content:center; gap:8px; border:1.5px dashed var(--border-color); background:transparent; box-shadow:none; color:var(--text-3); font-size:13px; font-weight:650; }
.drtp-new::before { display:none; }
.drtp-new svg { width:22px; height:22px; }
.drtp-new:hover { color:var(--primary); border-color:var(--primary); background:color-mix(in srgb, var(--primary) 4%, transparent); box-shadow:none; }
@media (max-width:480px) { .drtg { padding:4px 16px 24px; } .drtp-grid { grid-template-columns:1fr; } .drtp-card { min-height:0; } .drtp-new { min-height:64px; } }
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

      ${renderDiaryHero(entries, streak)}

      <!-- Nav: segmented tabs + list tools -->
      <div class="drt-row">
        <div class="drt-seg" role="tablist">
          ${[['list', 'list', 'Entries'], ['calendar', 'calendar', 'Month'], ['yearly', 'grid-3x3', 'Year'], ['insights', 'bar-chart-3', 'Stats'], ['tags', 'tags', 'Tags & Templates']].map(([v, ic, label]) => `
          <button class="drt-tab ${currentDiaryView === v ? 'active' : ''}" role="tab" aria-selected="${currentDiaryView === v}" onclick="switchDiaryView('${v}')"><i data-lucide="${ic}"></i>${label}</button>`).join('')}
        </div>
        ${currentDiaryView === 'list' ? `
        <div class="drt-tools">
          ${currentTagFilter ? `<button class="drt-filter" onclick="drClearTagFilter()" title="Clear tag filter">#${_drpEsc(currentTagFilter)}<span aria-hidden="true">×</span></button>` : ''}
          <label class="drt-search">
            <i data-lucide="search"></i>
            <input type="text" id="drSearchInput" placeholder="Search entries" value="${_drpEsc(currentSearchQuery)}" oninput="handleDiarySearch(this.value)">
            ${currentSearchQuery ? `<button class="drt-clear" onclick="handleDiarySearch('')" title="Clear search">×</button>` : ''}
          </label>
          <select class="drt-select" onchange="handleDateFilter(this.value)" aria-label="Date range">
            <option value="all" ${currentDateFilter === 'all' ? 'selected' : ''}>All time</option>
            <option value="week" ${currentDateFilter === 'week' ? 'selected' : ''}>This week</option>
            <option value="month" ${currentDateFilter === 'month' ? 'selected' : ''}>This month</option>
            <option value="last7" ${currentDateFilter === 'last7' ? 'selected' : ''}>Last 7 days</option>
          </select>
        </div>` : ''}
      </div>

      <!-- Scrollable Body -->
      <div class="dr-body ${currentDiaryView === 'list' ? 'dr-body-split' : ''}">
        ${currentDiaryView === 'list' ? `<div class="dr-list-main">${renderListView(sorted)}</div><aside class="dr-rail">${renderDiaryRail(entries)}</aside>` : ''}
        ${currentDiaryView === 'calendar' ? renderCalendarView(entries) : ''}
        ${currentDiaryView === 'yearly' ? renderYearlyView(entries) : ''}
        ${currentDiaryView === 'insights' ? renderInsightsView(entries) : ''}
        ${currentDiaryView === 'tags' ? renderTagsView() : ''}
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

function _drMoodColor(m) { return m >= 8 ? '#10B981' : m >= 6 ? '#84CC16' : m >= 4 ? '#F59E0B' : m >= 2 ? '#F97316' : '#EF4444'; }

/* Desktop summary: four stat tiles + this week's days (coloured by mood). */
function renderDiaryHero(entries, streak) {
  const all = entries || [];
  const now = new Date();
  const todayStr = diaryLocalDate(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const byDate = {};
  all.forEach(e => { const d = String(e.date || '').slice(0, 10); if (d) (byDate[d] = byDate[d] || []).push(e); });
  const days = [];
  for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const written = days.filter(d => byDate[diaryLocalDate(d)]).length;
  const thisMonth = all.filter(e => String(e.date || '').startsWith(todayStr.slice(0, 7))).length;
  const words = all.reduce((s, e) => s + _drStripMd(e.content).split(/\s+/).filter(Boolean).length, 0);
  const cutoff = diaryLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const recentMoods = all.filter(e => String(e.date || '').slice(0, 10) >= cutoff).map(_drMood).filter(v => v != null);
  const moods = recentMoods.length ? recentMoods : all.map(_drMood).filter(v => v != null);
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const doneToday = !!byDate[todayStr];
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const tile = (ic, color, n, unit, label, sub, ok) => `
      <div class="drh-stat">
        <div class="drh-ic" style="--ic:${color}"><i data-lucide="${ic}"></i></div>
        <div class="drh-txt">
          <div class="drh-n">${n}${unit ? `<small>${unit}</small>` : ''}</div>
          <div class="drh-l">${label}</div>
          <div class="drh-sub ${ok ? 'ok' : ''}">${sub}</div>
        </div>
      </div>`;
  return `
  <div class="drh">
    <div class="drh-stats">
      ${tile('flame', '#F97316', streak, streak === 1 ? 'day' : 'days', 'Streak', doneToday ? 'Today is written' : (streak ? 'Write today to keep it' : 'Write today to start one'), doneToday)}
      ${tile('smile', avg != null ? _drMoodColor(avg) : '#94A3B8', avg != null ? avg.toFixed(1) : '—', avg != null ? '/10' : '', 'Avg mood', recentMoods.length ? 'Last 30 days' : (moods.length ? 'All time' : 'No moods yet'))}
      ${tile('book-open', '#6366F1', all.length, '', 'Entries', `${thisMonth} this month`)}
      ${tile('pen-line', '#0EA5E9', words >= 10000 ? (words / 1000).toFixed(1) + 'k' : words.toLocaleString(), '', 'Words', all.length ? `≈ ${Math.round(words / all.length)} per entry` : 'Start writing')}
    </div>
    <div class="drh-week">
      <div class="drh-week-top">
        <span class="drh-l">This week</span>
        <span class="drh-week-count"><b>${written}</b>/7 days</span>
      </div>
      <div class="drh-days">
        ${days.map((d, i) => {
          const ds = diaryLocalDate(d);
          const es = byDate[ds];
          const m = es ? _drMood(es[0]) : null;
          const future = ds > todayStr;
          const click = es ? `openEditDiary('${es[0].id}')` : `openDiaryModal('${ds}')`;
          const tip = `${dow[i]} ${d.getDate()}${es ? (m != null ? ` · mood ${m}/10` : ' · written') : (future ? '' : ' · tap to write')}`;
          return `<button class="drh-day ${es ? 'has' : ''} ${ds === todayStr ? 'today' : ''} ${future ? 'future' : ''}" ${future ? 'disabled' : `onclick="${click}"`} title="${tip}">
            <span class="drh-dow">${dow[i].charAt(0)}</span>
            <span class="drh-dot" ${es ? `style="--m:${m != null ? _drMoodColor(m) : 'var(--primary)'}"` : ''}>${d.getDate()}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="drh-bar"><i style="width:${(written / 7) * 100}%"></i></div>
    </div>
  </div>`;
}

window.drClearTagFilter = function () { currentTagFilter = ''; renderDiary(); };

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
        <p class="dr-entry-preview">${_drpEsc(_drStripMd(entry.content).substring(0, 200))}</p>
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
    const preview = _drpEsc(_drStripMd(entry.content).substring(0, 200));
    const tags = entry.tags ? entry.tags.split(/[,\s]+/).filter(t => t).slice(0, 3) : [];

    return `
          <div class="timeline-entry" style="border-left-color:${moodColor}; background:${moodBg}; animation-delay:${i * 0.05}s;">
            <div class="timeline-entry-date">${dateStr}</div>
            <div class="timeline-entry-text">${preview}${_drStripMd(entry.content).length > 200 ? '...' : ''}</div>
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

  const totalWords = entries.reduce((acc, e) => acc + _drStripMd(e.content).split(/\s+/).filter(Boolean).length, 0);

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
      (e.content && _drStripMd(e.content).toLowerCase().includes(query)) ||
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
  const hadFocus = document.activeElement && document.activeElement.id === 'drSearchInput';
  currentSearchQuery = query;
  renderDiary();
  if (hadFocus) {
    const inp = document.getElementById('drSearchInput');
    if (inp) { inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) { } }
  }
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

  const nT = (state.data.diary_templates || []).length;
  return `
    <div class="drtg">
      <section>
        <div class="drtg-head">
          <div>
            <h3>Tags<span>${allTags.length}</span></h3>
            <p>Click a tag to see the entries that use it.</p>
          </div>
          <div class="drtg-actions">
            <button class="drtg-btn" onclick="openTagModal()"><i data-lucide="plus"></i>New tag</button>
          </div>
        </div>
        ${allTags.length === 0
          ? `<div class="drtg-empty">No tags yet — add #tags while writing and they'll show up here.</div>`
          : `<div class="drtg-chips">${allTags.map((tag, idx) => `
            <button class="drtg-chip" style="--c:${colors[idx % colors.length]}" onclick="filterByTag('${String(tag).replace(/'/g, "\\'")}')">
              <span class="drtg-dot"></span>#${_drpEsc(tag)}<span class="drtg-n">${tagCounts[tag] || 0}</span>
            </button>`).join('')}</div>`}
      </section>

      <section>
        <div class="drtg-head">
          <div>
            <h3>Templates<span>${nT}</span></h3>
            <p>Start an entry from a ready-made outline.</p>
          </div>
          <div class="drtg-actions">
            ${nT === 0 ? `<button class="drtg-btn btn-seed" onclick="seedDefaultTemplates()"><i data-lucide="sparkles"></i>Add starter set</button>` : ''}
            <button class="drtg-btn primary" onclick="openTemplateModal()"><i data-lucide="plus"></i>New template</button>
          </div>
        </div>
        ${renderTemplatesList()}
      </section>
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

const DR_TPL_CATS = {
  reflection: ['#6366F1', 'lightbulb'], gratitude: ['#F59E0B', 'heart'], goals: ['#10B981', 'target'],
  morning: ['#F97316', 'sunrise'], evening: ['#8B5CF6', 'moon'], work: ['#0EA5E9', 'briefcase'],
  health: ['#EF4444', 'activity'], planning: ['#14B8A6', 'list-checks'], general: ['#64748B', 'file-text'],
};
function _drTplCat(c) { return DR_TPL_CATS[String(c || 'general').toLowerCase()] || DR_TPL_CATS.general; }

/* The outline a template gives you: its headings, else its first lines. */
function _drTplOutline(content) {
  const s = String(content || '');
  if (!s.trim()) return [];
  if (drIsHTML(s)) {
    const b = new DOMParser().parseFromString('<body>' + drSanitize(s) + '</body>', 'text/html').body;
    let out = [...b.querySelectorAll('h2,h3,h4')].map(h => h.textContent.trim()).filter(Boolean);
    if (!out.length) out = [...b.children].map(c => c.textContent.trim()).filter(Boolean);
    return out;
  }
  const lines = s.split(/\r?\n/);
  let out = lines.filter(l => /^\s*#{1,6}\s+\S/.test(l)).map(l => l.replace(/^\s*#{1,6}\s+/, ''));
  if (!out.length) out = lines.map(l => l.replace(/^\s*([-*+•>]|\d+[.)])\s*/, ''));
  return out.map(l => l.replace(/\*\*|__|~~/g, '').trim()).filter(Boolean);
}

function renderTemplatesList() {
  const templates = state.data.diary_templates || [];
  const newCard = `<button class="drtp-card drtp-new" onclick="openTemplateModal()"><i data-lucide="plus"></i><span>New template</span></button>`;
  if (!templates.length) return `<div class="drtp-grid">${newCard}</div>`;
  return `
    <div class="drtp-grid">
      ${templates.map(t => {
        const [color, icon] = _drTplCat(t.category);
        const outline = _drTplOutline(t.content);
        const shown = outline.slice(0, 4);
        return `
        <div class="drtp-card" style="--c:${color}" role="button" tabindex="0" title="Use this template"
             onclick="useTemplate(${t.id})" onkeydown="if(event.key==='Enter'){useTemplate(${t.id})}">
          <div class="drtp-top">
            <span class="drtp-cat"><i data-lucide="${icon}"></i>${_drpEsc(t.category || 'general')}</span>
            <div class="drtp-acts">
              <button class="drtp-act" title="Edit template" onclick="event.stopPropagation(); editTemplate(${t.id})"><i data-lucide="pencil"></i></button>
              <button class="drtp-act del" title="Delete template" onclick="event.stopPropagation(); deleteTemplate(${t.id})"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <div class="drtp-title">${_drpEsc(t.title || 'Untitled')}</div>
          <ul class="drtp-outline">
            ${shown.length ? shown.map(x => `<li>${_drpEsc(x)}</li>`).join('') : '<li class="more">Empty template</li>'}
            ${outline.length > shown.length ? `<li class="more">+${outline.length - shown.length} more</li>` : ''}
          </ul>
          <div class="drtp-use">Use template<i data-lucide="arrow-right"></i></div>
        </div>`;
      }).join('')}
      ${newCard}
    </div>
  `;
}

window.useTemplate = function (id) {
  const templates = state.data.diary_templates || [];
  const t = templates.find(x => x.id === id);
  if (t) openDiaryModal(null, drToEditorHTML(t.content));
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
    <input class="input" id="mTemplateTitle" placeholder="Title" value="${_drpEsc(template?.title || '')}">
    <select class="input" id="mTemplateCategory">
      <option value="reflection" ${template?.category === 'reflection' ? 'selected' : ''}>Reflection</option>
      <option value="goals" ${template?.category === 'goals' ? 'selected' : ''}>Goals</option>
      <option value="gratitude" ${template?.category === 'gratitude' ? 'selected' : ''}>Gratitude</option>
    </select>
    <div class="dr-write-zone drx-tpl-zone">
      ${drToolbarHTML()}
      <div class="rich-editor dr-zone-editor drx-editor" id="mTemplateContent" contenteditable="true"
           placeholder="Write the template — headings, colours and checklists are kept.">${drToEditorHTML(template?.content || '')}</div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="saveTemplate(${template?.id || 'null'})">Save</button>
    </div>
  `;
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.saveTemplate = async function (existingId) {
  const title = document.getElementById('mTemplateTitle').value;
  const category = document.getElementById('mTemplateCategory').value;
  const contentEl = document.getElementById('mTemplateContent');
  const content = (contentEl && (contentEl.innerText || '').trim()) ? drRichValue(contentEl) : '';

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
        ${drToolbarHTML({ dateStr: defaultDate })}
        <div class="rich-editor dr-zone-editor drx-editor" id="mDiaryText" contenteditable="true"
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
    if (editor) { editor.innerHTML = drToEditorHTML(t.content); editor.dispatchEvent(new Event('input', { bubbles: true })); }
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
        ${drToolbarHTML({ dateStr: (e.date || '').slice(0, 10) })}
        <div class="rich-editor dr-zone-editor drx-editor" id="mDiaryText" contenteditable="true">${drToEditorHTML(e.content)}</div>
        <div class="dr-zone-footer">
          <input class="dr-zone-tags" id="mDiaryTags" value="${(e.tags || '')}" placeholder="#tags (comma separated)">
          <span class="dr-zone-wc" id="diaryWordCount">${_drStripMd(e.content).split(/\s+/).filter(Boolean).length} words</span>
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

/* ═══ RICH EDITOR ═══════════════════════════════════════════════════════════
   One editor for journal entries and templates:
   • Toolbar — heading, bold / italic / underline / strike, text colour and
     highlight palette, bullets, numbers, checklist, quote, clear formatting.
   • Bubble — select any text and a small formatter floats next to it.
   Entries with formatting are stored as cleaned HTML (allow-listed tags and
   colour styles only). Entries without formatting stay plain text, so old
   data and the chat flow are unchanged. Old markdown entries/templates
   (###, -, 1., **bold**) open as real headings and lists. */

const DRX_TEXT = [
  { c: '#E5484D', n: 'Red' },
  { c: '#F76B15', n: 'Orange' },
  { c: '#CA8A04', n: 'Gold' },
  { c: '#16A34A', n: 'Green' },
  { c: '#3B82F6', n: 'Blue' },
  { c: '#8B5CF6', n: 'Purple' },
  { c: '#DB2777', n: 'Pink' },
  { c: '#8A8F98', n: 'Gray' },
];
const DRX_HILITE = [
  { c: 'rgba(250, 204, 21, 0.4)', n: 'Yellow' },
  { c: 'rgba(34, 197, 94, 0.28)', n: 'Green' },
  { c: 'rgba(59, 130, 246, 0.26)', n: 'Blue' },
  { c: 'rgba(236, 72, 153, 0.26)', n: 'Pink' },
  { c: 'rgba(249, 115, 22, 0.3)', n: 'Orange' },
];
const DRX_SENTINEL = '#010203';            // used to strip a colour back to default
const DRX_SENTINEL_RGB = 'rgb(1, 2, 3)';

/* ── Sanitiser ── */
const DRX_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'MARK', 'H2', 'H3', 'H4', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE']);
const DRX_DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'FORM', 'HEAD', 'TITLE']);
const DRX_COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;

function drSanitize(html) {
  const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
  const clean = (parent) => {
    [...parent.childNodes].forEach(n => {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1) { n.remove(); return; }
      const tag = n.tagName.toUpperCase();
      if (DRX_DROP.has(tag)) { n.remove(); return; }
      clean(n);
      if (tag === 'FONT') {
        const s = doc.createElement('span');
        const col = (n.getAttribute('color') || '').trim();
        if (DRX_COLOR.test(col)) s.style.color = col;
        while (n.firstChild) s.appendChild(n.firstChild);
        n.replaceWith(s);
        if (!s.getAttribute('style')) s.replaceWith(...s.childNodes);
        return;
      }
      if (!DRX_TAGS.has(tag)) { n.replaceWith(...n.childNodes); return; }
      const st = n.style;
      const color = (st.color || '').trim();
      const bg = (st.backgroundColor || '').trim();
      const fw = (st.fontWeight || '').trim();
      const fs = (st.fontStyle || '').trim();
      const td = ((st.textDecorationLine || st.textDecoration || '') + '').trim();
      const isCheck = tag === 'UL' && n.classList.contains('dr-check');
      const checked = tag === 'LI' && n.hasAttribute('data-checked');
      [...n.attributes].forEach(a => n.removeAttribute(a.name));
      if (color && DRX_COLOR.test(color) && color !== DRX_SENTINEL_RGB) n.style.color = color;
      if (bg && DRX_COLOR.test(bg) && bg !== DRX_SENTINEL_RGB && !/^rgba\([^)]*,\s*0\s*\)$/.test(bg)) n.style.backgroundColor = bg;
      if (tag === 'SPAN') {
        if (fw === 'bold' || +fw >= 600) n.style.fontWeight = '700';
        if (fs === 'italic') n.style.fontStyle = 'italic';
        if (/underline|line-through/.test(td)) n.style.textDecorationLine = td.match(/underline|line-through/g).join(' ');
        if (!n.getAttribute('style')) { n.replaceWith(...n.childNodes); return; }
      }
      if (isCheck) n.className = 'dr-check';
      if (checked) n.setAttribute('data-checked', '1');
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

function drIsHTML(s) {
  return /<(b|strong|i|em|u|s|strike|del|span|mark|font|h[1-6]|p|div|br|ul|ol|li|blockquote)(\s[^>]*)?\/?>/i.test(String(s || ''));
}

/* Plain text / light markdown → editor HTML */
function drMdToHTML(md) {
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = t => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  let out = '', list = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  const open = (t) => { if (list !== t) { close(); out += `<${t}>`; list = t; } };
  lines.forEach(line => {
    let m;
    if ((m = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line))) { close(); const h = m[1].length <= 2 ? 'h2' : 'h3'; out += `<${h}>${inline(m[2]) || '<br>'}</${h}>`; return; }
    if ((m = /^\s*[-*+•](?:\s+(.*))?$/.exec(line))) { open('ul'); out += `<li>${inline(m[1] || '') || '<br>'}</li>`; return; }
    if ((m = /^\s*\d+[.)](?:\s+(.*))?$/.exec(line))) { open('ol'); out += `<li>${inline(m[1] || '') || '<br>'}</li>`; return; }
    if ((m = /^\s*>\s?(.*)$/.exec(line))) { close(); out += `<blockquote>${inline(m[1]) || '<br>'}</blockquote>`; return; }
    close();
    out += `<div>${inline(line) || '<br>'}</div>`;
  });
  close();
  return out;
}

/* Stored content → HTML for the editor */
function drToEditorHTML(content) {
  const s = String(content || '');
  if (!s.trim()) return '';
  return drIsHTML(s) ? drSanitize(s) : drMdToHTML(s);
}

/* Editor → value to store. Plain text when nothing is formatted. */
function drRichValue(el) {
  if (!el) return '';
  const html = drSanitize(el.innerHTML).trim();
  const probe = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
  const formatted = probe.querySelector('b,strong,i,em,u,s,strike,del,span,mark,h2,h3,h4,ul,ol,li,blockquote');
  if (!formatted) return String(el.innerText || el.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return html;
}
window.drSanitize = drSanitize;
window.drToEditorHTML = drToEditorHTML;
window.drRichValue = drRichValue;

/* ── Toolbar markup ── */
function drToolbarHTML(opts = {}) {
  const b = (cmd, inner, title) => `<button type="button" class="dr-toolbar-btn drx-btn" data-cmd="${cmd}" title="${title}" aria-label="${title}">${inner}</button>`;
  const ic = n => `<i data-lucide="${n}" style="width:16px;height:16px"></i>`;
  const sw = (kind, c, n) => `<button type="button" class="drx-sw ${kind === 'hilite' ? 'is-hl' : ''}" data-cmd="${kind}" data-val="${c}" title="${n}" aria-label="${n}" style="${kind === 'hilite' ? `background:${c}` : `--c:${c}`}">${kind === 'hilite' ? 'A' : ''}</button>`;
  return `
    <div class="dr-zone-toolbar drx-toolbar" role="toolbar" aria-label="Formatting">
      ${b('h3', ic('heading'), 'Heading')}
      ${b('bold', '<b>B</b>', 'Bold')}
      ${b('italic', '<i style="font-family:Georgia,serif">I</i>', 'Italic')}
      ${b('underline', '<u>U</u>', 'Underline')}
      ${b('strikeThrough', '<s>S</s>', 'Strikethrough')}
      <span class="drx-sep"></span>
      <button type="button" class="dr-toolbar-btn drx-btn drx-color-btn" data-cmd="palette" title="Text colour and highlight" aria-label="Text colour and highlight">
        <span class="drx-a">A</span><span class="drx-bar"></span>
      </button>
      <span class="drx-sep"></span>
      ${b('insertUnorderedList', ic('list'), 'Bullet list')}
      ${b('insertOrderedList', ic('list-ordered'), 'Numbered list')}
      ${b('check', ic('list-checks'), 'Checklist')}
      ${b('quote', ic('quote'), 'Quote')}
      ${b('clear', ic('remove-formatting'), 'Clear formatting')}
      ${opts.dateStr ? `
      <button type="button" class="dr-toolbar-ai" onmousedown="event.preventDefault();" onclick="insertDiarySummary('${opts.dateStr}')" title="Auto-Summarize Day">✨ Summary</button>
      <button type="button" class="dr-toolbar-btn" id="speechBtn" onmousedown="event.preventDefault();" onclick="toggleSpeechToText()" title="Speak to Write" style="margin-left:4px">${ic('mic')}</button>` : ''}
    </div>
    <div class="drx-palette" hidden>
      <div class="drx-pal-row"><span class="drx-pal-lbl">Text</span>
        <button type="button" class="drx-sw is-none" data-cmd="color" data-val="" title="Default colour" aria-label="Default colour">A</button>
        ${DRX_TEXT.map(x => sw('color', x.c, x.n)).join('')}
      </div>
      <div class="drx-pal-row"><span class="drx-pal-lbl">Highlight</span>
        <button type="button" class="drx-sw is-none" data-cmd="hilite" data-val="" title="No highlight" aria-label="No highlight">⌀</button>
        ${DRX_HILITE.map(x => sw('hilite', x.c, x.n)).join('')}
      </div>
    </div>`;
}
window.drToolbarHTML = drToolbarHTML;

/* ── Commands ── */
let _drxEditor = null;      // editor the bubble/toolbar acts on
let _drxRange = null;       // last selection inside an editor

function _drxEditorFor(el) {
  const zone = el && el.closest && el.closest('.dr-write-zone');
  return (zone && zone.querySelector('.drx-editor')) || _drxEditor;
}
function _drxSelInside(ed) {
  const sel = window.getSelection();
  return sel && sel.rangeCount && ed && ed.contains(sel.getRangeAt(0).commonAncestorContainer);
}
function _drxEnsureSel(ed) {
  if (!ed) return false;
  if (_drxSelInside(ed)) { if (document.activeElement !== ed) { const r = window.getSelection().getRangeAt(0).cloneRange(); ed.focus({ preventScroll: true }); const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); } return true; }
  ed.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (_drxRange && ed.contains(_drxRange.commonAncestorContainer)) { sel.removeAllRanges(); sel.addRange(_drxRange); return true; }
  const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
  return true;
}
function _drxBlock(ed, tag) {
  const sel = window.getSelection();
  let n = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
  while (n && n !== ed) { if (n.nodeType === 1 && n.tagName === tag) return n; n = n.parentNode; }
  return null;
}
function _drxStripSentinel(ed, prop) {
  ed.querySelectorAll('[style]').forEach(el => {
    if ((el.style[prop] || '').replace(/\s/g, '') === DRX_SENTINEL_RGB.replace(/\s/g, '') || (el.style[prop] || '').toLowerCase() === DRX_SENTINEL) {
      el.style[prop] = '';
      if (!el.getAttribute('style')) el.removeAttribute('style');
      if (el.tagName === 'SPAN' && !el.attributes.length) el.replaceWith(...el.childNodes);
    }
  });
  ed.querySelectorAll('font[color]').forEach(f => { if (f.getAttribute('color').toLowerCase() === DRX_SENTINEL) f.replaceWith(...f.childNodes); });
}

/* Chrome moves the caret to the line start when a block command (list,
   heading, quote) re-wraps a line — remember it as text offsets and put it back. */
function _drxSaveCaret(ed) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !ed.contains(sel.getRangeAt(0).commonAncestorContainer)) return null;
  const r = sel.getRangeAt(0), pre = document.createRange();
  pre.selectNodeContents(ed); pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return { start, end: start + r.toString().length };
}
function _drxRestoreCaret(ed, pos) {
  if (!pos) return;
  const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  let n, seen = 0, sN = null, sO = 0, eN = null, eO = 0, last = null;
  while ((n = walker.nextNode())) {
    const len = n.textContent.length;
    if (!sN && pos.start <= seen + len) { sN = n; sO = pos.start - seen; }
    if (!eN && pos.end <= seen + len) { eN = n; eO = pos.end - seen; break; }
    seen += len; last = n;
  }
  if (!sN) { if (!last) return; sN = last; sO = last.textContent.length; }
  if (!eN) { eN = sN; eO = sO; }
  const r = document.createRange();
  try { r.setStart(sN, sO); r.setEnd(eN, eO); } catch (e) { return; }
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
}

function drxRun(cmd, val, srcEl) {
  const ed = _drxEditorFor(srcEl);
  if (!ed) return;
  if (cmd === 'palette') {
    const pal = ed.closest('.dr-write-zone')?.querySelector('.drx-palette');
    if (pal) pal.hidden = !pal.hidden;
    srcEl.classList.toggle('on', pal && !pal.hidden);
    return;
  }
  _drxEnsureSel(ed);
  try { document.execCommand('styleWithCSS', false, true); document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) { }
  const blockCmd = ['h3', 'quote', 'check', 'insertUnorderedList', 'insertOrderedList'].includes(cmd);
  const caret = blockCmd ? _drxSaveCaret(ed) : null;
  switch (cmd) {
    case 'h3': {
      if (_drxBlock(ed, 'LI')) document.execCommand(_drxBlock(ed, 'OL') ? 'insertOrderedList' : 'insertUnorderedList');
      const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      document.execCommand('formatBlock', false, cur === 'h3' || cur === 'h2' ? '<div>' : '<h3>');
      break;
    }
    case 'quote': {
      const inQ = _drxBlock(ed, 'BLOCKQUOTE');
      if (!inQ && _drxBlock(ed, 'LI')) document.execCommand(_drxBlock(ed, 'OL') ? 'insertOrderedList' : 'insertUnorderedList');
      document.execCommand('formatBlock', false, inQ ? '<div>' : '<blockquote>');
      break;
    }
    case 'check': {
      const ul = _drxBlock(ed, 'UL');
      if (ul && ul.classList.contains('dr-check')) { document.execCommand('insertUnorderedList'); break; }
      if (ul) { ul.classList.add('dr-check'); break; }
      if (_drxBlock(ed, 'OL')) document.execCommand('insertOrderedList');
      document.execCommand('insertUnorderedList');
      const nu = _drxBlock(ed, 'UL'); if (nu) nu.classList.add('dr-check');
      break;
    }
    case 'color':
      document.execCommand('foreColor', false, val || DRX_SENTINEL);
      if (!val) _drxStripSentinel(ed, 'color');
      _drxSetBar(ed, val);
      break;
    case 'hilite':
      if (!document.execCommand('hiliteColor', false, val || DRX_SENTINEL)) document.execCommand('backColor', false, val || DRX_SENTINEL);
      if (!val) _drxStripSentinel(ed, 'backgroundColor');
      break;
    case 'clear':
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      break;
    default:
      document.execCommand(cmd, false, null);
  }
  if (caret) _drxRestoreCaret(ed, caret);
  if (cmd === 'color' || cmd === 'hilite') {
    const pal = ed.closest('.dr-write-zone')?.querySelector('.drx-palette');
    if (pal && _drIsPhone()) { pal.hidden = true; ed.closest('.dr-write-zone').querySelector('.drx-color-btn')?.classList.remove('on'); }
  }
  ed.dispatchEvent(new Event('input', { bubbles: true }));
  _drxSyncState();
}
window.drxRun = drxRun;

function _drxSetBar(ed, c) {
  const bar = ed.closest('.dr-write-zone')?.querySelector('.drx-bar');
  if (bar) bar.style.background = c || 'currentColor';
}

function _drxSyncState() {
  const ed = _drxEditor;
  if (!ed || !_drxSelInside(ed)) return;
  const zone = ed.closest('.dr-write-zone');
  const q = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  const fb = String((() => { try { return document.queryCommandValue('formatBlock'); } catch (e) { return ''; } })() || '').toLowerCase();
  const inCheck = !!(_drxBlock(ed, 'UL') && _drxBlock(ed, 'UL').classList.contains('dr-check'));
  const state = {
    bold: q('bold'), italic: q('italic'), underline: q('underline'), strikeThrough: q('strikeThrough'),
    insertUnorderedList: q('insertUnorderedList') && !inCheck, insertOrderedList: q('insertOrderedList'),
    check: inCheck, h3: fb === 'h3' || fb === 'h2', quote: !!_drxBlock(ed, 'BLOCKQUOTE'),
  };
  [zone, _drxBubbleEl].forEach(root => {
    if (!root) return;
    root.querySelectorAll('.drx-btn[data-cmd]').forEach(b => { if (b.dataset.cmd in state) b.classList.toggle('on', !!state[b.dataset.cmd]); });
  });
}

/* ── Floating bubble ── */
let _drxBubbleEl = null;
function _drxBubble() {
  if (_drxBubbleEl) return _drxBubbleEl;
  const el = document.createElement('div');
  el.className = 'drx-bubble';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Format selection');
  el.hidden = true;
  const sw = (kind, c, n) => `<button type="button" class="drx-sw sm ${kind === 'hilite' ? 'is-hl' : ''}" data-cmd="${kind}" data-val="${c}" title="${n}" aria-label="${n}" style="${kind === 'hilite' ? `background:${c}` : `--c:${c}`}">${kind === 'hilite' ? 'A' : ''}</button>`;
  el.innerHTML = `
    <button type="button" class="drx-btn" data-cmd="bold" aria-label="Bold"><b>B</b></button>
    <button type="button" class="drx-btn" data-cmd="italic" aria-label="Italic"><i style="font-family:Georgia,serif">I</i></button>
    <button type="button" class="drx-btn" data-cmd="underline" aria-label="Underline"><u>U</u></button>
    <button type="button" class="drx-btn" data-cmd="strikeThrough" aria-label="Strikethrough"><s>S</s></button>
    <span class="drx-sep"></span>
    ${DRX_TEXT.slice(0, 5).map(x => sw('color', x.c, x.n)).join('')}
    <span class="drx-sep"></span>
    ${DRX_HILITE.slice(0, 3).map(x => sw('hilite', x.c, x.n + ' highlight')).join('')}
    <span class="drx-sep"></span>
    <button type="button" class="drx-btn" data-cmd="clear" aria-label="Clear formatting">✕</button>`;
  document.body.appendChild(el);
  _drxBubbleEl = el;
  return el;
}
function _drxHideBubble() { if (_drxBubbleEl) _drxBubbleEl.hidden = true; }
function _drxPlaceBubble() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return _drxHideBubble();
  const range = sel.getRangeAt(0);
  const ed = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer.closest('.drx-editor') : range.commonAncestorContainer.parentElement?.closest('.drx-editor');
  if (!ed || !sel.toString().trim()) return _drxHideBubble();
  _drxEditor = ed;
  const rect = range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return _drxHideBubble();
  const b = _drxBubble();
  b.hidden = false;
  const bw = b.offsetWidth, bh = b.offsetHeight, vw = window.innerWidth, vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  // On touch the OS copy/paste menu sits above the selection, so go below it.
  let top = touch ? rect.bottom + 12 : rect.top - bh - 10;
  if (top < 8) top = rect.bottom + 12;
  if (top + bh > vh - 8) top = Math.max(8, rect.top - bh - 10);
  let left = rect.left + rect.width / 2 - bw / 2;
  left = Math.max(8, Math.min(left, vw - bw - 8));
  b.style.top = Math.round(top) + 'px';
  b.style.left = Math.round(left) + 'px';
  _drxSyncState();
}

/* ── Global wiring (once) ── */
(function () {
  if (window._drxWired) return;
  window._drxWired = true;
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(_drxPlaceBubble); };

  // Keep focus + selection in the editor when a tool is pressed.
  const keep = e => { if (e.target.closest && e.target.closest('.drx-btn, .drx-sw, .drx-bubble')) e.preventDefault(); };
  document.addEventListener('mousedown', keep, true);
  document.addEventListener('pointerdown', keep, true);

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.drx-btn, .drx-sw');
    if (btn && btn.dataset.cmd) {
      e.preventDefault();
      drxRun(btn.dataset.cmd, btn.dataset.val || '', btn);
      if (btn.closest('.drx-bubble')) schedule();
      return;
    }
    // Checklist: tap the box to tick it.
    const li = e.target.closest && e.target.closest('.drx-editor ul.dr-check > li');
    if (li && e.clientX - li.getBoundingClientRect().left < 30) {
      e.preventDefault();
      if (li.hasAttribute('data-checked')) li.removeAttribute('data-checked'); else li.setAttribute('data-checked', '1');
      li.closest('.drx-editor').dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      const host = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
      const ed = host && host.closest && host.closest('.drx-editor');
      if (ed) { _drxEditor = ed; _drxRange = r.cloneRange(); }
    }
    schedule();
  });

  // A new checklist item shouldn't inherit the tick from the one above.
  document.addEventListener('input', e => {
    if (!e.target.classList || !e.target.classList.contains('drx-editor')) return;
    if (e.inputType === 'insertParagraph') {
      const li = _drxBlock(e.target, 'LI');
      if (li && li.hasAttribute('data-checked') && !li.textContent.trim()) li.removeAttribute('data-checked');
    }
  });

  // Keyboard shortcuts for underline / strike (bold & italic are native).
  document.addEventListener('keydown', e => {
    if (!e.target.classList || !e.target.classList.contains('drx-editor')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); drxRun('strikeThrough', '', e.target); }
    if (mod && e.altKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) { e.preventDefault(); drxRun('h3', '', e.target); }
    if (e.key === 'Escape') _drxHideBubble();
  });

  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.classList || !document.activeElement.classList.contains('drx-editor')) _drxHideBubble(); }, 120));

  const st = document.createElement('style');
  st.id = 'drxStyles';
  st.textContent = `
.drx-toolbar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.drx-toolbar::-webkit-scrollbar { display: none; }
.drx-toolbar > * { flex-shrink: 0; }
.drx-toolbar .dr-toolbar-ai { margin-left: auto; }
.drx-sep { width: 1px; height: 20px; background: var(--border-color); margin: 0 4px; flex: none; display: inline-block; }
.dr-toolbar-btn.drx-btn.on { background: rgba(79,70,229,.1); color: var(--primary); }
.drx-color-btn { position: relative; flex-direction: column; gap: 1px; }
.drx-color-btn .drx-a { font-size: 14px; font-weight: 800; line-height: 1; }
.drx-color-btn .drx-bar { width: 16px; height: 3px; border-radius: 2px; background: currentColor; }
.drx-palette { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border-color); background: var(--surface-1); flex-shrink: 0; }
.drx-palette[hidden] { display: none; }
.drx-pal-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.drx-pal-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--text-3); width: 64px; flex: none; }
.drx-sw { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--border-color); background: var(--c, transparent); cursor: pointer; padding: 0; flex: none;
  display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: var(--text-1); -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: transform .12s; }
.drx-sw:not(.is-hl):not(.is-none) { border-color: transparent; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.drx-sw.is-hl { border-radius: 7px; border-color: transparent; }
.drx-sw.is-none { background: var(--surface-2); color: var(--text-2); }
.drx-sw:active { transform: scale(.88); }
@media (pointer: coarse) { .drx-palette .drx-sw { width: 32px; height: 32px; } }
.drx-bubble { position: fixed; z-index: 100000; display: flex; align-items: center; gap: 3px; padding: 5px 6px; border-radius: 12px; background: var(--surface-1); border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.08); max-width: calc(100vw - 16px); overflow-x: auto; scrollbar-width: none; animation: drxPop .12s ease-out; }
.drx-bubble[hidden] { display: none; }
.drx-bubble::-webkit-scrollbar { display: none; }
@keyframes drxPop { from { opacity: 0; transform: translateY(4px) scale(.97); } to { opacity: 1; transform: none; } }
.drx-bubble .drx-btn { width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; color: var(--text-1); font-size: 14px; cursor: pointer; flex: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.drx-bubble .drx-btn.on { background: rgba(79,70,229,.1); color: var(--primary); }
.drx-bubble .drx-btn:active { background: var(--surface-2); }
.drx-bubble .drx-sw.sm { width: 22px; height: 22px; font-size: 11px; }
.drx-bubble .drx-sep { height: 18px; margin: 0 2px; }
.drx-editor h2 { font-size: 1.3em; font-weight: 800; line-height: 1.3; margin: .55em 0 .2em; letter-spacing: -.3px; }
.drx-editor h3 { font-size: 1.12em; font-weight: 750; line-height: 1.35; margin: .55em 0 .15em; letter-spacing: -.2px; }
.drx-editor h2:first-child, .drx-editor h3:first-child { margin-top: 0; }
.drx-editor ul, .drx-editor ol { padding-left: 1.4em; margin: .25em 0; }
.drx-editor blockquote { margin: .4em 0; padding: 2px 0 2px 12px; border-left: 3px solid var(--primary); color: var(--text-2); font-style: italic; }
.drx-editor ul.dr-check { list-style: none; padding-left: 2px; }
.drx-editor ul.dr-check > li { position: relative; padding-left: 28px; }
.drx-editor ul.dr-check > li::before { content: ''; position: absolute; left: 0; top: .32em; width: 17px; height: 17px; box-sizing: border-box; border: 1.8px solid var(--text-3); border-radius: 5px; cursor: pointer; }
.drx-editor ul.dr-check > li[data-checked]::before { content: '✓'; background: var(--primary); border-color: var(--primary); color: #fff; font-size: 12px; font-weight: 800; line-height: 14px; text-align: center; }
.drx-editor ul.dr-check > li[data-checked] { color: var(--text-3); text-decoration: line-through; }
.drx-tpl-zone { margin: 4px 0 0; min-height: 260px; }
.drx-tpl-zone .drx-editor { min-height: 200px; border: none; border-radius: 0; }
`;
  document.head.appendChild(st);
})();
