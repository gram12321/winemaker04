-- Clean development cutover: Buy Market relationships are buyer-to-counterparty,
-- regardless of whether an adapter supplies local stock or a global asset.

DROP FUNCTION IF EXISTS record_buy_goods_supplier_purchase(uuid, text, text, text, numeric, numeric, integer, numeric);
DROP TABLE IF EXISTS buy_goods_supplier_relationships;

CREATE TABLE buy_market_counterparty_relationships (
  buyer_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  counterparty_kind text NOT NULL CHECK (counterparty_kind IN ('supplier', 'npc', 'company')),
  counterparty_id text NOT NULL,
  counterparty_key text GENERATED ALWAYS AS (counterparty_kind || ':' || counterparty_id) STORED,
  counterparty_name text NOT NULL,
  total_purchases integer NOT NULL DEFAULT 0,
  total_units_purchased numeric NOT NULL DEFAULT 0,
  loyalty_score numeric NOT NULL DEFAULT 0,
  last_purchase_year integer,
  consecutive_years integer NOT NULL DEFAULT 0,
  year_units_purchased numeric NOT NULL DEFAULT 0,
  year_relationship_points numeric NOT NULL DEFAULT 0,
  year_guard_year integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_company_id, counterparty_kind, counterparty_id)
);

CREATE INDEX idx_buy_market_counterparty_relationships_lookup
  ON buy_market_counterparty_relationships (buyer_company_id, counterparty_key);

ALTER TABLE buy_market_counterparty_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies can manage their Buy Market relationships"
  ON buy_market_counterparty_relationships FOR ALL
  USING (buyer_company_id IN (SELECT id FROM companies))
  WITH CHECK (buyer_company_id IN (SELECT id FROM companies));

ALTER TABLE storage_vessel_market_listings
  ADD COLUMN IF NOT EXISTS seller_counterparty_id text;

UPDATE storage_vessel_market_listings
SET seller_counterparty_id = CASE
  WHEN seller_kind = 'company' THEN seller_company_id::text
  ELSE 'npc:' || trim(both '_' from regexp_replace(lower(seller_name), '[^a-z0-9]+', '_', 'g'))
END
WHERE seller_counterparty_id IS NULL;

CREATE OR REPLACE FUNCTION set_storage_vessel_listing_counterparty_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seller_counterparty_id IS NULL OR NEW.seller_counterparty_id = '' THEN
    NEW.seller_counterparty_id := CASE
      WHEN NEW.seller_kind = 'company' THEN NEW.seller_company_id::text
      ELSE 'npc:' || trim(both '_' from regexp_replace(lower(NEW.seller_name), '[^a-z0-9]+', '_', 'g'))
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_vessel_listing_counterparty_id ON storage_vessel_market_listings;
CREATE TRIGGER storage_vessel_listing_counterparty_id
  BEFORE INSERT OR UPDATE OF seller_kind, seller_name, seller_company_id
  ON storage_vessel_market_listings
  FOR EACH ROW EXECUTE FUNCTION set_storage_vessel_listing_counterparty_id();

ALTER TABLE storage_vessel_market_listings
  ALTER COLUMN seller_counterparty_id SET NOT NULL;

CREATE OR REPLACE FUNCTION buy_market_counterparty_price_multiplier(
  p_buyer_company_id uuid, p_counterparty_kind text, p_counterparty_id text
) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN COALESCE((SELECT loyalty_score FROM buy_market_counterparty_relationships
      WHERE buyer_company_id = p_buyer_company_id AND counterparty_kind = p_counterparty_kind
        AND counterparty_id = p_counterparty_id), 0) >= 14000 THEN .93
    WHEN COALESCE((SELECT loyalty_score FROM buy_market_counterparty_relationships
      WHERE buyer_company_id = p_buyer_company_id AND counterparty_kind = p_counterparty_kind
        AND counterparty_id = p_counterparty_id), 0) >= 8500 THEN .95
    WHEN COALESCE((SELECT loyalty_score FROM buy_market_counterparty_relationships
      WHERE buyer_company_id = p_buyer_company_id AND counterparty_kind = p_counterparty_kind
        AND counterparty_id = p_counterparty_id), 0) >= 4600 THEN .97
    WHEN COALESCE((SELECT loyalty_score FROM buy_market_counterparty_relationships
      WHERE buyer_company_id = p_buyer_company_id AND counterparty_kind = p_counterparty_kind
        AND counterparty_id = p_counterparty_id), 0) >= 2000 THEN .98
    WHEN COALESCE((SELECT loyalty_score FROM buy_market_counterparty_relationships
      WHERE buyer_company_id = p_buyer_company_id AND counterparty_kind = p_counterparty_kind
        AND counterparty_id = p_counterparty_id), 0) >= 700 THEN .99
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION record_buy_market_counterparty_purchase(
  p_buyer_company_id uuid, p_counterparty_kind text, p_counterparty_id text,
  p_counterparty_name text, p_units_purchased numeric, p_points numeric,
  p_current_year integer, p_yearly_cap numeric
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_relation jsonb;
BEGIN
  INSERT INTO buy_market_counterparty_relationships (
    buyer_company_id, counterparty_kind, counterparty_id, counterparty_name,
    total_purchases, total_units_purchased, loyalty_score, year_guard_year,
    year_units_purchased, year_relationship_points, last_purchase_year, consecutive_years
  ) VALUES (
    p_buyer_company_id, p_counterparty_kind, p_counterparty_id, p_counterparty_name,
    1, p_units_purchased, LEAST(p_points, p_yearly_cap), p_current_year,
    p_units_purchased, LEAST(p_points, p_yearly_cap), p_current_year, 1
  ) ON CONFLICT (buyer_company_id, counterparty_kind, counterparty_id) DO UPDATE SET
    counterparty_name = EXCLUDED.counterparty_name,
    total_purchases = buy_market_counterparty_relationships.total_purchases + 1,
    total_units_purchased = buy_market_counterparty_relationships.total_units_purchased + EXCLUDED.total_units_purchased,
    loyalty_score = buy_market_counterparty_relationships.loyalty_score + LEAST(p_points, GREATEST(0, p_yearly_cap - CASE WHEN buy_market_counterparty_relationships.year_guard_year = p_current_year THEN buy_market_counterparty_relationships.year_relationship_points ELSE 0 END)),
    year_guard_year = p_current_year,
    year_units_purchased = CASE WHEN buy_market_counterparty_relationships.year_guard_year = p_current_year THEN buy_market_counterparty_relationships.year_units_purchased + EXCLUDED.year_units_purchased ELSE EXCLUDED.year_units_purchased END,
    year_relationship_points = CASE WHEN buy_market_counterparty_relationships.year_guard_year = p_current_year THEN LEAST(p_yearly_cap, buy_market_counterparty_relationships.year_relationship_points + p_points) ELSE LEAST(p_points, p_yearly_cap) END,
    last_purchase_year = p_current_year,
    consecutive_years = CASE WHEN buy_market_counterparty_relationships.year_guard_year = p_current_year THEN buy_market_counterparty_relationships.consecutive_years WHEN buy_market_counterparty_relationships.last_purchase_year = p_current_year - 1 THEN buy_market_counterparty_relationships.consecutive_years + 1 ELSE 1 END,
    updated_at = now()
  RETURNING to_jsonb(buy_market_counterparty_relationships) INTO v_relation;
  RETURN v_relation;
END;
$$;

DROP FUNCTION IF EXISTS purchase_used_storage_vessel_listing(uuid, uuid, numeric, numeric, integer, text, integer);
CREATE FUNCTION purchase_used_storage_vessel_listing(
  p_company_id uuid, p_listing_id uuid, p_year integer, p_season text, p_week integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vessel_id uuid; v_listing record; v_vessel storage_vessels; v_condition numeric;
  v_price numeric; v_current integer; v_listed integer; v_retired integer; v_transaction jsonb;
  v_counterparty_kind text; v_counterparty_id text;
BEGIN
  SELECT * INTO v_listing FROM storage_vessel_market_listings
  WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_vessel FROM storage_vessels
  WHERE id = v_listing.vessel_id AND owner_kind = 'npc_market' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_current := p_year * 48 + (CASE p_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, p_week - 1);
  v_listed := v_listing.listed_year * 48 + (CASE v_listing.listed_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, v_listing.listed_week - 1);
  v_retired := v_listing.retired_year * 48 + (CASE v_listing.retired_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, v_listing.retired_week - 1);
  IF v_current < v_listed OR v_current >= v_retired THEN RETURN NULL; END IF;
  v_condition := storage_vessel_market_projected_condition(v_listing.starting_condition, v_vessel.material, v_listing.listed_year, v_listing.listed_season, v_listing.listed_week, p_year, p_season, p_week);
  IF v_condition <= 0 THEN RETURN NULL; END IF;
  v_counterparty_kind := v_listing.seller_kind;
  v_counterparty_id := v_listing.seller_counterparty_id;
  v_price := ROUND(storage_vessel_market_used_value(v_vessel, v_condition, p_year) * buy_market_counterparty_price_multiplier(p_company_id, v_counterparty_kind, v_counterparty_id), 2);
  v_transaction := record_company_transaction(p_company_id, -v_price, 'Used vessel market purchase', 'supplies', false, p_week, p_season, p_year, true);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  UPDATE storage_vessels SET owner_kind = 'company', owner_company_id = p_company_id, company_id = p_company_id, condition = v_condition WHERE id = v_listing.vessel_id;
  UPDATE storage_vessel_market_listings SET status = 'sold', sold_at = now(), buyer_company_id = p_company_id WHERE id = p_listing_id;
  PERFORM record_buy_market_counterparty_purchase(p_company_id, v_counterparty_kind, v_counterparty_id, v_listing.seller_name, 1, ROUND(v_price * .25), p_year, 2600);
  RETURN jsonb_build_object('transaction', v_transaction);
END;
$$;
