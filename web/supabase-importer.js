// ============================================================================
// SUPABASE IMPORTER — one-shot Google Sheets → Supabase migration
//
// USAGE (in browser console, after signing in):
//     await importFromSheets()
//
// What it does:
//   1. Reads every table from your existing Google Apps Script endpoint.
//   2. For every row, strips columns that don't exist in the new schema,
//      coerces strings to proper types (numbers, dates, booleans, JSON),
//      stamps user_id with the currently signed-in user's UUID.
//   3. Upserts in batches of 100 — safe to re-run; existing rows are updated
//      by id, never duplicated.
//   4. Prints a per-table report at the end.
//
// Safety:
//   - Will refuse to run unless Supabase is enabled and you're signed in.
//   - Respects Row-Level Security: each user can only insert rows tagged
//     with their own user_id.
//   - Dry-run mode: importFromSheets({ dryRun: true }) prints what WOULD
//     happen without writing anything.
// ============================================================================

(function () {
    // The exact Google Apps Script URL the current app uses
    const SHEET_API = 'https://script.google.com/macros/s/AKfycbzA4TVNQO42M3r6notPSFgEqZZgVJ8ge66Gl7dbW06tCmCkaif6qkVsiK820AB4a5nSrg/exec';

    // Tables to import, in dependency-aware order (parents before children).
    const TABLES = [
        'settings', 'reader_settings', 'pomodoro_settings',
        'vision_board', 'vision_tdp', 'vision_images', 'vision_affirmations',
        'habits', 'habit_logs',
        'tasks', 'planner_events',
        'expenses', 'funds', 'assets',
        'people', 'people_debts',
        'diary', 'diary_templates', 'diary_tags', 'diary_achievements',
        'notes', 'reminders',
        'book_library', 'book_summaries',
        'gym_workouts', 'gym_exercises',
        'pomodoro_sessions', 'pomodoro_badges', 'ritual_logs',
        'mural_projects', 'mural_categories', 'mural_elements',
        'english_sessions', 'english_messages'
    ];

    // Columns that exist in the Postgres schema, per table.
    // Anything NOT in this list (e.g. legacy view_mode, hidden_tabs) gets stripped.
    const ALLOWED = {
        planner_events: ['id','title','start_datetime','end_datetime','category'],
        tasks: ['id','title','due_date','due_time','priority','status','notes','description','category','tags','vision_id','recurrence','recurrence_days','recurrence_end','completed_dates','duration','subtasks','pomodoro_estimate','pomodoro_length'],
        expenses: ['id','date','amount','category','description','type'],
        habits: ['id','habit_name','frequency','streak','reminder_time','emoji','pomodoro_sessions','pomodoro_length','alarm_enabled','routine'],
        habit_logs: ['id','habit_id','date','status','pomodoro_completed'],
        diary: ['id','date','content','mood','tags'],
        vision_board: ['id','category','title','description','image_url','target_date','progress','status','notes','linked_habits','video_url','month_focus','created_at','updated_at'],
        settings: ['id','name','dob','morning_message','afternoon_message','evening_message','weekly_budget','monthly_budget','category_budgets','theme_color','theme_mode','orientation_lock','ai_api_key','ai_model','nav_layout','dashboard_config','kpi_config','bento_config','dashboard_tiles','notification_enabled','notification_sound','notification_method','quiet_hours_start','quiet_hours_end','diary_default_mood','diary_show_tasks','diary_show_habits','diary_show_expenses','task_default_view','task_categories','habit_routines','elevenlabs_api_key','elevenlabs_voice_id','tts_provider','tts_voice_id'],
        funds: ['id','name','balance','type','currency'],
        assets: ['id','name','value','purchase_date','notes'],
        people: ['id','name','relationship','birthday','phone','email','instagram','last_contact','next_interaction','is_favorite','is_priority','notes'],
        people_debts: ['id','person_id','amount','type','date','notes'],
        reminders: ['id','title','reminder_datetime','is_active','linked_item_id'],
        diary_templates: ['id','title','content','category','is_default','sort_order'],
        diary_tags: ['id','name','color','usage_count','created_at'],
        diary_achievements: ['id','type','name','description','target_value','unlocked_at'],
        gym_workouts: ['id','date','exercise_name','workout_type','duration_minutes','sets','reps','weight','notes'],
        gym_exercises: ['id','name','muscle_group','equipment','description'],
        notes: ['id','title','content','category','is_pinned','tags','created_at','updated_at'],
        vision_images: ['id','vision_id','file_id','url','name','uploaded_at'],
        pomodoro_settings: ['id','work_duration','short_break','long_break','long_break_interval','sound_work','sound_break','auto_start_break','background_mode'],
        pomodoro_sessions: ['id','date','type','duration','habit_id','task_id','completed'],
        pomodoro_badges: ['id','badge_type','unlocked_at','total_sessions'],
        vision_tdp: ['id','start_date','end_date','status','categories_json','created_at'],
        book_library: ['id','title','author','cover_url','category','status','date_added','date_completed','rating','notes','linked_goals','tags'],
        book_summaries: ['id','book_id','book_title','author','summary_json','total_pages','linked_vision_ids','key_takeaways','action_items','memorable_quotes','created_at'],
        reader_settings: ['id','background_color','font_color','font_family','font_size','line_spacing','fullscreen_mode','page_animation','auto_save_position'],
        mural_projects: ['id','title','category','bg_pattern','bg_color','created_at','updated_at'],
        mural_categories: ['id','name','color'],
        mural_elements: ['id','project_id','type','x','y','w','h','content','color','z_index','shape','from_id','to_id','connector_style','from_side','to_side','line_style','arrow_mode'],
        vision_affirmations: ['id','vision_id','text','order','bg_style','is_pinned','is_favorite','favorite_at','duration','media_key','audio_url','created_at'],
        ritual_logs: ['id','date','duration_seconds','affirmation_count','mood_after','completed'],
        english_sessions: ['id','date','duration_seconds','topic','level','score','weak_areas','strong_areas','summary','message_count'],
        english_messages: ['id','session_id','role','content','correction','feedback','timestamp']
    };

    // Tables with UNIQUE(user_id) — auto-provisioned on signup, must upsert on user_id
    const SINGLETON_TABLES = new Set(['settings', 'reader_settings', 'pomodoro_settings']);

    // Column type maps
    const BOOL_COLS = {
        habits: ['alarm_enabled'],
        people: ['is_favorite', 'is_priority'],
        reminders: ['is_active'],
        diary_templates: ['is_default'],
        settings: ['notification_enabled', 'diary_show_tasks', 'diary_show_habits', 'diary_show_expenses'],
        notes: ['is_pinned'],
        pomodoro_sessions: ['completed'],
        pomodoro_settings: ['auto_start_break'],
        reader_settings: ['fullscreen_mode', 'auto_save_position'],
        vision_affirmations: ['is_pinned', 'is_favorite'],
        ritual_logs: ['completed']
    };

    const NUM_COLS = {
        tasks: ['duration', 'pomodoro_estimate', 'pomodoro_length'],
        expenses: ['amount'],
        habits: ['streak', 'pomodoro_sessions', 'pomodoro_length'],
        habit_logs: ['pomodoro_completed'],
        vision_board: ['progress'],
        settings: ['weekly_budget', 'monthly_budget'],
        funds: ['balance'],
        assets: ['value'],
        people_debts: ['amount'],
        diary_templates: ['sort_order'],
        diary_tags: ['usage_count'],
        diary_achievements: ['target_value'],
        gym_workouts: ['duration_minutes', 'sets', 'reps', 'weight'],
        pomodoro_settings: ['work_duration', 'short_break', 'long_break', 'long_break_interval'],
        pomodoro_sessions: ['duration'],
        pomodoro_badges: ['total_sessions'],
        book_library: ['rating'],
        book_summaries: ['total_pages'],
        reader_settings: ['font_size', 'line_spacing'],
        mural_elements: ['x', 'y', 'w', 'h', 'z_index'],
        vision_affirmations: ['order', 'duration'],
        ritual_logs: ['duration_seconds', 'affirmation_count'],
        english_sessions: ['duration_seconds', 'score', 'message_count']
    };

    const DATE_COLS = {
        tasks: ['due_date', 'recurrence_end'],
        expenses: ['date'],
        habit_logs: ['date'],
        diary: ['date'],
        vision_board: ['target_date'],
        settings: ['dob'],
        assets: ['purchase_date'],
        people: ['birthday', 'last_contact', 'next_interaction'],
        people_debts: ['date'],
        gym_workouts: ['date'],
        pomodoro_sessions: ['date'],
        vision_tdp: ['start_date', 'end_date'],
        book_library: ['date_added', 'date_completed'],
        ritual_logs: ['date'],
        english_sessions: ['date']
    };

    const TS_COLS = {
        planner_events: ['start_datetime', 'end_datetime'],
        vision_board: ['created_at', 'updated_at'],
        diary_tags: ['created_at'],
        diary_achievements: ['unlocked_at'],
        notes: ['created_at', 'updated_at'],
        vision_images: ['uploaded_at'],
        pomodoro_badges: ['unlocked_at'],
        vision_tdp: ['created_at'],
        book_summaries: ['created_at'],
        mural_projects: ['created_at', 'updated_at'],
        vision_affirmations: ['created_at', 'favorite_at'],
        reminders: ['reminder_datetime'],
        english_messages: ['timestamp']
    };

    const JSON_COLS = {
        tasks: ['completed_dates', 'subtasks'],
        vision_board: ['linked_habits'],
        settings: ['category_budgets'],
        book_library: ['linked_goals'],
        book_summaries: ['summary_json', 'linked_vision_ids'],
        vision_tdp: ['categories_json']
    };

    // ───────────────────────────────────────────────────────────────────────
    // Public entry point
    // ───────────────────────────────────────────────────────────────────────
    window.importFromSheets = async function importFromSheets(opts = {}) {
        const dryRun = !!opts.dryRun;
        const onlyTables = opts.only ? new Set(Array.isArray(opts.only) ? opts.only : [opts.only]) : null;

        // ── Preflight
        if (!window.supabase || !window.supabase.from) {
            console.error('[Importer] Supabase client not ready. Make sure SUPABASE_CONFIG.enabled = true and you have built the app.');
            return;
        }
        const { data: { user }, error: userErr } = await window.supabase.auth.getUser();
        if (userErr || !user) {
            console.error('[Importer] Not signed in. Sign in first, then re-run importFromSheets().');
            return;
        }
        const userId = user.id;
        const banner = dryRun ? 'DRY RUN' : 'LIVE IMPORT';
        console.log(`%c[Importer] ${banner} → user=${user.email} (${userId.slice(0, 8)}…)`,
            'color:#4F46E5;font-weight:700;font-size:14px');

        if (!dryRun && !confirm(`Import all Google Sheet data to Supabase for ${user.email}?\nSafe to re-run — existing rows are updated, not duplicated.`)) {
            console.log('[Importer] Cancelled by user.');
            return;
        }

        const summary = { ok: [], failed: [], skipped: [] };
        const tables = onlyTables ? TABLES.filter(t => onlyTables.has(t)) : TABLES;

        for (const table of tables) {
            console.groupCollapsed(`%c${table}`, 'color:#0F172A;font-weight:600');
            try {
                // Fetch from Google Sheet
                const url = `${SHEET_API}?sheet=${table}&action=get&t=${Date.now()}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const raw = Array.isArray(json) ? json : (json.data || []);
                console.log(`Sheet: ${raw.length} rows`);

                if (raw.length === 0) {
                    summary.skipped.push({ table, reason: 'empty' });
                    console.log('Skipped (empty sheet)');
                    console.groupEnd();
                    continue;
                }

                // Transform
                const allowed = ALLOWED[table];
                const rows = raw
                    .map(r => transformRow(table, r, allowed, userId))
                    .filter(r => r && r.id);

                console.log(`Transformed: ${rows.length} rows`);
                console.log('Sample:', rows[0]);

                if (dryRun) {
                    summary.ok.push({ table, rows: rows.length, dryRun: true });
                    console.groupEnd();
                    continue;
                }

                // Upsert in batches of 100
                const batchSize = 100;
                let inserted = 0;
                const isSingleton = SINGLETON_TABLES.has(table);
                const conflictCol = isSingleton ? 'user_id' : 'id';

                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    const { data, error } = await window.supabase
                        .from(table)
                        .upsert(batch, { onConflict: conflictCol })
                        .select('id');
                    if (error) {
                        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
                        summary.failed.push({ table, msg: error.message, batchStart: i });
                        break;
                    }
                    inserted += data?.length || 0;
                }

                console.log(`%c→ Inserted ${inserted}/${rows.length}`, 'color:#059669;font-weight:600');
                summary.ok.push({ table, rows: inserted, total: rows.length });
            } catch (e) {
                console.error('Failed:', e.message);
                summary.failed.push({ table, msg: e.message });
            }
            console.groupEnd();
        }

        // Final report
        console.log(`%c━━━ IMPORT COMPLETE ━━━`, 'color:#4F46E5;font-weight:700;font-size:14px');
        console.log(`Tables succeeded: ${summary.ok.length}`);
        console.log(`Rows imported:    ${summary.ok.reduce((s, t) => s + (t.rows || 0), 0)}`);
        console.log(`Tables skipped:   ${summary.skipped.length} (empty)`);
        if (summary.failed.length) {
            console.warn(`Tables with errors: ${summary.failed.length}`);
            console.table(summary.failed);
        }
        if (!dryRun && summary.ok.length > 0) {
            console.log('%cReloading in 2s to refresh app state…', 'color:#9097A1');
            setTimeout(() => location.reload(), 2000);
        }
        return summary;
    };

    // ───────────────────────────────────────────────────────────────────────
    // Row transformation
    // ───────────────────────────────────────────────────────────────────────
    function transformRow(table, sourceRow, allowed, userId) {
        if (!sourceRow || typeof sourceRow !== 'object') return null;
        const out = {};

        // 1. Strip to allowed columns only
        if (allowed) {
            Object.keys(sourceRow).forEach(k => {
                if (allowed.includes(k)) out[k] = sourceRow[k];
            });
        } else {
            Object.assign(out, sourceRow);
        }

        // 2. Clean empty values
        Object.keys(out).forEach(k => {
            const v = out[k];
            if (v === '' || v === null || v === undefined || v === 'undefined' || v === 'null' || v === 'NULL') {
                delete out[k];
            }
        });

        // 3. Ensure id is a non-empty string
        if (out.id === undefined || out.id === null || out.id === '') {
            out.id = String(Date.now()) + Math.floor(Math.random() * 10000);
        } else {
            out.id = String(out.id);
        }

        // 4. Stamp user_id
        out.user_id = userId;

        // 5. Type coercion
        coerceTypes(table, out);

        return out;
    }

    function coerceTypes(table, row) {
        // Booleans
        (BOOL_COLS[table] || []).forEach(col => {
            if (col in row) {
                const v = row[col];
                row[col] = v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
            }
        });

        // Numbers
        (NUM_COLS[table] || []).forEach(col => {
            if (col in row) {
                const v = Number(row[col]);
                if (Number.isFinite(v)) row[col] = v;
                else delete row[col];
            }
        });

        // Dates (DATE columns expect YYYY-MM-DD)
        (DATE_COLS[table] || []).forEach(col => {
            if (col in row && row[col]) {
                const v = String(row[col]).trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
                    row[col] = v.slice(0, 10);
                } else {
                    const d = new Date(v);
                    if (!isNaN(d.getTime())) row[col] = d.toISOString().slice(0, 10);
                    else delete row[col];
                }
            }
        });

        // Timestamps (TIMESTAMPTZ columns)
        (TS_COLS[table] || []).forEach(col => {
            if (col in row && row[col]) {
                const d = new Date(row[col]);
                if (!isNaN(d.getTime())) row[col] = d.toISOString();
                else delete row[col];
            }
        });

        // JSON columns — parse strings to objects/arrays
        (JSON_COLS[table] || []).forEach(col => {
            if (col in row && typeof row[col] === 'string') {
                try { row[col] = JSON.parse(row[col]); }
                catch (e) { /* leave as string; Postgres will JSONB-cast strings too */ }
            }
        });
    }

    console.log('[Importer] Loaded. Run `importFromSheets()` in console to migrate, or `importFromSheets({ dryRun: true })` to preview.');
})();
