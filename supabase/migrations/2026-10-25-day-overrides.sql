-- Per-day time overrides for the Journal planner (drag & drop).
-- Moving a habit, a repeating task, a meal or the workout on the day timeline
-- changes it for THAT date only; one row per (date, kind, ref_id).
-- Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.day_overrides (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE,
    kind        TEXT,          -- 'habit' | 'task' | 'food' | 'gym'
    ref_id      TEXT,          -- habit id, task id, meal slot key, or 'gym'
    time        TEXT,          -- 'HH:MM'
    duration    INT,           -- minutes
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.day_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "day_overrides_owner_all" ON public.day_overrides;
CREATE POLICY "day_overrides_owner_all" ON public.day_overrides
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_day_overrides_user_date ON public.day_overrides(user_id, date);
