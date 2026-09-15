-- Time Tracker — the "Time spent on" feature linked from the Pomodoro page:
-- a grid of 6 category stopwatches (goal, name, running state persisted so a
-- session survives reload/navigation) plus a log of every play->pause interval,
-- used by the Analysis page's charts. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.time_categories (
    id              TEXT PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_index      INT NOT NULL DEFAULT 0,      -- 0-5, fixed position in the 3x2 grid
    name            TEXT DEFAULT 'Category',
    goal_minutes    INT DEFAULT 0,                -- editable daily target shown next to the name
    elapsed_seconds INT DEFAULT 0,                -- accumulated time for the current tracking day
    running         BOOLEAN DEFAULT false,
    running_since   TIMESTAMPTZ,                  -- set while running; NULL while paused
    day             DATE DEFAULT CURRENT_DATE,    -- the day elapsed_seconds belongs to (rolls to 0 next day)
    todos_json      TEXT DEFAULT '[]',            -- JSON array of {id, text, done}
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, slot_index)
);

CREATE TABLE IF NOT EXISTS public.time_logs (
    id               TEXT PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id      TEXT,                        -- references time_categories.id
    category_name    TEXT,                        -- snapshot of the name at logging time
    date             DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_seconds INT NOT NULL DEFAULT 0,
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.time_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_categories_owner_all" ON public.time_categories;
CREATE POLICY "time_categories_owner_all" ON public.time_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "time_logs_owner_all" ON public.time_logs;
CREATE POLICY "time_logs_owner_all" ON public.time_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_time_categories_user ON public.time_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_date ON public.time_logs(user_id, date DESC);

DROP TRIGGER IF EXISTS trg_time_categories_updated_at ON public.time_categories;
CREATE TRIGGER trg_time_categories_updated_at BEFORE UPDATE ON public.time_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_time_logs_updated_at ON public.time_logs;
CREATE TRIGGER trg_time_logs_updated_at BEFORE UPDATE ON public.time_logs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
