-- Rename persisted research IDs after foundation lane refactor.
-- This migration intentionally remaps historical unlock records only.

UPDATE research_unlocks
SET research_id = CASE research_id
  WHEN 'admin_basic' THEN 'foundation_admin_baseline'
  WHEN 'admin_research_methodology' THEN 'foundation_admin_methodology'
  WHEN 'admin_research_office' THEN 'foundation_admin_office'
  WHEN 'project_grant_basic' THEN 'foundation_grant_basic'
  WHEN 'project_grant_advanced' THEN 'foundation_grant_advanced'
  WHEN 'staff_onboarding_program' THEN 'foundation_staff_onboarding'
  WHEN 'staff_training' THEN 'foundation_staff_training'
  WHEN 'staff_leadership_pipeline' THEN 'foundation_staff_leadership'
  ELSE research_id
END
WHERE research_id IN (
  'admin_basic',
  'admin_research_methodology',
  'admin_research_office',
  'project_grant_basic',
  'project_grant_advanced',
  'staff_onboarding_program',
  'staff_training',
  'staff_leadership_pipeline'
);
