/* view-vision.js - World-Class SaaS Vision Board */

/* ─── LOCAL MEDIA STORAGE (IndexedDB) ─────────────────────────────────────
   Images & Videos are stored on-device in IndexedDB.
   Google Sheets only stores a small reference key: "local://key" or "local-img://key".
   ArrayBuffers are used because they serialize reliably in WKWebView IndexedDB.
   ─────────────────────────────────────────────────────────────────────────── */
const _VisionIDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('VisionMedia', 2);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
      };
      r.onsuccess = e => { this._db = e.target.result; res(this._db); };
      r.onerror = e => rej(e.target.error);
    });
  },
  async put(key, obj) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(obj, key);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(key);
      req.onsuccess = e => res(e.target.result || null);
      req.onerror = e => rej(e.target.error);
    });
  },
  async del(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(key);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  }
};

// In-memory cache: key → objectURL (or base64 for legacy)
window._visionMediaCache = window._visionMediaCache || {};

/* ─── AI VOICE TTS GENERATION (via Gemini Native Audio Dialog — UNLIMITED FREE) ─
   Pre-generates realistic human voice for affirmations using Google Gemini
   Live API (WebSocket). Uses gemini-2.5-flash-native-audio which has
   UNLIMITED free tier (unlike the TTS model which caps at 10 req/day).
   Uses the same Gemini API key you already have. 30 voices!
   Stores audio in IndexedDB under key "audio://<affirmationId>".
   ─────────────────────────────────────────────────────────────────────────── */

// Gemini TTS voice options (30 voices)
const VOICE_PROVIDERS = {
  gemini: {
    label: 'Gemini AI Voices',
    voices: [
      { id: 'Sulafat', name: 'Sulafat (Warm)' },
      { id: 'Achernar', name: 'Achernar (Soft)' },
      { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' },
      { id: 'Aoede', name: 'Aoede (Breezy)' },
      { id: 'Leda', name: 'Leda (Youthful)' },
      { id: 'Kore', name: 'Kore (Firm)' },
      { id: 'Puck', name: 'Puck (Upbeat)' },
      { id: 'Zephyr', name: 'Zephyr (Bright)' },
      { id: 'Charon', name: 'Charon (Informative)' },
      { id: 'Fenrir', name: 'Fenrir (Excitable)' },
      { id: 'Orus', name: 'Orus (Firm)' },
      { id: 'Algieba', name: 'Algieba (Smooth)' },
      { id: 'Despina', name: 'Despina (Smooth)' },
      { id: 'Erinome', name: 'Erinome (Clear)' },
      { id: 'Gacrux', name: 'Gacrux (Mature)' },
      { id: 'Achird', name: 'Achird (Friendly)' },
      { id: 'Umbriel', name: 'Umbriel (Easy-going)' },
      { id: 'Enceladus', name: 'Enceladus (Breathy)' },
      { id: 'Iapetus', name: 'Iapetus (Clear)' },
      { id: 'Schedar', name: 'Schedar (Even)' },
      { id: 'Alnilam', name: 'Alnilam (Firm)' },
      { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' },
      { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' },
      { id: 'Autonoe', name: 'Autonoe (Bright)' },
      { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' },
      { id: 'Sadachbia', name: 'Sadachbia (Lively)' },
      { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' },
      { id: 'Algenib', name: 'Algenib (Gravelly)' },
      { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' },
      { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' },
    ]
  }
};

// Psychologically-tuned system instruction for manifestation TTS
// - Slow pace → parasympathetic activation, perceived authority/truth
// - Warm conviction → mirror neuron response, listener internalizes belief
// - Deliberate pauses → subconscious absorption (Zeigarnik effect)
// - Identity emphasis → "I am" activates self-schema modification (Bem's theory)
const TTS_SYSTEM_INSTRUCTION = `You are a manifestation guide speaking affirmations with deep conviction and warm authority. Speak as if you are the person's wisest inner voice — calm, certain, and deeply believing every word. Use a slow, deliberate pace with natural pauses between phrases. Emphasize identity statements like "I am", "I have", "I create" with quiet power. Your tone should evoke safety, strength, and absolute certainty — like a meditation teacher guiding someone into their highest self. Read ONLY the given text, no extra words.`;

function _getGeminiKey() {
  const s = state.data.settings?.[0] || {};
  return s.ai_api_key || '';
}

function _getVoiceConfig() {
  const s = state.data.settings?.[0] || {};
  return {
    provider: s.tts_provider || 'gemini',
    voiceId: s.tts_voice_id || 'Sulafat'
  };
}

// Memory-efficient base64 to ArrayBuffer (avoids atob + Uint8Array.from which doubles memory)
function _base64ToArrayBuffer(base64) {
  // Decode in 32KB chunks to avoid huge intermediate strings on iOS
  const CHUNK = 32768;
  const binLen = Math.ceil(base64.length * 3 / 4);
  const buf = new Uint8Array(binLen);
  let offset = 0;

  for (let i = 0; i < base64.length; i += CHUNK) {
    const slice = base64.substring(i, Math.min(i + CHUNK, base64.length));
    const bin = atob(slice);
    for (let j = 0; j < bin.length; j++) {
      buf[offset++] = bin.charCodeAt(j);
    }
  }
  // Trim to actual size (padding may cause slight over-allocation)
  return buf.subarray(0, offset);
}

// Convert base64 PCM (24kHz, 16-bit, mono) to WAV blob — memory-efficient
function _pcmBase64ToWavBlob(base64Data) {
  // Support raw buffer from _concatBase64Chunks (WebSocket chunked audio)
  let pcmBytes;
  if (base64Data === '__RAW_BUFFER__' && _concatBase64Chunks._rawBuffer) {
    pcmBytes = _concatBase64Chunks._rawBuffer;
    _concatBase64Chunks._rawBuffer = null; // free immediately
  } else {
    pcmBytes = _base64ToArrayBuffer(base64Data);
  }
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataLength = pcmBytes.length;

  // WAV header (44 bytes) — write directly into the blob parts to avoid copying
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  _writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  _writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  _writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  _writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Use Blob constructor with 2 parts (header + PCM) — avoids allocating a combined buffer
  return new Blob([header, pcmBytes.buffer], { type: 'audio/wav' });
}

function _writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Generate TTS audio using Gemini Native Audio Dialog (Live API via WebSocket)
// This model has UNLIMITED free tier (unlike gemini-2.5-flash-preview-tts which caps at 10 RPD)
async function _generateGeminiTTS(text, voiceName) {
  const apiKey = _getGeminiKey();
  if (!apiKey) throw new Error('Set Gemini API key in Settings → AI');

  return new Promise((resolve, reject) => {
    const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    let ws;
    let audioChunks = [];
    let setupDone = false;
    let timeoutId;

    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      return reject(new Error('WebSocket connection failed: ' + (e.message || 'unknown')));
    }

    // 30s timeout safety net
    timeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      reject(new Error('Gemini Live API timeout (30s)'));
    }, 30000);

    ws.onopen = () => {
      console.log('[Live API] WebSocket connected, sending setup...');
      // Step 1: Send setup/config message
      const configMsg = {
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          generationConfig: {
            temperature: 0.8,
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: TTS_SYSTEM_INSTRUCTION }]
          }
        }
      };
      ws.send(JSON.stringify(configMsg));
    };

    ws.onmessage = async (event) => {
      try {
        // WebSocket may return Blob or string — handle both
        let rawData = event.data;
        if (rawData instanceof Blob) {
          rawData = await rawData.text();
        }
        const msg = JSON.parse(rawData);
        console.log('[Live API] msg keys:', Object.keys(msg).join(','), JSON.stringify(msg).substring(0, 200));

        // Setup complete acknowledgment
        if (msg.setupComplete) {
          setupDone = true;
          console.log('[Live API] Setup complete, sending text...');
          // Step 2: Send the text to speak
          const clientMsg = {
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: text }] }],
              turnComplete: true
            }
          };
          ws.send(JSON.stringify(clientMsg));
          return;
        }

        // Collect audio chunks from model response
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              audioChunks.push(part.inlineData.data);
              console.log('[Live API] Got audio chunk, total chunks:', audioChunks.length);
            }
          }
        }

        // Turn complete — assemble audio and resolve
        if (msg.serverContent?.turnComplete) {
          clearTimeout(timeoutId);
          console.log('[Live API] Turn complete, total chunks:', audioChunks.length);
          ws.close();

          if (audioChunks.length === 0) {
            return reject(new Error('No audio received from Gemini Live API'));
          }

          // Concatenate all base64 PCM chunks into one
          const allPcm = _concatBase64Chunks(audioChunks);
          audioChunks = null; // free memory

          const wavBlob = _pcmBase64ToWavBlob(allPcm);
          console.log('[Live API] WAV blob created:', wavBlob.size, 'bytes');
          resolve(wavBlob);
        }
      } catch (e) {
        console.error('[Live API] message parse error', e);
      }
    };

    ws.onerror = (e) => {
      clearTimeout(timeoutId);
      console.error('[Live API] WebSocket error:', e);
      reject(new Error('Gemini Live API WebSocket error'));
    };

    ws.onclose = (e) => {
      clearTimeout(timeoutId);
      console.log('[Live API] WebSocket closed, code:', e.code, 'reason:', e.reason, 'setupDone:', setupDone);
      if (!setupDone) {
        reject(new Error(`Gemini Live API connection closed (code ${e.code}): ${e.reason || 'unknown'}`));
      }
      // If setupDone and turnComplete already resolved, this is fine
    };
  });
}

// Concatenate multiple base64 PCM chunks into one base64 string
function _concatBase64Chunks(chunks) {
  if (chunks.length === 1) return chunks[0];
  // Decode each chunk, concatenate, return combined base64
  // More memory-efficient: decode to buffers and concat
  let totalLen = 0;
  const buffers = [];
  for (const chunk of chunks) {
    const buf = _base64ToArrayBuffer(chunk);
    buffers.push(buf);
    totalLen += buf.length;
  }
  // We don't actually need base64 again — modify _pcmBase64ToWavBlob to accept raw buffer
  // For now, return a marker and store the buffers
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const buf of buffers) {
    combined.set(buf, offset);
    offset += buf.length;
  }
  // Store on a temp property so _pcmBase64ToWavBlob can use it
  _concatBase64Chunks._rawBuffer = combined;
  return '__RAW_BUFFER__';
}

// ── Batch TTS: Process multiple affirmations on ONE WebSocket (no repeated handshake) ──
// Returns { generated: N, failed: N, results: [{id, success}] }
async function _generateGeminiTTSBatch(items, voiceName, onItemDone) {
  const apiKey = _getGeminiKey();
  if (!apiKey) throw new Error('Missing API key');
  if (!items.length) return { generated: 0, failed: 0, results: [] };

  const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  const results = [];
  let generated = 0, failed = 0;

  return new Promise((resolveBatch) => {
    let ws;
    try { ws = new WebSocket(WS_URL); } catch(e) {
      items.forEach(it => { failed++; results.push({id: it.id, success: false}); if (onItemDone) onItemDone(it, null); });
      return resolveBatch({ generated, failed, results });
    }

    let setupDone = false;
    let currentIdx = 0;
    let audioChunks = [];
    let turnTimeout = null;

    function finishBatch() {
      clearTimeout(turnTimeout);
      try { if (ws.readyState <= 1) ws.close(); } catch(e) {}
      resolveBatch({ generated, failed, results });
    }

    function sendNextItem() {
      if (currentIdx >= items.length) { finishBatch(); return; }
      const item = items[currentIdx];
      audioChunks = [];
      // 30s timeout per turn
      clearTimeout(turnTimeout);
      turnTimeout = setTimeout(() => {
        failed++; results.push({id: item.id, success: false});
        if (onItemDone) onItemDone(item, null);
        currentIdx++;
        sendNextItem();
      }, 30000);
      ws.send(JSON.stringify({
        clientContent: { turns: [{ role: 'user', parts: [{ text: item.text }] }], turnComplete: true }
      }));
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          generationConfig: {
            temperature: 0.8,
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          },
          systemInstruction: { parts: [{ text: TTS_SYSTEM_INSTRUCTION }] }
        }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) raw = await raw.text();
        const msg = JSON.parse(raw);

        if (msg.setupComplete) { setupDone = true; sendNextItem(); return; }

        // Collect audio chunks
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) audioChunks.push(part.inlineData.data);
          }
        }

        // Turn complete — assemble WAV and store
        if (msg.serverContent?.turnComplete) {
          clearTimeout(turnTimeout);
          const item = items[currentIdx];
          if (audioChunks.length > 0) {
            try {
              const allPcm = _concatBase64Chunks(audioChunks);
              const wavBlob = _pcmBase64ToWavBlob(allPcm);
              const arrayBuffer = await wavBlob.arrayBuffer();
              await _VisionIDB.put('audio://' + item.id, { type: 'audio/wav', buffer: arrayBuffer });
              generated++;
              results.push({id: item.id, success: true});
              if (onItemDone) onItemDone(item, wavBlob);
            } catch(e) {
              failed++; results.push({id: item.id, success: false});
              if (onItemDone) onItemDone(item, null);
            }
          } else {
            failed++; results.push({id: item.id, success: false});
            if (onItemDone) onItemDone(item, null);
          }
          audioChunks = [];
          currentIdx++;
          sendNextItem();
        }
      } catch(e) { /* parse error, keep going */ }
    };

    ws.onerror = () => {
      // Mark remaining as failed
      for (let i = currentIdx; i < items.length; i++) {
        failed++; results.push({id: items[i].id, success: false});
        if (onItemDone) onItemDone(items[i], null);
      }
      finishBatch();
    };

    ws.onclose = () => {
      if (!setupDone) {
        items.forEach(it => { failed++; results.push({id: it.id, success: false}); if (onItemDone) onItemDone(it, null); });
        finishBatch();
      }
      // If setupDone and all items processed, finishBatch already called
    };
  });
}

window.generateGeminiAudio = async function(text, affId, opts = {}) {
  const config = _getVoiceConfig();
  const cleanText = text.replace(/\*/g, '').trim();
  if (!cleanText) return false;

  try {
    console.log(`[TTS] Generating: voice=${config.voiceId}, text="${cleanText.substring(0, 40)}..."`);

    const blob = await _generateGeminiTTS(cleanText, config.voiceId);
    if (!blob || blob.size < 100) {
      showToast('Voice generation returned empty audio', 'error');
      return false;
    }

    const arrayBuffer = await blob.arrayBuffer();
    await _VisionIDB.put('audio://' + affId, { type: 'audio/wav', buffer: arrayBuffer });

    console.log(`[TTS] Saved: ${blob.size} bytes for aff ${affId}`);
    if (!opts.silent) showToast('Voice generated!', 'success');
    return true;
  } catch (e) {
    showToast('Voice generation failed: ' + (e.message || 'unknown error'), 'error');
    console.error('[TTS]', e);
    return false;
  }
};

// Check if an affirmation has pre-generated audio
window.hasStoredAudio = async function(affId) {
  try {
    const stored = await _VisionIDB.get('audio://' + affId);
    // Must have actual audio buffer (not stale batch-ref entries from previous attempts)
    return !!(stored && stored.buffer);
  } catch (e) { return false; }
};

// ── Google Drive Sync: Upload audio after generation ──
// Converts ArrayBuffer to base64, sends to GAS backend which stores in Drive POS/audio/
async function _uploadAudioToDrive(affId) {
  try {
    const stored = await _VisionIDB.get('audio://' + affId);
    if (!stored || !stored.buffer) return;

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(stored.buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    const base64 = btoa(binary);

    const result = await apiCall('uploadAudio', null, {
      filename: 'aff_' + affId + '.wav',
      data: base64,
      mimeType: 'audio/wav',
      aff_id: affId
    });

    if (result?.url) {
      // Update local state with the Drive URL
      const aff = (state.data.vision_affirmations || []).find(a => String(a.id) === String(affId));
      if (aff) aff.audio_url = result.url;
    }
  } catch (e) {
    console.warn('[Drive Upload] Failed for aff', affId, e.message);
  }
}

// ── Cloud Audio Sync (manual, user-triggered) ──
// Checks if there are cloud-stored voices missing locally; shows a sync banner if so.
window._audioSyncRunning = false;

async function _checkCloudAudioAvailable() {
  const affs = state.data.vision_affirmations || [];
  let missing = 0;
  for (const aff of affs) {
    if (aff.audio_url && !(await hasStoredAudio(aff.id))) missing++;
  }
  if (missing === 0) return;

  // Show a small sync banner at top of vision page
  const main = document.getElementById('main');
  if (!main) return;
  const existing = document.getElementById('audioSyncBanner');
  if (existing) return; // Already showing

  const banner = document.createElement('div');
  banner.id = 'audioSyncBanner';
  banner.style.cssText = 'background:var(--surface-2);border:1px solid var(--border-color);border-radius:12px;padding:12px 16px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
  banner.innerHTML = `
    <div style="font-size:13px;color:var(--text-2);">
      <strong>☁️ ${missing} voice${missing > 1 ? 's' : ''}</strong> available from cloud
    </div>
    <button onclick="syncAudioFromCloud()" style="padding:8px 16px;border:none;border-radius:8px;background:var(--primary);color:white;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">
      Sync Now
    </button>
  `;
  // Insert after the first child (header area)
  const shell = main.querySelector('.vision-shell') || main;
  shell.insertBefore(banner, shell.children[1] || null);
}

window.syncAudioFromCloud = async function() {
  if (window._audioSyncRunning) return;
  window._audioSyncRunning = true;

  const banner = document.getElementById('audioSyncBanner');

  try {
    const affs = state.data.vision_affirmations || [];
    const toDownload = [];
    for (const aff of affs) {
      if (aff.audio_url && !(await hasStoredAudio(aff.id))) toDownload.push(aff);
    }

    if (toDownload.length === 0) {
      if (banner) banner.remove();
      window._audioSyncRunning = false;
      return;
    }

    // Update banner to show progress
    if (banner) banner.innerHTML = `
      <div style="font-size:13px;color:var(--text-2);flex:1;">
        <strong>☁️ Syncing...</strong> <span id="syncProgress">0/${toDownload.length}</span>
      </div>
    `;

    let synced = 0;
    // Download 3 at a time for speed
    const BATCH = 3;
    for (let i = 0; i < toDownload.length; i += BATCH) {
      const batch = toDownload.slice(i, i + BATCH);
      await Promise.all(batch.map(async (aff) => {
        try {
          let fileId = aff.audio_url;
          if (fileId.startsWith('drive:')) fileId = fileId.substring(6);
          else if (fileId.includes('id=')) fileId = fileId.split('id=')[1];
          else return;

          const result = await apiCall('downloadAudio', null, { file_id: fileId });
          if (!result?.data) return;

          const binaryStr = atob(result.data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let j = 0; j < len; j++) bytes[j] = binaryStr.charCodeAt(j);
          if (bytes.byteLength < 100) return;

          await _VisionIDB.put('audio://' + aff.id, { type: result.mimeType || 'audio/wav', buffer: bytes.buffer });
          synced++;
        } catch (e) {
          console.warn('[Cloud Sync] Failed for', aff.id, e.message);
        }
      }));

      // Update progress
      const prog = document.getElementById('syncProgress');
      if (prog) prog.textContent = `${Math.min(i + BATCH, toDownload.length)}/${toDownload.length}`;
    }

    if (banner) banner.remove();
    if (synced > 0) showToast(`Synced ${synced} voice${synced > 1 ? 's' : ''} from cloud ☁️`, 'success');
    else showToast('No new voices to sync', 'info');
  } catch (e) {
    console.warn('[Cloud Sync] Error:', e.message);
    showToast('Sync failed: ' + e.message, 'error');
    if (banner) banner.remove();
  }
  window._audioSyncRunning = false;
};

// ═══════════════════════════════════════════════════════════════════
// VISION MEDIA CLOUD SYNC — Images & Videos to/from Google Drive
// ═══════════════════════════════════════════════════════════════════

// Helper: convert ArrayBuffer to base64
function _bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

// Upload a single media file (image or video) from IDB to Drive
async function _uploadMediaToDrive(localKey, filename, mimeType) {
  try {
    const stored = await _VisionIDB.get(localKey);
    if (!stored || !stored.buffer) return null;

    const base64 = _bufferToBase64(stored.buffer);
    const result = await apiCall('uploadMedia', null, {
      filename: filename,
      data: base64,
      mimeType: mimeType || stored.type || 'application/octet-stream'
    });

    return result?.url || null; // "drive:XXXX"
  } catch (e) {
    console.warn('[Media Upload] Failed for', localKey, e.message);
    return null;
  }
}

// Download a media file from Drive to IDB
async function _downloadMediaFromDrive(driveRef) {
  try {
    let fileId = driveRef;
    if (fileId.startsWith('drive:')) fileId = fileId.substring(6);
    else if (fileId.includes('id=')) fileId = fileId.split('id=')[1];
    else return null;

    const result = await apiCall('downloadMedia', null, { file_id: fileId });
    if (!result?.data) return null;

    const binaryStr = atob(result.data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

    return { type: result.mimeType || 'application/octet-stream', buffer: bytes.buffer };
  } catch (e) {
    console.warn('[Media Download] Failed for', driveRef, e.message);
    return null;
  }
}

// After saving a vision goal, upload its media to Drive in background
async function _syncVisionMediaToCloud(goalId) {
  const goals = state.data.vision || state.data.visions || [];
  const goal = goals.find(g => String(g.id) === String(goalId));
  if (!goal) return;

  // Upload image if it's a local reference
  if (goal.image_url && goal.image_url.startsWith('local-img://')) {
    const localKey = goal.image_url.replace('local-img://', '');
    const ext = localKey.startsWith('img_') ? '.jpg' : '.dat';
    const driveRef = await _uploadMediaToDrive(localKey, 'vision_' + goalId + '_img' + ext, 'image/jpeg');
    if (driveRef) {
      // Store both local + cloud ref: "local-img://KEY|drive:ID"
      goal.image_url = 'local-img://' + localKey + '|' + driveRef;
      apiCall('update', 'vision_board', { image_url: goal.image_url }, goalId).catch(() => {});
    }
  }

  // Upload videos if they're local references
  if (goal.video_url) {
    const parts = goal.video_url.split(',');
    let changed = false;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith('local://') && !part.includes('|drive:')) {
        const localKey = part.replace('local://', '');
        const ext = '.mp4';
        const driveRef = await _uploadMediaToDrive(localKey, 'vision_' + goalId + '_vid' + i + ext, 'video/mp4');
        if (driveRef) {
          parts[i] = 'local://' + localKey + '|' + driveRef;
          changed = true;
        }
      }
    }
    if (changed) {
      goal.video_url = parts.join(',');
      apiCall('update', 'vision_board', { video_url: goal.video_url }, goalId).catch(() => {});
    }
  }
}

// Sync missing cloud media to local IDB (called when loading a vision goal's media)
async function _syncVisionMediaFromCloud(goal) {
  if (!goal) return;
  let changed = false;

  // Check image
  if (goal.image_url && goal.image_url.includes('|drive:')) {
    const [localPart, drivePart] = goal.image_url.split('|');
    const localKey = localPart.replace('local-img://', '');
    const hasLocal = await _VisionIDB.get(localKey);
    if (!hasLocal) {
      const downloaded = await _downloadMediaFromDrive(drivePart);
      if (downloaded) {
        await _VisionIDB.put(localKey, downloaded);
        const blob = new Blob([downloaded.buffer], { type: downloaded.type });
        window._visionMediaCache[localKey] = URL.createObjectURL(blob);
        changed = true;
      }
    }
  }

  // Check videos
  if (goal.video_url) {
    const parts = goal.video_url.split(',');
    for (const part of parts) {
      if (part.includes('|drive:')) {
        const [localPart, drivePart] = part.split('|');
        const localKey = localPart.replace('local://', '');
        const hasLocal = await _VisionIDB.get(localKey);
        if (!hasLocal) {
          const downloaded = await _downloadMediaFromDrive(drivePart);
          if (downloaded) {
            await _VisionIDB.put(localKey, downloaded);
            const blob = new Blob([downloaded.buffer], { type: downloaded.type });
            window._visionMediaCache[localKey] = URL.createObjectURL(blob);
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

// Bulk generate voices — one call per affirmation, memory-safe for iOS
// Uses sequential processing with cleanup between each to stay under WKWebView memory limits
window.generateAllVoices = async function(goalId) {
  const apiKey = _getGeminiKey();
  const config = _getVoiceConfig();
  if (!apiKey) { showToast('Set Gemini API key in Settings → AI', 'error'); return; }

  const affs = (state.data.vision_affirmations || [])
    .filter(a => !goalId || String(a.vision_id) === String(goalId))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!affs.length) { showToast('No affirmations found', 'error'); return; }

  // --- Build progress panel ---
  const bulkBtn = document.getElementById('bulkVoiceBtn');
  if (bulkBtn) { bulkBtn.disabled = true; bulkBtn.innerHTML = '⏳ Starting...'; }

  let panel = document.getElementById('voiceGenProgress');
  if (panel) panel.remove();

  const container = document.getElementById('affMgrList')?.parentElement || document.getElementById('bulkVoiceBtn')?.parentElement;
  if (container) {
    panel = document.createElement('div');
    panel.id = 'voiceGenProgress';
    panel.className = 'voice-gen-panel';
    panel.innerHTML = `
      <div class="voice-gen-panel__header">
        <span class="voice-gen-panel__title">🎙 Voice Generation</span>
        <span class="voice-gen-panel__stats" id="vgStats">0 / ${affs.length}</span>
      </div>
      <div class="voice-gen-panel__bar-wrap">
        <div class="voice-gen-panel__bar" id="vgBar" style="width:0%"></div>
      </div>
      <div class="voice-gen-panel__counts" id="vgCounts">
        <span class="vg-count vg-count--done">✅ 0 done</span>
        <span class="vg-count vg-count--skip">⏭ 0 skipped</span>
        <span class="vg-count vg-count--fail">❌ 0 failed</span>
      </div>
      <div class="voice-gen-panel__log" id="vgLog"></div>
    `;
    const ref = document.getElementById('bulkVoiceBtn');
    if (ref && ref.nextSibling) container.insertBefore(panel, ref.nextSibling);
    else container.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('visible'));
  }

  const vgBar = document.getElementById('vgBar');
  const vgStats = document.getElementById('vgStats');
  const vgCounts = document.getElementById('vgCounts');
  const vgLog = document.getElementById('vgLog');

  let processed = 0, generated = 0, skipped = 0, failed = 0;

  function updatePanel(currentAff, status) {
    processed++;
    const pct = Math.round((processed / affs.length) * 100);
    if (vgBar) vgBar.style.width = pct + '%';
    if (vgStats) vgStats.textContent = `${processed} / ${affs.length}`;
    if (bulkBtn) bulkBtn.innerHTML = `⏳ ${processed}/${affs.length}...`;
    if (vgCounts) vgCounts.innerHTML = `
      <span class="vg-count vg-count--done">✅ ${generated} done</span>
      <span class="vg-count vg-count--skip">⏭ ${skipped} skipped</span>
      <span class="vg-count vg-count--fail">❌ ${failed} failed</span>
    `;
    if (vgLog) {
      const shortText = (currentAff.text || '').replace(/\*/g, '').substring(0, 45);
      const icon = status === 'done' ? '✅' : status === 'skip' ? '⏭' : status === 'fail' ? '❌' : '⏳';
      const statusLabel = status === 'done' ? 'Generated' : status === 'skip' ? 'Already exists' : 'Failed';
      const entry = document.createElement('div');
      entry.className = `voice-gen-panel__entry voice-gen-panel__entry--${status}`;
      entry.innerHTML = `<span class="vg-entry-icon">${icon}</span><span class="vg-entry-text">${shortText}…</span><span class="vg-entry-status">${statusLabel}</span>`;
      vgLog.prepend(entry);
      while (vgLog.children.length > 20) vgLog.removeChild(vgLog.lastChild);
    }
  }

  // Phase 1: Separate already-generated from needs-generation
  const needsGen = [];
  for (const aff of affs) {
    const has = await hasStoredAudio(aff.id);
    if (has) {
      skipped++;
      updatePanel(aff, 'skip');
    } else {
      needsGen.push({ id: aff.id, text: (aff.text || '').replace(/\*/g, '').trim() });
    }
  }

  // Phase 2: Run up to 3 parallel WebSocket batches
  if (needsGen.length > 0) {
    const PARALLEL = Math.min(3, needsGen.length);
    const chunkSize = Math.ceil(needsGen.length / PARALLEL);
    const groups = [];
    for (let i = 0; i < needsGen.length; i += chunkSize) {
      groups.push(needsGen.slice(i, i + chunkSize));
    }

    const affMap = {};
    affs.forEach(a => affMap[a.id] = a);

    await Promise.all(groups.map(group =>
      _generateGeminiTTSBatch(group, config.voiceId, (item, blob) => {
        if (blob) {
          generated++;
          updatePanel(affMap[item.id] || item, 'done');
          // Fire-and-forget Drive upload
          _uploadAudioToDrive(item.id).catch(() => {});
        } else {
          failed++;
          updatePanel(affMap[item.id] || item, 'fail');
        }
      })
    ));
  }

  // --- Final state ---
  if (bulkBtn) { bulkBtn.innerHTML = '🎙 Generate All Voices'; bulkBtn.disabled = false; }

  if (panel) {
    panel.classList.add('complete');
    const header = panel.querySelector('.voice-gen-panel__title');
    if (header) header.textContent = failed > 0 ? '⚠️ Generation Complete (with errors)' : '✅ All Voices Ready!';
    setTimeout(() => { if (panel) panel.classList.add('collapsed'); }, 8000);
  }

  updateVoiceStatusIndicators();

  showToast(`Done! ${generated} generated, ${skipped} skipped, ${failed} failed`, failed === 0 ? 'success' : 'warning');
};

// ── Download missing cloud audio silently (called on manager open & ritual start) ──
async function _syncMissingCloudAudio() {
  const affs = state.data.vision_affirmations || [];
  const toDownload = [];
  for (const aff of affs) {
    if (aff.audio_url && !(await hasStoredAudio(aff.id))) toDownload.push(aff);
  }
  if (toDownload.length === 0) return 0;

  let synced = 0;
  // Download 3 at a time
  const BATCH = 3;
  for (let i = 0; i < toDownload.length; i += BATCH) {
    const batch = toDownload.slice(i, i + BATCH);
    await Promise.all(batch.map(async (aff) => {
      try {
        let fileId = aff.audio_url;
        if (fileId.startsWith('drive:')) fileId = fileId.substring(6);
        else if (fileId.includes('id=')) fileId = fileId.split('id=')[1];
        else return;
        const result = await apiCall('downloadAudio', null, { file_id: fileId });
        if (!result?.data) return;
        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
        if (bytes.byteLength < 100) return;
        await _VisionIDB.put('audio://' + aff.id, { type: result.mimeType || 'audio/wav', buffer: bytes.buffer });
        synced++;
      } catch (e) {
        console.warn('[Cloud Sync] Failed for', aff.id, e.message);
      }
    }));
  }
  return synced;
}

// ── Delete stored audio for an affirmation ──
window.deleteAffAudio = async function(affId) {
  try {
    await _VisionIDB.del('audio://' + affId);
    // Clean cached blob URL
    if (window._affAudioCache[affId]) {
      URL.revokeObjectURL(window._affAudioCache[affId]);
      delete window._affAudioCache[affId];
    }
    // Clear cloud reference in sheet
    const aff = (state.data.vision_affirmations || []).find(a => String(a.id) === String(affId));
    if (aff && aff.audio_url) {
      aff.audio_url = '';
      apiCall('update', 'vision_affirmations', { audio_url: '' }, affId).catch(() => {});
    }
    showToast('Voice deleted', 'success');
    updateVoiceStatusIndicators();
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
};

// ── Delete ALL stored audio ──
window.deleteAllAffAudio = async function() {
  if (!confirm('Delete all generated voices? You can regenerate them later.')) return;
  const affs = state.data.vision_affirmations || [];
  let count = 0;
  for (const aff of affs) {
    try {
      const has = await hasStoredAudio(aff.id);
      if (has) {
        await _VisionIDB.del('audio://' + aff.id);
        count++;
      }
      if (window._affAudioCache[aff.id]) {
        URL.revokeObjectURL(window._affAudioCache[aff.id]);
        delete window._affAudioCache[aff.id];
      }
      if (aff.audio_url) {
        aff.audio_url = '';
        apiCall('update', 'vision_affirmations', { audio_url: '' }, aff.id).catch(() => {});
      }
    } catch (e) {}
  }
  showToast(`Deleted ${count} voice${count !== 1 ? 's' : ''}`, 'success');
  updateVoiceStatusIndicators();
};

// ── Download ALL cloud audio to local — replaces any local copies with cloud versions ──
window.downloadAllFromCloud = async function() {
  const affs = state.data.vision_affirmations || [];
  const toDownload = affs.filter(a => a.audio_url);

  if (toDownload.length === 0) {
    showToast('No cloud voices found', 'info');
    return;
  }

  const btn = document.getElementById('downloadCloudBtn');
  if (btn) { btn.disabled = true; btn.textContent = `☁️ 0/${toDownload.length}...`; }

  let synced = 0;
  const BATCH = 3;
  for (let i = 0; i < toDownload.length; i += BATCH) {
    const batch = toDownload.slice(i, i + BATCH);
    await Promise.all(batch.map(async (aff) => {
      try {
        let fileId = aff.audio_url;
        if (fileId.startsWith('drive:')) fileId = fileId.substring(6);
        else if (fileId.includes('id=')) fileId = fileId.split('id=')[1];
        else return;

        const result = await apiCall('downloadAudio', null, { file_id: fileId });
        if (!result?.data) return;

        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
        if (bytes.byteLength < 100) return;

        await _VisionIDB.put('audio://' + aff.id, { type: result.mimeType || 'audio/wav', buffer: bytes.buffer });
        synced++;
      } catch (e) {
        console.warn('[Cloud Download] Failed for', aff.id, e.message);
      }
    }));
    if (btn) btn.textContent = `☁️ ${Math.min(i + BATCH, toDownload.length)}/${toDownload.length}...`;
  }

  if (btn) { btn.disabled = false; btn.textContent = '☁️ Download from Cloud'; }
  showToast(`Downloaded ${synced} voice${synced !== 1 ? 's' : ''} from cloud`, 'success');
  updateVoiceStatusIndicators();
};

// Pre-cached blob URLs for instant playback (avoids async IDB fetch in tap handler)
window._affAudioCache = {};  // { affId: blobUrl }

// Update the voice status badges in the affirmation manager
async function updateVoiceStatusIndicators() {
  // Clean up old cached URLs
  for (const id in window._affAudioCache) {
    URL.revokeObjectURL(window._affAudioCache[id]);
  }
  window._affAudioCache = {};

  const badges = document.querySelectorAll('.aff-voice-badge');
  for (const badge of badges) {
    const affId = badge.dataset.affId;
    if (!affId) continue;
    const has = await hasStoredAudio(affId);
    badge.textContent = has ? '🔊' : '';
    badge.title = has ? 'Voice generated' : '';
  }
  // Also update individual generate buttons + pre-cache audio blob URLs
  const btns = document.querySelectorAll('.aff-voice-gen-btn');
  for (const btn of btns) {
    const affId = btn.dataset.affId;
    if (!affId) continue;
    const stored = await _VisionIDB.get('audio://' + affId);
    const has = !!(stored && stored.buffer);
    btn.innerHTML = has ? '✅' : '🎙';
    btn.title = has ? 'Voice ready — click to regenerate' : 'Generate voice';
    // Pre-cache blob URL for instant playback
    if (has) {
      const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
      window._affAudioCache[affId] = URL.createObjectURL(blob);
    }
  }
  // Show/hide play preview buttons + delete buttons
  const playBtns = document.querySelectorAll('.aff-voice-play-btn');
  for (const btn of playBtns) {
    const affId = btn.dataset.affId;
    if (!affId) continue;
    btn.style.display = window._affAudioCache[affId] ? 'inline-flex' : 'none';
  }
  const delBtns = document.querySelectorAll('.aff-voice-del-btn');
  for (const btn of delBtns) {
    const affId = btn.dataset.affId;
    if (!affId) continue;
    btn.style.display = window._affAudioCache[affId] ? 'inline-flex' : 'none';
  }
}

// Preview/play a generated voice recording — fully synchronous from tap
window._affPreviewAudio = null;
window.previewAffVoice = function(affId) {
  const btn = document.querySelector(`.aff-voice-play-btn[data-aff-id="${affId}"]`);

  // If already playing this one, stop it
  if (window._affPreviewAudio && window._affPreviewAudio._affId === affId) {
    window._affPreviewAudio.pause();
    window._affPreviewAudio.currentTime = 0;
    window._affPreviewAudio = null;
    if (btn) btn.innerHTML = '▶';
    return;
  }

  // Stop any other preview playing
  if (window._affPreviewAudio) {
    window._affPreviewAudio.pause();
    window._affPreviewAudio = null;
    document.querySelectorAll('.aff-voice-play-btn').forEach(b => b.innerHTML = '▶');
  }

  // Use pre-cached blob URL (set during updateVoiceStatusIndicators)
  const cachedUrl = window._affAudioCache[affId];
  if (!cachedUrl) {
    showToast('No voice recording found — generate it first', 'error');
    return;
  }

  // Create Audio and play immediately — no async gap, iOS gesture chain preserved
  const audio = new Audio(cachedUrl);
  audio.volume = 1.0;
  audio._affId = affId;
  window._affPreviewAudio = audio;

  if (btn) btn.innerHTML = '⏸';

  audio.onended = () => {
    window._affPreviewAudio = null;
    if (btn) btn.innerHTML = '▶';
  };
  audio.onerror = () => {
    window._affPreviewAudio = null;
    if (btn) btn.innerHTML = '▶';
    showToast('Audio playback error', 'error');
  };

  audio.play().catch(() => {
    if (btn) btn.innerHTML = '▶';
    showToast('Playback blocked by browser — tap again', 'warning');
  });
};

// Read stored {type, buffer} from IDB and return an objectURL
async function _idbToObjectUrl(stored) {
  if (!stored) return null;
  if (typeof stored === 'string') return stored; // legacy base64
  if (stored.buffer) {
    const type = stored.type || 'video/mp4';
    const blob = new Blob([stored.buffer], { type: type });
    return { url: URL.createObjectURL(blob), type: type };
  }
  if (stored instanceof Blob) return { url: URL.createObjectURL(stored), type: stored.type };
  return null;
}

// Resolve a local:// or local-img:// reference to a usable URL (async)
// This ensures we always have a valid Blob URL even if the page was refreshed or memory cleared.
async function resolveMediaUrlAsync(url) {
  if (!url) return '';
  if (url.startsWith('local://') || url.startsWith('local-img://')) {
    const isImg = url.includes('local-img://');

    // Handle "local-img://KEY|drive:ID" or "local://KEY|drive:ID" format
    let fullRef = isImg ? url.slice(12) : url.slice(8);
    let driveRef = null;
    let key = fullRef;
    if (fullRef.includes('|drive:')) {
      const parts = fullRef.split('|');
      key = parts[0];
      driveRef = parts[1]; // "drive:XXXXX"
    }

    // Check in-memory cache first
    if (window._visionMediaCache[key]) return window._visionMediaCache[key];

    // Try fetching from local IDB
    try {
      const stored = await _VisionIDB.get(key);
      const res = await _idbToObjectUrl(stored);
      if (res && res.url) {
        window._visionMediaCache[key] = res.url;
        return res.url;
      }
    } catch (e) {}

    // Not in local IDB — try downloading from Drive if we have a cloud ref
    if (driveRef) {
      try {
        const downloaded = await _downloadMediaFromDrive(driveRef);
        if (downloaded && downloaded.buffer) {
          await _VisionIDB.put(key, downloaded);
          const blob = new Blob([downloaded.buffer], { type: downloaded.type });
          const blobUrl = URL.createObjectURL(blob);
          window._visionMediaCache[key] = blobUrl;
          return blobUrl;
        }
      } catch (e) {
        console.warn('Cloud media download failed for:', key, e);
      }
    }

    return '';
  }
  return sanitizeUrl(url);
}

/**
 * Robustly initialize video elements by reading data-vision-local attribute.
 * This is necessary because <script> tags in innerHTML do NOT execute.
 */
async function initVisionMediaElements(container = document) {
  const vids = container.querySelectorAll('video[data-vision-local]');
  for (const vid of vids) {
    const url = vid.getAttribute('data-vision-local');
    if (url && url.startsWith('local://')) {
      const blobUrl = await resolveMediaUrlAsync(url);
      if (blobUrl) {
        vid.src = blobUrl;
        vid.load();
        if (vid.hasAttribute('autoplay')) {
          vid.play().catch(e => console.warn('Autoplay failed', e));
        }
      }
    }
  }
}

// Legacy sync version for places where async is not yet supported
function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('local://') || url.startsWith('local-img://')) {
    const key = url.includes('local-img://') ? url.slice(12) : url.slice(8);
    return window._visionMediaCache[key] || '';
  }
  return sanitizeUrl(url);
}

// Pre-load ALL local media from IDB into memory before rendering
async function preloadLocalMedia(goals) {
  for (const g of (goals || [])) {
    // Video
    if (g.video_url) {
      const vids = g.video_url.split(',').map(s => s.trim()).filter(Boolean);
      for (const v of vids) {
        if (v.startsWith('local://')) {
          const key = v.slice(8);
          if (!window._visionMediaCache[key]) {
            try {
              const stored = await _VisionIDB.get(key);
              const res = await _idbToObjectUrl(stored);
              if (res && res.url) window._visionMediaCache[key] = res.url;
            } catch (e) { console.warn('IDB video load failed', key, e); }
          }
        }
      }
    }
    // Image
    if (g.image_url && g.image_url.startsWith('local-img://')) {
      const key = g.image_url.slice(12);
      if (!window._visionMediaCache[key]) {
        try {
          const stored = await _VisionIDB.get(key);
          const res = await _idbToObjectUrl(stored);
          if (res && res.url) window._visionMediaCache[key] = res.url;
        } catch (e) { console.warn('IDB image load failed', key, e); }
      }
    }
  }
}



// Vision State Management
let visionState = {
  view: 'grid',
  filter: 'focus', // default = Focus This Month
  search: '',
  sort: 'newest',
  listSort: { col: 'target', dir: 'asc' }, // desktop table column sort
};

const VISION_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

/* ══════════════════════════════════════════════════════════════════════
   VISION DESKTOP COMMAND CENTER — scoped to .vz-pro. Two-pane on desktop:
   board (left) + insight/detail pane (right). Mobile (<1100px) keeps the
   single-column layout and the existing full-screen detail modal.
   ══════════════════════════════════════════════════════════════════════ */
const VISION_REFINE_CSS = `<style>
.vz-pro { max-width:1340px; margin:0 auto; }

/* Overview bar */
.vz-ov { display:flex; align-items:center; gap:22px; flex-wrap:wrap; background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; box-shadow:var(--shadow-card); padding:14px 18px; margin-bottom:14px; }
.vz-ov-ring { display:flex; align-items:center; gap:12px; }
.vz-ov-ring .rw { position:relative; width:54px; height:54px; flex-shrink:0; }
.vz-ov-ring .rw b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; }
.vz-ov-ring .rl { font-size:12px; color:var(--text-3); line-height:1.3; }
.vz-ov-ring .rl b { color:var(--text-1); font-size:13px; }
.vz-ov-div { width:1px; height:30px; background:var(--border-color); }
.vz-ov-item { display:flex; flex-direction:column; gap:2px; cursor:default; }
.vz-ov-item b { font-size:19px; font-weight:700; color:var(--text-1); letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.vz-ov-item span { font-size:11.5px; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; font-weight:600; }
.vz-ov-next { margin-left:auto; text-align:right; }
.vz-ov-next .t { font-size:13px; color:var(--text-2); font-weight:600; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vz-ov-next .d { font-size:12px; color:var(--text-3); }
.vz-ov-next .d.urgent { color:#B42318; font-weight:600; }

/* ════ Integrated control header (desktop overhaul) — stats + view + filters + actions ════ */
.vz-head { margin-bottom:20px; }
.vz-head__top { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
.vz-stats { display:flex; align-items:center; gap:13px; flex-wrap:wrap; }
.vz-stat { display:inline-flex; align-items:center; gap:7px; font-size:13.5px; color:var(--text-3); font-weight:500; white-space:nowrap; }
.vz-stat b { color:var(--text-1); font-weight:700; font-variant-numeric:tabular-nums; }
.vz-stat__ring { display:inline-flex; line-height:0; }
.vz-stat--warn { color:#B42318; font-weight:600; max-width:280px; overflow:hidden; text-overflow:ellipsis; }
.vz-stat-sep { width:1px; height:15px; background:var(--border-color); flex-shrink:0; }
.vz-viewseg { display:inline-flex; background:var(--surface-2); border:1px solid var(--border-color); border-radius:10px; padding:3px; gap:2px; flex-shrink:0; }
.vz-viewseg button { border:none; background:transparent; color:var(--text-3); font-size:13px; font-weight:600; padding:7px 13px; border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all .14s; white-space:nowrap; }
.vz-viewseg button:hover { color:var(--text-1); }
.vz-viewseg button.active { background:var(--surface-1); color:var(--text-1); box-shadow:var(--shadow-xs); }
.vz-viewseg .vz-viewseg--story { color:var(--primary); }
.vz-head__bar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding-bottom:16px; border-bottom:1px solid var(--border-color); }
.vz-head__secondary { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.vz-mini-btn { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border-color); border-radius:9px; padding:7px 12px; cursor:pointer; transition:all .14s; white-space:nowrap; }
.vz-mini-btn:hover { border-color:var(--border-strong); color:var(--text-1); }
.vz-board--full { width:100%; }

/* Toolbar / filters / view tabs */
.vz-pro .vision-toolbar { margin-bottom:12px; }
.vz-pro .vision-filter-chip { border-width:1px; }
.vz-pro .vision-view-tabs { width:fit-content; }

/* Two-pane workspace (grid view) */
.vz-workspace { display:flex; gap:20px; align-items:flex-start; }
.vz-board { flex:1; min-width:0; }
.vz-pane { flex:0 0 360px; position:sticky; top:12px; max-height:calc(100vh - 90px); overflow-y:auto; display:flex; flex-direction:column; gap:13px; padding-bottom:8px; }

/* Quick-action bar on cards (inline progress + edit) — desktop only. */
.vz-quick { display:none; }
.vz-quick__b { width:26px; height:26px; border-radius:8px; border:1px solid rgba(255,255,255,.38); background:rgba(255,255,255,.18); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); color:#fff; font-size:16px; font-weight:700; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s, transform .12s; flex-shrink:0; }
.vz-quick__b:hover { background:rgba(255,255,255,.36); transform:translateY(-1px); }
.vz-quick__b:active { transform:scale(.92); }
.vz-quick__b svg { width:14px; height:14px; }
.vz-quick__p { font-size:13px; font-weight:800; color:#fff; min-width:40px; text-align:center; font-variant-numeric:tabular-nums; text-shadow:0 1px 3px rgba(0,0,0,.45); }
.vz-quick__sp { flex:1; }
.vz-quick__color { width:26px; height:26px; border-radius:8px; border:1px solid color-mix(in srgb, var(--vz-ink,#fff) 55%, transparent); cursor:pointer; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,.25); padding:0; }

/* ── Solid-color cards: auto-contrast ink + tinted accents (no photo overlay) ── */
.vision-card--color .vision-card-overlay { display:none !important; }
.vision-card--color .vision-card-content { color:var(--vz-ink); }
.vision-card--color .vision-card-title { color:var(--vz-ink); }
.vision-card--color.vz-ink-light .vision-card-title { text-shadow:0 1px 8px rgba(0,0,0,.42); }
.vision-card--color .vision-card-cat-tag { background:color-mix(in srgb, var(--vz-ink) 15%, transparent); color:var(--vz-ink); border-color:color-mix(in srgb, var(--vz-ink) 30%, transparent); }
.vision-card--color .vision-aff-indicator { background:color-mix(in srgb, var(--vz-ink) 16%, transparent); color:var(--vz-ink); border-color:color-mix(in srgb, var(--vz-ink) 30%, transparent); }
.vision-card--color .vision-card-progress { background:color-mix(in srgb, var(--vz-ink) 22%, transparent); }
.vision-card--color .vision-progress-fill { background:var(--vz-ink) !important; }
.vision-card--color .vz-quick__b { color:var(--vz-ink); border:1px solid color-mix(in srgb, var(--vz-ink) 32%, transparent); background:color-mix(in srgb, var(--vz-ink) 12%, transparent); }
.vision-card--color .vz-quick__b:hover { background:color-mix(in srgb, var(--vz-ink) 22%, transparent); }
.vision-card--color .vz-quick__p { color:var(--vz-ink); text-shadow:none; }
.vision-card--color .vision-card-badge.normal { background:color-mix(in srgb, var(--vz-ink) 18%, transparent); color:var(--vz-ink); }

/* ── Color picker modal: curated palette + custom ── */
.vz-palette { display:grid; grid-template-columns:repeat(6, 1fr); gap:10px; }
.vz-sw { aspect-ratio:1; border-radius:10px; border:2px solid transparent; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); padding:0; }
.vz-sw.sel { box-shadow:0 0 0 2px var(--surface-1), 0 0 0 4px var(--text-1); }
.vz-sw--custom { display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; background:var(--surface-2); border:1.5px dashed var(--border-color); color:var(--text-3); font-size:20px; box-shadow:none; }
.vz-sw--custom input[type=color] { position:absolute; inset:0; opacity:0; cursor:pointer; }
/* Edit-goal "Show on board" Color/Image toggle */
.vz-disp-row { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.vz-disp-lbl { font-size:12px; font-weight:600; color:var(--text-3); }
.vz-disp-seg { display:inline-flex; background:var(--surface-2); border:1px solid var(--border-color); border-radius:9px; padding:3px; gap:2px; }
.vz-disp { border:none; background:transparent; color:var(--text-3); font-size:12.5px; font-weight:600; padding:6px 14px; border-radius:7px; cursor:pointer; transition:all .14s; }
.vz-disp.active { background:var(--surface-1); color:var(--text-1); box-shadow:var(--shadow-xs); }

/* Denser, refined, compact cards — desktop only (mobile card shape untouched) */
@media (min-width:1000px){
  .vz-pro .vz-board .vision-grid { grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)) !important; gap:14px !important; }
  .vz-pro .vision-card { border-radius:var(--radius-lg); aspect-ratio:auto !important; min-height:0 !important; height:176px; box-shadow:var(--shadow-card); transition:box-shadow .18s ease, transform .18s ease; }
  .vz-pro .vision-card:hover { box-shadow:var(--shadow-lg); transform:translateY(-2px); }
  .vz-pro .vision-card.vz-sel { box-shadow:0 0 0 2px var(--primary), var(--shadow-lg); }
  .vz-pro .vision-card-content { padding:12px 12px 11px; }
  .vz-pro .vision-card-title { font-size:18px; font-weight:800; margin-bottom:7px; -webkit-line-clamp:2; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
  .vz-pro .vision-card-cat-tag { top:10px; left:10px; padding:4px 11px; font-size:11.5px; }
  .vz-pro .vz-quick__p { font-size:15px; min-width:46px; }
  .vz-pro .vision-aff-indicator { width:30px; height:30px; top:10px; right:10px; }
  .vz-pro .vz-quick { display:flex; align-items:center; gap:6px; margin-top:9px; }
  .vz-pro .vz-pane { flex-basis:340px; }
}

/* Pane cards */
.vzp-card { background:var(--surface-1); border:1px solid var(--border-color); border-radius:13px; box-shadow:var(--shadow-card); padding:15px; }
.vzp-h { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); font-weight:700; margin:0 0 10px; }
.vzp-ritual { display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; background:linear-gradient(135deg, color-mix(in srgb,var(--primary) 12%,var(--surface-1)), var(--surface-1)); }
.vzp-ritual:hover { box-shadow:var(--shadow-md); }
.vzp-ritual .rx { font-size:14px; font-weight:700; color:var(--text-1); }
.vzp-ritual .rs { font-size:12px; color:var(--text-3); margin-top:2px; }
.vzp-ritual .rgo { width:38px; height:38px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.vzp-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer; }
.vzp-row:last-child { border-bottom:none; }
.vzp-row .nm { flex:1; font-size:13px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vzp-row:hover .nm { color:var(--text-1); }
.vzp-row .dd { font-size:11px; font-weight:600; color:var(--text-3); }
.vzp-row .dd.urgent { color:#B42318; }
.vzp-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.vzp-cat { margin-bottom:11px; }
.vzp-cat:last-child { margin-bottom:0; }
.vzp-cat-top { display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-2); margin-bottom:5px; }
.vzp-cat-top b { color:var(--text-1); font-variant-numeric:tabular-nums; }
.vzp-bar { height:6px; background:var(--surface-3); border-radius:999px; overflow:hidden; }
.vzp-bar i { display:block; height:100%; background:var(--primary); border-radius:999px; }
.vzp-empty { font-size:12.5px; color:var(--text-3); }

/* Goal detail pane */
.vzp-hero { height:140px; border-radius:12px; background-size:cover; background-position:center; position:relative; overflow:hidden; margin-bottom:12px; }
.vzp-hero::after { content:""; position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,.5), transparent 60%); }
.vzp-hero .cat { position:absolute; top:10px; left:10px; z-index:1; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#fff; background:rgba(0,0,0,.35); backdrop-filter:blur(4px); padding:3px 9px; border-radius:999px; }
.vzp-hero .x { position:absolute; top:10px; right:10px; z-index:1; width:28px; height:28px; border:none; border-radius:8px; background:rgba(0,0,0,.4); backdrop-filter:blur(4px); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.vzp-dtitle { font-size:17px; font-weight:700; color:var(--text-1); letter-spacing:-.01em; margin-bottom:10px; }
.vzp-prog-top { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
.vzp-prog-top b { font-size:22px; font-weight:700; color:var(--text-1); font-variant-numeric:tabular-nums; }
.vzp-prog-top span { font-size:12px; color:var(--text-3); }
.vzp-range { width:100%; accent-color:var(--primary); margin:2px 0 4px; }
.vzp-meta { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
.vzp-chip { font-size:12px; padding:4px 10px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-2); }
.vzp-lbl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3); margin:14px 0 8px; }
.vzp-hab { display:inline-flex; align-items:center; gap:5px; font-size:12px; padding:4px 10px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-2); margin:0 5px 5px 0; }
.vzp-gallery { display:flex; gap:6px; flex-wrap:wrap; }
.vzp-gallery i { width:52px; height:52px; border-radius:8px; background-size:cover; background-position:center; border:1px solid var(--border-color); display:block; }
.vzp-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
.vzp-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px; border:1px solid var(--border-color); background:var(--surface-1); border-radius:9px; font:inherit; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; }
.vzp-btn:hover { background:var(--surface-2); color:var(--text-1); }
.vzp-btn.primary { grid-column:1/-1; background:var(--primary); color:#fff; border-color:transparent; }
.vzp-btn.primary:hover { filter:brightness(.96); color:#fff; }
.vzp-btn.ok { color:var(--success,#10B981); }
.vzp-btn.danger:hover { color:#B42318; background:rgba(220,38,38,.06); border-color:rgba(220,38,38,.2); }

/* List → table */
.vz-pro .vz-table-wrap { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; box-shadow:var(--shadow-card); overflow:hidden; }
.vz-pro .vz-table { width:100%; border-collapse:separate; border-spacing:0; }
.vz-pro .vz-table th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); font-weight:600; padding:12px 16px; border-bottom:1px solid var(--border-color); background:var(--surface-2); cursor:pointer; user-select:none; white-space:nowrap; }
.vz-pro .vz-table th:hover { color:var(--text-1); }
.vz-pro .vz-table td { padding:13px 16px; border-bottom:1px solid var(--border-color); font-size:13.5px; color:var(--text-2); }
.vz-pro .vz-table tbody tr:last-child td { border-bottom:none; }
.vz-pro .vz-table tbody tr { cursor:pointer; transition:background .12s; }
.vz-pro .vz-table tbody tr:hover td { background:var(--surface-2); }
.vz-pro .vz-td-title { font-weight:600; color:var(--text-1); }
.vz-pro .vz-tcat { font-size:12px; padding:3px 9px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border-color); color:var(--text-2); }
.vz-pro .vz-tprog { display:flex; align-items:center; gap:8px; min-width:130px; }
.vz-pro .vz-tprog-bar { flex:1; height:6px; background:var(--surface-3); border-radius:999px; overflow:hidden; }
.vz-pro .vz-tprog-bar i { display:block; height:100%; background:var(--primary); border-radius:999px; }
.vz-pro .vz-tprog span { font-size:12px; font-variant-numeric:tabular-nums; color:var(--text-2); min-width:34px; text-align:right; }
.vz-pro .vz-tdate { font-variant-numeric:tabular-nums; white-space:nowrap; }
.vz-pro .vz-tdate.over { color:#B42318; }
.vz-pro .vz-tbadge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; background:var(--surface-2); color:var(--text-3); }
.vz-pro .vz-tbadge.ok { background:rgba(16,185,129,.12); color:#067647; }
.vz-pro .vz-tbadge.late { background:rgba(220,38,38,.09); color:#B42318; }

/* Timeline → roadmap */
.vz-pro .vz-roadmap { display:flex; flex-direction:column; gap:16px; }
.vz-pro .vz-rd-lane { background:var(--surface-1); border:1px solid var(--border-color); border-radius:14px; box-shadow:var(--shadow-card); padding:14px 16px; }
.vz-pro .vz-rd-lane.over { border-color:rgba(220,38,38,.25); }
.vz-pro .vz-rd-head { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3); margin-bottom:12px; }
.vz-pro .vz-rd-lane.over .vz-rd-head { color:#B42318; }
.vz-pro .vz-rd-head span { background:var(--surface-2); border-radius:999px; padding:1px 8px; font-size:11px; color:var(--text-2); }
.vz-pro .vz-rd-items { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:10px; }
.vz-pro .vz-rd-item { display:flex; align-items:center; gap:11px; padding:10px 12px; border:1px solid var(--border-color); border-radius:11px; cursor:pointer; transition:all .14s; }
.vz-pro .vz-rd-item:hover { border-color:var(--border-strong); box-shadow:var(--shadow-xs); }
.vz-pro .vz-rd-cat { width:34px; height:34px; border-radius:9px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.vz-pro .vz-rd-main { flex:1; min-width:0; }
.vz-pro .vz-rd-title { font-size:13.5px; font-weight:600; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vz-pro .vz-rd-meta { font-size:11.5px; color:var(--text-3); margin:2px 0 5px; }
.vz-pro .vz-rd-bar { height:5px; background:var(--surface-3); border-radius:999px; overflow:hidden; }
.vz-pro .vz-rd-bar i { display:block; height:100%; background:var(--primary); border-radius:999px; }
.vz-pro .vz-rd-pct { font-size:12px; font-weight:700; color:var(--text-2); font-variant-numeric:tabular-nums; flex-shrink:0; }

/* ════ VISUAL HIERARCHY (quiet sidebar) — guide the eye top → content → rail ════ */
@media (min-width:1000px){
  /* 1 · Calm the top zone so it orients without competing with content */
  .vz-pro .vz-ov { background:var(--surface-2); box-shadow:none; padding:12px 16px; margin-bottom:12px; }
  .vz-pro .tdp-header-row { background:transparent; border:1px solid var(--border-color); padding:7px 12px; margin-bottom:18px; }
  .vz-pro .tdp-btn { background:var(--surface-1); color:var(--text-1); border:1px solid var(--border-color); min-width:0; padding:6px 13px; box-shadow:none; }
  .vz-pro .tdp-btn:hover { transform:none; box-shadow:none; border-color:var(--border-strong); }
  .vz-pro .tdp-btn-label { color:var(--text-3); opacity:1; }
  .vz-pro .tdp-btn-status { font-size:13px; font-weight:700; color:var(--text-1); }
  .vz-pro .vision-toolbar { margin-bottom:10px; }

  /* 2 · A clear section heading marks the grid as the primary content */
  .vz-board-head { display:flex; align-items:baseline; gap:9px; margin:0 0 13px; }
  .vz-board-head h2 { font-size:15px; font-weight:700; color:var(--text-1); margin:0; letter-spacing:-.01em; }
  .vz-board-head .n { font-size:13px; color:var(--text-3); font-weight:600; }

  /* 3 · Subordinate the rail — narrower, lighter, lower contrast = clearly secondary */
  .vz-pane { flex-basis:300px; }
  .vz-pro .vzp-card { background:var(--surface-2); box-shadow:none; border:1px solid var(--border-color); padding:14px; }
  .vz-pro .vzp-ritual { box-shadow:none; }
  .vz-pro .vzp-h { color:var(--text-3); }
}

@media (max-width:999px){
  .vz-pro { max-width:none; }
  .vz-workspace { display:block; }
  .vz-pane { display:none; }
}

/* ═══ VISION STORIES — full-screen one-by-one viewer (Instagram-style, desktop) ═══ */
.vz-story-overlay { position:fixed; inset:0; z-index:9999; background:rgba(8,10,18,.88); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; }
.vz-story-overlay.hidden { display:none !important; }
.vz-story-tools { position:absolute; top:16px; left:0; right:0; padding:0 22px; display:flex; align-items:center; gap:10px; z-index:3; }
.vz-story-modes { display:inline-flex; background:rgba(255,255,255,.14); border-radius:11px; padding:3px; }
.vz-story-modes button { border:none; background:transparent; color:rgba(255,255,255,.72); font-size:13px; font-weight:600; padding:7px 18px; border-radius:8px; cursor:pointer; transition:all .15s; }
.vz-story-modes button.active { background:#fff; color:#0F172A; }
.vz-story-tbtn { width:40px; height:40px; border-radius:50%; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.12); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }
.vz-story-tbtn:hover { background:rgba(255,255,255,.26); }
.vz-story-top { position:absolute; top:64px; left:50%; transform:translateX(-50%); width:min(640px,72vw); z-index:3; }
.vz-story-segs { display:flex; gap:5px; }
.vz-seg { flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,.26); border:none; cursor:pointer; padding:0; transition:background .2s; }
.vz-seg.past { background:rgba(255,255,255,.65); }
.vz-seg.on { background:#fff; }
.vz-story-nav { position:absolute; top:50%; transform:translateY(-50%); width:52px; height:52px; border-radius:50%; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.12); color:#fff; font-size:30px; line-height:1; cursor:pointer; z-index:3; display:flex; align-items:center; justify-content:center; transition:background .15s; }
.vz-story-nav:hover { background:rgba(255,255,255,.26); }
.vz-story-nav.prev { left:26px; } .vz-story-nav.next { right:26px; }
.vz-story-nav.disabled { opacity:.22; pointer-events:none; }
.vz-story-stage { display:flex; flex-direction:column; align-items:center; gap:12px; }
.vz-story-card { display:flex; width:min(940px,86vw); height:min(600px,80vh); background:var(--surface-1); border-radius:20px; overflow:hidden; box-shadow:0 30px 90px rgba(0,0,0,.55); }
.vz-story-media { position:relative; flex:0 0 42%; background:#0c0c0c; }
.vz-story-img { position:absolute; inset:0; background-size:cover; background-position:center; }
.vz-story-vid { width:100%; height:100%; object-fit:cover; }
.vz-story-media::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.05) 40%, rgba(0,0,0,.62) 100%); pointer-events:none; }
.vz-story-cat { position:absolute; top:14px; left:14px; z-index:2; background:rgba(255,255,255,.2); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.25); color:#fff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:4px 11px; border-radius:999px; }
.vz-story-mtitle { position:absolute; left:18px; right:18px; bottom:18px; z-index:2; color:#fff; font-size:22px; font-weight:800; line-height:1.2; text-shadow:0 2px 10px rgba(0,0,0,.5); }
.vz-story-side { flex:1; min-width:0; padding:22px 24px; overflow-y:auto; }
.vz-story-row1 { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.vz-story-prog { display:flex; align-items:baseline; gap:5px; margin-right:auto; }
.vz-story-prog b { font-size:26px; font-weight:800; color:var(--text-1); letter-spacing:-.02em; }
.vz-story-prog span { font-size:12px; color:var(--text-3); }
.vz-story-chip { font-size:12px; font-weight:600; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border-color); border-radius:999px; padding:4px 10px; white-space:nowrap; }
.vz-story-chip.focus { color:var(--primary); }
.vz-story-chip.over { color:#B42318; border-color:rgba(220,38,38,.3); }
.vz-story-bar { height:7px; background:var(--surface-3); border-radius:999px; overflow:hidden; margin-bottom:8px; }
.vz-story-bar i { display:block; height:100%; background:var(--primary); border-radius:999px; transition:width .25s ease; }
.vz-story-prog-ctl { display:flex; gap:8px; margin-bottom:16px; }
.vz-story-prog-ctl button { width:40px; height:32px; border-radius:9px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); font-size:18px; font-weight:700; cursor:pointer; transition:all .14s; }
.vz-story-prog-ctl button:hover { background:var(--surface-2); border-color:var(--border-strong); }
.vz-story-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); margin:14px 0 6px; }
.vz-story-text { font-size:13.5px; color:var(--text-2); line-height:1.6; white-space:pre-wrap; }
.vz-story-habs { display:flex; flex-wrap:wrap; gap:6px; }
.vz-story-hab { font-size:12px; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border-color); border-radius:8px; padding:4px 9px; }
.vz-story-gal { display:flex; flex-wrap:wrap; gap:7px; }
.vz-story-gal i { width:54px; height:54px; border-radius:9px; background-size:cover; background-position:center; cursor:pointer; border:1px solid var(--border-color); transition:transform .14s; }
.vz-story-gal i:hover { transform:scale(1.06); }
.vz-story-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; }
.vz-story-btn { padding:9px 15px; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-1); color:var(--text-1); font-size:13px; font-weight:600; cursor:pointer; transition:all .14s; }
.vz-story-btn:hover { background:var(--surface-2); }
.vz-story-btn.primary { background:var(--primary); border-color:var(--primary); color:#fff; }
.vz-story-btn.ok { color:#0F766E; border-color:rgba(15,118,110,.3); }
.vz-story-count { color:rgba(255,255,255,.7); font-size:12.5px; font-weight:600; font-variant-numeric:tabular-nums; }
.vz-story-empty { color:rgba(255,255,255,.85); font-size:15px; text-align:center; max-width:360px; line-height:1.6; }
.vz-story-launch { color:var(--primary) !important; }
@media (max-width:999px){
  .vz-story-card { flex-direction:column; width:92vw; height:86vh; }
  .vz-story-media { flex:0 0 44%; }
  .vz-story-nav { width:44px; height:44px; font-size:24px; }
  .vz-story-nav.prev { left:10px; } .vz-story-nav.next { right:10px; }
}
</style>`;

let _vzSelId = null;
function _vzDesktop() { try { return window.matchMedia('(min-width:1000px)').matches; } catch (e) { return (window.innerWidth || 1280) >= 1000; } }
function _vzDays(d) { return d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null; }
function _vzIsFocus(g) { return g.month_focus === true || String(g.month_focus).toLowerCase() === 'true'; }
function _vzRitualStreak() {
  const days = new Set((state.data.ritual_logs || []).filter(r => r.completed !== false && r.date).map(r => String(r.date).slice(0, 10)));
  if (!days.size) return 0;
  const iso = x => x.toISOString().slice(0, 10);
  let streak = 0; const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
function _vzKey(e) {
  if (!document.querySelector('.vz-pane')) return;            // only on Vision grid (desktop)
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if (e.key === 'Escape') { if (_vzSelId) { vzCloseDetail(); e.preventDefault(); } return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const order = window._vzOrder || [];
  if (!order.length) return;
  let i = _vzSelId ? order.indexOf(String(_vzSelId)) : -1;
  i = e.key === 'ArrowDown' ? Math.min(order.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
  const id = order[i];
  if (id) { _vzSelId = null; vzSelect(id); const c = document.getElementById('vision-card-' + id); if (c) c.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
}
function _vzLinkedHabitNames(g) {
  let arr = [];
  try { if (g.linked_habits) { const s = String(g.linked_habits).trim(); arr = s.startsWith('[') ? JSON.parse(s) : s.split(',').map(x => ({ id: x.trim() })); } } catch (e) {}
  const habits = state.data.habits || [];
  return arr.map(h => { const id = (h && h.id != null) ? h.id : h; const hb = habits.find(x => String(x.id) === String(id)); return hb ? hb.habit_name : null; }).filter(Boolean);
}

window.vzCardOpen = function (id) { openVisionDetail(id); };
window.vzSelect = function (id) {
  _vzSelId = (String(id) === String(_vzSelId)) ? null : String(id);
  vzRenderPane();
  document.querySelectorAll('.vision-card.vz-sel').forEach(c => c.classList.remove('vz-sel'));
  if (_vzSelId) { const c = document.getElementById('vision-card-' + _vzSelId); if (c) c.classList.add('vz-sel'); }
};
window.vzCloseDetail = function () { _vzSelId = null; vzRenderPane(); document.querySelectorAll('.vision-card.vz-sel').forEach(c => c.classList.remove('vz-sel')); };
function vzPaneHTML() {
  const g = _vzSelId ? (state.data.vision || []).find(v => String(v.id) === String(_vzSelId)) : null;
  return g ? vzGoalDetailHTML(g) : vzInsightHTML();
}
function vzRenderPane() {
  const p = document.querySelector('.vz-pane');
  if (!p) return;
  p.innerHTML = vzPaneHTML();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
window.vzSetProgress = async function (id, val) {
  const g = (state.data.vision || []).find(v => String(v.id) === String(id));
  if (!g) return;
  g.progress = parseInt(val, 10) || 0;
  _vzSyncProgressUI(id, g.progress);
  try { await apiCall('update', 'vision_board', { progress: g.progress }, id); } catch (e) {}
};

// One-tap progress from a card's −/+ buttons (clamped 0–100).
window.vzBump = async function (id, delta) {
  const g = (state.data.vision || []).find(v => String(v.id) === String(id));
  if (!g) return;
  const p = Math.max(0, Math.min(100, (parseInt(g.progress, 10) || 0) + delta));
  if (p === (parseInt(g.progress, 10) || 0)) return;
  g.progress = p;
  _vzSyncProgressUI(id, p);
  try { await apiCall('update', 'vision_board', { progress: p }, id); } catch (e) {}
};

// Keep every on-screen progress indicator for a goal in sync (card bar, card %, pane slider + label).
function _vzSyncProgressUI(id, p) {
  const card = document.getElementById('vision-card-' + id);
  if (card) {
    const fill = card.querySelector('.vision-progress-fill');
    if (fill) { fill.style.width = p + '%'; fill.style.setProperty('--progress-width', p + '%'); }
  }
  const qp = document.getElementById('vzqp-' + id); if (qp) qp.textContent = p + '%';
  if (String(_vzSelId) === String(id)) {
    const lbl = document.getElementById('vzProgVal'); if (lbl) lbl.textContent = p + '%';
    const rng = document.querySelector('.vz-pane .vzp-range'); if (rng) rng.value = p;
  }
}

function vzInsightHTML() {
  const goals = (state.data.vision || []).filter(g => g.status !== 'achieved');
  const focus = goals.filter(_vzIsFocus);
  const due = goals.filter(g => g.target_date).sort((a, b) => new Date(a.target_date) - new Date(b.target_date)).slice(0, 4);
  const cats = {};
  goals.forEach(g => { const c = g.category || 'Personal'; (cats[c] = cats[c] || { n: 0, sum: 0 }); cats[c].n++; cats[c].sum += (parseInt(g.progress, 10) || 0); });
  const catRows = Object.keys(cats).sort().map(c => { const a = Math.round(cats[c].sum / cats[c].n); return `<div class="vzp-cat"><div class="vzp-cat-top"><span>${escapeHtml(c)}</span><b>${a}%</b></div><div class="vzp-bar"><i style="width:${a}%"></i></div></div>`; }).join('');
  const focusRows = focus.length ? focus.map(g => `<div class="vzp-row" onclick="vzSelect('${g.id}')"><span class="vzp-dot" style="background:var(--primary)"></span><span class="nm">${escapeHtml(g.title || '')}</span><span class="dd">${(parseInt(g.progress, 10) || 0)}%</span></div>`).join('') : `<div class="vzp-empty">Star goals to focus on this month.</div>`;
  const dueRows = due.length ? due.map(g => { const d = _vzDays(g.target_date); const u = d != null && d <= 30; return `<div class="vzp-row" onclick="vzSelect('${g.id}')"><span class="vzp-dot" style="background:${u ? '#DC2626' : 'var(--text-3)'}"></span><span class="nm">${escapeHtml(g.title || '')}</span><span class="dd ${u ? 'urgent' : ''}">${d < 0 ? Math.abs(d) + 'd ago' : d + 'd'}</span></div>`; }).join('') : `<div class="vzp-empty">No upcoming target dates.</div>`;
  const rstreak = _vzRitualStreak();
  return `
  <div class="vzp-card vzp-ritual" onclick="startManifestationRitual()">
    <div><div class="rx">Daily Ritual</div><div class="rs">${rstreak > 0 ? `🔥 ${rstreak}-day streak` : 'Manifest your vision'}</div></div>
    <span class="rgo"><i data-lucide="play" style="width:14px;height:14px"></i></span>
  </div>
  <div class="vzp-card"><div class="vzp-h">Focus this month</div>${focusRows}</div>
  <div class="vzp-card"><div class="vzp-h">Due soon</div>${dueRows}</div>
  ${catRows ? `<div class="vzp-card"><div class="vzp-h">Progress by category</div>${catRows}</div>` : ''}`;
}

function vzGoalDetailHTML(g) {
  const prog = parseInt(g.progress, 10) || 0;
  const d = _vzDays(g.target_date);
  const hero = g.image_url ? (resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url)) : getDefaultImage(g);
  const habits = _vzLinkedHabitNames(g);
  const affs = (state.data.vision_affirmations || []).filter(a => String(a.vision_id) === String(g.id));
  const imgs = (state.data.vision_images || []).filter(im => String(im.vision_id) === String(g.id)).slice(0, 6);
  const isFocus = _vzIsFocus(g);
  return `
  <div class="vzp-card">
    <div class="vzp-hero" style="background-image:url('${hero}')">
      <span class="cat">${escapeHtml(g.category || 'Personal')}</span>
      <button class="x" onclick="vzCloseDetail()"><i data-lucide="x" style="width:14px;height:14px"></i></button>
    </div>
    <div class="vzp-dtitle">${escapeHtml(g.title || '')}</div>
    <div class="vzp-prog-top"><b id="vzProgVal">${prog}%</b><span>progress</span></div>
    <input class="vzp-range" type="range" min="0" max="100" step="5" value="${prog}" oninput="vzSetProgress('${g.id}', this.value)">
    <div class="vzp-meta">
      ${g.target_date ? `<span class="vzp-chip">🎯 ${formatDate(g.target_date)}${d != null ? ` · ${d < 0 ? Math.abs(d) + 'd ago' : d + 'd left'}` : ''}</span>` : `<span class="vzp-chip">No deadline</span>`}
      ${isFocus ? `<span class="vzp-chip" style="color:var(--primary)">★ Focus</span>` : ''}
    </div>
    ${g.description ? `<div style="font-size:13px;color:var(--text-2);line-height:1.55">${escapeHtml(g.description)}</div>` : ''}
    ${habits.length ? `<div class="vzp-lbl">Linked habits</div>${habits.map(h => `<span class="vzp-hab"><i data-lucide="flame" style="width:12px;height:12px"></i>${escapeHtml(h)}</span>`).join('')}` : ''}
    ${imgs.length ? `<div class="vzp-lbl">Gallery</div><div class="vzp-gallery">${imgs.map(im => `<i style="background-image:url('${resolveMediaUrl(im.url) || sanitizeUrl(im.url)}')"></i>`).join('')}</div>` : ''}
    <div class="vzp-actions">
      <button class="vzp-btn primary" onclick="startManifestationRitual('${g.id}')"><i data-lucide="sparkles" style="width:14px;height:14px"></i> Start ritual${affs.length ? ` · ${affs.length}` : ''}</button>
      <button class="vzp-btn" onclick="openVisionDetail('${g.id}')">Open full</button>
      <button class="vzp-btn" onclick="openEditVision('${g.id}')">Edit</button>
      <button class="vzp-btn ${isFocus ? 'ok' : ''}" onclick="toggleVisionFocus('${g.id}');setTimeout(vzRenderPane,150)">★ Focus</button>
      <button class="vzp-btn ok" onclick="markVisionAchieved('${g.id}')">Achieve</button>
      <button class="vzp-btn danger" onclick="deleteVision('${g.id}')">Delete</button>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   VISION STORIES — full-screen, one-by-one viewer (Instagram-style, desktop).
   Focus/All toggle, prev/next, edit, close. Keyboard ←/→/Esc.
   ═══════════════════════════════════════════════════════════════════════ */
window._vzStory = window._vzStory || { ids: [], i: 0, mode: 'all' };

function _vzStoryGoals(mode) {
  const active = (state.data.vision || []).filter(g => g.status !== 'achieved');
  const list = mode === 'focus' ? active.filter(_vzIsFocus) : active;
  return sortVisions(list);
}

window.openVisionStories = function (startId, mode) {
  let m = mode || (visionState.filter === 'focus' ? 'focus' : 'all');
  let goals = _vzStoryGoals(m);
  if (goals.length === 0 && m === 'focus') { m = 'all'; goals = _vzStoryGoals('all'); }
  const ids = goals.map(g => String(g.id));
  let i = (startId != null) ? ids.indexOf(String(startId)) : 0;
  if (i < 0) i = 0;
  window._vzStory = { ids, i, mode: m };
  _vzStoryEnsureDom();
  document.getElementById('vzStoryOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (!window._vzStoryKey) { window._vzStoryKey = _vzStoryKeyHandler; document.addEventListener('keydown', window._vzStoryKey); }
  _vzStoryRender();
};

window.closeVisionStories = function () {
  const ov = document.getElementById('vzStoryOverlay');
  if (ov) {
    ov.classList.add('hidden');
    const v = ov.querySelector('video'); if (v) { try { v.pause(); } catch (e) {} }
  }
  document.body.style.overflow = '';
  if (window._vzStoryKey) { document.removeEventListener('keydown', window._vzStoryKey); window._vzStoryKey = null; }
};

function _vzStoryKeyHandler(e) {
  const ov = document.getElementById('vzStoryOverlay');
  if (!ov || ov.classList.contains('hidden')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeVisionStories(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); vzStoryNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); vzStoryPrev(); }
}

window.vzStoryNext = function () { const s = window._vzStory; if (s.i < s.ids.length - 1) { s.i++; _vzStoryRender(); } };
window.vzStoryPrev = function () { const s = window._vzStory; if (s.i > 0) { s.i--; _vzStoryRender(); } };
window.vzStoryGo = function (i) { const s = window._vzStory; if (i >= 0 && i < s.ids.length) { s.i = i; _vzStoryRender(); } };

window.vzStorySetMode = function (mode) {
  const s = window._vzStory;
  const curId = s.ids[s.i];
  const goals = _vzStoryGoals(mode);
  const ids = goals.map(g => String(g.id));
  let i = ids.indexOf(String(curId)); if (i < 0) i = 0;
  window._vzStory = { ids, i, mode };
  _vzStoryRender();
};

window.vzStoryEdit = function () {
  const s = window._vzStory; const id = s.ids[s.i]; if (!id) return;
  closeVisionStories();
  setTimeout(() => openEditVision(id), 130);
};

window._vzStorySwap = function (u) { const el = document.getElementById('vzStoryImg'); if (el) el.style.backgroundImage = `url('${u}')`; };

window._vzStoryBump = async function (id, delta) {
  await vzBump(id, delta);
  const g = (state.data.vision || []).find(v => String(v.id) === String(id)); if (!g) return;
  const p = parseInt(g.progress, 10) || 0;
  const b = document.querySelector('#vzStoryStage .vz-story-prog b'); if (b) b.textContent = p + '%';
  const bar = document.querySelector('#vzStoryStage .vz-story-bar i'); if (bar) bar.style.width = p + '%';
};

function _vzStoryEnsureDom() {
  if (document.getElementById('vzStoryOverlay')) return;
  const ov = document.createElement('div');
  ov.id = 'vzStoryOverlay';
  ov.className = 'vz-story-overlay hidden';
  ov.innerHTML = `
    <div class="vz-story-tools">
      <div class="vz-story-modes">
        <button id="vzStoryMF" onclick="vzStorySetMode('focus')">Focus</button>
        <button id="vzStoryMA" onclick="vzStorySetMode('all')">All</button>
      </div>
      <div style="flex:1"></div>
      <button class="vz-story-tbtn" onclick="vzStoryEdit()" title="Edit goal">${renderIcon('edit', null, 'style="width:16px"')}</button>
      <button class="vz-story-tbtn" onclick="closeVisionStories()" title="Close (Esc)" style="font-size:20px">&times;</button>
    </div>
    <div class="vz-story-top"><div class="vz-story-segs" id="vzStorySegs"></div></div>
    <button class="vz-story-nav prev" onclick="vzStoryPrev()" aria-label="Previous">&lsaquo;</button>
    <div class="vz-story-stage" id="vzStoryStage"></div>
    <button class="vz-story-nav next" onclick="vzStoryNext()" aria-label="Next">&rsaquo;</button>
  `;
  ov.addEventListener('click', (e) => { if (e.target === ov) closeVisionStories(); });
  document.body.appendChild(ov);
}

async function _vzStoryRender() {
  const s = window._vzStory;
  const stage = document.getElementById('vzStoryStage');
  const segs = document.getElementById('vzStorySegs');
  if (!stage) return;

  const mf = document.getElementById('vzStoryMF'), ma = document.getElementById('vzStoryMA');
  if (mf) mf.classList.toggle('active', s.mode === 'focus');
  if (ma) ma.classList.toggle('active', s.mode === 'all');

  if (!s.ids.length) {
    if (segs) segs.innerHTML = '';
    stage.innerHTML = `<div class="vz-story-empty">${s.mode === 'focus' ? 'No focus goals yet — star goals to add them here, or switch to All.' : 'No active visions yet. Add one to get started.'}</div>`;
    return;
  }

  if (segs) segs.innerHTML = s.ids.map((_, idx) => `<button class="vz-seg ${idx === s.i ? 'on' : (idx < s.i ? 'past' : '')}" onclick="vzStoryGo(${idx})" aria-label="Go to ${idx + 1}"></button>`).join('');

  const g = (state.data.vision || []).find(v => String(v.id) === String(s.ids[s.i]));
  if (!g) return;
  try { await preloadLocalMedia([g]); } catch (e) {}

  const videoUrls = g.video_url ? g.video_url.split(',').map(x => x.trim()).filter(Boolean) : [];
  const hasVideo = videoUrls.length > 0;
  const hasImg = !!g.image_url;
  const img = hasImg ? (resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url)) : '';
  const prog = parseInt(g.progress, 10) || 0;
  const d = _vzDays(g.target_date);
  const habits = _vzLinkedHabitNames(g);
  const affs = (state.data.vision_affirmations || []).filter(a => String(a.vision_id) === String(g.id));
  const gallery = (state.data.vision_images || []).filter(im => String(im.vision_id) === String(g.id)).slice(0, 8);
  const isFocus = _vzIsFocus(g);

  // Color-or-image: a set photo/video wins in the immersive view; otherwise the goal's color.
  const media = hasVideo
    ? `<video class="vz-story-vid" muted loop autoplay playsinline webkit-playsinline preload="auto" poster="${hasImg ? (resolveMediaUrl(g.image_url) || '') : ''}" data-vision-local="${videoUrls[0]}"></video>`
    : (hasImg
        ? `<div class="vz-story-img" id="vzStoryImg" style="background-image:url('${img}')"></div>`
        : `<div class="vz-story-img" style="background:${_vzCardColor(g)}"></div>`);

  stage.innerHTML = `
    <div class="vz-story-card">
      <div class="vz-story-media">
        ${media}
        <span class="vz-story-cat">${escapeHtml(g.category || 'Personal')}</span>
        <div class="vz-story-mtitle">${escapeHtml(g.title || '')}</div>
      </div>
      <div class="vz-story-side">
        <div class="vz-story-row1">
          <div class="vz-story-prog"><b>${prog}%</b><span>progress</span></div>
          ${isFocus ? `<span class="vz-story-chip focus">★ Focus</span>` : ''}
          ${g.target_date ? `<span class="vz-story-chip ${d != null && d < 0 ? 'over' : ''}">🎯 ${formatDate(g.target_date)}${d != null ? ` · ${d < 0 ? Math.abs(d) + 'd ago' : d + 'd left'}` : ''}</span>` : `<span class="vz-story-chip">No deadline</span>`}
        </div>
        <div class="vz-story-bar"><i style="width:${prog}%"></i></div>
        <div class="vz-story-prog-ctl">
          <button onclick="_vzStoryBump('${g.id}',-1)" title="−1%">−</button>
          <button onclick="_vzStoryBump('${g.id}',1)" title="+1%">+</button>
        </div>
        ${g.description ? `<div class="vz-story-lbl">Vision</div><div class="vz-story-text">${escapeHtml(g.description)}</div>` : ''}
        ${g.notes ? `<div class="vz-story-lbl">Notes</div><div class="vz-story-text">${escapeHtml(g.notes)}</div>` : ''}
        ${habits.length ? `<div class="vz-story-lbl">Linked habits</div><div class="vz-story-habs">${habits.map(h => `<span class="vz-story-hab">${escapeHtml(h)}</span>`).join('')}</div>` : ''}
        ${gallery.length ? `<div class="vz-story-lbl">Gallery</div><div class="vz-story-gal">${gallery.map(im => { const u = resolveMediaUrl(im.url) || sanitizeUrl(im.url); return `<i style="background-image:url('${u}')" onclick="_vzStorySwap('${u}')"></i>`; }).join('')}</div>` : ''}
        <div class="vz-story-actions">
          ${affs.length ? `<button class="vz-story-btn primary" onclick="closeVisionStories();setTimeout(()=>startManifestationRitual('${g.id}'),130)">Start ritual · ${affs.length}</button>` : ''}
          <button class="vz-story-btn" onclick="vzStoryEdit()">Edit</button>
          <button class="vz-story-btn ok" onclick="closeVisionStories();setTimeout(()=>markVisionAchieved('${g.id}'),130)">Achieve</button>
        </div>
      </div>
    </div>
    <div class="vz-story-count">${s.i + 1} / ${s.ids.length}</div>
  `;

  const prevB = document.querySelector('#vzStoryOverlay .vz-story-nav.prev');
  const nextB = document.querySelector('#vzStoryOverlay .vz-story-nav.next');
  if (prevB) prevB.classList.toggle('disabled', s.i === 0);
  if (nextB) nextB.classList.toggle('disabled', s.i === s.ids.length - 1);

  if (hasVideo) { try { initVisionMediaElements(stage); } catch (e) {} }
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

async function renderVision() {
  await checkAndAutoRenewTDP();
  const goals = state.data.vision || [];
  await preloadLocalMedia(goals);
  let filtered = filterVisions(goals);
  filtered = sortVisions(filtered);
  const stats = calculateVisionStats(goals);
  const _vzActive = goals.filter(g => g.status !== 'achieved');
  const _vzAvg = _vzActive.length ? Math.round(_vzActive.reduce((s, g) => s + (parseInt(g.progress, 10) || 0), 0) / _vzActive.length) : 0;
  const _vzNext = _vzActive.filter(g => g.target_date).sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0];
  const _vzNextD = _vzNext ? _vzDays(_vzNext.target_date) : null;
  const _vzC = 2 * Math.PI * 22;

  const activeTDP = await getActiveTDP();
  const tdpInfo = getTDPDayInfo(activeTDP);
  const tdpProg = calculateTDPProgress(activeTDP);

  let tdpHtml = `
    <div class="tdp-header-row animate-enter">
      <button class="tdp-btn" onclick="openTDPModal()">
        <span class="tdp-btn-label">10 Days Plan</span>
        <span class="tdp-btn-status">${activeTDP ? 'Day ' + tdpInfo.day : 'Start TDP'}</span>
      </button>
      <div class="tdp-progress-wrap">
        <div class="tdp-progress-meta">
          <span>${activeTDP ? tdpProg.percentage + '% Complete' : 'Planning block not started'}</span>
          <span>${activeTDP ? tdpInfo.remaining + ' days left' : ''}</span>
        </div>
        <div class="tdp-progress-bar">
          <div class="tdp-progress-fill" style="width: ${activeTDP ? tdpProg.percentage : 0}%"></div>
        </div>
      </div>
    </div>
  `;

  const _segBtn = (v, label, icon) => `<button class="${visionState.view === v ? 'active' : ''}" onclick="switchVisionView('${v}')">${renderIcon(icon, null, 'style="width:15px"')} ${label}</button>`;

  // DESKTOP: one compact, integrated control header — stats, view switch, filters,
  // and secondary actions in two tidy rows. Replaces the stacked overview card +
  // TDP band + filter row + view-toggle row so the goals grid is the page.
  const _vzHeadDesktop = `
      <div class="vz-head">
        <div class="vz-head__top">
          <div class="vz-stats">
            <span class="vz-stat"><span class="vz-stat__ring"><svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="var(--surface-3)" stroke-width="4"/><circle cx="15" cy="15" r="12" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 12}" stroke-dashoffset="${2 * Math.PI * 12 * (1 - _vzAvg / 100)}" transform="rotate(-90 15 15)"/></svg></span><span><b>${_vzAvg}%</b> avg</span></span>
            <span class="vz-stat-sep"></span>
            <span class="vz-stat"><b>${stats.active}</b> active</span>
            <span class="vz-stat"><b>${stats.achieved}</b> achieved</span>
            ${_vzNext && _vzNextD != null ? `<span class="vz-stat-sep"></span><span class="vz-stat ${_vzNextD < 0 ? 'vz-stat--warn' : ''}">${_vzNextD < 0 ? '⚠' : '⏳'} ${escapeHtml(_vzNext.title || '')} · ${_vzNextD < 0 ? Math.abs(_vzNextD) + 'd overdue' : 'in ' + _vzNextD + 'd'}</span>` : ''}
          </div>
          <div class="vz-viewseg">
            ${_segBtn('grid', 'Grid', 'grid')}
            ${_segBtn('list', 'List', 'list')}
            ${_segBtn('timeline', 'Timeline', 'calendar')}
            <button class="vz-viewseg--story" onclick="openVisionStories()"><i data-lucide="play" style="width:14px;height:14px;vertical-align:-2px"></i> Story</button>
          </div>
        </div>
        <div class="vz-head__bar">
          <div class="vision-filters" id="visionFilters">${renderFilterChips()}</div>
          <div class="vz-head__secondary">
            <button class="vz-mini-btn" onclick="startManifestationRitual()"><i data-lucide="play" style="width:13px;height:13px;vertical-align:-2px"></i> Daily ritual</button>
            <button class="vz-mini-btn" onclick="openTDPModal()">${activeTDP ? 'TDP · Day ' + tdpInfo.day : 'Start 10-day plan'}</button>
          </div>
        </div>
      </div>`;

  // MOBILE: unchanged stacked layout (overview card + TDP band + filters + tabs).
  const _vzHeadMobile = `
      <div class="vz-ov">
        <div class="vz-ov-ring">
          <div class="rw">
            <svg width="54" height="54"><circle cx="27" cy="27" r="22" fill="none" stroke="var(--surface-3)" stroke-width="6"/><circle cx="27" cy="27" r="22" fill="none" stroke="var(--primary)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${_vzC}" stroke-dashoffset="${_vzC * (1 - _vzAvg / 100)}" transform="rotate(-90 27 27)"/></svg>
            <b>${_vzAvg}%</b>
          </div>
          <div class="rl">avg<br><b>progress</b></div>
        </div>
        <div class="vz-ov-div"></div>
        <div class="vz-ov-item"><b>${stats.active}</b><span>Active</span></div>
        <div class="vz-ov-item"><b>${stats.achieved}</b><span>Achieved</span></div>
        ${_vzNext ? `<div class="vz-ov-next"><div class="t">⏳ ${escapeHtml(_vzNext.title || '')}</div><div class="d ${_vzNextD != null && _vzNextD <= 30 ? 'urgent' : ''}">${_vzNextD < 0 ? Math.abs(_vzNextD) + 'd overdue' : 'in ' + _vzNextD + 'd'}</div></div>` : ''}
      </div>
      ${tdpHtml}
      <div class="vision-toolbar"><div class="vision-filters" id="visionFilters">${renderFilterChips()}</div></div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; flex-wrap:wrap">
        <div class="vision-view-tabs">
          <button class="vision-tab ${visionState.view === 'grid' ? 'active' : ''}" onclick="switchVisionView('grid')" title="Grid">${renderIcon('grid', null, 'style="width:16px"')} Grid</button>
          <button class="vision-tab ${visionState.view === 'list' ? 'active' : ''}" onclick="switchVisionView('list')" title="List">${renderIcon('list', null, 'style="width:16px"')} List</button>
          <button class="vision-tab ${visionState.view === 'timeline' ? 'active' : ''}" onclick="switchVisionView('timeline')" title="Timeline">${renderIcon('calendar', null, 'style="width:16px"')} Timeline</button>
        </div>
        <button class="vision-tab vz-story-launch" style="margin-left:auto" onclick="openVisionStories()" title="View your visions one-by-one, full screen"><i data-lucide="play" style="width:15px;height:15px;vertical-align:-2px"></i> Story view</button>
      </div>`;

  document.getElementById('main').innerHTML = `
    <div class="vision-wrapper vz-pro">
      ${VISION_REFINE_CSS}

      ${_vzDesktop() ? _vzHeadDesktop : _vzHeadMobile}

      ${visionState.view === 'grid' ? `<div class="vz-board vz-board--full">${renderVisionGrid(filtered)}</div>` : ''}
      ${visionState.view === 'list' ? renderVisionList(filtered) : ''}
      ${visionState.view === 'timeline' ? renderVisionTimeline(filtered) : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  initVisionMediaElements(document.getElementById('main'));

  // Keyboard nav for the desktop detail pane (Esc to close, ↑/↓ between goals)
  window._vzOrder = visionState.view === 'grid'
    ? [...filtered.filter(g => g.status !== 'achieved'), ...filtered.filter(g => g.status === 'achieved')].map(g => String(g.id))
    : [];
  if (!window._vzKeyBound) { document.addEventListener('keydown', _vzKey); window._vzKeyBound = true; }

  // Check if cloud audio needs syncing — show button if so, don't auto-download
  setTimeout(() => _checkCloudAudioAvailable(), 2000);
}

function renderFilterChips() {
  const cats = ['focus', 'all', ...VISION_CATEGORIES];
  const labels = { focus: `${renderIcon('target', null, 'style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px;"')} Focus`, all: 'All' };
  return cats.map(c => `
    <button class="vision-filter-chip ${visionState.filter === c ? 'active' : ''}"
            onclick="setVisionFilter('${c}')">
      ${labels[c] || c}
    </button>
  `).join('');
}

function calculateVisionStats(goals) {
  const now = new Date();
  const currentYear = now.getFullYear();
  return {
    total: goals.length,
    active: goals.filter(g => g.status !== 'achieved').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    thisYear: goals.filter(g => g.target_date && new Date(g.target_date).getFullYear() === currentYear).length
  };
}

/* ─── GRID VIEW ─────────────────────────────────────────────────── */
function renderVisionGrid(goals) {
  const active = goals.filter(g => g.status !== 'achieved');
  const achieved = goals.filter(g => g.status === 'achieved');

  // Section heading anchors the grid as the primary content (desktop only).
  const f = visionState.filter;
  const headLabel = f === 'focus' ? 'Focus this month' : (f === 'all' ? 'All goals' : (String(f).charAt(0).toUpperCase() + String(f).slice(1)));
  const head = _vzDesktop() ? `<div class="vz-board-head"><h2>${escapeHtml(headLabel)}</h2><span class="n">${active.length} active</span></div>` : '';

  return `
    ${head}
    <div class="vision-grid">
      ${active.length === 0
      ? `<div class="vision-empty" style="grid-column:1/-1">
             <span class="vision-empty-icon">${renderIcon('target', null, 'style="width:40px; color:var(--text-muted);"')}</span>
             <div class="vision-empty-text">No active goals yet</div>
             <div class="vision-empty-sub">Add your first vision goal to get started</div>
           </div>`
      : active.map(g => renderVisionCard(g)).join('')}
    </div>

    ${achieved.length > 0 ? `
      <div class="vision-achieved-section">
        <div class="vision-achieved-label" style="display:flex; align-items:center; gap:6px;">
          ${renderIcon('trophy', null, 'style="width:18px; color:#F59E0B;"')} Achieved Goals (${achieved.length})
        </div>
        <div class="vision-grid" style="opacity:0.85">
          ${achieved.map(g => renderVisionCard(g, true)).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// Pleasant default colors per category (deep enough for white text). Per-goal
// g.color (from the color wheel) overrides.
const VZ_CAT_COLORS = {
  'Work': '#2563EB', 'Personality': '#7C3AED', 'Ouro': '#0F766E',
  'Enjoyment': '#EA580C', 'Routine': '#0891B2', 'Personal': '#4F46E5',
  'Health': '#DC2626', 'Finance': '#059669', 'Social': '#DB2777'
};
function _vzCardColor(g) {
  if (g && /^#[0-9A-Fa-f]{6}$/.test(g.color || '')) return g.color;
  return VZ_CAT_COLORS[g && g.category] || '#4F46E5';
}

// Perceived-luminance → a readable text color for a given background hex.
function _vzTextOn(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 168 ? '#0F172A' : '#FFFFFF';
}
// Curated, harmonious palette shown first; the wheel is the "custom" option.
window.VZ_PALETTE = ['#4F46E5', '#2563EB', '#0891B2', '#0F766E', '#059669', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#475569'];

// Live-update a card's color + auto-contrast ink (no save yet).
window.vzPreviewColor = function (id, color) {
  const card = document.getElementById('vision-card-' + id);
  if (!card) return;
  const ink = _vzTextOn(color);
  card.style.setProperty('--vz-ink', ink);
  card.classList.toggle('vz-ink-light', ink === '#FFFFFF');
  card.classList.toggle('vz-ink-dark', ink !== '#FFFFFF');
  const bg = card.querySelector('.vision-card-bg'); if (bg) bg.style.background = color;
  const sw = card.querySelector('.vz-quick__color'); if (sw) sw.style.background = color;
};
// Persist the chosen color.
window.vzSetColor = async function (id, color) {
  const g = (state.data.vision || []).find(v => String(v.id) === String(id));
  if (!g) return;
  g.color = color;
  vzPreviewColor(id, color);
  document.querySelectorAll('#universalModal .vz-sw[data-color]').forEach(b =>
    b.classList.toggle('sel', (b.dataset.color || '').toLowerCase() === String(color).toLowerCase()));
  const ci = document.getElementById('vzColorCustom'); if (ci) ci.value = color;
  try { await apiCall('update', 'vision_board', { color: color }, id); } catch (e) {}
};
// Color picker: curated swatches first, custom wheel last.
window.vzOpenColorModal = function (id) {
  const g = (state.data.vision || []).find(v => String(v.id) === String(id)); if (!g) return;
  const cur = _vzCardColor(g);
  const modal = document.getElementById('universalModal'); const box = modal.querySelector('.modal-box');
  box.innerHTML = `
    <h3 style="margin:0 0 4px; font-weight:700">Goal color</h3>
    <p style="font-size:13px; color:var(--text-muted); margin:0 0 16px">Pick a color for “${escapeHtml(g.title || '')}”.</p>
    <div class="vz-palette">
      ${window.VZ_PALETTE.map(c => `<button class="vz-sw ${c.toLowerCase() === String(cur).toLowerCase() ? 'sel' : ''}" data-color="${c}" style="background:${c}" title="${c}" onclick="vzSetColor('${id}','${c}')"></button>`).join('')}
      <label class="vz-sw vz-sw--custom" title="Custom color">
        <input type="color" id="vzColorCustom" value="${cur}" oninput="vzPreviewColor('${id}', this.value)" onchange="vzSetColor('${id}', this.value)">
        <span>+</span>
      </label>
    </div>
    <div style="display:flex; justify-content:flex-end; margin-top:18px"><button class="btn primary" onclick="document.getElementById('universalModal').classList.add('hidden')">Done</button></div>
  `;
  modal.classList.remove('hidden');
};
// Edit-goal: choose whether the board shows this goal's color or its image.
window.vzSetDisplayMode = function (v) {
  const inp = document.getElementById('mVisDisplayMode'); if (inp) inp.value = v;
  document.querySelectorAll('.vz-disp-seg .vz-disp').forEach(b => b.classList.toggle('active', b.dataset.v === v));
};

function renderVisionCard(g, isAchieved = false) {
  const days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / 86400000) : null;
  const color = _vzCardColor(g);

  let badge = '';
  if (isAchieved) {
    badge = `<div class="vision-card-badge achieved" style="display:flex; align-items:center; gap:4px;">${renderIcon('trophy', null, 'style="width:12px;"')} Achieved</div>`;
  } else if (days !== null) {
    const cls = days < 0 ? 'expired' : (days <= 30 ? 'urgent' : 'normal');
    badge = `<div class="vision-card-badge ${cls}">${days < 0 ? 'Ended' : days === 0 ? 'Today!' : days + 'd left'}</div>`;
  }

  const cardId = `vision-card-${g.id}`;
  const affCount = (state.data.vision_affirmations || []).filter(a => String(a.vision_id) === String(g.id)).length;
  // Per-goal board display: 'image' shows the photo, otherwise the solid color.
  const useImage = g.display_mode === 'image' && g.image_url;
  const ink = useImage ? '#FFFFFF' : _vzTextOn(color);   // auto-contrast text color
  const colorCls = useImage ? '' : ('vision-card--color ' + (ink === '#FFFFFF' ? 'vz-ink-light' : 'vz-ink-dark'));
  const bgStyle = useImage
    ? `background-image:url('${resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url)}'); background-size:cover; background-position:center;`
    : `background:${color}`;

  return `
    <div class="vision-card ${colorCls} animate-enter ${String(g.id) === String(_vzSelId) ? 'vz-sel' : ''}" id="${cardId}" style="--vz-ink:${ink}" onclick="vzCardOpen('${g.id}')">
      <div class="vision-card-bg" style="${bgStyle}"></div>
      <div class="vision-card-overlay"></div>
      <div class="vision-card-cat-tag">${g.category || 'Personal'}</div>
      ${affCount ? `<div class="vision-aff-indicator" title="Manifest (${affCount} affirmations)" onclick="event.stopPropagation();startManifestationRitual('${g.id}')">${renderIcon('sparkles', null, 'style="width:14px; color:currentColor"')}</div>` : ''}

      <div class="vision-card-content">
        ${badge}
        <div class="vision-card-title">${g.title}</div>
        <div class="vision-card-progress">
        <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
        ${!isAchieved ? `
        <div class="vz-quick" onclick="event.stopPropagation()">
          <button class="vz-quick__b" title="Decrease 1%" onclick="event.stopPropagation();vzBump('${g.id}',-1)">−</button>
          <span class="vz-quick__p" id="vzqp-${g.id}">${parseInt(g.progress, 10) || 0}%</span>
          <button class="vz-quick__b" title="Increase 1%" onclick="event.stopPropagation();vzBump('${g.id}',1)">+</button>
          <span class="vz-quick__sp"></span>
          <button class="vz-quick__color" title="Pick color" style="background:${color}" onclick="event.stopPropagation();vzOpenColorModal('${g.id}')"></button>
          <button class="vz-quick__b" title="Edit goal" onclick="event.stopPropagation();openEditVision('${g.id}')">${renderIcon('edit', null, 'style="width:14px"')}</button>
        </div>` : ''}
      </div>
    </div>
  `;
}

/* ─── LIST VIEW ─────────────────────────────────────────────────── */
function renderVisionList(goals) {
  if (goals.length === 0) return emptyState();
  if (_vzDesktop()) return vzListTable(goals);
  return `<div class="vision-list">${goals.map(g => renderVisionListItem(g)).join('')}</div>`;
}

/* Desktop: sortable table for power management of many goals */
function vzSortGoalsForList(goals, ls) {
  const dir = ls.dir === 'asc' ? 1 : -1;
  const val = g => {
    switch (ls.col) {
      case 'title': return (g.title || '').toLowerCase();
      case 'category': return (g.category || '').toLowerCase();
      case 'progress': return parseInt(g.progress, 10) || 0;
      case 'status': return g.status === 'achieved' ? 1 : 0;
      case 'target': return g.target_date ? new Date(g.target_date).getTime() : (dir === 1 ? 8.64e15 : -8.64e15);
      default: return 0;
    }
  };
  return [...goals].sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -1 * dir : va > vb ? 1 * dir : 0; });
}
window.vzSortList = function (col) {
  const ls = visionState.listSort;
  if (ls.col === col) ls.dir = ls.dir === 'asc' ? 'desc' : 'asc';
  else { ls.col = col; ls.dir = col === 'progress' ? 'desc' : 'asc'; }
  renderVision();
};
function vzTableRow(g) {
  const d = _vzDays(g.target_date);
  const prog = parseInt(g.progress, 10) || 0;
  const isA = g.status === 'achieved';
  const over = d != null && d < 0 && !isA;
  return `
    <tr onclick="openVisionDetail('${g.id}')">
      <td class="vz-td-title">${_vzIsFocus(g) ? '<span style="color:var(--primary)">★</span> ' : ''}${escapeHtml(g.title || '')}</td>
      <td><span class="vz-tcat">${escapeHtml(g.category || 'Personal')}</span></td>
      <td><div class="vz-tprog"><div class="vz-tprog-bar"><i style="width:${prog}%"></i></div><span>${prog}%</span></div></td>
      <td class="vz-tdate ${over ? 'over' : ''}">${g.target_date ? formatDate(g.target_date) : '—'}</td>
      <td>${isA ? '<span class="vz-tbadge ok">Achieved</span>' : over ? '<span class="vz-tbadge late">Overdue</span>' : '<span class="vz-tbadge">Active</span>'}</td>
    </tr>`;
}
function vzListTable(goals) {
  const ls = visionState.listSort || { col: 'target', dir: 'asc' };
  const rows = vzSortGoalsForList(goals, ls).map(vzTableRow).join('');
  const arr = c => ls.col === c ? (ls.dir === 'asc' ? ' ↑' : ' ↓') : '';
  return `
    <div class="vz-table-wrap">
      <table class="vz-table">
        <thead><tr>
          <th onclick="vzSortList('title')">Goal${arr('title')}</th>
          <th onclick="vzSortList('category')">Category${arr('category')}</th>
          <th onclick="vzSortList('progress')">Progress${arr('progress')}</th>
          <th onclick="vzSortList('target')">Target${arr('target')}</th>
          <th onclick="vzSortList('status')">Status${arr('status')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderVisionListItem(g) {
  const daysLeft = g.target_date ? getDaysLeft(g.target_date) : null;
  const isAchieved = g.status === 'achieved';
  const isPast = daysLeft !== null && daysLeft < 0;
  const badgeClass = isAchieved ? 'achieved' : (isPast ? 'past' : 'active');
  const badgeText = isAchieved ? `${renderIcon('trophy', null, 'style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"')} Done` : (daysLeft !== null ? (daysLeft < 0 ? 'Ended' : daysLeft + 'd') : '');

  const vids = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hasThumb = g.image_url || vids.length > 0;
  const thumbStyle = g.image_url ? `background-image:url('${sanitizeUrl(g.image_url)}'); background-size:cover; background-position:center;` : 'background:#111';

  return `
    <div class="vision-list-item" onclick="openVisionDetail('${g.id}')">
      ${hasThumb
      ? `<div class="vision-list-thumb" style="${thumbStyle}">
             ${g.video_url ? '<span style="color:white;font-size:18px;display:flex;align-items:center;justify-content:center;height:100%">▶</span>' : ''}
           </div>`
      : `<div class="vision-list-icon">${getCategoryEmoji(g.category)}</div>`}
      <div class="vision-list-content">
        <div class="vision-list-title">${g.title}</div>
        <div class="vision-list-cat">${g.category || 'Personal'}</div>
        <div class="vision-list-date">${g.target_date ? 'Target: ' + formatDate(g.target_date) : 'No deadline'}</div>
        <div class="vision-list-progress-wrap">
          <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
      </div>
      ${badgeText ? `<div class="vision-list-badge ${badgeClass}">${badgeText}</div>` : ''}
    </div>
  `;
}

/* ─── TIMELINE VIEW ─────────────────────────────────────────────── */
function renderVisionTimeline(goals) {
  if (goals.length === 0) return emptyState();
  if (_vzDesktop()) return vzRoadmap(goals);
  const grouped = groupByYear(goals);
  return `
    <div class="vision-timeline">
      ${Object.keys(grouped).sort().map(year => `
        <div class="timeline-year-section">
          <div class="timeline-year-header" style="display:flex; align-items:center; gap:6px;">${renderIcon('calendar', null, 'style="width:16px;"')} ${year}</div>
          <div class="timeline-items">
            ${grouped[year].map(g => renderTimelineItem(g)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTimelineItem(g) {
  const daysLeft = g.target_date ? getDaysLeft(g.target_date) : null;
  const isAchieved = g.status === 'achieved';

  return `
    <div class="timeline-item" onclick="openVisionDetail('${g.id}')">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${getCategoryEmoji(g.category)} ${g.title}</div>
        <div class="timeline-meta" style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
          ${g.target_date ? formatDate(g.target_date) : 'No deadline'}
          ${isAchieved ? ` • ${renderIcon('trophy', null, 'style="width:12px;"')} Achieved` : (daysLeft !== null ? ' • ' + Math.abs(daysLeft) + (daysLeft < 0 ? 'd ago' : 'd left') : '')}
        </div>
        <div class="timeline-progress">
          <div class="vision-progress-fill" style="--progress-width:${g.progress || 0}%; width:${g.progress || 0}%"></div>
        </div>
      </div>
    </div>
  `;
}

/* Desktop: a real roadmap — overdue lane, upcoming by year·quarter, someday, achieved */
function vzRoadItem(g) {
  const d = _vzDays(g.target_date);
  const prog = parseInt(g.progress, 10) || 0;
  const isA = g.status === 'achieved';
  return `
    <div class="vz-rd-item" onclick="openVisionDetail('${g.id}')">
      <div class="vz-rd-cat">${getCategoryEmoji(g.category)}</div>
      <div class="vz-rd-main">
        <div class="vz-rd-title">${escapeHtml(g.title || '')}</div>
        <div class="vz-rd-meta">${g.target_date ? formatDate(g.target_date) : 'No target date'}${(d != null && !isA) ? ' · ' + (d < 0 ? Math.abs(d) + 'd ago' : d + 'd left') : ''}</div>
        <div class="vz-rd-bar"><i style="width:${prog}%"></i></div>
      </div>
      <div class="vz-rd-pct">${prog}%</div>
    </div>`;
}
function vzRoadmap(goals) {
  const today = new Date();
  const dated = goals.filter(g => g.target_date && g.status !== 'achieved');
  const overdue = dated.filter(g => new Date(g.target_date) < today);
  const upcoming = dated.filter(g => new Date(g.target_date) >= today).sort((a, b) => new Date(a.target_date) - new Date(b.target_date));
  const someday = goals.filter(g => !g.target_date && g.status !== 'achieved');
  const achieved = goals.filter(g => g.status === 'achieved');
  const groups = {};
  upcoming.forEach(g => { const dt = new Date(g.target_date); const key = dt.getFullYear() + ' · Q' + (Math.floor(dt.getMonth() / 3) + 1); (groups[key] = groups[key] || []).push(g); });
  const lane = (label, items, cls = '') => items.length ? `<div class="vz-rd-lane ${cls}"><div class="vz-rd-head">${label}<span>${items.length}</span></div><div class="vz-rd-items">${items.map(vzRoadItem).join('')}</div></div>` : '';
  return `
    <div class="vz-roadmap">
      ${lane('⚠ Overdue', overdue, 'over')}
      ${Object.keys(groups).sort().map(k => lane(k, groups[k])).join('')}
      ${lane('Someday', someday, 'someday')}
      ${lane('✓ Achieved', achieved, 'done')}
    </div>`;
}

/* ─── DETAIL MODAL ──────────────────────────────────────────────── */
window.openVisionDetail = async function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;

  // Preload media for this vision before showing modal
  if (g.video_url || g.image_url) {
    await preloadLocalMedia([g]);
  }

  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');

  const imgUrl = g.image_url ? (resolveMediaUrl(g.image_url) || sanitizeUrl(g.image_url)) : getDefaultImage(g);
  const videoUrls = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hasVideo = videoUrls.length > 0;
  const hasImage = !hasVideo && g.image_url;

  // Status badges
  let statusBadge = '';
  if (g.status === 'achieved') {
    statusBadge = `<span class="vision-card-badge achieved" style="display:inline-flex;align-items:center;gap:4px;">${renderIcon('trophy', null, 'style="width:12px;"')} Achieved</span>`;
  } else if (g.target_date) {
    const d = getDaysLeft(g.target_date);
    const color = d < 0 ? 'var(--danger)' : (d <= 30 ? 'var(--warning)' : 'var(--success)');
    statusBadge = `<span style="background:${color};color:white;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">${d < 0 ? 'Ended' : d === 0 ? 'Today!' : d + 'd left'}</span>`;
  }

  // Timeline info
  const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
  const updatedDate = g.updated_at ? new Date(g.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown');

  // Generate video gallery dots
  const videoDots = videoUrls.length > 1 ? `
    <div style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:10; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:20px; backdrop-filter:blur(4px);">
      ${videoUrls.map((u, i) => `
        <button onclick="event.stopPropagation(); scrollToVideo(${i})"
          class="vision-dot-btn ${i === 0 ? 'active' : ''}"
          title="Video ${i + 1}"></button>
      `).join('')}
    </div>
  ` : '';

  // Progress color based on percentage
  const progress = g.progress || 0;
  const progressColor = progress >= 100 ? 'var(--success)' : (progress >= 50 ? 'var(--primary)' : 'var(--warning)');

  // 📝 NEW: Habit Scorecard calculation for Vision Header
  let totalCompletions = 0;
  let totalTarget = 0;
  try {
    if (g && g.linked_habits) {
      let existingHabits = [];
      if (String(g.linked_habits).trim().startsWith('[')) {
        existingHabits = JSON.parse(g.linked_habits);
      } else {
        existingHabits = String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 0 }));
      }
      existingHabits.forEach(hConfig => {
        if (hConfig.target > 0) {
          totalTarget += hConfig.target;
          const startEpoch = new Date(hConfig.startDate || 0).getTime();
          (state.data.habit_logs || []).forEach(log => {
            if (String(log.habit_id) === String(hConfig.id) && log.completed) {
              const logEpoch = new Date(log.date).getTime();
              if (logEpoch >= startEpoch) totalCompletions++;
            }
          });
        }
      });
    }
  } catch (e) { console.error("Error calculating habit scorecard", e); }

  const habitScorecardHtml = totalTarget > 0 ? `
    <div class="vision-habit-scorecard" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => routeTo('habits'), 100);" title="View Habits">
      <div class="vision-scorecard-value">
        ${renderIcon('check-circle', null, 'style="width:14px; color:var(--success)"')}
        ${totalCompletions}/${totalTarget}
      </div>
      <div class="vision-scorecard-label">Score</div>
    </div>
  ` : '';


  box.innerHTML = `
    <!-- Top Header (With Actions) -->
    <div class="vision-detail-modal-header">
      <div class="vision-header-info">
        <div class="vision-detail-modal-title">${g.title}</div>
        <div class="vision-detail-modal-meta">
          <span style="background:var(--primary); color:white; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${g.category || 'General'}</span>
          ${statusBadge}
        </div>
      </div>
      <div class="vision-header-actions" style="display:flex; flex-direction:column; align-items:center;">
        <div style="display:flex; gap:8px;">
          <button class="vision-header-icon-btn edit" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => openEditVision('${g.id}'), 100);" title="Edit">
            ${renderIcon('edit', null, 'style="width:18px;"')}
          </button>
          <button class="vision-header-icon-btn delete" onclick="event.stopPropagation(); if(confirm('Delete?')) { closeVisionDetail(); setTimeout(() => deleteVision('${g.id}'), 100); }" title="Delete">
            ${renderIcon('trash', null, 'style="width:18px;"')}
          </button>
          ${g.status !== 'achieved' ? `
          <button class="vision-header-icon-btn achieve" onclick="event.stopPropagation(); closeVisionDetail(); setTimeout(() => markVisionAchieved('${g.id}'), 100);" title="Finish">
            ${renderIcon('trophy', null, 'style="width:18px;"')}
          </button>
          ` : ''}
        </div>
        ${habitScorecardHtml}
      </div>
    </div>

    <!-- Media Section (Dedicated Container) -->
    <div class="vision-detail-media-container" style="background:#000;">
      ${hasVideo
      ? `<div style="width:100%; height:100%; position:relative;">
          <div class="vision-video-gallery" id="visionGallery-${g.id}">
            ${videoUrls.map((u, i) => {
        const videoId = `vision-detail-video-${g.id}-${i}`;
        return `
              <div class="vision-video-slide">
                <video id="${videoId}" 
                       style="width:100%;height:100%;object-fit:cover;" 
                       playsinline webkit-playsinline 
                       loop 
                       muted
                       autoplay
                       preload="auto" 
                       onclick="const v=this; v.paused?v.play():v.pause();"
                       poster="${g.image_url ? resolveMediaUrl(g.image_url) : ''}" 
                       data-vision-local="${u}"></video>
                
                <!-- Audio Toggle Button -->
                <button class="vision-video-audio-btn" 
                        onclick="event.stopPropagation(); toggleVisionAudio('${videoId}', this);">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                </button>

                <!-- Captions Overlay (Notes) -->
                ${g.notes ? `
                <div class="vision-video-captions">
                  ${g.notes}
                </div>
                ` : ''}
              </div>`;
      }).join('')}
          </div>
          ${videoUrls.length > 1 ? `
            <!-- Tap Navigation Overlays (Invisible) -->
            <div style="position:absolute; inset:0; display:flex; z-index:25;">
              <div onclick="event.stopPropagation(); navigateVisionGallery(-1);" style="flex:1; cursor:pointer;" aria-label="Previous"></div>
              <div onclick="event.stopPropagation(); toggleCurrentVisionVideo();" style="flex:1.4; cursor:pointer;" aria-label="Play/Pause"></div>
              <div onclick="event.stopPropagation(); navigateVisionGallery(1);" style="flex:1; cursor:pointer;" aria-label="Next"></div>
            </div>
          ` : ''}
          ${videoDots}
        </div>`
      : `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${getFallbackImage(g)}'">`}
    </div>

    <!-- Entrance Animation Progress Bar (Below Video) -->
    <div class="vision-detail-progress-section">
      <div class="vision-thick-progress-container">
        <div id="visionDetailProgressFill" class="vision-progress-fill" style="width:0%; background:linear-gradient(90deg, ${progressColor} 0%, ${progressColor}cc 100%);"></div>
        <span id="visionDetailProgressText" class="vision-progress-text">0%</span>
      </div>
    </div>

    <!-- Content Sections -->
    <div style="padding: 0 24px 24px;">

      <!-- Timeline & Info -->
      <div style="display:flex; gap:20px; margin-bottom:20px; flex-wrap:wrap;">
        ${createdDate !== 'Unknown' ? `
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
          ${renderIcon('calendar', null, 'style="width:14px;"')}
          <span>Created: <strong style="color:var(--text-2);">${createdDate}</strong></span>
        </div>` : ''}
        ${updatedDate !== 'Unknown' && updatedDate !== createdDate ? `
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted);">
          ${renderIcon('clock', null, 'style="width:14px;"')}
          <span>Updated: <strong style="color:var(--text-2);">${updatedDate}</strong></span>
        </div>` : ''}
      </div>

    <!-- Linked Habits - Enhanced -->
    ${(() => {
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          if (String(g.linked_habits).trim().startsWith('[')) {
            existingHabits = JSON.parse(g.linked_habits);
          } else {
            existingHabits = String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 0 }));
          }
        }
      } catch (e) { console.error("Error parsing linked habits in detail view", e); }

      const habits = state.data.habits || [];
      const linked = existingHabits.map(hObj => {
        const fullHabit = habits.find(h => String(h.id) === String(hObj.id));
        return fullHabit ? { ...fullHabit, target: hObj.target } : null;
      }).filter(Boolean);

      if (!linked.length) return '';
      return `
      <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          ${renderIcon('link', null, 'style="width:14px;"')} Linked Habits
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${linked.map(h => `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:var(--surface-3);">
              <div style="width:8px; height:8px; border-radius:50%; background:var(--primary);"></div>
              <span style="flex:1; font-size:14px; font-weight:600; color:var(--text-1);">${h.habit_name}</span>
              ${h.target > 0 ? `<span style="font-size:12px; color:var(--text-muted);">Target: ${h.target}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    })()}

    <!-- Linked Tasks - Enhanced -->
    ${(() => {
    const linkedTasks = (state.data.tasks || []).filter(t => String(t.vision_id) === String(g.id));
    if (linkedTasks.length === 0) return '';
    return `
      <div style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          ${renderIcon('check-square', null, 'style="width:14px;"')} Linked Tasks
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${linkedTasks.map(t => `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:var(--surface-3);">
              <div style="width:8px; height:8px; border-radius:50%; background:${t.priority === 'P1' ? 'var(--danger)' : (t.priority === 'P2' ? 'var(--warning)' : 'var(--success)')};"></div>
              <span style="flex:1; font-size:14px; font-weight:500; color:var(--text-1); ${t.status === 'completed' ? 'text-decoration:line-through;opacity:0.6;' : ''}">${t.title}</span>
              ${t.due_date ? `<span style="font-size:11px; color:var(--text-muted); background:var(--surface-1); padding:2px 8px; border-radius:10px;">${t.due_date}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  })()}

    <!-- Affirmations Section -->
    <div id="visionDetailAffirmations" style="background:var(--surface-2); border-radius:16px; padding:16px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
          ${renderIcon('sparkles', null, 'style="width:14px; color:var(--warning)"')} Affirmations
        </div>
        <button class="btn-icon" onclick="openAffirmationCreator('${g.id}')" title="Add Affirmation">
          ${renderIcon('plus', null, 'style="width:16px;"')}
        </button>
      </div>
      <div id="visionAffirmationsList" style="display:flex; flex-direction:column; gap:8px;">
        ${renderAffirmationsList(g.id)}
      </div>
    </div>

      <!-- App Action Buttons -->
      <div style="display:flex; gap:12px; margin-top:12px;">
        <button class="btn" onclick="closeVisionDetail()" style="flex:1;">Close</button>
        <button class="btn primary" onclick="closeVisionDetail(); setTimeout(() => { openTaskModal(); setTimeout(() => { if(document.getElementById('mTaskVisionGoal')) document.getElementById('mTaskVisionGoal').value = '${g.id}'; }, 100); }, 300);" style="flex:1.5;">+ Quick Task</button>
        <button class="btn ${g.month_focus === true || String(g.month_focus).toLowerCase() === 'true' ? 'success' : ''}" onclick="toggleVisionFocus('${g.id}')" style="width:50px; display:flex; align-items:center; justify-content:center; padding:0;">
          ${renderIcon('star', null, `style="width:20px; ${g.month_focus === true || String(g.month_focus).toLowerCase() === 'true' ? 'fill:var(--warning);' : ''}"`)}
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  // Fluid Progress Animation Logic
  const animateVisionNumber = (el, start, end, duration) => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progressRatio = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(progressRatio * (end - start) + start);
      el.textContent = `${val}%`;
      if (progressRatio < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = `${end}%`;
      }
    };
    window.requestAnimationFrame(step);
  };

  setTimeout(() => {
    const fill = document.getElementById('visionDetailProgressFill');
    const text = document.getElementById('visionDetailProgressText');
    if (fill && text) {
      // Force Reflow to ensure 0% is registered
      fill.style.transition = 'none';
      fill.style.width = '0%';
      fill.offsetHeight; // reflow

      // Step 1: Charge to 100% (Visual & Numerical synchronized)
      fill.style.transition = 'width 1.2s cubic-bezier(0.65, 0, 0.35, 1), background-color 0.8s ease';
      fill.style.width = '100%';
      fill.style.backgroundColor = 'var(--success)';
      animateVisionNumber(text, 0, 100, 1200);

      // Step 2: Pause at 100%, then Settle to Actual
      setTimeout(() => {
        fill.style.width = `${progress}%`;
        // Transition back to status-based color
        const finalColor = progress >= 100 ? 'var(--success)' : (progress >= 50 ? 'var(--primary)' : 'var(--warning)');
        fill.style.backgroundColor = finalColor;
        animateVisionNumber(text, 100, progress, 1200);
      }, 1600);
    }
  }, 300);

  // Attach navigation logic
  if (hasVideo) {
    const gallery = box.querySelector('.vision-video-gallery');
    const dots = box.querySelectorAll('.vision-dot-btn');
    let currentIdx = 0;
    const total = videoUrls.length;

    window.scrollToVideo = function (index) {
      if (index < 0 || index >= total) return;

      // Pause current video before switching
      const prevVid = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (prevVid) prevVid.pause();

      currentIdx = index;
      const width = gallery.offsetWidth;
      gallery.scrollTo({ left: index * width, behavior: 'smooth' });

      // Play new video after switching
      const nextVid = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (nextVid) nextVid.play().catch(() => { });

      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIdx);
      });
    };

    window.toggleCurrentVisionVideo = function () {
      const v = box.querySelector(`#vision-detail-video-${g.id}-${currentIdx}`);
      if (v) {
        if (v.paused) v.play().catch(() => { });
        else v.pause();
      }
    };

    window.navigateVisionGallery = function (direction) {
      let nextIdx = currentIdx + direction;
      if (nextIdx < 0) nextIdx = total - 1;
      if (nextIdx >= total) nextIdx = 0;
      window.scrollToVideo(nextIdx);
    };
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  initVisionMediaElements(box);

  // Auto-hide navigation buttons after 2 seconds
  setTimeout(() => {
    const navBtns = box.querySelectorAll('.vision-video-nav-btn');
    navBtns.forEach(btn => btn.classList.add('hidden-fade'));
  }, 2000);
};

window.closeVisionDetail = function () {
  const modal = document.getElementById('universalModal');
  if (modal) {
    const videos = modal.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.pause();
        v.currentTime = 0;
        v.removeAttribute('src'); // Better cleanup
        v.load();
      } catch (e) { }
    });
    modal.classList.add('hidden');
  }
};

/* ─── VISION VIDEO HELPERS ───────────────────────────────────────── */
window.toggleVisionAudio = function (videoId, btnEl) {
  const v = document.getElementById(videoId);
  if (!v) return;
  v.muted = !v.muted;

  // Update icon reliably with raw SVG
  if (btnEl) {
    if (v.muted) {
      btnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    } else {
      btnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    }
  }
};

/* ─── VIDEO MODAL ───────────────────────────────────────────────── */
window.openVideoModal = async function (urls, initialIndex = 0) {
  if (!urls) return;
  const videoUrls = Array.isArray(urls) ? urls : [urls];

  const existing = document.getElementById('visionVideoModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'visionVideoModal';
  overlay.className = 'vision-video-modal';
  overlay.innerHTML = `
    <div class="vision-video-inner" style="width:100vw; height:100vh; max-width:none; border-radius:0;">
      <div class="vision-modal-gallery" id="modalVideoGallery">
        ${videoUrls.map((u, i) => `
          <div class="vision-modal-slide">
            <video id="modalVideoPlayer-${i}" 
                   controls 
                   playsinline 
                   webkit-playsinline 
                   x5-playsinline
                   preload="auto" 
                   style="width:100%; height:auto; max-height:100vh; outline:none;" 
                   data-vision-local="${u}"></video>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Create close button via JS so addEventListener works reliably on WKWebView
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('style', [
    'position:fixed',
    'top:max(env(safe-area-inset-top, 16px) + 8px, 48px)',
    'right:16px',
    'z-index:20000',
    'width:44px',
    'height:44px',
    'border-radius:50%',
    'border:none',
    'background:rgba(0,0,0,0.5)',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'color:white',
    'font-size:24px',
    'font-weight:bold',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
  ].join(';'));
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.closeVideoModal();
  });
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);

  const gallery = overlay.querySelector('#modalVideoGallery');
  initVisionMediaElements(gallery);

  setTimeout(() => {
    const slideWidth = gallery.offsetWidth;
    gallery.scrollTo({ left: initialIndex * slideWidth, behavior: 'auto' });
    const initialVid = gallery.querySelector(`#modalVideoPlayer-${initialIndex}`);
    if (initialVid) initialVid.play().catch(() => { });
  }, 100);

  // Aggressive Fix for iOS native fullscreen hijacking
  gallery.querySelectorAll('video').forEach(v => {
    v.addEventListener('webkitbeginfullscreen', (e) => {
      e.preventDefault();
      if (v.webkitExitFullscreen) v.webkitExitFullscreen();
    }, false);

    // Safety: close modal if video exits fullscreen (iOS sometimes triggers this)
    v.addEventListener('webkitendfullscreen', () => {
      window.closeVideoModal();
    });
  });

  // Play/pause videos as they scroll into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const vid = entry.target;
      if (entry.isIntersecting) {
        vid.play().catch(() => { });
      } else {
        vid.pause();
      }
    });
  }, { threshold: 0.6 });

  gallery.querySelectorAll('video').forEach(v => observer.observe(v));
};

window.closeVideoModal = function () {
  const modal = document.getElementById('visionVideoModal');
  if (modal) {
    const v = modal.querySelector('video');
    if (v) { v.pause(); v.src = ''; }
    modal.remove();
  }
};

/* ─── ADD / EDIT MODAL ──────────────────────────────────────────── */
window.openVisionModal = function () {
  window._visionPendingVideos = [];
  window._visionMediaTab = 'image';
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(null);
  modal.classList.remove('hidden');
  initVisionFormListeners();
};

window.openEditVision = function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  window._visionPendingVideos = g.video_url ? g.video_url.split(',').map(s => s.trim()).filter(Boolean).map(u => ({ localKey: u.replace('local://', ''), filename: 'Existing Video', type: 'video/mp4', isExisting: true })) : [];
  window._visionMediaTab = 'image';
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  box.innerHTML = buildVisionForm(g);
  modal.classList.remove('hidden');
  initVisionFormListeners();
  setTimeout(() => {
    if (typeof renderPendingVideosUi === "function") {
      renderPendingVideosUi();
      initVisionMediaElements(box);
    }
  }, 100);
};

function buildVisionForm(g) {
  const isEdit = !!g;
  return `
    <div class="vision-detail-modal-header">
      <div class="vision-detail-modal-title" style="font-size:18px;">
        ${isEdit ? renderIcon('edit', null, 'style="width:20px;"') + ' Edit Goal' : renderIcon('target', null, 'style="width:20px;"') + ' New Vision Goal'}
      </div>
    </div>

    <div style="padding: 0 24px 24px;">
      <!-- Section 1: Basic Info -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('write', null, 'style="width:14px;"')} Title & Category</div>
        <input class="input" id="mVisTitle" placeholder="Goal Title *" value="${isEdit ? escH(g.title) : ''}" style="margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <select class="input" id="mVisCat">
            ${VISION_CATEGORIES.map(c => `<option value="${c}" ${isEdit && g.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <input type="date" class="input" id="mVisDate" value="${isEdit ? (g.target_date || '') : ''}">
        </div>
      </div>

      <!-- Section 2: Progress -->
      <div class="vision-form-section">
        <label class="vision-form-label">
          <span>${renderIcon('trending-up', null, 'style="width:14px;"')} Progress</span>
          <strong id="mVisProgressVal" style="color:var(--primary); margin-left:auto;">${isEdit ? (g.progress || 0) : 0}%</strong>
        </label>
        <div style="margin-top:8px;">
          <input type="range" id="mVisProgress" min="0" max="100" value="${isEdit ? (g.progress || 0) : 0}"
            ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ? 'disabled' : ''}
            oninput="document.getElementById('mVisProgressVal').textContent = this.value + '%'">
          ${isEdit && g.linked_habits && String(g.linked_habits).startsWith('[') && JSON.parse(g.linked_habits).length > 0 ?
      `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Auto-calculated from habits</div>` : ''}
        </div>
      </div>

      <!-- Section 3: Notes -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('file-text', null, 'style="width:14px;"')} Notes</div>
        <textarea class="input" id="mVisNotes" placeholder="What's your vision? (optional)" style="height:100px;resize:none;">${isEdit ? escH(g.notes || '') : ''}</textarea>
      </div>

      <!-- Section 4: Media -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('image', null, 'style="width:14px;"')} Media Attachments</div>
        <div class="vz-disp-row">
          <span class="vz-disp-lbl">Show on board</span>
          <div class="vz-disp-seg">
            <button type="button" class="vz-disp ${(isEdit && g && g.display_mode === 'image') ? '' : 'active'}" data-v="color" onclick="vzSetDisplayMode('color')">Color</button>
            <button type="button" class="vz-disp ${(isEdit && g && g.display_mode === 'image') ? 'active' : ''}" data-v="image" onclick="vzSetDisplayMode('image')">Image</button>
          </div>
          <input type="hidden" id="mVisDisplayMode" value="${(isEdit && g && g.display_mode === 'image') ? 'image' : 'color'}">
        </div>
        <div class="vision-modal-tabs">
          <button class="vision-modal-tab ${window._visionMediaTab === 'image' ? 'active' : ''}" id="vTabImg" onclick="switchVisionMediaTab('image')">Image</button>
          <button class="vision-modal-tab ${window._visionMediaTab === 'url' ? 'active' : ''}" id="vTabUrl" onclick="switchVisionMediaTab('url')">URL</button>
          <button class="vision-modal-tab ${window._visionMediaTab === 'video' ? 'active' : ''}" id="vTabVid" onclick="switchVisionMediaTab('video')">Video</button>
        </div>

        <div id="vPanelImg" style="display:${window._visionMediaTab === 'image' ? 'block' : 'none'}">
          <div class="vision-upload-zone" onclick="document.getElementById('vImgInput').click()">
            <input type="file" id="vImgInput" accept="image/*" hidden onchange="handleVisionMedia(this.files,'image')">
            <span class="vision-upload-icon">${renderIcon('upload-cloud', null, 'style="width:32px; color:var(--text-muted); opacity:0.5;"')}</span>
            <div style="font-weight:600; font-size:14px;">Upload Image</div>
          </div>
          <div id="vImgPreviewWrap" class="vision-media-preview" style="display:none">
            <img id="vImgPreview" src="" alt="preview">
            <button class="vision-media-remove" onclick="clearVisionMedia('image')">✕</button>
          </div>
        </div>

        <div id="vPanelUrl" style="display:${window._visionMediaTab === 'url' ? 'block' : 'none'}">
          <input type="url" id="mVisImg" class="input" placeholder="https://example.com/image.jpg" value="${isEdit ? escH(g?.image_url?.startsWith('data:') ? '' : (g.image_url || '')) : ''}">
        </div>

        <div id="vPanelVid" style="display:${window._visionMediaTab === 'video' ? 'block' : 'none'}">
          <div class="vision-upload-zone" onclick="document.getElementById('vVidInput').click()">
            <input type="file" id="vVidInput" accept="video/*" multiple hidden onchange="handleVisionMedia(this.files,'video')">
            <span class="vision-upload-icon">${renderIcon('video', null, 'style="width:32px; color:var(--text-muted); opacity:0.5;"')}</span>
            <div style="font-weight:600; font-size:14px;">Upload Video(s)</div>
          </div>
          <div id="vVidPreviewWrap" class="vision-media-preview" style="display:none; flex-direction:column; gap:10px;"></div>
        </div>
      </div>

      <!-- Section 5: Habits & Focus -->
      <div class="vision-form-section">
        <div class="vision-form-label">${renderIcon('link', null, 'style="width:14px;"')} Link Habits</div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding-right:4px;">
          ${(() => {
      const habits = state.data.habits || [];
      let existingHabits = [];
      try {
        if (g && g.linked_habits) {
          existingHabits = String(g.linked_habits).trim().startsWith('[') ? JSON.parse(g.linked_habits) : String(g.linked_habits).split(',').map(x => ({ id: x.trim(), target: 25 }));
        }
      } catch (e) { console.error("Error parsing habits", e); }

      const existingIds = existingHabits.map(h => String(h.id));
      if (!habits.length) return '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:10px;">No habits available</div>';

      return habits.map(h => {
        const isLinked = existingIds.includes(String(h.id));
        const linkedData = isLinked ? existingHabits.find(ex => String(ex.id) === String(h.id)) : null;
        const targetVal = linkedData?.target || 25;

        return `
                <div style="background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; padding:12px;">
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="vHabitLink_${h.id}" value="${h.id}" ${isLinked ? 'checked' : ''} 
                           onchange="document.getElementById('vHabitTargetWrap_${h.id}').style.display = this.checked ? 'flex' : 'none'" 
                           style="width:18px; height:18px; accent-color:var(--primary);">
                    <div style="flex:1;">
                      <div style="font-size:14px; font-weight:700;">${h.habit_name}</div>
                      <div style="font-size:11px; color:var(--text-muted);">${h.category || 'General'}</div>
                    </div>
                  </label>
                  <div id="vHabitTargetWrap_${h.id}" style="display:${isLinked ? 'flex' : 'none'}; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                    <span style="font-size:12px; font-weight:600; color:var(--text-2);">Target Recurrence:</span>
                    <input type="number" id="vHabitTarget_${h.id}" value="${targetVal}" min="1" style="width:60px; height:32px; text-align:center; border-radius:8px; border:1px solid var(--border-color); background:var(--surface-2); font-size:13px; font-weight:700;">
                  </div>
                </div>`;
      }).join('');
    })()}
        </div>

        <label style="display:flex; align-items:center; gap:12px; margin-top:16px; padding:14px; background:var(--surface-1); border:1px solid var(--border-color); border-radius:12px; cursor:pointer;">
          <input type="checkbox" id="mVisMonthFocus" ${isEdit && (g.month_focus === true || String(g.month_focus).toLowerCase() === 'true') ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary);">
          <div>
            <div style="font-size:14px; font-weight:700;">Focus This Month</div>
            <div style="font-size:11px; color:var(--text-muted);">Pin to top and manifestation views</div>
          </div>
          <span style="margin-left:auto; font-size:18px;">⭐</span>
        </label>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; gap:12px; margin-top:24px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')" style="flex:1; height:48px;">Cancel</button>
        <button class="btn primary" data-action="${isEdit ? 'update-vision-modal' : 'save-vision-modal'}" ${isEdit ? `data-edit-id="${g.id}"` : ''} style="flex:2; height:48px; font-weight:800;">
          ${isEdit ? 'Save Changes' : 'Create Vision'}
        </button>
      </div>
    </div>
  `;
}

function initVisionFormListeners() {
  // Drag & drop for image
  const imgZone = document.getElementById('vImgZone');
  if (imgZone) {
    imgZone.addEventListener('dragover', e => { e.preventDefault(); imgZone.classList.add('drag-over'); });
    imgZone.addEventListener('dragleave', () => imgZone.classList.remove('drag-over'));
    imgZone.addEventListener('drop', e => {
      e.preventDefault();
      imgZone.classList.remove('drag-over');
      handleVisionMedia(e.dataTransfer.files, 'image');
    });
  }
  // Drag & drop for video
  const vidZone = document.getElementById('vVidZone');
  if (vidZone) {
    vidZone.addEventListener('dragover', e => { e.preventDefault(); vidZone.classList.add('drag-over'); });
    vidZone.addEventListener('dragleave', () => vidZone.classList.remove('drag-over'));
    vidZone.addEventListener('drop', e => {
      e.preventDefault();
      vidZone.classList.remove('drag-over');
      handleVisionMedia(e.dataTransfer.files, 'video');
    });
  }
}

window.switchVisionMediaTab = function (tab) {
  const tabs = { image: 'vPanelImg', url: 'vPanelUrl', video: 'vPanelVid' };
  const btns = { image: 'vTabImg', url: 'vTabUrl', video: 'vTabVid' };
  Object.entries(tabs).forEach(([key, panelId]) => {
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = key === tab ? 'block' : 'none';
  });
  Object.entries(btns).forEach(([key, btnId]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.toggle('active', key === tab);
  });
  window._visionMediaTab = tab;
  if (tab === 'video') initVisionMediaElements(document.getElementById('vVidPreviewWrap'));
};

window.renderPendingVideosUi = function () {
  const wrap = document.getElementById('vVidPreviewWrap');
  if (!wrap) return;
  if (!window._visionPendingVideos || window._visionPendingVideos.length === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.style.display = 'flex';
  wrap.innerHTML = window._visionPendingVideos.map((v, idx) => {
    const videoId = `pending-video-${idx}`;
    const videoUrl = v.isExisting ? 'local://' + v.localKey : 'local://' + v.localKey; // Both are local keys

    return `
        <div style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#000;">
          <video id="${videoId}" controls style="width:100%;max-height:200px;object-fit:cover;" webkit-playsinline preload="auto" data-vision-local="${videoUrl}">
          </video>
          <button class="vision-media-remove" onclick="event.preventDefault();removePendingVideo(${idx})" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;">✕</button>
        </div>
        `;
  }).join('');
  initVisionMediaElements(wrap);
};

window.removePendingVideo = function (idx) {
  if (!window._visionPendingVideos) return;
  const v = window._visionPendingVideos[idx];
  if (v && !v.isExisting && v.localKey) {
    _VisionIDB.del(v.localKey).catch(() => { });
    delete window._visionMediaCache[v.localKey];
  }
  window._visionPendingVideos.splice(idx, 1);
  renderPendingVideosUi();
};

window.handleVisionMedia = function (files, type) {
  if (!files || files.length === 0) return;

  if (type === 'image') {
    const file = files[0];
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) { showToast('Image too large. Max 8 MB', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async e => {
      const buffer = e.target.result;
      const mimeType = file.type;
      const storedObj = { type: mimeType, buffer };
      const blob = new Blob([buffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const localKey = 'img_' + Date.now();
      try {
        await _VisionIDB.put(localKey, storedObj);
        window._visionMediaCache[localKey] = blobUrl;
      } catch (err) {
        showToast('Could not save image: ' + err.message, 'error');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      window._visionPendingImage = { localKey, filename: file.name, type: mimeType };
      const preview = document.getElementById('vImgPreview');
      const wrap = document.getElementById('vImgPreviewWrap');
      if (preview) preview.src = blobUrl;
      if (wrap) wrap.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
  } else {
    // VIDEO - support multiple
    if (!window._visionPendingVideos) window._visionPendingVideos = [];
    const maxSize = 200 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        showToast(`Video ${file.name} too large. Max 200 MB`, 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = async e => {
        const buffer = e.target.result;
        const mimeType = file.type;
        const storedObj = { type: mimeType, buffer };
        const blob = new Blob([buffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const localKey = 'vid_' + Date.now() + Math.random().toString(36).substring(7);

        try {
          await _VisionIDB.put(localKey, storedObj);
          window._visionMediaCache[localKey] = blobUrl;
          window._visionPendingVideos.push({ localKey, filename: file.name, type: mimeType, size: file.size });
          renderPendingVideosUi();
        } catch (err) {
          showToast('Could not save video: ' + err.message, 'error');
          URL.revokeObjectURL(blobUrl);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }
};

window.clearVisionMedia = function (type) {
  if (type === 'image') {
    window._visionPendingImage = null;
    const preview = document.getElementById('vImgPreview');
    const wrap = document.getElementById('vImgPreviewWrap');
    if (preview) preview.src = '';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (window._visionPendingVideo?.localKey) {
      _VisionIDB.del(window._visionPendingVideo.localKey).catch(() => { });
      delete window._visionVideoCache[window._visionPendingVideo.localKey];
    }
    window._visionPendingVideo = null;
    const preview = document.getElementById('vVidPreview');
    const wrap = document.getElementById('vVidPreviewWrap');
    if (preview) { preview.pause(); preview.src = ''; }
    if (wrap) wrap.style.display = 'none';
  }
};

// Shared helper to collect payload from the modal
function collectVisionPayload() {
  const tab = window._visionMediaTab || 'image';
  let image_url = '';
  let video_url = '';

  if (tab === 'image' && window._visionPendingImage) {
    image_url = 'local-img://' + window._visionPendingImage.localKey;
  } else if (tab === 'url') {
    const urlEl = document.getElementById('mVisImg');
    if (urlEl) image_url = urlEl.value;
  } else if (tab === 'video' && window._visionPendingVideos && window._visionPendingVideos.length > 0) {
    // Support multiple videos - join all video keys with comma
    video_url = window._visionPendingVideos.map(v => 'local://' + v.localKey).join(',');
  }

  // Preserve existing video_url when editing and no new video was selected
  if (!video_url) {
    try {
      const editBtn = document.querySelector('[data-action="update-vision-modal"]');
      if (editBtn && editBtn.dataset.editId) {
        const existingGoal = state.data.vision.find(v => String(v.id) === String(editBtn.dataset.editId));
        if (existingGoal && existingGoal.video_url && (existingGoal.video_url.startsWith('local://') || existingGoal.video_url.startsWith('local-img://'))) {
          video_url = existingGoal.video_url;
        }
      }
    } catch (e) { }
  }

  // Collect linked habits (checked checkboxes)
  const linkedHabitsDocs = Array.from(document.querySelectorAll('[id^="vHabitLink_"]:checked')).map(cb => {
    const id = cb.value;
    const targetInput = document.getElementById(`vHabitTarget_${id}`);
    const target = targetInput ? parseInt(targetInput.value, 10) || 25 : 25;

    // We need to fetch the existing start date if this was already linked, otherwise use today
    let startDate = new Date().toISOString().slice(0, 10);
    try {
      const existingBtn = document.querySelector('[data-action="update-vision-modal"]');
      if (existingBtn && existingBtn.dataset.editId) {
        const g = state.data.vision.find(v => String(v.id) === String(existingBtn.dataset.editId));
        if (g && g.linked_habits && g.linked_habits.startsWith('[')) {
          const parsed = JSON.parse(g.linked_habits);
          const existing = parsed.find(ex => String(ex.id) === String(id));
          if (existing && existing.startDate) startDate = existing.startDate;
        }
      }
    } catch (e) { }

    return { id, target, startDate };
  });

  const linkedHabits = JSON.stringify(linkedHabitsDocs);
  const monthFocus = document.getElementById('mVisMonthFocus')?.checked || false;

  return {
    title: document.getElementById('mVisTitle').value.trim(),
    category: document.getElementById('mVisCat').value,
    target_date: document.getElementById('mVisDate').value,
    notes: document.getElementById('mVisNotes').value,
    progress: parseInt(document.getElementById('mVisProgress').value, 10),
    image_url,
    video_url,
    month_focus: monthFocus,
    linked_habits: linkedHabits,
    display_mode: document.getElementById('mVisDisplayMode')?.value || 'color',
  };
}

// Universal modal click handler
document.addEventListener('click', async function (event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'save-vision-modal') {
    const payload = collectVisionPayload();
    if (!payload.title) { showToast('Title is required!', 'error'); return; }
    payload.status = 'active';
    showToast('Saving goal…');
    const createRes = await apiCall('post', 'vision_board', payload);
    document.getElementById('universalModal').classList.add('hidden');
    window._visionPendingImage = null;
    window._visionPendingVideo = null;
    await refreshData('vision');
    showToast('Vision goal added! ✅');
    // Upload media to Drive in background
    if (createRes?.id) _syncVisionMediaToCloud(createRes.id).catch(() => {});
  } else if (btn.dataset.action === 'update-vision-modal') {
    const id = btn.dataset.editId;
    const payload = collectVisionPayload();
    if (!payload.title) { showToast('Title is required!', 'error'); return; }
    showToast('Updating…');
    await apiCall('update', 'vision_board', payload, id);
    document.getElementById('universalModal').classList.add('hidden');
    window._visionPendingImage = null;
    window._visionPendingVideo = null;
    await refreshData('vision');
    showToast('Vision goal updated! ✅');
    // Upload media to Drive in background
    _syncVisionMediaToCloud(id).catch(() => {});
  }
});

/* ─── ACTIONS ───────────────────────────────────────────────────── */
window.toggleVisionFocus = async function (id) {
  const g = state.data.vision.find(v => String(v.id) === String(id));
  if (!g) return;
  const newFocus = !(g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE');
  g.month_focus = newFocus; // optimistic
  document.getElementById('universalModal').classList.add('hidden');
  await apiCall('update', 'vision_board', { month_focus: newFocus }, id);
  await refreshData('vision');
  showToast(newFocus ? '⭐ Goal set as Month Focus!' : 'Focus removed');
};

window.deleteVision = async function (id) {

  if (confirm('Delete this vision goal?')) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('delete', 'vision_board', {}, id);
    await refreshData('vision');
    showToast('Goal deleted');
  }
};

window.markVisionAchieved = async function (id) {
  if (confirm('Mark this goal as achieved? ' + renderIcon('trophy', null, 'style="width:16px;height:16px;margin-right:4px"'))) {
    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('update', 'vision_board', { status: 'achieved', progress: 100 }, id);
    await refreshData('vision');
    showToast(renderIcon('trophy', null, 'style="width:16px;height:16px;margin-right:4px"') + ' Goal marked as achieved!');
  }
};

/* ─── AFFIRMATION SYSTEM LOGIC ─────────────────────────────────── */
window.renderAffirmationsList = function(visionId) {
  const affirmations = (state.data.vision_affirmations || [])
    .filter(a => String(a.vision_id) === String(visionId))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (affirmations.length === 0) {
    return `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No affirmations yet. Add one to start your ritual.</div>`;
  }

  const pinIcon = (a) => {
    const pinned = a.is_pinned === true || a.is_pinned === 'true' || a.is_pinned === 'TRUE';
    return pinned ? `<span title="Pinned to Dashboard" style="font-size:11px; opacity:0.7;">📌</span>` : '';
  };

  return affirmations.map(a => `
    <div class="vision-aff-item" style="background:var(--surface-3); border-radius:12px; padding:10px 14px; display:flex; align-items:center; gap:12px;">
      <div style="flex:1; font-size:14px; color:var(--text-1); line-height:1.4;">
        ${pinIcon(a)} ${escH(a.text)}
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn-icon sm" onclick="openAffirmationCreator('${visionId}', '${a.id}')" title="Edit">
          ${renderIcon('edit', null, 'style="width:14px;"')}
        </button>
        <button class="btn-icon sm delete" onclick="deleteAffirmation('${a.id}')" title="Delete">
          ${renderIcon('trash', null, 'style="width:14px;"')}
        </button>
      </div>
    </div>
  `).join('');
};

window.openAffirmationCreator = function(visionId, affId = null) {
  const aff = affId ? state.data.vision_affirmations.find(a => String(a.id) === String(affId)) : null;
  const isEdit = !!aff;
  const isPinned = aff ? (aff.is_pinned === true || aff.is_pinned === 'true' || aff.is_pinned === 'TRUE') : false;
  const currentStyle = (aff?.bg_style || 'dawn').toLowerCase();
  const existingMediaKey = aff?.media_key || '';
  window._affPendingMedia = null;
  window._affMediaRemoved = false;

  const styleConfig = {
    dawn:  { label: 'Dawn',  gradient: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)', icon: '🌅' },
    ocean: { label: 'Ocean', gradient: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',              icon: '🌊' },
    deep:  { label: 'Deep',  gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', icon: '🌌' }
  };

  // Remove any existing affirmation creator modal
  const existingModal = document.getElementById('affirmationCreatorModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'affirmationCreatorModal';
  modal.style.cssText = 'position:fixed; inset:0; z-index:10010; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal-box" style="max-width:450px; animation: modalIn 0.2s ease-out;">
      <div class="vision-detail-modal-header" style="border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
        <div class="vision-detail-modal-title">
          ${renderIcon('sparkles', null, 'style="width:18px; color:var(--warning)"')} ${isEdit ? 'Edit Affirmation' : 'New Affirmation'}
        </div>
        <button class="btn icon" onclick="document.getElementById('affirmationCreatorModal').remove()">${renderIcon('x', null, 'style="width:20px"')}</button>
      </div>
      <div style="padding: 0 0 24px;">
        <div class="vision-form-section">
          <label class="vision-form-label">Affirmation Text</label>
          <textarea id="affText" class="input" placeholder="I am becoming the best version of myself..." style="height:120px; font-size:16px; line-height:1.5; padding:16px; border-radius:16px;" oninput="updateAffPreview()">${isEdit ? escH(aff.text) : ''}</textarea>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
            <div style="font-size:11px; color:var(--text-muted);">Wrap words in *asterisks* for emphasis in ritual view.</div>
            <button type="button" id="affAISuggestBtn" class="btn" onclick="getAISuggestions('${visionId}')" style="font-size:11px; padding:4px 10px; border-radius:8px; gap:4px; display:inline-flex; align-items:center;">
              ${renderIcon('sparkles', null, 'style="width:12px; color:var(--warning)"')} AI Suggest
            </button>
          </div>
          <div id="affAISuggestions" style="display:none; margin-top:10px;"></div>

          <!-- Live Preview -->
          <div class="aff-preview-container">
            <div class="aff-preview-label">RITUAL PREVIEW</div>
            <div class="aff-preview-box" id="affPreviewBox">
              <div class="aff-preview-text" id="affPreviewText">
                <span style="opacity:0.3; font-weight:400; font-size:13px;">Type to see preview...</span>
              </div>
            </div>
          </div>
        </div>

        <div class="vision-form-section">
          <label class="vision-form-label">Ritual Theme</label>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
            ${Object.entries(styleConfig).map(([key, cfg]) => `
              <button type="button" class="aff-style-choice ${currentStyle === key ? 'active' : ''}"
                      data-style="${key}"
                      onclick="selectAffStyle(this, '${key}')"
                      style="padding:0; border-radius:14px; border:2px solid ${currentStyle === key ? 'var(--primary)' : 'var(--border-color)'}; overflow:hidden; cursor:pointer; transition: border-color 0.2s, transform 0.2s;">
                <div style="background:${cfg.gradient}; padding:16px 10px 10px; text-align:center;">
                  <div style="font-size:20px; margin-bottom:4px;">${cfg.icon}</div>
                </div>
                <div style="padding:8px; background:var(--surface-2); font-size:12px; font-weight:700; text-align:center; color:var(--text-1);">
                  ${cfg.label}
                </div>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="affStyle" value="${currentStyle}">
        </div>

        <!-- Ritual Media -->
        <div class="vision-form-section">
          <label class="vision-form-label">Ritual Media <span style="font-weight:400; color:var(--text-muted);">(optional)</span></label>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">Image or video plays as cinematic background during this affirmation in the ritual.</div>
          <div class="aff-media-tabs" id="affMediaTabs">
            <button type="button" class="aff-media-tab ${!existingMediaKey ? 'active' : ''}" data-tab="none" onclick="switchAffMediaTab('none')">None</button>
            <button type="button" class="aff-media-tab ${existingMediaKey && existingMediaKey.includes('local-img://') ? 'active' : ''}" data-tab="image" onclick="switchAffMediaTab('image')">Image</button>
            <button type="button" class="aff-media-tab ${existingMediaKey && existingMediaKey.includes('local://') && !existingMediaKey.includes('local-img://') ? 'active' : ''}" data-tab="video" onclick="switchAffMediaTab('video')">Video</button>
          </div>
          <div id="affMediaContent" style="margin-top:10px;">
            <div id="affMediaNone" class="aff-media-panel ${!existingMediaKey ? '' : 'hidden'}">
              <div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">
                No media — mesh gradient only during ritual
              </div>
            </div>
            <div id="affMediaImage" class="aff-media-panel ${existingMediaKey && existingMediaKey.includes('local-img://') ? '' : 'hidden'}">
              <div id="affImgPreview" class="aff-media-preview"></div>
              <label class="aff-media-dropzone" id="affImgDropzone">
                <input type="file" accept="image/*" onchange="handleAffMedia(this.files, 'image')" style="display:none;">
                <div style="text-align:center;">
                  <div style="font-size:24px; margin-bottom:6px;">📷</div>
                  <div style="font-size:12px; font-weight:600; color:var(--text-1);">Choose image or drag & drop</div>
                  <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Max 8 MB · JPG, PNG, WebP</div>
                </div>
              </label>
            </div>
            <div id="affMediaVideo" class="aff-media-panel ${existingMediaKey && existingMediaKey.includes('local://') && !existingMediaKey.includes('local-img://') ? '' : 'hidden'}">
              <div id="affVidPreview" class="aff-media-preview"></div>
              <label class="aff-media-dropzone" id="affVidDropzone">
                <input type="file" accept="video/*" onchange="handleAffMedia(this.files, 'video')" style="display:none;">
                <div style="text-align:center;">
                  <div style="font-size:24px; margin-bottom:6px;">🎬</div>
                  <div style="font-size:12px; font-weight:600; color:var(--text-1);">Choose video or drag & drop</div>
                  <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Max 200 MB · MP4, WebM, MOV</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Pin toggle -->
        <div class="vision-form-section" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:12px 14px; background:var(--surface-2); border-radius:12px;">
            <input type="checkbox" id="affPinned" ${isPinned ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--warning); cursor:pointer;">
            <div>
              <div style="font-size:13px; font-weight:600; color:var(--text-1);">Pin to Dashboard</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Pinned affirmations show on your daily dashboard widget</div>
            </div>
          </label>
        </div>

        <div style="display:flex; gap:12px; margin-top:20px;">
          <button class="btn" onclick="document.getElementById('affirmationCreatorModal').remove()" style="flex:1;">Cancel</button>
          <button class="btn primary" id="affSaveBtn" onclick="saveAffirmation('${visionId}', ${affId ? `'${affId}'` : 'null'})" style="flex:2;">
            ${isEdit ? 'Update' : 'Add to Goal'}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  document.getElementById('affText').focus();
  if (isEdit) updateAffPreview();

  // If editing and has existing media, load preview
  if (existingMediaKey) {
    (async () => {
      try {
        const url = await resolveMediaUrlAsync(existingMediaKey);
        if (!url) return;
        const isImg = existingMediaKey.includes('local-img://');
        const previewEl = document.getElementById(isImg ? 'affImgPreview' : 'affVidPreview');
        if (previewEl) {
          if (isImg) {
            previewEl.innerHTML = `<div class="aff-media-thumb"><img src="${url}" alt="Preview"><button type="button" class="aff-media-remove" onclick="removeAffMedia()">✕</button></div>`;
          } else {
            previewEl.innerHTML = `<div class="aff-media-thumb"><video src="${url}" muted playsinline style="max-height:120px; border-radius:10px;"></video><button type="button" class="aff-media-remove" onclick="removeAffMedia()">✕</button></div>`;
          }
        }
      } catch (e) { console.warn('Failed to load affirmation media preview:', e); }
    })();
  }

  // Setup drag & drop
  ['affImgDropzone', 'affVidDropzone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dragover');
      const type = id.includes('Img') ? 'image' : 'video';
      handleAffMedia(e.dataTransfer.files, type);
    });
  });
};

window.selectAffStyle = function(btn, style) {
  btn.closest('.vision-form-section').querySelectorAll('.aff-style-choice').forEach(b => {
    b.classList.remove('active');
    b.style.borderColor = 'var(--border-color)';
    b.style.transform = 'scale(1)';
  });
  btn.classList.add('active');
  btn.style.borderColor = 'var(--primary)';
  btn.style.transform = 'scale(1.03)';
  document.getElementById('affStyle').value = style;
  updateAffPreview();
};

/* --- Affirmation Media Handling --- */
window.switchAffMediaTab = function(tab) {
  document.querySelectorAll('.aff-media-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.aff-media-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('affMedia' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.classList.remove('hidden');
  if (tab === 'none') {
    window._affPendingMedia = null;
    window._affMediaRemoved = true;
  }
};

window.handleAffMedia = async function(files, type) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const maxSize = type === 'image' ? 8 * 1024 * 1024 : 200 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast(`File too large. Max ${type === 'image' ? '8' : '200'} MB.`, 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = e.target.result;
    const mimeType = file.type;
    const prefix = type === 'image' ? 'aff_img_' : 'aff_vid_';
    const localKey = prefix + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    await _VisionIDB.put(localKey, { type: mimeType, buffer });
    const blob = new Blob([buffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    window._visionMediaCache[localKey] = blobUrl;

    window._affPendingMedia = { localKey, type, mimeType };
    window._affMediaRemoved = false;

    // Show preview
    const previewEl = document.getElementById(type === 'image' ? 'affImgPreview' : 'affVidPreview');
    if (previewEl) {
      if (type === 'image') {
        previewEl.innerHTML = `<div class="aff-media-thumb"><img src="${blobUrl}" alt="Preview"><button type="button" class="aff-media-remove" onclick="removeAffMedia()">✕</button></div>`;
      } else {
        previewEl.innerHTML = `<div class="aff-media-thumb"><video src="${blobUrl}" muted playsinline style="max-height:120px; border-radius:10px;"></video><button type="button" class="aff-media-remove" onclick="removeAffMedia()">✕</button></div>`;
      }
    }
  };
  reader.readAsArrayBuffer(file);
};

window.removeAffMedia = function() {
  window._affPendingMedia = null;
  window._affMediaRemoved = true;
  const imgPreview = document.getElementById('affImgPreview');
  const vidPreview = document.getElementById('affVidPreview');
  if (imgPreview) imgPreview.innerHTML = '';
  if (vidPreview) vidPreview.innerHTML = '';
};

/* --- Live Preview in Creator --- */
window.updateAffPreview = function() {
  const text = document.getElementById('affText')?.value.trim();
  const style = document.getElementById('affStyle')?.value || 'dawn';
  const previewBox = document.getElementById('affPreviewBox');
  const previewText = document.getElementById('affPreviewText');
  if (!previewBox || !previewText) return;

  const gradients = {
    dawn:  'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)',
    ocean: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
    deep:  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
  };
  previewBox.style.background = gradients[style] || gradients.dawn;

  if (!text) {
    previewText.innerHTML = '<span style="opacity:0.3; font-weight:400; font-size:13px;">Type to see preview...</span>';
    return;
  }

  // Render kinetic-style preview with emphasis
  const words = text.split(/\s+/);
  previewText.innerHTML = words.map((word, i) => {
    const isEmph = word.startsWith('*') && word.endsWith('*') && word.length > 2;
    const clean = isEmph ? escH(word.slice(1, -1)) : escH(word);
    const cls = isEmph ? 'ritual-word ritual-word-emphasis' : 'ritual-word';
    return `<span class="${cls}" style="animation-delay:${i * 0.1}s">${clean}</span>`;
  }).join(' ');
};

/* --- AI Suggestions --- */
window.getAISuggestions = async function(visionId) {
  const btn = document.getElementById('affAISuggestBtn');
  const container = document.getElementById('affAISuggestions');
  if (!btn || !container) return;

  const config = AI_SERVICE.getConfig();
  if (!config.apiKey) {
    showToast('Add an AI API key in Settings first', 'error');
    return;
  }

  // Get goal context
  const vision = state.data.visions?.find(v => String(v.id) === String(visionId));
  const goalTitle = vision?.title || 'my goal';
  const goalCategory = vision?.category || '';
  const existingAffs = (state.data.vision_affirmations || [])
    .filter(a => String(a.vision_id) === String(visionId))
    .map(a => a.text);

  btn.disabled = true;
  btn.innerHTML = `${renderIcon('loading', null, 'style="width:12px; animation:spin 1s linear infinite"')} Thinking...`;

  try {
    const prompt = `You are an expert in positive psychology and manifestation affirmations.

Goal: "${goalTitle}"${goalCategory ? ` (Category: ${goalCategory})` : ''}
${existingAffs.length ? `Existing affirmations:\n${existingAffs.map(a => `- ${a}`).join('\n')}\n\nGenerate 3 NEW and DIFFERENT affirmations.` : 'Generate 3 affirmations for this goal.'}

Rules:
- Start with "I am", "I have", "I attract", "I choose", "My" or similar first-person present tense
- Be specific to the goal, not generic
- 8-20 words each
- Wrap 1-2 key power words in *asterisks* for emphasis
- Return ONLY the 3 affirmations, one per line, no numbering`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error('AI request failed');
    const result = await response.json();
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const suggestions = raw.split('\n').map(s => s.trim()).filter(s => s && !s.match(/^\d/));

    if (!suggestions.length) throw new Error('No suggestions');

    container.style.display = 'flex';
    container.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;';
    container.innerHTML = suggestions.slice(0, 3).map(s => `
      <button type="button" class="btn" onclick="useAISuggestion(this)" style="font-size:12px; padding:8px 12px; border-radius:10px; text-align:left; line-height:1.3; flex:1 1 100%; background:var(--surface-2); border:1px solid var(--border-color);">
        ${escH(s)}
      </button>
    `).join('');

  } catch (err) {
    console.error('AI suggest error:', err);
    showToast('Could not generate suggestions', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${renderIcon('sparkles', null, 'style="width:12px; color:var(--warning)"')} AI Suggest`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
};

window.useAISuggestion = function(btn) {
  const textarea = document.getElementById('affText');
  if (textarea) {
    textarea.value = btn.textContent.trim();
    updateAffPreview();
    textarea.focus();
  }
  // Highlight selected
  btn.parentElement.querySelectorAll('button').forEach(b => b.style.borderColor = 'var(--border-color)');
  btn.style.borderColor = 'var(--primary)';
};

window.saveAffirmation = async function(visionId, affId) {
  const text = document.getElementById('affText')?.value.trim();
  const bg_style = document.getElementById('affStyle')?.value || 'dawn';
  const is_pinned = document.getElementById('affPinned')?.checked ? 'true' : 'false';

  if (!text) {
    showToast('Please enter affirmation text', 'error');
    return;
  }

  // Disable save button to prevent double-tap
  const saveBtn = document.getElementById('affSaveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const payload = {
      vision_id: visionId,
      text: text,
      bg_style: bg_style,
      is_pinned: is_pinned
    };

    // Handle media_key
    if (window._affPendingMedia) {
      const prefix = window._affPendingMedia.type === 'image' ? 'local-img://' : 'local://';
      payload.media_key = prefix + window._affPendingMedia.localKey;
    } else if (window._affMediaRemoved) {
      payload.media_key = '';
    }
    // If neither pending nor removed, don't send media_key (preserves existing on edit)

    if (affId) {
      // Edit: preserve original order and created_at
      const existing = (state.data.vision_affirmations || []).find(a => String(a.id) === String(affId));
      if (existing) {
        payload.order = existing.order;
        payload.created_at = existing.created_at;
        // Preserve existing media_key if not changed
        if (!window._affPendingMedia && !window._affMediaRemoved) {
          payload.media_key = existing.media_key || '';
        }
      }
      await apiCall('update', 'vision_affirmations', payload, affId);
    } else {
      // New: calculate next order using max to avoid gaps from deletions
      const siblings = (state.data.vision_affirmations || []).filter(a => String(a.vision_id) === String(visionId));
      const maxOrder = siblings.reduce((max, a) => Math.max(max, Number(a.order) || 0), 0);
      payload.order = maxOrder + 1;
      payload.created_at = new Date().toISOString();
      await apiCall('create', 'vision_affirmations', payload);
    }

    document.getElementById('affirmationCreatorModal')?.remove();
    await refreshData('vision_affirmations');

    // Refresh detail view if open
    const affList = document.getElementById('visionAffirmationsList');
    if (affList) affList.innerHTML = renderAffirmationsList(visionId);

    showToast('Affirmation saved! ✨');
  } catch (err) {
    console.error('Save affirmation error:', err);
    showToast('Failed to save affirmation', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = affId ? 'Update' : 'Add to Goal'; }
  }
};

window.deleteAffirmation = async function(affId) {
  if (!confirm('Remove this affirmation?')) return;

  const aff = state.data.vision_affirmations.find(a => String(a.id) === String(affId));
  const vId = aff?.vision_id;

  try {
    showToast('Deleting...');
    await apiCall('delete', 'vision_affirmations', {}, affId);
    await refreshData('vision_affirmations');

    if (vId) {
      const affList = document.getElementById('visionAffirmationsList');
      if (affList) affList.innerHTML = renderAffirmationsList(vId);
    }
    showToast('Removed');
  } catch (err) {
    console.error('Delete affirmation error:', err);
    showToast('Failed to delete affirmation', 'error');
  }
};



/* ═══════════════════════════════════════════════════════════════
   IMMERSIVE MANIFESTATION RITUAL SYSTEM v2
   Psychology-backed affirmation engine with:
   - Canvas particle system
   - Animated gradient mesh backgrounds
   - Guided breathing visualization (4-4-4)
   - Binaural beats + ambient texture + harmonic progression
   - Haptic feedback
   - Tap-to-advance / swipe gestures
   - Favorite during ritual
   - Post-ritual reflection & streak tracking
   ═══════════════════════════════════════════════════════════════ */

/* ─── PARTICLE SYSTEM ─────────────────────────────────────────── */
window.RitualParticleSystem = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,
  width: 0,
  height: 0,
  time: 0,
  theme: 'dawn',

  palettes: {
    dawn:  ['#FFD700', '#FF6B6B', '#FF9A3C', '#FFF5E1', '#FFB347'],
    ocean: ['#00D4FF', '#0083B0', '#6DD5ED', '#B8E8FC', '#4FC3F7'],
    deep:  ['#7B68EE', '#9370DB', '#B8A9E8', '#DCD0FF', '#6C5CE7']
  },

  init(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ritual-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  },

  setTheme(theme) {
    this.theme = (theme || 'dawn').toLowerCase();
  },

  spawn(count = 50) {
    const colors = this.palettes[this.theme] || this.palettes.dawn;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.005 + Math.random() * 0.015
      });
    }
  },

  burst(x, y, count = 20) {
    const colors = this.palettes[this.theme] || this.palettes.dawn;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: 0,
        twinkleSpeed: 0,
        life: 1,
        decay: 0.008 + Math.random() * 0.01
      });
    }
  },

  update() {
    this.time++;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Burst particles fade and die
      if (p.life !== undefined) {
        p.life -= p.decay;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      }

      // Wrap edges for ambient particles
      if (p.life === undefined) {
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;
        if (p.y < -10) p.y = this.height + 10;
        if (p.y > this.height + 10) p.y = -10;
      }
    }
  },

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const p of this.particles) {
      const alpha = p.life !== undefined
        ? p.life
        : 0.3 + 0.4 * Math.sin(this.time * p.twinkleSpeed + p.phase);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, alpha);
      this.ctx.fill();

      // Glow for larger particles
      if (p.radius > 1.5 && alpha > 0.4) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = alpha * 0.1;
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
  },

  start() {
    const loop = () => {
      this.update();
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  },

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.particles = [];
    this.time = 0;
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.ctx = null;
  }
};

/* ─── AUDIO ENGINE v3 — Cinematic Soundscape ─────────────────── *
 *  Architecture:
 *    Master Gain → Convolution Reverb (IR generated procedurally)
 *    ├─ Binaural pad    — detuned stereo sines, very subtle
 *    ├─ Harmonic drone  — 4-voice pad (root, 5th, octave, 9th) through waveshaper warmth
 *    ├─ Ambient bed     — filtered noise with dual-LFO for ocean-wash movement
 *    └─ One-shot FX     — singing bowl (convolved), soft chords, breath cue
 *  All gains are conservative (0.01-0.06) so nothing competes.
 *  Every transition uses setTargetAtTime for click-free parameter changes.
 * ─────────────────────────────────────────────────────────────── */
window.RitualAudioEngine = {
  ctx: null, masterGain: null, gain: null, reverb: null, dryGain: null, wetGain: null,
  binaural: { left: null, right: null, gain: null, freq: 200, beat: 6 },
  drone: { oscs: [], gain: null, lfo: null, warmth: null },
  ambient: { source: null, filters: [], lfo1: null, lfo2: null, gain: null },
  _allNodes: [],

  /* ── Helpers ──────────────────────────────────────────────── */
  _track(node) { this._allNodes.push(node); return node; },

  _createReverb() {
    // Procedural impulse response — simulates a large cathedral space
    const sr = this.ctx.sampleRate;
    const len = sr * 3; // 3 second tail
    const ir = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // Exponential decay with early reflections
        const t = i / sr;
        const decay = Math.exp(-3.5 * t); // -3.5 gives ~3s RT60
        const earlyRef = (i < sr * 0.08) ? 0.4 : 1.0;
        d[i] = (Math.random() * 2 - 1) * decay * earlyRef;
      }
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  },

  _createWarmth() {
    // Subtle waveshaper for analog warmth — soft saturation curve
    const shaper = this.ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 1.2); // Gentle soft-clip
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
  },

  _themeConfig(theme) {
    const t = (theme || 'dawn').toLowerCase();
    return {
      dawn:  { base: 136, // C#3 — warm, grounding
               chord: [1, 1.5, 2, 2.25],   // root, 5th, octave, maj9
               ambFilter: 'bandpass', ambFreq: 600, ambQ: 0.6,
               ambLfo1Rate: 0.03, ambLfo2Rate: 0.07, ambLfoDepth: 150 },
      ocean: { base: 110, // A2 — deep, flowing
               chord: [1, 1.335, 2, 3],     // root, min3, octave, 12th (minor, melancholic)
               ambFilter: 'lowpass', ambFreq: 350, ambQ: 0.8,
               ambLfo1Rate: 0.02, ambLfo2Rate: 0.11, ambLfoDepth: 100 },
      deep:  { base: 73.4, // D2 — sub-bass, cosmic
               chord: [1, 1.498, 2, 2.67],  // root, 5th, octave, add5+oct
               ambFilter: 'bandpass', ambFreq: 1800, ambQ: 0.3,
               ambLfo1Rate: 0.015, ambLfo2Rate: 0.05, ambLfoDepth: 400 }
    }[t] || arguments.callee.call(this, 'dawn'); // shouldn't happen
  },

  /* ── Init / Start / Stop ─────────────────────────────────── */
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master chain: dry + wet(reverb) → master compressor → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    this.reverb = this._createReverb();
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.7;
    this.wetGain.gain.value = 0.3;

    // Limiter — prevents any clipping
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    // Routing: masterGain → [dry + reverb→wet] → compressor → destination
    this.gain = this.masterGain; // alias for external API compatibility
    this.masterGain.connect(this.dryGain).connect(compressor);
    this.masterGain.connect(this.reverb).connect(this.wetGain).connect(compressor);
    compressor.connect(this.ctx.destination);
  },

  start(theme = 'dawn') {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();

    const isMuted = localStorage.getItem('ritualAudioMuted') === 'true';
    const now = this.ctx.currentTime;
    // Fade in from silence over 3s
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : 0.55, now + 3);

    this._setupBinaural();
    this._setupDrone(theme);
    this._setupAmbient(theme);
  },

  _setupBinaural() {
    const now = this.ctx.currentTime;
    this.binaural.gain = this._track(this.ctx.createGain());
    this.binaural.gain.gain.value = 0.20; // Research: binaural beats should be subtle but perceptible (0.15-0.25)
    this.binaural.gain.connect(this.masterGain);

    this.binaural.left = this._track(this.ctx.createOscillator());
    this.binaural.right = this._track(this.ctx.createOscillator());
    const lp = this.ctx.createStereoPanner();
    const rp = this.ctx.createStereoPanner();
    this.binaural.left.type = 'sine';
    this.binaural.right.type = 'sine';
    this.binaural.left.frequency.value = this.binaural.freq;
    this.binaural.right.frequency.value = this.binaural.freq + this.binaural.beat;
    lp.pan.value = -1;
    rp.pan.value = 1;
    this.binaural.left.connect(lp).connect(this.binaural.gain);
    this.binaural.right.connect(rp).connect(this.binaural.gain);
    this.binaural.left.start();
    this.binaural.right.start();
  },

  _setupDrone(theme) {
    const cfg = this._themeConfig(theme);
    const now = this.ctx.currentTime;

    // Warmth shaper
    this.drone.warmth = this._createWarmth();

    // Drone bus: oscs → warmth → gain → master
    this.drone.gain = this._track(this.ctx.createGain());
    this.drone.gain.gain.value = 0;
    this.drone.warmth.connect(this.drone.gain);
    this.drone.gain.connect(this.masterGain);

    // Fade in drone slowly over 4s (0.12 — subtle bed, shouldn't be individually noticeable)
    this.drone.gain.gain.linearRampToValueAtTime(0.12, now + 4);

    // 4-voice pad with slight detuning for lushness
    this.drone.oscs = cfg.chord.map((ratio, i) => {
      const osc = this._track(this.ctx.createOscillator());
      osc.type = 'sine';
      osc.frequency.value = cfg.base * ratio;
      // Slight detune for chorus/shimmer effect — ±3 cents per voice
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * (2 + i);
      const voiceGain = this.ctx.createGain();
      // Higher harmonics are quieter
      voiceGain.gain.value = 0.5 / (1 + i * 0.5);
      osc.connect(voiceGain).connect(this.drone.warmth);
      osc.start();
      return osc;
    });

    // Slow LFO on drone volume for organic breathing feel
    this.drone.lfo = this._track(this.ctx.createOscillator());
    this.drone.lfo.frequency.value = 0.08; // One breath every ~12s
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.012;
    this.drone.lfo.connect(lfoDepth).connect(this.drone.gain.gain);
    this.drone.lfo.start();
  },

  _setupAmbient(theme) {
    const cfg = this._themeConfig(theme);
    const sr = this.ctx.sampleRate;

    // Generate 4 seconds of noise for richer looping
    const bufLen = sr * 4;
    const buf = this.ctx.createBuffer(2, bufLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      // Brownian (red) noise — much smoother than white noise
      let last = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + (0.02 * white)) / 1.02; // Integrate for brown noise
        d[i] = last * 3.5; // Normalize
      }
    }

    this.ambient.source = this._track(this.ctx.createBufferSource());
    this.ambient.source.buffer = buf;
    this.ambient.source.loop = true;

    // Dual filter chain for richer shaping
    const f1 = this.ctx.createBiquadFilter();
    f1.type = cfg.ambFilter;
    f1.frequency.value = cfg.ambFreq;
    f1.Q.value = cfg.ambQ;

    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = cfg.ambFreq * 3;
    f2.Q.value = 0.3;
    this.ambient.filters = [f1, f2];

    this.ambient.gain = this._track(this.ctx.createGain());
    this.ambient.gain.gain.value = 0.30; // Research: ambient 25-35% of voice volume for meditation
    this.ambient.gain.connect(this.masterGain);

    // Dual LFO — one slow sweep, one faster shimmer — creates organic movement
    this.ambient.lfo1 = this._track(this.ctx.createOscillator());
    this.ambient.lfo1.frequency.value = cfg.ambLfo1Rate;
    const lfo1G = this.ctx.createGain();
    lfo1G.gain.value = cfg.ambLfoDepth;
    this.ambient.lfo1.connect(lfo1G).connect(f1.frequency);

    this.ambient.lfo2 = this._track(this.ctx.createOscillator());
    this.ambient.lfo2.frequency.value = cfg.ambLfo2Rate;
    const lfo2G = this.ctx.createGain();
    lfo2G.gain.value = cfg.ambLfoDepth * 0.3;
    this.ambient.lfo2.connect(lfo2G).connect(f1.frequency);

    this.ambient.source.connect(f1).connect(f2).connect(this.ambient.gain);
    this.ambient.source.start();
    this.ambient.lfo1.start();
    this.ambient.lfo2.start();
  },

  /* ── Transitions ─────────────────────────────────────────── */
  transition(beatFreq, theme, duration = 6) {
    if (!this.ctx || !this.binaural.right) return;
    const now = this.ctx.currentTime;
    const tau = duration / 3; // Time constant — reaches ~95% in 3τ

    // Binaural: smooth frequency glide
    this.binaural.right.frequency.cancelScheduledValues(now);
    this.binaural.right.frequency.setTargetAtTime(this.binaural.freq + beatFreq, now, tau);

    // Drone: morph chord voicing smoothly
    if (theme && this.drone.oscs.length) {
      const cfg = this._themeConfig(theme);
      this.drone.oscs.forEach((osc, i) => {
        if (cfg.chord[i] !== undefined) {
          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setTargetAtTime(cfg.base * cfg.chord[i], now, tau);
        }
      });
    }

    // Ambient: morph filter character
    if (theme && this.ambient.filters.length) {
      const cfg = this._themeConfig(theme);
      const f = this.ambient.filters[0];
      f.frequency.cancelScheduledValues(now);
      f.frequency.setTargetAtTime(cfg.ambFreq, now, tau);
      f.Q.cancelScheduledValues(now);
      f.Q.setTargetAtTime(cfg.ambQ, now, tau);
    }
  },

  /* ── One-shot FX ─────────────────────────────────────────── */
  playChime() {
    // Tibetan singing bowl — multiple detuned partials through reverb
    if (!this.ctx || localStorage.getItem('ritualAudioMuted') === 'true') return;
    const now = this.ctx.currentTime;
    const base = 396;

    // Bowl partials: not pure harmonics — slightly inharmonic like real metal
    const partials = [
      { ratio: 1.0,    amp: 0.020, decay: 4.0 },
      { ratio: 2.71,   amp: 0.012, decay: 3.2 },  // Characteristic bowl partial
      { ratio: 4.95,   amp: 0.006, decay: 2.4 },
    ];

    // Dedicated reverb send for the bowl — wetter than master
    const bowlBus = this.ctx.createGain();
    bowlBus.gain.value = 1.0;
    bowlBus.connect(this.masterGain);

    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * p.ratio, now);
      // Gentle pitch wobble — like a real bowl ringing
      osc.frequency.setTargetAtTime(base * p.ratio * 0.999, now + 0.5, 2);
      g.gain.setValueAtTime(0, now);
      // Slow swell attack (0.6s) — no click
      g.gain.linearRampToValueAtTime(p.amp, now + 0.6);
      // Long exponential decay
      g.gain.setTargetAtTime(0.0001, now + 0.6, p.decay / 4);
      osc.connect(g).connect(bowlBus);
      osc.start(now);
      osc.stop(now + p.decay + 1);
    });
  },

  playSoftTone() {
    // Ethereal pad chord — two notes fading in and out like a breath
    if (!this.ctx || localStorage.getItem('ritualAudioMuted') === 'true') return;
    const now = this.ctx.currentTime;
    const dur = 3.0;

    const notes = [264, 396]; // C4 + G4 — perfect fifth, very consonant
    const bus = this.ctx.createGain();
    bus.gain.value = 1.0;
    bus.connect(this.masterGain);

    notes.forEach((freq, i) => {
      // Two slightly detuned oscillators per note for chorus width
      [-3, 3].forEach(detune => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        g.gain.setValueAtTime(0, now);
        // Swell in over 1s, hold briefly, fade out
        g.gain.linearRampToValueAtTime(0.008, now + 1.0);
        g.gain.setValueAtTime(0.008, now + 1.2);
        g.gain.setTargetAtTime(0.0001, now + 1.2, (dur - 1.2) / 4);
        osc.connect(g).connect(bus);
        osc.start(now);
        osc.stop(now + dur + 0.5);
      });
    });
  },

  playBreathCue(phase) {
    // Subtle tonal cue for breathing — rising for inhale, falling for exhale
    if (!this.ctx || localStorage.getItem('ritualAudioMuted') === 'true') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (phase === 'inhale') {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setTargetAtTime(330, now, 1.5);
    } else if (phase === 'exhale') {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setTargetAtTime(220, now, 1.5);
    } else {
      osc.frequency.setValueAtTime(275, now); // Hold — middle note
    }
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.006, now + 0.5);
    g.gain.setTargetAtTime(0.0001, now + 0.5, 1.0);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 3);
  },

  playCompletion() {
    // Ascending arpeggio — C-E-G-C (major triad + octave) signaling accomplishment
    if (!this.ctx || localStorage.getItem('ritualAudioMuted') === 'true') return;
    const now = this.ctx.currentTime;
    const notes = [264, 330, 396, 528]; // C4, E4, G4, C5
    const bus = this.ctx.createGain();
    bus.gain.value = 1.0;
    bus.connect(this.masterGain);

    notes.forEach((freq, i) => {
      const delay = i * 0.4;
      [-2, 2].forEach(detune => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        g.gain.setValueAtTime(0, now + delay);
        g.gain.linearRampToValueAtTime(0.012, now + delay + 0.3);
        g.gain.setTargetAtTime(0.0001, now + delay + 0.3, 1.2);
        osc.connect(g).connect(bus);
        osc.start(now + delay);
        osc.stop(now + delay + 4);
      });
    });
  },

  /* ── Lifecycle ───────────────────────────────────────────── */
  fadeOut(duration = 3) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + duration);
  },

  stop() {
    this._allNodes.forEach(node => {
      if (node) { try { node.stop(); } catch(e){} try { node.disconnect(); } catch(e){} }
    });
    this._allNodes = [];
    this.binaural.left = this.binaural.right = null;
    this.drone.oscs = [];
    this.drone.lfo = null;
    this.ambient.source = this.ambient.lfo1 = this.ambient.lfo2 = null;
    this.ambient.filters = [];
  },

  setMute(isMuted) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.55, this.ctx.currentTime, 0.3);
    }
  }
};

/* ─── HAPTIC FEEDBACK ─────────────────────────────────────────── */
function ritualHaptic(pattern) {
  if (!navigator.vibrate) return;
  const patterns = {
    transition: [10, 30, 10],
    chime: [10],
    breatheIn: [10, 20, 10, 20, 10],
    complete: [50, 30, 50, 30, 100]
  };
  try { navigator.vibrate(patterns[pattern] || [15]); } catch(e){}
}

/* ─── ENHANCED TEXT RENDERING ─────────────────────────────────── */
function renderEnhancedKineticText(text) {
  if (!text) return '';
  // Process *emphasis* markers, then split into words
  const processed = text.replace(/\*(.*?)\*/g, '⸨$1⸩'); // temp markers
  return processed.split(' ').map((word, i) => {
    const isEmphasis = word.includes('⸨');
    const clean = word.replace(/[⸨⸩]/g, '');
    const cls = isEmphasis ? 'ritual-word ritual-word-emphasis' : 'ritual-word';
    return `<span class="${cls}" style="animation-delay: ${i * 0.15}s">${escH(clean)}</span>`;
  }).join(' ');
}

// Legacy fallback
function renderKineticText(text) {
  return text.split(' ').map((word, i) =>
    `<span class="kinetic-text" style="animation-delay: ${i * 0.1}s">${escH(word)}</span>`
  ).join(' ');
}

/* ─── BREATHING CYCLE ─────────────────────────────────────────── */
async function runBreathingCycle(cycles = 3) {
  const guide = document.getElementById('breathingGuide');
  const label = document.getElementById('breathLabel');
  const timer = document.getElementById('breathTimer');
  if (!guide || !label || !timer) return;

  guide.classList.add('visible');
  await sleep(500);

  for (let c = 0; c < cycles; c++) {
    if (!document.getElementById('manifestationRitual')) return;

    // Inhale (4s) — voice OR breath cue, never both (prevents overlap)
    guide.className = 'breathing-guide visible inhale';
    label.textContent = 'Inhale';
    ritualHaptic('breatheIn');
    if (window._ritualEyesClosed) {
      await speakGuidePhrase('Breathe in', 0.68, 'guide');
    } else {
      RitualAudioEngine.playBreathCue('inhale');
    }
    for (let t = 4; t >= 1; t--) {
      timer.textContent = t;
      await sleep(1000);
      if (!document.getElementById('manifestationRitual')) return;
    }

    // Hold (4s)
    guide.className = 'breathing-guide visible hold';
    label.textContent = 'Hold';
    if (window._ritualEyesClosed) {
      await speakGuidePhrase('Hold', 0.65, 'guide');
    } else {
      RitualAudioEngine.playBreathCue('hold');
    }
    for (let t = 4; t >= 1; t--) {
      timer.textContent = t;
      await sleep(1000);
      if (!document.getElementById('manifestationRitual')) return;
    }

    // Exhale (4s)
    guide.className = 'breathing-guide visible exhale';
    label.textContent = 'Exhale';
    if (window._ritualEyesClosed) {
      await speakGuidePhrase('Breathe out', 0.65, 'guide');
    } else {
      RitualAudioEngine.playBreathCue('exhale');
    }
    for (let t = 4; t >= 1; t--) {
      timer.textContent = t;
      await sleep(1000);
      if (!document.getElementById('manifestationRitual')) return;
    }
  }

  // Fade out breathing guide
  guide.classList.remove('visible');
  await sleep(1500);
}

/* ─── STREAK & TRACKING ───────────────────────────────────────── */
function updateRitualStreak() {
  const today = new Date().toISOString().split('T')[0];
  const stored = JSON.parse(localStorage.getItem('ritualStreak') || '{"count":0,"lastDate":""}');
  if (stored.lastDate === today) return stored.count;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  stored.count = (stored.lastDate === yesterday) ? stored.count + 1 : 1;
  stored.lastDate = today;
  localStorage.setItem('ritualStreak', JSON.stringify(stored));
  return stored.count;
}

/* ─── POST-RITUAL REFLECTION ──────────────────────────────────── */
function showPostRitualReflection(affCount, startTime) {
  const streak = updateRitualStreak();
  const duration = Math.round((Date.now() - startTime) / 1000);

  const overlay = document.createElement('div');
  overlay.className = 'ritual-reflection-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) dismissReflection(overlay); };

  const milestones = [7, 14, 30, 60, 100, 365];
  const isMilestone = milestones.includes(streak);

  overlay.innerHTML = `
    <div class="ritual-reflection-sheet">
      <div style="font-size:36px; margin-bottom:12px;">${isMilestone ? '🏆' : '✨'}</div>
      <div class="ritual-reflection-title">Ritual Complete</div>
      <div class="ritual-reflection-subtitle">${affCount} affirmation${affCount > 1 ? 's' : ''} manifested</div>

      <div class="ritual-streak-display">🔥 ${streak} day streak</div>

      <div style="font-size:14px; font-weight:600; margin-bottom:14px; color:var(--text-2, rgba(255,255,255,0.7));">How do you feel?</div>
      <div class="ritual-mood-row">
        ${['😔','😐','🙂','😊','🤩'].map((emoji, i) => `
          <button class="ritual-mood-btn" onclick="selectRitualMood(this, ${i + 1}, ${duration}, ${affCount})">${emoji}</button>
        `).join('')}
      </div>

      <button class="ritual-done-btn" onclick="this.closest('.ritual-reflection-overlay').remove()">Done</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  if (isMilestone && typeof triggerConfetti === 'function') {
    setTimeout(() => triggerConfetti(2000), 500);
  }
}

window.selectRitualMood = async function(btn, mood, duration, affCount) {
  btn.closest('.ritual-mood-row').querySelectorAll('.ritual-mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  ritualHaptic('chime');

  try {
    await apiCall('create', 'ritual_logs', {
      date: new Date().toISOString().split('T')[0],
      duration_seconds: duration,
      affirmation_count: affCount,
      mood_after: mood,
      completed: 'true'
    });
  } catch(e) { console.warn('Failed to save ritual log', e); }
};

function dismissReflection(overlay) {
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 500);
}

/* ─── FAVORITE DURING RITUAL ──────────────────────────────────── */
window.toggleRitualFavorite = async function() {
  const aff = window._ritualCurrentAff;
  if (!aff) return;

  const isFav = aff.is_favorite === 'true' || aff.is_favorite === true;
  const newVal = !isFav;

  const btn = document.getElementById('ritualFavBtn');
  if (btn) {
    btn.classList.toggle('active', newVal);
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 500);
    btn.querySelector('span').textContent = newVal ? '♥' : '♡';
  }
  ritualHaptic('chime');

  // Update in-memory
  aff.is_favorite = newVal ? 'true' : 'false';

  try {
    await apiCall('update', 'vision_affirmations', {
      is_favorite: String(newVal),
      favorite_at: newVal ? new Date().toISOString() : ''
    }, aff.id);
  } catch(e) { console.warn('Failed to save favorite', e); }
};

/* ─── GESTURE HANDLING ────────────────────────────────────────── */
function setupRitualGestures(overlay) {
  let startY = 0;
  overlay.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', (e) => {
    const delta = startY - e.changedTouches[0].clientY;
    if (delta > 80 && window._ritualAdvanceResolve) {
      window._ritualAdvanceResolve(); // swipe up = advance
    } else if (delta < -80) {
      window._ritualRepeat = true;
      if (window._ritualAdvanceResolve) window._ritualAdvanceResolve();
    }
  }, { passive: true });

  // Tap to advance
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.ritual-close, .ritual-audio-toggle, .ritual-favorite-btn')) return;
    if (window._ritualAdvanceResolve) window._ritualAdvanceResolve();
  });
}

/* ─── AFFIRMATION MANAGER MODAL ────────────────────────────────── */
window.openAffirmationManager = function() {
  const allAffs = (state.data.vision_affirmations || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (allAffs.length === 0) {
    showToast('No affirmations yet. Add affirmations to your goals first.', 'info');
    return;
  }

  // Group by goal
  const goals = state.data.visions || [];
  const goalMap = {};
  goals.forEach(g => { goalMap[g.id] = g.title || 'Untitled Goal'; });

  const modal = document.createElement('div');
  modal.id = 'affManagerModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10010;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;';

  const buildList = () => {
    const sorted = (state.data.vision_affirmations || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    return sorted.map((a, idx) => {
      const dur = parseInt(a.duration) || 8;
      const goalName = escH(goalMap[a.vision_id] || 'Unknown');
      return `
        <div class="aff-mgr-item" data-id="${a.id}" data-idx="${idx}">
          <div class="aff-mgr-handle" title="Drag to reorder">
            ${renderIcon('drag', null, 'style="width:16px;color:var(--text-muted)"')}
          </div>
          <div class="aff-mgr-content">
            <div class="aff-mgr-text">${escH(a.text)}</div>
            <div class="aff-mgr-goal">${goalName}</div>
          </div>
          <button class="aff-voice-play-btn" data-aff-id="${a.id}" onclick="event.stopPropagation(); previewAffVoice('${a.id}')" title="Preview voice" style="display:none;">▶</button>
          <button class="aff-voice-gen-btn" data-aff-id="${a.id}" onclick="event.stopPropagation(); genSingleVoice('${a.id}', '${escH(a.text).replace(/'/g, "\\'")}')" title="Generate voice">🎙</button>
          <button class="aff-voice-del-btn" data-aff-id="${a.id}" onclick="event.stopPropagation(); deleteAffAudio('${a.id}')" title="Delete voice" style="display:none;">🗑</button>
          <span class="aff-voice-badge" data-aff-id="${a.id}"></span>
          <div class="aff-mgr-duration">
            <button class="aff-mgr-dur-btn" onclick="adjustAffDuration('${a.id}',-1)" title="Decrease">−</button>
            <span class="aff-mgr-dur-val" id="durVal_${a.id}">${dur}s</span>
            <button class="aff-mgr-dur-btn" onclick="adjustAffDuration('${a.id}',1)" title="Increase">+</button>
          </div>
        </div>`;
    }).join('');
  };

  modal.innerHTML = `
    <div class="aff-mgr-container">
      <div class="aff-mgr-header">
        <div style="font-size:18px;font-weight:700;color:var(--text-1);">Manage Affirmations</div>
        <button onclick="document.getElementById('affManagerModal')?.remove()" style="background:var(--surface-3);border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;color:var(--text-2);display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:0 4px;">Drag to reorder. Set display time per affirmation.</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="bulkVoiceBtn" class="aff-voice-bulk-btn" onclick="generateAllVoices()" style="flex:1;">🎙 Generate All</button>
        <button class="aff-voice-bulk-btn" onclick="downloadAllFromCloud()" style="flex:1;background:var(--info);color:white;" id="downloadCloudBtn">☁️ Download from Cloud</button>
        <button class="aff-voice-bulk-btn" onclick="deleteAllAffAudio()" style="flex:0 0 auto;background:var(--error);color:white;">🗑</button>
      </div>
      <div class="aff-mgr-list" id="affMgrList">
        ${buildList()}
      </div>
      <button onclick="saveAffirmationOrder()" class="aff-mgr-save">
        ${renderIcon('save', null, 'style="width:18px"')} Save Order
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modal.querySelector('.aff-mgr-container').style.transform = 'translateY(0) scale(1)';
  });

  // Setup drag-to-reorder via touch/pointer
  initAffManagerDrag();

  // Check voice status + auto-sync missing cloud audio
  updateVoiceStatusIndicators();
  _syncMissingCloudAudio().then(synced => {
    if (synced > 0) {
      showToast(`Synced ${synced} voice${synced > 1 ? 's' : ''} from cloud`, 'success');
      updateVoiceStatusIndicators(); // Refresh UI after sync
    }
  }).catch(() => {});
};

// Generate voice for a single affirmation (from manager button)
window.genSingleVoice = async function(affId, text) {
  const btn = document.querySelector(`.aff-voice-gen-btn[data-aff-id="${affId}"]`);
  if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }
  const ok = await generateGeminiAudio(text, affId);
  if (btn) { btn.innerHTML = ok ? '✅' : '🎙'; btn.disabled = false; }
  if (ok) {
    // Cache the new audio blob URL for instant playback
    try {
      const stored = await _VisionIDB.get('audio://' + affId);
      if (stored && stored.buffer) {
        if (window._affAudioCache[affId]) URL.revokeObjectURL(window._affAudioCache[affId]);
        const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
        window._affAudioCache[affId] = URL.createObjectURL(blob);
      }
    } catch(e) {}
    // Show play button
    const playBtn = document.querySelector(`.aff-voice-play-btn[data-aff-id="${affId}"]`);
    if (playBtn) playBtn.style.display = 'inline-flex';
    // Update badge
    const badge = document.querySelector(`.aff-voice-badge[data-aff-id="${affId}"]`);
    if (badge) { badge.textContent = '🔊'; badge.title = 'Voice generated'; }
    // Fire-and-forget upload to Google Drive for cross-device sync
    _uploadAudioToDrive(affId).catch(() => {});
  }
};

/* ─── Drag-to-Reorder ────────────────────────────────────────── */
function initAffManagerDrag() {
  const list = document.getElementById('affMgrList');
  if (!list) return;
  let dragItem = null, dragClone = null, startY = 0, offsetY = 0;
  let items = [], placeholder = null;

  function getItems() { return [...list.querySelectorAll('.aff-mgr-item')]; }

  function onStart(e) {
    const handle = e.target.closest('.aff-mgr-handle');
    if (!handle) return;
    e.preventDefault();
    dragItem = handle.closest('.aff-mgr-item');
    if (!dragItem) return;
    items = getItems();
    const rect = dragItem.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startY = clientY;
    offsetY = clientY - rect.top;

    // Create clone for visual feedback
    dragClone = dragItem.cloneNode(true);
    dragClone.classList.add('aff-mgr-dragging');
    dragClone.style.width = rect.width + 'px';
    dragClone.style.top = rect.top + 'px';
    dragClone.style.left = rect.left + 'px';
    document.body.appendChild(dragClone);

    // Placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'aff-mgr-placeholder';
    placeholder.style.height = rect.height + 'px';
    dragItem.parentNode.insertBefore(placeholder, dragItem);
    dragItem.style.display = 'none';
  }

  function onMove(e) {
    if (!dragClone) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragClone.style.top = (clientY - offsetY) + 'px';

    // Find insertion point
    const currentItems = getItems().filter(el => el !== dragItem);
    let insertBefore = null;
    for (const item of currentItems) {
      const r = item.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { insertBefore = item; break; }
    }
    if (insertBefore) {
      list.insertBefore(placeholder, insertBefore);
    } else {
      list.appendChild(placeholder);
    }
  }

  function onEnd() {
    if (!dragClone) return;
    // Insert dragItem where placeholder is
    list.insertBefore(dragItem, placeholder);
    dragItem.style.display = '';
    placeholder.remove();
    dragClone.remove();
    dragClone = null;
    dragItem = null;
    placeholder = null;
  }

  list.addEventListener('mousedown', onStart);
  list.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

/* ─── Adjust per-affirmation duration ─────────────────────────── */
window.adjustAffDuration = function(affId, delta) {
  const aff = (state.data.vision_affirmations || []).find(a => String(a.id) === String(affId));
  if (!aff) return;
  let dur = parseInt(aff.duration) || 8;
  dur = Math.max(3, Math.min(30, dur + delta));
  aff.duration = dur;
  const el = document.getElementById('durVal_' + affId);
  if (el) el.textContent = dur + 's';
};

/* ─── Save reordered affirmations ─────────────────────────────── */
window.saveAffirmationOrder = async function() {
  const list = document.getElementById('affMgrList');
  if (!list) return;
  const items = list.querySelectorAll('.aff-mgr-item');
  const updates = [];
  items.forEach((el, i) => {
    const id = el.dataset.id;
    const aff = (state.data.vision_affirmations || []).find(a => String(a.id) === String(id));
    if (aff) {
      const newOrder = i + 1;
      const newDur = parseInt(aff.duration) || 8;
      if (aff.order !== newOrder || aff.duration !== newDur) {
        aff.order = newOrder;
        aff.duration = newDur;
        updates.push(aff);
      }
    }
  });

  // Save all changes to backend
  const btn = list.parentElement.querySelector('.aff-mgr-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    for (const aff of updates) {
      await apiCall('update', 'vision_affirmations', aff, aff.id);
    }
    showToast(`Order saved (${updates.length} updated)`, 'success');
    document.getElementById('affManagerModal')?.remove();
    renderVision();
  } catch (err) {
    showToast('Failed to save order: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Order'; }
  }
};

/* ─── MAIN RITUAL ENTRY (direct launch) ───────────────────────── */
window.startManifestationRitual = function(goalId) {
  let affirmations = (state.data.vision_affirmations || []);
  if (goalId) affirmations = affirmations.filter(a => String(a.vision_id) === String(goalId));
  if (affirmations.length === 0) {
    showToast('Add some affirmations first to start the ritual!', 'error');
    return;
  }

  const ritualAffs = [...affirmations].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Unlock iOS audio IMMEDIATELY in user tap callstack (required for iOS)
  unlockRitualAudio(ritualAffs);

  // Sync cloud audio BEFORE starting ritual — download missing voices first
  // Show a brief loading indicator so user knows what's happening
  const _syncToast = document.createElement('div');
  _syncToast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:16px 28px;border-radius:12px;z-index:100000;font-size:15px;text-align:center;';
  _syncToast.textContent = 'Loading voices...';
  document.body.appendChild(_syncToast);

  // Wait for sync + generate guide voices, then start ritual
  // Safety: hard cap at 60s so ritual ALWAYS launches even if something hangs
  let _ritualLaunched = false;
  const _launchOnce = () => {
    if (_ritualLaunched) return;
    _ritualLaunched = true;
    try { _syncToast.remove(); } catch(e) {}
    _launchRitualAfterSync(ritualAffs);
  };
  const _safetyTimer = setTimeout(_launchOnce, 60000);

  (async () => {
    // 1. Sync missing affirmation audio from cloud
    try {
      const synced = await _syncMissingCloudAudio();
      if (synced > 0) {
        for (const aff of ritualAffs) {
          if (!window._ritualAudioCache[aff.id]) {
            try {
              const stored = await _VisionIDB.get('audio://' + aff.id);
              if (stored && stored.buffer) {
                const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
                window._ritualAudioCache[aff.id] = URL.createObjectURL(blob);
              }
            } catch(e) {}
          }
        }
      }
    } catch(e) {}

    // 2. Pre-generate guide voice phrases (only generates missing ones, cached in IDB forever)
    try {
      await _preGenerateGuideVoices((msg) => { _syncToast.textContent = msg; });
    } catch(e) { console.warn('[Ritual] Guide voice generation failed:', e); }

    clearTimeout(_safetyTimer);
    _launchOnce();
  })();
};

// Separated ritual launch so it runs AFTER cloud audio sync completes
async function _launchRitualAfterSync(ritualAffs) {
  // Re-cache audio from IDB (cloud sync may have downloaded new files since unlockRitualAudio ran)
  for (const aff of ritualAffs) {
    if (!window._ritualAudioCache[aff.id]) {
      try {
        const stored = await _VisionIDB.get('audio://' + aff.id);
        if (stored && stored.buffer) {
          const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
          window._ritualAudioCache[aff.id] = URL.createObjectURL(blob);
        }
      } catch(e) {}
    }
  }
  console.log('[Ritual] Audio cache ready:', Object.keys(window._ritualAudioCache).length, 'of', ritualAffs.length, 'affirmations have AI voice');
  console.log('[Ritual] Guide voice cache:', Object.keys(window._ritualGuideCache).length, 'of', RITUAL_GUIDE_PHRASES.length, 'phrases');

  // Start background audio keepalive (prevents iOS from suspending JS when screen locks)
  startRitualKeepAlive();

  window._ritualAffs = ritualAffs;
  window._ritualSettings = {};
  window._ritualStartTime = Date.now();
  window._ritualAdvanceResolve = null;
  window._ritualRepeat = false;
  window._ritualCurrentAff = null;

  // Build overlay DOM
  const overlay = document.createElement('div');
  overlay.id = 'manifestationRitual';
  overlay.className = 'ritual-overlay';
  overlay.setAttribute('data-phase', 'ground');

  const dotsHtml = ritualAffs.map((_, i) => `<div class="ritual-progress-dot" data-dot="${i}"></div>`).join('');

  overlay.innerHTML = `
    <div class="ritual-mesh" id="ritualMesh" data-theme="dawn">
      <div class="ritual-mesh-blob"></div>
      <div class="ritual-mesh-blob"></div>
      <div class="ritual-mesh-blob"></div>
    </div>
    <div class="ritual-media-layer" id="ritualMediaLayer"></div>
    <button class="ritual-close" onclick="closeRitual()">✕</button>

    <div class="breathing-guide" id="breathingGuide">
      <div class="breathing-rings">
        <div class="breathing-ring breathing-ring-1"></div>
        <div class="breathing-ring breathing-ring-2"></div>
        <div class="breathing-ring breathing-ring-3"></div>
      </div>
      <div class="breathing-glow"></div>
      <div class="breathing-label" id="breathLabel">Breathe</div>
      <div class="breathing-timer" id="breathTimer">4</div>
    </div>

    <div class="ritual-content">
      <div id="ritualPrompt" class="ritual-prompt">Prepare for your manifestation...</div>
      <div id="ritualAffirmation" class="ritual-affirmation"></div>
    </div>

    <button class="ritual-favorite-btn" id="ritualFavBtn" onclick="toggleRitualFavorite()">
      <span>♡</span>
    </button>

    <div class="ritual-progress" id="ritualProgress">${dotsHtml}</div>

    <div class="ritual-controls-bar">
      <button id="ritualSkipBtn" class="ritual-control-btn ritual-skip-btn" onclick="skipGrounding()">
        ⏭ Skip to Affirmations
      </button>
      <button id="ritualAudioBtn" class="ritual-control-btn" onclick="toggleRitualAudio()">
        ${localStorage.getItem('ritualAudioMuted') === 'true' ? '🔇 Sound Off' : '🔊 Sound On'}
      </button>
      <button id="ritualEyesBtn" class="ritual-control-btn" onclick="toggleEyesClosed()">
        🧘 Eyes Closed
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Keep screen on
  window._ritualEyesClosed = false;
  acquireWakeLock();

  RitualParticleSystem.init(overlay);
  RitualParticleSystem.setTheme('dawn');
  RitualParticleSystem.spawn(50);
  RitualParticleSystem.start();

  setupRitualGestures(overlay);
  RitualAudioEngine.start('dawn');
  // Boost binaural beats to audible level (default 0.05 is inaudible)
  if (RitualAudioEngine.binaural?.gain) {
    RitualAudioEngine.binaural.gain.gain.setTargetAtTime(0.18, RitualAudioEngine.ctx.currentTime, 0.5);
  }

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    document.getElementById('ritualMesh').classList.add('visible');
  });

  runRitualSequence();
};

window.closeRitual = function() {
  window._ritualClosed = true;
  releaseWakeLock();
  stopRitualKeepAlive();
  stopSpeaking();
  cleanupRitualAudioCache();
  window._ritualEyesClosed = false;
  // Cleanup ritual media
  const mediaLayer = document.getElementById('ritualMediaLayer');
  if (mediaLayer) {
    const vid = mediaLayer.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
    mediaLayer.innerHTML = '';
  }
  const r = document.getElementById('manifestationRitual');
  if (r) {
    r.classList.add('fade-out');
    r.classList.remove('visible');
    RitualAudioEngine.fadeOut(1.5);
    setTimeout(() => {
      r.remove();
      RitualAudioEngine.stop();
      RitualParticleSystem.stop();
    }, 1600);
  } else {
    RitualAudioEngine.stop();
    RitualParticleSystem.stop();
  }
};

window.toggleRitualAudio = function() {
  const btn = document.getElementById('ritualAudioBtn');
  const isCurrentlyMuted = localStorage.getItem('ritualAudioMuted') === 'true';
  const newMuted = !isCurrentlyMuted;
  localStorage.setItem('ritualAudioMuted', newMuted);
  if (btn) btn.innerHTML = newMuted ? '🔇 Sound Off' : '🔊 Sound On';
  RitualAudioEngine.setMute(newMuted);
};

window.skipGrounding = function() {
  window._ritualSkipGrounding = true;
  const skipBtn = document.getElementById('ritualSkipBtn');
  if (skipBtn) {
    skipBtn.innerHTML = '⏭ Skipping...';
    skipBtn.disabled = true;
  }
};

/* ─── RITUAL SEQUENCE (3-Phase) ───────────────────────────────── */
async function runRitualSequence() {
  const overlay = document.getElementById('manifestationRitual');
  const prompt = document.getElementById('ritualPrompt');
  const affEl = document.getElementById('ritualAffirmation');
  const mesh = document.getElementById('ritualMesh');
  const progress = document.getElementById('ritualProgress');
  const favBtn = document.getElementById('ritualFavBtn');
  window._ritualClosed = false;

  const alive = () => !window._ritualClosed && document.getElementById('manifestationRitual');

  // Helper: wait for tap or timeout
  function waitForAdvance(ms) {
    return new Promise(resolve => {
      window._ritualAdvanceResolve = resolve;
      const timer = setTimeout(() => {
        window._ritualAdvanceResolve = null;
        resolve();
      }, ms);
      // If resolved early (tap/swipe), clear timer
      const origResolve = resolve;
      window._ritualAdvanceResolve = () => {
        clearTimeout(timer);
        window._ritualAdvanceResolve = null;
        origResolve();
      };
    });
  }

  // TTS helper — speaks text if eyes-closed mode is on, then waits
  async function sayIfEyesClosed(text, extraPauseMs = 500, mood = 'calm') {
    if (window._ritualEyesClosed) {
      await speakGuidePhrase(text, 0.78, mood);
      if (extraPauseMs > 0) await sleep(extraPauseMs);
    }
  }

  // ═══ PHASE 1: GROUNDING (skippable) ═══
  window._ritualSkipGrounding = false;
  overlay.setAttribute('data-phase', 'ground');

  // Show skip button during grounding
  const skipBtn = document.getElementById('ritualSkipBtn');

  // Helper: sleep that can be interrupted by skip
  function skippableSleep(ms) {
    return new Promise(resolve => {
      if (window._ritualSkipGrounding) { resolve(); return; }
      const timer = setTimeout(resolve, ms);
      const check = setInterval(() => {
        if (window._ritualSkipGrounding) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 100);
      // Clean up interval when timer fires naturally
      const origResolve = resolve;
      setTimeout(() => clearInterval(check), ms + 50);
    });
  }

  await skippableSleep(800);

  if (!window._ritualSkipGrounding) {
    // Show prompt
    prompt.classList.add('visible');
    RitualAudioEngine.playChime();
    ritualHaptic('chime');
    await sayIfEyesClosed('Prepare for your manifestation.');
    await skippableSleep(3000);
  }
  if (!alive()) return;

  if (!window._ritualSkipGrounding) {
    prompt.textContent = 'Take a deep breath...';
    await sayIfEyesClosed('Take a deep breath.');
    await skippableSleep(2000);
  }
  if (!alive()) return;

  if (!window._ritualSkipGrounding) {
    // Breathing cycles
    prompt.classList.remove('visible');
    await skippableSleep(500);
    const _rs = window._ritualSettings || {};
    const breathCycles = _rs.breathing !== undefined ? _rs.breathing : 3;
    if (breathCycles > 0 && !window._ritualSkipGrounding) await runBreathingCycle(breathCycles);
  }
  if (!alive()) return;

  if (!window._ritualSkipGrounding) {
    // Post-breathing affirmation setup
    prompt.textContent = 'Feel your intentions taking form...';
    prompt.classList.add('visible');
    RitualAudioEngine.playChime();
    await sayIfEyesClosed('Feel your intentions taking form.');
    await skippableSleep(3000);
    if (!alive()) return;
    prompt.classList.remove('visible');
    await skippableSleep(1000);
  } else {
    // Skipped — quick transition
    prompt.classList.remove('visible');
    const breathGuide = document.getElementById('breathingGuide');
    if (breathGuide) breathGuide.classList.remove('visible');
    stopSpeaking();
  }
  if (!alive()) return;

  // Hide skip button once we're past grounding
  if (skipBtn) skipBtn.style.display = 'none';

  // ═══ PHASE 2: AFFIRMATIONS ═══
  overlay.setAttribute('data-phase', 'affirm');
  RitualAudioEngine.transition(10, null, 5);
  progress.classList.add('visible');

  for (let i = 0; i < window._ritualAffs.length; i++) {
    if (!alive()) return;
    const aff = window._ritualAffs[i];
    const theme = (aff.bg_style || 'dawn').toLowerCase();
    window._ritualCurrentAff = aff;
    window._ritualRepeat = false;

    // Update visuals
    mesh.setAttribute('data-theme', theme);
    RitualParticleSystem.setTheme(theme);
    RitualAudioEngine.playSoftTone();
    RitualAudioEngine.transition(10, theme, 5);
    ritualHaptic('transition');

    // --- Show media background (affirmation-level → goal fallback) ---
    const mediaLayer = document.getElementById('ritualMediaLayer');
    if (mediaLayer) {
      let mediaRef = aff.media_key || '';
      // Fallback to parent goal's media
      if (!mediaRef) {
        const goal = (state.data.visions || state.data.vision_board || []).find(v => String(v.id) === String(aff.vision_id));
        if (goal) mediaRef = goal.video_url || goal.image_url || '';
      }
      if (mediaRef) {
        try {
          // For comma-separated videos, use first one
          const firstRef = mediaRef.split(',')[0].trim();
          const mediaUrl = await resolveMediaUrlAsync(firstRef);
          if (mediaUrl) {
            const isVideo = firstRef.includes('local://') && !firstRef.includes('local-img://');
            // Fade out current before swapping
            mediaLayer.classList.remove('visible');
            await sleep(300);
            // Pause any existing video
            const oldVid = mediaLayer.querySelector('video');
            if (oldVid) { oldVid.pause(); oldVid.src = ''; }
            if (isVideo) {
              mediaLayer.innerHTML = `<video src="${mediaUrl}" autoplay muted loop playsinline></video>`;
            } else {
              mediaLayer.innerHTML = `<img src="${mediaUrl}" alt="">`;
            }
            requestAnimationFrame(() => mediaLayer.classList.add('visible'));
          } else {
            mediaLayer.classList.remove('visible');
          }
        } catch (e) {
          console.warn('Ritual media error:', e);
          mediaLayer.classList.remove('visible');
        }
      } else {
        // No media — fade out
        mediaLayer.classList.remove('visible');
      }
    }

    // Update progress dots
    progress.querySelectorAll('.ritual-progress-dot').forEach((dot, di) => {
      dot.classList.toggle('active', di === i);
      dot.classList.toggle('done', di < i);
    });

    // Update favorite button
    const isFav = aff.is_favorite === 'true' || aff.is_favorite === true;
    favBtn.classList.toggle('active', isFav);
    favBtn.querySelector('span').textContent = isFav ? '♥' : '♡';
    favBtn.classList.add('visible');

    // Show affirmation with kinetic text
    affEl.innerHTML = renderEnhancedKineticText(aff.text);
    affEl.classList.add('active');

    // Particle burst at center
    RitualParticleSystem.burst(window.innerWidth / 2, window.innerHeight / 2, 15);

    // Eyes-closed: speak the affirmation naturally, then hold for contemplation
    if (window._ritualEyesClosed) {
      await sleep(1000); // gentle pause before speaking
      await speakAffirmation(aff.text, aff.id, 0.78, 'affirm'); // confident, present
      await sleep(2500); // silence for visualization after hearing it
      // Repeat once, slower and calmer, for deeper reinforcement
      await speakAffirmation(aff.text, aff.id, 0.70, 'calm');
      await sleep(2000);
    } else {
      // Wait — per-affirmation duration or default 8s
      const affDurMs = (parseInt(aff.duration) || 8) * 1000;
      await waitForAdvance(affDurMs);
    }
    if (!alive()) return;

    // Handle repeat (swipe down)
    if (window._ritualRepeat) {
      i--; // Will re-process this affirmation
      window._ritualRepeat = false;
      affEl.classList.remove('active');
      await sleep(500);
      continue;
    }

    // Fade out
    affEl.classList.remove('active');
    favBtn.classList.remove('visible');
    if (mediaLayer) mediaLayer.classList.remove('visible');
    await sleep(1500);
  }

  // Cleanup media layer after all affirmations
  const finalMediaLayer = document.getElementById('ritualMediaLayer');
  if (finalMediaLayer) {
    finalMediaLayer.classList.remove('visible');
    const vid = finalMediaLayer.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
    finalMediaLayer.innerHTML = '';
  }

  if (!alive()) return;

  // ═══ PHASE 3: CLOSING ═══
  overlay.setAttribute('data-phase', 'close');
  progress.classList.remove('visible');
  RitualAudioEngine.transition(12, 'deep', 3);
  mesh.setAttribute('data-theme', 'deep');

  prompt.textContent = 'Your vision is manifesting.';
  prompt.classList.add('visible');
  RitualAudioEngine.playSoftTone();
  await sayIfEyesClosed('Your vision is manifesting.', 800, 'calm');
  await sleep(4000);
  if (!alive()) return;

  prompt.textContent = 'Trust the process.';
  RitualAudioEngine.playCompletion();
  await sayIfEyesClosed('Trust the process.', 500, 'calm');
  await sleep(3000);
  if (!alive()) return;

  prompt.classList.remove('visible');
  ritualHaptic('complete');

  // Graceful close
  RitualAudioEngine.fadeOut(2);
  overlay.classList.add('fade-out');
  overlay.classList.remove('visible');

  await sleep(2000);
  const r = document.getElementById('manifestationRitual');
  if (r) r.remove();
  RitualAudioEngine.stop();
  RitualParticleSystem.stop();
  releaseWakeLock();
  stopRitualKeepAlive();
  stopSpeaking();
  window._ritualEyesClosed = false;

  // Show reflection
  showPostRitualReflection(window._ritualAffs.length, window._ritualStartTime);
}

// iOS-safe sleep — uses <audio> element as timer (survives lock screen)
// setTimeout is suspended by iOS when WKWebView enters background
function sleep(ms) {
  return new Promise(resolve => {
    // If ritual keepalive is active, use audio-based timer
    if (window._ritualKeepAlive) {
      const sr = 8000;
      const numSamples = Math.max(sr, Math.round(sr * ms / 1000));
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
      for (let i = 0; i < numSamples; i += 100) samples[i] = 129; // faint noise so iOS doesn't optimize away
      const blob = new Blob([header, samples], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.01;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => { URL.revokeObjectURL(url); setTimeout(resolve, ms); });
    } else {
      setTimeout(resolve, ms);
    }
  });
}

/* ─── WAKE LOCK (Screen-On) ──────────────────────────────────── */
window._ritualWakeLock = null;
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      window._ritualWakeLock = await navigator.wakeLock.request('screen');
      window._ritualWakeLock.addEventListener('release', () => { window._ritualWakeLock = null; });
    }
  } catch (e) { /* user denied or not supported */ }
}
function releaseWakeLock() {
  if (window._ritualWakeLock) {
    try { window._ritualWakeLock.release(); } catch(e) {}
    window._ritualWakeLock = null;
  }
}
// Re-acquire on visibility change (needed because OS releases on tab switch)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.getElementById('manifestationRitual') && !window._ritualEyesClosed) {
    acquireWakeLock();
  }
});

/* ─── EYES-CLOSED MODE (TTS + Background) ────────────────────── */
window._ritualEyesClosed = false;
window._ritualTTSVoice = null;
window._ritualTTSReady = false;

function pickBestVoice() {
  if (window._ritualTTSVoice) return window._ritualTTSVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Score each English voice — higher = more natural
  const scored = voices
    .filter(v => v.lang.startsWith('en'))
    .map(v => {
      let score = 0;
      const n = v.name.toLowerCase();
      // Neural / Enhanced / Premium voices (available on iOS 16+, macOS, newer Android)
      if (/neural|enhanced|premium|natural|hq/i.test(n)) score += 100;
      // Specific high-quality voices by name
      if (/samantha|zarvox|allison|ava|joana|karen|moira|tessa|fiona/i.test(n)) score += 50;
      if (/daniel|aaron|tom|oliver|james/i.test(n)) score += 45;
      // Google's newer voices are decent
      if (/google/i.test(n)) score += 30;
      // Microsoft neural voices (Edge/Windows)
      if (/microsoft.*online|microsoft.*neural/i.test(n)) score += 80;
      if (/jenny|aria|guy|ryan|sonia/i.test(n)) score += 60;
      // Non-local (cloud) voices tend to be better
      if (!v.localService) score += 20;
      // Penalize clearly robotic/legacy
      if (/espeak|festival|pico|mbrola|vocalizer/i.test(n)) score -= 50;
      return { voice: v, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length) {
    window._ritualTTSVoice = scored[0].voice;
    console.log('[Ritual TTS] Selected voice:', scored[0].voice.name, '(score:', scored[0].score + ')');
    return scored[0].voice;
  }
  return voices[0] || null;
}

// Pre-load voices
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {
    window._ritualTTSVoice = null; // re-evaluate
    pickBestVoice();
    window._ritualTTSReady = true;
  };
  // Some browsers populate immediately
  if (speechSynthesis.getVoices().length) {
    pickBestVoice();
    window._ritualTTSReady = true;
  }
}

/**
 * Speak text naturally by splitting into phrases with pauses between them.
 * This avoids the "robot reading a paragraph" effect.
 * @param {string} text - The text to speak
 * @param {number} rate - Speech rate (0.7-1.0 recommended for meditation)
 * @param {string} mood - 'calm' | 'affirm' | 'guide' — adjusts pitch/rate subtly
 */
function speakText(text, rate = 0.85, mood = 'calm') {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }

    // Clean markdown emphasis markers
    const clean = text.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

    // Split into natural phrases at punctuation and conjunctions
    const phrases = clean
      .split(/(?<=[.!?;:])\s+|(?<=[,])\s+(?=\w{4,})|(?:\s+—\s+)|(?:\s+-\s+)/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Mood-based tuning
    const moodConfig = {
      calm:   { pitch: 0.92, rateAdj: -0.05, pauseMs: 400 },
      affirm: { pitch: 1.0,  rateAdj: 0,     pauseMs: 300 },
      guide:  { pitch: 0.88, rateAdj: -0.08, pauseMs: 500 },
    }[mood] || { pitch: 0.92, rateAdj: 0, pauseMs: 350 };

    const voice = pickBestVoice();
    let idx = 0;

    function speakNext() {
      if (idx >= phrases.length) { resolve(); return; }
      const phrase = phrases[idx];
      idx++;

      const utt = new SpeechSynthesisUtterance(phrase);
      if (voice) utt.voice = voice;

      // Vary rate slightly per phrase for natural rhythm
      const phraseRate = rate + moodConfig.rateAdj + (Math.random() * 0.04 - 0.02);
      utt.rate = Math.max(0.5, Math.min(1.1, phraseRate));
      utt.pitch = moodConfig.pitch;
      utt.volume = 0.92;

      utt.onend = () => {
        // Natural pause between phrases — longer at sentence ends
        const isSentenceEnd = /[.!?]$/.test(phrase);
        const pause = isSentenceEnd ? moodConfig.pauseMs * 1.8 : moodConfig.pauseMs;
        if (idx < phrases.length) {
          setTimeout(speakNext, pause);
        } else {
          resolve();
        }
      };
      utt.onerror = () => {
        if (idx < phrases.length) setTimeout(speakNext, 200);
        else resolve();
      };
      speechSynthesis.speak(utt);
    }

    speakNext();
  });
}

// ═══ RITUAL GUIDE VOICE — AI-generated prompts (replaces robotic speechSynthesis) ═══
// Short phrases used during grounding/breathing/closing phases
const RITUAL_GUIDE_PHRASES = [
  'Breathe in',
  'Hold',
  'Breathe out',
  'Prepare for your manifestation.',
  'Take a deep breath.',
  'Feel your intentions taking form.',
  'Your vision is manifesting.',
  'Trust the process.',
  // Meditation-specific phrases
  'Welcome to your guided meditation.',
  'Close your eyes and settle into a comfortable position.',
  'Let go of any tension in your body.',
  'Now, let us affirm your intentions.',
  'Repeat this silently to yourself.',
  'Let this truth sink deep within you.',
  'Take a final deep breath.',
  'Carry these intentions with you. Namaste.'
];

const RITUAL_GUIDE_INSTRUCTION = `You are a meditation guide microphone. Your ONLY job: speak the EXACT words given to you. Do NOT add any words before or after. Do NOT say "okay" or "sure" or explain anything. Do NOT improvise or expand. Just speak the exact text in a calm, gentle, soft voice. Example: if given "Breathe in", say ONLY "Breathe in" — nothing else.`;

// Cache: IDB key → blob URL  (persisted in IDB, loaded to blob URLs at ritual start)
window._ritualGuideCache = {};  // { phrase: blobUrl }

// Generate all guide phrases via Gemini TTS (one WebSocket per phrase for reliability)
// Stores in IDB so only generated ONCE ever, then reused forever
const _GUIDE_VOICE_VERSION = 2; // bump this to force re-generation of all guide voices

async function _preGenerateGuideVoices(onProgress) {
  const apiKey = _getGeminiKey();
  if (!apiKey) { console.warn('[Guide Voice] No API key, will use fallback TTS'); return 0; }
  const voiceCfg = _getVoiceConfig();
  let generated = 0;

  // Check version — if outdated, clear all old guide voices
  const storedVer = parseInt(localStorage.getItem('_guideVoiceVer') || '0');
  if (storedVer < _GUIDE_VOICE_VERSION) {
    console.log('[Guide Voice] Version changed, clearing old cache');
    for (const phrase of RITUAL_GUIDE_PHRASES) {
      try { await _VisionIDB.del('guide-voice://' + phrase); } catch(e) {}
    }
    localStorage.setItem('_guideVoiceVer', String(_GUIDE_VOICE_VERSION));
  }

  // First pass: load already-cached from IDB, collect missing ones
  const toGenerate = [];
  for (const phrase of RITUAL_GUIDE_PHRASES) {
    const idbKey = 'guide-voice://' + phrase;
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

  if (toGenerate.length === 0) return 0;
  if (onProgress) onProgress(`Generating ${toGenerate.length} voice clips...`);

  // Generate ALL missing phrases in parallel (3 at a time for speed)
  const BATCH = 3;
  for (let i = 0; i < toGenerate.length; i += BATCH) {
    const batch = toGenerate.slice(i, i + BATCH);
    if (onProgress) onProgress(`Generating voices ${i + 1}-${Math.min(i + BATCH, toGenerate.length)}/${toGenerate.length}...`);
    await Promise.all(batch.map(async (phrase) => {
      const idbKey = 'guide-voice://' + phrase;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) console.log('[Guide Voice] Retry:', phrase);
          const wavBlob = await _generateGeminiGuideTTS(phrase, voiceCfg.voiceId, apiKey);
          const buf = await wavBlob.arrayBuffer();
          await _VisionIDB.put(idbKey, { type: 'audio/wav', buffer: buf });
          window._ritualGuideCache[phrase] = URL.createObjectURL(wavBlob);
          generated++;
          console.log('[Guide Voice] Generated:', phrase);
          return;
        } catch(e) {
          console.warn('[Guide Voice] Attempt', attempt + 1, 'failed for:', phrase, e.message);
        }
      }
    }));
  }
  return generated;
}

// Lighter TTS call for short guide phrases (reuses the same WebSocket pattern)
async function _generateGeminiGuideTTS(text, voiceName, apiKey) {
  return new Promise((resolve, reject) => {
    const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    let ws;
    let audioChunks = [];
    let setupDone = false;
    let timeoutId;

    try { ws = new WebSocket(WS_URL); } catch(e) { return reject(e); }

    timeoutId = setTimeout(() => {
      if (ws.readyState <= 1) ws.close();
      reject(new Error('Guide TTS timeout'));
    }, 30000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
          generationConfig: {
            temperature: 0.6,
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          },
          systemInstruction: { parts: [{ text: RITUAL_GUIDE_INSTRUCTION }] }
        }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) raw = await raw.text();
        const msg = JSON.parse(raw);

        if (msg.setupComplete) {
          setupDone = true;
          ws.send(JSON.stringify({
            clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
          }));
          return;
        }
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) audioChunks.push(part.inlineData.data);
          }
        }
        if (msg.serverContent?.turnComplete) {
          clearTimeout(timeoutId);
          ws.close();
          if (!audioChunks.length) return reject(new Error('No audio'));
          const allPcm = _concatBase64Chunks(audioChunks);
          audioChunks = null;
          resolve(_pcmBase64ToWavBlob(allPcm));
        }
      } catch(e) { /* parse error */ }
    };

    ws.onerror = () => { clearTimeout(timeoutId); reject(new Error('WS error')); };
    ws.onclose = (e) => { clearTimeout(timeoutId); if (!setupDone) reject(new Error('WS closed')); };
  });
}

// ── Audio playback — prefers <audio> element (survives iOS lock screen) ──
// AudioContext playback dies when iOS suspends the WKWebView on screen lock.
// <audio> elements with the keepalive running continue to fire onended events.
async function _playAudioViaContext(blobUrl, opts = {}) {
  const { volume = 0.92, playbackRate = 1.0, maxDuration = 0 } = opts;

  // Primary: Audio element — survives iOS background/lock screen
  return new Promise(resolve => {
    const audio = new Audio(blobUrl);
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    window._ritualCurrentAudio = audio;
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; window._ritualCurrentAudio = null; resolve(); } };
    audio.onended = done;
    audio.onerror = () => {
      // Fallback to AudioContext if Audio element fails
      console.warn('[Audio element] failed, trying AudioContext');
      const ctx = RitualAudioEngine.ctx;
      if (ctx) {
        (async () => {
          try {
            if (ctx.state === 'suspended') await ctx.resume();
            const resp = await fetch(blobUrl);
            const arrBuf = await resp.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrBuf);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.playbackRate.value = playbackRate;
            const gainNode = ctx.createGain();
            gainNode.gain.value = volume;
            source.connect(gainNode).connect(ctx.destination);
            source.onended = done;
            source.start();
            window._ritualCurrentSource = source;
          } catch(e2) { done(); }
        })();
      } else { done(); }
    };
    if (maxDuration > 0) setTimeout(() => { try { audio.pause(); } catch(e) {} done(); }, maxDuration);
    audio.play().catch(() => done());
  });
}

// Play a pre-generated guide phrase (AI voice), fallback to speakText if not available
async function speakGuidePhrase(phrase, rate, mood) {
  // Stop any currently playing guide/ritual audio first to prevent overlap
  if (window._ritualCurrentSource) {
    try { window._ritualCurrentSource.stop(); } catch(e) {}
    window._ritualCurrentSource = null;
  }
  if (window._ritualCurrentAudio) {
    try { window._ritualCurrentAudio.pause(); window._ritualCurrentAudio.currentTime = 0; } catch(e) {}
    window._ritualCurrentAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  const cachedUrl = window._ritualGuideCache[phrase];
  if (cachedUrl) {
    return _playAudioViaContext(cachedUrl, { volume: 0.92, playbackRate: 1.0, maxDuration: 5000 });
  }
  // Fallback to browser TTS
  return speakText(phrase, rate, mood);
}

// ═══ iOS BACKGROUND AUDIO KEEPALIVE ═══
// iOS suspends WKWebView JS when screen locks unless audio is actively playing.
// We play a silent audio loop to keep the runtime alive during manifestation.
window._ritualKeepAlive = null;

function startRitualKeepAlive() {
  if (window._ritualKeepAlive) return;
  try {
    // Generate 30 seconds of near-silence — longer keeps iOS from suspending
    const sampleRate = 8000;
    const duration = 30;
    const numSamples = sampleRate * duration;
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    _writeString(v, 0, 'RIFF');
    v.setUint32(4, 36 + numSamples, true);
    _writeString(v, 8, 'WAVE');
    _writeString(v, 12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    _writeString(v, 36, 'data');
    v.setUint32(40, numSamples, true);
    // Very faint noise (not pure silence — iOS optimizes pure silence away)
    const samples = new Uint8Array(numSamples);
    for (let i = 0; i < numSamples; i++) samples[i] = 128 + (i % 2 === 0 ? 1 : -1);
    const blob = new Blob([header, samples], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.05;
    audio.play().then(() => {
      console.log('[Ritual] Background keepalive audio started');
    }).catch(e => {
      console.warn('[Ritual] Keepalive audio failed:', e.message);
    });
    window._ritualKeepAlive = { audio, url };

    // Register MediaSession so iOS treats this as a real media app
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Manifestation Ritual',
        artist: 'PersonalOS',
        album: 'Daily Practice'
      });
      navigator.mediaSession.setActionHandler('play', () => { audio.play(); });
      navigator.mediaSession.setActionHandler('pause', () => { /* don't actually pause */ });
    }
  } catch(e) {
    console.warn('[Ritual] Keepalive setup failed:', e);
  }
}

function stopRitualKeepAlive() {
  if (window._ritualKeepAlive) {
    window._ritualKeepAlive.audio.pause();
    window._ritualKeepAlive.audio.src = '';
    URL.revokeObjectURL(window._ritualKeepAlive.url);
    window._ritualKeepAlive = null;
    console.log('[Ritual] Background keepalive stopped');
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
  }
}

// Pre-cached ritual audio blob URLs — loaded at ritual start
window._ritualAudioCache = {};  // { affId: blobUrl }

// Tiny silent WAV (44 bytes header + 2 bytes silence) for iOS audio unlock
const _SILENT_WAV = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQIAAAB/fw==';

// Call at ritual start (within user tap) to unlock iOS audio AND pre-cache all audio
async function unlockRitualAudio(affirmations) {
  // 1. Unlock iOS audio by playing a tiny silent WAV in the gesture handler
  try {
    const silentAudio = new Audio(_SILENT_WAV);
    silentAudio.volume = 0.01;
    await silentAudio.play();
    silentAudio.pause();
  } catch(e) {}

  // 2. Pre-load all affirmation audio from IDB into blob URLs
  window._ritualAudioCache = {};
  for (const aff of (affirmations || [])) {
    try {
      const stored = await _VisionIDB.get('audio://' + aff.id);
      if (stored && stored.buffer) {
        const blob = new Blob([stored.buffer], { type: stored.type || 'audio/wav' });
        window._ritualAudioCache[aff.id] = URL.createObjectURL(blob);
      }
    } catch(e) {}
  }
}

// Clean up ritual audio cache
function cleanupRitualAudioCache() {
  for (const id in window._ritualAudioCache) {
    URL.revokeObjectURL(window._ritualAudioCache[id]);
  }
  window._ritualAudioCache = {};
}

// Play pre-generated Gemini audio or fall back to browser TTS
async function speakAffirmation(text, affId, rate, mood) {
  // Use pre-cached blob URL (loaded at ritual start — no async IDB fetch needed)
  const cachedUrl = window._ritualAudioCache[affId];
  if (cachedUrl) {
    try {
      await _playAudioViaContext(cachedUrl, { volume: 0.92, playbackRate: rate > 0.9 ? 1.0 : 0.92 });
      return;
    } catch(e) {
      console.warn('[speakAffirmation] AudioContext failed, falling back to TTS', e.message);
    }
  }
  // Fallback to browser TTS (no pre-generated audio)
  return speakText(text, rate, mood);
}

function stopSpeaking() {
  if (window._ritualCurrentSource) {
    try { window._ritualCurrentSource.stop(); } catch(e) {}
    window._ritualCurrentSource = null;
  }
  if (window._ritualCurrentAudio) {
    try { window._ritualCurrentAudio.pause(); } catch(e) {}
    window._ritualCurrentAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

window.toggleEyesClosed = function() {
  window._ritualEyesClosed = !window._ritualEyesClosed;
  const overlay = document.getElementById('manifestationRitual');
  const btn = document.getElementById('ritualEyesBtn');
  if (!overlay || !btn) return;

  if (window._ritualEyesClosed) {
    // Enter eyes-closed mode
    overlay.classList.add('eyes-closed');
    btn.innerHTML = '👁 Eyes Open';
    btn.classList.add('active');
    // Release wake lock — user wants screen off
    releaseWakeLock();
    showToast('Eyes-closed mode — your affirmations will be spoken aloud. You can lock your screen.', 'info');
  } else {
    // Exit eyes-closed mode
    overlay.classList.remove('eyes-closed');
    btn.innerHTML = '🧘 Eyes Closed';
    btn.classList.remove('active');
    stopSpeaking();
    acquireWakeLock();
  }
};

/* ─── EVENT HANDLERS ─────────────────────────────────────────────  */
window.setVisionFilter = function (cat) {
  visionState.filter = cat;
  renderVision();
};

window.switchVisionView = function (view) {
  visionState.view = view;
  renderVision();
};

window.handleVisionSort = function (sortType) {
  visionState.sort = sortType;
  renderVision();
};

/* ─── HELPERS ───────────────────────────────────────────────────── */
function filterVisions(goals) {
  let filtered = [...goals];
  if (visionState.filter === 'focus') {
    filtered = filtered.filter(g => g.month_focus === true || g.month_focus === 'true' || g.month_focus === 'TRUE');
  } else if (visionState.filter !== 'all') {
    filtered = filtered.filter(g => g.category === visionState.filter);
  }
  if (visionState.search) {
    const q = visionState.search.toLowerCase();
    filtered = filtered.filter(g =>
      g.title.toLowerCase().includes(q) || (g.notes && g.notes.toLowerCase().includes(q))
    );
  }
  return filtered;
}

function sortVisions(goals) {
  const s = [...goals];
  switch (visionState.sort) {
    case 'newest': return s.reverse();
    case 'oldest': return s;
    case 'closest': return s.sort((a, b) => (!a.target_date ? 1 : !b.target_date ? -1 : new Date(a.target_date) - new Date(b.target_date)));
    case 'furthest': return s.sort((a, b) => (!a.target_date ? 1 : !b.target_date ? -1 : new Date(b.target_date) - new Date(a.target_date)));
    case 'az': return s.sort((a, b) => a.title.localeCompare(b.title));
    default: return s;
  }
}

function groupByYear(goals) {
  const grouped = {};
  goals.forEach(g => {
    const key = g.target_date ? new Date(g.target_date).getFullYear() : 'No Deadline';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(g);
  });
  return grouped;
}

function getCategoryEmoji(category) {
  const map = {
    Personality: 'star', Ouro: 'gem', Work: 'briefcase',
    Enjoyment: 'sparkles', Routine: 'repeat'
  };
  const iconName = map[category] || 'target';
  return renderIcon(iconName, null, 'class="v-cat-icon"');
}

function sanitizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // base64 blob - leave as-is
  return url.replace(/^http:\/\//i, 'https://');
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


function emptyState() {
  return `<div class="vision-empty">
          <span class="vision-empty-icon">${renderIcon('target', null, 'style="width:48px;height:48px;"')}</span>
          <div class="vision-empty-text">No goals found</div>
          <div class="vision-empty-sub">Try changing your filter or adding a new goal</div>
        </div>`;
}

function escH(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getDefaultImage(g) {
  const categoryImages = {
    Personality: [
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80'
    ],
    Ouro: [
      'https://images.unsplash.com/photo-1553729459-ead63e3c0ad4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1516567727245-ad8c68f3ec93?auto=format&fit=crop&w=600&q=80'
    ],
    Work: [
      'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'
    ],
    Enjoyment: [
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80'
    ],
    Routine: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
    ]
  };
  const defaults = [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  ];
  const images = categoryImages[g.category] || defaults;
  const hash = (g.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return images[hash % images.length];
}


function getFallbackImage(g) {
  return 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80';
}

// Legacy compat
window.openVisionImageSheet = window.openVisionModal;
window.playVisionVideo = window.openVideoModal;
window.stopVisionVideo = window.closeVideoModal;
window.sendUpcomingHabitSummary = window.sendUpcomingHabitSummary || function () { };

/* ── 10 Days Plan (TDP) Feature Implementation ────────────────────────── */
const VISION_TDP_CATEGORIES = ['Personality', 'Ouro', 'Work', 'Enjoyment', 'Routine'];

async function getActiveTDP() {
  const plans = state.data.vision_tdp || [];
  console.log('[TDP Debug] All plans:', plans);
  const active = plans.find(p => p.status === 'active');
  console.log('[TDP Debug] Active plan:', active);
  return active;
}

function calculateTDPProgress(plan) {
  if (!plan || !plan.categories_json) return { total: 0, completed: 0, percentage: 0 };
  let cats = {};
  try {
    cats = typeof plan.categories_json === 'string' ? JSON.parse(plan.categories_json) : plan.categories_json;
  } catch (e) { return { total: 0, completed: 0, percentage: 0 }; }

  let total = 0, completed = 0;
  Object.values(cats).forEach(items => {
    (items || []).forEach(item => {
      total++;
      if (item.completed) completed++;
    });
  });
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function getTDPDayInfo(plan) {
  if (!plan) return { day: 0, remaining: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(plan.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(plan.end_date);
  end.setHours(0, 0, 0, 0);

  const day = Math.floor((today - start) / 86400000) + 1;
  const remaining = Math.ceil((end - today) / 86400000);
  return { day: Math.max(0, day), remaining: Math.max(0, remaining) };
}

async function checkAndAutoRenewTDP() {
  const active = await getActiveTDP();
  if (!active) return;

  const info = getTDPDayInfo(active);
  if (info.remaining < 0 || (new Date() > new Date(active.end_date) && info.remaining === 0)) {
    // Archive expired plan
    active.status = 'archived';
    await apiPost('vision_tdp', active);
    showToast('Your 10 Days Plan has ended. Create a new one!');
    renderVision();
  }
}

async function openTDPModal(tab = 'current') {
  const active = await getActiveTDP();

  // Create Modal Overlay if not exists
  let overlay = document.getElementById('tdpModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'tdp-modal-overlay';
    overlay.id = 'tdpModalOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeTDPModal(); };
    document.body.appendChild(overlay);
  }

  renderTDPModalContent(active, tab);
}

function closeTDPModal() {
  const overlay = document.getElementById('tdpModalOverlay');
  const modal = overlay ? overlay.querySelector('.tdp-modal') : null;
  if (!overlay) return;

  if (modal) modal.classList.remove('active');
  overlay.classList.remove('active');

  setTimeout(() => {
    overlay.remove();
  }, 400); // Match transition duration
}

async function renderTDPModalContent(active, tab) {
  const overlay = document.getElementById('tdpModalOverlay');
  if (!overlay) return;

  // Auto-fetch if current tab and no plan provided
  if (tab === 'current' && !active) {
    active = await getActiveTDP();
  }

  let bodyHtml = '';
  if (tab === 'current') {
    if (active) {
      bodyHtml = renderCurrentTDP(active);
    } else {
      bodyHtml = renderNoActiveTDP();
    }
  } else if (tab === 'previous') {
    bodyHtml = renderPreviousTDPs();
  } else if (tab === 'create') {
    bodyHtml = renderCreateTDPView();
  }

  overlay.innerHTML = `
    <div class="tdp-modal">
      <div class="tdp-sheet-handle"></div>
      <div class="tdp-modal-header">
        <div class="tdp-modal-title" style="font-weight:900;">10 Days Plan</div>
        <button class="tdp-close" onclick="closeTDPModal()">${renderIcon('x', null, 'style="width:20px"')}</button>
      </div>
      <div class="tdp-tabs">
        <button class="tdp-tab ${tab === 'current' ? 'active' : ''}" onclick="renderTDPModalContent(null, 'current')">Current</button>
        <button class="tdp-tab ${tab === 'previous' ? 'active' : ''}" onclick="renderTDPModalContent(null, 'previous')">History</button>
      </div>
      <div class="tdp-modal-body">
        ${bodyHtml}
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Trigger animation
  requestAnimationFrame(() => {
    const modal = overlay.querySelector('.tdp-modal');
    overlay.classList.add('active');
    if (modal) modal.classList.add('active');
  });
}

function renderNoActiveTDP() {
  return `
    <div style="text-align:center; padding:40px 20px;">
      <div style="font-size:48px; margin-bottom:16px;">📅</div>
      <h3 style="margin-bottom:8px;">No Active Plan</h3>
      <p style="color:var(--text-muted); margin-bottom:24px;">Start your next 10-day sprint across all vision categories.</p>
      <button class="btn primary" onclick="renderTDPModalContent(null, 'create')">Create First Plan</button>
    </div>
  `;
}

function renderCurrentTDP(plan) {
  const info = getTDPDayInfo(plan);
  const prog = calculateTDPProgress(plan);
  const cats = JSON.parse(plan.categories_json);

  return `
    <div class="tdp-current-header" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
        <div>
          <div style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase;">Day ${info.day} of 10</div>
          <div style="font-size:18px; font-weight:800;">${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px; font-weight:800; color:var(--primary);">${prog.percentage}%</div>
          <div style="font-size:11px; color:var(--text-muted);">${prog.completed}/${prog.total} Items</div>
        </div>
      </div>
      <div class="tdp-progress-bar"><div class="tdp-progress-fill" style="width:${prog.percentage}%"></div></div>
    </div>

    ${VISION_TDP_CATEGORIES.map(cat => {
      const catColors = {
        'Personality': '#A855F7',
        'Ouro': '#3B82F6',
        'Work': '#10B981',
        'Enjoyment': '#F59E0B',
        'Routine': '#6366F1'
      };
      const color = catColors[cat] || 'var(--primary)';
      return `
      <div class="tdp-cat-section">
        <div class="tdp-cat-header" style="margin-bottom:14px;">
          <div class="tdp-cat-title" style="color:${color}; font-weight:800; font-size:12px; letter-spacing:1px;">${cat}</div>
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); padding:2px 8px; background:var(--surface-3); border-radius:10px;">
            ${(cats[cat] || []).filter(i => i.completed).length}/${(cats[cat] || []).length}
          </div>
        </div>
        <div class="tdp-cat-list">
          ${(cats[cat] || []).map((item, idx) => `
            <div class="tdp-list-item ${item.completed ? 'done' : ''}" onclick="toggleTDPItem('${plan.id}', '${cat}', ${idx})">
              <div class="tdp-checkbox"></div>
              <div class="tdp-item-text" style="font-size:14px; font-weight:600;">${item.text}</div>
              <button class="btn-icon" style="color:var(--text-muted); padding:8px;" onclick="event.stopPropagation(); deleteTDPItem('${plan.id}', '${cat}', ${idx})">
                ${renderIcon('trash', null, 'style="width:14px; opacity:0.6;"')}
              </button>
            </div>
          `).join('')}
          <div class="tdp-add-wrap" style="margin-top:12px;">
            <input type="text" class="tdp-add-input" style="border:1.5px dashed var(--border-color); background:transparent; padding:12px 16px; border-radius:16px;" placeholder="+ Add item to ${cat}..." onkeypress="if(event.key==='Enter') addTDPItem('${plan.id}', '${cat}', this.value)">
          </div>
        </div>
      </div>
    `}).join('')}
  `;
}

async function toggleTDPItem(planId, cat, idx) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  cats[cat][idx].completed = !cats[cat][idx].completed;
  plan.categories_json = JSON.stringify(cats);

  // Optimistic UI
  renderTDPModalContent(plan, 'current');
  renderVision();

  try {
    await apiPost('vision_tdp', plan);
    showToast('Saved on sheet');
  } catch (e) {
    console.error('Failed to save TDP item toggle:', e);
    showToast('Failed to save to sheet');
    // Reload data to sync back if error
    await loadAllData();
    renderVision();
  }
}

async function addTDPItem(planId, cat, text) {
  if (!text.trim()) return;
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  if (!cats[cat]) cats[cat] = [];
  cats[cat].push({ text, completed: false });
  plan.categories_json = JSON.stringify(cats);

  // Optimistic UI
  renderTDPModalContent(plan, 'current');
  renderVision();

  try {
    await apiPost('vision_tdp', plan);
    showToast('Saved on sheet');
  } catch (e) {
    console.error('Failed to add TDP item:', e);
    showToast('Failed to save to sheet');
    await loadAllData();
    renderVision();
  }
}

async function deleteTDPItem(planId, cat, idx) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;
  const cats = JSON.parse(plan.categories_json);
  cats[cat].splice(idx, 1);
  plan.categories_json = JSON.stringify(cats);

  // Optimistic UI
  renderTDPModalContent(plan, 'current');
  renderVision();

  try {
    await apiPost('vision_tdp', plan);
    showToast('Saved on sheet');
  } catch (e) {
    console.error('Failed to delete TDP item:', e);
    showToast('Failed to save to sheet');
    await loadAllData();
    renderVision();
  }
}

function renderCreateTDPView() {
  const nextStart = new Date();
  nextStart.setHours(0, 0, 0, 0);
  const dateStr = nextStart.toISOString().split('T')[0];

  return `
    <div class="tdp-create-header">
      <h3 style="margin-bottom:4px;">New 10 Days Plan</h3>
      <p style="font-size:13px; opacity:0.9;">Choose your start date and set your focus for the next block.</p>
    </div>
    <div class="tdp-date-picker-row">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Start Date</label>
      <input type="date" id="tdpNewStartDate" class="tdp-date-input" value="${dateStr}" onchange="updateTDPPreview()">
    </div>
    <div id="tdpPreview" style="margin-bottom:24px; font-size:14px; color:var(--text-2); background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--border-color);">
      Ends on: <strong>${formatDate(new Date(nextStart.getTime() + 9 * 86400000))}</strong>
    </div>
    
    <div style="display:flex; gap:12px;">
      <button class="btn" style="flex:1" onclick="renderTDPModalContent(null, 'current')">Cancel</button>
      <button class="btn primary" style="flex:2" onclick="createNewTDP()">Create Plan</button>
    </div>
  `;
}

function updateTDPPreview() {
  const val = document.getElementById('tdpNewStartDate').value;
  if (!val) return;
  const end = new Date(new Date(val).getTime() + 9 * 86400000);
  document.getElementById('tdpPreview').innerHTML = `Ends on: <strong>${formatDate(end)}</strong>`;
}

async function createNewTDP() {
  const start = document.getElementById('tdpNewStartDate').value;
  if (!start) return;

  const endDate = new Date(new Date(start).getTime() + 9 * 86400000);
  const end = endDate.toISOString().split('T')[0];

  const categories = {};
  VISION_TDP_CATEGORIES.forEach(c => categories[c] = []);

  const newPlan = {
    start_date: start,
    end_date: end,
    status: 'active',
    categories_json: JSON.stringify(categories),
    created_at: new Date().toISOString()
  };

  // Archive existing active if any
  const plans = state.data.vision_tdp || [];
  for (const p of plans) {
    if (p.status === 'active') {
      p.status = 'archived';
      await apiPost('vision_tdp', p);
    }
  }

  console.log('[TDP Debug] Sending new plan to API:', newPlan);
  const postRes = await apiPost('vision_tdp', newPlan);
  console.log('[TDP Debug] API Post Result:', postRes);

  console.log('[TDP Debug] Triggering loadAllData to sync state...');
  await loadAllData();
  console.log('[TDP Debug] loadAllData complete. State vision_tdp:', state.data.vision_tdp);

  closeTDPModal();
  showToast('New 10 Days Plan created!');
  renderVision();
}

function renderPreviousTDPs() {
  const plans = (state.data.vision_tdp || []).filter(p => p.status === 'archived').sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  if (plans.length === 0) return `<div style="text-align:center; color:var(--text-muted); padding:40px;">No archived plans yet.</div>`;

  return plans.map(p => {
    const prog = calculateTDPProgress(p);
    return `
      <div class="tdp-archive-card" onclick="viewArchivedTDP('${p.id}')">
        <div class="tdp-archive-meta">
          <div class="tdp-archive-dates">${formatDate(p.start_date)} - ${formatDate(p.end_date)}</div>
          <div class="tdp-archive-percent">${prog.percentage}% Complete (${prog.completed}/${prog.total})</div>
        </div>
        ${renderIcon('chevron-right', null, 'style="width:16px; color:var(--text-muted)"')}
      </div>
    `;
  }).join('');
}

function viewArchivedTDP(planId) {
  const plan = state.data.vision_tdp.find(p => String(p.id) === String(planId));
  if (!plan) return;

  const prog = calculateTDPProgress(plan);
  const cats = JSON.parse(plan.categories_json);

  const overlay = document.getElementById('tdpModalOverlay');
  overlay.innerHTML = `
    <div class="tdp-modal animate-enter">
      <div class="tdp-modal-header">
        <div class="tdp-modal-title"><button class="btn-icon" onclick="renderTDPModalContent(null, 'previous')">${renderIcon('arrow-left', null, 'style="width:18px"')}</button> Archived Plan</div>
    < button class= "tdp-close" onclick = "closeTDPModal()" > ${renderIcon('x', null, 'style="width:20px"')}</button >
      </div >
    <div class="tdp-modal-body">
      <div class="tdp-current-header" style="margin-bottom:24px; opacity:0.8;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Archived</div>
            <div style="font-size:18px; font-weight:800;">${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:800; color:var(--text-muted);">${prog.percentage}%</div>
            <div style="font-size:11px; color:var(--text-muted);">${prog.completed}/${prog.total} Items</div>
          </div>
        </div>
        <div class="tdp-progress-bar"><div class="tdp-progress-fill" style="width:${prog.percentage}%; background:var(--text-muted)"></div></div>
      </div>

      ${VISION_TDP_CATEGORIES.map(cat => `
          <div class="tdp-cat-section" style="opacity:0.7">
            <div class="tdp-cat-title" style="color:var(--text-muted); margin-bottom:12px;">${cat}</div>
            <div class="tdp-cat-list">
              ${(cats[cat] || []).map(item => `
                <div class="tdp-list-item ${item.completed ? 'done' : ''}" style="cursor:default">
                  <div class="tdp-checkbox">${item.completed ? renderIcon('save', null, 'style="width:12px"') : ''}</div>
                  <div class="tdp-item-text">${item.text}</div>
                </div>
              `).join('')}
              ${(cats[cat] || []).length === 0 ? '<div style="font-size:12px; color:var(--text-muted); padding:8px;">No items.</div>' : ''}
            </div>
          </div>
        `).join('')}
    </div>
    </div >
    `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
