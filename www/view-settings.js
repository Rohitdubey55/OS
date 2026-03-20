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

  // Tasks settings - parse from task_categories prefix if present (persistence)
  let taskDefaultView = s.task_default_view || 'expanded';
  if (s.task_categories && s.task_categories.startsWith('VIEW:')) {
    const parts = s.task_categories.split('|');
    const viewPref = parts[0].replace('VIEW:', '');
    if (viewPref === 'collapsed' || viewPref === 'expanded') {
      taskDefaultView = viewPref;
    }
  }

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
    elevenlabs_api_key: s.elevenlabs_api_key || '',
    elevenlabs_voice_id: s.elevenlabs_voice_id || '',
    tts_provider: s.tts_provider || 'gemini',
    tts_voice_id: s.tts_voice_id || 'Sulafat',
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
    habit_summary_time: s.habit_summary_time || '08:00',
    // Logic parsed above
    task_default_view: taskDefaultView,
    task_categories: s.task_categories || 'Personal,Work,Health,Learning,Finance,Other',
    habit_routines: s.habit_routines || 'Morning,Work,Evening'
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
          <label class="setting-label">Date of Birth</label>
          <input type="date" class="input" id="userDob" value="${settings.dob || ''}">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Used for Life Calendar and Year Progress calculation.</p>
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
        <div style="border-top:1px solid var(--border-color); margin:20px 0 16px; padding-top:16px;">
            <p class="section-description" style="margin-bottom:12px;">🎙 <strong>AI Voice for Affirmations</strong> — 30 realistic human voices powered by Gemini. Uses your Gemini API key above (free tier!).</p>

            <div class="setting-item">
                <label class="setting-label">Voice Provider</label>
                <select class="input" id="sTtsProvider" onchange="updateVoiceDropdown()" disabled>
                    <option value="gemini" selected>Gemini AI (free with your API key)</option>
                </select>
            </div>
            <div class="setting-item">
                <label class="setting-label">Voice</label>
                <div style="display:flex; gap:10px; align-items:center;">
                    <select class="input" id="sTtsVoice" style="flex:1;">
                    </select>
                    <button class="btn secondary" id="elPreviewBtn" onclick="previewGeminiVoice()">▶ Preview</button>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:6px">Uses your Gemini API key — all 30 voices are free. Generate voices in Vision → Manage Affirmations.</div>
            </div>
        </div>

        <!-- Legacy fields (hidden, kept for backward compat) -->
        <input type="hidden" id="sElevenLabsKey" value="${settings.elevenlabs_api_key}">
        <input type="hidden" id="sElevenLabsVoice" value="${settings.elevenlabs_voice_id}">

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
        <p class="section-description">Toggle and rearrange modules.</p>
        
        <div class="tab-toggles" id="tabTogglesList">
           ${renderTabTogglesOrdered(settings.nav_layout, settings.hidden_tabs)}
        </div>
        <button class="btn primary" onclick="saveAllSettings('tabs')" style="margin-top:12px">Save Tabs</button>
        </div>
      </details>

      <!-- 5. DASHBOARD LAYOUT -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('home', null, 'style="width:18px; margin-right:8px;"')} Dashboard Layout</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Toggle and rearrange dashboard widgets.</p>
        
        <div class="dash-toggles" id="dashTogglesList" style="max-height: 280px; overflow-y: auto; padding-right: 8px;">
           ${renderDashboardTogglesOrdered()}
        </div>
        
        <!-- KPI Visibility Toggles -->
        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color);">
          <div style="font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            ${typeof renderIcon === 'function' ? renderIcon('bar-chart-2', null, 'style="width:18px;"') : '📊'} KPI Visibility
          </div>
          <p class="section-description" style="margin-bottom: 16px;">Toggle which KPIs to show on the dashboard.</p>
          <div id="kpiTogglesList" style="max-height: 280px; overflow-y: auto; padding-right: 8px;">
            ${renderKpiToggles()}
          </div>
        </div>
        
        <div style="padding-top: 20px; margin-top: 20px; border-top: 1px solid var(--border-color); padding-bottom: 20px;">
          <button class="btn primary" onclick="saveAllSettings('dashboard')" style="width:100%; padding:14px; height:auto;">Save Dashboard Layout</button>
        </div>
        </div>
      </details>

      <!-- 6. DIARY SETTINGS -->
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

      <!-- 7. TASKS SETTINGS -->
      <details class="settings-details" style="display:block;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('tasks', null, 'style="width:18px; margin-right:8px;"')} Tasks Settings</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Customize your task experience.</p>
        
        <!-- Default View -->
        <div style="margin-bottom:20px;">
          <label class="setting-label">Default Category View</label>
          <div class="density-options" id="taskDefaultViewOptions">
            <button class="density-btn ${settings.task_default_view === 'collapsed' ? '' : 'active'}" onclick="selectTaskDefaultView('expanded', this)">Expanded</button>
            <button class="density-btn ${settings.task_default_view === 'collapsed' ? 'active' : ''}" onclick="selectTaskDefaultView('collapsed', this)">Collapsed</button>
          </div>
          <input type="hidden" id="sTaskDefaultView" value="${settings.task_default_view || 'expanded'}">
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Whether task categories start collapsed or expanded when you open the Tasks view.</p>
        </div>

        <!-- Categories -->
        <div style="margin-bottom:20px;">
          <label class="setting-label">Task Categories</label>
          <p style="font-size:12px; color:var(--text-muted); margin-top:0; margin-bottom:12px;">These categories appear in the task form and filter bar.</p>
          <div id="taskCategoryList" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            ${(() => {
      const raw = settings.task_categories || 'Personal,Work,Health,Learning,Finance,Other';
      let cats = [];
      try {
        const parsed = JSON.parse(raw);
        cats = Array.isArray(parsed) ? parsed : raw.split(',').map(c => c.trim()).filter(Boolean);
      } catch (e) {
        cats = raw.split(',').map(c => c.trim()).filter(Boolean);
      }
      // Filter out internal setting prefixes
      return cats.filter(cat => !cat.startsWith('VIEW:')).map(cat => `
                <div style="display:inline-flex; align-items:center; gap:6px; background:var(--surface-2); border:1px solid var(--border-color); border-radius:20px; padding:5px 12px; font-size:13px;">
                  <span>${cat}</span>
                  <button type="button" onclick="removeTaskCategory(this)" style="border:none; background:none; cursor:pointer; color:var(--text-muted); font-size:16px; line-height:1; padding:0; display:flex; align-items:center;">\u00d7</button>
                </div>
              `).join('');
    })()}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="newTaskCategoryInput" class="input" placeholder="New category name..." style="flex:1;" onkeydown="if(event.key==='Enter'){addTaskCategory(); event.preventDefault();}">
            <button class="btn secondary" onclick="addTaskCategory()">+ Add</button>
          </div>
        </div>

        <button class="btn primary" onclick="saveAllSettings('tasks')">Save Tasks Settings</button>
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
                    <option value="none">Silent</option>
                     <optgroup label="Short Alerts">
                        <option value="chime">Chime</option>
                        <option value="beep">Beep</option>
                        <option value="classic">Classic Alarm</option>
                    </optgroup>
                    <optgroup label="Long Alarms">
                        <option value="alarm_fast_10s">Fast Alarm (10s)</option>
                        <option value="digital_clock_20s">Digital Clock (20s)</option>
                        <option value="siren_30s">Siren (30s)</option>
                        <option value="gentle_wake_30s">Gentle Wake (30s)</option>
                        <option value="meditation_bell_30s">Meditation Bell (30s)</option>
                        <option value="sonar_10s">Sonar (10s)</option>
                        <option value="emergency_20s">Emergency (20s)</option>
                        <option value="slow_pulse_10s">Slow Pulse (10s)</option>
                        <option value="space_ambient_30s">Space Ambient (30s)</option>
                        <option value="marimba_trill_20s">Marimba Trill (20s)</option>
                    </optgroup>
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
      
      <!-- 8. HABITS SETTINGS -->
      <details class="settings-details" style="display:block; margin-top:16px; border:1px solid var(--border-color); border-radius:16px;">
        <summary class="widget-header" style="cursor:pointer; padding:16px 20px; margin:0; background:var(--surface-1); border-bottom:1px solid var(--border-color); border-radius:16px 16px 0 0; list-style:none;">
            <div class="widget-title">${renderIcon('streak', null, 'style="width:18px; margin-right:8px;"')} Habits Settings</div>
            ${renderIcon('down', null, 'style="width:20px; transition:transform 0.3s;"')}
        </summary>
        <div class="widget-body" style="padding:20px; border-radius:0 0 16px 16px; background:var(--surface-1);">
        <p class="section-description">Manage habit routines and other preferences.</p>
        
        <div style="margin-bottom:20px;">
          <label class="setting-label">Habit Routines</label>
          <p style="font-size:12px; color:var(--text-muted); margin-top:0; margin-bottom:12px;">These routines will appear as options when adding or editing a habit.</p>
          <div id="habitRoutineList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
            ${(() => {
    const raw = settings.habit_routines || 'Morning,Work,Evening';
    const routines = raw.split(',').map(r => r.trim()).filter(Boolean);
    return routines.map(r => `
                <div class="routine-item" data-id="${r}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--surface-2); border-radius:8px; border:1px solid var(--border-color);">
                  <span class="routine-name" style="font-weight:500; font-size:13px;">${r}</span>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                       <button type="button" class="btn icon small" onclick="moveTab(event, this, -1)" style="padding:2px; height:auto;" title="Move Up">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>
                       </button>
                       <button type="button" class="btn icon small" onclick="moveTab(event, this, 1)" style="padding:2px; height:auto;" title="Move Down">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                       </button>
                    </div>
                    <button type="button" onclick="removeHabitRoutine(this)" style="border:none; background:none; cursor:pointer; color:var(--danger); font-size:18px; padding:0; display:flex; align-items:center;">&times;</button>
                  </div>
                </div>
              `).join('');
  })()}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="newHabitRoutineInput" class="input" placeholder="New routine name..." style="flex:1;" onkeydown="if(event.key==='Enter'){addHabitRoutine(); event.preventDefault();}">
            <button class="btn secondary" onclick="addHabitRoutine()">+ Add</button>
          </div>
        </div>
        <button class="btn primary" onclick="saveAllSettings('habits')">Save Habits Settings</button>
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

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  // Load notification settings from localStorage
  loadNotificationSettingsUI();

  // Initialize TTS voice dropdown
  if (document.getElementById('sTtsProvider')) updateVoiceDropdown();
}

// Helpers
function renderTabTogglesOrdered(layoutStr, fallbackHiddenStr) {
  const allTabs = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'finance', label: 'Finance' },
    { id: 'habits', label: 'Habits' },
    { id: 'diary', label: 'Diary' },
    { id: 'vision', label: 'Vision' },
    { id: 'people', label: 'People' },
    { id: 'books', label: 'Books' },
    { id: 'mural', label: 'Mural' }
  ];

  let layoutData = [];
  try {
    layoutData = layoutStr ? JSON.parse(layoutStr) : [];
  } catch (e) { console.error("Error parsing Nav_Layout:", e); }

  let orderedTabs = [];

  if (layoutData && layoutData.length > 0) {
    // Use layout array to define order and visibility
    layoutData.forEach(itemConfig => {
      const tabInfo = allTabs.find(t => t.id === itemConfig.id);
      if (tabInfo) {
        orderedTabs.push({ ...tabInfo, visible: itemConfig.visible });
      }
    });
    // Add any newly added hardcoded tabs that aren't in layout yet
    allTabs.forEach(t => {
      if (!orderedTabs.some(ot => ot.id === t.id)) {
        orderedTabs.push({ ...t, visible: true });
      }
    });
  } else {
    // Fallback if Nav_Layout is empty
    orderedTabs = allTabs.map(t => ({
      ...t,
      visible: fallbackHiddenStr ? !fallbackHiddenStr.includes(t.id) : true
    }));
  }

  return orderedTabs.map(tab => renderTabToggle(tab.label, tab.id, tab.visible)).join('');
}

function renderDashboardTogglesOrdered() {
  const baseConfig = typeof DEFAULT_DASH_CONFIG !== 'undefined' ? DEFAULT_DASH_CONFIG : [
    { id: 'morning', label: 'Morning Greeting', visible: true },
    { id: 'theNow', label: 'The Now Focus', visible: true },
    { id: 'aiBriefing', label: 'Daily Briefing', visible: true },
    { id: 'vision', label: 'Vision Banner', visible: true },
    { id: 'kpis', label: 'KPI Cards', visible: true },
    { id: 'budget', label: 'Budget Alert', visible: true },
    { id: 'pinnedNotes', label: 'Pinned Notes', visible: true },
    { id: 'tasks', label: 'High Priority Tasks', visible: true },
    { id: 'habits', label: 'Habit Tracker', visible: true }
  ];

  let layoutData = [];
  const s = state.data.settings?.[0] || {};
  try {
    if (s.dashboard_config) {
      let parsed = s.dashboard_config;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      layoutData = parsed;
    }
  } catch (e) { }

  let orderedWidgets = [];
  if (layoutData && layoutData.length > 0) {
    layoutData.forEach(item => {
      const baseInfo = baseConfig.find(b => b.id === item.id);
      if (baseInfo) orderedWidgets.push({ ...baseInfo, visible: item.visible });
    });
    baseConfig.forEach(b => {
      if (!orderedWidgets.some(ow => ow.id === b.id)) orderedWidgets.push({ ...b, visible: true });
    });
  } else {
    orderedWidgets = baseConfig.map(b => ({ ...b }));
  }

  return orderedWidgets.map(w => `
      <label class="dash-toggle-item" data-id="${w.id}" data-label="${w.label}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-2); border-radius: 8px; margin-bottom: 8px;">
         <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div>
               <div class="toggle-name" style="font-weight: 500;">${w.label}</div>
            </div>
         </div>
         <div style="display: flex; align-items: center; gap: 16px;">
            <div class="toggle-label" style="margin: 0;">
                <input type="checkbox" class="dash-checkbox" value="${w.id}" ${w.visible !== false ? 'checked' : ''}>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
               <button type="button" class="btn icon small" onclick="moveTab(event, this, -1)" style="padding: 2px; height: auto;" title="Move Up">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
               </button>
               <button type="button" class="btn icon small" onclick="moveTab(event, this, 1)" style="padding: 2px; height: auto;" title="Move Down">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
               </button>
            </div>
         </div>
      </label>
  `).join('');
}

function renderKpiToggles() {
  const baseConfig = typeof DEFAULT_KPI_CONFIG !== 'undefined' ? DEFAULT_KPI_CONFIG : [
    { id: 'netWorth', label: 'Net Worth', visible: true, category: 'financial' },
    { id: 'monthSpend', label: 'Month Spend', visible: true, category: 'financial' },
    { id: 'tasksDone', label: 'Tasks Done', visible: true, category: 'productivity' }
  ];

  let kpiData = [];
  const s = state.data.settings?.[0] || {};
  try {
    if (s.kpi_config) {
      let parsed = s.kpi_config;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      kpiData = parsed;
    }
  } catch (e) { }

  // Group by category
  const categories = {
    financial: { label: '💰 Financial', items: [] },
    productivity: { label: '✅ Productivity', items: [] },
    habits: { label: '🔥 Habits', items: [] },
    lifestyle: { label: '👤 Lifestyle', items: [] },
    predictive: { label: '🔮 Predictive', items: [] }
  };

  // Merge saved config with base config
  let orderedKpis = [];
  if (kpiData && kpiData.length > 0) {
    kpiData.forEach(item => {
      const baseInfo = baseConfig.find(b => b.id === item.id);
      if (baseInfo) orderedKpis.push({ ...baseInfo, visible: item.visible });
    });
    baseConfig.forEach(b => {
      if (!orderedKpis.some(ok => ok.id === b.id)) orderedKpis.push({ ...b, visible: true });
    });
  } else {
    orderedKpis = baseConfig.map(b => ({ ...b }));
  }

  // Group by category
  orderedKpis.forEach(k => {
    if (categories[k.category]) {
      categories[k.category].items.push(k);
    }
  });

  let html = '';
  Object.entries(categories).forEach(([catKey, cat]) => {
    if (cat.items.length === 0) return;
    html += `<div style="margin-bottom: 16px;">
      <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${cat.label}</div>`;

    cat.items.forEach(k => {
      html += `<label class="dash-toggle-item" data-id="${k.id}" data-label="${k.label}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface-2); border-radius: 8px; margin-bottom: 6px;">
         <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <div class="toggle-label" style="margin: 0;">
                <input type="checkbox" class="kpi-checkbox" value="${k.id}" ${k.visible !== false ? 'checked' : ''}>
            </div>
            <div>
               <div class="toggle-name" style="font-weight: 500; font-size: 13px;">${k.label}</div>
            </div>
         </div>
      </label>`;
    });
    html += '</div>';
  });

  return html;
}
function renderColorOption(color, activeColor) {
  const isActive = (activeColor || '#4F46E5').toLowerCase() === color.toLowerCase();
  return `<div class="color-option ${isActive ? 'active' : ''}" style="background-color: ${color}" data-color="${color}"></div>`;
}

function renderTabToggle(label, key, isVisible) {
  return `
      <label class="tab-toggle-item" data-id="${key}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-2); border-radius: 8px; margin-bottom: 8px;">
         <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div>
               <div class="toggle-name" style="font-weight: 500;">${label}</div>
               <div style="font-size:12px; color:var(--text-muted); margin-top:2px">Show ${label} tab</div>
            </div>
         </div>
         <div style="display: flex; align-items: center; gap: 16px;">
            <div class="toggle-label" style="margin: 0;">
                <input type="checkbox" class="tab-checkbox" value="${key}" ${isVisible !== false ? 'checked' : ''}>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
               <button type="button" class="btn icon small" onclick="moveTab(event, this, -1)" style="padding: 2px; height: auto;" title="Move Up">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
               </button>
               <button type="button" class="btn icon small" onclick="moveTab(event, this, 1)" style="padding: 2px; height: auto;" title="Move Down">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
               </button>
            </div>
         </div>
      </label>
    `;
}

// Logic for Up/Down buttons
window.moveTab = function (event, btnElement, direction) {
  // Prevent checkbox click
  event.preventDefault();
  event.stopPropagation();

  const row = btnElement.closest('.tab-toggle-item, .dash-toggle-item, .routine-item');
  const list = row.parentElement;

  if (direction === -1) {
    // Move Up
    const prev = row.previousElementSibling;
    if (prev) {
      list.insertBefore(row, prev);
    }
  } else if (direction === 1) {
    // Move Down
    const next = row.nextElementSibling;
    if (next) {
      list.insertBefore(next, row); // This swaps places but visually doesn't work if next is the last element
      list.insertBefore(row, next.nextSibling); // Properly moves after the next sibling
    }
  }
};

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

  const layoutStr = settings.nav_layout || '';
  let orderList = [];
  let hiddenList = [];

  if (layoutStr) {
    try {
      const layoutData = JSON.parse(layoutStr);
      orderList = layoutData.map(item => item.id);
      hiddenList = layoutData.filter(item => !item.visible).map(item => item.id);
    } catch (e) { console.error("Error parsing Nav_Layout in UI:", e); }
  } else {
    // Fallback to old keys
    const hiddenStr = settings.hidden_tabs || '';
    hiddenList = hiddenStr.split(',').map(s => s.trim());
  }

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

// --- Task Settings Helpers ---
window.selectTaskDefaultView = function (view, el) {
  const container = document.getElementById('taskDefaultViewOptions');
  if (container) {
    container.querySelectorAll('.density-btn').forEach(btn => btn.classList.remove('active'));
  }
  if (el) {
    el.classList.add('active');
  } else if (window.event && window.event.target) {
    window.event.target.classList.add('active');
  }
  const hidden = document.getElementById('sTaskDefaultView');
  if (hidden) hidden.value = view;
};

window.addTaskCategory = function () {
  const input = document.getElementById('newTaskCategoryInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const list = document.getElementById('taskCategoryList');
  if (!list) return;
  // Check duplicate
  const existing = Array.from(list.querySelectorAll('span')).map(s => s.textContent.trim().toLowerCase());
  if (existing.includes(val.toLowerCase())) { input.value = ''; return; }
  const pill = document.createElement('div');
  pill.style.cssText = 'display:inline-flex; align-items:center; gap:6px; background:var(--surface-2); border:1px solid var(--border-color); border-radius:20px; padding:5px 12px; font-size:13px;';
  pill.innerHTML = `<span>${val}</span><button type="button" onclick="removeTaskCategory(this)" style="border:none; background:none; cursor:pointer; color:var(--text-muted); font-size:16px; line-height:1; padding:0; display:flex; align-items:center;">\u00d7</button>`;
  list.appendChild(pill);
  input.value = '';
};

window.removeTaskCategory = function (btn) {
  btn.closest('div').remove();
};

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
  const dob = document.getElementById('userDob')?.value || '';
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

  // Read exact order and visibility of elements in DOM
  const tabItemsDOM = Array.from(document.querySelectorAll('.tab-toggle-item'));
  const navLayoutArray = tabItemsDOM.map(el => {
    const isVisible = el.querySelector('.tab-checkbox').checked;
    return { id: el.dataset.id, visible: isVisible };
  });
  const navLayoutJSON = JSON.stringify(navLayoutArray);

  // Read dashboard toggles correctly
  const dashItemsDOM = Array.from(document.querySelectorAll('#dashTogglesList .dash-toggle-item'));
  const dashLayoutArray = dashItemsDOM.map(el => {
    const isVisible = el.querySelector('.dash-checkbox').checked;
    // ensure label is preserved
    const label = el.dataset.label;
    return { id: el.dataset.id, label: label, visible: isVisible };
  });
  const dashLayoutJSON = JSON.stringify(dashLayoutArray);

  // Build settings object based on section
  let newSettings = {};

  if (section === 'all' || section === 'profile') {
    newSettings.name = name;
    newSettings.dob = dob;
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
    // Legacy ElevenLabs fields
    const elKey = document.getElementById('sElevenLabsKey')?.value?.trim() || '';
    const elVoice = document.getElementById('sElevenLabsVoice')?.value?.trim() || '';
    newSettings.elevenlabs_api_key = elKey;
    newSettings.elevenlabs_voice_id = elVoice;
    // Gemini TTS settings
    newSettings.tts_provider = document.getElementById('sTtsProvider')?.value || 'gemini';
    newSettings.tts_voice_id = document.getElementById('sTtsVoice')?.value || 'Sulafat';
  }

  if (section === 'all' || section === 'tabs') {
    newSettings.nav_layout = navLayoutJSON;
  }

  if (section === 'all' || section === 'dashboard') {
    newSettings.dashboard_config = dashLayoutJSON;

    // Also save KPI config
    const kpiItemsDOM = Array.from(document.querySelectorAll('.kpi-checkbox'));
    const kpiConfigArray = kpiItemsDOM.map(cb => {
      const id = cb.value;
      const visible = cb.checked;
      // Get label from parent element
      const parent = cb.closest('.dash-toggle-item');
      const label = parent?.dataset.label || id;
      // Get category from DEFAULT_KPI_CONFIG
      const kpiInfo = (typeof DEFAULT_KPI_CONFIG !== 'undefined' ? DEFAULT_KPI_CONFIG : []).find(k => k.id === id);
      return { id, label, visible, category: kpiInfo?.category || 'other' };
    });
    const kpiConfigJSON = JSON.stringify(kpiConfigArray);
    newSettings.kpi_config = kpiConfigJSON;
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

  if (section === 'all' || section === 'tasks') {
    const taskDefaultView = document.getElementById('sTaskDefaultView')?.value || 'expanded';
    // Collect categories from pill list
    const pillSpans = Array.from(document.querySelectorAll('#taskCategoryList > div > span'));
    const taskCatsBase = pillSpans.map(s => s.textContent.trim()).filter(Boolean).join(',');

    // Store the view preference as a special prefix in the categories string for persistence
    // as per user request to save it in the same sheet location.
    newSettings.task_default_view = taskDefaultView;
    newSettings.task_categories = `VIEW:${taskDefaultView}|${taskCatsBase || 'Personal,Work,Health,Learning,Finance,Other'}`;
  }

  if (section === 'all' || section === 'habits') {
    const pillSpans = Array.from(document.querySelectorAll('#habitRoutineList .routine-name'));
    const habitRoutines = pillSpans.map(s => s.textContent.trim()).filter(Boolean).join(',');
    newSettings.habit_routines = habitRoutines;
  }

  const sectionNames = { profile: 'Profile', budget: 'Budget', appearance: 'Appearance', ai: 'AI', tabs: 'Tab Visibility', notifications: 'Notifications', diary: 'Diary', tasks: 'Tasks' };
  showToast(section === 'all' ? 'Saving settings...' : `Saving ${sectionNames[section] || 'settings'}...`);

  // Optimistic Update
  if (state.data.settings?.[0]) {
    Object.assign(state.data.settings[0], newSettings);
    if (section === 'all' || section === 'appearance') applySettings();
    if (section === 'all' || section === 'tabs') updateTabVisibility();
  }

  const existingId = state.data.settings?.[0]?.id;

  if (existingId) {
    await apiCall('update', 'settings', newSettings, existingId);
  } else {
    // If no settings exist, Create
    await apiCall('create', 'settings', newSettings);
    await refreshData('settings');
  }

  showToast('Save Successful!', 'success');
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

// Legacy — kept for backward compat
window.testElevenLabsAPI = function() {
  showToast('Voices now use Gemini AI — select a voice and click Preview!', 'info');
};

// --- Voice Provider Dropdown & Preview (Gemini TTS) ---

// Populate voice dropdown with Gemini voices
window.updateVoiceDropdown = function() {
  const sel = document.getElementById('sTtsVoice');
  if (!sel) return;

  // Use VOICE_PROVIDERS from view-vision.js if available, otherwise use inline list
  const geminiVoices = (typeof VOICE_PROVIDERS !== 'undefined' && VOICE_PROVIDERS.gemini)
    ? VOICE_PROVIDERS.gemini.voices
    : [
      { id: 'Sulafat', name: 'Sulafat (Warm)' },
      { id: 'Achernar', name: 'Achernar (Soft)' },
      { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' },
      { id: 'Aoede', name: 'Aoede (Breezy)' },
      { id: 'Leda', name: 'Leda (Youthful)' },
      { id: 'Kore', name: 'Kore (Firm)' },
      { id: 'Puck', name: 'Puck (Upbeat)' },
      { id: 'Zephyr', name: 'Zephyr (Bright)' },
      { id: 'Charon', name: 'Charon (Informative)' },
      { id: 'Fenrir', name: 'Fenrir (Excitable)' },
      { id: 'Orus', name: 'Orus (Firm)' },
      { id: 'Algieba', name: 'Algieba (Smooth)' },
      { id: 'Despina', name: 'Despina (Smooth)' },
      { id: 'Erinome', name: 'Erinome (Clear)' },
      { id: 'Gacrux', name: 'Gacrux (Mature)' },
      { id: 'Achird', name: 'Achird (Friendly)' },
      { id: 'Umbriel', name: 'Umbriel (Easy-going)' },
      { id: 'Enceladus', name: 'Enceladus (Breathy)' },
      { id: 'Iapetus', name: 'Iapetus (Clear)' },
      { id: 'Schedar', name: 'Schedar (Even)' },
      { id: 'Alnilam', name: 'Alnilam (Firm)' },
      { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' },
      { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' },
      { id: 'Autonoe', name: 'Autonoe (Bright)' },
      { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' },
      { id: 'Sadachbia', name: 'Sadachbia (Lively)' },
      { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' },
      { id: 'Algenib', name: 'Algenib (Gravelly)' },
      { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' },
      { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' },
    ];

  const s = state.data.settings?.[0] || {};
  const savedVoice = s.tts_voice_id || 'Sulafat';

  sel.innerHTML = geminiVoices.map(v =>
    `<option value="${v.id}" ${v.id === savedVoice ? 'selected' : ''}>${v.name}</option>`
  ).join('');
};

// Generate TTS via Gemini Native Audio Dialog WebSocket (unlimited free tier)
function _settingsGenerateTTS(text, voiceName, apiKey) {
  return new Promise((resolve, reject) => {
    const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    let ws, audioChunks = [], setupDone = false;

    try { ws = new WebSocket(WS_URL); } catch (e) {
      return reject(new Error('WebSocket failed: ' + (e.message || 'unknown')));
    }

    const timeoutId = setTimeout(() => {
      if (ws.readyState <= 1) ws.close();
      reject(new Error('Timeout (30s)'));
    }, 30000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          },
          systemInstruction: { parts: [{ text: 'Read the user text aloud exactly as written. No extra words.' }] }
        }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        let rawData = event.data;
        if (rawData instanceof Blob) rawData = await rawData.text();
        const msg = JSON.parse(rawData);
        if (msg.setupComplete) {
          setupDone = true;
          ws.send(JSON.stringify({
            clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
          }));
          return;
        }
        if (msg.serverContent?.modelTurn?.parts) {
          for (const p of msg.serverContent.modelTurn.parts) {
            if (p.inlineData?.data) audioChunks.push(p.inlineData.data);
          }
        }
        if (msg.serverContent?.turnComplete) {
          clearTimeout(timeoutId);
          ws.close();
          if (!audioChunks.length) return reject(new Error('No audio received'));
          // Decode all chunks and build WAV
          let totalLen = 0;
          const bufs = audioChunks.map(b64 => {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            totalLen += arr.length;
            return arr;
          });
          const pcm = new Uint8Array(totalLen);
          let off = 0;
          for (const b of bufs) { pcm.set(b, off); off += b.length; }
          // WAV header
          const sr = 24000, ch = 1, bps = 16;
          const wavBuf = new ArrayBuffer(44 + pcm.length);
          const v = new DataView(wavBuf);
          const ws2 = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
          ws2(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); ws2(8, 'WAVE');
          ws2(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
          v.setUint16(22, ch, true); v.setUint32(24, sr, true);
          v.setUint32(28, sr * ch * (bps / 8), true); v.setUint16(32, ch * (bps / 8), true);
          v.setUint16(34, bps, true); ws2(36, 'data'); v.setUint32(40, pcm.length, true);
          new Uint8Array(wavBuf).set(pcm, 44);
          resolve(new Blob([wavBuf], { type: 'audio/wav' }));
        }
      } catch (e) { console.error('[Settings TTS] parse error', e); }
    };

    ws.onerror = () => { clearTimeout(timeoutId); reject(new Error('WebSocket error')); };
    ws.onclose = (e) => {
      clearTimeout(timeoutId);
      if (!setupDone) reject(new Error(`Connection closed (${e.code}): ${e.reason || 'unknown'}`));
    };
  });
}

// Preview selected voice using Gemini TTS API
window._elPreviewAudio = null;

window.previewGeminiVoice = async function () {
  const voiceId = document.getElementById('sTtsVoice')?.value;
  const btn = document.getElementById('elPreviewBtn');

  function resetBtn(label) {
    if (btn) { btn.disabled = false; btn.textContent = label || '▶ Preview'; }
  }

  if (!voiceId) { showToast('Select a voice first', 'error'); return; }

  // Check for Gemini API key
  const s = state.data.settings?.[0] || {};
  const apiKey = s.ai_api_key || '';
  if (!apiKey) {
    showToast('Set your Gemini API key above first!', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating...'; }

  // Stop any currently playing preview
  if (window._elPreviewAudio) {
    window._elPreviewAudio.pause();
    if (window._elPreviewAudio._objUrl) URL.revokeObjectURL(window._elPreviewAudio._objUrl);
    window._elPreviewAudio = null;
  }

  // Pre-create Audio in user-gesture callstack (iOS requirement)
  const previewAudio = new Audio();
  previewAudio.volume = 1.0;
  try { await previewAudio.play().catch(() => {}); } catch(e) {}
  previewAudio.pause();

  const safetyTimer = setTimeout(() => {
    if (btn && btn.textContent.includes('Generating')) {
      showToast('Taking too long — try again', 'error');
      resetBtn();
    }
  }, 15000);

  try {
    showToast('Generating preview with Gemini...', 'info');
    console.log('[TTS Preview] Gemini voice:', voiceId);

    const previewText = 'I am worthy of all the abundance flowing into my life.';

    // Use Gemini Native Audio Dialog via WebSocket (unlimited free tier)
    const wavBlob = await _settingsGenerateTTS(previewText, voiceId, apiKey);

    const url = URL.createObjectURL(wavBlob);
    previewAudio.src = url;
    previewAudio._objUrl = url;
    window._elPreviewAudio = previewAudio;

    if (btn) { btn.disabled = true; btn.textContent = '🔊 Playing...'; }

    previewAudio.onended = () => {
      URL.revokeObjectURL(url);
      window._elPreviewAudio = null;
      resetBtn();
    };
    previewAudio.onerror = () => {
      URL.revokeObjectURL(url);
      window._elPreviewAudio = null;
      showToast('Playback error', 'error');
      resetBtn();
    };

    await previewAudio.play();
    showToast('Playing preview...', 'success');
  } catch (e) {
    showToast('Preview failed: ' + (e.message || 'unknown error'), 'error');
    console.error('[TTS Preview]', e);
    resetBtn();
  } finally {
    clearTimeout(safetyTimer);
  }
};

// Initialize voice dropdown when settings page loads
setTimeout(() => {
  if (document.getElementById('sTtsProvider')) updateVoiceDropdown();
}, 100);

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

  // It's a custom wav file — schedule a real notification so the sound goes through iOS notification system
  if (window.LocalNotifications) {
    await window.LocalNotifications.schedule({
      notifications: [{
        title: "🔔 Test Notification",
        body: "This is how your habit alarms will sound",
        id: 88889,
        schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
        sound: val.endsWith('.wav') ? val : val + '.wav'
      }]
    });
    showToast('Notification arriving in 1 second...', 'info');
  } else {
    showToast(`Sound: ${val}`, 'info');
  }
};

function padZero(num) {
  return num.toString().padStart(2, '0');
}

window.addHabitRoutine = function () {
  const input = document.getElementById('newHabitRoutineInput');
  const routine = input.value.trim();
  if (!routine) return;
  const list = document.getElementById('habitRoutineList');
  const div = document.createElement('div');
  div.className = "routine-item";
  div.dataset.id = routine;
  div.style = "display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--surface-2); border-radius:8px; border:1px solid var(--border-color);";
  div.innerHTML = `
      <span class="routine-name" style="font-weight:500; font-size:13px;">${routine}</span>
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
           <button type="button" class="btn icon small" onclick="moveTab(event, this, -1)" style="padding:2px; height:auto;" title="Move Up">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>
           </button>
           <button type="button" class="btn icon small" onclick="moveTab(event, this, 1)" style="padding:2px; height:auto;" title="Move Down">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
           </button>
        </div>
        <button type="button" onclick="removeHabitRoutine(this)" style="border:none; background:none; cursor:pointer; color:var(--danger); font-size:18px; padding:0; display:flex; align-items:center;">&times;</button>
      </div>
  `;
  list.appendChild(div);
  input.value = '';
};

window.removeHabitRoutine = function (btn) {
  btn.closest('.routine-item').remove();
};
