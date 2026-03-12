/* view-reader.js — Immersive Book Reader */

let rdrSummary = null;
let rdrPage = 0;
let rdrPages = [];
let rdrFontSize = 17;
let rdrLineHeight = 1.75;
let rdrTheme = 'default';

const RDR_THEMES = {
  default: { bg: 'var(--surface-1, #fff)', text: 'var(--text-main, #1a1a1a)', panel: 'var(--card-bg, #f9f9f9)' },
  sepia:   { bg: '#f4ecd8', text: '#5b4636', panel: '#ede0c8' },
  night:   { bg: '#111827', text: '#e5e7eb', panel: '#1f2937' },
  forest:  { bg: '#1a2e1a', text: '#d4edda', panel: '#1f3d1f' },
};

/* ═══════════════════════════════
   ENTRY POINT
═══════════════════════════════ */
function renderReader(summaryId) {
  const main = document.getElementById('main');
  if (!main) return;

  const sum = (state.data.book_summaries || []).find(s => String(s.id) === String(summaryId));
  if (!sum) {
    main.innerHTML = `<div class="rdr-not-found">
      <i data-lucide="book-x" style="width:48px;height:48px;opacity:0.3;margin-bottom:16px"></i>
      <p>Summary not found.</p>
      <button class="bl-suggest-btn" onclick="renderBooks()">Back to Library</button>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  rdrSummary = sum;
  rdrPage = 0;
  try { rdrPages = JSON.parse(sum.summary_json || '[]'); } catch (e) { rdrPages = []; }

  // Load saved settings
  const saved = state.data.reader_settings?.[0];
  if (saved) {
    rdrFontSize = Number(saved.font_size) || 17;
    rdrLineHeight = Number(saved.line_spacing) || 1.75;
    rdrTheme = saved.background_color || 'default';
  }

  main.innerHTML = rdrShellHTML();
  rdrApplyTheme(rdrTheme, false);
  rdrRenderPage(0);

  // Touch swipe
  const root = document.getElementById('rdrRoot');
  let sx = 0, sy = 0;
  root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) rdrNextPage(); else rdrPrevPage();
    }
  }, { passive: true });

  // Keyboard
  const keyH = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rdrNextPage();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') rdrPrevPage();
    else if (e.key === 'Escape') { document.removeEventListener('keydown', keyH); renderBooks(); }
  };
  document.addEventListener('keydown', keyH);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Shell HTML ── */
function rdrShellHTML() {
  const sum = rdrSummary;
  try {
    var takeaways = JSON.parse(sum.key_takeaways || '[]');
  } catch (e) { var takeaways = []; }

  return `
<div class="rdr-root" id="rdrRoot">

  <!-- Top Bar -->
  <div class="rdr-topbar" id="rdrTopbar">
    <button class="rdr-back-btn" onclick="renderBooks()">
      <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
    </button>
    <div class="rdr-topbar-info">
      <div class="rdr-topbar-title">${escapeHtml(sum.book_title || '')}</div>
      <div class="rdr-topbar-author">by ${escapeHtml(sum.author || '')}</div>
    </div>
    <button class="rdr-settings-btn" onclick="rdrToggleFullscreen()" id="rdrFullscreenBtn" title="Fullscreen">
      <i data-lucide="maximize-2" style="width:18px;height:18px"></i>
    </button>
    <button class="rdr-settings-btn" onclick="rdrToggleSettings()" id="rdrSettingsToggle">
      <i data-lucide="sliders" style="width:18px;height:18px"></i>
    </button>
  </div>

  <!-- Progress Bar -->
  <div class="rdr-progress-track">
    <div class="rdr-progress-fill" id="rdrProgressFill" style="width:0%"></div>
  </div>

  <!-- Page Content -->
  <div class="rdr-scroll" id="rdrScroll">
    <div class="rdr-content" id="rdrContent"></div>
  </div>

  <!-- Bottom Nav -->
  <div class="rdr-bottom-nav" id="rdrBottomNav">
    <button class="rdr-nav-btn" onclick="rdrPrevPage()" id="rdrPrevBtn">
      <i data-lucide="chevron-left" style="width:20px;height:20px"></i>
    </button>
    <div class="rdr-page-info">
      <span id="rdrPageNum">1</span>
      <span class="rdr-page-sep">/</span>
      <span id="rdrTotalPages">${rdrPages.length}</span>
    </div>
    <button class="rdr-nav-btn" onclick="rdrNextPage()" id="rdrNextBtn">
      <i data-lucide="chevron-right" style="width:20px;height:20px"></i>
    </button>
  </div>

  <!-- Settings Panel -->
  <div class="rdr-settings-panel hidden" id="rdrSettingsPanel">
    <div class="rdr-settings-inner">
      <div class="rdr-settings-header">
        <span>Reader Settings</span>
        <button class="rdr-icon-btn" onclick="rdrToggleSettings()">
          <i data-lucide="x" style="width:16px;height:16px"></i>
        </button>
      </div>

      <div class="rdr-setting-row">
        <span class="rdr-setting-label">Font Size</span>
        <div class="rdr-setting-ctrl">
          <button class="rdr-ctrl-btn" onclick="rdrAdjustFont(-1)">A−</button>
          <span id="rdrFontSizeVal" class="rdr-ctrl-val">${rdrFontSize}px</span>
          <button class="rdr-ctrl-btn" onclick="rdrAdjustFont(1)">A+</button>
        </div>
      </div>

      <div class="rdr-setting-row">
        <span class="rdr-setting-label">Line Spacing</span>
        <div class="rdr-setting-ctrl">
          <button class="rdr-ctrl-btn" onclick="rdrAdjustSpacing(-0.1)">−</button>
          <span id="rdrSpacingVal" class="rdr-ctrl-val">${rdrLineHeight.toFixed(1)}</span>
          <button class="rdr-ctrl-btn" onclick="rdrAdjustSpacing(0.1)">+</button>
        </div>
      </div>

      <div class="rdr-setting-row">
        <span class="rdr-setting-label">Theme</span>
        <div class="rdr-theme-swatches">
          <button class="rdr-swatch" style="background:#fff;border:2px solid ${rdrTheme==='default'?'var(--primary)':'#ddd'}" onclick="rdrApplyTheme('default',true)" title="Default"></button>
          <button class="rdr-swatch" style="background:#f4ecd8;border:2px solid ${rdrTheme==='sepia'?'var(--primary)':'#ddd'}" onclick="rdrApplyTheme('sepia',true)" title="Sepia"></button>
          <button class="rdr-swatch" style="background:#111827;border:2px solid ${rdrTheme==='night'?'var(--primary)':'#ddd'}" onclick="rdrApplyTheme('night',true)" title="Night"></button>
          <button class="rdr-swatch" style="background:#1a2e1a;border:2px solid ${rdrTheme==='forest'?'var(--primary)':'#ddd'}" onclick="rdrApplyTheme('forest',true)" title="Forest"></button>
        </div>
      </div>
    </div>
  </div>

</div>
`;
}

/* ── Page Rendering ── */
function rdrRenderPage(idx) {
  const page = rdrPages[idx];
  const content = document.getElementById('rdrContent');
  const scroll = document.getElementById('rdrScroll');
  const fill = document.getElementById('rdrProgressFill');
  const num = document.getElementById('rdrPageNum');
  const prevBtn = document.getElementById('rdrPrevBtn');
  const nextBtn = document.getElementById('rdrNextBtn');
  if (!content) return;

  content.style.fontSize = rdrFontSize + 'px';
  content.style.lineHeight = rdrLineHeight;

  content.innerHTML = rdrPageHTML(page, idx);

  if (fill) fill.style.width = ((idx + 1) / rdrPages.length * 100) + '%';
  if (num) num.textContent = idx + 1;
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx === rdrPages.length - 1;

  scroll?.scrollTo({ top: 0, behavior: 'smooth' });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rdrPageHTML(page, idx) {
  if (!page) return '<p style="color:var(--text-muted)">Empty page</p>';

  const isLast = idx === rdrPages.length - 1;
  let html = `
    <div class="rdr-page-header">
      <span class="rdr-page-number">Page ${page.page_number || idx + 1}</span>
    </div>
    <h2 class="rdr-page-title">${escapeHtml(page.title || '')}</h2>
    <div class="rdr-page-body">
      ${(page.content || '').split('\n').filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
    </div>
  `;

  if (page.key_points && page.key_points.length > 0) {
    html += `
    <div class="rdr-keypoints">
      <div class="rdr-block-header">
        <i data-lucide="star" style="width:14px;height:14px"></i>
        Key Points
      </div>
      <ul class="rdr-list">
        ${page.key_points.map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
      </ul>
    </div>`;
  }

  if (page.action_items && page.action_items.length > 0) {
    html += `
    <div class="rdr-actions">
      <div class="rdr-block-header">
        <i data-lucide="check-circle" style="width:14px;height:14px"></i>
        Actions
      </div>
      <ul class="rdr-list">
        ${page.action_items.map(ai => `<li>${escapeHtml(ai)}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Final page: show takeaways
  if (isLast) {
    try {
      const takeaways = JSON.parse(rdrSummary.key_takeaways || '[]');
      if (takeaways.length > 0) {
        html += `
        <div class="rdr-takeaways">
          <div class="rdr-block-header">
            <i data-lucide="trophy" style="width:14px;height:14px"></i>
            Overall Takeaways
          </div>
          <ul class="rdr-list">
            ${takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
        </div>`;
      }
    } catch (e) {}
  }

  return html;
}

/* ── Navigation ── */
window.rdrNextPage = function() {
  if (rdrPage < rdrPages.length - 1) {
    rdrPage++;
    rdrAnimatePageChange('left');
  }
};

window.rdrPrevPage = function() {
  if (rdrPage > 0) {
    rdrPage--;
    rdrAnimatePageChange('right');
  }
};

function rdrAnimatePageChange(dir) {
  const content = document.getElementById('rdrContent');
  if (!content) { rdrRenderPage(rdrPage); return; }
  content.style.opacity = '0';
  content.style.transform = `translateX(${dir === 'left' ? '-20px' : '20px'})`;
  setTimeout(() => {
    rdrRenderPage(rdrPage);
    content.style.transition = 'none';
    content.style.transform = `translateX(${dir === 'left' ? '20px' : '-20px'})`;
    content.style.opacity = '0';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        content.style.transform = 'translateX(0)';
        content.style.opacity = '1';
      });
    });
  }, 150);
}

/* ── Settings ── */
window.rdrToggleSettings = function() {
  document.getElementById('rdrSettingsPanel')?.classList.toggle('hidden');
};

window.rdrAdjustFont = function(delta) {
  rdrFontSize = Math.max(12, Math.min(28, rdrFontSize + delta));
  const el = document.getElementById('rdrContent');
  if (el) el.style.fontSize = rdrFontSize + 'px';
  const val = document.getElementById('rdrFontSizeVal');
  if (val) val.textContent = rdrFontSize + 'px';
};

window.rdrAdjustSpacing = function(delta) {
  rdrLineHeight = Math.max(1.2, Math.min(2.5, Math.round((rdrLineHeight + delta) * 10) / 10));
  const el = document.getElementById('rdrContent');
  if (el) el.style.lineHeight = rdrLineHeight;
  const val = document.getElementById('rdrSpacingVal');
  if (val) val.textContent = rdrLineHeight.toFixed(1);
};

/* ── Fullscreen (CSS-only — no native API to avoid Capacitor warning) ── */
let rdrIsFullscreen = false;

window.rdrToggleFullscreen = function() {
  const root = document.getElementById('rdrRoot');
  if (!root) return;
  rdrIsFullscreen = !rdrIsFullscreen;
  root.classList.toggle('rdr-fullscreen', rdrIsFullscreen);
  rdrUpdateFsIcon(rdrIsFullscreen);
};

function rdrUpdateFsIcon(isFs) {
  const btn = document.getElementById('rdrFullscreenBtn');
  if (!btn) return;
  btn.innerHTML = isFs
    ? '<i data-lucide="minimize-2" style="width:18px;height:18px"></i>'
    : '<i data-lucide="maximize-2" style="width:18px;height:18px"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.rdrApplyTheme = function(theme, updateSwatches) {
  rdrTheme = theme;
  const t = RDR_THEMES[theme] || RDR_THEMES.default;
  const root = document.getElementById('rdrRoot');
  if (!root) return;
  root.style.setProperty('--rdr-bg', t.bg);
  root.style.setProperty('--rdr-text', t.text);
  root.style.setProperty('--rdr-panel', t.panel);

  if (updateSwatches) {
    document.querySelectorAll('.rdr-swatch').forEach((el, i) => {
      const themes = ['default', 'sepia', 'night', 'forest'];
      el.style.borderColor = themes[i] === theme ? 'var(--primary)' : '#ddd';
    });
  }
};
