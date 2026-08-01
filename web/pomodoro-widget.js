/* pomodoro-widget.js — PersonalOS floating Pomodoro
   ────────────────────────────────────────────────────────────────────────────
   A draggable panel that floats above the whole app, driven by the SAME engine
   as the Pomodoro page (view-pomodoro.js). It never calls renderPomodoro()
   unless the user is actually on that page, so starting a session from the
   sidebar does not blow away whatever view is currently mounted.

   Flow:  pick a duration (default 25) → Start → hourglass drains in real time
          → optional fullscreen flip clock. All of it floats, all of it drags.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
    'use strict';

    const LS_POS = 'pomoWidgetPos';
    const LS_MIN = 'pomoWidgetMins';
    const PRESETS = [5, 15, 25, 45, 60];

    let raf = null;
    let lastDigits = '';

    /* ── engine access ────────────────────────────────────────────────────── */
    // view-pomodoro.js is lazy-loaded. These accessors return null until it is.
    const S = () => (typeof window._pomoGetState === 'function' ? window._pomoGetState() : null);
    const CFG = () => (typeof window._pomoGetSettings === 'function' ? window._pomoGetSettings() : null);

    async function ensureEngine() {
        if (S()) return true;
        if (typeof window.ensureViewLoaded === 'function') {
            await window.ensureViewLoaded('pomodoro');
        }
        return !!S();
    }

    function onPomodoroPage() {
        return typeof state !== 'undefined' && state && state.view === 'pomodoro';
    }

    /* ── styles ───────────────────────────────────────────────────────────── */
    function ensureStyle() {
        if (document.getElementById('pomoWidgetStyle')) return;
        const st = document.createElement('style');
        st.id = 'pomoWidgetStyle';
        st.textContent = `
/* ══ floating panel ══ */
.pw-panel{position:fixed;z-index:9500;width:268px;border-radius:20px;
  background:var(--surface-1,#fff);color:var(--text-1,#0f172a);
  box-shadow:0 18px 50px rgba(0,0,0,.18),0 4px 14px rgba(0,0,0,.10);
  border:1px solid var(--border-color,rgba(0,0,0,.07));
  font-family:inherit;overflow:hidden;
  animation:pwIn .22s cubic-bezier(.34,1.4,.64,1);touch-action:none;
  -webkit-user-select:none;user-select:none}
@keyframes pwIn{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:none}}
.pw-panel.pw-dragging{transition:none;box-shadow:0 26px 60px rgba(0,0,0,.26)}

.pw-head{display:flex;align-items:center;gap:8px;padding:11px 12px 11px 14px;
  cursor:grab;background:var(--surface-2,#f8fafc);
  border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}
.pw-head:active{cursor:grabbing}
.pw-grip{display:flex;flex-direction:column;gap:2.5px;flex:0 0 auto;opacity:.42}
.pw-grip i{display:block;width:13px;height:1.6px;border-radius:2px;background:currentColor}
.pw-title{font-size:12.5px;font-weight:700;letter-spacing:.02em;flex:1}
.pw-head-btn{width:24px;height:24px;flex:0 0 auto;border:none;border-radius:7px;cursor:pointer;
  background:transparent;color:var(--text-3,#94a3b8);display:flex;align-items:center;justify-content:center}
.pw-head-btn:hover{background:var(--surface-3,#e9eef5);color:var(--text-1,#0f172a)}
.pw-head-btn svg{width:14px;height:14px}

.pw-body{padding:16px 16px 18px}

/* ══ duration picker ══ */
.pw-label{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-3,#94a3b8);margin-bottom:9px}
.pw-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px}
.pw-chip{padding:9px 0;border-radius:10px;border:1px solid var(--border-color,#e2e8f0);
  background:var(--surface-2,#f8fafc);color:var(--text-2,#475569);
  font-size:12.5px;font-weight:700;cursor:pointer;transition:.14s;font-family:inherit}
.pw-chip:hover{border-color:#c7d2fe}
.pw-chip.on{background:var(--primary,#5b5bd6);border-color:var(--primary,#5b5bd6);color:#fff}
.pw-custom{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.pw-custom input{flex:1;width:100%;padding:9px 11px;border-radius:10px;font-family:inherit;
  border:1px solid var(--border-color,#e2e8f0);background:var(--surface-2,#f8fafc);
  color:var(--text-1,#0f172a);font-size:13px;font-weight:600;outline:none}
.pw-custom input:focus{border-color:var(--primary,#5b5bd6)}
.pw-custom span{font-size:11.5px;font-weight:600;color:var(--text-3,#94a3b8)}

.pw-btn{width:100%;padding:12px;border:none;border-radius:12px;cursor:pointer;font-family:inherit;
  background:var(--primary,#5b5bd6);color:#fff;font-size:13.5px;font-weight:700;
  display:flex;align-items:center;justify-content:center;gap:7px;transition:.14s}
.pw-btn:hover{filter:brightness(1.07)}
.pw-btn:active{transform:scale(.985)}
.pw-btn svg{width:15px;height:15px}
.pw-btn.pw-ghost{background:var(--surface-2,#f1f5f9);color:var(--text-2,#475569);
  border:1px solid var(--border-color,#e2e8f0)}
.pw-btn.pw-ghost:hover{background:var(--surface-3,#e9eef5)}

/* ══ hourglass ══ */
.pw-glass-wrap{display:flex;flex-direction:column;align-items:center;gap:2px}
.pw-glass{width:118px;height:auto;display:block;overflow:visible}
.pw-glass.pw-flip{animation:pwFlip .7s cubic-bezier(.5,0,.3,1)}
@keyframes pwFlip{to{transform:rotate(180deg)}}
.pw-sand{fill:#e8b04b}
.pw-sand-dk{fill:#d29a35}
.pw-frame{fill:none;stroke:var(--text-1,#0f172a);stroke-width:3.4;
  stroke-linejoin:round;stroke-linecap:round;opacity:.82}
.pw-cap{fill:var(--text-1,#0f172a);opacity:.82}
.pw-inner{fill:rgba(148,163,184,.10)}
.pw-stream{fill:#e8b04b}
.pw-grain{fill:#e8b04b}
.pw-glass.running .pw-grain{animation:pwGrain .85s linear infinite}
.pw-glass.running .pw-grain:nth-of-type(2){animation-delay:.28s}
.pw-glass.running .pw-grain:nth-of-type(3){animation-delay:.56s}
@keyframes pwGrain{0%{opacity:0;transform:translateY(0)}
  12%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translateY(52px)}}

.pw-time{font-size:31px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
  line-height:1.1;margin-top:6px}
.pw-time.pw-final{color:#ef4444}
.pw-phase{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--text-3,#94a3b8);margin-top:1px}
.pw-controls{display:flex;gap:7px;margin-top:15px}
.pw-controls .pw-btn{padding:10px}

/* ══ fullscreen flip clock ══ */
.pw-fs{position:fixed;inset:0;z-index:10050;background:#050507;color:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;
  animation:pwFsIn .28s ease-out;-webkit-user-select:none;user-select:none}
@keyframes pwFsIn{from{opacity:0}to{opacity:1}}
.pw-fs-phase{font-size:13px;font-weight:800;letter-spacing:.42em;text-transform:uppercase;
  color:#6ee7b7;text-indent:.42em}
.pw-fs-phase.brk{color:#93c5fd}
.pw-fs-clock{display:flex;align-items:center;gap:14px}
.pw-fs-grp{display:flex;gap:8px}
.pw-fs-sep{font-size:52px;font-weight:800;color:rgba(255,255,255,.16);margin-bottom:6px}
.pw-fs-exit{position:absolute;top:26px;right:26px;width:44px;height:44px;border-radius:50%;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;
  cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
.pw-fs-exit svg{width:19px;height:19px}
.pw-fs-hint{position:absolute;bottom:30px;font-size:11px;letter-spacing:.13em;
  text-transform:uppercase;color:rgba(255,255,255,.26);font-weight:600}
.pw-fs-actions{display:flex;gap:10px}
.pw-fs-act{padding:11px 26px;border-radius:11px;border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.07);color:#fff;font-family:inherit;font-size:12.5px;
  font-weight:700;letter-spacing:.05em;cursor:pointer}
.pw-fs-act:hover{background:rgba(255,255,255,.13)}

/* split-flap card */
.pw-card{position:relative;width:92px;height:132px;border-radius:11px;
  font-size:86px;font-weight:800;line-height:132px;text-align:center;
  font-variant-numeric:tabular-nums;perspective:340px;
  box-shadow:0 14px 30px rgba(0,0,0,.55)}
.pw-card>div{position:absolute;left:0;width:100%;height:50%;overflow:hidden;
  background:#17171c;backface-visibility:hidden}
.pw-card .t,.pw-card .ft{top:0;border-radius:11px 11px 0 0;
  border-bottom:1px solid rgba(0,0,0,.62);line-height:132px}
.pw-card .b,.pw-card .fb{bottom:0;border-radius:0 0 11px 11px;line-height:0}
.pw-card .ft{transform-origin:50% 100%;z-index:3;background:#1b1b21}
.pw-card .fb{transform-origin:50% 0;z-index:2;transform:rotateX(90deg);background:#141419}
.pw-card.go .ft{animation:pwFoldT .34s cubic-bezier(.42,0,.62,1) forwards}
.pw-card.go .fb{animation:pwFoldB .34s cubic-bezier(.42,.1,.55,1) .34s forwards}
@keyframes pwFoldT{to{transform:rotateX(-90deg)}}
@keyframes pwFoldB{to{transform:rotateX(0)}}

/* sidebar button, lit while the widget is open */
.sidebar .nav-item.pw-on{background:var(--saas-ink,#0b0f17)!important;color:#fff!important;
  font-weight:600;box-shadow:0 4px 12px rgba(11,15,23,.25)}
.sidebar .nav-item.pw-on .nav-icon{color:#fff}

@media (max-width:560px){
  .pw-panel{width:min(268px,calc(100vw - 24px))}
  .pw-card{width:66px;height:96px;font-size:62px;line-height:96px}
  .pw-card .t,.pw-card .ft{line-height:96px}
  .pw-fs-clock{gap:9px}
}
@media (prefers-color-scheme:dark){
  .pw-panel{background:#15161c;color:#e8eaf0;border-color:rgba(255,255,255,.08)}
  .pw-head{background:#1b1d24;border-bottom-color:rgba(255,255,255,.06)}
}`;
        document.head.appendChild(st);
    }

    /* ── icons ────────────────────────────────────────────────────────────── */
    const I = {
        play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
        expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'
    };

    /* ── hourglass geometry ───────────────────────────────────────────────── */
    // viewBox 0 0 120 190. Top bulb 24→92, neck 92→98, bottom bulb 98→166.
    const TOP_Y0 = 24, TOP_Y1 = 92, BOT_Y0 = 98, BOT_Y1 = 166;

    function glassSVG() {
        return `
<svg class="pw-glass" viewBox="0 0 120 190">
  <defs>
    <clipPath id="pwTopClip"><path d="M22 24 H98 L63 92 H57 Z"/></clipPath>
    <clipPath id="pwBotClip"><path d="M57 98 H63 L98 166 H22 Z"/></clipPath>
  </defs>

  <path class="pw-inner" d="M22 24 H98 L63 92 H57 Z"/>
  <path class="pw-inner" d="M57 98 H63 L98 166 H22 Z"/>

  <g clip-path="url(#pwTopClip)">
    <rect class="pw-sand" id="pwSandTop" x="0" y="24" width="120" height="68"/>
  </g>

  <rect class="pw-stream" id="pwStream" x="58.4" y="92" width="3.2" height="0" opacity="0"/>

  <g clip-path="url(#pwBotClip)">
    <rect class="pw-sand" id="pwSandBot" x="0" y="166" width="120" height="0"/>
    <path class="pw-sand-dk" id="pwMound" d="M60 166 L60 166 L60 166 Z"/>
    <circle class="pw-grain" cx="60" cy="102" r="1.7"/>
    <circle class="pw-grain" cx="60" cy="102" r="1.4"/>
    <circle class="pw-grain" cx="60" cy="102" r="1.9"/>
  </g>

  <path class="pw-frame" d="M22 24 H98 L63 92 H57 Z"/>
  <path class="pw-frame" d="M57 98 H63 L98 166 H22 Z"/>
  <rect class="pw-cap" x="14" y="14" width="92" height="9" rx="4.5"/>
  <rect class="pw-cap" x="14" y="167" width="92" height="9" rx="4.5"/>
</svg>`;
    }

    // p = fraction elapsed (0 → 1). Drives sand levels, stream and mound.
    function paintGlass(p) {
        p = Math.max(0, Math.min(1, p));
        const top = document.getElementById('pwSandTop');
        const bot = document.getElementById('pwSandBot');
        const mnd = document.getElementById('pwMound');
        const str = document.getElementById('pwStream');
        if (!top) return;

        // Top bulb: surface falls toward the neck as sand runs out.
        const surf = TOP_Y0 + (TOP_Y1 - TOP_Y0) * p;
        top.setAttribute('y', surf.toFixed(2));
        top.setAttribute('height', Math.max(0, TOP_Y1 - surf).toFixed(2));

        // Bottom bulb: flat bed rises, with a cone mound heaping under the neck.
        const bedH = (BOT_Y1 - BOT_Y0) * p * 0.78;
        const bedY = BOT_Y1 - bedH;
        bot.setAttribute('y', bedY.toFixed(2));
        bot.setAttribute('height', bedH.toFixed(2));

        const peak = 15 * Math.sin(Math.PI * Math.min(1, p * 1.15)) + 3 * p;
        const halfW = 8 + 34 * p;
        mnd.setAttribute('d',
            `M${(60 - halfW).toFixed(1)} ${bedY.toFixed(1)} Q60 ${(bedY - peak).toFixed(1)} ` +
            `${(60 + halfW).toFixed(1)} ${bedY.toFixed(1)} Z`);

        // Falling stream spans neck → current bed, only while sand remains.
        const st = S();
        const flowing = st && st.isRunning && !st.isPaused && p < 0.999;
        str.setAttribute('opacity', flowing ? '1' : '0');
        str.setAttribute('y', TOP_Y1.toFixed(2));
        str.setAttribute('height', Math.max(0, bedY - TOP_Y1).toFixed(2));
    }

    /* ── panel ────────────────────────────────────────────────────────────── */
    function panel() { return document.getElementById('pomoWidget'); }

    function chosenMins() {
        const v = parseInt(localStorage.getItem(LS_MIN) || '25', 10);
        return (Number.isFinite(v) && v > 0 && v <= 600) ? v : 25;
    }

    function idleHTML() {
        const m = chosenMins();
        return `
<div class="pw-label">Session length</div>
<div class="pw-chips">
  ${PRESETS.map(p => `<button class="pw-chip${p === m ? ' on' : ''}" data-min="${p}">${p}</button>`).join('')}
</div>
<div class="pw-custom">
  <input id="pwMins" type="number" min="1" max="600" value="${m}" aria-label="Minutes">
  <span>minutes</span>
</div>
<button class="pw-btn" id="pwStart">${I.play}<span>Start focus</span></button>`;
    }

    function runHTML() {
        return `
<div class="pw-glass-wrap">
  ${glassSVG()}
  <div class="pw-time" id="pwTime">--:--</div>
  <div class="pw-phase" id="pwPhase">FOCUS</div>
</div>
<div class="pw-controls">
  <button class="pw-btn pw-ghost" id="pwToggle" title="Pause / resume"></button>
  <button class="pw-btn pw-ghost" id="pwReset" title="Reset">${I.stop}</button>
  <button class="pw-btn" id="pwFull" title="Fullscreen">${I.expand}</button>
</div>`;
    }

    function paintBody() {
        const p = panel();
        if (!p) return;
        const st = S();
        const running = !!(st && st.isRunning);
        const body = p.querySelector('.pw-body');
        const want = running ? 'run' : 'idle';
        if (body.dataset.mode !== want) {
            body.dataset.mode = want;
            body.innerHTML = running ? runHTML() : idleHTML();
            wireBody();
        }
        if (running) tick();
    }

    function wireBody() {
        const p = panel();
        if (!p) return;

        p.querySelectorAll('.pw-chip').forEach(c => c.addEventListener('click', () => {
            const v = parseInt(c.dataset.min, 10);
            localStorage.setItem(LS_MIN, String(v));
            p.querySelectorAll('.pw-chip').forEach(x => x.classList.toggle('on', x === c));
            const inp = p.querySelector('#pwMins');
            if (inp) inp.value = v;
        }));

        const inp = p.querySelector('#pwMins');
        if (inp) inp.addEventListener('input', () => {
            const v = parseInt(inp.value, 10);
            if (Number.isFinite(v) && v > 0) localStorage.setItem(LS_MIN, String(v));
            p.querySelectorAll('.pw-chip').forEach(x => x.classList.toggle('on', parseInt(x.dataset.min, 10) === v));
        });

        const go = p.querySelector('#pwStart');
        if (go) go.addEventListener('click', start);

        const tgl = p.querySelector('#pwToggle');
        if (tgl) tgl.addEventListener('click', toggle);

        const rst = p.querySelector('#pwReset');
        if (rst) rst.addEventListener('click', reset);

        const fs = p.querySelector('#pwFull');
        if (fs) fs.addEventListener('click', openFullscreen);
    }

    /* ── engine controls (never re-render a page we are not on) ───────────── */
    async function start() {
        if (!(await ensureEngine())) {
            if (typeof showToast === 'function') showToast('Pomodoro engine failed to load', 'error');
            return;
        }
        const st = S();
        const mins = chosenMins();

        st.mode = 'custom';
        st.currentPhase = 'work';
        st.linkedDuration = mins;      // savePomodoroSession() logs this duration
        st.timeRemaining = mins * 60;
        st.totalTime = mins * 60;
        st.isRunning = true;
        st.isPaused = false;

        if (typeof window._pomoStartTimerInterval === 'function') window._pomoStartTimerInterval();
        if (typeof requestPomodoroWakeLock === 'function') requestPomodoroWakeLock();
        if (onPomodoroPage() && typeof renderPomodoro === 'function') renderPomodoro();

        paintBody();
    }

    function toggle() {
        const st = S();
        if (!st) return;
        if (st.isPaused) {
            st.isPaused = false;
            if (typeof window._pomoStartTimerInterval === 'function') window._pomoStartTimerInterval();
            if (typeof requestPomodoroWakeLock === 'function') requestPomodoroWakeLock();
        } else {
            st.isPaused = true;
            clearInterval(st.timerInterval);
            if (typeof releasePomodoroWakeLock === 'function') releasePomodoroWakeLock();
        }
        if (onPomodoroPage() && typeof renderPomodoro === 'function') renderPomodoro();
        tick();
    }

    function reset() {
        const st = S();
        if (!st) return;
        clearInterval(st.timerInterval);
        st.isRunning = false;
        st.isPaused = false;
        st.currentPhase = 'work';
        st.linkedDuration = null;
        const cfg = CFG();
        const w = (cfg && cfg.work_duration) || chosenMins();
        st.timeRemaining = w * 60;
        st.totalTime = w * 60;
        if (typeof releasePomodoroWakeLock === 'function') releasePomodoroWakeLock();
        closeFullscreen();
        if (onPomodoroPage() && typeof renderPomodoro === 'function') renderPomodoro();
        paintBody();
    }

    /* ── per-frame paint ──────────────────────────────────────────────────── */
    function mmss(sec) {
        const m = Math.floor(Math.max(0, sec) / 60);
        const s = Math.max(0, sec) % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function phaseLabel(st) {
        return st.currentPhase === 'work' ? 'FOCUS'
            : st.currentPhase === 'longBreak' ? 'LONG BREAK' : 'BREAK';
    }

    function tick() {
        const st = S();
        if (!st) return;

        const p = panel();
        if (p && p.querySelector('.pw-body').dataset.mode === 'run') {
            // Engine stopped (phase finished) → fall back to the picker.
            if (!st.isRunning) { paintBody(); return; }

            const txt = mmss(st.timeRemaining);
            const tEl = p.querySelector('#pwTime');
            if (tEl && tEl.textContent !== txt) tEl.textContent = txt;
            if (tEl) tEl.classList.toggle('pw-final', st.timeRemaining <= 60);

            const phEl = p.querySelector('#pwPhase');
            if (phEl) phEl.textContent = phaseLabel(st) + (st.isPaused ? ' · PAUSED' : '');

            const tg = p.querySelector('#pwToggle');
            if (tg) {
                const want = st.isPaused ? I.play : I.pause;
                if (tg.innerHTML !== want) tg.innerHTML = want;
            }

            const g = p.querySelector('.pw-glass');
            if (g) g.classList.toggle('running', st.isRunning && !st.isPaused);

            paintGlass(st.totalTime > 0 ? (st.totalTime - st.timeRemaining) / st.totalTime : 0);
        }

        paintFullscreen(st);
    }

    function loop() {
        tick();
        raf = requestAnimationFrame(loop);
    }
    function startLoop() { if (!raf) raf = requestAnimationFrame(loop); }
    function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    /* ── dragging ─────────────────────────────────────────────────────────── */
    function clampPos(x, y, el) {
        const w = el.offsetWidth || 268, h = el.offsetHeight || 320;
        return {
            x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
            y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8))
        };
    }

    function place(el) {
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem(LS_POS) || 'null'); } catch (e) { pos = null; }
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
            pos = { x: window.innerWidth - 268 - 24, y: Math.max(24, window.innerHeight - 430) };
        }
        const c = clampPos(pos.x, pos.y, el);
        el.style.left = c.x + 'px';
        el.style.top = c.y + 'px';
    }

    function makeDraggable(el, handle) {
        let dx = 0, dy = 0, on = false;

        handle.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.pw-head-btn')) return;
            on = true;
            const r = el.getBoundingClientRect();
            dx = e.clientX - r.left;
            dy = e.clientY - r.top;
            el.classList.add('pw-dragging');
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        handle.addEventListener('pointermove', (e) => {
            if (!on) return;
            const c = clampPos(e.clientX - dx, e.clientY - dy, el);
            el.style.left = c.x + 'px';
            el.style.top = c.y + 'px';
        });

        const end = (e) => {
            if (!on) return;
            on = false;
            el.classList.remove('pw-dragging');
            try { handle.releasePointerCapture(e.pointerId); } catch (_) { }
            localStorage.setItem(LS_POS, JSON.stringify({
                x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0
            }));
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    /* ── fullscreen flip clock ────────────────────────────────────────────── */
    function card(id, d) {
        return `<div class="pw-card" id="${id}" data-d="${d}">
      <div class="t">${d}</div><div class="b">${d}</div>
      <div class="ft">${d}</div><div class="fb">${d}</div></div>`;
    }

    function openFullscreen() {
        const st = S();
        if (!st) return;
        if (document.getElementById('pwFullscreen')) return;
        ensureStyle();

        const d = mmss(st.timeRemaining).replace(':', '');
        const fs = document.createElement('div');
        fs.id = 'pwFullscreen';
        fs.className = 'pw-fs';
        fs.innerHTML = `
      <button class="pw-fs-exit" id="pwFsExit" title="Exit fullscreen (Esc)">${I.close}</button>
      <div class="pw-fs-phase" id="pwFsPhase">Focus</div>
      <div class="pw-fs-clock">
        <div class="pw-fs-grp">${card('pwD0', d[0])}${card('pwD1', d[1])}</div>
        <div class="pw-fs-sep">:</div>
        <div class="pw-fs-grp">${card('pwD2', d[2])}${card('pwD3', d[3])}</div>
      </div>
      <div class="pw-fs-actions">
        <button class="pw-fs-act" id="pwFsToggle">Pause</button>
        <button class="pw-fs-act" id="pwFsExit2">Exit</button>
      </div>
      <div class="pw-fs-hint">Press Esc to exit</div>`;
        document.body.appendChild(fs);
        lastDigits = d;

        fs.querySelector('#pwFsExit').addEventListener('click', closeFullscreen);
        fs.querySelector('#pwFsExit2').addEventListener('click', closeFullscreen);
        fs.querySelector('#pwFsToggle').addEventListener('click', toggle);
        document.addEventListener('keydown', escClose);

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
        }
        tick();
    }

    function escClose(e) { if (e.key === 'Escape') closeFullscreen(); }

    function closeFullscreen() {
        const fs = document.getElementById('pwFullscreen');
        if (fs) fs.remove();
        document.removeEventListener('keydown', escClose);
        lastDigits = '';
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        }
    }

    function flip(el, next) {
        if (!el || el.dataset.d === next) return;
        const prev = el.dataset.d;
        el.dataset.d = next;
        el.querySelector('.t').textContent = next;   // top half: new digit, revealed as the leaf folds away
        el.querySelector('.b').textContent = prev;   // bottom half: still the old digit
        el.querySelector('.ft').textContent = prev;  // folding leaf, front face — falls
        el.querySelector('.fb').textContent = next;  // folding leaf, back face — lands
        clearTimeout(el._pwT);
        el.classList.remove('go');
        void el.offsetWidth;                         // restart the animation
        el.classList.add('go');
        el._pwT = setTimeout(() => {
            // Dropping .go snaps both leaves back to their resting transforms —
            // .ft sits at rotateX(0) ON TOP of the static top half. So every face
            // has to hold the NEW digit before the class comes off, or the card
            // is left showing the previous number.
            el.querySelector('.b').textContent = next;
            el.querySelector('.ft').textContent = next;
            el.classList.remove('go');
        }, 690);
    }

    function paintFullscreen(st) {
        const fs = document.getElementById('pwFullscreen');
        if (!fs) return;
        const d = mmss(st.timeRemaining).replace(':', '');
        if (d !== lastDigits) {
            ['pwD0', 'pwD1', 'pwD2', 'pwD3'].forEach((id, i) => flip(document.getElementById(id), d[i]));
            lastDigits = d;
        }
        const ph = fs.querySelector('#pwFsPhase');
        if (ph) {
            ph.textContent = phaseLabel(st) + (st.isPaused ? ' · Paused' : '');
            ph.classList.toggle('brk', st.currentPhase !== 'work');
        }
        const tg = fs.querySelector('#pwFsToggle');
        if (tg) tg.textContent = st.isPaused ? 'Resume' : 'Pause';
    }

    /* ── open / close / toggle ────────────────────────────────────────────── */
    async function open() {
        ensureStyle();
        await ensureEngine();
        if (panel()) return;

        const el = document.createElement('div');
        el.id = 'pomoWidget';
        el.className = 'pw-panel';
        el.innerHTML = `
      <div class="pw-head" id="pwHead">
        <span class="pw-grip"><i></i><i></i><i></i></span>
        <span class="pw-title">Pomodoro</span>
        <button class="pw-head-btn" id="pwOpenPage" title="Open Pomodoro page">${I.page}</button>
        <button class="pw-head-btn" id="pwClose" title="Close">${I.close}</button>
      </div>
      <div class="pw-body"></div>`;
        document.body.appendChild(el);

        place(el);
        makeDraggable(el, el.querySelector('#pwHead'));
        el.querySelector('#pwClose').addEventListener('click', close);
        el.querySelector('#pwOpenPage').addEventListener('click', () => {
            if (typeof routeTo === 'function') routeTo('pomodoro');
        });

        window._pomoWidgetOpen = true;
        if (typeof window._pomoRenderMini === 'function') window._pomoRenderMini(); // hide the old bubble
        markNav(true);
        paintBody();
        startLoop();
    }

    function close() {
        closeFullscreen();
        const el = panel();
        if (el) el.remove();
        stopLoop();
        window._pomoWidgetOpen = false;
        if (typeof window._pomoRenderMini === 'function') window._pomoRenderMini(); // bubble may return
        markNav(false);
    }

    // routeTo() rewrites .active on every .nav-item, so the open-state highlight
    // rides on its own class that navigation will not strip.
    function markNav(on) {
        const n = document.getElementById('navPomodoro');
        if (n) n.classList.toggle('pw-on', !!on);
    }

    window.togglePomoWidget = function () {
        if (panel()) close(); else open();
    };
    window.openPomoWidget = open;
    window.closePomoWidget = close;

    // Keep the panel on-screen when the window is resized.
    window.addEventListener('resize', () => {
        const el = panel();
        if (!el) return;
        const c = clampPos(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0, el);
        el.style.left = c.x + 'px';
        el.style.top = c.y + 'px';
    });
})();
