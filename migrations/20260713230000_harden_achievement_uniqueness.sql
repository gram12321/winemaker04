BEGIN;

-- The current achievement shape is source-keyed. Discard malformed rows rather
-- than translating retired shapes into the current schema.
DELETE FROM public.prestige_events
WHERE type = 'achievement'
  AND NOT COALESCE(
    source_id = 'achievement:' || (payload->>'achievementId')
      AND NULLIF(payload->>'achievementId', '') IS NOT NULL
      AND payload->>'event' = 'achievement_unlock',
    FALSE
  );

-- Remove invalid rows before enforcing the one-unlock-per-company invariant.
WITH ranked_unlocks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, achievement_key
      ORDER BY achieved_at ASC NULLS LAST, created_at ASC NULLS LAST, id
    ) AS duplicate_rank
  FROM public.achievements
)
DELETE FROM public.achievements AS achievement
USING ranked_unlocks AS ranked
WHERE achievement.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS achievements_company_key_unique
  ON public.achievements (company_id, achievement_key);

-- The current vineyard-achievement shape keeps the vineyard attribution in
-- source_id and uses a distinct achievement-unlock event payload.
DELETE FROM public.prestige_events
WHERE type = 'vineyard_achievement'
  AND NOT COALESCE(
    source_id IS NOT NULL
      AND source_id = payload->>'vineyardId'
      AND (
        payload->>'event' IN ('planting', 'aging', 'improvement', 'harvest')
        OR (
          payload->>'event' = 'achievement_unlock'
          AND NULLIF(payload->>'achievementId', '') IS NOT NULL
          AND NULLIF(payload->>'vineyardId', '') IS NOT NULL
        )
      ),
    FALSE
  );

WITH ranked_vineyard_rewards AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, type, source_id, payload->>'achievementId'
      ORDER BY created_game_week ASC NULLS LAST, id
    ) AS duplicate_rank
  FROM public.prestige_events
  WHERE type = 'vineyard_achievement'
    AND payload->>'event' = 'achievement_unlock'
)
DELETE FROM public.prestige_events AS prestige_event
USING ranked_vineyard_rewards AS ranked
WHERE prestige_event.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS prestige_events_vineyard_achievement_unique
  ON public.prestige_events (
    company_id,
    type,
    source_id,
    (payload->>'achievementId')
  )
  WHERE type = 'vineyard_achievement'
    AND payload->>'event' = 'achievement_unlock';

DELETE FROM public.prestige_events
WHERE type = 'research'
  AND NOT COALESCE(
    source_id = 'research:' || (payload->>'projectId')
      AND NULLIF(payload->>'projectId', '') IS NOT NULL
      AND NULLIF(payload->>'projectTitle', '') IS NOT NULL
      AND NULLIF(payload->>'description', '') IS NOT NULL,
    FALSE
  );

WITH ranked_research_rewards AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, type, source_id
      ORDER BY created_game_week ASC NULLS LAST, id
    ) AS duplicate_rank
  FROM public.prestige_events
  WHERE type = 'research'
)
DELETE FROM public.prestige_events AS prestige_event
USING ranked_research_rewards AS ranked
WHERE prestige_event.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS prestige_events_company_research_source_unique
  ON public.prestige_events (company_id, type, source_id)
  WHERE type = 'research';

ALTER TABLE public.prestige_events
  ADD CONSTRAINT prestige_events_achievement_shape_check
  CHECK (
    type <> 'achievement'
    OR COALESCE(
      source_id = 'achievement:' || (payload->>'achievementId')
        AND NULLIF(payload->>'achievementId', '') IS NOT NULL
        AND payload->>'event' = 'achievement_unlock',
      FALSE
    )
  );

ALTER TABLE public.prestige_events
  ADD CONSTRAINT prestige_events_vineyard_achievement_shape_check
  CHECK (
    type <> 'vineyard_achievement'
    OR COALESCE(
      source_id IS NOT NULL
        AND source_id = payload->>'vineyardId'
        AND (
          payload->>'event' IN ('planting', 'aging', 'improvement', 'harvest')
          OR (
            payload->>'event' = 'achievement_unlock'
            AND NULLIF(payload->>'achievementId', '') IS NOT NULL
            AND NULLIF(payload->>'vineyardId', '') IS NOT NULL
          )
        ),
      FALSE
    )
  );

ALTER TABLE public.prestige_events
  ADD CONSTRAINT prestige_events_research_shape_check
  CHECK (
    type <> 'research'
    OR COALESCE(
      source_id = 'research:' || (payload->>'projectId')
        AND NULLIF(payload->>'projectId', '') IS NOT NULL
        AND NULLIF(payload->>'projectTitle', '') IS NOT NULL
        AND NULLIF(payload->>'description', '') IS NOT NULL,
      FALSE
    )
  );

COMMIT;
