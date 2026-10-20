-- Day Plan in the journal editor: let a planner block be ticked off.
-- Ticking a block in the journal (or in the Planner) sets done = true,
-- and the Planner draws it struck through.
ALTER TABLE public.planner_events ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false;
