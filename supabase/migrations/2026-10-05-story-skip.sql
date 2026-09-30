-- Photos/videos to leave out of a vision's story (JSON list of media ids).
ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS story_skip TEXT;
