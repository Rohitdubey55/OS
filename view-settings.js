/* view-settings.js - Frontend Aligned with User's Backend Schema */

function renderSettings() {
  // Toggle function for collapsible sections
  window.toggleSection = function (sectionId) {
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
  const [themeMode, iconPack] = (s.theme_mode || 'light|emoji').split('|');

  const settings = {
    weekly_budget: s.weekly_budget || 0,
    monthly_budget: s.monthly_budget || 0,
    theme_color: s.theme_color || '#4F46E5',
    theme_mode: themeMode || 'light',
    icon_pack: iconPack || 'emoji',
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
    evening_message: s.evening_message || '',
    // Diary settings
    diary_default_mood: s.diary_default_mood || '5',
    diary_show_tasks: s.diary_show_tasks !== false,
    diary_show_habits: s.diary_show_habits !== false,
    diary_show_expenses: s.diary_show_expenses !== false,
    // Notification settings
    habit_summary_time: s.habit_summary_time || '08:00'
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
            <div class="widget-title">${renderIcon('user', null, 'style="width:18px; margin-right:8px;"')} Profile</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
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
            <div class="widget-title">${renderIcon('wallet', null, 'style="width:18px; margin-right:8px;"')} Budget Settings</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
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
        <div id="categorySummary" style="margin-top:16px; padding:12px; background:var(--surface-3); border-radius:8px; display:flex; justify-content:space-between; font-size:13px;">
          <span>Total Budget: <strong id="totalCatBudget">₹0</strong></span>
          <span>Total Spent: <strong id="totalCatSpent">₹0</strong></span>
        </div>
        <button class="btn primary" style="margin-top:12px; margin-left:8px;" onclick="saveAllSettings('budget')">Save Budget</button>
        </div>
        </details>

      <!-- 3. APPEARANCE -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('palette', null, 'style="width:18px; margin-right:8px;"')} Appearance</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
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

            <label class="setting-label">Icon Pack</label>
            <div class="icon-pack-grid">
                <label class="icon-pack-option ${settings.icon_pack === 'lucide' ? 'active' : ''}" onclick="selectIconPack('lucide')">
                    <input type="radio" name="iconPack" value="lucide" ${settings.icon_pack === 'lucide' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'lucide')} ${renderIcon('calendar', 'lucide')} ${renderIcon('achievements', 'lucide')}</span>
                    <span class="pack-name">Lucide</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'remix' ? 'active' : ''}" onclick="selectIconPack('remix')">
                    <input type="radio" name="iconPack" value="remix" ${settings.icon_pack === 'remix' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'remix')} ${renderIcon('calendar', 'remix')} ${renderIcon('achievements', 'remix')}</span>
                    <span class="pack-name">Remix</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'tabler' ? 'active' : ''}" onclick="selectIconPack('tabler')">
                    <input type="radio" name="iconPack" value="tabler" ${settings.icon_pack === 'tabler' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'tabler')} ${renderIcon('calendar', 'tabler')} ${renderIcon('achievements', 'tabler')}</span>
                    <span class="pack-name">Tabler</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'material' ? 'active' : ''}" onclick="selectIconPack('material')">
                    <input type="radio" name="iconPack" value="material" ${settings.icon_pack === 'material' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'material')} ${renderIcon('calendar', 'material')} ${renderIcon('achievements', 'material')}</span>
                    <span class="pack-name">Material</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'fontawesome' ? 'active' : ''}" onclick="selectIconPack('fontawesome')">
                    <input type="radio" name="iconPack" value="fontawesome" ${settings.icon_pack === 'fontawesome' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'fontawesome')} ${renderIcon('calendar', 'fontawesome')} ${renderIcon('achievements', 'fontawesome')}</span>
                    <span class="pack-name">Font Awesome</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'heroicons' ? 'active' : ''}" onclick="selectIconPack('heroicons')">
                    <input type="radio" name="iconPack" value="heroicons" ${settings.icon_pack === 'heroicons' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'heroicons')} ${renderIcon('calendar', 'heroicons')} ${renderIcon('achievements', 'heroicons')}</span>
                    <span class="pack-name">Heroicons</span>
                </label>
                <label class="icon-pack-option ${settings.icon_pack === 'feather' ? 'active' : ''}" onclick="selectIconPack('feather')">
                    <input type="radio" name="iconPack" value="feather" ${settings.icon_pack === 'feather' ? 'checked' : ''}>
                    <span class="pack-preview">${renderIcon('home', 'feather')} ${renderIcon('calendar', 'feather')} ${renderIcon('achievements', 'feather')}</span>
                    <span class="pack-name">Feather</span>
                </label>
                <label class="icon-pack-option ${!settings.icon_pack || settings.icon_pack === 'emoji' ? 'active' : ''}" onclick="selectIconPack('emoji')">
                    <input type="radio" name="iconPack" value="emoji" ${!settings.icon_pack || settings.icon_pack === 'emoji' ? 'checked' : ''}>
                    <span class="pack-preview">🏠 📅 🏆</span>
                    <span class="pack-name">Emoji</span>
                </label>
            </div>
            <input type="hidden" id="sIconPack" value="${settings.icon_pack || 'emoji'}">
        </div>
        <button class="btn primary" onclick="saveAllSettings('appearance')">Save Appearance</button>
      </details>

      <!-- 3. AI CONFIG -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('ai', null, 'style="width:18px; margin-right:8px;"')} AI Configuration</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
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
            <div class="widget-title">${renderIcon('layout', null, 'style="width:18px; margin-right:8px;"')} Tab Visibility</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Toggle and rearrange modules (drag to reorder).</p>
        
        <div class="tab-toggles" id="tabTogglesList">
           ${renderTabTogglesOrdered(settings.hidden_tabs, settings.tab_order)}
        </div>
        <button class="btn primary" onclick="saveAllSettings('tabs')" style="margin-top:12px">Save Tabs</button>
        </div>
      </details>

      <!-- 5. DIARY SETTINGS -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('diary', null, 'style="width:18px; margin-right:8px;"')} Diary Settings</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Customize your diary experience.</p>
        
        <div style="margin-bottom:16px">
          <label class="setting-label">Default Mood</label>
          <select class="input" id="defaultMood">
            <option value="5" ${settings.diary_default_mood === '5' ? 'selected' : ''}>😐 Neutral (5)</option>
            <option value="7" ${settings.diary_default_mood === '7' ? 'selected' : ''}>😊 Good (7)</option>
            <option value="8" ${settings.diary_default_mood === '8' ? 'selected' : ''}>😄 Great (8)</option>
            <option value="6" ${settings.diary_default_mood === '6' ? 'selected' : ''}>🙂 Okay (6)</option>
            <option value="4" ${settings.diary_default_mood === '4' ? 'selected' : ''}>😔 Low (4)</option>
          </select>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Default mood for new entries.</p>
        </div>

        <div style="margin-bottom:16px">
          <label class="setting-label">Show Context</label>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <label class="toggle-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="showTasksInDiary" ${settings.diary_show_tasks !== false ? 'checked' : ''}> Show Tasks
            </label>
            <label class="toggle-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="showHabitsInDiary" ${settings.diary_show_habits !== false ? 'checked' : ''}> Show Habits
            </label>
            <label class="toggle-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="showExpensesInDiary" ${settings.diary_show_expenses !== false ? 'checked' : ''}> Show Expenses
            </label>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Show context data in diary entry modal.</p>
        </div>

        <div style="margin-bottom:16px">
          <label class="setting-label">Export Diary</label>
          <button class="btn secondary" onclick="window.exportDiary && window.exportDiary()">
            ${renderIcon('export')} Export All Entries
          </button>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Download all your diary entries as a file.</p>
        </div>
        
        <button class="btn primary" onclick="saveAllSettings('diary')">Save Diary Settings</button>
        </div>
      </details>

      <!-- 4. NOTIFICATIONS -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('reminder', null, 'style="width:18px; margin-right:8px;"')} Notifications</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
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
                ${renderIcon('reminder')} Request Browser Permission
            </button>
            <span class="permission-status" id="notificationPermissionStatus"></span>
        </div>
        
        <div class="setting-item">
            <label class="setting-label">Notification Sound</label>
            <div style="display:flex; gap:10px">
                <select id="notificationSound" class="input" style="flex:1">
                    <option value="default">Default (System Ringtone)</option>
                    <option value="chime.wav">Chime</option>
                    <option value="beep.wav">Beep</option>
                    <option value="classic.wav">Classic Alarm</option>
                    <option value="none">Silent</option>
                </select>
                <button class="btn secondary" onclick="playTestSound()" style="padding: 0 16px;">Test</button>
            </div>
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
            <label class="setting-label">Habit Summary Time</label>
            <div style="display:flex; align-items:center; gap:10px">
                <input type="time" id="habitSummaryTime" class="input" value="${settings.habit_summary_time}">
            </div>
            <p class="setting-hint">Daily notification summarising upcoming habits.</p>
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
            <div class="widget-title">${renderIcon('database', null, 'style="width:18px; margin-right:8px;"')} Data Management</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">View raw data or reset the application.</p>
        
        <div class="data-management-actions">
           <button class="btn secondary" onclick="openGoogleSheet()">${renderIcon('grid', null, 'style="width:16px; margin-right:8px"')} Open Google Sheet</button>
           <button class="btn danger" onclick="confirmDeleteAllData()">${renderIcon('delete', null, 'style="width:16px; margin-right:8px"')} Delete All Data</button>
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

    header.addEventListener('click', function () {
      const isExpanded = !body.classList.contains('hidden');
      body.classList.toggle('hidden');
      header.classList.toggle('expanded', !isExpanded);
    });
  });

  // Enable drag and drop sorting for tabs
  const tabList = document.getElementById('tabTogglesList');
  if (tabList && typeof Sortable !== 'undefined') {
    new Sortable(tabList, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost'
    });
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  // Load notification settings from localStorage
  loadNotificationSettingsUI();
}

// Helpers
function renderTabTogglesOrdered(hiddenStr, orderStr) {
  const allTabs = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'finance', label: 'Finance' },
    { id: 'habits', label: 'Habits' },
    { id: 'diary', label: 'Diary' },
    { id: 'vision', label: 'Vision' },
    { id: 'people', label: 'People' }
  ];

  let orderedTabs = [...allTabs];

  // If we have a custom order, sort the tabs array to match it
  if (orderStr) {
    const orderList = orderStr.split(',').map(s => s.trim());
    orderedTabs.sort((a, b) => {
      const indexA = orderList.indexOf(a.id);
      const indexB = orderList.indexOf(b.id);
      // If a tab isn't in the orderList (e.g. a new feature), put it at the end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  return orderedTabs.map(tab => renderTabToggle(tab.label, tab.id, hiddenStr)).join('');
}
function renderColorOption(color, activeColor) {
  const isActive = (activeColor || '#4F46E5').toLowerCase() === color.toLowerCase();
  return `<div class="color-option ${isActive ? 'active' : ''}" style="background-color: ${color}" data-color="${color}"></div>`;
}

function renderTabToggle(label, key, hiddenStr) {
  const isHidden = (hiddenStr || '').includes(key);
  return `
      <label class="tab-toggle-item" data-id="${key}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-2); border-radius: 8px; margin-bottom: 8px; cursor: grab;">
         <div style="display: flex; align-items: center; gap: 12px;">
            <div class="drag-handle" style="color: var(--text-muted); display: flex; align-items: center;">
               ${renderIcon('menu', null, 'style="width: 16px;"')}
            </div>
            <div>
               <div class="toggle-name" style="font-weight: 500;">${label}</div>
               <div style="font-size:12px; color:var(--text-muted); margin-top:2px">Show ${label} tab</div>
            </div>
         </div>
         <div class="toggle-label" style="margin: 0;">
            <input type="checkbox" class="tab-checkbox" value="${key}" ${!isHidden ? 'checked' : ''}>
         </div>
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
  const orderStr = settings.tab_order || '';
  const orderList = orderStr ? orderStr.split(',').map(s => s.trim()) : [];

  // Helper function to reorder DOM nodes inside their parent container
  const reorderNodes = (containerSelector, itemSelector) => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    // Get all items in the container
    const items = Array.from(container.querySelectorAll(itemSelector));

    // Sort items based on the orderList
    items.sort((a, b) => {
      const targetA = a.dataset.target;
      const targetB = b.dataset.target;

      // Keep dashboard at the top
      if (targetA === 'dashboard') return -1;
      if (targetB === 'dashboard') return 1;

      const indexA = orderList.indexOf(targetA);
      const indexB = orderList.indexOf(targetB);

      // If a tab isn't in the list, keep its original relative weight (or put at end)
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });

    // Reattach items to the DOM in the new order (this naturally moves them without detaching completely!)
    items.forEach(item => {
      container.appendChild(item);

      // Also apply visibility while we're looping through them
      const target = item.dataset.target;
      if (target && target !== 'dashboard') {
        if (hiddenList.includes(target)) item.style.display = 'none';
        else item.style.display = 'flex';
      }
    });
  };

  // Run the reordering and visibility updates on both navigation menus
  reorderNodes('.sidebar nav', '.nav-item');
  reorderNodes('.mobile-nav', '.mob-item');
}

// --- APPLY SETTINGS (Unified Logic) ---
window.applySettings = function () {
  const settings = state.data.settings?.[0];
  if (!settings) return;

  // 1. Theme Color
  const color = settings.theme_color || '#4F46E5';
  document.documentElement.style.setProperty('--primary', color);

  // 2. Theme Mode & Icon Pack
  const [mode, iconPack] = (settings.theme_mode || 'light|emoji').split('|');
  document.documentElement.setAttribute('data-theme', mode || 'light');

  // 3. Icon Pack Update
  const packToUse = iconPack || 'emoji';
  try {
    const appSettings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    appSettings.icon_pack = packToUse;
    localStorage.setItem('app_settings', JSON.stringify(appSettings));
  } catch (e) { console.warn('Could not save icon pack setting'); }

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

// Icon Pack Selection
window.selectIconPack = function (pack) {
  document.querySelectorAll('.icon-pack-option').forEach(el => el.classList.remove('active'));
  event.target.closest('.icon-pack-option').classList.add('active');
  document.getElementById('sIconPack').value = pack;
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
  const catSpent = {};

  if (state.data.expenses) {
    state.data.expenses.forEach(e => {
      if (e.category) {
        txCategories.add(e.category);
        // Track spending per category (all-time)
        catSpent[e.category] = (catSpent[e.category] || 0) + Number(e.amount || 0);
      }
    });
  }

  // Calculate sum of all category budgets
  let totalBudget = 0;
  let totalSpent = 0;
  Object.values(data).forEach(budget => {
    if (budget && budget !== '') {
      totalBudget += Number(budget);
    }
  });
  Object.values(catSpent).forEach(spent => {
    totalSpent += spent;
  });

  // Store for display
  window._categorySpentData = catSpent;
  window._categoryBudgetData = data;

  // Combine: saved budget categories + transaction categories (NO hardcoded defaults)
  const allCats = new Set([
    ...Object.keys(data),
    ...txCategories
  ]);

  if (allCats.size === 0) {
    // No categories - show one empty row for user to add
    addCategoryRow('', '', 'weekly');
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
      // Handle both old format (number) and new format (object)
      let budget = '';
      let source = 'weekly';
      if (typeof data[cat] === 'object' && data[cat] !== null) {
        budget = data[cat].budget || '';
        source = data[cat].source || 'weekly';
      } else if (typeof data[cat] === 'number' || typeof data[cat] === 'string') {
        budget = data[cat];
      }
      addCategoryRow(cat, budget, source);
    });
  }

  // Update summary after initialization
  setTimeout(updateCategorySummary, 100);
}

function safeJsonParse(str) {
  if (!str) return {};
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (e) { return {}; }
}

window.addCategoryRow = function (cat = '', amt = '', source = 'weekly') {
  // Get unique categories from transactions for suggestions (only from sheet)
  const txCategories = new Set();
  const catSpent = {};
  if (state.data.expenses) {
    state.data.expenses.forEach(e => {
      if (e.category) {
        txCategories.add(e.category);
        // Track all expense spending per category
        if (e.type === 'expense') {
          catSpent[e.category] = (catSpent[e.category] || 0) + Number(e.amount || 0);
        }
      }
    });
  }

  const spent = catSpent[cat] || 0;
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '10px';
  div.style.marginBottom = '10px';
  div.style.alignItems = 'center';
  div.className = 'cat-budget-row';
  div.innerHTML = `
      <input type="text" class="input cat-name" placeholder="Category" value="${cat}" style="flex:1; min-width:100px;" list="settingsCatOptions" onchange="updateCategorySummary()">
      <datalist id="settingsCatOptions">
        ${[...txCategories].map(c => `<option value="${c}">`).join('')}
      </datalist>
      <select class="input cat-source" style="width:90px; margin:0" onchange="updateCategorySummary()">
        <option value="weekly" ${source === 'weekly' ? 'selected' : ''}>Weekly</option>
        <option value="monthly" ${source === 'monthly' ? 'selected' : ''}>Monthly</option>
      </select>
      <input type="number" class="input cat-amt" placeholder="Limit" value="${amt}" style="flex:1; min-width:80px;" onchange="updateCategorySummary()">
      ${spent > 0 ? `<span style="align-self:center; font-size:11px; color:var(--text-muted); min-width:60px;">₹${spent.toLocaleString()}</span>` : ''}
      <button class="btn danger small" onclick="this.parentElement.remove(); updateCategorySummary()">X</button>
    `;
  document.getElementById('categoryBudgetList').appendChild(div);
  updateCategorySummary();
};

// Update the category summary totals
window.updateCategorySummary = function () {
  const data = {};
  document.querySelectorAll('.cat-budget-row').forEach(row => {
    const c = row.querySelector('.cat-name').value.trim();
    const amt = row.querySelector('.cat-amt').value;
    if (c && amt) data[c] = amt;
  });

  // Calculate total budget
  let totalBudget = 0;
  Object.values(data).forEach(budget => {
    if (budget && budget !== '') {
      totalBudget += Number(budget);
    }
  });

  // Calculate total spent from ALL categories (not just those with budget)
  let totalSpent = 0;
  if (state.data.expenses) {
    state.data.expenses.forEach(e => {
      if (e.type === 'expense' && e.category) {
        totalSpent += Number(e.amount || 0);
      }
    });
  }

  const budgetEl = document.getElementById('totalCatBudget');
  const spentEl = document.getElementById('totalCatSpent');
  if (budgetEl) budgetEl.textContent = '₹' + totalBudget.toLocaleString();
  if (spentEl) spentEl.textContent = '₹' + totalSpent.toLocaleString();
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
    const s = row.querySelector('.cat-source')?.value || 'weekly';
    if (c && a) {
      // Store as object with budget and source
      cats[c] = { budget: Number(a), source: s };
    }
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

  // Read exact order of elements in DOM after drag-and-drop
  const tabItemsDOM = Array.from(document.querySelectorAll('.tab-toggle-item'));
  const currentOrder = tabItemsDOM.map(el => el.dataset.id).filter(id => id).join(',');

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
    const currentPack = document.getElementById('sIconPack')?.value || 'emoji';
    newSettings.theme_mode = `${themeMode}|${currentPack}`;
    newSettings.orientation_lock = orientation;
  }

  if (section === 'all' || section === 'ai') {
    newSettings.ai_api_key = apiKey;
    newSettings.ai_model = model;
  }

  if (section === 'all' || section === 'tabs') {
    newSettings.hidden_tabs = hidden;
    newSettings.tab_order = currentOrder;
  }

  if (section === 'all' || section === 'notifications') {
    const notifEnabled = document.getElementById('notificationsEnabled');
    const notifSound = document.getElementById('notificationSound');
    const notifMethod = document.getElementById('notificationMethod');
    const quietStart = document.getElementById('quietHoursStart');
    const quietEnd = document.getElementById('quietHoursEnd');

    newSettings.notification_enabled = notifEnabled ? notifEnabled.checked : true;
    newSettings.notification_sound = notifSound ? notifSound.value : 'default';
    newSettings.notification_method = notifMethod ? notifMethod.value : 'both';
    newSettings.quiet_hours_start = quietStart ? quietStart.value : '22:00';
    newSettings.quiet_hours_end = quietEnd ? quietEnd.value : '08:00';

    // Also immediately update the in-memory notificationState
    if (window.notificationState) {
      window.notificationState.enabled = newSettings.notification_enabled;
      window.notificationState.sound = newSettings.notification_sound;
      window.notificationState.defaultMethod = newSettings.notification_method;
      window.notificationState.quietHoursStart = parseInt(newSettings.quiet_hours_start);
      window.notificationState.quietHoursEnd = parseInt(newSettings.quiet_hours_end);
      window.notificationState.habitSummaryTime = newSettings.habit_summary_time;
    }

    // Also save to localStorage as a fast cache for next startup
    localStorage.setItem('notificationSettings', JSON.stringify({
      enabled: newSettings.notification_enabled,
      sound: newSettings.notification_sound,
      defaultMethod: newSettings.notification_method,
      quietHoursStart: parseInt(newSettings.quiet_hours_start),
      quietHoursEnd: parseInt(newSettings.quiet_hours_end),
      habitSummaryTime: newSettings.habit_summary_time
    }));

    // Re-sync native alarms with updated sound preference
    if (typeof window.syncNativeNotifications === 'function') {
      setTimeout(window.syncNativeNotifications, 500);
    }
  }

  if (section === 'all' || section === 'diary') {
    const defaultMood = document.getElementById('defaultMood')?.value || '5';
    const showTasks = document.getElementById('showTasksInDiary')?.checked;
    const showHabits = document.getElementById('showHabitsInDiary')?.checked;
    const showExpenses = document.getElementById('showExpensesInDiary')?.checked;
    newSettings.diary_default_mood = defaultMood;
    newSettings.diary_show_tasks = showTasks;
    newSettings.diary_show_habits = showHabits;
    newSettings.diary_show_expenses = showExpenses;
  }

  const sectionNames = { profile: 'Profile', budget: 'Budget', appearance: 'Appearance', ai: 'AI', tabs: 'Tab Visibility', notifications: 'Notifications', diary: 'Diary' };
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
    if (res.ok) showToast('API Key Valid!');
    else showToast('Invalid Key', 'error');
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
      status.innerHTML = '<span class="permission-granted">Enabled</span>';
    } else if (perm === 'denied') {
      status.innerHTML = '<span class="permission-denied">Blocked</span>';
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

    // Save to localStorage directly (saveNotificationSettings lives in notification-service.js)
    const toSave = {
      enabled: window.notificationState.enabled,
      sound: window.notificationState.sound,
      defaultMethod: window.notificationState.defaultMethod,
      quietHoursStart: window.notificationState.quietHoursStart,
      quietHoursEnd: window.notificationState.quietHoursEnd,
      habitSummaryTime: document.getElementById('habitSummaryTime')?.value || '08:00'
    };
    window.notificationState.habitSummaryTime = toSave.habitSummaryTime;
    localStorage.setItem('notificationSettings', JSON.stringify(toSave));
    showToast('Notification settings saved!', 'success');

    // Re-sync native alarms with the new sound preference
    if (typeof window.syncNativeNotifications === 'function') {
      window.syncNativeNotifications();
    }
  }
}

window.playTestSound = async function () {
  const soundSelect = document.getElementById('notificationSound');
  if (!soundSelect) return;
  const val = soundSelect.value;

  if (val === 'none') {
    showToast('Silent notification selected', 'info');
    return;
  }

  if (val === 'default') {
    // For default sound, schedule a real local notification — this uses the iOS system alert sound
    if (window.LocalNotifications) {
      await window.LocalNotifications.schedule({
        notifications: [{
          title: "🔔 Test Notification",
          body: "This is how your habit alarms will sound",
          id: 88888,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          sound: ''
        }]
      });
      showToast('Notification arriving in 1 second...', 'info');
    } else {
      showToast('Default system sound selected', 'info');
    }
    return;
  }

  // It's a custom wav file
  if (window.Capacitor && window.Capacitor.Plugins.NativeAudio) {
    try {
      const assetName = val.replace('.wav', '');
      await window.Capacitor.Plugins.NativeAudio.preload({
        assetId: assetName,
        assetPath: val,
        audioChannelNum: 1,
        isUrl: false
      });
      await window.Capacitor.Plugins.NativeAudio.play({ assetId: assetName });
      showToast(`Playing ${val}...`, 'info');
    } catch (e) {
      console.error("NativeAudio failed, falling back", e);
    }
  } else {
    // Fallback to web audio
    const audio = new Audio('assets/sounds/' + val);
    audio.play().catch(e => {
      console.error('Audio playback failed', e);
      showToast('Preview playing natively...', 'info');
      if (window.LocalNotifications) {
        window.LocalNotifications.schedule({
          notifications: [{
            title: "Test", body: "Sound Preview", id: 8889,
            schedule: { at: new Date(Date.now() + 1000) }, sound: val
          }]
        });
      }
    });
  }
};

function padZero(num) {
  return num.toString().padStart(2, '0');
}
