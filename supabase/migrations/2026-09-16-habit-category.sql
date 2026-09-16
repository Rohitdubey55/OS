-- Habits share the Tasks app's categories.
--
-- A "Time spent on" card links to ONE category and pulls in that category's
-- tasks and habits together. Habits previously had no category at all (the
-- field was dropped from the habit form back when duration was added), so the
-- tracker had to fall back on `routine` — but routine answers a different
-- question ("when in my day does this sit?") and doesn't line up with the way
-- tasks are filed. This adds the column back and the habit form writes it.
--
-- Existing habits come out with category NULL; set one on each habit's edit
-- form (Habits → a habit → Category) and it starts appearing on the matching
-- card. Safe to run multiple times.

ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_habits_user_category ON public.habits(user_id, category);
