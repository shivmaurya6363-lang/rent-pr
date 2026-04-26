
-- Drop existing restrictive policies on slider_images
DROP POLICY IF EXISTS "Admins can manage slider images" ON public.slider_images;
DROP POLICY IF EXISTS "Anyone can view active slider images" ON public.slider_images;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage slider images"
ON public.slider_images
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active slider images"
ON public.slider_images
FOR SELECT
TO anon, authenticated
USING (is_active = true);
