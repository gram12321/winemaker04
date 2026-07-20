-- Each company achievement can award its company-prestige event once.
-- Existing achievement events used a NULL source_id, so this only constrains
-- the source-keyed rows introduced by the isolated achievement feature.
CREATE UNIQUE INDEX IF NOT EXISTS prestige_events_company_achievement_source_unique
  ON public.prestige_events (company_id, type, source_id)
  WHERE type = 'achievement' AND source_id IS NOT NULL;
