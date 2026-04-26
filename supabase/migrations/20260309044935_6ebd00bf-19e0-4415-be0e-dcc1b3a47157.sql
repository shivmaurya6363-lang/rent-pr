
-- Create product_locations junction table for many-to-many relationship
CREATE TABLE public.product_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- Enable RLS
ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;

-- Permissive policies
CREATE POLICY "Anyone can view product locations"
  ON public.product_locations AS PERMISSIVE
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Vendors can manage their product locations"
  ON public.product_locations AS PERMISSIVE
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_locations.product_id
    AND p.vendor_id = public.get_vendor_id(auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_locations.product_id
    AND p.vendor_id = public.get_vendor_id(auth.uid())
  ));

CREATE POLICY "Admins can manage all product locations"
  ON public.product_locations AS PERMISSIVE
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing location_id data into junction table
INSERT INTO public.product_locations (product_id, location_id)
SELECT id, location_id FROM public.products WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;
