
-- Storage bucket for slider images
INSERT INTO storage.buckets (id, name, public) VALUES ('slider-images', 'slider-images', true);

-- Allow anyone to view slider images
CREATE POLICY "Anyone can view slider images" ON storage.objects FOR SELECT USING (bucket_id = 'slider-images');

-- Allow admins to manage slider images
CREATE POLICY "Admins can manage slider images" ON storage.objects FOR ALL USING (
  bucket_id = 'slider-images' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Slider images table for ordering and metadata
CREATE TABLE public.slider_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT DEFAULT 'Browse Products',
  cta_link TEXT DEFAULT '/products',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.slider_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active slider images" ON public.slider_images FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage slider images" ON public.slider_images FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Product variations table
CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_type TEXT NOT NULL, -- e.g. "Model", "Size", "Capacity"
  variation_value TEXT NOT NULL, -- e.g. "1 Ton", "2 Ton"
  price_adjustment NUMERIC DEFAULT 0, -- additional cost per month
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active variations" ON public.product_variations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage all variations" ON public.product_variations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Vendors can manage their product variations" ON public.product_variations FOR ALL 
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_variations.product_id AND p.vendor_id = get_vendor_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_variations.product_id AND p.vendor_id = get_vendor_id(auth.uid())));
