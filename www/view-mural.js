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
let muralDragInitialTransform = { x: 0, y: 0, scale: 1 };
let muralSelectedElementIds = []; // Array of selected element IDs
let muralPointerDown = false;
let muralIsMarquee = false; // Whether we are drag-selecting
let muralMarqueeStart = { x: 0, y: 0 };
let muralMarqueeRect = { x: 0, y: 0, w: 0, h: 0 };
let muralUndoStack = [];
let muralContextMenuEl = null;
let muralColorPickerEl = null;
let muralIsResizing = false;
let muralResizeStart = { w: 0, h: 0, x: 0, y: 0 };
let muralZoomExpanded = false;

/* ── Multi-select bounding box state ── */
let muralGroupResizing = false;
let muralGroupResizeEdge = null; // 'nw','ne','sw','se'
let muralGroupResizeStart = { mouseX: 0, mouseY: 0, bounds: null, elemSnapshots: [] };
let muralGroupDragging = false;
let muralJustMarqueed = false; // Flag to prevent click from clearing marquee selection on PC

/* ── Background settings ── */
let muralBgPattern = 'dots';  // 'dots','grid','checks','lines','none'
let muralBgColor = '';         // empty = default (var(--surface-base))

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
                    <button class="mural-header-btn" onclick="openMuralShortcutsModal()" title="Keyboard Shortcuts">
                        <i data-lucide="keyboard" style="width:18px;height:18px"></i>
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
    muralSelectedElementIds = [];
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
                    <div class="mural-zoom-controls-wrapper ${muralZoomExpanded ? 'expanded' : ''}" id="muralZoomWrapper">
                        <button class="mural-zoom-toggle" onclick="toggleMuralZoomMenu()" title="Zoom Controls">
                            <i data-lucide="zoom-in"></i>
                        </button>
                        <div class="mural-zoom-actions">
                            <button class="mural-zoom-btn-mini" onclick="zoomMural(1.25)" title="Zoom In">
                                <i data-lucide="plus"></i>
                            </button>
                            <button class="mural-zoom-btn-mini" onclick="zoomMural(0.8)" title="Zoom Out">
                                <i data-lucide="minus"></i>
                            </button>
                            <button class="mural-zoom-btn-mini" onclick="fitMuralToContent()" title="Fit to Content">
                                <i data-lucide="maximize-2"></i>
                            </button>
                            <button class="mural-zoom-btn-mini" onclick="resetMuralView()" title="Reset View">
                                <i data-lucide="scan"></i>
                            </button>
                        </div>
                    </div>
                    <button class="mural-bg-btn" id="muralBgBtn" onclick="toggleMuralBgPanel(event)" title="Canvas Background">
                        <i data-lucide="palette" style="width:16px;height:16px"></i>
                    </button>
                    <button class="mural-save-btn" id="muralManualSaveBtn" onclick="manualMuralSync()">
                        Save
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
                        <marker id="mural-arrowhead-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
                            <polygon points="10 0, 0 3.5, 10 7" fill="var(--mural-accent, #6366F1)" />
                        </marker>
                        <marker id="mural-arrowhead-start-selected" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
                            <polygon points="10 0, 0 3.5, 10 7" fill="#F59E0B" />
                        </marker>
                        <marker id="mural-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                            <circle cx="4" cy="4" r="3" fill="var(--mural-accent, #6366F1)" />
                        </marker>
                        <marker id="mural-dot-selected" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                            <circle cx="4" cy="4" r="3" fill="#F59E0B" />
                        </marker>
                    </defs>
                </svg>
            </div>

            <!-- Toolbar -->
            <div class="mural-toolbar" id="muralToolbar">
                <button class="mural-tool active" data-tool="select" onclick="setMuralTool('select')" data-tooltip="Select & Move (V)">
                    <i data-lucide="mouse-pointer-2"></i>
                </button>
                <button class="mural-tool" data-tool="hand" onclick="setMuralTool('hand')" data-tooltip="Hand Tool / Pan (H)">
                    <i data-lucide="hand"></i>
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
                <button class="mural-tool" id="muralUndoBtn" onclick="muralUndo()" data-tooltip="Undo (⌘Z)" style="opacity:0.4" disabled>
                    <i data-lucide="undo-2"></i>
                </button>
                <button class="mural-tool danger" onclick="deleteMuralSelected()" data-tooltip="Delete">
                    <i data-lucide="trash-2"></i>
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
    muralSelectedElementIds = [];
    muralUndoStack = [];
    dismissMuralPopups();
    // Restore app chrome
    hideMuralAppChrome(false);
    renderMural();
}

function hideMuralAppChrome(hide) {
    const selectors = ['.mobile-nav', '.fab', '.fab-overlay', '.fab-menu', '.ai-fab'];
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
                <marker id="mural-arrowhead-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
                    <polygon points="10 0, 0 3.5, 10 7" fill="var(--mural-accent, #6366F1)" />
                </marker>
                <marker id="mural-arrowhead-start-selected" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
                    <polygon points="10 0, 0 3.5, 10 7" fill="#F59E0B" />
                </marker>
                <marker id="mural-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                    <circle cx="4" cy="4" r="3" fill="var(--mural-accent, #6366F1)" />
                </marker>
                <marker id="mural-dot-selected" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                    <circle cx="4" cy="4" r="3" fill="#F59E0B" />
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
    if (muralSelectedElementIds.includes(data.id)) div.classList.add('selected');
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
            anchor.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
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
            snapshotElementsForUndo([data.id], 'resize');
            muralIsResizing = true;
            muralSelectedElementIds = [data.id];
            muralResizeStart = {
                w: data.w || 150,
                h: data.h || 150,
                x: e.clientX,
                y: e.clientY
            };
            highlightMuralElements([data.id]);
        });
        div.appendChild(handle);
    }

    // Pointer events for drag
    div.addEventListener('pointerdown', (e) => {
        if (muralIsResizing) return;
        if (document.activeElement === div && div.contentEditable === 'true') return; // Don't drag while typing

        // If hand tool is active, let the event bubble to the page for panning
        if (muralActiveTool === 'hand') return;

        e.stopPropagation();

        // ── Connector tool: click to connect ──
        if (muralActiveTool === 'connector') {
            handleConnectorClick(data.id, e);
            return;
        }

        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            // Toggle selection
            if (muralSelectedElementIds.includes(data.id)) {
                muralSelectedElementIds = muralSelectedElementIds.filter(id => id !== data.id);
            } else {
                muralSelectedElementIds.push(data.id);
            }
        } else {
            // Single select (if not already part of a multi-selection)
            if (!muralSelectedElementIds.includes(data.id)) {
                muralSelectedElementIds = [data.id];
            }
        }
        
        muralSelectedConnectorId = null;
        highlightMuralElements(muralSelectedElementIds);
        highlightMuralConnector(null);

        if (muralActiveTool === 'select') {
            muralIsDragging = true;
            muralDragStart = { x: e.clientX, y: e.clientY };
            div.setPointerCapture(e.pointerId);
        }
    });

    // Context menu (long press / right click)
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.preventDefault();
        e.stopPropagation();
        if (!muralSelectedElementIds.includes(data.id)) {
            muralSelectedElementIds = [data.id];
        }
        highlightMuralElements(muralSelectedElementIds);
        showMuralContextMenu(e.clientX, e.clientY, data.id);
    });

    // Long press for mobile
    let longPressTimer = null;
    div.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            if (!muralSelectedElementIds.includes(data.id)) {
                muralSelectedElementIds = [data.id];
            }
            highlightMuralElements(muralSelectedElementIds);
            showMuralContextMenu(touch.clientX, touch.clientY, data.id);
        }, 300); // Reduced from 500ms
    }, { passive: true });
    div.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
    div.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });

    return div;
}

function highlightMuralElements(ids) {
    document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
    (ids || []).forEach(id => {
        const dom = document.getElementById(`mural-el-${id}`);
        if (dom) dom.classList.add('selected');
    });
    updateSelectionBoundingBox();
}

/* ═══════════════════════════════════════
   SELECTION BOUNDING BOX — Group drag & resize
   ═══════════════════════════════════════ */
function getSelectionBounds() {
    if (muralSelectedElementIds.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    muralSelectedElementIds.forEach(id => {
        const el = muralElements.find(e => String(e.id) === String(id));
        if (!el || el.type === 'connector') return;
        const ex = el.x || 0, ey = el.y || 0;
        const ew = el.w || 150, eh = el.h || 150;
        minX = Math.min(minX, ex);
        minY = Math.min(minY, ey);
        maxX = Math.max(maxX, ex + ew);
        maxY = Math.max(maxY, ey + eh);
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function updateSelectionBoundingBox() {
    let box = document.getElementById('muralSelectionBox');
    const bounds = getSelectionBounds();
    if (!bounds) {
        removeSelectionBoundingBox();
        return;
    }
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;

    if (!box) {
        box = document.createElement('div');
        box.id = 'muralSelectionBox';
        box.className = 'mural-selection-box';
        canvas.appendChild(box);

        // Append handles as SIBLINGS on the canvas (not inside the box)
        // so pointer-events: none on the box doesn't block them on desktop
        ['nw','ne','sw','se'].forEach(edge => {
            const handle = document.createElement('div');
            handle.className = `mural-sel-handle ${edge}`;
            handle.id = `muralSelHandle-${edge}`;
            handle.dataset.edge = edge;
            handle.addEventListener('pointerdown', onSelBoxHandleDown);
            canvas.appendChild(handle);
        });
    }

    const pad = 8;
    const bx = bounds.x - pad, by = bounds.y - pad;
    const bw = bounds.w + pad * 2, bh = bounds.h + pad * 2;
    box.style.left = `${bx}px`;
    box.style.top = `${by}px`;
    box.style.width = `${bw}px`;
    box.style.height = `${bh}px`;

    // Position corner handles
    const hOff = 6; // half handle size
    const positions = {
        nw: { left: bx - hOff, top: by - hOff },
        ne: { left: bx + bw - hOff, top: by - hOff },
        sw: { left: bx - hOff, top: by + bh - hOff },
        se: { left: bx + bw - hOff, top: by + bh - hOff }
    };
    ['nw','ne','sw','se'].forEach(edge => {
        const h = document.getElementById(`muralSelHandle-${edge}`);
        if (h) {
            h.style.left = `${positions[edge].left}px`;
            h.style.top = `${positions[edge].top}px`;
        }
    });
}

function onSelBoxHandleDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const edge = e.target.dataset.edge;
    if (!edge) return;
    snapshotElementsForUndo(muralSelectedElementIds, 'resize');
    muralGroupResizing = true;
    muralGroupResizeEdge = edge;
    const bounds = getSelectionBounds();
    // Snapshot each element's relative position within the bounding box
    const elemSnapshots = [];
    muralSelectedElementIds.forEach(id => {
        const el = muralElements.find(item => String(item.id) === String(id));
        if (!el || el.type === 'connector') return;
        elemSnapshots.push({
            id: el.id,
            rx: ((el.x || 0) - bounds.x) / bounds.w,
            ry: ((el.y || 0) - bounds.y) / bounds.h,
            rw: (el.w || 150) / bounds.w,
            rh: (el.h || 150) / bounds.h
        });
    });
    muralGroupResizeStart = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        bounds: { ...bounds },
        elemSnapshots
    };
}

function onGroupResizeMove(e) {
    if (!muralGroupResizing) return;
    const { bounds, elemSnapshots } = muralGroupResizeStart;
    const dx = (e.clientX - muralGroupResizeStart.mouseX) / muralTransform.scale;
    const dy = (e.clientY - muralGroupResizeStart.mouseY) / muralTransform.scale;
    const edge = muralGroupResizeEdge;

    let newX = bounds.x, newY = bounds.y, newW = bounds.w, newH = bounds.h;
    if (edge.includes('e')) { newW = Math.max(60, bounds.w + dx); }
    if (edge.includes('w')) { newW = Math.max(60, bounds.w - dx); newX = bounds.x + bounds.w - newW; }
    if (edge.includes('s')) { newH = Math.max(60, bounds.h + dy); }
    if (edge.includes('n')) { newH = Math.max(60, bounds.h - dy); newY = bounds.y + bounds.h - newH; }

    // Apply proportional resize to all elements
    elemSnapshots.forEach(snap => {
        const el = muralElements.find(item => String(item.id) === String(snap.id));
        if (!el) return;
        el.x = newX + snap.rx * newW;
        el.y = newY + snap.ry * newH;
        el.w = Math.max(40, snap.rw * newW);
        el.h = Math.max(40, snap.rh * newH);
        const dom = document.getElementById(`mural-el-${el.id}`);
        if (dom) {
            dom.style.left = `${el.x}px`;
            dom.style.top = `${el.y}px`;
            dom.style.width = `${el.w}px`;
            dom.style.height = `${el.h}px`;
        }
        updateConnectorsForElement(el.id);
    });
    updateSelectionBoundingBox();
}

function onGroupResizeUp(e) {
    if (!muralGroupResizing) return;
    muralGroupResizing = false;
    muralGroupResizeEdge = null;
    // Elements already updated in-place, will be saved on manual sync
}

function removeSelectionBoundingBox() {
    const box = document.getElementById('muralSelectionBox');
    if (box) box.remove();
    // Remove sibling handles
    ['nw','ne','sw','se'].forEach(edge => {
        const h = document.getElementById(`muralSelHandle-${edge}`);
        if (h) h.remove();
    });
}

function updateSelectionBoundingBoxOffset(dx, dy) {
    // Temporarily offset the bounding box + handles during drag (before el.x/y are committed)
    const box = document.getElementById('muralSelectionBox');
    if (!box || muralSelectedElementIds.length < 2) return;
    const bounds = getSelectionBounds();
    if (!bounds) return;
    const pad = 8;
    const bx = bounds.x + dx - pad, by = bounds.y + dy - pad;
    const bw = bounds.w + pad * 2, bh = bounds.h + pad * 2;
    box.style.left = `${bx}px`;
    box.style.top = `${by}px`;
    // Move handles too
    const hOff = 6;
    const positions = {
        nw: { left: bx - hOff, top: by - hOff },
        ne: { left: bx + bw - hOff, top: by - hOff },
        sw: { left: bx - hOff, top: by + bh - hOff },
        se: { left: bx + bw - hOff, top: by + bh - hOff }
    };
    ['nw','ne','sw','se'].forEach(edge => {
        const h = document.getElementById(`muralSelHandle-${edge}`);
        if (h) {
            h.style.left = `${positions[edge].left}px`;
            h.style.top = `${positions[edge].top}px`;
        }
    });
}

/* ═══════════════════════════════════════
   CONTEXT MENU — Element Actions
   ═══════════════════════════════════════ */
function showMuralContextMenu(x, y, elementId) {
    dismissMuralPopups();

    const isMultiple = muralSelectedElementIds.length > 1;
    const el = muralElements.find(item => String(item.id) === String(elementId));
    if (!el && !isMultiple) return;

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
    snapshotElementsForUndo([elementId], 'color');
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
    const bgPanel = document.getElementById('muralBgPanel');
    if (bgPanel) bgPanel.remove();
}

/* ═══════════════════════════════════════
   BACKGROUND OPTIONS PANEL
   ═══════════════════════════════════════ */
const MURAL_BG_PATTERNS = [
    { id: 'dots', label: 'Dots', icon: 'grip-horizontal' },
    { id: 'grid', label: 'Grid', icon: 'grid-3x3' },
    { id: 'checks', label: 'Checks', icon: 'check-square' },
    { id: 'lines', label: 'Lines', icon: 'align-justify' },
    { id: 'cross', label: 'Cross', icon: 'plus' },
    { id: 'none', label: 'None', icon: 'square' }
];

const MURAL_BG_COLORS = [
    { id: '', label: 'Default', color: '' },
    { id: '#ffffff', label: 'White', color: '#ffffff' },
    { id: '#f8fafc', label: 'Slate', color: '#f8fafc' },
    { id: '#fefce8', label: 'Warm', color: '#fefce8' },
    { id: '#f0fdf4', label: 'Green', color: '#f0fdf4' },
    { id: '#eff6ff', label: 'Blue', color: '#eff6ff' },
    { id: '#fdf2f8', label: 'Pink', color: '#fdf2f8' },
    { id: '#faf5ff', label: 'Purple', color: '#faf5ff' },
    { id: '#1e1e2e', label: 'Dark', color: '#1e1e2e' },
    { id: '#1a1a2e', label: 'Navy', color: '#1a1a2e' },
    { id: '#0f172a', label: 'Midnight', color: '#0f172a' },
    { id: '#18181b', label: 'Zinc', color: '#18181b' }
];

function toggleMuralBgPanel(e) {
    e.stopPropagation();
    let panel = document.getElementById('muralBgPanel');
    if (panel) { panel.remove(); return; }

    const btn = document.getElementById('muralBgBtn');
    const rect = btn.getBoundingClientRect();

    panel = document.createElement('div');
    panel.id = 'muralBgPanel';
    panel.className = 'mural-bg-panel';
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.right = `${window.innerWidth - rect.right}px`;

    // Pattern section
    let html = `<div class="mural-bg-section-title">Pattern</div><div class="mural-bg-patterns">`;
    MURAL_BG_PATTERNS.forEach(p => {
        const active = muralBgPattern === p.id ? 'active' : '';
        html += `<button class="mural-bg-pattern-btn ${active}" onclick="setMuralBgPattern('${p.id}')" title="${p.label}">
            <i data-lucide="${p.icon}" style="width:16px;height:16px"></i>
            <span>${p.label}</span>
        </button>`;
    });
    html += `</div>`;

    // Color section
    html += `<div class="mural-bg-section-title" style="margin-top:12px">Color</div><div class="mural-bg-colors">`;
    MURAL_BG_COLORS.forEach(c => {
        const active = muralBgColor === c.id ? 'active' : '';
        const isDark = c.id && ['#1e1e2e','#1a1a2e','#0f172a','#18181b'].includes(c.id);
        const border = !c.id || c.id === '#ffffff' ? 'border:1px solid var(--border-color);' : '';
        const bg = c.color || 'var(--surface-base)';
        html += `<button class="mural-bg-color-btn ${active}" onclick="setMuralBgColor('${c.id}')" title="${c.label}" style="background:${bg}; ${border}">
            ${active ? `<i data-lucide="check" style="width:14px;height:14px;color:${isDark ? '#fff' : '#333'}"></i>` : ''}
        </button>`;
    });
    html += `</div>`;

    panel.innerHTML = html;
    document.body.appendChild(panel);
    if (window.lucide) lucide.createIcons();

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', closeBgPanelOutside, { once: true });
    }, 10);
}

function closeBgPanelOutside(e) {
    const panel = document.getElementById('muralBgPanel');
    if (panel && !panel.contains(e.target) && !e.target.closest('#muralBgBtn')) {
        panel.remove();
    }
}

function setMuralBgPattern(pattern) {
    muralBgPattern = pattern;
    applyMuralBackground();
    // Refresh panel to update active state
    const panel = document.getElementById('muralBgPanel');
    if (panel) { panel.remove(); toggleMuralBgPanel({ stopPropagation: () => {} }); }
    // Persist to project
    saveMuralBgSettings();
}

function setMuralBgColor(color) {
    muralBgColor = color;
    applyMuralBackground();
    const panel = document.getElementById('muralBgPanel');
    if (panel) { panel.remove(); toggleMuralBgPanel({ stopPropagation: () => {} }); }
    saveMuralBgSettings();
}

function applyMuralBackground() {
    const page = document.getElementById('muralPage');
    if (!page) return;

    // Set background color
    const bgColor = muralBgColor || '';
    page.style.backgroundColor = bgColor || '';

    // Determine pattern dot/line color based on bg darkness
    const isDark = muralBgColor && ['#1e1e2e','#1a1a2e','#0f172a','#18181b'].includes(muralBgColor);
    const dotColor = isDark ? 'rgba(255,255,255,0.12)' : 'var(--border-color)';
    const lineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const majorColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

    // Apply pattern to the page (viewport) so it's always infinite
    switch (muralBgPattern) {
        case 'dots':
            page.style.backgroundImage = `radial-gradient(circle, ${dotColor} 0.8px, transparent 0.8px)`;
            page.style.backgroundSize = '32px 32px';
            break;
        case 'grid':
            // Graph paper: minor lines every 16px, major lines every 128px (8x)
            page.style.backgroundImage = `
                linear-gradient(${majorColor} 1px, transparent 1px),
                linear-gradient(90deg, ${majorColor} 1px, transparent 1px),
                linear-gradient(${lineColor} 0.5px, transparent 0.5px),
                linear-gradient(90deg, ${lineColor} 0.5px, transparent 0.5px)`;
            page.style.backgroundSize = '128px 128px, 128px 128px, 16px 16px, 16px 16px';
            break;
        case 'checks':
            page.style.backgroundImage = `
                linear-gradient(45deg, ${lineColor} 25%, transparent 25%),
                linear-gradient(-45deg, ${lineColor} 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, ${lineColor} 75%),
                linear-gradient(-45deg, transparent 75%, ${lineColor} 75%)`;
            page.style.backgroundSize = '32px 32px';
            break;
        case 'lines':
            page.style.backgroundImage = `linear-gradient(${lineColor} 1px, transparent 1px)`;
            page.style.backgroundSize = '32px 32px';
            break;
        case 'cross':
            page.style.backgroundImage = `
                radial-gradient(circle, ${dotColor} 0.8px, transparent 0.8px),
                linear-gradient(${lineColor} 1px, transparent 1px),
                linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
            page.style.backgroundSize = '32px 32px, 32px 32px, 32px 32px';
            break;
        case 'none':
            page.style.backgroundImage = 'none';
            break;
    }
}

function saveMuralBgSettings() {
    const project = muralProjects.find(p => String(p.id) === String(muralActiveProjectId));
    if (project) {
        project.bg_pattern = muralBgPattern;
        project.bg_color = muralBgColor;
    }
    // Persist to backend sheet
    apiPost({
        action: 'update',
        sheet: 'mural_projects',
        id: muralActiveProjectId,
        payload: {
            bg_pattern: muralBgPattern || '',
            bg_color: muralBgColor || '',
            updated_at: new Date().toISOString()
        }
    }).catch(err => console.error('Failed to save bg settings:', err));
}

function loadMuralBgSettings() {
    // Load from project data (already fetched from backend)
    const project = muralProjects.find(p => String(p.id) === String(muralActiveProjectId));
    if (project && (project.bg_pattern || project.bg_color)) {
        muralBgPattern = project.bg_pattern || 'dots';
        muralBgColor = project.bg_color || '';
    } else {
        muralBgPattern = 'dots';
        muralBgColor = '';
    }
    applyMuralBackground();
}
window.toggleMuralBgPanel = toggleMuralBgPanel;
window.setMuralBgPattern = setMuralBgPattern;
window.setMuralBgColor = setMuralBgColor;

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
        // Don't deselect when clicking selection handles or bounding box
        if (e.target.classList && (e.target.classList.contains('mural-sel-handle') || e.target.classList.contains('mural-selection-box'))) return;
        // Don't deselect right after a marquee selection (click fires after pointerup on PC)
        if (muralJustMarqueed) { muralJustMarqueed = false; return; }
        if (e.target === canvas || e.target.closest('.mural-connector-svg')) {
            muralSelectedElementIds = [];
            muralSelectedConnectorId = null;
            highlightMuralConnector(null);
            document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
            removeSelectionBoundingBox();
            dismissMuralPopups();
            // Cancel connector creation if clicking empty space
            if (muralConnectorSource) cancelMuralConnector();
        }
    });

    applyMuralTransform();
    updateMuralZoomBadge();
    loadMuralBgSettings();
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

    // Don't intercept clicks on selection box handles
    if (e.target.classList && e.target.classList.contains('mural-sel-handle')) return;

    muralPointerDown = true;

    // Handle Hand tool panning regardless of what's clicked (if it's not another UI element)
    if (muralActiveTool === 'hand') {
        const canvas = document.getElementById('muralCanvas');
        if (canvas) canvas.style.cursor = 'grabbing';
        muralIsDragging = true;
        muralDragStart = { x: e.clientX, y: e.clientY };
        muralDragInitialTransform = { ...muralTransform };
        return;
    }

    if (e.target.id === 'muralPage' || e.target.id === 'muralCanvas' || e.target.id === 'muralConnectorSvg') {
        if (muralActiveTool === 'select') {
            muralIsMarquee = true;
            muralMarqueeStart = { 
                x: (e.clientX - muralTransform.x) / muralTransform.scale, 
                y: (e.clientY - muralTransform.y) / muralTransform.scale 
            };
            muralMarqueeRect = { x: muralMarqueeStart.x, y: muralMarqueeStart.y, w: 0, h: 0 };
            
            // Re-render marquee if exists
            let marquee = document.getElementById('muralMarquee');
            if (marquee) marquee.remove();
            marquee = document.createElement('div');
            marquee.id = 'muralMarquee';
            marquee.className = 'mural-marquee';
            document.getElementById('muralCanvas').appendChild(marquee);
        }

        muralIsDragging = !muralIsMarquee;
        muralDragStart = { x: e.clientX, y: e.clientY };
        muralDragInitialTransform = { ...muralTransform };
        
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            muralSelectedElementIds = [];
            highlightMuralElements([]);
        }
        dismissMuralPopups();
    }
}

function onMuralPointerMove(e) {
    if (muralTouchState.isPinching) return;

    // Group resize from bounding box handles
    if (muralGroupResizing) {
        e.preventDefault();
        onGroupResizeMove(e);
        return;
    }

    if (muralIsResizing && muralSelectedElementIds.length > 0) {
        e.preventDefault();
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementIds[0]));
        if (el) {
            const dx = (e.clientX - muralResizeStart.x) / muralTransform.scale;
            const dy = (e.clientY - muralResizeStart.y) / muralTransform.scale;
            el.w = Math.max(20, muralResizeStart.w + dx);
            el.h = Math.max(20, muralResizeStart.h + dy);
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

    if (muralIsMarquee) {
        const curX = (e.clientX - muralTransform.x) / muralTransform.scale;
        const curY = (e.clientY - muralTransform.y) / muralTransform.scale;
        
        muralMarqueeRect.x = Math.min(muralMarqueeStart.x, curX);
        muralMarqueeRect.y = Math.min(muralMarqueeStart.y, curY);
        muralMarqueeRect.w = Math.abs(curX - muralMarqueeStart.x);
        muralMarqueeRect.h = Math.abs(curY - muralMarqueeStart.y);
        
        const marquee = document.getElementById('muralMarquee');
        if (marquee) {
            marquee.style.left = `${muralMarqueeRect.x}px`;
            marquee.style.top = `${muralMarqueeRect.y}px`;
            marquee.style.width = `${muralMarqueeRect.w}px`;
            marquee.style.height = `${muralMarqueeRect.h}px`;
        }
        return;
    }

    if (!muralIsDragging) return;

    if (muralSelectedElementIds.length > 0) {
        const dx = (e.clientX - muralDragStart.x) / muralTransform.scale;
        const dy = (e.clientY - muralDragStart.y) / muralTransform.scale;
        
        muralSelectedElementIds.forEach(id => {
            const el = muralElements.find(item => String(item.id) === String(id));
            if (el) {
                // We use a temporary display offset, but we don't update el.x/y until pointerup
                const dom = document.getElementById(`mural-el-${el.id}`);
                if (dom) {
                    dom.style.left = `${el.x + dx}px`;
                    dom.style.top = `${el.y + dy}px`;
                }
                updateConnectorsForElement(el.id);
            }
        });
        // Move selection bounding box in sync
        updateSelectionBoundingBoxOffset(dx, dy);
    } else {
        // If hand tool OR background drag
        muralTransform.x = muralDragInitialTransform.x + (e.clientX - muralDragStart.x);
        muralTransform.y = muralDragInitialTransform.y + (e.clientY - muralDragStart.y);
        applyMuralTransform();
    }
}

function onMuralPointerUp(e) {
    muralPointerDown = false;

    if (muralGroupResizing) {
        onGroupResizeUp(e);
        return;
    }

    if (muralActiveTool === 'hand') {
        const canvas = document.getElementById('muralCanvas');
        if (canvas) canvas.style.cursor = 'grab';
        muralIsDragging = false;
        return;
    }

    if (muralIsMarquee) {
        muralIsMarquee = false;
        const marquee = document.getElementById('muralMarquee');
        if (marquee) marquee.remove();

        // Find elements inside rectangle
        const selected = [];
        muralElements.forEach(el => {
            if (el.type === 'connector') return;
            const ex = el.x || 0;
            const ey = el.y || 0;
            const ew = el.w || 150;
            const eh = el.h || 150;

            if (ex < muralMarqueeRect.x + muralMarqueeRect.w &&
                ex + ew > muralMarqueeRect.x &&
                ey < muralMarqueeRect.y + muralMarqueeRect.h &&
                ey + eh > muralMarqueeRect.y) {
                selected.push(el.id);
            }
        });

        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            muralSelectedElementIds = [...new Set([...muralSelectedElementIds, ...selected])];
        } else {
            muralSelectedElementIds = selected;
        }
        highlightMuralElements(muralSelectedElementIds);

        // On PC, the click event fires after pointerup and would clear the selection.
        // Set a flag so the canvas click handler skips deselection.
        if (muralSelectedElementIds.length > 0) {
            muralJustMarqueed = true;
            setTimeout(() => { muralJustMarqueed = false; }, 0);
        }
    }

    if (muralIsResizing && muralSelectedElementIds.length > 0) {
        const el = muralElements.find(item => String(item.id) === String(muralSelectedElementIds[0]));
        if (el) saveMuralElement(el);
        muralIsResizing = false;
        // Changes kept locally until manual sync
    }

    if (muralSelectedElementIds.length > 0 && muralIsDragging) {
        const dx = (e.clientX - muralDragStart.x) / muralTransform.scale;
        const dy = (e.clientY - muralDragStart.y) / muralTransform.scale;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            // Snapshot BEFORE committing the move
            snapshotElementsForUndo(muralSelectedElementIds, 'move');
            muralSelectedElementIds.forEach(id => {
                const el = muralElements.find(item => String(item.id) === String(id));
                if (el) {
                    el.x += dx;
                    el.y += dy;
                    saveMuralElement(el);
                }
            });
        }
        updateSelectionBoundingBox();
    }
    muralIsDragging = false;
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

    // Update canvas cursor and anchor visibility
    const canvas = document.getElementById('muralCanvas');
    const page = document.getElementById('muralPage');
    if (canvas) {
        if (tool === 'connector') canvas.style.cursor = 'crosshair';
        else if (tool === 'hand') canvas.style.cursor = 'grab';
        else canvas.style.cursor = 'default';
    }
    if (page) {
        page.classList.toggle('connector-tool-active', tool === 'connector');
    }
}
window.setMuralTool = setMuralTool;

/* ═══════════════════════════════════════
   KEYBOARD SHORTCUTS SYSTEM
   ═══════════════════════════════════════ */
const MURAL_DEFAULT_SHORTCUTS = {
    'delete_item': { key: 'delete', mods: [], label: 'Delete Item', desc: 'Delete selected element' },
    'delete_item_alt': { key: 'backspace', mods: [], label: 'Delete Item (Alt)', desc: 'Delete selected element' },
    'duplicate': { key: 'd', mods: ['meta'], label: 'Duplicate', desc: 'Duplicate selected element' },
    'undo': { key: 'z', mods: ['meta'], label: 'Undo', desc: 'Undo last action' },
    'tool_select': { key: 'v', mods: [], label: 'Select Tool', desc: 'Switch to select tool' },
    'tool_hand': { key: 'h', mods: [], label: 'Hand Tool', desc: 'Switch to hand tool for panning' },
    'add_sticky': { key: 'n', mods: [], label: 'New Sticky', desc: 'Create a new sticky note' },
    'add_text': { key: 't', mods: [], label: 'New Text', desc: 'Create a text element' },
    'add_rect': { key: 'r', mods: [], label: 'New Rectangle', desc: 'Create a rectangle shape' },
    'tool_connector': { key: 'l', mods: [], label: 'Connector Tool', desc: 'Switch to connector tool' },
    'reset_view': { key: '0', mods: ['meta'], label: 'Reset View', desc: 'Reset zoom and pan' },
    'fit_content': { key: '1', mods: ['meta'], label: 'Fit to Content', desc: 'Zoom to fit all elements' },
    'escape': { key: 'escape', mods: [], label: 'Cancel / Deselect', desc: 'Close menus or deselect' }
};

function getMuralShortcuts() {
    const s = state.data.settings?.[0] || {};
    if (s.mural_shortcuts) {
        try {
            return JSON.parse(s.mural_shortcuts);
        } catch (e) {
            console.error('Failed to parse mural shortcuts:', e);
        }
    }
    return JSON.parse(JSON.stringify(MURAL_DEFAULT_SHORTCUTS));
}

function isMuralShortcutsEnabled() {
    const s = state.data.settings?.[0] || {};
    return s.mural_shortcuts_enabled !== false; // Default to true
}

async function setMuralShortcutsEnabled(enabled) {
    if (!state.data.settings) state.data.settings = [{}];
    const s = state.data.settings[0];
    s.mural_shortcuts_enabled = enabled;
    try {
        if (s.id) await apiPost('settings', s);
        else {
            const res = await apiPost('settings', { action: 'create', payload: s });
            if (res.success && res.id) s.id = res.id;
        }
    } catch (e) {
        console.error('Error saving shortcuts toggle:', e);
    }
}

async function saveMuralShortcuts(shortcuts) {
    if (!state.data.settings) state.data.settings = [{}];
    const s = state.data.settings[0];
    s.mural_shortcuts = JSON.stringify(shortcuts);
    
    try {
        if (s.id) {
            await apiPost('settings', s);
        } else {
            const res = await apiPost('settings', { action: 'create', payload: s });
            if (res.success && res.id) s.id = res.id;
        }
    } catch (e) {
        console.error('Error saving shortcuts:', e);
        toast('Failed to save shortcuts');
    }
}

let _muralRecordingAction = null;

window.openMuralShortcutsModal = function() {
    const shortcuts = getMuralShortcuts();
    const isEnabled = isMuralShortcutsEnabled();
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    
    _muralRecordingAction = null;

    const renderList = () => {
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                <h3 style="margin:0">Keyboard Shortcuts</h3>
                <div style="display:flex; align-items:center; gap:8px">
                    <span style="font-size:12px; color:var(--text-3)">${isEnabled ? 'Enabled' : 'Disabled'}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleMuralShortcutsGlobal(this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <p style="color:var(--text-3); margin-bottom:20px; font-size:13px">Click a shortcut to remap it.</p>
            
            <div class="mural-shortcuts-list">
                ${Object.entries(shortcuts).map(([id, s]) => `
                    <div class="mural-shortcut-row ${_muralRecordingAction === id ? 'recording' : ''}" onclick="startMuralShortcutRecording('${id}')">
                        <div class="mural-shortcut-info">
                            <span class="mural-shortcut-label">${s.label}</span>
                            <span class="mural-shortcut-desc">${s.desc}</span>
                        </div>
                        <div class="mural-shortcut-key">
                            ${s.mods.includes('meta') ? '<span class="mural-key-kbd">⌘</span>' : ''}
                            ${s.mods.includes('ctrl') ? '<span class="mural-key-kbd">Ctrl</span>' : ''}
                            ${s.mods.includes('shift') ? '<span class="mural-key-kbd">Shift</span>' : ''}
                            ${s.mods.includes('alt') ? '<span class="mural-key-kbd">Alt</span>' : ''}
                            <span class="mural-key-kbd">${s.key.toUpperCase()}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex; gap:12px; margin-top:24px;">
                <button class="btn secondary" style="flex:1" onclick="resetMuralShortcutsToDefault()">Reset Defaults</button>
                <button class="btn primary" style="flex:1" onclick="document.getElementById('universalModal').classList.add('hidden'); _muralRecordingAction = null;">Done</button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    };

    renderList();
    modal.classList.remove('hidden');

    window.startMuralShortcutRecording = (id) => {
        _muralRecordingAction = id;
        renderList();
        
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const forbiddenKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'];
            if (forbiddenKeys.includes(e.key)) return;

            const newKey = e.key.toLowerCase();
            const mods = [];
            if (e.metaKey) mods.push('meta');
            if (e.ctrlKey) mods.push('ctrl');
            if (e.shiftKey) mods.push('shift');
            if (e.altKey) mods.push('alt');

            shortcuts[id].key = newKey;
            shortcuts[id].mods = mods;
            
            _muralRecordingAction = null;
            document.removeEventListener('keydown', handler, true);
            
            saveMuralShortcuts(shortcuts);
            renderList();
        };

        document.addEventListener('keydown', handler, true);
    };

    window.resetMuralShortcutsToDefault = async () => {
        if (!confirm('Reset all shortcuts to default?')) return;
        const defaults = JSON.parse(JSON.stringify(MURAL_DEFAULT_SHORTCUTS));
        await saveMuralShortcuts(defaults);
        document.getElementById('universalModal').classList.add('hidden');
        toast('Shortcuts reset');
        openMuralShortcutsModal();
    };

    window.toggleMuralShortcutsGlobal = async (checked) => {
        await setMuralShortcutsEnabled(checked);
        toast(`Shortcuts ${checked ? 'enabled' : 'disabled'}`);
        openMuralShortcutsModal();
    };
};
function onMuralKeyDown(e) {
    if (!muralActiveProjectId) return;
    if (!isMuralShortcutsEnabled()) return; // Early return if shortcuts are disabled
    if (_muralRecordingAction) return; // Don't catch while recording
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const key = e.key.toLowerCase();
    const shortcuts = getMuralShortcuts();

    const matches = (s) => {
        if (s.key !== key) return false;
        const needsMeta = s.mods.includes('meta');
        const needsCtrl = s.mods.includes('ctrl');
        const needsShift = s.mods.includes('shift');
        const hasMeta = e.metaKey;
        const hasCtrl = e.ctrlKey;
        const hasShift = e.shiftKey;
        // Meta or Ctrl usually treated similarly for shortcut purposes on Mac vs PC
        // If shortcut doesn't need meta, check if it's strictly a plain key
        // (Except for Cmd+D/Z which have meta in default shortcuts)
        if (needsMeta && !(hasMeta || hasCtrl)) return false;
        if (!needsMeta && (hasMeta || hasCtrl) && s.mods.length === 0) {
            // If the shortcut is just a key (e.g., 'v') and meta/ctrl is pressed, it doesn't match
            // unless the shortcut explicitly includes meta/ctrl.
            // This prevents 'Cmd+V' from triggering 'v' tool_select.
            if (hasMeta || hasCtrl) return false;
        }
        if (needsShift !== hasShift) return false;
        return true;
    };

    // Find the action for this key
    const action = Object.keys(shortcuts).find(id => matches(shortcuts[id]));
    if (!action) return;

    // Handle Actions
    if (action === 'delete_item' || action === 'delete_item_alt') {
        if (muralSelectedConnectorId) {
            e.preventDefault();
            deleteMuralConnector(muralSelectedConnectorId);
            muralSelectedConnectorId = null;
            highlightMuralConnector(null);
            dismissMuralPopups();
        } else if (muralSelectedElementIds.length > 0) {
            e.preventDefault();
            deleteMuralSelected();
        }
    } else if (action === 'duplicate') {
        if (muralSelectedElementIds.length > 0) {
            e.preventDefault();
            duplicateMuralSelected();
        }
    } else if (action === 'undo') {
        e.preventDefault();
        muralUndo();
    } else if (action === 'tool_select') {
        setMuralTool('select');
    } else if (action === 'tool_hand') {
        setMuralTool('hand');
    } else if (action === 'add_sticky') {
        addMuralSticky();
    } else if (action === 'add_text') {
        addMuralText();
    } else if (action === 'add_rect') {
        addMuralShape('rect');
    } else if (action === 'tool_connector') {
        setMuralTool('connector');
    } else if (action === 'escape') {
        if (muralConnectorSource) {
            cancelMuralConnector();
        }
        // Always deselect/dismiss popups on escape
        muralSelectedElementIds = [];
        muralSelectedConnectorId = null;
        highlightMuralConnector(null);
        document.querySelectorAll('.mural-element.selected').forEach(el => el.classList.remove('selected'));
        dismissMuralPopups();
    } else if (action === 'reset_view') {
        e.preventDefault();
        resetMuralView();
    } else if (action === 'fit_content') {
        e.preventDefault();
        fitMuralToContent();
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
        y: center.y - (shape === 'rect' ? 30 : 60),
        w: 120, h: shape === 'rect' ? 60 : 120,
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

window.openMuralIconLibrary = function() {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    if (!modal || !box) return;

    // Selection of useful icons for whiteboarding
    const icons = [
        'heart', 'star', 'check', 'check-circle', 'info', 'help-circle', 'alert-triangle',
        'thumbs-up', 'thumbs-down', 'smile', 'frown', 'meh', 'user', 'users', 'clock',
        'calendar', 'flag', 'award', 'target', 'rocket', 'lightbulb', 'zap', 'flame',
        'image', 'paperclip', 'link', 'mail', 'phone', 'home', 'search', 'settings',
        'navigation', 'map-pin', 'camera', 'mic', 'video', 'music', 'briefcase', 'book',
        'file-text', 'folder', 'archive', 'trash-2', 'shield', 'lock', 'lock-open', 'key'
    ];

    box.innerHTML = `
        <h3 style="margin-bottom:8px">Icon Library</h3>
        <p style="color:var(--text-3); margin-bottom:16px; font-size:13px">Choose an icon to add to the canvas.</p>
        
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
        if (newEl.type === 'icon' && window.lucide) {
            lucide.createIcons();
        }
        muralSelectedElementIds = [newEl.id];
        highlightMuralElements(muralSelectedElementIds);
        pushMuralUndo({ action: 'create', snapshots: [{ ...newEl }] });
        // Removed automatic server sync: new elements now stay local (temp_ID)
        // until manualMuralSync() is called.
    }
}

async function deleteMuralElement(id) {
    const el = muralElements.find(item => String(item.id) === String(id));
    if (!el) return;

    // Push to undo stack
    pushMuralUndo({ action: 'delete', snapshots: [{ ...el }] });

    // Optimistic: remove from DOM immediately
    const dom = document.getElementById(`mural-el-${id}`);
    if (dom) dom.remove();
    muralElements = muralElements.filter(item => item.id !== id);
    muralSelectedElementIds = muralSelectedElementIds.filter(item => item !== id);

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
        muralSelectedConnectorId = null;
        return;
    }
    if (muralSelectedElementIds.length === 0) return toast('Select elements first');
    
    const idsToDelete = [...muralSelectedElementIds];
    muralSelectedElementIds = [];
    idsToDelete.forEach(id => deleteMuralElement(id));
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
    if (muralSelectedElementIds.length === 0) return toast('Select elements first');
    
    const idsToDuplicate = [...muralSelectedElementIds];
    // Clear selection so we only select the new ones
    muralSelectedElementIds = [];
    
    // Use a small delay between duplications to maintain stack order if needed, 
    // or just loop. We'll loop.
    idsToDuplicate.forEach(id => duplicateMuralElement(id));
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
function pushMuralUndo(entry) {
    muralUndoStack.push(entry);
    // Cap stack size
    if (muralUndoStack.length > 50) muralUndoStack.shift();
    updateMuralUndoBtn();
}

function updateMuralUndoBtn() {
    const btn = document.getElementById('muralUndoBtn');
    if (!btn) return;
    if (muralUndoStack.length > 0) {
        btn.disabled = false;
        btn.style.opacity = '1';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.4';
    }
}

// Snapshot helpers — call BEFORE mutating
function snapshotElementsForUndo(ids, actionType) {
    const snapshots = [];
    (ids || []).forEach(id => {
        const el = muralElements.find(e => String(e.id) === String(id));
        if (el) snapshots.push({ ...el });
    });
    if (snapshots.length > 0) {
        pushMuralUndo({ action: actionType, snapshots });
    }
}

async function muralUndo() {
    if (muralUndoStack.length === 0) return;
    const entry = muralUndoStack.pop();
    updateMuralUndoBtn();

    if (entry.action === 'delete') {
        // Re-create deleted element(s)
        const els = entry.snapshots || (entry.element ? [entry.element] : []);
        const canvas = document.getElementById('muralCanvas');
        els.forEach(snap => {
            muralElements.push(snap);
            if (canvas) canvas.appendChild(createMuralElementDOM(snap));
            if (snap.type === 'connector') {
                muralConnectors.push(snap);
            }
        });
        renderAllMuralConnectors();
        toast('Undo: restored deleted');
        hideMuralUndoToast();
    } else if (entry.action === 'move' || entry.action === 'resize' || entry.action === 'color' || entry.action === 'edit') {
        // Restore previous state for each element
        (entry.snapshots || []).forEach(snap => {
            const el = muralElements.find(e => String(e.id) === String(snap.id));
            if (!el) return;
            if (entry.action === 'move') {
                el.x = snap.x; el.y = snap.y;
            } else if (entry.action === 'resize') {
                el.x = snap.x; el.y = snap.y;
                el.w = snap.w; el.h = snap.h;
            } else if (entry.action === 'color') {
                el.color = snap.color;
            } else if (entry.action === 'edit') {
                el.content = snap.content;
            }
            // Update DOM
            const dom = document.getElementById(`mural-el-${el.id}`);
            if (dom) {
                dom.style.left = `${el.x}px`;
                dom.style.top = `${el.y}px`;
                if (el.w) dom.style.width = `${el.w}px`;
                if (el.h) dom.style.height = `${el.h}px`;
                if (entry.action === 'color') dom.style.backgroundColor = el.color;
                if (entry.action === 'edit') {
                    const contentEl = dom.querySelector('.mural-element-content');
                    if (contentEl) contentEl.innerText = el.content || '';
                }
            }
            updateConnectorsForElement(el.id);
        });
        updateSelectionBoundingBox();
        toast('Undo: ' + entry.action);
    } else if (entry.action === 'create') {
        // Remove the created element(s)
        (entry.snapshots || []).forEach(snap => {
            const idx = muralElements.findIndex(e => String(e.id) === String(snap.id));
            if (idx !== -1) muralElements.splice(idx, 1);
            const dom = document.getElementById(`mural-el-${snap.id}`);
            if (dom) dom.remove();
            // Also remove from connectors
            const ci = muralConnectors.findIndex(c => String(c.id) === String(snap.id));
            if (ci !== -1) muralConnectors.splice(ci, 1);
        });
        renderAllMuralConnectors();
        toast('Undo: removed created element');
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
            // Sync data in memory without re-rendering DOM (which destroys the button ref)
            try {
                const freshData = await apiGet('mural_elements');
                state.data.mural_elements = freshData || [];
                muralElements = (freshData || []).filter(el => String(el.project_id) === String(muralActiveProjectId));
            } catch(e) { /* non-critical refresh */ }
        } else {
            throw new Error(res.message);
        }
    } catch (err) {
        console.error('Manual sync failed:', err);
        toast('Sync failed — check connection');
        showSaveIndicator('error');
    } finally {
        // Re-query button from DOM (original ref may be stale)
        const saveBtn = document.getElementById('muralManualSaveBtn');
        if (saveBtn) {
            saveBtn.classList.remove('loading');
            saveBtn.innerHTML = 'Saved';
            setTimeout(() => {
                const b = document.getElementById('muralManualSaveBtn');
                if (b) b.innerHTML = 'Save';
            }, 2000);
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
    // If a connector is selected, re-route its endpoint to this anchor
    if (muralSelectedConnectorId) {
        const conn = muralConnectors.find(c => c.id === muralSelectedConnectorId);
        if (conn) {
            if (String(conn.from_id) === String(elementId)) {
                conn.from_side = side;
            } else if (String(conn.to_id) === String(elementId)) {
                conn.to_side = side;
            }
            renderSingleConnector(conn);
            showConnectorAnchors(conn);
        }
        return;
    }

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

    pushMuralUndo({ action: 'delete', snapshots: [{ ...conn }] });

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
/**
 * Pick the best anchor side (top/bottom/left/right) for connecting
 * fromEl to toEl, based on their relative positions.
 * Returns the side of fromEl that faces toEl most directly.
 */
function getBestAnchorSide(fromId, toId) {
    const fc = getElementCenter(fromId);
    const tc = getElementCenter(toId);
    if (!fc || !tc) return 'right';

    const dx = tc.x - fc.x;
    const dy = tc.y - fc.y;

    // Pick the axis with the larger gap
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'right' : 'left';
    } else {
        return dy >= 0 ? 'bottom' : 'top';
    }
}

function getConnectorPath(conn) {
    const fromCenter = getElementCenter(conn.from_id);
    const toCenter = getElementCenter(conn.to_id);
    if (!fromCenter || !toCenter) return null;

    // Always use clean anchor midpoints (like diagrams.net)
    const fromSide = conn.from_side || getBestAnchorSide(conn.from_id, conn.to_id);
    const toSide = conn.to_side || getBestAnchorSide(conn.to_id, conn.from_id);

    const fromPt = getElementAnchorPoint(conn.from_id, fromSide);
    const toPt = getElementAnchorPoint(conn.to_id, toSide);

    if (!fromPt || !toPt) return null;

    const fx = Number(fromPt.x), fy = Number(fromPt.y);
    const tx = Number(toPt.x), ty = Number(toPt.y);
    const style = conn.connector_style || 'bezier';

    if (style === 'straight') {
        return `M ${fx} ${fy} L ${tx} ${ty}`;
    }

    if (style === 'step') {
        // Smart step routing based on anchor sides
        return getStepPath(fx, fy, fromSide, tx, ty, toSide);
    }

    // Bezier — control points extend outward from the anchor side
    const dist = Math.hypot(tx - fx, ty - fy);
    const offset = Math.min(dist * 0.4, 150);

    const cp1 = getControlPointForSide(fx, fy, fromSide, offset);
    const cp2 = getControlPointForSide(tx, ty, toSide, offset);

    return `M ${fx} ${fy} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${tx} ${ty}`;
}

/**
 * Get a bezier control point that extends outward from the given side.
 */
function getControlPointForSide(x, y, side, offset) {
    switch (side) {
        case 'top':    return { x, y: y - offset };
        case 'bottom': return { x, y: y + offset };
        case 'left':   return { x: x - offset, y };
        case 'right':  return { x: x + offset, y };
        default:       return { x: x + offset, y };
    }
}

/**
 * Smart step/orthogonal routing that respects anchor sides.
 */
function getStepPath(fx, fy, fromSide, tx, ty, toSide) {
    const gap = 20; // minimum gap before first turn

    // Horizontal sides (left/right) → first segment is horizontal
    if ((fromSide === 'left' || fromSide === 'right') && (toSide === 'left' || toSide === 'right')) {
        const midX = (fx + tx) / 2;
        return `M ${fx} ${fy} L ${midX} ${fy} L ${midX} ${ty} L ${tx} ${ty}`;
    }
    // Vertical sides (top/bottom) → first segment is vertical
    if ((fromSide === 'top' || fromSide === 'bottom') && (toSide === 'top' || toSide === 'bottom')) {
        const midY = (fy + ty) / 2;
        return `M ${fx} ${fy} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
    }
    // Mixed: horizontal start → vertical end (or vice versa)
    if (fromSide === 'left' || fromSide === 'right') {
        return `M ${fx} ${fy} L ${tx} ${fy} L ${tx} ${ty}`;
    }
    return `M ${fx} ${fy} L ${fx} ${ty} L ${tx} ${ty}`;
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
        muralSelectedElementIds = [];
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
    path.style.transition = 'stroke 0.2s, stroke-width 0.2s';
    path.style.pointerEvents = 'none';

    // Line style: solid (default), dashed, dotted
    const lineStyle = conn.line_style || 'solid';
    if (lineStyle === 'dashed') {
        path.setAttribute('stroke-dasharray', '8 4');
    } else if (lineStyle === 'dotted') {
        path.setAttribute('stroke-dasharray', '2 4');
        path.setAttribute('stroke-linecap', 'round');
    }

    // Arrow mode: arrow (default end), both, none, dot
    const arrowMode = conn.arrow_mode || 'arrow';
    const sel = isSelected;
    if (arrowMode === 'arrow') {
        path.setAttribute('marker-end', sel ? 'url(#mural-arrowhead-selected)' : 'url(#mural-arrowhead)');
    } else if (arrowMode === 'both') {
        path.setAttribute('marker-start', sel ? 'url(#mural-arrowhead-start-selected)' : 'url(#mural-arrowhead-start)');
        path.setAttribute('marker-end', sel ? 'url(#mural-arrowhead-selected)' : 'url(#mural-arrowhead)');
    } else if (arrowMode === 'reverse') {
        path.setAttribute('marker-start', sel ? 'url(#mural-arrowhead-start-selected)' : 'url(#mural-arrowhead-start)');
    } else if (arrowMode === 'dot') {
        path.setAttribute('marker-start', sel ? 'url(#mural-dot-selected)' : 'url(#mural-dot)');
        path.setAttribute('marker-end', sel ? 'url(#mural-dot-selected)' : 'url(#mural-dot)');
    }
    // arrowMode === 'none' → no markers

    if (isSelected) {
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
    // Clear previous connector anchor highlights
    hideConnectorAnchors();
    if (connId) {
        const conn = muralConnectors.find(c => c.id === connId);
        if (conn) showConnectorAnchors(conn);
    }
}

function showConnectorAnchors(conn) {
    hideConnectorAnchors();
    [conn.from_id, conn.to_id].forEach(elId => {
        const dom = document.getElementById(`mural-el-${elId}`);
        if (dom) dom.classList.add('show-anchors');
    });
    // Highlight the currently connected sides
    const fromSide = conn.from_side || getBestAnchorSide(conn.from_id, conn.to_id);
    const toSide = conn.to_side || getBestAnchorSide(conn.to_id, conn.from_id);
    const fromDom = document.getElementById(`mural-el-${conn.from_id}`);
    const toDom = document.getElementById(`mural-el-${conn.to_id}`);
    if (fromDom) {
        const a = fromDom.querySelector(`.mural-anchor.${fromSide}`);
        if (a) a.classList.add('connected');
    }
    if (toDom) {
        const a = toDom.querySelector(`.mural-anchor.${toSide}`);
        if (a) a.classList.add('connected');
    }
}

function hideConnectorAnchors() {
    document.querySelectorAll('.mural-element.show-anchors').forEach(el => el.classList.remove('show-anchors'));
    document.querySelectorAll('.mural-anchor.connected').forEach(el => el.classList.remove('connected'));
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
    const currentLine = conn.line_style || 'solid';
    const currentArrow = conn.arrow_mode || 'arrow';

    menu.innerHTML = `
        <div class="mural-context-section-label">Route</div>
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
        <div class="mural-context-section-label">Line</div>
        <button class="mural-context-item ${currentLine === 'solid' ? 'active-style' : ''}" onclick="changeConnectorLine('${connId}', 'solid'); dismissMuralPopups();">
            <i data-lucide="minus"></i> Solid
        </button>
        <button class="mural-context-item ${currentLine === 'dashed' ? 'active-style' : ''}" onclick="changeConnectorLine('${connId}', 'dashed'); dismissMuralPopups();">
            <i data-lucide="grip-horizontal"></i> Dashed
        </button>
        <button class="mural-context-item ${currentLine === 'dotted' ? 'active-style' : ''}" onclick="changeConnectorLine('${connId}', 'dotted'); dismissMuralPopups();">
            <i data-lucide="more-horizontal"></i> Dotted
        </button>
        <div class="mural-context-divider"></div>
        <div class="mural-context-section-label">Arrows</div>
        <button class="mural-context-item ${currentArrow === 'arrow' ? 'active-style' : ''}" onclick="changeConnectorArrow('${connId}', 'arrow'); dismissMuralPopups();">
            <i data-lucide="arrow-right"></i> End Arrow
        </button>
        <button class="mural-context-item ${currentArrow === 'both' ? 'active-style' : ''}" onclick="changeConnectorArrow('${connId}', 'both'); dismissMuralPopups();">
            <i data-lucide="move-horizontal"></i> Both Arrows
        </button>
        <button class="mural-context-item ${currentArrow === 'reverse' ? 'active-style' : ''}" onclick="changeConnectorArrow('${connId}', 'reverse'); dismissMuralPopups();">
            <i data-lucide="arrow-left"></i> Start Arrow
        </button>
        <button class="mural-context-item ${currentArrow === 'none' ? 'active-style' : ''}" onclick="changeConnectorArrow('${connId}', 'none'); dismissMuralPopups();">
            <i data-lucide="minus"></i> No Arrows
        </button>
        <button class="mural-context-item ${currentArrow === 'dot' ? 'active-style' : ''}" onclick="changeConnectorArrow('${connId}', 'dot'); dismissMuralPopups();">
            <i data-lucide="circle-dot"></i> Dot Ends
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

async function changeConnectorLine(connId, lineStyle) {
    const conn = muralConnectors.find(c => c.id === connId);
    if (!conn) return;
    conn.line_style = lineStyle;
    renderSingleConnector(conn);
    saveMuralElement(conn);
}
window.changeConnectorLine = changeConnectorLine;

async function changeConnectorArrow(connId, arrowMode) {
    const conn = muralConnectors.find(c => c.id === connId);
    if (!conn) return;
    conn.arrow_mode = arrowMode;
    renderSingleConnector(conn);
    saveMuralElement(conn);
}
window.changeConnectorArrow = changeConnectorArrow;
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

function toggleMuralZoomMenu() {
    muralZoomExpanded = !muralZoomExpanded;
    const wrapper = document.getElementById('muralZoomWrapper');
    if (wrapper) {
        wrapper.classList.toggle('expanded', muralZoomExpanded);
    }
    if (window.lucide) lucide.createIcons();
}
