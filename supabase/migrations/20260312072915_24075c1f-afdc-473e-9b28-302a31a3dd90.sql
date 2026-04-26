
-- Drop all existing restrictive policies on document_uploads
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.document_uploads;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.document_uploads;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.document_uploads;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.document_uploads;
DROP POLICY IF EXISTS "Vendors can view documents for their orders" ON public.document_uploads;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all documents" ON public.document_uploads
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own documents" ON public.document_uploads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.document_uploads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own documents" ON public.document_uploads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Vendors can view documents for their orders" ON public.document_uploads
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = document_uploads.order_id AND o.vendor_id = get_vendor_id(auth.uid())
  ));
