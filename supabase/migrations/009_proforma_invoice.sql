-- ERP-401: Proforma Invoice schema
-- PI-7001 series, no stock/tax effect, convertible to invoice

CREATE SEQUENCE IF NOT EXISTS pi_seq START 7001;

CREATE TABLE IF NOT EXISTS proforma_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_no           TEXT NOT NULL DEFAULT 'PI-' || nextval('pi_seq'),
  company_id      UUID NOT NULL REFERENCES companies(id),
  so_id           UUID REFERENCES sales_orders(id),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date   DATE,
  place_of_supply TEXT NOT NULL DEFAULT '27',
  taxable_amt     NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','converted','cancelled')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proforma_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_id       UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT DEFAULT 'NOS',
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1,
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 18,
  cgst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read proforma" ON proforma_invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write proforma" ON proforma_invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read proforma items" ON proforma_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write proforma items" ON proforma_items FOR ALL USING (auth.role() = 'authenticated');
