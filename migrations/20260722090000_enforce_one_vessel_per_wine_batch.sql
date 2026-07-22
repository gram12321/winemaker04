-- Rollout 3.1: one active wine batch is stored in one vessel only.
-- Development database is reset for this topology change; no backfill is intended.
ALTER TABLE public.storage_vessel_allocations
  ADD CONSTRAINT storage_vessel_allocations_one_vessel_per_plan UNIQUE (plan_id);

CREATE OR REPLACE FUNCTION public.reserve_storage_vessel_plan(
  p_company_id UUID, p_required_litres NUMERIC, p_vessel_ids UUID[], p_activity_id TEXT,
  p_created_year INTEGER, p_created_season TEXT, p_created_week INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_plan_id UUID; v_vessel public.storage_vessels%ROWTYPE;
BEGIN
  IF p_required_litres <= 0 OR COALESCE(array_length(p_vessel_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Storage reservation requires exactly one vessel';
  END IF;
  SELECT * INTO v_vessel FROM public.storage_vessels
  WHERE id = p_vessel_ids[1] AND company_id = p_company_id AND operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1 FROM public.storage_vessel_allocations a
      JOIN public.storage_vessel_allocation_plans p ON p.id = a.plan_id
      WHERE a.vessel_id = p_vessel_ids[1] AND a.released_at IS NULL AND p.status IN ('reserved', 'active')
    )
  FOR UPDATE;
  IF NOT FOUND OR v_vessel.capacity_litres < p_required_litres THEN
    RAISE EXCEPTION 'Selected Storage Vessel is unavailable or lacks capacity';
  END IF;
  INSERT INTO public.storage_vessel_allocation_plans (company_id, activity_id, status, required_litres, created_year, created_season, created_week)
  VALUES (p_company_id, p_activity_id, 'reserved', p_required_litres, p_created_year, p_created_season, p_created_week)
  RETURNING id INTO v_plan_id;
  INSERT INTO public.storage_vessel_allocations (company_id, plan_id, vessel_id, assigned_capacity_litres)
  VALUES (p_company_id, v_plan_id, v_vessel.id, v_vessel.capacity_litres);
  RETURN v_plan_id;
END; $$;

CREATE OR REPLACE FUNCTION public.add_storage_vessel_plan_allocations(
  p_company_id UUID, p_plan_id UUID, p_vessel_ids UUID[]
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- A plan already owns its only vessel. A later harvest must create a new plan and batch.
  RETURN FALSE;
END; $$;
