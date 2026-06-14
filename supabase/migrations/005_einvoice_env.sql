-- ERP-106: NIC e-invoice environment toggle
-- Adds einvoice_env column to company_settings

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS einvoice_env TEXT NOT NULL DEFAULT 'sandbox'
  CHECK (einvoice_env IN ('sandbox', 'production'));
