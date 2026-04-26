
-- Re-assert columns to force schema cache refresh
ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS landing_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_reserve numeric DEFAULT 0;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
