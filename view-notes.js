/* view-notes.js - Notes App (SaaS Revamp) */

/* ── State ── */
let notesData = [];
let notesFilter = 'all';
let notesSearch = '';
let notesSort = 'recent';
let notesView = 'list';
let activeNoteId = null;
let notesIsNew = false;
let notesSaveTimer = null;
let notesPreviewMode = false;

/* ── Categories ── */
const NOTE_CATS = {
    all: { label: 'All', icon: '📋', color: '#6366F1' },
    personal: { label: 'Personal', icon: '👤', color: '#818CF8' },
    work: { label: 'Work', icon: '💼', color: '#F59E0B' },
    ideas: { label: 'Ideas', icon: '💡', color: '#10B981' },
    goals: { label: 'Goals', icon: '🎯', color: '#EF4444' },
    journal: { label: 'Journal', icon: '📔', color: '#EC4899' },
    learning: { label: 'Learning', icon: '📚', color: '#3B82F6' },
};

const NOTE_SORTS = {
    recent: 'Recently Updated',
    oldest: 'Oldest First',
    alpha: 'A → Z',
    pinned: 'Pinned First',
    created: 'Date Created',
};

/* ═══════════════════════════════
   ENTRY POINT
═══════════════════════════════ */
async function renderNotes() {
    const main = document.getElementById('main');

    main.innerHTML = `
        <div class="notes-shell" id="notesShell">
            <!-- ── Sidebar ── -->
            <div class="notes-sidebar" id="notesSidebar">
                <div class="notes-sidebar-header">
                    <div class="notes-sidebar-title">
                        <span>📝</span><span>Notes</span>
                    </div>
                    <div class="notes-sidebar-actions">
                        <button class="notes-icon-btn" id="notesViewToggle" onclick="toggleNotesView()" title="Toggle grid/list">
                            <i data-icon="layout-grid" style="width:14px;height:14px"></i>
                        </button>
                        <button class="notes-new-btn" onclick="createNewNote()">
                            <i data-icon="plus" style="width:13px;height:13px"></i> New
                        </button>
                    </div>
                </div>

                <div class="notes-search-wrap">
                    <i data-icon="search" style="width:13px;height:13px;color:var(--text-muted);flex-shrink:0"></i>
                    <input type="text" id="notesSearchInput" placeholder="Search notes…" oninput="notesOnSearch(this.value)">
                    <button class="notes-search-clear" id="notesSearchClear" onclick="clearNotesSearch()" style="display:none">
                        <i data-icon="x" style="width:10px;height:10px"></i>
                    </button>
                </div>

                <div class="notes-stats-mini">
                    <div class="notes-stat-mini"><span id="nsTotal">–</span><span>notes</span></div>
                    <div class="notes-stat-mini"><span id="nsWeek">–</span><span>this week</span></div>
                    <div class="notes-stat-mini"><span id="nsWords">–</span><span>words</span></div>
                </div>

                <div class="notes-section-label" style="padding:0 12px 4px">Categories</div>
                <div class="notes-cat-list" id="notesCatList">
                    ${Object.entries(NOTE_CATS).map(([k, v]) => `
                        <button class="notes-cat-btn ${k === 'all' ? 'active' : ''}"
                            data-cat="${k}" onclick="filterNotesBy('${k}')"
                            style="--cat-color:${v.color}">
                            <span class="notes-cat-icon">${v.icon}</span>
                            <span class="notes-cat-text">${v.label}</span>
                            <span class="notes-cat-count" id="ncc_${k}">0</span>
                        </button>
                    `).join('')}
                </div>

                <div class="notes-sort-row">
                    <select class="notes-sort-select" onchange="changeNotesSort(this.value)">
                        ${Object.entries(NOTE_SORTS).map(([k, v]) =>
        `<option value="${k}" ${notesSort === k ? 'selected' : ''}>${v}</option>`
    ).join('')}
                    </select>
                </div>

                <div class="notes-cards-list" id="notesCardsList">
                    <div class="notes-loading-state">Loading notes…</div>
                </div>
            </div>

            <!-- ── Main Detail ── -->
            <div class="notes-main" id="notesMain">
                <div class="notes-empty-panel">
                    <div class="notes-empty-icon">📝</div>
                    <h3>Select a note or create a new one</h3>
                    <p>Your thoughts, ideas, and work — all in one place</p>
                    <button class="notes-new-btn-lg" onclick="createNewNote()">+ Create your first note</button>
                </div>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    document.addEventListener('keydown', notesKeyboardHandler);
    await loadNotesData();
}

/* ═══════════════════════════════
   DATA
═══════════════════════════════ */
async function loadNotesData() {
    try {
        if (typeof initToolsSheets === 'function') await initToolsSheets();
        const res = await apiGet('notes');
        notesData = res || [];
        updateNotesStats();
        renderNotesCards();
        if (activeNoteId) {
            const note = notesData.find(n => String(n.id) === String(activeNoteId));
            if (note) renderNotesDetail(note);
        }
    } catch (err) {
        console.error('Error loading notes:', err);
        const el = document.getElementById('notesCardsList');
        if (el) el.innerHTML = `<div class="notes-error">⚠️ Failed to load notes</div>`;
    }
}

/* ═══════════════════════════════
   STATS
═══════════════════════════════ */
function updateNotesStats() {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const total = notesData.length;
    const week = notesData.filter(n => new Date(n.created_at || n.updated_at) >= weekAgo).length;
    const words = notesData.reduce((s, n) => s + notesWordCount(n.content), 0);

    const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = fmt(val); };
    set('nsTotal', total); set('nsWeek', week); set('nsWords', words);

    Object.keys(NOTE_CATS).forEach(k => {
        const count = k === 'all' ? total : notesData.filter(n => n.category === k).length;
        const ce = document.getElementById(`ncc_${k}`);
        if (ce) ce.textContent = count;
    });
}

/* ═══════════════════════════════
   CARDS
═══════════════════════════════ */
function renderNotesCards() {
    const el = document.getElementById('notesCardsList');
    if (!el) return;

    let list = [...notesData];
    if (notesFilter !== 'all') list = list.filter(n => n.category === notesFilter);
    if (notesSearch) {
        list = list.filter(n =>
            (n.title || '').toLowerCase().includes(notesSearch) ||
            (n.content || '').toLowerCase().includes(notesSearch) ||
            (n.tags || '').toLowerCase().includes(notesSearch)
        );
    }

    list.sort((a, b) => {
        if (notesSort === 'pinned') {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
        }
        if (notesSort === 'alpha') return (a.title || '').localeCompare(b.title || '');
        if (notesSort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (notesSort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });

    if (list.length === 0) {
        el.innerHTML = `<div class="notes-cards-empty">${notesSearch ? '🔍' : '📭'}<br>${notesSearch ? 'No results' : 'No notes yet'}</div>`;
        return;
    }

    const pinned = list.filter(n => n.is_pinned);
    const unpinned = list.filter(n => !n.is_pinned);
    let html = '';

    if (pinned.length && notesSort === 'recent') {
        html += `<div class="notes-group-label">📌 Pinned</div>`;
        html += pinned.map(noteCardHTML).join('');
        if (unpinned.length) html += `<div class="notes-group-label">Recent</div>`;
    }
    html += (notesSort === 'recent' ? unpinned : list).map(noteCardHTML).join('');

    el.innerHTML = html;
    el.className = `notes-cards-list${notesView === 'grid' ? ' grid' : ''}`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
}

function noteCardHTML(note) {
    const cat = NOTE_CATS[note.category] || NOTE_CATS.personal;
    const isActive = String(note.id) === String(activeNoteId);
    const preview = notesGetPreview(note.content, notesSearch);
    const dateStr = notesRelDate(note.updated_at || note.created_at);
    const wc = notesWordCount(note.content);
    const tags = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    return `
        <div class="notes-card ${isActive ? 'active' : ''} ${note.is_pinned ? 'pinned' : ''}"
            style="--cat-color:${cat.color}" onclick="selectNotesCard('${note.id}')">
            <div class="notes-card-accent"></div>
            <div class="notes-card-body">
                <div class="notes-card-top">
                    <span class="notes-card-title">${notesSearch ? notesHighlight(escapeHtml(note.title || 'Untitled'), notesSearch) : escapeHtml(note.title || 'Untitled')}</span>
                    <button class="notes-card-pin-btn ${note.is_pinned ? 'on' : ''}"
                        onclick="notesQuickPin(event,'${note.id}')" title="Pin">📌</button>
                </div>
                <div class="notes-card-preview">${preview}</div>
                <div class="notes-card-footer">
                    <span class="notes-card-cat" style="color:${cat.color};background:${cat.color}22">${cat.icon} ${cat.label}</span>
                    <span class="notes-card-meta">${dateStr} · ${wc}w</span>
                </div>
                ${tags.length ? `<div class="notes-card-tags">${tags.slice(0, 3).map(t => `<span class="notes-card-tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            </div>
        </div>
    `;
}

/* ═══════════════════════════════
   DETAIL PANEL
═══════════════════════════════ */
function renderNotesDetail(note) {
    const main = document.getElementById('notesMain');
    if (!main) return;

    notesPreviewMode = false;
    const cat = NOTE_CATS[note.category] || NOTE_CATS.personal;
    const wc = notesWordCount(note.content);
    const rt = notesReadingTime(note.content);
    const date = notesRelDate(note.updated_at || note.created_at);
    const tags = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    main.innerHTML = `
        <div class="notes-detail-wrap">
            <!-- Back btn (mobile) -->
            <button class="notes-back-btn" onclick="notesCloseMobile()">← Back</button>

            <!-- Top bar -->
            <div class="notes-detail-topbar">
                <input class="notes-detail-title" id="noteTitleInput"
                    value="${escapeHtml(note.title || '')}" placeholder="Untitled note…"
                    oninput="notesDebounceSave()">
                <div class="notes-topbar-right">
                    <span class="notes-save-badge" id="notesSaveBadge"></span>
                    <button class="notes-act-btn ${note.is_pinned ? 'on' : ''}" onclick="toggleNotePin('${note.id}')" title="Pin">📌</button>
                    <button class="notes-act-btn" onclick="copyNoteToClipboard()" title="Copy">
                        <i data-icon="copy" style="width:14px;height:14px"></i>
                    </button>
                    <button class="notes-act-btn danger" onclick="deleteNoteById('${note.id}')" title="Delete">
                        <i data-icon="trash-2" style="width:14px;height:14px"></i>
                    </button>
                </div>
            </div>

            <!-- Meta -->
            <div class="notes-detail-meta">
                <select class="notes-cat-picker" id="noteCatPicker" onchange="notesDebounceSave()">
                    ${Object.entries(NOTE_CATS).filter(([k]) => k !== 'all').map(([k, v]) =>
        `<option value="${k}" ${note.category === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
    ).join('')}
                </select>
                <span class="notes-meta-pill" id="noteRTChip">⏱ ${rt}</span>
                <span class="notes-meta-pill" id="noteWCChip">${wc} words</span>
                <span class="notes-meta-pill">🕐 ${date}</span>
            </div>

            <!-- Toolbar -->
            <div class="notes-toolbar">
                <button class="ntb" onclick="notesFormat('bold')"      title="Bold Ctrl+B"><b>B</b></button>
                <button class="ntb" onclick="notesFormat('italic')"    title="Italic Ctrl+I"><i>I</i></button>
                <span class="ntb-sep"></span>
                <button class="ntb" onclick="notesFormat('h1')"        title="Heading 1">H1</button>
                <button class="ntb" onclick="notesFormat('h2')"        title="Heading 2">H2</button>
                <button class="ntb" onclick="notesFormat('h3')"        title="Heading 3">H3</button>
                <span class="ntb-sep"></span>
                <button class="ntb" onclick="notesFormat('bullet')"    title="Bullet list">• List</button>
                <button class="ntb" onclick="notesFormat('checklist')" title="Checklist">☑ Task</button>
                <button class="ntb" onclick="notesFormat('quote')"     title="Quote">" Quote</button>
                <span class="ntb-sep"></span>
                <button class="ntb" onclick="notesFormat('code')"      title="Inline code"><code>\`code\`</code></button>
                <button class="ntb" onclick="notesFormat('codeblock')" title="Code block">```</button >
                <button class="ntb" onclick="notesFormat('hr')"        title="Divider">—</button>
                <span class="ntb-flex"></span>
                <button class="ntb ntb-preview" id="notesPreviewBtn" onclick="notesTogglePreview()">
                    <i data-icon="eye" style="width:13px;height:13px"></i> Preview
                </button>
            </div >

            < !--Editor -->
            <div class="notes-content-area" id="notesContentArea">
                <textarea class="notes-editor" id="noteEditor"
                    placeholder="Start writing… Markdown is supported"
                    oninput="notesDebounceSave(); notesLiveCount(this)"
                    onkeydown="notesEditorKey(event)"
                >${escapeHtml(note.content || '')}</textarea>
            </div>

            <!--Footer -->
        <div class="notes-detail-footer">
            <div class="notes-tags-row" id="notesTagsRow">
                ${tags.map(t => notesTagChipHTML(t)).join('')}
                <input class="notes-tag-input" id="notesTagInput"
                    placeholder="+ tag"
                    onkeydown="notesTagKey(event)"
                    onfocus="this.placeholder='type + Enter'"
                    onblur="this.placeholder='+ tag'">
            </div>
            <span class="notes-wc-label" id="notesWCLabel">${wc} words</span>
        </div>
        </div >
        `;

    // Mobile: show detail panel
    document.getElementById('notesShell')?.classList.add('notes-has-detail');

    if (notesIsNew) {
        setTimeout(() => {
            const t = document.getElementById('noteTitleInput');
            if (t) { t.focus(); t.select(); }
        }, 50);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: main });
}

function notesTagChipHTML(tag) {
    return `< span class="notes-tag-chip" > #${ escapeHtml(tag) } <button class="notes-tag-x" onclick="notesRemoveTag('${escapeHtml(tag)}')">×</button></span > `;
}

/* ═══════════════════════════════
   SELECT / CREATE
═══════════════════════════════ */
function selectNotesCard(id) {
    if (activeNoteId && notesSaveTimer) {
        clearTimeout(notesSaveTimer);
        notesSaveTimer = null;
        saveNoteNow(true);
    }
    notesIsNew      = false;
    notesPreviewMode = false;
    activeNoteId    = id;
    renderNotesCards();
    const note = notesData.find(n => String(n.id) === String(id));
    if (note) renderNotesDetail(note);
}

function createNewNote() {
    if (activeNoteId && notesSaveTimer) {
        clearTimeout(notesSaveTimer);
        notesSaveTimer = null;
        saveNoteNow(true);
    }
    notesIsNew       = true;
    notesPreviewMode = false;
    activeNoteId     = null;
    renderNotesDetail({
        id:         null,
        title:      '',
        content:    '',
        category:   notesFilter !== 'all' ? notesFilter : 'personal',
        tags:       '',
        is_pinned:  false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
}

function notesCloseMobile() {
    document.getElementById('notesShell')?.classList.remove('notes-has-detail');
    activeNoteId = null;
}

/* ═══════════════════════════════
   AUTO-SAVE
═══════════════════════════════ */
function notesDebounceSave() {
    const badge = document.getElementById('notesSaveBadge');
    if (badge) { badge.textContent = '● unsaved'; badge.className = 'notes-save-badge unsaved'; }
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(saveNoteNow, 1500);
}

async function saveNoteNow(silent = false) {
    const titleEl   = document.getElementById('noteTitleInput');
    const editorEl  = document.getElementById('noteEditor');
    const catEl     = document.getElementById('noteCatPicker');
    if (!titleEl) return;

    const tagChips = [...document.querySelectorAll('.notes-tag-chip')]
        .map(el => el.textContent.replace('×', '').replace('#', '').trim())
        .filter(Boolean);

    const payload = {
        title:      titleEl.value.trim() || 'Untitled',
        content:    editorEl?.value || '',
        category:   catEl?.value || 'personal',
        tags:       tagChips.join(', '),
        updated_at: new Date().toISOString(),
    };

    const badge = document.getElementById('notesSaveBadge');
    if (badge && !silent) { badge.textContent = '◌ saving…'; badge.className = 'notes-save-badge saving'; }

    try {
        let res;
        if (notesIsNew) {
            payload.created_at = new Date().toISOString();
            res = await apiPost({ action: 'create', sheet: 'notes', payload });
            if (res.success) {
                notesIsNew   = false;
                activeNoteId = res.id || res.data?.id;
                await loadNotesData();
            }
        } else if (activeNoteId) {
            res = await apiPost({ action: 'update', sheet: 'notes', id: activeNoteId, payload });
            if (res.success) {
                const idx = notesData.findIndex(n => String(n.id) === String(activeNoteId));
                if (idx >= 0) Object.assign(notesData[idx], payload);
                updateNotesStats();
                renderNotesCards();
            }
        }
        if (badge && !silent) {
            badge.textContent = '✓ saved';
            badge.className   = 'notes-save-badge saved';
            setTimeout(() => { if (badge) badge.textContent = ''; }, 2000);
        }
    } catch (err) {
        console.error('Save error:', err);
        if (badge) { badge.textContent = '✗ error'; badge.className = 'notes-save-badge error'; }
    }
}

/* ═══════════════════════════════
   FORMATTING TOOLBAR
═══════════════════════════════ */
const NOTES_FMT = {
    bold:      { b: '**',    a: '**',    ph: 'bold text' },
    italic:    { b: '*',     a: '*',     ph: 'italic text' },
    h1:        { b: '# ',    a: '',      ph: 'Heading 1',   nl: true },
    h2:        { b: '## ',   a: '',      ph: 'Heading 2',   nl: true },
    h3:        { b: '### ',  a: '',      ph: 'Heading 3',   nl: true },
    code:      { b: '`',     a: '`',     ph: 'code' },
    codeblock: { b: '```\n', a: '\n```', ph: 'code here',   nl: true },
    bullet:    { b: '- ',    a: '',      ph: 'list item',   nl: true },
    checklist: { b: '- [ ] ',a: '',      ph: 'task',        nl: true },
    quote:     { b: '> ',    a: '',      ph: 'quote',       nl: true },
    hr:        { insert: '\n---\n' },
};

function notesFormat(type) {
    const ta = document.getElementById('noteEditor');
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const f = NOTES_FMT[type]; if (!f) return;
    let newVal, ns, ne;
    if (f.insert) {
        newVal = ta.value.slice(0, s) + f.insert + ta.value.slice(e);
        ns = ne = s + f.insert.length;
    } else {
        const text   = ta.value.slice(s, e) || f.ph;
        const prefix = f.nl && s > 0 && ta.value[s - 1] !== '\n' ? '\n' : '';
        newVal = ta.value.slice(0, s) + prefix + f.b + text + f.a + ta.value.slice(e);
        ns = s + prefix.length + f.b.length;
        ne = ns + text.length;
    }
    ta.value = newVal;
    ta.focus();
    ta.setSelectionRange(ns, ne);
    notesDebounceSave();
    notesLiveCount(ta);
}

function notesEditorKey(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target, s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(s);
        ta.setSelectionRange(s + 2, s + 2);
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); notesFormat('bold'); }
        if (e.key === 'i') { e.preventDefault(); notesFormat('italic'); }
        if (e.key === 's') { e.preventDefault(); clearTimeout(notesSaveTimer); saveNoteNow(); }
    }
}

function notesLiveCount(ta) {
    const wc = notesWordCount(ta.value);
    const wl = document.getElementById('notesWCLabel');
    const wc2 = document.getElementById('noteWCChip');
    const rt  = document.getElementById('noteRTChip');
    if (wl)  wl.textContent  = `${ wc } words`;
    if (wc2) wc2.textContent = `${ wc } words`;
    if (rt)  rt.textContent  = `⏱ ${ notesReadingTime(ta.value) } `;
}

/* ── Preview (markdown render) ── */
function notesTogglePreview() {
    const area = document.getElementById('notesContentArea');
    const btn  = document.getElementById('notesPreviewBtn');
    const ta   = document.getElementById('noteEditor');
    if (!area) return;

    notesPreviewMode = !notesPreviewMode;
    if (notesPreviewMode) {
        const html = notesRenderMD(ta?.value || '');
        area.innerHTML = `< div class="notes-preview" onclick = "notesTogglePreview()" > ${ html }</div > `;
        if (btn) btn.innerHTML = `< i data - icon="edit-2" style = "width:13px;height:13px" ></i > Edit`;
    } else {
        const note = notesData.find(n => String(n.id) === String(activeNoteId));
        area.innerHTML = `< textarea class="notes-editor" id = "noteEditor"
    placeholder = "Start writing… Markdown is supported"
    oninput = "notesDebounceSave(); notesLiveCount(this)"
    onkeydown = "notesEditorKey(event)"
        > ${ escapeHtml(note?.content || '') }</textarea > `;
        if (btn) btn.innerHTML = `< i data - icon="eye" style = "width:13px;height:13px" ></i > Preview`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: area });
}

/* ═══════════════════════════════
   TAGS
═══════════════════════════════ */
function notesTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, '-');
        if (!val) return;
        const existing = [...document.querySelectorAll('.notes-tag-chip')]
            .map(el => el.textContent.replace('×', '').replace('#', '').trim());
        if (existing.includes(val)) { e.target.value = ''; return; }
        const row   = document.getElementById('notesTagsRow');
        const input = document.getElementById('notesTagInput');
        const chip  = document.createElement('span');
        chip.className = 'notes-tag-chip';
        chip.innerHTML = `#${ escapeHtml(val) } <button class="notes-tag-x" onclick="notesRemoveTag('${escapeHtml(val)}')">×</button>`;
        row.insertBefore(chip, input);
        e.target.value = '';
        notesDebounceSave();
    }
    if (e.key === 'Backspace' && !e.target.value) {
        const chips = document.querySelectorAll('.notes-tag-chip');
        if (chips.length) { chips[chips.length - 1].remove(); notesDebounceSave(); }
    }
}

function notesRemoveTag(tag) {
    document.querySelectorAll('.notes-tag-chip').forEach(el => {
        if (el.textContent.replace('×', '').replace('#', '').trim() === tag) el.remove();
    });
    notesDebounceSave();
}

/* ═══════════════════════════════
   PIN / COPY / DELETE
═══════════════════════════════ */
function notesQuickPin(e, id) {
    e.stopPropagation();
    toggleNotePin(id);
}

async function toggleNotePin(id) {
    const note = notesData.find(n => String(n.id) === String(id));
    if (!note) return;
    try {
        const res = await apiPost({ action: 'update', sheet: 'notes', id,
            payload: { is_pinned: !note.is_pinned, updated_at: new Date().toISOString() } });
        if (res.success) {
            note.is_pinned = !note.is_pinned;
            renderNotesCards();
            const btn = document.querySelector('.notes-act-btn.on, .notes-act-btn[onclick*="toggleNotePin"]');
            toast(note.is_pinned ? '📌 Pinned!' : '📌 Unpinned');
        }
    } catch (err) { console.error(err); }
}

function copyNoteToClipboard() {
    const title   = document.getElementById('noteTitleInput')?.value || '';
    const content = document.getElementById('noteEditor')?.value || '';
    navigator.clipboard.writeText(`${ title } \n\n${ content } `)
        .then(() => toast('📋 Copied to clipboard!'))
        .catch(() => toast('❌ Copy failed'));
}

async function deleteNoteById(id) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
        const res = await apiPost({ action: 'delete', sheet: 'notes', id });
        if (res.success) {
            notesData    = notesData.filter(n => String(n.id) !== String(id));
            activeNoteId = null;
            notesIsNew   = false;
            updateNotesStats();
            renderNotesCards();
            document.getElementById('notesShell')?.classList.remove('notes-has-detail');
            const main = document.getElementById('notesMain');
            if (main) main.innerHTML = `< div class="notes-empty-panel" ><div class="notes-empty-icon">🗑️</div><h3>Note deleted</h3><p>Select or create a note</p></div > `;
            toast('🗑️ Note deleted');
        }
    } catch (err) { toast('❌ Error deleting note'); }
}

/* ═══════════════════════════════
   FILTER / SORT / VIEW
═══════════════════════════════ */
function filterNotesBy(cat) {
    notesFilter = cat;
    document.querySelectorAll('.notes-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    renderNotesCards();
}

function notesOnSearch(val) {
    notesSearch = val.toLowerCase().trim();
    const clr = document.getElementById('notesSearchClear');
    if (clr) clr.style.display = notesSearch ? 'flex' : 'none';
    renderNotesCards();
}

function clearNotesSearch() {
    notesSearch = '';
    const inp = document.getElementById('notesSearchInput');
    if (inp) inp.value = '';
    const clr = document.getElementById('notesSearchClear');
    if (clr) clr.style.display = 'none';
    renderNotesCards();
}

function changeNotesSort(val) {
    notesSort = val;
    renderNotesCards();
}

function toggleNotesView() {
    notesView = notesView === 'list' ? 'grid' : 'list';
    renderNotesCards();
    const btn = document.getElementById('notesViewToggle');
    if (btn) {
        btn.innerHTML = notesView === 'grid'
            ? `< i data - icon="list" style = "width:14px;height:14px" ></i > `
            : `< i data - icon="layout-grid" style = "width:14px;height:14px" ></i > `;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
    }
}

/* ═══════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════ */
function notesKeyboardHandler(e) {
    if (!document.getElementById('notesSidebar')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.target.matches('input,textarea')) {
        e.preventDefault(); createNewNote();
    }
    if (e.key === 'Escape' && notesIsNew) {
        notesIsNew = false; activeNoteId = null;
        document.getElementById('notesShell')?.classList.remove('notes-has-detail');
        const m = document.getElementById('notesMain');
        if (m) m.innerHTML = `< div class="notes-empty-panel" ><div class="notes-empty-icon">📝</div><h3>No note selected</h3></div > `;
    }
}

/* ═══════════════════════════════
   MARKDOWN RENDERER
═══════════════════════════════ */
function notesRenderMD(text) {
    if (!text) return '<p class="nmd-empty">Nothing here yet… click to edit</p>';
    let h = escapeHtml(text);

    // Fenced code blocks
    h = h.replace(/```([^ `]*?)``` / gs, (_, c) => `<pre class="nmd-pre"><code>${c.trim()}</code></pre>`);
    // Inline code
    h = h.replace(/`([^`\n]+)`/g, '<code class="nmd-code">$1</code>');
    // Headers
    h = h.replace(/^### (.+)$/gm, '<h3 class="nmd-h3">$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2 class="nmd-h2">$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1 class="nmd-h1">$1</h1>');
    // HR
    h = h.replace(/^---$/gm, '<hr class="nmd-hr">');
    // Checkboxes
    h = h.replace(/^- \[x\] (.+)$/gm, '<div class="nmd-check done">✓ $1</div>');
    h = h.replace(/^- \[ \] (.+)$/gm, '<div class="nmd-check">○ $1</div>');
    // Bullet lists
    h = h.replace(/(^[-*] .+$\n?)+/gm, m => {
        const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('');
        return `<ul class="nmd-ul">${items}</ul>`;
    });
    // Blockquote (&gt; after escaping)
    h = h.replace(/^&gt; (.+)$/gm, '<blockquote class="nmd-quote">$1</blockquote>');
    // Bold + italic
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/_(.+?)_/g, '<em>$1</em>');
    // Paragraphs
    h = h.split(/\n\n+/).map(block => {
        block = block.trim();
        if (!block) return '';
        if (/^<(h[123]|ul|ol|blockquote|pre|hr|div)/.test(block)) return block;
        return `<p class="nmd-p">${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return h;
}

/* ═══════════════════════════════
   HELPERS
═══════════════════════════════ */
function notesWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function notesReadingTime(text) {
    const wc = notesWordCount(text);
    if (!wc) return '< 1 min';
    return `${Math.max(1, Math.ceil(wc / 200))} min read`;
}

function notesGetPreview(content, search) {
    if (!content) return '<span style="opacity:0.4">Empty note</span>';
    const plain = content.replace(/[#*`>_\-]/g, '').substring(0, 110) + (content.length > 110 ? '…' : '');
    if (search) return notesHighlight(escapeHtml(plain), search);
    return escapeHtml(plain);
}

function notesHighlight(html, query) {
    if (!query) return html;
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${esc})`, 'gi'), '<mark class="notes-hl">$1</mark>');
}

function notesRelDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr), now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function closeModal() {
    const modal = document.getElementById('universalModal');
    if (modal) modal.classList.add('hidden');
}

function showNotification(msg) {
    if (typeof toast === 'function') toast(msg); else alert(msg);
}
