/* view-mural.js — Mural Infinite Canvas Tool */

/* ── State ── */
let muralElements = [];
let muralTransform = { x: 0, y: 0, scale: 1 };
let muralActiveTool = 'select';
let muralIsDragging = false;
let muralDragStart = { x: 0, y: 0 };
let muralSelectedElementId = null;
let muralPointerDown = false;
let muralInitialDist = null; // For pinch to zoom

/* ── Constants ── */
const MURAL_COLORS = ['#fff9c4', '#ffccbc', '#e1f5fe', '#e8f5e9', '#f3e5f5'];

/* ═══════════════════════════════
   ENTRY POINT
   ═══════════════════════════════ */
async function renderMural() {
    const main = document.getElementById('main');
    if (!main) return;

    main.innerHTML = `
        <div class="mural-page" id="muralPage">
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
    loadMuralData();
}

/* ═══════════════════════════════
   CANVAS CORE
   ═══════════════════════════════ */
function initMuralCanvas() {
    const canvas = document.getElementById('muralCanvas');
    const page = document.getElementById('muralPage');
    if (!canvas || !page) return;

    // Use PointerEvents for unified touch/mouse
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

/* ═══════════════════════════════
   DATA HANDLING
   ═══════════════════════════════ */
async function loadMuralData() {
    try {
        const res = await apiGet('mural_elements');
        muralElements = res || [];
        renderMuralElements();
    } catch (err) {
        console.error('Failed to load mural data:', err);
    }
}

function renderMuralElements() {
    const canvas = document.getElementById('muralCanvas');
    if (!canvas) return;

    canvas.innerHTML = '';
    muralElements.forEach(el => {
        const div = createMuralElementDOM(el);
        canvas.appendChild(div);
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
   INTERACTIONS
   ═══════════════════════════════ */
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
        // Dragging Element
        const el = muralElements.find(item => item.id === muralSelectedElementId);
        if (el) {
            el.x = e.clientX / muralTransform.scale - muralDragStart.x;
            el.y = e.clientY / muralTransform.scale - muralDragStart.y;
            const dom = document.getElementById(`mural-el-${el.id}`);
            if (dom) {
                dom.style.left = `${el.x}px`;
                dom.style.top = `${el.y}px`;
            }
        }
    } else {
        // Panning Canvas
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

function onMuralWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomMural(zoomFactor, e.clientX, e.clientY);
}

function zoomMural(factor, centerX, centerY) {
    const oldScale = muralTransform.scale;
    const newScale = Math.min(Math.max(oldScale * factor, 0.1), 5);

    if (!centerX) centerX = window.innerWidth / 2;
    if (!centerY) centerY = window.innerHeight / 2;

    // Adjust x, y so we zoom into the pointer position
    muralTransform.x = centerX - (centerX - muralTransform.x) * (newScale / oldScale);
    muralTransform.y = centerY - (centerY - muralTransform.y) * (newScale / oldScale);
    muralTransform.scale = newScale;

    applyMuralTransform();
}

function resetMuralView() {
    muralTransform = { x: 0, y: 0, scale: 1 };
    applyMuralTransform();
}

function setMuralTool(tool) {
    muralActiveTool = tool;
    document.querySelectorAll('.mural-tool').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tool}'`));
    });
}

/* ═══════════════════════════════
   ELEMENT ACTIONS
   ═══════════════════════════════ */
async function addMuralSticky() {
    const centerX = (window.innerWidth / 2 - muralTransform.x) / muralTransform.scale;
    const centerY = (window.innerHeight / 2 - muralTransform.y) / muralTransform.scale;

    const newEl = {
        type: 'sticky',
        x: centerX - 75,
        y: centerY - 75,
        w: 150,
        h: 150,
        content: 'New Note',
        color: MURAL_COLORS[Math.floor(Math.random() * MURAL_COLORS.length)],
        z_index: muralElements.length + 1
    };

    try {
        const res = await apiPost({ action: 'create', sheet: 'mural_elements', payload: newEl });
        if (res.success) {
            newEl.id = res.id;
            muralElements.push(newEl);
            const dom = createMuralElementDOM(newEl);
            document.getElementById('muralCanvas').appendChild(dom);
        }
    } catch (err) {
        console.error('Failed to create sticky:', err);
    }
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
    } catch (err) {
        console.error('Failed to delete element:', err);
    }
}

/* ═══════════════════════════════
   AUTO-SAVE
   ═══════════════════════════════ */
let muralSaveTimer = null;
function debounceMuralSave(id, data) {
    clearTimeout(muralSaveTimer);
    muralSaveTimer = setTimeout(() => {
        const el = muralElements.find(item => item.id === id);
        if (el) {
            Object.assign(el, data);
            saveMuralElement(el);
        }
    }, 1000);
}

async function saveMuralElement(el) {
    try {
        await apiPost({ action: 'update', sheet: 'mural_elements', id: el.id, payload: el });
    } catch (err) {
        console.error('Failed to save element:', err);
    }
}
