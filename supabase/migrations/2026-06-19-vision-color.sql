-- Add per-goal color to vision_board so Vision cards can use a chosen color
-- (from the color wheel) instead of an image. Stores a hex like '#4F46E5'.
-- Safe to run multiple times.
ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS color TEXT;
-- Per-goal board display: 'color' (default) or 'image'.
ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS display_mode TEXT;
