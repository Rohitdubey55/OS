-- Weekly Food Planner — plan Breakfast/Lunch/Dinner across the week, log what was
-- actually eaten, and a daily mood/energy + "ate healthy?" check-in for long-term
-- analysis of how food affects energy and mood. Safe to run multiple times.

-- One row per (date, slot): the plan vs. what was eaten.
CREATE TABLE IF NOT EXISTS public.meal_plan (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE,                       -- the day this meal belongs to
    slot        TEXT,                       -- 'breakfast' | 'lunch' | 'dinner'
    planned     TEXT,                       -- what you intend to eat
    eaten       TEXT,                       -- what you actually ate
    status      TEXT,                       -- 'as_planned' | 'different' | 'skipped'
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meal_plan_owner_all" ON public.meal_plan;
CREATE POLICY "meal_plan_owner_all" ON public.meal_plan
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_user ON public.meal_plan(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_date ON public.meal_plan(date);

-- One row per day: the mood/energy check-in + healthy-eating flag.
CREATE TABLE IF NOT EXISTS public.meal_day (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE,
    mood        INT,                        -- 1..5
    energy      INT,                        -- 1..5
    ate_healthy BOOLEAN,                    -- "did I eat well today?"
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meal_day ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meal_day_owner_all" ON public.meal_day;
CREATE POLICY "meal_day_owner_all" ON public.meal_day
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_day_user ON public.meal_day(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_day_date ON public.meal_day(date);
