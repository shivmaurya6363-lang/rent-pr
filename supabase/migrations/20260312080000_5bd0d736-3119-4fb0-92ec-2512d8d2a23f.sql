
-- Create site-assets bucket for logo
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for site-assets: anyone can view, admins can manage
DROP POLICY IF EXISTS "site_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "site_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "site_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "site_assets_delete" ON storage.objects;

CREATE POLICY "site_assets_select" ON storage.objects
FOR SELECT USING (bucket_id = 'site-assets');

CREATE POLICY "site_assets_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "site_assets_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "site_assets_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
