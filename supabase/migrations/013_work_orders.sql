-- ERP-601: Work Orders schema
-- WO-1001 series; links to SO + BOM; drives stock deduction on completion

CREATE SEQUENCE IF NOT EXISTS wo_seq START 1001;

CREATE TABLE IF NOT EXISTS work_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_no       TEXT NOT NULL DEFAULT 'WO-' || nextval('wo_seq'),
  so_id       UUID REFERENCES sales_orders(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  bom_id      UUID REFERENCES bom_headers(id),
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1,
  start_date  DATE,
  target_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read wo" ON work_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write wo" ON work_orders FOR ALL USING (auth.role() = 'authenticated');
