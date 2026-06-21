/* ============================================================================
   WISHLIST — flexible "things I want" list (Buy / Experience / Gift), organized
   by category. Lives in Daily Tools. No savings/Funds integration (by design).
   CRUD via apiCall(..., 'wishlist', ...); state.data.wishlist holds the rows.
   ============================================================================ */

const WL_DEFAULT_CATEGORIES = ['Tech', 'Travel', 'Home', 'Fashion', 'Health', 'Experiences', 'Gifts', 'Other'];
const WL_TYPES = {
    buy:        { label: 'Buy',        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' },
    experience: { label: 'Experience', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>' },
    gift:       { label: 'Gift',       icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>' }
};
const WL_PRIORITY = {
    high:   { label: 'High',   color: '#EF4444', rank: 3 },
    medium: { label: 'Medium', color: '#F59E0B', rank: 2 },
    low:    { label: 'Low',    color: '#10B981', rank: 1 }
};
const WL_CARD_COLORS = ['#6366F1', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6'];

let _wlType = 'all';        // all | buy | experience | gift
let _wlCat = 'all';         // all | <category>
let _wlStatus = 'wanted';   // wanted | got
let _wlSort = 'priority';   // priority | priceHigh | priceLow | recent | name
let _wlSearch = '';
let _wlGroup = true;        // group by category sections vs flat grid

function _wlAll() { return state.data.wishlist || []; }
function _wlCategories() {
    const used = _wlAll().map(i => i.category).filter(Boolean);
    return [...new Set([...WL_DEFAULT_CATEGORIES, ...used])];
}
function _wlColor(cat) {
    const s = String(cat || 'Other');
    const h = s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return WL_CARD_COLORS[h % WL_CARD_COLORS.length];
}
function _wlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const WISHLIST_CSS = `<style>
.wl-wrap { max-width:1200px; margin:0 auto; }
.wl-stats { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
.wl-stat { display:inline-flex; align-items:baseline; gap:6px; }
.wl-stat b { font-size:17px; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; }
.wl-stat span { font-size:12.5px; color:var(--text-3); }
.wl-stat-sep { width:1px; height:15px; background:var(--border-color); }
.wl-add { margin-left:auto; display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 16px; border:none; border-radius:9px; background:var(--primary); color:#fff; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; box-shadow:var(--shadow-xs); }
.wl-add:hover { filter:brightness(.97); }
.wl-add svg { width:15px; height:15px; }

.wl-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
.wl-chips { display:flex; gap:6px; overflow-x:auto; flex:1; min-width:0; scrollbar-width:none; }
.wl-chips::-webkit-scrollbar { display:none; }
.wl-chip { flex-shrink:0; padding:6px 13px; border-radius:22px; font-size:12.5px; font-weight:600; background:var(--surface-1); border:1.5px solid var(--border-color); color:var(--text-3); cursor:pointer; white-space:nowrap; }
.wl-chip.active { background:var(--primary); border-color:var(--primary); color:#fff; }
.wl-rightctl { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.wl-search { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:7px 11px; font:inherit; font-size:13px; color:var(--text-1); outline:none; min-width:130px; }
.wl-sel { background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:7px 10px; font:inherit; font-size:12.5px; color:var(--text-2); cursor:pointer; outline:none; }
.wl-iconbtn { width:34px; height:34px; border:1.5px solid var(--border-color); background:var(--surface-1); border-radius:10px; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wl-iconbtn.active { color:var(--primary); border-color:var(--primary); background:var(--primary-soft,rgba(79,70,229,.08)); }
.wl-statustabs { display:inline-flex; background:var(--surface-2); border:1px solid var(--border-color); border-radius:10px; padding:2px; }
.wl-statustabs button { border:none; background:transparent; font:inherit; font-size:12.5px; font-weight:600; color:var(--text-3); padding:5px 12px; border-radius:8px; cursor:pointer; }
.wl-statustabs button.active { background:var(--surface-1); color:var(--text-1); box-shadow:var(--shadow-xs); }

.wl-section { background:var(--surface-1); border:1px solid var(--border-color); border-radius:16px; margin-bottom:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03); }
.wl-section-head { display:flex; align-items:center; gap:9px; padding:11px 14px; border-bottom:1px solid var(--border-color); }
.wl-section-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.wl-section-name { flex:1; font-size:12.5px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.5px; }
.wl-section-count { font-size:12px; font-weight:600; color:var(--text-3); }

.wl-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; padding:14px; }
.wl-flatgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
.wl-card { position:relative; border:1px solid var(--border-color); border-radius:14px; background:var(--surface-1); overflow:hidden; cursor:pointer; box-shadow:var(--shadow-xs); transition:transform .14s ease, box-shadow .14s ease, border-color .14s ease; display:flex; flex-direction:column; }
.wl-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); border-color:var(--border-strong); }
.wl-card.is-got { opacity:.62; }
.wl-media { height:96px; display:flex; align-items:flex-start; justify-content:space-between; padding:8px; background-size:cover; background-position:center; position:relative; }
.wl-media-grad { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.18)); }
.wl-type-chip { position:relative; display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:999px; background:rgba(255,255,255,.92); color:#1A1F36; font-size:11px; font-weight:700; }
.wl-type-chip svg { width:12px; height:12px; }
.wl-body { padding:11px 12px 12px; flex:1; display:flex; flex-direction:column; gap:5px; }
.wl-title { font-size:14px; font-weight:700; color:var(--text-1); line-height:1.3; }
.wl-card.is-got .wl-title { text-decoration:line-through; }
.wl-row { display:flex; align-items:center; gap:8px; }
.wl-price { font-size:13px; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; }
.wl-prio { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; }
.wl-prio::before { content:''; width:7px; height:7px; border-radius:50%; background:currentColor; }
.wl-for { font-size:11.5px; color:var(--text-3); }
.wl-actions { display:flex; gap:5px; margin-top:auto; padding-top:8px; }
.wl-act { width:30px; height:30px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:8px; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.wl-act svg { width:15px; height:15px; }
.wl-act:hover { background:var(--surface-2); color:var(--text-1); }
.wl-act.got:hover { color:var(--success,#10B981); border-color:rgba(16,185,129,.4); background:rgba(16,185,129,.1); }
.wl-act.del:hover { color:#DC2626; border-color:rgba(220,38,38,.3); background:rgba(220,38,38,.06); }

.wl-empty { text-align:center; padding:50px 20px; color:var(--text-3); }
.wl-empty-t { font-size:17px; font-weight:700; color:var(--text-1); margin-bottom:6px; }
.wl-empty button { margin-top:14px; }

/* Add/edit form (inside #universalModal .modal-box) */
.wl-form-seg { display:flex; gap:6px; }
.wl-form-seg button { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px; border:1.5px solid var(--border-color); background:var(--surface-1); border-radius:9px; font:inherit; font-size:12.5px; font-weight:600; color:var(--text-3); cursor:pointer; }
.wl-form-seg button.on { border-color:var(--primary); color:var(--primary); background:var(--primary-soft,rgba(79,70,229,.08)); }
.wl-form-seg button svg { width:14px; height:14px; }
.wl-flabel { font-size:11.5px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; margin:12px 0 6px; }
.wl-finput { width:100%; box-sizing:border-box; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:10px; padding:10px 12px; font:inherit; font-size:14px; color:var(--text-1); outline:none; }
.wl-finput:focus { border-color:var(--primary); }
.wl-frow { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

@media (max-width:1099px){ .wl-wrap { max-width:none; } }
@media (max-width:560px){
  .wl-grid, .wl-flatgrid { grid-template-columns:1fr; }
  .wl-frow { grid-template-columns:1fr; }
}
</style>`;

function _wlFilteredSorted() {
    let items = _wlAll().filter(i => (i.status || 'wanted') !== 'archived');
    items = items.filter(i => (_wlStatus === 'got') ? (i.status === 'got') : ((i.status || 'wanted') === 'wanted'));
    if (_wlType !== 'all') items = items.filter(i => (i.type || 'buy') === _wlType);
    if (_wlCat !== 'all') items = items.filter(i => (i.category || 'Other') === _wlCat);
    if (_wlSearch) { const q = _wlSearch.toLowerCase(); items = items.filter(i => (i.title || '').toLowerCase().includes(q)); }
    const pr = i => (WL_PRIORITY[i.priority] ? WL_PRIORITY[i.priority].rank : 0);
    items.sort((a, b) => {
        switch (_wlSort) {
            case 'priceHigh': return (Number(b.price) || 0) - (Number(a.price) || 0);
            case 'priceLow':  return (Number(a.price) || 0) - (Number(b.price) || 0);
            case 'recent':    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
            case 'name':      return (a.title || '').localeCompare(b.title || '');
            default:          return pr(b) - pr(a); // priority
        }
    });
    return items;
}

function _wlCardHTML(i) {
    const type = WL_TYPES[i.type] || WL_TYPES.buy;
    const prio = WL_PRIORITY[i.priority];
    const color = _wlColor(i.category);
    const media = i.image_url
        ? `style="background-image:url('${_wlEsc(i.image_url)}')"`
        : `style="background:linear-gradient(135deg, ${color}, ${color}CC)"`;
    const got = i.status === 'got';
    return `
    <div class="wl-card ${got ? 'is-got' : ''}" onclick="editWishlistItem('${i.id}')">
        <div class="wl-media" ${media}>
            ${i.image_url ? '<div class="wl-media-grad"></div>' : ''}
            <span class="wl-type-chip">${type.icon}${type.label}</span>
        </div>
        <div class="wl-body">
            <div class="wl-title">${_wlEsc(i.title || 'Untitled')}</div>
            <div class="wl-row">
                ${i.price ? `<span class="wl-price">₹${Number(i.price).toLocaleString('en-IN')}</span>` : ''}
                ${prio ? `<span class="wl-prio" style="color:${prio.color}">${prio.label}</span>` : ''}
            </div>
            ${i.for_person ? `<div class="wl-for">For ${_wlEsc(i.for_person)}</div>` : ''}
            <div class="wl-actions" onclick="event.stopPropagation()">
                ${i.url ? `<a class="wl-act" href="${_wlEsc(i.url)}" target="_blank" rel="noopener" title="Open link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                <button class="wl-act got" onclick="markWishlistGot('${i.id}', ${got ? 'false' : 'true'})" title="${got ? 'Move back to wanted' : 'Got it'}">${got ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'}</button>
                <button class="wl-act" onclick="editWishlistItem('${i.id}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                <button class="wl-act del" onclick="deleteWishlistItem('${i.id}')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
        </div>
    </div>`;
}

function renderWishlist() {
    const all = _wlAll();
    const wanted = all.filter(i => (i.status || 'wanted') === 'wanted');
    const totalWanted = wanted.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const now = new Date();
    const gotThisMonth = all.filter(i => i.status === 'got' && i.got_at && new Date(i.got_at).getMonth() === now.getMonth() && new Date(i.got_at).getFullYear() === now.getFullYear()).length;

    const items = _wlFilteredSorted();
    const cats = _wlCategories();

    const typeChips = ['all', 'buy', 'experience', 'gift'].map(t =>
        `<button class="wl-chip ${_wlType === t ? 'active' : ''}" onclick="wlSetType('${t}')">${t === 'all' ? 'All types' : WL_TYPES[t].label}</button>`).join('');
    const catChips = ['all', ...cats].map(c =>
        `<button class="wl-chip ${_wlCat === c ? 'active' : ''}" onclick="wlSetCat('${_wlEsc(c)}')">${c === 'all' ? 'All categories' : _wlEsc(c)}</button>`).join('');

    let body;
    if (items.length === 0) {
        body = `<div class="wl-empty"><div class="wl-empty-t">${_wlStatus === 'got' ? 'Nothing checked off yet' : 'Your wishlist is empty'}</div><div>${_wlStatus === 'got' ? 'Items you mark "Got it" will show here.' : 'Add the things you want — to buy, to do, or to gift.'}</div>${_wlStatus !== 'got' ? '<button class="wl-add" style="margin:14px auto 0" onclick="openWishlistModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add item</button>' : ''}</div>`;
    } else if (_wlGroup && _wlCat === 'all') {
        const byCat = {};
        items.forEach(i => { const c = i.category || 'Other'; (byCat[c] = byCat[c] || []).push(i); });
        body = Object.keys(byCat).sort().map(c => `
            <div class="wl-section">
                <div class="wl-section-head"><span class="wl-section-dot" style="background:${_wlColor(c)}"></span><span class="wl-section-name">${_wlEsc(c)}</span><span class="wl-section-count">${byCat[c].length}</span></div>
                <div class="wl-grid">${byCat[c].map(_wlCardHTML).join('')}</div>
            </div>`).join('');
    } else {
        body = `<div class="wl-flatgrid">${items.map(_wlCardHTML).join('')}</div>`;
    }

    document.getElementById('main').innerHTML = `
        ${WISHLIST_CSS}
        <div class="wl-wrap">
            <div class="wl-stats">
                <div class="wl-stat"><b>${wanted.length}</b><span>${wanted.length === 1 ? 'item' : 'items'} wanted</span></div>
                ${totalWanted > 0 ? `<div class="wl-stat-sep"></div><div class="wl-stat"><b>₹${totalWanted.toLocaleString('en-IN')}</b><span>of stuff wanted</span></div>` : ''}
                ${gotThisMonth > 0 ? `<div class="wl-stat-sep"></div><div class="wl-stat"><b>${gotThisMonth}</b><span>got this month</span></div>` : ''}
                <button class="wl-add" onclick="openWishlistModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add item</button>
            </div>
            <div class="wl-controls">
                <div class="wl-chips">${typeChips}</div>
                <div class="wl-rightctl">
                    <div class="wl-statustabs"><button class="${_wlStatus === 'wanted' ? 'active' : ''}" onclick="wlSetStatus('wanted')">Wanted</button><button class="${_wlStatus === 'got' ? 'active' : ''}" onclick="wlSetStatus('got')">Got</button></div>
                    <input class="wl-search" placeholder="Search…" value="${_wlEsc(_wlSearch)}" oninput="_wlSearch=this.value; wlRerenderBody()">
                    <select class="wl-sel" onchange="_wlSort=this.value; renderWishlist()">
                        <option value="priority" ${_wlSort === 'priority' ? 'selected' : ''}>Priority</option>
                        <option value="priceHigh" ${_wlSort === 'priceHigh' ? 'selected' : ''}>Price: high→low</option>
                        <option value="priceLow" ${_wlSort === 'priceLow' ? 'selected' : ''}>Price: low→high</option>
                        <option value="recent" ${_wlSort === 'recent' ? 'selected' : ''}>Recently added</option>
                        <option value="name" ${_wlSort === 'name' ? 'selected' : ''}>Name</option>
                    </select>
                    <button class="wl-iconbtn ${_wlGroup ? 'active' : ''}" onclick="_wlGroup=!_wlGroup; renderWishlist()" title="Group by category">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="wl-chips" style="margin-bottom:14px">${catChips}</div>
            <div id="wlBody">${body}</div>
        </div>`;
}
window.renderWishlist = renderWishlist;

// Lightweight re-render of just the list body (used for search keystrokes).
window.wlRerenderBody = function () { renderWishlist(); const el = document.querySelector('.wl-search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
window.wlSetType = function (t) { _wlType = t; renderWishlist(); };
window.wlSetCat = function (c) { _wlCat = c; renderWishlist(); };
window.wlSetStatus = function (s) { _wlStatus = s; renderWishlist(); };

window.openWishlistModal = function (id) {
    const editing = id ? _wlAll().find(x => String(x.id) === String(id)) : null;
    const i = editing || { type: 'buy', priority: 'medium', status: 'wanted' };
    const cats = _wlCategories();
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    const typeBtn = (t) => `<button type="button" class="${(i.type || 'buy') === t ? 'on' : ''}" onclick="wlPickType(this,'${t}')">${WL_TYPES[t].icon}${WL_TYPES[t].label}</button>`;
    const prioBtn = (p) => `<button type="button" class="${(i.priority || 'medium') === p ? 'on' : ''}" onclick="wlPickPrio(this,'${p}')" style="${(i.priority || 'medium') === p ? `color:${WL_PRIORITY[p].color};border-color:${WL_PRIORITY[p].color}` : ''}">${WL_PRIORITY[p].label}</button>`;
    box.innerHTML = `
        <h3 style="margin:0 0 4px">${editing ? 'Edit item' : 'Add to wishlist'}</h3>
        <input type="hidden" id="wlfType" value="${i.type || 'buy'}">
        <input type="hidden" id="wlfPrio" value="${i.priority || 'medium'}">
        <div class="wl-flabel">Type</div>
        <div class="wl-form-seg" id="wlfTypeSeg">${typeBtn('buy')}${typeBtn('experience')}${typeBtn('gift')}</div>
        <div class="wl-flabel">What do you want?</div>
        <input class="wl-finput" id="wlfTitle" placeholder="e.g. Noise-cancelling headphones" value="${_wlEsc(i.title)}">
        <div class="wl-frow">
            <div><div class="wl-flabel">Category</div><input class="wl-finput" id="wlfCat" list="wlCatList" placeholder="Category" value="${_wlEsc(i.category || '')}"><datalist id="wlCatList">${cats.map(c => `<option value="${_wlEsc(c)}">`).join('')}</datalist></div>
            <div><div class="wl-flabel">Price (₹, optional)</div><input class="wl-finput" id="wlfPrice" type="number" placeholder="0" value="${i.price != null ? i.price : ''}"></div>
        </div>
        <div class="wl-flabel">Priority</div>
        <div class="wl-form-seg" id="wlfPrioSeg">${prioBtn('high')}${prioBtn('medium')}${prioBtn('low')}</div>
        <div class="wl-flabel">Link (optional)</div>
        <input class="wl-finput" id="wlfUrl" placeholder="https://…" value="${_wlEsc(i.url || '')}">
        <div class="wl-flabel">Image URL (optional)</div>
        <input class="wl-finput" id="wlfImg" placeholder="Paste an image link" value="${_wlEsc(i.image_url || '')}">
        <div class="wl-flabel">For (gift recipient, optional)</div>
        <input class="wl-finput" id="wlfFor" placeholder="Who's it for?" value="${_wlEsc(i.for_person || '')}">
        <div class="wl-flabel">Notes (optional)</div>
        <textarea class="wl-finput" id="wlfNotes" rows="2" style="resize:vertical">${_wlEsc(i.notes || '')}</textarea>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
            <button class="btn primary" onclick="saveWishlistItem('${editing ? id : ''}')">${editing ? 'Save' : 'Add'}</button>
        </div>`;
    modal.classList.remove('hidden');
    setTimeout(() => { const el = document.getElementById('wlfTitle'); if (el) el.focus(); }, 80);
};
window.editWishlistItem = function (id) { openWishlistModal(id); };
window.wlPickType = function (btn, t) { document.getElementById('wlfType').value = t; btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); btn.classList.add('on'); };
window.wlPickPrio = function (btn, p) {
    document.getElementById('wlfPrio').value = p;
    btn.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('on'); b.style.color = ''; b.style.borderColor = ''; });
    btn.classList.add('on'); btn.style.color = WL_PRIORITY[p].color; btn.style.borderColor = WL_PRIORITY[p].color;
};

window.saveWishlistItem = async function (id) {
    const title = (document.getElementById('wlfTitle').value || '').trim();
    if (!title) { if (typeof showToast === 'function') showToast('Give it a name'); return; }
    const payload = {
        title,
        type: document.getElementById('wlfType').value || 'buy',
        priority: document.getElementById('wlfPrio').value || 'medium',
        category: (document.getElementById('wlfCat').value || '').trim() || 'Other',
        price: document.getElementById('wlfPrice').value ? Number(document.getElementById('wlfPrice').value) : null,
        url: (document.getElementById('wlfUrl').value || '').trim(),
        image_url: (document.getElementById('wlfImg').value || '').trim(),
        for_person: (document.getElementById('wlfFor').value || '').trim(),
        notes: (document.getElementById('wlfNotes').value || '').trim()
    };
    document.getElementById('universalModal').classList.add('hidden');
    if (!state.data.wishlist) state.data.wishlist = [];
    if (id) {
        const it = state.data.wishlist.find(x => String(x.id) === String(id));
        if (it) Object.assign(it, payload);
        renderWishlist();
        try { await apiCall('update', 'wishlist', payload, id); } catch (e) { console.error('wishlist update', e); }
    } else {
        const newId = 'wl_' + Date.now() + Math.floor(Math.random() * 1000);
        const row = { id: newId, status: 'wanted', created_at: new Date().toISOString(), ...payload };
        state.data.wishlist.unshift(row);
        renderWishlist();
        try { await apiCall('create', 'wishlist', { id: newId, status: 'wanted', ...payload }); } catch (e) { console.error('wishlist create', e); }
    }
    if (typeof showToast === 'function') showToast(id ? 'Updated' : 'Added to wishlist');
};

window.markWishlistGot = async function (id, got) {
    const it = _wlAll().find(x => String(x.id) === String(id));
    if (!it) return;
    const isGot = (got === true || got === 'true');
    it.status = isGot ? 'got' : 'wanted';
    it.got_at = isGot ? new Date().toISOString() : null;
    renderWishlist();
    if (typeof showToast === 'function') showToast(isGot ? 'Nice — got it! 🎉' : 'Back on the list');
    try { await apiCall('update', 'wishlist', { status: it.status, got_at: it.got_at }, id); } catch (e) { console.error('wishlist got', e); }
};

window.deleteWishlistItem = async function (id) {
    if (!confirm('Remove this from your wishlist?')) return;
    state.data.wishlist = _wlAll().filter(x => String(x.id) !== String(id));
    renderWishlist();
    try { await apiCall('delete', 'wishlist', {}, id); } catch (e) { console.error('wishlist delete', e); }
};
