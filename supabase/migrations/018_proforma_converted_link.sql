-- Store the invoice ID created when a proforma is converted
-- Enables the drawer to show the document chain: PI → INV-XXXX

ALTER TABLE proforma_invoices
  ADD COLUMN IF NOT EXISTS converted_invoice_id UUID REFERENCES invoices(id);
