/* view-vision.js - World-Class SaaS Vision Board */

// Vision State Management
let visionState = {
  view: 'grid',
  filter: 'focus', // default = Focus This Month
  search: '',
  sort: 'newest',
};

const VISION_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

function renderVision() {
  const goals = state.data.vision || [];
  let filtered = filterVisions(goals);
  filtered = sortVisions(filtered);
  const stats = calculateVisionStats(goals);

  document.getElementById('main').innerHTML = `
    <div class="vision-wrapper">

      <!-- ── Compact Header ── -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap">
        <div>
          <h2 class="page-title" style="margin:0; display:flex; align-items:center; gap:8px;">${renderIcon('target', null, 'style="width:28px;"')} Vision Board</h2>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${stats.total} goals · ${stats.active} active · ${stats.achieved} achieved</div>
        </div>
        <button class="btn primary" onclick="openVisionModal()">+ Add Goal</button>
      </div>

      <!-- ── Toolbar ── -->
      <div class="vision-toolbar">
        <div class="vision-filters" id="visionFilters">
          ${renderFilterChips()}
        </div>
      </div>

      <!-- ── View Toggle ── -->
      <div class="vision-view-tabs" style="margin-bottom:20px">
        <button class="vision-tab ${visionState.view === 'grid' ? 'active' : ''}" onclick="switchVisionView('grid')" title="Grid">
          ${renderIcon('grid', null, 'style="width:16px"')} Grid
        </button>
        <button class="vision-tab ${visionState.view === 'list' ? 'active' : ''}" onclick="switchVisionView('list')" title="List">
          ${renderIcon('list', null, 'style="width:16px"')} List
        </button>
        <button class="vision-tab ${visionState.view === 'timeline' ? 'active' : ''}" onclick="switchVisionView('timeline')" title="Timeline">
          ${renderIcon('calendar', null, 'style="width:16px"')} Timeline
        </button>
      </div>

      ${visionState.view === 'grid' ? renderVisionGrid(filtered) : ''}
      ${visionState.view === 'list' ? renderVisionList(filtered) : ''}
      ${visionState.view === 'timeline' ? renderVisionTimeline(filtered) : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function renderFilterChips() {
  const cats = ['focus', 'all', ...VISION_CATEGORIES];
  const labels = { focus: `${renderIcon('target', null, 'style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px;"')} Focus`, all: 'All' };
  return cats.map(c => `
    <button class="vision-filter-chip ${visionState.filter === c ? 'active' : ''}"
            onclick="setVisionFilter('${c}')">
      ${labels[c] || c}
    </button>
  `).join('');
}

function calculateVisionStats(goals) {
  const now = new Date();
  const currentYear = now.getFullYear();
  return {
    total: goals.length,
    active: goals.filter(g => g.status !== 'achieved').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    thisYear: goals.filter(g => g.target_date && new Date(g.target_date).getFullYear() === currentYear).length
  };
}

/* ─── GRID VIEW ─────────────────────────────────────────────────── */
function renderVisionGrid(goals) {
  const active = goals.filter(g => g.status !== 'achieved');
  const achieved = goals.filter(g => g.status === 'achieved');

  return `
    <div class="vision-grid">
      ${active.length === 0
      ? `<div class="vision-empty" style="grid-column:1/-1">
             <span class="vision-empty-icon">${renderIcon('target', null, 'style="width:40px; color:var(--text-muted);"')}</span>
             <div class="vision-empty-text">No active goals yet</div>
             <div class="vision-empty-sub">Add your first vision goal to get started</div>
           </div>`
      : active.map(g => renderVisionCard(g)).join('')}
    </div>

    ${achieved.length > 0 ? `
      <div class="vision-achieved-section">
        <div class="vision-achieved-label" style="display:flex; align-items:center; gap:6px;">
          ${renderIcon('trophy', null, 'style="width:18px; color:#F59E0B;"')} Achieved Goals (${achieved.length})
        </div>
        <div class="vision-grid" style="opacity:0.85">
          ${achieved.map(g => renderVisionCard(g, true)).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function renderVisionCard(g, isAchieved = false) {
  const bgUrl = g.video_url ? '' : (g.image_url ? sanitizeUrl(g.image_url) : getDefaultImage(g));
  const days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / 86400000) : null;

  let badge = '';
  if (isAchieved) {
    badge = `<div class="vision-card-badge achieved" style="display:flex; align-items:center; gap:4px;">${renderIcon('trophy', null, 'style="width:12px;"')} Achieved</div>`;
  } else if (days !== null) {
    const cls = days < 0 ? 'expired' : (days <= 30 ? 'urgent' : 'normal');
    badge = `<div class="vision-card-badge ${cls}">${days < 0 ? 'Ended' : days === 0 ? 'Today!' : days + 'd left'}</div>`;
  }

  const hasVideo = !!g.video_url;
  const mediaStyle = hasVideo
    ? `background:#111;`
    : `background-image:url('${bgUrl}')`;

  return `
    <div class="vision-card animate-enter" onclick="openVisionDetail('${g.id}')">
      <div class="vision-card-bg" style="${mediaStyle}">
        ${hasVideo ? `<video src="${sanitizeUrl(g.video_url)}" style="width:100%;height:100%;object-fit:cover" muted loop autoplay playsinline></video>` : ''}
      </div>
      <div class="vision-card-overlay"></div>
      <div class="vision-card-cat-tag">${g.category || 'Personal'}</div>
      ${hasVideo ? `<button class="vision-video-btn" onclick="event.stopPropagation();openVideoModal('${sanitizeUrl(g.video_url)}')">▶</button>` : ''}
      <div class="vision-card-content">
        ${badge}
        <div class="vision-card-title">${g.title}</div>
        ${g.target_date ? `<div class="vision-card-category">${formatDate(g.target_date)}</div>` : ''}
        <div class="vision-card-progress">
        <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
      </div>
    </div>
  `;
}

/* ─── LIST VIEW ─────────────────────────────────────────────────── */
function renderVisionList(goals) {
  if (goals.length === 0) return emptyState();
  return `<div class="vision-list">${goals.map(g => renderVisionListItem(g)).join('')}</div>`;
}

function renderVisionListItem(g) {
  const daysLeft = g.target_date ? getDaysLeft(g.target_date) : null;
  const isAchieved = g.status === 'achieved';
  const isPast = daysLeft !== null && daysLeft < 0;
  const badgeClass = isAchieved ? 'achieved' : (isPast ? 'past' : 'active');
  const badgeText = isAchieved ? `${renderIcon('trophy', null, 'style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"')} Done` : (daysLeft !== null ? (daysLeft < 0 ? 'Ended' : daysLeft + 'd') : '');

  const hasThumb = g.image_url || g.video_url;
  const thumbStyle = g.image_url ? `background-image:url('${sanitizeUrl(g.image_url)}'); background-size:cover; background-position:center;` : 'background:#111';

  return `
    <div class="vision-list-item" onclick="openVisionDetail('${g.id}')">
      ${hasThumb
      ? `<div class="vision-list-thumb" style="${thumbStyle}">
             ${g.video_url ? '<span style="color:white;font-size:18px;display:flex;align-items:center;justify-content:center;height:100%">▶</span>' : ''}
           </div>`
      : `<div class="vision-list-icon">${getCategoryEmoji(g.category)}</div>`}
      <div class="vision-list-content">
        <div class="vision-list-title">${g.title}</div>
        <div class="vision-list-cat">${g.category || 'Personal'}</div>
        <div class="vision-list-date">${g.target_date ? 'Target: ' + formatDate(g.target_date) : 'No deadline'}</div>
        <div class="vision-list-progress-wrap">
          <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
      </div>
      ${badgeText ? `<div class="vision-list-badge ${badgeClass}">${badgeText}</div>` : ''}
    </div>
  `;
}

/* ─── TIMELINE VIEW ─────────────────────────────────────────────── */
function renderVisionTimeline(goals) {
  if (goals.length === 0) return emptyState();
  const grouped = groupByYear(goals);
  return `
    <div class="vision-timeline">
      ${Object.keys(grouped).sort().map(year => `
        <div class="timeline-year-section">
          <div class="timeline-year-header" style="display:flex; align-items:center; gap:6px;">${renderIcon('calendar', null, 'style="width:16px;"')} ${year}</div>
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
  const isAchieved = g.status === 'achieved';

  return `
    <div class="timeline-item" onclick="openVisionDetail('${g.id}')">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${getCategoryEmoji(g.category)} ${g.title}</div>
        <div class="timeline-meta" style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
          ${g.target_date ? formatDate(g.target_date) : 'No deadline'}
          ${isAchieved ? ` • ${renderIcon('trophy', null, 'style="width:12px;"')} Achieved` : (daysLeft !== null ? ' • ' + Math.abs(daysLeft) + (daysLeft < 0 ? 'd ago' : 'd left') : '')}
        </div>
        <div class="timeline-progress">
          <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
      </div>
    </div>
  `;
}

/* ─── DETAIL MODAL ──────────────────────────────────────────────── */
window.openVisionDetail = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  const imgUrl = g.image_url ? sanitizeUrl(g.image_url) : getDefaultImage(g);
  const hasVideo = !!g.video_url;

  let daysBadge = '';
  if (g.status === 'achieved') {
    daysBadge = `<span class="vision-card-badge achieved">${renderIcon('trophy', null, 'style="width:14px;height:14px;margin-right:4px"')} Achieved</span>`;
  } else if (g.target_date) {
    const d = getDaysLeft(g.target_date);
    const color = d < 0 ? 'var(--danger)' : (d <= 30 ? 'var(--warning)' : 'var(--success)');
    daysBadge = `<span style="background:${color};color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">${d < 0 ? 'Goal date passed' : d === 0 ? 'Due today!' : d + ' days left'}</span>`;
  }

  box.innerHTML = `
    <div class="vision-detail-hero">
      ${hasVideo
      ? `<video src="${sanitizeUrl(g.video_url)}" style="width:100%;height:100%;object-fit:cover" controls></video>`
      : `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${getFallbackImage(g)}'">`}
      <div class="vision-detail-hero-overlay">
        <h2 class="vision-detail-title-text">${g.title}</h2>
      </div>
    </div>

    <div class="vision-detail-meta-row">
      <span class="pill">${g.category || 'General'}</span>
      ${daysBadge}
    </div>

    <div class="vision-detail-progress-section">
      <div class="vision-detail-progress-label">
        <span>Progress</span>
        <span style="color:var(--primary);font-weight:800">${g.progress || 0}%</span>
      </div>
      <div class="vision-detail-progress-bar-wrap">
        <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
      </div>
    </div>

    <div class="vision-detail-notes">
      ${g.notes || '<span style="color:var(--text-muted)">No notes added yet.</span>'}
    </div>

    ${g.target_date ? `<div style="display:flex; align-items:center; gap:6px; font-size:12px;color:var(--text-muted);margin-bottom:16px">${renderIcon('calendar', null, 'style="width:14px;"')} Target: ${formatDate(g.target_date)}</div>` : ''}

    <!-- Linked Habits -->
    ${(() => {
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          if (String(g.linked_habits).trim().startsWith('[')) {
            existingHabits = JSON.parse(g.linked_habits);
          } else {
            // Legacy fallback
            existingHabits = String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 0 }));
          }
        }
      } catch (e) { console.error("Error parsing linked habits in detail view", e); }

      const habits = state.data.habits || [];
      const linked = existingHabits.map(hObj => {
        const fullHabit = habits.find(h => String(h.id) === String(hObj.id));
        return fullHabit ? { ...fullHabit, target: hObj.target } : null;
      }).filter(Boolean);

      if (!linked.length) return '';
      return `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px; display:flex; align-items:center; gap:4px;">${renderIcon('link', null, 'style="width:14px;"')} Linked Habits</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${linked.map(h => `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:var(--primary-soft);color:var(--primary);font-size:13px;font-weight:600">
             ${h.habit_name} ${h.target > 0 ? `<span style="opacity:0.7;font-size:11px;">(Target: ${h.target})</span>` : ''}
          </span>`).join('')}
        </div>
      </div>`;
    })()}

    <!-- Linked Tasks -->
    ${(() => {
      const linkedTasks = (state.data.tasks || []).filter(t => String(t.vision_id) === String(g.id));
      if (linkedTasks.length === 0) return '';
      return `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px; display:flex; align-items:center; gap:4px;">${renderIcon('check-square', null, 'style="width:14px;"')} Linked Tasks</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${linkedTasks.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:var(--surface-2);font-size:13px;">
             <div style="width:8px;height:8px;border-radius:50%;background:${t.priority === 'P1' ? 'var(--danger)' : (t.priority === 'P2' ? 'var(--warning)' : 'var(--success)')}"></div>
             <span style="flex:1;${t.status === 'completed' ? 'text-decoration:line-through;opacity:0.6;' : ''}">${t.title}</span>
             <span style="font-size:10px;color:var(--text-muted);">${t.due_date || ''}</span>
          </div>`).join('')}
        </div>
      </div>`;
    })()}

    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden'); setTimeout(() => { openTaskModal(); setTimeout(() => { if(document.getElementById('mTaskVisionGoal')) document.getElementById('mTaskVisionGoal').value = '${g.id}'; }, 100); }, 300);" style="color:var(--primary);border-color:var(--primary); display:flex; align-items:center; gap:6px;">${renderIcon('add', null, 'style="width:14px;"')} Quick Task</button>
      ${hasVideo ? `<button class="btn" onclick="openVideoModal('${sanitizeUrl(g.video_url)}')" style="color:var(--primary);border-color:var(--primary); display:flex; align-items:center; gap:6px;">${renderIcon('play', null, 'style="width:14px;"')} Watch Video</button>` : ''}
      <button class="btn ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? 'success' : ''}" onclick="toggleVisionFocus('${g.id}')" style="display:flex; align-items:center; gap:6px; ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? '' : 'color:var(--text-2);border-color:var(--border-color)'}">${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? `${renderIcon('star', null, 'style="width:14px; fill:var(--warning); color:var(--warning);"')}` : `${renderIcon('star', null, 'style="width:14px;"')}`} ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? 'Month Focus' : 'Set Focus'}</button>
      <button class="btn" onclick="openEditVision('${g.id}')" style="color:var(--primary);border-color:var(--primary); display:flex; align-items:center; gap:6px;">${renderIcon('edit', null, 'style="width:14px;"')} Edit</button>
      <button class="btn" onclick="deleteVision('${g.id}')" style="color:var(--danger);border-color:var(--danger); display:flex; align-items:center; gap:6px;">${renderIcon('delete', null, 'style="width:14px;"')} Delete</button>
    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  modal.classList.remove('hidden');
};

/* ─── VIDEO MODAL ───────────────────────────────────────────────── */
window.openVideoModal = function (url) {
  const existing = document.getElementById('visionVideoModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'visionVideoModal';
  overlay.className = 'vision-video-modal';
  overlay.innerHTML = `
    <div class="vision-video-inner">
      <button class="vision-video-close" onclick="closeVideoModal()">✕</button>
      <video src="${url}" controls autoplay style="width:100%;border-radius:16px;outline:none;max-height:80vh"></video>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeVideoModal(); });
  document.body.appendChild(overlay);
};

window.closeVideoModal = function () {
  const modal = document.getElementById('visionVideoModal');
  if (modal) {
    const v = modal.querySelector('video');
    if (v) { v.pause(); v.src = ''; }
    modal.remove();
  }
};

/* ─── ADD / EDIT MODAL ──────────────────────────────────────────── */
window.openVisionModal = function () {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(null);
  modal.classList.remove('hidden');
  initVisionFormListeners();
};

window.openEditVision = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(g);
  modal.classList.remove('hidden');
  initVisionFormListeners();
};

function buildVisionForm(g) {
  const isEdit = !!g;
  return `
        < h3 style = "margin-bottom:16px;font-size:18px;font-weight:800; display:flex; align-items:center; gap:8px;" > ${isEdit ? renderIcon('edit', null, 'style="width:20px;"') + ' Edit Goal' : renderIcon('target', null, 'style="width:20px;"') + ' New Vision Goal'}</h3 >

          <input class="input" id="mVisTitle" placeholder="Goal Title *" value="${isEdit ? escH(g.title) : ''}">

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <select class="input" id="mVisCat">
                ${VISION_CATEGORIES.map(c => `<option value="${c}" ${isEdit && g.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <input type="date" class="input" id="mVisDate" value="${isEdit ? (g.target_date || '') : ''}">
            </div>

            <div style="margin-bottom:10px">
              <label style="font-size:13px;font-weight:600;color:var(--text-2);display:flex;justify-content:space-between;margin-bottom:8px">
                <span>Progress ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ? '(Auto-calculated from habits)' : ''}</span>
                <strong id="mVisProgressVal" style="color:var(--primary)">${isEdit ? (g.progress || 0) : 0}%</strong>
              </label>
              <input type="range" id="mVisProgress" min="0" max="100" value="${isEdit ? (g.progress || 0) : 0}"
                ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ? 'disabled' : ''}
                oninput="document.getElementById('mVisProgressVal').textContent = this.value + '%'"
                style="-webkit-appearance:none;appearance:none;width:calc(100% - 4px);display:block;margin:0 2px;height:6px;border-radius:3px;background:var(--surface-3);outline:none;cursor:${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ? 'not-allowed; opacity: 0.5' : 'pointer'}">
            </div>

            <textarea class="input" id="mVisNotes" placeholder="Notes (optional)" style="height:80px;resize:vertical">${isEdit ? escH(g.notes || '') : ''}</textarea>

            <!-- Media Attachment Tabs -->
            <div style="margin-top:14px;margin-bottom:6px;font-size:13px;font-weight:700;color:var(--text-2); display:flex; align-items:center; gap:4px;">${renderIcon('image', null, 'style="width:14px;"')} Attach Media</div>
            <div class="vision-modal-tabs">
              <button class="vision-modal-tab active" id="vTabImg" onclick="switchVisionMediaTab('image')" style="display:flex; align-items:center; gap:4px; justify-content:center;">${renderIcon('image', null, 'style="width:14px;"')} Image</button>
              <button class="vision-modal-tab" id="vTabUrl" onclick="switchVisionMediaTab('url')" style="display:flex; align-items:center; gap:4px; justify-content:center;">${renderIcon('link', null, 'style="width:14px;"')} Image URL</button>
              <button class="vision-modal-tab" id="vTabVid" onclick="switchVisionMediaTab('video')" style="display:flex; align-items:center; gap:4px; justify-content:center;">${renderIcon('play', null, 'style="width:14px;"')} Video</button>
            </div>

            <!-- Image Upload -->
            <div id="vPanelImg">
              <div class="vision-upload-zone" id="vImgZone" onclick="document.getElementById('vImgInput').click()">
                <input type="file" id="vImgInput" accept="image/*" hidden onchange="handleVisionMedia(this.files,'image')">
                  <span class="vision-upload-icon">${renderIcon('image', null, 'style="width:32px; color:var(--text-muted);"')}</span>
                  <div style="font-weight:600;margin-bottom:4px">Tap to select image</div>
                  <div class="vision-upload-hint">PNG, JPG, WebP · Max 8 MB</div>
              </div>
              <div id="vImgPreviewWrap" class="vision-media-preview" style="display:none">
                <img id="vImgPreview" src="" alt="preview">
                  <button class="vision-media-remove" onclick="clearVisionMedia('image')">✕</button>
              </div>
              ${isEdit && g.image_url && !g.image_url.startsWith('data:') ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">Current: <a href="${escH(g.image_url)}" target="_blank" style="color:var(--primary)">Open existing image</a></p>` : ''}
            </div>

            <!-- URL Tab -->
            <div id="vPanelUrl" style="display:none">
              <input type="url" id="mVisImg" class="input" placeholder="https://example.com/image.jpg" value="${isEdit ? escH(g?.image_url?.startsWith('data:') ? '' : (g.image_url || '')) : ''}">
            </div>

            <!-- Video Upload -->
            <div id="vPanelVid" style="display:none">
              <div class="vision-upload-zone" id="vVidZone" onclick="document.getElementById('vVidInput').click()">
                <input type="file" id="vVidInput" accept="video/*" hidden onchange="handleVisionMedia(this.files,'video')">
                  <span class="vision-upload-icon">${renderIcon('video', null, 'style="width:32px;height:32px;"')}</span>
                  <div style="font-weight:600;margin-bottom:4px">Tap to select video from storage</div>
                  <div class="vision-upload-hint">MP4, MOV, WebM · Max 200 MB</div>
              </div>
              <div id="vVidPreviewWrap" class="vision-media-preview" style="display:none">
                <video id="vVidPreview" src="" controls style="width:100%;border-radius:12px;max-height:200px"></video>
                <button class="vision-media-remove" onclick="clearVisionMedia('video')">✕</button>
              </div>
              ${isEdit && g.video_url ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">Current video attached. Upload new to replace.</p>` : ''}
            </div>

            <!-- Habit Linker -->
            <div style="margin-top:14px">
              <div style="font-size:13px;font-weight:700;color:var(--text-2);margin-bottom:8px">${renderIcon('link', null, 'style="width:16px;height:16px;margin-right:4px"')} Link Habits</div>
              <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;padding:2px 0">
                ${(() => {
      const habits = state.data.habits || [];
      // Support legacy string format ("id1,id2") or new JSON format [{"id":"id1", "target":25, "startDate":"2026..."}]
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          if (String(g.linked_habits).trim().startsWith('[')) {
            existingHabits = JSON.parse(g.linked_habits);
          } else {
            // Legacy fallback
            existingHabits = String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 0 }));
          }
        }
      } catch (e) { console.error("Error parsing linked habits", e); }

      const existingIds = existingHabits.map(h => String(h.id));

      if (!habits.length) return '<span style="font-size:13px;color:var(--text-muted)">No habits found. Add habits first.</span>';
      return habits.map(h => {
        const isLinked = existingIds.includes(String(h.id));
        const linkedData = isLinked ? existingHabits.find(ex => String(ex.id) === String(h.id)) : null;
        const targetVal = linkedData && linkedData.target ? linkedData.target : 25;

        return `
            <div style="display:flex; flex-direction:column; gap:4px; padding:8px 12px; background:var(--surface-2); border-radius:10px; margin-bottom:4px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="vHabitLink_${h.id}" value="${h.id}" ${isLinked ? 'checked' : ''} onchange="document.getElementById('vHabitTargetWrap_${h.id}').style.display = this.checked ? 'flex' : 'none'" style="width:16px;height:16px;accent-color:var(--primary)">
                <span style="font-size:14px;font-weight:600">${h.habit_name}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${h.category || ''}</span>
              </label>
              <div id="vHabitTargetWrap_${h.id}" style="display:${isLinked ? 'flex' : 'none'}; align-items:center; justify-content:space-between; margin-top:4px; padding-left:26px;">
                <span style="font-size:12px; color:var(--text-muted);">Target Recurrence:</span>
                <input type="number" id="vHabitTarget_${h.id}" value="${targetVal}" min="1" style="width:60px; padding:4px 8px; border-radius:6px; border:1px solid var(--border-color); background:var(--surface-1); font-size:12px;">
              </div>
            </div>
          `;
      }).join('');
    })()
    }
              </div>
            </div>

            <!-- Month Focus -->
            <label style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:10px 14px;background:var(--surface-2);border-radius:12px;cursor:pointer">
              <input type="checkbox" id="mVisMonthFocus" ${isEdit && (g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE') ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary)">
                <div>
                  <div style="font-size:13px;font-weight:700">⭐ Focus This Month</div>
                  <div style="font-size:11px;color:var(--text-muted)">Pin this goal to the Focus view</div>
                </div>
            </label>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap">
              <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
              ${isEdit && g.status !== 'achieved' ? `<button class="btn success" onclick="markVisionAchieved('${g.id}')">${renderIcon('trophy', null, 'style="width:16px;height:16px;margin-right:4px"')} Mark Achieved</button>` : ''}
              <button class="btn primary" data-action="${isEdit ? 'update-vision-modal' : 'save-vision-modal'}" ${isEdit ? `data-edit-id="${g.id}"` : ''}>
                ${isEdit ? 'Update Goal' : 'Save Goal'}
              </button>
            </div>
            `;
}

function initVisionFormListeners() {
  // Drag & drop for image
  const imgZone = document.getElementById('vImgZone');
  if (imgZone) {
    imgZone.addEventListener('dragover', e => { e.preventDefault(); imgZone.classList.add('drag-over'); });
    imgZone.addEventListener('dragleave', () => imgZone.classList.remove('drag-over'));
    imgZone.addEventListener('drop', e => {
      e.preventDefault();
      imgZone.classList.remove('drag-over');
      handleVisionMedia(e.dataTransfer.files, 'image');
    });
  }
  // Drag & drop for video
  const vidZone = document.getElementById('vVidZone');
  if (vidZone) {
    vidZone.addEventListener('dragover', e => { e.preventDefault(); vidZone.classList.add('drag-over'); });
    vidZone.addEventListener('dragleave', () => vidZone.classList.remove('drag-over'));
    vidZone.addEventListener('drop', e => {
      e.preventDefault();
      vidZone.classList.remove('drag-over');
      handleVisionMedia(e.dataTransfer.files, 'video');
    });
  }
}

window.switchVisionMediaTab = function (tab) {
  const tabs = { image: 'vPanelImg', url: 'vPanelUrl', video: 'vPanelVid' };
  const btns = { image: 'vTabImg', url: 'vTabUrl', video: 'vTabVid' };
  Object.entries(tabs).forEach(([key, panelId]) => {
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = key === tab ? 'block' : 'none';
  });
  Object.entries(btns).forEach(([key, btnId]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.toggle('active', key === tab);
  });
  window._visionMediaTab = tab;
};

window.handleVisionMedia = function (files, type) {
  const file = files[0];
  if (!file) return;

  const maxSize = type === 'video' ? 200 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast(`File too large. Max ${type === 'video' ? '200 MB' : '8 MB'}`, 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    if (type === 'image') {
      window._visionPendingImage = { data, filename: file.name, type: file.type };
      const preview = document.getElementById('vImgPreview');
      const wrap = document.getElementById('vImgPreviewWrap');
      if (preview) preview.src = data;
      if (wrap) wrap.style.display = 'block';
    } else {
      window._visionPendingVideo = { data, filename: file.name, type: file.type, size: file.size };
      const preview = document.getElementById('vVidPreview');
      const wrap = document.getElementById('vVidPreviewWrap');
      if (preview) { preview.src = data; preview.load(); }
      if (wrap) wrap.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

window.clearVisionMedia = function (type) {
  if (type === 'image') {
    window._visionPendingImage = null;
    const preview = document.getElementById('vImgPreview');
    const wrap = document.getElementById('vImgPreviewWrap');
    if (preview) preview.src = '';
    if (wrap) wrap.style.display = 'none';
  } else {
    window._visionPendingVideo = null;
    const preview = document.getElementById('vVidPreview');
    const wrap = document.getElementById('vVidPreviewWrap');
    if (preview) { preview.pause(); preview.src = ''; }
    if (wrap) wrap.style.display = 'none';
  }
};

// Shared helper to collect payload from the modal
function collectVisionPayload() {
  const tab = window._visionMediaTab || 'image';
  let image_url = '';
  let video_url = '';

  if (tab === 'image' && window._visionPendingImage) {
    image_url = window._visionPendingImage.data;
  } else if (tab === 'url') {
    const urlEl = document.getElementById('mVisImg');
    if (urlEl) image_url = urlEl.value;
  } else if (tab === 'video' && window._visionPendingVideo) {
    video_url = window._visionPendingVideo.data;
  }

  // Collect linked habits (checked checkboxes)
  const linkedHabitsDocs = Array.from(document.querySelectorAll('[id^="vHabitLink_"]:checked')).map(cb => {
    const id = cb.value;
    const targetInput = document.getElementById(`vHabitTarget_${id}`);
    const target = targetInput ? parseInt(targetInput.value, 10) || 25 : 25;

    // We need to fetch the existing start date if this was already linked, otherwise use today
    let startDate = new Date().toISOString().slice(0, 10);
    try {
      const existingBtn = document.querySelector('[data-action="update-vision-modal"]');
      if (existingBtn && existingBtn.dataset.editId) {
        const g = state.data.vision.find(v => String(v.id) === String(existingBtn.dataset.editId));
        if (g && g.linked_habits && g.linked_habits.startsWith('[')) {
          const parsed = JSON.parse(g.linked_habits);
          const existing = parsed.find(ex => String(ex.id) === String(id));
          if (existing && existing.startDate) startDate = existing.startDate;
        }
      }
    } catch (e) { }

    return { id, target, startDate };
  });

  const linkedHabits = JSON.stringify(linkedHabitsDocs);
  const monthFocus = document.getElementById('mVisMonthFocus')?.checked || false;

  return {
    title: document.getElementById('mVisTitle').value.trim(),
    category: document.getElementById('mVisCat').value,
    target_date: document.getElementById('mVisDate').value,
    notes: document.getElementById('mVisNotes').value,
    progress: parseInt(document.getElementById('mVisProgress').value, 10),
    image_url,
    video_url,
    month_focus: monthFocus,
    linked_habits: linkedHabits,
  };
}

// Universal modal click handler
document.addEventListener('click', async function (event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'save-vision-modal') {
    const payload = collectVisionPayload();
    if (!payload.title) { showToast('Title is required!', 'error'); return; }
    payload.status = 'active';
    showToast('Saving goal…');
    await apiCall('post', 'vision_board', payload);
    document.getElementById('universalModal').classList.add('hidden');
    window._visionPendingImage = null;
    window._visionPendingVideo = null;
    await refreshData('vision');
    showToast('Vision goal added! ' + renderIcon('target', null, 'style="width:16px;height:16px;margin-right:4px"'));
  } else if (btn.dataset.action === 'update-vision-modal') {
    const id = btn.dataset.editId;
    const payload = collectVisionPayload();
    if (!payload.title) { showToast('Title is required!', 'error'); return; }
    showToast('Updating…');
    await apiCall('update', 'vision_board', payload, id);
    document.getElementById('universalModal').classList.add('hidden');
    window._visionPendingImage = null;
    window._visionPendingVideo = null;
    await refreshData('vision');
    showToast('Vision goal updated! ✅');
  }
});

/* ─── ACTIONS ───────────────────────────────────────────────────── */
window.toggleVisionFocus = async function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  const newFocus = !(g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE');
  g.month_focus = newFocus; // optimistic
  document.getElementById('universalModal').classList.add('hidden');
  await apiCall('update', 'vision_board', { month_focus: newFocus }, id);
  await refreshData('vision');
  showToast(newFocus ? '⭐ Goal set as Month Focus!' : 'Focus removed');
};

window.deleteVision = async function (id) {

  if (confirm('Delete this vision goal?')) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('delete', 'vision_board', {}, id);
    await refreshData('vision');
    showToast('Goal deleted');
  }
};

window.markVisionAchieved = async function (id) {
  if (confirm('Mark this goal as achieved? ' + renderIcon('trophy', null, 'style="width:16px;height:16px;margin-right:4px"'))) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('update', 'vision_board', { status: 'achieved', progress: 100 }, id);
    await refreshData('vision');
    showToast(renderIcon('trophy', null, 'style="width:16px;height:16px;margin-right:4px"') + ' Goal marked as achieved!');
  }
};

/* ─── EVENT HANDLERS ─────────────────────────────────────────────  */
window.setVisionFilter = function (cat) {
  visionState.filter = cat;
  renderVision();
};

window.switchVisionView = function (view) {
  visionState.view = view;
  renderVision();
};

window.handleVisionSort = function (sortType) {
  visionState.sort = sortType;
  renderVision();
};

/* ─── HELPERS ───────────────────────────────────────────────────── */
function filterVisions(goals) {
  let filtered = [...goals];
  if (visionState.filter === 'focus') {
    filtered = filtered.filter(g => g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE');
  } else if (visionState.filter !== 'all') {
    filtered = filtered.filter(g => g.category === visionState.filter);
  }
  if (visionState.search) {
    const q = visionState.search.toLowerCase();
    filtered = filtered.filter(g =>
      g.title.toLowerCase().includes(q) || (g.notes && g.notes.toLowerCase().includes(q))
    );
  }
  return filtered;
}

function sortVisions(goals) {
  const s = [...goals];
  switch (visionState.sort) {
    case 'newest': return s.reverse();
    case 'oldest': return s;
    case 'closest': return s.sort((a, b) => (!a.target_date ? 1 : !b.target_date ? -1 : new Date(a.target_date) - new Date(b.target_date)));
    case 'furthest': return s.sort((a, b) => (!a.target_date ? 1 : !b.target_date ? -1 : new Date(b.target_date) - new Date(a.target_date)));
    case 'az': return s.sort((a, b) => a.title.localeCompare(b.title));
    default: return s;
  }
}

function groupByYear(goals) {
  const grouped = {};
  goals.forEach(g => {
    const key = g.target_date ? new Date(g.target_date).getFullYear() : 'No Deadline';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(g);
  });
  return grouped;
}

function getCategoryEmoji(category) {
  const map = {
    Personality: 'star', Ouro: 'gem', Work: 'briefcase',
    Enjoyment: 'sparkles', Routine: 'repeat'
  };
  const iconName = map[category] || 'target';
  return renderIcon(iconName, null, 'class="v-cat-icon"');
}

function sanitizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // base64 blob - leave as-is
  return url.replace(/^http:\/\//i, 'https://');
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysLeft(target) {
  return Math.ceil((new Date(target) - new Date()) / 86400000);
}

function emptyState() {
  return `<div class="vision-empty">
              <span class="vision-empty-icon">${renderIcon('target', null, 'style="width:48px;height:48px;"')}</span>
              <div class="vision-empty-text">No goals found</div>
              <div class="vision-empty-sub">Try changing your filter or adding a new goal</div>
            </div>`;
}

function escH(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getDefaultImage(g) {
  const categoryImages = {
    Personality: [
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80'
    ],
    Ouro: [
      'https://images.unsplash.com/photo-1553729459-ead63e3c0ad4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1516567727245-ad8c68f3ec93?auto=format&fit=crop&w=600&q=80'
    ],
    Work: [
      'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'
    ],
    Enjoyment: [
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80'
    ],
    Routine: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
    ]
  };
  const defaults = [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  ];
  const images = categoryImages[g.category] || defaults;
  const hash = (g.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return images[hash % images.length];
}


function getFallbackImage(g) {
  return 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80';
}

// Legacy compat
window.openVisionImageSheet = window.openVisionModal;
window.playVisionVideo = window.openVideoModal;
window.stopVisionVideo = window.closeVideoModal;
window.sendUpcomingHabitSummary = window.sendUpcomingHabitSummary || function () { };
