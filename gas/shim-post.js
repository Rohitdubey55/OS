// =====================================================================
// Team editing: auto-save changes every few seconds and pull other
// people's changes when the board's version moves on.
// =====================================================================
var _m2Saving = false, _m2Pulling = false, _m2LastSig = '', _m2LastSigAt = 0;

function _m2Busy() {
    return (typeof muralPointerDown !== 'undefined' && muralPointerDown) ||
        (typeof muralIsDragging !== 'undefined' && muralIsDragging) ||
        (typeof muralIsResizing !== 'undefined' && muralIsResizing) ||
        (typeof muralGroupResizing !== 'undefined' && muralGroupResizing) ||
        (typeof muralPenStroke !== 'undefined' && muralPenStroke) ||
        (typeof muralDrawingLine !== 'undefined' && muralDrawingLine);
}

async function _m2AutoSave() {
    if (_m2Saving || !muralActiveProjectId || !document.getElementById('muralPage') || _m2Busy()) return;
    var pid = String(muralActiveProjectId);
    var d = _m2Delta(pid, muralElements);
    if (!d.upserts.length && !d.deletes.length) return;
    // Safety: never send the exact same change twice in a row (stops any save loop)
    var sig = JSON.stringify([d.upserts.map(_m2Key), d.deletes]);
    if (sig === _m2LastSig && Date.now() - _m2LastSigAt < 60000) return;
    _m2LastSig = sig; _m2LastSigAt = Date.now();
    _m2Saving = true;
    try {
        if (typeof showSaveIndicator === 'function') showSaveIndicator('saving');
        var r = await _m2SendDelta(pid, d);
        if (typeof showSaveIndicator === 'function') showSaveIndicator(r && r.success ? 'saved' : 'error');
    } catch (e) { console.warn('Mural auto-save failed', e); }
    finally { _m2Saving = false; }
}

async function _m2Pull(pid, preloaded) {
    if (_m2Pulling) return;
    _m2Pulling = true;
    try {
        var b = preloaded || await _m2run('mural2Board', pid);
        if (!preloaded) try { _m2Local('b.' + pid, (b.elements || []).map(_m2Clean)); } catch (_) {}
        if (String(pid) !== String(muralActiveProjectId) || !document.getElementById('muralCanvas')) return;
        var remote = (b.elements || []).map(_m2Clean);
        var rs = {}; remote = remote.filter(function (e) { var k = String(e.id); if (rs[k]) return false; rs[k] = true; return true; });
        var d = _m2Delta(pid, muralElements);
        var dirty = {}; d.upserts.forEach(function (e) { dirty[String(e.id)] = true; });
        var local = {}; muralElements.forEach(function (e) { local[String(e.id)] = e; });
        var canvas = document.getElementById('muralCanvas');
        var focusEl = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.mural-element') : null;
        var seen = {}, connChanged = false, touched = false;
        remote.forEach(function (re) {
            var id = String(re.id); seen[id] = true;
            if (dirty[id]) return;                       // my unsaved edit wins locally
            var le = local[id];
            if (!le) {
                muralElements.push(re);
                if (re.type === 'connector') { muralConnectors.push(re); connChanged = true; }
                else if (canvas) canvas.appendChild(createMuralElementDOM(re));
                _m2SetBase(re); touched = true; return;
            }
            if (_m2Key(le) === _m2Key(re)) { _m2SetBase(re); return; }
            if (focusEl && focusEl.id === 'mural-el-' + id) return; // someone else edited what I'm typing in — keep mine
            Object.keys(le).forEach(function (k) { if (!(k in re)) delete le[k]; });
            Object.assign(le, re);
            if (le.type === 'connector') connChanged = true;
            else {
                var dom = document.getElementById('mural-el-' + id);
                if (dom) dom.replaceWith(createMuralElementDOM(le));
                updateConnectorsForElement(id);
            }
            _m2SetBase(le); touched = true;
        });
        // Removed by someone else (was saved before, not edited by me since, now gone)
        var gone = muralElements.filter(function (e) { var id = String(e.id); return !seen[id] && _m2Base[id] && _m2Base[id].pid === String(pid) && !dirty[id]; });
        if (gone.length) {
            var goneIds = {}; gone.forEach(function (e) { goneIds[String(e.id)] = true; delete _m2Base[String(e.id)]; var dom = document.getElementById('mural-el-' + e.id); if (dom) dom.remove(); });
            muralElements = muralElements.filter(function (e) { return !goneIds[String(e.id)]; });
            muralConnectors = muralConnectors.filter(function (c) { return !goneIds[String(c.id)]; });
            muralSelectedElementIds = muralSelectedElementIds.filter(function (id) { return !goneIds[String(id)]; });
            connChanged = true; touched = true;
        }
        if (connChanged) renderAllMuralConnectors();
        if (touched) {
            highlightMuralElements(muralSelectedElementIds);
            if (typeof updateMuralScrollbars === 'function') updateMuralScrollbars();
        }
        _m2Ver[pid] = b.version;
    } catch (e) { console.warn('Mural pull failed', e); }
    finally { _m2Pulling = false; }
}

function _m2RenderViewers(list, me) {
    var bar = document.querySelector('.mural-topbar-right');
    if (!bar) return;
    var el = document.getElementById('m2Viewers');
    var others = (list || []).filter(function (e) { return e && e !== me; });
    if (!el) { el = document.createElement('div'); el.id = 'm2Viewers'; el.className = 'm2-viewers'; bar.insertBefore(el, bar.firstChild); }
    el.innerHTML = others.slice(0, 5).map(function (e) {
        var n = e.split('@')[0]; var ini = n.split(/[._-]/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
        return '<span class="m2-av" title="' + escapeHtml(e) + ' is on this board">' + escapeHtml(ini) + '</span>';
    }).join('') + (others.length ? '<span class="m2-av-label">' + (others.length === 1 ? '1 other here' : others.length + ' others here') + '</span>' : '');
    el.style.display = others.length ? 'flex' : 'none';
}

async function _m2Tick() {
    if (document.hidden || !muralActiveProjectId || !document.getElementById('muralPage')) return;
    var pid = String(muralActiveProjectId);
    try {
        await _m2AutoSave();
        var p = await _m2run('mural2Poll', pid);
        _m2Others = (p.viewers || []).filter(function (e) { return e && e !== p.me; }).length;
        _m2RenderViewers(p.viewers, p.me);
        if (_m2Ver[pid] === undefined) { _m2Ver[pid] = p.version; return; }
        if (p.version > _m2Ver[pid] && !_m2Busy()) await _m2Pull(pid);
    } catch (e) { /* offline or quota — try again next tick */ }
}
// Every 5 s while someone is working, every 20 s after a minute of no activity
var _m2LastActive = Date.now(), _m2LastTick = 0;
['pointerdown', 'keydown', 'wheel'].forEach(function (t) { document.addEventListener(t, function () { _m2LastActive = Date.now(); }, { passive: true, capture: true }); });
// How often to check for teammates' changes:
//   others on the board + you active → 5 s · alone → 15 s · idle 2 min → 30 s · idle 10 min → stop (resumes on any click/key)
var _m2Others = 0;
function _m2Interval() {
    var idle = Date.now() - _m2LastActive;
    if (idle > 600000) return Infinity;
    if (idle > 120000) return 30000;
    return _m2Others > 0 ? 5000 : 15000;
}
setInterval(function () {
    if (Date.now() - _m2LastTick < _m2Interval() - 200) return;
    _m2LastTick = Date.now();
    _m2Tick();
}, 1000);

window.addEventListener('beforeunload', function (e) {
    if (!muralActiveProjectId) return;
    var d = _m2Delta(String(muralActiveProjectId), muralElements);
    if (d.upserts.length || d.deletes.length) { _m2AutoSave(); e.preventDefault(); e.returnValue = ''; }
});

// Keyboard-shortcut settings saved per browser (see apiPost)
try {
    var _m2s = JSON.parse(localStorage.getItem('m2.settings') || 'null');
    if (_m2s) { if (!window.state.data.settings || !window.state.data.settings.length) window.state.data.settings = [{}]; Object.assign(window.state.data.settings[0], _m2s); }
} catch (_) {}

// Old boards stored "name" instead of "title"
(function () {
    var ps = window.state.data.mural_projects;
    if (Array.isArray(ps)) ps.forEach(function (p) { if (!p.title && p.name) p.title = p.name; });
})();

// Changes are saved within ~3 s of being made, independent of the check interval (no server call if nothing changed)
setInterval(function () { if (!document.hidden) _m2AutoSave(); }, 3000);

// Show Mural errors as a toast instead of failing silently (helps report problems)
window.addEventListener('unhandledrejection', function (ev) {
    var m = ev && ev.reason && (ev.reason.stack || ev.reason.message || String(ev.reason));
    if (m && /mural|_m2/i.test(m)) toast('Mural error: ' + String(ev.reason.message || m).slice(0, 160), 'error');
});
window.addEventListener('error', function (ev) {
    var m = ev && (ev.error && ev.error.stack || ev.message);
    if (m && /mural|_m2/i.test(m)) toast('Mural error: ' + String(ev.message || m).slice(0, 160), 'error');
});

// Leaving a board (open another / go back) → send its unsaved changes right away,
// without making the person wait for the save to finish.
function _m2SaveNow() {
    if (!muralActiveProjectId) return;
    var pid = String(muralActiveProjectId);
    var d = _m2Delta(pid, muralElements);
    if (!d.upserts.length && !d.deletes.length) return;
    d = { upserts: d.upserts.map(function (e) { return Object.assign({}, e); }), deletes: d.deletes.slice() };
    _m2SendDelta(pid, d).catch(function (e) { console.warn('Mural save on leave failed', e); toast('Could not save the last change — please check the board', 'error'); });
}
(function () {
    var _open = openMuralProject, _exit = exitMuralProject;
    openMuralProject = function (id) { _m2SaveNow(); return _open.apply(this, arguments); };
    exitMuralProject = function () { _m2SaveNow(); return _exit.apply(this, arguments); };
    window.openMuralProject = openMuralProject; window.exitMuralProject = exitMuralProject;
})();
