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

CREATE OR REPLACE FUNCTION complete_empty_storage_vessel(
  p_company_id UUID, p_batch_id TEXT, p_plan_id UUID, p_vessel_id UUID, p_remaining_litres NUMERIC,
  p_remaining_quantity NUMERIC, p_released_at TIMESTAMPTZ, p_released_year INTEGER, p_released_season TEXT, p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_filled_litres NUMERIC;
  v_batch_litres NUMERIC;
  v_batch_quantity NUMERIC;
BEGIN
  PERFORM 1 FROM storage_vessel_allocation_plans WHERE id = p_plan_id AND company_id = p_company_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT filled_litres INTO v_filled_litres FROM storage_vessel_allocations
  WHERE company_id = p_company_id AND plan_id = p_plan_id AND vessel_id = p_vessel_id AND released_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT COALESCE(volume_litres, quantity), quantity INTO v_batch_litres, v_batch_quantity FROM wine_batches
  WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id FOR UPDATE;
  IF NOT FOUND OR v_batch_litres <= 0 THEN RETURN FALSE; END IF;
  IF ABS(p_remaining_litres - GREATEST(0, v_batch_litres - v_filled_litres)) > 0.001
    OR ABS(p_remaining_quantity - GREATEST(0, v_batch_quantity * GREATEST(0, v_batch_litres - v_filled_litres) / v_batch_litres)) > 0.001 THEN RETURN FALSE; END IF;
  IF p_remaining_litres <= 0 THEN
    DELETE FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    UPDATE storage_vessel_allocations SET released_at = p_released_at, filled_litres = 0 WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL;
    UPDATE storage_vessel_allocation_plans SET status = 'released', released_year = p_released_year, released_season = p_released_season, released_week = p_released_week WHERE id = p_plan_id AND company_id = p_company_id;
    RETURN TRUE;
  END IF;
  UPDATE wine_batches SET volume_litres = p_remaining_litres, quantity = ROUND(p_remaining_quantity) WHERE id = p_batch_id AND company_id = p_company_id AND storage_plan_id = p_plan_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE storage_vessel_allocations SET released_at = p_released_at, filled_litres = 0 WHERE company_id = p_company_id AND plan_id = p_plan_id AND vessel_id = p_vessel_id AND released_at IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE storage_vessel_allocation_plans SET required_litres = p_remaining_litres WHERE id = p_plan_id AND company_id = p_company_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = p_plan_id AND released_at IS NULL)
  UPDATE storage_vessel_allocations a SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_remaining_litres - f.before_litres)) FROM fills f WHERE a.id = f.id;
  RETURN TRUE;
END;
$$;
ALTER TABLE buy_goods_supplier_relationships
  ADD COLUMN IF NOT EXISTS consecutive_years integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_units_purchased numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_relationship_points numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_guard_year integer;

CREATE OR REPLACE FUNCTION record_buy_goods_supplier_purchase(
  p_company_id UUID, p_goods_domain TEXT, p_supplier_id TEXT, p_supplier_name TEXT,
  p_units_purchased NUMERIC, p_points NUMERIC, p_current_year INTEGER, p_yearly_cap NUMERIC
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_relation JSONB;
BEGIN
  INSERT INTO buy_goods_supplier_relationships (
    company_id, goods_domain, supplier_id, supplier_name, total_purchases, total_units_purchased,
    loyalty_score, year_guard_year, year_units_purchased, year_relationship_points, last_purchase_year, consecutive_years, updated_at
  ) VALUES (
    p_company_id, p_goods_domain, p_supplier_id, p_supplier_name, 1, p_units_purchased,
    LEAST(p_points, p_yearly_cap), p_current_year, p_units_purchased, LEAST(p_points, p_yearly_cap), p_current_year, 1, NOW()
  ) ON CONFLICT (company_id, goods_domain, supplier_id) DO UPDATE SET
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
