
-- Create storage bucket for customer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', false);

-- Create document_uploads table
CREATE TABLE public.document_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('aadhaar', 'pan', 'bank_statement')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, document_type)
);

-- Enable RLS
ALTER TABLE public.document_uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON public.document_uploads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON public.document_uploads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON public.document_uploads FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON public.document_uploads FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Vendors can view documents for their orders
CREATE POLICY "Vendors can view documents for their orders"
ON public.document_uploads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = document_uploads.order_id
      AND o.vendor_id = get_vendor_id(auth.uid())
  )
);

-- Storage policies for customer-documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents storage"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own documents storage"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'customer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all documents storage"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'customer-documents' AND has_role(auth.uid(), 'admin'::app_role));
