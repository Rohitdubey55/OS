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
  const goals = state.data.vision || [];
  await preloadLocalMedia(goals);
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
      ${videoUrls.length > 1 ? `<div class="vision-card-badge normal" style="top:auto;bottom:10px;right:10px;left:auto;background:rgba(0,0,0,0.7);color:white">+${videoUrls.length - 1} Videos</div>` : ''}
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

  box.innerHTML = `
    <!-- Enhanced Hero Section with Floating Actions -->
    <div class="vision-detail-hero" style="position:relative; ${hasVideo ? 'height:280px;' : 'height:240px;'}">
      <!-- Floating Action Buttons -->
      <div style="position:absolute; top:12px; right:12px; display:flex; gap:8px; z-index:20;">
        <button onclick="event.stopPropagation(); document.getElementById('universalModal').classList.add('hidden'); setTimeout(() => openEditVision('${g.id}'), 100);"
          style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(0,0,0,0.5); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);">
          ${renderIcon('edit', null, 'style="width:18px;"')}
        </button>
        <button onclick="event.stopPropagation(); if(confirm('Delete this vision goal?')) { document.getElementById('universalModal').classList.add('hidden'); setTimeout(() => deleteVision('${g.id}'), 100); }"
          style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(220,38,38,0.8); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          ${renderIcon('trash', null, 'style="width:18px;"')}
        </button>
        ${g.status !== 'achieved' ? `
        <button onclick="event.stopPropagation(); document.getElementById('universalModal').classList.add('hidden'); setTimeout(() => markVisionAchieved('${g.id}'), 100);"
          style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(34,197,94,0.9); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          ${renderIcon('trophy', null, 'style="width:18px;"')}
        </button>
        ` : ''}
      </div>

      ${hasVideo
      ? `<div style="width:100%; height:100%; position:relative; overflow:hidden;">
          <div class="vision-video-gallery" id="visionGallery-${g.id}">
            ${videoUrls.map((u, i) => {
        const videoId = `vision-detail-video-${g.id}-${i}`;
        return `
              <div class="vision-video-slide">
                <video id="${videoId}" style="width:100%;height:100%;object-fit:cover;" controls playsinline webkit-playsinline preload="auto" onclick="openVideoModal(${JSON.stringify(videoUrls).replace(/"/g, '&quot;')}, ${i})" poster="${g.image_url ? resolveMediaUrl(g.image_url) : ''}" data-vision-local="${u}">
                </video>
              </div>`;
      }).join('')}
          </div>

          ${videoUrls.length > 1 ? `
            <button class="vision-video-nav-prev vision-video-nav-btn prev" onclick="event.stopPropagation(); navigateVisionGallery(-1)">
              ${renderIcon('chevron-left', null, 'style="width:24px;height:24px"')}
            </button>
            <button class="vision-video-nav-next vision-video-nav-btn next" onclick="event.stopPropagation(); navigateVisionGallery(1)">
              ${renderIcon('chevron-right', null, 'style="width:24px;height:24px"')}
            </button>
          ` : ''}

          ${videoDots}
          <div style="position:absolute; top:16px; left:16px; background:rgba(0,0,0,0.6); color:white; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; backdrop-filter:blur(8px); pointer-events:none; z-index:20;">
            ${videoUrls.length} Video${videoUrls.length > 1 ? 's' : ''}
          </div>
        </div>`
      : `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${getFallbackImage(g)}'">`}
      
      <!-- Gradient Overlay -->
      <div style="position:absolute; bottom:0; left:0; right:0; height:120px; background:linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%); pointer-events:none;"></div>
      <div style="position:absolute; bottom:16px; left:16px; right:16px;">
        <div style="font-size:22px; font-weight:800; color:white; line-height:1.3; margin-bottom:8px; text-shadow:0 2px 8px rgba(0,0,0,0.5);">${g.title}</div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="background:var(--primary); color:white; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${g.category || 'General'}</span>
          ${statusBadge}
        </div>
      </div>
    </div>

    <!-- Enhanced Progress Section -->
    <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin:16px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px;">Progress</span>
        <span style="font-size:24px; font-weight:800; color:${progressColor};">${progress}%</span>
      </div>
      <div style="height:12px; background:var(--surface-3); border-radius:6px; overflow:hidden;">
        <div style="height:100%; width:${progress}%; background:linear-gradient(90deg, ${progressColor} 0%, ${progressColor}cc 100%); border-radius:6px; transition:width 0.5s ease;"></div>
      </div>
    </div>

    <!-- Enhanced Notes Section -->
    <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
      <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        ${renderIcon('file-text', null, 'style="width:14px;"')} Notes
      </div>
      <div style="font-size:14px; color:var(--text-1); line-height:1.6; ${!g.notes ? 'color:var(--text-muted); font-style:italic;' : ''}">
        ${g.notes || 'No notes added yet.'}
      </div>
    </div>

    <!-- Timeline Info -->
    <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
        ${renderIcon('calendar', null, 'style="width:14px;"')}
        <span>Created: <strong style="color:var(--text-2);">${createdDate}</strong></span>
      </div>
      <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
        ${renderIcon('clock', null, 'style="width:14px;"')}
        <span>Updated: <strong style="color:var(--text-2);">${updatedDate}</strong></span>
      </div>
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

    <!-- Action Buttons -->
    <div style="display:flex; justify-content:stretch; gap:10px; flex-wrap:wrap; margin-top:8px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1; min-width:100px;">
        ${renderIcon('x', null, 'style="width:14px;margin-right:6px"')} Close
      </button>
      <button class="btn primary" onclick="document.getElementById('universalModal').classList.add('hidden'); setTimeout(() => { openTaskModal(); setTimeout(() => { if(document.getElementById('mTaskVisionGoal')) document.getElementById('mTaskVisionGoal').value = '${g.id}'; }, 100); }, 300);" style="flex:1; min-width:140px; display:flex; align-items:center; justify-content:center; gap:6px;">
        ${renderIcon('plus', null, 'style="width:14px;"')} Quick Task
      </button>
      <button class="btn ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? 'success' : ''}" onclick="toggleVisionFocus('${g.id}')" style="flex:1; min-width:120px; display:flex; align-items:center; justify-content:center; gap:6px;">
        ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE'
      ? `${renderIcon('star', null, 'style="width:14px; fill:var(--warning);"')}`
      : `${renderIcon('star', null, 'style="width:14px;"')}`}
        ${g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE' ? 'Focus On' : 'Set Focus'}
      </button>
    </div>
  `;

  // Attach navigation logic
  if (hasVideo) {
    const gallery = box.querySelector('.vision-video-gallery');
    const dots = box.querySelectorAll('.vision-dot-btn');
    let currentIdx = 0;
    const total = videoUrls.length;

    window.scrollToVideo = function (index) {
      if (index < 0 || index >= total) return;
      currentIdx = index;
      const width = gallery.offsetWidth;
      gallery.scrollTo({ left: index * width, behavior: 'smooth' });
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIdx);
      });
    };

    window.navigateVisionGallery = function (direction) {
      let nextIdx = currentIdx + direction;
      if (nextIdx < 0) nextIdx = total - 1;
      if (nextIdx >= total) nextIdx = 0;
      window.scrollToVideo(nextIdx);
    };
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  modal.classList.remove('hidden');
  initVisionMediaElements(box);
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
      <button class="vision-video-close" onclick="closeVideoModal()" style="z-index:100;">✕</button>
      <div class="vision-modal-gallery" id="modalVideoGallery">
        ${videoUrls.map((u, i) => `
          <div class="vision-modal-slide">
            <video id="modalVideoPlayer-${i}" controls preload="auto" style="width:100%; height:auto; max-height:100vh; outline:none;" data-vision-local="${u}"></video>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target.classList.contains('vision-modal-slide')) closeVideoModal(); });

  const gallery = overlay.querySelector('#modalVideoGallery');

  // Initialize all videos in the gallery
  initVisionMediaElements(gallery);

  // Scroll to the initial video
  setTimeout(() => {
    const slideWidth = gallery.offsetWidth;
    gallery.scrollTo({ left: initialIndex * slideWidth, behavior: 'auto' });

    // Try to play and fullscreen the initial video
    const initialVid = gallery.querySelector(`#modalVideoPlayer-${initialIndex}`);
    if (initialVid) {
      initialVid.play().then(() => {
        setTimeout(() => {
          if (initialVid.webkitEnterFullscreen) initialVid.webkitEnterFullscreen();
          else if (initialVid.requestFullscreen) initialVid.requestFullscreen();
        }, 200);
      }).catch(e => console.warn('Autoplay in modal failed:', e));
    }
  }, 50);

  // Optional: Add intersection observer to play/pause videos as they come into view
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
            <input type="file" id="vVidInput" accept="video/*" multiple hidden onchange="handleVisionMedia(this.files,'video')">
              <span class="vision-upload-icon">${renderIcon('video', null, 'style="width:32px;height:32px;"')}</span>
              <div style="font-weight:600;margin-bottom:4px">Tap to select video(s) from storage</div>
              <div class="vision-upload-hint">MP4, MOV, WebM · Max 200 MB</div>
          </div>
          <div id="vVidPreviewWrap" class="vision-media-preview" style="display:none; flex-direction:column; gap:10px; margin-top:10px; padding:0; background:transparent;">
            <!-- Previews generated dynamically -->
          </div>
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
