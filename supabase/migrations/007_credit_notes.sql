-- ERP-201: Credit Notes module

CREATE SEQUENCE cn_seq START 5001;

CREATE TABLE credit_notes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_no         TEXT          NOT NULL UNIQUE DEFAULT 'CN-' || nextval('cn_seq'),
  invoice_id    UUID          REFERENCES invoices(id) ON DELETE SET NULL,
  company_id    UUID          NOT NULL REFERENCES companies(id),
  date          DATE          NOT NULL,
  reason        TEXT,
  place_of_supply TEXT        NOT NULL DEFAULT '27',
  taxable_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gst     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT          NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'issued', 'cancelled')),
  created_by    UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE credit_note_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_id         UUID          NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES products(id),
  description   TEXT          NOT NULL,
  hsn_code      TEXT,
  uom           TEXT,
  qty           NUMERIC(10,3) NOT NULL,
  rate          NUMERIC(12,2) NOT NULL,
  gst_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order    INT           DEFAULT 0
);

ALTER TABLE credit_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_cn"       ON credit_notes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cn_items" ON credit_note_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
