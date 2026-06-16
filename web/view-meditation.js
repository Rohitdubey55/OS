/* view-meditation.js — Evidence-Based Guided Meditation Tool
   ═══════════════════════════════════════════════════════════════
   Structure based on clinical Yoga Nidra / NSDR (Non-Sleep Deep Rest) protocol:

   1. SETTLING & INTENTION (Sankalpa) — Self-affirmation theory: stating intentions
      in a relaxed state activates ventromedial prefrontal cortex (self-processing)
   2. BODY SCAN — Progressive relaxation reduces sympathetic nervous system activity,
      activates parasympathetic response (clinically validated in PMC9033521)
   3. BREATH AWARENESS — 4-7-8 breathing pattern stimulates vagus nerve,
      triggers relaxation response (Huberman Lab NSDR protocol)
   4. AFFIRMATION INTEGRATION — Theta brainwave state (4-8Hz) is optimal for
      affirmation absorption (neuroplasticity research, Nature 2024)
   5. VISUALIZATION — Guided imagery activates same neural pathways as real experience
      (PositivePsychology.com evidence base)
   6. RETURN — Gentle reorientation preserving the meditative benefits

   Binaural beats: 200Hz carrier (Oster Curve optimal for theta perception)
   Ramp: 10Hz alpha (settling) → 6Hz theta (body scan) → 5Hz deep theta (affirmations) → 7Hz (visualization) → 10Hz (return)
   ═══════════════════════════════════════════════════════════════ */

// ═══ MEDITATION GUIDE PHRASES ═══
// All phrases pre-generated via Gemini TTS and cached in IDB
const MEDITATION_PHRASES = [
  // Phase 1: Settling
  'Welcome. Find a comfortable position and gently close your eyes.',
  'Allow your body to become still. There is nothing you need to do right now.',
  'Set an intention for this practice. What do you wish to cultivate within yourself?',
  // Phase 2: Body Scan
  'Bring your awareness to the top of your head. Notice any sensation there.',
  'Let your attention flow down to your forehead, your eyes, your jaw. Soften each area.',
  'Feel your shoulders releasing any tension they have been carrying.',
  'Notice your chest, your belly, rising and falling with each breath.',
  'Bring awareness to your hands, your legs, all the way down to the soles of your feet.',
  'Your entire body is relaxed. Heavy. Supported.',
  // Phase 3: Breath Awareness (4-7-8 pattern)
  'Now bring your attention to your breath.',
  'Breathe in through your nose for four counts.',
  'Hold gently for seven counts.',
  'Exhale slowly through your mouth for eight counts.',
  // Phase 4: Affirmation Integration
  'You are now in a deeply receptive state. Your mind is open and still.',
  'Listen to each affirmation. Feel it as already true. Let it become part of you.',
  'Allow this truth to settle into your body.',
  // Phase 5: Visualization
  'Now picture yourself living this reality. See it clearly in your mind.',
  'Notice the colors, the sounds, the feelings. Make it vivid and real.',
  'This vision is not a wish. It is a memory from your future self.',
  // Phase 6: Return
  'Begin to deepen your breath. Feel the surface beneath you.',
  'Gently wiggle your fingers and toes.',
  'When you are ready, slowly open your eyes. Carry this peace with you.',
  'Namaste.'
];

// ═══ MEDITATION STATE ═══
window._meditation = null;

// ═══ LAUNCH ═══
window.startGuidedMeditation = async function() {
  if (document.getElementById('meditationPlayer')) return;

  const affs = (state.data.vision_affirmations || [])
    .filter(a => a.text && a.text.trim())
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (affs.length === 0) {
    showToast('No affirmations found. Add some in your Vision board first.', 'warning');
    return;
  }

  window._meditation = {
    affs, phase: 'loading', paused: false, closed: false,
    currentIdx: -1, startTime: Date.now()
  };

  // ── iOS: Start keepalive + AudioContext IMMEDIATELY in tap gesture ──
  // Must happen synchronously in the onclick callstack or iOS blocks it
  window._meditation._keepAliveAudio = true; // flag for _medSleep to use audio-based timers
  startRitualKeepAlive();
  RitualAudioEngine.start('ocean');
  // Binaural already at 0.20 (research-backed). Start with 10Hz alpha for settling phase,
  // will ramp down to 5-6Hz theta during body scan/affirmations (Oster Curve optimal)
  RitualAudioEngine.transition(10, 'ocean', 8);

  // Duration estimate: settling 90s + body scan 60s + breathing 80s + affs 30s each + visualization 40s + return 30s
  const estMins = Math.ceil((300 + affs.length * 30) / 60);

  const overlay = document.createElement('div');
  overlay.id = 'meditationPlayer';
  overlay.className = 'meditation-overlay';
  overlay.innerHTML = `
    <div class="meditation-bg"></div>
    <button class="meditation-close-btn" onclick="closeMeditation()">✕</button>
    <div class="meditation-center">
      <div class="meditation-title">Guided Meditation</div>
      <div class="meditation-subtitle" id="medSubtitle">${affs.length} affirmations · ~${estMins} min</div>
      <div class="meditation-current" id="medCurrentText"></div>
      <div class="meditation-progress-wrap">
        <div class="meditation-progress-bar" id="medProgressBar"></div>
      </div>
      <div class="meditation-controls">
        <button class="meditation-ctrl-btn" id="medPlayPauseBtn" onclick="meditationPlayPause()">
          <span id="medPlayIcon">⏸</span>
        </button>
      </div>
      <div class="meditation-phase" id="medPhaseLabel">Preparing...</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Pre-load affirmation audio from IDB
  await _meditationPreloadAudio(affs);

  // Pre-generate all meditation guide phrases via Gemini TTS
  try {
    await _preGenerateMeditationVoices((msg) => {
      const sub = document.getElementById('medSubtitle');
      if (sub) sub.textContent = msg;
    });
  } catch(e) {
    console.warn('[Meditation] Voice generation error:', e);
  }

  const sub = document.getElementById('medSubtitle');
  if (sub) sub.textContent = `${affs.length} affirmations · ~${estMins} min`;

  // (RitualAudioEngine + keepalive already started above in gesture callstack)

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Guided Meditation',
      artist: 'PersonalOS',
      album: 'Daily Practice'
    });
    navigator.mediaSession.setActionHandler('play', () => meditationPlayPause());
    navigator.mediaSession.setActionHandler('pause', () => meditationPlayPause());
  }

  runMeditationSequence(affs);
};

// ═══ AUDIO PRELOAD ═══
async function _meditationPreloadAudio(affs) {
  window._ritualAudioCache = window._ritualAudioCache || {};
  for (const aff of affs) {
    if (window._ritualAudioCache[aff.id]) continue;
    try {
      const stored = await _VisionIDB.get('audio://' + aff.id);
      if (stored && stored.buffer) {
        const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
        window._ritualAudioCache[aff.id] = URL.createObjectURL(blob);
      }
    } catch(e) {}
  }
}

// ═══ MEDITATION SEQUENCE (Yoga Nidra / NSDR Protocol) ═══
async function runMeditationSequence(affs) {
  const m = window._meditation;
  if (!m) return;
  const alive = () => !m.closed && document.getElementById('meditationPlayer');
  // Total steps: settling(1) + bodyscan(1) + breathing(1) + affs + visualization(1) + return(1)
  const totalSteps = affs.length + 5;
  let currentStep = 0;

  function updateProgress() {
    currentStep++;
    const bar = document.getElementById('medProgressBar');
    if (bar) bar.style.width = `${Math.round((currentStep / totalSteps) * 100)}%`;
  }

  function showText(text) {
    const el = document.getElementById('medCurrentText');
    if (el) { el.style.opacity = '0'; setTimeout(() => { el.textContent = text; el.style.opacity = '1'; }, 300); }
  }

  function showPhase(text) {
    const el = document.getElementById('medPhaseLabel');
    if (el) el.textContent = text;
  }

  async function waitWhilePaused() {
    while (m.paused && !m.closed) await _medSleep(200);
  }

  // Helper: speak + show + pause (the core meditation rhythm)
  async function guide(text, pauseAfter = 3000) {
    if (!alive()) return;
    await waitWhilePaused();
    showText(text.replace(/\.$/, ''));
    await _medSpeak(text);
    if (pauseAfter > 0) await _medSleep(pauseAfter);
  }

  // ═══ PHASE 1: SETTLING & SANKALPA (Intention Setting) ═══
  // Self-affirmation theory: stating intentions during relaxation activates
  // ventromedial prefrontal cortex for self-processing and valuation
  m.phase = 'settling';
  showPhase('Settling In');

  await guide('Welcome. Find a comfortable position and gently close your eyes.', 4000);
  if (!alive()) return;

  await guide('Allow your body to become still. There is nothing you need to do right now.', 5000);
  if (!alive()) return;

  // Sankalpa — the yogic intention, planted in receptive state
  await guide('Set an intention for this practice. What do you wish to cultivate within yourself?', 8000);
  if (!alive()) return;

  updateProgress();

  // ═══ PHASE 2: BODY SCAN ═══
  // Progressive muscle relaxation activates parasympathetic nervous system
  // Clinically validated: reduces cortisol, increases vagal tone (PMC9033521)
  m.phase = 'bodyscan';
  showPhase('Body Scan');
  RitualAudioEngine.transition(6, 'ocean', 8); // Ramp from 10Hz alpha → 6Hz theta over 8s

  await guide('Bring your awareness to the top of your head. Notice any sensation there.', 5000);
  if (!alive()) return;

  await guide('Let your attention flow down to your forehead, your eyes, your jaw. Soften each area.', 5000);
  if (!alive()) return;

  await guide('Feel your shoulders releasing any tension they have been carrying.', 5000);
  if (!alive()) return;

  await guide('Notice your chest, your belly, rising and falling with each breath.', 5000);
  if (!alive()) return;

  await guide('Bring awareness to your hands, your legs, all the way down to the soles of your feet.', 5000);
  if (!alive()) return;

  await guide('Your entire body is relaxed. Heavy. Supported.', 6000);
  if (!alive()) return;

  updateProgress();

  // ═══ PHASE 3: BREATH AWARENESS (4-7-8 Pattern) ═══
  // 4-7-8 breathing stimulates vagus nerve, activates parasympathetic response
  // Extended exhale is key: forces CO2 buildup → triggers calming reflex
  m.phase = 'breathing';
  showPhase('Breath Awareness');

  await guide('Now bring your attention to your breath.', 3000);
  if (!alive()) return;

  // 3 cycles of 4-7-8 breathing
  for (let c = 0; c < 3; c++) {
    if (!alive()) return;
    await waitWhilePaused();

    // Inhale 4 counts
    showText('Breathe in... 4 counts');
    await _medSpeak('Breathe in through your nose for four counts.');
    RitualAudioEngine.playBreathCue('inhale');
    for (let t = 4; t >= 1; t--) {
      await _medSleep(1000);
      if (!alive()) return;
    }

    // Hold 7 counts
    showText('Hold gently... 7 counts');
    if (c === 0) await _medSpeak('Hold gently for seven counts.');
    RitualAudioEngine.playBreathCue('hold');
    for (let t = 7; t >= 1; t--) {
      await _medSleep(1000);
      if (!alive()) return;
    }

    // Exhale 8 counts
    showText('Exhale slowly... 8 counts');
    if (c === 0) await _medSpeak('Exhale slowly through your mouth for eight counts.');
    RitualAudioEngine.playBreathCue('exhale');
    for (let t = 8; t >= 1; t--) {
      await _medSleep(1000);
      if (!alive()) return;
    }

    await _medSleep(1000);
  }

  updateProgress();

  // ═══ PHASE 4: AFFIRMATION INTEGRATION ═══
  // Theta brainwave state (4-8Hz) is optimal for affirmation absorption
  // The brain is most receptive during deep relaxation (neuroplasticity window)
  // Each affirmation: hear → silence (internalize) → hear again slower → long pause (embed)
  m.phase = 'affirmations';
  showPhase('Affirmations');
  RitualAudioEngine.transition(5, null, 6); // 5Hz deep theta — maximum suggestibility for affirmation absorption

  await guide('You are now in a deeply receptive state. Your mind is open and still.', 4000);
  if (!alive()) return;

  await guide('Listen to each affirmation. Feel it as already true. Let it become part of you.', 5000);
  if (!alive()) return;

  for (let i = 0; i < affs.length; i++) {
    if (!alive()) return;
    await waitWhilePaused();
    m.currentIdx = i;
    const aff = affs[i];
    const cleanText = aff.text.replace(/\*/g, '').trim();
    const theme = (aff.bg_style || 'ocean').toLowerCase();

    RitualAudioEngine.playSoftTone();
    if (i % 3 === 0 && i > 0) RitualAudioEngine.transition(6, theme, 5);

    showPhase(`Affirmation ${i + 1} of ${affs.length}`);
    showText(cleanText);

    await _medSleep(2000);

    // First hearing: confident pace — plants the seed
    await _medSpeakAffirmation(cleanText, aff.id, 0.85);
    if (!alive()) return;

    // Silence for internalization (self-affirmation theory: processing time matters)
    await _medSleep(4000);
    if (!alive()) return;

    // Integration cue
    await guide('Allow this truth to settle into your body.', 3000);
    if (!alive()) return;

    // Second hearing: slower, deeper — reinforcement through repetition
    await _medSpeakAffirmation(cleanText, aff.id, 0.70);
    if (!alive()) return;

    // Long contemplation pause — theta state absorption
    await _medSleep(5000);

    updateProgress();
  }

  if (!alive()) return;

  // ═══ PHASE 5: VISUALIZATION ═══
  // Guided imagery: brain cannot distinguish imagined from real experience
  // Activates same motor/sensory cortex as lived experience (mirror neurons)
  m.phase = 'visualization';
  showPhase('Visualization');
  RitualAudioEngine.transition(7, 'deep', 6); // 7Hz high theta — optimal for vivid mental imagery

  await guide('Now picture yourself living this reality. See it clearly in your mind.', 8000);
  if (!alive()) return;

  await guide('Notice the colors, the sounds, the feelings. Make it vivid and real.', 8000);
  if (!alive()) return;

  await guide('This vision is not a wish. It is a memory from your future self.', 10000);
  if (!alive()) return;

  updateProgress();

  // ═══ PHASE 6: RETURN (Gentle Reorientation) ═══
  // Gradual return preserves parasympathetic activation and theta benefits
  m.phase = 'return';
  showPhase('Returning');
  RitualAudioEngine.transition(10, 'dawn', 8); // 10Hz alpha — gentle bridge back to calm wakefulness

  await guide('Begin to deepen your breath. Feel the surface beneath you.', 5000);
  if (!alive()) return;

  // One grounding breath
  showText('Deep breath in...');
  RitualAudioEngine.playBreathCue('inhale');
  await _medSleep(4000);
  showText('And release...');
  RitualAudioEngine.playBreathCue('exhale');
  await _medSleep(4000);
  if (!alive()) return;

  await guide('Gently wiggle your fingers and toes.', 4000);
  if (!alive()) return;

  await guide('When you are ready, slowly open your eyes. Carry this peace with you.', 5000);
  if (!alive()) return;

  showText('Namaste');
  await _medSpeak('Namaste.');
  await _medSleep(3000);

  updateProgress();
  showPhase('Complete');

  // Fade out
  RitualAudioEngine.fadeOut(4);
  await _medSleep(5000);

  closeMeditation();
}

// ═══ HELPERS ═══
// iOS suspends setTimeout when screen is locked, but <audio>.onended still fires.
// So we chain a tiny silent audio clip as our "timer" to survive background mode.
function _medSleep(ms) {
  return new Promise(resolve => {
    // Use an Audio element "timer" that iOS won't suspend
    if (window._meditation?._keepAliveAudio) {
      // Create a silent WAV of the desired duration
      const sr = 8000;
      const numSamples = Math.max(sr, Math.round(sr * ms / 1000)); // at least 1s
      const header = new ArrayBuffer(44);
      const v = new DataView(header);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + numSamples, true);
      w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr, true);
      v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      w(36, 'data'); v.setUint32(40, numSamples, true);
      const samples = new Uint8Array(numSamples).fill(128);
      // Add faint noise so iOS doesn't optimize it away
      for (let i = 0; i < numSamples; i += 100) samples[i] = 129;
      const blob = new Blob([header, samples], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.01;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        // Fallback to setTimeout if audio play fails
        setTimeout(resolve, ms);
      });
    } else {
      setTimeout(resolve, ms);
    }
  });
}

// Play voice via <audio> element (NOT AudioContext) — survives iOS background/lock
async function _medPlayAudio(blobUrl, opts = {}) {
  const { volume = 0.92, playbackRate = 1.0 } = opts;
  return new Promise(resolve => {
    const audio = new Audio(blobUrl);
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    window._ritualCurrentAudio = audio;
    let resolved = false;
    const done = () => {
      if (!resolved) { resolved = true; window._ritualCurrentAudio = null; resolve(); }
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(() => done());
  });
}

async function _medSpeak(phrase) {
  if (window._meditation?.closed) return;
  const cachedUrl = window._ritualGuideCache?.[phrase];
  if (cachedUrl) {
    return _medPlayAudio(cachedUrl, { volume: 0.92 });
  }
  // Fallback to browser TTS
  return speakText(phrase, 0.72, 'guide');
}

async function _medSpeakAffirmation(text, affId, rate) {
  if (window._meditation?.closed) return;
  const cachedUrl = window._ritualAudioCache?.[affId];
  if (cachedUrl) {
    return _medPlayAudio(cachedUrl, { volume: 0.92, playbackRate: rate > 0.9 ? 1.0 : 0.92 });
  }
  return speakText(text, rate, 'calm');
}

// ═══ MEDITATION VOICE PRE-GENERATION ═══
async function _preGenerateMeditationVoices(onProgress) {
  const apiKey = _getGeminiKey();
  if (!apiKey) { console.warn('[Meditation] No API key, will use fallback TTS'); return; }
  const voiceCfg = _getVoiceConfig();
  window._ritualGuideCache = window._ritualGuideCache || {};

  // Collect all phrases that need generation
  const toGenerate = [];
  for (const phrase of MEDITATION_PHRASES) {
    const idbKey = 'guide-voice://' + phrase;
    if (window._ritualGuideCache[phrase]) continue;
    try {
      const existing = await _VisionIDB.get(idbKey);
      if (existing && existing.buffer) {
        const blob = new Blob([existing.buffer], { type: existing.type || 'audio/wav' });
        window._ritualGuideCache[phrase] = URL.createObjectURL(blob);
        continue;
      }
    } catch(e) {}
    toGenerate.push(phrase);
  }

  if (toGenerate.length === 0) return;
  if (onProgress) onProgress(`Generating ${toGenerate.length} meditation voice clips...`);

  const BATCH = 3;
  for (let i = 0; i < toGenerate.length; i += BATCH) {
    const batch = toGenerate.slice(i, i + BATCH);
    if (onProgress) onProgress(`Generating voices ${i + 1}-${Math.min(i + BATCH, toGenerate.length)}/${toGenerate.length}...`);
    await Promise.all(batch.map(async (phrase) => {
      const idbKey = 'guide-voice://' + phrase;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const wavBlob = await _generateGeminiGuideTTS(phrase, voiceCfg.voiceId, apiKey);
          const buf = await wavBlob.arrayBuffer();
          await _VisionIDB.put(idbKey, { type: 'audio/wav', buffer: buf });
          window._ritualGuideCache[phrase] = URL.createObjectURL(wavBlob);
          console.log('[Meditation Voice] Generated:', phrase.substring(0, 40));
          return;
        } catch(e) {
          console.warn('[Meditation Voice] Attempt', attempt + 1, 'failed:', phrase.substring(0, 30), e.message);
        }
      }
    }));
  }
}

// ═══ CONTROLS ═══
window.meditationPlayPause = function() {
  const m = window._meditation;
  if (!m) return;
  m.paused = !m.paused;
  const icon = document.getElementById('medPlayIcon');
  if (icon) icon.textContent = m.paused ? '▶' : '⏸';

  if (m.paused) {
    if (RitualAudioEngine.ctx?.state === 'running') RitualAudioEngine.ctx.suspend();
    stopSpeaking();
  } else {
    if (RitualAudioEngine.ctx?.state === 'suspended') RitualAudioEngine.ctx.resume();
  }
};

window.closeMeditation = function() {
  if (window._meditation) {
    window._meditation.closed = true;
    window._meditation = null;
  }
  stopSpeaking();
  stopRitualKeepAlive();
  RitualAudioEngine.fadeOut(1);
  setTimeout(() => RitualAudioEngine.stop(), 1200);

  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;

  const el = document.getElementById('meditationPlayer');
  if (el) {
    el.classList.remove('visible');
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 600);
  }
};
