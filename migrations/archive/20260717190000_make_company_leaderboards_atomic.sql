-- Company aggregate leaderboards keep one current best score per company.
-- Historical wine/vineyard entries remain append-only.
WITH ranked_aggregates AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id, score_type
      ORDER BY score_value DESC, achieved_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.highscores
  WHERE score_type IN ('company_value', 'company_value_per_week')
)
DELETE FROM public.highscores AS highscore
USING ranked_aggregates
WHERE highscore.id = ranked_aggregates.id
  AND ranked_aggregates.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS highscores_company_aggregate_unique
  ON public.highscores (company_id, score_type)
  WHERE score_type IN ('company_value', 'company_value_per_week');

CREATE OR REPLACE FUNCTION public.upsert_company_aggregate_highscore(
  p_company_id UUID,
  p_company_name TEXT,
  p_score_type TEXT,
  p_score_value NUMERIC,
  p_game_week INTEGER,
  p_game_season TEXT,
  p_game_year INTEGER,
  p_achieved_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_score_type NOT IN ('company_value', 'company_value_per_week') THEN
    RAISE EXCEPTION 'Unsupported company aggregate score type: %', p_score_type;
  END IF;

  INSERT INTO public.highscores (
    company_id, company_name, score_type, score_value,
    game_week, game_season, game_year, achieved_at
  ) VALUES (
    p_company_id, p_company_name, p_score_type, p_score_value,
    p_game_week, p_game_season, p_game_year, p_achieved_at
  )
  ON CONFLICT (company_id, score_type)
    WHERE score_type IN ('company_value', 'company_value_per_week')
  DO UPDATE SET
    company_name = EXCLUDED.company_name,
    score_value = EXCLUDED.score_value,
    game_week = EXCLUDED.game_week,
    game_season = EXCLUDED.game_season,
    game_year = EXCLUDED.game_year,
    achieved_at = EXCLUDED.achieved_at
  WHERE EXCLUDED.score_value > public.highscores.score_value;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Rank one deterministic best entry per company. Historical wine and vineyard
-- records remain append-only; this projection prevents repeated submissions
-- from giving one company multiple places in its company ranking.
CREATE OR REPLACE FUNCTION public.get_company_leaderboard_context(
  p_company_id UUID,
  p_score_type TEXT,
  p_window INTEGER DEFAULT 2
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_score_type NOT IN (
    'company_value',
    'company_value_per_week',
    'highest_vintage_quantity',
    'most_productive_vineyard',
    'highest_wine_score',
    'highest_taste_quality_index',
    'highest_structure_index',
    'highest_price',
    'lowest_price'
  ) THEN
    RAISE EXCEPTION 'Unsupported leaderboard score type: %', p_score_type;
  END IF;

  WITH best_entries AS (
    SELECT DISTINCT ON (company_id) *
    FROM public.highscores
    WHERE score_type = p_score_type
    ORDER BY
      company_id,
      CASE WHEN p_score_type = 'lowest_price' THEN score_value END ASC NULLS LAST,
      CASE WHEN p_score_type <> 'lowest_price' THEN score_value END DESC NULLS LAST,
      achieved_at DESC NULLS LAST,
      id DESC
  ), ranked_entries AS (
    SELECT
      best_entries.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN p_score_type = 'lowest_price' THEN score_value END ASC NULLS LAST,
          CASE WHEN p_score_type <> 'lowest_price' THEN score_value END DESC NULLS LAST,
          achieved_at DESC NULLS LAST,
          id DESC
      ) AS position,
      count(*) OVER () AS total
    FROM best_entries
  )
  SELECT jsonb_build_object(
    'position', target.position,
    'total', target.total,
    'startIndex', GREATEST(target.position - 1 - GREATEST(p_window, 0), 0),
    'entries', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', entry.id,
            'company_id', entry.company_id,
            'company_name', entry.company_name,
            'score_type', entry.score_type,
            'score_value', entry.score_value,
            'game_week', entry.game_week,
            'game_season', entry.game_season,
            'game_year', entry.game_year,
            'achieved_at', entry.achieved_at,
            'created_at', entry.created_at,
            'vineyard_id', entry.vineyard_id,
            'vineyard_name', entry.vineyard_name,
            'wine_vintage', entry.wine_vintage,
            'grape_variety', entry.grape_variety
          )
          ORDER BY entry.position
        ),
        '[]'::JSONB
      )
      FROM ranked_entries AS entry
      WHERE entry.position BETWEEN
        GREATEST(target.position - GREATEST(p_window, 0), 1)
        AND LEAST(target.position + GREATEST(p_window, 0), target.total)
    )
  ) INTO result
  FROM ranked_entries AS target
  WHERE target.company_id = p_company_id;

  RETURN COALESCE(result, jsonb_build_object('position', 0, 'total', 0, 'startIndex', 0, 'entries', '[]'::JSONB));
END;
$$;
