-- Background music for a vision's story (set from the pencil inside the story).
-- JSON: {"ref": "builtin:calm" | "local://KEY|drive:sb~PATH", "name": "...", "vol": 0.6}
ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS story_music TEXT;
