-- Track WHEN a task was completed, so the app can keep finished tasks visible at
-- the bottom of their category for a few days (and power completed-task charts).
-- Set to now() on completion, cleared when a task is un-completed. Safe to re-run.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
