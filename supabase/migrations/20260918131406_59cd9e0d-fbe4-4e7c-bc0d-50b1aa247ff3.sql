ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS measured_m2 numeric,
  ADD COLUMN IF NOT EXISTS price_m2 numeric,
  ADD COLUMN IF NOT EXISTS measured_total numeric,
  ADD COLUMN IF NOT EXISTS realized_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS measurer_name text,
  ADD COLUMN IF NOT EXISTS phone text;