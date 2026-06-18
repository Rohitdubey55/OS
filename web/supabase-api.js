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
                    let row = _normalizeForInsert(sheet, payload, user.id);
                    let res, tries = 0;
                    do {
                        res = await sb.from(sheet).insert(row).select().single();
                        if (!res.error) break;
                        const stripped = _stripMissingCol(res.error, row);
                        if (!stripped) break;
                        row = stripped;
                    } while (++tries < 5);
                    if (res.error) throw res.error;
                    return { success: true, data: res.data, id: res.data?.id };
                }

                // ─────────────────────────────────────────────────────
                case 'update': {
                    if (!user) throw new Error('Not authenticated');
                    if (!id) throw new Error('Missing id for update');
                    let updates = _normalizeForUpdate(sheet, payload);
                    let res = null, tries = 0;
                    // If the payload is empty — or becomes empty after dropping a
                    // not-yet-migrated column (e.g. `color`) — skip the DB call so we
                    // don't send an empty UPDATE (which makes .single() throw
                    // "Cannot coerce the result to a single JSON object").
                    while (updates && Object.keys(updates).length > 0 && tries < 5) {
                        res = await sb.from(sheet).update(updates).eq('id', String(id)).select().single();
                        if (!res.error) break;
                        const stripped = _stripMissingCol(res.error, updates);
                        if (!stripped) break;
                        updates = stripped;
                        tries++;
                        // If stripping a not-yet-migrated column emptied the payload,
                        // there's nothing left to persist — treat as a successful no-op
                        // instead of throwing the original "column not found" error.
                        if (Object.keys(updates).length === 0) { res = { data: null, error: null }; break; }
                    }
                    if (!res) return { success: true, data: null, skipped: true };
                    if (res.error) throw res.error;
                    return { success: true, data: res.data };
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

    // Per-table allowlist of columns that exist in Postgres. Any payload field
    // not in this list is silently dropped — prevents "schema doesn't have column X"
    // errors from view code that sends legacy fields like habit_summary_time.
    const ALLOWED_COLUMNS = {
        settings: new Set(['id','user_id','name','dob','morning_message','afternoon_message','evening_message','weekly_budget','monthly_budget','category_budgets','theme_color','theme_mode','orientation_lock','ai_api_key','ai_model','nav_layout','dashboard_config','kpi_config','bento_config','dashboard_tiles','mobile_dashboard_tiles','notification_enabled','notification_sound','notification_method','quiet_hours_start','quiet_hours_end','diary_default_mood','diary_show_tasks','diary_show_habits','diary_show_expenses','task_default_view','task_categories','habit_routines','elevenlabs_api_key','elevenlabs_voice_id','tts_provider','tts_voice_id']),
        reader_settings: new Set(['id','user_id','background_color','font_color','font_family','font_size','line_spacing','fullscreen_mode','page_animation','auto_save_position']),
        pomodoro_settings: new Set(['id','user_id','work_duration','short_break','long_break','long_break_interval','sound_work','sound_break','auto_start_break','background_mode']),
        tasks: new Set(['id','user_id','title','due_date','due_time','priority','status','notes','description','category','tags','vision_id','recurrence','recurrence_days','recurrence_end','completed_dates','duration','subtasks','pomodoro_estimate','pomodoro_length']),
        habits: new Set(['id','user_id','habit_name','frequency','streak','reminder_time','emoji','pomodoro_sessions','pomodoro_length','alarm_enabled','routine']),
        habit_logs: new Set(['id','user_id','habit_id','date','status','pomodoro_completed']),
        expenses: new Set(['id','user_id','date','amount','category','description','type','payment_mode']),
        diary: new Set(['id','user_id','date','content','mood','tags']),
        planner_events: new Set(['id','user_id','title','start_datetime','end_datetime','category','color']),
        vision_board: new Set(['id','user_id','category','title','description','image_url','target_date','progress','status','notes','linked_habits','video_url','month_focus','color','display_mode']),
        funds: new Set(['id','user_id','name','balance','type','currency']),
        assets: new Set(['id','user_id','name','value','purchase_date','notes']),
        people: new Set(['id','user_id','name','relationship','birthday','phone','email','instagram','last_contact','next_interaction','is_favorite','is_priority','notes']),
        people_debts: new Set(['id','user_id','person_id','amount','type','date','notes']),
        notes: new Set(['id','user_id','title','content','category','is_pinned','tags']),
        reminders: new Set(['id','user_id','title','reminder_datetime','is_active','linked_item_id']),
        book_library: new Set(['id','user_id','title','author','cover_url','category','status','date_added','date_completed','rating','notes','linked_goals','tags']),
        book_summaries: new Set(['id','user_id','book_id','book_title','author','summary_json','total_pages','linked_vision_ids','key_takeaways','action_items','memorable_quotes']),
        vision_affirmations: new Set(['id','user_id','vision_id','text','order','bg_style','is_pinned','is_favorite','favorite_at','duration','media_key','audio_url']),
        ritual_logs: new Set(['id','user_id','date','duration_seconds','affirmation_count','mood_after','completed']),
        gym_workouts: new Set(['id','user_id','date','exercise_name','workout_type','duration_minutes','sets','reps','weight','notes']),
        gym_exercises: new Set(['id','user_id','name','muscle_group','equipment','description']),
        pomodoro_sessions: new Set(['id','user_id','date','type','duration','habit_id','task_id','completed']),
        pomodoro_badges: new Set(['id','user_id','badge_type','unlocked_at','total_sessions']),
        diary_templates: new Set(['id','user_id','title','content','category','is_default','sort_order']),
        diary_tags: new Set(['id','user_id','name','color','usage_count']),
        diary_achievements: new Set(['id','user_id','type','name','description','target_value','unlocked_at']),
        vision_images: new Set(['id','user_id','vision_id','file_id','url','name','uploaded_at']),
        vision_tdp: new Set(['id','user_id','start_date','end_date','status','categories_json']),
        mural_projects: new Set(['id','user_id','title','category','bg_pattern','bg_color']),
        mural_categories: new Set(['id','user_id','name','color']),
        mural_elements: new Set(['id','user_id','project_id','type','x','y','w','h','content','color','z_index','shape','from_id','to_id','connector_style','from_side','to_side','line_style','arrow_mode']),
        english_sessions: new Set(['id','user_id','date','duration_seconds','topic','level','score','weak_areas','strong_areas','summary','message_count']),
        english_messages: new Set(['id','user_id','session_id','role','content','correction','feedback','timestamp'])
    };

    // If a write fails because a column doesn't exist yet (e.g. a column added in a
    // not-yet-run migration like payment_mode), drop that column so the write can retry.
    // Keeps saves working on a schema gap; the field simply isn't persisted until migrated.
    function _stripMissingCol(error, row) {
        if (!error || !row) return null;
        const msg = String(error.message || '') + ' ' + String(error.details || '') + ' ' + String(error.hint || '');
        const m = msg.match(/'([^']+)' column/) || msg.match(/column "([^"]+)"/) || msg.match(/Could not find the '([^']+)'/) || msg.match(/\bcolumn ([a-z0-9_]+)\b/i);
        const col = m && m[1];
        if (col && Object.prototype.hasOwnProperty.call(row, col)) {
            const copy = { ...row };
            delete copy[col];
            return copy;
        }
        return null;
    }

    // Drop any keys in payload that aren't in the table's allowlist.
    function _filterToAllowed(sheet, row) {
        const allow = ALLOWED_COLUMNS[sheet];
        if (!allow) return row;   // no allowlist → pass through
        const out = {};
        Object.keys(row).forEach(k => {
            if (allow.has(k)) out[k] = row[k];
            // Don't even console.warn for stripped keys — too spammy on every save
        });
        return out;
    }

    // Normalize a row for INSERT: ensure id (string) and user_id
    function _normalizeForInsert(sheet, payload, userId) {
        const row = { ...(payload || {}) };
        if (!row.id) row.id = String(Date.now()) + Math.floor(Math.random() * 1000);
        else row.id = String(row.id);
        row.user_id = userId;
        delete row.created_at;
        delete row.updated_at;
        return _filterToAllowed(sheet, _coerceTypes(sheet, row));
    }

    // Normalize a row for UPDATE: strip server fields, filter to allowed columns
    function _normalizeForUpdate(sheet, payload) {
        const row = { ...(payload || {}) };
        delete row.user_id;
        delete row.id;
        delete row.created_at;
        delete row.updated_at;
        return _filterToAllowed(sheet, _coerceTypes(sheet, row));
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
