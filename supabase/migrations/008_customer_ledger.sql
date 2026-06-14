-- ERP-207: Customer Ledger — append-only event table

CREATE TABLE customer_ledger (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID          NOT NULL REFERENCES companies(id),
  doc_type    TEXT          NOT NULL
              CHECK (doc_type IN ('invoice','payment','cn','advance','opening','adjustment')),
  doc_id      UUID,
  doc_no      TEXT,
  doc_date    DATE,
  debit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_company_date ON customer_ledger(company_id, doc_date);

-- Backfill existing invoices as debit entries (exclude cancelled)
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_no, doc_date, debit)
SELECT company_id, 'invoice', id, inv_no, date, total
FROM invoices
WHERE status NOT IN ('cancelled');

-- Backfill existing payments as credit entries
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_date, credit)
SELECT i.company_id, 'payment', p.id, p.date, p.amount
FROM payments p
JOIN invoices i ON i.id = p.invoice_id;

ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_ledger" ON customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
