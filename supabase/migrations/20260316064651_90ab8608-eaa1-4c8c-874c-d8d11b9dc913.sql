
-- Add delivery TAT and installation TAT columns to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS delivery_tat integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS installation_tat integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS protection_value numeric DEFAULT NULL;
