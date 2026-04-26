
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage legal documents" ON public.legal_documents;
DROP POLICY IF EXISTS "Anyone can read active legal documents" ON public.legal_documents;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active legal documents"
  ON public.legal_documents FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Seed initial legal documents if they don't exist
INSERT INTO public.legal_documents (slug, title, content, version, is_active)
VALUES
  ('terms-and-conditions', 'Terms & Conditions', E'# Terms & Conditions\n\n## 1. Introduction\nWelcome to RentPR. By using our platform, you agree to these terms and conditions.\n\n## 2. Rental Agreement\nAll rentals are subject to availability and confirmation. Monthly rent, security deposit, and other fees are as displayed at the time of checkout.\n\n## 3. Security Deposit\nA refundable security deposit is required at the time of order. It will be refunded within 7-10 business days after the product is returned in good condition.\n\n## 4. Payment Terms\nMonthly rent is due on the 1st of each month. Late payments may attract penalties.\n\n## 5. Product Care\nYou are responsible for maintaining the rented product in good condition. Normal wear and tear is acceptable.\n\n## 6. Cancellation & Returns\nOrders can be cancelled within 24 hours of placement. Early termination fees may apply for returning products before the rental period ends.\n\n## 7. Liability\nRentPR is not liable for any indirect or consequential damages arising from the use of rented products.\n\n## 8. Contact\nFor queries, reach us at hello@rentpr.in', 1, true),
  ('privacy-policy', 'Privacy Policy', E'# Privacy Policy\n\n## 1. Information We Collect\nWe collect personal information such as name, email, phone number, and address when you register or place an order.\n\n## 2. How We Use Your Information\nYour information is used to process orders, provide customer support, and improve our services.\n\n## 3. Data Security\nWe implement industry-standard security measures to protect your personal data.\n\n## 4. Cookies\nOur website uses cookies to enhance your browsing experience.\n\n## 5. Third-Party Sharing\nWe do not sell your personal information. We may share data with delivery partners to fulfill orders.\n\n## 6. Your Rights\nYou can request access, correction, or deletion of your personal data by contacting us.\n\n## 7. Contact\nFor privacy concerns, email us at hello@rentpr.in', 1, true),
  ('terms-of-service', 'Terms of Service', E'# Terms of Service\n\n## 1. Acceptance\nBy accessing RentPR, you accept these Terms of Service.\n\n## 2. User Accounts\nYou must provide accurate information when creating an account. You are responsible for maintaining account security.\n\n## 3. Prohibited Activities\nYou may not misuse the platform, engage in fraud, or violate any applicable laws.\n\n## 4. Intellectual Property\nAll content on RentPR is owned by us and protected by copyright laws.\n\n## 5. Limitation of Liability\nRentPR liability is limited to the amount paid for the specific service.\n\n## 6. Governing Law\nThese terms are governed by the laws of India.\n\n## 7. Contact\nQuestions? Email hello@rentpr.in', 1, true),
  ('refund-policy', 'Refund Policy', E'# Refund Policy\n\n## 1. Security Deposit Refund\nSecurity deposits are refunded within 7-10 business days after product return and inspection.\n\n## 2. Cancellation Refunds\nOrders cancelled within 24 hours receive a full refund. After 24 hours, cancellation charges may apply.\n\n## 3. Damage Deductions\nIf the returned product has damage beyond normal wear and tear, repair costs will be deducted from the security deposit.\n\n## 4. Refund Method\nRefunds are processed to the original payment method.\n\n## 5. Processing Time\nRefunds typically take 5-7 business days to reflect in your account.\n\n## 6. Contact\nFor refund queries, contact hello@rentpr.in', 1, true)
ON CONFLICT (slug) DO NOTHING;
