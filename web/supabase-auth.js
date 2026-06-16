// ============================================================================
// SUPABASE AUTH — login/signup/logout flow
//   - Renders a full-screen login gate if no session
//   - On success: caches user, removes gate, calls onAuthed callback
//   - Logout: clears session, shows gate again
// ============================================================================
(function () {
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.enabled) return;

    // ────────────────────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────────────────────
    window.supabaseAuth = {
        ensureSignedIn,
        signOut,
        getUser: () => window._currentUser
    };

    // Bootstrap: check for existing session, show gate if not
    document.addEventListener('DOMContentLoaded', initAuthFlow);
    // Also fire immediately in case DOMContentLoaded already passed
    if (document.readyState !== 'loading') setTimeout(initAuthFlow, 0);

    async function initAuthFlow() {
        if (window._authInitialized) return;
        window._authInitialized = true;
        if (!window.supabase || !window.supabase.auth) {
            console.warn('[Auth] Supabase client not ready, retrying');
            setTimeout(initAuthFlow, 100);
            window._authInitialized = false;
            return;
        }
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session?.user) {
            window._currentUser = session.user;
            console.log('[Auth] restored session for', session.user.email);
            removeLoginGate();
            window.dispatchEvent(new CustomEvent('supabase:authed', { detail: session.user }));
        } else {
            renderLoginGate();
        }

        // Listen for sign-out from other tabs
        window.supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                window._currentUser = null;
                renderLoginGate();
            } else if (event === 'SIGNED_IN' && session?.user) {
                window._currentUser = session.user;
                removeLoginGate();
                window.dispatchEvent(new CustomEvent('supabase:authed', { detail: session.user }));
            }
        });
    }

    async function ensureSignedIn() {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) renderLoginGate();
        return session?.user || null;
    }

    async function signOut() {
        await window.supabase.auth.signOut();
        window._currentUser = null;
        renderLoginGate();
    }

    // ────────────────────────────────────────────────────────────
    // Login gate UI
    // ────────────────────────────────────────────────────────────
    function renderLoginGate() {
        removeLoginGate();
        const overlay = document.createElement('div');
        overlay.id = 'supabaseAuthGate';
        overlay.innerHTML = `
            <div class="sa-card">
                <div class="sa-brand">
                    <div class="sa-brand__mark"></div>
                    <h1 class="sa-brand__name">PersonalOS</h1>
                </div>
                <p class="sa-tagline">Your private operating system for life.</p>
                <div class="sa-tabs">
                    <button class="sa-tab is-active" data-tab="signin">Sign in</button>
                    <button class="sa-tab" data-tab="signup">Create account</button>
                </div>
                <form class="sa-form" id="saForm">
                    <label class="sa-field">
                        <span>Email</span>
                        <input type="email" id="saEmail" required autocomplete="email" />
                    </label>
                    <label class="sa-field">
                        <span>Password</span>
                        <input type="password" id="saPass" required minlength="6" autocomplete="current-password" />
                    </label>
                    <div class="sa-error" id="saError"></div>
                    <button type="submit" class="sa-submit" id="saSubmit">Sign in</button>
                </form>
                <div class="sa-divider"><span>or</span></div>
                <button class="sa-google" id="saGoogle">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.3-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.32A5.36 5.36 0 0 1 9 3.58z"/></svg>
                    Continue with Google
                </button>
                <p class="sa-foot">By signing up, you agree to keep your data private. We never share it.</p>
            </div>
            <style>
                #supabaseAuthGate {
                    position: fixed; inset: 0; z-index: 99999;
                    background: linear-gradient(135deg, #F2F3F5 0%, #E5E7EB 100%);
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }
                .sa-card {
                    background: #FFFFFF; border-radius: 18px; padding: 32px 28px;
                    width: 100%; max-width: 380px;
                    box-shadow: 0 24px 50px -12px rgba(15, 23, 42, 0.18);
                }
                .sa-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
                .sa-brand__mark {
                    width: 32px; height: 32px; border-radius: 8px;
                    background: linear-gradient(135deg, #6EE7B7, #818CF8);
                }
                .sa-brand__name {
                    font-size: 18px; font-weight: 800; color: #0F172A;
                    letter-spacing: -0.02em; margin: 0;
                }
                .sa-tagline {
                    font-size: 13px; color: #5B6470;
                    margin: 0 0 24px 0;
                }
                .sa-tabs {
                    display: flex; gap: 4px; background: #F2F3F5;
                    border-radius: 10px; padding: 4px; margin-bottom: 20px;
                }
                .sa-tab {
                    flex: 1; padding: 8px 12px;
                    background: transparent; border: none;
                    font-size: 13px; font-weight: 600; color: #5B6470;
                    border-radius: 8px; cursor: pointer;
                    transition: all 120ms ease;
                }
                .sa-tab.is-active {
                    background: #FFFFFF; color: #0F172A;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .sa-form { display: flex; flex-direction: column; gap: 12px; }
                .sa-field { display: flex; flex-direction: column; gap: 6px; }
                .sa-field span {
                    font-size: 11px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: #5B6470;
                }
                .sa-field input {
                    padding: 10px 12px; border: 1px solid #E5E7EB;
                    border-radius: 8px; font-size: 14px;
                    background: #FFFFFF; color: #0F172A;
                    transition: border-color 120ms ease;
                }
                .sa-field input:focus {
                    outline: none; border-color: #818CF8;
                    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
                }
                .sa-error {
                    color: #DC2626; font-size: 12px;
                    min-height: 16px; padding: 2px 0;
                }
                .sa-submit {
                    margin-top: 4px; padding: 11px;
                    background: #0F172A; color: #FFFFFF;
                    border: none; border-radius: 10px;
                    font-size: 14px; font-weight: 700; cursor: pointer;
                    transition: background 120ms ease;
                }
                .sa-submit:hover { background: #1E293B; }
                .sa-submit:disabled { opacity: 0.6; cursor: wait; }
                .sa-divider {
                    display: flex; align-items: center; gap: 10px;
                    color: #9097A1; font-size: 11px; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    margin: 18px 0;
                }
                .sa-divider::before, .sa-divider::after {
                    content: ''; flex: 1; height: 1px; background: #E5E7EB;
                }
                .sa-google {
                    width: 100%; padding: 10px;
                    background: #FFFFFF; color: #0F172A;
                    border: 1px solid #E5E7EB; border-radius: 10px;
                    font-size: 14px; font-weight: 600;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    cursor: pointer;
                    transition: all 120ms ease;
                }
                .sa-google:hover { background: #F9FAFB; border-color: #CBD5E1; }
                .sa-foot {
                    font-size: 11px; color: #9097A1;
                    text-align: center; margin: 18px 0 0 0;
                    line-height: 1.5;
                }
            </style>`;
        document.body.appendChild(overlay);

        let mode = 'signin';
        overlay.querySelectorAll('.sa-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                mode = tab.dataset.tab;
                overlay.querySelectorAll('.sa-tab').forEach(t => t.classList.toggle('is-active', t === tab));
                overlay.querySelector('#saSubmit').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
                overlay.querySelector('#saError').textContent = '';
                const passInput = overlay.querySelector('#saPass');
                passInput.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
            });
        });

        overlay.querySelector('#saForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = overlay.querySelector('#saEmail').value.trim();
            const password = overlay.querySelector('#saPass').value;
            const submit = overlay.querySelector('#saSubmit');
            const errBox = overlay.querySelector('#saError');
            errBox.textContent = '';
            submit.disabled = true;
            submit.textContent = mode === 'signin' ? 'Signing in…' : 'Creating…';
            try {
                if (mode === 'signin') {
                    const { error } = await window.supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                } else {
                    const { error } = await window.supabase.auth.signUp({ email, password });
                    if (error) throw error;
                    errBox.style.color = '#059669';
                    errBox.textContent = 'Account created. Check your email if confirmation is required.';
                }
            } catch (err) {
                errBox.style.color = '#DC2626';
                errBox.textContent = err.message || 'Something went wrong.';
            } finally {
                submit.disabled = false;
                submit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
            }
        });

        overlay.querySelector('#saGoogle').addEventListener('click', async () => {
            const errBox = overlay.querySelector('#saError');
            errBox.textContent = '';
            try {
                const { error } = await window.supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin }
                });
                if (error) throw error;
            } catch (err) {
                errBox.style.color = '#DC2626';
                errBox.textContent = err.message || 'Google sign-in failed.';
            }
        });
    }

    function removeLoginGate() {
        const el = document.getElementById('supabaseAuthGate');
        if (el) el.remove();
    }
})();
