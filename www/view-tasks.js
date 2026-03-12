/* view-tasks.js — SaaS Premium Task Manager */

const TASK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── State ── */
let _taskSort = 'priority';
let _itemSelectionMode = false;
let _selectedTaskIds = new Set();
let _expandedTaskIds = new Set();
let _collapsedCategories = new Set();
let _taskCategory = 'All';
let _taskPriorityFilter = 'All';
let _showCompletedTasks = false;

const PRIORITY_COLOR = { P1: '#DC2626', P2: '#D97706', P3: '#059669' };
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

function _getSearchValue() { return ''; }

function parseDueTimeForInput(val) {
  if (!val) return '';
  const s = String(val);
  if (s.startsWith('1899-12-30T')) {
    const timePart = s.slice(11, 16);
    if (timePart.match(/^\d{2}:\d{2}$/)) return timePart;
  }
  if (s.includes('T') && !s.startsWith('1899')) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }
  if (s.match(/^\d{2}:\d{2}/)) return s.slice(0, 5);
  return '';
}

/* ══════════════════════════════════════════════════════
   QUICK-CAPTURE HANDLER
══════════════════════════════════════════════════════ */
window.tkQuickCapture = async function(e) {
  if (e.key !== 'Enter') return;
  const inp = document.getElementById('tkCaptureInput');
  const catSel = document.getElementById('tkCaptureCat');
  const title = inp?.value?.trim();
  if (!title) return;
  inp.value = '';
  inp.placeholder = 'Saving…';
  const category = catSel?.value || '';
  try {
    await apiCall('create', 'tasks', {
      title,
      priority: 'P2',
      status: 'pending',
      category,
      due_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      subtasks: '[]'
    });
    inp.placeholder = 'Capture a task… press Enter to save';
    await refreshData('tasks');
  } catch (e) {
    inp.placeholder = 'Capture a task… press Enter to save';
    showToast('Failed to save task');
  }
};

window.tkSetCat = function(cat) {
  _taskCategory = cat;
  document.querySelectorAll('.tk-cat-pill').forEach(el =>
    el.classList.toggle('active', el.dataset.cat === cat)
  );
  renderTasks();
};

window.tkSetPrio = function(p) {
  _taskPriorityFilter = p;
  document.querySelectorAll('.tk-prio-dot').forEach(el =>
    el.classList.toggle('active', el.dataset.prio === p)
  );
  renderTasks();
};

/* ══════════════════════════════════════════════════════
   MAIN RENDERER
══════════════════════════════════════════════════════ */
function renderTasks(filter = '') {
  let tasks = Array.isArray(state.data.tasks) ? [...state.data.tasks] : [];

  if (_collapsedCategories.size === 0 && !filter) {
    const s = state.data.settings?.[0] || {};
    let defaultView = s.task_default_view || 'expanded';
    if (s.task_categories && s.task_categories.startsWith('VIEW:')) {
      const parts = s.task_categories.split('|');
      const viewPref = parts[0].replace('VIEW:', '');
      if (viewPref === 'collapsed' || viewPref === 'expanded') defaultView = viewPref;
    }
    if (defaultView === 'collapsed') {
      const allCatsInit = [...new Set(tasks.map(t => t.category || 'Other'))];
      allCatsInit.forEach(c => _collapsedCategories.add(c));
      _collapsedCategories.add("Today's 3");
      _collapsedCategories.add('Recurring');
    } else {
      _collapsedCategories.clear();
    }
  }

  if (filter) tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(filter.toLowerCase()));
  if (_taskCategory !== 'All') tasks = tasks.filter(t => t.category === _taskCategory);
  if (_taskPriorityFilter !== 'All') tasks = tasks.filter(t => t.priority === _taskPriorityFilter);

  tasks.sort((a, b) => {
    if (_taskSort === 'priority') {
      const pMap = { P1: 1, P2: 2, P3: 3 };
      const diff = (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
      if (diff !== 0) return diff;
    }
    if (_taskSort === 'date' || _taskSort === 'priority')
      return (a.due_date || '9999').localeCompare(b.due_date || '9999');
    if (_taskSort === 'category') return (a.category || 'z').localeCompare(b.category || 'z');
    if (_taskSort === 'title') return (a.title || '').localeCompare(b.title || '');
    return 0;
  });

  const oneOff = tasks.filter(t => !t.recurrence || t.recurrence === 'none');
  const recurring = tasks.filter(t => t.recurrence && t.recurrence !== 'none');
  let pending = oneOff.filter(t => t.status !== 'completed');
  const completed = oneOff.filter(t => t.status === 'completed');
  let recurringToday = recurring.filter(t => isTaskDueToday(t));
  const recurringOther = recurring.filter(t => !isTaskDueToday(t));

  const allCats = [...new Set((state.data.tasks || []).map(t => t.category).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  const totalPending = pending.length + recurringToday.filter(t => !isRecurringTaskCompletedToday(t)).length;

  const pendingByCat = {};
  pending.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!pendingByCat[cat]) pendingByCat[cat] = [];
    pendingByCat[cat].push(t);
  });

  const doneCount = (state.data.tasks || []).filter(t => t.status === 'completed').length;
  const totalCount = (state.data.tasks || []).length;
  const pctDone = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  document.getElementById('main').innerHTML = `
  <style>
    /* ══ SHELL ══ */
    .tk-shell { display:flex; flex-direction:column; height:calc(100vh - env(safe-area-inset-top,44px) - 80px); overflow:hidden; background:var(--surface-base); }

    /* ══ HEADER ══ */
    .tk-header { display:flex; align-items:center; justify-content:space-between; padding:16px 16px 12px; flex-shrink:0; }
    .tk-header-left { display:flex; align-items:center; gap:10px; }
    .tk-header-title { font-size:24px; font-weight:800; color:var(--text-1); letter-spacing:-0.8px; line-height:1; }
    .tk-count-badge { font-size:11px; font-weight:700; background:var(--primary); color:#fff; border-radius:20px; padding:3px 9px; letter-spacing:.2px; }
    .tk-pct-badge { font-size:11px; font-weight:700; background:var(--surface-2); color:var(--text-3); border:1.5px solid var(--border-color); border-radius:20px; padding:3px 9px; letter-spacing:.2px; }
    .tk-header-right { display:flex; align-items:center; gap:4px; }
    .tk-add-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:var(--primary); color:#fff; border:none; border-radius:22px; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; box-shadow:0 2px 8px rgba(79,70,229,.25); letter-spacing:.1px; }
    .tk-add-btn:active { opacity:.88; transform:scale(.96); box-shadow:none; }
    .tk-icon-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:none; background:transparent; border-radius:10px; cursor:pointer; color:var(--text-3); transition:all .15s; }
    .tk-icon-btn:hover,.tk-icon-btn:active { background:var(--surface-2); color:var(--text-1); }
    .tk-icon-btn.active { color:var(--primary); background:var(--primary-soft,rgba(79,70,229,.08)); }

    /* ══ QUICK CAPTURE ══ */
    .tk-capture-wrap { padding:0 16px 10px; flex-shrink:0; }
    .tk-capture { display:flex; align-items:center; gap:0; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:14px; padding:0; overflow:hidden; transition:border-color .25s,box-shadow .25s; box-shadow:var(--shadow-sm); }
    .tk-capture:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.12), var(--shadow-sm); }
    .tk-capture-icon { display:flex; align-items:center; padding:0 12px 0 14px; color:var(--primary); flex-shrink:0; }
    .tk-capture-input { flex:1; background:transparent; border:none; outline:none; font-size:14px; color:var(--text-1); padding:12px 0; min-width:0; }
    .tk-capture-input::placeholder { color:var(--text-3); }
    .tk-capture-divider { width:1px; background:var(--border-color); height:20px; flex-shrink:0; margin:0 2px; }
    .tk-capture-cat { border:none; background:transparent; outline:none; font-size:12px; font-weight:600; color:var(--text-3); padding:12px 14px 12px 10px; cursor:pointer; flex-shrink:0; max-width:100px; }
    .tk-capture-cat:focus { color:var(--primary); }

    /* ══ FILTER PILLS ══ */
    .tk-filter-row { display:flex; gap:6px; padding:0 16px 8px; overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
    .tk-filter-row::-webkit-scrollbar { display:none; }
    .tk-cat-pill { display:inline-flex; align-items:center; padding:6px 14px; border-radius:22px; font-size:12.5px; font-weight:500; background:var(--surface-1); border:1.5px solid var(--border-color); color:var(--text-3); cursor:pointer; white-space:nowrap; flex-shrink:0; transition:all .18s; }
    .tk-cat-pill:active { transform:scale(.96); }
    .tk-cat-pill.active { background:var(--primary); border-color:var(--primary); color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(79,70,229,.2); }

    /* ══ PRIORITY + SORT ROW ══ */
    .tk-priority-row { display:flex; align-items:center; gap:8px; padding:0 16px 10px; flex-shrink:0; }
    .tk-prio-group { display:flex; align-items:center; gap:4px; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:22px; padding:4px 10px 4px 8px; }
    .tk-prio-dot { width:18px; height:18px; border-radius:50%; background:var(--dot-color,#999); border:2.5px solid transparent; cursor:pointer; transition:all .18s; flex-shrink:0; }
    .tk-prio-dot.all-prio { width:auto; height:auto; background:transparent; border:none; padding:0 2px; font-size:11.5px; font-weight:700; color:var(--text-3); border-radius:0; }
    .tk-prio-dot.all-prio.active { color:var(--primary); }
    .tk-prio-dot:not(.all-prio).active { transform:scale(1.25); box-shadow:0 0 0 2.5px #fff, 0 0 0 4.5px var(--dot-color); }
    .tk-sort-select { margin-left:auto; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:6px 10px; font-size:12px; color:var(--text-2); cursor:pointer; outline:none; font-weight:500; }
    .tk-toggle-done { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1.5px solid var(--border-color); background:var(--surface-1); border-radius:10px; cursor:pointer; color:var(--text-3); transition:all .15s; flex-shrink:0; }
    .tk-toggle-done.active { border-color:var(--success,#059669); color:var(--success,#059669); background:rgba(5,150,105,.06); }

    /* ══ SCROLLABLE LIST ══ */
    .tk-list { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:0 16px 80px; }

    /* ══ SECTION CARD ══ */
    .tk-section { background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; margin-bottom:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03); animation:tkIn .3s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes tkIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .tk-section-header { display:flex; align-items:center; gap:9px; padding:11px 14px; cursor:pointer; user-select:none; background:transparent; transition:background .15s; }
    .tk-section-header:active { background:var(--surface-2); }
    .tk-section-dot { width:7px; height:7px; border-radius:50%; background:var(--primary); flex-shrink:0; }
    .tk-section-label { flex:1; font-size:12.5px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.5px; }
    .tk-section-count { font-size:12px; font-weight:600; color:var(--text-3); }
    .tk-section-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; }
    .tk-section-badge.urgent { background:rgba(220,38,38,.08); color:var(--danger,#DC2626); }
    .tk-section-badge.overdue { background:rgba(220,38,38,.08); color:var(--danger,#DC2626); }
    .tk-section-tasks { border-top:1px solid var(--border-color); }

    /* ══ TASK ROW ══ */
    .task-bento-row { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-bottom:1px solid var(--border-color); cursor:pointer; transition:background .15s; position:relative; animation:tkRowIn .22s ease both; }
    @keyframes tkRowIn { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
    .task-bento-row:last-child { border-bottom:none; }
    .task-bento-row:active { background:var(--surface-2); }
    .task-bento-row.done { opacity:.48; }
    .task-bento-row.selected { background:var(--primary-soft,rgba(79,70,229,.06)); }
    .task-bento-row.animating-done { animation:tkDone .4s ease forwards; }
    @keyframes tkDone { 0%{opacity:1} 50%{background:rgba(5,150,105,.08);transform:scale(1.005)} 100%{opacity:.48} }

    /* ══ CHECKBOX ══ */
    .task-check-ring { width:21px; height:21px; min-width:21px; border-radius:50%; border:2px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s cubic-bezier(.2,.8,.2,1); flex-shrink:0; margin-top:1px; }
    .task-check-ring.done { background:var(--success,#059669); border-color:var(--success,#059669); }
    .task-check-ring:active:not(.done) { border-color:var(--primary); background:var(--primary-soft,rgba(79,70,229,.08)); transform:scale(.92); }

    /* ══ ROW CONTENT ══ */
    .tk-row-content { flex:1; min-width:0; }
    .tk-row-top { display:flex; align-items:flex-start; gap:7px; }
    .task-title-text { font-size:14px; font-weight:500; line-height:1.4; color:var(--text-1); flex:1; min-width:0; word-break:break-word; }
    .task-title-text.done-text { text-decoration:line-through; color:var(--text-3); }
    .task-title-text.p1-text { font-weight:700; }
    .tk-date-chip { font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; background:var(--surface-2); color:var(--text-3); border:1px solid var(--border-color); white-space:nowrap; flex-shrink:0; line-height:1.6; }
    .tk-date-chip.overdue { background:rgba(220,38,38,.07); color:var(--danger,#DC2626); border-color:rgba(220,38,38,.18); }
    .tk-date-chip.today-chip { background:rgba(79,70,229,.08); color:var(--primary); border-color:rgba(79,70,229,.2); }

    /* ══ META CHIPS ══ */
    .tk-meta-row { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
    .task-meta-chip { display:inline-flex; align-items:center; gap:3px; font-size:10.5px; color:var(--text-3); background:var(--surface-2); padding:2px 7px; border-radius:20px; border:1px solid var(--border-color); white-space:nowrap; }
    .task-meta-chip.done-chip { color:var(--success,#059669); background:rgba(5,150,105,.06); border-color:rgba(5,150,105,.2); }

    /* ══ EXPANDED PANEL (kept for compatibility) ══ */
    .subtask-expand { display:none; }

    /* ══ EMPTY STATE ══ */
    .tk-empty { display:flex; flex-direction:column; align-items:center; padding:52px 24px; text-align:center; }
    .tk-empty-icon { width:60px; height:60px; border-radius:50%; background:rgba(5,150,105,.1); display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:16px; }
    .tk-empty-title { font-size:17px; font-weight:700; color:var(--text-1); margin-bottom:5px; }
    .tk-empty-sub { font-size:13px; color:var(--text-3); line-height:1.5; }

    /* ══ TWO-STEP MODAL ══ */
    .tk-modal-wrap { position:relative; overflow:hidden; }
    .tk-modal-slider { display:flex; transition:transform .32s cubic-bezier(.4,0,.2,1); width:200%; }
    .tk-modal-panel { width:50%; min-width:50%; display:flex; flex-direction:column; gap:0; }
    .tk-modal-header { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
    .tk-modal-title { flex:1; font-size:18px; font-weight:800; color:var(--text-1); letter-spacing:-.4px; }
    .tk-modal-close { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:none; background:var(--surface-2); border-radius:50%; cursor:pointer; color:var(--text-3); font-size:17px; transition:all .15s; }
    .tk-modal-close:active { background:var(--surface-3); }
    .tk-back-pill { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:22px; border:1.5px solid var(--border-color); background:var(--surface-2); font-size:12.5px; font-weight:600; color:var(--text-2); cursor:pointer; transition:all .15s; }
    .tk-back-pill:active { background:var(--surface-3); }

    /* Title input */
    .tk-title-input { width:100%; border:none; outline:none; font-size:19px; font-weight:700; color:var(--text-1); background:transparent; padding:4px 0 14px; border-bottom:2px solid var(--border-color); margin-bottom:20px; letter-spacing:-.3px; transition:border-color .2s; box-sizing:border-box; }
    .tk-title-input:focus { border-bottom-color:var(--primary); }
    .tk-title-input::placeholder { color:var(--text-3); font-weight:400; font-size:17px; }

    /* Priority picker */
    .tk-prio-picker { display:flex; gap:7px; }
    .tk-prio-pick { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 8px; border-radius:12px; border:1.5px solid var(--border-color); background:var(--surface-2); font-size:12.5px; font-weight:600; color:var(--text-3); cursor:pointer; transition:all .18s; }
    .tk-prio-pick:active { transform:scale(.97); }
    .tk-prio-pick.selected { border-color:var(--pick-color,var(--primary)); background:color-mix(in srgb,var(--pick-color,var(--primary)) 10%,transparent); color:var(--pick-color,var(--primary)); font-weight:700; }
    .tk-prio-pick .pk-dot { width:9px; height:9px; border-radius:50%; background:var(--pick-color); flex-shrink:0; }

    /* Field groups */
    .tk-field-section { margin-bottom:14px; }
    .tk-field-label { font-size:10.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.7px; margin-bottom:7px; display:block; }
    .tk-field-row { display:flex; gap:10px; margin-bottom:14px; }
    .tk-field-row .tk-field-section { flex:1; margin-bottom:0; }
    .tk-input { width:100%; box-sizing:border-box; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:11px; padding:10px 13px; font-size:13.5px; color:var(--text-1); outline:none; transition:border-color .2s,box-shadow .2s; }
    .tk-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.1); }
    .tk-select { width:100%; box-sizing:border-box; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:11px; padding:10px 13px; font-size:13.5px; color:var(--text-1); outline:none; cursor:pointer; transition:border-color .2s; }
    .tk-select:focus { border-color:var(--primary); }
    .tk-textarea { width:100%; box-sizing:border-box; background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:11px; padding:10px 13px; font-size:13.5px; color:var(--text-1); outline:none; resize:none; line-height:1.55; transition:border-color .2s,box-shadow .2s; }
    .tk-textarea:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,.1); }

    /* Step 2 sections */
    .tk-modal-section { background:var(--surface-2); border:1.5px solid var(--border-color); border-radius:13px; padding:13px; margin-bottom:12px; }
    .tk-modal-section-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--primary); margin-bottom:10px; display:flex; align-items:center; gap:6px; }
    .tk-modal-subtask-add { width:100%; padding:8px; border:1.5px dashed var(--border-color); border-radius:9px; background:transparent; font-size:12.5px; color:var(--text-3); cursor:pointer; text-align:center; margin-top:8px; transition:all .15s; }
    .tk-modal-subtask-add:hover { border-color:var(--primary); color:var(--primary); background:rgba(79,70,229,.04); }
    .tk-day-picker { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
    .tk-day-label { font-size:12px; display:flex; align-items:center; gap:4px; background:var(--surface-1); padding:5px 10px; border-radius:9px; cursor:pointer; border:1.5px solid var(--border-color); transition:all .15s; }
    .tk-day-label input { display:none; }
    .tk-day-label.checked { background:rgba(79,70,229,.08); border-color:var(--primary); color:var(--primary); font-weight:700; }

    /* Modal Actions */
    .tk-modal-actions { display:flex; align-items:center; gap:10px; padding-top:16px; margin-top:4px; border-top:1px solid var(--border-color); }
    .tk-modal-more { display:inline-flex; align-items:center; gap:5px; padding:10px 18px; border-radius:11px; border:1.5px solid var(--border-color); background:transparent; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; transition:all .18s; }
    .tk-modal-more:hover { border-color:var(--primary); color:var(--primary); background:rgba(79,70,229,.04); }
    .tk-modal-save { flex:1; padding:11px; border-radius:11px; border:none; background:var(--primary); color:#fff; font-size:14px; font-weight:700; cursor:pointer; transition:all .18s; box-shadow:0 2px 8px rgba(79,70,229,.25); letter-spacing:.1px; }
    .tk-modal-save:active { opacity:.88; transform:scale(.98); box-shadow:none; }
    .tk-modal-cancel { padding:11px 18px; border-radius:11px; border:1.5px solid var(--border-color); background:transparent; color:var(--text-2); font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .tk-modal-cancel:active { background:var(--surface-2); }

    /* Step dots */
    .tk-step-dots { display:flex; justify-content:center; gap:5px; margin-bottom:18px; }
    .tk-step-dot { width:6px; height:6px; border-radius:50%; background:var(--border-color); transition:all .22s; }
    .tk-step-dot.active { background:var(--primary); width:20px; border-radius:3px; }

    /* ══ TASK ROW — active state ══ */
    .task-bento-row.sheet-open { background:var(--primary-soft,rgba(79,70,229,.05)); }

    /* ══ BOTTOM SHEET ══ */
    .tk-sheet-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; opacity:0; transition:opacity .3s ease; pointer-events:none; }
    .tk-sheet-overlay.open { opacity:1; pointer-events:all; }
    .tk-sheet { position:fixed; left:0; right:0; bottom:0; z-index:1001; background:var(--surface-1); border-radius:24px 24px 0 0; max-height:90vh; display:flex; flex-direction:column; transform:translateY(100%); transition:transform .38s cubic-bezier(.32,.72,0,1); will-change:transform; box-shadow:0 -8px 40px rgba(0,0,0,.18); }
    .tk-sheet.open { transform:translateY(0); }
    .tk-sheet-handle { width:36px; height:4px; background:var(--border-color); border-radius:2px; margin:12px auto 0; flex-shrink:0; }
    .tk-sheet-prio-bar { height:3px; border-radius:0 0 2px 2px; flex-shrink:0; margin:10px 24px 0; border-radius:3px; }

    /* Sheet header */
    .tk-sheet-header { padding:16px 20px 0; flex-shrink:0; }
    .tk-sheet-title-row { display:flex; align-items:flex-start; gap:14px; margin-bottom:14px; }
    .tk-sheet-check { width:26px; height:26px; min-width:26px; border-radius:50%; border:2px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s cubic-bezier(.2,.8,.2,1); margin-top:3px; flex-shrink:0; }
    .tk-sheet-check.done { background:var(--success,#059669); border-color:var(--success,#059669); }
    .tk-sheet-check:active:not(.done) { transform:scale(.88); border-color:var(--primary); }
    .tk-sheet-title { font-size:20px; font-weight:800; color:var(--text-1); line-height:1.3; flex:1; letter-spacing:-.5px; word-break:break-word; }
    .tk-sheet-title.done { text-decoration:line-through; color:var(--text-3); font-weight:600; }
    .tk-sheet-close { width:32px; height:32px; min-width:32px; border:none; background:var(--surface-2); border-radius:50%; cursor:pointer; color:var(--text-3); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; margin-top:2px; }
    .tk-sheet-close:active { background:var(--surface-3,#E2E8F0); }

    /* Meta chips */
    .tk-sheet-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 20px 16px; flex-shrink:0; }
    .tk-sheet-chip { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:20px; font-size:12px; font-weight:600; background:var(--surface-2); color:var(--text-2); border:1px solid var(--border-color); }
    .tk-sheet-chip.today { background:rgba(79,70,229,.08); color:var(--primary); border-color:rgba(79,70,229,.2); }
    .tk-sheet-chip.overdue { background:rgba(220,38,38,.07); color:#DC2626; border-color:rgba(220,38,38,.18); }
    .tk-sheet-chip.p1 { background:rgba(220,38,38,.07); color:#DC2626; border-color:rgba(220,38,38,.18); }
    .tk-sheet-chip.p2 { background:rgba(217,119,6,.07); color:#D97706; border-color:rgba(217,119,6,.18); }
    .tk-sheet-chip.p3 { background:rgba(5,150,105,.07); color:#059669; border-color:rgba(5,150,105,.18); }

    /* Scrollable body */
    .tk-sheet-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:0 20px 8px; }
    .tk-sheet-divider { height:1px; background:var(--border-color); margin:0 -20px 16px; }

    /* Description */
    .tk-sheet-desc { font-size:14.5px; color:var(--text-2); line-height:1.7; margin-bottom:20px; }

    /* Section label */
    .tk-sheet-sec-label { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--text-3); margin-bottom:10px; display:flex; align-items:center; gap:7px; }

    /* Subtasks */
    .tk-sheet-subtask-list { background:var(--surface-2); border-radius:14px; overflow:hidden; margin-bottom:8px; }
    .tk-sheet-sub-item { display:flex; align-items:center; gap:12px; padding:11px 14px; border-bottom:1px solid var(--border-color); transition:background .15s; }
    .tk-sheet-sub-item:last-child { border-bottom:none; }
    .tk-sheet-sub-item:active { background:var(--surface-3,#E2E8F0); }
    .tk-sheet-sub-check { width:20px; height:20px; min-width:20px; border-radius:50%; border:2px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; flex-shrink:0; }
    .tk-sheet-sub-check.done { background:var(--success,#059669); border-color:var(--success,#059669); }
    .tk-sheet-sub-text { flex:1; font-size:14px; color:var(--text-1); line-height:1.4; }
    .tk-sheet-sub-text.done { text-decoration:line-through; color:var(--text-3); }
    .tk-sheet-sub-del { border:none; background:none; cursor:pointer; opacity:.3; padding:4px; display:flex; align-items:center; }
    .tk-sheet-sub-add { display:flex; align-items:center; gap:12px; padding:10px 14px; background:var(--surface-2); border-radius:14px; margin-bottom:20px; border:1.5px dashed var(--border-color); transition:border-color .2s; }
    .tk-sheet-sub-add:focus-within { border-color:var(--primary); }
    .tk-sheet-sub-add-input { flex:1; border:none; background:transparent; outline:none; font-size:14px; color:var(--text-1); }
    .tk-sheet-sub-add-input::placeholder { color:var(--text-3); }

    /* Action bar */
    .tk-sheet-actions { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; padding:14px 20px; padding-bottom:calc(14px + env(safe-area-inset-bottom,0px)); border-top:1px solid var(--border-color); flex-shrink:0; background:var(--surface-1); }
    .tk-sheet-act { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px 6px; border-radius:14px; border:1.5px solid var(--border-color); background:var(--surface-2); cursor:pointer; font-size:11.5px; font-weight:600; color:var(--text-2); transition:all .18s; }
    .tk-sheet-act:active { transform:scale(.94); }
    .tk-sheet-act i { pointer-events:none; }
    .tk-sheet-act.primary { border-color:rgba(79,70,229,.2); background:rgba(79,70,229,.06); color:var(--primary); }
    .tk-sheet-act.success { border-color:rgba(5,150,105,.2); background:rgba(5,150,105,.06); color:var(--success,#059669); }
    .tk-sheet-act.danger { border-color:rgba(220,38,38,.2); background:rgba(220,38,38,.05); color:#DC2626; }

    @media(max-width:480px) {
      .tk-shell { height:calc(100vh - env(safe-area-inset-top,44px) - 80px); }
    }
  </style>

  <div class="tk-shell">

    <!-- Header -->
    <div class="tk-header">
      <div class="tk-header-left">
        <span class="tk-header-title">Tasks</span>
        <span class="tk-count-badge">${totalPending}</span>
        ${pctDone > 0 ? `<span class="tk-pct-badge">${pctDone}%</span>` : ''}
      </div>
      <div class="tk-header-right">
        <button class="tk-icon-btn ${_itemSelectionMode ? 'active' : ''}" onclick="toggleTaskSelectionMode()" title="Select mode">
          <i data-lucide="list-checks" style="width:18px;height:18px"></i>
        </button>
        <button class="tk-icon-btn" onclick="openCategoryManager()" title="Categories">
          <i data-lucide="tag" style="width:18px;height:18px"></i>
        </button>
        <button class="tk-add-btn" onclick="openTaskModal()">
          <i data-lucide="plus" style="width:15px;height:15px"></i>
          <span>Add</span>
        </button>
      </div>
    </div>

    ${_itemSelectionMode ? `
    <div style="display:flex;align-items:center;gap:8px;padding:0 16px 10px;flex-shrink:0;background:rgba(79,70,229,.04);border-bottom:1px solid var(--border-color);padding-top:10px;">
      <span style="font-size:13px;font-weight:600;color:var(--primary);flex:1;">${_selectedTaskIds.size} selected</span>
      <button class="tk-action-btn danger" onclick="deleteSelectedTasks()">
        <i data-lucide="trash-2" style="width:13px;height:13px"></i> Delete
      </button>
      <button class="tk-action-btn" onclick="toggleTaskSelectionMode()">Cancel</button>
    </div>` : ''}

    <!-- Quick Capture -->
    <div class="tk-capture-wrap">
      <div class="tk-capture">
        <div class="tk-capture-icon">
          <i data-lucide="zap" style="width:15px;height:15px"></i>
        </div>
        <input class="tk-capture-input" id="tkCaptureInput"
               placeholder="Capture a task… press Enter to save"
               onkeydown="tkQuickCapture(event)" />
        <div class="tk-capture-divider"></div>
        <select class="tk-capture-cat" id="tkCaptureCat">
          <option value="">No category</option>
          ${allCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Category Pills -->
    <div class="tk-filter-row">
      ${['All', ...allCats].map(c => `
        <button class="tk-cat-pill ${_taskCategory === c ? 'active' : ''}"
                data-cat="${c}" onclick="tkSetCat('${c}')">${escapeHtml(c)}</button>
      `).join('')}
    </div>

    <!-- Priority + Sort Row -->
    <div class="tk-priority-row">
      <div class="tk-prio-group">
        <button class="tk-prio-dot all-prio ${_taskPriorityFilter === 'All' ? 'active' : ''}"
                data-prio="All" onclick="tkSetPrio('All')">All</button>
        ${['P1','P2','P3'].map(p => `
          <button class="tk-prio-dot ${_taskPriorityFilter === p ? 'active' : ''}"
                  data-prio="${p}"
                  style="--dot-color:${PRIORITY_COLOR[p]}"
                  onclick="tkSetPrio('${p}')"
                  title="${PRIORITY_LABEL[p]}"></button>
        `).join('')}
      </div>
      <select class="tk-sort-select" onchange="_taskSort=this.value;renderTasks()">
        <option value="priority" ${_taskSort==='priority'?'selected':''}>↑ Priority</option>
        <option value="date"     ${_taskSort==='date'?'selected':''}>📅 Due Date</option>
        <option value="category" ${_taskSort==='category'?'selected':''}>🏷 Category</option>
        <option value="title"    ${_taskSort==='title'?'selected':''}>A–Z</option>
      </select>
      <button class="tk-toggle-done ${_showCompletedTasks?'active':''}"
              onclick="_showCompletedTasks=!_showCompletedTasks;renderTasks()"
              title="Toggle completed">
        <i data-lucide="check-circle-2" style="width:15px;height:15px"></i>
      </button>
    </div>

    <!-- Scrollable List -->
    <div class="tk-list">

      ${recurringToday.length > 0 ? tkSectionHTML('__recurring_today__', 'Recurring Today', recurringToday, true) : ''}

      ${pending.length === 0 && recurringToday.length === 0 ? `
        <div class="tk-empty">
          <div class="tk-empty-icon">✓</div>
          <div class="tk-empty-title">All clear!</div>
          <div class="tk-empty-sub">No pending tasks. Use quick capture above to add one.</div>
        </div>
      ` : Object.keys(pendingByCat).sort().map((cat, idx) =>
          tkSectionHTML(cat, cat, pendingByCat[cat], false, true, false, idx)
        ).join('')}

      ${_showCompletedTasks && completed.length > 0 ? tkSectionHTML('__completed__', `Completed (${completed.length})`, completed, false) : ''}

      ${recurringOther.length > 0 ? tkSectionHTML('__recurring_other__', 'Other Recurring', recurringOther, true, false, true) : ''}

      <div style="height:80px"></div>
    </div>
  </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  _attachTaskSwipes();
}

/* ══════════════════════════════════════════════════════
   SECTION RENDERER
══════════════════════════════════════════════════════ */
function tkSectionHTML(key, label, tasks, isRecurring = false, hideCategory = false, dimmed = false, idx = 0) {
  const isCollapsed = _collapsedCategories.has(key);
  const count = tasks.length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueInGroup = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length;
  const p1InGroup = tasks.filter(t => t.priority === 'P1').length;

  const sectionColors = {
    '__todays_three__': 'var(--danger,#EF4444)',
    '__recurring_today__': 'var(--primary)',
    '__completed__': 'var(--success,#10B981)',
    '__recurring_other__': 'var(--text-muted)',
  };
  const dotColor = sectionColors[key] || 'var(--primary)';

  return `
  <div class="tk-section" style="${dimmed ? 'opacity:0.65;' : ''}animation-delay:${idx * 0.04}s">
    <div class="tk-section-header" onclick="toggleCategoryCollapse('${key}')">
      <div class="tk-section-dot" style="background:${dotColor}"></div>
      <span class="tk-section-label">${label}</span>
      ${p1InGroup > 0 ? `<span class="tk-section-badge urgent">${p1InGroup} urgent</span>` : ''}
      ${overdueInGroup > 0 ? `<span class="tk-section-badge overdue">${overdueInGroup} late</span>` : ''}
      <span class="tk-section-count">${count}</span>
      <i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--text-3);opacity:.6;flex-shrink:0;transition:transform .22s;${isCollapsed ? '' : 'transform:rotate(90deg)'}"></i>
    </div>
    ${!isCollapsed ? `<div class="tk-section-tasks">${tasks.map(t => tkTaskRowHTML(t, isRecurring)).join('')}</div>` : ''}
  </div>`;
}

/* ══════════════════════════════════════════════════════
   TASK ROW RENDERER — clean by default, actions on expand
══════════════════════════════════════════════════════ */
function tkTaskRowHTML(t, isRecurring = false) {
  // Keep original function name alias for _reRenderTaskRow / _attachTaskSwipes compatibility
  return renderBentoTaskRow(t, isRecurring);
}

function renderBentoTaskRow(t, isRecurring = false) {
  const isDone = isRecurring ? isRecurringTaskCompletedToday(t) : t.status === 'completed';
  const selected = _selectedTaskIds.has(String(t.id));
  const isExpanded = _expandedTaskIds.has(String(t.id));
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = t.due_date && t.due_date < today && !isDone;
  const pHex  = { P1: '#DC2626', P2: '#D97706', P3: '#059669' }[t.priority] || '#94A3B8';
  const pColor = pHex;
  const subtasks = parseSubtasks(t);
  const doneSubCount = subtasks.filter(s => s.done).length;

  // Friendly date
  let dateLabel = '';
  let dateChipClass = 'tk-date-chip';
  if (t.due_date) {
    const diff = Math.round((new Date(t.due_date) - new Date(today)) / 86400000);
    if (diff === 0)      { dateLabel = 'Today';              dateChipClass += ' today-chip'; }
    else if (diff === 1) { dateLabel = 'Tomorrow'; }
    else if (diff === -1){ dateLabel = 'Yesterday';          if (isOverdue) dateChipClass += ' overdue'; }
    else if (diff < 0)   { dateLabel = `${Math.abs(diff)}d ago`; if (isOverdue) dateChipClass += ' overdue'; }
    else if (diff < 7)   { dateLabel = `in ${diff}d`; }
    else                 { dateLabel = new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
  }

  const recurLabel = { daily:'Daily', weekly:'Weekly', monthly:'Monthly' }[t.recurrence] || '';
  // Priority left-accent strip
  const accentStyle = !isDone && t.priority
    ? `border-left:3px solid ${pColor};`
    : 'border-left:3px solid transparent;';
  // Subtle row tint for P1
  const rowTint = !isDone && t.priority === 'P1' ? 'background:rgba(220,38,38,.025);' : '';

  return `
  <div class="task-bento-row ${isDone ? 'done' : ''} ${selected ? 'selected' : ''} ${isExpanded ? 'sheet-open' : ''}"
       id="task-row-${t.id}"
       style="${accentStyle}${rowTint}"
       onclick="${_itemSelectionMode ? `toggleTaskSelection('${t.id}')` : `toggleTaskDetails('${t.id}')`}">

    <!-- Checkbox -->
    <div class="task-check-ring ${isDone ? 'done' : ''}"
         style="${!isDone && t.priority ? `border-color:${pColor}55;` : ''}"
         onclick="event.stopPropagation(); ${_itemSelectionMode
           ? `toggleTaskSelection('${t.id}')`
           : isRecurring
             ? `toggleRecurringTask('${t.id}',${!isDone})`
             : `toggleTaskOptimistic('${t.id}')`}">
      ${isDone || (_itemSelectionMode && selected)
        ? `<i data-lucide="check" style="width:10px;height:10px;color:white;stroke-width:3"></i>`
        : ''}
    </div>

    <!-- Content -->
    <div class="tk-row-content">
      <div class="tk-row-top">
        <span class="task-title-text ${isDone ? 'done-text' : ''} ${t.priority === 'P1' && !isDone ? 'p1-text' : ''}">
          ${escapeHtml(t.title || '')}
        </span>
        ${dateLabel ? `<span class="${dateChipClass}">${dateLabel}</span>` : ''}
      </div>
      <div class="tk-meta-row">
        ${subtasks.length > 0 ? `
        <span class="task-meta-chip ${doneSubCount === subtasks.length && subtasks.length > 0 ? 'done-chip' : ''}">
          <i data-lucide="${doneSubCount === subtasks.length ? 'check-circle-2' : 'list-checks'}" style="width:9px;height:9px"></i>
          ${doneSubCount}/${subtasks.length}
        </span>` : ''}
        ${recurLabel ? `<span class="task-meta-chip"><i data-lucide="repeat-2" style="width:9px;height:9px"></i> ${recurLabel}</span>` : ''}
        ${t.pomodoro_estimate > 0 ? `<span class="task-meta-chip" style="color:var(--primary)"><i data-lucide="timer" style="width:9px;height:9px"></i> ${t.pomodoro_estimate}×🍅</span>` : ''}
        ${t.category && _taskCategory === 'All' ? `<span class="task-meta-chip">${escapeHtml(t.category)}</span>` : ''}
      </div>
    </div>

    <!-- Chevron -->
    <i data-lucide="chevron-right" style="width:15px;height:15px;color:var(--text-3);opacity:.4;flex-shrink:0;margin-top:2px;"></i>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   TASK DETAIL BOTTOM SHEET
══════════════════════════════════════════════════════ */
let _sheetTaskId = null;

function _tkSheetHTML(t) {
  const isRecurring = !!(t.recurrence && t.recurrence !== 'none');
  const isDone = isRecurring ? isRecurringTaskCompletedToday(t) : t.status === 'completed';
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = t.due_date && t.due_date < today && !isDone;
  const pHex = { P1: '#DC2626', P2: '#D97706', P3: '#059669' }[t.priority] || '#94A3B8';
  const subtasks = parseSubtasks(t);
  const doneSubCount = subtasks.filter(s => s.done).length;

  // Date label
  let dateLabel = '', dateClass = '';
  if (t.due_date) {
    const diff = Math.round((new Date(t.due_date) - new Date(today)) / 86400000);
    if (diff === 0)      { dateLabel = 'Today';               dateClass = 'today'; }
    else if (diff === 1) { dateLabel = 'Tomorrow'; }
    else if (diff === -1){ dateLabel = 'Yesterday';            if (isOverdue) dateClass = 'overdue'; }
    else if (diff < 0)   { dateLabel = `${Math.abs(diff)}d overdue`; if (isOverdue) dateClass = 'overdue'; }
    else if (diff < 7)   { dateLabel = `in ${diff} days`; }
    else { dateLabel = new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }); }
  }

  const prioLabel = { P1: 'High Priority', P2: 'Medium Priority', P3: 'Low Priority' }[t.priority] || '';
  const prioClass = { P1: 'p1', P2: 'p2', P3: 'p3' }[t.priority] || '';
  const recurLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[t.recurrence] || '';

  return `
  <div class="tk-sheet-handle"></div>
  <div class="tk-sheet-prio-bar" style="background:${pHex}"></div>

  <div class="tk-sheet-header">
    <div class="tk-sheet-title-row">
      <div class="tk-sheet-check ${isDone ? 'done' : ''}" id="tkSheetCheck"
           style="${!isDone ? `border-color:${pHex}66` : ''}"
           onclick="${isRecurring ? `toggleRecurringTask('${t.id}',${!isDone})` : `toggleTaskOptimistic('${t.id}')`};_tkRefreshSheetRow('${t.id}')">
        ${isDone ? `<i data-lucide="check" style="width:11px;height:11px;color:#fff;stroke-width:3"></i>` : ''}
      </div>
      <div class="tk-sheet-title ${isDone ? 'done' : ''}">${escapeHtml(t.title || '')}</div>
      <button class="tk-sheet-close" onclick="closeTaskSheet()">
        <i data-lucide="x" style="width:14px;height:14px"></i>
      </button>
    </div>
  </div>

  <div class="tk-sheet-chips">
    ${dateLabel ? `<span class="tk-sheet-chip ${dateClass}"><i data-lucide="calendar" style="width:11px;height:11px"></i> ${dateLabel}</span>` : ''}
    ${prioLabel ? `<span class="tk-sheet-chip ${prioClass}"><i data-lucide="flag" style="width:11px;height:11px"></i> ${prioLabel}</span>` : ''}
    ${t.category ? `<span class="tk-sheet-chip"><i data-lucide="tag" style="width:11px;height:11px"></i> ${escapeHtml(t.category)}</span>` : ''}
    ${recurLabel ? `<span class="tk-sheet-chip"><i data-lucide="repeat-2" style="width:11px;height:11px"></i> ${recurLabel}</span>` : ''}
    ${t.due_time ? `<span class="tk-sheet-chip"><i data-lucide="clock" style="width:11px;height:11px"></i> ${t.due_time}</span>` : ''}
    ${t.pomodoro_estimate > 0 ? `<span class="tk-sheet-chip p2"><i data-lucide="timer" style="width:11px;height:11px"></i> ${t.pomodoro_estimate} sessions</span>` : ''}
  </div>

  <div class="tk-sheet-body">
    ${t.description ? `
    <div class="tk-sheet-sec-label"><i data-lucide="align-left" style="width:12px;height:12px"></i> Notes</div>
    <div class="tk-sheet-desc">${escapeHtml(t.description)}</div>` : ''}

    <div class="tk-sheet-sec-label"><i data-lucide="list-checks" style="width:12px;height:12px"></i> Subtasks
      ${subtasks.length > 0 ? `<span style="margin-left:auto;font-size:11px;font-weight:700;color:var(--success,#059669)">${doneSubCount}/${subtasks.length}</span>` : ''}
    </div>

    ${subtasks.length > 0 ? `
    <div class="tk-sheet-subtask-list">
      ${subtasks.map((s, idx) => `
      <div class="tk-sheet-sub-item">
        <div class="tk-sheet-sub-check ${s.done ? 'done' : ''}"
             onclick="toggleSubtask('${t.id}',${idx},${!s.done});_tkRefreshSheetRow('${t.id}')">
          ${s.done ? `<i data-lucide="check" style="width:9px;height:9px;color:#fff;stroke-width:3"></i>` : ''}
        </div>
        <span class="tk-sheet-sub-text ${s.done ? 'done' : ''}">${escapeHtml(s.text)}</span>
        <button class="tk-sheet-sub-del" onclick="deleteSubtask('${t.id}',${idx});_tkRefreshSheetRow('${t.id}')">
          <i data-lucide="x" style="width:13px;height:13px"></i>
        </button>
      </div>`).join('')}
    </div>` : ''}

    <div class="tk-sheet-sub-add">
      <div style="width:20px;height:20px;min-width:20px;border-radius:50%;border:2px dashed var(--border-color);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i data-lucide="plus" style="width:10px;height:10px;color:var(--text-3)"></i>
      </div>
      <input class="tk-sheet-sub-add-input" id="tkSheetSubInput"
             placeholder="Add a subtask…"
             onkeydown="if(event.key==='Enter'&&this.value.trim()){addInlineSubtask('${t.id}',this.value);this.value='';_tkRefreshSheetRow('${t.id}')}">
    </div>
  </div>

  <div class="tk-sheet-actions">
    <button class="tk-sheet-act primary" onclick="closeTaskSheet();openEditTask('${t.id}')">
      <i data-lucide="pencil" style="width:18px;height:18px"></i>
      Edit
    </button>
    <button class="tk-sheet-act ${t.pomodoro_estimate > 0 ? 'success' : ''}" onclick="closeTaskSheet();quickStartPomodoro('task','${t.id}')">
      <i data-lucide="timer" style="width:18px;height:18px"></i>
      Focus
    </button>
    <button class="tk-sheet-act" onclick="closeTaskSheet();addReminderToTask('${t.id}')">
      <i data-lucide="bell" style="width:18px;height:18px"></i>
      Remind
    </button>
    <button class="tk-sheet-act danger" onclick="closeTaskSheet();deleteTask('${t.id}')">
      <i data-lucide="trash-2" style="width:18px;height:18px"></i>
      Delete
    </button>
  </div>`;
}

window._tkRefreshSheetRow = function(id) {
  // Re-render the task row in the list
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (t) {
    const row = document.getElementById(`task-row-${id}`);
    if (row) {
      const isRec = !!(t.recurrence && t.recurrence !== 'none');
      row.outerHTML = renderBentoTaskRow(t, isRec);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    // Refresh sheet content in-place
    const sheet = document.getElementById('tkSheet');
    if (sheet && _sheetTaskId === String(id)) {
      sheet.innerHTML = _tkSheetHTML(t);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
};

window.openTaskSheet = function(id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;

  _sheetTaskId = String(id);
  _expandedTaskIds.add(String(id));

  // Inject overlay + sheet if not present
  let overlay = document.getElementById('tkSheetOverlay');
  let sheet = document.getElementById('tkSheet');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tkSheetOverlay';
    overlay.className = 'tk-sheet-overlay';
    overlay.onclick = closeTaskSheet;
    document.body.appendChild(overlay);
  }
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'tkSheet';
    sheet.className = 'tk-sheet';
    document.body.appendChild(sheet);
  }

  sheet.innerHTML = _tkSheetHTML(t);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Highlight the row
  const row = document.getElementById(`task-row-${id}`);
  if (row) row.classList.add('sheet-open');

  // Trigger animation next frame
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    sheet.classList.add('open');
  });

  // Swipe-down to close
  let startY = 0;
  sheet.ontouchstart = e => { startY = e.touches[0].clientY; };
  sheet.ontouchmove = e => { if (e.touches[0].clientY - startY > 80) closeTaskSheet(); };
};

window.closeTaskSheet = function() {
  const overlay = document.getElementById('tkSheetOverlay');
  const sheet = document.getElementById('tkSheet');
  if (!sheet) return;

  overlay?.classList.remove('open');
  sheet.classList.remove('open');

  // Remove row highlight
  if (_sheetTaskId) {
    const row = document.getElementById(`task-row-${_sheetTaskId}`);
    if (row) row.classList.remove('sheet-open');
    _expandedTaskIds.delete(_sheetTaskId);
    _sheetTaskId = null;
  }

  setTimeout(() => {
    overlay?.remove();
    sheet?.remove();
  }, 380);
};

/* ── Toggle task row (opens sheet) ── */
window.toggleTaskDetails = function(id) {
  if (_sheetTaskId === String(id)) {
    closeTaskSheet();
  } else {
    openTaskSheet(id);
  }
};

/* ── Subtask Operations ── */
function _reRenderTaskRow(taskId) {
  const t = state.data.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return renderTasks(_getSearchValue());
  const row = document.getElementById(`task-row-${taskId}`);
  if (!row) return renderTasks(_getSearchValue());
  const isRecurring = !!(t.recurrence && t.recurrence !== 'none');
  row.outerHTML = renderBentoTaskRow(t, isRecurring);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  // Refresh sheet if open for this task
  const sheet = document.getElementById('tkSheet');
  if (sheet && _sheetTaskId === String(taskId)) {
    sheet.innerHTML = _tkSheetHTML(t);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
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

/* ── Selection & Batch Delete ── */
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

/* ── Attach Swipes ── */
function _attachTaskSwipes() {
  if (typeof window.addSwipeAction !== 'function') return;
  document.querySelectorAll('.task-bento-row').forEach(row => {
    const taskId = row.id.replace('task-row-', '');
    window.addSwipeAction(row,
      () => { window.deleteTask(taskId); },
      () => { window.toggleTaskOptimistic(taskId); }
    );
  });
}

/* ── Toggle Task Status ── */
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
  if (typeof window.triggerHapticBuzz === 'function') window.triggerHapticBuzz();
  const row = document.getElementById(`task-row-${id}`);
  if (newStatus === 'completed' && row) {
    row.classList.add('animating-done');
    await new Promise(r => setTimeout(r, 400));
  }
  t.status = newStatus;
  _reRenderTaskRow(id);
  try {
    await apiCall('update', 'tasks', { status: newStatus }, id);
    if (newStatus === 'completed') showToast('Task completed! ✓');
  } catch (e) {
    t.status = newStatus === 'completed' ? 'pending' : 'completed';
    _reRenderTaskRow(id);
    showToast('Error updating task');
  }
};

/* ══════════════════════════════════════════════════════
   TWO-STEP MODAL — NEW TASK
══════════════════════════════════════════════════════ */

// Internal state for modal priority selection
let _modalPriority = 'P2';

window.tkPickPriority = function(p) {
  _modalPriority = p;
  // Update hidden select (read by main.js)
  const sel = document.getElementById('mTaskPriority');
  if (sel) sel.value = p;
  // Update visual buttons
  document.querySelectorAll('.tk-prio-pick').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.p === p);
  });
};

window.tkModalGoStep2 = function() {
  const slider = document.getElementById('tkModalSlider');
  if (slider) { slider.style.transform = 'translateX(-50%)'; }
  // Update step dots
  document.querySelectorAll('.tk-step-dot').forEach((d, i) => d.classList.toggle('active', i === 1));
};

window.tkModalGoStep1 = function() {
  const slider = document.getElementById('tkModalSlider');
  if (slider) { slider.style.transform = 'translateX(0)'; }
  document.querySelectorAll('.tk-step-dot').forEach((d, i) => d.classList.toggle('active', i === 0));
};

window.openTaskModal = function () {
  _modalPriority = 'P2';
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const categories = getAllTaskCategories();

  box.innerHTML = `
  <div class="tk-modal-wrap">
    <!-- Step indicator -->
    <div class="tk-step-dots">
      <div class="tk-step-dot active"></div>
      <div class="tk-step-dot"></div>
    </div>

    <div class="tk-modal-slider" id="tkModalSlider">

      <!-- ═══ PANEL 1: Quick Capture ═══ -->
      <div class="tk-modal-panel">
        <div class="tk-modal-header">
          <span class="tk-modal-title">New Task</span>
          <button class="tk-modal-close" onclick="document.getElementById('universalModal').classList.add('hidden')">✕</button>
        </div>

        <input class="tk-title-input" id="mTaskTitle" placeholder="What needs to be done?" autofocus>

        <!-- Priority -->
        <div class="tk-field-section">
          <span class="tk-field-label">Priority</span>
          <div class="tk-prio-picker">
            <button class="tk-prio-pick" data-p="P1" style="--pick-color:#EF4444" onclick="tkPickPriority('P1')">
              <span class="pk-dot" style="background:#EF4444"></span> High
            </button>
            <button class="tk-prio-pick selected" data-p="P2" style="--pick-color:#F59E0B" onclick="tkPickPriority('P2')">
              <span class="pk-dot" style="background:#F59E0B"></span> Medium
            </button>
            <button class="tk-prio-pick" data-p="P3" style="--pick-color:#10B981" onclick="tkPickPriority('P3')">
              <span class="pk-dot" style="background:#10B981"></span> Low
            </button>
          </div>
          <!-- Hidden select read by main.js -->
          <select id="mTaskPriority" style="display:none;">
            <option value="P1">P1</option>
            <option value="P2" selected>P2</option>
            <option value="P3">P3</option>
          </select>
        </div>

        <!-- Date + Category -->
        <div class="tk-field-row">
          <div class="tk-field-section">
            <span class="tk-field-label">Due Date</span>
            <input type="date" class="tk-input" id="mTaskDate" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="tk-field-section">
            <span class="tk-field-label">Category</span>
            <select class="tk-select" id="mTaskCategory">
              <option value="">None</option>
              ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="tk-modal-actions">
          <button class="tk-modal-more" onclick="tkModalGoStep2()">
            More <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
          </button>
          <button class="tk-modal-save" data-action="save-task-modal">Save Task</button>
        </div>
      </div>

      <!-- ═══ PANEL 2: Details ═══ -->
      <div class="tk-modal-panel" style="padding-left:20px;">
        <div class="tk-modal-header">
          <button class="tk-back-pill" onclick="tkModalGoStep1()">
            <i data-lucide="arrow-left" style="width:13px;height:13px"></i> Back
          </button>
          <span class="tk-modal-title">Details</span>
          <button class="tk-modal-close" onclick="document.getElementById('universalModal').classList.add('hidden')">✕</button>
        </div>

        <textarea class="tk-textarea" id="mTaskDesc" placeholder="Description..." rows="2"></textarea>

        <!-- Tags + Time row -->
        <div class="tk-field-row" style="margin-top:12px;">
          <div class="tk-field-section">
            <span class="tk-field-label">Time</span>
            <input type="time" class="tk-input" id="mTaskTime">
          </div>
          <div class="tk-field-section">
            <span class="tk-field-label">Tags</span>
            <input type="text" class="tk-input" id="mTaskTags" placeholder="tag1, tag2">
          </div>
        </div>

        <!-- Subtasks -->
        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="list-checks" style="width:13px;height:13px"></i> Subtasks
          </div>
          <div id="mSubtaskList"></div>
          <button class="tk-modal-subtask-add" onclick="addSubtaskInput()">+ Add subtask</button>
        </div>

        <!-- Duration + Pomodoro -->
        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="timer" style="width:13px;height:13px"></i> Time Estimate
          </div>
          <div class="tk-field-row" style="margin-bottom:0;">
            <div class="tk-field-section">
              <span class="tk-field-label">Duration (min)</span>
              <input type="number" class="tk-input" id="mTaskDuration" value="30" min="5" step="5">
            </div>
            <div class="tk-field-section">
              <span class="tk-field-label">🍅 Sessions</span>
              <input type="number" class="tk-input" id="mTaskPomoEstimate" value="0" min="0">
            </div>
            <div class="tk-field-section">
              <span class="tk-field-label">Session (min)</span>
              <input type="number" class="tk-input" id="mTaskPomoLength" value="25" min="5" step="5">
            </div>
          </div>
        </div>

        <!-- Vision Link -->
        <div class="tk-field-section">
          <span class="tk-field-label">Link to Vision Goal</span>
          <select class="tk-select" id="mTaskVisionGoal">
            <option value="">None</option>
            ${(state.data.vision || []).filter(g => g.status !== 'achieved').map(g =>
              `<option value="${g.id}">${escapeHtml(g.title || g.goal_name || '')}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Recurrence -->
        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="repeat-2" style="width:13px;height:13px"></i> Recurrence
          </div>
          <select class="tk-select" id="mTaskRecurrence" onchange="taskRecurrenceChanged()">
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <div id="taskDayPickerWrap" style="display:none;margin-top:10px;">
            <div class="tk-day-picker">
              ${TASK_DAY_NAMES.map(d => `
                <label class="tk-day-label">
                  <input type="checkbox" value="${d}" class="task-day-check"> ${d}
                </label>`).join('')}
            </div>
          </div>
          <div id="taskEndDateWrap" style="display:none;margin-top:10px;">
            <span class="tk-field-label">End Date</span>
            <input type="date" class="tk-input" id="mTaskRecurrenceEnd" style="margin-top:6px;">
          </div>
        </div>

        <div class="tk-modal-actions">
          <button class="tk-modal-cancel" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="tk-modal-save" data-action="save-task-modal">Save Task</button>
        </div>
      </div>

    </div><!-- /slider -->
  </div>`;

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/* ── Subtask input helper (used by both modals) ── */
window.addSubtaskInput = function (value = '', done = false) {
  const list = document.getElementById('mSubtaskList');
  if (!list) return;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
  div.innerHTML = `
    <input type="checkbox" class="subtask-check" ${done ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;flex-shrink:0;">
    <input type="text" class="subtask-text tk-input" value="${escapeHtml(value)}" placeholder="Step…" style="margin:0;flex:1;padding:6px 10px;">
    <button style="border:none;background:none;cursor:pointer;opacity:.4;padding:4px;" onclick="this.parentElement.remove()">
      <i data-lucide="x" style="width:13px;height:13px"></i>
    </button>`;
  list.appendChild(div);
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.taskRecurrenceChanged = function () {
  const val = document.getElementById('mTaskRecurrence')?.value;
  const dayWrap = document.getElementById('taskDayPickerWrap');
  const endWrap = document.getElementById('taskEndDateWrap');
  if (dayWrap) dayWrap.style.display = val === 'weekly' ? 'block' : 'none';
  if (endWrap) endWrap.style.display = val !== 'none' ? 'block' : 'none';
};

/* ══════════════════════════════════════════════════════
   TWO-STEP MODAL — EDIT TASK
══════════════════════════════════════════════════════ */
window.openEditTask = function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  _modalPriority = t.priority || 'P2';

  const categories = getAllTaskCategories();
  const isWeekly = t.recurrence === 'weekly';
  const isRecurring = t.recurrence && t.recurrence !== 'none';
  const selectedDays = t.recurrence_days ? t.recurrence_days.split(',').map(s => s.trim()) : [];
  let subtasks = [];
  try { if (t.subtasks) subtasks = typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : t.subtasks; } catch {}

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  box.innerHTML = `
  <div class="tk-modal-wrap">
    <div class="tk-step-dots">
      <div class="tk-step-dot active"></div>
      <div class="tk-step-dot"></div>
    </div>

    <div class="tk-modal-slider" id="tkModalSlider">

      <!-- ═══ PANEL 1 ═══ -->
      <div class="tk-modal-panel">
        <div class="tk-modal-header">
          <span class="tk-modal-title">Edit Task</span>
          <button class="tk-modal-close" onclick="document.getElementById('universalModal').classList.add('hidden')">✕</button>
        </div>

        <input class="tk-title-input" id="mTaskTitle"
               value="${escapeHtml(t.title || '')}" placeholder="Task title">

        <!-- Priority -->
        <div class="tk-field-section">
          <span class="tk-field-label">Priority</span>
          <div class="tk-prio-picker">
            <button class="tk-prio-pick ${t.priority==='P1'?'selected':''}" data-p="P1" style="--pick-color:#EF4444" onclick="tkPickPriority('P1')">
              <span class="pk-dot" style="background:#EF4444"></span> High
            </button>
            <button class="tk-prio-pick ${(!t.priority||t.priority==='P2')?'selected':''}" data-p="P2" style="--pick-color:#F59E0B" onclick="tkPickPriority('P2')">
              <span class="pk-dot" style="background:#F59E0B"></span> Medium
            </button>
            <button class="tk-prio-pick ${t.priority==='P3'?'selected':''}" data-p="P3" style="--pick-color:#10B981" onclick="tkPickPriority('P3')">
              <span class="pk-dot" style="background:#10B981"></span> Low
            </button>
          </div>
          <select id="mTaskPriority" style="display:none;">
            <option value="P1" ${t.priority==='P1'?'selected':''}>P1</option>
            <option value="P2" ${(!t.priority||t.priority==='P2')?'selected':''}>P2</option>
            <option value="P3" ${t.priority==='P3'?'selected':''}>P3</option>
          </select>
        </div>

        <div class="tk-field-row">
          <div class="tk-field-section">
            <span class="tk-field-label">Due Date</span>
            <input type="date" class="tk-input" id="mTaskDate" value="${t.due_date || ''}">
          </div>
          <div class="tk-field-section">
            <span class="tk-field-label">Category</span>
            <select class="tk-select" id="mTaskCategory">
              <option value="">None</option>
              ${categories.map(c => `<option value="${escapeHtml(c)}" ${t.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="tk-modal-actions">
          <button class="tk-modal-more" onclick="tkModalGoStep2()">
            More <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
          </button>
          <button class="tk-modal-save" data-action="update-task-modal" data-edit-id="${t.id}">Update</button>
        </div>
      </div>

      <!-- ═══ PANEL 2 ═══ -->
      <div class="tk-modal-panel" style="padding-left:20px;">
        <div class="tk-modal-header">
          <button class="tk-back-pill" onclick="tkModalGoStep1()">
            <i data-lucide="arrow-left" style="width:13px;height:13px"></i> Back
          </button>
          <span class="tk-modal-title">Details</span>
          <button class="tk-modal-close" onclick="document.getElementById('universalModal').classList.add('hidden')">✕</button>
        </div>

        <textarea class="tk-textarea" id="mTaskDesc" rows="2" placeholder="Description...">${escapeHtml(t.description || '')}</textarea>

        <div class="tk-field-row" style="margin-top:12px;">
          <div class="tk-field-section">
            <span class="tk-field-label">Time</span>
            <input type="time" class="tk-input" id="mTaskTime" value="${parseDueTimeForInput(t.due_time)}">
          </div>
          <div class="tk-field-section">
            <span class="tk-field-label">Tags</span>
            <input type="text" class="tk-input" id="mTaskTags" value="${escapeHtml(t.tags || '')}" placeholder="tag1, tag2">
          </div>
        </div>

        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="list-checks" style="width:13px;height:13px"></i> Subtasks
          </div>
          <div id="mSubtaskList"></div>
          <button class="tk-modal-subtask-add" onclick="addSubtaskInput()">+ Add subtask</button>
        </div>

        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="timer" style="width:13px;height:13px"></i> Time Estimate
          </div>
          <div class="tk-field-row" style="margin-bottom:0;">
            <div class="tk-field-section">
              <span class="tk-field-label">Duration (min)</span>
              <input type="number" class="tk-input" id="mTaskDuration" value="${t.duration || 30}" min="5" step="5">
            </div>
            <div class="tk-field-section">
              <span class="tk-field-label">🍅 Sessions</span>
              <input type="number" class="tk-input" id="mTaskPomoEstimate" value="${t.pomodoro_estimate || 0}" min="0">
            </div>
            <div class="tk-field-section">
              <span class="tk-field-label">Session (min)</span>
              <input type="number" class="tk-input" id="mTaskPomoLength" value="${t.pomodoro_length || 25}" min="5" step="5">
            </div>
          </div>
        </div>

        <div class="tk-field-section">
          <span class="tk-field-label">Link to Vision Goal</span>
          <select class="tk-select" id="mTaskVisionGoal">
            <option value="">None</option>
            ${(state.data.vision || []).filter(g => g.status !== 'achieved' || g.id === t.vision_id).map(g =>
              `<option value="${g.id}" ${String(g.id)===String(t.vision_id)?'selected':''}>${escapeHtml(g.title || g.goal_name || '')}</option>`
            ).join('')}
          </select>
        </div>

        <div class="tk-modal-section">
          <div class="tk-modal-section-title">
            <i data-lucide="repeat-2" style="width:13px;height:13px"></i> Recurrence
          </div>
          <select class="tk-select" id="mTaskRecurrence" onchange="taskRecurrenceChanged()">
            <option value="none"    ${!t.recurrence||t.recurrence==='none'?'selected':''}>None</option>
            <option value="daily"   ${t.recurrence==='daily'?'selected':''}>Daily</option>
            <option value="weekly"  ${t.recurrence==='weekly'?'selected':''}>Weekly</option>
            <option value="monthly" ${t.recurrence==='monthly'?'selected':''}>Monthly</option>
          </select>
          <div id="taskDayPickerWrap" style="display:${isWeekly?'block':'none'};margin-top:10px;">
            <div class="tk-day-picker">
              ${TASK_DAY_NAMES.map(d => `
                <label class="tk-day-label ${selectedDays.includes(d)?'checked':''}">
                  <input type="checkbox" value="${d}" class="task-day-check" ${selectedDays.includes(d)?'checked':''}> ${d}
                </label>`).join('')}
            </div>
          </div>
          <div id="taskEndDateWrap" style="display:${isRecurring?'block':'none'};margin-top:10px;">
            <span class="tk-field-label">End Date</span>
            <input type="date" class="tk-input" id="mTaskRecurrenceEnd" value="${t.recurrence_end||''}" style="margin-top:6px;">
          </div>
        </div>

        <div class="tk-modal-actions">
          <button class="tk-modal-cancel" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="tk-modal-save" data-action="update-task-modal" data-edit-id="${t.id}">Update Task</button>
        </div>
      </div>

    </div><!-- /slider -->
  </div>`;

  modal.classList.remove('hidden');
  if (subtasks.length > 0) {
    document.getElementById('mSubtaskList').innerHTML = '';
    subtasks.forEach(s => addSubtaskInput(s.text, s.done));
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/* ══════════════════════════════════════════════════════
   REMINDER INTEGRATION (unchanged)
══════════════════════════════════════════════════════ */
window.addReminderToTask = function (taskId) {
  const task = state.data.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;
  if (typeof openReminderModal === 'function') {
    openReminderModal();
    setTimeout(() => {
      document.getElementById('reminderTitle').value = `Task: ${task.title}`;
      document.getElementById('reminderDescription').value = task.description || '';
      document.getElementById('reminderCategory').value = 'task';
      document.getElementById('relatedItemType').value = 'task';
      loadRelatedItems('task');
      setTimeout(() => { document.getElementById('relatedItemId').value = taskId; }, 100);
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        document.getElementById('reminderDate').value = dueDate.toISOString().split('T')[0];
        document.getElementById('reminderTime').value = '09:00';
      }
    }, 100);
  }
};

/* ══════════════════════════════════════════════════════
   DELETE TASK (unchanged)
══════════════════════════════════════════════════════ */
window.deleteTask = async function (id) {
  const t = state.data.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  const originalTask = { ...t };
  const originalIndex = state.data.tasks.indexOf(t);
  state.data.tasks.splice(originalIndex, 1);
  renderTasks(_getSearchValue());
  showToast('Task deleted', 'default', async () => {
    state.data.tasks.splice(originalIndex, 0, originalTask);
    renderTasks(_getSearchValue());
    showToast('Task restored');
  });
  setTimeout(async () => {
    const stillDeleted = !state.data.tasks.find(x => String(x.id) === String(id));
    if (stillDeleted) {
      try { await apiCall('delete', 'tasks', {}, id); } catch (err) { console.error('Failed to delete task:', err); }
    }
  }, 5000);
};

/* ══════════════════════════════════════════════════════
   CATEGORY CRUD (unchanged)
══════════════════════════════════════════════════════ */
const DEFAULT_TASK_CATEGORIES = ['Work', 'Personal', 'Health', 'Finance', 'Study', 'Other'];

function getTaskCategories() {
  const settings = state.data.settings?.[0] || {};
  if (settings.task_categories) {
    let raw = settings.task_categories;
    if (raw.startsWith('VIEW:')) raw = raw.split('|')[1] || '';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return raw.split(',').map(c => c.trim()).filter(Boolean);
  }
  return [...DEFAULT_TASK_CATEGORIES];
}

async function saveTaskCategoriesToSettings(categories) {
  const settings = state.data.settings?.[0] || {};
  let currentRaw = settings.task_categories || '';
  let prefix = '';
  if (currentRaw.startsWith('VIEW:')) prefix = currentRaw.split('|')[0] + '|';
  const newSettings = { ...settings, task_categories: prefix + categories.join(',') };
  if (settings.id) {
    await apiCall('update', 'settings', newSettings, settings.id);
  } else {
    await apiCall('create', 'settings', newSettings);
  }
  if (!state.data.settings) state.data.settings = [{}];
  state.data.settings[0] = newSettings;
}

function getAllTaskCategories() {
  const savedCats = getTaskCategories();
  const taskCats = (state.data.tasks || []).map(t => t.category).filter(Boolean);
  return [...new Set([...savedCats, ...taskCats])];
}

window.addTaskCategory = async function (categoryName) {
  if (!categoryName || categoryName.trim() === '') return false;
  const trimmed = categoryName.trim();
  const categories = getTaskCategories();
  if (categories.includes(trimmed)) { showToast('Category already exists'); return false; }
  categories.push(trimmed);
  await saveTaskCategoriesToSettings(categories);
  showToast(`Category "${trimmed}" added`);
  return true;
};

window.deleteTaskCategory = async function (categoryName) {
  if (!confirm(`Delete category "${categoryName}"? Tasks will become uncategorized.`)) return;
  const categories = getTaskCategories().filter(c => c !== categoryName);
  await saveTaskCategoriesToSettings(categories);
  const tasksToUpdate = state.data.tasks.filter(t => t.category === categoryName);
  for (const t of tasksToUpdate) await apiCall('update', 'tasks', { ...t, category: '' }, t.id);
  showToast(`Category "${categoryName}" deleted`);
  await refreshData('tasks');
};

window.renameTaskCategory = async function (oldName, newName) {
  if (!newName || newName.trim() === '') return false;
  const trimmed = newName.trim();
  const categories = getTaskCategories();
  if (categories.includes(trimmed) && trimmed !== oldName) { showToast('Category name already exists'); return false; }
  const newCategories = categories.map(c => c === oldName ? trimmed : c);
  await saveTaskCategoriesToSettings(newCategories);
  const tasksToUpdate = state.data.tasks.filter(t => t.category === oldName);
  for (const t of tasksToUpdate) await apiCall('update', 'tasks', { ...t, category: trimmed }, t.id);
  showToast(`Category renamed to "${trimmed}"`);
  await refreshData('tasks');
  return true;
};

window.openCategoryManager = function () {
  const categories = getAllTaskCategories();
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3 style="margin-bottom:16px;font-size:17px;font-weight:800;">Manage Categories</h3>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input class="tk-input" id="newCategoryInput" placeholder="New category name" style="flex:1;">
      <button class="btn primary" style="white-space:nowrap;" onclick="saveNewCategory()">Add</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
      ${categories.map(cat => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border-color);border-radius:10px;background:var(--surface-2);">
          <span style="font-weight:600;font-size:14px;">${escapeHtml(cat)}</span>
          <div style="display:flex;gap:6px;">
            <button class="btn icon small" onclick="editCategoryName('${escapeHtml(cat)}')" title="Rename">
              <i data-lucide="pencil" style="width:13px;height:13px"></i>
            </button>
            <button class="btn icon small" onclick="confirmDeleteCategory('${escapeHtml(cat)}')" title="Delete">
              <i data-lucide="trash-2" style="width:13px;height:13px"></i>
            </button>
          </div>
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
    </div>`;
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.saveNewCategory = async function () {
  const input = document.getElementById('newCategoryInput');
  const name = input.value.trim();
  if (await addTaskCategory(name)) { input.value = ''; openCategoryManager(); }
};

window.editCategoryName = async function (oldName) {
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (newName && newName !== oldName) { await renameTaskCategory(oldName, newName); openCategoryManager(); }
};

window.confirmDeleteCategory = async function (categoryName) {
  await deleteTaskCategory(categoryName);
  document.getElementById('universalModal').classList.add('hidden');
};
