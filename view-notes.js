/* view-notes.js — Notes Chat Interface */

/* ── State ── */
let notesData = [];
let notesFilter = 'all';
let notesSearch = '';
let notesSort = 'recent';
let activeNoteId = null;
let notesIsNew = false;
let notesSaveTimer = null;
let notesComposeCategory = 'personal';

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

/* ── Formatting ── */
const NOTES_FMT = {
    bold: { b: '**', a: '**', ph: 'bold text' },
    italic: { b: '*', a: '*', ph: 'italic text' },
    h1: { b: '# ', a: '', ph: 'Heading 1', nl: true },
    h2: { b: '## ', a: '', ph: 'Heading 2', nl: true },
    h3: { b: '### ', a: '', ph: 'Heading 3', nl: true },
    code: { b: '\x60', a: '\x60', ph: 'code' },
    codeblock: { b: '\x60\x60\x60\n', a: '\n\x60\x60\x60', ph: 'code here', nl: true },
    bullet: { b: '- ', a: '', ph: 'list item', nl: true },
    checklist: { b: '- [ ] ', a: '', ph: 'task', nl: true },
    quote: { b: '> ', a: '', ph: 'quote', nl: true },
    hr: { insert: '\n---\n' },
};

/* ═══════════════════════════════
   ENTRY POINT
═══════════════════════════════ */
function renderNotes() {
    const main = document.getElementById('main');
    if (!main) return;

    main.innerHTML = [
        '<div class="nc-shell" id="ncShell">',
        '  <div class="nc-header">',
        '    <div class="nc-header-left">',
        '      <span class="nc-header-title">Notes</span>',
        '      <span class="nc-count-badge" id="ncCount">0</span>',
        '    </div>',
        '    <div class="nc-header-right">',
        '      <button class="nc-icon-btn" onclick="ncToggleSearch()" title="Search">',
        '        <i data-lucide="search" style="width:18px;height:18px"></i>',
        '      </button>',
        '    </div>',
        '  </div>',
        '  <div class="nc-search-bar hidden" id="ncSearchBar">',
        '    <i data-lucide="search" style="width:15px;height:15px;flex-shrink:0;opacity:0.5"></i>',
        '    <input type="text" placeholder="Search notes…" oninput="ncOnSearch(this.value)" id="ncSearchInput">',
        '    <button class="nc-search-close" onclick="ncCloseSearch()">×</button>',
        '  </div>',
        '  <div class="nc-filter-bar" id="ncFilterBar">',
        '    ' + Object.entries(NOTE_CATS).map(function (entry) {
            var k = entry[0]; var v = entry[1];
            return '<button class="nc-filter-pill' + (k === 'all' ? ' active' : '') + '" ' +
                'data-cat="' + k + '" onclick="ncFilterBy(\'' + k + '\')" ' +
                'style="--pill-color:' + v.color + '">' + v.icon + ' ' + v.label + '</button>';
        }).join(''),
        '  </div>',
        '  <div class="nc-feed" id="ncFeed"><div class="nc-loading">Loading notes…</div></div>',
        '  <div class="nc-cat-picker-popup hidden" id="ncCatPickerPopup">',
        '    ' + Object.entries(NOTE_CATS).filter(function (e) { return e[0] !== 'all'; }).map(function (entry) {
            var k = entry[0]; var v = entry[1];
            return '<button class="nc-cat-option" onclick="ncSetComposeCategory(\'' + k + '\')">' +
                v.icon + ' ' + v.label + '</button>';
        }).join(''),
        '  </div>',
        '  <div class="nc-compose" id="ncCompose">',
        '    <button class="nc-compose-cat-btn" id="ncComposeCatBtn" onclick="ncToggleCatPicker()" title="Category">',
        '      <span id="ncComposeCatIcon">' + NOTE_CATS.personal.icon + '</span>',
        '    </button>',
        '    <input class="nc-compose-input" id="ncComposeInput" type="text"',
        '      placeholder="Quick note… (Enter to send)"',
        '      onkeydown="ncComposeKey(event)">',
        '    <button class="nc-compose-edit-btn" onclick="ncOpenNewEditor()" title="Full editor">',
        '      <i data-lucide="edit-3" style="width:18px;height:18px"></i>',
        '    </button>',
        '    <button class="nc-compose-send-btn" onclick="ncQuickSend()" title="Send">',
        '      <i data-lucide="send" style="width:18px;height:18px"></i>',
        '    </button>',
        '  </div>',
        '</div>',
        '<div class="nc-editor-overlay hidden" id="ncEditorOverlay">',
        '  <div class="nc-editor-sheet" id="ncEditorSheet"></div>',
        '</div>'
    ].join('\n');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    loadNotesData();
}

/* ═══════════════════════════════
   DATA
═══════════════════════════════ */
async function loadNotesData() {
    try {
        if (typeof initToolsSheets === 'function') await initToolsSheets();

        if (state.data.notes && state.data.notes.length > 0) {
            notesData = state.data.notes;
        } else {
            const res = await apiGet('notes');
            notesData = res || [];
            state.data.notes = notesData;
        }

        ncRenderFeed();
        ncUpdateCount();
    } catch (err) {
        console.error('Error loading notes:', err);
        const el = document.getElementById('ncFeed');
        if (el) el.innerHTML = '<div class="nc-error">Failed to load notes</div>';
    }
}

/* ═══════════════════════════════
   FEED RENDER
═══════════════════════════════ */
function ncRenderFeed() {
    const el = document.getElementById('ncFeed');
    if (!el) return;

    let list = notesData.slice();
    if (notesFilter !== 'all') list = list.filter(function (n) { return n.category === notesFilter; });
    if (notesSearch) {
        var q = notesSearch.toLowerCase();
        list = list.filter(function (n) {
            return (n.title || '').toLowerCase().indexOf(q) >= 0 ||
                (n.content || '').toLowerCase().indexOf(q) >= 0 ||
                (n.tags || '').toLowerCase().indexOf(q) >= 0;
        });
    }

    list.sort(function (a, b) {
        var pa = a.is_pinned ? 1 : 0;
        var pb = b.is_pinned ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });

    if (list.length === 0) {
        el.innerHTML = '<div class="nc-empty">' +
            (notesSearch ? '🔍 No results for "' + escapeHtml(notesSearch) + '"' : '📭 No notes yet — type below to create one') +
            '</div>';
        return;
    }

    var groups = {};
    var groupOrder = [];
    list.forEach(function (note) {
        var key = ncDayKey(note.updated_at || note.created_at);
        if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
        groups[key].push(note);
    });

    var html = '';
    groupOrder.forEach(function (key) {
        html += '<div class="nc-date-sep"><span>' + escapeHtml(key) + '</span></div>';
        groups[key].forEach(function (note) {
            html += ncBubbleHTML(note);
        });
    });

    el.innerHTML = html;
    ncUpdateCount();
}

function ncBubbleHTML(note) {
    var cat = NOTE_CATS[note.category] || NOTE_CATS.personal;
    var isActive = String(note.id) === String(activeNoteId);
    var tags = note.tags ? note.tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
    var preview = note.content ? note.content.replace(/[#*>\-_]/g, '').substring(0, 120) + (note.content.length > 120 ? '…' : '') : '';
    var titleHtml = notesSearch ? notesHighlight(escapeHtml(note.title || 'Untitled'), notesSearch) : escapeHtml(note.title || 'Untitled');
    var previewHtml = notesSearch && preview ? notesHighlight(escapeHtml(preview), notesSearch) : escapeHtml(preview);
    var timeStr = ncTimeStr(note.updated_at || note.created_at);
    var wc = notesWordCount(note.content);

    return '<div class="nc-bubble' + (isActive ? ' active' : '') + (note.is_pinned ? ' pinned' : '') + '" ' +
        'style="--bubble-color:' + cat.color + '" ' +
        'onclick="ncOpenEditor(\'' + note.id + '\')" id="ncB_' + note.id + '">' +
        '<div class="nc-bubble-accent"></div>' +
        '<div class="nc-bubble-body">' +
        '<div class="nc-bubble-top">' +
        '<span class="nc-bubble-cat-icon">' + cat.icon + '</span>' +
        '<span class="nc-bubble-title">' + titleHtml + '</span>' +
        (note.is_pinned ? '<span class="nc-bubble-pin" title="Pinned">📌</span>' : '') +
        '<button class="nc-bubble-del" onclick="ncDeleteNote(event,\'' + note.id + '\')" title="Delete">×</button>' +
        '</div>' +
        (preview ? '<div class="nc-bubble-preview">' + previewHtml + '</div>' : '') +
        '<div class="nc-bubble-footer">' +
        '<div class="nc-bubble-tags">' +
        tags.slice(0, 3).map(function (t) { return '<span class="nc-bubble-tag">#' + escapeHtml(t) + '</span>'; }).join('') +
        '</div>' +
        '<span class="nc-bubble-meta">' + timeStr + (wc ? ' · ' + wc + 'w' : '') + '</span>' +
        '</div>' +
        '</div>' +
        '</div>';
}

/* ═══════════════════════════════
   EDITOR OVERLAY
═══════════════════════════════ */
function ncOpenEditor(id) {
    if (notesSaveTimer) { clearTimeout(notesSaveTimer); notesSaveTimer = null; saveNoteNow(true); }
    activeNoteId = id;
    notesIsNew = false;
    var note = notesData.find(function (n) { return String(n.id) === String(id); });
    if (!note) return;
    ncRenderEditor(note);
    var overlay = document.getElementById('ncEditorOverlay');
    if (overlay) overlay.classList.remove('hidden');
    setTimeout(function () {
        var t = document.getElementById('ncEditorTitle');
        if (t) t.focus();
    }, 80);
    ncRenderFeed();
}

function ncOpenNewEditor() {
    if (notesSaveTimer) { clearTimeout(notesSaveTimer); notesSaveTimer = null; saveNoteNow(true); }
    var composeInput = document.getElementById('ncComposeInput');
    var initialTitle = composeInput ? composeInput.value.trim() : '';
    notesIsNew = true;
    activeNoteId = null;
    var note = {
        id: null,
        title: initialTitle,
        content: '',
        category: notesComposeCategory,
        tags: '',
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    ncRenderEditor(note);
    var overlay = document.getElementById('ncEditorOverlay');
    if (overlay) overlay.classList.remove('hidden');
    if (composeInput) composeInput.value = '';
    setTimeout(function () {
        var t = document.getElementById('ncEditorTitle');
        if (t) { t.focus(); if (initialTitle) { t.select(); } }
    }, 80);
}

function ncRenderEditor(note) {
    var sheet = document.getElementById('ncEditorSheet');
    if (!sheet) return;
    var cat = NOTE_CATS[note.category] || NOTE_CATS.personal;
    var tags = note.tags ? note.tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
    var wc = notesWordCount(note.content);
    var isExisting = !notesIsNew && note.id;

    var catOptions = Object.entries(NOTE_CATS).filter(function (e) { return e[0] !== 'all'; }).map(function (entry) {
        var k = entry[0]; var v = entry[1];
        return '<option value="' + k + '"' + (note.category === k ? ' selected' : '') + '>' + v.icon + ' ' + v.label + '</option>';
    }).join('');

    sheet.innerHTML = [
        '<div class="nc-ed-handle"></div>',
        '<div class="nc-ed-topbar">',
        '  <button class="nc-ed-close" onclick="ncCloseEditor()">← Back</button>',
        '  <div class="nc-ed-topbar-right">',
        '    <span class="nc-ed-save-badge" id="ncEdSaveBadge"></span>',
        '    <button class="nc-ed-action" onclick="ncTogglePin(\'' + (note.id || '') + '\')" title="Pin">' + (note.is_pinned ? '📌' : '📍') + '</button>',
        (isExisting ? '    <button class="nc-ed-action danger" onclick="ncDeleteNote(event,\'' + note.id + '\')" title="Delete"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>' : ''),
        '  </div>',
        '</div>',
        '<input class="nc-ed-title" id="ncEditorTitle" type="text" placeholder="Note title…"',
        '  value="' + escapeHtml(note.title || '') + '"',
        '  oninput="notesDebounceSave()">',
        '<div class="nc-ed-meta">',
        '  <select class="nc-ed-cat-select" id="ncEdCatSelect" onchange="notesDebounceSave()">' + catOptions + '</select>',
        '  <span class="nc-ed-wc" id="ncEdWC">' + wc + ' words</span>',
        '</div>',
        '<div class="nc-ed-toolbar">',
        '  <button class="nc-tb" onclick="notesFormat(\'bold\')" title="Bold Ctrl+B"><b>B</b></button>',
        '  <button class="nc-tb" onclick="notesFormat(\'italic\')" title="Italic Ctrl+I"><i>I</i></button>',
        '  <span class="nc-tb-sep"></span>',
        '  <button class="nc-tb" onclick="notesFormat(\'h1\')" title="Heading 1">H1</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'h2\')" title="Heading 2">H2</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'bullet\')" title="Bullet">• List</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'checklist\')" title="Checklist">☑ Task</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'quote\')" title="Quote">&ldquo; Quote</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'code\')" title="Code">&#96;code&#96;</button>',
        '  <button class="nc-tb" onclick="notesFormat(\'hr\')" title="Divider">—</button>',
        '</div>',
        '<textarea class="nc-ed-content" id="ncEditorContent"',
        '  placeholder="Start writing… Markdown is supported"',
        '  oninput="notesDebounceSave(); ncLiveCount(this)"',
        '  onkeydown="notesEditorKey(event)">' + escapeHtml(note.content || '') + '</textarea>',
        '<div class="nc-ed-footer">',
        '  <div class="nc-ed-tags-row" id="ncEdTagsRow">',
        '    ' + tags.map(function (t) { return ncTagChipHTML(t); }).join(''),
        '    <input class="nc-ed-tag-input" id="ncEdTagInput" type="text"',
        '      placeholder="+ tag"',
        '      onkeydown="ncTagKey(event)"',
        '      onfocus="this.placeholder=\'type + Enter\'"',
        '      onblur="this.placeholder=\'+ tag\'">',
        '  </div>',
        '</div>'
    ].join('\n');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: sheet });
}

function ncCloseEditor() {
    if (notesSaveTimer) { clearTimeout(notesSaveTimer); notesSaveTimer = null; saveNoteNow(true); }
    var overlay = document.getElementById('ncEditorOverlay');
    if (overlay) overlay.classList.add('hidden');
    activeNoteId = null;
    notesIsNew = false;
    loadNotesData();
}

function ncEditorBackdropClick(e) {
    var sheet = document.getElementById('ncEditorSheet');
    if (sheet && !sheet.contains(e.target)) {
        ncCloseEditor();
    }
}

/* ═══════════════════════════════
   AUTO-SAVE
═══════════════════════════════ */
function notesDebounceSave() {
    var badge = document.getElementById('ncEdSaveBadge');
    if (badge) { badge.textContent = '● unsaved'; badge.className = 'nc-ed-save-badge unsaved'; }
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(saveNoteNow, 1500);
}

async function saveNoteNow(silent) {
    var titleEl = document.getElementById('ncEditorTitle');
    var editorEl = document.getElementById('ncEditorContent');
    var catEl = document.getElementById('ncEdCatSelect');
    if (!titleEl) return;

    var tagChips = Array.from(document.querySelectorAll('#ncEdTagsRow .nc-tag-chip')).map(function (el) {
        return el.textContent.replace('×', '').replace('#', '').trim();
    }).filter(Boolean);

    var payload = {
        title: titleEl.value.trim() || 'Untitled',
        content: editorEl ? editorEl.value : '',
        category: catEl ? catEl.value : 'personal',
        tags: tagChips.join(', '),
        updated_at: new Date().toISOString(),
    };

    var badge = document.getElementById('ncEdSaveBadge');
    if (badge && !silent) { badge.textContent = '◌ saving…'; badge.className = 'nc-ed-save-badge saving'; }

    try {
        var res;
        if (notesIsNew) {
            payload.created_at = new Date().toISOString();
            res = await apiPost({ action: 'create', sheet: 'notes', payload: payload });
            if (res.success) {
                notesIsNew = false;
                activeNoteId = res.id || (res.data && res.data.id);
                notesData.unshift(Object.assign({ id: activeNoteId }, payload));
                ncUpdateCount();
            }
        } else if (activeNoteId) {
            res = await apiPost({ action: 'update', sheet: 'notes', id: activeNoteId, payload: payload });
            if (res.success) {
                var idx = notesData.findIndex(function (n) { return String(n.id) === String(activeNoteId); });
                if (idx >= 0) Object.assign(notesData[idx], payload);
            }
        }
        if (badge && !silent) {
            badge.textContent = '✓ saved';
            badge.className = 'nc-ed-save-badge saved';
            setTimeout(function () { if (badge) badge.textContent = ''; }, 2000);
        }
    } catch (err) {
        console.error('Save error:', err);
        if (badge) { badge.textContent = '✗ error'; badge.className = 'nc-ed-save-badge error'; }
    }
}

/* ═══════════════════════════════
   QUICK SEND (COMPOSE BAR)
═══════════════════════════════ */
async function ncQuickSend() {
    var input = document.getElementById('ncComposeInput');
    if (!input) return;
    var title = input.value.trim();
    if (!title) return;

    input.value = '';
    var payload = {
        title: title,
        content: '',
        category: notesComposeCategory,
        tags: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    try {
        var res = await apiPost({ action: 'create', sheet: 'notes', payload: payload });
        if (res.success) {
            if (typeof toast === 'function') toast('Note created!');
            await loadNotesData();
        }
    } catch (err) {
        console.error('Quick send error:', err);
        if (typeof toast === 'function') toast('Failed to create note');
    }
}

function ncComposeKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        ncQuickSend();
    }
}

/* ═══════════════════════════════
   FILTER / SEARCH
═══════════════════════════════ */
function ncFilterBy(cat) {
    notesFilter = cat;
    document.querySelectorAll('.nc-filter-pill').forEach(function (b) {
        b.classList.toggle('active', b.dataset.cat === cat);
    });
    ncRenderFeed();
}

function ncToggleSearch() {
    var bar = document.getElementById('ncSearchBar');
    if (!bar) return;
    var hidden = bar.classList.toggle('hidden');
    if (!hidden) {
        var inp = document.getElementById('ncSearchInput');
        if (inp) inp.focus();
    }
}

function ncCloseSearch() {
    notesSearch = '';
    var bar = document.getElementById('ncSearchBar');
    if (bar) bar.classList.add('hidden');
    var inp = document.getElementById('ncSearchInput');
    if (inp) inp.value = '';
    ncRenderFeed();
}

function ncOnSearch(val) {
    notesSearch = val.toLowerCase().trim();
    ncRenderFeed();
}

/* ═══════════════════════════════
   COMPOSE CATEGORY PICKER
═══════════════════════════════ */
function ncToggleCatPicker() {
    var popup = document.getElementById('ncCatPickerPopup');
    if (popup) popup.classList.toggle('hidden');
}

function ncSetComposeCategory(k) {
    notesComposeCategory = k;
    var cat = NOTE_CATS[k] || NOTE_CATS.personal;
    var icon = document.getElementById('ncComposeCatIcon');
    if (icon) icon.textContent = cat.icon;
    var popup = document.getElementById('ncCatPickerPopup');
    if (popup) popup.classList.add('hidden');
}

/* ═══════════════════════════════
   PIN / DELETE
═══════════════════════════════ */
async function ncTogglePin(id) {
    var note = notesData.find(function (n) { return String(n.id) === String(id); });
    if (!note && !notesIsNew) return;
    if (notesIsNew || !id) {
        if (typeof toast === 'function') toast('Save note first to pin');
        return;
    }
    try {
        var newPinned = !note.is_pinned;
        var res = await apiPost({
            action: 'update', sheet: 'notes', id: id,
            payload: { is_pinned: newPinned, updated_at: new Date().toISOString() }
        });
        if (res.success) {
            note.is_pinned = newPinned;
            if (typeof toast === 'function') toast(newPinned ? '📌 Pinned!' : '📌 Unpinned');
            var actionBtn = document.querySelector('.nc-ed-topbar-right .nc-ed-action');
            if (actionBtn) actionBtn.textContent = newPinned ? '📌' : '📍';
        }
    } catch (err) { console.error(err); }
}

async function ncDeleteNote(e, id) {
    if (e) e.stopPropagation();
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
        var res = await apiPost({ action: 'delete', sheet: 'notes', id: id });
        if (res.success) {
            notesData = notesData.filter(function (n) { return String(n.id) !== String(id); });
            if (String(activeNoteId) === String(id)) {
                activeNoteId = null;
                notesIsNew = false;
                var overlay = document.getElementById('ncEditorOverlay');
                if (overlay) overlay.classList.add('hidden');
            }
            if (typeof toast === 'function') toast('Note deleted');
            ncRenderFeed();
        }
    } catch (err) {
        if (typeof toast === 'function') toast('Failed to delete note');
    }
}

/* ═══════════════════════════════
   TAGS
═══════════════════════════════ */
function ncTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        var val = e.target.value.replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, '-');
        if (!val) return;
        var existing = Array.from(document.querySelectorAll('#ncEdTagsRow .nc-tag-chip')).map(function (el) {
            return el.textContent.replace('×', '').replace('#', '').trim();
        });
        if (existing.indexOf(val) >= 0) { e.target.value = ''; return; }
        var row = document.getElementById('ncEdTagsRow');
        var input = document.getElementById('ncEdTagInput');
        var chip = document.createElement('span');
        chip.className = 'nc-tag-chip';
        chip.innerHTML = '#' + escapeHtml(val) + ' <button class="nc-tag-x" onclick="ncRemoveTag(\'' + escapeHtml(val) + '\')">×</button>';
        row.insertBefore(chip, input);
        e.target.value = '';
        notesDebounceSave();
    }
    if (e.key === 'Backspace' && !e.target.value) {
        var chips = document.querySelectorAll('#ncEdTagsRow .nc-tag-chip');
        if (chips.length) { chips[chips.length - 1].remove(); notesDebounceSave(); }
    }
}

function ncRemoveTag(tag) {
    document.querySelectorAll('#ncEdTagsRow .nc-tag-chip').forEach(function (el) {
        if (el.textContent.replace('×', '').replace('#', '').trim() === tag) el.remove();
    });
    notesDebounceSave();
}

/* ═══════════════════════════════
   FORMATTING TOOLBAR
═══════════════════════════════ */
function notesFormat(type) {
    var ta = document.getElementById('ncEditorContent');
    if (!ta) return;
    var s = ta.selectionStart, en = ta.selectionEnd;
    var f = NOTES_FMT[type];
    if (!f) return;
    var newVal, ns, ne;
    if (f.insert) {
        newVal = ta.value.slice(0, s) + f.insert + ta.value.slice(en);
        ns = ne = s + f.insert.length;
    } else {
        var text = ta.value.slice(s, en) || f.ph;
        var prefix = (f.nl && s > 0 && ta.value[s - 1] !== '\n') ? '\n' : '';
        newVal = ta.value.slice(0, s) + prefix + f.b + text + f.a + ta.value.slice(en);
        ns = s + prefix.length + f.b.length;
        ne = ns + text.length;
    }
    ta.value = newVal;
    ta.focus();
    ta.setSelectionRange(ns, ne);
    notesDebounceSave();
    ncLiveCount(ta);
}

function notesEditorKey(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        var ta = e.target, s = ta.selectionStart;
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

/* ═══════════════════════════════
   HELPERS
═══════════════════════════════ */
function ncLiveCount(ta) {
    var wc = notesWordCount(ta.value);
    var el = document.getElementById('ncEdWC');
    if (el) el.textContent = wc + ' words';
}

function notesWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
}

function notesHighlight(html, query) {
    if (!query) return html;
    var esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp('(' + esc + ')', 'gi'), '<mark class="nc-hl">$1</mark>');
}

function ncDayKey(dateStr) {
    if (!dateStr) return 'Unknown';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function ncTimeStr(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    var days = Math.floor(diff / 86400);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notesRelDate(dateStr) {
    return ncTimeStr(dateStr);
}

function ncTagChipHTML(tag) {
    return '<span class="nc-tag-chip">#' + escapeHtml(tag) + ' <button class="nc-tag-x" onclick="ncRemoveTag(\'' + escapeHtml(tag) + '\')">×</button></span>';
}

function ncUpdateCount() {
    var el = document.getElementById('ncCount');
    if (el) el.textContent = notesData.length;
}
