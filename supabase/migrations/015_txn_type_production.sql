-- Migration 015: Add production txn_type values for Work Order stock ledger
-- These values were missing, causing WO completion to log entries as 'adjustment'
ALTER TYPE txn_type ADD VALUE IF NOT EXISTS 'production';
ALTER TYPE txn_type ADD VALUE IF NOT EXISTS 'production_output';
