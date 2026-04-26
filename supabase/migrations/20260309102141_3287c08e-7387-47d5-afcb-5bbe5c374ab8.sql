CREATE TABLE public.mobile_slider_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  subtitle text,
  cta_text text DEFAULT 'Browse Products',
  cta_link text DEFAULT '/products',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_slider_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mobile slider images"
ON public.mobile_slider_images AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active mobile slider images"
ON public.mobile_slider_images AS PERMISSIVE
FOR SELECT TO anon, authenticated
USING (is_active = true);