-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Anyone can view active locations
CREATE POLICY "Anyone can view active locations" 
ON public.locations 
FOR SELECT 
USING (is_active = true);

-- Admins can manage locations
CREATE POLICY "Admins can manage locations" 
ON public.locations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add location_id to products table
ALTER TABLE public.products 
ADD COLUMN location_id UUID REFERENCES public.locations(id);

-- Create index for faster lookups
CREATE INDEX idx_products_location ON public.products(location_id);

-- Insert popular cities
INSERT INTO public.locations (name, slug, is_popular, display_order) VALUES
('Delhi', 'delhi', true, 1),
('Noida', 'noida', true, 2),
('Gurgaon', 'gurgaon', true, 3),
('Ghaziabad', 'ghaziabad', true, 4),
('Faridabad', 'faridabad', true, 5),
('Mumbai', 'mumbai', true, 6),
('Bangalore', 'bangalore', true, 7),
('Pune', 'pune', true, 8),
('Hyderabad', 'hyderabad', true, 9),
('Chennai', 'chennai', true, 10),
('Kolkata', 'kolkata', false, 11),
('Ahmedabad', 'ahmedabad', false, 12),
('Jaipur', 'jaipur', false, 13),
('Lucknow', 'lucknow', false, 14),
('Chandigarh', 'chandigarh', false, 15);

-- Update trigger for locations
CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();