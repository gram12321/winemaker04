-- A canonical vessel keeps its historical listing row after purchase. Selling
-- that asset again must reactivate the row instead of violating its unique
-- vessel_id constraint.
DROP FUNCTION IF EXISTS sell_storage_vessel_to_market(uuid, uuid, uuid, numeric, integer, text, integer);
DROP FUNCTION IF EXISTS sell_storage_vessel_to_market(uuid, text, uuid, numeric, integer, text, integer);
CREATE FUNCTION sell_storage_vessel_to_market(
  p_company_id uuid, p_company_name text, p_vessel_id uuid, p_payout numeric,
  p_year integer, p_season text, p_week integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_condition numeric;
  v_retire record;
BEGIN
  PERFORM 1 FROM storage_vessels v
  WHERE v.id = p_vessel_id
    AND v.owner_kind = 'company'
    AND v.owner_company_id = p_company_id
    AND v.operational_status = 'operational'
  FOR UPDATE;
  IF NOT FOUND
    OR EXISTS (SELECT 1 FROM storage_vessel_allocations a WHERE a.vessel_id = p_vessel_id AND a.released_at IS NULL)
    OR EXISTS (SELECT 1 FROM activities a WHERE a.company_id = p_company_id AND a.status IN ('active', 'paused') AND a.params->>'vesselId' = p_vessel_id::text)
  THEN RETURN false; END IF;

  SELECT condition INTO v_condition FROM storage_vessels WHERE id = p_vessel_id;
  SELECT * INTO v_retire
  FROM storage_vessel_market_retirement_date(v_condition, (SELECT material FROM storage_vessels WHERE id = p_vessel_id), p_year, p_season, p_week);

  UPDATE storage_vessels
  SET owner_kind = 'npc_market', owner_company_id = NULL, company_id = NULL
  WHERE id = p_vessel_id;

  INSERT INTO storage_vessel_market_listings (
    vessel_id, seller_kind, seller_counterparty_id, seller_name, seller_company_id,
    origin, status, evolution_seed, generation_key, starting_condition,
    listed_year, listed_season, listed_week, retired_year, retired_season, retired_week,
    sold_at, buyer_company_id
  ) VALUES (
    p_vessel_id, 'company', p_company_id::text, p_company_name, p_company_id,
    'player_sellback', 'active', concat('sellback:', p_vessel_id, ':', p_year, ':', p_season, ':', p_week), NULL, v_condition,
    p_year, p_season, p_week, v_retire.year_value, v_retire.season_value, v_retire.week_value, NULL, NULL
  )
  ON CONFLICT (vessel_id) DO UPDATE SET
    seller_kind = EXCLUDED.seller_kind,
    seller_counterparty_id = EXCLUDED.seller_counterparty_id,
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
  RETURN jsonb_build_object('success', true, 'payout', p_payout);
END;
$$;
