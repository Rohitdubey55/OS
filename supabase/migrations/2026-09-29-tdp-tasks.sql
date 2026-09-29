-- The Ten Days Plan stops keeping its own copy of your work.
--
-- Plan items used to live inside vision_tdp.categories_json, which made them
-- invisible to the Tasks app and impossible to give a deadline, a comment or a
-- vision goal without reinventing all three. A plan item is now an ordinary
-- task, tagged with the plan it belongs to and due on the day that plan ends —
-- so it shows up in Tasks, on the stopwatch cards, and in the plan, and ticking
-- it anywhere ticks it everywhere.
--
-- tasks.vision_id already exists, so linking an item to a vision goal needs no
-- new column. Safe to run multiple times.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tdp_plan_id      TEXT;  -- the plan this item belongs to
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tdp_carried_from TEXT;  -- the plan it was carried out of, if any
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS comments_json    TEXT;  -- [{at, text}] running log, newest last

CREATE INDEX IF NOT EXISTS idx_tasks_tdp_plan ON public.tasks(user_id, tdp_plan_id);

-- What worked, what didn't — written once the ten days are up.
ALTER TABLE public.vision_tdp ADD COLUMN IF NOT EXISTS retro TEXT;
