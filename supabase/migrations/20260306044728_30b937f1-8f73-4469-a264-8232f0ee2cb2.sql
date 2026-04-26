
-- Legal documents table for T&C, Privacy Policy, Terms of Service, Refund Policy
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Anyone can read active legal documents
CREATE POLICY "Anyone can read active legal documents"
  ON public.legal_documents FOR SELECT
  USING (is_active = true);

-- Admins can manage legal documents
CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add agreement tracking to orders
ALTER TABLE public.orders
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN terms_version integer;

-- Seed initial legal documents with dummy content
INSERT INTO public.legal_documents (slug, title, content) VALUES
('terms-and-conditions', 'Terms & Conditions', E'# Terms & Conditions\n\nLast updated: March 2026\n\n## 1. Acceptance of Terms\nBy accessing and using this rental platform, you accept and agree to be bound by the terms and provision of this agreement.\n\n## 2. Rental Agreement\nAll rentals are subject to availability. The rental period begins on the delivery date and ends on the agreed return date.\n\n## 3. Security Deposit\nA refundable security deposit is required for all rentals. The deposit will be refunded within 7 business days after the product is returned in good condition.\n\n## 4. Monthly Payments\nMonthly rent is auto-debited on the agreed date each month. Failure to pay may result in late fees and service suspension.\n\n## 5. Product Care\nYou are responsible for maintaining the rented products in good condition. Normal wear and tear is acceptable.\n\n## 6. Damage & Loss\nAny damage beyond normal wear and tear will be charged. Lost items will be charged at replacement value minus deposit.\n\n## 7. Early Termination\nYou may terminate the rental early with a 30-day notice. Early termination fees may apply.\n\n## 8. Delivery & Installation\nDelivery and installation charges are one-time fees payable at checkout.\n\n## 9. Returns\nProducts must be returned in the same condition as received. A pickup will be scheduled at the end of the rental period.\n\n## 10. Contact\nFor any questions, contact us at support@rentpr.in'),

('privacy-policy', 'Privacy Policy', E'# Privacy Policy\n\nLast updated: March 2026\n\n## 1. Information We Collect\nWe collect information you provide directly, including name, email, phone number, delivery address, and payment information.\n\n## 2. How We Use Your Information\nWe use your information to process rentals, deliver products, send notifications, and improve our services.\n\n## 3. Data Sharing\nWe do not sell your personal information. We share data only with delivery partners and payment processors as needed.\n\n## 4. Data Security\nWe implement industry-standard security measures to protect your personal information.\n\n## 5. Cookies\nWe use cookies to improve your browsing experience and analyze site traffic.\n\n## 6. Your Rights\nYou have the right to access, update, or delete your personal information. Contact us at privacy@rentpr.in.\n\n## 7. Changes\nWe may update this policy from time to time. We will notify you of significant changes via email.'),

('terms-of-service', 'Terms of Service', E'# Terms of Service\n\nLast updated: March 2026\n\n## 1. Service Description\nWe provide an online platform for renting furniture, electronics, and appliances on a monthly subscription basis.\n\n## 2. Account Registration\nYou must create an account to use our services. You are responsible for maintaining the confidentiality of your account.\n\n## 3. Prohibited Activities\nYou may not misuse our services, attempt unauthorized access, or use products for illegal purposes.\n\n## 4. Intellectual Property\nAll content on this platform is owned by us or our licensors.\n\n## 5. Limitation of Liability\nWe are not liable for indirect, incidental, or consequential damages arising from use of our services.\n\n## 6. Governing Law\nThese terms are governed by the laws of India.'),

('refund-policy', 'Refund Policy', E'# Refund Policy\n\nLast updated: March 2026\n\n## 1. Security Deposit Refund\nYour security deposit will be refunded within 7 business days after product return and inspection.\n\n## 2. Advance Rent Refund\nIf you paid rent in advance, unused months will be refunded proportionally minus any applicable fees.\n\n## 3. Cancellation Before Delivery\nFull refund if cancelled before product dispatch. Partial refund if cancelled after dispatch.\n\n## 4. Damaged Products\nIf you receive a damaged product, report within 24 hours for full replacement or refund.\n\n## 5. Refund Method\nRefunds are processed to the original payment method within 5-7 business days.\n\n## 6. Non-Refundable Charges\nDelivery and installation charges are non-refundable once the service is completed.');
