
CREATE POLICY "Vendors can view customer profiles for their orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = profiles.user_id
      AND o.vendor_id = get_vendor_id(auth.uid())
  )
);
