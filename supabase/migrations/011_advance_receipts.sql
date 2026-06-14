-- ERP-501: Advance Receipts schema
-- AR-6001 series; PDC support; auto-posts to customer_ledger

CREATE SEQUENCE IF NOT EXISTS ar_seq START 6001;

CREATE TABLE IF NOT EXISTS advance_receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_no        TEXT NOT NULL DEFAULT 'AR-' || nextval('ar_seq'),
  company_id   UUID NOT NULL REFERENCES companies(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference    TEXT,
  notes        TEXT,
  is_pdc       BOOLEAN NOT NULL DEFAULT false,
  pdc_date     DATE,
  status       TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','applied','cancelled')),
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE advance_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ar" ON advance_receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write ar" ON advance_receipts FOR ALL USING (auth.role() = 'authenticated');
