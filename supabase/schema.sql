-- ============================================================================
-- PersonalOS — Supabase Schema Migration
-- Run this in Supabase SQL Editor after creating a fresh project.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY.
-- ============================================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- TABLES
-- Every table:
--   - id TEXT PRIMARY KEY (app generates string IDs, kept for compatibility)
--   - user_id UUID → auth.users(id), NOT NULL (multi-tenancy)
--   - created_at, updated_at timestamps
--   - Plus all columns from the original Google Sheet schema
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.planner_events (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    category TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    due_date DATE,
    due_time TEXT,
    priority TEXT,
    status TEXT,
    notes TEXT,
    description TEXT,
    category TEXT,
    tags TEXT,
    vision_id TEXT,
    recurrence TEXT,
    recurrence_days TEXT,
    recurrence_end DATE,
    completed_dates JSONB,
    completed_at TIMESTAMPTZ,
    duration INT,
    subtasks JSONB,
    pomodoro_estimate INT,
    pomodoro_length INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    amount NUMERIC(14,2),
    category TEXT,
    description TEXT,
    type TEXT,
    payment_mode TEXT,
    budget_scope TEXT,          -- 'weekly' (day-to-day; counts toward weekly + monthly) or 'monthly' (big bill; monthly only)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.habits (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_name TEXT,
    frequency TEXT,
    streak INT DEFAULT 0,
    reminder_time TEXT,
    emoji TEXT,
    pomodoro_sessions INT,
    pomodoro_length INT,
    alarm_enabled BOOLEAN DEFAULT false,
    routine TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id TEXT,
    date DATE,
    status TEXT,
    pomodoro_completed INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    content TEXT,
    mood TEXT,
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vision_board (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT,
    title TEXT,
    description TEXT,
    image_url TEXT,
    target_date DATE,
    progress INT DEFAULT 0,
    status TEXT,
    notes TEXT,
    linked_habits JSONB,
    video_url TEXT,
    month_focus TEXT,
    color TEXT,
    display_mode TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    dob DATE,
    morning_message TEXT,
    afternoon_message TEXT,
    evening_message TEXT,
    weekly_budget NUMERIC(14,2),
    monthly_budget NUMERIC(14,2),
    category_budgets JSONB,
    theme_color TEXT,
    theme_mode TEXT,
    orientation_lock TEXT,
    ai_api_key TEXT,
    ai_model TEXT,
    nav_layout TEXT,
    dashboard_config TEXT,
    kpi_config TEXT,
    bento_config TEXT,
    dashboard_tiles TEXT,
    mobile_dashboard_tiles TEXT,
    notification_enabled BOOLEAN,
    notification_sound TEXT,
    notification_method TEXT,
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    diary_default_mood TEXT,
    diary_show_tasks BOOLEAN,
    diary_show_habits BOOLEAN,
    diary_show_expenses BOOLEAN,
    task_default_view TEXT,
    task_categories TEXT,
    habit_routines TEXT,
    elevenlabs_api_key TEXT,
    elevenlabs_voice_id TEXT,
    tts_provider TEXT,
    tts_voice_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.funds (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    balance NUMERIC(14,2),
    type TEXT,
    currency TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    value NUMERIC(14,2),
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.people (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    relationship TEXT,
    birthday DATE,
    phone TEXT,
    email TEXT,
    instagram TEXT,
    last_contact DATE,
    next_interaction DATE,
    is_favorite BOOLEAN DEFAULT false,
    is_priority BOOLEAN DEFAULT false,
    notes TEXT,
    contact_frequency INTEGER,   -- per-person cadence override in days; NULL = use relationship default
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.people_debts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id TEXT,
    amount NUMERIC(14,2),
    type TEXT,
    date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminders (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    reminder_datetime TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    linked_item_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary_templates (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    category TEXT,
    is_default BOOLEAN DEFAULT false,
    sort_order INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary_tags (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    color TEXT,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary_achievements (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT,
    name TEXT,
    description TEXT,
    target_value INT,
    unlocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_workouts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    exercise_name TEXT,
    workout_type TEXT,
    duration_minutes INT,
    sets INT,
    reps INT,
    weight NUMERIC(8,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_exercises (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    muscle_group TEXT,
    equipment TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    category TEXT,
    is_pinned BOOLEAN DEFAULT false,
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wishlist (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    type TEXT,                       -- 'buy' | 'experience' | 'gift'
    price NUMERIC(14,2),
    priority TEXT,                   -- 'high' | 'medium' | 'low'
    url TEXT,
    image_url TEXT,
    category TEXT,                   -- managed category (primary grouping)
    for_person TEXT,
    notes TEXT,
    status TEXT DEFAULT 'wanted',    -- 'wanted' | 'got' | 'archived'
    got_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vision_images (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vision_id TEXT,
    file_id TEXT,
    url TEXT,
    name TEXT,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pomodoro_settings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    work_duration INT,
    short_break INT,
    long_break INT,
    long_break_interval INT,
    sound_work TEXT,
    sound_break TEXT,
    auto_start_break BOOLEAN DEFAULT false,
    background_mode TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    type TEXT,
    duration INT,
    habit_id TEXT,
    task_id TEXT,
    completed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pomodoro_badges (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_type TEXT,
    unlocked_at TIMESTAMPTZ,
    total_sessions INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vision_tdp (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    status TEXT,
    categories_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.book_library (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    author TEXT,
    cover_url TEXT,
    category TEXT,
    status TEXT,
    date_added DATE,
    date_completed DATE,
    rating INT,
    notes TEXT,
    linked_goals JSONB,
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.book_summaries (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id TEXT,
    book_title TEXT,
    author TEXT,
    summary_json JSONB,
    total_pages INT,
    linked_vision_ids JSONB,
    key_takeaways TEXT,
    action_items TEXT,
    memorable_quotes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reader_settings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    background_color TEXT,
    font_color TEXT,
    font_family TEXT,
    font_size INT,
    line_spacing NUMERIC(4,2),
    fullscreen_mode BOOLEAN DEFAULT false,
    page_animation TEXT,
    auto_save_position BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mural_projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    category TEXT,
    bg_pattern TEXT,
    bg_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mural_categories (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mural_elements (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT,
    type TEXT,
    x NUMERIC(10,2),
    y NUMERIC(10,2),
    w NUMERIC(10,2),
    h NUMERIC(10,2),
    content TEXT,
    color TEXT,
    z_index INT,
    shape TEXT,
    from_id TEXT,
    to_id TEXT,
    connector_style TEXT,
    from_side TEXT,
    to_side TEXT,
    line_style TEXT,
    arrow_mode TEXT,
    font_size INTEGER,
    text_color TEXT,
    bold BOOLEAN,
    text_align TEXT,
    stroke_width INTEGER,
    from_x NUMERIC(10,2),
    from_y NUMERIC(10,2),
    to_x NUMERIC(10,2),
    to_y NUMERIC(10,2),
    from_rx NUMERIC(6,4),
    from_ry NUMERIC(6,4),
    to_rx NUMERIC(6,4),
    to_ry NUMERIC(6,4),
    border_radius NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vision_affirmations (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vision_id TEXT,
    text TEXT,
    "order" INT,
    bg_style TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    favorite_at TIMESTAMPTZ,
    duration INT,
    media_key TEXT,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ritual_logs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    duration_seconds INT,
    affirmation_count INT,
    mood_after TEXT,
    completed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.english_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE,
    duration_seconds INT,
    topic TEXT,
    level TEXT,
    score INT,
    weak_areas TEXT,
    strong_areas TEXT,
    summary TEXT,
    message_count INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.english_messages (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    role TEXT,
    content TEXT,
    correction TEXT,
    feedback TEXT,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INDEXES — speed up the most common queries
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'planner_events','tasks','expenses','habits','habit_logs','diary',
        'vision_board','funds','assets','people','people_debts','reminders',
        'diary_templates','diary_tags','diary_achievements','gym_workouts',
        'gym_exercises','notes','vision_images','pomodoro_sessions',
        'pomodoro_badges','vision_tdp','book_library','book_summaries',
        'mural_projects','mural_categories','mural_elements','vision_affirmations',
        'ritual_logs','english_sessions','english_messages','wishlist'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON public.%I(user_id);', tbl, tbl);
    END LOOP;
END $$;

-- Date indexes on frequently-queried date columns
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON public.diary(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_start ON public.planner_events(user_id, start_datetime);

-- ----------------------------------------------------------------------------
-- updated_at triggers — auto-update on every UPDATE
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'planner_events','tasks','expenses','habits','habit_logs','diary',
        'vision_board','settings','funds','assets','people','people_debts',
        'reminders','diary_templates','diary_tags','diary_achievements',
        'gym_workouts','gym_exercises','notes','vision_images',
        'pomodoro_settings','pomodoro_sessions','pomodoro_badges','vision_tdp',
        'book_library','book_summaries','reader_settings','mural_projects',
        'mural_categories','mural_elements','vision_affirmations','ritual_logs',
        'english_sessions','english_messages','wishlist'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl, tbl);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — each user only sees / writes their own rows
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'planner_events','tasks','expenses','habits','habit_logs','diary',
        'vision_board','settings','funds','assets','people','people_debts',
        'reminders','diary_templates','diary_tags','diary_achievements',
        'gym_workouts','gym_exercises','notes','vision_images',
        'pomodoro_settings','pomodoro_sessions','pomodoro_badges','vision_tdp',
        'book_library','book_summaries','reader_settings','mural_projects',
        'mural_categories','mural_elements','vision_affirmations','ritual_logs',
        'english_sessions','english_messages','wishlist'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "users own data select" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "users own data insert" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "users own data update" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "users own data delete" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "users own data select" ON public.%I FOR SELECT USING (auth.uid() = user_id);', tbl);
        EXECUTE format('CREATE POLICY "users own data insert" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id);', tbl);
        EXECUTE format('CREATE POLICY "users own data update" ON public.%I FOR UPDATE USING (auth.uid() = user_id);', tbl);
        EXECUTE format('CREATE POLICY "users own data delete" ON public.%I FOR DELETE USING (auth.uid() = user_id);', tbl);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- AUTO-PROVISION settings + reader_settings + pomodoro_settings on new user
-- These three are "1 row per user" tables — pre-create the row on signup
-- so the app never has to special-case "no settings yet".
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.settings (id, user_id, name)
    VALUES (gen_random_uuid()::TEXT, NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'You'))
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.reader_settings (id, user_id, background_color, font_color, font_family, font_size, line_spacing)
    VALUES (gen_random_uuid()::TEXT, NEW.id, '#FFFFFF', '#0F172A', 'Inter', 16, 1.6)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.pomodoro_settings (id, user_id, work_duration, short_break, long_break, long_break_interval)
    VALUES (gen_random_uuid()::TEXT, NEW.id, 25, 5, 15, 4)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- DONE. Result: 35 tables, RLS enforced, auto-provisioned defaults.
-- ============================================================================
