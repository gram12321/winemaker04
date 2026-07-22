-- Prevent two active/paused activities from researching the same project.
-- target_id is populated by the research start path; legacy rows with a NULL
-- target_id are intentionally left untouched.
CREATE UNIQUE INDEX IF NOT EXISTS activities_company_research_target_active_unique
  ON public.activities (company_id, category, target_id)
  WHERE category = 'ADMINISTRATION_AND_RESEARCH'
    AND target_id IS NOT NULL
    AND status IN ('active', 'paused');

-- The live schema's legacy type check predates the research prestige source.
-- Keep it explicit so research completion can write the type already used by
-- the application and its research shape constraint.
ALTER TABLE public.prestige_events
  DROP CONSTRAINT IF EXISTS prestige_events_type_check;

ALTER TABLE public.prestige_events
  ADD CONSTRAINT prestige_events_type_check
  CHECK (type IN (
    'company_finance',
    'company_story',
    'admin_cheat',
    'sale',
    'penalty',
    'cellar_collection',
    'achievement',
    'research',
    'vineyard_sale',
    'vineyard_achievement',
    'vineyard_age',
    'vineyard_land',
    'wine_feature',
    'company_value'
  ));
