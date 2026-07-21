-- Migration: Add is_founder flag to staff table
-- Supports the Founder Profit-Share Model (Feature 4.1)
-- Founders receive 0 wages but earn a share of yearly profit instead.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN staff.is_founder IS
  'When true, the staff member is a company founder. Founders receive no wages and instead earn a share of yearly net profit (Founder Return). Cleared when the founder is bought out.';
