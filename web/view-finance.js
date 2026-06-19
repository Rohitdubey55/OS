/* view-finance.js */

let finState = 'expenses'; // 'expenses', 'income', 'funds', 'assets'
let finRange = 'week';    // 'week', 'month', 'year'

/* Finance desktop refinement — scoped to .fin-pro (no double heading; Add New
   lives in the app header bar; KPI overview + two-pane with an insights rail). */
const FINANCE_REFINE_CSS = `<style>
.fin-pro { max-width:1340px; margin:0 auto; }
.fin-pro .fin-nav { background:var(--surface-2); border:1px solid var(--border-color); border-radius:10px; padding:4px; display:inline-flex; gap:2px; width:fit-content; margin-bottom:18px; }
.fin-pro .fin-tab { border:none; background:transparent; padding:8px 16px; border-radius:7px; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; display:inline-flex; align-items:center; }
.fin-pro .fin-tab.active { background:var(--surface-1); color:var(--text-1); box-shadow:var(--shadow-xs); }
.fin-pro .fin-range { background:var(--surface-2); border:1px solid var(--border-color); border-radius:9px; padding:3px; display:inline-flex; gap:2px; }
.fin-pro .fin-range .range-btn { border:none; background:transparent; padding:6px 14px; border-radius:7px; font-size:12.5px; font-weight:550; color:var(--text-3); cursor:pointer; }
.fin-pro .fin-range .range-btn.active { background:var(--surface-1); color:var(--text-1); box-shadow:var(--shadow-xs); }
.fin-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
.fin-kpi { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:14px 16px; }
.fin-kpi .k-l { font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); font-weight:600; }
.fin-kpi .k-v { font-size:22px; font-weight:700; letter-spacing:-.02em; color:var(--text-1); font-variant-numeric:tabular-nums; margin-top:4px; }
.fin-workspace { display:flex; gap:20px; align-items:flex-start; }
.fin-main { flex:1; min-width:0; }
.fin-rail { flex:0 0 320px; position:sticky; top:12px; display:flex; flex-direction:column; gap:13px; }
.fin-pro .dash-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:16px; }
.fin-sec-h { font-size:13px; font-weight:700; color:var(--text-1); margin:0 0 12px; }
.fin-pro .transaction-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:11px; box-shadow:var(--shadow-xs); padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; gap:14px; cursor:pointer; transition:box-shadow .14s ease, border-color .14s ease; }
.fin-pro .transaction-card:hover { box-shadow:var(--shadow-sm); border-color:var(--border-strong); }
.fin-pro .transaction-date { font-size:12px; color:var(--text-3); font-variant-numeric:tabular-nums; min-width:52px; }
.fin-pro .transaction-details { flex:1; min-width:0; }
.fin-pro .transaction-amount { font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
.fin-pro .empty-state { text-align:center; color:var(--text-3); font-size:13.5px; padding:30px 0; }
.finr-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:15px; }
.finr-h { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); font-weight:700; margin:0 0 12px; }
.finr-cat { margin-bottom:11px; }
.finr-cat:last-child { margin-bottom:0; }
.finr-cat-top { display:flex; justify-content:space-between; gap:8px; font-size:12.5px; color:var(--text-2); margin-bottom:5px; }
.finr-cat-top span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.finr-cat-top b { color:var(--text-1); font-variant-numeric:tabular-nums; flex-shrink:0; }
.finr-bar { height:6px; background:var(--surface-3); border-radius:999px; overflow:hidden; }
.finr-bar i { display:block; height:100%; background:var(--primary); border-radius:999px; }
.finr-empty { font-size:12.5px; color:var(--text-3); }
/* Unified "Add to Finance" type selector (in the modal — global, not scoped to .fin-pro) */
.fin-add-segs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:4px 0 16px; }
.fin-add-seg { border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); padding:9px 6px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; transition:background .14s ease, color .14s ease, border-color .14s ease; }
.fin-add-seg:hover { border-color:var(--border-strong); color:var(--text-1); }
.fin-add-seg.active { background:var(--primary); border-color:var(--primary); color:#fff; box-shadow:var(--shadow-sm); }
@media (max-width:1099px){
  .fin-pro { max-width:none; }
  .fin-kpis { grid-template-columns:repeat(2,1fr); }
  .fin-workspace { display:block; }
  .fin-rail { display:none; }
}
</style>`;

function renderFinance() {
  const main = document.getElementById('main');

  main.innerHTML = `
    <div class="finance-wrapper fin-pro">
      ${FINANCE_REFINE_CSS}
      <div class="fin-nav">
        <button class="fin-tab ${finState === 'expenses' ? 'active' : ''}" onclick="switchFinTab('expenses')">${renderIcon('wallet', null, 'style="width:16px; margin-right:6px"')} Expenses</button>
        <button class="fin-tab ${finState === 'income' ? 'active' : ''}" onclick="switchFinTab('income')">${renderIcon('chart', null, 'style="width:16px; margin-right:6px"')} Income</button>
        <button class="fin-tab ${finState === 'funds' ? 'active' : ''}" onclick="switchFinTab('funds')">${renderIcon('target', null, 'style="width:16px; margin-right:6px"')} Funds</button>
        <button class="fin-tab ${finState === 'assets' ? 'active' : ''}" onclick="switchFinTab('assets')">${renderIcon('landmark', null, 'style="width:16px; margin-right:6px"')} Assets</button>
      </div>

      <div id="finance-content"></div>
    </div>


  `;

  renderFinanceContent();
}

function switchFinTab(tab) {
  finState = tab;
  renderFinance();
}

function switchFinRange(range) {
  finRange = range;
  renderFinanceContent();
}

function renderFinanceContent() {
  const container = document.getElementById('finance-content');
  container.innerHTML = '';

  if (finState === 'expenses') renderFinExpenses(container);
  else if (finState === 'income') renderFinIncome(container);
  else if (finState === 'funds') renderFinFunds(container);
  else if (finState === 'assets') renderFinAssets(container);
}

/* --- UNIFIED "ADD TO FINANCE" MODAL ---
   One Add button, four things you can add. A type selector at the top switches
   between Expense / Income / Fund / Asset so you're never limited by the tab
   you happen to be on. Defaults to the current tab's type. */
window.openFinanceAction = function (preferredType) {
  const map = { expenses: 'expense', income: 'income', funds: 'fund', assets: 'asset' };
  const valid = ['expense', 'income', 'fund', 'asset'];
  window._finAddType = valid.includes(preferredType) ? preferredType : (map[finState] || 'expense');
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = _finAddModalHTML(window._finAddType);
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Switch the form when the user picks a different type in the selector.
window._finSetAddType = function (type) {
  window._finAddType = type;
  const box = document.querySelector('#universalModal .modal-box');
  if (box) box.innerHTML = _finAddModalHTML(type);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Per-expense budget scope picker (Weekly = day-to-day, Monthly = big bill).
// Weekly expenses count toward the weekly budget + the monthly total; monthly
// ones count toward the monthly total only. Read on save via input[name=mTxScope].
function _finScopeRadioHTML(selected) {
  const sel = selected === 'monthly' ? 'monthly' : 'weekly';
  const opt = (val, title, sub) => `
      <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; cursor:pointer;">
        <input type="radio" name="mTxScope" value="${val}" ${sel === val ? 'checked' : ''} style="margin:0; accent-color:var(--primary)">
        <span><b>${title}</b> <span style="color:var(--text-muted); font-size:12px">· ${sub}</span></span>
      </label>`;
  return `
    <div style="margin-top:12px">
      <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px">Counts toward budget</div>
      <div style="display:flex; gap:10px">
        ${opt('weekly', 'Weekly', 'day-to-day')}
        ${opt('monthly', 'Monthly', 'big bill')}
      </div>
    </div>`;
}

function _finAddModalHTML(type) {
  const labels = { expense: 'Expense', income: 'Income', fund: 'Fund', asset: 'Asset' };
  const segs = ['expense', 'income', 'fund', 'asset'].map(t =>
    `<button type="button" class="fin-add-seg ${type === t ? 'active' : ''}" onclick="_finSetAddType('${t}')">${labels[t]}</button>`
  ).join('');

  let body = '', save = '';
  if (type === 'expense' || type === 'income') {
    const categories = getAllFinanceCategories();
    body = `
      <input type="hidden" id="mTxType" value="${type}">
      <input type="date" class="input" id="mTxDate" value="${new Date().toISOString().slice(0, 10)}">
      <input type="number" class="input" id="mTxAmount" placeholder="Amount (₹)" style="margin-top:10px">
      <select class="input" id="mTxCategory" style="margin-top:10px; width:100%">
          <option value="">Select Category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      ${type === 'expense' ? _finScopeRadioHTML('weekly') : ''}
      <input class="input" id="mTxNote" placeholder="Note (optional — e.g. 'Birthday dinner')" style="margin-top:10px">`;
    save = `<button class="btn primary" data-action="save-tx-modal">Save ${labels[type]}</button>`;
  } else if (type === 'fund') {
    body = `
      <input class="input" id="mFundName" placeholder="Fund Name (e.g. New Laptop)">
      <input type="number" class="input" id="mFundTarget" placeholder="Target Amount (₹)" style="margin-top:10px">
      <input type="number" class="input" id="mFundCurrent" placeholder="Current Savings (₹)" style="margin-top:10px">`;
    save = `<button class="btn primary" data-action="save-fund-modal">Save Goal</button>`;
  } else { // asset
    body = `
      <input class="input" id="mAssetName" placeholder="Asset Name (e.g. Gold, Stocks)">
      <select class="input" id="mAssetType" style="margin-top:10px">
         <option value="Cash">Cash</option>
         <option value="Investment">Investment</option>
         <option value="Property">Property</option>
      </select>
      <input type="number" class="input" id="mAssetValue" placeholder="Current Value (₹)" style="margin-top:10px">`;
    save = `<button class="btn primary" data-action="save-asset-modal">Save Asset</button>`;
  }

  return `
    <h3 style="margin-bottom:4px">Add to Finance</h3>
    <div class="fin-add-segs">${segs}</div>
    ${body}
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      ${save}
    </div>`;
}

/* --- TAB 1: EXPENSES (Hierarchical View) --- */

// Helper function to get Monday and Sunday of the current week
function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// ── Weekly evaluation widgets ──────────────────────────────────────────────
// Weekly mode is about the day-to-day budget, so instead of Income/Net/Savings
// and a duplicate category list we compute pace, a daily chart, a week-over-week
// trend and the biggest expenses — all from weekly-scoped expenses.
function _finWeeklyStats(expenseItems, totalExp, weeklyBudget, weekBounds, now, allExpenses) {
  const dow = now.getDay();                  // 0 Sun .. 6 Sat
  const daysElapsed = dow === 0 ? 7 : dow;   // Mon=1 .. Sun=7
  const daysLeft = 7 - daysElapsed;
  const left = weeklyBudget - totalExp;
  const dailyAvg = daysElapsed > 0 ? totalExp / daysElapsed : totalExp;
  const projected = Math.round(dailyAvg * 7);
  const safePerDay = daysLeft > 0 ? Math.max(0, left) / daysLeft : 0;

  const dayTotals = [0, 0, 0, 0, 0, 0, 0];   // index 0 = Monday … 6 = Sunday
  expenseItems.forEach(e => {
    const wd = new Date(e.date).getDay();
    dayTotals[wd === 0 ? 6 : wd - 1] += Number(e.amount) || 0;
  });

  // Same window, one week earlier — weekly-scoped expenses only.
  const lwStart = new Date(weekBounds.start); lwStart.setDate(lwStart.getDate() - 7);
  const lwEnd = new Date(weekBounds.end); lwEnd.setDate(lwEnd.getDate() - 7);
  const lastWeekTotal = (allExpenses || []).reduce((s, e) => {
    if (e.type !== 'expense' || e.budget_scope !== 'weekly') return s;
    const d = new Date(e.date);
    return (d >= lwStart && d <= lwEnd) ? s + (Number(e.amount) || 0) : s;
  }, 0);

  const biggest = [...expenseItems].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 4);

  return { daysElapsed, daysLeft, left, dailyAvg, projected, safePerDay, dayTotals, lastWeekTotal, biggest };
}

function _finWeeklyRailHTML(s, totalExp, weeklyBudget) {
  const onTrack = weeklyBudget <= 0 || s.projected <= weeklyBudget;
  const dayMax = Math.max(...s.dayTotals, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const paceCard = `
    <div class="finr-card">
      <div class="finr-h">Pace</div>
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px">Day ${s.daysElapsed} of 7</div>
      ${s.daysLeft > 0
        ? `<div style="font-size:22px; font-weight:800; color:var(--text-1); line-height:1">₹${Math.round(s.safePerDay).toLocaleString()}<span style="font-size:12px; font-weight:600; color:var(--text-muted)"> /day</span></div>
           <div style="font-size:12px; color:var(--text-muted); margin-top:2px">safe to spend for ${s.daysLeft} more day${s.daysLeft > 1 ? 's' : ''}</div>`
        : `<div style="font-size:13px; color:var(--text-muted)">Week complete</div>`}
      <div style="margin-top:10px; font-size:12.5px; color:var(--text-muted)">Projected: <b style="color:${onTrack ? 'var(--success)' : 'var(--danger)'}">₹${s.projected.toLocaleString()}</b> / ₹${weeklyBudget.toLocaleString()}</div>
      <div style="margin-top:8px"><span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; background:${onTrack ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'color-mix(in srgb, var(--danger) 16%, transparent)'}; color:${onTrack ? 'var(--success)' : 'var(--danger)'}">${onTrack ? 'On track' : 'Over pace'}</span></div>
    </div>`;

  const chartCard = `
    <div class="finr-card">
      <div class="finr-h">Daily spend</div>
      <div style="display:flex; align-items:flex-end; gap:6px; margin-top:8px;">
        ${s.dayTotals.map((v, i) => {
          const h = v > 0 ? Math.max(4, Math.round((v / dayMax) * 64)) : 0;
          const isToday = i === (s.daysElapsed - 1);
          return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div style="width:100%; height:64px; display:flex; align-items:flex-end;"><div title="₹${Math.round(v).toLocaleString()}" style="width:100%; height:${h}px; background:${isToday ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 35%, transparent)'}; border-radius:4px 4px 0 0;"></div></div>
            <div style="font-size:10px; color:var(--text-muted)">${dayLabels[i]}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  let trendLine;
  if (s.lastWeekTotal > 0) {
    const diff = totalExp - s.lastWeekTotal;
    const pct = Math.round(Math.abs(diff) / s.lastWeekTotal * 100);
    const down = diff <= 0;
    trendLine = `<div style="margin-top:8px; font-size:13px; font-weight:700; color:${down ? 'var(--success)' : 'var(--danger)'}">${down ? '▼' : '▲'} ${pct}% ${down ? 'less' : 'more'} than last week</div>`;
  } else {
    trendLine = `<div style="margin-top:8px; font-size:12px; color:var(--text-muted)">No data last week</div>`;
  }
  const trendCard = `
    <div class="finr-card">
      <div class="finr-h">vs last week</div>
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px"><span style="color:var(--text-muted)">This week</span><b>₹${Math.round(totalExp).toLocaleString()}</b></div>
      <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted)">Last week</span><b>₹${Math.round(s.lastWeekTotal).toLocaleString()}</b></div>
      ${trendLine}
    </div>`;

  const biggestCard = `
    <div class="finr-card">
      <div class="finr-h">Biggest this week</div>
      ${s.biggest.length
        ? s.biggest.map(e => `<div class="finr-cat"><div class="finr-cat-top"><span>${escapeHtml(e.category || 'Uncategorized')}${e.description ? ' · ' + escapeHtml(e.description) : ''}</span><b>₹${Number(e.amount).toLocaleString()}</b></div></div>`).join('')
        : '<div class="finr-empty">No spending yet.</div>'}
    </div>`;

  return paceCard + chartCard + trendCard + biggestCard;
}

function renderFinExpenses(container) {
  const allExpenses = state.data.expenses || [];
  const settings = state.data.settings?.[0] || {};
  const now = new Date();
  const weekBounds = getWeekBounds(now);

  // Parse Budgets - use separate fields, not calculated from categories
  const monthlyBudget = Number(settings.monthly_budget) || 0;
  const weeklyBudget = Number(settings.weekly_budget) || 0;

  let categoryBudgets = {};
  try {
    if (settings.category_budgets) categoryBudgets = JSON.parse(settings.category_budgets);
  } catch (e) { console.error("Invalid category budget JSON", e); }

  // Filter Logic
  const filtered = allExpenses.filter(e => {
    const d = new Date(e.date);
    // Weekly View: Show only weekly expenses from current week (Mon-Sun)
    if (finRange === 'week') {
      // Weekly budget = only expenses tagged "weekly" (day-to-day), within the
      // current week. Big/monthly bills (budget_scope === 'monthly') never count
      // here. Legacy expenses with no scope yet are treated as monthly so they
      // don't flood the weekly budget until you re-tag them. Income isn't scoped.
      if (e.type === 'expense' && e.budget_scope !== 'weekly') return false;

      // Filter by current week (Monday-based)
      return d >= weekBounds.start && d <= weekBounds.end;
    }
    else if (finRange === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    else if (finRange === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });

  const expenseItems = filtered.filter(e => e.type === 'expense');
  const incomeItems = filtered.filter(e => e.type === 'income');
  const totalExp = expenseItems.reduce((s, e) => s + Number(e.amount), 0);
  const totalInc = incomeItems.reduce((s, e) => s + Number(e.amount), 0);

  // Category Breakdown
  const catSpent = {};
  expenseItems.forEach(e => { catSpent[e.category] = (catSpent[e.category] || 0) + Number(e.amount); });

  const net = totalInc - totalExp;
  const funds = state.data.funds || [];
  const fundsTotal = funds.reduce((s, f) => s + Number(f.current_amount || f.balance || 0), 0);
  const catEntries = Object.entries(catSpent).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catMax = catEntries.length ? catEntries[0][1] : 1;
  const catBars = catEntries.map(([c, v]) => `<div class="finr-cat"><div class="finr-cat-top"><span>${escapeHtml(c || 'Uncategorized')}</span><b>₹${Number(v).toLocaleString()}</b></div><div class="finr-bar"><i style="width:${Math.round(v / catMax * 100)}%"></i></div></div>`).join('');
  const fundsRail = funds.slice(0, 5).map(f => { const cur = Number(f.current_amount || f.balance || 0); const tgt = Number(f.target_amount || 0); const pct = tgt > 0 ? Math.min(100, Math.round(cur / tgt * 100)) : 0; return `<div class="finr-cat"><div class="finr-cat-top"><span>${escapeHtml(f.fund_name || f.name || 'Fund')}</span><b>₹${cur.toLocaleString()}</b></div>${tgt > 0 ? `<div class="finr-bar"><i style="width:${pct}%"></i></div>` : ''}</div>`; }).join('');

  // Weekly mode swaps the generic KPIs (Income/Net/Savings are meaningless for a
  // day-to-day budget) for budget-pace metrics, and swaps the rail for evaluation
  // cards. Monthly/Yearly keep the original KPIs + rail.
  const wk = finRange === 'week'
    ? _finWeeklyStats(expenseItems, totalExp, weeklyBudget, weekBounds, now, allExpenses)
    : null;

  const kpisHTML = (finRange === 'week')
    ? `
      <div class="fin-kpi"><div class="k-l">Spent</div><div class="k-v" style="color:#B42318">₹${totalExp.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Left</div><div class="k-v" style="color:${wk.left >= 0 ? 'var(--success,#10B981)' : '#B42318'}">${wk.left < 0 ? '-' : ''}₹${Math.abs(Math.round(wk.left)).toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Daily avg</div><div class="k-v">₹${Math.round(wk.dailyAvg).toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Projected</div><div class="k-v" style="color:${(weeklyBudget <= 0 || wk.projected <= weeklyBudget) ? 'var(--success,#10B981)' : '#B42318'}">₹${wk.projected.toLocaleString()}</div></div>`
    : `
      <div class="fin-kpi"><div class="k-l">Spent</div><div class="k-v" style="color:#B42318">₹${totalExp.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Income</div><div class="k-v" style="color:var(--success,#10B981)">₹${totalInc.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Net</div><div class="k-v" style="color:${net >= 0 ? 'var(--success,#10B981)' : '#B42318'}">${net < 0 ? '-' : ''}₹${Math.abs(net).toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Savings</div><div class="k-v">₹${fundsTotal.toLocaleString()}</div></div>`;

  const railHTML = (finRange === 'week')
    ? _finWeeklyRailHTML(wk, totalExp, weeklyBudget)
    : `<div class="finr-card"><div class="finr-h">Top categories</div>${catBars || '<div class="finr-empty">No spending in this period.</div>'}</div>
       <div class="finr-card"><div class="finr-h">Savings</div>${fundsRail || '<div class="finr-empty">No funds yet.</div>'}</div>`;

  // Render
  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-bottom:18px;">
      <div class="fin-range">
        <button class="range-btn ${finRange === 'week' ? 'active' : ''}" onclick="switchFinRange('week')">Weekly</button>
        <button class="range-btn ${finRange === 'month' ? 'active' : ''}" onclick="switchFinRange('month')">Monthly</button>
        <button class="range-btn ${finRange === 'year' ? 'active' : ''}" onclick="switchFinRange('year')">Yearly</button>
      </div>
    </div>

    <div class="fin-kpis">${kpisHTML}</div>

    <div class="fin-workspace">
      <div class="fin-main">
        ${(finRange === 'month' || finRange === 'week') ? `<div style="margin-bottom:18px;">${finRange === 'month' ? renderMonthlyOverview(totalExp, monthlyBudget, catSpent, categoryBudgets) : renderWeeklyOverview(totalExp, weeklyBudget, catSpent, categoryBudgets)}</div>` : ''}
        <div class="transactions-list">
          <h3 class="fin-sec-h">Recent transactions</h3>
          ${expenseItems.length === 0 ? '<div class="empty-state">No transactions in this period.</div>' : ''}
          ${expenseItems.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15).map(renderTransactionCard).join('')}
        </div>
      </div>
      <aside class="fin-rail">${railHTML}</aside>
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function renderMonthlyOverview(totalExp, limit, catSpent, catLimits) {
  const pct = limit > 0 ? Math.min(100, (totalExp / limit) * 100) : 0;
  const color = pct > 100 ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--success)');

  // Get all categories from both limits and spending
  const definedCats = Object.keys(catLimits || {});
  const spentCats = Object.keys(catSpent || {});
  const allCats = [...new Set([...definedCats, ...spentCats])];

  const rows = allCats.map(c => {
    const spent = Number(catSpent?.[c] || 0);
    // Handle both old format (number) and new format (object)
    const catData = catLimits?.[c];
    const climit = (typeof catData === 'object' && catData !== null) ? Number(catData.budget) || 0 : Number(catData) || 0;
    return { c, spent, climit };
  }).filter(r => r.spent > 0 || r.climit > 0);

  // Skip a breakdown that's just one category equal to the total (it duplicates the overall bar).
  const redundant = rows.length === 1 && Math.round(rows[0].spent) === Math.round(totalExp);
  const catHtml = redundant ? '' : rows.map(({ c, spent, climit }) => {
    const cpct = climit > 0 ? Math.min(100, (spent / climit) * 100) : (spent > 0 ? 100 : 0);
    const ccolor = (climit > 0 && spent > climit) ? 'var(--danger)' : 'var(--primary)';
    return `
        <div style="margin-bottom:12px; cursor:pointer;" onclick="showCategoryExpenses('${c}')" class="fin-cat-item">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
                <span style="font-weight:600">${escapeHtml(c)}</span>
                <span>₹${spent.toLocaleString()} ${climit ? '/ ₹' + climit.toLocaleString() : ''}</span>
            </div>
            <div style="height:6px; background:var(--surface-3); border-radius:3px; overflow:hidden">
                <div style="height:100%; width:${cpct}%; background:${ccolor}; transition: width 0.3s"></div>
            </div>
        </div>`;
  }).join('');

  // Balance = budget − spend (how much is left this month).
  const balance = Number(limit) - Number(totalExp);
  const balColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
  const balText = balance >= 0 ? `₹${balance.toLocaleString()} left` : `₹${Math.abs(balance).toLocaleString()} over`;

  return `
    <div class="dash-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
             <div class="stat-label">${renderIcon('calendar', null, 'style="width:14px; margin-right:6px; display:inline-block"')} Monthly Overview</div>
             <div class="stat-val" style="font-size:1.2em">₹${Number(totalExp).toLocaleString()} <span style="font-size:0.6em; color:var(--text-muted)">/ ₹${Number(limit || 0).toLocaleString()}</span></div>
        </div>

        <div class="progress-bg" style="height:10px; margin-bottom:10px; background:var(--surface-3); border-radius:5px; overflow:hidden">
             <div class="progress-fill" style="width:${pct}%; background:${color}; transition: width 0.3s"></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:16px;">
             <span style="font-size:12.5px; color:var(--text-muted)">Balance</span>
             <span style="font-size:17px; font-weight:700; color:${balColor}">${balText}</span>
        </div>

        ${catHtml ? `
        <div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px;">
             <div style="font-size:11px; font-weight:700; margin-bottom:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px">Category Breakdown</div>
             <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
                 ${catHtml}
             </div>
        </div>` : ''}
    </div>`;
}

function renderWeeklyOverview(totalExp, limit, catSpent = {}, catLimits = {}) {
  const now = new Date();
  const weekBounds = getWeekBounds(now);
  const mondayStr = weekBounds.start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const sundayStr = weekBounds.end.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const pct = limit > 0 ? Math.min(100, (totalExp / limit) * 100) : 0;
  const color = pct > 100 ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--success)');

  // Per-category breakdown of THIS WEEK's day-to-day spending. catSpent is already
  // limited to weekly-scoped expenses in the current week, so just show whatever
  // categories appear there. (Category limits are monthly, so we don't compare
  // weekly spend against them here — that would mix periods.)
  const rows = Object.keys(catSpent || {})
    .map(c => ({ c, spent: Number(catSpent[c] || 0) }))
    .filter(r => r.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // If the only category equals the whole weekly spend, its bar just repeats the
  // overall bar above — skip it so we don't show a duplicate.
  const redundant = rows.length === 1 && Math.round(rows[0].spent) === Math.round(totalExp);
  const catMax = rows.length ? Math.max(...rows.map(r => r.spent)) : 1;
  const catHtml = redundant ? '' : rows.map(({ c, spent }) => {
    const cpct = Math.min(100, (spent / catMax) * 100);
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="font-weight:600">${escapeHtml(c)}</span><span>₹${spent.toLocaleString()}</span></div><div class="progress-bg" style="height:6px"><div class="progress-fill" style="width:${cpct}%;background:var(--primary)"></div></div></div>`;
  }).join('');

  // Balance = budget − spend (how much is left this week).
  const balance = Number(limit) - Number(totalExp);
  const balColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
  const balText = balance >= 0 ? `₹${balance.toLocaleString()} left` : `₹${Math.abs(balance).toLocaleString()} over`;

  return `
     <div class="dash-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
             <div class="stat-label">${renderIcon('priority', null, 'style="width:14px; margin-right:6px; display:inline-block"')} Weekly Budget (${mondayStr} - ${sundayStr})</div>
             <div class="stat-val" style="font-size:1.2em">₹${totalExp.toLocaleString()} <span style="font-size:0.6em; color:var(--text-muted)">/ ₹${Number(limit).toLocaleString()}</span></div>
        </div>
        <div class="progress-bg" style="height:8px;">
             <div class="progress-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:10px;">
             <span style="font-size:12.5px; color:var(--text-muted)">Balance</span>
             <span style="font-size:17px; font-weight:700; color:${balColor}">${balText}</span>
        </div>
        ${catHtml ? `<div style="margin-top:14px; border-top:1px solid var(--border-color); padding-top:12px;">${catHtml}</div>` : ''}
        <div style="font-size:12px; margin-top:8px; color:var(--text-muted)">
            Only day-to-day (weekly) expenses; monthly bills are excluded.
        </div>
    </div>`;
}

/* --- TAB 2: INCOME --- */
function renderFinIncome(container) {
  const allExpenses = state.data.expenses || [];
  const now = new Date();

  const filtered = allExpenses.filter(e => {
    const d = new Date(e.date);
    if (finRange === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return d >= oneWeekAgo && d <= now;
    }
    else if (finRange === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    else if (finRange === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });

  const incomeItems = filtered.filter(e => e.type === 'income');
  const expenseItems = filtered.filter(e => e.type === 'expense');
  const totalInc = incomeItems.reduce((s, e) => s + Number(e.amount), 0);
  const totalExp = expenseItems.reduce((s, e) => s + Number(e.amount), 0);
  const netBalance = totalInc - totalExp;

  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-bottom:24px;">
        <div style="background:var(--surface-3); padding:4px; border-radius:10px; display:flex; gap:2px;">
        <button class="range-btn ${finRange === 'week' ? 'active' : ''}" onclick="switchFinRange('week')">Week</button>
        <button class="range-btn ${finRange === 'month' ? 'active' : ''}" onclick="switchFinRange('month')">Month</button>
        <button class="range-btn ${finRange === 'year' ? 'active' : ''}" onclick="switchFinRange('year')">Year</button>
        </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: var(--space-6);">
      <div class="dash-card">
        <div class="stat-label">${renderIcon('chart', null, 'style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px"')} Total Income</div>
        <div class="stat-val" style="color:var(--success)">₹${totalInc.toLocaleString()}</div>
      </div>
      <div class="dash-card">
        <div class="stat-label">${renderIcon('activity', null, 'style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px"')} Net Balance</div>
        <div class="stat-val" style="color:${netBalance >= 0 ? 'var(--success)' : 'var(--danger)'}">₹${Math.abs(netBalance).toLocaleString()}</div>
        <div class="text-muted" style="font-size:12px; margin-top:8px">${netBalance >= 0 ? 'Surplus' : 'Deficit'}</div>
      </div>
    </div>

    <!-- Transactions List -->
    <div class="transactions-list">
      <h3 style="margin-bottom: var(--space-4);">Recent Income</h3>
      ${incomeItems.length === 0 ? '<div class="empty-state">No income transactions found</div>' : ''}
      ${incomeItems.map(renderTransactionCard).join('')}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Helper function to render transaction card
function renderTransactionCard(tx) {
  const date = new Date(tx.date);
  const dateStr = date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const isIncome = tx.type === 'income';

  return `
    <div class="transaction-card" onclick="openEditTransaction('${tx.id}')">
      <div class="transaction-date">${dateStr}</div>
      <div class="transaction-details">
        ${(tx.description || tx.notes) ? `<div class="transaction-notes" style="font-weight:600; margin-bottom:4px;">${tx.description || tx.notes}</div>` : ''}
        <div class="transaction-category" style="font-size:12px; color:var(--text-muted)">${tx.category || 'Uncategorized'}</div>
      </div>
      <div class="transaction-amount" style="color: ${isIncome ? 'var(--success)' : 'var(--danger)'}">
        ${isIncome ? '+' : '-'}₹${Number(tx.amount).toLocaleString()}
      </div>
    </div>
  `;
}

/* --- TAB 2: FUNDS --- */
function renderFinFunds(container) {
  const funds = state.data.funds || [];
  container.innerHTML = `
    <div class="grid">
      ${funds.map(f => {
    const pct = Math.min(100, Math.round((f.current_amount / f.target_amount) * 100));
    return `
        <div class="fund-card">
          <div class="fund-header">
            <span>${f.fund_name}</span>
            <span>${pct}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted)">
            <span>₹${Number(f.current_amount).toLocaleString()} saved</span>
            <span>Goal: ₹${Number(f.target_amount).toLocaleString()}</span>
          </div>
          <div class="fund-progress-bg">
            <div class="fund-progress-fill" style="width:${pct}%"></div>
          </div>
          <div style="margin-top:10px; display:flex; gap:6px; justify-content:flex-end">
            <button class="btn icon" onclick="openEditFund('${f.id}')" title="Edit">${renderIcon('edit', null, 'style="width:14px"')}</button>
            <button class="btn icon" data-action="delete" data-sheet="funds" data-id="${f.id}">${renderIcon('delete', null, 'style="width:14px"')}</button>
          </div>
        </div>`;
  }).join('')}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

/* --- TAB 3: ASSETS --- */
function renderFinAssets(container) {
  const assets = (state.data.assets || []).slice();
  const total = assets.reduce((s, a) => s + Number(a.value || 0), 0);
  const count = assets.length;
  const sorted = assets.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const top = sorted[0];
  const topName = top ? String(top.name || 'Untitled') : '—';
  const topShort = topName.length > 16 ? topName.slice(0, 15) + '…' : topName;
  const avg = count ? Math.round(total / count) : 0;

  container.innerHTML = `
    <div class="fin-kpis">
      <div class="fin-kpi"><div class="k-l">Net worth</div><div class="k-v">₹${total.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Holdings</div><div class="k-v">${count}</div></div>
      <div class="fin-kpi"><div class="k-l">Largest · ${topShort}</div><div class="k-v">₹${Number(top ? top.value || 0 : 0).toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Avg / holding</div><div class="k-v">₹${avg.toLocaleString()}</div></div>
    </div>
    <div class="card" style="padding:0; overflow:hidden">
      ${count === 0
        ? '<div class="empty-state" style="padding:36px 20px; text-align:center; color:var(--text-2)">No assets yet. Tap “Add new” to add one.</div>'
        : sorted.map(a => {
            const share = total > 0 ? Math.round((Number(a.value || 0) / total) * 100) : 0;
            return `
        <div class="asset-item">
          <div style="min-width:0">
            <div style="font-weight:600">${a.name || 'Untitled'}</div>
            <div class="asset-type">${a.type || a.notes || ''}${a.type || a.notes ? ' · ' : ''}${share}% of net worth</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px">
             <div style="font-weight:700; font-variant-numeric:tabular-nums">₹${Number(a.value || 0).toLocaleString()}</div>
             <button class="btn icon" onclick="openEditAsset('${a.id}')" title="Edit">${renderIcon('edit', null, 'style="width:14px"')}</button>
             <button class="btn icon" data-action="delete" data-sheet="assets" data-id="${a.id}">${renderIcon('delete', null, 'style="width:14px"')}</button>
          </div>
        </div>`;
          }).join('')}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// --- EDIT FUNCTIONS ---

window.openEditTransaction = function (id) {
  const tx = (state.data.expenses || []).find(x => String(x.id) === String(id));
  if (!tx) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const categories = getAllFinanceCategories();
  const isExpense = tx.type === 'expense';

  box.innerHTML = `
    <h3>Edit Transaction</h3>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px">
      <select class="input" id="mTxType" style="margin:0">
        <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>Expense</option>
        <option value="income" ${tx.type === 'income' ? 'selected' : ''}>Income</option>
      </select>
      <input type="date" class="input" id="mTxDate" value="${(tx.date || '').slice(0, 10)}" style="margin:0">
    </div>
    <input type="number" class="input" id="mTxAmount" placeholder="Amount (₹)" value="${tx.amount || ''}">
    <select class="input" id="mTxCategory" style="margin-top:10px; width:100%">
        <option value="">Select Category</option>
        ${categories.map(c => `<option value="${c}" ${tx.category === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
    ${isExpense ? _finScopeRadioHTML(tx.budget_scope === 'weekly' ? 'weekly' : 'monthly') : ''}
    <input class="input" id="mTxNote" placeholder="Note (optional)" value="${(tx.description || tx.notes || '').replace(/"/g, '&quot;')}" style="margin-top:10px">

    <div style="display:flex; justify-content:space-between; gap:10px; margin-top:16px;">
      <button class="btn danger" onclick="deleteTransaction('${tx.id}')">Delete</button>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="update-tx-modal" data-edit-id="${tx.id}">Update</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

window.deleteTransaction = async function (id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;

  const btn = document.querySelector('button[data-action="delete-tx"][data-id="' + id + '"]');
  if (btn) btn.disabled = true;

  try {
    await apiCall('delete', 'expenses', {}, id);
    document.getElementById('universalModal').classList.add('hidden');
    state.data.expenses = (state.data.expenses || []).filter(x => String(x.id) !== String(id));
    renderFinanceContent();
    showToast("Transaction deleted");
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

window.openEditFund = function (id) {
  const f = (state.data.funds || []).find(x => String(x.id) === String(id));
  if (!f) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3>Edit Fund Goal</h3>
    <input class="input" id="mFundName" value="${(f.fund_name || '').replace(/"/g, '&quot;')}" placeholder="Fund Name">
    <input type="number" class="input" id="mFundTarget" value="${f.target_amount || ''}" placeholder="Target Amount">
    <input type="number" class="input" id="mFundCurrent" value="${f.current_amount || ''}" placeholder="Current Savings">
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-fund-modal" data-edit-id="${f.id}">Update</button>
    </div>
  `;
  modal.classList.remove('hidden');
}

window.openEditAsset = function (id) {
  const a = (state.data.assets || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3>Edit Asset</h3>
    <input class="input" id="mAssetName" value="${(a.name || '').replace(/"/g, '&quot;')}" placeholder="Asset Name">
    <select class="input" id="mAssetType">
      <option value="Cash" ${a.type === 'Cash' ? 'selected' : ''}>Cash</option>
      <option value="Investment" ${a.type === 'Investment' ? 'selected' : ''}>Investment</option>
      <option value="Property" ${a.type === 'Property' ? 'selected' : ''}>Property</option>
    </select>
    <input type="number" class="input" id="mAssetValue" value="${a.value || ''}" placeholder="Current Value">
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-asset-modal" data-edit-id="${a.id}">Update</button>
    </div>
  `;
  modal.classList.remove('hidden');
};

// --- HELPERS ---
function exportFinanceCSV() {
  const expenses = state.data.expenses || [];
  if (!expenses.length) return showToast('No data to export');

  const headers = ['Date', 'Title', 'Category', 'Amount', 'Type', 'Source', 'Notes'];
  const csvContent = [
    headers.join(','),
    ...expenses.map(e => {
      const row = [
        e.date,
        `"${(e.title || '').replace(/"/g, '""')}"`, // Escape quotes
        e.category,
        e.amount,
        e.type,
        e.source,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ];
      return row.join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `finance_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─────────────────────────────────────────────────────────
// Finance Category CRUD Functions - Stored in Settings Sheet
// ─────────────────────────────────────────────────────────

// Get categories from settings (synced with Google Sheets)
function getFinanceCategories() {
  const settings = state.data.settings?.[0] || {};
  if (settings.finance_categories) {
    try {
      return JSON.parse(settings.finance_categories);
    } catch (e) { }
  }
  // No defaults - return empty categories (must come from sheet)
  return { expense: [], income: [] };
}

// Save categories to settings (synced with Google Sheets)
async function saveFinanceCategoriesToSettings(categories) {
  const settings = state.data.settings?.[0] || {};
  const newSettings = {
    ...settings,
    finance_categories: JSON.stringify(categories)
  };

  // Update settings in the sheet
  if (settings.id) {
    await apiCall('update', 'settings', newSettings, settings.id);
  } else {
    await apiCall('create', 'settings', newSettings);
  }

  // Update local state
  if (!state.data.settings) state.data.settings = [{}];
  state.data.settings[0] = newSettings;
}

// Get all finance categories — merge budget categories, categories used in real
// transactions, and any explicit finance_categories, so the picker is never empty.
function getAllFinanceCategories() {
  const settings = state.data.settings?.[0] || {};
  const set = new Set();
  try {
    if (settings.category_budgets) Object.keys(JSON.parse(settings.category_budgets)).forEach(c => { if (c && c.trim()) set.add(c.trim()); });
  } catch (e) { }
  (state.data.expenses || []).forEach(e => { if (e.category && String(e.category).trim()) set.add(String(e.category).trim()); });
  try {
    if (settings.finance_categories) { const fc = JSON.parse(settings.finance_categories); [...(fc.expense || []), ...(fc.income || [])].forEach(c => { if (c && String(c).trim()) set.add(String(c).trim()); }); }
  } catch (e) { }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Add a new category
window.addFinanceCategory = async function (categoryName, type = 'expense') {
  if (!categoryName || categoryName.trim() === '') return false;
  const trimmed = categoryName.trim();
  const categories = getFinanceCategories();
  if (categories[type].includes(trimmed)) {
    showToast('Category already exists');
    return false;
  }
  categories[type].push(trimmed);
  await saveFinanceCategoriesToSettings(categories);
  showToast(`Category "${trimmed}" added`);
  return true;
};

// Delete a category
window.deleteFinanceCategory = async function (categoryName, type) {
  const categories = getFinanceCategories();
  categories[type] = categories[type].filter(c => c !== categoryName);
  await saveFinanceCategoriesToSettings(categories);
  showToast(`Category "${categoryName}" deleted`);
};

// Rename a category
window.renameFinanceCategory = async function (oldName, newName, type) {
  if (!newName || newName.trim() === '') return false;
  const trimmed = newName.trim();
  const categories = getFinanceCategories();

  if (categories[type].includes(trimmed) && trimmed !== oldName) {
    showToast('Category name already exists');
    return false;
  }

  categories[type] = categories[type].map(c => c === oldName ? trimmed : c);
  await saveFinanceCategoriesToSettings(categories);
  showToast(`Category renamed to "${trimmed}"`);
  return true;
};

// Open Finance Category Manager Modal
window.openFinanceCategoryManager = function () {
  const cats = getFinanceCategories();
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  box.innerHTML = `
    <h3 style="margin-bottom:16px;">Manage Finance Categories</h3>
    
    <!-- Expense Categories -->
    <div style="margin-bottom:20px;">
      <h4 style="font-size:12px; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">Expense Categories</h4>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input class="input" id="newExpenseCatInput" placeholder="New expense category" style="flex:1;">
        <button class="btn primary small" onclick="saveNewFinanceCategory('expense')">Add</button>
      </div>
      <div style="max-height:150px;overflow-y:auto;">
        ${cats.expense.map(cat => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:4px;">
            <span style="font-size:13px;">${cat}</span>
            <button class="btn icon small" onclick="deleteFinanceCategoryWithRefresh('${cat}', 'expense')" title="Delete">
              ${renderIcon('x', null, 'style="width:12px;"')}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Income Categories -->
    <div style="margin-bottom:16px;">
      <h4 style="font-size:12px; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">Income Categories</h4>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input class="input" id="newIncomeCatInput" placeholder="New income category" style="flex:1;">
        <button class="btn primary small" onclick="saveNewFinanceCategory('income')">Add</button>
      </div>
      <div style="max-height:150px;overflow-y:auto;">
        ${cats.income.map(cat => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:4px;">
            <span style="font-size:13px;">${cat}</span>
            <button class="btn icon small" onclick="deleteFinanceCategoryWithRefresh('${cat}', 'income')" title="Delete">
              ${renderIcon('x', null, 'style="width:12px;"')}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div style="display:flex;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
};

window.deleteFinanceCategoryWithRefresh = async function (categoryName, type) {
  await deleteFinanceCategory(categoryName, type);
  openFinanceCategoryManager(); // Refresh the modal
};

window.saveNewFinanceCategory = async function (type) {
  const inputId = type === 'expense' ? 'newExpenseCatInput' : 'newIncomeCatInput';
  const input = document.getElementById(inputId);
  const name = input.value.trim();
  if (await addFinanceCategory(name, type)) {
    input.value = '';
    openFinanceCategoryManager(); // Refresh the modal
  }
};

window.renderFinance = renderFinance;
// --- AI INSIGHT (FINANCE) ---
window.generateFinanceInsight = async function () {
  const contentDiv = document.getElementById('aiFinanceContent');
  if (!contentDiv) return;

  contentDiv.style.display = 'block';
  contentDiv.innerHTML = `${renderIcon('loading', null, 'class="spin" style="width:16px"')} Analyzing finances...`;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  try {
    const contextData = {
      budget: state.data.settings?.[0]?.monthly_budget || 0,
      transactions: state.data.expenses.slice(-10)
    };
    const insight = await AI_SERVICE.generateInsight('finance', contextData);
    contentDiv.innerHTML = insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  } catch (err) {
    contentDiv.innerHTML = `<span style="color:var(--danger)">${err.message}</span>`;
  }
};

window.showCategoryExpenses = function (category) {
  const allExpenses = state.data.expenses || [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const filtered = allExpenses.filter(e => {
    const d = new Date(e.date);
    return e.category === category &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear &&
      e.type === 'expense';
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Create Bottom Sheet
  const sheetId = 'fin-category-sheet';
  const backdropId = 'fin-category-backdrop';

  // Remove existing if any
  if (document.getElementById(sheetId)) closeCategorySheet();

  const backdrop = document.createElement('div');
  backdrop.id = backdropId;
  backdrop.className = 'modal-backdrop-ios';
  backdrop.onclick = closeCategorySheet;
  document.body.appendChild(backdrop);

  const sheet = document.createElement('div');
  sheet.id = sheetId;
  sheet.className = 'quick-log-sheet';
  sheet.innerHTML = `
    <div class="quick-log-handle"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3 style="margin:0; font-size:20px;">${category} Expenses</h3>
      <button class="btn icon" onclick="closeCategorySheet()">${renderIcon('x', null, 'style="width:20px"')}</button>
    </div>
    <div style="margin-bottom:16px; font-size:14px; color:var(--text-muted)">
      Total: ₹${filtered.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()} (${filtered.length} items)
    </div>
    <div class="transactions-list" style="padding:0">
      ${filtered.length === 0 ? '<div class="empty-state">No transactions this month</div>' : ''}
      ${filtered.map(renderTransactionCard).join('')}
    </div>
  `;
  document.body.appendChild(sheet);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.closeCategorySheet = function () {
  document.getElementById('fin-category-sheet')?.remove();
  document.getElementById('fin-category-backdrop')?.remove();
};