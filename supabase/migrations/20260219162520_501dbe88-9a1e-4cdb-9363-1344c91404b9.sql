
-- Create platform_settings table for storing system configuration
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings"
  ON public.platform_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read settings (needed for auto-approve logic etc.)
CREATE POLICY "Anyone can read settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);

-- Insert default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('general', '{"platformName": "RentEase", "supportEmail": "support@rentease.com", "maintenanceMode": false}'::jsonb),
  ('pricing', '{"defaultCommission": 30, "gstRate": 18, "protectionPlanFee": 99}'::jsonb),
  ('rentals', '{"minRentalDuration": 3, "maxRentalDuration": 24}'::jsonb),
  ('approvals', '{"autoApproveVendors": false, "autoApproveProducts": false, "requireEmailVerification": true}'::jsonb);

-- Add trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
