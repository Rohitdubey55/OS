/* biometric-lock.js
 *
 * Shows a full-screen lock overlay until the user authenticates via
 * fingerprint / face. Triggered on cold start and on resume from background
 * (after a configurable grace period — currently 60s — so quick context
 * switches don't keep nagging the user).
 *
 * Enable/disable via:
 *   localStorage.setItem('biometricLock', '1')   // enable
 *   localStorage.removeItem('biometricLock')     // disable
 *
 * (The Settings view will eventually expose a toggle for this; for now it
 *  is opt-in via localStorage so adopting users can try it before the UI ships.)
 */

(function () {
    'use strict';

    const ENABLED_KEY = 'biometricLock';
    const GRACE_MS = 60 * 1000; // 60 seconds of background = re-lock
    let lockedAt = 0;
    let lockOverlay = null;
    let unlocking = false;

    function isEnabled() {
        try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch (e) { return false; }
    }

    function isNative() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    function buildLockOverlay() {
        if (lockOverlay) return lockOverlay;
        const el = document.createElement('div');
        el.id = 'biometricLockOverlay';
        el.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483647',
            'background:#0B0E14', 'color:#E4E7EC',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'gap:24px', 'padding:24px',
            'font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
            'opacity:1', 'transition:opacity 200ms ease'
        ].join(';');
        el.innerHTML = `
            <div style="width:72px;height:72px;border-radius:18px;background:#1F2937;display:flex;align-items:center;justify-content:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A5B4FC" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">PersonalOS is locked</div>
            <div id="biometricLockHint" style="font-size:13px;color:#9CA3AF;text-align:center;max-width:260px;line-height:1.5;">
                Authenticate to continue. Your diary and finance data stay private.
            </div>
            <button id="biometricUnlockBtn"
                    style="margin-top:8px;padding:12px 24px;font-size:14px;font-weight:600;
                           background:#4F46E5;color:#FFFFFF;border:none;border-radius:12px;
                           cursor:pointer;min-width:180px;">
                Unlock
            </button>
        `;
        document.body.appendChild(el);
        el.querySelector('#biometricUnlockBtn').addEventListener('click', attemptUnlock);
        lockOverlay = el;
        return el;
    }

    function showLock() {
        const el = buildLockOverlay();
        el.style.display = 'flex';
        el.style.opacity = '1';
        // Also blur any focused input so the keyboard doesn't show through.
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    function hideLock() {
        if (!lockOverlay) return;
        lockOverlay.style.opacity = '0';
        setTimeout(() => { if (lockOverlay) lockOverlay.style.display = 'none'; }, 220);
    }

    async function attemptUnlock() {
        if (unlocking) return;
        unlocking = true;
        const hint = document.getElementById('biometricLockHint');

        // Native path: Capacitor BiometricAuth plugin
        const Bio = window.Capacitor?.Plugins?.BiometricAuth;
        if (Bio && isNative()) {
            try {
                const avail = await Bio.checkBiometry();
                if (!avail.isAvailable) {
                    if (hint) hint.textContent = 'Biometrics unavailable on this device. Tap unlock to continue.';
                    // Fall through: allow unlock without auth so the user isn't soft-bricked.
                    hideLock();
                    unlocking = false;
                    return;
                }
                await Bio.authenticate({
                    reason: 'Unlock PersonalOS',
                    cancelTitle: 'Cancel',
                    iosFallbackTitle: 'Use Passcode',
                    androidTitle: 'PersonalOS is locked',
                    androidSubtitle: 'Authenticate to continue',
                    androidConfirmationRequired: false
                });
                hideLock();
                unlocking = false;
                return;
            } catch (e) {
                console.warn('[BiometricLock] Authentication failed or cancelled:', e?.message || e);
                if (hint) hint.textContent = 'Authentication failed. Try again.';
                unlocking = false;
                return;
            }
        }

        // Non-native fallback (web preview / unsupported device): just dismiss.
        // The point of biometric lock is to deter casual snooping; without
        // native support there's nothing meaningful to gate against.
        hideLock();
        unlocking = false;
    }

    function maybeLock(force) {
        if (!isEnabled()) return false;
        if (!isNative() && !force) return false;
        showLock();
        // Kick off the auth prompt automatically; user can also tap the button.
        setTimeout(attemptUnlock, 100);
        return true;
    }

    // Wire to App lifecycle: lock when backgrounded long enough.
    function wireLifecycle() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                lockedAt = Date.now();
            } else if (document.visibilityState === 'visible') {
                if (isEnabled() && (Date.now() - lockedAt) > GRACE_MS) {
                    maybeLock();
                }
            }
        });

        // Capacitor App plugin: more reliable on Android than visibilitychange.
        const App = window.Capacitor?.Plugins?.App;
        if (App && App.addListener) {
            App.addListener('appStateChange', ({ isActive }) => {
                if (!isActive) {
                    lockedAt = Date.now();
                } else if (isEnabled() && (Date.now() - lockedAt) > GRACE_MS) {
                    maybeLock();
                }
            });
        }
    }

    // Public API
    window.biometricLock = {
        enable() {
            try { localStorage.setItem(ENABLED_KEY, '1'); } catch (e) {}
            console.log('[BiometricLock] Enabled');
        },
        disable() {
            try { localStorage.removeItem(ENABLED_KEY); } catch (e) {}
            console.log('[BiometricLock] Disabled');
        },
        isEnabled,
        lockNow() { maybeLock(true); },
        unlock: attemptUnlock
    };

    // Run on script load: if enabled, immediately gate the app.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { wireLifecycle(); maybeLock(); });
    } else {
        wireLifecycle();
        maybeLock();
    }
})();
