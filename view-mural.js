/* view-mural.js — Mural Multi-Project Whiteboard */

/* ── State ── */
let muralProjects = [];
let muralCategories = [];
let muralActiveProjectId = null;
let muralActiveCategory = 'all';

let muralElements = [];
let muralTransform = { x: 0, y: 0, scale: 1 };
let muralActiveTool = 'select';
let muralIsDragging = false;
let muralDragStart = { x: 0, y: 0 };
let muralSelectedElementId = null;
let muralPointerDown = false;

/* ── Constants ── */
const MURAL_COLORS = ['#fff9c4', '#ffccbc', '#e1f5fe', '#e8f5e9', '#f3e5f5'];

/* ═══════════════════════════════
   ENTRY POINT
   ═══════════════════════════════ */
async function renderMural() {
    const main = document.getElementById('main');
    if (!main) return;

    if (!muralActiveProjectId) {
        return renderMuralDashboard();
    }

    renderMuralCanvasView();
}

/* ═══════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════ */
async function renderMuralDashboard() {
    const main = document.getElementById('main');
    main.innerHTML = `<div class="nc-loading">Loading projects…</div>`;

    await loadMuralDashboardData();

    let filtered = muralProjects;
    if (muralActiveCategory !== 'all') {
        filtered = filtered.filter(p => p.category === muralActiveCategory);
    }

    main.innerHTML = `
        <div class="mural-dashboard">
            <div class="mural-header">
                <div class="mural-header-title">Mural</div>
                <div class="mural-header-actions">
                    <button class="nc-icon-btn" onclick="openMuralCategoryManager()" title="Edit Categories">
                        <i data-lucide="settings-2" style="width:20px;height:20px"></i>
                    </button>
                    <button class="nc-icon-btn" onclick="openNewMuralProjectModal()" title="Add Project">
                        <i data-lucide="plus" style="width:20px;height:20px"></i>
                    </button>
                </div>
            </div>

            <div class="mural-cat-bar">
                <button class="mural-cat-pill ${muralActiveCategory === 'all' ? 'active' : ''}" onclick="filterMuralBy('all')">All</button>
                ${muralCategories.map(cat => `
                    <button class="mural-cat-pill ${muralActiveCategory === cat.name ? 'active' : ''}" 
                        onclick="filterMuralBy('${cat.name}')">${cat.name}</button>
                `).join('')}
            </div>

            <div class="mural-grid">
                ${filtered.length === 0 ? '<div class="mural-empty">No projects found. Create one to get started!</div>' : ''}
                ${filtered.map(project => `
                    <div class="mural-project-card" onclick="openMuralProject(${project.id})">
                        <div class="mural-project-info">
                            <div class="mural-project-name">${escapeHtml(project.title)}</div>
                            <div class="mural-project-meta">${project.category} · ${new Date(project.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="mural-project-actions">
                            <button class="mural-project-del" onclick="event.stopPropagation(); deleteMuralProject(${project.id})">
                                <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

async function loadMuralDashboardData() {
    try {
        const [projRes, catRes] = await Promise.all([
            apiGet('mural_projects'),
            apiGet('mural_categories')
        ]);
        muralProjects = projRes || [];
        muralCategories = catRes || [];
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

function filterMuralBy(cat) {
    muralActiveCategory = cat;
    renderMuralDashboard();
}

function openMuralProject(id) {
    muralActiveProjectId = id;
    renderMural();
}

/* ═══════════════════════════════
   CANVAS VIEW
   ═══════════════════════════════ */
async function renderMuralCanvasView() {
    const main = document.getElementById('main');
    const project = muralProjects.find(p => p.id === muralActiveProjectId);

    main.innerHTML = `
        <div class="mural-page" id="muralPage">
            <div style="position:fixed; top:20px; left:20px; z-index:1001; display:flex; align-items:center; gap:12px;">
                <button class="nc-icon-btn" onclick="exitMuralProject()" title="Back to Dashboard" style="background:var(--surface-1)">
                    <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
                </button>
                <div style="font-weight:700; background:var(--surface-1); padding:8px 16px; border-radius:12px; box-shadow:var(--shadow-sm)">
                    ${escapeHtml(project ? project.title : 'Project')}
                </div>
            </div>

            <div class="mural-canvas" id="muralCanvas"></div>
            
            <div class="mural-toolbar">
                <button class="mural-tool ${muralActiveTool === 'select' ? 'active' : ''}" onclick="setMuralTool('select')" title="Select">
                    <i data-lucide="mouse-pointer-2"></i>
                </button>
                <button class="mural-tool" onclick="addMuralSticky()" title="Add Sticky Note">
                    <i data-lucide="sticky-note"></i>
                </button>
                <button class="mural-tool" onclick="setMuralTool('shape')" title="Draw Shape">
                    <i data-lucide="square"></i>
                </button>
                <button class="mural-tool" onclick="setMuralTool('text')" title="Add Text">
                    <i data-lucide="type"></i>
                </button>
                <div style="width: 1px; background: var(--border-color); margin: 4px 0;"></div>
                <button class="mural-tool" onclick="clearMuralSelected()" title="Delete Selected">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>

            <div class="mural-controls">
                <button class="mural-zoom-btn" onclick="zoomMural(1.2)" title="Zoom In">
                    <i data-lucide="zoom-in"></i>
                </button>
                <button class="mural-zoom-btn" onclick="zoomMural(0.8)" title="Zoom Out">
                    <i data-lucide="zoom-out"></i>
                </button>
                <button class="mural-zoom-btn" onclick="resetMuralView()" title="Reset View">
                    <i data-lucide="refresh-cw"></i>
                </button>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
    initMuralCanvas();
    loadMuralElements();
}

function exitMuralProject() {
    muralActiveProjectId = null;
    muralElements = [];
    muralTransform = { x: 0, y: 0, scale: 1 };
    renderMural();
}

async function loadMuralElements() {
    try {
        const res = await apiGet('mural_elements');
        // Filter elements for the current project
        muralElements = (res || []).filter(el => String(el.project_id) === String(muralActiveProjectId));
        renderMuralElementsDOM();
    } catch (err) {
        console.error('Error loading elements:', err);
    }
}

function renderMuralElementsDOM() {
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    muralElements.forEach(el => {
        canvas.appendChild(createMuralElementDOM(el));
    });
}

function createMuralElementDOM(data) {
    const div = document.createElement('div');
    div.className = `mural-element ${data.type}`;
    div.id = `mural-el-${data.id}`;
    div.style.left = `${data.x}px`;
    div.style.top = `${data.y}px`;
    div.style.width = data.w ? `${data.w}px` : 'auto';
    div.style.height = data.h ? `${data.h}px` : 'auto';
    div.style.backgroundColor = data.color || '';
    div.style.zIndex = data.z_index || 1;

    if (data.type === 'sticky') {
        div.contentEditable = true;
        div.innerText = data.content || '';
        div.oninput = () => debounceMuralSave(data.id, { content: div.innerText });
    }

    div.onpointerdown = (e) => {
        if (muralActiveTool === 'select') {
            e.stopPropagation();
            muralSelectedElementId = data.id;
            muralIsDragging = true;
            muralDragStart = {
                x: e.clientX / muralTransform.scale - data.x,
                y: e.clientY / muralTransform.scale - data.y
            };
        }
    };
    return div;
}

/* ═══════════════════════════════
   MANAGEMENT MODALS
   ═══════════════════════════════ */
function openNewMuralProjectModal() {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
        <h3>New Mural Project</h3>
        <p>Give your project a name and choose a category.</p>
        <input type="text" id="newProjectTitle" class="nc-ed-title" placeholder="Project Title" style="margin-bottom:16px;">
        <select id="newProjectCategory" class="nc-ed-cat-select" style="width:100%; margin-bottom:24px;">
            ${muralCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
        </select>
        <div style="display:flex; gap:12px;">
            <button class="btn primary" onclick="createMuralProject()" style="flex:1">Create Project</button>
            <button class="btn secondary" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1">Cancel</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

async function createMuralProject() {
    const title = document.getElementById('newProjectTitle').value.trim();
    const cat = document.getElementById('newProjectCategory').value;
    if (!title) return toast('Please enter a title');

    const payload = {
        title,
        category: cat,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_projects', payload });
        if (res.success) {
            toast('Project created!');
            document.getElementById('universalModal').classList.add('hidden');
            renderMuralDashboard();
        }
    } catch (err) {
        console.error(err);
        toast('Error creating project');
    }
}

async function deleteMuralProject(id) {
    if (!confirm('Are you sure you want to delete this project and all its elements?')) return;
    try {
        const res = await apiPost({ action: 'delete', sheet: 'mural_projects', id });
        if (res.success) {
            toast('Project deleted');
            renderMuralDashboard();
            // Optional: Also cleanup elements for this project in backend
        }
    } catch (err) {
        toast('Error deleting project');
    }
}

function openMuralCategoryManager() {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
        <h3>Categories</h3>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:24px;">
            ${muralCategories.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border-color)">
                    <span>${c.name}</span>
                    <button class="nc-bubble-del" onclick="deleteMuralCategory(${c.id})">×</button>
                </div>
            `).join('')}
        </div>
        <div style="display:flex; gap:8px; margin-bottom:24px;">
            <input type="text" id="newCatName" placeholder="New Category" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border-color)">
            <button class="btn primary" onclick="createMuralCategory()">Add</button>
        </div>
        <button class="btn secondary" style="width:100%" onclick="document.getElementById('universalModal').classList.add('hidden')">Close</button>
    `;
    modal.classList.remove('hidden');
}

async function createMuralCategory() {
    const name = document.getElementById('newCatName').value.trim().toLowerCase();
    if (!name) return;
    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_categories', payload: { name, color: '#6366F1' } });
        if (res.success) {
            await loadMuralDashboardData();
            openMuralCategoryManager();
        }
    } catch (err) { console.error(err); }
}

async function deleteMuralCategory(id) {
    try {
        await apiPost({ action: 'delete', sheet: 'mural_categories', id });
        await loadMuralDashboardData();
        openMuralCategoryManager();
    } catch (err) { console.error(err); }
}

/* ═══════════════════════════════
   CANVAS CORE & INTERACTIONS
   ═══════════════════════════════ */
function initMuralCanvas() {
    const canvas = document.getElementById('muralCanvas');
    const page = document.getElementById('muralPage');
    if (!canvas || !page) return;

    page.addEventListener('pointerdown', onMuralPointerDown);
    page.addEventListener('pointermove', onMuralPointerMove);
    page.addEventListener('pointerup', onMuralPointerUp);
    page.addEventListener('wheel', onMuralWheel, { passive: false });

    applyMuralTransform();
}

function applyMuralTransform() {
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;
    canvas.style.transform = `translate(${muralTransform.x}px, ${muralTransform.y}px) scale(${muralTransform.scale})`;
}

function onMuralPointerDown(e) {
    muralPointerDown = true;
    if (e.target.id === 'muralPage' || e.target.id === 'muralCanvas') {
        muralIsDragging = true;
        muralDragStart = { x: e.clientX - muralTransform.x, y: e.clientY - muralTransform.y };
        muralSelectedElementId = null;
    }
}

function onMuralPointerMove(e) {
    if (!muralIsDragging) return;
    if (muralSelectedElementId) {
        const el = muralElements.find(item => item.id === muralSelectedElementId);
        if (el) {
            el.x = e.clientX / muralTransform.scale - muralDragStart.x;
            el.y = e.clientY / muralTransform.scale - muralDragStart.y;
            const dom = document.getElementById(`mural-el-${el.id}`);
            if (dom) { dom.style.left = `${el.x}px`; dom.style.top = `${el.y}px`; }
        }
    } else {
        muralTransform.x = e.clientX - muralDragStart.x;
        muralTransform.y = e.clientY - muralDragStart.y;
        applyMuralTransform();
    }
}

function onMuralPointerUp() {
    if (muralSelectedElementId && muralIsDragging) {
        const el = muralElements.find(item => item.id === muralSelectedElementId);
        if (el) saveMuralElement(el);
    }
    muralIsDragging = false;
    muralPointerDown = false;
}

function onMuralWheel(e) { e.preventDefault(); zoomMural(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY); }

function zoomMural(factor, centerX, centerY) {
    const oldScale = muralTransform.scale;
    const newScale = Math.min(Math.max(oldScale * factor, 0.1), 5);
    if (!centerX) centerX = window.innerWidth / 2;
    if (!centerY) centerY = window.innerHeight / 2;
    muralTransform.x = centerX - (centerX - muralTransform.x) * (newScale / oldScale);
    muralTransform.y = centerY - (centerY - muralTransform.y) * (newScale / oldScale);
    muralTransform.scale = newScale;
    applyMuralTransform();
}

function resetMuralView() { muralTransform = { x: 0, y: 0, scale: 1 }; applyMuralTransform(); }
function setMuralTool(tool) {
    muralActiveTool = tool;
    document.querySelectorAll('.mural-tool').forEach(btn => btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tool}'`)));
}

/* ═══════════════════════════════
   ELEMENT ACTIONS
   ═══════════════════════════════ */
async function addMuralSticky() {
    const centerX = (window.innerWidth / 2 - muralTransform.x) / muralTransform.scale;
    const centerY = (window.innerHeight / 2 - muralTransform.y) / muralTransform.scale;
    const newEl = {
        project_id: muralActiveProjectId,
        type: 'sticky',
        x: centerX - 75, y: centerY - 75,
        w: 150, h: 150,
        content: 'New Note',
        color: MURAL_COLORS[Math.floor(Math.random() * MURAL_COLORS.length)],
        z_index: muralElements.length + 1
    };
    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_elements', payload: newEl });
        if (res.success) {
            newEl.id = res.id;
            muralElements.push(newEl);
            document.getElementById('muralCanvas').appendChild(createMuralElementDOM(newEl));
        }
    } catch (err) { console.error(err); }
}

async function clearMuralSelected() {
    if (!muralSelectedElementId) return;
    if (!confirm('Delete this element?')) return;
    try {
        const res = await apiPost({ action: 'delete', sheet: 'mural_elements', id: muralSelectedElementId });
        if (res.success) {
            document.getElementById(`mural-el-${muralSelectedElementId}`).remove();
            muralElements = muralElements.filter(el => el.id !== muralSelectedElementId);
            muralSelectedElementId = null;
        }
    } catch (err) { console.error(err); }
}

let muralSaveTimer = null;
function debounceMuralSave(id, data) {
    clearTimeout(muralSaveTimer);
    muralSaveTimer = setTimeout(() => {
        const el = muralElements.find(item => item.id === id);
        if (el) { Object.assign(el, data); saveMuralElement(el); }
    }, 1000);
}

async function saveMuralElement(el) {
    try { await apiPost({ action: 'update', sheet: 'mural_elements', id: el.id, payload: el }); }
    catch (err) { console.error(err); }
}
