
-- Fix categories: Drop restrictive SELECT policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
CREATE POLICY "Anyone can view active categories"
ON public.categories
FOR SELECT
USING (is_active = true);

-- Fix products: Drop restrictive SELECT policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
CREATE POLICY "Anyone can view approved products"
ON public.products
FOR SELECT
USING (status = 'approved'::product_status);

DROP POLICY IF EXISTS "Authenticated users can view products for checkout" ON public.products;
CREATE POLICY "Authenticated users can view products for checkout"
ON public.products
FOR SELECT
USING (true);

-- Fix locations: Drop restrictive SELECT policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view active locations" ON public.locations;
CREATE POLICY "Anyone can view active locations"
ON public.locations
FOR SELECT
USING (is_active = true);

-- Fix rental_plans: Drop restrictive SELECT policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view active rental plans" ON public.rental_plans;
CREATE POLICY "Anyone can view active rental plans"
ON public.rental_plans
FOR SELECT
USING (is_active = true);
