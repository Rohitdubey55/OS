-- Time Tracker × Tasks: each stopwatch card is linked to one of the Tasks app's
-- categories and shows that category's live tasks, so a card's to-do list and the
-- Tasks app are the same data. Play on a task runs its category's stopwatch, and
-- the interval is logged against that task. Safe to run multiple times.

ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS task_category  TEXT;  -- linked Tasks category
ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS active_task_id TEXT;  -- task the clock is on

ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS task_id    TEXT;  -- tasks.id this interval was worked on
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS task_title TEXT;  -- snapshot of the title at logging time

CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.time_logs(user_id, task_id);
