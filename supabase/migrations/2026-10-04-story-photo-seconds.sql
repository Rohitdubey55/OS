-- How long each photo stays on screen in Vision stories (one value for all stories).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS story_photo_seconds INTEGER;
