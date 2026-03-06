/* view-chimes.js - Hourly & Custom Chimes Settings */

// Chime state is now initialized in notification-service.js
// but we ensure it exists here too just in case.
window.chimeState = window.chimeState || {
    enabled: false,
    interval: 60,
    quietStart: 22,
    quietEnd: 8,
    sound: 'chime.wav',
    speakTime: false,
    waterReminder: false,
    customMessage: 'Time to drink some water and stretch!'
};

function escH(text) {
    if (!text) return '';
    return String(text).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

function initChimesState() {
    const saved = localStorage.getItem('chimeSettings');
    if (saved) {
        try {
            window.chimeState = { ...window.chimeState, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error parsing chime settings:', e);
        }
    }
}

function saveChimesState() {
    localStorage.setItem('chimeSettings', JSON.stringify(window.chimeState));
    showToast('Chime Settings Saved');
}

function renderChimesView() {
    try {
        initChimesState();

        const s = window.chimeState;

        const html = `
            <div class="settings-section animate-enter" style="padding: 16px; max-width: 800px; margin: 0 auto; padding-bottom: 120px;">
                
                <div class="view-header" style="margin-bottom: 24px;">
                    <div class="view-title-section">
                        <h1 class="view-title">
                            ${renderIcon('bell', null, 'style="width:28px; margin-right:12px;"')} Chimes & Reminders
                        </h1>
                        <p class="view-subtitle">Hourly ticks, water reminders, and spoken time.</p>
                    </div>
                </div>

                <!-- 1. CORE CHIME SETTINGS -->
                <div class="settings-details" style="display:block; margin-bottom: 20px; background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden;">
                    <div class="widget-header" style="padding:16px 20px; background:var(--surface-2); border-bottom:1px solid var(--border-color); font-weight:600; display:flex; align-items:center; gap:8px;">
                        ${renderIcon('clock', null, 'style="width:18px;"')} Scheduler Settings
                    </div>
                    <div class="widget-body" style="padding:16px;">
                        
                        <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-1);">Enable Chimes</div>
                                <div style="font-size: 12px; color: var(--text-3);">Global switch for background interval pings.</div>
                            </div>
                            <input type="checkbox" id="chimeEnabled" ${s.enabled ? 'checked' : ''} onchange="updateChimeToggle('enabled')" style="width:20px; height:20px;">
                        </div>

                        <div class="setting-item" style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px;">Check Interval</label>
                            <select id="chimeInterval" class="input" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-base); color: var(--text-1);" onchange="updateChimeValue('interval')">
                                <option value="15" ${s.interval == 15 ? 'selected' : ''}>Every 15 minutes</option>
                                <option value="30" ${s.interval == 30 ? 'selected' : ''}>Half-Hourly (30 mins)</option>
                                <option value="45" ${s.interval == 45 ? 'selected' : ''}>Every 45 minutes</option>
                                <option value="60" ${s.interval == 60 ? 'selected' : ''}>Hourly (60 mins)</option>
                                <option value="120" ${s.interval == 120 ? 'selected' : ''}>Every 2 hours</option>
                            </select>
                        </div>

                        <div class="setting-item">
                            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px;">Chime Sound</label>
                            <div style="display:flex; gap:10px">
                                <select id="chimeSound" class="input" style="flex:1; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-base); color: var(--text-1);" onchange="updateChimeValue('sound')">
                                    <option value="none" ${s.sound === 'none' ? 'selected' : ''}>Silent</option>
                                    <optgroup label="Tones">
                                        <option value="chime.wav" ${s.sound === 'chime.wav' ? 'selected' : ''}>Chime</option>
                                        <option value="beep.wav" ${s.sound === 'beep.wav' ? 'selected' : ''}>Beep</option>
                                        <option value="classic.wav" ${s.sound === 'classic.wav' ? 'selected' : ''}>Classic</option>
                                    </optgroup>
                                    <optgroup label="Alarms">
                                        <option value="alarm_fast_10s.wav" ${s.sound === 'alarm_fast_10s.wav' ? 'selected' : ''}>Fast Alarm (10s)</option>
                                        <option value="digital_clock_20s.wav" ${s.sound === 'digital_clock_20s.wav' ? 'selected' : ''}>Digital Clock (20s)</option>
                                        <option value="meditation_bell_30s.wav" ${s.sound === 'meditation_bell_30s.wav' ? 'selected' : ''}>Meditation Bell (30s)</option>
                                    </optgroup>
                                </select>
                                <button class="btn secondary" onclick="testChimeSound()" style="white-space:nowrap">Test</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. QUIET HOURS -->
                <div class="settings-details" style="display:block; margin-bottom: 20px; background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden;">
                    <div class="widget-header" style="padding:16px 20px; background:var(--surface-2); border-bottom:1px solid var(--border-color); font-weight:600; display:flex; align-items:center; gap:8px;">
                        ${renderIcon('moon', null, 'style="width:18px;"')} Quiet Hours
                    </div>
                    <div class="widget-body" style="padding:20px;">
                        <div style="display:flex; gap:16px;">
                            <div style="flex:1">
                                <label style="display: block; font-size: 12px; color: var(--text-3); margin-bottom: 4px;">Start (24h)</label>
                                <input type="number" id="chimeQuietStart" class="input" min="0" max="23" value="${s.quietStart}" onchange="updateChimeValue('quietStart')" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                            </div>
                            <div style="flex:1">
                                <label style="display: block; font-size: 12px; color: var(--text-3); margin-bottom: 4px;">End (24h)</label>
                                <input type="number" id="chimeQuietEnd" class="input" min="0" max="23" value="${s.quietEnd}" onchange="updateChimeValue('quietEnd')" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                            </div>
                        </div>
                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 12px;">Pings are disabled during these hours.</p>
                    </div>
                </div>

                <!-- 3. VOICE & MESSAGE -->
                <div class="settings-details" style="display:block; margin-bottom: 20px; background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden;">
                    <div class="widget-header" style="padding:16px 20px; background:var(--surface-2); border-bottom:1px solid var(--border-color); font-weight:600; display:flex; align-items:center; gap:8px;">
                        ${renderIcon('message-square', null, 'style="width:18px;"')} Voice & Reminders
                    </div>
                    <div class="widget-body" style="padding:20px;">
                        <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-1);">Speak the Time</div>
                                <div style="font-size: 12px; color: var(--text-3);">Announce time via Text-to-Speech.</div>
                            </div>
                            <input type="checkbox" id="chimeSpeakTime" ${s.speakTime ? 'checked' : ''} onchange="updateChimeToggle('speakTime')" style="width:20px; height:20px;">
                        </div>

                        <div class="setting-item" style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px;">Custom Message</label>
                            <input type="text" id="chimeCustomMessage" class="input" value="${escH(s.customMessage)}" onchange="updateChimeValue('customMessage')" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                            <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Sent as notification and spoken if enabled.</p>
                        </div>

                        <button class="btn secondary" style="width:100%; margin-top:10px;" onclick="testFullChimeTrigger()">
                             ${renderIcon('play', null, 'style="width:14px; margin-right:6px;"')} Simulate Alert Now
                        </button>
                    </div>
                </div>

            </div>
        `;

        document.getElementById('main').innerHTML = html;
        console.log("Chimes View Rendered Successfully");
    } catch (e) {
        console.error("CRASH IN CHIMES TEMPLATE:", e);
        document.getElementById('main').innerHTML = '<div style="padding:32px; color:red; font-weight:bold;">CHIMES RENDER CRASH: ' + e.message + '<br><small>' + e.stack.split("\\n")[0] + '</small></div>';
    }
}

function updateChimeToggle(key) {
    const el = document.getElementById('chime' + key.charAt(0).toUpperCase() + key.slice(1));
    if (el) {
        window.chimeState[key] = el.checked;
        saveChimesState();
    }
}

function updateChimeValue(key) {
    const el = document.getElementById('chime' + key.charAt(0).toUpperCase() + key.slice(1));
    if (el) {
        let val = el.value;
        if (key === 'interval' || key === 'quietStart' || key === 'quietEnd') {
            val = parseInt(val, 10) || 0;
        }
        window.chimeState[key] = val;
        saveChimesState();
    }
}

function testChimeSound() {
    const sound = document.getElementById('chimeSound').value;
    if (sound !== 'none') {
        window.playNativeSound(sound);
    }
}

function testFullChimeTrigger() {
    initChimesState();

    const now = new Date();
    let timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let msg = `It is ${timeString}.`;
    let subMsg = window.chimeState.waterReminder ? window.chimeState.customMessage : '';

    // 1. Play sound (iOS Fixed)
    if (window.chimeState.sound !== 'none') {
        window.playNativeSound(window.chimeState.sound);
    }

    // 2. TTS (SSML Fixed)
    if (window.chimeState.speakTime && 'speechSynthesis' in window) {
        const textToSpeak = (msg + " " + subMsg).trim();
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
    }

    // 3. UI
    const finalMsg = window.chimeState.waterReminder ? window.chimeState.customMessage : msg;
    showToast("🔔 " + finalMsg, "info");
}
