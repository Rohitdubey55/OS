// ============================================================================
// SUPABASE CLIENT — initializes the global supabase client if config is enabled
// ============================================================================
(function () {
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.enabled) {
        console.log('[Supabase] disabled — using Google Sheets backend');
        window.supabase = null;
        return;
    }
    if (!cfg.url || !cfg.anonKey || cfg.url.includes('YOUR-PROJECT-REF')) {
        console.warn('[Supabase] enabled but URL/anonKey missing. Edit web/supabase-config.js');
        window.supabase = null;
        return;
    }
    if (typeof window.supabase === 'undefined' || !window.supabase?.createClient) {
        // The UMD bundle exposes a global `supabase` namespace; we expect it loaded
        // via the script tag in index.html.
        console.error('[Supabase] SDK not loaded. Check index.html script include.');
        return;
    }

    // Replace the namespace with the configured client instance
    const ns = window.supabase;
    window.supabase = ns.createClient(cfg.url, cfg.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
        }
    });
    window.supabaseNS = ns;
    console.log('[Supabase] client ready');
})();

// Helper exposed globally — returns the current user's UUID or null
window.currentUserId = function () {
    try {
        const session = window.supabase?.auth?.getSession?.();
        // getSession returns a Promise; for synchronous use, we cache the user in window._currentUser
        return window._currentUser?.id || null;
    } catch (e) { return null; }
};
