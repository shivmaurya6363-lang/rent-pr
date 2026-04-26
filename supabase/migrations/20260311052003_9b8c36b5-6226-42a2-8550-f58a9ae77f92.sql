
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS cancellation_status text DEFAULT NULL;
