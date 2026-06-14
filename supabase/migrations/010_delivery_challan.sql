-- ERP-404: Delivery Challan schema
-- DC-8001 series, no price/GST columns, delivery-only document

CREATE SEQUENCE IF NOT EXISTS dc_seq START 8001;

CREATE TABLE IF NOT EXISTS delivery_challans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_no            TEXT NOT NULL DEFAULT 'DC-' || nextval('dc_seq'),
  company_id       UUID NOT NULL REFERENCES companies(id),
  so_id            UUID REFERENCES sales_orders(id),
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no       TEXT,
  transporter_name TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dispatched','cancelled')),
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dc_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id       UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT DEFAULT 'NOS',
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1
);

-- RLS
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read dc" ON delivery_challans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write dc" ON delivery_challans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read dc items" ON dc_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write dc items" ON dc_items FOR ALL USING (auth.role() = 'authenticated');
