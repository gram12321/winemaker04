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

-- Final transaction and purchase integrity commands.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS money_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS market_purchase_operations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION record_company_transaction(
  p_company_id UUID, p_amount NUMERIC, p_description TEXT, p_category TEXT, p_recurring BOOLEAN,
  p_week INTEGER, p_season TEXT, p_year INTEGER, p_require_funds BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_money NUMERIC; v_new_money NUMERIC; v_money_version BIGINT; v_transaction JSONB;
BEGIN
  SELECT money, money_version INTO v_money, v_money_version
  FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_new_money := v_money + p_amount;
  IF p_require_funds AND v_new_money < 0 THEN RETURN NULL; END IF;
  UPDATE companies
  SET money = v_new_money, money_version = v_money_version + 1
  WHERE id = p_company_id;
  INSERT INTO transactions (company_id, amount, description, category, recurring, money, week, season, year, created_at)
  VALUES (p_company_id, p_amount, p_description, p_category, p_recurring, v_new_money, p_week, p_season, p_year, NOW())
  RETURNING to_jsonb(transactions) INTO v_transaction;
  RETURN v_transaction || jsonb_build_object('money_version', v_money_version + 1);
END;
$$;

CREATE OR REPLACE FUNCTION purchase_storage_vessel_offer(
  p_company_id UUID, p_purchase_id UUID, p_offer_id TEXT, p_quantity INTEGER,
  p_week INTEGER, p_season TEXT, p_year INTEGER, p_description TEXT, p_category TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_offer market_buy_offers%ROWTYPE; v_cost NUMERIC; v_transaction JSONB; v_result JSONB;
BEGIN
  SELECT result INTO v_result FROM market_purchase_operations
  WHERE id = p_purchase_id AND company_id = p_company_id;
  IF FOUND THEN RETURN v_result || jsonb_build_object('completedNow', FALSE); END IF;
  IF p_quantity <= 0 THEN RETURN NULL; END IF;

  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_offer FROM market_buy_offers
  WHERE company_id = p_company_id AND offer_id = p_offer_id AND ware_group = 'storage_vessels'
  FOR UPDATE;
  IF NOT FOUND OR v_offer.available_units < p_quantity THEN RETURN NULL; END IF;
  IF COALESCE((v_offer.payload->>'capacityLitres')::NUMERIC, 0) <= 0 THEN RETURN NULL; END IF;
  v_cost := ROUND(v_offer.effective_price_per_unit * p_quantity, 2);
  v_transaction := record_company_transaction(p_company_id, -v_cost, p_description, p_category, FALSE, p_week, p_season, p_year, TRUE);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;

  UPDATE market_buy_offers SET available_units = available_units - p_quantity, updated_at = NOW()
  WHERE company_id = p_company_id AND offer_id = p_offer_id;
  INSERT INTO storage_vessels (
    id, company_id, vessel_type, material, quality_score, production_year, capacity_litres,
    acquisition_price, source_offer_id, operational_status, purchased_year, purchased_season, purchased_week
  )
  SELECT gen_random_uuid(), p_company_id, v_offer.payload->>'vesselType', v_offer.payload->>'material',
    (v_offer.payload->>'qualityScore')::NUMERIC, (v_offer.payload->>'productionYear')::INTEGER,
    (v_offer.payload->>'capacityLitres')::NUMERIC, v_offer.effective_price_per_unit, p_offer_id,
    'operational', p_year, p_season, p_week
  FROM generate_series(1, p_quantity);
  v_result := jsonb_build_object('transaction', v_transaction);
  INSERT INTO market_purchase_operations (id, company_id, result) VALUES (p_purchase_id, p_company_id, v_result);
  RETURN v_result || jsonb_build_object('completedNow', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION purchase_grape_market_offer(
  p_company_id UUID, p_purchase_id UUID, p_offer_id TEXT, p_quantity NUMERIC,
  p_vessel_ids UUID[], p_required_litres NUMERIC, p_batch JSONB,
  p_week INTEGER, p_season TEXT, p_year INTEGER, p_description TEXT, p_category TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_offer market_buy_offers%ROWTYPE; v_cost NUMERIC; v_transaction JSONB; v_result JSONB;
  v_plan_id UUID; v_capacity NUMERIC; v_vessel_count INTEGER;
BEGIN
  SELECT result INTO v_result FROM market_purchase_operations
  WHERE id = p_purchase_id AND company_id = p_company_id;
  IF FOUND THEN RETURN v_result || jsonb_build_object('completedNow', FALSE); END IF;
  IF p_quantity <= 0 OR p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN RETURN NULL; END IF;

  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_offer FROM market_buy_offers
  WHERE company_id = p_company_id AND offer_id = p_offer_id AND ware_group = 'grapes'
  FOR UPDATE;
  IF NOT FOUND OR v_offer.available_units < p_quantity THEN RETURN NULL; END IF;
  PERFORM 1 FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids) FOR UPDATE;
  SELECT COUNT(*), COALESCE(SUM(s.capacity_litres), 0) INTO v_vessel_count, v_capacity
  FROM storage_vessels s
  WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids) AND s.operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1 FROM storage_vessel_allocations a
      JOIN storage_vessel_allocation_plans plan ON plan.id = a.plan_id
      WHERE a.vessel_id = s.id AND a.released_at IS NULL AND plan.status IN ('reserved', 'active')
    );
  IF v_vessel_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres THEN RETURN NULL; END IF;
  IF p_batch->>'id' IS NULL OR (p_batch->>'quantity')::NUMERIC <> p_quantity THEN RETURN NULL; END IF;

  v_cost := ROUND(v_offer.effective_price_per_unit * p_quantity, 2);
  v_transaction := record_company_transaction(p_company_id, -v_cost, p_description, p_category, FALSE, p_week, p_season, p_year, TRUE);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  INSERT INTO storage_vessel_allocation_plans (
    company_id, status, required_litres, created_year, created_season, created_week
  ) VALUES (p_company_id, 'active', p_required_litres, p_year, p_season, p_week)
  RETURNING id INTO v_plan_id;
  INSERT INTO storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  SELECT p_company_id, v_plan_id, id, capacity_litres
  FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids);
  INSERT INTO wine_batches
  SELECT (jsonb_populate_record(NULL::wine_batches,
    p_batch || jsonb_build_object('company_id', p_company_id, 'storage_plan_id', v_plan_id, 'volume_litres', p_required_litres, 'created_at', NOW())
  )).*;
  UPDATE storage_vessel_allocation_plans SET wine_batch_id = p_batch->>'id'
  WHERE id = v_plan_id AND company_id = p_company_id;
  WITH fills AS (
    SELECT id, assigned_capacity_litres,
      COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres
    FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = v_plan_id
  )
  UPDATE storage_vessel_allocations a
  SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_required_litres - f.before_litres))
  FROM fills f WHERE a.id = f.id;
  UPDATE market_buy_offers SET available_units = available_units - p_quantity, updated_at = NOW()
  WHERE company_id = p_company_id AND offer_id = p_offer_id;
  v_result := jsonb_build_object('transaction', v_transaction);
  INSERT INTO market_purchase_operations (id, company_id, result) VALUES (p_purchase_id, p_company_id, v_result);
  RETURN v_result || jsonb_build_object('completedNow', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION reserve_storage_vessel_plan(
  p_company_id UUID, p_required_litres NUMERIC, p_vessel_ids UUID[], p_activity_id TEXT,
  p_created_year INTEGER, p_created_season TEXT, p_created_week INTEGER
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_plan_id UUID; v_capacity NUMERIC; v_count INTEGER;
BEGIN
  IF p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Storage reservation requires positive volume and at least one vessel'; END IF;
  PERFORM 1 FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids) FOR UPDATE;
  SELECT COUNT(*), COALESCE(SUM(s.capacity_litres), 0) INTO v_count, v_capacity FROM storage_vessels s
  WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids) AND s.operational_status = 'operational'
    AND NOT EXISTS (SELECT 1 FROM storage_vessel_allocations a JOIN storage_vessel_allocation_plans p ON p.id = a.plan_id WHERE a.vessel_id = s.id AND a.released_at IS NULL AND p.status IN ('reserved', 'active'));
  IF v_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres THEN RAISE EXCEPTION 'Selected Storage Vessels are unavailable or lack capacity'; END IF;
  INSERT INTO storage_vessel_allocation_plans (company_id, activity_id, status, required_litres, created_year, created_season, created_week)
  VALUES (p_company_id, p_activity_id, 'reserved', p_required_litres, p_created_year, p_created_season, p_created_week) RETURNING id INTO v_plan_id;
  INSERT INTO storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  SELECT p_company_id, v_plan_id, s.id, s.capacity_litres FROM storage_vessels s WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids);
  RETURN v_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_storage_vessel_plan_allocations(p_company_id UUID, p_plan_id UUID, p_vessel_ids UUID[])
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  IF COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = p_plan_id AND company_id = p_company_id AND status IN ('reserved', 'active') FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids) FOR UPDATE;
  SELECT COUNT(*) INTO v_count FROM storage_vessels s
  WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids) AND s.operational_status = 'operational'
    AND NOT EXISTS (SELECT 1 FROM storage_vessel_allocations a JOIN storage_vessel_allocation_plans p ON p.id = a.plan_id WHERE a.vessel_id = s.id AND a.released_at IS NULL AND p.status IN ('reserved', 'active'));
  IF v_count <> array_length(p_vessel_ids, 1) THEN RETURN FALSE; END IF;
  INSERT INTO storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  SELECT p_company_id, p_plan_id, s.id, s.capacity_litres FROM storage_vessels s WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION complete_empty_storage_vessel(
  p_company_id UUID, p_batch_id TEXT, p_plan_id UUID, p_vessel_id UUID, p_remaining_litres NUMERIC,
  p_remaining_quantity NUMERIC, p_released_at TIMESTAMPTZ, p_released_year INTEGER, p_released_season TEXT, p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_filled_litres NUMERIC; v_batch_litres NUMERIC; v_batch_quantity NUMERIC;
BEGIN
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = p_plan_id AND company_id = p_company_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT filled_litres INTO v_filled_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND vessel_id = p_vessel_id AND released_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT COALESCE(volume_litres, quantity), quantity INTO v_batch_litres, v_batch_quantity FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id FOR UPDATE;
  IF NOT FOUND OR v_batch_litres <= 0 OR ABS(p_remaining_litres - GREATEST(0, v_batch_litres - v_filled_litres)) > 0.001 OR ABS(p_remaining_quantity - GREATEST(0, v_batch_quantity * GREATEST(0, v_batch_litres - v_filled_litres) / v_batch_litres)) > 0.001 THEN RETURN FALSE; END IF;
  IF p_remaining_litres <= 0 THEN
    DELETE FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id;
    UPDATE storage_vessel_allocations SET released_at = p_released_at, filled_litres = 0 WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL;
    UPDATE storage_vessel_allocation_plans SET status = 'released', released_year = p_released_year, released_season = p_released_season, released_week = p_released_week WHERE id = p_plan_id AND company_id = p_company_id;
    RETURN TRUE;
  END IF;
  UPDATE wine_batches SET volume_litres = p_remaining_litres, quantity = ROUND(p_remaining_quantity) WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id;
  UPDATE storage_vessel_allocations SET released_at = p_released_at, filled_litres = 0 WHERE company_id = p_company_id AND plan_id = p_plan_id AND vessel_id = p_vessel_id AND released_at IS NULL;
  UPDATE storage_vessel_allocation_plans SET required_litres = p_remaining_litres WHERE id = p_plan_id AND company_id = p_company_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL)
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_remaining_litres - f.before_litres)) FROM fills f WHERE a.id = f.id;
  RETURN TRUE;
END;
$$;

ALTER TABLE buy_goods_supplier_relationships
  ADD COLUMN IF NOT EXISTS consecutive_years INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_units_purchased NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_relationship_points NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_guard_year INTEGER;

UPDATE buy_goods_supplier_relationships SET year_relationship_points = GREATEST(year_relationship_points, COALESCE(year_loyalty_points, 0));

-- 20260713180000_add_staff_maintenance_skill.sql
-- Preserve the existing administration/research skill before resetting the
-- long-standing skill_maintenance column to the new Maintenance skill.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS skill_administration_and_research NUMERIC NOT NULL DEFAULT 0.3;

UPDATE staff
SET skill_administration_and_research = skill_maintenance
WHERE skill_administration_and_research = 0.3;

UPDATE staff SET skill_maintenance = 0.3 WHERE skill_maintenance = skill_administration_and_research;

CREATE OR REPLACE FUNCTION record_buy_goods_supplier_purchase(
  p_company_id UUID, p_goods_domain TEXT, p_supplier_id TEXT, p_supplier_name TEXT,
  p_units_purchased NUMERIC, p_points NUMERIC, p_current_year INTEGER, p_yearly_cap NUMERIC
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_relation JSONB;
BEGIN
  INSERT INTO buy_goods_supplier_relationships (company_id, goods_domain, supplier_id, supplier_name, total_purchases, total_units_purchased, loyalty_score, year_guard_year, year_units_purchased, year_relationship_points, last_purchase_year, consecutive_years, updated_at)
  VALUES (p_company_id, p_goods_domain, p_supplier_id, p_supplier_name, 1, p_units_purchased, LEAST(p_points, p_yearly_cap), p_current_year, p_units_purchased, LEAST(p_points, p_yearly_cap), p_current_year, 1, NOW())
  ON CONFLICT (company_id, goods_domain, supplier_id) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    total_purchases = buy_goods_supplier_relationships.total_purchases + 1,
    total_units_purchased = buy_goods_supplier_relationships.total_units_purchased + EXCLUDED.total_units_purchased,
    loyalty_score = buy_goods_supplier_relationships.loyalty_score + LEAST(p_points, GREATEST(0, p_yearly_cap - CASE WHEN buy_goods_supplier_relationships.year_guard_year = p_current_year THEN buy_goods_supplier_relationships.year_relationship_points ELSE 0 END)),
    year_guard_year = p_current_year,
    year_units_purchased = CASE WHEN buy_goods_supplier_relationships.year_guard_year = p_current_year THEN buy_goods_supplier_relationships.year_units_purchased + EXCLUDED.year_units_purchased ELSE EXCLUDED.year_units_purchased END,
    year_relationship_points = CASE WHEN buy_goods_supplier_relationships.year_guard_year = p_current_year THEN LEAST(p_yearly_cap, buy_goods_supplier_relationships.year_relationship_points + p_points) ELSE LEAST(p_points, p_yearly_cap) END,
    last_purchase_year = p_current_year,
    consecutive_years = CASE WHEN buy_goods_supplier_relationships.year_guard_year = p_current_year THEN buy_goods_supplier_relationships.consecutive_years WHEN buy_goods_supplier_relationships.last_purchase_year = p_current_year - 1 THEN buy_goods_supplier_relationships.consecutive_years + 1 ELSE 1 END,
    updated_at = NOW()
  RETURNING to_jsonb(buy_goods_supplier_relationships) INTO v_relation;
  RETURN v_relation;
END;
$$;

CREATE OR REPLACE FUNCTION consume_storage_backed_wine_batch(
  p_company_id UUID, p_batch_id TEXT, p_quantity NUMERIC,
  p_released_year INTEGER, p_released_season TEXT, p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_quantity NUMERIC; v_volume_litres NUMERIC; v_plan_id UUID; v_remaining_quantity NUMERIC; v_remaining_litres NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN RETURN FALSE; END IF;
  SELECT quantity, COALESCE(volume_litres, quantity), storage_plan_id INTO v_quantity, v_volume_litres, v_plan_id FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_quantity < p_quantity THEN RETURN FALSE; END IF;
  v_remaining_quantity := v_quantity - p_quantity;
  v_remaining_litres := CASE WHEN v_quantity > 0 THEN GREATEST(0, v_volume_litres * v_remaining_quantity / v_quantity) ELSE 0 END;
  IF v_remaining_quantity <= 0 THEN
    DELETE FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id;
    IF v_plan_id IS NOT NULL THEN
      UPDATE storage_vessel_allocations SET released_at = NOW(), filled_litres = 0 WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL;
      UPDATE storage_vessel_allocation_plans SET status = 'released', released_year = p_released_year, released_season = p_released_season, released_week = p_released_week WHERE company_id = p_company_id AND id = v_plan_id AND status IN ('reserved', 'active');
    END IF;
    RETURN TRUE;
  END IF;
  UPDATE wine_batches SET quantity = ROUND(v_remaining_quantity), volume_litres = CASE WHEN v_plan_id IS NULL THEN volume_litres ELSE v_remaining_litres END WHERE id = p_batch_id AND company_id = p_company_id;
  IF v_plan_id IS NOT NULL THEN
    UPDATE storage_vessel_allocation_plans SET required_litres = v_remaining_litres WHERE company_id = p_company_id AND id = v_plan_id AND status = 'active';
    WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL)
    UPDATE storage_vessel_allocations a SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, v_remaining_litres - f.before_litres)) FROM fills f WHERE a.id = f.id;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION append_storage_backed_harvest_batch(
  p_company_id UUID, p_batch_id TEXT, p_plan_id UUID, p_quantity NUMERIC, p_volume_litres NUMERIC,
  p_land_value_modifier_harvest_snapshot NUMERIC, p_structure_index_harvest_snapshot NUMERIC, p_taste_quality_index_harvest_snapshot NUMERIC,
  p_land_value_modifier NUMERIC, p_taste_quality_index NUMERIC, p_structure_index NUMERIC,
  p_characteristics JSONB, p_breakdown JSONB, p_wine_anchors JSONB, p_estimated_price NUMERIC,
  p_harvest_start_week INTEGER, p_harvest_start_season TEXT, p_harvest_start_year INTEGER,
  p_harvest_end_week INTEGER, p_harvest_end_season TEXT, p_harvest_end_year INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_capacity NUMERIC;
BEGIN
  IF p_quantity <= 0 OR p_volume_litres <= 0 THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = p_plan_id AND company_id = p_company_id AND status = 'active' AND wine_batch_id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL FOR UPDATE;
  SELECT COALESCE(SUM(assigned_capacity_litres), 0) INTO v_capacity FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL;
  IF v_capacity < p_volume_litres THEN RETURN FALSE; END IF;
  UPDATE wine_batches SET quantity = ROUND(p_quantity), volume_litres = p_volume_litres, land_value_modifier_harvest_snapshot = p_land_value_modifier_harvest_snapshot, structure_index_harvest_snapshot = p_structure_index_harvest_snapshot, taste_quality_index_harvest_snapshot = p_taste_quality_index_harvest_snapshot, land_value_modifier = p_land_value_modifier, taste_quality_index = p_taste_quality_index, structure_index = p_structure_index, characteristics = p_characteristics, breakdown = p_breakdown, wine_anchors = p_wine_anchors, estimated_price = p_estimated_price, harvest_start_week = p_harvest_start_week, harvest_start_season = p_harvest_start_season, harvest_start_year = p_harvest_start_year, harvest_end_week = p_harvest_end_week, harvest_end_season = p_harvest_end_season, harvest_end_year = p_harvest_end_year WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id AND state = 'grapes';
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE storage_vessel_allocation_plans SET required_litres = p_volume_litres WHERE id = p_plan_id AND company_id = p_company_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL)
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_volume_litres - f.before_litres)) FROM fills f WHERE a.id = f.id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION bottle_storage_backed_wine_batch(
  p_company_id UUID, p_batch_id TEXT, p_quantity NUMERIC, p_bottled_week INTEGER, p_bottled_season TEXT, p_bottled_year INTEGER,
  p_taste_quality_index_bottling_snapshot NUMERIC, p_land_value_modifier_bottling_snapshot NUMERIC, p_structure_index_bottling_snapshot NUMERIC, p_wine_score_bottling_snapshot NUMERIC,
  p_released_year INTEGER, p_released_season TEXT, p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_plan_id UUID;
BEGIN
  SELECT storage_plan_id INTO v_plan_id FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND state = 'must_fermenting' FOR UPDATE;
  IF NOT FOUND OR v_plan_id IS NULL THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = v_plan_id AND company_id = p_company_id AND status = 'active' AND wine_batch_id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE wine_batches SET state = 'bottled', quantity = FLOOR(p_quantity), bottled_week = p_bottled_week, bottled_season = p_bottled_season, bottled_year = p_bottled_year, taste_quality_index_bottling_snapshot = p_taste_quality_index_bottling_snapshot, land_value_modifier_bottling_snapshot = p_land_value_modifier_bottling_snapshot, structure_index_bottling_snapshot = p_structure_index_bottling_snapshot, wine_score_bottling_snapshot = p_wine_score_bottling_snapshot WHERE id = p_batch_id AND company_id = p_company_id;
  UPDATE storage_vessel_allocations SET released_at = NOW(), filled_litres = 0 WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL;
  UPDATE storage_vessel_allocation_plans SET status = 'released', released_year = p_released_year, released_season = p_released_season, released_week = p_released_week WHERE id = v_plan_id AND company_id = p_company_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION sell_storage_backed_wine_batch(
  p_company_id UUID, p_batch_id TEXT, p_quantity NUMERIC, p_amount NUMERIC, p_description TEXT, p_category TEXT,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_transaction JSONB;
BEGIN
  IF NOT consume_storage_backed_wine_batch(p_company_id, p_batch_id, p_quantity, p_year, p_season, p_week) THEN RAISE EXCEPTION 'Could not consume sale inventory'; END IF;
  v_transaction := record_company_transaction(p_company_id, p_amount, p_description, p_category, FALSE, p_week, p_season, p_year, FALSE);
  IF v_transaction IS NULL THEN RAISE EXCEPTION 'Could not record sale transaction'; END IF;
  RETURN v_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION deliver_forward_contract_inventory(
  p_company_id UUID, p_contract_id UUID, p_consumptions JSONB, p_new_delivered NUMERIC,
  p_fulfilled BOOLEAN, p_payment_amount NUMERIC, p_payment_description TEXT, p_payment_category TEXT,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_item JSONB; v_quantity NUMERIC; v_delivered NUMERIC; v_total NUMERIC; v_consumed NUMERIC;
  v_target_state TEXT; v_target_grape TEXT; v_batch_state TEXT; v_batch_grape TEXT; v_batch_quantity NUMERIC; v_transaction JSONB;
BEGIN
  SELECT delivered_kg, quantity_kg, target_state, target_grape INTO v_delivered, v_total, v_target_state, v_target_grape
  FROM grape_forward_contracts WHERE id = p_contract_id AND company_id = p_company_id AND status = 'accepted' FOR UPDATE;
  IF NOT FOUND OR p_new_delivered <= v_delivered OR p_new_delivered > v_total THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM((value->>'quantity')::NUMERIC), 0) INTO v_consumed FROM jsonb_array_elements(p_consumptions);
  IF v_consumed <= 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_consumptions) WHERE (value->>'quantity')::NUMERIC <= 0)
    OR ABS(p_new_delivered - (v_delivered + v_consumed)) > 0.001 OR p_fulfilled <> (p_new_delivered >= v_total) THEN RETURN NULL; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_consumptions) LOOP
    v_quantity := (v_item->>'quantity')::NUMERIC;
    SELECT state, grape, quantity INTO v_batch_state, v_batch_grape, v_batch_quantity FROM wine_batches WHERE id = v_item->>'batchId' AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND OR v_batch_quantity < v_quantity OR v_batch_state NOT IN ('grapes', 'must_ready', 'must_fermenting', 'bottled')
      OR (v_target_state <> 'any' AND v_batch_state <> v_target_state) OR (v_target_grape IS NOT NULL AND v_batch_grape <> v_target_grape) THEN RETURN NULL; END IF;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_consumptions) LOOP
    v_quantity := (v_item->>'quantity')::NUMERIC;
    IF NOT consume_storage_backed_wine_batch(p_company_id, v_item->>'batchId', v_quantity, p_year, p_season, p_week) THEN RAISE EXCEPTION 'Could not consume forward delivery inventory'; END IF;
  END LOOP;
  IF p_fulfilled THEN
    v_transaction := record_company_transaction(p_company_id, p_payment_amount, p_payment_description, p_payment_category, FALSE, p_week, p_season, p_year, FALSE);
    IF v_transaction IS NULL THEN RAISE EXCEPTION 'Could not record forward settlement'; END IF;
    UPDATE grape_forward_contracts SET delivered_kg = quantity_kg, status = 'fulfilled', settled_week = p_week, settled_season = p_season, settled_year = p_year, updated_at = NOW() WHERE id = p_contract_id AND company_id = p_company_id;
  ELSE
    UPDATE grape_forward_contracts SET delivered_kg = p_new_delivered, updated_at = NOW() WHERE id = p_contract_id AND company_id = p_company_id;
  END IF;
  RETURN jsonb_build_object('transaction', v_transaction);
END;
$$;
