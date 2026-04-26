ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS buy_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS advance_discount_percent numeric DEFAULT 0;