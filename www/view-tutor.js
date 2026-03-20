/* view-tutor.js — English Tutor: Real-Time Voice Conversation with Gemini */

/* ── State ── */
let _tutor = {
  sessionId: null,
  sessionStart: null,
  messages: [],       // {role, content, timestamp}
  ws: null,
  isConnected: false,
  isListening: false,
  isSpeaking: false,
  topic: null,
  micStream: null,
  inputAudioCtx: null,
  processorNode: null,
  playbackCtx: null,
  audioQueue: [],
  isPlayingAudio: false,
  currentSource: null,
  sessionActive: false
};

/* ── Topics ── */
const TUTOR_TOPICS = [
  { id: 'business',     label: 'Business English',   icon: '💼', desc: 'Meetings, emails, negotiations' },
  { id: 'conversation', label: 'Daily Conversation', icon: '💬', desc: 'Casual talk, small talk, social' },
  { id: 'grammar',      label: 'Grammar Practice',   icon: '✍️', desc: 'Tenses, articles, prepositions' },
  { id: 'interview',    label: 'Interview Prep',     icon: '🎯', desc: 'Job interviews, HR questions' },
  { id: 'idioms',       label: 'Idioms & Phrases',   icon: '🌍', desc: 'Native expressions, phrasal verbs' },
  { id: 'presentation', label: 'Presentations',      icon: '📊', desc: 'Public speaking, pitching ideas' },
  { id: 'writing',      label: 'Writing Skills',     icon: '📝', desc: 'Emails, reports, essays' },
  { id: 'free',         label: 'Free Practice',      icon: '🎤', desc: 'Talk about anything' },
];

/* ── System Prompt ── */
const TUTOR_SYSTEM_PROMPT = `You are "Coach" — an elite English communication coach who combines Cambridge and British Council methodology with cutting-edge learning psychology. You are having a REAL VOICE CONVERSATION with the student. Speak naturally, warmly, and clearly.

## YOUR IDENTITY
- Warm but professionally demanding. Never condescending.
- Speak at a natural pace — slightly slower than normal conversation.
- Use short, clear sentences. Pause between ideas.
- Celebrate effort. Correct errors firmly but kindly.
- You are NOT a chatbot. You are a real conversation partner and teacher.

## PSYCHOLOGICAL TECHNIQUES (use naturally, never mention them by name)

1. SPACED REPETITION: Track errors the student makes. Naturally reintroduce those problem patterns 5-6 turns later in a new context to test if they learned.

2. SCAFFOLDED CORRECTION (Vygotsky's Zone of Proximal Development):
   - First attempt: Hint — "Hmm, can you rephrase that last part?"
   - Second attempt: Guide — "Think about the verb tense — when did this happen?"
   - Third attempt: Provide the correct form with a brief, clear explanation.
   Never jump straight to the answer. Let them struggle productively.

3. DESIRABLE DIFFICULTY (Robert Bjork): Push slightly beyond their comfort zone. If present tense is easy, shift to conditionals without warning. If basic vocab is fine, introduce sophisticated synonyms.

4. GROWTH MINDSET FRAMING (Carol Dweck): Never say "wrong" or "incorrect." Say "almost" or "not quite — here's the shift." Frame errors as progress: "That's a sophisticated attempt — the small adjustment is..."

5. ELABORATIVE INTERROGATION: After corrections, ask "Why do you think it works this way?" to deepen understanding and make the rule stick.

6. THE TESTING EFFECT: Every 5-6 exchanges, do a quick recall quiz on concepts covered earlier: "Quick — use 'would have' in a sentence about a missed opportunity."

7. INTERLEAVING: Mix grammar, vocabulary, pronunciation tips, and fluency within the same conversation. Switch between formal and informal registers.

8. EMOTIONAL ANCHORING: Connect language to emotions and real experiences. "Tell me about a time you felt really proud" — this creates stronger memory encoding.

9. METACOGNITIVE PROMPTING: Occasionally ask "What pattern do you notice?" or "How is this different from what we practiced earlier?" to build self-awareness.

## CONVERSATION RULES
- Keep responses SHORT — 2-4 sentences maximum. This is voice, not text.
- Ask ONE question at a time. Wait for their answer.
- Use real-world scenarios: job interviews, presentations, social situations, travel, debates.
- Adapt difficulty to their DEMONSTRATED level, not what they claim.
- When correcting: say the correct form naturally in conversation, then briefly explain why.
- Every ~8-10 exchanges, give brief progress feedback: what improved, what to focus on.
- Be genuinely curious about their life — ask follow-up questions that require complex English.
- Vary your question types: open-ended, role-play, fill-the-blank, rephrase challenges.

## PAST SESSION DATA (for continuity and personalization)
{PAST_SESSIONS}

## TODAY'S FOCUS: {TOPIC}

Begin by warmly greeting the student. If they have past sessions, reference specific progress or areas to revisit. If new, ask what they'd like to work on. Keep the energy positive and engaging.`;

/* ── Helper: Get API key from settings ── */
function _tutorGetKey() {
  const s = state.data.settings?.[0] || {};
  return s.ai_api_key || '';
}

function _tutorGetVoice() {
  const s = state.data.settings?.[0] || {};
  return s.tts_voice_id || 'Sulafat';
}

/* ═══════════════════════════════
   RENDER — Entry Point
═══════════════════════════════ */
function renderTutor() {
  const main = document.getElementById('main');
  if (!main) return;

  // Load past sessions
  const sessions = (state.data.english_sessions || [])
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const pastHtml = sessions.length > 0
    ? sessions.slice(0, 5).map(s => {
        const dur = Math.round((s.duration_seconds || 0) / 60);
        const d = s.date ? new Date(s.date).toLocaleDateString() : '';
        return `<div class="tutor-session-card">
          <div class="tutor-session-card__top">
            <span class="tutor-session-card__topic">${_escTutor(s.topic || 'Free Practice')}</span>
            <span class="tutor-session-card__date">${d}</span>
          </div>
          <div class="tutor-session-card__meta">${dur}min · ${s.message_count || 0} exchanges</div>
          ${s.weak_areas ? `<div class="tutor-session-card__weak">Focus: ${_escTutor(s.weak_areas)}</div>` : ''}
        </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">No sessions yet. Start your first conversation!</p>';

  main.innerHTML = `
    <div class="tutor-shell" id="tutorShell">
      <!-- Pre-Session View -->
      <div class="tutor-presession" id="tutorPresession">
        <div class="tutor-header">
          <h2 class="tutor-title">${typeof renderIcon === 'function' ? renderIcon('languages', null, 'style="width:28px"') : '🎓'} English Tutor</h2>
          <p class="tutor-subtitle">Real-time voice conversation with your AI coach</p>
        </div>

        <div class="tutor-topic-section">
          <h3 class="tutor-section-label">Choose a topic</h3>
          <div class="tutor-topic-grid">
            ${TUTOR_TOPICS.map(t => `
              <button class="tutor-topic-chip" onclick="startTutorSession('${t.id}')">
                <span class="tutor-topic-icon">${t.icon}</span>
                <span class="tutor-topic-label">${t.label}</span>
                <span class="tutor-topic-desc">${t.desc}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="tutor-past-section">
          <h3 class="tutor-section-label">Recent Sessions</h3>
          <div class="tutor-past-list">${pastHtml}</div>
        </div>
      </div>

      <!-- Active Session View (hidden initially) -->
      <div class="tutor-active hidden" id="tutorActive">
        <div class="tutor-active-header">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span class="tutor-active-topic" id="tutorActiveTopic" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <span class="tutor-active-timer" id="tutorTimer">00:00</span>
          </div>
          <button class="tutor-end-btn" onclick="endTutorSession()">End</button>
        </div>

        <div class="tutor-voice-area">
          <div class="tutor-mic-ring" id="tutorMicRing">
            <div class="tutor-mic-circle tutor-mic--idle" id="tutorMicCircle">
              <span class="tutor-mic-icon" id="tutorMicIcon">🎙</span>
            </div>
          </div>
          <div class="tutor-status" id="tutorStatus">Connecting...</div>
          <button class="tutor-talk-btn" id="tutorTalkBtn"
                  ontouchstart="tutorStartTalking(event)" ontouchend="tutorStopTalking(event)"
                  onmousedown="tutorStartTalking(event)" onmouseup="tutorStopTalking(event)"
                  oncontextmenu="return false">
            Hold to Speak
          </button>
          <div class="tutor-talk-hint" id="tutorTalkHint">Hold the button while you speak, release when done</div>
        </div>

        <div class="tutor-transcript" id="tutorTranscript">
          <div class="tutor-transcript-inner" id="tutorTranscriptInner"></div>
        </div>
      </div>

      <!-- Session End Summary (hidden initially) -->
      <div class="tutor-summary hidden" id="tutorSummary"></div>
    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

/* ═══════════════════════════════
   SESSION START
═══════════════════════════════ */
window.startTutorSession = async function(topicId) {
  const apiKey = _tutorGetKey();
  if (!apiKey) { showToast('Set Gemini API key in Settings → AI', 'error'); return; }

  const topic = TUTOR_TOPICS.find(t => t.id === topicId) || TUTOR_TOPICS[7];

  // ── iOS FIX: Request mic permission IMMEDIATELY in the user tap handler ──
  // getUserMedia MUST be called directly in the gesture callstack on iOS
  let micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (e) {
    showToast('Microphone access denied — check Settings → Safari → Microphone', 'error');
    return;
  }

  // Also create/resume AudioContext in the gesture handler (iOS requires this)
  const playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  if (playbackCtx.state === 'suspended') await playbackCtx.resume();
  _tutor.playbackCtx = playbackCtx;

  _tutor.topic = topic.label;
  _tutor.sessionStart = Date.now();
  _tutor.messages = [];
  _tutor.audioQueue = [];
  _tutor.isPlayingAudio = false;
  _tutor.sessionActive = true;
  _tutor.micStream = micStream; // Store the stream obtained in gesture

  // Switch UI
  const pre = document.getElementById('tutorPresession');
  const active = document.getElementById('tutorActive');
  if (pre) pre.classList.add('hidden');
  if (active) active.classList.remove('hidden');

  const topicEl = document.getElementById('tutorActiveTopic');
  if (topicEl) topicEl.textContent = `${topic.icon} ${topic.label}`;

  setTutorStatus('Connecting...');
  startTutorTimer();

  // Build past session context
  const pastCtx = buildPastSessionsContext();

  // Connect WebSocket (mic stream already obtained above)
  try {
    await connectTutorWS(topic.label, pastCtx);
  } catch (e) {
    setTutorStatus('Connection failed — ' + (e.message || 'unknown'));
    showToast('Could not connect to AI: ' + e.message, 'error');
  }
};

/* ═══════════════════════════════
   WEBSOCKET — Bidirectional Voice
═══════════════════════════════ */
function connectTutorWS(topic, pastCtx) {
  return new Promise((resolve, reject) => {
    const apiKey = _tutorGetKey();
    const voiceId = _tutorGetVoice();
    const prompt = TUTOR_SYSTEM_PROMPT
      .replace('{PAST_SESSIONS}', pastCtx || 'No previous sessions. This is a new student.')
      .replace('{TOPIC}', topic || 'Free Practice');

    const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    let ws;
    try { ws = new WebSocket(WS_URL); } catch(e) { return reject(e); }
    _tutor.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } }
            }
          },
          systemInstruction: { parts: [{ text: prompt }] },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: true
            }
          }
        }
      }));
    };

    let setupDone = false;

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) raw = await raw.text();
        const msg = JSON.parse(raw);

        // Setup complete — start mic
        if (msg.setupComplete) {
          setupDone = true;
          _tutor.isConnected = true;
          setTutorStatus('Setting up microphone...');
          try {
            await startTutorMic(ws);
            setTutorStatus('Ready! Hold the button to speak');
            setMicState('idle');
            const btn = document.getElementById('tutorTalkBtn');
            if (btn) btn.style.display = '';
          } catch(e) {
            setTutorStatus('Mic setup failed — ' + (e.message || 'unknown'));
            showToast('Microphone error: ' + e.message, 'error');
          }
          resolve();
          return;
        }

        // AI audio response chunks → queue for playback
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              queueTutorAudio(part.inlineData.data);
            }
          }
        }

        // Transcription of AI's speech
        if (msg.serverContent?.outputTranscription?.text) {
          const txt = msg.serverContent.outputTranscription.text;
          if (txt.trim()) appendTutorTranscript('coach', txt);
        }

        // Transcription of user's speech
        if (msg.serverContent?.inputTranscription?.text) {
          const txt = msg.serverContent.inputTranscription.text;
          if (txt.trim()) appendTutorTranscript('user', txt);
        }

        // Turn complete — AI done speaking, finalize coach bubble
        if (msg.serverContent?.turnComplete) {
          _finalizeTutorBubble('coach');
          _tutorLiveText = '';
          _tutorLastRole = null;
          setTutorStatus('🎙 Listening... your turn');
          setMicState('listening');
        }
      } catch(e) {
        console.warn('[Tutor WS] parse error', e);
      }
    };

    ws.onerror = () => {
      if (!setupDone) reject(new Error('WebSocket error'));
      setTutorStatus('Connection error');
      setMicState('idle');
    };

    ws.onclose = (e) => {
      _tutor.isConnected = false;
      if (!setupDone) reject(new Error('Connection closed: ' + (e.reason || e.code)));
      if (_tutor.sessionActive) {
        setTutorStatus('Disconnected — session ended');
        setMicState('idle');
      }
    };
  });
}

/* ═══════════════════════════════
   MICROPHONE CAPTURE (16kHz PCM)
═══════════════════════════════ */
async function startTutorMic(ws) {
  // Use the stream already obtained in the user gesture handler
  const stream = _tutor.micStream;
  if (!stream) throw new Error('No microphone stream available');

  // iOS doesn't support AudioContext at 16kHz — use native sample rate and downsample
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  _tutor.inputAudioCtx = audioCtx;
  const nativeSampleRate = audioCtx.sampleRate; // 44100 or 48000 on iOS
  const targetRate = 16000;
  const downsampleRatio = Math.round(nativeSampleRate / targetRate);

  const source = audioCtx.createMediaStreamSource(stream);

  // Use larger buffer for iOS stability
  const bufSize = 4096;
  const processor = audioCtx.createScriptProcessor(bufSize, 1, 1);
  _tutor.processorNode = processor;

  processor.onaudioprocess = (e) => {
    if (!_tutor.isListening || !ws || ws.readyState !== WebSocket.OPEN) return;

    const float32 = e.inputBuffer.getChannelData(0);

    // Downsample from native rate (44.1k/48k) to 16kHz
    const outLen = Math.floor(float32.length / downsampleRatio);
    const int16 = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const s = Math.max(-1, Math.min(1, float32[i * downsampleRatio]));
      int16[i] = s < 0 ? s * 32768 : s * 32767;
    }

    // Base64 encode
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    const base64 = btoa(binary);

    ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          data: base64,
          mimeType: 'audio/pcm;rate=16000'
        }]
      }
    }));
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);
  _tutor.isListening = false; // Don't auto-listen; wait for push-to-talk
}

function stopTutorMic() {
  _tutor.isListening = false;
  if (_tutor.processorNode) {
    try { _tutor.processorNode.disconnect(); } catch(e) {}
    _tutor.processorNode = null;
  }
  if (_tutor.inputAudioCtx) {
    try { _tutor.inputAudioCtx.close(); } catch(e) {}
    _tutor.inputAudioCtx = null;
  }
  if (_tutor.micStream) {
    _tutor.micStream.getTracks().forEach(t => t.stop());
    _tutor.micStream = null;
  }
}

/* ═══════════════════════════════
   AUDIO PLAYBACK (24kHz PCM)
═══════════════════════════════ */
function queueTutorAudio(base64Data) {
  _tutor.audioQueue.push(base64Data);
  if (!_tutor.isPlayingAudio) playNextTutorChunk();
}

function playNextTutorChunk() {
  if (_tutor.audioQueue.length === 0) {
    _tutor.isPlayingAudio = false;
    _tutor.isSpeaking = false;
    // Reset UI to listening once all audio has actually finished playing
    if (_tutor.isConnected && _tutor.sessionActive) {
      setTutorStatus('🎙 Listening... your turn');
      setMicState('listening');
    }
    return;
  }
  _tutor.isPlayingAudio = true;
  _tutor.isSpeaking = true;
  setMicState('speaking');
  setTutorStatus('Coach is speaking...');

  const chunk = _tutor.audioQueue.shift();

  // Decode base64 → Int16 PCM
  const binaryStr = atob(chunk);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

  // Play via AudioContext at 24kHz (pre-created in gesture handler for iOS)
  const audioCtx = _tutor.playbackCtx || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  _tutor.playbackCtx = audioCtx;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const numSamples = bytes.length / 2;
  const buffer = audioCtx.createBuffer(1, numSamples, 24000);
  const channel = buffer.getChannelData(0);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < numSamples; i++) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioCtx.destination);
  _tutor.currentSource = src;
  src.onended = () => {
    _tutor.currentSource = null;
    playNextTutorChunk();
  };
  src.start();
}

function stopTutorPlayback() {
  _tutor.audioQueue = [];
  _tutor.isPlayingAudio = false;
  _tutor.isSpeaking = false;
  if (_tutor.currentSource) {
    try { _tutor.currentSource.stop(); } catch(e) {}
    _tutor.currentSource = null;
  }
}

/* ═══════════════════════════════
   TRANSCRIPT
═══════════════════════════════ */

/* Clean up noisy transcription text from Gemini */
function _cleanTranscription(text) {
  if (!text) return '';
  // Remove <noise>, <laugh>, <cough>, etc. tags
  let cleaned = text.replace(/<[^>]+>/g, '');
  // Remove non-Latin/non-English characters (Thai, Chinese, Arabic, etc.)
  // Keep basic Latin, extended Latin (accented chars), digits, punctuation
  cleaned = cleaned.replace(/[^\u0000-\u024F\u1E00-\u1EFF0-9\s.,!?;:'"()\-–—…/&@#$%*+=]/g, '');
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

/*
 * Transcription — Gemini sends fragments word-by-word.
 * Strategy: ONE live bubble per role. When the OTHER role starts talking,
 * we finalize the current role's bubble and start a new one.
 * This keeps all of a speaker's text in a single bubble.
 */
let _tutorLastRole = null;   // Track which role is currently "live"
let _tutorLiveText = '';     // Accumulated text for the live bubble

function appendTutorTranscript(role, text) {
  const cleaned = _cleanTranscription(text);
  if (!cleaned || cleaned.length < 2) return;

  // If role changed, finalize the previous role's bubble
  if (_tutorLastRole && _tutorLastRole !== role) {
    _finalizeTutorBubble(_tutorLastRole);
    _tutorLiveText = '';
  }
  _tutorLastRole = role;

  // Always join with a space
  if (_tutorLiveText) {
    _tutorLiveText += ' ' + cleaned;
  } else {
    _tutorLiveText = cleaned;
  }

  // Update the live bubble in the UI
  _updateLiveBubble(role, _tutorLiveText);
}

function _updateLiveBubble(role, text) {
  const inner = document.getElementById('tutorTranscriptInner');
  if (!inner) return;

  let liveEl = inner.querySelector('.tutor-msg--live');
  if (!liveEl || liveEl.dataset.role !== role) {
    // Create new live bubble
    liveEl = document.createElement('div');
    liveEl.className = `tutor-msg tutor-msg--${role} tutor-msg--live`;
    liveEl.dataset.role = role;
    liveEl.innerHTML = `
      <span class="tutor-msg-role">${role === 'coach' ? 'Coach' : 'You'}</span>
      <span class="tutor-msg-text"></span>
    `;
    inner.appendChild(liveEl);
  }

  const textEl = liveEl.querySelector('.tutor-msg-text');
  if (textEl) textEl.textContent = text;
  inner.scrollTop = inner.scrollHeight;
}

function _finalizeTutorBubble(role) {
  const text = _tutorLiveText.trim();
  if (!text || text.length < 3) return;

  // Store in messages
  _tutor.messages.push({
    role: role === 'coach' ? 'tutor' : 'user',
    content: text,
    timestamp: new Date().toISOString()
  });

  // Remove the live marker from the bubble
  const inner = document.getElementById('tutorTranscriptInner');
  if (!inner) return;
  const liveEl = inner.querySelector('.tutor-msg--live');
  if (liveEl && liveEl.dataset.role === role) {
    liveEl.classList.remove('tutor-msg--live');
    const textEl = liveEl.querySelector('.tutor-msg-text');
    if (textEl) textEl.textContent = text;
  }
}

/* ═══════════════════════════════
   SESSION END
═══════════════════════════════ */
window.endTutorSession = async function() {
  if (!_tutor.sessionActive) return;
  _tutor.sessionActive = false;

  // Finalize any pending transcript bubble
  if (_tutorLastRole) { _finalizeTutorBubble(_tutorLastRole); _tutorLiveText = ''; _tutorLastRole = null; }

  stopTutorMic();
  stopTutorPlayback();
  if (_tutor.ws) { try { _tutor.ws.close(); } catch(e) {} _tutor.ws = null; }
  clearInterval(_tutor._timerInterval);

  const duration = Math.round((Date.now() - _tutor.sessionStart) / 1000);
  const msgCount = _tutor.messages.length;

  // Show summary immediately
  const summaryEl = document.getElementById('tutorSummary');
  const activeEl = document.getElementById('tutorActive');
  if (activeEl) activeEl.classList.add('hidden');
  if (summaryEl) {
    summaryEl.classList.remove('hidden');
    summaryEl.innerHTML = `
      <div class="tutor-summary-content">
        <div class="tutor-summary-icon">🎓</div>
        <h2 class="tutor-summary-title">Session Complete!</h2>
        <div class="tutor-summary-stats">
          <div class="tutor-stat">
            <span class="tutor-stat-value">${Math.round(duration / 60)}</span>
            <span class="tutor-stat-label">Minutes</span>
          </div>
          <div class="tutor-stat">
            <span class="tutor-stat-value">${msgCount}</span>
            <span class="tutor-stat-label">Exchanges</span>
          </div>
          <div class="tutor-stat">
            <span class="tutor-stat-value">${_escTutor(_tutor.topic || 'Free')}</span>
            <span class="tutor-stat-label">Topic</span>
          </div>
        </div>
        <p class="tutor-summary-note">Saving session to your records...</p>
        <button class="tutor-btn-primary" onclick="renderTutor()" style="margin-top:20px;">Back to Topics</button>
      </div>
    `;
  }

  // Save to Sheets
  try {
    const sessionData = {
      date: new Date().toISOString(),
      duration_seconds: duration,
      topic: _tutor.topic || 'free_practice',
      level: '',
      score: '',
      weak_areas: '',
      strong_areas: '',
      summary: `${msgCount} exchanges, ${Math.round(duration / 60)} minutes`,
      message_count: msgCount
    };

    const res = await apiCall('create', 'english_sessions', sessionData);
    const sessionId = res?.id;

    // Save messages (fire-and-forget for speed)
    if (sessionId && _tutor.messages.length) {
      const batch = _tutor.messages.map(msg =>
        apiCall('create', 'english_messages', {
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          correction: '',
          feedback: '',
          timestamp: msg.timestamp
        }).catch(() => {})
      );
      await Promise.all(batch);
    }

    // Refresh state data
    try { await refreshData('english_sessions'); } catch(e) {}

    const noteEl = summaryEl?.querySelector('.tutor-summary-note');
    if (noteEl) noteEl.textContent = 'Session saved successfully!';
    showToast('Session saved!', 'success');
  } catch (e) {
    showToast('Session save failed: ' + (e.message || 'unknown'), 'error');
  }
};

/* ═══════════════════════════════
   UI HELPERS
═══════════════════════════════ */
function setTutorStatus(text) {
  const el = document.getElementById('tutorStatus');
  if (el) el.textContent = text;
}

function setMicState(state) {
  const ring = document.getElementById('tutorMicRing');
  const circle = document.getElementById('tutorMicCircle');
  const icon = document.getElementById('tutorMicIcon');
  if (!ring) return;

  ring.className = 'tutor-mic-ring';
  if (state === 'listening') {
    ring.classList.add('tutor-mic--listening');
    if (icon) icon.textContent = '🎙';
  } else if (state === 'speaking') {
    ring.classList.add('tutor-mic--speaking');
    if (icon) icon.textContent = '🔊';
  } else {
    ring.classList.add('tutor-mic--idle');
    if (icon) icon.textContent = '⏸';
  }
}

/* ── Push-to-Talk: Hold to speak, release to send ── */
window.tutorStartTalking = function(e) {
  if (e) e.preventDefault();
  if (!_tutor.isConnected || !_tutor.ws || _tutor.ws.readyState !== WebSocket.OPEN) return;

  // Stop coach audio if playing (interrupt)
  stopTutorPlayback();

  // Resume AudioContexts on iOS (user gesture required)
  if (_tutor.inputAudioCtx && _tutor.inputAudioCtx.state === 'suspended') _tutor.inputAudioCtx.resume();
  if (_tutor.playbackCtx && _tutor.playbackCtx.state === 'suspended') _tutor.playbackCtx.resume();

  // Send activity start signal
  _tutor.ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));

  _tutor.isListening = true;
  setMicState('listening');
  setTutorStatus('🎙 Listening...');

  const btn = document.getElementById('tutorTalkBtn');
  if (btn) { btn.textContent = '🎙 Speaking...'; btn.classList.add('tutor-talk-btn--active'); }
};

window.tutorStopTalking = function(e) {
  if (e) e.preventDefault();
  if (!_tutor.isListening) return;

  _tutor.isListening = false;

  // Send activity end signal — tells Gemini user is done speaking
  if (_tutor.ws && _tutor.ws.readyState === WebSocket.OPEN) {
    _tutor.ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
  }

  setMicState('idle');
  setTutorStatus('Processing...');

  const btn = document.getElementById('tutorTalkBtn');
  if (btn) { btn.textContent = 'Hold to Speak'; btn.classList.remove('tutor-talk-btn--active'); }
};

// Legacy toggle (tap on mic circle)
window.toggleTutorMic = function() {
  if (_tutor.isListening) {
    tutorStopTalking();
  } else {
    tutorStartTalking();
  }
};

function startTutorTimer() {
  const el = document.getElementById('tutorTimer');
  if (!el) return;
  _tutor._timerInterval = setInterval(() => {
    if (!_tutor.sessionStart) return;
    const sec = Math.round((Date.now() - _tutor.sessionStart) / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }, 1000);
}

function buildPastSessionsContext() {
  const sessions = (state.data.english_sessions || [])
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  if (!sessions.length) return 'No previous sessions. This is a new student.';
  return sessions.map(s =>
    `[${s.date}] Topic: ${s.topic}, Duration: ${Math.round((s.duration_seconds || 0) / 60)}min, ` +
    `Messages: ${s.message_count || 0}, Weak: ${s.weak_areas || 'N/A'}, Strong: ${s.strong_areas || 'N/A'}, ` +
    `Summary: ${s.summary || 'N/A'}`
  ).join('\n');
}

function _escTutor(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
