CREATE OR REPLACE FUNCTION deliver_forward_contract_inventory(
  p_company_id UUID, p_contract_id UUID, p_consumptions JSONB, p_new_delivered NUMERIC,
  p_fulfilled BOOLEAN, p_payment_amount NUMERIC, p_payment_description TEXT, p_payment_category TEXT,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_item JSONB;
  v_quantity NUMERIC;
  v_delivered NUMERIC;
  v_total NUMERIC;
  v_consumed NUMERIC;
  v_target_state TEXT;
  v_target_grape TEXT;
  v_batch_state TEXT;
  v_batch_grape TEXT;
  v_batch_quantity NUMERIC;
  v_transaction JSONB;
BEGIN
  SELECT delivered_kg, quantity_kg, target_state, target_grape
  INTO v_delivered, v_total, v_target_state, v_target_grape
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
    SELECT state, grape, quantity INTO v_batch_state, v_batch_grape, v_batch_quantity
    FROM wine_batches
    WHERE id = v_item->>'batchId' AND company_id = p_company_id
    FOR UPDATE;
    IF NOT FOUND
      OR v_batch_quantity < v_quantity
      OR v_batch_state NOT IN ('grapes', 'must_ready', 'must_fermenting', 'bottled')
      OR (v_target_state <> 'any' AND v_batch_state <> v_target_state)
      OR (v_target_grape IS NOT NULL AND v_batch_grape <> v_target_grape) THEN RETURN NULL; END IF;
  END LOOP;

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
