-- Restore active RPCs that were absent from the live schema.
-- market_purchase_operations is internal idempotency state for grape purchases.

CREATE TABLE IF NOT EXISTS public.market_purchase_operations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.market_purchase_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_purchase_operations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_market_buy_offer_units(
  p_company_id UUID,
  p_offer_id TEXT,
  p_units INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_units <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.market_buy_offers
  SET available_units = available_units + p_units, updated_at = NOW()
  WHERE company_id = p_company_id AND offer_id = p_offer_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_team_membership(
  p_staff_id UUID,
  p_team_id UUID,
  p_is_assigned BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  staff_company_id UUID;
  team_company_id UUID;
BEGIN
  SELECT company_id INTO staff_company_id
  FROM public.staff
  WHERE id = p_staff_id
  FOR UPDATE;

  SELECT company_id INTO team_company_id
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF staff_company_id IS NULL
    OR team_company_id IS NULL
    OR staff_company_id IS DISTINCT FROM team_company_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.staff
  SET team_ids = CASE
    WHEN p_is_assigned THEN array_append(array_remove(COALESCE(team_ids, ARRAY[]::TEXT[]), p_team_id::TEXT), p_team_id::TEXT)
    ELSE array_remove(COALESCE(team_ids, ARRAY[]::TEXT[]), p_team_id::TEXT)
  END
  WHERE id = p_staff_id AND company_id = staff_company_id;

  UPDATE public.teams
  SET member_ids = CASE
    WHEN p_is_assigned THEN array_append(array_remove(COALESCE(member_ids, ARRAY[]::TEXT[]), p_staff_id::TEXT), p_staff_id::TEXT)
    ELSE array_remove(COALESCE(member_ids, ARRAY[]::TEXT[]), p_staff_id::TEXT)
  END
  WHERE id = p_team_id AND company_id = staff_company_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_grape_market_offer(
  p_company_id UUID, p_purchase_id UUID, p_offer_id TEXT, p_quantity NUMERIC,
  p_vessel_ids UUID[], p_required_litres NUMERIC, p_batch JSONB,
  p_week INTEGER, p_season TEXT, p_year INTEGER, p_description TEXT, p_category TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer public.market_buy_offers%ROWTYPE;
  v_cost NUMERIC;
  v_transaction JSONB;
  v_result JSONB;
  v_plan_id UUID;
  v_capacity NUMERIC;
  v_vessel_count INTEGER;
BEGIN
  SELECT result INTO v_result
  FROM public.market_purchase_operations
  WHERE id = p_purchase_id AND company_id = p_company_id;
  IF FOUND THEN
    RETURN v_result || jsonb_build_object('completedNow', FALSE);
  END IF;

  IF p_quantity <= 0 OR p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM 1 FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_offer
  FROM public.market_buy_offers
  WHERE company_id = p_company_id AND offer_id = p_offer_id AND ware_group = 'grapes'
  FOR UPDATE;
  IF NOT FOUND OR v_offer.available_units < p_quantity THEN RETURN NULL; END IF;

  PERFORM 1 FROM public.storage_vessels
  WHERE company_id = p_company_id AND id = ANY(p_vessel_ids)
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(s.capacity_litres), 0)
  INTO v_vessel_count, v_capacity
  FROM public.storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids)
    AND s.operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1
      FROM public.storage_vessel_allocations a
      JOIN public.storage_vessel_allocation_plans plan ON plan.id = a.plan_id
      WHERE a.vessel_id = s.id AND a.released_at IS NULL AND plan.status IN ('reserved', 'active')
    );
  IF v_vessel_count <> array_length(p_vessel_ids, 1) OR v_capacity < p_required_litres THEN RETURN NULL; END IF;
  IF p_batch->>'id' IS NULL OR (p_batch->>'quantity')::NUMERIC <> p_quantity THEN RETURN NULL; END IF;

  v_cost := ROUND(v_offer.effective_price_per_unit * p_quantity, 2);
  v_transaction := public.record_company_transaction(
    p_company_id, -v_cost, p_description, p_category, FALSE, p_week, p_season, p_year, TRUE
  );
  IF v_transaction IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.storage_vessel_allocation_plans (
    company_id, status, required_litres, created_year, created_season, created_week
  ) VALUES (p_company_id, 'active', p_required_litres, p_year, p_season, p_week)
  RETURNING id INTO v_plan_id;

  INSERT INTO public.storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  SELECT p_company_id, v_plan_id, id, capacity_litres
  FROM public.storage_vessels
  WHERE company_id = p_company_id AND id = ANY(p_vessel_ids);

  INSERT INTO public.wine_batches
  SELECT (jsonb_populate_record(NULL::public.wine_batches,
    p_batch || jsonb_build_object(
      'company_id', p_company_id,
      'storage_plan_id', v_plan_id,
      'volume_litres', p_required_litres,
      'created_at', NOW()
    )
  )).*;

  UPDATE public.storage_vessel_allocation_plans
  SET wine_batch_id = p_batch->>'id'
  WHERE id = v_plan_id AND company_id = p_company_id;

  WITH fills AS (
    SELECT id, assigned_capacity_litres,
      COALESCE(SUM(assigned_capacity_litres) OVER (
        ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS before_litres
    FROM public.storage_vessel_allocations
    WHERE company_id = p_company_id AND plan_id = v_plan_id
  )
  UPDATE public.storage_vessel_allocations a
  SET filled_litres = LEAST(f.assigned_capacity_litres, GREATEST(0, p_required_litres - f.before_litres))
  FROM fills f
  WHERE a.id = f.id;

  UPDATE public.market_buy_offers
  SET available_units = available_units - p_quantity, updated_at = NOW()
  WHERE company_id = p_company_id AND offer_id = p_offer_id;

  v_result := jsonb_build_object('transaction', v_transaction);
  INSERT INTO public.market_purchase_operations (id, company_id, result)
  VALUES (p_purchase_id, p_company_id, v_result);

  RETURN v_result || jsonb_build_object('completedNow', TRUE);
END;
$$;
