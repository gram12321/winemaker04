-- Storage Vessel cleanliness is a clean-cutover rule for the existing vessel model.
-- No legacy rows are backfilled; development databases are recreated from the
-- current schema when necessary.

ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS cleanliness TEXT NOT NULL DEFAULT 'clean';

ALTER TABLE storage_vessels
  DROP CONSTRAINT IF EXISTS storage_vessels_cleanliness_check;

ALTER TABLE storage_vessels
  ADD CONSTRAINT storage_vessels_cleanliness_check
  CHECK (cleanliness IN ('clean', 'dirty'));

CREATE OR REPLACE FUNCTION enforce_clean_storage_vessel_allocation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE vessel_cleanliness TEXT;
BEGIN
  SELECT cleanliness INTO vessel_cleanliness
  FROM storage_vessels
  WHERE id = NEW.vessel_id AND company_id = NEW.company_id
  FOR UPDATE;

  IF vessel_cleanliness IS DISTINCT FROM 'clean' THEN
    RAISE EXCEPTION 'Storage Vessel must be clean before allocation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_vessel_allocation_requires_clean_vessel ON storage_vessel_allocations;
CREATE TRIGGER storage_vessel_allocation_requires_clean_vessel
  BEFORE INSERT ON storage_vessel_allocations
  FOR EACH ROW EXECUTE FUNCTION enforce_clean_storage_vessel_allocation();

CREATE OR REPLACE FUNCTION mark_storage_vessel_dirty_on_fill()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.filled_litres > 0 AND COALESCE(OLD.filled_litres, 0) <= 0 THEN
    UPDATE storage_vessels
    SET cleanliness = 'dirty'
    WHERE id = NEW.vessel_id AND company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_vessel_marks_dirty_on_fill ON storage_vessel_allocations;
CREATE TRIGGER storage_vessel_marks_dirty_on_fill
  AFTER INSERT OR UPDATE OF filled_litres ON storage_vessel_allocations
  FOR EACH ROW EXECUTE FUNCTION mark_storage_vessel_dirty_on_fill();

CREATE OR REPLACE FUNCTION complete_clean_storage_vessel(p_company_id UUID, p_vessel_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  UPDATE storage_vessels s
  SET cleanliness = 'clean'
  WHERE s.company_id = p_company_id
    AND s.id = p_vessel_id
    AND s.operational_status = 'operational'
    AND s.cleanliness = 'dirty'
    AND NOT EXISTS (
      SELECT 1 FROM storage_vessel_allocations a
      WHERE a.company_id = p_company_id
        AND a.vessel_id = p_vessel_id
        AND a.released_at IS NULL
    );
  RETURN FOUND;
END;
$$;
