-- Rollout 1: canonical legal vessel catalogue and material-aware pricing inputs.
ALTER TABLE storage_vessels ADD COLUMN IF NOT EXISTS catalogue_id text;

UPDATE storage_vessels
SET catalogue_id = CASE
  WHEN material = 'oak' THEN CASE WHEN capacity_litres >= 750 THEN 'oak_cask_1000' WHEN capacity_litres >= 400 THEN 'oak_cask_500' ELSE 'oak_cask_250' END
  WHEN material = 'chestnut' THEN CASE WHEN capacity_litres >= 1500 THEN 'chestnut_cask_2000' WHEN capacity_litres >= 750 THEN 'chestnut_cask_1000' ELSE 'chestnut_cask_500' END
  WHEN material = 'stainless_steel' THEN CASE WHEN capacity_litres >= 1800 THEN 'stainless_steel_tank_2500' WHEN capacity_litres >= 750 THEN 'stainless_steel_tank_1000' ELSE 'stainless_steel_tank_500' END
  WHEN material = 'concrete' THEN CASE WHEN capacity_litres >= 2200 THEN 'concrete_tank_3000' WHEN capacity_litres >= 1100 THEN 'concrete_tank_1500' ELSE 'concrete_tank_750' END
  WHEN material = 'ceramic' THEN CASE WHEN capacity_litres >= 750 THEN 'ceramic_container_1000' WHEN capacity_litres >= 400 THEN 'ceramic_container_500' ELSE 'ceramic_container_250' END
  ELSE CASE WHEN capacity_litres >= 3500 THEN 'plastic_container_5000' WHEN capacity_litres >= 1800 THEN 'plastic_container_2500' ELSE 'plastic_container_1000' END
END
WHERE catalogue_id IS NULL;

ALTER TABLE storage_vessels ALTER COLUMN catalogue_id SET NOT NULL;
ALTER TABLE storage_vessels ADD CONSTRAINT storage_vessels_catalogue_id_check CHECK (catalogue_id IN (
  'oak_cask_250','oak_cask_500','oak_cask_1000','chestnut_cask_500','chestnut_cask_1000','chestnut_cask_2000',
  'stainless_steel_tank_500','stainless_steel_tank_1000','stainless_steel_tank_2500','concrete_tank_750','concrete_tank_1500','concrete_tank_3000',
  'ceramic_container_250','ceramic_container_500','ceramic_container_1000','plastic_container_1000','plastic_container_2500','plastic_container_5000'
));

CREATE OR REPLACE FUNCTION ensure_npc_used_storage_vessel_listings(
  p_year integer, p_season text, p_week integer, p_listings jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_listing jsonb; v_generation_key text; v_catalogue_id text; v_condition numeric; v_vessel_id uuid; v_retirement record;
BEGIN
  IF jsonb_typeof(p_listings) <> 'array' THEN RAISE EXCEPTION 'NPC vessel listings must be an array'; END IF;
  FOR v_listing IN SELECT value FROM jsonb_array_elements(p_listings) LOOP
    v_generation_key := v_listing->>'generationKey'; v_catalogue_id := v_listing->>'catalogueId'; v_condition := (v_listing->>'condition')::numeric;
    IF v_generation_key IS NULL OR v_catalogue_id IS NULL OR v_listing->>'sellerCounterpartyId' IS NULL OR v_listing->>'sellerName' IS NULL OR v_listing->>'vesselName' IS NULL
      OR (v_listing->>'qualityScore')::numeric NOT BETWEEN 0 AND 1 OR v_condition NOT BETWEEN 0 AND 1 OR (v_listing->>'fillHistory')::integer < 0
      OR (v_listing->>'cleanliness') NOT IN ('clean','dirty') THEN RAISE EXCEPTION 'Invalid NPC vessel listing for %', COALESCE(v_generation_key,'unknown'); END IF;
    v_vessel_id := md5(v_generation_key)::uuid;
    IF EXISTS (SELECT 1 FROM storage_vessel_market_listings WHERE generation_key = v_generation_key OR vessel_id = v_vessel_id) THEN CONTINUE; END IF;
    INSERT INTO storage_vessels (id,vessel_name,company_id,owner_kind,owner_company_id,vessel_type,material,catalogue_id,quality_score,condition,fill_history,production_year,capacity_litres,acquisition_price,source_offer_id,operational_status,cleanliness,purchased_year,purchased_season,purchased_week)
    VALUES (v_vessel_id,v_listing->>'vesselName',NULL,'npc_market',NULL,v_listing->>'vesselType',v_listing->>'material',v_catalogue_id,(v_listing->>'qualityScore')::numeric,v_condition,(v_listing->>'fillHistory')::integer,(v_listing->>'productionYear')::integer,(v_listing->>'capacityLitres')::numeric,0,v_generation_key,'operational',v_listing->>'cleanliness',p_year,p_season,p_week);
    SELECT * INTO v_retirement FROM storage_vessel_market_retirement_date(v_condition, v_listing->>'material', p_year, p_season, p_week);
    INSERT INTO storage_vessel_market_listings (vessel_id,seller_kind,seller_counterparty_id,seller_name,origin,evolution_seed,generation_key,starting_condition,listed_year,listed_season,listed_week,retired_year,retired_season,retired_week)
    VALUES (v_vessel_id,'npc',v_listing->>'sellerCounterpartyId',v_listing->>'sellerName','npc_generated',v_generation_key,v_generation_key,v_condition,p_year,p_season,p_week,v_retirement.year_value,v_retirement.season_value,v_retirement.week_value);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION storage_vessel_market_used_value(p_vessel storage_vessels, p_condition numeric, p_year integer)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE q numeric := LEAST(1, GREATEST(0, p_vessel.quality_score)); v_quality numeric; v_age numeric; v_age_multiplier numeric; v_material_multiplier numeric;
BEGIN
  v_quality := CASE WHEN q < .3 THEN 1 + q*q*2 WHEN q < .6 THEN 1.18 + ln(1 + (q - .3) * 2) * .6 WHEN q < .8 THEN 1.78 + (q - .6) * 5 WHEN q < .9 THEN 2.78 + power((q - .8) * 10, 1.5) * 2.5 WHEN q < .95 THEN 5.28 + power((q - .9) * 20, 2) * 10 ELSE 15.28 END;
  v_age := GREATEST(0, p_year - p_vessel.production_year); v_age_multiplier := .03 + .97 * exp(-v_age / 10);
  v_material_multiplier := CASE p_vessel.material WHEN 'oak' THEN 1.4 WHEN 'chestnut' THEN 1.25 WHEN 'concrete' THEN 1.2 WHEN 'ceramic' THEN 1.45 WHEN 'plastic' THEN .55 ELSE 1 END;
  RETURN GREATEST(0, ROUND(850 * (p_vessel.capacity_litres / 250) * v_material_multiplier * (q * v_quality) * v_age_multiplier * p_condition * (1 / (1 + p_vessel.fill_history * .035)) * CASE WHEN p_vessel.cleanliness = 'dirty' THEN .8 ELSE 1 END, 2));
END; $$;
