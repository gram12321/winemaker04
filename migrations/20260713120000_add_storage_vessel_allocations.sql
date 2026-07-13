-- Storage is a hard production invariant. No compatibility path is retained for
-- non-bottled batches without an allocation plan.

ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'operational';

ALTER TABLE storage_vessels
  DROP COLUMN IF EXISTS state;

CREATE TABLE IF NOT EXISTS storage_vessel_allocation_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
  wine_batch_id TEXT REFERENCES wine_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'active', 'released')),
  required_litres NUMERIC NOT NULL CHECK (required_litres > 0),
  created_year INTEGER NOT NULL,
  created_season TEXT NOT NULL,
  created_week INTEGER NOT NULL,
  activated_year INTEGER,
  activated_season TEXT,
  activated_week INTEGER,
  released_year INTEGER,
  released_season TEXT,
  released_week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_vessel_plans_company_status
  ON storage_vessel_allocation_plans(company_id, status);
CREATE INDEX IF NOT EXISTS idx_storage_vessel_plans_batch
  ON storage_vessel_allocation_plans(company_id, wine_batch_id);

CREATE TABLE IF NOT EXISTS storage_vessel_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES storage_vessel_allocation_plans(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES storage_vessels(id) ON DELETE RESTRICT,
  assigned_capacity_litres NUMERIC NOT NULL CHECK (assigned_capacity_litres > 0),
  filled_litres NUMERIC NOT NULL DEFAULT 0 CHECK (filled_litres >= 0 AND filled_litres <= assigned_capacity_litres),
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, vessel_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_vessel_one_unreleased_plan
  ON storage_vessel_allocations(vessel_id)
  WHERE released_at IS NULL;

ALTER TABLE storage_vessel_allocation_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage storage vessel allocation plans" ON storage_vessel_allocation_plans;
CREATE POLICY "Users can manage storage vessel allocation plans"
  ON storage_vessel_allocation_plans FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

ALTER TABLE storage_vessel_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage storage vessel allocations" ON storage_vessel_allocations;
CREATE POLICY "Users can manage storage vessel allocations"
  ON storage_vessel_allocations FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

ALTER TABLE wine_batches
  ADD COLUMN IF NOT EXISTS storage_plan_id UUID REFERENCES storage_vessel_allocation_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS volume_litres NUMERIC;

-- No legacy exemption: pre-allocation grapes/must cannot satisfy the new physical
-- storage invariant, so remove them before enforcing it. Bottled wine is exempt.
DELETE FROM wine_batches
WHERE state IS DISTINCT FROM 'bottled';

ALTER TABLE wine_batches
  ADD CONSTRAINT wine_batches_storage_requirement
  CHECK (state = 'bottled' OR (storage_plan_id IS NOT NULL AND volume_litres IS NOT NULL AND volume_litres > 0));

CREATE OR REPLACE FUNCTION reserve_storage_vessel_plan(
  p_company_id UUID,
  p_required_litres NUMERIC,
  p_vessel_ids UUID[],
  p_activity_id TEXT,
  p_created_year INTEGER,
  p_created_season TEXT,
  p_created_week INTEGER
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_id UUID;
  v_capacity NUMERIC;
  v_count INTEGER;
BEGIN
  IF p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Storage reservation requires positive volume and at least one vessel';
  END IF;

  PERFORM 1
  FROM storage_vessels
  WHERE company_id = p_company_id
    AND id = ANY(p_vessel_ids)
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(s.capacity_litres), 0)
  INTO v_count, v_capacity
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids)
    AND s.operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1
      FROM storage_vessel_allocations a
      JOIN storage_vessel_allocation_plans p ON p.id = a.plan_id
      WHERE a.vessel_id = s.id
        AND p.status IN ('reserved', 'active')
    );

  IF v_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres THEN
    RAISE EXCEPTION 'Selected Storage Vessels are unavailable or lack capacity';
  END IF;

  INSERT INTO storage_vessel_allocation_plans (
    company_id, activity_id, status, required_litres,
    created_year, created_season, created_week
  ) VALUES (
    p_company_id, p_activity_id, 'reserved', p_required_litres,
    p_created_year, p_created_season, p_created_week
  ) RETURNING id INTO v_plan_id;

  INSERT INTO storage_vessel_allocations (
    company_id, plan_id, vessel_id, assigned_capacity_litres
  )
  SELECT p_company_id, v_plan_id, s.id, s.capacity_litres
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids);

  RETURN v_plan_id;
END;
$$;
