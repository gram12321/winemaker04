-- Rename persisted score and achievement identifiers to explicit taste-quality naming.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'highscores'
  ) THEN
    UPDATE public.highscores
    SET score_type = 'highest_taste_quality_index'
    WHERE score_type IN ('highest_taste_index', 'highest_quality_index');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'achievements'
  ) THEN
    UPDATE public.achievements
    SET achievement_key = REPLACE(achievement_key, 'wine_taste_index_', 'wine_taste_quality_index_')
    WHERE achievement_key LIKE 'wine_taste_index_%';

    UPDATE public.achievements
    SET achievement_key = REPLACE(achievement_key, 'wine_quality_index_', 'wine_taste_quality_index_')
    WHERE achievement_key LIKE 'wine_quality_index_%';
  END IF;
END $$;
