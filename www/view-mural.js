/* ══════════════════════════════════════════════════════════════
   view-mural.js — World-Class Infinite Canvas Whiteboard
   Premium SaaS · Mobile-first · Touch-friendly · iOS-safe
   Script Version: 2026-03-14-v3
   ══════════════════════════════════════════════════════════════ */
const MURAL_SCRIPT_VERSION = '2026-03-14-v3';
console.log(`Mural Script Loaded: ${MURAL_SCRIPT_VERSION}`);

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
let muralUndoStack = [];
let muralContextMenuEl = null;
let muralColorPickerEl = null;
let muralIsResizing = false;
let muralResizeStart = { w: 0, h: 0, x: 0, y: 0 };

/* ── Connector State ── */
let muralConnectors = [];
let muralConnectorSource = null;   // ID of source element when creating connector
let muralSelectedConnectorId = null;

/* ── Constants ── */
const MURAL_COLORS = [
    '#fff9c4', '#ffccbc', '#e1f5fe', '#e8f5e9', '#f3e5f5',
    '#fce4ec', '#e0f7fa', '#fff3e0', '#f1f8e9', '#ede7f6',
    '#e8eaf6', '#fbe9e7'
];

const MURAL_COLOR_NAMES = {
    '#fff9c4': 'Lemon', '#ffccbc': 'Peach', '#e1f5fe': 'Sky',
    '#e8f5e9': 'Mint', '#f3e5f5': 'Lavender', '#fce4ec': 'Rose',
    '#e0f7fa': 'Aqua', '#fff3e0': 'Amber', '#f1f8e9': 'Sage',
    '#ede7f6': 'Violet', '#e8eaf6': 'Periwinkle', '#fbe9e7': 'Coral'
};

/* ═══════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════ */
async function renderMural() {
    const main = document.getElementById('main');
    if (!main) return;

    // Cleanup any previous context menus / pickers
    dismissMuralPopups();

    if (!muralActiveProjectId) {
        return renderMuralDashboard();
    }
    renderMuralCanvasView();
}

/* ═══════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════ */
async function renderMuralDashboard() {
    const main = document.getElementById('main');

    // Use preloaded data from state if available, otherwise fetch
    if (state.data.mural_projects && muralProjects.length === 0) {
        muralProjects = state.data.mural_projects || [];
        muralCategories = state.data.mural_categories || [];
    }
    if (muralProjects.length === 0 && !state.data.mural_projects) {
        main.innerHTML = `
            <div class="mural-loading">
                <div class="mural-spinner"></div>
                <span>Loading projects…</span>
            </div>`;
        await loadMuralDashboardData();
    }

    let filtered = muralProjects;
    if (muralActiveCategory !== 'all') {
        filtered = filtered.filter(p => p.category === muralActiveCategory);
    }

    // Count elements per project — use preloaded data
    let elementCounts = {};
    try {
        const allEls = state.data.mural_elements || await apiGet('mural_elements');
        (allEls || []).forEach(el => {
            const pid = String(el.project_id);
            elementCounts[pid] = (elementCounts[pid] || 0) + 1;
        });
    } catch (e) { /* silent */ }

    main.innerHTML = `
        <div class="mural-dashboard">
            <div class="mural-header">
                <div class="mural-header-left">
                    <div class="mural-header-title">Mural</div>
                    <div class="mural-header-subtitle">${muralProjects.length} project${muralProjects.length !== 1 ? 's' : ''}</div>
                </div>
                <div class="mural-header-actions">
                    <button class="mural-header-btn" onclick="repairMuralData()" title="Repair Data & Remove Duplicates">
                        <i data-lucide="wrench" style="width:18px;height:18px"></i>
                    </button>
                    <button class="mural-header-btn" onclick="openMuralCategoryManager()" title="Edit Categories">
                        <i data-lucide="settings-2" style="width:18px;height:18px"></i>
                    </button>
                    <button class="mural-add-btn" onclick="openNewMuralProjectModal()">
                        <i data-lucide="plus" style="width:18px;height:18px"></i>
                        <span>New Project</span>
                    </button>
                </div>
            </div>

            ${muralCategories.length > 0 ? `
            <div class="mural-cat-bar">
                <button class="mural-cat-pill ${muralActiveCategory === 'all' ? 'active' : ''}" onclick="filterMuralBy('all')">All</button>
                ${muralCategories.map(cat => `
                    <button class="mural-cat-pill ${muralActiveCategory === cat.name ? 'active' : ''}"
                        onclick="filterMuralBy('${escapeHtml(cat.name)}')">${escapeHtml(cat.name)}</button>
                `).join('')}
            </div>` : ''}

            <div class="mural-grid">
                ${filtered.length === 0 ? `
                    <div class="mural-empty">
                        <div class="mural-empty-icon"><i data-lucide="layout-dashboard" style="width:28px;height:28px"></i></div>
                        <div class="mural-empty-title">No projects yet</div>
                        <div class="mural-empty-desc">Create your first mural project to start organizing ideas on an infinite canvas.</div>
                    </div>
                ` : ''}
                ${filtered.map(project => {
        const count = elementCounts[String(project.id)] || 0;
        // Generate preview dots from element colors
        const projectEls = (muralElements || []).filter(el => String(el.project_id) === String(project.id));
        return `
                    <div class="mural-project-card" onclick="openMuralProject('${project.id}')">
                        <div class="mural-project-card-preview">
                            <div class="preview-dots">
                                ${count > 0 ? Array.from({ length: Math.min(count, 8) }).map((_, i) =>
            `<div class="preview-dot" style="background:${MURAL_COLORS[i % MURAL_COLORS.length]}"></div>`
        ).join('') : '<i data-lucide="layers" style="width:24px;height:24px;opacity:0.3"></i>'}
                            </div>
                        </div>
                        <div class="mural-project-info">
                            <div class="mural-project-name">${escapeHtml(project.title)}</div>
                            <div class="mural-project-meta">
                                <span>${escapeHtml(project.category || 'Uncategorized')}</span>
                                <span class="mural-project-meta-dot"></span>
                                <span>${formatMuralDate(project.created_at)}</span>
                            </div>
                        </div>
                        <div class="mural-project-footer">
                            <div class="mural-project-el-count">${count} element${count !== 1 ? 's' : ''}</div>
                            <div class="mural-project-actions">
                                <button class="mural-project-edit" onclick="event.stopPropagation(); openEditMuralProjectModal('${project.id}')" title="Edit project">
                                    <i data-lucide="edit-3" style="width:14px;height:14px"></i>
                                </button>
                                <button class="mural-project-del" onclick="event.stopPropagation(); deleteMuralProject('${project.id}')" title="Delete project">
                                    <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
    }).join('')}
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function formatMuralDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadMuralDashboardData() {
    try {
        const [projRes, catRes] = await Promise.all([
            apiGet('mural_projects'),
            apiGet('mural_categories')
        ]);
        muralProjects = projRes || [];
        muralCategories = catRes || [];
        // Sync with global state for dashboard counts
        state.data.mural_projects = muralProjects;
        state.data.mural_categories = muralCategories;
    } catch (err) {
        console.error('Error loading dashboard data:', err);
        toast('Failed to load projects');
    }
}

function filterMuralBy(cat) {
    muralActiveCategory = cat;
    renderMuralDashboard();
}

function openMuralProject(id) {
    muralActiveProjectId = id;
    muralTransform = { x: 0, y: 0, scale: 1 };
    muralSelectedElementId = null;
    muralActiveTool = 'select';
    muralUndoStack = [];
    renderMural();
}

/* ═══════════════════════════════════════
   CANVAS VIEW
   ═══════════════════════════════════════ */
async function renderMuralCanvasView() {
    const main = document.getElementById('main');
    const project = muralProjects.find(p => p.id === muralActiveProjectId);

    main.innerHTML = `
        <div class="mural-page" id="muralPage">
            <!-- Top Bar -->
            <div class="mural-topbar">
                <div class="mural-topbar-left">
                    <button class="mural-back-btn" onclick="exitMuralProject()" title="Back to Dashboard">
                        <i data-lucide="arrow-left" style="width:18px;height:18px"></i>
                    </button>
                    <div class="mural-project-title-bar">${escapeHtml(project ? project.title : 'Project')}</div>
                </div>
                <div class="mural-topbar-right">
                    <button class="mural-save-btn" id="muralManualSaveBtn" onclick="manualMuralSync()">
                        <i data-lucide="save"></i> Save
                    </button>
                    <span class="mural-zoom-badge" id="muralZoomBadge">100%</span>
                </div>
            </div>

            <!-- Save Indicator -->
            <div class="mural-save-indicator" id="muralSaveIndicator">
                <span id="muralSaveText">Saved</span>
            </div>

            <!-- Canvas -->
            <div class="mural-canvas" id="muralCanvas">
                <!-- SVG overlay for connectors -->
                <svg id="muralConnectorSvg" class="mural-connector-svg" width="10000" height="10000">
                    <defs>
                        <marker id="mural-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
                            <polygon points="0 0, 10 3.5, 0 7" fill="var(--mural-accent, #6366F1)" />
                        </marker>
                        <marker id="mural-arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                        </marker>
                    </defs>
                </svg>
            </div>

            <!-- Toolbar -->
            <div class="mural-toolbar" id="muralToolbar">
                <button class="mural-tool active" data-tool="select" onclick="setMuralTool('select')" data-tooltip="Select & Move">
                    <i data-lucide="mouse-pointer-2"></i>
                </button>
                <button class="mural-tool" data-tool="sticky" onclick="addMuralSticky()" data-tooltip="Sticky Note">
                    <i data-lucide="sticky-note"></i>
                </button>
                <button class="mural-tool" data-tool="text" onclick="addMuralText()" data-tooltip="Text">
                    <i data-lucide="type"></i>
                </button>
            <div class="mural-tool-group">
                <button class="mural-tool" data-tool="shapes" onclick="toggleMuralShapeMenu(event)" data-tooltip="Shapes">
                    <i data-lucide="shapes"></i>
                </button>
                <div class="mural-tool-popover" id="muralShapeMenu">
                    <button class="mural-popover-item" onclick="addMuralShape('rect')"><i data-lucide="square"></i> Rectangle</button>
                    <button class="mural-popover-item" onclick="addMuralShape('circle')"><i data-lucide="circle"></i> Circle</button>
                    <button class="mural-popover-item" onclick="addMuralShape('triangle')"><i data-lucide="triangle"></i> Triangle</button>
                    <button class="mural-popover-item" onclick="addMuralShape('diamond')"><i data-lucide="diamond"></i> Diamond</button>
                    <button class="mural-popover-item" onclick="addMuralShape('hexagon')"><i data-lucide="hexagon"></i> Hexagon</button>
                    <button class="mural-popover-item" onclick="addMuralShape('star')"><i data-lucide="star"></i> Star</button>
                </div>
            </div>
            <button class="mural-tool" onclick="openMuralIconLibrary()" data-tooltip="Icons">
                <i data-lucide="smile"></i>
            </button>
                <div class="mural-toolbar-divider"></div>
                <button class="mural-tool" data-tool="connector" onclick="setMuralTool('connector')" data-tooltip="Connector (L)">
                    <i data-lucide="arrow-up-right"></i>
                </button>
                <div class="mural-toolbar-divider"></div>
                <button class="mural-tool" onclick="duplicateMuralSelected()" data-tooltip="Duplicate">
                    <i data-lucide="copy"></i>
                </button>
                <button class="mural-tool danger" onclick="deleteMuralSelected()" data-tooltip="Delete">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>

            <!-- Zoom Controls -->
            <div class="mural-controls">
                <button class="mural-zoom-btn" onclick="zoomMural(1.25)" title="Zoom In">
                    <i data-lucide="plus"></i>
                </button>
                <button class="mural-zoom-btn" onclick="zoomMural(0.8)" title="Zoom Out">
                    <i data-lucide="minus"></i>
                </button>
                <button class="mural-zoom-btn" onclick="fitMuralToContent()" title="Fit to Content">
                    <i data-lucide="maximize-2"></i>
                </button>
                <button class="mural-zoom-btn" onclick="resetMuralView()" title="Reset View">
                    <i data-lucide="scan"></i>
                </button>
            </div>

            <!-- Undo Toast -->
            <div class="mural-undo-toast" id="muralUndoToast">
                <span id="muralUndoText">Element deleted</span>
                <button class="mural-undo-btn" onclick="muralUndo()">Undo</button>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Hide app chrome (bottom nav, FAB, search) for full-screen canvas
    hideMuralAppChrome(true);

    initMuralCanvas();
    await loadMuralElements();
}

function exitMuralProject() {
    muralActiveProjectId = null;
    muralElements = [];
    muralTransform = { x: 0, y: 0, scale: 1 };
    muralSelectedElementId = null;
    muralUndoStack = [];
    dismissMuralPopups();
    // Restore app chrome
    hideMuralAppChrome(false);
    renderMural();
}

function hideMuralAppChrome(hide) {
    const selectors = ['.mobile-nav', '.fab', '.mobile-search-fab', '.fab-overlay', '.fab-menu', '.ai-fab'];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (hide) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
            } else {
                el.style.removeProperty('display');
                el.style.removeProperty('pointer-events');
                el.style.removeProperty('visibility');
            }
        });
    });
}

async function loadMuralElements() {
    try {
        // Always fetch fresh data for mural elements to avoid stale UI
        const res = await apiGet('mural_elements');
        // Sync with global state for dashboard counts
        state.data.mural_elements = res || [];
        muralElements = (res || []).filter(el => String(el.project_id) === String(muralActiveProjectId));
        renderMuralElementsDOM();
    } catch (err) {
        console.error('Error loading elements:', err);
        toast('Failed to load canvas elements');
    }
}

function renderMuralElementsDOM() {
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;

    // Preserve the SVG overlay, clear everything else
    const svgOverlay = document.getElementById('muralConnectorSvg');
    canvas.innerHTML = '';
    if (svgOverlay) {
        canvas.appendChild(svgOverlay);
    } else {
        // Re-create SVG if it was lost
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'muralConnectorSvg';
        svg.classList.add('mural-connector-svg');
        svg.setAttribute('width', '10000');
        svg.setAttribute('height', '10000');
        svg.innerHTML = `
            <defs>
                <marker id="mural-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--mural-accent, #6366F1)" />
                </marker>
                <marker id="mural-arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                </marker>
            </defs>`;
        canvas.appendChild(svg);
    }

    // Separate connectors from regular elements
    muralConnectors = muralElements.filter(el => el.type === 'connector');
    const regularElements = muralElements.filter(el => el.type !== 'connector');

    regularElements.forEach(el => {
        canvas.appendChild(createMuralElementDOM(el));
    });

    // Render all connectors
    renderAllMuralConnectors();
}

function createMuralElementDOM(data) {
    const div = document.createElement('div');
    const elType = data.type || 'sticky';
    let className = 'mural-element';
    if (elType === 'sticky') className += ' sticky';
    else if (elType === 'text') className += ' text-el';
    else if (elType === 'shape') className += ` shape-el ${data.shape || ''}`;
    else if (elType === 'icon') className += ' icon-el';

    div.className = className;
    if (data.id === muralSelectedElementId) div.classList.add('selected');
    div.id = `mural-el-${data.id}`;
    div.style.left = `${data.x || 0}px`;
    div.style.top = `${data.y || 0}px`;
    if (data.w) div.style.width = `${data.w}px`;
    if (data.h) div.style.height = `${data.h}px`;
    if (data.color && elType !== 'icon') div.style.backgroundColor = data.color;
    if (data.color && elType === 'icon') div.style.color = data.color;
    div.style.zIndex = data.z_index || 1;

    // Content wrapper for text isolation
    const content = document.createElement('div');
    content.className = 'mural-element-content';
    div.appendChild(content);

    // Content: Icons use <i> tags, Others use text
    if (elType === 'icon') {
        content.contentEditable = false;
        content.innerHTML = `<i data-lucide="${data.content || 'smile'}"></i>`;
    } else {
        content.contentEditable = true;
        content.spellcheck = false;
        content.innerText = data.content || '';
        content.addEventListener('input', () => {
            // Keep local state updated for fast UI, but don't autosave to server
            if (data.id) {
                const el = muralElements.find(item => String(item.id) === String(data.id));
                if (el) el.content = content.innerText;
            }
        });
    }

    // Prevent drag while editing text
    content.addEventListener('focus', () => {
        div.style.cursor = 'text';
    });
    content.addEventListener('blur', () => {
        div.style.cursor = 'move';
        // Content is already updated in 'input' event, no server sync on blur
    });

    // Add connection anchors (only for non-connectors)
    const elTypeFinal = data.type || 'sticky';
    if (elTypeFinal !== 'connector') {
        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const anchor = document.createElement('div');
            anchor.className = `mural-anchor ${side}`;
            anchor.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAnchorClick(data.id, side, e);
            });
            div.appendChild(anchor);
        });
    }

    // Add resize handle for sticky notes and shapes
    if (elType === 'sticky' || elType === 'shape') {
        const handle = document.createElement('div');
        handle.className = 'mural-resize-handle';
        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            muralIsResizing = true;
            muralSelectedElementId = data.id;
            muralResizeStart = {
                w: data.w || 150,
                h: data.h || 150,
                x: e.clientX,
                y: e.clientY
            };
            highlightMuralElement(data.id);
        });
        div.appendChild(handle);
    }

    // Pointer events for drag
    div.addEventListener('pointerdown', (e) => {
        if (muralIsResizing) return;
        if (document.activeElement === div && div.contentEditable === 'true') return; // Don't drag while typing

        e.stopPropagation();

        // ── Connector tool: click to connect ──
        if (muralActiveTool === 'connector') {
            handleConnectorClick(data.id, e);
            return;
        }

        muralSelectedElementId = data.id;
        muralSelectedConnectorId = null;
        highlightMuralElement(data.id);
        highlightMuralConnector(null);

        if (muralActiveTool === 'select') {
            muralIsDragging = true;
            muralDragStart = {
                x: e.clientX / muralTransform.scale - data.x,
                y: e.clientY / muralTransform.scale - data.y
            };
            div.setPointerCapture(e.pointerId);
        }
    });

    // Context menu (long press / right click)
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        muralSelectedElementId = data.id;
        highlightMuralElement(data.id);
        showMuralContextMenu(e.clientX, e.clientY, data.id);
    });

    // Long press for mobile
    let longPressTimer = null;
    div.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            muralSelectedElementId = data.id;
            highlightMuralElement(data.id);
            showMuralContextMenu(touch.clientX, touch.clientY, data.id);
        }, 300); // Reduced from 500ms
    }, { passive: true });
    div.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
    div.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });

    return div;
}

function highlightMuralElement(id) {
    document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
    const dom = document.getElementById(`mural-el-${id}`);
    if (dom) dom.classList.add('selected');
}

/* ═══════════════════════════════════════
   CONTEXT MENU — Element Actions
   ═══════════════════════════════════════ */
function showMuralContextMenu(x, y, elementId) {
    dismissMuralPopups();

    const el = muralElements.find(item => String(item.id) === String(elementId));
    if (!el) return;

    const menu = document.createElement('div');
    menu.className = 'mural-context-menu';
    menu.id = 'muralContextMenu';

    // Keep menu in viewport
    const menuWidth = 180;
    const menuHeight = 220;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.innerHTML = `
        <button class="mural-context-item" onclick="showMuralColorPicker(${x}, ${y}, '${elementId}')">
            <i data-lucide="palette"></i> Change Color
        </button>
        <button class="mural-context-item" onclick="duplicateMuralElement('${elementId}'); dismissMuralPopups();">
            <i data-lucide="copy"></i> Duplicate
        </button>
        <button class="mural-context-item" onclick="bringMuralToFront('${elementId}'); dismissMuralPopups();">
            <i data-lucide="bring-to-front"></i> Bring to Front
        </button>
        <button class="mural-context-item" onclick="sendMuralToBack('${elementId}'); dismissMuralPopups();">
            <i data-lucide="send-to-back"></i> Send to Back
        </button>
        <div class="mural-context-divider"></div>
        <button class="mural-context-item danger" onclick="deleteMuralElement('${elementId}'); dismissMuralPopups();">
            <i data-lucide="trash-2"></i> Delete
        </button>
    `;

    document.body.appendChild(menu);
    muralContextMenuEl = menu;
    if (window.lucide) lucide.createIcons();

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('pointerdown', dismissMuralPopupsOnOutside, { once: true });
    }, 10);
}
window.showMuralContextMenu = showMuralContextMenu;

function showMuralColorPicker(x, y, elementId) {
    dismissMuralPopups();

    const el = muralElements.find(item => String(item.id) === String(elementId));
    if (!el) return;

    const picker = document.createElement('div');
    picker.className = 'mural-color-picker';
    picker.id = 'muralColorPicker';

    // Position picker — try below the element, or center on mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        // Bottom sheet style on mobile
        picker.style.left = '50%';
        picker.style.transform = 'translateX(-50%)';
        picker.style.bottom = '90px';
        picker.style.top = 'auto';
        picker.style.maxWidth = 'calc(100vw - 32px)';
    } else {
        if (x + 280 > window.innerWidth) x = window.innerWidth - 288;
        if (y + 120 > window.innerHeight) y = window.innerHeight - 128;
        picker.style.left = `${x}px`;
        picker.style.top = `${y}px`;
    }

    // All colors: pastels + vivid + neutrals
    const allColors = [
        ...MURAL_COLORS,
        '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1',
        '#EC4899', '#8B5CF6', '#14B8A6', '#06B6D4',
        '#ffffff', '#f3f4f6', '#d1d5db', '#6b7280', '#374151', '#1f2937'
    ];

    const colorNames = {
        ...MURAL_COLOR_NAMES,
        '#EF4444': 'Red', '#F97316': 'Orange', '#F59E0B': 'Amber', '#10B981': 'Green',
        '#3B82F6': 'Blue', '#6366F1': 'Indigo', '#EC4899': 'Pink', '#8B5CF6': 'Purple',
        '#14B8A6': 'Teal', '#06B6D4': 'Cyan',
        '#ffffff': 'White', '#f3f4f6': 'Light Gray', '#d1d5db': 'Gray',
        '#6b7280': 'Dark Gray', '#374151': 'Charcoal', '#1f2937': 'Near Black'
    };

    picker.innerHTML = `
        <div class="mural-picker-label">Pastel</div>
        <div class="mural-picker-row">
            ${MURAL_COLORS.map(c => `
                <div class="mural-color-swatch ${el.color === c ? 'active' : ''}"
                     style="background:${c}"
                     title="${colorNames[c] || c}"
                     onclick="changeMuralColor('${elementId}', '${c}')">
                </div>`).join('')}
        </div>
        <div class="mural-picker-label">Vivid</div>
        <div class="mural-picker-row">
            ${['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#06B6D4'].map(c => `
                <div class="mural-color-swatch ${el.color === c ? 'active' : ''}"
                     style="background:${c}"
                     title="${colorNames[c] || c}"
                     onclick="changeMuralColor('${elementId}', '${c}')">
                </div>`).join('')}
        </div>
        <div class="mural-picker-label">Neutral</div>
        <div class="mural-picker-row">
            ${['#ffffff', '#f3f4f6', '#d1d5db', '#6b7280', '#374151', '#1f2937'].map(c => `
                <div class="mural-color-swatch ${el.color === c ? 'active' : ''}"
                     style="background:${c}; ${c === '#ffffff' ? 'border-color: #d1d5db;' : ''}"
                     title="${colorNames[c] || c}"
                     onclick="changeMuralColor('${elementId}', '${c}')">
                </div>`).join('')}
        </div>
    `;

    document.body.appendChild(picker);
    muralColorPickerEl = picker;

    setTimeout(() => {
        document.addEventListener('pointerdown', dismissMuralPopupsOnOutside, { once: true });
    }, 10);
}

function changeMuralColor(elementId, color) {
    const el = muralElements.find(item => String(item.id) === String(elementId));
    if (!el) return;
    el.color = color;
    const dom = document.getElementById(`mural-el-${elementId}`);
    if (dom) dom.style.backgroundColor = color;
    // Removed autosave: saveMuralElement(el);
    dismissMuralPopups();
}
window.changeMuralColor = changeMuralColor;
window.dismissMuralPopups = dismissMuralPopups;

function dismissMuralPopups() {
    if (muralContextMenuEl) { muralContextMenuEl.remove(); muralContextMenuEl = null; }
    if (muralColorPickerEl) { muralColorPickerEl.remove(); muralColorPickerEl = null; }
    const shapeMenu = document.getElementById('muralShapeMenu');
    if (shapeMenu) shapeMenu.classList.remove('visible');
}

function dismissMuralPopupsOnOutside(e) {
    const ctx = document.getElementById('muralContextMenu');
    const cp = document.getElementById('muralColorPicker');
    if (ctx && !ctx.contains(e.target)) { ctx.remove(); muralContextMenuEl = null; }
    if (cp && !cp.contains(e.target)) { cp.remove(); muralColorPickerEl = null; }
}

/* ═══════════════════════════════════════
   MANAGEMENT MODALS
   ═══════════════════════════════════════ */
function openNewMuralProjectModal() {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
        <h3 style="margin-bottom:4px">New Project</h3>
        <p style="color:var(--text-3); margin-bottom:20px; font-size:14px">Create a new canvas to organize your ideas.</p>
        <input type="text" id="newProjectTitle" class="nc-ed-title" placeholder="Project name" style="margin-bottom:16px; font-size:16px; padding:12px;" autofocus>
        <select id="newProjectCategory" class="nc-ed-cat-select" style="width:100%; margin-bottom:24px; padding:12px; font-size:14px; border-radius:12px;">
            <option value="">No category</option>
            ${muralCategories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div style="display:flex; gap:12px;">
            <button class="btn primary" onclick="createMuralProject()" style="flex:1; padding:12px; border-radius:12px; font-weight:600">Create</button>
            <button class="btn secondary" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1; padding:12px; border-radius:12px">Cancel</button>
        </div>
    `;
    modal.classList.remove('hidden');

    // Focus input after modal opens
    setTimeout(() => {
        const inp = document.getElementById('newProjectTitle');
        if (inp) inp.focus();
    }, 100);

    // Enter key to create
    const inp = document.getElementById('newProjectTitle');
    if (inp) inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createMuralProject();
    });
}

async function createMuralProject() {
    const titleEl = document.getElementById('newProjectTitle');
    const catEl = document.getElementById('newProjectCategory');
    const title = (titleEl ? titleEl.value : '').trim();
    const cat = catEl ? catEl.value : '';
    if (!title) return toast('Please enter a project name');

    const payload = {
        title,
        category: cat || 'Uncategorized',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_projects', payload });
        if (res.success) {
            toast('Project created!');
            document.getElementById('universalModal').classList.add('hidden');
            await loadMuralDashboardData();
            renderMuralDashboard();
        }
    } catch (err) {
        console.error(err);
        toast('Error creating project');
    }
}

async function deleteMuralProject(id) {
    if (!confirm('Delete this project and all its elements?')) return;
    try {
        const res = await apiPost({ action: 'deleteMuralProject', id });
        if (res.success) {
            toast('Project deleted');
            renderMuralDashboard();
        }
    } catch (err) {
        toast('Error deleting project');
    }
}

function openEditMuralProjectModal(projectId) {
    const project = muralProjects.find(p => String(p.id) === String(projectId));
    if (!project) return toast('Project not found');

    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
        <h3 style="margin-bottom:4px">Edit Project</h3>
        <p style="color:var(--text-3); margin-bottom:20px; font-size:14px">Update project details.</p>
        <input type="text" id="editProjectTitle" class="nc-ed-title" value="${escapeHtml(project.title)}" style="margin-bottom:16px; font-size:16px; padding:12px;" autofocus>
        <select id="editProjectCategory" class="nc-ed-cat-select" style="width:100%; margin-bottom:24px; padding:12px; font-size:14px; border-radius:12px;">
            <option value="">No category</option>
            ${muralCategories.map(c => `<option value="${escapeHtml(c.name)}" ${project.category === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div style="display:flex; gap:12px;">
            <button class="btn primary" onclick="updateMuralProject('${projectId}')" style="flex:1; padding:12px; border-radius:12px; font-weight:600">Save Changes</button>
            <button class="btn secondary" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1; padding:12px; border-radius:12px">Cancel</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

async function updateMuralProject(projectId) {
    const title = document.getElementById('editProjectTitle').value.trim();
    const category = document.getElementById('editProjectCategory').value;

    if (!title) return toast('Project name cannot be empty');

    try {
        const payload = { title, category, updated_at: new Date().toISOString() };
        const res = await apiPost({ action: 'update', sheet: 'mural_projects', id: projectId, payload });
        if (res.success) {
            toast('Project updated!');
            document.getElementById('universalModal').classList.add('hidden');
            await loadMuralDashboardData();
            renderMuralDashboard();
        }
    } catch (e) {
        console.error(e);
        toast('Failed to update project');
    }
}

function openMuralCategoryManager() {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
        <h3 style="margin-bottom:4px">Categories</h3>
        <p style="color:var(--text-3); margin-bottom:20px; font-size:14px">Organize your projects into groups.</p>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; border-radius:12px; border:1px solid var(--border-color); overflow:hidden;">
            ${muralCategories.length === 0 ? '<div style="padding:24px; text-align:center; color:var(--text-3); font-size:14px;">No categories yet</div>' : ''}
            ${muralCategories.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--border-color)">
                    <span style="font-weight:500">${escapeHtml(c.name)}</span>
                    <button style="width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s"
                        onmouseover="this.style.background='var(--mural-danger-soft)'; this.style.color='var(--mural-danger)'"
                        onmouseout="this.style.background='transparent'; this.style.color='var(--text-3)'"
                        onclick="deleteMuralCategory('${c.id}')">×</button>
                </div>
            `).join('')}
        </div>
        <div style="display:flex; gap:8px; margin-bottom:20px;">
            <input type="text" id="newCatName" placeholder="New category name" style="flex:1; padding:12px; border-radius:10px; border:1px solid var(--border-color); font-size:14px; background:var(--surface-1); color:var(--text-1)">
            <button class="btn primary" onclick="createMuralCategory()" style="padding:12px 18px; border-radius:10px; font-weight:600">Add</button>
        </div>
        <button class="btn secondary" style="width:100%; padding:12px; border-radius:10px" onclick="document.getElementById('universalModal').classList.add('hidden')">Done</button>
    `;
    modal.classList.remove('hidden');

    // Enter to add
    setTimeout(() => {
        const inp = document.getElementById('newCatName');
        if (inp) {
            inp.focus();
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') createMuralCategory();
            });
        }
    }, 100);
}

async function createMuralCategory() {
    const nameEl = document.getElementById('newCatName');
    const name = (nameEl ? nameEl.value : '').trim();
    if (!name) return toast('Please enter a category name');

    // Check for duplicate
    if (muralCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return toast('Category already exists');
    }

    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_categories', payload: { name, color: '#6366F1' } });
        if (res.success) {
            toast('Category added');
            await loadMuralDashboardData();
            openMuralCategoryManager();
        }
    } catch (err) {
        console.error(err);
        toast('Error adding category');
    }
}

async function deleteMuralCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
        await apiPost({ action: 'delete', sheet: 'mural_categories', id });
        await loadMuralDashboardData();
        if (muralActiveCategory !== 'all') {
            const still = muralCategories.find(c => c.name === muralActiveCategory);
            if (!still) muralActiveCategory = 'all';
        }
        openMuralCategoryManager();
    } catch (err) {
        console.error(err);
        toast('Error deleting category');
    }
}

/* ═══════════════════════════════════════
   CANVAS CORE — Pan, Zoom, Touch
   ═══════════════════════════════════════ */
function initMuralCanvas() {
    const canvas = document.getElementById('muralCanvas');
    const page = document.getElementById('muralPage');
    if (!canvas || !page) return;

    // Pointer events
    page.addEventListener('pointerdown', onMuralPointerDown);
    page.addEventListener('pointermove', onMuralPointerMove);
    page.addEventListener('pointerup', onMuralPointerUp);
    page.addEventListener('pointercancel', onMuralPointerUp);

    // Wheel zoom
    page.addEventListener('wheel', onMuralWheel, { passive: false });

    // Touch pinch zoom
    page.addEventListener('touchstart', onMuralTouchStart, { passive: false });
    page.addEventListener('touchmove', onMuralTouchMove, { passive: false });
    page.addEventListener('touchend', onMuralTouchEnd, { passive: true });

    // Keyboard shortcuts
    document.addEventListener('keydown', onMuralKeyDown);

    // Click canvas background to deselect
    canvas.addEventListener('click', (e) => {
        if (e.target === canvas || e.target.closest('.mural-connector-svg')) {
            muralSelectedElementId = null;
            muralSelectedConnectorId = null;
            highlightMuralConnector(null);
            document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
            dismissMuralPopups();
            // Cancel connector creation if clicking empty space
            if (muralConnectorSource) cancelMuralConnector();
        }
    });

    applyMuralTransform();
    updateMuralZoomBadge();
}

// Touch pinch zoom state
let muralTouchState = { touches: [], lastDist: 0, lastCenter: { x: 0, y: 0 }, isPinching: false };

function onMuralTouchStart(e) {
    if (e.touches.length === 2) {
        e.preventDefault();
        muralTouchState.isPinching = true;
        muralIsDragging = false;
        const t1 = e.touches[0], t2 = e.touches[1];
        muralTouchState.lastDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        muralTouchState.lastCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }
}

function onMuralTouchMove(e) {
    if (e.touches.length === 2 && muralTouchState.isPinching) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const center = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };

        // Zoom
        const factor = dist / muralTouchState.lastDist;
        const oldScale = muralTransform.scale;
        const newScale = Math.min(Math.max(oldScale * factor, 0.1), 5);
        muralTransform.x = center.x - (center.x - muralTransform.x) * (newScale / oldScale);
        muralTransform.y = center.y - (center.y - muralTransform.y) * (newScale / oldScale);
        muralTransform.scale = newScale;

        // Pan
        muralTransform.x += center.x - muralTouchState.lastCenter.x;
        muralTransform.y += center.y - muralTouchState.lastCenter.y;

        muralTouchState.lastDist = dist;
        muralTouchState.lastCenter = center;
        applyMuralTransform();
        updateMuralZoomBadge();
    }
}

function onMuralTouchEnd(e) {
    if (e.touches.length < 2) {
        muralTouchState.isPinching = false;
    }
}

function applyMuralTransform() {
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;
    canvas.style.transform = `translate(${muralTransform.x}px, ${muralTransform.y}px) scale(${muralTransform.scale})`;
}

function updateMuralZoomBadge() {
    const badge = document.getElementById('muralZoomBadge');
    if (badge) badge.textContent = `${Math.round(muralTransform.scale * 100)}%`;
}

function onMuralPointerDown(e) {
    if (muralTouchState.isPinching) return;
    muralPointerDown = true;

    if (e.target.id === 'muralPage' || e.target.id === 'muralCanvas') {
        muralIsDragging = true;
        muralDragStart = { x: e.clientX - muralTransform.x, y: e.clientY - muralTransform.y };
        muralSelectedElementId = null;
        document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
        dismissMuralPopups();
    }
}

function onMuralPointerMove(e) {
    if (muralTouchState.isPinching) return;

    if (muralIsResizing && muralSelectedElementId) {
        e.preventDefault();
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementId));
        if (el) {
            const dx = (e.clientX - muralResizeStart.x) / muralTransform.scale;
            const dy = (e.clientY - muralResizeStart.y) / muralTransform.scale;
            el.w = Math.max(80, muralResizeStart.w + dx);
            el.h = Math.max(80, muralResizeStart.h + dy);
            const dom = document.getElementById(`mural-el-${el.id}`);
            if (dom) {
                dom.style.width = `${el.w}px`;
                dom.style.height = `${el.h}px`;
            }
            // Live-update connectors attached to this element
            updateConnectorsForElement(el.id);
        }
        return;
    }

    if (!muralIsDragging) return;

    if (muralSelectedElementId) {
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementId));
        if (el) {
            el.x = e.clientX / muralTransform.scale - muralDragStart.x;
            el.y = e.clientY / muralTransform.scale - muralDragStart.y;
            const dom = document.getElementById(`mural-el-${el.id}`);
            if (dom) { dom.style.left = `${el.x}px`; dom.style.top = `${el.y}px`; }
            // Live-update connectors attached to this element
            updateConnectorsForElement(el.id);
        }
    } else {
        muralTransform.x = e.clientX - muralDragStart.x;
        muralTransform.y = e.clientY - muralDragStart.y;
        applyMuralTransform();
    }
}

function onMuralPointerUp() {
    if (muralIsResizing && muralSelectedElementId) {
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementId));
        if (el) saveMuralElement(el);
        muralIsResizing = false;
        showSaveIndicator('saving');
    }

    if (muralSelectedElementId && muralIsDragging) {
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementId));
        if (el) {
            saveMuralElement(el);
            showSaveIndicator('saving');
        }
    }
    muralIsDragging = false;
    muralPointerDown = false;
}

function onMuralWheel(e) {
    e.preventDefault();
    zoomMural(e.deltaY > 0 ? 0.92 : 1.08, e.clientX, e.clientY);
}

function zoomMural(factor, centerX, centerY) {
    const oldScale = muralTransform.scale;
    const newScale = Math.min(Math.max(oldScale * factor, 0.1), 5);
    if (!centerX) centerX = window.innerWidth / 2;
    if (!centerY) centerY = window.innerHeight / 2;
    muralTransform.x = centerX - (centerX - muralTransform.x) * (newScale / oldScale);
    muralTransform.y = centerY - (centerY - muralTransform.y) * (newScale / oldScale);
    muralTransform.scale = newScale;
    applyMuralTransform();
    updateMuralZoomBadge();
}

function resetMuralView() {
    muralTransform = { x: 0, y: 0, scale: 1 };
    applyMuralTransform();
    updateMuralZoomBadge();
}

function fitMuralToContent() {
    if (muralElements.length === 0) return resetMuralView();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    muralElements.forEach(el => {
        minX = Math.min(minX, el.x || 0);
        minY = Math.min(minY, el.y || 0);
        maxX = Math.max(maxX, (el.x || 0) + (el.w || 150));
        maxY = Math.max(maxY, (el.y || 0) + (el.h || 150));
    });

    const contentW = maxX - minX + 200; // Increased padding
    const contentH = maxY - minY + 200;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - 140; // More room for toolbars

    const scale = Math.min(viewW / contentW, viewH / contentH, 2);
    muralTransform.scale = Math.max(0.15, Math.min(scale, 1.5)); // Slightly tighter max scale
    muralTransform.x = (viewW - contentW * muralTransform.scale) / 2 - minX * muralTransform.scale + 100;
    muralTransform.y = (viewH - contentH * muralTransform.scale) / 2 - minY * muralTransform.scale + 70;

    applyMuralTransform();
    updateMuralZoomBadge();
}

function setMuralTool(tool) {
    // Cancel any in-progress connector creation if switching away
    if (muralActiveTool === 'connector' && tool !== 'connector') {
        cancelMuralConnector();
    }
    muralActiveTool = tool;
    document.querySelectorAll('.mural-tool[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });

    // Update canvas cursor for connector mode
    const canvas = document.getElementById('muralCanvas');
    if (canvas) {
        canvas.style.cursor = tool === 'connector' ? 'crosshair' : 'grab';
    }
}
window.setMuralTool = setMuralTool;

/* ═══════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════ */
function onMuralKeyDown(e) {
    // Only handle when on canvas view
    if (!muralActiveProjectId) return;
    // Don't capture when typing in inputs/contenteditable
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const key = e.key.toLowerCase();

    // Delete / Backspace → delete selected
    if ((key === 'delete' || key === 'backspace') && muralSelectedElementId) {
        e.preventDefault();
        deleteMuralElement(muralSelectedElementId);
        return;
    }

    // Cmd/Ctrl + D → duplicate
    if ((e.metaKey || e.ctrlKey) && key === 'd' && muralSelectedElementId) {
        e.preventDefault();
        duplicateMuralElement(muralSelectedElementId);
        return;
    }

    // Cmd/Ctrl + Z → undo
    if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault();
        muralUndo();
        return;
    }

    // V → select tool
    if (key === 'v') { setMuralTool('select'); return; }
    // N → new sticky
    if (key === 'n') { addMuralSticky(); return; }
    // T → new text
    if (key === 't') { addMuralText(); return; }
    // R → new rectangle
    if (key === 'r') { addMuralShape('rect'); return; }
    // L → connector tool
    if (key === 'l') { setMuralTool('connector'); return; }
    // Escape → deselect / cancel connector
    if (key === 'escape') {
        if (muralConnectorSource) {
            cancelMuralConnector();
            return;
        }
        muralSelectedElementId = null;
        muralSelectedConnectorId = null;
        highlightMuralConnector(null);
        document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
        dismissMuralPopups();
        return;
    }
    // 0 → reset view
    if (key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetMuralView();
        return;
    }
    // 1 → fit to content
    if (key === '1' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        fitMuralToContent();
        return;
    }
}

/* ═══════════════════════════════════════
   ELEMENT CREATION
   ═══════════════════════════════════════ */
function getCanvasCenter() {
    const cx = (window.innerWidth / 2 - muralTransform.x) / muralTransform.scale;
    const cy = (window.innerHeight / 2 - muralTransform.y) / muralTransform.scale;
    // Add small random offset to avoid stacking
    return {
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40
    };
}

async function addMuralSticky() {
    const center = getCanvasCenter();
    const newEl = {
        project_id: muralActiveProjectId,
        type: 'sticky',
        x: center.x - 75,
        y: center.y - 75,
        w: 160, h: 160,
        content: '',
        color: MURAL_COLORS[Math.floor(Math.random() * MURAL_COLORS.length)],
        z_index: muralElements.length + 1
    };
    await createMuralElement(newEl);
}

async function addMuralText() {
    const center = getCanvasCenter();
    const newEl = {
        project_id: muralActiveProjectId,
        type: 'text',
        x: center.x - 60,
        y: center.y - 20,
        w: 200, h: 40,
        content: 'Type here...',
        color: 'transparent',
        z_index: muralElements.length + 1
    };
    await createMuralElement(newEl);
}

async function addMuralShape(shape) {
    const center = getCanvasCenter();
    const newEl = {
        project_id: muralActiveProjectId,
        type: 'shape',
        shape: shape,
        x: center.x - 60,
        y: center.y - 60,
        w: 120, h: 120,
        content: '',
        color: 'rgba(99, 102, 241, 0.08)',
        z_index: muralElements.length + 1
    };
    await createMuralElement(newEl);
}

async function addMuralIcon(iconName) {
    const center = getCanvasCenter();
    const newEl = {
        project_id: muralActiveProjectId,
        type: 'icon',
        content: iconName,
        x: center.x - 40,
        y: center.y - 40,
        w: 80, h: 80,
        color: 'var(--mural-accent)',
        z_index: muralElements.length + 1
    };
    await createMuralElement(newEl);
}

function toggleMuralShapeMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('muralShapeMenu');
    const isVisible = menu.classList.contains('visible');
    dismissMuralPopups(); // Close others
    if (!isVisible) menu.classList.add('visible');
}

function openMuralIconLibrary() {
    const modal = document.getElementById('universalModal');
    const title = document.getElementById('universalModalTitle');
    const content = document.getElementById('universalModalContent');
    if (!modal || !title || !content) return;

    title.innerText = 'Icon Library';

    // Selection of useful icons for whiteboarding
    const icons = [
        'heart', 'star', 'check', 'check-circle', 'info', 'help-circle', 'alert-triangle',
        'thumbs-up', 'thumbs-down', 'smile', 'frown', 'meh', 'user', 'users', 'clock',
        'calendar', 'flag', 'award', 'target', 'rocket', 'lightbulb', 'zap', 'flame',
        'image', 'paperclip', 'link', 'mail', 'phone', 'home', 'search', 'settings',
        'navigation', 'map-pin', 'camera', 'mic', 'video', 'music', 'briefcase', 'book',
        'file-text', 'folder', 'archive', 'trash-2', 'shield', 'lock', 'unlocked', 'key'
    ];

    content.innerHTML = `
        <div style="margin-bottom:16px;">
            <input type="text" id="muralIconSearch" placeholder="Search icons..." 
                style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); font-size:14px;">
        </div>
        <div class="mural-icon-grid" id="muralIconGrid">
            ${icons.map(name => `
                <button class="mural-icon-btn" onclick="addMuralIcon('${name}'); document.getElementById('universalModal').classList.add('hidden');">
                    <i data-lucide="${name}"></i>
                    <span>${name}</span>
                </button>
            `).join('')}
        </div>
        <button class="btn secondary" style="width:100%; margin-top:20px; padding:12px; border-radius:12px;" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
    `;

    modal.classList.remove('hidden');
    lucide.createIcons();

    const searchInput = document.getElementById('muralIconSearch');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.mural-icon-btn').forEach(btn => {
            const name = btn.querySelector('span').innerText;
            btn.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });
}

async function createMuralElement(newEl) {
    // Optimistic: generate temp ID and render immediately
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    newEl.id = tempId;
    muralElements.push(newEl);

    const canvas = document.getElementById('muralCanvas');
    if (canvas) {
        const dom = createMuralElementDOM(newEl);
        canvas.appendChild(dom);
        // Auto-focus for text editing
        if (newEl.type === 'sticky' || newEl.type === 'text' || newEl.type === 'shape') {
            const content = dom.querySelector('.mural-element-content');
            setTimeout(() => {
                if (content) content.focus();
                const sel = window.getSelection();
                const range = document.createRange();
                if (content) range.selectNodeContents(content);
                sel.removeAllRanges();
                sel.addRange(range);
            }, 50);
        }
        muralSelectedElementId = newEl.id;
        highlightMuralElement(newEl.id);
        // Removed automatic server sync: new elements now stay local (temp_ID) 
        // until manualMuralSync() is called.
    }
}

async function deleteMuralElement(id) {
    const el = muralElements.find(item => String(item.id) === String(id));
    if (!el) return;

    // Push to undo stack
    muralUndoStack.push({ action: 'delete', element: { ...el } });

    // Optimistic: remove from DOM immediately
    const dom = document.getElementById(`mural-el-${id}`);
    if (dom) dom.remove();
    muralElements = muralElements.filter(item => item.id !== id);
    muralSelectedElementId = null;

    // Also remove any connectors attached to this element (optimistic)
    if (el.type !== 'connector') {
        const attachedConnectors = muralConnectors.filter(c =>
            String(c.from_id) === String(id) || String(c.to_id) === String(id)
        );
        muralConnectors = muralConnectors.filter(c =>
            String(c.from_id) !== String(id) && String(c.to_id) !== String(id)
        );
        muralElements = muralElements.filter(item =>
            !attachedConnectors.find(c => c.id === item.id)
        );
        renderAllMuralConnectors();

        // Delete connectors from server in background
        for (const conn of attachedConnectors) {
            apiPost({ action: 'delete', sheet: 'mural_elements', id: conn.id }).catch(() => { });
        }
    } else {
        muralConnectors = muralConnectors.filter(c => c.id !== id);
        renderAllMuralConnectors();
    }

    showMuralUndoToast('Element deleted');
    // Removed automatic server sync: deletions stay local until manualMuralSync().
}
window.deleteMuralElement = deleteMuralElement;
window.deleteMuralSelected = deleteMuralSelected;

function deleteMuralSelected() {
    if (muralSelectedConnectorId) {
        deleteMuralConnector(muralSelectedConnectorId);
        return;
    }
    if (!muralSelectedElementId) return toast('Select an element first');
    deleteMuralElement(muralSelectedElementId);
}

async function duplicateMuralElement(id) {
    const el = muralElements.find(item => String(item.id) === String(id));
    if (!el) return;

    const newEl = {
        ...el,
        id: undefined,
        x: (el.x || 0) + 20,
        y: (el.y || 0) + 20,
        z_index: muralElements.length + 1
    };
    delete newEl.id;
    await createMuralElement(newEl);
    toast('Element duplicated');
}

function duplicateMuralSelected() {
    if (!muralSelectedElementId) return toast('Select an element first');
    duplicateMuralElement(muralSelectedElementId);
}
window.duplicateMuralElement = duplicateMuralElement;
window.duplicateMuralSelected = duplicateMuralSelected;

function bringMuralToFront(id) {
    const maxZ = Math.max(...muralElements.map(e => e.z_index || 0), 0) + 1;
    const el = muralElements.find(item => String(item.id) === String(id));
    if (!el) return;
    el.z_index = maxZ;
    const dom = document.getElementById(`mural-el-${id}`);
    if (dom) dom.style.zIndex = maxZ;
    // Removed autosave: saveMuralElement(el);
}

function sendMuralToBack(id) {
    const minZ = Math.min(...muralElements.map(e => e.z_index || 0), 1) - 1;
    const el = muralElements.find(item => String(item.id) === String(id));
    if (!el) return;
    el.z_index = Math.max(0, minZ);
    const dom = document.getElementById(`mural-el-${id}`);
    if (dom) dom.style.zIndex = el.z_index;
    // Removed autosave: saveMuralElement(el);
}
window.bringMuralToFront = bringMuralToFront;
window.sendMuralToBack = sendMuralToBack;

/* ═══════════════════════════════════════
   UNDO SYSTEM
   ═══════════════════════════════════════ */
async function muralUndo() {
    if (muralUndoStack.length === 0) return;
    const action = muralUndoStack.pop();

    if (action.action === 'delete') {
        // Re-create the deleted element locally
        const el = action.element;
        muralElements.push(el);

        const canvas = document.getElementById('muralCanvas');
        if (canvas) {
            canvas.appendChild(createMuralElementDOM(el));
        }

        if (el.type === 'connector') {
            muralConnectors.push(el);
            renderAllMuralConnectors();
        }

        toast('Undo successful');
        hideMuralUndoToast();
    }
}
window.muralUndo = muralUndo;
window.showMuralUndoToast = showMuralUndoToast;
window.hideMuralUndoToast = hideMuralUndoToast;

function showMuralUndoToast(msg) {
    const toastEl = document.getElementById('muralUndoToast');
    const textEl = document.getElementById('muralUndoText');
    if (!toastEl || !textEl) return;
    textEl.textContent = msg;
    toastEl.classList.add('visible');
    // Auto-hide after 5s
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
        toastEl.classList.remove('visible');
    }, 5000);
}

function hideMuralUndoToast() {
    const toastEl = document.getElementById('muralUndoToast');
    if (toastEl) toastEl.classList.remove('visible');
}

/* ═══════════════════════════════════════
   SAVE SYSTEM
   ═══════════════════════════════════════ */
let muralSaveTimer = null;

function debounceMuralSave(id, data) {
    // This function is effectively disabled for server sync, 
    // but kept for local property updates if needed by other callers.
    const el = muralElements.find(item => String(item.id) === String(id));
    if (el) Object.assign(el, data);
}

let muralConnectorSourceSide = null; // Add to globals

function cancelMuralConnector() {
    if (muralConnectorSource) {
        const dom = document.getElementById(`mural-el-${muralConnectorSource}`);
        if (dom) {
            dom.classList.remove('connector-source');
            dom.querySelectorAll('.mural-anchor').forEach(a => a.classList.remove('active'));
        }
    }
    muralConnectorSource = null;
    muralConnectorSourceSide = null;
    dismissMuralPopups();
}
window.cancelMuralConnector = cancelMuralConnector;

async function manualMuralSync() {
    const btn = document.getElementById('muralManualSaveBtn');
    if (btn) {
        btn.classList.add('loading');
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Saving...';
        if (window.lucide) lucide.createIcons();
    }
    showSaveIndicator('saving');
    try {
        const res = await apiPost({
            action: 'syncMuralElements',
            sheet: 'mural_elements',
            payload: { project_id: muralActiveProjectId, elements: muralElements }
        });
        if (res.success) {
            // Apply ID mapping returned from server
            if (res.idMap) {
                const idMap = res.idMap;
                Object.keys(idMap).forEach(tempId => {
                    const realId = idMap[tempId];
                    // 1. Update muralElements
                    const el = muralElements.find(e => String(e.id) === String(tempId));
                    if (el) {
                        el.id = realId;
                        const elDom = document.getElementById(`mural-el-${tempId}`);
                        if (elDom) elDom.id = `mural-el-${realId}`;
                    }

                    // 2. Update muralConnectors
                    const conn = muralConnectors.find(c => String(c.id) === String(tempId));
                    if (conn) {
                        conn.id = realId;
                        const connDom = document.getElementById(`connector-${tempId}`);
                        if (connDom) connDom.id = `connector-${realId}`;
                    }

                    // 3. Update connector references
                    muralConnectors.forEach(c => {
                        if (String(c.from_id) === String(tempId)) c.from_id = realId;
                        if (String(c.to_id) === String(tempId)) c.to_id = realId;
                    });

                    // 4. Update DOM IDs
                    const dom = document.getElementById(`mural-el-${tempId}`);
                    if (dom) dom.id = `mural-el-${realId}`;

                    const connDom = document.getElementById(`connector-${tempId}`);
                    if (connDom) connDom.id = `connector-${realId}`;
                });
            }

            showSaveIndicator('saved');
            toast('Mural saved successfully!');
            // Refresh view to ensure everything is perfectly synced with the backend
            if (typeof loadMuralElements === 'function') await loadMuralElements();
            if (typeof loadMuralDashboardData === 'function') await loadMuralDashboardData();
        } else {
            throw new Error(res.message);
        }
    } catch (err) {
        console.error('Manual sync failed:', err);
        toast('Sync failed — check connection');
        showSaveIndicator('error');
    } finally {
        if (btn) {
            btn.classList.remove('loading');
            btn.innerHTML = '<i data-lucide="save"></i> Save';
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function repairMuralData() {
    if (!confirm('This will deduplicate entries and fix header alignment in your Google Sheet. Proceed?')) return;

    try {
        toast('Repairing data...');
        const res = await apiPost({ action: 'repairMural' });
        if (res.success) {
            toast('Cleanup complete! Refreshing projects...');
            await loadMuralDashboardData();
            renderMuralDashboard();
        } else {
            throw new Error(res.error || res.message);
        }
    } catch (err) {
        console.error(err);
        toast('Repair failed: ' + err.message);
    }
}
window.repairMuralData = repairMuralData;

async function saveMuralElement(el) {
    // This function is now only called manually if specific element sync is needed.
    // Standard flow now uses manualMuralSync() for bulk updates.
}

function showSaveIndicator(state) {
    const indicator = document.getElementById('muralSaveIndicator');
    const text = document.getElementById('muralSaveText');
    if (!indicator || !text) return;

    indicator.className = 'mural-save-indicator visible';

    if (state === 'saving') {
        indicator.classList.add('saving');
        text.textContent = 'Saving…';
    } else if (state === 'saved') {
        indicator.classList.remove('saving');
        indicator.classList.add('saved');
        text.textContent = '✓ Saved';
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    } else {
        indicator.classList.remove('saving');
        text.textContent = '✗ Error';
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 3000);
    }
}

/* ═══════════════════════════════════════
   CONNECTORS — Line connections between elements
   ═══════════════════════════════════════ */

/**
 * Handle click on an element while connector tool is active.
 * First click = set source, second click = create connector to target.
 */
function handleConnectorClick(elementId, e) {
    const el = muralElements.find(item => String(item.id) === String(elementId));
    if (!el || el.type === 'connector') return;

    if (!muralConnectorSource) {
        muralConnectorSource = elementId;
        const dom = document.getElementById(`mural-el-${elementId}`);
        if (dom) dom.classList.add('connector-source');
        toast('Now click the target element to connect');
    } else if (muralConnectorSource === elementId) {
        cancelMuralConnector();
    } else {
        createMuralConnector(muralConnectorSource, elementId);
        cancelMuralConnector();
    }
}
window.handleConnectorClick = handleConnectorClick;

/**
 * Handle click on an anchor specifically.
 */
async function handleAnchorClick(elementId, side, e) {
    if (muralActiveTool !== 'connector') return;

    if (!muralConnectorSource) {
        muralConnectorSource = elementId;
        muralConnectorSourceSide = side;
        const dom = document.getElementById(`mural-el-${elementId}`);
        if (dom) dom.classList.add('connector-source');
        const anchor = dom.querySelector(`.mural-anchor.${side}`);
        if (anchor) anchor.classList.add('active');
        toast(`Connecting from ${side} — click target anchor`);
    } else if (muralConnectorSource === elementId && muralConnectorSourceSide === side) {
        cancelMuralConnector();
    } else {
        createMuralConnector(muralConnectorSource, elementId, muralConnectorSourceSide, side);
        cancelMuralConnector();
    }
}
window.handleAnchorClick = handleAnchorClick;

/**
 * Create a new connector between two elements and save to API.
 */
async function createMuralConnector(fromId, toId, fromSide = null, toSide = null) {
    // Check if connector already exists
    const exists = muralConnectors.find(c =>
        (String(c.from_id) === String(fromId) && String(c.to_id) === String(toId) && c.from_side === fromSide && c.to_side === toSide)
    );
    if (exists) { toast('Already connected'); return; }

    // Optimistic: render instantly with temp ID
    const tempId = `temp_conn_${Date.now()}`;
    const newEl = {
        id: tempId,
        project_id: muralActiveProjectId,
        type: 'connector',
        from_id: fromId,
        to_id: toId,
        from_side: fromSide,
        to_side: toSide,
        color: '#6366F1',
        connector_style: 'bezier',
        x: 0, y: 0, w: 0, h: 0,
        content: '',
        z_index: 0
    };

    muralElements.push(newEl);
    muralConnectors.push(newEl);
    renderSingleConnector(newEl);
    showSaveIndicator('saved');
    toast('Connected!');
    // Removed automatic server sync for connectors.
}

/**
 * Delete a connector by ID.
 */
async function deleteMuralConnector(connId) {
    const conn = muralConnectors.find(c => c.id === connId);
    if (!conn) return;

    muralUndoStack.push({ action: 'delete', element: { ...conn } });

    // Optimistic: remove immediately
    muralElements = muralElements.filter(item => item.id !== connId);
    muralConnectors = muralConnectors.filter(c => c.id !== connId);
    muralSelectedConnectorId = null;
    renderAllMuralConnectors();
    showMuralUndoToast('Connector deleted');

    // Delete from server in background
    apiPost({ action: 'delete', sheet: 'mural_elements', id: connId }).catch(err => {
        console.error(err);
    });
}

/**
 * Get the center point of an element for connector routing.
 */
function getElementCenter(elId) {
    const el = muralElements.find(item => String(item.id) === String(elId) && item.type !== 'connector');
    if (!el) return null;
    return {
        x: Number(el.x || 0) + Number(el.w || 150) / 2,
        y: Number(el.y || 0) + Number(el.h || 150) / 2
    };
}
window.getElementCenter = getElementCenter;
window.getElementCenter = getElementCenter;

/**
 * Get the edge intersection point of an element's bounding box
 * towards a target point, for clean arrow endpoints.
 */
function getElementEdgePoint(elId, targetX, targetY) {
    const el = muralElements.find(item => String(item.id) === String(elId) && item.type !== 'connector');
    if (!el) return null;

    const cx = Number(el.x || 0) + Number(el.w || 150) / 2;
    const cy = Number(el.y || 0) + Number(el.h || 150) / 2;
    const hw = Number(el.w || 150) / 2 - 2; // -2px overlap to guarantee no visual gap
    const hh = Number(el.h || 150) / 2 - 2;

    const dx = targetX - cx;
    const dy = targetY - cy;

    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    // For circles
    if (el.type === 'shape' && el.shape === 'circle') {
        const r = Math.max(hw, hh);
        const dist = Math.hypot(dx, dy);
        return {
            x: cx + (dx / dist) * r,
            y: cy + (dy / dist) * r
        };
    }

    // For rectangles: find intersection with edge
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let scale;

    if (absDx * hh > absDy * hw) {
        // Intersects left or right edge
        scale = hw / absDx;
    } else {
        // Intersects top or bottom edge
        scale = hh / absDy;
    }

    return {
        x: cx + dx * scale,
        y: cy + dy * scale
    };
}

/**
 * Get the exact coordinate of a named anchor (top, bottom, left, right) on an element.
 */
function getElementAnchorPoint(elId, side) {
    const el = muralElements.find(item => String(item.id) === String(elId));
    if (!el) return null;

    const x = Number(el.x || 0);
    const y = Number(el.y || 0);
    const w = Number(el.w || 150);
    const h = Number(el.h || 150);

    switch (side) {
        case 'top': return { x: x + w / 2, y: y };
        case 'bottom': return { x: x + w / 2, y: y + h };
        case 'left': return { x: x, y: y + h / 2 };
        case 'right': return { x: x + w, y: y + h / 2 };
        default: return { x: x + w / 2, y: y + h / 2 };
    }
}

/**
 * Generate a bezier curve path between two elements.
 */
function getConnectorPath(conn) {
    const fromCenter = getElementCenter(conn.from_id);
    const toCenter = getElementCenter(conn.to_id);
    if (!fromCenter || !toCenter) return null;

    let fromPt, toPt;

    if (conn.from_side) {
        fromPt = getElementAnchorPoint(conn.from_id, conn.from_side);
    } else {
        fromPt = getElementEdgePoint(conn.from_id, toCenter.x, toCenter.y);
    }

    if (conn.to_side) {
        toPt = getElementAnchorPoint(conn.to_id, conn.to_side);
    } else {
        toPt = getElementEdgePoint(conn.to_id, fromCenter.x, fromCenter.y);
    }

    if (!fromPt || !toPt) return null;

    const fx = Number(fromPt.x), fy = Number(fromPt.y);
    const tx = Number(toPt.x), ty = Number(toPt.y);
    const style = conn.connector_style || 'bezier';

    if (style === 'straight') {
        return `M ${fx} ${fy} L ${tx} ${ty}`;
    }

    if (style === 'step') {
        const midX = (fx + tx) / 2;
        return `M ${fx} ${fy} L ${midX} ${fy} L ${midX} ${ty} L ${tx} ${ty}`;
    }

    const dx = tx - fx;
    const dy = ty - fy;
    const dist = Math.hypot(dx, dy);
    const curvature = Math.min(dist * 0.3, 120);

    let cp1x, cp1y, cp2x, cp2y;
    if (Math.abs(dx) > Math.abs(dy)) {
        cp1x = fx + curvature * Math.sign(dx);
        cp1y = fy;
        cp2x = tx - curvature * Math.sign(dx);
        cp2y = ty;
    } else {
        cp1x = fx;
        cp1y = fy + curvature * Math.sign(dy);
        cp2x = tx;
        cp2y = ty - curvature * Math.sign(dy);
    }

    return `M ${fx} ${fy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;
}

/**
 * Render a single connector SVG path.
 */
function renderSingleConnector(conn) {
    const svg = document.getElementById('muralConnectorSvg');
    if (!svg) return;

    // Remove existing path for this connector
    const existingPath = svg.querySelector(`[data-connector-id="${conn.id}"]`);
    if (existingPath) existingPath.remove();
    const existingHit = svg.querySelector(`[data-connector-hit="${conn.id}"]`);
    if (existingHit) existingHit.remove();

    const pathD = getConnectorPath(conn);
    if (!pathD) return;

    const isSelected = conn.id === muralSelectedConnectorId;

    // Invisible wider hit area for easier clicking
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', pathD);
    hitPath.setAttribute('data-connector-hit', conn.id);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '20');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.cursor = 'pointer';
    hitPath.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        muralSelectedConnectorId = conn.id;
        muralSelectedElementId = null;
        document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
        highlightMuralConnector(conn.id);
    });
    hitPath.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        muralSelectedConnectorId = conn.id;
        highlightMuralConnector(conn.id);
        showConnectorContextMenu(e.clientX, e.clientY, conn.id);
    });
    svg.appendChild(hitPath);

    // Visible path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('data-connector-id', conn.id);
    path.setAttribute('stroke', isSelected ? '#F59E0B' : (conn.color || '#6366F1'));
    path.setAttribute('stroke-width', isSelected ? '3' : '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('marker-end', isSelected ? 'url(#mural-arrowhead-selected)' : 'url(#mural-arrowhead)');
    path.style.transition = 'stroke 0.2s, stroke-width 0.2s';
    path.style.pointerEvents = 'none'; // hit area handles clicks
    if (isSelected) {
        path.setAttribute('stroke-dasharray', '');
        path.classList.add('mural-connector-selected');
    }
    svg.appendChild(path);
}

/**
 * Render all connectors.
 */
function renderAllMuralConnectors() {
    const svg = document.getElementById('muralConnectorSvg');
    if (!svg) return;

    // Clear all connector paths (keep defs)
    svg.querySelectorAll('path').forEach(p => p.remove());

    muralConnectors.forEach(conn => {
        renderSingleConnector(conn);
    });
}

/**
 * Update connectors attached to a specific element (on drag/resize).
 */
function updateConnectorsForElement(elementId) {
    const attached = muralConnectors.filter(c =>
        String(c.from_id) === String(elementId) || String(c.to_id) === String(elementId)
    );
    attached.forEach(conn => {
        renderSingleConnector(conn);
    });
}

/**
 * Highlight a connector (visual selection).
 */
function highlightMuralConnector(connId) {
    muralSelectedConnectorId = connId;
    renderAllMuralConnectors();
}

/**
 * Context menu for connectors.
 */
function showConnectorContextMenu(x, y, connId) {
    dismissMuralPopups();

    const conn = muralConnectors.find(c => c.id === connId);
    if (!conn) return;

    const menu = document.createElement('div');
    menu.className = 'mural-context-menu';
    menu.id = 'muralContextMenu';

    const menuWidth = 180;
    const menuHeight = 180;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const currentStyle = conn.connector_style || 'bezier';

    menu.innerHTML = `
        <button class="mural-context-item ${currentStyle === 'bezier' ? 'active-style' : ''}" onclick="changeConnectorStyle('${connId}', 'bezier'); dismissMuralPopups();">
            <i data-lucide="spline"></i> Curved
        </button>
        <button class="mural-context-item ${currentStyle === 'straight' ? 'active-style' : ''}" onclick="changeConnectorStyle('${connId}', 'straight'); dismissMuralPopups();">
            <i data-lucide="minus"></i> Straight
        </button>
        <button class="mural-context-item ${currentStyle === 'step' ? 'active-style' : ''}" onclick="changeConnectorStyle('${connId}', 'step'); dismissMuralPopups();">
            <i data-lucide="git-commit-horizontal"></i> Stepped
        </button>
        <div class="mural-context-divider"></div>
        <button class="mural-context-item danger" onclick="deleteMuralConnector('${connId}'); dismissMuralPopups();">
            <i data-lucide="trash-2"></i> Delete
        </button>
    `;

    document.body.appendChild(menu);
    muralContextMenuEl = menu;
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        document.addEventListener('pointerdown', dismissMuralPopupsOnOutside, { once: true });
    }, 10);
}

/**
 * Change connector line style.
 */
async function changeConnectorStyle(connId, style) {
    const conn = muralConnectors.find(c => c.id === connId);
    if (!conn) return;
    conn.connector_style = style;
    renderSingleConnector(conn);
    saveMuralElement(conn);
    showSaveIndicator('saving');
}
window.changeConnectorStyle = changeConnectorStyle;
window.deleteMuralConnector = deleteMuralConnector;

/* ═══════════════════════════════════════
   CLEANUP — Remove listeners on exit
   ═══════════════════════════════════════ */
// Store reference so we can remove
const _muralKeyHandler = (e) => {
    if (typeof onMuralKeyDown === 'function') onMuralKeyDown(e);
};

// Override exitMuralProject to clean up listeners
const _origExitMural = exitMuralProject;
// Already defined above, just ensuring keyboard cleanup happens on nav away
window.addEventListener('beforeunload', () => {
    document.removeEventListener('keydown', onMuralKeyDown);
});
