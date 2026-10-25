/* ============================================================================
   WARDROBE — every piece of clothing you own, a fitting room to try outfits on
   a figure with your face, and outfit planning for the day's events.

   Data (Supabase):
     wardrobe_items    one row per piece: name, type (top/bottom/shoes/layer/
                       accessory), category (Gym, Parties…), image (a small
                       background-removed WebP as a data URL), color, status
                       (clean/dirty), purchase_date, price, brand, size,
                       wear_count, last_worn, favorite, notes
     wardrobe_outfits  saved combinations (item_ids JSON)
     wardrobe_log      what you planned / wore on a date, optionally for one
                       planner event (date, event_id, event_title, item_ids, worn)
     wardrobe_profile  one row: your face photo, skin tone, measurements and
                       your list of categories (data = JSON)
   Images never leave the device until saved, and are shrunk to ~30 KB each.
   ============================================================================ */

const WD_TYPES = [
  { k: 'top', l: 'Top', pl: 'Tops' },
  { k: 'bottom', l: 'Bottom', pl: 'Bottoms' },
  { k: 'shoes', l: 'Shoes', pl: 'Shoes' },
  { k: 'layer', l: 'Layer', pl: 'Layers' },
  { k: 'accessory', l: 'Accessory', pl: 'Accessories' }
];
const WD_DEFAULT_CATS = ['Gym', 'Parties', 'Office', 'Casual', 'Traditional'];
const WD_SKINS = ['#f3d2b3', '#e8b991', '#d9a274', '#c68857', '#a86b40', '#7d4b2a', '#5a3520'];
const WD_TABLES = ['wardrobe_items', 'wardrobe_outfits', 'wardrobe_log', 'wardrobe_profile'];

const _wd = {
  loaded: false, loading: null,
  q: '', type: 'all', status: 'all',
  fit: { top: null, bottom: null, shoes: null, layer: null, acc: [] },
  fitFrom: 'all',          // shuffle source category
  sheetOpen: false,        // mobile fitting-room sheet
  draft: null,             // item / profile being edited
  picker: null             // journal picker context
};
let _wdSvgN = 0;

/* ── small helpers ── */
const _wdEsc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const _wdQ = s => _wdEsc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
const _wdId = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const _wdToday = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const _wdToast = (m, u) => { if (typeof showToast === 'function') showToast(m, 'default', u || null); };
const _wdJSON = (v, fb) => { try { const x = typeof v === 'string' ? JSON.parse(v || 'null') : v; return x == null ? fb : x; } catch (e) { return fb; } };
const _wdTypeL = k => (WD_TYPES.find(t => t.k === k) || { l: 'Item' }).l;
const _wdNum = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const _wdDays = d => { if (!d) return null; const a = new Date(String(d).slice(0, 10) + 'T00:00:00'); return Math.floor((Date.now() - a) / 864e5); };
const _wdFmtDate = d => { if (!d) return ''; const a = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(a) ? '' : a.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };

/* ── data ── */
function _wdItems() { return Array.isArray(state.data.wardrobe_items) ? state.data.wardrobe_items : (state.data.wardrobe_items = []); }
function _wdOutfits() { return Array.isArray(state.data.wardrobe_outfits) ? state.data.wardrobe_outfits : (state.data.wardrobe_outfits = []); }
function _wdLogs() { return Array.isArray(state.data.wardrobe_log) ? state.data.wardrobe_log : (state.data.wardrobe_log = []); }
function _wdItem(id) { return id == null ? null : _wdItems().find(i => String(i.id) === String(id)) || null; }
const _wdDirty = it => String(it && it.status || '').toLowerCase() === 'dirty';
const _wdFav = it => !!(it && (it.favorite === true || it.favorite === 'true' || it.favorite === 1));

async function _wdLoad(force) {
  if (_wd.loaded && !force) return;
  if (_wd.loading) return _wd.loading;
  _wd.loading = (async () => {
    const need = WD_TABLES.filter(t => force || !Array.isArray(state.data[t]));
    // Read straight from Supabase when we can, so a not-yet-created table fails quietly.
    const sb = window.supabase, user = window._currentUser;
    const get = async t => {
      if (sb && sb.from && user) { const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: true }); if (error) { console.warn('[wardrobe]', t, error.message); return []; } return data || []; }
      return typeof apiGet === 'function' ? apiGet(t) : apiCall('get', t);
    };
    const got = await Promise.all(need.map(t => get(t).catch(() => [])));
    need.forEach((t, i) => { state.data[t] = Array.isArray(got[i]) ? got[i] : []; });
    _wd.loaded = true; _wd.loading = null;
  })();
  return _wd.loading;
}
async function _wdCreate(table, row) {
  const list = state.data[table] || (state.data[table] = []);
  list.push(row);
  try {
    const r = await apiCall('create', table, { ...row });
    if (!r || r.success === false) throw new Error(r && r.message);
    return true;
  } catch (e) {
    console.error(table, e);
    _wdToast(/relation|does not exist|schema cache/i.test(String(e && e.message)) ? 'Run the wardrobe migration in Supabase so this can be saved' : 'Couldn’t save — check your connection');
    return false;
  }
}
async function _wdUpdate(table, id, fields) {
  const row = (state.data[table] || []).find(x => String(x.id) === String(id));
  if (row) Object.assign(row, fields);
  try { const r = await apiCall('update', table, fields, id); if (r && r.success === false) throw new Error(r.message); }
  catch (e) { console.error(table, e); _wdToast('Couldn’t save the change'); }
}
async function _wdDelete(table, id) {
  state.data[table] = (state.data[table] || []).filter(x => String(x.id) !== String(id));
  try { await apiCall('delete', table, {}, id); } catch (e) { console.error(e); }
}

/* ── profile (face, body, categories) ── */
function _wdProfileRow() { const r = state.data.wardrobe_profile; return Array.isArray(r) && r.length ? r[0] : null; }
function _wdProfile() {
  const p = _wdJSON(_wdProfileRow() && _wdProfileRow().data, {}) || {};
  return {
    face: p.face || '', faceZoom: p.faceZoom || 1, faceX: p.faceX || 0, faceY: p.faceY || 0,
    skin: p.skin || WD_SKINS[2],
    height: _wdNum(p.height) || 175, chest: _wdNum(p.chest) || 96, waist: _wdNum(p.waist) || 84, hips: _wdNum(p.hips) || 96,
    categories: Array.isArray(p.categories) && p.categories.length ? p.categories : WD_DEFAULT_CATS.slice()
  };
}
async function _wdSaveProfile(p) {
  const data = JSON.stringify(p);
  const row = _wdProfileRow();
  if (row) await _wdUpdate('wardrobe_profile', row.id, { data });
  else await _wdCreate('wardrobe_profile', { id: _wdId('wp'), data });
}
function _wdCategories() {
  const cats = _wdProfile().categories.slice();
  _wdItems().forEach(i => { const c = (i.category || '').trim(); if (c && !cats.includes(c)) cats.push(c); });
  return cats;
}

/* ══ IMAGE PIPELINE ═══════════════════════════════════════════════════════
   Photo → downscaled → (optional) plain background removed by flood-filling
   from the edges → trimmed to the garment → WebP data URL (~20–40 KB).
   Works best on a photo of the item laid flat or hung on a plain wall/bed. */
async function _wdBitmap(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { } }
  return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
}
function _wdCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
async function _wdProcessImage(src, removeBg, max = 560) {
  const bmp = src instanceof Blob ? await _wdBitmap(src) : src;
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
  const c = _wdCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  // average colour of the garment (centre area) for the fallback drawing
  let cr = 0, cg = 0, cb = 0, cn = 0;
  for (let yy = Math.floor(h * .3); yy < h * .7; yy += 3) for (let xx = Math.floor(w * .3); xx < w * .7; xx += 3) { const i = (yy * w + xx) * 4; cr += d[i]; cg += d[i + 1]; cb += d[i + 2]; cn++; }
  let color = cn ? '#' + [cr, cg, cb].map(v => Math.round(v / cn).toString(16).padStart(2, '0')).join('') : '';
  let bgOk = false;
  if (removeBg) {
    // background colour = median of the border pixels
    const border = [];
    for (let xx = 0; xx < w; xx += 2) { border.push(xx, 0); border.push(xx, h - 1); }
    for (let yy = 0; yy < h; yy += 2) { border.push(0, yy); border.push(w - 1, yy); }
    const rs = [], gs = [], bs = [];
    for (let k = 0; k < border.length; k += 2) { const i = (border[k + 1] * w + border[k]) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
    const med = a => a.sort((p, q) => p - q)[a.length >> 1];
    const br = med(rs), bgc = med(gs), bb = med(bs);
    // how uniform is the border? a busy background can't be removed safely
    let close = 0;
    for (let k = 0; k < rs.length; k++) if (Math.abs(rs[k] - br) + Math.abs(gs[k] - bgc) + Math.abs(bs[k] - bb) < 70) close++;
    if (close / rs.length > 0.55) {
      bgOk = true;
      const tol = 58, seen = new Uint8Array(w * h), stack = [];
      const dist = i => Math.abs(d[i] - br) + Math.abs(d[i + 1] - bgc) + Math.abs(d[i + 2] - bb);
      for (let xx = 0; xx < w; xx++) { stack.push(xx, 0, xx, h - 1); }
      for (let yy = 0; yy < h; yy++) { stack.push(0, yy, w - 1, yy); }
      while (stack.length) {
        const yy = stack.pop(), xx = stack.pop();
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const p = yy * w + xx; if (seen[p]) continue; seen[p] = 1;
        const i = p * 4, dd = dist(i);
        if (dd > tol) continue;
        d[i + 3] = dd < tol * .6 ? 0 : Math.round(255 * (dd - tol * .6) / (tol * .4));
        stack.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
      }
      x.putImageData(img, 0, 0);
      // re-average the colour using only kept pixels
      cr = cg = cb = cn = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { cr += d[i]; cg += d[i + 1]; cb += d[i + 2]; cn++; }
      if (cn) color = '#' + [cr, cg, cb].map(v => Math.round(v / cn).toString(16).padStart(2, '0')).join('');
    }
  }
  // trim transparent margins so the garment fills its spot on the figure
  let out = c;
  if (bgOk) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    if (x1 > x0 && y1 > y0 && (x1 - x0) * (y1 - y0) > w * h * 0.04) {
      out = _wdCanvas(x1 - x0 + 1, y1 - y0 + 1);
      out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    } else bgOk = false;
  }
  let url = out.toDataURL('image/webp', 0.82);
  if (!url.startsWith('data:image/webp')) url = out.toDataURL(bgOk ? 'image/png' : 'image/jpeg', 0.85);
  return { url, color, bgRemoved: bgOk };
}
async function _wdProcessFace(file) {
  const bmp = await _wdBitmap(file);
  const sc = Math.min(1, 520 / Math.max(bmp.width, bmp.height));
  const c = _wdCanvas(Math.round(bmp.width * sc), Math.round(bmp.height * sc));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/* ══ THE FIGURE ═══════════════════════════════════════════════════════════
   An SVG mannequin shaped by your measurements with your face on top.
   Clothes are your own photos layered on the body; an item without a photo
   is drawn as a simple garment in its colour. */
function _wdBody(p) {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const sh = cl(p.chest / 96 * 33, 25, 46), wa = cl(p.waist / 84 * 23, 15, 40), hi = cl(p.hips / 96 * 27, 19, 42);
  const leg = cl(178 + (p.height - 175) * 0.7, 150, 210);
  const cx = 100, yS = 86, yW = 186, yH = 224, yK = yH + leg * 0.5, yF = yH + leg;
  return { cx, sh, wa, hi, leg, yS, yW, yH, yK, yF, H: yF + 22 };
}
function _wdFigureSVG(fit, opts = {}) {
  const p = opts.profile || _wdProfile();
  const b = _wdBody(p);
  const n = ++_wdSvgN, cx = b.cx;
  const skin = p.skin, base = 'var(--wd-base, #dfe3ea)', line = 'rgba(15,23,42,.18)';
  const it = k => (k === 'acc' ? null : _wdItem(fit[k]));
  const top = it('top'), bottom = it('bottom'), shoes = it('shoes'), layer = it('layer');
  const acc = (fit.acc || []).map(_wdItem).filter(Boolean);
  // body pieces
  const torso = `M${cx - b.sh},${b.yS} C${cx - b.sh - 2},${b.yS + 40} ${cx - b.wa - 2},${b.yW - 30} ${cx - b.wa},${b.yW} L${cx - b.hi},${b.yH} L${cx + b.hi},${b.yH} L${cx + b.wa},${b.yW} C${cx + b.wa + 2},${b.yW - 30} ${cx + b.sh + 2},${b.yS + 40} ${cx + b.sh},${b.yS} Q${cx},${b.yS - 12} ${cx - b.sh},${b.yS}Z`;
  const armL = `M${cx - b.sh + 2},${b.yS + 2} Q${cx - b.sh - 14},${b.yS + 50} ${cx - b.sh - 16},${b.yH + 12}`;
  const armR = `M${cx + b.sh - 2},${b.yS + 2} Q${cx + b.sh + 14},${b.yS + 50} ${cx + b.sh + 16},${b.yH + 12}`;
  const legW = Math.max(14, b.hi * 0.62);
  const legL = `M${cx - b.hi + 2},${b.yH - 4} L${cx - b.hi + 6},${b.yK} L${cx - legW * 0.55 - 4},${b.yF} L${cx - 4},${b.yF} L${cx - 2},${b.yK} L${cx},${b.yH}Z`;
  const legR = `M${cx + b.hi - 2},${b.yH - 4} L${cx + b.hi - 6},${b.yK} L${cx + legW * 0.55 + 4},${b.yF} L${cx + 4},${b.yF} L${cx + 2},${b.yK} L${cx},${b.yH}Z`;
  const body = `<g class="wdf-body">
    <path d="${armL}" stroke="${skin}" stroke-width="13" stroke-linecap="round" fill="none"/>
    <path d="${armR}" stroke="${skin}" stroke-width="13" stroke-linecap="round" fill="none"/>
    <circle cx="${cx - b.sh - 16}" cy="${b.yH + 16}" r="7.5" fill="${skin}"/><circle cx="${cx + b.sh + 16}" cy="${b.yH + 16}" r="7.5" fill="${skin}"/>
    <path d="${legL}" fill="${base}" stroke="${line}"/><path d="${legR}" fill="${base}" stroke="${line}"/>
    <path d="${torso}" fill="${base}" stroke="${line}"/>
    <rect x="${cx - 9}" y="66" width="18" height="${b.yS - 62}" rx="6" fill="${skin}"/>
  </g>`;
  // garments
  const pic = (item, x, y, w, h, align) => `<image href="${item.image}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${align} meet"/>`;
  const col = item => (item && item.color) || '#64748b';
  const topShape = (item, grow = 0) => {
    const s = b.sh + 4 + grow, w2 = b.wa + 5 + grow, hp = b.hi + 4 + grow, y = b.yS - 3 - grow, yb = b.yH + 10 + grow * 2;
    return `<path d="M${cx - s},${y} L${cx - s - 20},${y + 62} L${cx - s - 7},${y + 68} L${cx - w2 - 2},${y + 44} L${cx - hp},${yb} L${cx + hp},${yb} L${cx + w2 + 2},${y + 44} L${cx + s + 7},${y + 68} L${cx + s + 20},${y + 62} L${cx + s},${y} Q${cx},${y + 14} ${cx - s},${y}Z" fill="${col(item)}" stroke="rgba(0,0,0,.18)"/>`;
  };
  const bottomShape = item => `<path d="M${cx - b.hi - 3},${b.yH - 10} L${cx + b.hi + 3},${b.yH - 10} L${cx + b.hi + 1},${b.yK} L${cx + legW * 0.55 + 6},${b.yF - 4} L${cx + 3},${b.yF - 4} L${cx},${b.yH + 14} L${cx - 3},${b.yF - 4} L${cx - legW * 0.55 - 6},${b.yF - 4} L${cx - b.hi - 1},${b.yK}Z" fill="${col(item)}" stroke="rgba(0,0,0,.18)"/>`;
  const shoeShape = item => `<ellipse cx="${cx - legW * 0.35 - 4}" cy="${b.yF + 4}" rx="${legW * 0.55 + 3}" ry="7" fill="${col(item)}"/><ellipse cx="${cx + legW * 0.35 + 4}" cy="${b.yF + 4}" rx="${legW * 0.55 + 3}" ry="7" fill="${col(item)}"/>`;
  let wear = '';
  if (bottom) wear += bottom.image ? pic(bottom, cx - b.hi - 10, b.yH - 14, (b.hi + 10) * 2, b.leg + 18, 'xMidYMin') : bottomShape(bottom);
  if (shoes) wear += shoes.image ? pic(shoes, cx - b.hi - 18, b.yF - 18, (b.hi + 18) * 2, 34, 'xMidYMax') : shoeShape(shoes);
  if (top) wear += top.image ? pic(top, cx - b.sh - 26, b.yS - 14, (b.sh + 26) * 2, b.yH - b.yS + 34, 'xMidYMin') : topShape(top);
  if (layer) wear += layer.image ? pic(layer, cx - b.sh - 32, b.yS - 18, (b.sh + 32) * 2, b.yH - b.yS + 50, 'xMidYMin') : topShape(layer, 5);
  // head + face
  const fz = p.faceZoom || 1;
  const head = p.face
    ? `<clipPath id="wdfc${n}"><ellipse cx="${cx}" cy="40" rx="25" ry="29"/></clipPath>
       <ellipse cx="${cx}" cy="40" rx="26.5" ry="30.5" fill="${skin}"/>
       <g clip-path="url(#wdfc${n})"><image href="${p.face}" x="${cx - 32 * fz + (p.faceX || 0)}" y="${40 - 34 * fz + (p.faceY || 0)}" width="${64 * fz}" height="${68 * fz}" preserveAspectRatio="xMidYMid slice"/></g>`
    : `<ellipse cx="${cx}" cy="40" rx="25" ry="29" fill="${skin}"/><text x="${cx}" y="44" text-anchor="middle" font-size="9" font-weight="700" fill="rgba(0,0,0,.45)">Add face</text>`;
  const accHTML = acc.slice(0, 5).map((a, i) => {
    const y = b.yS - 6 + i * 40;
    return `<g><circle cx="182" cy="${y + 16}" r="17" fill="var(--surface-1,#fff)" stroke="rgba(0,0,0,.12)"/>${a.image ? `<clipPath id="wdfa${n}_${i}"><circle cx="182" cy="${y + 16}" r="15"/></clipPath><image href="${a.image}" x="167" y="${y + 1}" width="30" height="30" clip-path="url(#wdfa${n}_${i})" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="182" cy="${y + 16}" r="9" fill="${col(a)}"/>`}</g>`;
  }).join('');
  return `<svg class="wdf" viewBox="0 0 200 ${b.H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Outfit preview">
    <ellipse cx="${cx}" cy="${b.yF + 10}" rx="${b.hi + 22}" ry="6" fill="rgba(15,23,42,.08)"/>
    ${body}${wear}${head}${accHTML}
  </svg>`;
}

/* ══ RENDER ═══════════════════════════════════════════════════════════════ */
function _wdFiltered(list) {
  const q = _wd.q.trim().toLowerCase();
  return list.filter(i => {
    if (_wd.type !== 'all' && i.type !== _wd.type) return false;
    if (_wd.status === 'clean' && _wdDirty(i)) return false;
    if (_wd.status === 'dirty' && !_wdDirty(i)) return false;
    if (_wd.status === 'fav' && !_wdFav(i)) return false;
    if (_wd.status === 'unworn') { const d = _wdDays(i.last_worn || i.purchase_date || i.created_at); if (d != null && d < 60) return false; }
    if (q && ![i.name, i.category, i.brand, i.notes, _wdTypeL(i.type)].some(v => v && String(v).toLowerCase().includes(q))) return false;
    return true;
  });
}
function _wdInFit(id) { const f = _wd.fit; return [f.top, f.bottom, f.shoes, f.layer].some(x => String(x) === String(id)) || (f.acc || []).some(x => String(x) === String(id)); }
function _wdCard(i) {
  const dirty = _wdDirty(i), on = _wdInFit(i.id);
  const worn = Number(i.wear_count) || 0;
  return `<div class="wd-card${on ? ' on' : ''}${dirty ? ' dirty' : ''}" role="button" tabindex="0" onclick="wdTryOn('${_wdQ(i.id)}')" onkeydown="if(event.key==='Enter')wdTryOn('${_wdQ(i.id)}')" title="${on ? 'Remove from the fitting room' : 'Try it on'}">
    <div class="wd-card-img"${i.image ? '' : ` style="--ic:${_wdEsc(i.color || '#94a3b8')}"`}>${i.image ? `<img src="${i.image}" alt="" loading="lazy" draggable="false">` : `<span class="wd-noimg">${_wdEsc(_wdTypeL(i.type))}</span>`}
      ${_wdFav(i) ? '<span class="wd-fav">★</span>' : ''}
      <button type="button" class="wd-edit" onclick="event.stopPropagation();wdEditItem('${_wdQ(i.id)}')" title="Edit" aria-label="Edit ${_wdEsc(i.name || 'item')}"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
      ${on ? '<span class="wd-on">Trying on</span>' : ''}
    </div>
    <div class="wd-card-b">
      <div class="wd-card-t">${_wdEsc(i.name || _wdTypeL(i.type))}</div>
      <div class="wd-card-m"><span>${_wdEsc(_wdTypeL(i.type))}${worn ? ` · ${worn}×` : ''}</span>
        <button type="button" class="wd-st ${dirty ? 'dirty' : 'clean'}" onclick="event.stopPropagation();wdToggleClean('${_wdQ(i.id)}')" title="${dirty ? 'Dirty — tap when washed' : 'Clean — tap after wearing'}">${dirty ? 'Dirty' : 'Clean'}</button></div>
    </div>
  </div>`;
}
function _wdCatSection(cat, items) {
  const all = _wdItems().filter(i => (i.category || 'Uncategorised') === cat);
  const dirty = all.filter(_wdDirty).length;
  return `<section class="wd-cat" data-cat="${_wdEsc(cat)}">
    <header class="wd-cat-h">
      <h3>${_wdEsc(cat)}</h3><span class="wd-cat-n">${all.length}${dirty ? ` · <b>${dirty} dirty</b>` : ''}</span>
      <div class="wd-cat-a">
        <button type="button" class="wd-ib" onclick="wdScrollCat(this,-1)" aria-label="Scroll left"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
        <button type="button" class="wd-ib" onclick="wdScrollCat(this,1)" aria-label="Scroll right"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
        <button type="button" class="wd-ib" onclick="wdCatMenu('${_wdQ(cat)}')" aria-label="Category options"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
      </div>
    </header>
    <div class="wd-strip">${items.map(_wdCard).join('')}
      <button type="button" class="wd-add-card" onclick="wdAddItems('${_wdQ(cat)}')"><span>+</span>Add to ${_wdEsc(cat)}</button>
    </div>
  </section>`;
}
function _wdFitSlots() {
  const row = (k, label) => {
    const it = _wdItem(_wd.fit[k]);
    return `<div class="wd-slot${it ? ' set' : ''}"><span class="wd-slot-l">${label}</span>
      ${it ? `<span class="wd-slot-i">${it.image ? `<img src="${it.image}" alt="">` : `<i style="background:${_wdEsc(it.color || '#94a3b8')}"></i>`}<b>${_wdEsc(it.name || label)}</b>${_wdDirty(it) ? '<em>dirty</em>' : ''}</span>
        <button type="button" class="wd-x" onclick="wdFitClear('${k}')" aria-label="Remove">×</button>` : `<span class="wd-slot-e">Tap ${k === 'shoes' ? 'shoes' : 'a ' + label.toLowerCase()} to try ${k === 'shoes' ? 'them' : 'it'} on</span>`}</div>`;
  };
  const acc = (_wd.fit.acc || []).map(_wdItem).filter(Boolean);
  return row('top', 'Top') + row('layer', 'Layer') + row('bottom', 'Bottom') + row('shoes', 'Shoes') +
    `<div class="wd-slot${acc.length ? ' set' : ''}"><span class="wd-slot-l">Extras</span>${acc.length ? `<span class="wd-slot-acc">${acc.map(a => `<button type="button" onclick="wdTryOn('${_wdQ(a.id)}')" title="Remove ${_wdEsc(a.name)}">${a.image ? `<img src="${a.image}" alt="">` : `<i style="background:${_wdEsc(a.color || '#94a3b8')}"></i>`}</button>`).join('')}</span>` : '<span class="wd-slot-e">Watch, cap, belt…</span>'}</div>`;
}
function _wdFitHTML(mode) {
  const ids = _wdFitIds();
  const outfits = _wdOutfits();
  const cats = _wdCategories();
  return `<div class="wd-fit">
    <div class="wd-fit-h"><b>Fitting room</b>
      <button type="button" class="wd-ib" onclick="wdOpenProfile()" title="Your face & body" aria-label="Your face & body"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></button></div>
    <div class="wd-fig">${_wdFigureSVG(_wd.fit)}</div>
    <div class="wd-slots">${_wdFitSlots()}</div>
    <div class="wd-fit-acts">
      <div class="wd-shuffle"><button type="button" class="wd-btn" onclick="wdShuffle()" title="Random clean outfit"><svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>Shuffle</button>
        <select onchange="_wd.fitFrom=this.value" aria-label="Shuffle from"><option value="all">from all</option>${cats.map(c => `<option ${_wd.fitFrom === c ? 'selected' : ''}>${_wdEsc(c)}</option>`).join('')}</select></div>
      ${mode === 'picker'
      ? `<button type="button" class="wd-btn primary" onclick="wdPickerSave()" ${ids.length ? '' : 'disabled'}>Use this outfit</button>`
      : `<button type="button" class="wd-btn" onclick="wdSaveOutfit()" ${ids.length ? '' : 'disabled'}>Save outfit</button>
         <button type="button" class="wd-btn primary" onclick="wdWearToday()" ${ids.length ? '' : 'disabled'}>Wear today</button>`}
      ${ids.length ? `<button type="button" class="wd-link" onclick="wdFitReset()">Clear</button>` : ''}
    </div>
    ${outfits.length ? `<div class="wd-outfits"><div class="wd-sub">Saved outfits</div><div class="wd-ostrip">${outfits.map(o => {
      const its = _wdJSON(o.item_ids, []).map(_wdItem).filter(Boolean);
      return `<div class="wd-oc"><button type="button" class="wd-oc-b" onclick="wdLoadOutfit('${_wdQ(o.id)}')" title="Try on ${_wdEsc(o.name || 'outfit')}"><span class="wd-oc-im">${its.slice(0, 4).map(i => i.image ? `<img src="${i.image}" alt="">` : `<i style="background:${_wdEsc(i.color || '#94a3b8')}"></i>`).join('')}</span><span class="wd-oc-t">${_wdEsc(o.name || 'Outfit')}</span></button>
        <button type="button" class="wd-oc-x" onclick="wdDeleteOutfit('${_wdQ(o.id)}')" aria-label="Delete outfit">×</button></div>`;
    }).join('')}</div></div>` : ''}
  </div>`;
}
function _wdStats() {
  const all = _wdItems(), dirty = all.filter(_wdDirty).length;
  const worth = all.reduce((s, i) => s + (_wdNum(i.price) || 0), 0);
  return { n: all.length, dirty, clean: all.length - dirty, worth };
}
window.renderWardrobe = async function () {
  const main = document.getElementById('main'); if (!main) return;
  _wdInjectCSS();
  if (!_wd.loaded) {
    main.innerHTML = `<div class="wd-wrap"><div class="wd-loading">Opening your wardrobe…</div></div>`;
    await _wdLoad();
    if (state.view !== 'wardrobe') return;
  }
  const st = _wdStats();
  const cats = _wdCategories();
  const filtered = _wdFiltered(_wdItems());
  const byCat = {};
  filtered.forEach(i => { const c = (i.category || '').trim() || 'Uncategorised'; (byCat[c] = byCat[c] || []).push(i); });
  const order = cats.concat(byCat.Uncategorised ? ['Uncategorised'] : []);
  const anyFilter = _wd.q || _wd.type !== 'all' || _wd.status !== 'all';
  const sections = order.filter(c => byCat[c] || !anyFilter).map(c => _wdCatSection(c, (byCat[c] || []).sort((a, b) => (_wdDirty(a) - _wdDirty(b)) || (_wdFav(b) - _wdFav(a)) || String(a.name || '').localeCompare(String(b.name || ''))))).join('');
  const chips = (key, list) => list.map(([k, l]) => `<button type="button" class="wd-chip${_wd[key] === k ? ' on' : ''}" onclick="wdFilter('${key}','${k}')">${l}</button>`).join('');
  const empty = !st.n ? `<div class="wd-empty">
      <div class="wd-empty-ic"><svg viewBox="0 0 24 24"><path d="M20.4 18.6 13 14.5V13a3 3 0 1 0-3-3"/><path d="M3.6 18.6 12 14l8.4 4.6a1 1 0 0 1-.5 1.9H4.1a1 1 0 0 1-.5-1.9z"/></svg></div>
      <h3>Build your wardrobe</h3>
      <p>Photograph each piece laid flat or hung on a plain wall — the background is removed for you. Add many at once, then set each one's type and category.</p>
      <div class="wd-empty-acts"><button type="button" class="wd-btn primary" onclick="wdAddItems()">Add clothes</button><button type="button" class="wd-btn" onclick="wdOpenProfile()">Add your face & size</button></div>
    </div>` : '';
  main.innerHTML = `<div class="wd-wrap">
    <div class="wd-main">
      <header class="wd-head">
        <div><h1>Wardrobe</h1><p>${st.n} item${st.n === 1 ? '' : 's'} · ${st.clean} clean${st.dirty ? ` · <b class="wd-dirty-n">${st.dirty} in the laundry</b>` : ''}${st.worth ? ` · worth ₹${Math.round(st.worth).toLocaleString('en-IN')}` : ''}</p></div>
        <div class="wd-head-a">
          ${st.dirty ? `<button type="button" class="wd-btn" onclick="wdLaundryDone()" title="Mark everything clean">Laundry done</button>` : ''}
          <button type="button" class="wd-btn" onclick="wdNewCategory()">New category</button>
          <button type="button" class="wd-btn primary" onclick="wdAddItems()">+ Add clothes</button>
        </div>
      </header>
      ${st.n ? `<div class="wd-tools">
        <label class="wd-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="wdQ" type="search" placeholder="Search clothes" value="${_wdEsc(_wd.q)}" oninput="wdSearch(this.value)"></label>
        <div class="wd-chips">${chips('type', [['all', 'All'], ...WD_TYPES.map(t => [t.k, t.pl])])}</div>
        <div class="wd-chips">${chips('status', [['all', 'Any'], ['clean', 'Clean'], ['dirty', 'Dirty'], ['fav', '★ Favourites'], ['unworn', 'Not worn in 60 days']])}</div>
      </div>` : ''}
      ${empty}
      ${st.n ? (sections || '<div class="wd-none">Nothing matches these filters.</div>') : ''}
    </div>
    <aside class="wd-side${_wd.sheetOpen ? ' open' : ''}">${_wdFitHTML()}</aside>
    <button type="button" class="wd-fab" onclick="wdToggleSheet()">${_wd.sheetOpen ? 'Close fitting room' : `Fitting room${_wdFitIds().length ? ` · ${_wdFitIds().length}` : ''}`}</button>
  </div>`;
};
function _wdRefresh() {
  if (_wd.picker && document.getElementById('wdPicker')) return _wdPickerRender();
  if (state.view === 'wardrobe') renderWardrobe();
}
function _wdFitOnly() {
  const host = document.querySelector('#wdPicker .wd-fit-host') || document.querySelector('.wd-side');
  if (!host) return _wdRefresh();
  host.innerHTML = _wdFitHTML(_wd.picker ? 'picker' : '');
  document.querySelectorAll('.wd-card').forEach(c => {
    const m = /wdTryOn\('([^']*)'\)/.exec(c.getAttribute('onclick') || '');
    if (m) { const on = _wdInFit(m[1].replace(/\\'/g, "'")); c.classList.toggle('on', on); const tag = c.querySelector('.wd-on'); if (on && !tag) c.querySelector('.wd-card-img').insertAdjacentHTML('beforeend', '<span class="wd-on">Trying on</span>'); if (!on && tag) tag.remove(); }
  });
  const fab = document.querySelector('.wd-fab'); if (fab && !_wd.sheetOpen) fab.textContent = `Fitting room${_wdFitIds().length ? ` · ${_wdFitIds().length}` : ''}`;
}

/* ══ ACTIONS ══════════════════════════════════════════════════════════════ */
window.wdFilter = function (key, v) { _wd[key] = v; _wdRefresh(); };
let _wdQT = null;
window.wdSearch = function (v) {
  _wd.q = v; clearTimeout(_wdQT);
  _wdQT = setTimeout(() => { _wdRefresh(); const el = document.getElementById('wdQ'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 200);
};
window.wdScrollCat = function (btn, dir) { const s = btn.closest('.wd-cat').querySelector('.wd-strip'); s.scrollBy({ left: dir * Math.max(200, s.clientWidth * 0.8), behavior: 'smooth' }); };
window.wdToggleSheet = function () { _wd.sheetOpen = !_wd.sheetOpen; _wdRefresh(); };
function _wdFitIds() { const f = _wd.fit; return [f.top, f.layer, f.bottom, f.shoes, ...(f.acc || [])].filter(Boolean).map(String); }
window.wdTryOn = function (id) {
  const it = _wdItem(id); if (!it) return;
  const f = _wd.fit, k = it.type === 'accessory' ? 'acc' : (['top', 'bottom', 'shoes', 'layer'].includes(it.type) ? it.type : 'top');
  if (k === 'acc') { const i = f.acc.findIndex(x => String(x) === String(id)); if (i >= 0) f.acc.splice(i, 1); else f.acc.push(it.id); }
  else f[k] = String(f[k]) === String(id) ? null : it.id;
  _wdFitOnly();
};
window.wdFitClear = function (k) { _wd.fit[k] = null; _wdFitOnly(); };
window.wdFitReset = function () { _wd.fit = { top: null, bottom: null, shoes: null, layer: null, acc: [] }; _wdFitOnly(); };
window.wdShuffle = function () {
  const pool = _wdItems().filter(i => !_wdDirty(i) && (_wd.fitFrom === 'all' || i.category === _wd.fitFrom));
  const pick = t => { const l = pool.filter(i => i.type === t); return l.length ? l[Math.floor(Math.random() * l.length)].id : null; };
  _wd.fit = { top: pick('top'), bottom: pick('bottom'), shoes: pick('shoes'), layer: Math.random() < 0.35 ? pick('layer') : null, acc: [] };
  if (!_wdFitIds().length) _wdToast('No clean clothes to pick from' + (_wd.fitFrom !== 'all' ? ` in ${_wd.fitFrom}` : ''));
  _wdFitOnly();
};
window.wdToggleClean = async function (id) {
  const it = _wdItem(id); if (!it) return;
  const status = _wdDirty(it) ? 'clean' : 'dirty';
  it.status = status; _wdRefresh();
  await _wdUpdate('wardrobe_items', id, { status });
};
window.wdLaundryDone = async function () {
  const d = _wdItems().filter(_wdDirty);
  if (!d.length || !confirm(`Mark all ${d.length} dirty item${d.length > 1 ? 's' : ''} as clean?`)) return;
  d.forEach(i => { i.status = 'clean'; }); _wdRefresh();
  for (const i of d) await _wdUpdate('wardrobe_items', i.id, { status: 'clean' });
  _wdToast(`${d.length} item${d.length > 1 ? 's' : ''} back in the cupboard`);
};
// Wearing marks clothes dirty (shoes and accessories stay clean) and counts the wear.
async function _wdWear(ids, date) {
  for (const id of ids) {
    const it = _wdItem(id); if (!it) continue;
    const f = { wear_count: (Number(it.wear_count) || 0) + 1, last_worn: date };
    if (!['shoes', 'accessory'].includes(it.type)) f.status = 'dirty';
    await _wdUpdate('wardrobe_items', id, f);
  }
}
window.wdWearToday = async function () {
  const ids = _wdFitIds(); if (!ids.length) return;
  const date = _wdToday();
  await _wdCreate('wardrobe_log', { id: _wdId('wl'), date, item_ids: JSON.stringify(ids), worn: true, event_title: 'Today' });
  await _wdWear(ids, date);
  _wdRefresh();
  _wdToast('Logged — those clothes are now in the laundry');
};
window.wdSaveOutfit = async function () {
  const ids = _wdFitIds(); if (!ids.length) return;
  const name = prompt('Name this outfit', _wd.fitFrom !== 'all' ? `${_wd.fitFrom} look` : 'My outfit');
  if (name === null) return;
  await _wdCreate('wardrobe_outfits', { id: _wdId('wo'), name: name.trim() || 'Outfit', item_ids: JSON.stringify(ids) });
  _wdRefresh(); _wdToast('Outfit saved');
};
window.wdLoadOutfit = function (id) {
  const o = _wdOutfits().find(x => String(x.id) === String(id)); if (!o) return;
  _wd.fit = { top: null, bottom: null, shoes: null, layer: null, acc: [] };
  _wdJSON(o.item_ids, []).forEach(x => { const it = _wdItem(x); if (it) wdTryOnSilent(it); });
  _wdFitOnly();
};
function wdTryOnSilent(it) { const f = _wd.fit; if (it.type === 'accessory') f.acc.push(it.id); else f[['top', 'bottom', 'shoes', 'layer'].includes(it.type) ? it.type : 'top'] = it.id; }
window.wdDeleteOutfit = async function (id) { if (!confirm('Delete this saved outfit?')) return; await _wdDelete('wardrobe_outfits', id); _wdRefresh(); };

/* categories */
window.wdNewCategory = async function () {
  const name = (prompt('New category (e.g. Office, Wedding, Travel)') || '').trim(); if (!name) return;
  const p = _wdProfile();
  if (p.categories.some(c => c.toLowerCase() === name.toLowerCase())) { _wdToast('That category already exists'); return; }
  p.categories.push(name); await _wdSaveProfile(p); _wdRefresh();
};
window.wdCatMenu = async function (cat) {
  const items = _wdItems().filter(i => (i.category || 'Uncategorised') === cat);
  const act = prompt(`"${cat}" — type a new name to rename it, or type DELETE to remove the category${items.length ? ` (its ${items.length} item${items.length > 1 ? 's' : ''} move to Uncategorised)` : ''}.`, cat);
  if (act === null) return;
  const p = _wdProfile(), v = act.trim();
  if (v.toUpperCase() === 'DELETE') {
    p.categories = p.categories.filter(c => c !== cat); await _wdSaveProfile(p);
    for (const i of items) await _wdUpdate('wardrobe_items', i.id, { category: '' });
  } else if (v && v !== cat) {
    p.categories = p.categories.map(c => c === cat ? v : c);
    if (!p.categories.includes(v)) p.categories.push(v);
    await _wdSaveProfile(p);
    for (const i of items) await _wdUpdate('wardrobe_items', i.id, { category: v });
  }
  _wdRefresh();
};

/* ══ SHEETS (modal plumbing) ══════════════════════════════════════════════ */
function _wdSheet(html, cls = '') {
  _wdCloseSheet();
  const ov = document.createElement('div');
  ov.className = 'wd-ov'; ov.id = 'wdOv';
  ov.innerHTML = `<div class="wd-sheet ${cls}" role="dialog">${html}</div>`;
  ov.addEventListener('pointerdown', e => { if (e.target === ov) _wdCloseSheet(); });
  document.body.appendChild(ov);
  _wdInjectCSS();
  return ov;
}
function _wdCloseSheet() { document.getElementById('wdOv')?.remove(); }
window.wdCloseSheet = _wdCloseSheet;
const _wdX = `<button type="button" class="wd-sx" onclick="wdCloseSheet()" aria-label="Close">×</button>`;

/* ── add clothes (one or many photos) ── */
window.wdAddItems = function (cat) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...(inp.files || [])]; if (!files.length) { wdEditItem(null, { category: cat || '' }); return; }
    const ov = _wdSheet(`<div class="wd-sh"><b>Preparing ${files.length} photo${files.length > 1 ? 's' : ''}…</b>${_wdX}</div><div class="wd-sb"><div class="wd-prog"><i style="width:0%"></i></div><p class="wd-hint">Removing plain backgrounds and shrinking each photo.</p></div>`);
    const out = [];
    for (let k = 0; k < files.length; k++) {
      try { const r = await _wdProcessImage(files[k], true); out.push({ ...r, file: files[k], name: files[k].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/^(IMG|DSC|PXL|Photo)\s*\d*\s*/i, '').trim() }); }
      catch (e) { console.error(e); }
      const bar = ov.querySelector('.wd-prog i'); if (bar) bar.style.width = Math.round((k + 1) / files.length * 100) + '%';
    }
    if (out.length === 1) { _wd.draft = null; wdEditItem(null, { category: cat || '', image: out[0].url, color: out[0].color, bgRemoved: out[0].bgRemoved, file: out[0].file, name: out[0].name }); return; }
    _wdBulkSheet(out, cat || '');
  };
  inp.click();
};
function _wdBulkSheet(list, cat) {
  const cats = _wdCategories();
  _wd.bulk = list.map(x => ({ ...x, type: 'top', category: cat, status: 'clean', name: x.name || '' }));
  const rows = _wd.bulk.map((x, i) => `<div class="wd-brow">
      <img src="${x.url}" alt="">
      <input class="wd-in" placeholder="Name (e.g. Black polo)" value="${_wdEsc(x.name)}" oninput="_wd.bulk[${i}].name=this.value">
      <select class="wd-in" onchange="_wd.bulk[${i}].type=this.value">${WD_TYPES.map(t => `<option value="${t.k}">${t.l}</option>`).join('')}</select>
      <select class="wd-in" onchange="_wd.bulk[${i}].category=this.value"><option value="">No category</option>${cats.map(c => `<option ${c === cat ? 'selected' : ''}>${_wdEsc(c)}</option>`).join('')}</select>
      <button type="button" class="wd-x" onclick="_wd.bulk[${i}].skip=!_wd.bulk[${i}].skip;this.closest('.wd-brow').classList.toggle('skip')" title="Skip this photo">×</button>
    </div>`).join('');
  _wdSheet(`<div class="wd-sh"><div><b>Add ${list.length} items</b><div class="wd-sub2">Set each one's name, type and category. You can add dates, price and more later.</div></div>${_wdX}</div>
    <div class="wd-sb"><div class="wd-blist">${rows}</div></div>
    <div class="wd-sf"><button type="button" class="wd-btn" onclick="wdCloseSheet()">Cancel</button><button type="button" class="wd-btn primary" onclick="wdBulkSave()">Add to wardrobe</button></div>`, 'wide');
}
window.wdBulkSave = async function () {
  const list = (_wd.bulk || []).filter(x => !x.skip);
  _wdCloseSheet();
  for (const x of list) await _wdCreate('wardrobe_items', { id: _wdId('wi'), name: (x.name || '').trim() || _wdTypeL(x.type), type: x.type, category: x.category, status: 'clean', image: x.url, color: x.color, wear_count: 0 });
  _wd.bulk = null; _wdRefresh();
  _wdToast(`${list.length} item${list.length > 1 ? 's' : ''} added`);
};

/* ── item editor ── */
window.wdEditItem = function (id, seed) {
  const it = id ? _wdItem(id) : null;
  const d = _wd.draft = it ? { ...it, _id: it.id } : Object.assign({ _id: null, name: '', type: 'top', category: '', status: 'clean', image: '', color: '#64748b', purchase_date: '', price: '', brand: '', size: '', notes: '', favorite: false }, seed || {});
  d.bgRemove = d.bgRemoved !== false;
  const cats = _wdCategories();
  const worn = Number(d.wear_count) || 0, price = _wdNum(d.price);
  _wdSheet(`<div class="wd-sh"><div><b>${it ? 'Edit item' : 'Add item'}</b>${it ? `<div class="wd-sub2">${worn ? `Worn ${worn}× · last ${_wdFmtDate(d.last_worn)}` : 'Not worn yet'}${price && worn ? ` · ₹${Math.round(price / worn).toLocaleString('en-IN')} per wear` : ''}</div>` : ''}</div>${_wdX}</div>
    <div class="wd-sb">
      <div class="wd-ed">
        <div class="wd-ed-img">
          <div class="wd-ed-pic" id="wdEdPic">${d.image ? `<img src="${d.image}" alt="">` : `<span>No photo</span>`}</div>
          <button type="button" class="wd-btn" onclick="wdEdPhoto()">${d.image ? 'Change photo' : 'Add photo'}</button>
          ${d.file ? `<label class="wd-chk"><input type="checkbox" ${d.bgRemove ? 'checked' : ''} onchange="wdEdBg(this.checked)"> Remove background</label>` : ''}
        </div>
        <div class="wd-ed-f">
          <label class="wd-l">Name<input class="wd-in" value="${_wdEsc(d.name)}" placeholder="e.g. Navy linen shirt" oninput="_wd.draft.name=this.value"></label>
          <div class="wd-l">Type<div class="wd-seg" id="wdEdType">${WD_TYPES.map(t => `<button type="button" class="${d.type === t.k ? 'on' : ''}" data-v="${t.k}" onclick="wdEdSet('type','${t.k}')">${t.l}</button>`).join('')}</div></div>
          <label class="wd-l">Category<select class="wd-in" onchange="if(this.value==='__new'){const n=(prompt('New category')||'').trim(); if(n){_wd.draft.category=n; wdAddCat(n);} else this.value=_wd.draft.category;} else _wd.draft.category=this.value">
            <option value="">No category</option>${cats.map(c => `<option ${d.category === c ? 'selected' : ''}>${_wdEsc(c)}</option>`).join('')}<option value="__new">+ New category…</option></select></label>
          <div class="wd-l">Status<div class="wd-seg" id="wdEdStatus"><button type="button" class="${_wdDirty(d) ? '' : 'on'}" data-v="clean" onclick="wdEdSet('status','clean')">Clean</button><button type="button" class="${_wdDirty(d) ? 'on' : ''}" data-v="dirty" onclick="wdEdSet('status','dirty')">Dirty</button></div></div>
          <div class="wd-row2">
            <label class="wd-l">Bought on<input class="wd-in" type="date" value="${_wdEsc(String(d.purchase_date || '').slice(0, 10))}" onchange="_wd.draft.purchase_date=this.value"></label>
            <label class="wd-l">Price (₹)<input class="wd-in" type="number" min="0" inputmode="numeric" value="${_wdEsc(d.price ?? '')}" oninput="_wd.draft.price=this.value"></label>
          </div>
          <div class="wd-row2">
            <label class="wd-l">Brand<input class="wd-in" value="${_wdEsc(d.brand || '')}" oninput="_wd.draft.brand=this.value"></label>
            <label class="wd-l">Size<input class="wd-in" value="${_wdEsc(d.size || '')}" placeholder="M / 32 / 9" oninput="_wd.draft.size=this.value"></label>
          </div>
          <div class="wd-row2">
            <label class="wd-l">Colour<input class="wd-in wd-col" type="color" value="${_wdEsc(d.color || '#64748b')}" oninput="_wd.draft.color=this.value"></label>
            <label class="wd-chk wd-favchk"><input type="checkbox" ${_wdFav(d) ? 'checked' : ''} onchange="_wd.draft.favorite=this.checked"> ★ Favourite</label>
          </div>
          <label class="wd-l">Notes<textarea class="wd-in" rows="2" placeholder="Fit, care, goes well with…" oninput="_wd.draft.notes=this.value">${_wdEsc(d.notes || '')}</textarea></label>
        </div>
      </div>
    </div>
    <div class="wd-sf">${it ? `<button type="button" class="wd-btn danger" onclick="wdDeleteItem('${_wdQ(it.id)}')">Delete</button>` : ''}<span style="flex:1"></span>
      <button type="button" class="wd-btn" onclick="wdCloseSheet()">Cancel</button><button type="button" class="wd-btn primary" onclick="wdSaveItem()">Save</button></div>`, 'wide');
};
window.wdAddCat = async function (n) { const p = _wdProfile(); if (!p.categories.includes(n)) { p.categories.push(n); await _wdSaveProfile(p); } const sel = document.querySelector('#wdOv select.wd-in'); if (sel) { const o = document.createElement('option'); o.textContent = n; o.selected = true; sel.insertBefore(o, sel.lastElementChild); } };
window.wdEdSet = function (k, v) { _wd.draft[k] = v; document.querySelectorAll(`#wdEd${k === 'type' ? 'Type' : 'Status'} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
window.wdEdPhoto = function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const pic = document.getElementById('wdEdPic'); if (pic) pic.innerHTML = '<span>Processing…</span>';
    const r = await _wdProcessImage(f, true);
    Object.assign(_wd.draft, { image: r.url, color: r.color, file: f, bgRemove: true });
    if (pic) pic.innerHTML = `<img src="${r.url}" alt="">`;
    const col = document.querySelector('#wdOv .wd-col'); if (col && r.color) col.value = r.color;
    _wdEdRefreshBg(_wd.draft);
  };
  inp.click();
};
function _wdEdRefreshBg(d) {
  const img = document.querySelector('.wd-ed-img');
  if (img && d.file && !img.querySelector('.wd-chk')) img.insertAdjacentHTML('beforeend', `<label class="wd-chk"><input type="checkbox" ${d.bgRemove ? 'checked' : ''} onchange="wdEdBg(this.checked)"> Remove background</label>`);
}
window.wdEdBg = async function (on) {
  const d = _wd.draft; if (!d || !d.file) return;
  d.bgRemove = on;
  const r = await _wdProcessImage(d.file, on);
  d.image = r.url; d.color = r.color;
  const pic = document.getElementById('wdEdPic'); if (pic) pic.innerHTML = `<img src="${r.url}" alt="">`;
};
window.wdSaveItem = async function () {
  const d = _wd.draft; if (!d) return;
  const f = { name: (d.name || '').trim() || _wdTypeL(d.type), type: d.type, category: d.category || '', status: d.status === 'dirty' ? 'dirty' : 'clean', image: d.image || '', color: d.color || '', purchase_date: d.purchase_date || null, price: _wdNum(d.price), brand: d.brand || '', size: d.size || '', notes: d.notes || '', favorite: !!d.favorite };
  _wdCloseSheet(); _wd.draft = null;
  if (d._id) await _wdUpdate('wardrobe_items', d._id, f);
  else await _wdCreate('wardrobe_items', { id: _wdId('wi'), wear_count: 0, ...f });
  _wdRefresh(); _wdToast('Saved');
};
window.wdDeleteItem = async function (id) {
  const it = _wdItem(id); if (!it || !confirm(`Delete "${it.name || 'this item'}"?`)) return;
  _wdCloseSheet();
  ['top', 'bottom', 'shoes', 'layer'].forEach(k => { if (String(_wd.fit[k]) === String(id)) _wd.fit[k] = null; });
  _wd.fit.acc = _wd.fit.acc.filter(x => String(x) !== String(id));
  await _wdDelete('wardrobe_items', id); _wdRefresh();
};

/* ── your face & body ── */
window.wdOpenProfile = function (over) {
  const p = _wd.draft = Object.assign({ _profile: true }, over || _wdProfile());
  _wdSheet(`<div class="wd-sh"><div><b>Your face & body</b><div class="wd-sub2">Used only for the fitting-room figure.</div></div>${_wdX}</div>
    <div class="wd-sb"><div class="wd-prof">
      <div class="wd-prof-fig" id="wdProfFig">${_wdFigureSVG(_wd.fit, { profile: p })}</div>
      <div class="wd-prof-f">
        <div class="wd-l">Face photo<div class="wd-facerow"><button type="button" class="wd-btn" onclick="wdProfFace()">${p.face ? 'Change photo' : 'Add a front-facing photo'}</button>${p.face ? '<button type="button" class="wd-link" onclick="_wd.draft.face=\'\';_wdProfPreview()">Remove</button>' : ''}</div></div>
        <div class="wd-row3">
          <label class="wd-l">Zoom<input type="range" min="0.8" max="2.6" step="0.05" value="${p.faceZoom}" oninput="_wd.draft.faceZoom=+this.value;_wdProfPreview()"></label>
          <label class="wd-l">Left / right<input type="range" min="-30" max="30" step="1" value="${p.faceX}" oninput="_wd.draft.faceX=+this.value;_wdProfPreview()"></label>
          <label class="wd-l">Up / down<input type="range" min="-30" max="30" step="1" value="${p.faceY}" oninput="_wd.draft.faceY=+this.value;_wdProfPreview()"></label>
        </div>
        <div class="wd-l">Skin tone<div class="wd-skins">${WD_SKINS.map(c => `<button type="button" class="${p.skin === c ? 'on' : ''}" style="background:${c}" onclick="_wd.draft.skin='${c}';document.querySelectorAll('.wd-skins button').forEach(b=>b.classList.toggle('on',b.style.backgroundColor===this.style.backgroundColor));_wdProfPreview()" aria-label="Skin tone"></button>`).join('')}</div></div>
        <div class="wd-row2">
          <label class="wd-l">Height (cm)<input class="wd-in" type="number" value="${p.height}" oninput="_wd.draft.height=+this.value||175;_wdProfPreview()"></label>
          <label class="wd-l">Chest (cm)<input class="wd-in" type="number" value="${p.chest}" oninput="_wd.draft.chest=+this.value||96;_wdProfPreview()"></label>
        </div>
        <div class="wd-row2">
          <label class="wd-l">Waist (cm)<input class="wd-in" type="number" value="${p.waist}" oninput="_wd.draft.waist=+this.value||84;_wdProfPreview()"></label>
          <label class="wd-l">Hips (cm)<input class="wd-in" type="number" value="${p.hips}" oninput="_wd.draft.hips=+this.value||96;_wdProfPreview()"></label>
        </div>
      </div>
    </div></div>
    <div class="wd-sf"><span style="flex:1"></span><button type="button" class="wd-btn" onclick="wdCloseSheet()">Cancel</button><button type="button" class="wd-btn primary" onclick="wdSaveProfile()">Save</button></div>`, 'wide');
};
window._wdProfPreview = function () { const el = document.getElementById('wdProfFig'); if (el) el.innerHTML = _wdFigureSVG(_wd.fit, { profile: _wd.draft }); };
window.wdProfFace = function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; _wd.draft.face = await _wdProcessFace(f); _wd.draft.faceZoom = 1.2; _wd.draft.faceX = 0; _wd.draft.faceY = 0; wdOpenProfile(_wd.draft); };
  inp.click();
};
window.wdSaveProfile = async function () {
  const d = _wd.draft; if (!d) return;
  const p = { face: d.face, faceZoom: d.faceZoom, faceX: d.faceX, faceY: d.faceY, skin: d.skin, height: d.height, chest: d.chest, waist: d.waist, hips: d.hips, categories: _wdProfile().categories };
  _wdCloseSheet(); _wd.draft = null;
  await _wdSaveProfile(p); _wdRefresh(); _wdToast('Saved');
};

/* ══ JOURNAL: pick an outfit for an event of the day ═══════════════════════
   window.wdPickOutfit({ date, eventId, eventTitle }) opens a picker over the
   journal. Saving writes a wardrobe_log row for (date, event) — planned until
   you mark it worn. */
function _wdLogFor(date, eventId) { return _wdLogs().find(l => String(l.date || '').slice(0, 10) === date && String(l.event_id || '') === String(eventId || '')); }
window.wdPickOutfit = async function (ctx) {
  _wdInjectCSS();
  await _wdLoad();
  _wd.picker = Object.assign({ date: _wdToday(), eventId: '', eventTitle: 'The day' }, ctx || {});
  const log = _wdLogFor(_wd.picker.date, _wd.picker.eventId);
  _wd.fit = { top: null, bottom: null, shoes: null, layer: null, acc: [] };
  if (log) _wdJSON(log.item_ids, []).forEach(x => { const it = _wdItem(x); if (it) wdTryOnSilent(it); });
  const ov = _wdSheet('', 'picker');
  ov.querySelector('.wd-sheet').id = 'wdPicker';
  _wdPickerRender();
};
function _wdPickerRender() {
  const sh = document.getElementById('wdPicker'); if (!sh) return;
  const pc = _wd.picker;
  const cats = _wdCategories();
  const items = _wdFiltered(_wdItems());
  const byCat = {}; items.forEach(i => { const c = (i.category || '').trim() || 'Uncategorised'; (byCat[c] = byCat[c] || []).push(i); });
  const order = cats.concat(byCat.Uncategorised ? ['Uncategorised'] : []).filter(c => byCat[c]);
  const dl = new Date(pc.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  sh.innerHTML = `<div class="wd-sh"><div><b>Outfit for ${_wdEsc(pc.eventTitle || 'the day')}</b><div class="wd-sub2">${dl} · tap clothes to try them on</div></div>${_wdX}</div>
    <div class="wd-pick">
      <div class="wd-pick-l">
        <div class="wd-chips">${[['all', 'All'], ...WD_TYPES.map(t => [t.k, t.pl])].map(([k, l]) => `<button type="button" class="wd-chip${_wd.type === k ? ' on' : ''}" onclick="wdFilter('type','${k}')">${l}</button>`).join('')}
          <button type="button" class="wd-chip${_wd.status === 'clean' ? ' on' : ''}" onclick="wdFilter('status','${_wd.status === 'clean' ? 'all' : 'clean'}')">Clean only</button></div>
        ${order.length ? order.map(c => _wdCatSection(c, byCat[c])).join('') : `<div class="wd-none">${_wdItems().length ? 'Nothing matches.' : 'Your wardrobe is empty — add clothes in Wardrobe first.'}</div>`}
      </div>
      <div class="wd-pick-r wd-fit-host">${_wdFitHTML('picker')}</div>
    </div>`;
}
window.wdPickerSave = async function () {
  const pc = _wd.picker; if (!pc) return;
  const ids = _wdFitIds();
  const log = _wdLogFor(pc.date, pc.eventId);
  if (log) await _wdUpdate('wardrobe_log', log.id, { item_ids: JSON.stringify(ids), event_title: pc.eventTitle || '' });
  else await _wdCreate('wardrobe_log', { id: _wdId('wl'), date: pc.date, event_id: pc.eventId || '', event_title: pc.eventTitle || '', item_ids: JSON.stringify(ids), worn: false });
  _wd.picker = null; _wdCloseSheet();
  if (typeof dbRender === 'function') dbRender();
  _wdToast('Outfit planned');
};
// Mark a planned outfit as worn: clothes go to the laundry, wear counts go up.
window.wdMarkWorn = async function (logId) {
  const log = _wdLogs().find(l => String(l.id) === String(logId)); if (!log) return;
  const worn = !(log.worn === true || log.worn === 'true');
  await _wdUpdate('wardrobe_log', log.id, { worn });
  if (worn) await _wdWear(_wdJSON(log.item_ids, []), String(log.date).slice(0, 10));
  if (typeof dbRender === 'function') dbRender();
  _wdToast(worn ? 'Marked worn — clothes moved to the laundry' : 'Marked as not worn');
};
window.wdClearPlan = async function (logId) { await _wdDelete('wardrobe_log', logId); if (typeof dbRender === 'function') dbRender(); };
window._wdLoad = _wdLoad; window._wdItem = _wdItem; window._wdLogs = _wdLogs; window._wdJSON = _wdJSON;

/* ══ STYLES ═══════════════════════════════════════════════════════════════ */
function _wdInjectCSS() {
  if (document.getElementById('wdStyles')) return;
  const st = document.createElement('style'); st.id = 'wdStyles';
  st.textContent = `
.wd-wrap { display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:20px; max-width:1400px; margin:0 auto; padding-bottom:40px; align-items:start; --wd-base:#dfe3ea; }
.wd-loading { padding:60px; text-align:center; color:var(--text-3); }
.wd-main { min-width:0; }
.wd-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.wd-head h1 { margin:0; font-size:26px; font-weight:850; letter-spacing:-.02em; color:var(--text-1); }
.wd-head p { margin:4px 0 0; font-size:13px; color:var(--text-3); font-weight:600; }
.wd-dirty-n { color:#B54708; }
.wd-head-a { display:flex; gap:8px; flex-wrap:wrap; }
.wd-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); border-radius:10px; padding:8px 13px; font:inherit; font-size:13px; font-weight:650; cursor:pointer; white-space:nowrap; }
.wd-btn svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.wd-btn:hover { background:var(--surface-2); }
.wd-btn.primary { background:var(--primary); color:#fff; border-color:transparent; }
.wd-btn.primary:hover { filter:brightness(.96); }
.wd-btn.danger { color:#B42318; border-color:rgba(220,38,38,.3); }
.wd-btn:disabled { opacity:.5; cursor:default; }
.wd-link { border:none; background:none; color:var(--text-3); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; padding:4px; }
.wd-tools { display:flex; flex-direction:column; gap:8px; margin-bottom:6px; }
.wd-search { display:flex; align-items:center; gap:8px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:11px; padding:0 12px; max-width:420px; }
.wd-search svg { width:16px; height:16px; fill:none; stroke:var(--text-3); stroke-width:2; }
.wd-search input { flex:1; border:none !important; outline:none; background:transparent !important; box-shadow:none !important; padding:9px 0 !important; margin:0; font:inherit; font-size:14px; color:var(--text-1); }
.wd-chips { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; }
.wd-chips::-webkit-scrollbar { display:none; }
.wd-chip { flex:none; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-2); font:inherit; font-size:12.5px; font-weight:600; padding:6px 12px; border-radius:999px; cursor:pointer; }
.wd-chip.on { background:var(--text-1); color:var(--surface-1); border-color:var(--text-1); }
.wd-cat { margin-top:18px; }
.wd-cat-h { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.wd-cat-h h3 { margin:0; font-size:17px; font-weight:800; color:var(--text-1); }
.wd-cat-n { font-size:12.5px; color:var(--text-3); font-weight:600; }
.wd-cat-n b { color:#B54708; font-weight:700; }
.wd-cat-a { margin-left:auto; display:flex; gap:4px; }
.wd-ib { width:30px; height:30px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:9px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-2); padding:0; }
.wd-ib svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.wd-ib svg circle { fill:currentColor; stroke:none; }
.wd-fit-h .wd-ib svg circle, .wd-search svg circle { fill:none; stroke:currentColor; }
.wd-ib:hover { background:var(--surface-2); color:var(--text-1); }
.wd-strip { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x proximity; padding:4px 2px 10px; scrollbar-width:thin; }
.wd-card { flex:none; width:150px; scroll-snap-align:start; background:var(--surface-1); border:1.5px solid var(--border-color); border-radius:14px; overflow:hidden; cursor:pointer; transition:transform .12s, box-shadow .12s, border-color .12s; }
.wd-card:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(15,23,42,.1); }
.wd-card.on { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent); }
.wd-card-img { position:relative; aspect-ratio:4/5; background:repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface-1) 0 50%) 0 0/16px 16px; display:flex; align-items:center; justify-content:center; }
.wd-card-img img { max-width:88%; max-height:88%; object-fit:contain; filter:drop-shadow(0 4px 6px rgba(15,23,42,.15)); }
.wd-card.dirty .wd-card-img img { opacity:.55; filter:grayscale(.5); }
.wd-noimg { width:64%; aspect-ratio:1; border-radius:14px; background:var(--ic); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:800; text-shadow:0 1px 2px rgba(0,0,0,.3); }
.wd-fav { position:absolute; left:8px; top:6px; color:#f59e0b; font-size:15px; }
.wd-edit { position:absolute; right:6px; top:6px; width:28px; height:28px; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-1); display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity .12s; padding:0; }
.wd-edit svg { width:14px; height:14px; fill:none; stroke:var(--text-2); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.wd-card:hover .wd-edit { opacity:1; }
@media (hover:none) { .wd-edit { opacity:.9; } }
.wd-on { position:absolute; left:6px; bottom:6px; font-size:10px; font-weight:800; color:#fff; background:var(--primary); border-radius:999px; padding:2px 8px; }
.wd-card-b { padding:8px 10px 10px; }
.wd-card-t { font-size:13px; font-weight:700; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wd-card-m { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:4px; font-size:11.5px; color:var(--text-3); font-weight:600; }
.wd-st { border:none; font:inherit; font-size:10.5px; font-weight:800; border-radius:999px; padding:2px 8px; cursor:pointer; }
.wd-st.clean { background:#D1FADF; color:#05603A; }
.wd-st.dirty { background:#FEF0C7; color:#93370D; }
.wd-add-card { flex:none; width:150px; min-height:220px; border:1.5px dashed var(--border-color); border-radius:14px; background:transparent; color:var(--text-3); font:inherit; font-size:12.5px; font-weight:650; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
.wd-add-card span { font-size:26px; line-height:1; }
.wd-add-card:hover { border-color:var(--primary); color:var(--primary); }
.wd-none { padding:40px; text-align:center; color:var(--text-3); }
.wd-empty { text-align:center; padding:50px 20px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:18px; }
.wd-empty-ic { width:64px; height:64px; border-radius:18px; margin:0 auto 12px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; }
.wd-empty-ic svg { width:34px; height:34px; fill:none; stroke:var(--text-2); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.wd-empty h3 { margin:0 0 6px; font-size:18px; color:var(--text-1); }
.wd-empty p { margin:0 auto 16px; max-width:440px; font-size:13.5px; color:var(--text-3); line-height:1.5; }
.wd-empty-acts { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
/* fitting room */
.wd-side { position:sticky; top:12px; }
.wd-fit { background:var(--surface-1); border:1px solid var(--border-color); border-radius:18px; padding:14px; box-shadow:var(--shadow-card, 0 4px 14px rgba(0,0,0,.05)); }
.wd-fit-h { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.wd-fit-h b { font-size:15px; font-weight:800; color:var(--text-1); }
.wd-fig { display:flex; justify-content:center; background:radial-gradient(120% 80% at 50% 10%, color-mix(in srgb, var(--primary) 7%, var(--surface-1)), var(--surface-2)); border-radius:14px; padding:10px 0 4px; }
.wdf { width:100%; max-width:230px; height:auto; max-height:46vh; }
.wd-slots { display:flex; flex-direction:column; gap:4px; margin-top:10px; }
.wd-slot { display:flex; align-items:center; gap:8px; min-height:34px; padding:3px 6px; border-radius:9px; }
.wd-slot.set { background:var(--surface-2); }
.wd-slot-l { width:50px; flex:none; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3); }
.wd-slot-e { font-size:12px; color:var(--text-3); }
.wd-slot-i { flex:1; min-width:0; display:flex; align-items:center; gap:7px; }
.wd-slot-i img, .wd-slot-i i { width:26px; height:26px; object-fit:contain; border-radius:6px; flex:none; display:block; }
.wd-slot-i b { font-size:13px; font-weight:650; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wd-slot-i em { font-style:normal; font-size:10px; font-weight:800; color:#93370D; background:#FEF0C7; border-radius:999px; padding:1px 6px; }
.wd-slot-acc { display:flex; gap:5px; }
.wd-slot-acc button { width:28px; height:28px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-1); padding:2px; cursor:pointer; }
.wd-slot-acc img, .wd-slot-acc i { width:100%; height:100%; object-fit:contain; display:block; border-radius:5px; }
.wd-x { width:26px; height:26px; flex:none; border:none; background:transparent; color:var(--text-3); font-size:18px; line-height:1; border-radius:7px; cursor:pointer; }
.wd-x:hover { background:var(--surface-3,#e5e7eb); color:var(--text-1); }
.wd-fit-acts { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; align-items:center; }
.wd-fit-acts .wd-btn.primary { flex:1; }
.wd-shuffle { display:flex; align-items:center; gap:0; width:100%; }
.wd-shuffle .wd-btn { border-top-right-radius:0; border-bottom-right-radius:0; }
.wd-shuffle select { flex:1; min-width:0; border:1px solid var(--border-color); border-left:none; border-radius:0 10px 10px 0; background:var(--surface-1); color:var(--text-2); font:inherit; font-size:12.5px; padding:8px 8px; height:auto; margin:0; }
.wd-outfits { margin-top:14px; border-top:1px solid var(--border-color); padding-top:10px; }
.wd-sub { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3); margin-bottom:6px; }
.wd-ostrip { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
.wd-oc { position:relative; flex:none; width:86px; }
.wd-oc-b { width:100%; border:1px solid var(--border-color); background:var(--surface-2); border-radius:11px; padding:5px; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:4px; }
.wd-oc-im { display:grid; grid-template-columns:1fr 1fr; gap:2px; aspect-ratio:1; }
.wd-oc-im img, .wd-oc-im i { width:100%; height:100%; object-fit:contain; display:block; border-radius:4px; }
.wd-oc-t { font-size:11px; font-weight:650; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wd-oc-x { position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-3); font-size:13px; line-height:1; cursor:pointer; display:none; padding:0; }
.wd-oc:hover .wd-oc-x { display:block; }
.wd-fab { display:none; }
@media (max-width:1000px) {
  .wd-wrap { grid-template-columns:1fr; }
  .wd-side { position:fixed; left:0; right:0; bottom:0; top:auto; z-index:900; max-height:86vh; overflow-y:auto; transform:translateY(105%); transition:transform .22s ease; }
  .wd-side.open { transform:none; }
  .wd-side .wd-fit { border-radius:20px 20px 0 0; padding-bottom:calc(70px + env(safe-area-inset-bottom,0px)); }
  .wd-fab { display:block; position:fixed; left:50%; transform:translateX(-50%); bottom:calc(84px + env(safe-area-inset-bottom,0px)); z-index:901; border:none; background:var(--text-1); color:var(--surface-1); font:inherit; font-size:13.5px; font-weight:750; padding:11px 20px; border-radius:999px; box-shadow:0 10px 24px rgba(15,23,42,.3); cursor:pointer; }
  .wd-card, .wd-add-card { width:132px; }
}
/* sheets */
.wd-ov { position:fixed; inset:0; z-index:100020; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:16px; }
.wd-sheet { width:min(460px,100%); max-height:92vh; display:flex; flex-direction:column; background:var(--surface-1); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.3); overflow:hidden; }
.wd-sheet.wide { width:min(760px,100%); }
.wd-sheet.picker { width:min(1180px,100%); height:min(860px,94vh); }
.wd-sh { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 18px 12px; border-bottom:1px solid var(--border-color); }
.wd-sh b { font-size:16px; font-weight:800; color:var(--text-1); }
.wd-sub2 { font-size:12.5px; color:var(--text-3); margin-top:3px; }
.wd-sx { width:32px; height:32px; flex:none; border:none; border-radius:9px; background:var(--surface-2); color:var(--text-2); font-size:20px; line-height:1; cursor:pointer; }
.wd-sb { padding:14px 18px; overflow-y:auto; flex:1; }
.wd-sf { display:flex; gap:8px; justify-content:flex-end; padding:12px 18px; border-top:1px solid var(--border-color); }
.wd-hint { font-size:12.5px; color:var(--text-3); }
.wd-prog { height:8px; border-radius:999px; background:var(--surface-3,#e5e7eb); overflow:hidden; }
.wd-prog i { display:block; height:100%; background:var(--primary); transition:width .2s; }
.wd-in { width:100%; box-sizing:border-box; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); border-radius:10px; padding:9px 11px; font:inherit; font-size:14px; margin:0; }
.wd-in:focus { outline:none; border-color:var(--primary); }
.wd-col { padding:3px; height:40px; }
.wd-l { display:flex; flex-direction:column; gap:5px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); margin-bottom:10px; }
.wd-row2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.wd-row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
.wd-seg { display:flex; gap:5px; flex-wrap:wrap; }
.wd-seg button { flex:1; border:1px solid var(--border-color); background:var(--surface-2); color:var(--text-2); font:inherit; font-size:12.5px; font-weight:650; text-transform:none; letter-spacing:0; padding:8px 6px; border-radius:9px; cursor:pointer; }
.wd-seg button.on { background:var(--text-1); color:var(--surface-1); border-color:var(--text-1); }
.wd-chk { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; }
.wd-favchk { margin-top:18px; }
.wd-ed { display:grid; grid-template-columns:220px 1fr; gap:18px; }
.wd-ed-img { display:flex; flex-direction:column; gap:8px; align-items:stretch; }
.wd-ed-pic { aspect-ratio:4/5; border-radius:14px; border:1px solid var(--border-color); background:repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface-1) 0 50%) 0 0/16px 16px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px; overflow:hidden; }
.wd-ed-pic img { max-width:92%; max-height:92%; object-fit:contain; }
.wd-blist { display:flex; flex-direction:column; gap:8px; }
.wd-brow { display:grid; grid-template-columns:56px 1.4fr 1fr 1fr 28px; gap:8px; align-items:center; }
.wd-brow img { width:56px; height:56px; object-fit:contain; border-radius:9px; background:var(--surface-2); }
.wd-brow.skip { opacity:.35; }
.wd-prof { display:grid; grid-template-columns:230px 1fr; gap:18px; }
.wd-prof-fig { background:var(--surface-2); border-radius:14px; display:flex; justify-content:center; padding:10px 0; }
.wd-facerow { display:flex; gap:8px; align-items:center; text-transform:none; letter-spacing:0; }
.wd-skins { display:flex; gap:8px; }
.wd-skins button { width:30px; height:30px; border-radius:50%; border:2px solid var(--surface-1); box-shadow:0 0 0 1px var(--border-color); cursor:pointer; }
.wd-skins button.on { box-shadow:0 0 0 2px var(--primary); }
.wd-pick { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 320px; }
.wd-pick-l { overflow-y:auto; padding:12px 16px 20px; }
.wd-pick-r { overflow-y:auto; padding:12px; border-left:1px solid var(--border-color); background:var(--surface-2); }
.wd-pick-r .wd-fit { box-shadow:none; }
@media (max-width:760px) {
  .wd-ed, .wd-prof { grid-template-columns:1fr; }
  .wd-ed-img { max-width:240px; margin:0 auto; }
  .wd-brow { grid-template-columns:48px 1fr 1fr; }
  .wd-brow input { grid-column:2 / 4; }
  .wd-brow .wd-x { display:none; }
  .wd-ov { padding:0; align-items:flex-end; }
  .wd-sheet, .wd-sheet.wide, .wd-sheet.picker { width:100%; max-height:94vh; border-radius:18px 18px 0 0; }
  .wd-sheet.picker { height:94vh; }
  .wd-pick { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .wd-pick-r { order:-1; border-left:none; border-bottom:1px solid var(--border-color); max-height:44vh; }
  .wd-pick-r .wdf { max-height:30vh; }
}
`;
  document.head.appendChild(st);
}
