
-- Fix slider_images policies: MUST be PERMISSIVE not RESTRICTIVE
DROP POLICY IF EXISTS "Admins can manage slider images" ON public.slider_images;
DROP POLICY IF EXISTS "Anyone can view active slider images" ON public.slider_images;

CREATE POLICY "Admins can manage slider images"
ON public.slider_images AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active slider images"
ON public.slider_images AS PERMISSIVE
FOR SELECT TO anon, authenticated
USING (is_active = true);
