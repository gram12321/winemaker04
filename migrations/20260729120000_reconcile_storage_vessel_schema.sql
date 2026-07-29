-- Reconcile the live table with the storage-vessel model used by the client.
--
-- This is intentionally additive: older development projects may have the
-- original company_id-based table, while the current client reads and writes
-- the lifecycle and ownership columns below.

ALTER TABLE public.storage_vessels
  ADD COLUMN IF NOT EXISTS vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_kind TEXT,
  ADD COLUMN IF NOT EXISTS owner_company_id UUID,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS condition NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fill_history INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_year INTEGER,
  ADD COLUMN IF NOT EXISTS cleanliness TEXT NOT NULL DEFAULT 'clean';

-- Existing vessels used company_id before ownership was generalized. Preserve
-- that ownership and make the new columns immediately valid for reads.
UPDATE public.storage_vessels
SET owner_kind = COALESCE(owner_kind, 'company'),
    owner_company_id = COALESCE(owner_company_id, company_id),
    production_year = COALESCE(production_year, purchased_year),
    cleanliness = COALESCE(cleanliness, 'clean'),
    condition = COALESCE(condition, 1),
    fill_history = COALESCE(fill_history, 0),
    quality_score = COALESCE(quality_score, 0.5);

ALTER TABLE public.storage_vessels
  ALTER COLUMN owner_kind SET NOT NULL,
  ALTER COLUMN production_year SET NOT NULL;

ALTER TABLE public.storage_vessels
  DROP CONSTRAINT IF EXISTS storage_vessels_owner_kind_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_owner_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_condition_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_fill_history_check,
  DROP CONSTRAINT IF EXISTS storage_vessels_cleanliness_check;

ALTER TABLE public.storage_vessels
  ADD CONSTRAINT storage_vessels_owner_kind_check
    CHECK (owner_kind IN ('company', 'npc_market')),
  ADD CONSTRAINT storage_vessels_owner_check
    CHECK (
      (owner_kind = 'company' AND owner_company_id IS NOT NULL)
      OR (owner_kind = 'npc_market' AND owner_company_id IS NULL)
    ),
  ADD CONSTRAINT storage_vessels_condition_check
    CHECK (condition BETWEEN 0 AND 1),
  ADD CONSTRAINT storage_vessels_fill_history_check
    CHECK (fill_history >= 0),
  ADD CONSTRAINT storage_vessels_cleanliness_check
    CHECK (cleanliness IN ('clean', 'dirty'));

-- Keep legacy company_id consumers and the newer ownership-based client in
-- sync. This also makes inserts from the test lab satisfy the legacy NOT NULL
-- company_id and RLS policy without sending two sources of ownership.
CREATE OR REPLACE FUNCTION public.sync_storage_vessel_owner_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.company_id := CASE
    WHEN NEW.owner_kind = 'company' THEN NEW.owner_company_id
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_vessel_owner_company_sync ON public.storage_vessels;
CREATE TRIGGER storage_vessel_owner_company_sync
  BEFORE INSERT OR UPDATE OF owner_kind, owner_company_id
  ON public.storage_vessels
  FOR EACH ROW EXECUTE FUNCTION public.sync_storage_vessel_owner_company();
