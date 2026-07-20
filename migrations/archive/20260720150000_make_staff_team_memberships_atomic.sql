-- Team membership is denormalized between staff.team_ids and teams.member_ids.
-- Keep both sides synchronized under one company-scoped row lock and transaction.
CREATE OR REPLACE FUNCTION public.set_staff_team_membership(
  p_staff_id UUID,
  p_team_id UUID,
  p_is_assigned BOOLEAN
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
