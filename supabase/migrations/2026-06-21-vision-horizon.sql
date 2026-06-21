-- Adds a "horizon" (time-frame) to vision goals: month / 3month / 3year / 10year.
-- Lets goals be grouped/filtered by how far out they are (This Month → 10 Years).
ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS horizon TEXT;
