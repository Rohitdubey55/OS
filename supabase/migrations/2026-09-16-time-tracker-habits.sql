-- Time Tracker × Habits: a card can also pull in a habit routine (Morning / Work
-- / Evening …), since habits are grouped by routine rather than category. Play on
-- a habit runs the card's stopwatch with that habit as the active item, and the
-- interval is logged against it. Safe to run multiple times.

ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS habit_routine   TEXT;  -- linked habit routine ('*all*' = every habit)
ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS active_habit_id TEXT;  -- habit the clock is on

ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS habit_id TEXT;  -- habits.id this interval was worked on
-- time_logs.task_title doubles as the label for whichever item was tracked.

CREATE INDEX IF NOT EXISTS idx_time_logs_habit ON public.time_logs(user_id, habit_id);

-- Optional: makes the stopwatch state propagate between open devices instantly
-- instead of on the 20-second poll. Skip it and sync still works, just slower.
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_categories;
