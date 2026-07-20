-- NPC inventory generation may be retried after a partially completed market
-- reset. Treat both the generation key and canonical vessel identity as idempotent.
CREATE OR REPLACE FUNCTION ensure_npc_used_storage_vessel_listings(
  p_year integer,
  p_season text,
  p_week integer,
  p_listings jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing jsonb;
  v_generation_key text;
  v_material text;
  v_condition numeric;
  v_vessel_id uuid;
  v_retirement record;
BEGIN
  IF jsonb_typeof(p_listings) <> 'array' THEN RAISE EXCEPTION 'NPC vessel listings must be an array'; END IF;
  FOR v_listing IN SELECT value FROM jsonb_array_elements(p_listings) LOOP
    v_generation_key := v_listing->>'generationKey';
    v_material := v_listing->>'material';
    v_condition := (v_listing->>'condition')::numeric;
    IF v_generation_key IS NULL OR v_listing->>'sellerCounterpartyId' IS NULL OR v_listing->>'sellerName' IS NULL
      OR v_listing->>'vesselName' IS NULL OR v_material IS NULL OR (v_listing->>'capacityLitres')::numeric <= 0
      OR (v_listing->>'qualityScore')::numeric NOT BETWEEN 0 AND 1 OR v_condition NOT BETWEEN 0 AND 1
      OR (v_listing->>'fillHistory')::integer < 0 OR (v_listing->>'cleanliness') NOT IN ('clean', 'dirty')
    THEN RAISE EXCEPTION 'Invalid NPC vessel listing for %', COALESCE(v_generation_key, 'unknown'); END IF;

    v_vessel_id := md5(v_generation_key)::uuid;
    IF EXISTS (SELECT 1 FROM storage_vessel_market_listings WHERE generation_key = v_generation_key OR vessel_id = v_vessel_id) THEN CONTINUE; END IF;

    INSERT INTO storage_vessels (
      id, vessel_name, company_id, owner_kind, owner_company_id, vessel_type, material,
      quality_score, condition, fill_history, production_year, capacity_litres,
      acquisition_price, source_offer_id, operational_status, cleanliness,
      purchased_year, purchased_season, purchased_week
    ) VALUES (
      v_vessel_id, v_listing->>'vesselName', NULL, 'npc_market', NULL, 'cask', v_material,
      (v_listing->>'qualityScore')::numeric, v_condition, (v_listing->>'fillHistory')::integer,
      (v_listing->>'productionYear')::integer, (v_listing->>'capacityLitres')::numeric,
      0, v_generation_key, 'operational', v_listing->>'cleanliness', p_year, p_season, p_week
    ) ON CONFLICT DO NOTHING;

    SELECT * INTO v_retirement FROM storage_vessel_market_retirement_date(v_condition, v_material, p_year, p_season, p_week);
    INSERT INTO storage_vessel_market_listings (
      vessel_id, seller_kind, seller_counterparty_id, seller_name, origin, evolution_seed,
      generation_key, starting_condition, listed_year, listed_season, listed_week,
      retired_year, retired_season, retired_week
    ) VALUES (
      v_vessel_id, 'npc', v_listing->>'sellerCounterpartyId', v_listing->>'sellerName',
      'npc_generated', v_generation_key, v_generation_key, v_condition,
      p_year, p_season, p_week, v_retirement.year_value, v_retirement.season_value, v_retirement.week_value
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
