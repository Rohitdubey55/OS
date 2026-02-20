/* view-vision.js - Enhanced Multi-View Vision Board */

// Vision State Management
let visionState = {
  view: 'grid',
  filter: 'all',
  search: '',
  sort: 'newest',
  page: 1,
  itemsPerPage: 12,
  controlsExpanded: false
};

function renderVision() {
  const goals = state.data.vision || [];
  let filtered = filterVisions(goals);
  filtered = sortVisions(filtered);
  const stats = calculateVisionStats(goals);

  document.getElementById('main').innerHTML = `
    <div class="vision-wrapper">
      <div class="header-row">
        <div>
          <h2 class="page-title">Vision Board</h2>
        </div>
        <button class="btn primary" onclick="openVisionModal()">+ Add Goal</button>
      </div>

      ${renderVisionStats(stats)}

      <!-- View Tabs -->
      <div class="vision-view-tabs">
        <button class="vision-tab ${visionState.view === 'grid' ? 'active' : ''}" onclick="switchVisionView('grid')" title="Grid View"><i data-lucide="layout-grid" style="width:18px"></i></button>
        <button class="vision-tab ${visionState.view === 'list' ? 'active' : ''}" onclick="switchVisionView('list')" title="List View"><i data-lucide="list" style="width:18px"></i></button>
        <button class="vision-tab ${visionState.view === 'timeline' ? 'active' : ''}" onclick="switchVisionView('timeline')" title="Timeline View"><i data-lucide="calendar" style="width:18px"></i></button>
      </div>

      ${visionState.view === 'grid' ? renderVisionGrid(filtered) : ''}
      ${visionState.view === 'list' ? renderVisionList(filtered) : ''}
      ${visionState.view === 'timeline' ? renderVisionTimeline(filtered) : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function calculateVisionStats(goals) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const thisYear = goals.filter(g => {
    if (!g.target_date) return false;
    return new Date(g.target_date).getFullYear() === currentYear;
  }).length;
  const future = goals.filter(g => {
    if (!g.target_date) return false;
    return new Date(g.target_date).getFullYear() > currentYear;
  }).length;
  return { total: goals.length, thisYear, future };
}

function renderVisionStats(stats) {
  return `
    <div class="vision-stats-dashboard">
      <div class="vision-stat-card">
        <div class="stat-number">${stats.total}</div>
        <div class="stat-label">Total Goals</div>
      </div>
      <div class="vision-stat-card">
        <div class="stat-number">${stats.thisYear}</div>
        <div class="stat-label">This Year</div>
      </div>
      <div class="vision-stat-card">
        <div class="stat-number">${stats.future}</div>
        <div class="stat-label">Future</div>
      </div>
    </div>
  `;
}

// Grid View (extracted from original renderVision)
function renderVisionGrid(goals) {
  const paginated = goals.slice(0, visionState.page * visionState.itemsPerPage); // Keep pagination logic if needed, or simple
  // P2 had pagination. Let's restore simple first to be safe, or just render all since user complained about missing features.
  // Actually, let's just render all filtered.

  const active = goals.filter(g => g.status !== 'achieved');
  const achieved = goals.filter(g => g.status === 'achieved');

  return `
    <div class="vision-grid">
      ${active.length === 0 ? '<div class="vision-empty">No active goals. Add one!</div>' : active.map(g => renderVisionCard(g)).join('')}
    </div>

    ${achieved.length > 0 ? `
      <div style="margin-top:40px; border-top:1px solid var(--border-color); padding-top:20px;">
          <h3 style="font-size:16px; color:var(--text-muted); margin-bottom:15px">🏆 Achieved Goals</h3>
          <div class="vision-grid" style="opacity:0.8">
              ${achieved.map(g => renderVisionCard(g, true)).join('')}
          </div>
      </div>
    ` : ''}
  `;
}

// List View
function renderVisionList(goals) {
  if (goals.length === 0) {
    return `<div class="vision-empty"><div class="vision-empty-icon"><i data-lucide="sparkles" style="width:48px; height:48px; display:inline-block"></i></div><div class="vision-empty-text">No vision goals found</div></div>`;
  }
  return `<div class="vision-list">${goals.map(g => renderVisionListItem(g)).join('')}</div>`;
}

function renderVisionListItem(g) {
  const daysLeft = g.target_date ? getDaysLeft(g.target_date) : null;
  const categoryIcon = getCategoryIcon(g.category);
  const isPast = daysLeft !== null && daysLeft < 0;
  const isAchieved = g.status === 'achieved';
  const opacity = isAchieved ? 'opacity:0.7; filter:grayscale(0.5);' : '';

  return `
    <div class="vision-list-item" style="${opacity}" onclick="openVisionDetail('${g.id}')">
      <div class="vision-list-icon">${categoryIcon}</div>
      <div class="vision-list-content">
        <div class="vision-list-title">${g.title}</div>
        <div class="vision-list-date">${g.target_date ? 'Target: ' + formatDate(g.target_date) : 'No deadline'}</div>
        <div style="background:rgba(0,0,0,0.1); height:4px; border-radius:2px; margin-top:4px; overflow:hidden; width:100%;">
            <div style="width:${g.progress || 0}%; height:100%; background:var(--primary);"></div>
        </div>
      </div>
      ${isAchieved ? '<div class="vision-list-badge achieved">Achieved</div>' : (daysLeft !== null ? `<div class="vision-list-badge ${isPast ? 'past' : 'active'}">${isPast ? 'Past' : daysLeft + 'd'}</div>` : '')}
    </div>
  `;
}

// Timeline View
function renderVisionTimeline(goals) {
  if (goals.length === 0) {
    return `<div class="vision-empty"><div class="vision-empty-icon"><i data-lucide="sparkles" style="width:48px; height:48px; display:inline-block"></i></div><div class="vision-empty-text">No vision goals found</div></div>`;
  }
  const grouped = groupByYear(goals);
  return `
    <div class="vision-timeline">
    ${Object.keys(grouped).sort().map(year => `
        <div class="timeline-year-section">
          <h3 class="timeline-year-header"><i data-lucide="calendar" style="width:18px; display:inline-block; vertical-align:middle; margin-right:6px"></i> ${year}</h3>
          <div class="timeline-items">
            ${grouped[year].map(g => renderTimelineItem(g)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTimelineItem(g) {
  const daysLeft = g.target_date ? getDaysLeft(g.target_date) : null;
  const categoryIcon = getCategoryIcon(g.category);
  const isAchieved = g.status === 'achieved';
  const opacity = isAchieved ? 'opacity:0.7; filter:grayscale(0.5);' : '';

  return `
    <div class="timeline-item" style="${opacity}" onclick="openVisionDetail('${g.id}')">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${categoryIcon} ${g.title}</div>
        <div class="timeline-meta">${formatDate(g.target_date)} ${daysLeft !== null ? '• ' + daysLeft + ' days' : ''}</div>
        <div style="background:rgba(0,0,0,0.1); height:4px; border-radius:2px; margin-top:4px; overflow:hidden; width:100%;">
            <div style="width:${g.progress || 0}%; height:100%; background:var(--primary);"></div>
        </div>
      </div>
    </div>
  `;
}

// Grid Card - improved design
function renderVisionCard(g, isAchieved = false) {
  // Safe handling of images - convert http to https and handle errors
  const safeImgUrl = (url) => {
    if (!url) return getDefaultImage(g);
    let safeUrl = url.replace(/^http:\/\//i, 'https://');
    return safeUrl;
  };
  const bgUrl = g.image_url ? safeImgUrl(g.image_url) : getDefaultImage(g);

  // Calculate days left
  const days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const badgeClass = days === null ? '' : (days < 0 ? 'expired' : (days < 30 ? 'urgent' : 'normal'));
  const badgeText = days === null ? '' : (days < 0 ? 'Ended' : `${days}d left`);

  const opacity = isAchieved ? 'opacity:0.8; filter:grayscale(0.3);' : '';

  return `
    <div class="vision-card animate-enter" style="${opacity}" onclick="openVisionDetail('${g.id}')">
      <div class="vision-card-bg" style="background-image: url('${bgUrl}');"></div>
      <div class="vision-card-overlay"></div>
      <div class="vision-card-content">
        ${badgeText && !isAchieved ? `<div class="vision-card-badge ${badgeClass}">${badgeText}</div>` : ''}
        ${isAchieved ? '<div class="vision-card-badge achieved">✓ Achieved</div>' : ''}
        <div class="vision-card-title">${g.title}</div>
        <div class="vision-card-category">${g.category || 'Personal'}</div>
        <div class="vision-card-progress">
            <div class="vision-card-progress-bar" style="width:${g.progress || 0}%;"></div>
        </div>
      </div>
    </div>
  `;
}

// Unique default images based on category + title hash
function getDefaultImage(g) {
  const categoryImages = {
    'Personal': [
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80'
    ],
    'Career': [
      'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80'
    ],
    'Travel': [
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=80'
    ],
    'Finance': [
      'https://images.unsplash.com/photo-1553729459-ead63e3c0ad4?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=400&q=80'
    ],
    'Health': [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80'
    ],
    'Education': [
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80'
    ],
    'Relationship': [
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=400&q=80'
    ]
  };
  const defaults = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=80'
  ];
  const images = categoryImages[g.category] || defaults;
  const hash = (g.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return images[hash % images.length];
}

function getFallbackImage(g) {
  const fallbacks = [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
  ];
  const hash = (g.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallbacks[hash % fallbacks.length];
}

// Helper Functions
function filterVisions(goals) {
  let filtered = [...goals];
  if (visionState.filter !== 'all') {
    filtered = filtered.filter(g => g.category === visionState.filter);
  }
  if (visionState.search) {
    const query = visionState.search.toLowerCase();
    filtered = filtered.filter(g =>
      g.title.toLowerCase().includes(query) ||
      (g.notes && g.notes.toLowerCase().includes(query))
    );
  }
  return filtered;
}

function sortVisions(goals) {
  const sorted = [...goals];
  switch (visionState.sort) {
    case 'newest': return sorted.reverse();
    case 'oldest': return sorted;
    case 'closest':
      return sorted.sort((a, b) => {
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return new Date(a.target_date) - new Date(b.target_date);
      });
    case 'furthest':
      return sorted.sort((a, b) => {
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return new Date(b.target_date) - new Date(a.target_date);
      });
    case 'az': return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default: return sorted;
  }
}

function groupByYear(goals) {
  const grouped = {};
  const noDate = [];
  goals.forEach(g => {
    if (!g.target_date) { noDate.push(g); return; }
    const year = new Date(g.target_date).getFullYear();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(g);
  });
  if (noDate.length > 0) grouped['No Deadline'] = noDate;
  return grouped;
}

function getCategoryIcon(category) {
  const icons = { 'Personal': 'target', 'Career': 'briefcase', 'Travel': 'plane', 'Finance': 'coins', 'Health': 'activity', 'Education': 'book-open', 'Relationship': 'heart' };
  const iconName = icons[category] || 'star';
  return `<i data-lucide="${iconName}" style="width:16px; display:inline-block; vertical-align:text-bottom; margin-right:4px"></i>`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysLeft(target) {
  const today = new Date();
  const tgt = new Date(target);
  return Math.ceil((tgt - today) / (1000 * 60 * 60 * 24));
}

// Event Handlers
window.switchVisionView = function (view) {
  visionState.view = view;
  visionState.page = 1;
  renderVision();
};

window.handleVisionSearch = function (query) {
  visionState.search = query;
  visionState.page = 1;
  renderVision();
};

window.handleVisionSort = function (sortType) {
  visionState.sort = sortType;
  renderVision();
};

window.loadMoreVisions = function () {
  visionState.page++;
  renderVision();
};

// Modal Functions
window.openVisionDetail = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  const safeImgUrl = (url) => {
    if (!url) return getDefaultImage(g);
    return url.replace(/^http:\/\//i, 'https://');
  };
  const imgUrl = g.image_url ? safeImgUrl(g.image_url) : getDefaultImage(g);

  let daysBadge = '';
  if (g.target_date) {
    const d = getDaysLeft(g.target_date);
    const color = d < 0 ? 'var(--danger, #EF4444)' : 'var(--success, #10B981)';
    daysBadge = `<span style="background:${color}; color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold">${d < 0 ? 'Goal Date Passed' : d + ' Days Remaining'}</span>`;
  }

  box.innerHTML = `
    <div style="margin:-24px -24px 20px -24px; height:200px; overflow:hidden; border-radius:16px 16px 0 0; position:relative">
       <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover">
       <div style="position:absolute; bottom:16px; left:24px; right:24px;">
          <h2 style="color:white; text-shadow:0 2px 10px rgba(0,0,0,0.5); margin:0; font-size:24px">${g.title}</h2>
       </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
       <div class="pill">${g.category || 'General'}</div>
       ${daysBadge}
    </div>
    <div style="background:var(--surface-2); padding:16px; border-radius:12px; font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:20px; max-height:150px; overflow-y:auto">
       ${g.notes || '<span style="color:var(--text-muted)">No notes added.</span>'}}
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:20px">
       Target Date: ${g.target_date || 'N/A'}
    </div>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
        <button class="btn" style="color:var(--primary); border-color:var(--primary)" onclick="openEditVision('${g.id}')"><i data-lucide="pencil" style="width:16px; margin-right:6px"></i> Edit Goal</button>
        <button class="btn" style="color:var(--danger); border-color:var(--danger)" onclick="deleteVision('${g.id}')"><i data-lucide="trash-2" style="width:16px; margin-right:6px"></i> Delete Goal</button>
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  modal.classList.remove('hidden');
};

window.openEditVision = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3>Edit Vision Goal</h3>
    <input class="input" id="mVisTitle" value="${(g.title || '').replace(/"/g, '&quot;')}" placeholder="Goal Title">
    <input class="input" id="mVisImg" value="${(g.image_url || '').replace(/"/g, '&quot;')}" placeholder="Image URL (optional)">
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
        <select class="input" id="mVisCat">
            <option value="Personal" ${g.category === 'Personal' ? 'selected' : ''}>Personal</option>
            <option value="Career" ${g.category === 'Career' ? 'selected' : ''}>Career</option>
            <option value="Travel" ${g.category === 'Travel' ? 'selected' : ''}>Travel</option>
            <option value="Finance" ${g.category === 'Finance' ? 'selected' : ''}>Finance</option>
            <option value="Health" ${g.category === 'Health' ? 'selected' : ''}>Health</option>
            <option value="Education" ${g.category === 'Education' ? 'selected' : ''}>Education</option>
            <option value="Relationship" ${g.category === 'Relationship' ? 'selected' : ''}>Relationship</option>
        </select>
        <input type="date" class="input" id="mVisDate" value="${g.target_date || ''}">
    </div>
    <div style="margin-bottom:10px;">
        <label for="mVisProgress" class="input-label">Progress: <span id="mVisProgressVal">${g.progress || 0}%</span></label>
        <input type="range" class="slider" id="mVisProgress" min="0" max="100" value="${g.progress || 0}" oninput="document.getElementById('mVisProgressVal').textContent = this.value + '%'">
    </div>
    <textarea class="input" id="mVisNotes" placeholder="Notes..." style="height:80px">${(g.notes || '').replace(/</g, '&lt;')}</textarea>
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" data-action="update-vision-modal" data-edit-id="${g.id}">Update Goal</button>
        ${g.status !== 'achieved' ? `<button class="btn success" onclick="markVisionAchieved('${g.id}')">Mark Achieved</button>` : ''}
    </div>
  `;
  modal.classList.remove('hidden');
};

window.deleteVision = async function (id) {
  if (confirm('Delete this vision goal?')) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('delete', 'vision_board', {}, id);
    await refreshData('vision');
  }
};

window.openVisionModal = function () {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  box.innerHTML = `
        <h3>New Vision Goal</h3>
        <input class="input" id="mVisTitle" placeholder="Goal Title">
        <input class="input" id="mVisImg" placeholder="Image URL (optional)">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
          <select class="input" id="mVisCat">
            <option value="Personal">Personal</option>
            <option value="Career">Career</option>
            <option value="Travel">Travel</option>
            <option value="Finance">Finance</option>
            <option value="Health">Health</option>
            <option value="Education">Education</option>
            <option value="Relationship">Relationship</option>
          </select>
          <input type="date" class="input" id="mVisDate">
        </div>
        <div style="margin-bottom:10px;">
          <label for="mVisProgress" class="input-label">Progress: <span id="mVisProgressVal">0%</span></label>
          <input type="range" class="slider" id="mVisProgress" min="0" max="100" value="0" oninput="document.getElementById('mVisProgressVal').textContent = this.value + '%'">
        </div>
        <textarea class="input" id="mVisNotes" placeholder="Notes..." style="height:80px"></textarea>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px">
          <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
          <button class="btn primary" data-action="save-vision-modal">Save</button>
        </div>
  `;
  modal.classList.remove('hidden');
};

window.markVisionAchieved = async function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  if (confirm('Mark this goal as achieved? It will be moved to the achieved section.')) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('update', 'vision_board', { status: 'achieved', progress: 100 }, id);
    await refreshData('vision');
    showToast('Goal marked as achieved!');
  }
}

// Universal modal event listener for save/update
document.addEventListener('click', async function (event) {
  if (event.target.dataset.action === 'save-vision-modal') {
    const title = document.getElementById('mVisTitle').value;
    if (!title) { showToast('Title is required!', 'error'); return; }

    const payload = {
      title: title,
      category: document.getElementById('mVisCat').value,
      target_date: document.getElementById('mVisDate').value,
      image_url: document.getElementById('mVisImg').value,
      notes: document.getElementById('mVisNotes').value,
      progress: parseInt(document.getElementById('mVisProgress').value, 10),
      status: 'active'
    };
    await apiCall('post', 'vision_board', payload);
    document.getElementById('universalModal').classList.add('hidden');
    await refreshData('vision');
    showToast('Vision goal added!');
  } else if (event.target.dataset.action === 'update-vision-modal') {
    const id = event.target.dataset.editId;
    const title = document.getElementById('mVisTitle').value;
    if (!title) { showToast('Title is required!', 'error'); return; }

    const payload = {
      title: title,
      category: document.getElementById('mVisCat').value,
      target_date: document.getElementById('mVisDate').value,
      image_url: document.getElementById('mVisImg').value,
      notes: document.getElementById('mVisNotes').value,
      progress: parseInt(document.getElementById('mVisProgress').value, 10)
    };
    await apiCall('update', 'vision_board', payload, id);
    document.getElementById('universalModal').classList.add('hidden');
    await refreshData('vision');
    showToast('Vision goal updated!');
  }
});

// --- VISION IMAGE UPLOAD ---

window.openVisionImageSheet = function(visionId) {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  
  box.innerHTML = `
    <h3>Add Image</h3>
    
    <!-- Tab Navigation -->
    <div class="image-source-tabs" style="display:flex; gap:10px; margin-bottom:20px;">
      <button class="tab-btn btn secondary" id="uploadTabBtn" onclick="switchImageSource('upload')">
        📁 Upload from Device
      </button>
      <button class="tab-btn btn" id="urlTabBtn" onclick="switchImageSource('url')">
        🔗 Add from URL
      </button>
    </div>
    
    <!-- Upload Tab -->
    <div id="imageUploadTab" class="source-tab">
      <div class="upload-zone" id="dropZone" style="border:2px dashed var(--border-color); border-radius:12px; padding:40px; text-align:center; cursor:pointer;" onclick="document.getElementById('visionFileInput').click()">
        <input type="file" id="visionFileInput" accept="image/*" hidden onchange="handleVisionFileSelect(this.files)">
        <div class="upload-prompt">
          <i data-lucide="upload-cloud" style="width:48px; height:48px; color:var(--primary)"></i>
          <p style="margin:10px 0 5px;">Tap to select or drag & drop</p>
          <span style="font-size:12px; color:var(--text-muted)">PNG, JPG, GIF, WebP - Max 10MB</span>
        </div>
      </div>
      <div id="uploadPreview" class="upload-preview hidden" style="margin-top:20px;">
        <img id="previewImage" src="" alt="Preview" style="max-width:100%; max-height:200px; border-radius:8px;">
        <div class="preview-info" style="display:flex; justify-content:space-between; margin-top:10px;">
          <span id="previewName" style="font-size:14px;"></span>
          <span id="previewSize" style="font-size:12px; color:var(--text-muted);"></span>
        </div>
        <button class="btn danger" style="margin-top:10px;" onclick="clearVisionUpload()">Remove</button>
      </div>
    </div>
    
    <!-- URL Tab -->
    <div id="imageUrlTab" class="source-tab hidden">
      <input type="url" id="visionImageUrl" class="input" style="width:100%; margin-bottom:10px;" 
             placeholder="https://example.com/image.jpg">
      <button class="btn secondary" onclick="loadImageFromUrl()" style="margin-bottom:15px;">
        Load Preview
      </button>
      <div id="urlPreview" class="url-preview hidden">
        <img id="urlPreviewImage" src="" alt="Preview" style="max-width:100%; max-height:200px; border-radius:8px;">
      </div>
    </div>
    
    <!-- Actions -->
    <div class="modal-actions" style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn" onclick="closeUniversalModal()">Cancel</button>
      <button class="btn primary" onclick="saveVisionImage('${visionId}')">
        Save Image
      </button>
    </div>
  `;
  
  openUniversalModal();
  
  // Initialize icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Set up drag and drop
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      handleVisionFileSelect(e.dataTransfer.files);
    });
  }
}

window.switchImageSource = function(source) {
  const uploadTab = document.getElementById('imageUploadTab');
  const urlTab = document.getElementById('imageUrlTab');
  const uploadBtn = document.getElementById('uploadTabBtn');
  const urlBtn = document.getElementById('urlTabBtn');
  
  if (source === 'upload') {
    uploadTab.classList.remove('hidden');
    urlTab.classList.add('hidden');
    uploadBtn.classList.add('secondary');
    urlBtn.classList.remove('secondary');
  } else {
    uploadTab.classList.add('hidden');
    urlTab.classList.remove('hidden');
    uploadBtn.classList.remove('secondary');
    urlBtn.classList.add('secondary');
  }
}

window.handleVisionFileSelect = function(files) {
  const file = files[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Invalid file type. Use PNG, JPG, GIF, or WebP', 'error');
    return;
  }
  
  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max 10MB', 'error');
    return;
  }
  
  // Read and preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    // Store for saving
    window.pendingVisionImage = {
      data: base64,
      filename: file.name,
      type: file.type,
      size: file.size
    };
    // Show preview
    document.getElementById('previewImage').src = base64;
    document.getElementById('previewName').textContent = file.name;
    document.getElementById('previewSize').textContent = formatFileSize(file.size);
    document.getElementById('uploadPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

window.loadImageFromUrl = function() {
  const url = document.getElementById('visionImageUrl').value;
  if (!url) {
    showToast('Enter a valid URL', 'error');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    showToast('Invalid URL format', 'error');
    return;
  }
  
  // Load preview
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    window.pendingVisionImage = {
      url: url,
      width: img.width,
      height: img.height
    };
    document.getElementById('urlPreviewImage').src = url;
    document.getElementById('urlPreview').classList.remove('hidden');
  };
  img.onerror = () => {
    showToast('Could not load image. Check URL or CORS settings.', 'error');
  };
  img.src = url;
}

window.saveVisionImage = async function(visionId) {
  const img = window.pendingVisionImage;
  if (!img) {
    showToast('No image selected', 'error');
    return;
  }
  
  showToast('Saving image...');
  
  try {
    let payload;
    
    if (img.data) {
      // Upload from device - determine storage strategy
      if (img.size > 500 * 1024) {
        // Large file - would use Google Drive (simplified for now - store as base64)
        showToast('Large image detected. Consider using URL for better performance.', 'info');
      }
      
      // Save image metadata to vision_images sheet
      payload = {
        vision_id: visionId,
        image_url: img.data,  // Base64 (for small files)
        source_type: 'upload',
        original_filename: img.filename,
        file_size: img.size,
        uploaded_at: new Date().toISOString()
      };
      
      await apiCall('create', 'vision_images', payload);
      
      // Also update the vision_board with primary image
      await apiCall('update', 'vision_board', {
        image_url: img.data,
        image_source: 'upload'
      }, visionId);
      
    } else if (img.url) {
      // URL source - just update vision
      payload = {
        image_url: img.url,
        image_source: 'url'
      };
      await apiCall('update', 'vision_board', payload, visionId);
    }
    
    // Refresh vision data
    await refreshData('vision');
    closeUniversalModal();
    showToast('Image saved successfully!', 'success');
    
  } catch (error) {
    console.error(error);
    showToast('Error saving image', 'error');
  }
  
  // Clear pending image
  window.pendingVisionImage = null;
}

window.clearVisionUpload = function() {
  window.pendingVisionImage = null;
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('previewImage').src = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
