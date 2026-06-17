-- Add payment_mode to expenses so a transaction's payment method (Cash/UPI/Card…) persists.
-- Safe to run multiple times.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_mode TEXT;
