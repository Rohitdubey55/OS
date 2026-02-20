/* view-tasks.js — Ultra-Premium Bento Grid UI */

const TASK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- STATE ---
let _taskSort = 'priority';
let _itemSelectionMode = false;
let _selectedTaskIds = new Set();
let _expandedTaskIds = new Set();       // tasks expanded to show subtasks
let _collapsedCategories = new Set();   // category groups collapsed
let _taskCategory = 'All';
let _taskPriorityFilter = 'All';
let _showCompletedTasks = false;

// Priority palette (border color only — no text labels in list)
const PRIORITY_COLOR = { P1: '#EF4444', P2: '#F59E0B', P3: '#10B981' };
const PRIORITY_LABEL = { P1: 'High', P2: 'Medium', P3: 'Low' };

function getTaskTodayDayName() {
  const d = new Date().getDay();
  return TASK_DAY_NAMES[d === 0 ? 6 : d - 1];
}

function isTaskDueToday(t) {
  const today = new Date().toISOString().slice(0, 10);
  if (!t.recurrence || t.recurrence === 'none') return t.due_date === today || !t.due_date;
  if (t.recurrence_end && t.recurrence_end < today) return false;
  if (t.recurrence === 'daily') return true;
  if (t.recurrence === 'weekly') {
    const todayDay = getTaskTodayDayName();
    return t.recurrence_days ? t.recurrence_days.split(',').map(s => s.trim()).includes(todayDay) : true;
  }
  if (t.recurrence === 'monthly') {
    const dom = new Date().getDate();
    const taskDay = t.due_date ? new Date(t.due_date).getDate() : dom;
    return dom === taskDay;
  }
  return true;
}

function isRecurringTaskCompletedToday(t) {
  if (!t.recurrence || t.recurrence === 'none') return t.status === 'completed';
  const today = new Date().toISOString().slice(0, 10);
  return (t.completed_dates || '').split(',').includes(today);
}

function parseSubtasks(t) {
  try {
    if (!t.subtasks || t.subtasks === '[]') return [];
    return typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : (t.subtasks || []);
  } catch { return []; }
}

window.toggleCategoryCollapse = function (cat) {
  _collapsedCategories.has(cat) ? _collapsedCategories.delete(cat) : _collapsedCategories.add(cat);
  renderTasks(_getSearchValue());
};

function _getSearchValue() {
  return '';
}

// ─────────────────────────────────────────────────────────
//  MAIN RENDERER
// ─────────────────────────────────────────────────────────
function renderTasks(filter = '') {
  let tasks = Array.isArray(state.data.tasks) ? [...state.data.tasks] : [];

  if (filter) tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(filter.toLowerCase()));
  if (_taskCategory !== 'All') tasks = tasks.filter(t => t.category === _taskCategory);
  if (_taskPriorityFilter !== 'All') tasks = tasks.filter(t => t.priority === _taskPriorityFilter);

  // Sort
  tasks.sort((a, b) => {
    if (_taskSort === 'priority') {
      const pMap = { P1: 1, P2: 2, P3: 3 };
      const diff = (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
      if (diff !== 0) return diff;
    }
    if (_taskSort === 'date' || _taskSort === 'priority') {
      return (a.due_date || '9999').localeCompare(b.due_date || '9999');
    }
    if (_taskSort === 'category') return (a.category || 'z').localeCompare(b.category || 'z');
    if (_taskSort === 'title') return (a.title || '').localeCompare(b.title || '');
    return 0;
  });

  const oneOff = tasks.filter(t => !t.recurrence || t.recurrence === 'none');
  const recurring = tasks.filter(t => t.recurrence && t.recurrence !== 'none');
  const pending = oneOff.filter(t => t.status !== 'completed');
  const completed = oneOff.filter(t => t.status === 'completed');

  const recurringToday = recurring.filter(t => isTaskDueToday(t));
  const recurringOther = recurring.filter(t => !isTaskDueToday(t));

  const allCats = ['All', ...new Set((state.data.tasks || []).map(t => t.category).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = pending.filter(t => t.due_date && t.due_date < today).length;
  const totalPending = pending.length + recurringToday.filter(t => !isRecurringTaskCompletedToday(t)).length;

  // Group pending by category
  const pendingByCat = {};
  pending.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!pendingByCat[cat]) pendingByCat[cat] = [];
    pendingByCat[cat].push(t);
  });

  // Stats for the header strip
  const p1Count = pending.filter(t => t.priority === 'P1').length;
  const doneCount = (state.data.tasks || []).filter(t => t.status === 'completed').length;
  const totalCount = (state.data.tasks || []).length;
  const pctDone = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  document.getElementById('main').innerHTML = `
    <style>
      /* Bento animations */
      @keyframes bentoIn {
        from { opacity:0; transform:translateY(15px) scale(0.97); }
        to   { opacity:1; transform:translateY(0)    scale(1);    }
      }
      @keyframes taskSlideIn {
        from { opacity:0; transform:translateX(-10px); }
        to   { opacity:1; transform:translateX(0); }
      }

      /* Masonry Layout */
      .bento-masonry {
        column-count: 2;
        column-gap: 12px;
        margin-top: 10px;
      }
      @media (max-width: 650px) {
        .bento-masonry { column-count: 1; }
      }

      .bento-card {
        background: var(--surface-1);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03);
        overflow: hidden;
        transition: box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        animation: bentoIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        break-inside: avoid;
        margin-bottom: 12px;
        display: inline-block;
        width: 100%;
      }
      .bento-card:hover { 
        box-shadow: 0 10px 32px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05); 
        transform: translateY(-2px);
      }
      
      .task-bento-row {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 10px 14px; border-bottom: 1px solid var(--border-color);
        cursor: pointer; transition: background 0.2s;
        animation: taskSlideIn 0.3s ease both;
      }
      .task-bento-row:last-child { border-bottom: none; }
      .task-bento-row:hover { background: var(--surface-2, rgba(0,0,0,0.02)); }
      .task-bento-row.done { opacity: 0.55; }
      .task-bento-row.selected { background: color-mix(in srgb, var(--primary) 8%, transparent); }
      .task-check-ring {
        width: 20px; height: 20px; min-width: 20px; border-radius: 50%;
        border: 2px solid var(--border-color); display: flex; align-items: center;
        justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; margin-top: 1px;
      }
      .task-check-ring.done    { background: var(--primary); border-color: var(--primary); }
      .task-check-ring:hover:not(.done) { border-color: var(--primary); }
      .cat-header {
        display: flex; align-items: center; gap: 8px; padding: 9px 12px 7px;
        cursor: pointer; user-select: none; background: var(--surface-2, rgba(0,0,0,0.015));
        border-bottom: 1px solid var(--border-color); transition: background 0.15s;
      }
      .cat-header:hover { background: var(--surface-base, rgba(0,0,0,0.03)); }
      .prio-dot {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      }
      .task-title-text {
        font-size: 13.5px; font-weight: 500; line-height: 1.35;
        color: var(--text-1); flex: 1; min-width: 0;
      }
      .task-meta-chip {
        display: inline-flex; align-items: center; gap: 3px;
        font-size: 10px; color: var(--text-muted); background: var(--surface-2, rgba(0,0,0,0.04));
        padding: 1px 6px; border-radius: 20px; border: 1px solid var(--border-color);
        white-space: nowrap;
      }
      .subtask-expand {
        padding: 8px 12px 10px 40px; border-bottom: 1px solid var(--border-color);
        background: var(--surface-1); animation: bentoIn 0.2s ease;
      }
      .subtask-item {
        display: flex; align-items: center; gap: 8px; padding: 4px 0;
        font-size: 12px; border-bottom: 1px solid rgba(0,0,0,0.04);
      }
      .subtask-item:last-of-type { border-bottom: none; }
      .subtask-mini-check {
        width: 15px; height: 15px; min-width: 15px; border-radius: 50%;
        border: 2px solid var(--border-color); display: flex; align-items: center;
        justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0;
      }
      .subtask-mini-check.done { background: var(--primary); border-color: var(--primary); }
      .stat-pill {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: var(--surface-2, rgba(0,0,0,0.03)); border-radius: 12px; padding: 10px 14px;
        border: 1px solid var(--border-color); flex: 1; min-width: 0;
      }
      .filter-dot-btn {
        width: 18px; height: 18px; border-radius: 50%; border: 3px solid transparent;
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; flex-shrink: 0;
      }
      .filter-dot-btn.active { transform: scale(1.25); box-shadow: 0 0 0 3px rgba(255,255,255,0.6), 0 0 0 5px currentColor; }
      .filter-dot-btn:hover { transform: scale(1.15); }
    </style>

    <div class="task-wrapper">

      <!-- ── TOP HEADER ── -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h2 style="margin:0; font-size:20px; font-weight:700; letter-spacing:-0.3px;">Tasks</h2>
          <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">
            ${totalPending} active · ${overdueCount > 0 ? `<span style="color:var(--danger)">⚠ ${overdueCount} overdue</span>` : `${pctDone}% complete`}
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          ${_itemSelectionMode ? `
            <button class="btn small" style="background:var(--danger);color:white;font-size:11px;" onclick="deleteSelectedTasks()">
              <i data-lucide="trash-2" style="width:12px;margin-right:3px;"></i>Delete (${_selectedTaskIds.size})
            </button>
            <button class="btn small secondary" style="font-size:11px;" onclick="toggleTaskSelectionMode()">Cancel</button>
          ` : `
            <button class="btn icon" onclick="toggleTaskSelectionMode()" title="Select tasks" style="width:32px;height:32px;">
              <i data-lucide="check-square" style="width:15px;"></i>
            </button>
          `}
        </div>
      </div>

      <!-- ── STATS STRIP ── -->
      <div style="display:flex; gap:8px; margin-bottom:12px; overflow-x:auto; scrollbar-width:none;">
        <div class="stat-pill">
          <div style="font-size:18px; font-weight:700; color:var(--danger);">${p1Count}</div>
          <div style="font-size:10px; color:var(--text-muted);">Urgent</div>
        </div>
        <div class="stat-pill">
          <div style="font-size:18px; font-weight:700; color:var(--primary);">${totalPending}</div>
          <div style="font-size:10px; color:var(--text-muted);">Active</div>
        </div>
        <div class="stat-pill" style="flex:2;">
          <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:4px;">
            <span style="font-size:10px; color:var(--text-muted);">Progress</span>
            <span style="font-size:10px; font-weight:600;">${pctDone}%</span>
          </div>
          <div style="width:100%; height:5px; background:var(--border-color); border-radius:3px; overflow:hidden;">
            <div style="width:${pctDone}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--success)); border-radius:3px; transition:width 0.5s;"></div>
          </div>
        </div>
      </div>

      <!-- ── FILTERS ── -->
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <!-- Status -->
        <div class="segmented-control" style="flex:0 0 auto;">
          <button class="range-btn ${!_showCompletedTasks ? 'active' : ''}"
            onclick="_showCompletedTasks=false;renderTasks(_getSearchValue())">Active</button>
          <button class="range-btn ${_showCompletedTasks ? 'active' : ''}"
            onclick="_showCompletedTasks=true;renderTasks(_getSearchValue())">Done</button>
        </div>

        <!-- Priority dot filters -->
        <div style="display:flex;align-items:center;gap:5px;background:var(--surface-1);border:1px solid var(--border-color);border-radius:20px;padding:5px 10px;">
          <button onclick="_taskPriorityFilter='All';renderTasks(_getSearchValue())"
            style="font-size:11px;font-weight:600;background:none;border:none;cursor:pointer;padding:0 4px;color:${_taskPriorityFilter === 'All' ? 'var(--primary)' : 'var(--text-muted)'};">All</button>
          ${['P1', 'P2', 'P3'].map(p => `
            <button class="filter-dot-btn ${_taskPriorityFilter === p ? 'active' : ''}"
              style="background:${PRIORITY_COLOR[p]}; color:${PRIORITY_COLOR[p]};"
              onclick="_taskPriorityFilter='${p}';renderTasks(_getSearchValue())"
              title="${PRIORITY_LABEL[p]}"></button>
          `).join('')}
        </div>

        <!-- Category -->
        <select class="input" style="flex:1;min-width:70px;margin:0;padding:0 8px;height:30px;font-size:12px;border-radius:10px;"
          onchange="_taskCategory=this.value;renderTasks(_getSearchValue())">
          ${allCats.map(c => `<option value="${c}" ${c === _taskCategory ? 'selected' : ''}>${c}</option>`).join('')}
        </select>

        <!-- Sort -->
        <select class="input" style="flex:1;min-width:70px;margin:0;padding:0 8px;height:30px;font-size:12px;border-radius:10px;"
          onchange="_taskSort=this.value;renderTasks(_getSearchValue())">
          <option value="priority" ${_taskSort === 'priority' ? 'selected' : ''}>↑ Priority</option>
          <option value="date"     ${_taskSort === 'date' ? 'selected' : ''}>📅 Date</option>
          <option value="category" ${_taskSort === 'category' ? 'selected' : ''}>🏷 Group</option>
          <option value="title"    ${_taskSort === 'title' ? 'selected' : ''}>A–Z</option>
        </select>
      </div>

      <!-- ── OVERDUE BANNER ── -->
      ${overdueCount > 0 ? `
      <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--danger);">
        <i data-lucide="alert-triangle" style="width:14px;flex-shrink:0;"></i>
        <span><strong>${overdueCount} task${overdueCount > 1 ? 's' : ''}</strong> past due date</span>
      </div>` : ''}

      <!-- ── RECURRING TODAY ── -->
      ${recurringToday.length > 0 ? renderBentoSection('__recurring_today__',
    `<i data-lucide="repeat" style="width:13px;"></i> Today's Recurring`,
    recurringToday, true) : ''}

      <!-- ── PENDING BY CATEGORY ── -->
      ${pending.length === 0 && recurringToday.length === 0 ? `
        <div class="bento-card" style="padding:32px;text-align:center;">
          <i data-lucide="check-circle-2" style="width:32px;color:var(--success);margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;"></i>
          <div style="font-weight:600;color:var(--text-2);margin-bottom:4px;">All clear!</div>
          <div style="font-size:12px;color:var(--text-muted);">No active tasks right now.</div>
        </div>
      ` : `<div class="bento-masonry">` + Object.keys(pendingByCat).sort().map((cat, idx) => {
      // Wrap in a temporary span just to set animation delay based on index
      const bentoHtml = renderBentoSection(cat, cat, pendingByCat[cat], false, true);
      return bentoHtml.replace('class="bento-card"', `class="bento-card" style="animation-delay:${idx * 0.05}s;"`);
    }).join('') + `</div>`}

      <!-- ── COMPLETED ── -->
      ${_showCompletedTasks && completed.length > 0 ? renderBentoSection('__completed__',
      `<i data-lucide="check-circle" style="width:13px;"></i> Completed`,
      completed, false) : ''}

      <!-- ── OTHER RECURRING ── -->
      ${recurringOther.length > 0 ? renderBentoSection('__recurring_other__',
        `<i data-lucide="repeat" style="width:13px;"></i> Other Recurring`,
        recurringOther, true, false, true) : ''}

      <!-- bottom spacer -->
      <div style="height:80px;"></div>
    </div>`;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ─────────────────────────────────────────────────────────
//  BENTO SECTION
// ─────────────────────────────────────────────────────────
function renderBentoSection(key, label, tasks, isRecurring = false, hideCategory = false, dimmed = false) {
  const isCollapsed = !_collapsedCategories.has(key); // Default collapsed (empty set = all collapsed)
  const count = tasks.length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueInGroup = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length;
  const p1InGroup = tasks.filter(t => t.priority === 'P1').length;

  return `
    <div class="bento-card" style="${dimmed ? 'opacity:0.6;' : ''} margin-bottom:10px;">
      <!-- Category Header -->
      <div class="cat-header" onclick="toggleCategoryCollapse('${key}')">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;"></div>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--text-1);">${label}</span>
        ${p1InGroup > 0 ? `<span style="font-size:10px;font-weight:700;color:${PRIORITY_COLOR.P1};background:${PRIORITY_COLOR.P1}18;border-radius:20px;padding:1px 7px;">${p1InGroup} urgent</span>` : ''}
        ${overdueInGroup > 0 ? `<span style="font-size:10px;font-weight:700;color:var(--danger);background:rgba(239,68,68,0.1);border-radius:20px;padding:1px 7px;">⚠ ${overdueInGroup}</span>` : ''}
        <span style="font-size:11px;color:var(--text-muted);margin-left:2px;">${count}</span>
        <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width:14px;color:var(--text-muted);flex-shrink:0;"></i>
      </div>
      ${!isCollapsed ? tasks.map(t => renderBentoTaskRow(t, isRecurring, dimmed)).join('') : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────
//  BENTO TASK ROW
// ─────────────────────────────────────────────────────────
function renderBentoTaskRow(t, isRecurring = false, dimmed = false) {
  const isDone = isRecurring ? isRecurringTaskCompletedToday(t) : t.status === 'completed';
  const selected = _selectedTaskIds.has(String(t.id));
  const isExpanded = _expandedTaskIds.has(String(t.id));
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = t.due_date && t.due_date < today && !isDone;
  const pColor = PRIORITY_COLOR[t.priority] || 'transparent';
  const subtasks = parseSubtasks(t);
  const doneSubCount = subtasks.filter(s => s.done).length;

  // Friendly date
  let dateLabel = '';
  if (t.due_date) {
    const diff = Math.round((new Date(t.due_date) - new Date(today)) / 86400000);
    if (diff === 0) dateLabel = 'Today';
    else if (diff === 1) dateLabel = 'Tomorrow';
    else if (diff === -1) dateLabel = 'Yesterday';
    else if (diff < 0) dateLabel = `${Math.abs(diff)}d ago`;
    else if (diff < 7) dateLabel = `${diff}d`;
    else dateLabel = t.due_date;
  }

  const recurLabel = { daily: '↻ Daily', weekly: '↻ Weekly', monthly: '↻ Monthly' }[t.recurrence] || '';

  return `
    <div class="task-bento-row ${isDone ? 'done' : ''} ${selected ? 'selected' : ''}"
         id="task-row-${t.id}"
         style="border-left:3px solid ${isDone ? 'transparent' : pColor};"
         onclick="toggleTaskDetails('${t.id}')">

      <!-- Checkbox -->
      <div class="task-check-ring ${isDone ? 'done' : ''}"
           onclick="event.stopPropagation(); ${_itemSelectionMode ? `toggleTaskSelection('${t.id}')` :
      (isRecurring ? `toggleRecurringTask('${t.id}',${!isDone})` : `toggleTaskOptimistic('${t.id}')`)}"
           style="${isDone ? 'background:var(--primary);border-color:var(--primary);' : (!_itemSelectionMode && t.priority ? `border-color:${pColor}55;` : '')}">
        ${isDone || (_itemSelectionMode && selected)
      ? `<i data-lucide="check" style="width:10px;color:white;"></i>`
      : (_itemSelectionMode ? `<i data-lucide="circle" style="width:10px;color:var(--text-muted);"></i>` : '')
    }
      </div>

      <!-- Content -->
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:flex-start;gap:4px;">
          <span class="task-title-text" style="${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">
            ${t.title}
          </span>
          ${!_itemSelectionMode ? `
          <div style="display:flex;align-items:center;gap:1px;flex-shrink:0;margin-top:-1px;" onclick="event.stopPropagation()">
            <button class="btn icon" style="width:22px;height:22px;padding:2px;" onclick="openEditTask('${t.id}')" title="Edit">
              <i data-lucide="pencil" style="width:11px;"></i>
            </button>
            <button class="btn icon" style="width:22px;height:22px;padding:2px;" data-action="delete" data-sheet="tasks" data-id="${t.id}" title="Delete">
              <i data-lucide="trash-2" style="width:11px;"></i>
            </button>
            <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" style="width:13px;color:var(--text-muted);opacity:0.5;margin-left:1px;"></i>
          </div>` : ''}
        </div>

        <!-- Meta chips (collapsed view) -->
        ${!isExpanded ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
          ${t.due_date ? `
          <span class="task-meta-chip" style="${isOverdue ? 'color:var(--danger);border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.07);' : ''}">
            <i data-lucide="${isOverdue ? 'alert-circle' : 'calendar'}" style="width:9px;"></i>
            ${dateLabel}${isOverdue ? ' ⚠' : ''}
          </span>` : ''}
          ${subtasks.length > 0 ? `
          <span class="task-meta-chip" style="${doneSubCount === subtasks.length && subtasks.length > 0 ? 'color:var(--success);border-color:rgba(16,185,129,0.3);' : ''}">
            <i data-lucide="${doneSubCount === subtasks.length && subtasks.length > 0 ? 'check-circle' : 'list-todo'}" style="width:9px;"></i>
            ${doneSubCount}/${subtasks.length}
          </span>` : ''}
          ${recurLabel ? `<span class="task-meta-chip"><i data-lucide="repeat" style="width:9px;"></i> ${recurLabel}</span>` : ''}
        </div>` : ''}
      </div>
    </div>

    <!-- Expanded subtasks panel -->
    ${isExpanded ? `
    <div class="subtask-expand">
      ${t.description ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;line-height:1.5;">${t.description}</div>` : ''}
      ${subtasks.map((s, idx) => `
        <div class="subtask-item">
          <div class="subtask-mini-check ${s.done ? 'done' : ''}"
               onclick="event.stopPropagation();toggleSubtask('${t.id}',${idx},${!s.done})">
            ${s.done ? `<i data-lucide="check" style="width:8px;color:white;"></i>` : ''}
          </div>
          <span style="flex:1;${s.done ? 'text-decoration:line-through;color:var(--text-muted);' : 'color:var(--text-2);'}">${s.text}</span>
          <i data-lucide="x" style="width:11px;color:var(--text-muted);cursor:pointer;opacity:0.5;"
             onclick="event.stopPropagation();window.deleteSubtask('${t.id}',${idx})"></i>
        </div>
      `).join('')}
      <!-- Add subtask input -->
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;margin-top:2px;">
        <div style="width:15px;height:15px;min-width:15px;border:2px dashed var(--border-color);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="plus" style="width:8px;color:var(--text-muted);"></i>
        </div>
        <input type="text" id="inline-subtask-input-${t.id}" placeholder="Add subtask…"
               style="flex:1;border:none;background:transparent;outline:none;font-size:12px;color:var(--text-1);"
               onclick="event.stopPropagation()"
               onkeydown="if(event.key==='Enter'){event.stopPropagation();addInlineSubtask('${t.id}',this.value);this.value='';}">
      </div>
    </div>` : ''}
  `;
}

// ─────────────────────────────────────────────────────────
//  EXPAND / COLLAPSE TASK
// ─────────────────────────────────────────────────────────
window.toggleTaskDetails = function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;

  _expandedTaskIds.has(String(id))
    ? _expandedTaskIds.delete(String(id))
    : _expandedTaskIds.add(String(id));

  // Re-render just this task in place for snappiness
  const row = document.getElementById(`task-row-${id}`);
  if (row) {
    const isRecurring = !!(t.recurrence && t.recurrence !== 'none');
    // Replace row + its optional expanded sibling
    const newHtml = renderBentoTaskRow(t, isRecurring);
    const tmp = document.createElement('div');
    tmp.innerHTML = newHtml;
    // Remove old expanded div if present
    const next = row.nextElementSibling;
    if (next && next.classList.contains('subtask-expand')) next.remove();
    row.outerHTML = newHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const inp = document.getElementById(`inline-subtask-input-${id}`);
    if (inp) inp.focus();
  } else {
    renderTasks(_getSearchValue());
  }
};

// ─────────────────────────────────────────────────────────
//  SUBTASK OPERATIONS
// ─────────────────────────────────────────────────────────
function _reRenderTaskRow(taskId) {
  const t = state.data.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return renderTasks(_getSearchValue());
  const row = document.getElementById(`task-row-${taskId}`);
  if (!row) return renderTasks(_getSearchValue());
  const isRecurring = !!(t.recurrence && t.recurrence !== 'none');
  const next = row.nextElementSibling;
  if (next && next.classList.contains('subtask-expand')) next.remove();
  row.outerHTML = renderBentoTaskRow(t, isRecurring);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.toggleSubtask = async function (taskId, subIndex, newStatus) {
  const t = state.data.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  const subs = parseSubtasks(t);
  if (!subs[subIndex]) return;
  subs[subIndex].done = newStatus;
  t.subtasks = JSON.stringify(subs);
  _reRenderTaskRow(taskId);
  await apiCall('update', 'tasks', { subtasks: t.subtasks }, taskId);
};

window.deleteSubtask = async function (taskId, subIndex) {
  const t = state.data.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  const subs = parseSubtasks(t);
  subs.splice(subIndex, 1);
  t.subtasks = JSON.stringify(subs);
  _reRenderTaskRow(taskId);
  await apiCall('update', 'tasks', { subtasks: t.subtasks }, taskId);
};

window.addInlineSubtask = async function (taskId, text) {
  if (!text?.trim()) return;
  const t = state.data.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  const subs = parseSubtasks(t);
  subs.push({ text: text.trim(), done: false });
  t.subtasks = JSON.stringify(subs);
  _reRenderTaskRow(taskId);
  const inp = document.getElementById(`inline-subtask-input-${taskId}`);
  if (inp) inp.focus();
  await apiCall('update', 'tasks', { subtasks: t.subtasks }, taskId);
};

// ─────────────────────────────────────────────────────────
//  SELECTION & BATCH DELETE
// ─────────────────────────────────────────────────────────
window.toggleTaskSelectionMode = function () {
  _itemSelectionMode = !_itemSelectionMode;
  _selectedTaskIds.clear();
  renderTasks(_getSearchValue());
};

window.toggleTaskSelection = function (id) {
  _selectedTaskIds.has(String(id)) ? _selectedTaskIds.delete(String(id)) : _selectedTaskIds.add(String(id));
  renderTasks(_getSearchValue());
};

window.deleteSelectedTasks = async function () {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const count = _selectedTaskIds.size;
  if (count === 0) return;
  box.innerHTML = `
    <h3 style="color:var(--danger)">Delete ${count} Task${count > 1 ? 's' : ''}?</h3>
    <p style="color:var(--text-muted);margin:10px 0;font-size:13px;">This cannot be undone.</p>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn" style="background:var(--danger);color:white;" onclick="confirmDeleteSelectedTasks()">Delete ${count}</button>
    </div>`;
  modal.classList.remove('hidden');
};

window.confirmDeleteSelectedTasks = async function () {
  document.getElementById('universalModal').classList.add('hidden');
  state.data.tasks = state.data.tasks.filter(t => !_selectedTaskIds.has(String(t.id)));
  _itemSelectionMode = false;
  renderTasks();
  for (const id of _selectedTaskIds) await apiCall('delete', 'tasks', {}, id);
  _selectedTaskIds.clear();
};

// ─────────────────────────────────────────────────────────
//  TOGGLE TASK STATUS
// ─────────────────────────────────────────────────────────
window.toggleRecurringTask = async function (id, markDone) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  const today = new Date().toISOString().slice(0, 10);
  let dates = (t.completed_dates || '').split(',').filter(Boolean);
  if (markDone) { if (!dates.includes(today)) dates.push(today); }
  else { dates = dates.filter(d => d !== today); }
  t.completed_dates = dates.join(',');
  _reRenderTaskRow(id);
  await apiCall('update', 'tasks', { completed_dates: t.completed_dates }, id);
};

window.toggleTaskOptimistic = async function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  const newStatus = t.status === 'completed' ? 'pending' : 'completed';
  t.status = newStatus;
  _reRenderTaskRow(id);
  try {
    await apiCall('update', 'tasks', { status: newStatus }, id);
  } catch (e) {
    t.status = newStatus === 'completed' ? 'pending' : 'completed';
    _reRenderTaskRow(id);
    showToast('Error updating task');
  }
};

// ─────────────────────────────────────────────────────────
//  MODALS
// ─────────────────────────────────────────────────────────
window.openTaskModal = function () {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const categories = ['Work', 'Personal', 'Health', 'Finance', 'Study', 'Other'];
  box.innerHTML = `
    <h3>New Task</h3>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <input class="input" id="mTaskTitle" placeholder="Task title" autofocus>
      <textarea class="input" id="mTaskDesc" placeholder="Description..." rows="2"></textarea>
      <div style="border:1px solid var(--border-color);padding:10px;border-radius:10px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Subtasks</label>
        <div id="mSubtaskList" style="margin-top:6px;"></div>
        <button class="btn small secondary" style="width:100%;margin-top:6px;" onclick="addSubtaskInput()">+ Add Subtask</button>
      </div>
      <div style="display:flex;gap:8px;">
        <select class="input" id="mTaskCategory">
          <option value="" disabled selected>Category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <input type="text" class="input" id="mTaskTags" placeholder="Tags">
      </div>
      <div style="display:flex;gap:8px;">
        <select class="input" id="mTaskPriority">
          <option value="P1">● High (P1)</option>
          <option value="P2" selected>● Medium (P2)</option>
          <option value="P3">● Low (P3)</option>
        </select>
        <input type="date" class="input" id="mTaskDate" value="${new Date().toISOString().slice(0, 10)}">
        <input type="time" class="input" id="mTaskTime">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Recurrence</label>
        <select class="input" id="mTaskRecurrence" onchange="taskRecurrenceChanged()" style="margin-top:6px;">
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div id="taskDayPickerWrap" style="display:none;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);">Days</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `
            <label style="font-size:11px;display:flex;align-items:center;gap:3px;">
              <input type="checkbox" value="${d}" class="task-day-check"> ${d}
            </label>`).join('')}
        </div>
      </div>
      <div id="taskEndDateWrap" style="display:none;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);">End Date (optional)</label>
        <input type="date" class="input" id="mTaskRecurrenceEnd" style="margin-top:6px;">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="save-task-modal">Save Task</button>
      </div>
    </div>`;
  document.getElementById('universalModal').classList.remove('hidden');
};

window.addSubtaskInput = function (value = '', done = false) {
  const list = document.getElementById('mSubtaskList');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px;';
  div.innerHTML = `
    <input type="checkbox" class="subtask-check" ${done ? 'checked' : ''}>
    <input type="text" class="input small subtask-text" value="${value}" placeholder="Step…" style="margin:0;flex:1;">
    <i data-lucide="x" style="width:13px;cursor:pointer;" onclick="this.parentElement.remove()"></i>`;
  list.appendChild(div);
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.taskRecurrenceChanged = function () {
  const val = document.getElementById('mTaskRecurrence').value;
  document.getElementById('taskDayPickerWrap').style.display = val === 'weekly' ? 'block' : 'none';
  document.getElementById('taskEndDateWrap').style.display = val !== 'none' ? 'block' : 'none';
};

window.openEditTask = function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  const categories = ['Work', 'Personal', 'Health', 'Finance', 'Study', 'Other'];
  const isWeekly = t.recurrence === 'weekly';
  const isRecurring = t.recurrence && t.recurrence !== 'none';
  const selectedDays = t.recurrence_days ? t.recurrence_days.split(',').map(s => s.trim()) : [];
  let subtasks = [];
  try { if (t.subtasks) subtasks = typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : t.subtasks; } catch { }

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3>Edit Task</h3>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <input class="input" id="mTaskTitle" value="${(t.title || '').replace(/"/g, '&quot;')}" placeholder="Task title">
      <textarea class="input" id="mTaskDesc" placeholder="Description..." rows="2">${t.description || ''}</textarea>
      <div style="border:1px solid var(--border-color);padding:10px;border-radius:10px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Subtasks</label>
        <div id="mSubtaskList" style="margin-top:6px;"></div>
        <button class="btn small secondary" style="width:100%;margin-top:6px;" onclick="addSubtaskInput()">+ Add Subtask</button>
      </div>
      <div style="display:flex;gap:8px;">
        <select class="input" id="mTaskCategory">
          <option value="" disabled ${!t.category ? 'selected' : ''}>Category</option>
          ${categories.map(c => `<option value="${c}" ${t.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <input type="text" class="input" id="mTaskTags" value="${t.tags || ''}" placeholder="Tags">
      </div>
      <div style="display:flex;gap:8px;">
        <select class="input" id="mTaskPriority">
          <option value="P1" ${t.priority === 'P1' ? 'selected' : ''}>● High (P1)</option>
          <option value="P2" ${t.priority === 'P2' ? 'selected' : ''}>● Medium (P2)</option>
          <option value="P3" ${(!t.priority || t.priority === 'P3') ? 'selected' : ''}>● Low (P3)</option>
        </select>
        <input type="date" class="input" id="mTaskDate" value="${t.due_date || ''}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Recurrence</label>
        <select class="input" id="mTaskRecurrence" onchange="taskRecurrenceChanged()" style="margin-top:6px;">
          <option value="none"    ${!t.recurrence || t.recurrence === 'none' ? 'selected' : ''}>None</option>
          <option value="daily"   ${t.recurrence === 'daily' ? 'selected' : ''}>Daily</option>
          <option value="weekly"  ${t.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="monthly" ${t.recurrence === 'monthly' ? 'selected' : ''}>Monthly</option>
        </select>
      </div>
      <div id="taskDayPickerWrap" style="display:${isWeekly ? 'block' : 'none'};">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${TASK_DAY_NAMES.map(d => `
            <label style="font-size:11px;display:flex;align-items:center;gap:3px;">
              <input type="checkbox" value="${d}" class="task-day-check" ${selectedDays.includes(d) ? 'checked' : ''}> ${d}
            </label>`).join('')}
        </div>
      </div>
      <div id="taskEndDateWrap" style="display:${isRecurring ? 'block' : 'none'};">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);">End Date</label>
        <input type="date" class="input" id="mTaskRecurrenceEnd" value="${t.recurrence_end || ''}" style="margin-top:6px;">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="update-task-modal" data-edit-id="${t.id}">Update Task</button>
      </div>
    </div>`;
  modal.classList.remove('hidden');
  if (subtasks.length > 0) {
    document.getElementById('mSubtaskList').innerHTML = '';
    subtasks.forEach(s => addSubtaskInput(s.text, s.done));
  }
};