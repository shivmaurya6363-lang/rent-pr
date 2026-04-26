-- Update locations to mark Delhi NCR cities as popular and set proper order
UPDATE public.locations SET is_popular = true, display_order = 1 WHERE slug = 'delhi';
UPDATE public.locations SET is_popular = true, display_order = 2 WHERE slug = 'noida';
UPDATE public.locations SET is_popular = true, display_order = 3 WHERE slug = 'gurgaon';
UPDATE public.locations SET is_popular = true, display_order = 4 WHERE slug = 'faridabad';
UPDATE public.locations SET is_popular = true, display_order = 5 WHERE slug = 'ghaziabad';

-- Add Gurgaon if not exists (may be named Gurugram)
INSERT INTO public.locations (name, slug, is_popular, is_active, display_order)
VALUES ('Gurgaon', 'gurgaon', true, true, 3)
ON CONFLICT (slug) DO UPDATE SET is_popular = true, display_order = 3;

-- Add Faridabad if not exists
INSERT INTO public.locations (name, slug, is_popular, is_active, display_order)
VALUES ('Faridabad', 'faridabad', true, true, 4)
ON CONFLICT (slug) DO UPDATE SET is_popular = true, display_order = 4;

-- Add Ghaziabad if not exists
INSERT INTO public.locations (name, slug, is_popular, is_active, display_order)
VALUES ('Ghaziabad', 'ghaziabad', true, true, 5)
ON CONFLICT (slug) DO UPDATE SET is_popular = true, display_order = 5;

-- Set other cities as not popular
UPDATE public.locations SET is_popular = false WHERE slug NOT IN ('delhi', 'noida', 'gurgaon', 'faridabad', 'ghaziabad');