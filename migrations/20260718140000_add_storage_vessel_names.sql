-- Persist the human-readable vessel identifier assigned at purchase.
ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS vessel_name TEXT;
