CREATE OR REPLACE FUNCTION consume_storage_backed_wine_batch(
  p_company_id UUID,
  p_batch_id TEXT,
  p_quantity NUMERIC,
  p_released_year INTEGER,
  p_released_season TEXT,
  p_released_week INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_quantity NUMERIC;
  v_volume_litres NUMERIC;
  v_plan_id UUID;
  v_remaining_quantity NUMERIC;
  v_remaining_litres NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN RETURN FALSE; END IF;

  SELECT quantity, COALESCE(volume_litres, quantity), storage_plan_id
  INTO v_quantity, v_volume_litres, v_plan_id
  FROM wine_batches
  WHERE id = p_batch_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND OR v_quantity < p_quantity THEN RETURN FALSE; END IF;

  v_remaining_quantity := v_quantity - p_quantity;
  v_remaining_litres := CASE
    WHEN v_quantity > 0 THEN GREATEST(0, v_volume_litres * v_remaining_quantity / v_quantity)
    ELSE 0
  END;

  IF v_remaining_quantity <= 0 THEN
    DELETE FROM wine_batches WHERE id = p_batch_id AND company_id = p_company_id;
    IF v_plan_id IS NOT NULL THEN
      UPDATE storage_vessel_allocations
      SET released_at = NOW(), filled_litres = 0
      WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL;
      UPDATE storage_vessel_allocation_plans
      SET status = 'released', released_year = p_released_year, released_season = p_released_season, released_week = p_released_week
      WHERE company_id = p_company_id AND id = v_plan_id AND status IN ('reserved', 'active');
    END IF;
    RETURN TRUE;
  END IF;

  UPDATE wine_batches
  SET quantity = ROUND(v_remaining_quantity),
      volume_litres = CASE WHEN v_plan_id IS NULL THEN volume_litres ELSE v_remaining_litres END
  WHERE id = p_batch_id AND company_id = p_company_id;

  IF v_plan_id IS NOT NULL THEN
    UPDATE storage_vessel_allocation_plans
    SET required_litres = v_remaining_litres
    WHERE company_id = p_company_id AND id = v_plan_id AND status = 'active';

    WITH fills AS (
      SELECT id, assigned_capacity_litres,
        COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres
      FROM storage_vessel_allocations
      WHERE company_id = p_company_id AND plan_id = v_plan_id AND released_at IS NULL
    )
    UPDATE storage_vessel_allocations a
    SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, v_remaining_litres - f.before_litres))
    FROM fills f
    WHERE a.id = f.id;
  END IF;

  RETURN TRUE;
END;
$$;

UPDATE buy_goods_supplier_relationships
SET year_relationship_points = GREATEST(year_relationship_points, COALESCE(year_loyalty_points, 0));

UPDATE staff
SET skill_maintenance = 0.3
WHERE skill_maintenance = skill_administration_and_research;

CREATE OR REPLACE FUNCTION record_company_transaction(
  p_company_id UUID, p_amount NUMERIC, p_description TEXT, p_category TEXT, p_recurring BOOLEAN,
  p_week INTEGER, p_season TEXT, p_year INTEGER, p_require_funds BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_money NUMERIC; v_new_money NUMERIC; v_transaction JSONB;
BEGIN
  SELECT money INTO v_money FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_new_money := v_money + p_amount;
  IF p_require_funds AND v_new_money < 0 THEN RETURN NULL; END IF;
  UPDATE companies SET money = v_new_money WHERE id = p_company_id;
  INSERT INTO transactions (company_id, amount, description, category, recurring, money, week, season, year, created_at)
  VALUES (p_company_id, p_amount, p_description, p_category, p_recurring, v_new_money, p_week, p_season, p_year, NOW())
  RETURNING to_jsonb(transactions) INTO v_transaction;
  RETURN v_transaction;
END;
$$;
