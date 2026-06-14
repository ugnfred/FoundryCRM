-- Split company_settings.address into structured Indian postal fields
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS pincode       text;

-- Migrate existing free-text address into address_line1 so nothing is lost
UPDATE company_settings
SET address_line1 = address
WHERE address_line1 IS NULL AND address IS NOT NULL AND address <> '';
