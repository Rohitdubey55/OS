/* view-settings.js - Frontend Aligned with User's Backend Schema */

function renderSettings() {
  // Toggle function for collapsible sections
  window.toggleSection = function(sectionId) {
    var body = document.getElementById('body-' + sectionId);
    var icon = document.getElementById('icon-' + sectionId);
    if (body) {
      if (body.style.display === 'none') {
        body.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else {
        body.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
      }
    }
  };
  
  // Map backend keys to frontend variables
  // Backend relies on: ai_api_key, view_mode
  const s = state.data.settings?.[0] || {};

  const settings = {
    weekly_budget: s.weekly_budget || 0,
    monthly_budget: s.monthly_budget || 0,
    theme_color: s.theme_color || '#4F46E5',
    theme_mode: s.theme_mode || 'light',
    hidden_tabs: s.hidden_tabs || '',
    // Map 'ai_api_key' from sheet to 'gemini_api_key' for UI
    gemini_api_key: s.ai_api_key || '',
    ai_model: s.ai_model || 'gemini-1.5-flash',
    category_budgets: s.category_budgets || '{}',
    // Orientation lock setting
    orientation_lock: s.orientation_lock || 'auto',
    // User name
    name: s.name || s.user_name || '',
    // Custom greeting messages
    morning_message: s.morning_message || '',
    afternoon_message: s.afternoon_message || '',
    evening_message: s.evening_message || ''
  };

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="settings-wrapper">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px">
        <h2 class="page-title" style="margin:0">Settings</h2>
      </div>

      <!-- 1. PROFILE -->
      <details class="settings-details" style="margin-bottom:16px; border:1px solid var(--border-color); border-radius:16px; display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="user" style="width:18px; margin-right:8px;"></i> Profile</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Your personal information.</p>
        
        <div style="margin-bottom:16px">
          <label class="setting-label">Display Name</label>
          <input type="text" class="input" id="userName" value="${settings.name}" placeholder="Enter your name">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">This name will appear in your daily greeting.</p>
        </div>

        <div style="margin-bottom:16px">
          <label class="setting-label">Morning Message</label>
          <input type="text" class="input" id="morningMessage" value="${settings.morning_message}" placeholder="Review your plan for the day">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Shown in the morning (before 12 PM)</p>
        </div>

        <div style="margin-bottom:16px">
          <label class="setting-label">Afternoon Message</label>
          <input type="text" class="input" id="afternoonMessage" value="${settings.afternoon_message}" placeholder="Stay focused on your goals">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Shown in the afternoon (12 PM - 6 PM)</p>
        </div>

        <div style="margin-bottom:16px">
          <label class="setting-label">Evening Message</label>
          <input type="text" class="input" id="eveningMessage" value="${settings.evening_message}" placeholder="Great work today!">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Shown in the evening (after 6 PM)</p>
        </div>
        <button class="btn primary" onclick="saveAllSettings('profile')">Save Profile</button>
        </div>
        </details>

      <!-- 2. BUDGET -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="wallet" style="width:18px; margin-right:8px;"></i> Budget Settings</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Manage your financial tracking limits.</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px">
           <div>
             <label class="setting-label">Weekly Budget</label>
             <input type="number" class="input" id="weeklyBudget" value="${settings.weekly_budget}" placeholder="0">
           </div>
           <div>
             <label class="setting-label">Monthly Budget</label>
             <input type="number" class="input" id="monthlyBudget" value="${settings.monthly_budget}" placeholder="0">
           </div>
        </div>
        
        <label class="setting-label">Category Limits</label>
        <div id="categoryBudgetList"></div>
        <button class="btn small" style="margin-top:12px" onclick="addCategoryRow()">+ Add Category</button>
        <button class="btn primary" style="margin-top:12px; margin-left:8px;" onclick="saveAllSettings('budget')">Save Budget</button>
        </div>
        </details>

      <!-- 3. APPEARANCE -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="palette" style="width:18px; margin-right:8px;"></i> Appearance</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Customize the look and feel of your OS.</p>
        
        <!-- Accents -->
        <div class="setting-item">
            <label class="setting-label">Accent Color</label>
            <div class="theme-colors">
                ${renderColorOption('#6366F1', settings.theme_color)} <!-- Indigo -->
                ${renderColorOption('#3B82F6', settings.theme_color)} <!-- Blue -->
                ${renderColorOption('#10B981', settings.theme_color)} <!-- Emerald -->
                ${renderColorOption('#8B5CF6', settings.theme_color)} <!-- Violet -->
                ${renderColorOption('#EC4899', settings.theme_color)} <!-- Pink -->
                ${renderColorOption('#EF4444', settings.theme_color)} <!-- Red -->
                ${renderColorOption('#F59E0B', settings.theme_color)} <!-- Amber -->
                ${renderColorOption('#14B8A6', settings.theme_color)} <!-- Teal -->
                ${renderColorOption('#F97316', settings.theme_color)} <!-- Orange -->
                ${renderColorOption('#06B6D4', settings.theme_color)} <!-- Cyan -->
                ${renderColorOption('#84CC16', settings.theme_color)} <!-- Lime -->
                ${renderColorOption('#A855F7', settings.theme_color)} <!-- Purple -->
            </div>
            <input type="hidden" id="sColor" value="${settings.theme_color}">
        </div>

        <!-- Theme Mode -->
        <div class="setting-item">
            <label class="setting-label">Theme Mode</label>
            <div class="density-options" id="themeModeOptions">
                <button class="density-btn ${settings.theme_mode === 'light' ? 'active' : ''}" onclick="selectThemeMode('light')">Light</button>
                <button class="density-btn ${settings.theme_mode === 'dark' ? 'active' : ''}" onclick="selectThemeMode('dark')">Dark</button>
                <button class="density-btn ${settings.theme_mode === 'forest' ? 'active' : ''}" onclick="selectThemeMode('forest')">Forest</button>
                <button class="density-btn ${settings.theme_mode === 'midnight' ? 'active' : ''}" onclick="selectThemeMode('midnight')">Midnight</button>
                <button class="density-btn ${settings.theme_mode === 'sunset' ? 'active' : ''}" onclick="selectThemeMode('sunset')">Sunset</button>
                <button class="density-btn ${settings.theme_mode === 'ocean' ? 'active' : ''}" onclick="selectThemeMode('ocean')">Ocean</button>
                <button class="density-btn ${settings.theme_mode === 'lavender' ? 'active' : ''}" onclick="selectThemeMode('lavender')">Lavender</button>
                <button class="density-btn ${settings.theme_mode === 'rose' ? 'active' : ''}" onclick="selectThemeMode('rose')">Rose</button>
            </div>
        </div>

        <!-- Orientation Lock -->
        <div class="setting-item">
            <label class="setting-label">Screen Orientation</label>
            <div class="density-options" id="orientationOptions">
                <button class="density-btn ${(settings.orientation_lock || 'auto') === 'auto' ? 'active' : ''}" onclick="selectOrientation('auto')">Auto</button>
                <button class="density-btn ${settings.orientation_lock === 'portrait' ? 'active' : ''}" onclick="selectOrientation('portrait')">Portrait</button>
                <button class="density-btn ${settings.orientation_lock === 'landscape' ? 'active' : ''}" onclick="selectOrientation('landscape')">Landscape</button>
            </div>
            <input type="hidden" id="sOrientation" value="${settings.orientation_lock || 'auto'}">
        </div>
        <button class="btn primary" onclick="saveAllSettings('appearance')">Save Appearance</button>
      </details>

      <!-- 3. AI CONFIG -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="cpu" style="width:18px; margin-right:8px;"></i> AI Configuration</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Power your dashboard with Google Gemini.</p>
        
        <div class="setting-item">
            <label class="setting-label">Gemini API Key</label>
            <div style="display:flex; gap:10px">
                <input type="password" class="input" id="sApiKey" value="${settings.gemini_api_key}" placeholder="AIzaSy...">
                <button class="btn secondary" onclick="testGeminiAPI()">Test</button>
            </div>
        </div>
        <div class="setting-item">
            <label class="setting-label">AI Model ID</label>
            <input type="text" class="input" id="sModel" value="${settings.ai_model}" placeholder="gemini-1.5-flash">
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px">
                Presets: 
                <span class="model-chip" onclick="setModel('gemini-1.5-flash')">Flash</span>
                <span class="model-chip" onclick="setModel('gemini-2.0-flash')">2.0 Flash</span>
                <span class="model-chip" onclick="setModel('gemini-1.5-pro')">Pro</span>
            </div>
        </div>
        <button class="btn primary" onclick="saveAllSettings('ai')">Save AI</button>
        </div>
      </details>

      <!-- 4. TAB VISIBILITY -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="layout" style="width:18px; margin-right:8px;"></i> Tab Visibility</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Toggle modules on or off.</p>
        
        <div class="tab-toggles">
           ${renderTabToggle('Calendar', 'calendar', settings.hidden_tabs)}
           ${renderTabToggle('Tasks', 'tasks', settings.hidden_tabs)}
           ${renderTabToggle('Finance', 'finance', settings.hidden_tabs)}
           ${renderTabToggle('Habits', 'habits', settings.hidden_tabs)}
           ${renderTabToggle('Diary', 'diary', settings.hidden_tabs)}
           ${renderTabToggle('Vision', 'vision', settings.hidden_tabs)}
           ${renderTabToggle('People', 'people', settings.hidden_tabs)}
        </div>
        <button class="btn primary" onclick="saveAllSettings('tabs')" style="margin-top:12px">Save Tabs</button>
        </div>
      </details>

      <!-- 4. NOTIFICATIONS -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="bell" style="width:18px; margin-right:8px;"></i> Notifications</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Configure reminder and notification preferences.</p>
        
        <div class="setting-item">
            <label class="setting-label">Enable Notifications</label>
            <label class="toggle">
                <input type="checkbox" id="notificationsEnabled" checked>
                <span class="slider"></span>
            </label>
        </div>
        
        <div class="setting-item">
            <button class="btn secondary" onclick="requestNotificationPermission()">
                <i data-lucide="bell"></i> Request Browser Permission
            </button>
            <span class="permission-status" id="notificationPermissionStatus"></span>
        </div>
        
        <div class="setting-item">
            <label class="setting-label">Notification Sound</label>
            <select id="notificationSound" class="input">
                <option value="default">Default</option>
                <option value="alert">Alert</option>
                <option value="none">Silent</option>
            </select>
        </div>
        
        <div class="setting-item">
            <label class="setting-label">Default Notification Method</label>
            <select id="notificationMethod" class="input">
                <option value="both">Browser + In-App</option>
                <option value="browser">Browser Only</option>
                <option value="in-app">In-App Only</option>
            </select>
        </div>
        
        <div class="setting-item">
            <label class="setting-label">Quiet Hours</label>
            <div style="display:flex; align-items:center; gap:10px">
                <input type="time" id="quietHoursStart" class="input" value="22:00">
                <span>to</span>
                <input type="time" id="quietHoursEnd" class="input" value="08:00">
            </div>
            <p class="setting-hint">No notifications during quiet hours (except marked urgent)</p>
        </div>
        <button class="btn primary" onclick="saveAllSettings('notifications')" style="margin-top:12px">Save Notifications</button>
        </div>
      </details>

      <!-- 5. DATA MANAGEMENT -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title"><i data-lucide="database" style="width:18px; margin-right:8px;"></i> Data Management</div>
            <i data-lucide="chevron-down" style="width:20px; transition:transform 0.3s;"></i>
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">View raw data or reset the application.</p>
        
        <div class="data-management-actions">
           <button class="btn secondary" onclick="openGoogleSheet()"><i data-lucide="table" style="width:16px; margin-right:8px"></i> Open Google Sheet</button>
           <button class="btn danger" onclick="confirmDeleteAllData()"><i data-lucide="trash-2" style="width:16px; margin-right:8px"></i> Delete All Data</button>
        </div>
        </div>
      </details>

      <!-- SAVE SECTION -->
    </div>
  `;

  // Init Colors
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', function () {
      const color = this.dataset.color;
      document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('sColor').value = color;
      document.documentElement.style.setProperty('--primary', color);
    });
  });

  initCategoryRows(settings.category_budgets);
  
  // Add toggle functionality for collapsible sections
  document.querySelectorAll('.settings-section .widget-header').forEach(header => {
    const body = header.nextElementSibling;
    
    header.addEventListener('click', function() {
      const isExpanded = !body.classList.contains('hidden');
      body.classList.toggle('hidden');
      header.classList.toggle('expanded', !isExpanded);
    });
  });
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  
  // Load notification settings from localStorage
  loadNotificationSettingsUI();
}

// Helpers
function renderColorOption(color, activeColor) {
  const isActive = (activeColor || '#4F46E5').toLowerCase() === color.toLowerCase();
  return `<div class="color-option ${isActive ? 'active' : ''}" style="background-color: ${color}" data-color="${color}"></div>`;
}

function renderTabToggle(label, key, hiddenStr) {
  const isHidden = (hiddenStr || '').includes(key);
  return `
      <label class="tab-toggle-item">
         <div class="toggle-label">
            <input type="checkbox" class="tab-checkbox" value="${key}" ${!isHidden ? 'checked' : ''}>
            <span class="toggle-name">${label}</span>
         </div>
         <div style="font-size:12px; color:var(--text-muted); margin-top:4px">Show ${label} tab</div>
      </label>
    `;
}

// --- HELPER: Set Model from Chip ---
window.setModel = function (modelId) {
  const input = document.getElementById('sModel');
  if (input) {
    input.value = modelId;
    // visual feedback
    input.style.borderColor = 'var(--primary)';
    setTimeout(() => input.style.borderColor = '', 300);
  }
}

// --- HELPER: Update Tab Visibility (Instant) ---
window.updateTabVisibility = function () {
  const settings = state.data.settings?.[0];
  if (!settings) return;

  const hiddenStr = settings.hidden_tabs || '';
  const hiddenList = hiddenStr.split(',').map(s => s.trim());

  // 1. Sidebar Items
  document.querySelectorAll('.nav-item').forEach(el => {
    const target = el.dataset.target;
    if (hiddenList.includes(target)) el.style.display = 'none';
    else el.style.display = 'flex';
  });

  // 2. Mobile Nav Items
  document.querySelectorAll('.mob-item').forEach(el => {
    const target = el.dataset.target;
    if (hiddenList.includes(target)) el.style.display = 'none';
    else el.style.display = 'flex';
  });
}

// --- APPLY SETTINGS (Unified Logic) ---
window.applySettings = function () {
  const settings = state.data.settings?.[0];
  if (!settings) return;

  // 1. Theme Color
  const color = settings.theme_color || '#4F46E5';
  document.documentElement.style.setProperty('--primary', color);

  // 2. Theme Mode (Light/Dark/Forest/Midnight/Sunset/Ocean/Lavender/Rose)
  const mode = settings.theme_mode || 'light';
  document.documentElement.setAttribute('data-theme', mode);

  // 3. Tabs
  updateTabVisibility();

  // 5. Update UI State if on Settings Page
  if (state.view === 'settings') {
    // Update Color Pickers
    document.querySelectorAll('.color-option').forEach(el => {
      el.classList.toggle('active', el.dataset.color === color);
    });
    // Update Theme Mode Buttons
    document.querySelectorAll('#themeModeOptions .density-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase() === mode);
    });
  }
};

// Interactive Logic
window.selectThemeMode = function (mode) {
  const parent = document.getElementById('themeModeOptions');
  parent.querySelectorAll('.density-btn').forEach(x => x.classList.remove('active'));
  event.target.classList.add('active');
  document.documentElement.setAttribute('data-theme', mode);
}

window.selectOrientation = function (orientation) {
  const parent = document.getElementById('orientationOptions');
  parent.querySelectorAll('.density-btn').forEach(x => x.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('sOrientation').value = orientation;
  
  // Apply orientation lock
  applyOrientationLock(orientation);
}

// Apply orientation lock
function applyOrientationLock(orientation) {
  console.log('Applying orientation lock:', orientation);
  
  // Try Screen Orientation API first
  if (screen.orientation) {
    if (orientation === 'auto') {
      screen.orientation.unlock().catch(e => console.log('Orientation unlock failed:', e));
    } else if (orientation === 'portrait') {
      screen.orientation.lock('portrait').catch(e => {
        console.log('Portrait lock failed, trying portrait-primary:', e);
        screen.orientation.lock('portrait-primary').catch(e2 => console.log('Orientation lock failed:', e2));
      });
    } else if (orientation === 'landscape') {
      screen.orientation.lock('landscape').catch(e => {
        console.log('Landscape lock failed, trying landscape-primary:', e);
        screen.orientation.lock('landscape-primary').catch(e2 => console.log('Orientation lock failed:', e2));
      });
    }
  } else {
    console.log('Screen Orientation API not supported - using CSS fallback');
    // Fallback: Apply CSS transform for visual effect (won't actually lock device)
    applyOrientationCSS(orientation);
  }
}

// CSS fallback for orientation (visual only)
function applyOrientationCSS(orientation) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  
  if (orientation === 'portrait') {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } else if (orientation === 'landscape') {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } else {
    meta.setAttribute('content', 'width=device-width, initial-scale=1');
  }
}

function initCategoryRows(jsonStr) {
  const container = document.getElementById('categoryBudgetList');
  container.innerHTML = '';
  const data = safeJsonParse(jsonStr);
  
  // Get unique categories from transactions (Money tab) - only from sheet
  const txCategories = new Set();
  if (state.data.expenses) {
    state.data.expenses.forEach(e => {
      if (e.category) txCategories.add(e.category);
    });
  }
  
  // Combine: saved budget categories + transaction categories (NO hardcoded defaults)
  const allCats = new Set([
    ...Object.keys(data),
    ...txCategories
  ]);
  
  if (allCats.size === 0) {
    // No categories - show one empty row for user to add
    addCategoryRow('', '');
  } else {
    // Sort: saved budget categories first, then alphabetically
    const sortedCats = [...allCats].sort((a, b) => {
      const aHasBudget = data[a] !== undefined && data[a] !== '';
      const bHasBudget = data[b] !== undefined && data[b] !== '';
      if (aHasBudget && !bHasBudget) return -1;
      if (!aHasBudget && bHasBudget) return 1;
      return a.localeCompare(b);
    });
    
    sortedCats.forEach(cat => {
      const budget = data[cat] || '';
      addCategoryRow(cat, budget);
    });
  }
}

function safeJsonParse(str) {
  if (!str) return {};
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (e) { return {}; }
}

window.addCategoryRow = function (cat = '', amt = '') {
  // Get unique categories from transactions for suggestions (only from sheet)
  const txCategories = new Set();
  if (state.data.expenses) {
    state.data.expenses.forEach(e => {
      if (e.category) txCategories.add(e.category);
    });
  }
  
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '10px';
  div.style.marginBottom = '10px';
  div.className = 'cat-budget-row';
  div.innerHTML = `
      <input type="text" class="input cat-name" placeholder="Category" value="${cat}" style="flex:1" list="settingsCatOptions">
      <datalist id="settingsCatOptions">
        ${[...txCategories].map(c => `<option value="${c}">`).join('')}
      </datalist>
      <input type="number" class="input cat-amt" placeholder="Limit" value="${amt}" style="flex:1">
      <button class="btn danger small" onclick="this.parentElement.remove()">X</button>
    `;
  document.getElementById('categoryBudgetList').appendChild(div);
};

// --- DATA SYNC LOGIC (Aligned with User Backend) ---
window.saveAllSettings = async function (section = 'all') {
  // Profile fields
  const name = document.getElementById('userName')?.value || '';
  const morning = document.getElementById('morningMessage')?.value || '';
  const afternoon = document.getElementById('afternoonMessage')?.value || '';
  const evening = document.getElementById('eveningMessage')?.value || '';
  
  // Budget fields
  const weekly = document.getElementById('weeklyBudget').value;
  const monthly = document.getElementById('monthlyBudget').value;
  const cats = {};
  document.querySelectorAll('.cat-budget-row').forEach(row => {
    const c = row.querySelector('.cat-name').value.trim();
    const a = row.querySelector('.cat-amt').value;
    if (c && a) cats[c] = Number(a);
  });
  
  // Appearance fields
  const color = document.getElementById('sColor').value;
  let themeMode = 'light';
  const modeBtn = document.querySelector('#themeModeOptions .density-btn.active');
  if (modeBtn) themeMode = modeBtn.textContent.toLowerCase();
  const orientationEl = document.getElementById('sOrientation');
  const orientation = orientationEl?.value || 'auto';
  
  // AI fields
  const apiKey = document.getElementById('sApiKey').value;
  const model = document.getElementById('sModel').value;
  
  // Tab fields
  const allTabs = ['calendar', 'tasks', 'finance', 'habits', 'diary', 'vision', 'people'];
  const checkedTabs = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => cb.value);
  const hidden = allTabs.filter(t => !checkedTabs.includes(t)).join(',');

  // Build settings object based on section
  let newSettings = {};
  
  if (section === 'all' || section === 'profile') {
    newSettings.name = name;
    newSettings.morning_message = morning;
    newSettings.afternoon_message = afternoon;
    newSettings.evening_message = evening;
  }
  
  if (section === 'all' || section === 'budget') {
    newSettings.weekly_budget = Number(weekly);
    newSettings.monthly_budget = Number(monthly);
    newSettings.category_budgets = JSON.stringify(cats);
  }
  
  if (section === 'all' || section === 'appearance') {
    newSettings.theme_color = color;
    newSettings.theme_mode = themeMode;
    newSettings.orientation_lock = orientation;
  }
  
  if (section === 'all' || section === 'ai') {
    newSettings.ai_api_key = apiKey;
    newSettings.ai_model = model;
  }
  
  if (section === 'all' || section === 'tabs') {
    newSettings.hidden_tabs = hidden;
  }

  if (section === 'all' || section === 'notifications') {
    saveNotificationSettings();
  }

  const sectionNames = { profile: 'Profile', budget: 'Budget', appearance: 'Appearance', ai: 'AI', tabs: 'Tab Visibility', notifications: 'Notifications' };
  showToast(section === 'all' ? 'Saving settings...' : `Saving ${sectionNames[section] || 'settings'}...`);
  
  // Optimistic Update
  if (state.data.settings?.[0]) {
    Object.assign(state.data.settings[0], newSettings);
    if (section === 'all' || section === 'appearance') applySettings();
  }

  const existingId = state.data.settings?.[0]?.id;

  if (existingId) {
    await apiCall('update', 'settings', newSettings, existingId);
  } else {
    // If no settings exist, Create
    await apiCall('create', 'settings', newSettings);
    await refreshData('settings');
  }

  showToast('Settings Saved!');
};

window.testGeminiAPI = async function () {
  const key = document.getElementById('sApiKey').value;
  if (!key) { showToast('Enter API Key', 'error'); return; }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
    });
    if (res.ok) showToast('API Key Valid! ✅');
    else showToast('Invalid Key ❌', 'error');
  } catch (e) { showToast('Connection Error', 'error'); }
};

window.openGoogleSheet = function () {
  window.open('https://docs.google.com/spreadsheets/d/1m1r9fZ9cO8izkb-YIs-iz5hZljTpm3p0PzD-LiS0hZM/', '_blank');
};

window.confirmDeleteAllData = function () {
  if (confirm("Delete ALL Data? This cannot be undone.")) {
    showToast('Data reset initiated...', 'error');
  }
};

// --- NOTIFICATION SETTINGS HELPERS ---

function loadNotificationSettingsUI() {
    // Get notification state
    const enabled = document.getElementById('notificationsEnabled');
    const sound = document.getElementById('notificationSound');
    const method = document.getElementById('notificationMethod');
    const quietStart = document.getElementById('quietHoursStart');
    const quietEnd = document.getElementById('quietHoursEnd');
    const status = document.getElementById('notificationPermissionStatus');
    
    if (enabled && window.notificationState) {
        enabled.checked = window.notificationState.enabled;
        if (sound) sound.value = window.notificationState.sound || 'default';
        if (method) method.value = window.notificationState.defaultMethod || 'both';
        if (quietStart) quietStart.value = padZero(window.notificationState.quietHoursStart || 22) + ':00';
        if (quietEnd) quietEnd.value = padZero(window.notificationState.quietHoursEnd || 8) + ':00';
    }
    
    // Show permission status
    if (status && window.notificationState) {
        const perm = window.notificationState.permission;
        if (perm === 'granted') {
            status.innerHTML = '<span class="permission-granted">✓ Enabled</span>';
        } else if (perm === 'denied') {
            status.innerHTML = '<span class="permission-denied">✕ Blocked</span>';
        } else {
            status.innerHTML = '<span class="permission-default">Not requested</span>';
        }
    }
}

function saveNotificationSettings() {
    const enabled = document.getElementById('notificationsEnabled');
    const sound = document.getElementById('notificationSound');
    const method = document.getElementById('notificationMethod');
    const quietStart = document.getElementById('quietHoursStart');
    const quietEnd = document.getElementById('quietHoursEnd');
    
    if (window.notificationState) {
        window.notificationState.enabled = enabled ? enabled.checked : true;
        window.notificationState.sound = sound ? sound.value : 'default';
        window.notificationState.defaultMethod = method ? method.value : 'both';
        
        if (quietStart) {
            window.notificationState.quietHoursStart = parseInt(quietStart.value.split(':')[0]);
        }
        if (quietEnd) {
            window.notificationState.quietHoursEnd = parseInt(quietEnd.value.split(':')[0]);
        }
        
        // Save to localStorage
        if (typeof saveNotificationSettings === 'function') {
            window.notificationState.saveSettings();
        }
    }
}

function padZero(num) {
    return num.toString().padStart(2, '0');
}
