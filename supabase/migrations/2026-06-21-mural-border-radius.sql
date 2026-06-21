-- Adjustable corner radius for Mural rectangle shapes (rect = sharp, rounded = curved).
-- Stored in pixels; null means "use the shape's default" (0 for rect, 16 for rounded).
-- Safe to run multiple times.
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS border_radius NUMERIC(6,2);
