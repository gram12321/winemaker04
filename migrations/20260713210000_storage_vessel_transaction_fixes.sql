CREATE OR REPLACE FUNCTION append_storage_backed_harvest_batch(
  p_company_id UUID,
  p_batch_id TEXT,
  p_plan_id UUID,
  p_quantity NUMERIC,
  p_volume_litres NUMERIC,
  p_land_value_modifier_harvest_snapshot NUMERIC,
  p_structure_index_harvest_snapshot NUMERIC,
  p_taste_quality_index_harvest_snapshot NUMERIC,
  p_land_value_modifier NUMERIC,
  p_taste_quality_index NUMERIC,
  p_structure_index NUMERIC,
  p_characteristics JSONB,
  p_breakdown JSONB,
  p_wine_anchors JSONB,
  p_estimated_price NUMERIC,
  p_harvest_start_week INTEGER,
  p_harvest_start_season TEXT,
  p_harvest_start_year INTEGER,
  p_harvest_end_week INTEGER,
  p_harvest_end_season TEXT,
  p_harvest_end_year INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_capacity NUMERIC;
BEGIN
  IF p_quantity <= 0 OR p_volume_litres <= 0 THEN RETURN FALSE; END IF;

  PERFORM 1 FROM storage_vessel_allocation_plans
  WHERE id = p_plan_id AND company_id = p_company_id AND status = 'active' AND wine_batch_id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM 1 FROM storage_vessel_allocations
  WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL
  FOR UPDATE;
  SELECT COALESCE(SUM(assigned_capacity_litres), 0) INTO v_capacity
  FROM storage_vessel_allocations
  WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL;
  IF v_capacity < p_volume_litres THEN RETURN FALSE; END IF;

  UPDATE wine_batches SET
    quantity = ROUND(p_quantity), volume_litres = p_volume_litres,
    land_value_modifier_harvest_snapshot = p_land_value_modifier_harvest_snapshot,
    structure_index_harvest_snapshot = p_structure_index_harvest_snapshot,
    taste_quality_index_harvest_snapshot = p_taste_quality_index_harvest_snapshot,
    land_value_modifier = p_land_value_modifier, taste_quality_index = p_taste_quality_index,
    structure_index = p_structure_index, characteristics = p_characteristics,
    breakdown = p_breakdown, wine_anchors = p_wine_anchors, estimated_price = p_estimated_price,
    harvest_start_week = p_harvest_start_week, harvest_start_season = p_harvest_start_season,
    harvest_start_year = p_harvest_start_year, harvest_end_week = p_harvest_end_week,
    harvest_end_season = p_harvest_end_season, harvest_end_year = p_harvest_end_year
  WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id AND state = 'grapes';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE storage_vessel_allocation_plans SET required_litres = p_volume_litres
  WHERE id = p_plan_id AND company_id = p_company_id;

  WITH fills AS (
    SELECT id, assigned_capacity_litres,
      COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres
    FROM storage_vessel_allocations
    WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL
  )
  UPDATE storage_vessel_allocations a
  SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_volume_litres - f.before_litres))
  FROM fills f WHERE a.id = f.id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION bottle_storage_backed_wine_batch(
  p_company_id UUID, p_batch_id TEXT, p_quantity NUMERIC,
  p_bottled_week INTEGER, p_bottled_season TEXT, p_bottled_year INTEGER,
  p_taste_quality_index_bottling_snapshot NUMERIC,
  p_land_value_modifier_bottling_snapshot NUMERIC,
  p_structure_index_bottling_snapshot NUMERIC,
  p_wine_score_bottling_snapshot NUMERIC,
  p_released_year INTEGER, p_released_season TEXT, p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_plan_id UUID;
BEGIN
  SELECT storage_plan_id INTO v_plan_id FROM wine_batches
  WHERE id = p_batch_id AND company_id = p_company_id AND state = 'must_fermenting'
  FOR UPDATE;
  IF NOT FOUND OR v_plan_id IS NULL THEN RETURN FALSE; END IF;

  PERFORM 1 FROM storage_vessel_allocation_plans
  WHERE id = v_plan_id AND company_id = p_company_id AND status = 'active' AND wine_batch_id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE wine_batches SET
    state = 'bottled', quantity = FLOOR(p_quantity),
    bottled_week = p_bottled_week, bottled_season = p_bottled_season, bottled_year = p_bottled_year,
    taste_quality_index_bottling_snapshot = p_taste_quality_index_bottling_snapshot,
    land_value_modifier_bottling_snapshot = p_land_value_modifier_bottling_snapshot,
    structure_index_bottling_snapshot = p_structure_index_bottling_snapshot,
    wine_score_bottling_snapshot = p_wine_score_bottling_snapshot
  WHERE id = p_batch_id AND company_id = p_company_id;

  UPDATE storage_vessel_allocations SET released_at = NOW(), filled_litres = 0
  WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL;
  UPDATE storage_vessel_allocation_plans SET
    status = 'released', released_year = p_released_year,
    released_season = p_released_season, released_week = p_released_week
  WHERE id = v_plan_id AND company_id = p_company_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION sell_storage_backed_wine_batch(
  p_company_id UUID, p_batch_id TEXT, p_quantity NUMERIC,
  p_amount NUMERIC, p_description TEXT, p_category TEXT,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_transaction JSONB;
BEGIN
  IF NOT consume_storage_backed_wine_batch(p_company_id, p_batch_id, p_quantity, p_year, p_season, p_week) THEN
    RAISE EXCEPTION 'Could not consume sale inventory';
  END IF;
  v_transaction := record_company_transaction(
    p_company_id, p_amount, p_description, p_category, FALSE,
    p_week, p_season, p_year, FALSE
  );
  IF v_transaction IS NULL THEN RAISE EXCEPTION 'Could not record sale transaction'; END IF;
  RETURN v_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION deliver_forward_contract_inventory(
  p_company_id UUID, p_contract_id UUID, p_consumptions JSONB, p_new_delivered NUMERIC,
  p_fulfilled BOOLEAN, p_payment_amount NUMERIC, p_payment_description TEXT, p_payment_category TEXT,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_item JSONB; v_quantity NUMERIC; v_delivered NUMERIC; v_total NUMERIC; v_consumed NUMERIC; v_transaction JSONB;
BEGIN
  SELECT delivered_kg, quantity_kg INTO v_delivered, v_total
  FROM grape_forward_contracts
  WHERE id = p_contract_id AND company_id = p_company_id AND status = 'accepted'
  FOR UPDATE;
  IF NOT FOUND OR p_new_delivered <= v_delivered OR p_new_delivered > v_total THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM((value->>'quantity')::NUMERIC), 0) INTO v_consumed
  FROM jsonb_array_elements(p_consumptions);
  IF v_consumed <= 0
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_consumptions) WHERE (value->>'quantity')::NUMERIC <= 0)
    OR ABS(p_new_delivered - (v_delivered + v_consumed)) > 0.001
    OR p_fulfilled <> (p_new_delivered >= v_total) THEN RETURN NULL; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_consumptions)
  LOOP
    v_quantity := (v_item->>'quantity')::NUMERIC;
    IF NOT consume_storage_backed_wine_batch(p_company_id, v_item->>'batchId', v_quantity, p_year, p_season, p_week) THEN
      RAISE EXCEPTION 'Could not consume forward delivery inventory';
    END IF;
  END LOOP;

  IF p_fulfilled THEN
    v_transaction := record_company_transaction(
      p_company_id, p_payment_amount, p_payment_description, p_payment_category, FALSE,
      p_week, p_season, p_year, FALSE
    );
    IF v_transaction IS NULL THEN RAISE EXCEPTION 'Could not record forward settlement'; END IF;
    UPDATE grape_forward_contracts SET
      delivered_kg = quantity_kg, status = 'fulfilled', settled_week = p_week,
      settled_season = p_season, settled_year = p_year, updated_at = NOW()
    WHERE id = p_contract_id AND company_id = p_company_id;
  ELSE
    UPDATE grape_forward_contracts SET delivered_kg = p_new_delivered, updated_at = NOW()
    WHERE id = p_contract_id AND company_id = p_company_id;
  END IF;
  RETURN jsonb_build_object('transaction', v_transaction);
END;
$$;
