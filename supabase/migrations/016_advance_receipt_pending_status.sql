-- Migration 016: Add 'pending' to advance_receipts status CHECK constraint
-- Required for PDC advances that haven't cleared yet
ALTER TABLE advance_receipts DROP CONSTRAINT IF EXISTS advance_receipts_status_check;
ALTER TABLE advance_receipts ADD CONSTRAINT advance_receipts_status_check
  CHECK (status IN ('pending', 'received', 'applied', 'cancelled'));
