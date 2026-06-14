-- ERP-102: GRN sequential numbering
-- Replaces random 6-digit GRN numbers with sequential GRN-XXXX series

CREATE SEQUENCE IF NOT EXISTS grn_seq START 9001;

-- Add grn_no column if it doesn't already have a proper one
-- (existing grn_no may be random; we keep it for legacy rows)
ALTER TABLE grn ADD COLUMN IF NOT EXISTS grn_no_seq TEXT;

-- Trigger: auto-assign sequential grn_no on new inserts
CREATE OR REPLACE FUNCTION set_grn_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_no IS NULL OR NEW.grn_no = '' THEN
    NEW.grn_no := 'GRN-' || nextval('grn_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grn_no_trigger ON grn;
CREATE TRIGGER grn_no_trigger
  BEFORE INSERT ON grn
  FOR EACH ROW EXECUTE FUNCTION set_grn_no();
