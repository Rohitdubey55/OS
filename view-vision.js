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

  const isExpanded = visionState.controlsExpanded;
  const activeFilters = [];
  if (visionState.filter !== 'all') activeFilters.push(visionState.filter);
  if (visionState.search) activeFilters.push('"' + visionState.search + '"');
  if (visionState.sort !== 'newest') activeFilters.push(visionState.sort);
  const filterSummary = activeFilters.length > 0
    ? '<span class="filter-summary">' + activeFilters.join(' • ') + '</span>'
    : '';

  document.getElementById('main').innerHTML = `
    <div class="vision-wrapper">
      <div class="header-row">
        <div>
          <h2 class="page-title">Vision Board</h2>
          <div class="vision-mini-stats">${stats.total} goals • ${stats.thisYear} this year</div>
        </div>
        <button class="btn primary" onclick="openVisionModal()">+ Add Goal</button>
      </div>

      ${renderVisionStats(stats)}

      <!-- Collapsible Controls Toggle -->
      <div class="vision-controls-toggle" onclick="toggleVisionControls()">
        <div class="controls-toggle-left">
          <span class="controls-toggle-icon">${isExpanded ? '▼' : '▶'}</span>
          <span class="controls-toggle-label">Filters & Views</span>
          ${filterSummary}
        </div>
        <span class="controls-toggle-count">${filtered.length} of ${goals.length}</span>
      </div>

      <!-- Collapsible Controls Section -->
      <div class="vision-controls-section ${isExpanded ? 'expanded' : 'collapsed'}">
        <div class="vision-view-tabs">
          <button class="vision-tab ${visionState.view === 'grid' ? 'active' : ''}" onclick="switchVisionView('grid')"><i data-lucide="layout-grid" style="width:16px; margin-right:6px"></i> Grid</button>
          <button class="vision-tab ${visionState.view === 'list' ? 'active' : ''}" onclick="switchVisionView('list')"><i data-lucide="list" style="width:16px; margin-right:6px"></i> List</button>
          <button class="vision-tab ${visionState.view === 'timeline' ? 'active' : ''}" onclick="switchVisionView('timeline')"><i data-lucide="calendar" style="width:16px; margin-right:6px"></i> Timeline</button>
        </div>

        <div class="category-pills">
          ${renderCategoryPills(goals)}
        </div>

        <div class="vision-search-bar">
          <input type="text" class="vision-search-input" placeholder="Search goals..."
                 value="${visionState.search}" oninput="handleVisionSearch(this.value)">
          <select class="vision-sort-select" onchange="handleVisionSort(this.value)">
            <option value="newest" ${visionState.sort === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="oldest" ${visionState.sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="closest" ${visionState.sort === 'closest' ? 'selected' : ''}>Closest Deadline</option>
            <option value="furthest" ${visionState.sort === 'furthest' ? 'selected' : ''}>Furthest Deadline</option>
            <option value="az" ${visionState.sort === 'az' ? 'selected' : ''}>A-Z</option>
          </select>
        </div>
      </div>

      ${visionState.view === 'grid' ? renderVisionGrid(filtered) : ''}
      ${visionState.view === 'list' ? renderVisionList(filtered) : ''}
      ${visionState.view === 'timeline' ? renderVisionTimeline(filtered) : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Toggle controls
window.toggleVisionControls = function () {
  visionState.controlsExpanded = !visionState.controlsExpanded;
  renderVision();
};

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

function renderCategoryPills(goals) {
  const categories = ['all', ...new Set(goals.map(g => g.category).filter(c => c))];
  return categories.map(cat => {
    const isActive = visionState.filter === cat;
    const displayName = cat === 'all' ? 'All' : cat;
    return `<button class="category-pill ${isActive ? 'active' : ''}" onclick="handleCategoryFilter('${cat}')">${displayName}</button>`;
  }).join('');
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
      <div style="margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
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

// Grid Card - unique images per category/title
function renderVisionCard(g, isAchieved = false) {
  // Safe handling of images
  const bg = g.image_url ? `background-image: url('${g.image_url}');` : `background-image: url('${getDefaultImage(g)}');`;

  // Calculate days left
  const days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const badgeClass = days === null ? '' : (days < 0 ? 'v-badge-expired' : (days < 30 ? 'v-badge-urgent' : 'v-badge-normal'));
  const badgeText = days === null ? '' : (days < 0 ? 'Ended' : `${days} days left`);

  const opacity = isAchieved ? 'opacity:0.7; filter:grayscale(0.5);' : '';

  return `
    <div class="vision-card animate-enter" style="${bg} ${opacity}" onclick="openVisionDetail('${g.id}')">
      <div class="v-overlay"></div>
      <div class="v-content">
        ${badgeText && !isAchieved ? `<div class="v-badge ${badgeClass}">${badgeText}</div>` : ''}
        ${isAchieved ? '<div class="v-badge achieved">Achieved</div>' : ''}
        <div class="v-title">${g.title}</div>
        <div class="v-category">${g.category}</div>
        <!-- Progress Bar -->
        <div style="background:rgba(255,255,255,0.2); height:4px; border-radius:2px; margin-top:8px; overflow:hidden;">
            <div style="width:${g.progress || 0}%; height:100%; background:white;"></div>
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

window.handleCategoryFilter = function (category) {
  visionState.filter = category;
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
  const imgUrl = g.image_url || getDefaultImage(g);

  let daysBadge = '';
  if (g.target_date) {
    const d = getDaysLeft(g.target_date);
    const color = d < 0 ? '#EF4444' : '#10B981';
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
    <div style="background:#F9FAFB; padding:16px; border-radius:12px; font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:20px; max-height:150px; overflow-y:auto">
       ${g.notes || '<span style="color:#999">No notes added.</span>'}
    </div>
    <div style="font-size:12px; color:#999; margin-bottom:20px">
       Target Date: ${g.target_date || 'N/A'}
    </div>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
        <button class="btn" style="color:var(--primary); border-color:var(--primary)" onclick="openEditVision('${g.id}')"><i data-lucide="pencil" style="width:16px; margin-right:6px"></i> Edit Goal</button>
        <button class="btn" style="color:#EF4444; border-color:#EF4444" onclick="deleteVision('${g.id}')"><i data-lucide="trash-2" style="width:16px; margin-right:6px"></i> Delete Goal</button>
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
