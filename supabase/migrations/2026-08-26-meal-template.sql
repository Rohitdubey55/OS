-- Repeatable weekly meal template for the Food Planner.
-- One row per (weekday, slot): the meal you normally eat that day. The week view
-- falls back to this whenever a date+slot has no explicit meal_plan row, so a week
-- is planned by default and only needs marking. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.meal_template (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekday     INT,                        -- 0=Mon .. 6=Sun (matches the Monday-based week grid)
    slot        TEXT,                       -- 'breakfast' | 'lunch' | 'snacks' | 'dinner'
    planned     TEXT,                       -- the usual meal for that weekday+slot
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meal_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meal_template_owner_all" ON public.meal_template;
CREATE POLICY "meal_template_owner_all" ON public.meal_template
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_template_user ON public.meal_template(user_id);
