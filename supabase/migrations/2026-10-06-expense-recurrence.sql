-- Upcoming expenses can repeat every month ("Repeats every month" in Finance).
-- Upcoming items themselves need no change: they're expenses with type = 'upcoming'.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recurrence TEXT;
