
-- Allow vendors to view addresses that belong to their orders
CREATE POLICY "Vendors can view addresses for their orders"
ON public.addresses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.address_id = addresses.id
    AND o.vendor_id = get_vendor_id(auth.uid())
  )
);

-- Allow admins to view all addresses
CREATE POLICY "Admins can view all addresses"
ON public.addresses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
