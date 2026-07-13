-- A harvest that fills its initial vessels may continue later in additional vessels.
CREATE OR REPLACE FUNCTION add_storage_vessel_plan_allocations(
  p_company_id UUID,
  p_plan_id UUID,
  p_vessel_ids UUID[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF COALESCE(array_length(p_vessel_ids, 1), 0) = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM 1
  FROM storage_vessel_allocation_plans
  WHERE id = p_plan_id
    AND company_id = p_company_id
    AND status IN ('reserved', 'active')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM 1
  FROM storage_vessels
  WHERE company_id = p_company_id
    AND id = ANY(p_vessel_ids)
  FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids)
    AND s.operational_status = 'operational'
    AND NOT EXISTS (
      SELECT 1
      FROM storage_vessel_allocations a
      JOIN storage_vessel_allocation_plans p ON p.id = a.plan_id
      WHERE a.vessel_id = s.id
        AND a.released_at IS NULL
    );

  IF v_count <> array_length(p_vessel_ids, 1) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO storage_vessel_allocations (
    company_id, plan_id, vessel_id, assigned_capacity_litres
  )
  SELECT p_company_id, p_plan_id, s.id, s.capacity_litres
  FROM storage_vessels s
  WHERE s.company_id = p_company_id
    AND s.id = ANY(p_vessel_ids);

  RETURN TRUE;
END;
$$;
