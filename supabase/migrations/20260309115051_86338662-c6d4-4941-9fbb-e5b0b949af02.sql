
-- Fix product_locations: convert RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Admins can manage all product locations" ON public.product_locations;
DROP POLICY IF EXISTS "Anyone can view product locations" ON public.product_locations;
DROP POLICY IF EXISTS "Vendors can manage their product locations" ON public.product_locations;

CREATE POLICY "Admins can manage all product locations"
ON public.product_locations AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view product locations"
ON public.product_locations AS PERMISSIVE FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Vendors can manage their product locations"
ON public.product_locations AS PERMISSIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_locations.product_id AND p.vendor_id = get_vendor_id(auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_locations.product_id AND p.vendor_id = get_vendor_id(auth.uid())));
