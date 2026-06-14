-- ERP-506: Bill of Materials schema
-- bom_headers + bom_items; versioning via version INT + is_active flag

CREATE TABLE IF NOT EXISTS bom_headers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id),
  version     INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE TABLE IF NOT EXISTS bom_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id        UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  component_id  UUID NOT NULL REFERENCES products(id),
  qty           NUMERIC(12,3) NOT NULL DEFAULT 1,
  uom           TEXT NOT NULL DEFAULT 'NOS',
  notes         TEXT
);

ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bom" ON bom_headers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write bom" ON bom_headers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read bom items" ON bom_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write bom items" ON bom_items FOR ALL USING (auth.role() = 'authenticated');
