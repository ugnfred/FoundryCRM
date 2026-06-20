-- Migration 017: Add 'converted' to quotation_status enum
-- Prevents showing "To SO" button for already-converted quotations
ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'converted';
