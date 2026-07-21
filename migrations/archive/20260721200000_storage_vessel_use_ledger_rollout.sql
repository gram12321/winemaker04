-- Rollout 2: reset-only vessel-use provenance. No historical backfill is intentional.
CREATE TABLE IF NOT EXISTS storage_vessel_use_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES storage_vessels(id) ON DELETE RESTRICT,
  allocation_plan_id UUID NOT NULL REFERENCES storage_vessel_allocation_plans(id) ON DELETE RESTRICT,
  wine_batch_id TEXT NOT NULL REFERENCES wine_batches(id) ON DELETE RESTRICT,
  batch_state_at_first_use TEXT NOT NULL CHECK (batch_state_at_first_use IN ('grapes','must_ready','must_fermenting','bottled')),
  initial_filled_litres NUMERIC NOT NULL CHECK (initial_filled_litres > 0),
  used_year INTEGER NOT NULL,
  used_season TEXT NOT NULL,
  used_week INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vessel_id, allocation_plan_id)
);
CREATE INDEX IF NOT EXISTS idx_storage_vessel_use_ledger_company ON storage_vessel_use_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_vessel_use_ledger_vessel ON storage_vessel_use_ledger(vessel_id);
CREATE INDEX IF NOT EXISTS idx_storage_vessel_use_ledger_batch ON storage_vessel_use_ledger(wine_batch_id);
ALTER TABLE storage_vessel_use_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage storage vessel use ledger" ON storage_vessel_use_ledger;
CREATE POLICY "Users can manage storage vessel use ledger" ON storage_vessel_use_ledger FOR ALL
  USING (company_id IN (SELECT id FROM companies)) WITH CHECK (company_id IN (SELECT id FROM companies));

CREATE OR REPLACE FUNCTION record_storage_vessel_first_use(
  p_company_id UUID, p_plan_id UUID, p_batch_id TEXT,
  p_year INTEGER, p_season TEXT, p_week INTEGER
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_state TEXT; v_count INTEGER := 0; v_allocation RECORD; v_inserted UUID;
BEGIN
  SELECT state INTO v_state FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Storage vessel use requires a matching wine batch'; END IF;
  FOR v_allocation IN
    SELECT a.id, a.vessel_id, a.filled_litres
    FROM storage_vessel_allocations a
    WHERE a.company_id = p_company_id AND a.plan_id = p_plan_id AND a.released_at IS NULL AND a.filled_litres > 0
    FOR UPDATE
  LOOP
    v_inserted := NULL;
    INSERT INTO storage_vessel_use_ledger (company_id, vessel_id, allocation_plan_id, wine_batch_id, batch_state_at_first_use, initial_filled_litres, used_year, used_season, used_week)
    VALUES (p_company_id, v_allocation.vessel_id, p_plan_id, p_batch_id, v_state, v_allocation.filled_litres, p_year, p_season, p_week)
    ON CONFLICT (vessel_id, allocation_plan_id) DO NOTHING
    RETURNING id INTO v_inserted;
    IF v_inserted IS NOT NULL THEN
      UPDATE storage_vessels SET fill_history = fill_history + 1, cleanliness = 'dirty'
      WHERE id = v_allocation.vessel_id AND owner_company_id = p_company_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION activate_storage_vessel_plan_for_batch(
  p_company_id UUID, p_plan_id UUID, p_batch_id TEXT, p_volume_litres NUMERIC,
  p_year INTEGER, p_season TEXT, p_week INTEGER
) RETURNS storage_vessel_allocation_plans LANGUAGE plpgsql AS $$
DECLARE v_plan storage_vessel_allocation_plans; v_capacity NUMERIC;
BEGIN
  IF p_volume_litres <= 0 THEN RETURN NULL; END IF;
  SELECT * INTO v_plan FROM storage_vessel_allocation_plans
  WHERE id = p_plan_id AND company_id = p_company_id AND status = 'reserved' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(assigned_capacity_litres), 0) INTO v_capacity FROM storage_vessel_allocations
  WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL;
  IF v_capacity < p_volume_litres THEN RETURN NULL; END IF;
  PERFORM 1 FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND state <> 'bottled' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE storage_vessel_allocation_plans SET wine_batch_id = p_batch_id, status = 'active', required_litres = p_volume_litres,
    activated_year = p_year, activated_season = p_season, activated_week = p_week
  WHERE id = p_plan_id AND company_id = p_company_id;
  WITH fills AS (
    SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres
    FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL
  )
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(a.assigned_capacity_litres, GREATEST(0, p_volume_litres - fills.before_litres)) FROM fills WHERE a.id = fills.id;
  PERFORM record_storage_vessel_first_use(p_company_id, p_plan_id, p_batch_id, p_year, p_season, p_week);
  SELECT * INTO v_plan FROM storage_vessel_allocation_plans WHERE id = p_plan_id;
  RETURN v_plan;
END; $$;

CREATE OR REPLACE FUNCTION purchase_grape_market_offer(
  p_company_id UUID, p_purchase_id UUID, p_offer_id TEXT, p_quantity NUMERIC, p_vessel_ids UUID[], p_required_litres NUMERIC,
  p_batch JSONB, p_week INTEGER, p_season TEXT, p_year INTEGER, p_description TEXT, p_category TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_offer market_buy_offers%ROWTYPE; v_cost NUMERIC; v_transaction JSONB; v_result JSONB; v_plan_id UUID; v_capacity NUMERIC; v_vessel_count INTEGER;
BEGIN
  SELECT result INTO v_result FROM market_purchase_operations WHERE id = p_purchase_id AND company_id = p_company_id;
  IF FOUND THEN RETURN v_result || jsonb_build_object('completedNow', FALSE); END IF;
  IF p_quantity <= 0 OR p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN RETURN NULL; END IF;
  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE; IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_offer FROM market_buy_offers WHERE company_id = p_company_id AND offer_id = p_offer_id AND ware_group = 'grapes' FOR UPDATE;
  IF NOT FOUND OR v_offer.available_units < p_quantity THEN RETURN NULL; END IF;
  PERFORM 1 FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids) FOR UPDATE;
  SELECT COUNT(*), COALESCE(SUM(s.capacity_litres), 0) INTO v_vessel_count, v_capacity FROM storage_vessels s
  WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids) AND s.operational_status = 'operational'
    AND NOT EXISTS (SELECT 1 FROM storage_vessel_allocations a JOIN storage_vessel_allocation_plans plan ON plan.id = a.plan_id WHERE a.vessel_id = s.id AND a.released_at IS NULL AND plan.status IN ('reserved','active'));
  IF v_vessel_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres OR p_batch->>'id' IS NULL OR (p_batch->>'quantity')::NUMERIC <> p_quantity THEN RETURN NULL; END IF;
  v_cost := ROUND(v_offer.effective_price_per_unit * p_quantity, 2);
  v_transaction := record_company_transaction(p_company_id, -v_cost, p_description, p_category, FALSE, p_week, p_season, p_year, TRUE);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  INSERT INTO storage_vessel_allocation_plans (company_id, status, required_litres, created_year, created_season, created_week) VALUES (p_company_id, 'active', p_required_litres, p_year, p_season, p_week) RETURNING id INTO v_plan_id;
  INSERT INTO storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres) SELECT p_company_id, v_plan_id, id, capacity_litres FROM storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids);
  INSERT INTO wine_batches SELECT (jsonb_populate_record(NULL::wine_batches, p_batch || jsonb_build_object('company_id', p_company_id, 'storage_plan_id', v_plan_id, 'volume_litres', p_required_litres, 'created_at', NOW()))).*;
  UPDATE storage_vessel_allocation_plans SET wine_batch_id = p_batch->>'id' WHERE id = v_plan_id AND company_id = p_company_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = v_plan_id)
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(a.assigned_capacity_litres, GREATEST(0, p_required_litres - fills.before_litres)) FROM fills WHERE a.id = fills.id;
  PERFORM record_storage_vessel_first_use(p_company_id, v_plan_id, p_batch->>'id', p_year, p_season, p_week);
  UPDATE market_buy_offers SET available_units = available_units - p_quantity, updated_at = NOW() WHERE company_id = p_company_id AND offer_id = p_offer_id;
  v_result := jsonb_build_object('transaction', v_transaction); INSERT INTO market_purchase_operations (id, company_id, result) VALUES (p_purchase_id, p_company_id, v_result);
  RETURN v_result || jsonb_build_object('completedNow', TRUE);
END; $$;

CREATE OR REPLACE FUNCTION append_storage_backed_harvest_batch(
  p_company_id UUID, p_batch_id TEXT, p_plan_id UUID, p_quantity NUMERIC, p_volume_litres NUMERIC,
  p_land_value_modifier_harvest_snapshot NUMERIC, p_structure_index_harvest_snapshot NUMERIC, p_taste_quality_index_harvest_snapshot NUMERIC,
  p_land_value_modifier NUMERIC, p_taste_quality_index NUMERIC, p_structure_index NUMERIC, p_characteristics JSONB, p_breakdown JSONB, p_wine_anchors JSONB, p_estimated_price NUMERIC,
  p_harvest_start_week INTEGER, p_harvest_start_season TEXT, p_harvest_start_year INTEGER, p_harvest_end_week INTEGER, p_harvest_end_season TEXT, p_harvest_end_year INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_capacity NUMERIC;
BEGIN
  IF p_quantity <= 0 OR p_volume_litres <= 0 THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = p_plan_id AND company_id = p_company_id AND status = 'active' AND wine_batch_id = p_batch_id FOR UPDATE; IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM 1 FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL FOR UPDATE;
  SELECT COALESCE(SUM(assigned_capacity_litres), 0) INTO v_capacity FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL; IF v_capacity < p_volume_litres THEN RETURN FALSE; END IF;
  UPDATE wine_batches SET quantity = ROUND(p_quantity), volume_litres = p_volume_litres, land_value_modifier_harvest_snapshot = p_land_value_modifier_harvest_snapshot, structure_index_harvest_snapshot = p_structure_index_harvest_snapshot, taste_quality_index_harvest_snapshot = p_taste_quality_index_harvest_snapshot, land_value_modifier = p_land_value_modifier, taste_quality_index = p_taste_quality_index, structure_index = p_structure_index, characteristics = p_characteristics, breakdown = p_breakdown, wine_anchors = p_wine_anchors, estimated_price = p_estimated_price, harvest_start_week = p_harvest_start_week, harvest_start_season = p_harvest_start_season, harvest_start_year = p_harvest_start_year, harvest_end_week = p_harvest_end_week, harvest_end_season = p_harvest_end_season, harvest_end_year = p_harvest_end_year WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id AND state = 'grapes'; IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE storage_vessel_allocation_plans SET required_litres = p_volume_litres WHERE id = p_plan_id AND company_id = p_company_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL)
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(a.assigned_capacity_litres, GREATEST(0, p_volume_litres - fills.before_litres)) FROM fills WHERE a.id = fills.id;
  PERFORM record_storage_vessel_first_use(p_company_id, p_plan_id, p_batch_id, p_harvest_end_year, p_harvest_end_season, p_harvest_end_week);
  RETURN TRUE;
END; $$;
