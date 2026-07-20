-- Fixes the deployed used-vessel purchase RPC: record_company_transaction
-- returns JSONB/NULL, not BOOLEAN. This replacement preserves the listing lock,
-- date projection, authoritative value calculation, and atomic transfer.

CREATE OR REPLACE FUNCTION purchase_used_storage_vessel_listing(
  p_company_id uuid, p_listing_id uuid, p_price numeric, p_projected_condition numeric, p_year integer, p_season text, p_week integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vessel_id uuid;
  v_listing record;
  v_vessel storage_vessels;
  v_condition numeric;
  v_price numeric;
  v_current integer;
  v_listed integer;
  v_retired integer;
  v_transaction jsonb;
BEGIN
  SELECT * INTO v_listing
  FROM storage_vessel_market_listings
  WHERE id = p_listing_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_vessel_id := v_listing.vessel_id;
  SELECT * INTO v_vessel
  FROM storage_vessels
  WHERE id = v_vessel_id AND owner_kind = 'npc_market'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_current := p_year * 48
    + (CASE p_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12
    + GREATEST(0, p_week - 1);
  v_listed := v_listing.listed_year * 48
    + (CASE v_listing.listed_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12
    + GREATEST(0, v_listing.listed_week - 1);
  v_retired := v_listing.retired_year * 48
    + (CASE v_listing.retired_season WHEN 'Spring' THEN 0 WHEN 'Summer' THEN 1 WHEN 'Fall' THEN 2 ELSE 3 END) * 12
    + GREATEST(0, v_listing.retired_week - 1);
  IF v_current < v_listed OR v_current >= v_retired THEN RETURN NULL; END IF;

  v_condition := storage_vessel_market_projected_condition(
    v_listing.starting_condition, v_vessel.material,
    v_listing.listed_year, v_listing.listed_season, v_listing.listed_week,
    p_year, p_season, p_week
  );
  IF v_condition <= 0 THEN RETURN NULL; END IF;

  v_price := storage_vessel_market_used_value(v_vessel, v_condition, p_year);
  v_transaction := record_company_transaction(
    p_company_id, -v_price, 'Used vessel market purchase', 'supplies', false,
    p_week, p_season, p_year, true
  );
  IF v_transaction IS NULL THEN RETURN NULL; END IF;

  UPDATE storage_vessels
  SET owner_kind = 'company', owner_company_id = p_company_id,
      company_id = p_company_id, condition = v_condition
  WHERE id = v_vessel_id;
  UPDATE storage_vessel_market_listings
  SET status = 'sold', sold_at = now(), buyer_company_id = p_company_id
  WHERE id = p_listing_id;
  RETURN jsonb_build_object('transaction', v_transaction);
END; $$;
