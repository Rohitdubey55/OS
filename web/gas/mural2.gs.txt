// =====================================================================
// MURAL v2 — server side for the Mural ported from POS (all features)
// Data lives in the same spreadsheet (SS_ID) as before:
//   Mural_Projects · Mural_Categories · Mural_Elements
// Old boards keep working: missing columns are added automatically and
// old project "name" is read as "title".
// Team editing: every save sends only changed items; each board has a
// version number so other people's screens pick up changes in seconds.
// =====================================================================
var MURAL2_SHEETS = { mural_projects: 'Mural_Projects', mural_categories: 'Mural_Categories', mural_elements: 'Mural_Elements' };

function mural2Ss_() { return SpreadsheetApp.openById(SS_ID); }

function mural2Sheet_(key) {
  var name = MURAL2_SHEETS[key] || key;
  var ss = mural2Ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1).setValue('id'); }
  if (sh.getLastColumn() === 0) sh.getRange(1, 1).setValue('id');
  return sh;
}

function mural2Clean_(v) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

// Whole table → { sh, headers, rows (2D, without header), index id→row# }
function mural2Table_(key) {
  var sh = mural2Sheet_(key);
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('id');
  if (idCol < 0) { headers.unshift('id'); values = values.map(function (r) { r.unshift(''); return r; }); idCol = 0; }
  var index = {};
  values.forEach(function (r, i) { if (r[idCol] !== '' && r[idCol] !== null) index[String(r[idCol])] = i; });
  return { key: key, sh: sh, headers: headers, rows: values, index: index, idCol: idCol, dirty: false, structural: false, changed: {}, origLen: values.length };
}

function mural2EnsureCols_(t, obj) {
  Object.keys(obj).forEach(function (k) {
    if (t.headers.indexOf(k) < 0) {
      t.headers.push(k);
      t.rows.forEach(function (r) { r.push(''); });
      t.dirty = true; t.structural = true;
    }
  });
}

function mural2Cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && v.length > 49000) return v.slice(0, 49000);
  return v;
}

function mural2Upsert_(t, obj) {
  if (obj.id === undefined || obj.id === null || obj.id === '') obj.id = 'M2_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
  mural2EnsureCols_(t, obj);
  var id = String(obj.id);
  var i = t.index[id];
  if (i === undefined) {
    var row = t.headers.map(function (h) { return mural2Cell_(obj[h]); });
    t.rows.push(row);
    t.index[id] = t.rows.length - 1;
  } else {
    var r = t.rows[i];
    t.headers.forEach(function (h, c) { if (Object.prototype.hasOwnProperty.call(obj, h)) r[c] = mural2Cell_(obj[h]); });
    t.changed[i] = true;
  }
  t.dirty = true;
  return id;
}

function mural2Delete_(t, pred) {
  var before = t.rows.length;
  t.rows = t.rows.filter(function (r) { return !pred(r); });
  if (t.rows.length !== before) {
    t.index = {};
    var idCol = t.headers.indexOf('id');
    t.rows.forEach(function (r, i) { t.index[String(r[idCol])] = i; });
    t.dirty = true; t.structural = true;
  }
  return before - t.rows.length;
}

function mural2Flush_(t) {
  if (!t.dirty) return;
  var sh = t.sh;
  var width0 = t.headers.length;
  var changedRows = Object.keys(t.changed).map(Number);
  // Small edits: write only the touched rows + append new ones (fast, keeps others' rows untouched)
  if (!t.structural && changedRows.length <= 40) {
    changedRows.forEach(function (i) {
      var r = t.rows[i].slice(0, width0); while (r.length < width0) r.push('');
      sh.getRange(i + 2, 1, 1, width0).setValues([r]);
    });
    var added = t.rows.slice(t.origLen).map(function (r) { r = r.slice(0, width0); while (r.length < width0) r.push(''); return r; });
    if (added.length) sh.getRange(t.origLen + 2, 1, added.length, width0).setValues(added);
    if (sh.getRange(1, 1, 1, width0).getValues()[0].join('|') !== t.headers.join('|')) sh.getRange(1, 1, 1, width0).setValues([t.headers]);
    t.dirty = false; t.changed = {}; t.origLen = t.rows.length;
    return;
  }
  var all = [t.headers].concat(t.rows);
  var width = t.headers.length;
  all = all.map(function (r) { while (r.length < width) r.push(''); return r.slice(0, width); });
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  sh.getRange(1, 1, all.length, width).setValues(all);
  if (lastRow > all.length) sh.getRange(all.length + 1, 1, lastRow - all.length, Math.max(width, lastCol)).clearContent();
  t.dirty = false; t.structural = false; t.changed = {}; t.origLen = t.rows.length;
}

function mural2Objects_(t) {
  // Older saves could leave the same id on several rows — the last row wins (same rule as updates)
  var byId = {}, order = [];
  t.rows.forEach(function (r) {
    var o = {};
    t.headers.forEach(function (h, c) { if (h) o[h] = mural2Clean_(r[c]); });
    if (o.id === '' || o.id === null || o.id === undefined) return;
    var k = String(o.id);
    if (!(k in byId)) order.push(k);
    byId[k] = o;
  });
  return order.map(function (k) { return byId[k]; });
}

function mural2User_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

// ---- board versions (for live-ish team editing) ----
function mural2BumpVersion_(pid) {
  if (!pid) return 0;
  var props = PropertiesService.getScriptProperties();
  var v = Number(props.getProperty('mural2v_' + pid) || 0) + 1;
  props.setProperty('mural2v_' + pid, String(v));
  CacheService.getScriptCache().put('mural2v_' + pid, String(v), 21600);
  return v;
}
function mural2GetVersion_(pid) {
  var c = CacheService.getScriptCache().get('mural2v_' + pid);
  if (c !== null) return Number(c);
  return Number(PropertiesService.getScriptProperties().getProperty('mural2v_' + pid) || 0);
}

// ---- public: called from mural.html via google.script.run ----
function mural2Get(key) {
  var t = mural2Table_(key);
  var out = mural2Objects_(t);
  if (key === 'mural_projects') out.forEach(function (p) { if (!p.title && p.name) p.title = p.name; });
  return out;
}

function mural2Board(pid) {
  var t = mural2Table_('mural_elements');
  var els = mural2Objects_(t).filter(function (e) { return String(e.project_id) === String(pid); });
  return { version: mural2GetVersion_(pid), elements: els };
}

// Who is looking at a board right now + its version. Called every few seconds.
function mural2Poll(pid) {
  var cache = CacheService.getScriptCache();
  var me = mural2User_();
  var key = 'mural2who_' + pid;
  var who = {};
  try { who = JSON.parse(cache.get(key) || '{}'); } catch (e) { who = {}; }
  var now = Date.now();
  if (me) who[me] = now;
  Object.keys(who).forEach(function (k) { if (now - who[k] > 30000) delete who[k]; });
  cache.put(key, JSON.stringify(who), 600);
  return { version: mural2GetVersion_(pid), viewers: Object.keys(who), me: me };
}

function mural2Post(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var me = mural2User_();
    var stamp = new Date().toISOString();
    var a = req && req.action;

    if (a === 'create' || a === 'update') {
      var t = mural2Table_(req.sheet);
      var p = req.payload || {};
      if (a === 'update' && req.id) p.id = req.id;
      if (req.sheet === 'mural_projects' && p.title !== undefined) p.name = p.title;
      p.updated_at = stamp; p.updated_by = me;
      if (a === 'create') { p.created_at = p.created_at || stamp; p.created_by = me; }
      var id = mural2Upsert_(t, p);
      mural2Flush_(t);
      var obj = mural2Objects_(t).filter(function (o) { return String(o.id) === String(id); })[0];
      if (req.sheet === 'mural_projects' && obj && !obj.title && obj.name) obj.title = obj.name;
      if (req.sheet === 'mural_elements' && p.project_id) mural2BumpVersion_(p.project_id);
      return { success: true, id: id, data: obj };
    }

    if (a === 'delete') {
      var td = mural2Table_(req.sheet);
      var idc = td.headers.indexOf('id');
      var pidc = td.headers.indexOf('project_id');
      var pidOf = null;
      mural2Delete_(td, function (r) { if (String(r[idc]) === String(req.id)) { if (pidc >= 0) pidOf = r[pidc]; return true; } return false; });
      mural2Flush_(td);
      if (pidOf) mural2BumpVersion_(pidOf);
      return { success: true };
    }

    if (a === 'deleteMuralProject') {
      var tp = mural2Table_('mural_projects'), te = mural2Table_('mural_elements');
      var ic = tp.headers.indexOf('id'), pc = te.headers.indexOf('project_id');
      mural2Delete_(tp, function (r) { return String(r[ic]) === String(req.id); });
      if (pc >= 0) mural2Delete_(te, function (r) { return String(r[pc]) === String(req.id); });
      mural2Flush_(tp); mural2Flush_(te);
      mural2BumpVersion_(req.id);
      return { success: true };
    }

    // Changed items only (what the browser sends while people edit)
    if (a === 'syncMuralDelta') {
      var pl = req.payload || {};
      var tx = mural2Table_('mural_elements');
      (pl.upserts || []).forEach(function (el) {
        el.project_id = el.project_id || pl.project_id;
        el.updated_at = stamp; el.updated_by = me;
        mural2Upsert_(tx, el);
      });
      var del = {}; (pl.deletes || []).forEach(function (id) { del[String(id)] = true; });
      var idx2 = tx.headers.indexOf('id');
      if (Object.keys(del).length) mural2Delete_(tx, function (r) { return del[String(r[idx2])] === true; });
      mural2Flush_(tx);
      var v = (pl.upserts && pl.upserts.length) || Object.keys(del).length ? mural2BumpVersion_(pl.project_id) : mural2GetVersion_(pl.project_id);
      return { success: true, version: v };
    }

    // Full replace of one board (used by import into a sub-board)
    if (a === 'syncMuralElements') {
      var ps = req.payload || {};
      var tf = mural2Table_('mural_elements');
      var pcol = tf.headers.indexOf('project_id');
      var keep = {}; (ps.elements || []).forEach(function (el) { keep[String(el.id)] = true; });
      var idf = tf.headers.indexOf('id');
      if (pcol >= 0) mural2Delete_(tf, function (r) { return String(r[pcol]) === String(ps.project_id) && !keep[String(r[idf])]; });
      (ps.elements || []).forEach(function (el) { el.project_id = ps.project_id; el.updated_at = stamp; el.updated_by = me; mural2Upsert_(tf, el); });
      mural2Flush_(tf);
      return { success: true, version: mural2BumpVersion_(ps.project_id) };
    }

    // Bring in boards exported from another Mural (POS export file)
    if (a === 'importBoards') {
      var pl2 = req.payload || {};
      var tpi = mural2Table_('mural_projects'), tei = mural2Table_('mural_elements');
      (pl2.projects || []).forEach(function (p2) { if (p2.title) p2.name = p2.title; p2.updated_at = stamp; p2.updated_by = me; mural2Upsert_(tpi, p2); });
      (pl2.elements || []).forEach(function (e2) { e2.updated_at = stamp; e2.updated_by = me; mural2Upsert_(tei, e2); });
      mural2Flush_(tpi); mural2Flush_(tei);
      (pl2.projects || []).forEach(function (p3) { mural2BumpVersion_(p3.id); });
      return { success: true, projects: (pl2.projects || []).length, elements: (pl2.elements || []).length };
    }

    if (a === 'repairMural') return { success: true };
    return { success: false, message: 'Unknown action: ' + a };
  } catch (e) {
    return { success: false, message: String(e) };
  } finally {
    lock.releaseLock();
  }
}
