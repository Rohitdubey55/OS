/* view-books.js — Wisdom Library */

/* ── State ── */
let booksFilter = 'all';
let booksSearch = '';

const BOOK_STATUS = {
  all:       { label: 'All',        color: '#6366F1' },
  reading:   { label: 'Reading',    color: '#3B82F6' },
  completed: { label: 'Completed',  color: '#10B981' },
  wishlist:  { label: 'Wishlist',   color: '#F59E0B' },
  paused:    { label: 'Paused',     color: '#6B7280' },
};

const BOOK_COVER_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
  'linear-gradient(135deg,#f6d365,#fda085)',
  'linear-gradient(135deg,#96fbc4,#f9f586)',
];

function bookCoverGradient(title) {
  if (!title) return BOOK_COVER_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % BOOK_COVER_GRADIENTS.length;
  return BOOK_COVER_GRADIENTS[Math.abs(h)];
}

function bookInitials(title) {
  if (!title) return '?';
  return title.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/* ═══════════════════════════════
   ENTRY POINT
═══════════════════════════════ */
function renderBooks() {
  const main = document.getElementById('main');
  if (!main) return;

  // Load from cache immediately or fetch
  if (!Array.isArray(state.data.book_library)) {
    state.data.book_library = [];
    state.data.book_summaries = [];
    booksLoadData();
  }

  main.innerHTML = booksShellHTML();
  booksRenderList();

  document.addEventListener('keydown', booksKeyHandler);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function booksLoadData() {
  try {
    await initToolsSheets();
    const [lib, sums] = await Promise.all([
      apiGet('book_library'),
      apiGet('book_summaries'),
    ]);
    state.data.book_library = lib || [];
    state.data.book_summaries = sums || [];
    booksRenderList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('Books load error', e);
  }
}

function booksKeyHandler(e) {
  if (e.key === 'Escape') {
    closeBookDetail();
    document.removeEventListener('keydown', booksKeyHandler);
  }
}

/* ── Shell HTML ── */
function booksShellHTML() {
  return `
<div class="bl-shell" id="blShell">

  <!-- Header -->
  <div class="bl-header">
    <div class="bl-header-left">
      <span class="bl-header-title">Library</span>
      <span class="bl-count-badge" id="blCount">0</span>
    </div>
    <div class="bl-header-right">
      <button class="bl-icon-btn" onclick="booksToggleSearch()" title="Search">
        <i data-lucide="search" style="width:18px;height:18px"></i>
      </button>
      <button class="bl-suggest-btn" onclick="openBookSuggestionModal()">
        <i data-lucide="sparkles" style="width:15px;height:15px"></i>
        <span>Suggest</span>
      </button>
    </div>
  </div>

  <!-- Search Bar -->
  <div class="bl-search-bar hidden" id="blSearchBar">
    <i data-lucide="search" style="width:15px;height:15px;flex-shrink:0;opacity:0.4"></i>
    <input id="blSearchInput" class="bl-search-input" placeholder="Search books..." oninput="booksOnSearch(this.value)" />
    <button class="bl-icon-btn" onclick="booksCloseSearch()">
      <i data-lucide="x" style="width:15px;height:15px"></i>
    </button>
  </div>

  <!-- Filter Pills -->
  <div class="bl-filter-row" id="blFilterRow">
    ${Object.entries(BOOK_STATUS).map(([k, v]) => `
      <button class="bl-filter-pill ${k === booksFilter ? 'active' : ''}"
        style="--pill-color:${v.color}"
        data-filter="${k}"
        onclick="booksSetFilter('${k}')">
        <span class="bl-pill-dot"></span>${v.label}
      </button>
    `).join('')}
  </div>

  <!-- Books Feed -->
  <div class="bl-feed" id="blFeed"></div>

</div>

<!-- Book Detail Overlay -->
<div class="bl-detail-overlay hidden" id="blDetailOverlay">
  <div class="bl-detail-sheet" id="blDetailSheet"></div>
</div>
`;
}

/* ── Render List ── */
function booksRenderList() {
  const feed = document.getElementById('blFeed');
  if (!feed) return;

  const library = state.data.book_library || [];
  let filtered = library.filter(b => {
    if (booksFilter !== 'all' && b.status !== booksFilter) return false;
    if (booksSearch) {
      const q = booksSearch.toLowerCase();
      return (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Update count badge
  const badge = document.getElementById('blCount');
  if (badge) badge.textContent = filtered.length;

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div class="bl-empty">
        <div class="bl-empty-icon">
          <i data-lucide="book-open" style="width:40px;height:40px;opacity:0.3"></i>
        </div>
        <div class="bl-empty-title">${library.length === 0 ? 'Your library is empty' : 'No books match'}</div>
        <div class="bl-empty-sub">${library.length === 0 ? 'Let AI suggest books based on your goals and habits' : 'Try a different filter or search term'}</div>
        ${library.length === 0 ? `<button class="bl-suggest-btn mt-3" onclick="openBookSuggestionModal()">
          <i data-lucide="sparkles" style="width:14px;height:14px"></i> Get AI Suggestions
        </button>` : ''}
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Group by status
  if (booksFilter === 'all') {
    const order = ['reading', 'wishlist', 'completed', 'paused'];
    const groups = {};
    filtered.forEach(b => {
      const s = b.status || 'wishlist';
      if (!groups[s]) groups[s] = [];
      groups[s].push(b);
    });
    let html = '';
    order.forEach(s => {
      if (groups[s] && groups[s].length > 0) {
        html += `<div class="bl-group-label">${BOOK_STATUS[s]?.label || s} <span class="bl-group-count">${groups[s].length}</span></div>`;
        html += `<div class="bl-list">${groups[s].map(blCardHTML).join('')}</div>`;
      }
    });
    feed.innerHTML = html;
  } else {
    feed.innerHTML = `<div class="bl-list">${filtered.map(blCardHTML).join('')}</div>`;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function blCardHTML(book) {
  const gradient = bookCoverGradient(book.title);
  const initials = bookInitials(book.title);
  const status = BOOK_STATUS[book.status] || BOOK_STATUS.wishlist;
  const hasSummary = (state.data.book_summaries || []).some(s => String(s.book_id) === String(book.id));

  return `
<div class="bl-card" onclick="openBookDetail('${book.id}')">
  <div class="bl-card-cover" style="background:${gradient}">
    <span class="bl-cover-initials">${escapeHtml(initials)}</span>
    ${hasSummary ? '<div class="bl-summary-badge"><i data-lucide="file-text" style="width:10px;height:10px"></i></div>' : ''}
  </div>
  <div class="bl-card-body">
    <div class="bl-card-status" style="color:${status.color}">${status.label}</div>
    <div class="bl-card-title">${escapeHtml(book.title || 'Untitled')}</div>
    <div class="bl-card-author">${escapeHtml(book.author || '')}</div>
    <div class="bl-card-footer">
      ${hasSummary
        ? `<button class="bl-read-btn" onclick="event.stopPropagation(); openBookReader('${book.id}')">
             <i data-lucide="book-open" style="width:11px;height:11px"></i> Read
           </button>`
        : `<button class="bl-summarize-btn" onclick="event.stopPropagation(); generateSummary('${book.id}')">
             <i data-lucide="zap" style="width:11px;height:11px"></i> Summarize
           </button>`
      }
    </div>
  </div>
</div>`;
}

/* ── Filter / Search ── */
window.booksSetFilter = function(f) {
  booksFilter = f;
  document.querySelectorAll('.bl-filter-pill').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === f);
  });
  booksRenderList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.booksToggleSearch = function() {
  const bar = document.getElementById('blSearchBar');
  if (!bar) return;
  bar.classList.toggle('hidden');
  if (!bar.classList.contains('hidden')) document.getElementById('blSearchInput')?.focus();
};

window.booksCloseSearch = function() {
  booksSearch = '';
  document.getElementById('blSearchBar')?.classList.add('hidden');
  if (document.getElementById('blSearchInput')) document.getElementById('blSearchInput').value = '';
  booksRenderList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.booksOnSearch = function(val) {
  booksSearch = val;
  booksRenderList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/* ── Book Detail Overlay ── */
window.openBookDetail = function(bookId) {
  const book = (state.data.book_library || []).find(b => String(b.id) === String(bookId));
  if (!book) return;
  const hasSummary = (state.data.book_summaries || []).some(s => String(s.book_id) === String(book.id));
  const gradient = bookCoverGradient(book.title);
  const initials = bookInitials(book.title);
  const status = BOOK_STATUS[book.status] || BOOK_STATUS.wishlist;

  const overlay = document.getElementById('blDetailOverlay');
  const sheet = document.getElementById('blDetailSheet');
  if (!overlay || !sheet) return;

  sheet.innerHTML = `
    <div class="bld-topbar">
      <button class="bl-icon-btn" onclick="closeBookDetail()">
        <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
      </button>
      <div class="bld-topbar-actions">
        <button class="bl-icon-btn" onclick="booksChangeStatus('${book.id}')">
          <i data-lucide="edit-2" style="width:18px;height:18px"></i>
        </button>
        <button class="bl-icon-btn danger" onclick="booksDeleteBook('${book.id}')">
          <i data-lucide="trash-2" style="width:18px;height:18px"></i>
        </button>
      </div>
    </div>
    <div class="bld-scroll">
      <div class="bld-hero" style="background:${gradient}">
        <div class="bld-hero-cover">${escapeHtml(initials)}</div>
      </div>
      <div class="bld-body">
        <div class="bld-status-chip" style="background:${status.color}22;color:${status.color}">${status.label}</div>
        <h1 class="bld-title">${escapeHtml(book.title || 'Untitled')}</h1>
        <p class="bld-author">by ${escapeHtml(book.author || 'Unknown')}</p>
        ${book.category ? `<div class="bld-meta-row"><i data-lucide="tag" style="width:14px;height:14px"></i><span>${escapeHtml(book.category)}</span></div>` : ''}
        ${book.date_added ? `<div class="bld-meta-row"><i data-lucide="calendar" style="width:14px;height:14px"></i><span>Added ${escapeHtml(book.date_added)}</span></div>` : ''}
        ${book.rating ? `<div class="bld-meta-row">${'★'.repeat(Number(book.rating))}${'☆'.repeat(5 - Number(book.rating))}</div>` : ''}
        ${book.notes ? `<div class="bld-notes">${escapeHtml(book.notes)}</div>` : ''}

        <div class="bld-actions">
          ${hasSummary
            ? `<button class="bld-primary-btn" onclick="openBookReader('${book.id}')">
                 <i data-lucide="book-open" style="width:16px;height:16px"></i> Read Summary
               </button>`
            : `<button class="bld-primary-btn" onclick="closeBookDetail(); generateSummary('${book.id}')">
                 <i data-lucide="zap" style="width:16px;height:16px"></i> Generate AI Summary
               </button>`
          }
          <button class="bld-secondary-btn" onclick="booksChangeStatus('${book.id}')">
            <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Change Status
          </button>
        </div>
      </div>
    </div>
  `;

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => sheet.classList.add('open'));
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeBookDetail = function() {
  const overlay = document.getElementById('blDetailOverlay');
  const sheet = document.getElementById('blDetailSheet');
  if (!overlay) return;
  sheet?.classList.remove('open');
  setTimeout(() => overlay.classList.add('hidden'), 280);
};

window.booksChangeStatus = async function(bookId) {
  const book = (state.data.book_library || []).find(b => String(b.id) === String(bookId));
  if (!book) return;
  const statuses = Object.entries(BOOK_STATUS).filter(([k]) => k !== 'all');
  const opts = statuses.map(([k, v]) => `${v.label}`).join(' / ');
  const choice = prompt(`Change status to (${opts}):`, book.status || 'wishlist');
  if (!choice) return;
  const matched = statuses.find(([k, v]) => v.label.toLowerCase() === choice.toLowerCase() || k === choice.toLowerCase());
  if (!matched) { toast('Unknown status'); return; }
  try {
    await apiCall('update', 'book_library', { status: matched[0] }, bookId);
    const idx = (state.data.book_library || []).findIndex(b => String(b.id) === String(bookId));
    if (idx >= 0) state.data.book_library[idx].status = matched[0];
    toast('Status updated');
    closeBookDetail();
    booksRenderList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) { toast('Failed to update'); }
};

window.booksDeleteBook = async function(bookId) {
  if (!confirm('Remove this book from your library?')) return;
  try {
    await apiCall('delete', 'book_library', {}, bookId);
    state.data.book_library = (state.data.book_library || []).filter(b => String(b.id) !== String(bookId));
    toast('Book removed');
    closeBookDetail();
    booksRenderList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) { toast('Failed to remove book'); }
};

/* ── AI Suggestion Modal ── */
window.openBookSuggestionModal = function() {
  openUniversalModal();
  const box = document.querySelector('#universalModal .modal-box');
  if (!box) return;

  box.innerHTML = `
    <div class="bl-modal-header">
      <div class="bl-modal-title">
        <i data-lucide="sparkles" style="width:20px;height:20px;color:#6366F1"></i>
        <span>AI Book Suggestions</span>
      </div>
      <button class="bl-icon-btn" onclick="closeUniversalModal()">
        <i data-lucide="x" style="width:18px;height:18px"></i>
      </button>
    </div>
    <div class="bl-modal-body" id="blSuggBody">
      <p class="bl-modal-sub">Analyzing your goals, habits, and diary to find the perfect books...</p>
      <div class="bl-sugg-loading" id="blSuggLoading">
        <div class="bl-sugg-spinner"></div>
        <span>Curating your reading list...</span>
      </div>
      <div class="bl-sugg-list hidden" id="blSuggList"></div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  AI_SERVICE.generateBookRecommendations(state.data)
    .then(recs => blShowRecommendations(recs))
    .catch(err => {
      toast('Failed to get suggestions: ' + err.message);
      closeUniversalModal();
    });
};

function blShowRecommendations(recs) {
  const loading = document.getElementById('blSuggLoading');
  const list = document.getElementById('blSuggList');
  if (!list) return;

  if (!recs || recs.length === 0) {
    if (loading) loading.innerHTML = '<p style="color:var(--text-muted)">No recommendations found based on your current data.</p>';
    return;
  }

  loading?.classList.add('hidden');
  list.classList.remove('hidden');

  list.innerHTML = recs.map((rec, i) => `
    <div class="bl-sugg-item" style="animation-delay:${i * 60}ms" onclick="blAddSuggestedBook('${escapeHtml(rec.title).replace(/'/g,"\\'")}','${escapeHtml(rec.author).replace(/'/g,"\\'")}','${escapeHtml(rec.category || '').replace(/'/g,"\\'")}')">
      <div class="bl-sugg-cover" style="background:${bookCoverGradient(rec.title)}">${bookInitials(rec.title)}</div>
      <div class="bl-sugg-info">
        <div class="bl-sugg-title">${escapeHtml(rec.title)}</div>
        <div class="bl-sugg-author">by ${escapeHtml(rec.author)} · ${escapeHtml(rec.category || '')}</div>
        <div class="bl-sugg-reason">${escapeHtml(rec.reason || '')}</div>
      </div>
      <button class="bl-sugg-add">
        <i data-lucide="plus" style="width:16px;height:16px"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.blAddSuggestedBook = async function(title, author, category) {
  try {
    const payload = {
      title,
      author,
      category,
      status: 'wishlist',
      date_added: new Date().toISOString().split('T')[0],
    };
    await apiCall('create', 'book_library', payload);
    toast(`"${title}" added to library!`);
    closeUniversalModal();
    const lib = await apiGet('book_library');
    state.data.book_library = lib || [];
    booksRenderList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    toast('Failed to add book: ' + e.message);
  }
};

/* ── Summary Generation ── */
window.generateSummary = async function(bookId) {
  const book = (state.data.book_library || []).find(b => String(b.id) === String(bookId));
  if (!book) return;

  // Show progress overlay in main
  const main = document.getElementById('main');
  const prevHTML = main ? main.innerHTML : '';

  if (main) {
    main.innerHTML = `
      <div class="bl-gen-overlay">
        <div class="bl-gen-card">
          <div class="bl-gen-cover" style="background:${bookCoverGradient(book.title)}">${bookInitials(book.title)}</div>
          <h2 class="bl-gen-title">${escapeHtml(book.title)}</h2>
          <p class="bl-gen-author">by ${escapeHtml(book.author || '')}</p>
          <div class="bl-gen-spinner"></div>
          <p class="bl-gen-status" id="blGenStatus">Generating your 15-page summary...</p>
          <p class="bl-gen-hint">This may take 30-60 seconds. AI is reading and analyzing the book for you.</p>
        </div>
      </div>
    `;
  }

  try {
    const goalTitles = (state.data.vision || []).map(v => v.title);
    const summary = await AI_SERVICE.generateBookSummary(book.title, book.author, goalTitles);

    const payload = {
      book_id: bookId,
      book_title: book.title,
      author: book.author,
      summary_json: JSON.stringify(summary.pages),
      total_pages: (summary.pages || []).length,
      created_at: new Date().toISOString(),
      key_takeaways: JSON.stringify(summary.key_takeaways || []),
      action_items: JSON.stringify(summary.overall_action_plan || []),
    };

    const res = await apiCall('create', 'book_summaries', payload);
    toast('Summary generated!');

    const sums = await apiGet('book_summaries');
    state.data.book_summaries = sums || [];

    // Open reader with the new summary
    const newSum = (state.data.book_summaries || []).find(s =>
      String(s.book_id) === String(bookId)
    );
    if (newSum) {
      openBookReader(bookId);
    } else {
      renderBooks();
    }
  } catch (e) {
    console.error(e);
    toast('Summarization failed: ' + e.message);
    renderBooks();
  }
};

/* ── Open Reader ── */
window.openBookReader = function(bookId) {
  const sum = (state.data.book_summaries || []).find(s => String(s.book_id) === String(bookId));
  if (!sum) { toast('No summary found. Generate one first.'); return; }
  renderReader(sum.id);
};
