-- Add per-event color to planner_events so users can color-code calendar events.
-- Stores a hex string like '#4F46E5'; NULL/empty = "Auto" (fall back to category color).
-- Safe to run multiple times.
ALTER TABLE public.planner_events ADD COLUMN IF NOT EXISTS color TEXT;
