/* view-vision.js - World-Class SaaS Vision Board */

/* ─── LOCAL MEDIA STORAGE (IndexedDB) ─────────────────────────────────────
   Images & Videos are stored on-device in IndexedDB.
   Google Sheets only stores a small reference key: "local://key" or "local-img://key".
   ArrayBuffers are used because they serialize reliably in WKWebView IndexedDB.
   ─────────────────────────────────────────────────────────────────────────── */
const _VisionIDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('VisionMedia', 2);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
      };
      r.onsuccess = e => { this._db = e.target.result; res(this._db); };
      r.onerror = e => rej(e.target.error);
    });
  },
  async put(key, obj) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(obj, key);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(key);
      req.onsuccess = e => res(e.target.result || null);
      req.onerror = e => rej(e.target.error);
    });
  },
  async del(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(key);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  }
};

// In-memory cache: key → objectURL (or base64 for legacy)
window._visionMediaCache = window._visionMediaCache || {};

// Read stored {type, buffer} from IDB and return an objectURL
async function _idbToObjectUrl(stored) {
  if (!stored) return null;
  if (typeof stored === 'string') return stored; // legacy base64
  if (stored.buffer) {
    const type = stored.type || 'video/mp4';
    const blob = new Blob([stored.buffer], { type: type });
    return { url: URL.createObjectURL(blob), type: type };
  }
  if (stored instanceof Blob) return { url: URL.createObjectURL(stored), type: stored.type };
  return null;
}

// Resolve a local:// or local-img:// reference to a usable URL (async)
// This ensures we always have a valid Blob URL even if the page was refreshed or memory cleared.
async function resolveMediaUrlAsync(url) {
  if (!url) return '';
  if (url.startsWith('local://') || url.startsWith('local-img://')) {
    const isImg = url.includes('local-img://');
    const key = isImg ? url.slice(12) : url.slice(8);

    // Check in-memory cache first
    if (window._visionMediaCache[key]) return window._visionMediaCache[key];

    // Otherwise, fetch from IDB and create new Blob URL
    try {
      const stored = await _VisionIDB.get(key);
      const res = await _idbToObjectUrl(stored);
      if (res && res.url) {
        window._visionMediaCache[key] = res.url;
        return res.url;
      }
    } catch (e) {
      console.warn('Async media resolution failed for:', key, e);
    }
    return '';
  }
  return sanitizeUrl(url);
}

/**
 * Robustly initialize video elements by reading data-vision-local attribute.
 * This is necessary because <script> tags in innerHTML do NOT execute.
 */
async function initVisionMediaElements(container = document) {
  const vids = container.querySelectorAll('video[data-vision-local]');
  for (const vid of vids) {
    const url = vid.getAttribute('data-vision-local');
    if (url && url.startsWith('local://')) {
      const blobUrl = await resolveMediaUrlAsync(url);
      if (blobUrl) {
        vid.src = blobUrl;
        vid.load();
        if (vid.hasAttribute('autoplay')) {
          vid.play().catch(e => console.warn('Autoplay failed', e));
        }
      }
    }
  }
}

// Legacy sync version for places where async is not yet supported
function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('local://') || url.startsWith('local-img://')) {
    const key = url.includes('local-img://') ? url.slice(12) : url.slice(8);
    return window._visionMediaCache[key] || '';
  }
  return sanitizeUrl(url);
}

// Pre-load ALL local media from IDB into memory before rendering
async function preloadLocalMedia(goals) {
  for (const g of (goals || [])) {
    // Video
    if (g.video_url) {
      const vids = g.video_url.split(',').map(s => s.trim()).filter(Boolean);
      for (const v of vids) {
        if (v.startsWith('local://')) {
          const key = v.slice(8);
          if (!window._visionMediaCache[key]) {
            try {
              const stored = await _VisionIDB.get(key);
              const res = await _idbToObjectUrl(stored);
              if (res && res.url) window._visionMediaCache[key] = res.url;
            } catch (e) { console.warn('IDB video load failed', key, e); }
          }
        }
      }
    }
    // Image
    if (g.image_url && g.image_url.startsWith('local-img://')) {
      const key = g.image_url.slice(12);
      if (!window._visionMediaCache[key]) {
        try {
          const stored = await _VisionIDB.get(key);
          const res = await _idbToObjectUrl(stored);
          if (res && res.url) window._visionMediaCache[key] = res.url;
        } catch (e) { console.warn('IDB image load failed', key, e); }
      }
    }
  }
}



// Vision State Management
let visionState = {
  view: 'grid',
  filter: 'focus', // default = Focus This Month
  search: '',
  sort: 'newest',
};

const VISION_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

async function renderVision() {
  await checkAndAutoRenewTDP();
  const goals = state.data.vision || [];
  await preloadLocalMedia(goals);
  let filtered = filterVisions(goals);
  filtered = sortVisions(filtered);
  const stats = calculateVisionStats(goals);

  const activeTDP = await getActiveTDP();
  const tdpInfo = getTDPDayInfo(activeTDP);
  const tdpProg = calculateTDPProgress(activeTDP);

  let tdpHtml = `
    <div class="tdp-header-row animate-enter">
      <button class="tdp-btn" onclick="openTDPModal()">
        <span class="tdp-btn-label">10 Days Plan</span>
        <span class="tdp-btn-status">${activeTDP ? 'Day ' + tdpInfo.day : 'Start TDP'}</span>
      </button>
      <div class="tdp-progress-wrap">
        <div class="tdp-progress-meta">
          <span>${activeTDP ? tdpProg.percentage + '% Complete' : 'Planning block not started'}</span>
          <span>${activeTDP ? tdpInfo.remaining + ' days left' : ''}</span>
        </div>
        <div class="tdp-progress-bar">
          <div class="tdp-progress-fill" style="width: ${activeTDP ? tdpProg.percentage : 0}%"></div>
        </div>
      </div>
    </div>
  `;

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

      ${tdpHtml}

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
  initVisionMediaElements(document.getElementById('main'));
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
  const videoUrls = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const firstVideo = videoUrls.length > 0 ? videoUrls[0] : null;
  const hasVideo = !!firstVideo;
  const bgUrl = hasVideo ? '' : (g.image_url ? resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url) : getDefaultImage(g));
  const days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / 86400000) : null;

  let badge = '';
  if (isAchieved) {
    badge = `<div class="vision-card-badge achieved" style="display:flex; align-items:center; gap:4px;">${renderIcon('trophy', null, 'style="width:12px;"')} Achieved</div>`;
  } else if (days !== null) {
    const cls = days < 0 ? 'expired' : (days <= 30 ? 'urgent' : 'normal');
    badge = `<div class="vision-card-badge ${cls}">${days < 0 ? 'Ended' : days === 0 ? 'Today!' : days + 'd left'}</div>`;
  }

  const cardId = `vision-card-${g.id}`;
  const mediaId = `vision-card-media-${g.id}`;

  // Set placeholder background initially
  const mediaStyle = hasVideo ? `background:#111;` : `background-image:url('${bgUrl}')`;

  // Auto-resolve local media after rendering
  if (g.image_url && g.image_url.startsWith('local-img://')) {
    setTimeout(async () => {
      const resolved = await resolveMediaUrlAsync(g.image_url);
      const el = document.getElementById(mediaId);
      if (el && resolved) el.style.backgroundImage = `url('${resolved}')`;
    }, 0);
  }

  return `
    <div class="vision-card animate-enter" id="${cardId}" onclick="openVisionDetail('${g.id}')">
      <div class="vision-card-bg" id="${mediaId}" style="${mediaStyle}">
        ${hasVideo ? `<video id="video-${g.id}" style="width:100%;height:100%;object-fit:cover" muted loop autoplay playsinline webkit-playsinline preload="auto" poster="${g.image_url ? resolveMediaUrl(g.image_url) : ''}" data-vision-local="${firstVideo}">
        </video>` : ''}
      </div>
      <div class="vision-card-overlay"></div>
      <div class="vision-card-cat-tag">${g.category || 'Personal'}</div>
      ${hasVideo ? `<button class="vision-video-btn" onclick="event.stopPropagation();openVideoModal('${firstVideo}')">▶</button>` : ''}
      <div class="vision-card-content">
        ${badge}
        <div class="vision-card-title">${g.title}</div>
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

  const vids = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hasThumb = g.image_url || vids.length > 0;
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
window.openVisionDetail = async function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;

  // Preload media for this vision before showing modal
  if (g.video_url || g.image_url) {
    await preloadLocalMedia([g]);
  }

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  const imgUrl = g.image_url ? (resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url)) : getDefaultImage(g);
  const videoUrls = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hasVideo = videoUrls.length > 0;
  const hasImage = !hasVideo && g.image_url;

  // Status badges
  let statusBadge = '';
  if (g.status === 'achieved') {
    statusBadge = `<span class="vision-card-badge achieved" style="display:inline-flex;align-items:center;gap:4px;">${renderIcon('trophy', null, 'style="width:12px;"')} Achieved</span>`;
  } else if (g.target_date) {
    const d = getDaysLeft(g.target_date);
    const color = d < 0 ? 'var(--danger)' : (d <= 30 ? 'var(--warning)' : 'var(--success)');
    statusBadge = `<span style="background:${color};color:white;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">${d < 0 ? 'Ended' : d === 0 ? 'Today!' : d + 'd left'}</span>`;
  }

  // Timeline info
  const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
  const updatedDate = g.updated_at ? new Date(g.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown');

  // Generate video gallery dots
  const videoDots = videoUrls.length > 1 ? `
    <div style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:10; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:20px; backdrop-filter:blur(4px);">
      ${videoUrls.map((u, i) => `
        <button onclick="event.stopPropagation(); scrollToVideo(${i})"
          class="vision-dot-btn ${i === 0 ? 'active' : ''}"
          title="Video ${i + 1}"></button>
      `).join('')}
    </div>
  ` : '';

  // Progress color based on percentage
  const progress = g.progress || 0;
  const progressColor = progress >= 100 ? 'var(--success)' : (progress >= 50 ? 'var(--primary)' : 'var(--warning)');

  // 📝 NEW: Habit Scorecard calculation for Vision Header
  let totalCompletions = 0;
  let totalTarget = 0;
  try {
    if (g && g.linked_habits) {
      let existingHabits = [];
      if (String(g.linked_habits).trim().startsWith('[')) {
        existingHabits = JSON.parse(g.linked_habits);
      } else {
        existingHabits = String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 0 }));
      }
      existingHabits.forEach(hConfig => {
        if (hConfig.target > 0) {
          totalTarget += hConfig.target;
          const startEpoch = new Date(hConfig.startDate || 0).getTime();
          (state.data.habit_logs || []).forEach(log => {
            if (String(log.habit_id) === String(hConfig.id) && log.completed) {
              const logEpoch = new Date(log.date).getTime();
              if (logEpoch >= startEpoch) totalCompletions++;
            }
          });
        }
      });
    }
  } catch (e) { console.error("Error calculating habit scorecard", e); }

  const habitScorecardHtml = totalTarget > 0 ? `
    <div class="vision-habit-scorecard" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => routeTo('habits'), 100);" title="View Habits">
      <div class="vision-scorecard-value">
        ${renderIcon('check-circle', null, 'style="width:14px; color:var(--success)"')}
        ${totalCompletions}/${totalTarget}
      </div>
      <div class="vision-scorecard-label">Score</div>
    </div>
  ` : '';


  box.innerHTML = `
    <!-- Top Header (With Actions) -->
    <div class="vision-detail-modal-header">
      <div class="vision-header-info">
        <div class="vision-detail-modal-title">${g.title}</div>
        <div class="vision-detail-modal-meta">
          <span style="background:var(--primary); color:white; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${g.category || 'General'}</span>
          ${statusBadge}
        </div>
      </div>
      <div class="vision-header-actions" style="display:flex; flex-direction:column; align-items:center;">
        <div style="display:flex; gap:8px;">
          <button class="vision-header-icon-btn edit" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => openEditVision('${g.id}'), 100);" title="Edit">
            ${renderIcon('edit', null, 'style="width:18px;"')}
          </button>
          <button class="vision-header-icon-btn delete" onclick="event.stopPropagation(); if(confirm('Delete?')) { closeVisionDetail(); setTimeout(() => deleteVision('${g.id}'), 100); }" title="Delete">
            ${renderIcon('trash', null, 'style="width:18px;"')}
          </button>
          ${g.status !== 'achieved' ? `
          <button class="vision-header-icon-btn achieve" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => markVisionAchieved('${g.id}'), 100);" title="Finish">
            ${renderIcon('trophy', null, 'style="width:18px;"')}
          </button>
          ` : ''}
        </div>
        ${habitScorecardHtml}
      </div>
    </div>

    <!-- Media Section (Dedicated Container) -->
    <div class="vision-detail-media-container" style="background:#000;">
      ${hasVideo
      ? `<div style="width:100%; height:100%; position:relative;">
          <div class="vision-video-gallery" id="visionGallery-${g.id}">
            ${videoUrls.map((u, i) => {
        const videoId = `vision-detail-video-${g.id}-${i}`;
        return `
              <div class="vision-video-slide">
                <video id="${videoId}" 
                       style="width:100%;height:100%;object-fit:cover;" 
                       playsinline webkit-playsinline 
                       loop 
                       muted
                       autoplay
                       preload="auto" 
                       onclick="const v=this; v.paused?v.play():v.pause();"
                       poster="${g.image_url ? resolveMediaUrl(g.image_url) : ''}" 
                       data-vision-local="${u}"></video>
                
                <!-- Audio Toggle Button -->
                <button class="vision-video-audio-btn" 
                        onclick="event.stopPropagation(); toggleVisionAudio('${videoId}', this);">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                </button>

                <!-- Captions Overlay (Notes) -->
                ${g.notes ? `
                <div class="vision-video-captions">
                  ${g.notes}
                </div>
                ` : ''}
              </div>`;
      }).join('')}
          </div>
          ${videoUrls.length > 1 ? `
            <!-- Tap Navigation Overlays (Invisible) -->
            <div style="position:absolute; inset:0; display:flex; z-index:25;">
              <div onclick="event.stopPropagation(); navigateVisionGallery(-1);" style="flex:1; cursor:pointer;" aria-label="Previous"></div>
              <div onclick="event.stopPropagation(); toggleCurrentVisionVideo();" style="flex:1.4; cursor:pointer;" aria-label="Play/Pause"></div>
              <div onclick="event.stopPropagation(); navigateVisionGallery(1);" style="flex:1; cursor:pointer;" aria-label="Next"></div>
            </div>
          ` : ''}
          ${videoDots}
        </div>`
      : `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${getFallbackImage(g)}'">`}
    </div>

    <!-- Entrance Animation Progress Bar (Below Video) -->
    <div class="vision-detail-progress-section">
      <div class="vision-thick-progress-container">
        <div id="visionDetailProgressFill" class="vision-progress-fill" style="width:0%; background:linear-gradient(90deg, ${progressColor} 0%, ${progressColor}cc 100%);"></div>
        <span id="visionDetailProgressText" class="vision-progress-text">0%</span>
      </div>
    </div>

    <!-- Content Sections -->
    <div style="padding: 0 24px 24px;">

      <!-- Timeline & Info -->
      <div style="display:flex; gap:20px; margin-bottom:20px; flex-wrap:wrap;">
        ${createdDate !== 'Unknown' ? `
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
          ${renderIcon('calendar', null, 'style="width:14px;"')}
          <span>Created: <strong style="color:var(--text-2);">${createdDate}</strong></span>
        </div>` : ''}
        ${updatedDate !== 'Unknown' && updatedDate !== createdDate ? `
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
          ${renderIcon('clock', null, 'style="width:14px;"')}
          <span>Updated: <strong style="color:var(--text-2);">${updatedDate}</strong></span>
        </div>` : ''}
      </div>

    <!-- Linked Habits - Enhanced -->
    ${(() => {
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          if (String(g.linked_habits).trim().startsWith('[')) {
            existingHabits = JSON.parse(g.linked_habits);
          } else {
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
      <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          ${renderIcon('link', null, 'style="width:14px;"')} Linked Habits
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${linked.map(h => `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:var(--surface-3);">
              <div style="width:8px; height:8px; border-radius:50%; background:var(--primary);"></div>
              <span style="flex:1; font-size:14px; font-weight:600; color:var(--text-1);">${h.habit_name}</span>
              ${h.target > 0 ? `<span style="font-size:12px; color:var(--text-muted);">Target: ${h.target}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    })()}

    <!-- Linked Tasks - Enhanced -->
    ${(() => {
      const linkedTasks = (state.data.tasks || []).filter(t => String(t.vision_id) === String(g.id));
      if (linkedTasks.length === 0) return '';
      return `
      <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          ${renderIcon('check-square', null, 'style="width:14px;"')} Linked Tasks
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${linkedTasks.map(t => `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:var(--surface-3);">
              <div style="width:8px; height:8px; border-radius:50%; background:${t.priority === 'P1' ? 'var(--danger)' : (t.priority === 'P2' ? 'var(--warning)' : 'var(--success)')};"></div>
              <span style="flex:1; font-size:14px; font-weight:500; color:var(--text-1); ${t.status === 'completed' ? 'text-decoration:line-through;opacity:0.6;' : ''}">${t.title}</span>
              ${t.due_date ? `<span style="font-size:11px; color:var(--text-muted); background:var(--surface-1); padding:2px 8px; border-radius:10px;">${t.due_date}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    })()}

      <!-- App Action Buttons -->
      <div style="display:flex; gap:12px; margin-top:12px;">
        <button class="btn" onclick="closeVisionDetail()" style="flex:1;">Close</button>
        <button class="btn primary" onclick="closeVisionDetail(); setTimeout(() => { openTaskModal(); setTimeout(() => { if(document.getElementById('mTaskVisionGoal')) document.getElementById('mTaskVisionGoal').value = '${g.id}'; }, 100); }, 300);" style="flex:1.5;">+ Quick Task</button>
        <button class="btn ${g.month_focus === true || String(g.month_focus).toLowerCase() === 'true' ? 'success' : ''}" onclick="toggleVisionFocus('${g.id}')" style="width:50px; display:flex; align-items:center; justify-content:center; padding:0;">
          ${renderIcon('star', null, `style="width:20px; ${g.month_focus === true || String(g.month_focus).toLowerCase() === 'true' ? 'fill:var(--warning);' : ''}"`)}
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  // Fluid Progress Animation Logic
  const animateVisionNumber = (el, start, end, duration) => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progressRatio = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(progressRatio * (end - start) + start);
      el.textContent = `${val}%`;
      if (progressRatio < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = `${end}%`;
      }
    };
    window.requestAnimationFrame(step);
  };

  setTimeout(() => {
    const fill = document.getElementById('visionDetailProgressFill');
    const text = document.getElementById('visionDetailProgressText');
    if (fill && text) {
      // Force Reflow to ensure 0% is registered
      fill.style.transition = 'none';
      fill.style.width = '0%';
      fill.offsetHeight; // reflow

      // Step 1: Charge to 100% (Visual & Numerical synchronized)
      fill.style.transition = 'width 1.2s cubic-bezier(0.65, 0, 0.35, 1), background-color 0.8s ease';
      fill.style.width = '100%';
      fill.style.backgroundColor = 'var(--success)';
      animateVisionNumber(text, 0, 100, 1200);

      // Step 2: Pause at 100%, then Settle to Actual
      setTimeout(() => {
        fill.style.width = `${progress}%`;
        // Transition back to status-based color
        const finalColor = progress >= 100 ? 'var(--success)' : (progress >= 50 ? 'var(--primary)' : 'var(--warning)');
        fill.style.backgroundColor = finalColor;
        animateVisionNumber(text, 100, progress, 1200);
      }, 1600);
    }
  }, 300);

  // Attach navigation logic
  if (hasVideo) {
    const gallery = box.querySelector('.vision-video-gallery');
    const dots = box.querySelectorAll('.vision-dot-btn');
    let currentIdx = 0;
    const total = videoUrls.length;

    window.scrollToVideo = function (index) {
      if (index < 0 || index >= total) return;

      // Pause current video before switching
      const prevVid = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (prevVid) prevVid.pause();

      currentIdx = index;
      const width = gallery.offsetWidth;
      gallery.scrollTo({ left: index * width, behavior: 'smooth' });

      // Play new video after switching
      const nextVid = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (nextVid) nextVid.play().catch(() => { });

      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIdx);
      });
    };

    window.toggleCurrentVisionVideo = function () {
      const v = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (v) {
        if (v.paused) v.play().catch(() => { });
        else v.pause();
      }
    };

    window.navigateVisionGallery = function (direction) {
      let nextIdx = currentIdx + direction;
      if (nextIdx < 0) nextIdx = total - 1;
      if (nextIdx >= total) nextIdx = 0;
      window.scrollToVideo(nextIdx);
    };
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  initVisionMediaElements(box);

  // Auto-hide navigation buttons after 2 seconds
  setTimeout(() => {
    const navBtns = box.querySelectorAll('.vision-video-nav-btn');
    navBtns.forEach(btn => btn.classList.add('hidden-fade'));
  }, 2000);
};

window.closeVisionDetail = function () {
  const modal = document.getElementById('universalModal');
  if (modal) {
    const videos = modal.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.pause();
        v.currentTime = 0;
        v.removeAttribute('src'); // Better cleanup
        v.load();
      } catch (e) { }
    });
    modal.classList.add('hidden');
  }
};

/* ─── VISION VIDEO HELPERS ───────────────────────────────────────── */
window.toggleVisionAudio = function (videoId, btnEl) {
  const v = document.getElementById(videoId);
  if (!v) return;
  v.muted = !v.muted;

  // Update icon reliably with raw SVG
  if (btnEl) {
    if (v.muted) {
      btnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    } else {
      btnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    }
  }
};

/* ─── VIDEO MODAL ───────────────────────────────────────────────── */
window.openVideoModal = async function (urls, initialIndex = 0) {
  if (!urls) return;
  const videoUrls = Array.isArray(urls) ? urls : [urls];

  const existing = document.getElementById('visionVideoModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'visionVideoModal';
  overlay.className = 'vision-video-modal';
  overlay.innerHTML = `
    <div class="vision-video-inner" style="width:100vw; height:100vh; max-width:none; border-radius:0;">
      <div class="vision-modal-gallery" id="modalVideoGallery">
        ${videoUrls.map((u, i) => `
          <div class="vision-modal-slide">
            <video id="modalVideoPlayer-${i}" 
                   controls 
                   playsinline 
                   webkit-playsinline 
                   x5-playsinline
                   preload="auto" 
                   style="width:100%; height:auto; max-height:100vh; outline:none;" 
                   data-vision-local="${u}"></video>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Create close button via JS so addEventListener works reliably on WKWebView
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('style', [
    'position:fixed',
    'top:max(env(safe-area-inset-top, 16px) + 8px, 48px)',
    'right:16px',
    'z-index:20000',
    'width:44px',
    'height:44px',
    'border-radius:50%',
    'border:none',
    'background:rgba(0,0,0,0.5)',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'color:white',
    'font-size:24px',
    'font-weight:bold',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
  ].join(';'));
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.closeVideoModal();
  });
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);

  const gallery = overlay.querySelector('#modalVideoGallery');
  initVisionMediaElements(gallery);

  setTimeout(() => {
    const slideWidth = gallery.offsetWidth;
    gallery.scrollTo({ left: initialIndex * slideWidth, behavior: 'auto' });
    const initialVid = gallery.querySelector(`#modalVideoPlayer-${initialIndex}`);
    if (initialVid) initialVid.play().catch(() => { });
  }, 100);

  // Aggressive Fix for iOS native fullscreen hijacking
  gallery.querySelectorAll('video').forEach(v => {
    v.addEventListener('webkitbeginfullscreen', (e) => {
      e.preventDefault();
      if (v.webkitExitFullscreen) v.webkitExitFullscreen();
    }, false);

    // Safety: close modal if video exits fullscreen (iOS sometimes triggers this)
    v.addEventListener('webkitendfullscreen', () => {
      window.closeVideoModal();
    });
  });

  // Play/pause videos as they scroll into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const vid = entry.target;
      if (entry.isIntersecting) {
        vid.play().catch(() => { });
      } else {
        vid.pause();
      }
    });
  }, { threshold: 0.6 });

  gallery.querySelectorAll('video').forEach(v => observer.observe(v));
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
  window._visionPendingVideos = [];
  window._visionMediaTab = 'image';
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(null);
  modal.classList.remove('hidden');
  initVisionFormListeners();
};

window.openEditVision = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  window._visionPendingVideos = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean).map(u => ({ localKey: u.replace('local://', ''), filename: 'Existing Video', type: 'video/mp4', isExisting: true })) : [];
  window._visionMediaTab = 'image';
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(g);
  modal.classList.remove('hidden');
  initVisionFormListeners();
  setTimeout(() => {
    if (typeof renderPendingVideosUi === "function") {
      renderPendingVideosUi();
      initVisionMediaElements(box);
    }
  }, 100);
};

function buildVisionForm(g) {
  const isEdit = !!g;
  return `
    <div class="vision-detail-modal-header">
      <div class="vision-detail-modal-title" style="font-size:18px;">
        ${isEdit ? renderIcon('edit', null, 'style="width:20px;"') + ' Edit Goal' : renderIcon('target', null, 'style="width:20px;"') + ' New Vision Goal'}
      </div>
    </div>

    <div style="padding: 0 24px 24px;">
      <!-- Section 1: Basic Info -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('type', null, 'style="width:14px;"')} Title & Category</div>
        <input class="input" id="mVisTitle" placeholder="Goal Title *" value="${isEdit ? escH(g.title) : ''}" style="margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <select class="input" id="mVisCat">
            ${VISION_CATEGORIES.map(c => `<option value="${c}" ${isEdit && g.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <input type="date" class="input" id="mVisDate" value="${isEdit ? (g.target_date || '') : ''}">
        </div>
      </div>

      <!-- Section 2: Progress -->
      <div class="vision-form-section">
        <label class="vision-form-label">
          <span>${renderIcon('trending-up', null, 'style="width:14px;"')} Progress</span>
          <strong id="mVisProgressVal" style="color:var(--primary); margin-left:auto;">${isEdit ? (g.progress || 0) : 0}%</strong>
        </label>
        <div style="margin-top:8px;">
          <input type="range" id="mVisProgress" min="0" max="100" value="${isEdit ? (g.progress || 0) : 0}"
            ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ? 'disabled' : ''}
            oninput="document.getElementById('mVisProgressVal').textContent = this.value + '%'">
          ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ?
      `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Auto-calculated from habits</div>` : ''}
        </div>
      </div>

      <!-- Section 3: Notes -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('file-text', null, 'style="width:14px;"')} Notes</div>
        <textarea class="input" id="mVisNotes" placeholder="What's your vision? (optional)" style="height:100px;resize:none;">${isEdit ? escH(g.notes || '') : ''}</textarea>
      </div>

      <!-- Section 4: Media -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('image', null, 'style="width:14px;"')} Media Attachments</div>
        <div class="vision-modal-tabs">
          <button class="vision-modal-tab ${window._visionMediaTab === 'image' ? 'active' : ''}" id="vTabImg" onclick="switchVisionMediaTab('image')">Image</button>
          <button class="vision-modal-tab ${window._visionMediaTab === 'url' ? 'active' : ''}" id="vTabUrl" onclick="switchVisionMediaTab('url')">URL</button>
          <button class="vision-modal-tab ${window._visionMediaTab === 'video' ? 'active' : ''}" id="vTabVid" onclick="switchVisionMediaTab('video')">Video</button>
        </div>

        <div id="vPanelImg" style="display:${window._visionMediaTab === 'image' ? 'block' : 'none'}">
          <div class="vision-upload-zone" onclick="document.getElementById('vImgInput').click()">
            <input type="file" id="vImgInput" accept="image/*" hidden onchange="handleVisionMedia(this.files,'image')">
            <span class="vision-upload-icon">${renderIcon('upload-cloud', null, 'style="width:32px; color:var(--text-muted); opacity:0.5;"')}</span>
            <div style="font-weight:600; font-size:14px;">Upload Image</div>
          </div>
          <div id="vImgPreviewWrap" class="vision-media-preview" style="display:none">
            <img id="vImgPreview" src="" alt="preview">
            <button class="vision-media-remove" onclick="clearVisionMedia('image')">✕</button>
          </div>
        </div>

        <div id="vPanelUrl" style="display:${window._visionMediaTab === 'url' ? 'block' : 'none'}">
          <input type="url" id="mVisImg" class="input" placeholder="https://example.com/image.jpg" value="${isEdit ? escH(g?.image_url?.startsWith('data:') ? '' : (g.image_url || '')) : ''}">
        </div>

        <div id="vPanelVid" style="display:${window._visionMediaTab === 'video' ? 'block' : 'none'}">
          <div class="vision-upload-zone" onclick="document.getElementById('vVidInput').click()">
            <input type="file" id="vVidInput" accept="video/*" multiple hidden onchange="handleVisionMedia(this.files,'video')">
            <span class="vision-upload-icon">${renderIcon('film', null, 'style="width:32px; color:var(--text-muted); opacity:0.5;"')}</span>
            <div style="font-weight:600; font-size:14px;">Upload Video(s)</div>
          </div>
          <div id="vVidPreviewWrap" class="vision-media-preview" style="display:none; flex-direction:column; gap:10px;"></div>
        </div>
      </div>

      <!-- Section 5: Habits & Focus -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('link', null, 'style="width:14px;"')} Link Habits</div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding-right:4px;">
          ${(() => {
      const habits = state.data.habits || [];
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          existingHabits = String(g.linked_habits).trim().startsWith('[') ? JSON.parse(g.linked_habits) : String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 25 }));
        }
      } catch (e) { console.error("Error parsing habits", e); }

      const existingIds = existingHabits.map(h => String(h.id));
      if (!habits.length) return '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:10px;">No habits available</div>';

      return habits.map(h => {
        const isLinked = existingIds.includes(String(h.id));
        const linkedData = isLinked ? existingHabits.find(ex => String(ex.id) === String(h.id)) : null;
        const targetVal = linkedData?.target || 25;

        return `
                <div style="background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; padding:12px;">
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="vHabitLink_${h.id}" value="${h.id}" ${isLinked ? 'checked' : ''} 
                           onchange="document.getElementById('vHabitTargetWrap_${h.id}').style.display = this.checked ? 'flex' : 'none'" 
                           style="width:18px; height:18px; accent-color:var(--primary);">
                    <div style="flex:1;">
                      <div style="font-size:14px; font-weight:700;">${h.habit_name}</div>
                      <div style="font-size:11px; color:var(--text-muted);">${h.category || 'General'}</div>
                    </div>
                  </label>
                  <div id="vHabitTargetWrap_${h.id}" style="display:${isLinked ? 'flex' : 'none'}; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                    <span style="font-size:12px; font-weight:600; color:var(--text-2);">Target Recurrence:</span>
                    <input type="number" id="vHabitTarget_${h.id}" value="${targetVal}" min="1" style="width:60px; height:32px; text-align:center; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-2); font-size:13px; font-weight:700;">
                  </div>
                </div>`;
      }).join('');
    })()}
        </div>

        <label style="display:flex; align-items:center; gap:12px; margin-top:16px; padding:14px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; cursor:pointer;">
          <input type="checkbox" id="mVisMonthFocus" ${isEdit && (g.month_focus === true || String(g.month_focus).toLowerCase() === 'true') ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary);">
          <div>
            <div style="font-size:14px; font-weight:700;">Focus This Month</div>
            <div style="font-size:11px; color:var(--text-muted);">Pin to top and manifestation views</div>
          </div>
          <span style="margin-left:auto; font-size:18px;">⭐</span>
        </label>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; gap:12px; margin-top:24px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1; height:48px;">Cancel</button>
        <button class="btn primary" data-action="${isEdit ? 'update-vision-modal' : 'save-vision-modal'}" ${isEdit ? `data-edit-id="${g.id}"` : ''} style="flex:2; height:48px; font-weight:800;">
          ${isEdit ? 'Save Changes' : 'Create Vision'}
        </button>
      </div>
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
  if (tab === 'video') initVisionMediaElements(document.getElementById('vVidPreviewWrap'));
};

window.renderPendingVideosUi = function () {
  const wrap = document.getElementById('vVidPreviewWrap');
  if (!wrap) return;
  if (!window._visionPendingVideos || window._visionPendingVideos.length === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.style.display = 'flex';
  wrap.innerHTML = window._visionPendingVideos.map((v, idx) => {
    const videoId = `pending-video-${idx}`;
    const videoUrl = v.isExisting ? 'local://' + v.localKey : 'local://' + v.localKey; // Both are local keys

    return `
        <div style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#000;">
          <video id="${videoId}" controls style="width:100%;max-height:200px;object-fit:cover;" webkit-playsinline preload="auto" data-vision-local="${videoUrl}">
          </video>
          <button class="vision-media-remove" onclick="event.preventDefault();removePendingVideo(${idx})" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;">✕</button>
        </div>
        `;
  }).join('');
  initVisionMediaElements(wrap);
};

window.removePendingVideo = function (idx) {
  if (!window._visionPendingVideos) return;
  const v = window._visionPendingVideos[idx];
  if (v && !v.isExisting && v.localKey) {
    _VisionIDB.del(v.localKey).catch(() => { });
    delete window._visionMediaCache[v.localKey];
  }
  window._visionPendingVideos.splice(idx, 1);
  renderPendingVideosUi();
};

window.handleVisionMedia = function (files, type) {
  if (!files || files.length === 0) return;

  if (type === 'image') {
    const file = files[0];
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) { showToast('Image too large. Max 8 MB', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async e => {
      const buffer = e.target.result;
      const mimeType = file.type;
      const storedObj = { type: mimeType, buffer };
      const blob = new Blob([buffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const localKey = 'img_' + Date.now();
      try {
        await _VisionIDB.put(localKey, storedObj);
        window._visionMediaCache[localKey] = blobUrl;
      } catch (err) {
        showToast('Could not save image: ' + err.message, 'error');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      window._visionPendingImage = { localKey, filename: file.name, type: mimeType };
      const preview = document.getElementById('vImgPreview');
      const wrap = document.getElementById('vImgPreviewWrap');
      if (preview) preview.src = blobUrl;
      if (wrap) wrap.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
  } else {
    // VIDEO - support multiple
    if (!window._visionPendingVideos) window._visionPendingVideos = [];
    const maxSize = 200 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        showToast(`Video ${file.name} too large. Max 200 MB`, 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = async e => {
        const buffer = e.target.result;
        const mimeType = file.type;
        const storedObj = { type: mimeType, buffer };
        const blob = new Blob([buffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const localKey = 'vid_' + Date.now() + Math.random().toString(36).substring(7);

        try {
          await _VisionIDB.put(localKey, storedObj);
          window._visionMediaCache[localKey] = blobUrl;
          window._visionPendingVideos.push({ localKey, filename: file.name, type: mimeType, size: file.size });
          renderPendingVideosUi();
        } catch (err) {
          showToast('Could not save video: ' + err.message, 'error');
          URL.revokeObjectURL(blobUrl);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }
};

window.clearVisionMedia = function (type) {
  if (type === 'image') {
    window._visionPendingImage = null;
    const preview = document.getElementById('vImgPreview');
    const wrap = document.getElementById('vImgPreviewWrap');
    if (preview) preview.src = '';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (window._visionPendingVideo?.localKey) {
      _VisionIDB.del(window._visionPendingVideo.localKey).catch(() => { });
      delete window._visionVideoCache[window._visionPendingVideo.localKey];
    }
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
    image_url = 'local-img://' + window._visionPendingImage.localKey;
  } else if (tab === 'url') {
    const urlEl = document.getElementById('mVisImg');
    if (urlEl) image_url = urlEl.value;
  } else if (tab === 'video' && window._visionPendingVideos && window._visionPendingVideos.length > 0) {
    // Support multiple videos - join all video keys with comma
    video_url = window._visionPendingVideos.map(v => 'local://' + v.localKey).join(',');
  }

  // Preserve existing video_url when editing and no new video was selected
  if (!video_url) {
    try {
      const editBtn = document.querySelector('[data-action="update-vision-modal"]');
      if (editBtn && editBtn.dataset.editId) {
        const existingGoal = state.data.vision.find(v => String(v.id) === String(editBtn.dataset.editId));
        if (existingGoal && existingGoal.video_url && (existingGoal.video_url.startsWith('local://') || existingGoal.video_url.startsWith('local-img://'))) {
          video_url = existingGoal.video_url;
        }
      }
    } catch (e) { }
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

/* ── 10 Days Plan (TDP) Feature Implementation ────────────────────────── */
const VISION_TDP_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

async function getActiveTDP() {
  const plans = state.data.vision_tdp || [];
  console.log('[TDP Debug] All plans:', plans);
  const active = plans.find(p => p.status === 'active');
  console.log('[TDP Debug] Active plan:', active);
  return active;
}

function calculateTDPProgress(plan) {
  if (!plan || !plan.categories_json) return { total: 0, completed: 0, percentage: 0 };
  let cats = {};
  try {
    cats = typeof plan.categories_json === 'string' ? JSON.parse(plan.categories_json) : plan.categories_json;
  } catch (e) { return { total: 0, completed: 0, percentage: 0 }; }

  let total = 0, completed = 0;
  Object.values(cats).forEach(items => {
    (items || []).forEach(item => {
      total++;
      if (item.completed) completed++;
    });
  });
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function getTDPDayInfo(plan) {
  if (!plan) return { day: 0, remaining: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(plan.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(plan.end_date);
  end.setHours(0, 0, 0, 0);

  const day = Math.floor((today - start) / 86400000) + 1;
  const remaining = Math.ceil((end - today) / 86400000);
  return { day: Math.max(0, day), remaining: Math.max(0, remaining) };
}

async function checkAndAutoRenewTDP() {
  const active = await getActiveTDP();
  if (!active) return;

  const info = getTDPDayInfo(active);
  if (info.remaining < 0 || (new Date() > new Date(active.end_date) && info.remaining === 0)) {
    // Archive expired plan
    active.status = 'archived';
    await apiPost('vision_tdp', active);
    showToast('Your 10 Days Plan has ended. Create a new one!');
    renderVision();
  }
}

async function openTDPModal(tab = 'current') {
  const active = await getActiveTDP();

  // Create Modal Overlay
  const overlay = document.createElement('div');
  overlay.className = 'tdp-modal-overlay';
  overlay.id = 'tdpModalOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeTDPModal(); };

  document.body.appendChild(overlay);
  renderTDPModalContent(active, tab);
}

function closeTDPModal() {
  const el = document.getElementById('tdpModalOverlay');
  if (el) el.remove();
}

async function renderTDPModalContent(active, tab) {
  const overlay = document.getElementById('tdpModalOverlay');
  if (!overlay) return;

  let bodyHtml = '';
  if (tab === 'current') {
    if (active) {
      bodyHtml = renderCurrentTDP(active);
    } else {
      bodyHtml = renderNoActiveTDP();
    }
  } else if (tab === 'previous') {
    bodyHtml = renderPreviousTDPs();
  } else if (tab === 'create') {
    bodyHtml = renderCreateTDPView();
  }

  overlay.innerHTML = `
    <div class="tdp-modal animate-enter">
      <div class="tdp-modal-header">
        <div class="tdp-modal-title">${renderIcon('calendar', null, 'style="width:20px"')} 10 Days Plan</div>
        <button class="tdp-close" onclick="closeTDPModal()">${renderIcon('x', null, 'style="width:20px"')}</button>
      </div>
      <div class="tdp-tabs">
        <button class="tdp-tab ${tab === 'current' ? 'active' : ''}" onclick="renderTDPModalContent(${active ? 'state.data.vision_tdp.find(p=>p.id===\'' + active.id + '\')' : 'null'}, 'current')">Current</button>
        <button class="tdp-tab ${tab === 'previous' ? 'active' : ''}" onclick="renderTDPModalContent(null, 'previous')">Previous Plans</button>
      </div>
      <div class="tdp-modal-body">
        ${bodyHtml}
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderNoActiveTDP() {
  return `
    <div style="text-align:center; padding:40px 20px;">
      <div style="font-size:48px; margin-bottom:16px;">📅</div>
      <h3 style="margin-bottom:8px;">No Active Plan</h3>
      <p style="color:var(--text-muted); margin-bottom:24px;">Start your next 10-day sprint across all vision categories.</p>
      <button class="btn primary" onclick="renderTDPModalContent(null, 'create')">Create First Plan</button>
    </div>
  `;
}

function renderCurrentTDP(plan) {
  const info = getTDPDayInfo(plan);
  const prog = calculateTDPProgress(plan);
  const cats = JSON.parse(plan.categories_json);

  return `
    <div class="tdp-current-header" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
        <div>
          <div style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase;">Day ${info.day} of 10</div>
          <div style="font-size:18px; font-weight:800;">${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px; font-weight:800; color:var(--primary);">${prog.percentage}%</div>
          <div style="font-size:11px; color:var(--text-muted);">${prog.completed}/${prog.total} Items</div>
        </div>
      </div>
      <div class="tdp-progress-bar"><div class="tdp-progress-fill" style="width:${prog.percentage}%"></div></div>
    </div>

    ${VISION_TDP_CATEGORIES.map(cat => `
      <div class="tdp-cat-section">
        <div class="tdp-cat-header">
          <div class="tdp-cat-title">${cat}</div>
          <div style="font-size:11px; color:var(--text-muted);">${(cats[cat] || []).filter(i => i.completed).length}/${(cats[cat] || []).length}</div>
        </div>
        <div class="tdp-cat-list">
          ${(cats[cat] || []).map((item, idx) => `
            <div class="tdp-list-item ${item.completed ? 'done' : ''}" onclick="toggleTDPItem('${plan.id}', '${cat}', ${idx})">
              <div class="tdp-checkbox">${item.completed ? renderIcon('check', null, 'style="width:12px"') : ''}</div>
              <div class="tdp-item-text">${item.text}</div>
              <button class="btn-icon" onclick="event.stopPropagation(); deleteTDPItem('${plan.id}', '${cat}', ${idx})">${renderIcon('trash', null, 'style="width:14px"')}</button>
            </div>
          `).join('')}
          <div class="tdp-add-wrap">
            <input type="text" class="tdp-add-input" placeholder="+ Add item to ${cat}..." onkeypress="if(event.key==='Enter') addTDPItem('${plan.id}', '${cat}', this.value)">
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

async function toggleTDPItem(planId, cat, idx) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  cats[cat][idx].completed = !cats[cat][idx].completed;
  plan.categories_json = JSON.stringify(cats);
  await apiPost('vision_tdp', plan);
  renderTDPModalContent(plan, 'current');
  renderVision();
}

async function addTDPItem(planId, cat, text) {
  if (!text.trim()) return;
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  if (!cats[cat]) cats[cat] = [];
  cats[cat].push({ text, completed: false });
  plan.categories_json = JSON.stringify(cats);
  await apiPost('vision_tdp', plan);
  renderTDPModalContent(plan, 'current');
  renderVision();
}

async function deleteTDPItem(planId, cat, idx) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  cats[cat].splice(idx, 1);
  plan.categories_json = JSON.stringify(cats);
  await apiPost('vision_tdp', plan);
  renderTDPModalContent(plan, 'current');
  renderVision();
}

function renderCreateTDPView() {
  const nextStart = new Date();
  nextStart.setHours(0, 0, 0, 0);
  const dateStr = nextStart.toISOString().split('T')[0];

  return `
    <div class="tdp-create-header">
      <h3 style="margin-bottom:4px;">New 10 Days Plan</h3>
      <p style="font-size:13px; opacity:0.9;">Choose your start date and set your focus for the next block.</p>
    </div>
    <div class="tdp-date-picker-row">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Start Date</label>
      <input type="date" id="tdpNewStartDate" class="tdp-date-input" value="${dateStr}" onchange="updateTDPPreview()">
    </div>
    <div id="tdpPreview" style="margin-bottom:24px; font-size:14px; color:var(--text-2); background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--border-color);">
      Ends on: <strong>${formatDate(new Date(nextStart.getTime() + 9 * 86400000))}</strong>
    </div>
    
    <div style="display:flex; gap:12px;">
      <button class="btn" style="flex:1" onclick="renderTDPModalContent(null, 'current')">Cancel</button>
      <button class="btn primary" style="flex:2" onclick="createNewTDP()">Create Plan</button>
    </div>
  `;
}

function updateTDPPreview() {
  const val = document.getElementById('tdpNewStartDate').value;
  if (!val) return;
  const end = new Date(new Date(val).getTime() + 9 * 86400000);
  document.getElementById('tdpPreview').innerHTML = `Ends on: <strong>${formatDate(end)}</strong>`;
}

async function createNewTDP() {
  const start = document.getElementById('tdpNewStartDate').value;
  if (!start) return;

  const endDate = new Date(new Date(start).getTime() + 9 * 86400000);
  const end = endDate.toISOString().split('T')[0];

  const categories = {};
  VISION_TDP_CATEGORIES.forEach(c => categories[c] = []);

  const newPlan = {
    start_date: start,
    end_date: end,
    status: 'active',
    categories_json: JSON.stringify(categories),
    created_at: new Date().toISOString()
  };

  // Archive existing active if any
  const plans = state.data.vision_tdp || [];
  for (const p of plans) {
    if (p.status === 'active') {
      p.status = 'archived';
      await apiPost('vision_tdp', p);
    }
  }

  console.log('[TDP Debug] Sending new plan to API:', newPlan);
  const postRes = await apiPost('vision_tdp', newPlan);
  console.log('[TDP Debug] API Post Result:', postRes);

  console.log('[TDP Debug] Triggering loadAllData to sync state...');
  await loadAllData();
  console.log('[TDP Debug] loadAllData complete. State vision_tdp:', state.data.vision_tdp);

  closeTDPModal();
  showToast('New 10 Days Plan created!');
  renderVision();
}

function renderPreviousTDPs() {
  const plans = (state.data.vision_tdp || []).filter(p => p.status === 'archived').sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  if (plans.length === 0) return `<div style="text-align:center; color:var(--text-muted); padding:40px;">No archived plans yet.</div>`;

  return plans.map(p => {
    const prog = calculateTDPProgress(p);
    return `
      <div class="tdp-archive-card" onclick="viewArchivedTDP('${p.id}')">
        <div class="tdp-archive-meta">
          <div class="tdp-archive-dates">${formatDate(p.start_date)} - ${formatDate(p.end_date)}</div>
          <div class="tdp-archive-percent">${prog.percentage}% Complete (${prog.completed}/${prog.total})</div>
        </div>
        ${renderIcon('chevron-right', null, 'style="width:16px; color:var(--text-muted)"')}
      </div>
    `;
  }).join('');
}

function viewArchivedTDP(planId) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;

  const prog = calculateTDPProgress(plan);
  const cats = JSON.parse(plan.categories_json);

  const overlay = document.getElementById('tdpModalOverlay');
  overlay.innerHTML = `
    <div class="tdp-modal animate-enter">
      <div class="tdp-modal-header">
        <div class="tdp-modal-title"><button class="btn-icon" onclick="renderTDPModalContent(null, 'previous')">${renderIcon('arrow-left', null, 'style="width:18px"')}</button> Archived Plan</div>
    < button class= "tdp-close" onclick = "closeTDPModal()" > ${renderIcon('x', null, 'style="width:20px"')}</button >
      </div >
    <div class="tdp-modal-body">
      <div class="tdp-current-header" style="margin-bottom:24px; opacity:0.8;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Archived</div>
            <div style="font-size:18px; font-weight:800;">${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:800; color:var(--text-muted);">${prog.percentage}%</div>
            <div style="font-size:11px; color:var(--text-muted);">${prog.completed}/${prog.total} Items</div>
          </div>
        </div>
        <div class="tdp-progress-bar"><div class="tdp-progress-fill" style="width:${prog.percentage}%; background:var(--text-muted)"></div></div>
      </div>

      ${VISION_TDP_CATEGORIES.map(cat => `
          <div class="tdp-cat-section" style="opacity:0.7">
            <div class="tdp-cat-title" style="color:var(--text-muted); margin-bottom:12px;">${cat}</div>
            <div class="tdp-cat-list">
              ${(cats[cat] || []).map(item => `
                <div class="tdp-list-item ${item.completed ? 'done' : ''}" style="cursor:default">
                  <div class="tdp-checkbox">${item.completed ? renderIcon('check', null, 'style="width:12px"') : ''}</div>
                  <div class="tdp-item-text">${item.text}</div>
                </div>
              `).join('')}
              ${(cats[cat] || []).length === 0 ? '<div style="font-size:12px; color:var(--text-muted); padding:8px;">No items.</div>' : ''}
            </div>
          </div>
        `).join('')}
    </div>
    </div >
    `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
