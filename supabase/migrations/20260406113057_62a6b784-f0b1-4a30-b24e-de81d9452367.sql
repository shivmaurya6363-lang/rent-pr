
-- Add cost fields to product_variations
ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS landing_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_reserve numeric DEFAULT 0;

-- Allow vendors to delete their own products
CREATE POLICY "Vendors can delete their own products"
ON public.products
FOR DELETE
TO authenticated
USING (vendor_id = get_vendor_id(auth.uid()));

-- Allow cascading deletes on rental_plans when product is deleted
CREATE POLICY "Vendors can delete their product plans"
ON public.rental_plans
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = rental_plans.product_id
  AND p.vendor_id = get_vendor_id(auth.uid())
));

-- Allow cascading deletes on product_variations
CREATE POLICY "Vendors can delete their product variations"
ON public.product_variations
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_variations.product_id
  AND p.vendor_id = get_vendor_id(auth.uid())
));

-- Allow cascading deletes on product_locations
CREATE POLICY "Vendors can delete their product locations"
ON public.product_locations
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_locations.product_id
  AND p.vendor_id = get_vendor_id(auth.uid())
));
