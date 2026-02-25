/* view-notes.js - Note Taking App */

let notesData = [];
let currentNoteFilter = 'all';
let selectedNote = null;

// Render Notes Page
async function renderNotes() {
    const main = document.getElementById('main');
    
    // Show loading skeleton
    main.innerHTML = `
        <div class="view-header">
            <div class="view-title-section">
                <h1 class="view-title">
                    <i data-icon="notebook" style="width:28px;height:28px;margin-right:8px;color:var(--success)"></i>
                    Notes
                </h1>
                <p class="view-subtitle">Your personal notes and ideas</p>
            </div>
            <button class="btn-primary" onclick="openNoteModal()">
                <i data-icon="add" style="width:18px;height:18px;margin-right:6px"></i>
                New Note
            </button>
        </div>
        
        <div class="notes-search-bar">
            <i data-icon="search" style="width:18px;height:18px;color:var(--text-muted)"></i>
            <input type="text" id="notesSearch" placeholder="Search notes..." oninput="searchNotes(this.value)">
        </div>
        
        <div class="notes-categories">
            <button class="category-btn active" data-category="all" onclick="filterNotes('all')">All</button>
            <button class="category-btn" data-category="personal" onclick="filterNotes('personal')">Personal</button>
            <button class="category-btn" data-category="work" onclick="filterNotes('work')">Work</button>
            <button class="category-btn" data-category="ideas" onclick="filterNotes('ideas')">Ideas</button>
        </div>
        
        <div class="notes-layout">
            <div class="notes-list" id="notesList">
                <!-- Notes list will be rendered here -->
            </div>
            <div class="note-detail" id="noteDetail">
                <div class="empty-state">
                    <i data-icon="notebook" style="width:48px;height:48px;color:var(--text-muted)"></i>
                    <h3>Select a note</h3>
                    <p>Choose a note from the list or create a new one</p>
                </div>
            </div>
        </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
    
    // Load data
    await loadNotesData();
}

// Load Notes Data
async function loadNotesData() {
    try {
        const response = await apiGet('notes');
        notesData = response || [];
        renderNotesList();
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

// Render Notes List
function renderNotesList(searchQuery = '') {
    const listContainer = document.getElementById('notesList');
    if (!listContainer) return;
    
    let filtered = notesData;
    
    // Apply category filter
    if (currentNoteFilter !== 'all') {
        filtered = filtered.filter(n => n.category === currentNoteFilter);
    }
    
    // Apply search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(n => 
            (n.title && n.title.toLowerCase().includes(query)) || 
            (n.content && n.content.toLowerCase().includes(query))
        );
    }
    
    // Sort: pinned first, then by updated_at
    const sorted = filtered.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
    
    if (sorted.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state-small">
                <i data-icon="notebook" style="width:32px;height:32px;color:var(--text-muted)"></i>
                <p>No notes found</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = sorted.map(note => `
            <div class="note-card ${selectedNote?.id === note.id ? 'selected' : ''}" onclick="selectNote(${note.id})">
                <div class="note-card-header">
                    <span class="note-title">${note.title || 'Untitled'}</span>
                    ${note.is_pinned ? '<i data-icon="pin" style="width:14px;height:14px;color:var(--warning)"></i>' : ''}
                </div>
                <div class="note-preview">${getNotePreview(note.content)}</div>
                <div class="note-meta">
                    <span class="note-category ${note.category}">${note.category || 'personal'}</span>
                    <span class="note-date">${formatNoteDate(note.updated_at || note.created_at)}</span>
                </div>
            </div>
        `).join('');
    }
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: listContainer });
    }
}

// Get Note Preview
function getNotePreview(content) {
    if (!content) return 'No content';
    return content.substring(0, 100) + (content.length > 100 ? '...' : '');
}

// Format Note Date
function formatNoteDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Select Note
function selectNote(id) {
    selectedNote = notesData.find(n => n.id === id);
    renderNoteDetail();
    renderNotesList(document.getElementById('notesSearch')?.value || '');
}

// Render Note Detail
function renderNoteDetail() {
    const detailContainer = document.getElementById('noteDetail');
    if (!detailContainer || !selectedNote) return;
    
    detailContainer.innerHTML = `
        <div class="note-detail-header">
            <h2 class="note-detail-title">${selectedNote.title || 'Untitled'}</h2>
            <div class="note-detail-actions">
                <button class="icon-btn" onclick="togglePinNote(${selectedNote.id})">
                    <i data-icon="${selectedNote.is_pinned ? 'pin-filled' : 'pin'}" style="width:18px;height:18px"></i>
                </button>
                <button class="icon-btn" onclick="openNoteModal(selectedNote)">
                    <i data-icon="edit" style="width:18px;height:18px"></i>
                </button>
                <button class="icon-btn danger" onclick="deleteNote(${selectedNote.id})">
                    <i data-icon="delete" style="width:18px;height:18px"></i>
                </button>
            </div>
        </div>
        <div class="note-detail-meta">
            <span class="note-category ${selectedNote.category}">${selectedNote.category || 'personal'}</span>
            <span>Created: ${formatNoteDate(selectedNote.created_at)}</span>
            ${selectedNote.updated_at ? `<span>Updated: ${formatNoteDate(selectedNote.updated_at)}</span>` : ''}
        </div>
        <div class="note-detail-content">
            ${selectedNote.content ? selectedNote.content.replace(/\n/g, '<br>') : '<p class="empty-content">No content</p>'}
        </div>
        ${selectedNote.tags ? `
        <div class="note-tags">
            ${selectedNote.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
        </div>
        ` : ''}
    `;
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: detailContainer });
    }
}

// Filter Notes
function filterNotes(category) {
    currentNoteFilter = category;
    
    // Update category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    renderNotesList(document.getElementById('notesSearch')?.value || '');
}

// Search Notes
function searchNotes(query) {
    renderNotesList(query);
}

// Open Note Modal
function openNoteModal(note = null) {
    const isEdit = !!note;
    const modal = document.getElementById('universalModal');
    const modalBox = modal.querySelector('.modal-box');
    
    modalBox.innerHTML = `
        <div class="modal-header">
            <h2>${isEdit ? 'Edit Note' : 'New Note'}</h2>
            <button class="modal-close" onclick="closeModal()">
                <i data-icon="x" style="width:20px;height:20px"></i>
            </button>
        </div>
        <form class="modal-form" onsubmit="saveNote(event, ${isEdit ? note.id : 'null'})">
            <div class="form-group">
                <label>Title</label>
                <input type="text" name="title" value="${note?.title || ''}" placeholder="Note title" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select name="category" required>
                    <option value="personal" ${note?.category === 'personal' ? 'selected' : ''}>Personal</option>
                    <option value="work" ${note?.category === 'work' ? 'selected' : ''}>Work</option>
                    <option value="ideas" ${note?.category === 'ideas' ? 'selected' : ''}>Ideas</option>
                </select>
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea name="content" rows="8" placeholder="Write your note here...">${note?.content || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" name="tags" value="${note?.tags || ''}" placeholder="e.g., important, project, ideas">
            </div>
            <div class="form-group-checkbox">
                <input type="checkbox" name="is_pinned" id="isPinned" ${note?.is_pinned ? 'checked' : ''}>
                <label for="isPinned">Pin this note</label>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Save'} Note</button>
            </div>
        </form>
    `;
    
    modal.classList.remove('hidden');
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: modalBox });
    }
}

// Save Note
async function saveNote(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const payload = {
        title: formData.get('title'),
        category: formData.get('category'),
        content: formData.get('content'),
        tags: formData.get('tags'),
        is_pinned: formData.get('is_pinned') === 'on',
        updated_at: new Date().toISOString()
    };
    
    if (!id) {
        payload.created_at = new Date().toISOString();
    }
    
    try {
        let response;
        if (id) {
            response = await apiPost({ action: 'update', sheet: 'notes', id, payload });
        } else {
            response = await apiPost({ action: 'create', sheet: 'notes', payload });
        }
        
        if (response.success) {
            closeModal();
            await loadNotesData();
            if (id) {
                selectNote(id);
            }
            showNotification(id ? 'Note updated!' : 'Note created!', 'success');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showNotification('Error saving note', 'error');
    }
}

// Toggle Pin Note
async function togglePinNote(id) {
    const note = notesData.find(n => n.id === id);
    if (!note) return;
    
    try {
        const response = await apiPost({ 
            action: 'update', 
            sheet: 'notes', 
            id, 
            payload: {
                is_pinned: !note.is_pinned,
                updated_at: new Date().toISOString()
            }
        });
        
        if (response.success) {
            await loadNotesData();
            selectedNote = notesData.find(n => n.id === id);
            renderNoteDetail();
            showNotification(note.is_pinned ? 'Note unpinned!' : 'Note pinned!', 'success');
        }
    } catch (error) {
        console.error('Error toggling pin:', error);
    }
}

// Delete Note
async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    
    try {
        const response = await apiPost({ action: 'delete', sheet: 'notes', id });
        if (response.success) {
            selectedNote = null;
            await loadNotesData();
            renderNoteDetail();
            showNotification('Note deleted!', 'success');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showNotification('Error deleting note', 'error');
    }
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    if (typeof toast === 'function') {
        toast(message);
    } else {
        alert(message);
    }
}
