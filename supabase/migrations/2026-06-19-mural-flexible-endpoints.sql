-- Flexible connector endpoints for Mural:
--   from_rx/from_ry, to_rx/to_ry  → relative anchor on a shape (0..1) so a connector
--                                    can attach at ANY point of a shape (#3)
--   from_x/from_y, to_x/to_y       → absolute free points so an end can float, which
--                                    also powers the standalone Line tool (#8)
-- An endpoint resolves as: shape anchor (id + rx/ry) → named side (legacy) → free point.
-- Safe to run multiple times.
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS from_x  NUMERIC(10,2);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS from_y  NUMERIC(10,2);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS to_x    NUMERIC(10,2);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS to_y    NUMERIC(10,2);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS from_rx NUMERIC(6,4);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS from_ry NUMERIC(6,4);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS to_rx   NUMERIC(6,4);
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS to_ry   NUMERIC(6,4);
