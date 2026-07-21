-- Add the persistent vessel lifecycle values used by the current model.
-- Condition and fill history are display-only for now; future mechanics may
-- use them for depreciation, maintenance, and vessel-memory effects.

ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS condition NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fill_history INTEGER NOT NULL DEFAULT 0;

ALTER TABLE storage_vessels
  DROP CONSTRAINT IF EXISTS storage_vessels_condition_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_fill_history_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_material_check;

-- The previous neutral label is now represented by stainless steel before
-- the stricter material constraint is installed.
UPDATE storage_vessels
SET material = 'stainless_steel'
WHERE material = 'neutral';

ALTER TABLE storage_vessels
  ADD CONSTRAINT storage_vessels_condition_check
    CHECK (condition >= 0 AND condition <= 1),
  ADD CONSTRAINT storage_vessels_fill_history_check
    CHECK (fill_history >= 0),
  ADD CONSTRAINT storage_vessels_material_check
    CHECK (material IN ('oak', 'chestnut', 'stainless_steel', 'concrete', 'ceramic', 'plastic'));
