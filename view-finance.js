/* view-finance.js */

let finState = 'expenses'; // 'expenses', 'income', 'funds', 'assets'
let finRange = 'week';    // 'week', 'month', 'year'

function renderFinance() {
  const main = document.getElementById('main');

  main.innerHTML = `
    <div class="finance-wrapper">
      <div class="header-row">
        <h2 class="page-title">Finance</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" onclick="openFinanceAction()">${renderIcon('add', null, 'style="width:14px; margin-right:4px;"')} Add New</button>
        </div>
      </div>

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

/* --- DYNAMIC MODAL LOGIC (Hierarchical Budget Update) --- */
window.openFinanceAction = function () {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  if (finState === 'expenses' || finState === 'income') {
    // 1. TRANSACTION FORM
    const defaultType = finState === 'expenses' ? 'expense' : 'income';

    // Get categories from settings (single source)
    const categories = getAllFinanceCategories();

    box.innerHTML = `
      <h3>New Transaction</h3>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px">
         <select class="input" id="mTxType" style="margin:0">
             <option value="expense" ${defaultType === 'expense' ? 'selected' : ''}>Expense</option>
             <option value="income" ${defaultType === 'income' ? 'selected' : ''}>Income</option>
         </select>
         <input type="date" class="input" id="mTxDate" value="${new Date().toISOString().slice(0, 10)}" style="margin:0">
      </div>
      
      <input type="number" class="input" id="mTxAmount" placeholder="Amount (₹)">
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <select class="input" id="mTxCategory" style="margin:0">
              <option value="">Select Category</option>
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>

          <input class="input" id="mTxPaymentMode" placeholder="Payment Mode" list="paymentModeOptions">
          <datalist id="paymentModeOptions">
            <option value="Cash">
            <option value="UPI">
            <option value="Card">
            <option value="Bank Transfer">
            <option value="Other">
          </datalist>
      </div>

      <input class="input" id="mTxNote" placeholder="Note (optional — e.g. 'Birthday dinner')" style="margin-top:10px">

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="save-tx-modal">Save Transaction</button>
      </div>
    `;
  }
  else if (finState === 'funds') {
    // 2. FUND FORM
    box.innerHTML = `
      <h3>New Fund Goal</h3>
      <input class="input" id="mFundName" placeholder="Fund Name (e.g. New Laptop)">
      <input type="number" class="input" id="mFundTarget" placeholder="Target Amount (₹)">
      <input type="number" class="input" id="mFundCurrent" placeholder="Current Savings (₹)">
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="save-fund-modal">Save Goal</button>
      </div>
    `;
  }
  else if (finState === 'assets') {
    // 3. ASSET FORM
    box.innerHTML = `
      <h3>New Asset</h3>
      <input class="input" id="mAssetName" placeholder="Asset Name (e.g. Gold, Stocks)">
      <select class="input" id="mAssetType">
         <option value="Cash">Cash</option>
         <option value="Investment">Investment</option>
         <option value="Property">Property</option>
      </select>
      <input type="number" class="input" id="mAssetValue" placeholder="Current Value (₹)">
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="save-asset-modal">Save Asset</button>
      </div>
    `;
  }

  modal.classList.remove('hidden');
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
      // Check if this category is marked as weekly in settings
      // Handle both old format (string/number) and new format (object)
      const catData = categoryBudgets[e.category];
      let catSource = 'weekly'; // Default to weekly for backward compatibility

      if (catData !== undefined) {
        if (typeof catData === 'object' && catData !== null) {
          catSource = catData.source || 'weekly';
        } else {
          // Old format - treat as weekly
          catSource = 'weekly';
        }
      }
      // If category is not in budget settings at all, show in weekly (backward compat)

      if (catSource !== 'weekly') return false;

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

  // Render
  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-bottom:24px;">
      <div style="background:var(--surface-3); padding:4px; border-radius:10px; display:flex; gap:2px;">
        <button class="range-btn ${finRange === 'week' ? 'active' : ''}" onclick="switchFinRange('week')">Weekly View</button>
        <button class="range-btn ${finRange === 'month' ? 'active' : ''}" onclick="switchFinRange('month')">Monthly View</button>
        <button class="range-btn ${finRange === 'year' ? 'active' : ''}" onclick="switchFinRange('year')">Yearly View</button>
      </div>
    </div>

    <!-- HIERARCHICAL BUDGET CARDS -->
    <div class="grid" style="grid-template-columns: 1fr; gap: 16px; margin-bottom: var(--space-6);">
        ${finRange === 'month' ? renderMonthlyOverview(totalExp, monthlyBudget, catSpent, categoryBudgets) : ''}
        ${finRange === 'week' ? renderWeeklyOverview(totalExp, weeklyBudget) : ''}
    </div>

    <!-- Transactions List -->
    <div class="transactions-list">
      <h3 style="margin-bottom: var(--space-4); color:var(--text-main);">Recent Transactions</h3>
      ${expenseItems.length === 0 ? '<div class="empty-state">No transactions found</div>' : ''}
      ${expenseItems.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15).map(renderTransactionCard).join('')}
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

  const catHtml = allCats.map(c => {
    const spent = catSpent?.[c] || 0;
    // Handle both old format (number) and new format (object)
    const catData = catLimits?.[c];
    let climit = 0;
    if (typeof catData === 'object' && catData !== null) {
      climit = Number(catData.budget) || 0;
    } else {
      climit = Number(catData) || 0;
    }
    if (spent === 0 && climit === 0) return '';

    const cpct = climit > 0 ? Math.min(100, (spent / climit) * 100) : (spent > 0 ? 100 : 0);
    const ccolor = (climit > 0 && spent > climit) ? 'var(--danger)' : 'var(--primary)';

    return `
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px">
                <span>${c}</span>
                <span>₹${spent} ${climit ? '/ ₹' + climit : ''}</span>
            </div>
            <div style="height:6px; background:var(--surface-3); border-radius:3px; overflow:hidden">
                <div style="height:100%; width:${cpct}%; background:${ccolor}; transition: width 0.3s"></div>
            </div>
        </div>`;
  }).join('');

  return `
    <div class="dash-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
             <div class="stat-label">${renderIcon('calendar', null, 'style="width:14px; margin-right:6px; display:inline-block"')} Monthly Overview</div>
             <div class="stat-val" style="font-size:1.2em">₹${totalExp} <span style="font-size:0.6em; color:var(--text-muted)">/ ₹${limit || 0}</span></div>
        </div>
        
        <div class="progress-bg" style="height:10px; margin-bottom:16px; background:var(--surface-3); border-radius:5px; overflow:hidden">
             <div class="progress-fill" style="width:${pct}%; background:${color}; transition: width 0.3s"></div>
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

function renderWeeklyOverview(totalExp, limit) {
  const now = new Date();
  const weekBounds = getWeekBounds(now);
  const mondayStr = weekBounds.start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const sundayStr = weekBounds.end.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const pct = limit > 0 ? Math.min(100, (totalExp / limit) * 100) : 0;
  const color = pct > 100 ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--success)');

  return `
     <div class="dash-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
             <div class="stat-label">${renderIcon('priority', null, 'style="width:14px; margin-right:6px; display:inline-block"')} Weekly Budget (${mondayStr} - ${sundayStr})</div>
             <div class="stat-val" style="font-size:1.2em">₹${totalExp} <span style="font-size:0.6em; color:var(--text-muted)">/ ${limit}</span></div>
        </div>
        
        <div class="progress-bg" style="height:8px; mb-4">
             <div class="progress-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <div style="font-size:12px; margin-top:8px; color:var(--text-muted)">
            Includes only expenses marked as "Weekly Budget". Fixed monthly bills are excluded.
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
        ${tx.notes ? `<div class="transaction-notes" style="font-weight:600; margin-bottom:4px;">${tx.notes}</div>` : ''}
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
  const assets = state.data.assets || [];
  const total = assets.reduce((s, a) => s + Number(a.value), 0);
  container.innerHTML = `
    <div class="dash-card net-worth-card" style="margin-bottom:20px">
      <div class="stat-label" style="color:var(--text-inverse); opacity:0.7">Total Net Worth</div>
      <div class="stat-val" style="color:var(--text-inverse)">₹${total.toLocaleString()}</div>
    </div>
    <div class="card" style="padding:0; overflow:hidden">
      ${assets.map(a => `
        <div class="asset-item">
          <div><div style="font-weight:600">${a.asset_name}</div><div class="asset-type">${a.type}</div></div>
          <div style="display:flex; align-items:center; gap:10px">
             <div style="font-weight:600">₹${Number(a.value).toLocaleString()}</div>
             <button class="btn icon" onclick="openEditAsset('${a.id}')" title="Edit">${renderIcon('edit', null, 'style="width:14px"')}</button>
             <button class="btn icon" data-action="delete" data-sheet="assets" data-id="${a.id}">${renderIcon('delete', null, 'style="width:14px"')}</button>
          </div>
        </div>
      `).join('')}
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
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <select class="input" id="mTxCategory" style="margin:0">
            <option value="">Select Category</option>
            ${categories.map(c => `<option value="${c}" ${tx.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <input class="input" id="mTxPaymentMode" placeholder="Payment Mode" list="paymentModeEdit" value="${(tx.payment_mode || '').replace(/"/g, '&quot;')}">
        <datalist id="paymentModeEdit">
          <option value="Cash">
          <option value="UPI">
          <option value="Card">
          <option value="Bank Transfer">
          <option value="Other">
        </datalist>
    </div>
    <input class="input" id="mTxNote" placeholder="Note (optional)" value="${(tx.notes || '').replace(/"/g, '&quot;')}" style="margin-top:10px">

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
    const url = SCRIPT_URL + '?action=deleteRow&sheet=expenses&id=' + encodeURIComponent(id);
    const resp = await fetch(url);
    const result = await resp.json();
    if (result.status === 'success') {
      document.getElementById('universalModal').classList.add('hidden');
      state.data.expenses = (state.data.expenses || []).filter(x => String(x.id) !== String(id));
      renderFinExpenses();
    } else {
      alert('Error: ' + (result.error || 'Unknown error'));
    }
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
    <input class="input" id="mAssetName" value="${(a.asset_name || '').replace(/"/g, '&quot;')}" placeholder="Asset Name">
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

// Get all categories from settings (single source: category_budgets)
function getAllFinanceCategories() {
  // Get categories from budget settings (single source of truth)
  const settings = state.data.settings?.[0] || {};
  let budgetCats = {};
  try {
    if (settings.category_budgets) budgetCats = JSON.parse(settings.category_budgets);
  } catch (e) { }
  const budgetCatKeys = Object.keys(budgetCats).filter(c => c && c.trim() !== '');

  return budgetCatKeys.sort();
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