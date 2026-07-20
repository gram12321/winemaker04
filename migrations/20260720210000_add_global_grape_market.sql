-- Global grape lots are NPC-custodied, but retain the original seller as the
-- public counterparty. Snapshot evolution is projected in TypeScript from
-- listed date + seed; the database only owns atomic transfers and quantities.

CREATE TABLE IF NOT EXISTS public.global_grape_market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_kind TEXT NOT NULL CHECK (seller_kind IN ('npc', 'company')),
  seller_counterparty_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  origin TEXT NOT NULL CHECK (origin IN ('npc_generated', 'company_listing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'retired')),
  evolution_seed TEXT NOT NULL UNIQUE,
  available_kg NUMERIC NOT NULL CHECK (available_kg > 0),
  base_price_per_kg NUMERIC NOT NULL CHECK (base_price_per_kg >= 0),
  quality_score NUMERIC NOT NULL CHECK (quality_score BETWEEN 0 AND 1),
  quality_decay_per_week NUMERIC NOT NULL CHECK (quality_decay_per_week >= 0),
  min_quality_floor NUMERIC NOT NULL CHECK (min_quality_floor BETWEEN 0 AND 1),
  batch_state TEXT NOT NULL CHECK (batch_state IN ('grapes', 'must_ready', 'must_fermenting')),
  grape_variety TEXT NOT NULL,
  batch_snapshot JSONB NOT NULL,
  provenance_snapshot JSONB,
  listed_year INTEGER NOT NULL,
  listed_season TEXT NOT NULL,
  listed_week INTEGER NOT NULL,
  expires_year INTEGER,
  expires_season TEXT,
  expires_week INTEGER,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_grape_market_seller_check CHECK (
    (seller_kind = 'company' AND seller_company_id IS NOT NULL)
    OR (seller_kind = 'npc' AND seller_company_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS global_grape_market_listings_active_idx
  ON public.global_grape_market_listings (status, listed_year, listed_season, listed_week);

ALTER TABLE public.global_grape_market_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS global_grape_market_listings_read_active ON public.global_grape_market_listings;
CREATE POLICY global_grape_market_listings_read_active ON public.global_grape_market_listings
  FOR SELECT USING (status = 'active');

CREATE OR REPLACE FUNCTION public.list_grape_batch_on_global_market(
  p_company_id UUID, p_company_name TEXT, p_batch_id TEXT, p_quantity_kg NUMERIC,
  p_payout NUMERIC, p_batch_snapshot JSONB, p_base_price_per_kg NUMERIC,
  p_quality_score NUMERIC, p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_batch public.wine_batches%ROWTYPE;
  v_transaction JSONB;
  v_listing_id UUID;
  v_seed TEXT;
  v_decay NUMERIC;
BEGIN
  SELECT * INTO v_batch FROM public.wine_batches
  WHERE id = p_batch_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND OR p_quantity_kg <= 0 OR p_quantity_kg > v_batch.quantity
    OR v_batch.state NOT IN ('grapes', 'must_ready', 'must_fermenting') THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.activities WHERE company_id = p_company_id AND status IN ('active', 'paused') AND (params->>'batchId' = p_batch_id OR params->>'outputBatchId' = p_batch_id)) THEN RETURN NULL; END IF;

  -- Use the same storage-backed consumption operation as direct grape sales.
  IF NOT public.consume_storage_backed_wine_batch(p_company_id, p_batch_id, p_quantity_kg, p_year, p_season, p_week) THEN RETURN NULL; END IF;
  v_transaction := public.record_company_transaction(p_company_id, p_payout, 'Global grape market listing payout', 'Grape Sales', FALSE, p_week, p_season, p_year, FALSE);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  v_seed := 'company-grape:' || p_company_id || ':' || p_batch_id || ':' || extract(epoch FROM clock_timestamp())::bigint;
  v_decay := CASE v_batch.state WHEN 'grapes' THEN .012 WHEN 'must_ready' THEN .008 ELSE .005 END;
  INSERT INTO public.global_grape_market_listings (
    seller_kind, seller_counterparty_id, seller_name, seller_company_id, origin, evolution_seed,
    available_kg, base_price_per_kg, quality_score, quality_decay_per_week, min_quality_floor,
    batch_state, grape_variety, batch_snapshot, provenance_snapshot, listed_year, listed_season, listed_week
  ) VALUES (
    'company', p_company_id::text, p_company_name, p_company_id, 'company_listing', v_seed,
    p_quantity_kg, p_base_price_per_kg, p_quality_score, v_decay, .16,
    v_batch.state, v_batch.grape_variety, p_batch_snapshot, p_batch_snapshot->'originSnapshot', p_year, p_season, p_week
  ) RETURNING id INTO v_listing_id;
  RETURN jsonb_build_object('transaction', v_transaction, 'listingId', v_listing_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_npc_global_grape_market_listings(
  p_year INTEGER, p_season TEXT, p_week INTEGER, p_listings JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_listing JSONB;
BEGIN
  IF jsonb_typeof(p_listings) <> 'array' THEN RAISE EXCEPTION 'NPC grape listings must be an array'; END IF;
  FOR v_listing IN SELECT value FROM jsonb_array_elements(p_listings) LOOP
    INSERT INTO public.global_grape_market_listings (
      seller_kind, seller_counterparty_id, seller_name, origin, evolution_seed, available_kg,
      base_price_per_kg, quality_score, quality_decay_per_week, min_quality_floor, batch_state,
      grape_variety, batch_snapshot, provenance_snapshot, listed_year, listed_season, listed_week
    ) VALUES (
      'npc', v_listing->>'sellerCounterpartyId', v_listing->>'sellerName', 'npc_generated', v_listing->>'evolutionSeed',
      (v_listing->>'availableKg')::numeric, (v_listing->>'basePricePerKg')::numeric, (v_listing->>'qualityScore')::numeric,
      CASE v_listing->>'batchState' WHEN 'grapes' THEN .012 WHEN 'must_ready' THEN .008 ELSE .005 END, .16,
      v_listing->>'batchState', v_listing->>'grapeVariety', v_listing->'batchSnapshot', (v_listing->'batchSnapshot')->'originSnapshot',
      p_year, p_season, p_week
    ) ON CONFLICT (evolution_seed) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_global_grape_market_listing(
  p_company_id UUID, p_purchase_id UUID, p_listing_id UUID, p_quantity_kg NUMERIC,
  p_vessel_ids UUID[], p_required_litres NUMERIC, p_batch JSONB, p_cost NUMERIC,
  p_relationship_points NUMERIC, p_relationship_yearly_cap NUMERIC,
  p_week INTEGER, p_season TEXT, p_year INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_listing public.global_grape_market_listings%ROWTYPE;
  v_transaction JSONB; v_plan_id UUID; v_capacity NUMERIC; v_count INTEGER;
BEGIN
  IF p_quantity_kg <= 0 OR p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN RETURN NULL; END IF;
  SELECT * INTO v_listing FROM public.global_grape_market_listings WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND OR v_listing.available_kg < p_quantity_kg THEN RETURN NULL; END IF;
  SELECT COUNT(*), COALESCE(SUM(capacity_litres), 0) INTO v_count, v_capacity
  FROM public.storage_vessels s WHERE s.company_id = p_company_id AND s.id = ANY(p_vessel_ids)
    AND s.operational_status = 'operational'
    AND NOT EXISTS (SELECT 1 FROM public.storage_vessel_allocations a JOIN public.storage_vessel_allocation_plans plan ON plan.id = a.plan_id WHERE a.vessel_id = s.id AND a.released_at IS NULL AND plan.status IN ('reserved', 'active'));
  IF v_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres THEN RETURN NULL; END IF;
  v_transaction := public.record_company_transaction(p_company_id, -p_cost, 'Global grape market purchase', 'supplies', FALSE, p_week, p_season, p_year, TRUE);
  IF v_transaction IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.storage_vessel_allocation_plans (company_id, status, required_litres, created_year, created_season, created_week)
  VALUES (p_company_id, 'active', p_required_litres, p_year, p_season, p_week) RETURNING id INTO v_plan_id;
  INSERT INTO public.storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  SELECT p_company_id, v_plan_id, id, capacity_litres FROM public.storage_vessels WHERE company_id = p_company_id AND id = ANY(p_vessel_ids);
  INSERT INTO public.wine_batches SELECT (jsonb_populate_record(NULL::public.wine_batches, p_batch || jsonb_build_object('company_id', p_company_id, 'storage_plan_id', v_plan_id, 'volume_litres', p_required_litres, 'created_at', now()))).*;
  UPDATE public.storage_vessel_allocation_plans SET wine_batch_id = p_batch->>'id' WHERE id = v_plan_id;
  WITH fills AS (SELECT id, assigned_capacity_litres, COALESCE(SUM(assigned_capacity_litres) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_litres FROM public.storage_vessel_allocations WHERE company_id = p_company_id AND plan_id = v_plan_id)
  UPDATE public.storage_vessel_allocations a SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_required_litres - f.before_litres)) FROM fills f WHERE a.id = f.id;
  UPDATE public.global_grape_market_listings SET available_kg = available_kg - p_quantity_kg, status = CASE WHEN available_kg - p_quantity_kg <= 0 THEN 'sold' ELSE 'active' END, buyer_company_id = CASE WHEN available_kg - p_quantity_kg <= 0 THEN p_company_id ELSE buyer_company_id END, sold_at = CASE WHEN available_kg - p_quantity_kg <= 0 THEN now() ELSE sold_at END, updated_at = now() WHERE id = p_listing_id;
  PERFORM public.record_buy_market_counterparty_purchase(p_company_id, v_listing.seller_kind, v_listing.seller_counterparty_id, v_listing.seller_name, p_quantity_kg, p_relationship_points, p_year, p_relationship_yearly_cap);
  RETURN jsonb_build_object('transaction', v_transaction);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_global_market(p_ware_group text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_ware_group IS NULL OR p_ware_group IN ('grapes', 'storage_vessels') THEN
    DELETE FROM public.market_buy_offers WHERE p_ware_group IS NULL OR ware_group = p_ware_group;
  ELSE
    RAISE EXCEPTION 'Unsupported market goods group: %', p_ware_group;
  END IF;
  IF p_ware_group IS NULL OR p_ware_group = 'grapes' THEN
    DELETE FROM public.global_grape_market_listings WHERE true;
  END IF;
  IF p_ware_group IS NULL OR p_ware_group = 'storage_vessels' THEN
    DELETE FROM public.storage_vessel_market_listings WHERE true;
    DELETE FROM public.storage_vessels WHERE owner_kind = 'npc_market';
  END IF;
END;
$$;
