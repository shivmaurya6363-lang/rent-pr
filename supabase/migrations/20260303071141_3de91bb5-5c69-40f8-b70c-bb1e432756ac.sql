
-- Create footer_settings table for admin-editable footer content
CREATE TABLE public.footer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.footer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read footer settings"
ON public.footer_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage footer settings"
ON public.footer_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default footer data
INSERT INTO public.footer_settings (key, value) VALUES
('brand', '{"name": "RentPR", "description": "India''s trusted rental platform. Rent printers, electronics, and more with flexible plans and hassle-free delivery."}'::jsonb),
('contact', '{"address": "Tower B, Sector 44, Gurugram, Haryana 122003", "phone": "+91 98765 43210", "email": "hello@rentpr.in"}'::jsonb),
('links', '{"quick_links": [{"to": "/", "label": "Home"}, {"to": "/products", "label": "All Products"}, {"to": "/how-it-works", "label": "How It Works"}], "categories": [{"to": "/products", "label": "Printers"}, {"label": "Electronics (Coming Soon)", "disabled": true}, {"label": "Furniture (Coming Soon)", "disabled": true}, {"label": "Appliances (Coming Soon)", "disabled": true}]}'::jsonb),
('legal', '{"copyright": "© {year} RentPR. All rights reserved.", "policies": [{"label": "Privacy Policy", "href": "#"}, {"label": "Terms of Service", "href": "#"}, {"label": "Refund Policy", "href": "#"}]}'::jsonb);

CREATE TRIGGER update_footer_settings_updated_at
BEFORE UPDATE ON public.footer_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
