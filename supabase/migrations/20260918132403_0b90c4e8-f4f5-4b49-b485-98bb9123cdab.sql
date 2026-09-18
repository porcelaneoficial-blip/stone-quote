ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS stock_quantity numeric NOT NULL DEFAULT 0;
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS stock_quantity numeric NOT NULL DEFAULT 0;