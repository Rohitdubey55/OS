-- The Ten Days Plan moved out of Vision into its own Daily Tools page, and its
-- items now file under the same categories as tasks and habits — so a "Time
-- spent on" card can pull in the active plan's items for its category, with a
-- play button and a tick, the same as everything else on the card.
--
-- An item lives inside vision_tdp.categories_json rather than a table of its
-- own, so tracked time points at it by the handle the plan gives it.
-- Safe to run multiple times.

ALTER TABLE public.time_logs       ADD COLUMN IF NOT EXISTS tdp_item_id        TEXT;  -- plan item this stretch was worked on
ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS active_tdp_item_id TEXT;  -- plan item the clock is on

CREATE INDEX IF NOT EXISTS idx_time_logs_tdp ON public.time_logs(user_id, tdp_item_id);

-- created_at was being sent on every plan write but silently dropped.
ALTER TABLE public.vision_tdp ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
