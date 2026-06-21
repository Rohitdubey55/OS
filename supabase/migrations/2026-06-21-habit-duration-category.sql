-- Habits: persist the "Duration" (minutes) field shown in the edit modal. It was
-- sent on save but silently dropped because the column didn't exist — so Duration
-- always reverted to its 45-minute default. (The Category field was removed from the
-- habit form, so no column is added for it.) Safe to run multiple times.
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS duration INT;
