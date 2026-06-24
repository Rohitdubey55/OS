-- "Things I can eat" library for the Food Planner: a reusable list of foods you can
-- pick from when planning Breakfast / Lunch / Dinner. Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.meal_items (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    slots       TEXT,                       -- CSV of 'breakfast,lunch,dinner'; empty = any
    healthy     TEXT,                       -- 'healthy' | 'ok' | 'treat'
    favorite    BOOLEAN DEFAULT false,
    use_count   INT DEFAULT 0,              -- how often picked (for ranking)
    notes       TEXT,
    sort_order  INT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meal_items_owner_all" ON public.meal_items;
CREATE POLICY "meal_items_owner_all" ON public.meal_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_user ON public.meal_items(user_id);
