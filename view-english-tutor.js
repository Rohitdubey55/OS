/* view-english-tutor.js */

/**
 * ENGLISH TUTOR VIEW
 * Features:
 * - Live Multimodal Audio Conversation (Gemini 2.5 Flash Native Audio)
 * - Growth mindset architecture (Socratic tutoring)
 * - Persistent learning (fetches past session notes)
 * - iPhone/Capacitor optimization
 */

async function renderEnglishTutor() {
    const main = document.getElementById('main');
    
    // Check for protocol limitation
    const isFileProtocol = window.location.protocol === 'file:';
    
    // 1. Fetch Past Sessions to build context
    const sessions = state.data.english_tutor_sessions || [];
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

    main.innerHTML = `
        <div class="tutor-container animate-enter" style="padding: 24px; max-width: 600px; margin: 0 auto; min-height: 80vh; display: flex; flex-direction: column;">
            
            <!-- Header Section -->
            <div class="tutor-header" style="text-align: center; margin-bottom: 32px;">
                <div class="tutor-icon-wrap" style="width: 80px; height: 80px; border-radius: 24px; background: linear-gradient(135deg, var(--primary), #818cf8); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px var(--primary-glow); position: relative;">
                    ${renderIcon('graduation-cap', null, 'style="width:40px; color:white;"')}
                    <div class="live-pulse" id="liveIndicator" style="position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; background: #ef4444; border-radius: 50%; opacity: 0; transition: opacity 0.3s; border: 3px solid var(--surface-1);"></div>
                </div>
                <h1 style="font-size: 28px; font-weight: 800; margin: 0; background: linear-gradient(90deg, var(--text-1), var(--primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">English Tutor</h1>
                <p id="tutorStatus" style="color: var(--text-muted); font-size: 14px; margin-top: 8px; font-weight: 500;">Supportive. Socratic. Personal.</p>
            </div>

            <!-- Stats/Context Card -->
            <div class="widget-card" style="margin-bottom: 24px; background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 20px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 1.2px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                    ${renderIcon('history', null, 'style="width:14px"')} Session Continuity
                </div>
                <div style="font-size: 14px; line-height: 1.6;">
                    ${lastSession ? `
                        <div style="font-weight: 700; margin-bottom: 6px; color: var(--text-1);">Last Lesson: ${lastSession.session_goal}</div>
                        <div style="color: var(--text-muted); font-size: 13px; font-style: italic;">Focus for today: "${lastSession.notes_for_next_time}"</div>
                    ` : `
                        <div style="color: var(--text-muted);">Welcome to your first session! Aria will get to know your goals today.</div>
                    `}
                </div>
            </div>

            <!-- Main Interaction Area -->
            <div id="visualizerArea" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                <div id="audioVisualizer" style="width: 100%; height: 140px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <div style="color: var(--text-muted); font-size: 13px; font-weight: 500;">Press Start to begin your live session</div>
                </div>
                
                <div id="transcriptBubble" style="width: 100%; max-height: 120px; overflow-y: auto; padding: 20px; background: var(--surface-2); border-radius: 22px; margin: 24px 0; font-size: 15px; line-height: 1.6; color: var(--text-main); display: none; box-shadow: inset 0 2px 8px rgba(0,0,0,0.04);">
                    <!-- Live transcript for accessibility -->
                </div>
            </div>

            <!-- Controls -->
            <div class="tutor-controls" style="display: flex; flex-direction: column; gap: 16px; margin-top: auto;">
                ${isFileProtocol ? `
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 16px; border-radius: 16px; font-size: 13px; line-height: 1.5; text-align: center; margin-bottom: 16px;">
                        <strong>⚠️ Protocol Restriction:</strong><br>
                        Google AI Live requires a secure origin (http/https). Please run this via a local server (e.g., npx serve) or via Capacitor on your iPhone.
                    </div>
                ` : ''}
                <button id="startTutorBtn" class="btn primary ui-polish hover-lift" style="height: 68px; border-radius: 22px; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 12px 24px var(--primary-glow); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);" onclick="startEnglishSession()">
                    ${renderIcon('mic', null, 'style="width:24px"')} Start Live Session
                </button>
                <button id="stopTutorBtn" class="btn ui-polish" style="height: 68px; border-radius: 22px; font-size: 17px; font-weight: 700; background: var(--surface-2); display: none; color: #ef4444;" onclick="stopEnglishSession()">
                    ${renderIcon('mic-off', null, 'style="width:20px; margin-right:8px"')} End Session
                </button>
                <div style="text-align: center; font-size: 11px; color: var(--text-muted); padding: 8px; opacity: 0.7; font-weight: 600; letter-spacing: 0.5px;">
                    POWERED BY GEMINI LIVE &middot; NATIVE AUDIO
                </div>
            </div>

        </div>

        <style>
            .tutor-container {
                animation: slide-up-tutor 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .live-pulse {
                animation: pulse-red-tutor 1.5s infinite;
            }
            @keyframes pulse-red-tutor {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { transform: scale(1.2); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            @keyframes slide-up-tutor {
                from { opacity: 0; transform: translateY(40px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .viz-bar {
                width: 6px;
                height: 12px;
                background: linear-gradient(to top, var(--primary), #818cf8);
                border-radius: 3px;
                transition: height 0.08s ease;
                box-shadow: 0 2px 4px var(--primary-glow);
            }
        </style>
    `;

    lucide.createIcons();
    
    // Auto-scroll to top
    window.scrollTo(0, 0);
}

// ── SESSION LOGIC ──

let tutorLiveSocket = null;
let audioContext = null;
let mediaStream = null;
let processor = null;

async function startEnglishSession(isFallback = false) {
    const startBtn = document.getElementById('startTutorBtn');
    const stopBtn = document.getElementById('stopTutorBtn');
    const status = document.getElementById('tutorStatus');
    const liveIndicator = document.getElementById('liveIndicator');
    
    try {
        startBtn.disabled = true;
        startBtn.textContent = isFallback ? "Trying fallback model..." : "Connecting to Aria...";
        
        // 1. Get Live Config
        const config = AI_SERVICE.englishTutor.getLiveConfig();
        const modelToUse = isFallback ? config.fallbackModel : config.model;
        
        // Use v1alpha as a fallback if v1beta fails, or try v1alpha first for newer models
        const version = isFallback ? 'v1beta' : 'v1alpha';
        const baseUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${version}.GenerativeService.BiDiGenerateContent`;
        const finalUrl = `${baseUrl}?key=${config.apiKey}&model=${modelToUse}`;
        
        console.log(`English Tutor: Attempting connection to ${modelToUse} via ${version}`);
        
        // 2. Setup WebSocket (Local instance to avoid race conditions)
        const socket = new WebSocket(finalUrl);
        let setupCompleted = false;

        socket.onopen = () => {
            console.log(`English Tutor: Connected using ${modelToUse}`);
            tutorLiveSocket = socket; // Now it's safe to set the global
            
            const sessions = state.data.english_tutor_sessions || [];
            const pastNotesSummary = sessions.map(s => `${s.date}: ${s.notes_for_next_time}`).join('\n');

            const setupMsg = {
                setup: {
                    model: modelToUse,
                    generation_config: config.generationConfig,
                    system_instruction: {
                        parts: [{ text: AI_SERVICE.englishTutor.getSystemPrompt(pastNotesSummary) }]
                    }
                }
            };
            socket.send(JSON.stringify(setupMsg));
            setupCompleted = true;
            
            status.textContent = "Aria is listening...";
            liveIndicator.style.opacity = "1";
            startBtn.style.display = "none";
            stopBtn.style.display = "flex";
            initVisualizer();
            initAudioStream();
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.serverContent && data.serverContent.modelTurn) {
                const parts = data.serverContent.modelTurn.parts;
                for (const part of parts) {
                    if (part.inlineData) playGeminiAudio(part.inlineData.data);
                    if (part.text) updateTranscript(part.text);
                }
            }
        };

        socket.onerror = (e) => {
            console.error(`WebSocket Error (${modelToUse}):`, e);
            if (!setupCompleted && !isFallback) {
                console.log("Primary model failed, trying fallback...");
                socket.close(); // Close this instance
                startEnglishSession(true);
            } else if (!setupCompleted) {
                showToast("Connection Error. Check API Key or Model access.");
                stopEnglishSession(false);
            }
        };

        socket.onclose = () => {
            console.log(`Socket closed: ${modelToUse}`);
            if (tutorLiveSocket === socket) {
                stopEnglishSession();
            }
        };

    } catch (err) {
        console.error("Session Start Failed:", err);
        showToast("Audio Access Denied");
        startBtn.disabled = false;
        startBtn.textContent = "Start Live Session";
    }
}

// ── AUDIO HANDLING ──

async function initAudioStream() {
    try {
        // iPhone/Capacitor specific check
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        // Process audio into 16-bit PCM for Gemini
        // We use a newer AudioWorklet if possible, but ScriptProcessor is more broadly compatible for now
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!tutorLiveSocket || tutorLiveSocket.readyState !== WebSocket.OPEN) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
            }
            
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
            tutorLiveSocket.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                    }]
                }
            }));
            
            updateVisualizer(inputData);
        };
    } catch (e) {
        console.error("Audio init error:", e);
        showToast("Microphone access is required.");
    }
}

const audioQueue = [];
let isPlaying = false;

function playGeminiAudio(base64Data) {
    const audioData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    audioQueue.push(audioData);
    if (!isPlaying) processAudioQueue();
}

async function processAudioQueue() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }
    isPlaying = true;
    const data = audioQueue.shift();
    
    const int16 = new Int16Array(data);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    
    const buffer = audioContext.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = processAudioQueue;
    source.start();
}

// ── UI HELPERS ──

function initVisualizer() {
    const viz = document.getElementById('audioVisualizer');
    viz.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const bar = document.createElement('div');
        bar.className = 'viz-bar';
        viz.appendChild(bar);
    }
}

function updateVisualizer(data) {
    const bars = document.querySelectorAll('.viz-bar');
    if (!bars.length) return;
    const step = Math.floor(data.length / bars.length);
    bars.forEach((bar, i) => {
        const amplitude = Math.abs(data[i * step]) * 200;
        bar.style.height = `${Math.max(12, amplitude)}px`;
    });
}

function updateTranscript(text) {
    const bubble = document.getElementById('transcriptBubble');
    bubble.style.display = "block";
    bubble.innerHTML = `<span style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:10px; letter-spacing:1px;">Aria</span><br>${text}`;
    bubble.scrollTo(0, bubble.scrollHeight);
}

async function stopEnglishSession(isSave = true) {
    if (tutorLiveSocket) tutorLiveSocket.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    
    tutorLiveSocket = null;
    audioContext = null;
    mediaStream = null;
    
    if (!isSave) {
        renderEnglishTutor();
        return;
    }

    // Finalize session notes
    // In a production app, we would wait for a summary from AI, but for prototype:
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
        await apiCall('create', 'english_tutor_sessions', {
            date: todayStr,
            session_goal: "Live Conversational Practice",
            notes_for_next_time: "Review pronunciation of -ed endings and practice plural possessives.",
            user_level: "Intermediate",
            transcript_summary: "Discussed daily routines and weekend plans. Corrected verb tense usage."
        });
        showToast("Session progress saved to PersonalOS!");
    } catch (e) {
        console.error("Save failed:", e);
    }
    
    renderEnglishTutor(); // Reset View
}
