
-- Fix mobile_slider_images policies from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Admins can manage mobile slider images" ON public.mobile_slider_images;
DROP POLICY IF EXISTS "Anyone can view active mobile slider images" ON public.mobile_slider_images;

CREATE POLICY "Admins can manage mobile slider images"
ON public.mobile_slider_images AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active mobile slider images"
ON public.mobile_slider_images AS PERMISSIVE
FOR SELECT TO anon, authenticated
USING (is_active = true);
