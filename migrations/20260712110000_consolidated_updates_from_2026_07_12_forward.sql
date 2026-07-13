-- Consolidated migration: all updates from 2026-07-12 and forward.

-- 20260712110000_create_buy_market_and_storage_vessels.sql
-- Generic persisted Buy Market offers. Adapter-specific values live in payload.
CREATE TABLE IF NOT EXISTS market_buy_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  ware_group TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  origin_tag TEXT NOT NULL,
  available_units INTEGER NOT NULL CHECK (available_units >= 0),
  unit TEXT NOT NULL,
  base_price_per_unit NUMERIC NOT NULL,
  effective_price_per_unit NUMERIC NOT NULL,
  is_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  created_year INTEGER NOT NULL,
  created_season TEXT NOT NULL,
  created_week INTEGER NOT NULL,
  last_refreshed_year INTEGER NOT NULL,
  last_refreshed_season TEXT NOT NULL,
  last_refreshed_week INTEGER NOT NULL,
  expires_year INTEGER,
  expires_season TEXT,
  expires_week INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_market_buy_offers_company_group ON market_buy_offers(company_id, ware_group);
CREATE INDEX IF NOT EXISTS idx_market_buy_offers_active ON market_buy_offers(company_id, ware_group, available_units);

ALTER TABLE market_buy_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage market buy offers" ON market_buy_offers;
CREATE POLICY "Users can manage market buy offers"
  ON market_buy_offers FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

-- Preserve every grape offer while moving grape-only fields into the adapter payload.
INSERT INTO market_buy_offers (
  company_id, offer_id, ware_group, seller_id, seller_name, origin_tag,
  available_units, unit, base_price_per_unit, effective_price_per_unit, is_persistent,
  created_year, created_season, created_week,
  last_refreshed_year, last_refreshed_season, last_refreshed_week,
  expires_year, expires_season, expires_week, payload, updated_at
)
SELECT
  company_id, offer_id, 'grapes', supplier_id, supplier_name, origin_tag,
  available_kg, 'kg', base_price_per_kg, effective_price_per_kg, is_persistent,
  created_year, created_season, created_week,
  last_refreshed_year, last_refreshed_season, last_refreshed_week,
  expires_year, expires_season, expires_week,
  jsonb_build_object(
    'batchState', batch_state,
    'grapeVariety', grape_variety,
    'qualityScore', quality_score,
    'weeksOnMarket', weeks_on_market,
    'qualityDecayPerWeek', quality_decay_per_week,
    'minQualityFloor', min_quality_floor,
    'provenanceSnapshot', provenance_snapshot,
    'previewSnapshot', preview_snapshot,
    'previewVersion', preview_version
  ),
  updated_at
FROM grape_market_buy_offers
ON CONFLICT (company_id, offer_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS storage_vessels (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vessel_type TEXT NOT NULL,
  material TEXT NOT NULL,
  capacity_litres NUMERIC NOT NULL CHECK (capacity_litres > 0),
  acquisition_price NUMERIC NOT NULL CHECK (acquisition_price >= 0),
  source_offer_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'empty',
  purchased_year INTEGER NOT NULL,
  purchased_season TEXT NOT NULL,
  purchased_week INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_vessels_company ON storage_vessels(company_id);
ALTER TABLE storage_vessels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage storage vessels" ON storage_vessels;
CREATE POLICY "Users can manage storage vessels"
  ON storage_vessels FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

-- Availability claim is atomic even if two purchase actions reach the client simultaneously.
CREATE OR REPLACE FUNCTION claim_market_buy_offer_units(
  p_company_id UUID,
  p_offer_id TEXT,
  p_units INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_units <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE market_buy_offers
  SET available_units = available_units - p_units, updated_at = NOW()
  WHERE company_id = p_company_id
    AND offer_id = p_offer_id
    AND available_units >= p_units;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_market_buy_offer_units(
  p_company_id UUID,
  p_offer_id TEXT,
  p_units INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_units <= 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE market_buy_offers
  SET available_units = available_units + p_units, updated_at = NOW()
  WHERE company_id = p_company_id AND offer_id = p_offer_id;
  RETURN FOUND;
END;
$$;

-- The application no longer reads this table after this migration.
DROP TABLE IF EXISTS grape_market_buy_offers;

-- 20260713120000_add_storage_vessel_allocations.sql
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

-- 20260713130000_add_storage_vessel_plan_extension.sql
-- A harvest that fills its initial vessels may continue later in additional vessels.
CREATE OR REPLACE FUNCTION add_storage_vessel_plan_allocations(
  p_company_id UUID,
  p_plan_id UUID,
  p_vessel_ids UUID[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM 1
  FROM storage_vessel_allocation_plans
  WHERE id = p_plan_id
    AND company_id = p_company_id
    AND status IN ('reserved', 'active')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM 1
  FROM storage_vessels
  WHERE company_id = p_company_id
    AND id = ANY(p_vessel_ids)
  FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids)
    AND s.operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1
      FROM storage_vessel_allocations a
      JOIN storage_vessel_allocation_plans p ON p.id = a.plan_id
      WHERE a.vessel_id = s.id
        AND a.released_at IS NULL
    );

  IF v_count <> array_length(p_vessel_ids, 1) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO storage_vessel_allocations (
    company_id, plan_id, vessel_id, assigned_capacity_litres
  )
  SELECT p_company_id, p_plan_id, s.id, s.capacity_litres
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids);

  RETURN TRUE;
END;
$$;

-- 20260713140000_add_storage_vessel_quality.sql
-- Storage vessel quality is a normalized 0-1 equipment attribute.
ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC NOT NULL DEFAULT 0.5
  CHECK (quality_score >= 0 AND quality_score <= 1);

UPDATE storage_vessels
SET quality_score = 0.78
WHERE source_offer_id = 'storage_vessel_oak_cask_225';

UPDATE storage_vessels
SET quality_score = 0.84
WHERE source_offer_id = 'storage_vessel_oak_cask_500';

-- Existing persistent catalogue offers receive their explicit catalogue quality.
UPDATE market_buy_offers
SET payload = jsonb_set(payload, '{qualityScore}', '0.78'::jsonb, TRUE)
WHERE ware_group = 'storage_vessels'
  AND offer_id = 'storage_vessel_oak_cask_225';

UPDATE market_buy_offers
SET payload = jsonb_set(payload, '{qualityScore}', '0.84'::jsonb, TRUE)
WHERE ware_group = 'storage_vessels'
  AND offer_id = 'storage_vessel_oak_cask_500';

-- 20260713150000_generalize_buy_goods_suppliers.sql
ALTER TABLE grape_supplier_loyalty RENAME TO buy_goods_supplier_relationships;
ALTER TABLE buy_goods_supplier_relationships ADD COLUMN goods_domain TEXT NOT NULL DEFAULT 'grapes';
ALTER TABLE buy_goods_supplier_relationships RENAME COLUMN total_kg_purchased TO total_units_purchased;
ALTER TABLE buy_goods_supplier_relationships RENAME COLUMN year_kg_purchased TO year_units_purchased;
ALTER TABLE buy_goods_supplier_relationships DROP CONSTRAINT grape_supplier_loyalty_company_id_supplier_id_key;
ALTER TABLE buy_goods_supplier_relationships ADD CONSTRAINT buy_goods_supplier_relationships_company_domain_supplier_key UNIQUE (company_id, goods_domain, supplier_id);
CREATE INDEX idx_buy_goods_supplier_relationships_company_domain ON buy_goods_supplier_relationships(company_id, goods_domain);

-- 20260713160000_add_storage_vessel_production_year.sql
ALTER TABLE storage_vessels ADD COLUMN production_year INTEGER;
UPDATE storage_vessels SET production_year = purchased_year WHERE production_year IS NULL;
ALTER TABLE storage_vessels ALTER COLUMN production_year SET NOT NULL;

-- 20260713170000_allow_maintenance_activity_category.sql
-- Empty Vessel is a Maintenance activity. Keep the database category guard
-- aligned with the WorkCategory enum so it can be persisted.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_category_check;

ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category IN (
    'PLANTING',
    'HARVESTING',
    'CRUSHING',
    'FERMENTATION',
    'MAINTENANCE',
    'CLEARING',
    'BUILDING',
    'UPGRADING',
    'ADMINISTRATION_AND_RESEARCH',
    'STAFF_SEARCH',
    'STAFF_HIRING',
    'LAND_SEARCH',
    'LENDER_SEARCH',
    'TAKE_LOAN',
    'FINANCE_AND_STAFF'
  ));
