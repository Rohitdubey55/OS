// ============================================================================
// SUPABASE API — drop-in replacement for the Google Apps Script apiCall.
//   Same signature: apiCall(action, sheet, payload, id)
//   action: 'get' | 'create' | 'update' | 'delete' | 'init'
//   sheet:  table name (matches Google Sheet tab name = Postgres table name)
//   payload: row data for create/update
//   id:     row id for update/delete
//
// All inserts are auto-stamped with user_id (from current session) so RLS
// policies allow the write. Reads filter by RLS implicitly.
// ============================================================================
(function () {
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.enabled) return; // Disabled — original apiCall stays in main.js

    // Wait until Supabase client + user are ready before we replace apiCall.
    // We replace the global apiCall at this point so all callers transparently
    // use Supabase.
    function install() {
        if (!window.supabase || !window.supabase.from) {
            setTimeout(install, 100);
            return;
        }
        window._origApiCall = window.apiCall;
        window.apiCall = supabaseApiCall;
        console.log('[Supabase] apiCall replaced. Backend: Postgres');
    }
    install();

    async function supabaseApiCall(action, sheet, payload = {}, id = null) {
        const sb = window.supabase;
        const user = window._currentUser;

        try {
            switch (action) {
                // ─────────────────────────────────────────────────────
                case 'get': {
                    // Fetch all rows for current user (RLS filters by user_id)
                    const { data, error } = await sb.from(sheet).select('*').order('created_at', { ascending: false });
                    if (error) throw error;
                    return data || [];
                }

                // ─────────────────────────────────────────────────────
                case 'init': {
                    // Bulk-load every table in parallel. Match the shape the legacy
                    // apiCall returns: { success: true, data: { table1: [...], ... } }
                    const tables = payload?.tables || _getAllTables();
                    const results = await Promise.all(tables.map(async (t) => {
                        try {
                            const { data, error } = await sb.from(t).select('*');
                            return [t, error ? [] : (data || [])];
                        } catch (e) { return [t, []]; }
                    }));
                    const dataMap = Object.fromEntries(results);
                    return { success: true, data: dataMap };
                }

                // ─────────────────────────────────────────────────────
                case 'create': {
                    if (!user) throw new Error('Not authenticated');
                    const row = _normalizeForInsert(sheet, payload, user.id);
                    const { data, error } = await sb.from(sheet).insert(row).select().single();
                    if (error) throw error;
                    return { success: true, data, id: data?.id };
                }

                // ─────────────────────────────────────────────────────
                case 'update': {
                    if (!user) throw new Error('Not authenticated');
                    if (!id) throw new Error('Missing id for update');
                    const updates = _normalizeForUpdate(sheet, payload);
                    const { data, error } = await sb.from(sheet).update(updates).eq('id', String(id)).select().single();
                    if (error) throw error;
                    return { success: true, data };
                }

                // ─────────────────────────────────────────────────────
                case 'delete': {
                    if (!user) throw new Error('Not authenticated');
                    if (!id) throw new Error('Missing id for delete');
                    const { error } = await sb.from(sheet).delete().eq('id', String(id));
                    if (error) throw error;
                    return { success: true };
                }

                default:
                    throw new Error('Unknown action: ' + action);
            }
        } catch (e) {
            console.error(`[Supabase] ${action} ${sheet} failed:`, e);
            if (typeof showToast === 'function') showToast('Error: ' + e.message);
            return action === 'get' ? [] : { success: false, message: e.message };
        }
    }

    // Normalize a row for INSERT: ensure id (string) and user_id
    function _normalizeForInsert(sheet, payload, userId) {
        const row = { ...(payload || {}) };
        // Ensure id is set as a string (app convention)
        if (!row.id) row.id = String(Date.now()) + Math.floor(Math.random() * 1000);
        else row.id = String(row.id);
        row.user_id = userId;
        // Strip server-managed columns if accidentally set
        delete row.created_at;
        delete row.updated_at;
        return _coerceTypes(sheet, row);
    }

    // Normalize a row for UPDATE: strip user_id (RLS check covers it), strip id
    function _normalizeForUpdate(sheet, payload) {
        const row = { ...(payload || {}) };
        delete row.user_id;
        delete row.id;
        delete row.created_at;
        delete row.updated_at;
        return _coerceTypes(sheet, row);
    }

    // Coerce string-y values to the right type for Postgres
    // (Apps Script returned everything as strings; Postgres is stricter)
    function _coerceTypes(sheet, row) {
        const out = { ...row };
        Object.keys(out).forEach(k => {
            const v = out[k];
            if (v === undefined || v === '' || v === 'undefined' || v === 'null') {
                delete out[k];
                return;
            }
            // Convert "true"/"false" strings to booleans
            if (v === 'true' || v === 'TRUE') out[k] = true;
            else if (v === 'false' || v === 'FALSE') out[k] = false;
            // Stringify objects/arrays for JSONB columns (PostgREST handles this)
            else if (typeof v === 'object' && v !== null) {
                // Leave as-is; PostgREST will JSON.stringify for jsonb columns
                out[k] = v;
            }
        });
        return out;
    }

    function _getAllTables() {
        return [
            'planner_events','tasks','expenses','habits','habit_logs','diary',
            'vision_board','settings','funds','assets','people','people_debts',
            'reminders','diary_templates','diary_tags','diary_achievements',
            'gym_workouts','gym_exercises','notes','vision_images',
            'pomodoro_settings','pomodoro_sessions','pomodoro_badges','vision_tdp',
            'book_library','book_summaries','reader_settings','mural_projects',
            'mural_categories','mural_elements','vision_affirmations','ritual_logs',
            'english_sessions','english_messages'
        ];
    }
})();
