-- Countdown timers on the Time Tracker cards: type a number of minutes on a
-- card, press Enter, and the stopwatch runs down instead of up, banking the
-- stretch and pausing itself at zero. The target lives on the row rather than
-- in the browser so a phone and a laptop show the same countdown, and either
-- one can stop it. NULL means the card is just counting up, as before.
-- Safe to run multiple times.

ALTER TABLE public.time_categories ADD COLUMN IF NOT EXISTS timer_target_seconds INT;
