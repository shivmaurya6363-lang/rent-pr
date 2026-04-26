
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS landing_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_reserve numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_charge_visible boolean DEFAULT true;
