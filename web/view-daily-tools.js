/* ============================================================================
   DAILY LIFE TOOLS — a hub page that groups the standalone tools (Books, Mural,
   Chimes, Gym, Notes, Pomodoro) into one tab. Each card routes to its tool view.
   ============================================================================ */

const DAILY_TOOLS = [
    {
        view: 'books', name: 'Books', sub: 'Reading library & summaries', accent: '#6366F1',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
    },
    {
        view: 'mural', name: 'Mural', sub: 'Infinite idea canvas', accent: '#EC4899',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.948.742-1.688 1.668-1.688h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
    },
    {
        view: 'chimes', name: 'Chimes', sub: 'Mindful bells & sounds', accent: '#0EA5E9',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>'
    },
    {
        view: 'gym', name: 'Gym', sub: 'Workouts & exercises', accent: '#10B981',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>'
    },
    {
        view: 'notes', name: 'Notes', sub: 'Quick notes & scratchpad', accent: '#F59E0B',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>'
    },
    {
        view: 'pomodoro', name: 'Pomodoro', sub: 'Focus timer sessions', accent: '#EF4444',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="12" y2="9"/><circle cx="12" cy="14" r="8"/></svg>'
    },
    {
        view: 'wishlist', name: 'Wishlist', sub: 'Things you want · buy, do, gift', accent: '#8B5CF6',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
    },
    {
        view: 'meals', name: 'Food Planner', sub: 'Plan meals · track energy & mood', accent: '#16A34A',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h0c1.1 0 2-.9 2-2V2"/><path d="M5 2v20"/><path d="M19 2v7c0 1.5-1 2.5-2.5 2.5S14 10.5 14 9V2"/><path d="M19 2v20"/></svg>'
    }
];

const DAILY_TOOLS_CSS = `<style>
.dlt-wrap { max-width:1100px; margin:0 auto; }
.dlt-intro { font-size:14px; color:var(--text-3); margin:2px 0 18px; }
.dlt-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; }
@media (max-width:900px){ .dlt-grid { grid-template-columns:repeat(2, 1fr); } }
@media (max-width:560px){ .dlt-grid { grid-template-columns:1fr; gap:12px; } }
.dlt-card {
    display:flex; align-items:center; gap:14px; text-align:left;
    padding:18px; border:1px solid var(--border-color); border-radius:16px;
    background:var(--surface-1); box-shadow:var(--shadow-card); cursor:pointer;
    font:inherit; color:var(--text-1); transition:transform .14s ease, box-shadow .14s ease, border-color .14s ease;
}
.dlt-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); border-color:var(--border-strong); }
.dlt-card:active { transform:translateY(0); }
.dlt-ic {
    width:48px; height:48px; flex-shrink:0; border-radius:13px;
    display:flex; align-items:center; justify-content:center;
    background:color-mix(in srgb, var(--dlt-accent) 14%, transparent); color:var(--dlt-accent);
}
.dlt-ic svg { width:24px; height:24px; }
.dlt-meta { min-width:0; flex:1; }
.dlt-name { font-size:16px; font-weight:700; letter-spacing:-.01em; }
.dlt-sub { font-size:12.5px; color:var(--text-3); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dlt-go { color:var(--text-3); flex-shrink:0; }
</style>`;

function renderDailyTools() {
    const cards = DAILY_TOOLS.map(t => `
        <button class="dlt-card" style="--dlt-accent:${t.accent}" onclick="routeTo('${t.view}')">
            <span class="dlt-ic">${t.icon}</span>
            <span class="dlt-meta">
                <span class="dlt-name">${t.name}</span>
                <span class="dlt-sub">${t.sub}</span>
            </span>
            <span class="dlt-go"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>`).join('');

    document.getElementById('main').innerHTML = `
        ${DAILY_TOOLS_CSS}
        <div class="dlt-wrap">
            <p class="dlt-intro">Everyday tools, all in one place.</p>
            <div class="dlt-grid">${cards}</div>
        </div>`;
}
window.renderDailyTools = renderDailyTools;
