-- The Buy Market migration was consolidated after the original
-- 20260712110000 migration had already been applied in some databases.
-- Install the atomic cask purchase command in a new migration so existing
-- databases receive the same purchase path as fresh installations.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS money_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS production_year INTEGER;

UPDATE storage_vessels
SET production_year = purchased_year
WHERE production_year IS NULL;

ALTER TABLE storage_vessels
  ALTER COLUMN production_year SET NOT NULL;

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
  UPDATE companies SET money = v_new_money, money_version = v_money_version + 1
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
  v_transaction := record_company_transaction(
    p_company_id, -v_cost, p_description, p_category, FALSE,
    p_week, p_season, p_year, TRUE
  );
  IF v_transaction IS NULL THEN RETURN NULL; END IF;

  UPDATE market_buy_offers
  SET available_units = available_units - p_quantity, updated_at = NOW()
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
  INSERT INTO market_purchase_operations (id, company_id, result)
  VALUES (p_purchase_id, p_company_id, v_result);
  RETURN v_result || jsonb_build_object('completedNow', TRUE);
END;
$$;
