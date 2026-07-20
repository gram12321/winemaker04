-- Development-only cutover. Existing vessel/listing data is deliberately discarded.
-- Allocation tables remain so the established harvest, bottling, and sale RPCs keep their contracts.

DROP TABLE IF EXISTS storage_vessel_market_listings CASCADE;
DELETE FROM storage_vessel_allocations;
DELETE FROM storage_vessel_allocation_plans;
DELETE FROM storage_vessels;

ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS owner_kind text,
  ADD COLUMN IF NOT EXISTS owner_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE storage_vessels ALTER COLUMN company_id DROP NOT NULL;
UPDATE storage_vessels SET owner_kind = 'company', owner_company_id = company_id WHERE owner_kind IS NULL;
ALTER TABLE storage_vessels ALTER COLUMN owner_kind SET NOT NULL;
-- A prior SQL-editor attempt may have completed these statements before failing
-- later in this development-only cutover. Recreate the named constraints cleanly.
ALTER TABLE storage_vessels DROP CONSTRAINT IF EXISTS storage_vessels_owner_kind_check;
ALTER TABLE storage_vessels DROP CONSTRAINT IF EXISTS storage_vessels_owner_check;
ALTER TABLE storage_vessels ADD CONSTRAINT storage_vessels_owner_kind_check CHECK (owner_kind IN ('company', 'npc_market'));
ALTER TABLE storage_vessels ADD CONSTRAINT storage_vessels_owner_check CHECK (
  (owner_kind = 'company' AND owner_company_id IS NOT NULL) OR (owner_kind = 'npc_market' AND owner_company_id IS NULL)
);

-- Allocation commands are rebuilt separately; this temporary generated mirror keeps the
-- current production commands functional while all application ownership reads use owner fields.
CREATE OR REPLACE FUNCTION sync_storage_vessel_owner_company_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.company_id := CASE WHEN NEW.owner_kind = 'company' THEN NEW.owner_company_id ELSE NULL END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS storage_vessel_owner_company_sync ON storage_vessels;
CREATE TRIGGER storage_vessel_owner_company_sync BEFORE INSERT OR UPDATE OF owner_kind, owner_company_id ON storage_vessels
FOR EACH ROW EXECUTE FUNCTION sync_storage_vessel_owner_company_id();

DROP POLICY IF EXISTS "Users can manage storage vessels" ON storage_vessels;
DROP POLICY IF EXISTS "Companies own vessels and can view active market assets" ON storage_vessels;
DROP POLICY IF EXISTS "Companies can manage owned storage vessels" ON storage_vessels;
CREATE POLICY "Companies own vessels and can view active market assets"
  ON storage_vessels FOR SELECT
  USING (
    (owner_kind = 'company' AND owner_company_id IN (SELECT id FROM companies))
    OR owner_kind = 'npc_market'
  );
CREATE POLICY "Companies can manage owned storage vessels"
  ON storage_vessels FOR ALL
  USING (owner_kind = 'company' AND owner_company_id IN (SELECT id FROM companies))
  WITH CHECK (owner_kind = 'company' AND owner_company_id IN (SELECT id FROM companies));

CREATE TABLE IF NOT EXISTS storage_vessel_market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL UNIQUE REFERENCES storage_vessels(id) ON DELETE CASCADE,
  seller_kind text NOT NULL CHECK (seller_kind IN ('npc', 'company')),
  seller_name text NOT NULL,
  seller_company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT storage_vessel_market_listings_seller_check CHECK (
    (seller_kind = 'company' AND seller_company_id IS NOT NULL)
    OR (seller_kind = 'npc' AND seller_company_id IS NULL)
  ),
  origin text NOT NULL CHECK (origin IN ('npc_generated', 'player_sellback')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'retired')),
  evolution_seed text NOT NULL,
  generation_key text UNIQUE NULL,
  starting_condition numeric NOT NULL CHECK (starting_condition BETWEEN 0 AND 1),
  listed_year integer NOT NULL, listed_season text NOT NULL, listed_week integer NOT NULL,
  retired_year integer NOT NULL, retired_season text NOT NULL, retired_week integer NOT NULL,
  sold_at timestamptz NULL, buyer_company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_vessel_market_listing_active_idx ON storage_vessel_market_listings(status, listed_year, listed_season, listed_week);
ALTER TABLE storage_vessel_market_listings ADD COLUMN IF NOT EXISTS seller_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE storage_vessel_market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active global storage vessel listings"
  ON storage_vessel_market_listings FOR SELECT
  USING (status = 'active');

CREATE OR REPLACE FUNCTION admin_clear_global_market(p_ware_group text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_ware_group IS NULL OR p_ware_group IN ('grapes', 'storage_vessels') THEN
    DELETE FROM market_buy_offers WHERE p_ware_group IS NULL OR ware_group = p_ware_group;
  ELSE
    RAISE EXCEPTION 'Unsupported market goods group: %', p_ware_group;
  END IF;
  IF p_ware_group IS NULL OR p_ware_group = 'storage_vessels' THEN
    DELETE FROM storage_vessel_market_listings WHERE true;
    DELETE FROM storage_vessels WHERE owner_kind = 'npc_market';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION storage_vessel_market_retirement_date(
  p_condition numeric, p_material text, p_year integer, p_season text, p_week integer
) RETURNS TABLE(year_value integer, season_value text, week_value integer) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_decay numeric; v_weeks integer; v_start integer; v_total integer; v_season_index integer;
BEGIN
  v_decay := CASE p_material
    WHEN 'oak' THEN 0.0035 WHEN 'chestnut' THEN 0.004 WHEN 'stainless_steel' THEN 0.0008
    WHEN 'concrete' THEN 0.0015 WHEN 'ceramic' THEN 0.0025 WHEN 'plastic' THEN 0.0045 ELSE 0.0035 END;
  v_weeks := CEIL(GREATEST(0, p_condition) / v_decay);
  v_season_index := CASE p_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END;
  v_start := p_year * 48 + v_season_index * 12 + GREATEST(0, p_week - 1);
  v_total := v_start + v_weeks;
  year_value := v_total / 48;
  season_value := (ARRAY['Spring','Summer','Fall','Winter'])[(v_total % 48) / 12 + 1];
  week_value := (v_total % 12) + 1;
  RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION storage_vessel_market_projected_condition(
  p_start_condition numeric, p_material text, p_listed_year integer, p_listed_season text, p_listed_week integer,
  p_year integer, p_season text, p_week integer
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_start integer; v_current integer; v_decay numeric; v_season integer;
BEGIN
  v_season := CASE p_listed_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END;
  v_start := p_listed_year * 48 + v_season * 12 + GREATEST(0, p_listed_week - 1);
  v_season := CASE p_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END;
  v_current := p_year * 48 + v_season * 12 + GREATEST(0, p_week - 1);
  v_decay := CASE p_material WHEN 'oak' THEN 0.0035 WHEN 'chestnut' THEN 0.004 WHEN 'stainless_steel' THEN 0.0008 WHEN 'concrete' THEN 0.0015 WHEN 'ceramic' THEN 0.0025 WHEN 'plastic' THEN 0.0045 ELSE 0.0035 END;
  RETURN GREATEST(0, ROUND(p_start_condition - GREATEST(0, v_current - v_start) * v_decay, 4));
END; $$;

CREATE OR REPLACE FUNCTION storage_vessel_market_used_value(p_vessel storage_vessels, p_condition numeric, p_year integer)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE q numeric := LEAST(1, GREATEST(0, p_vessel.quality_score)); v_quality numeric; v_age numeric; v_age_multiplier numeric;
BEGIN
  v_quality := CASE WHEN q < .3 THEN 1 + q*q*2 WHEN q < .6 THEN 1.18 + ln(1 + (q - .3) * 2) * .6 WHEN q < .8 THEN 1.78 + (q - .6) * 5 WHEN q < .9 THEN 2.78 + power((q - .8) * 10, 1.5) * 2.5 WHEN q < .95 THEN 5.28 + power((q - .9) * 20, 2) * 10 ELSE 15.28 END;
  v_age := GREATEST(0, p_year - p_vessel.production_year);
  v_age_multiplier := .03 + .97 * exp(-v_age / 10);
  RETURN GREATEST(0, ROUND(850 * (p_vessel.capacity_litres / 250) * (q * v_quality) * v_age_multiplier * p_condition * (1 / (1 + p_vessel.fill_history * .035)) * CASE WHEN p_vessel.cleanliness = 'dirty' THEN .8 ELSE 1 END, 2));
END; $$;

DROP FUNCTION IF EXISTS sell_storage_vessel_to_market(uuid, uuid, uuid, numeric, integer, text, integer);
DROP FUNCTION IF EXISTS sell_storage_vessel_to_market(uuid, text, uuid, numeric, integer, text, integer);
CREATE FUNCTION sell_storage_vessel_to_market(
  p_company_id uuid, p_company_name text, p_vessel_id uuid, p_payout numeric, p_year integer, p_season text, p_week integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_condition numeric; v_retire record;
BEGIN
  PERFORM 1 FROM storage_vessels v WHERE v.id = p_vessel_id AND v.owner_kind = 'company' AND v.owner_company_id = p_company_id
    AND v.operational_status = 'operational' FOR UPDATE;
  IF NOT FOUND
    OR EXISTS (SELECT 1 FROM storage_vessel_allocations a WHERE a.vessel_id = p_vessel_id AND a.released_at IS NULL)
    OR EXISTS (SELECT 1 FROM activities a WHERE a.company_id = p_company_id AND a.status IN ('active', 'paused')
      AND (a.params->>'vesselId' = p_vessel_id::text))
  THEN RETURN false; END IF;
  SELECT condition INTO v_condition FROM storage_vessels WHERE id = p_vessel_id;
  SELECT * INTO v_retire FROM storage_vessel_market_retirement_date(v_condition, (SELECT material FROM storage_vessels WHERE id = p_vessel_id), p_year, p_season, p_week);
  UPDATE storage_vessels SET owner_kind = 'npc_market', owner_company_id = NULL, company_id = NULL WHERE id = p_vessel_id;
  INSERT INTO storage_vessel_market_listings (vessel_id, seller_kind, seller_name, seller_company_id, origin, evolution_seed, starting_condition, listed_year, listed_season, listed_week, retired_year, retired_season, retired_week)
  VALUES (p_vessel_id, 'company', p_company_name, p_company_id, 'player_sellback', concat('sellback:', p_vessel_id, ':', p_year, ':', p_season, ':', p_week),
    v_condition, p_year, p_season, p_week, v_retire.year_value, v_retire.season_value, v_retire.week_value)
  ON CONFLICT (vessel_id) DO UPDATE SET
    seller_kind = EXCLUDED.seller_kind,
    seller_name = EXCLUDED.seller_name,
    seller_company_id = EXCLUDED.seller_company_id,
    origin = EXCLUDED.origin,
    status = 'active',
    evolution_seed = EXCLUDED.evolution_seed,
    generation_key = NULL,
    starting_condition = EXCLUDED.starting_condition,
    listed_year = EXCLUDED.listed_year,
    listed_season = EXCLUDED.listed_season,
    listed_week = EXCLUDED.listed_week,
    retired_year = EXCLUDED.retired_year,
    retired_season = EXCLUDED.retired_season,
    retired_week = EXCLUDED.retired_week,
    sold_at = NULL,
    buyer_company_id = NULL;
  PERFORM record_company_transaction(p_company_id, p_payout, 'Used vessel market sale', 'sales', false, p_week, p_season, p_year, false);
  RETURN true;
END; $$;

DROP FUNCTION IF EXISTS purchase_used_storage_vessel_listing(uuid, uuid, numeric, numeric, integer, text, integer);
CREATE FUNCTION purchase_used_storage_vessel_listing(
  p_company_id uuid, p_listing_id uuid, p_price numeric, p_projected_condition numeric, p_year integer, p_season text, p_week integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_vessel_id uuid; v_listing record; v_vessel storage_vessels; v_condition numeric; v_price numeric; v_current integer; v_listed integer; v_retired integer; v_transaction jsonb;
BEGIN
  SELECT * INTO v_listing FROM storage_vessel_market_listings WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_vessel_id := v_listing.vessel_id;
  SELECT * INTO v_vessel FROM storage_vessels WHERE id = v_vessel_id AND owner_kind = 'npc_market' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_current := p_year * 48 + (CASE p_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, p_week - 1);
  v_listed := v_listing.listed_year * 48 + (CASE v_listing.listed_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, v_listing.listed_week - 1);
  v_retired := v_listing.retired_year * 48 + (CASE v_listing.retired_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12 + GREATEST(0, v_listing.retired_week - 1);
  IF v_current < v_listed OR v_current >= v_retired THEN RETURN NULL; END IF;
  v_condition := storage_vessel_market_projected_condition(v_listing.starting_condition, v_vessel.material, v_listing.listed_year, v_listing.listed_season, v_listing.listed_week, p_year, p_season, p_week);
  IF v_condition <= 0 THEN RETURN NULL; END IF;
  v_price := storage_vessel_market_used_value(v_vessel, v_condition, p_year);
  v_transaction := record_company_transaction(p_company_id, -v_price, 'Used vessel market purchase', 'supplies', false, p_week, p_season, p_year, true);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  UPDATE storage_vessels SET owner_kind = 'company', owner_company_id = p_company_id, company_id = p_company_id, condition = v_condition WHERE id = v_vessel_id;
  UPDATE storage_vessel_market_listings SET status = 'sold', sold_at = now(), buyer_company_id = p_company_id WHERE id = p_listing_id;
  RETURN jsonb_build_object('transaction', v_transaction);
END; $$;
