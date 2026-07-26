/* view-finance.js */

let finState = 'expenses'; // 'expenses', 'income', 'funds', 'assets'
let finRange = 'week';    // 'week', 'month', 'year'

// Transaction list controls: how many are visible (grows via "Load more"),
// plus the current filter/sort. Reset when the tab or range changes.
let finTxShown = 20;
let finTxSort = 'date-desc';  // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
let finTxCat = '';            // '' = all categories
let finTxSearch = '';

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
/* Daily-spend bars: instant hover (and tap) tooltip with the amount */
.fin-daycell { position:relative; width:100%; height:64px; display:flex; align-items:flex-end; cursor:pointer; }
.fin-daytip { position:absolute; bottom:100%; left:50%; transform:translateX(-50%) translateY(-5px); background:var(--text-1); color:var(--surface-1); font-size:11px; font-weight:700; padding:3px 8px; border-radius:7px; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .12s ease; z-index:6; box-shadow:var(--shadow-card); font-variant-numeric:tabular-nums; }
.fin-daytip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:var(--text-1); }
.fin-daycell:hover .fin-daytip, .fin-daycell.show-tip .fin-daytip { opacity:1; }
/* Unified "Add to Finance" type selector (in the modal — global, not scoped to .fin-pro) */
.fin-add-segs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:4px 0 16px; }
.fin-add-seg { border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); padding:9px 6px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; transition:background .14s ease, color .14s ease, border-color .14s ease; }
.fin-add-seg:hover { border-color:var(--border-strong); color:var(--text-1); }
.fin-add-seg.active { background:var(--primary); border-color:var(--primary); color:#fff; box-shadow:var(--shadow-sm); }
/* Custom category picker (shows each category's description inline while choosing) */
.fin-cat-select { position:relative; margin-top:10px; }
.fin-cat-trigger { width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; text-align:left; cursor:pointer; appearance:none; -webkit-appearance:none; font:inherit; background:var(--surface-1); }
.fin-cat-trigger .fin-cat-ph { color:var(--text-muted); }
.fin-cat-caret { color:var(--text-muted); font-size:12px; flex-shrink:0; }
.fin-cat-menu { margin-top:6px; border:1px solid var(--border-color); border-radius:10px; background:var(--surface-1); max-height:260px; overflow-y:auto; box-shadow:var(--shadow-card); padding:4px; }
.fin-cat-opt { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; text-align:left; background:none; border:none; cursor:pointer; padding:9px 11px; border-radius:8px; }
.fin-cat-opt:hover { background:var(--surface-2); }
.fin-cat-opt-name { font-size:14px; font-weight:600; color:var(--text-1); }
.fin-cat-opt-desc { font-size:12px; color:var(--text-muted); line-height:1.3; }
/* Transactions toolbar (search / category filter / sort) + load-more.
   One single row — the app's global "select { width:100% }" is overridden here. */
.fin-tx-count { font-size:12px; color:var(--text-3); font-weight:500; margin-left:auto; font-variant-numeric:tabular-nums; }
.fin-tx-controls { display:flex; gap:8px; flex-wrap:nowrap; align-items:center; margin:10px 0 12px; }
.fin-tx-controls .fin-tx-search { flex:1 1 auto; width:auto; min-width:0; margin:0; padding:8px 11px; border:1px solid var(--border-color); border-radius:9px; background:var(--surface-1); color:var(--text-1); font-size:13px; }
.fin-tx-controls .fin-tx-search:focus { outline:none; border-color:var(--primary); }
.fin-tx-controls select { flex:0 1 auto; width:auto; min-width:0; max-width:34%; margin:0; padding:8px 28px 8px 10px; border:1px solid var(--border-color); border-radius:9px; background:var(--surface-1); color:var(--text-1); font-size:13px; cursor:pointer; text-overflow:ellipsis; }
.fin-loadmore { width:100%; margin-top:6px; padding:10px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:10px; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; transition:border-color .14s ease, color .14s ease; }
.fin-loadmore:hover { border-color:var(--border-strong); color:var(--text-1); }
/* Month insights: charts + doughnut */
.fin-insights { display:flex; flex-direction:column; gap:14px; margin-bottom:18px; }
.fin-ins-charts { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.fin-ins-charts .chart-box { position:relative; height:220px; }
.fin-donut-wrap { display:flex; align-items:center; gap:22px; }
.fin-donut-wrap.fin-donut-rail { flex-direction:column; gap:12px; }
.fin-insight-row { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:13px; line-height:1.5; color:var(--text-2); }
.fin-insight-row:last-child { border-bottom:none; padding-bottom:2px; }
.fin-insight-row b { color:var(--text-1); }
.fin-insight-dot { flex:0 0 8px; width:8px; height:8px; border-radius:50%; margin-top:6px; }
.fin-donut-box { position:relative; flex:0 0 190px; height:190px; }
.fin-donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
.fin-donut-center .dc-v { font-size:17px; font-weight:800; color:var(--text-1); letter-spacing:-.01em; }
.fin-donut-center .dc-l { font-size:11px; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
.fin-donut-legend { flex:1; min-width:0; }
.fin-catrow { padding:7px 0; border-bottom:1px solid var(--border-color); }
.fin-catrow:last-child { border-bottom:none; }
.fin-catrow .cr-top { display:flex; align-items:center; gap:8px; font-size:12.5px; }
.fin-catrow .cr-dot { flex:0 0 10px; width:10px; height:10px; border-radius:3px; }
.fin-catrow .cr-name { font-weight:600; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fin-catrow .cr-amt { margin-left:auto; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; white-space:nowrap; }
.fin-catrow .cr-share { color:var(--text-3); font-size:11.5px; white-space:nowrap; }
.fin-catrow .cr-mom { font-size:11px; font-weight:700; white-space:nowrap; }
@media (max-width:1099px){
  .fin-ins-charts { grid-template-columns:1fr; }
  .fin-donut-wrap { flex-direction:column; gap:12px; }
  .fin-donut-legend { width:100%; }
  .fin-pro { max-width:none; }
  .fin-kpis { grid-template-columns:repeat(2,1fr); }
  .fin-workspace { display:block; }
  /* Stack the rail (weekly Pace / Daily chart / vs-last-week / Biggest, or
     Top categories + Savings) BELOW the main content on phone instead of hiding it. */
  .fin-rail { display:flex; flex:none; width:100%; position:static; top:auto; margin-top:18px; }
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
  _finResetTxControls();
  renderFinance();
}

function switchFinRange(range) {
  finRange = range;
  _finResetTxControls();
  renderFinanceContent();
}

function _finResetTxControls() {
  finTxShown = 20;
  finTxSort = 'date-desc';
  finTxCat = '';
  finTxSearch = '';
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

// Map of category name → its description (set in Settings ▸ Budget ▸ Category Limits).
function _finCatDescriptions() {
  const map = {};
  try {
    const raw = state.data.settings && state.data.settings[0] && state.data.settings[0].category_budgets;
    const data = raw ? (typeof raw === 'object' ? raw : JSON.parse(raw)) : {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v && typeof v === 'object' && v.description) map[k] = v.description;
    });
  } catch (e) { /* no descriptions */ }
  return map;
}

// Custom category picker — each option shows the category name AND its description
// inline, so the description is visible WHILE choosing (a native <select> can't do this).
function _finCatOutside(e) {
  const wrap = document.getElementById('finCatSelect');
  if (wrap && !wrap.contains(e.target)) {
    const menu = document.getElementById('finCatMenu');
    if (menu) menu.hidden = true;
    document.removeEventListener('click', _finCatOutside);
  }
}
window._finToggleCatMenu = function () {
  const menu = document.getElementById('finCatMenu');
  if (!menu) return;
  if (menu.hidden) {
    menu.hidden = false;
    setTimeout(() => document.addEventListener('click', _finCatOutside), 0);
  } else {
    menu.hidden = true;
    document.removeEventListener('click', _finCatOutside);
  }
};
window._finPickCat = function (btn) {
  const val = btn.getAttribute('data-val') || '';
  const desc = btn.getAttribute('data-desc') || '';
  const hidden = document.getElementById('mTxCategory');
  if (hidden) hidden.value = val;
  const label = document.getElementById('finCatLabel');
  if (label) { label.textContent = val || 'Select Category'; label.classList.toggle('fin-cat-ph', !val); }
  const box = document.getElementById('mTxCatDesc');
  if (box) {
    if (desc) { box.textContent = desc; box.style.display = 'block'; }
    else { box.style.display = 'none'; box.textContent = ''; }
  }
  const menu = document.getElementById('finCatMenu');
  if (menu) menu.hidden = true;
  document.removeEventListener('click', _finCatOutside);
};

function _finAddModalHTML(type) {
  const labels = { expense: 'Expense', income: 'Income', fund: 'Fund', asset: 'Asset' };
  const segs = ['expense', 'income', 'fund', 'asset'].map(t =>
    `<button type="button" class="fin-add-seg ${type === t ? 'active' : ''}" onclick="_finSetAddType('${t}')">${labels[t]}</button>`
  ).join('');

  let body = '', save = '';
  if (type === 'expense' || type === 'income') {
    const categories = getAllFinanceCategories();
    const catDesc = _finCatDescriptions();
    const escA = (s) => escapeHtml(String(s == null ? '' : s)).replace(/"/g, '&quot;');
    // Categories only make sense for expenses; income just needs a source note.
    const catPicker = type === 'expense' ? `
      <div class="fin-cat-select" id="finCatSelect">
        <input type="hidden" id="mTxCategory" value="">
        <button type="button" class="input fin-cat-trigger" onclick="_finToggleCatMenu()">
          <span id="finCatLabel" class="fin-cat-ph">Select Category</span>
          <span class="fin-cat-caret">▾</span>
        </button>
        <div class="fin-cat-menu" id="finCatMenu" hidden>
          ${categories.length ? categories.map(c => `
            <button type="button" class="fin-cat-opt" data-val="${escA(c)}" data-desc="${escA(catDesc[c] || '')}" onclick="_finPickCat(this)">
              <span class="fin-cat-opt-name">${escapeHtml(c)}</span>
              ${catDesc[c] ? `<span class="fin-cat-opt-desc">${escapeHtml(catDesc[c])}</span>` : ''}
            </button>`).join('') : '<div style="padding:10px; color:var(--text-muted); font-size:13px">No categories yet</div>'}
        </div>
      </div>
      <div id="mTxCatDesc" style="display:none; margin-top:6px; font-size:12.5px; color:var(--text-muted); padding-left:2px; line-height:1.4;"></div>` : '';
    body = `
      <input type="hidden" id="mTxType" value="${type}">
      <input type="date" class="input" id="mTxDate" value="${new Date().toISOString().slice(0, 10)}">
      <input type="number" class="input" id="mTxAmount" placeholder="Amount (₹)" style="margin-top:10px">
      ${catPicker}
      ${type === 'expense' ? _finScopeRadioHTML('weekly') : ''}
      <input class="input" id="mTxNote" placeholder="${type === 'income' ? 'Source (e.g. Salary, Freelance client)' : "Note (optional — e.g. 'Birthday dinner')"}" style="margin-top:10px">`;
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

  const fullDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartCard = `
    <div class="finr-card">
      <div class="finr-h">Daily spend</div>
      <div style="display:flex; align-items:flex-end; gap:6px; margin-top:8px;">
        ${s.dayTotals.map((v, i) => {
          const h = v > 0 ? Math.max(4, Math.round((v / dayMax) * 64)) : 0;
          const isToday = i === (s.daysElapsed - 1);
          return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div class="fin-daycell" onclick="this.classList.toggle('show-tip')">
              <span class="fin-daytip">${fullDays[i]} · ₹${Math.round(v).toLocaleString()}</span>
              <div style="width:100%; height:${h}px; background:${isToday ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 35%, transparent)'}; border-radius:4px 4px 0 0;"></div>
            </div>
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
  // 'fy' only exists on the Income tab — fall back to month here.
  if (finRange === 'fy') finRange = 'month';
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

  // Month view gets a full analytics block: stat tiles, a daily-spend chart,
  // cumulative spend vs budget pace, and a category breakdown with trends.
  const mo = finRange === 'month'
    ? _finMonthlyStats(expenseItems, allExpenses, now, monthlyBudget, catSpent)
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

  const savingsCard = `<div class="finr-card"><div class="finr-h">Savings</div>${fundsRail || '<div class="finr-empty">No funds yet.</div>'}</div>`;
  const railHTML = (finRange === 'week')
    ? _finWeeklyRailHTML(wk, totalExp, weeklyBudget)
    : (finRange === 'month')
      ? _finMonthRailHTML(mo) + savingsCard
      : `<div class="finr-card"><div class="finr-h">Top categories</div>${catBars || '<div class="finr-empty">No spending in this period.</div>'}</div>` + savingsCard;

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
        ${mo ? renderMonthlyInsights(mo) : ''}
        ${_finTxListHTML(expenseItems)}
      </div>
      <aside class="fin-rail">${railHTML}</aside>
    </div>
  `;
  if (mo) _finInitMonthCharts(mo);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ── Month-view analytics ───────────────────────────────────────────────────
// Everything derived from this month's expenses (all budget scopes): daily
// totals, pace, comparisons against last month, and a category breakdown.
function _finMonthlyStats(expenseItems, allExpenses, now, monthlyBudget, catSpent) {
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const dayTotals = Array(daysInMonth).fill(0);
  expenseItems.forEach(e => {
    const dd = new Date(e.date).getDate();
    if (dd >= 1 && dd <= daysInMonth) dayTotals[dd - 1] += Number(e.amount) || 0;
  });

  const totalExp = dayTotals.reduce((s, v) => s + v, 0);
  const dailyAvg = today > 0 ? totalExp / today : 0;
  const projected = Math.round(dailyAvg * daysInMonth);

  // Cumulative actual (up to today; future days stay null so the line stops)
  // and a straight-line budget pace across the whole month.
  const cumulative = [];
  let run = 0;
  for (let i = 0; i < daysInMonth; i++) {
    run += dayTotals[i];
    cumulative.push(i < today ? Math.round(run) : null);
  }
  const pace = monthlyBudget > 0
    ? Array.from({ length: daysInMonth }, (_, i) => Math.round(monthlyBudget * (i + 1) / daysInMonth))
    : null;

  let biggestIdx = -1, biggestVal = 0;
  dayTotals.forEach((v, i) => { if (v > biggestVal) { biggestVal = v; biggestIdx = i; } });

  const noSpendDays = dayTotals.slice(0, today).filter(v => v === 0).length;

  // Weekday vs weekend daily averages (elapsed days only)
  let wdSum = 0, wdN = 0, weSum = 0, weN = 0;
  for (let i = 0; i < today; i++) {
    const dow = new Date(year, month, i + 1).getDay();
    if (dow === 0 || dow === 6) { weSum += dayTotals[i]; weN++; }
    else { wdSum += dayTotals[i]; wdN++; }
  }

  // Last month: same-elapsed-days total (fair mid-month comparison), full
  // total, and per-category totals for the trend arrows.
  const lmDate = new Date(year, month - 1, 1);
  const lmYear = lmDate.getFullYear(), lmMonth = lmDate.getMonth();
  const lmDays = new Date(lmYear, lmMonth + 1, 0).getDate();
  let lastMonthSame = 0, lastMonthFull = 0;
  const lmCat = {};
  (allExpenses || []).forEach(e => {
    if (e.type !== 'expense') return;
    const d = new Date(e.date);
    if (d.getFullYear() !== lmYear || d.getMonth() !== lmMonth) return;
    const amt = Number(e.amount) || 0;
    lastMonthFull += amt;
    if (d.getDate() <= Math.min(today, lmDays)) lastMonthSame += amt;
    const c = String(e.category || 'Uncategorized').trim();
    lmCat[c] = (lmCat[c] || 0) + amt;
  });

  // Category rows: top 5 + the rest folded into "Other" — a doughnut stays
  // readable at ≤6 segments, each with share-of-spend and a vs-last-month delta.
  const entries = Object.entries(catSpent || {})
    .map(([c, v]) => [String(c || 'Uncategorized').trim(), Number(v) || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 5);
  const restSum = entries.slice(5).reduce((s, [, v]) => s + v, 0);
  const catRows = top.map(([c, v]) => ({ name: c, amount: v, share: totalExp > 0 ? v / totalExp : 0, last: lmCat[c] || 0 }));
  if (restSum > 0) catRows.push({ name: 'Other', amount: restSum, share: totalExp > 0 ? restSum / totalExp : 0, last: null });

  return {
    year, month, daysInMonth, today, dayTotals, totalExp, dailyAvg, projected,
    cumulative, pace, monthlyBudget,
    biggestDay: biggestIdx >= 0 ? { date: new Date(year, month, biggestIdx + 1), amount: biggestVal } : null,
    noSpendDays,
    weekdayAvg: wdN ? wdSum / wdN : 0,
    weekendAvg: weN ? weSum / weN : 0,
    lastMonthSame, lastMonthFull, catRows
  };
}

// Doughnut segment colors: a CVD-validated categorical order (5 hues + a
// de-emphasis gray for "Other"), stepped separately for light and dark surfaces.
const FIN_CAT_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#7a786f'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#5e5d56']
};

function _finIsDarkTheme() {
  try {
    const bg = getComputedStyle(document.body).getPropertyValue('--surface-1').trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(bg);
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return lum < 128;
  } catch (e) { return false; }
}

function renderMonthlyInsights(mo) {
  const fmt = (n) => '₹' + Math.round(n).toLocaleString();
  const monthName = new Date(mo.year, mo.month, 1).toLocaleDateString('default', { month: 'long' });

  const charts = `
    <div class="fin-ins-charts">
      <div class="dash-card"><div class="fin-sec-h">Daily spending — ${monthName}</div><div class="chart-box"><canvas id="finChDaily"></canvas></div></div>
      <div class="dash-card"><div class="fin-sec-h">${mo.pace ? 'Spend vs budget pace' : 'Cumulative spend'}</div><div class="chart-box"><canvas id="finChCumulative"></canvas></div></div>
    </div>`;

  const colors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];
  const rows = mo.catRows.map((r, i) => {
    let mom = '';
    if (r.last != null) {
      if (r.last === 0 && r.amount > 0) mom = `<span class="cr-mom" style="color:var(--text-3)">new</span>`;
      else if (r.last > 0) {
        const d = r.amount - r.last; const p = Math.round(Math.abs(d) / r.last * 100); const down = d <= 0;
        mom = `<span class="cr-mom" style="color:${down ? 'var(--success)' : 'var(--danger)'}">${down ? '▼' : '▲'}${p}%</span>`;
      }
    }
    const swatch = colors[Math.min(i, colors.length - 1)];
    return `<div class="fin-catrow" style="cursor:pointer" onclick="showCategoryExpenses('${escapeHtml(r.name).replace(/'/g, "\\'")}')">
      <div class="cr-top"><span class="cr-dot" style="background:${swatch}"></span><span class="cr-name">${escapeHtml(r.name)}</span><span class="cr-share">${Math.round(r.share * 100)}%</span>${mom}<span class="cr-amt">${fmt(r.amount)}</span></div>
    </div>`;
  }).join('');
  const catCard = mo.catRows.length ? `
    <div class="dash-card">
      <div style="display:flex; align-items:baseline; gap:8px;"><div class="fin-sec-h">Where your money goes</div><span class="fin-tx-count">change vs all of last month</span></div>
      <div class="fin-donut-wrap">
        <div class="fin-donut-box"><canvas id="finChCat"></canvas><div class="fin-donut-center"><div class="dc-v">${fmt(mo.totalExp)}</div><div class="dc-l">spent</div></div></div>
        <div class="fin-donut-legend">${rows}</div>
      </div>
    </div>` : '';

  return `<div class="fin-insights">${charts}${catCard}</div>`;
}

// Month stat cards for the right-hand rail (mirrors the weekly rail style).
function _finMonthRailHTML(mo) {
  const fmt = (n) => '₹' + Math.round(n).toLocaleString();
  const onTrack = mo.monthlyBudget <= 0 || mo.projected <= mo.monthlyBudget;
  const daysLeft = mo.daysInMonth - mo.today;

  const paceCard = `
    <div class="finr-card">
      <div class="finr-h">Pace</div>
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px">Day ${mo.today} of ${mo.daysInMonth}</div>
      <div style="font-size:22px; font-weight:800; color:var(--text-1); line-height:1">${fmt(mo.dailyAvg)}<span style="font-size:12px; font-weight:600; color:var(--text-muted)"> /day</span></div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:2px">daily average${daysLeft > 0 ? ` · ${daysLeft} day${daysLeft > 1 ? 's' : ''} left` : ''}</div>
      <div style="margin-top:10px; font-size:12.5px; color:var(--text-muted)">Projected: <b style="color:${onTrack ? 'var(--success)' : 'var(--danger)'}">${fmt(mo.projected)}</b>${mo.monthlyBudget > 0 ? ` / ${fmt(mo.monthlyBudget)}` : ''}</div>
      ${mo.monthlyBudget > 0 ? `<div style="margin-top:8px"><span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; background:${onTrack ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'color-mix(in srgb, var(--danger) 16%, transparent)'}; color:${onTrack ? 'var(--success)' : 'var(--danger)'}">${onTrack ? 'On track' : 'Over pace'}</span></div>` : ''}
    </div>`;

  let trendLine;
  if (mo.lastMonthSame > 0) {
    const diff = mo.totalExp - mo.lastMonthSame;
    const pct = Math.round(Math.abs(diff) / mo.lastMonthSame * 100);
    const down = diff <= 0;
    trendLine = `<div style="margin-top:8px; font-size:13px; font-weight:700; color:${down ? 'var(--success)' : 'var(--danger)'}">${down ? '▼' : '▲'} ${pct}% ${down ? 'less' : 'more'} than last month</div>`;
  } else {
    trendLine = `<div style="margin-top:8px; font-size:12px; color:var(--text-muted)">No data last month</div>`;
  }
  const trendCard = `
    <div class="finr-card">
      <div class="finr-h">vs last month · first ${mo.today} days</div>
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px"><span style="color:var(--text-muted)">This month</span><b>${fmt(mo.totalExp)}</b></div>
      <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted)">Last month</span><b>${fmt(mo.lastMonthSame)}</b></div>
      ${trendLine}
    </div>`;

  const hlRow = (l, v, s) => `<div style="display:flex; justify-content:space-between; align-items:baseline; font-size:13px; margin-bottom:8px"><span style="color:var(--text-muted)">${l}</span><span style="text-align:right"><b>${v}</b>${s ? `<span style="color:var(--text-muted); font-size:11.5px"> ${s}</span>` : ''}</span></div>`;
  const highlightsCard = `
    <div class="finr-card">
      <div class="finr-h">Highlights</div>
      ${hlRow('Biggest day', mo.biggestDay ? fmt(mo.biggestDay.amount) : '—', mo.biggestDay ? mo.biggestDay.date.toLocaleDateString('default', { month: 'short', day: 'numeric' }) : '')}
      ${hlRow('No-spend days', mo.noSpendDays, `of ${mo.today}`)}
      ${hlRow('Weekday avg', fmt(mo.weekdayAvg), '/day')}
      ${hlRow('Weekend avg', fmt(mo.weekendAvg), '/day')}
    </div>`;

  return paceCard + trendCard + highlightsCard;
}

// Build the two Chart.js charts. chart.js loads deferred from a CDN, so retry
// briefly if it isn't ready yet; skip silently if it never arrives (offline).
function _finInitMonthCharts(mo, attempt = 0) {
  const daily = document.getElementById('finChDaily');
  const cumu = document.getElementById('finChCumulative');
  if (!daily || !cumu) return; // view already changed
  if (typeof Chart === 'undefined') {
    if (attempt < 20) setTimeout(() => _finInitMonthCharts(mo, attempt + 1), 250);
    return;
  }

  const css = getComputedStyle(document.body);
  const cssVar = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const primary = cssVar('--primary', '#818CF8');
  const textMuted = cssVar('--text-muted', '#9097A1');
  const grid = cssVar('--border-color', '#E5E7EB');
  const surface = cssVar('--surface-1', '#FFFFFF');
  const alpha = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  window._finCharts = window._finCharts || {};
  Object.keys(window._finCharts).forEach(k => { try { window._finCharts[k].destroy(); } catch (e) { } });

  const labels = Array.from({ length: mo.daysInMonth }, (_, i) => i + 1);
  const fmtC = (n) => '₹' + Math.round(n).toLocaleString();
  const compact = (n) => n >= 1000 ? '₹' + (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : '₹' + n;
  const monthShort = new Date(mo.year, mo.month, 1).toLocaleDateString('default', { month: 'short' });
  const axis = {
    x: {
      grid: { display: false }, border: { color: grid },
      ticks: { color: textMuted, font: { size: 10 }, maxRotation: 0, autoSkip: false, callback: (v, i) => (i === 0 || (i + 1) % 5 === 0) ? i + 1 : '' }
    },
    y: {
      grid: { color: grid }, border: { display: false }, beginAtZero: true,
      ticks: { color: textMuted, font: { size: 10 }, maxTicksLimit: 5, callback: (v) => compact(v) }
    }
  };

  window._finCharts.daily = new Chart(daily.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: mo.dayTotals,
        // Today's bar in the full accent; the rest in a quieter wash of the
        // same hue — emphasis, not extra colors.
        backgroundColor: mo.dayTotals.map((_, i) => i === mo.today - 1 ? primary : alpha(primary, 0.4)),
        hoverBackgroundColor: primary,
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        maxBarThickness: 14
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => `${monthShort} ${items[0].label}`,
            label: (item) => fmtC(item.parsed.y)
          }
        }
      },
      scales: axis
    }
  });

  const dsets = [{
    label: 'Spent',
    data: mo.cumulative,
    borderColor: primary, backgroundColor: alpha(primary, 0.10),
    fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
    pointHoverBackgroundColor: primary, pointHoverBorderColor: surface, pointHoverBorderWidth: 2,
    tension: 0.25, spanGaps: false
  }];
  if (mo.pace) dsets.push({
    label: 'Budget pace',
    data: mo.pace,
    borderColor: textMuted, borderDash: [5, 4], borderWidth: 1.5,
    pointRadius: 0, pointHoverRadius: 0, fill: false
  });

  window._finCharts.cumulative = new Chart(cumu.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: dsets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: !!mo.pace, labels: { color: textMuted, boxWidth: 18, boxHeight: 2, font: { size: 11 } } },
        tooltip: {
          displayColors: false,
          filter: (item) => item.parsed.y != null,
          callbacks: {
            title: (items) => items.length ? `${monthShort} ${items[0].label}` : '',
            label: (item) => `${item.dataset.label}: ${fmtC(item.parsed.y)}`
          }
        }
      },
      scales: axis
    }
  });

  // Doughnut: where the money goes. Colors match the legend swatches;
  // a 2px surface-colored border keeps segments separated.
  const donut = document.getElementById('finChCat');
  if (donut && mo.catRows.length) {
    const colors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];
    window._finCharts.donut = new Chart(donut.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: mo.catRows.map(r => r.name),
        datasets: [{
          data: mo.catRows.map(r => Math.round(r.amount)),
          backgroundColor: mo.catRows.map((_, i) => colors[Math.min(i, colors.length - 1)]),
          borderColor: surface,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        cutout: '64%',
        layout: { padding: 6 },
        plugins: {
          legend: { display: false }, // the row list beside the chart is the legend
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => {
                const share = mo.totalExp > 0 ? Math.round(item.parsed / mo.totalExp * 100) : 0;
                return `${fmtC(item.parsed)} · ${share}%`;
              }
            }
          }
        }
      }
    });
  }
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
  const all = state.data.expenses || [];
  const now = new Date();

  // Income is monthly/yearly by nature — a "week" of salary makes no sense.
  if (finRange === 'week') finRange = 'month';

  // Period bounds. 'fy' = Indian financial year (Apr 1 – Mar 31).
  let start, end, periodLabel;
  if (finRange === 'fy') {
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    start = new Date(fyStart, 3, 1);
    end = new Date(fyStart + 1, 2, 31, 23, 59, 59);
    periodLabel = `FY ${fyStart}–${String((fyStart + 1) % 100).padStart(2, '0')}`;
  } else if (finRange === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    periodLabel = String(now.getFullYear());
  } else { // month
    finRange = 'month';
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    periodLabel = now.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  }

  const inPeriod = all.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
  const incomeItems = inPeriod.filter(e => e.type === 'income');
  const expenseItems = inPeriod.filter(e => e.type === 'expense');
  const totalInc = incomeItems.reduce((s, e) => s + Number(e.amount), 0);
  const totalExp = expenseItems.reduce((s, e) => s + Number(e.amount), 0);
  const netBalance = totalInc - totalExp;

  // Monthly slots for the chart: the FY/year months, or trailing 12 in month mode.
  const slots = [];
  if (finRange === 'month') {
    for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); slots.push({ y: d.getFullYear(), m: d.getMonth() }); }
  } else {
    let d = new Date(start);
    while (d <= end) { slots.push({ y: d.getFullYear(), m: d.getMonth() }); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  }
  const slotIdx = {};
  slots.forEach((s, i) => { slotIdx[s.y + '-' + s.m] = i; });
  const incByMonth = slots.map(() => 0);
  all.forEach(e => {
    if (e.type !== 'income') return;
    const d = new Date(e.date);
    const i = slotIdx[d.getFullYear() + '-' + d.getMonth()];
    if (i != null) incByMonth[i] += Number(e.amount) || 0;
  });
  const slotLabels = slots.map(({ y, m }, i) => {
    const lbl = new Date(y, m, 1).toLocaleDateString('default', { month: 'short' });
    return (i === 0 || m === 0) ? `${lbl} '${String(y).slice(2)}` : lbl;
  });
  const chartTitle = finRange === 'month' ? 'Income by month — last 12 months' : `Income by month — ${periodLabel}`;

  // KPIs
  const monthsSoFar = finRange === 'month' ? 12 : Math.min(slots.length, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1);
  const avgPerMonth = finRange === 'month' ? totalInc : Math.round(totalInc / Math.max(1, monthsSoFar));
  const biggest = [...incomeItems].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const biggestSrc = biggest ? String(biggest.description || biggest.notes || biggest.category || '').slice(0, 18) : '';
  const savingsRate = totalInc > 0 ? Math.round(netBalance / totalInc * 100) : null;

  // Income by source (description is the "source" note)
  const srcSums = {};
  incomeItems.forEach(e => {
    const s = String(e.description || e.notes || e.category || 'Other').trim() || 'Other';
    srcSums[s] = (srcSums[s] || 0) + (Number(e.amount) || 0);
  });
  const srcEntries = Object.entries(srcSums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const srcTop = srcEntries.slice(0, 5);
  const srcRest = srcEntries.slice(5).reduce((s, [, v]) => s + v, 0);
  const srcRows = srcTop.map(([n, v]) => [n, v]);
  if (srcRest > 0) srcRows.push(['Other', srcRest]);
  const srcColors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];

  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-bottom:24px;">
        <div style="background:var(--surface-3); padding:4px; border-radius:10px; display:flex; gap:2px;">
        <button class="range-btn ${finRange === 'month' ? 'active' : ''}" onclick="switchFinRange('month')">Month</button>
        <button class="range-btn ${finRange === 'year' ? 'active' : ''}" onclick="switchFinRange('year')">Year</button>
        <button class="range-btn ${finRange === 'fy' ? 'active' : ''}" onclick="switchFinRange('fy')" title="Financial year (Apr–Mar)">FY (Apr–Mar)</button>
        </div>
    </div>

    <div class="fin-kpis">
      <div class="fin-kpi"><div class="k-l">Income · ${periodLabel}</div><div class="k-v" style="color:var(--success)">₹${totalInc.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">${finRange === 'month' ? 'This month' : 'Avg / month'}</div><div class="k-v">₹${avgPerMonth.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">Biggest${biggestSrc ? ' · ' + escapeHtml(biggestSrc) : ''}</div><div class="k-v">${biggest ? '₹' + Number(biggest.amount).toLocaleString() : '—'}</div></div>
      <div class="fin-kpi"><div class="k-l">Savings rate</div><div class="k-v" style="color:${savingsRate == null ? 'var(--text-3)' : (savingsRate >= 0 ? 'var(--success)' : 'var(--danger)')}">${savingsRate == null ? '—' : savingsRate + '%'}</div><div style="font-size:11.5px; color:var(--text-3); margin-top:2px">net ₹${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'kept' : 'deficit'}</div></div>
    </div>

    <div class="fin-workspace">
      <div class="fin-main">
        <div class="dash-card" style="margin-bottom:18px"><div class="fin-sec-h">${chartTitle}</div><div class="chart-box"><canvas id="finChIncMonthly"></canvas></div></div>
        ${_finTxListHTML(incomeItems)}
      </div>
      <aside class="fin-rail">
        ${srcRows.length ? `
        <div class="finr-card">
          <div class="finr-h">Income by source · ${periodLabel}</div>
          <div class="fin-donut-wrap fin-donut-rail">
            <div class="fin-donut-box" style="flex-basis:auto; width:140px; height:140px; margin:0 auto"><canvas id="finChIncSrc"></canvas></div>
            <div class="fin-donut-legend" style="width:100%">
              ${srcRows.map(([n, v], i) => `<div class="fin-catrow"><div class="cr-top"><span class="cr-dot" style="background:${srcColors[Math.min(i, srcColors.length - 1)]}"></span><span class="cr-name">${escapeHtml(n)}</span><span class="cr-share">${totalInc > 0 ? Math.round(v / totalInc * 100) : 0}%</span><span class="cr-amt">₹${Math.round(v).toLocaleString()}</span></div></div>`).join('')}
            </div>
          </div>
        </div>` : ''}
        ${(() => {
          const withData = incByMonth.map((v, i) => ({ v, label: slotLabels[i] })).filter(x => x.v > 0);
          if (!withData.length) return '';
          const best = withData.reduce((a, b) => (b.v > a.v ? b : a));
          return `
        <div class="finr-card">
          <div class="finr-h">Best month</div>
          <div style="font-size:22px; font-weight:800; color:var(--text-1); line-height:1">₹${best.v.toLocaleString()}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px">${best.label}</div>
          <div style="margin-top:10px; font-size:12.5px; color:var(--text-muted)">${withData.length} month${withData.length > 1 ? 's' : ''} with income</div>
        </div>`;
        })()}
      </aside>
    </div>
  `;
  _finInitIncomeCharts(slotLabels, incByMonth, slots, now, srcRows, totalInc);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function _finInitIncomeCharts(labels, incByMonth, slots, now, srcRows, totalInc, attempt = 0) {
  const bar = document.getElementById('finChIncMonthly');
  if (!bar) return;
  if (typeof Chart === 'undefined') {
    if (attempt < 20) setTimeout(() => _finInitIncomeCharts(labels, incByMonth, slots, now, srcRows, totalInc, attempt + 1), 250);
    return;
  }
  const css = getComputedStyle(document.body);
  const cssVar = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const primary = cssVar('--primary', '#818CF8');
  const textMuted = cssVar('--text-muted', '#9097A1');
  const grid = cssVar('--border-color', '#E5E7EB');
  const surface = cssVar('--surface-1', '#FFFFFF');
  const alpha = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const fmtC = (n) => '₹' + Math.round(n).toLocaleString();
  const compact = (n) => {
    const abs = Math.abs(n);
    if (abs >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (abs >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (abs >= 1000) return '₹' + (n / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return '₹' + n;
  };

  window._finCharts = window._finCharts || {};
  ['incMonthly', 'incSrc'].forEach(k => { try { window._finCharts[k]?.destroy(); } catch (e) { } });

  const isCurrent = (i) => slots[i] && slots[i].y === now.getFullYear() && slots[i].m === now.getMonth();
  window._finCharts.incMonthly = new Chart(bar.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: incByMonth,
        backgroundColor: incByMonth.map((_, i) => isCurrent(i) ? primary : alpha(primary, 0.4)),
        hoverBackgroundColor: primary,
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        maxBarThickness: 22
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: (i) => fmtC(i.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, border: { color: grid }, ticks: { color: textMuted, font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: grid }, border: { display: false }, beginAtZero: true, ticks: { color: textMuted, font: { size: 10 }, maxTicksLimit: 5, callback: (v) => compact(v) } }
      }
    }
  });

  const donut = document.getElementById('finChIncSrc');
  if (donut && srcRows.length) {
    const colors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];
    window._finCharts.incSrc = new Chart(donut.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: srcRows.map(([n]) => n),
        datasets: [{
          data: srcRows.map(([, v]) => Math.round(v)),
          backgroundColor: srcRows.map((_, i) => colors[Math.min(i, colors.length - 1)]),
          borderColor: surface, borderWidth: 2, hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { label: (i) => `${fmtC(i.parsed)} · ${totalInc > 0 ? Math.round(i.parsed / totalInc * 100) : 0}%` } }
        }
      }
    });
  }
}

// ── Transactions list: filter + sort + load more ──────────────────────────
// All expenses in the selected period are available; we render `finTxShown`
// at a time and grow on demand so huge months stay fast.
function _finTxListHTML(expenseItems) {
  const esc = (s) => escapeHtml(String(s == null ? '' : s)).replace(/"/g, '&quot;');
  const cats = [...new Set(expenseItems.map(e => String(e.category || 'Uncategorized').trim()))].sort((a, b) => a.localeCompare(b));

  let list = expenseItems.slice();
  if (finTxCat) list = list.filter(e => String(e.category || 'Uncategorized').trim() === finTxCat);
  const q = finTxSearch.trim().toLowerCase();
  if (q) list = list.filter(e =>
    [e.description, e.notes, e.category, e.amount].some(v => v != null && String(v).toLowerCase().includes(q)));

  const sorters = {
    'date-desc': (a, b) => new Date(b.date) - new Date(a.date),
    'date-asc': (a, b) => new Date(a.date) - new Date(b.date),
    'amount-desc': (a, b) => Number(b.amount) - Number(a.amount),
    'amount-asc': (a, b) => Number(a.amount) - Number(b.amount)
  };
  list.sort(sorters[finTxSort] || sorters['date-desc']);

  const visible = list.slice(0, finTxShown);
  const sortOpts = [
    ['date-desc', 'Newest first'], ['date-asc', 'Oldest first'],
    ['amount-desc', 'Amount: high → low'], ['amount-asc', 'Amount: low → high']
  ];

  return `
        <div class="transactions-list">
          <div style="display:flex; align-items:baseline; gap:10px;">
            <h3 class="fin-sec-h">Transactions</h3>
            <span class="fin-tx-count">Showing ${visible.length} of ${list.length}${(finTxCat || q) ? ` (filtered from ${expenseItems.length})` : ''}</span>
          </div>
          <div class="fin-tx-controls">
            <input id="finTxSearch" class="fin-tx-search" type="search" placeholder="Search note, category, amount…"
                   value="${esc(finTxSearch)}" oninput="_finTxSearchInput(this)">
            ${cats.length > 1 ? `<select onchange="_finTxSetCat(this.value)" title="Filter by category">
              <option value="">All categories</option>
              ${cats.map(c => `<option value="${esc(c)}" ${finTxCat === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>` : ''}
            <select onchange="_finTxSetSort(this.value)" title="Sort">
              ${sortOpts.map(([v, l]) => `<option value="${v}" ${finTxSort === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          ${list.length === 0 ? `<div class="empty-state">${expenseItems.length === 0 ? 'No transactions in this period.' : 'Nothing matches your filter.'}</div>` : ''}
          ${visible.map(renderTransactionCard).join('')}
          ${list.length > finTxShown ? `<button class="fin-loadmore" onclick="finShowMoreTx()">Load ${Math.min(40, list.length - finTxShown)} more (${list.length - finTxShown} remaining)</button>` : ''}
        </div>`;
}

window.finShowMoreTx = function () {
  finTxShown += 40;
  renderFinanceContent();
};
window._finTxSetSort = function (v) { finTxSort = v; renderFinanceContent(); };
window._finTxSetCat = function (v) { finTxCat = v; finTxShown = 20; renderFinanceContent(); };
window._finTxSearchInput = function (el) {
  finTxSearch = el.value;
  finTxShown = 20;
  clearTimeout(window._finTxSearchT);
  window._finTxSearchT = setTimeout(() => {
    renderFinanceContent();
    // Re-rendering replaces the input — put the cursor back so typing flows.
    const inp = document.getElementById('finTxSearch');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }, 250);
};

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
        ${isIncome
          ? (tx.category ? `<div class="transaction-category" style="font-size:12px; color:var(--text-muted)">${tx.category}</div>` : '')
          : `<div class="transaction-category" style="font-size:12px; color:var(--text-muted)">${tx.category || 'Uncategorized'}</div>`}
      </div>
      <div class="transaction-amount" style="color: ${isIncome ? 'var(--success)' : 'var(--danger)'}">
        ${isIncome ? '+' : '-'}₹${Number(tx.amount).toLocaleString()}
      </div>
    </div>
  `;
}

/* --- TAB 2: FUNDS --- */
// Legacy rows may only have name/balance (pre-migration); read both shapes.
function _finFundName(f) { return f.fund_name || f.name || 'Untitled fund'; }
function _finFundCurrent(f) { const v = Number(f.current_amount ?? f.balance ?? 0); return isNaN(v) ? 0 : v; }
function _finFundTarget(f) { const v = Number(f.target_amount ?? 0); return isNaN(v) ? 0 : v; }

function renderFinFunds(container) {
  const funds = state.data.funds || [];
  const contribs = state.data.fund_contributions || [];

  container.innerHTML = `
    <div class="grid">
      ${funds.length === 0 ? '<div class="empty-state" style="padding:36px 20px; text-align:center">No funds yet. Tap “Add new” to create a savings goal.</div>' : ''}
      ${funds.map(f => {
    const name = _finFundName(f);
    const cur = _finFundCurrent(f);
    const tgt = _finFundTarget(f);
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    const history = contribs
      .filter(c => String(c.fund_id) === String(f.id))
      .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
      .slice(0, 3);
    const historyHTML = history.length ? `
          <div style="margin-top:10px; border-top:1px solid var(--border-color); padding-top:8px;">
            ${history.map(c => `<div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); padding:2px 0;">
              <span>${new Date(c.date || c.created_at).toLocaleDateString('default', { month: 'short', day: 'numeric' })}${c.note ? ' · ' + escapeHtml(c.note) : ''}</span>
              <b style="color:var(--success); font-variant-numeric:tabular-nums">+₹${Number(c.amount || 0).toLocaleString()}</b>
            </div>`).join('')}
          </div>` : '';
    return `
        <div class="fund-card">
          <div class="fund-header">
            <span>${escapeHtml(name)}</span>
            <span>${tgt > 0 ? pct + '%' : ''}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted)">
            <span>₹${cur.toLocaleString()} saved</span>
            <span>${tgt > 0 ? 'Goal: ₹' + tgt.toLocaleString() : 'No goal set'}</span>
          </div>
          <div class="fund-progress-bg">
            <div class="fund-progress-fill" style="width:${pct}%"></div>
          </div>
          ${historyHTML}
          <div style="margin-top:10px; display:flex; gap:6px; justify-content:flex-end; align-items:center">
            <button class="btn" style="margin-right:auto; font-size:12.5px; font-weight:600" onclick="openAddToFund('${f.id}')">+ Add money</button>
            <button class="btn icon" onclick="openEditFund('${f.id}')" title="Edit">${renderIcon('edit', null, 'style="width:14px"')}</button>
            <button class="btn icon" data-action="delete" data-sheet="funds" data-id="${f.id}">${renderIcon('delete', null, 'style="width:14px"')}</button>
          </div>
        </div>`;
  }).join('')}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ── Add money to a fund (custom amount + date, e.g. ₹1000 now, ₹1000 next month)
window.openAddToFund = function (id) {
  const f = (state.data.funds || []).find(x => String(x.id) === String(id));
  if (!f) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3 style="margin-bottom:4px">Add to ${escapeHtml(_finFundName(f))}</h3>
    <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px">₹${_finFundCurrent(f).toLocaleString()} saved${_finFundTarget(f) > 0 ? ' of ₹' + _finFundTarget(f).toLocaleString() : ''}</div>
    <input type="number" class="input" id="mFcAmount" placeholder="Amount (₹)" min="0" autofocus>
    <input type="date" class="input" id="mFcDate" value="${new Date().toISOString().slice(0, 10)}" style="margin-top:10px">
    <input class="input" id="mFcNote" placeholder="Note (optional — e.g. 'July savings')" style="margin-top:10px">
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="_finSaveFundContribution('${f.id}')">Add money</button>
    </div>`;
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('mFcAmount')?.focus(), 50);
};

window._finSaveFundContribution = async function (id) {
  const f = (state.data.funds || []).find(x => String(x.id) === String(id));
  if (!f) return;
  const amount = Number(document.getElementById('mFcAmount')?.value);
  const date = document.getElementById('mFcDate')?.value || new Date().toISOString().slice(0, 10);
  const note = (document.getElementById('mFcNote')?.value || '').trim();
  if (!amount || isNaN(amount) || amount <= 0) { showToast('Enter an amount'); return; }
  document.getElementById('universalModal').classList.add('hidden');

  const newTotal = _finFundCurrent(f) + amount;
  try {
    // 1. History row (needs the fund_contributions table — supabase/migration-funds.sql)
    try {
      const res = await apiCall('create', 'fund_contributions', { fund_id: String(f.id), amount, date, note });
      if (!state.data.fund_contributions) state.data.fund_contributions = [];
      state.data.fund_contributions.unshift(res?.data || { id: res?.id, fund_id: String(f.id), amount, date, note });
    } catch (e) {
      console.warn('[Funds] history not saved — run supabase/migration-funds.sql:', e?.message);
      showToast('Saved, but history needs the funds DB migration');
    }
    // 2. Bump the fund total (balance mirrors current_amount for the legacy column)
    await apiCall('update', 'funds', { current_amount: newTotal, balance: newTotal }, f.id);
    f.current_amount = newTotal;
    f.balance = newTotal;
    renderFinanceContent();
    showToast(`Added ₹${amount.toLocaleString()} to ${_finFundName(f)}`);
  } catch (e) {
    showToast('Failed to add: ' + (e.message || 'unknown error'));
  }
};

/* --- TAB 3: ASSETS --- */

// Build the month-by-month net-worth series from asset value snapshots.
// For each month, each asset counts at its last logged value up to that month
// (carry-forward); the latest month always reflects the live current values.
function _finAssetSeries(assets, snaps) {
  const valid = (snaps || []).filter(s => s.asset_id != null && s.value != null);
  if (!valid.length) return null;
  const sDate = (s) => new Date(s.date || s.created_at);

  const first = new Date(Math.min(...valid.map(s => sDate(s).getTime())));
  const now = new Date();
  const months = [];
  let y = first.getFullYear(), m = first.getMonth();
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    months.push({ y, m });
    m++; if (m > 11) { m = 0; y++; }
  }
  const capped = months.slice(-12); // last 12 months max
  if (capped.length < 2) return null; // nothing to chart yet

  const perAsset = {};
  valid.forEach(s => { (perAsset[s.asset_id] = perAsset[s.asset_id] || []).push(s); });
  Object.values(perAsset).forEach(arr => arr.sort((a, b) => sDate(a) - sDate(b)));

  const totals = capped.map(({ y, m }) => {
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    let sum = 0;
    Object.values(perAsset).forEach(arr => {
      let v = null;
      for (const s of arr) { if (sDate(s) <= end) v = Number(s.value) || 0; else break; }
      if (v != null) sum += v;
    });
    return Math.round(sum);
  });
  // The latest month is "now" — use the live asset values, which are always
  // at least as fresh as the newest snapshot.
  totals[totals.length - 1] = Math.round(assets.reduce((s, a) => s + Number(a.value || 0), 0));

  const labels = capped.map(({ y, m }, i) => {
    const lbl = new Date(y, m, 1).toLocaleDateString('default', { month: 'short' });
    return (i === 0 || m === 0) ? `${lbl} '${String(y).slice(2)}` : lbl;
  });
  const growth = totals.map((v, i) => i === 0 ? null : v - totals[i - 1]);
  return { labels, totals, growth };
}

function renderFinAssets(container) {
  const assets = (state.data.assets || []).slice();
  const snaps = state.data.asset_snapshots || [];
  const total = assets.reduce((s, a) => s + Number(a.value || 0), 0);
  const count = assets.length;
  const sorted = assets.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const top = sorted[0];
  const topName = top ? String(top.name || 'Untitled') : '—';
  const topShort = topName.length > 16 ? topName.slice(0, 15) + '…' : topName;

  const series = _finAssetSeries(assets, snaps);

  // Compact INR for prose: ₹56.9L, ₹1.2Cr, ₹45k
  const inr = (n) => {
    const abs = Math.abs(n);
    if (abs >= 10000000) return '₹' + (n / 10000000).toFixed(abs >= 100000000 ? 1 : 2).replace(/\.?0+$/, '') + 'Cr';
    if (abs >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (abs >= 1000) return '₹' + Math.round(n / 1000) + 'k';
    return '₹' + Math.round(n).toLocaleString();
  };

  // "This month" KPI: current net worth vs end of last month
  let deltaHTML = '<div class="k-v" style="color:var(--text-3)">—</div>';
  if (series && series.totals.length >= 2) {
    const prev = series.totals[series.totals.length - 2];
    const d = total - prev;
    const pct = prev > 0 ? Math.round(Math.abs(d) / prev * 100) : 0;
    const up = d >= 0;
    deltaHTML = `<div class="k-v" style="color:${up ? 'var(--success)' : 'var(--danger)'}">${up ? '▲' : '▼'} ₹${Math.abs(d).toLocaleString()}<span style="font-size:13px; font-weight:600"> · ${pct}%</span></div>`;
  }

  // ── Finance-manager stats: cash flow, liquidity, concentration ───────────
  // Average monthly income/expense over the last 3 full months (fallback:
  // current month) — powers runway, savings pace, and milestone ETA.
  const _now2 = new Date();
  const monthAgg = {};
  (state.data.expenses || []).forEach(e => {
    const d = new Date(e.date);
    const k = d.getFullYear() + '-' + d.getMonth();
    if (!monthAgg[k]) monthAgg[k] = { inc: 0, exp: 0 };
    const amt = Number(e.amount) || 0;
    if (e.type === 'income') monthAgg[k].inc += amt;
    else if (e.type === 'expense') monthAgg[k].exp += amt;
  });
  let incSum = 0, expSum = 0, monthsUsed = 0;
  for (let k = 1; k <= 3; k++) {
    const d = new Date(_now2.getFullYear(), _now2.getMonth() - k, 1);
    const a = monthAgg[d.getFullYear() + '-' + d.getMonth()];
    if (a && (a.inc > 0 || a.exp > 0)) { incSum += a.inc; expSum += a.exp; monthsUsed++; }
  }
  if (!monthsUsed) {
    const a = monthAgg[_now2.getFullYear() + '-' + _now2.getMonth()];
    if (a) { incSum = a.inc; expSum = a.exp; monthsUsed = 1; }
  }
  const avgInc = monthsUsed ? incSum / monthsUsed : 0;
  const avgExp = monthsUsed ? expSum / monthsUsed : 0;
  const avgSurplus = avgInc - avgExp;

  const typedAssets = assets.filter(a => a.type && String(a.type).trim());
  const liquid = assets.reduce((s, a) => s + (String(a.type || '').trim() === 'Cash' ? Number(a.value || 0) : 0), 0);
  const runway = (liquid > 0 && avgExp > 0) ? liquid / avgExp : null;
  const runwayLabel = runway == null ? null : runway < 1 ? '<1 month' : runway > 24 ? '24+ months' : Math.round(runway) + ' month' + (runway >= 2 ? 's' : '');
  const topShare = total > 0 && top ? Number(top.value || 0) / total : 0;
  const cashShare = total > 0 ? liquid / total : 0;

  // Per-holding change vs end of last month (from snapshots)
  const eolm = new Date(_now2.getFullYear(), _now2.getMonth(), 0, 23, 59, 59);
  const assetDelta = {};
  assets.forEach(a => {
    const hist = (snaps || []).filter(s => String(s.asset_id) === String(a.id))
      .sort((x, y) => new Date(x.date || x.created_at) - new Date(y.date || y.created_at));
    let prev = null;
    hist.forEach(s => { if (new Date(s.date || s.created_at) <= eolm) prev = Number(s.value) || 0; });
    if (prev != null) assetDelta[a.id] = Number(a.value || 0) - prev;
  });
  let mover = null;
  Object.entries(assetDelta).forEach(([aid, d]) => {
    if (d !== 0 && (!mover || Math.abs(d) > Math.abs(mover.d))) {
      const a = assets.find(x => String(x.id) === String(aid));
      if (a) mover = { name: a.name || 'Untitled', d };
    }
  });

  // Next milestone: ₹10L steps below ₹1Cr, ₹25L steps above.
  const step = total < 10000000 ? 1000000 : 2500000;
  const milestone = Math.max(step, Math.ceil((total + 1) / step) * step);
  const etaMonths = avgSurplus > 0 ? Math.ceil((milestone - total) / avgSurplus) : null;
  const etaLabel = etaMonths != null && etaMonths <= 120
    ? new Date(_now2.getFullYear(), _now2.getMonth() + etaMonths, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' })
    : null;

  // ── The insights themselves (rule-based, only what applies, max 6) ────────
  const insights = [];
  if (top && topShare >= 0.35) insights.push({ tone: 'warn', text: `<b>${escapeHtml(topName)}</b> alone is <b>${Math.round(topShare * 100)}%</b> of your net worth. That's concentration risk — if it's a single bank or stock position, consider spreading it.` });
  else if (count >= 3 && top) insights.push({ tone: 'good', text: `Well diversified — your largest holding (<b>${escapeHtml(topName)}</b>) is only ${Math.round(topShare * 100)}% of net worth.` });

  if (runway != null) {
    if (runway >= 6) insights.push({ tone: 'good', text: `Your liquid cash (<b>${inr(liquid)}</b>) covers ≈ <b>${runwayLabel}</b> of expenses — a solid emergency cushion.` });
    else if (runway >= 3) insights.push({ tone: 'info', text: `Liquid cash (<b>${inr(liquid)}</b>) covers ≈ <b>${runwayLabel}</b> of expenses. A 6-month cushion is the usual target.` });
    else insights.push({ tone: 'warn', text: `Liquid cash covers only ≈ <b>${runwayLabel}</b> of expenses (${inr(liquid)}). Build the emergency cushion before chasing returns.` });
  }
  if (cashShare > 0.5 && runway != null && runway > 9) insights.push({ tone: 'info', text: `<b>${Math.round(cashShare * 100)}%</b> of your net worth sits in cash — beyond the emergency cushion, idle cash loses to inflation. Consider putting the excess to work.` });

  if (avgSurplus > 0) {
    const rate = avgInc > 0 ? Math.round(avgSurplus / avgInc * 100) : null;
    insights.push({ tone: 'good', text: `You're adding ≈ <b>${inr(avgSurplus)}/month</b> to your wealth${rate != null ? ` (saving ${rate}% of income)` : ''}.${etaLabel ? ` At this pace you cross <b>${inr(milestone)}</b> around <b>${etaLabel}</b>.` : ''}` });
  } else if (avgSurplus < 0 && monthsUsed) {
    insights.push({ tone: 'warn', text: `You spent ≈ <b>${inr(Math.abs(avgSurplus))}/month more than you earned</b> over the last ${monthsUsed} month${monthsUsed > 1 ? 's' : ''} — your assets are funding the gap.` });
  }

  if (avgInc > 0 && total > 0) {
    const mult = total / (avgInc * 12);
    insights.push({ tone: 'info', text: `Net worth ≈ <b>${mult.toFixed(1)}×</b> your annual income${mult < 1 ? ' — early days, keep the savings rate up' : mult >= 3 ? ' — strong position' : ''}.` });
  }
  if (mover) insights.push({ tone: mover.d > 0 ? 'good' : 'warn', text: `Biggest mover this month: <b>${escapeHtml(mover.name)}</b> ${mover.d > 0 ? '+' : '−'}${inr(Math.abs(mover.d))}.` });
  if (typedAssets.length < assets.length && assets.length > 0) insights.push({ tone: 'info', text: `${assets.length - typedAssets.length} holding${assets.length - typedAssets.length > 1 ? 's have' : ' has'} no type set. Edit each asset (Cash / Investment / Property) to sharpen the liquidity and allocation analysis.` });

  const toneColor = { good: 'var(--success)', warn: 'var(--danger)', info: 'var(--text-3)' };
  const insightsCard = insights.length ? `
    <div class="dash-card" style="margin-bottom:18px">
      <div class="fin-sec-h">What your money is telling you</div>
      ${insights.slice(0, 6).map(i => `
        <div class="fin-insight-row">
          <span class="fin-insight-dot" style="background:${toneColor[i.tone]}"></span>
          <span>${i.text}</span>
        </div>`).join('')}
    </div>` : '';

  // Milestone card for the rail
  const milestonePct = milestone > 0 ? Math.min(100, Math.round(total / milestone * 100)) : 0;
  const milestoneCard = total > 0 ? `
    <div class="finr-card">
      <div class="finr-h">Next milestone</div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px">
        <span style="font-size:20px; font-weight:800; color:var(--text-1)">${inr(milestone)}</span>
        <span style="font-size:12px; color:var(--text-muted)">${milestonePct}%</span>
      </div>
      <div class="finr-bar"><i style="width:${milestonePct}%"></i></div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:8px">${inr(milestone - total)} to go${etaLabel ? ` · ≈ ${etaLabel} at your current savings pace` : avgSurplus <= 0 ? ' · needs a positive monthly surplus' : ''}</div>
    </div>` : '';

  // Allocation by type (only worth a chart with 2+ types)
  const typeSums = {};
  assets.forEach(a => {
    const t = String(a.type || 'Other').trim() || 'Other';
    typeSums[t] = (typeSums[t] || 0) + Number(a.value || 0);
  });
  const typeRows = Object.entries(typeSums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const showAlloc = typeRows.length >= 2;
  const allocColors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];

  const chartsHTML = series ? `
    <div class="fin-ins-charts" style="margin-bottom:18px">
      <div class="dash-card"><div class="fin-sec-h">Net worth over time</div><div class="chart-box"><canvas id="finChNetWorth"></canvas></div></div>
      <div class="dash-card"><div class="fin-sec-h">Monthly growth</div><div class="chart-box"><canvas id="finChGrowth"></canvas></div></div>
    </div>` : (count > 0 ? `
    <div class="dash-card" style="margin-bottom:18px; font-size:13px; color:var(--text-muted)">
      Growth charts appear once value history builds up. Run <b>supabase/migration-assets.sql</b> once (Supabase → SQL Editor) to start tracking — every value update is then logged automatically, and “Log value” lets you backfill past months.
    </div>` : '');

  // Right rail: allocation donut (stacked vertically — the rail is narrow) + highlights.
  const allocCard = showAlloc ? `
    <div class="finr-card">
      <div class="finr-h">Allocation</div>
      <div class="fin-donut-wrap fin-donut-rail">
        <div class="fin-donut-box" style="flex-basis:auto; width:140px; height:140px; margin:0 auto"><canvas id="finChAlloc"></canvas></div>
        <div class="fin-donut-legend" style="width:100%">
          ${typeRows.map(([t, v], i) => `<div class="fin-catrow"><div class="cr-top"><span class="cr-dot" style="background:${allocColors[Math.min(i, allocColors.length - 1)]}"></span><span class="cr-name">${escapeHtml(t)}</span><span class="cr-share">${total > 0 ? Math.round(v / total * 100) : 0}%</span><span class="cr-amt">₹${Math.round(v).toLocaleString()}</span></div></div>`).join('')}
        </div>
      </div>
    </div>` : '';

  let highlightsCard = '';
  if (series) {
    const named = series.growth.map((v, i) => ({ v, label: series.labels[i] })).filter(x => x.v != null);
    if (named.length) {
      const best = named.reduce((a, b) => (b.v > a.v ? b : a));
      const worst = named.reduce((a, b) => (b.v < a.v ? b : a));
      const avgGrowth = Math.round(named.reduce((s, x) => s + x.v, 0) / named.length);
      const row = (l, x) => x == null ? '' : `<div style="display:flex; justify-content:space-between; align-items:baseline; font-size:13px; margin-bottom:8px"><span style="color:var(--text-muted)">${l}</span><span style="text-align:right"><b style="color:${x.v >= 0 ? 'var(--success)' : 'var(--danger)'}">${x.v >= 0 ? '+' : '−'}₹${Math.abs(x.v).toLocaleString()}</b><span style="color:var(--text-muted); font-size:11.5px"> ${x.label}</span></span></div>`;
      highlightsCard = `
    <div class="finr-card">
      <div class="finr-h">Growth highlights</div>
      ${row('Best month', best)}
      ${row('Worst month', worst)}
      <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:13px"><span style="color:var(--text-muted)">Avg / month</span><b style="color:${avgGrowth >= 0 ? 'var(--success)' : 'var(--danger)'}">${avgGrowth >= 0 ? '+' : '−'}₹${Math.abs(avgGrowth).toLocaleString()}</b></div>
    </div>`;
    }
  }

  container.innerHTML = `
    <div class="fin-kpis">
      <div class="fin-kpi"><div class="k-l">Net worth</div><div class="k-v">₹${total.toLocaleString()}</div></div>
      <div class="fin-kpi"><div class="k-l">This month</div>${deltaHTML}</div>
      <div class="fin-kpi"><div class="k-l">Liquid cash</div><div class="k-v">${liquid > 0 ? inr(liquid) : '—'}</div><div style="font-size:11.5px; color:var(--text-3); margin-top:2px">${runwayLabel != null ? `≈ ${runwayLabel} of expenses` : liquid > 0 ? 'no expense data yet' : 'tag assets as “Cash”'}</div></div>
      <div class="fin-kpi"><div class="k-l">Largest · ${topShort}</div><div class="k-v" style="color:${topShare >= 0.35 ? 'var(--danger)' : 'var(--text-1)'}">${Math.round(topShare * 100)}%</div><div style="font-size:11.5px; color:var(--text-3); margin-top:2px">of net worth · ${inr(Number(top ? top.value || 0 : 0))}</div></div>
    </div>
    <div class="fin-workspace">
      <div class="fin-main">
    ${insightsCard}
    ${chartsHTML}
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
             <div style="text-align:right">
               <div style="font-weight:700; font-variant-numeric:tabular-nums">₹${Number(a.value || 0).toLocaleString()}</div>
               ${assetDelta[a.id] != null && assetDelta[a.id] !== 0 ? `<div style="font-size:11.5px; font-weight:700; color:${assetDelta[a.id] > 0 ? 'var(--success)' : 'var(--danger)'}">${assetDelta[a.id] > 0 ? '+' : '−'}₹${Math.abs(assetDelta[a.id]).toLocaleString()} this mo</div>` : ''}
             </div>
             <button class="btn" style="font-size:12px; font-weight:600; padding:6px 10px" onclick="openLogAssetValue('${a.id}')" title="Log a value for any date">Log value</button>
             <button class="btn icon" onclick="openEditAsset('${a.id}')" title="Edit">${renderIcon('edit', null, 'style="width:14px"')}</button>
             <button class="btn icon" data-action="delete" data-sheet="assets" data-id="${a.id}">${renderIcon('delete', null, 'style="width:14px"')}</button>
          </div>
        </div>`;
          }).join('')}
        </div>
      </div>
      <aside class="fin-rail">${milestoneCard}${allocCard}${highlightsCard}</aside>
    </div>
  `;
  _finInitAssetCharts(series, typeRows, total);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ── Log an asset value for any date (builds the month-by-month history) ────
window.openLogAssetValue = function (id) {
  const a = (state.data.assets || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3 style="margin-bottom:4px">Log value — ${escapeHtml(a.name || 'Untitled')}</h3>
    <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px">Current: ₹${Number(a.value || 0).toLocaleString()}. Pick a past date to backfill history.</div>
    <input type="number" class="input" id="mAsValue" placeholder="Value (₹)" value="${a.value || ''}">
    <input type="date" class="input" id="mAsDate" value="${new Date().toISOString().slice(0, 10)}" style="margin-top:10px">
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="_finSaveAssetSnapshot('${a.id}')">Log value</button>
    </div>`;
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('mAsValue')?.focus(), 50);
};

window._finSaveAssetSnapshot = async function (id) {
  const a = (state.data.assets || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const value = Number(document.getElementById('mAsValue')?.value);
  const date = document.getElementById('mAsDate')?.value || new Date().toISOString().slice(0, 10);
  if (isNaN(value) || value < 0) { showToast('Enter a value'); return; }
  document.getElementById('universalModal').classList.add('hidden');
  try {
    const res = await apiCall('create', 'asset_snapshots', { asset_id: String(a.id), value, date });
    if (!state.data.asset_snapshots) state.data.asset_snapshots = [];
    state.data.asset_snapshots.push(res?.data || { id: res?.id, asset_id: String(a.id), value, date });
  } catch (e) {
    console.warn('[Assets] snapshot not saved — run supabase/migration-assets.sql:', e?.message);
    showToast('History needs the assets DB migration (supabase/migration-assets.sql)');
    return;
  }
  // If this log is the newest one, it IS the current value — keep the asset in sync.
  const newest = (state.data.asset_snapshots || [])
    .filter(s => String(s.asset_id) === String(a.id))
    .every(s => new Date(s.date || s.created_at) <= new Date(date));
  if (newest) {
    try { await apiCall('update', 'assets', { value }, a.id); a.value = value; } catch (e) { }
  }
  renderFinanceContent();
  showToast('Value logged');
};

// Net worth line + monthly growth bars + allocation doughnut.
function _finInitAssetCharts(series, typeRows, total, attempt = 0) {
  const needCharts = !!series || (typeRows && typeRows.length >= 2);
  if (!needCharts) return;
  if (typeof Chart === 'undefined') {
    if (attempt < 20) setTimeout(() => _finInitAssetCharts(series, typeRows, total, attempt + 1), 250);
    return;
  }
  const css = getComputedStyle(document.body);
  const cssVar = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const primary = cssVar('--primary', '#818CF8');
  const success = cssVar('--success', '#10B981');
  const danger = cssVar('--danger', '#DC2626');
  const textMuted = cssVar('--text-muted', '#9097A1');
  const grid = cssVar('--border-color', '#E5E7EB');
  const surface = cssVar('--surface-1', '#FFFFFF');
  const alpha = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const fmtC = (n) => '₹' + Math.round(n).toLocaleString();
  const compact = (n) => {
    const abs = Math.abs(n);
    if (abs >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (abs >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (abs >= 1000) return '₹' + (n / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return '₹' + n;
  };

  window._finCharts = window._finCharts || {};
  ['networth', 'growth', 'alloc'].forEach(k => { try { window._finCharts[k]?.destroy(); } catch (e) { } });

  const axisBase = (yTicks) => ({
    x: { grid: { display: false }, border: { color: grid }, ticks: { color: textMuted, font: { size: 10 }, maxRotation: 0 } },
    y: { grid: { color: grid }, border: { display: false }, ticks: { color: textMuted, font: { size: 10 }, maxTicksLimit: 5, callback: yTicks } }
  });

  if (series) {
    const nw = document.getElementById('finChNetWorth');
    if (nw) window._finCharts.networth = new Chart(nw.getContext('2d'), {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.totals,
          borderColor: primary, backgroundColor: alpha(primary, 0.10),
          fill: true, borderWidth: 2, pointRadius: 3, pointBackgroundColor: primary,
          pointBorderColor: surface, pointBorderWidth: 2, pointHoverRadius: 5, tension: 0.25
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { label: (i) => fmtC(i.parsed.y) } }
        },
        scales: { ...axisBase((v) => compact(v)), y: { ...axisBase((v) => compact(v)).y, beginAtZero: true } }
      }
    });

    const gr = document.getElementById('finChGrowth');
    if (gr) window._finCharts.growth = new Chart(gr.getContext('2d'), {
      type: 'bar',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.growth,
          backgroundColor: series.growth.map(v => v == null ? 'transparent' : (v >= 0 ? alpha(success, 0.75) : alpha(danger, 0.75))),
          hoverBackgroundColor: series.growth.map(v => v == null ? 'transparent' : (v >= 0 ? success : danger)),
          borderRadius: 4, maxBarThickness: 18
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            filter: (i) => i.parsed.y != null,
            callbacks: { label: (i) => (i.parsed.y >= 0 ? '+' : '−') + fmtC(Math.abs(i.parsed.y)) + ' vs previous month' }
          }
        },
        scales: axisBase((v) => (v > 0 ? '+' : v < 0 ? '−' : '') + compact(Math.abs(v)))
      }
    });
  }

  const al = document.getElementById('finChAlloc');
  if (al && typeRows && typeRows.length >= 2) {
    const colors = FIN_CAT_COLORS[_finIsDarkTheme() ? 'dark' : 'light'];
    window._finCharts.alloc = new Chart(al.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: typeRows.map(([t]) => t),
        datasets: [{
          data: typeRows.map(([, v]) => Math.round(v)),
          backgroundColor: typeRows.map((_, i) => colors[Math.min(i, colors.length - 1)]),
          borderColor: surface, borderWidth: 2, hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: { label: (i) => `${fmtC(i.parsed)} · ${total > 0 ? Math.round(i.parsed / total * 100) : 0}%` }
          }
        }
      }
    });
  }
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
    ${isExpense ? `<select class="input" id="mTxCategory" style="margin-top:10px; width:100%">
        <option value="">Select Category</option>
        ${categories.map(c => `<option value="${c}" ${tx.category === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>` : ''}
    ${isExpense ? _finScopeRadioHTML(tx.budget_scope === 'weekly' ? 'weekly' : 'monthly') : ''}
    <input class="input" id="mTxNote" placeholder="${isExpense ? 'Note (optional)' : 'Source (e.g. Salary)'}" value="${(tx.description || tx.notes || '').replace(/"/g, '&quot;')}" style="margin-top:10px">

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
    <input class="input" id="mFundName" value="${(f.fund_name || f.name || '').replace(/"/g, '&quot;')}" placeholder="Fund Name">
    <input type="number" class="input" id="mFundTarget" value="${f.target_amount ?? ''}" placeholder="Target Amount">
    <input type="number" class="input" id="mFundCurrent" value="${f.current_amount ?? f.balance ?? ''}" placeholder="Current Savings">
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