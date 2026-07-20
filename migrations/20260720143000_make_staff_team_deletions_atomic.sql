-- Staff/team membership is denormalized for fast game-state reads. Deletions
-- therefore update both representations in one company-scoped transaction.
CREATE OR REPLACE FUNCTION public.delete_staff_and_team_memberships(p_staff_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE company UUID;
BEGIN
  SELECT company_id INTO company FROM public.staff WHERE id = p_staff_id;
  IF company IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.teams SET member_ids = array_remove(member_ids, p_staff_id::TEXT) WHERE company_id = company;
  DELETE FROM public.staff WHERE id = p_staff_id AND company_id = company;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team_and_staff_assignments(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE company UUID;
BEGIN
  SELECT company_id INTO company FROM public.teams WHERE id = p_team_id;
  IF company IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.staff SET team_ids = array_remove(team_ids, p_team_id::TEXT) WHERE company_id = company;
  DELETE FROM public.teams WHERE id = p_team_id AND company_id = company;
  RETURN FOUND;
END;
$$;
