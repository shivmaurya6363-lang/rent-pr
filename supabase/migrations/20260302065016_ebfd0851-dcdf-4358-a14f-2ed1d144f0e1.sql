
-- Fix rental_plans: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Vendors can manage their product plans" ON public.rental_plans;
DROP POLICY IF EXISTS "Admins can manage all rental plans" ON public.rental_plans;
DROP POLICY IF EXISTS "Anyone can view active rental plans" ON public.rental_plans;

CREATE POLICY "Vendors can manage their product plans"
  ON public.rental_plans FOR ALL
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = rental_plans.product_id AND p.vendor_id = get_vendor_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = rental_plans.product_id AND p.vendor_id = get_vendor_id(auth.uid())));

CREATE POLICY "Admins can manage all rental plans"
  ON public.rental_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active rental plans"
  ON public.rental_plans FOR SELECT
  USING (is_active = true);

-- Fix products: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Vendors can view their own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can create products" ON public.products;
DROP POLICY IF EXISTS "Vendors can update their own products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products for checkout" ON public.products;

CREATE POLICY "Vendors can view their own products"
  ON public.products FOR SELECT
  USING (vendor_id = get_vendor_id(auth.uid()));

CREATE POLICY "Vendors can create products"
  ON public.products FOR INSERT
  WITH CHECK (vendor_id = get_vendor_id(auth.uid()));

CREATE POLICY "Vendors can update their own products"
  ON public.products FOR UPDATE
  USING (vendor_id = get_vendor_id(auth.uid()));

CREATE POLICY "Admins can manage all products"
  ON public.products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view approved products"
  ON public.products FOR SELECT
  USING (status = 'approved'::product_status);

CREATE POLICY "Authenticated users can view products for checkout"
  ON public.products FOR SELECT
  USING (true);
