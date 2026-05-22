-- Cleanup legacy wine_log.grape_quality constraint.
-- The app now tracks site/static quality through land_value_modifier,
-- so grape_quality must not block inserts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wine_log'
      AND column_name = 'grape_quality'
  ) THEN
    -- Backfill missing legacy values from land_value_modifier when available.
    UPDATE public.wine_log
    SET grape_quality = land_value_modifier
    WHERE grape_quality IS NULL
      AND land_value_modifier IS NOT NULL;

    -- Stop enforcing legacy not-null requirement.
    ALTER TABLE public.wine_log
      ALTER COLUMN grape_quality DROP NOT NULL;

    COMMENT ON COLUMN public.wine_log.grape_quality IS
      'Legacy compatibility field. Optional. Prefer land_value_modifier for active quality calculations.';
  END IF;
END $$;