-- ============================================================
-- Taste Quality Index column migration
-- Date: 2026-05-20
--
-- Purpose:
--   Standalone, idempotent script for Supabase SQL Editor.
--   Renames persisted quality-index columns to taste-quality naming
--   for the new computed taste quality system.
--
-- Safe to rerun:
--   - If old columns exist and new columns do not, columns are renamed.
--   - If both old and new columns exist, values are backfilled and old
--     columns are dropped.
--   - If neither old nor new columns exist, new columns are added.
-- ============================================================

BEGIN;

SET LOCAL search_path = public;

DO $$
BEGIN
  -- ------------------------------------------------------------
  -- wine_batches: current taste quality
  -- ------------------------------------------------------------
  IF to_regclass('public.wine_batches') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index'
    ) THEN
      ALTER TABLE public.wine_batches
        RENAME COLUMN quality_index TO taste_quality_index;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index'
    ) THEN
      UPDATE public.wine_batches
      SET taste_quality_index = COALESCE(taste_quality_index, quality_index, 0.5);

      ALTER TABLE public.wine_batches
        DROP COLUMN quality_index;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD COLUMN taste_quality_index numeric DEFAULT 0.5;
    END IF;

    -- Optional fallback for very old schemas that used grape_quality directly.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'grape_quality'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index'
    ) THEN
      UPDATE public.wine_batches
      SET taste_quality_index = COALESCE(taste_quality_index, grape_quality, 0.5)
      WHERE taste_quality_index IS NULL;
    END IF;

    -- ----------------------------------------------------------
    -- wine_batches: harvest snapshot
    -- ----------------------------------------------------------
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index_harvest_snapshot'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_harvest_snapshot'
    ) THEN
      ALTER TABLE public.wine_batches
        RENAME COLUMN quality_index_harvest_snapshot TO taste_quality_index_harvest_snapshot;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index_harvest_snapshot'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_harvest_snapshot'
    ) THEN
      UPDATE public.wine_batches
      SET taste_quality_index_harvest_snapshot =
        COALESCE(taste_quality_index_harvest_snapshot, quality_index_harvest_snapshot, taste_quality_index, 0.5);

      ALTER TABLE public.wine_batches
        DROP COLUMN quality_index_harvest_snapshot;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_harvest_snapshot'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD COLUMN taste_quality_index_harvest_snapshot numeric DEFAULT 0.5;
    END IF;

    -- ----------------------------------------------------------
    -- wine_batches: bottling snapshot
    -- ----------------------------------------------------------
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index_bottling_snapshot'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_bottling_snapshot'
    ) THEN
      ALTER TABLE public.wine_batches
        RENAME COLUMN quality_index_bottling_snapshot TO taste_quality_index_bottling_snapshot;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'quality_index_bottling_snapshot'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_bottling_snapshot'
    ) THEN
      UPDATE public.wine_batches
      SET taste_quality_index_bottling_snapshot =
        COALESCE(taste_quality_index_bottling_snapshot, quality_index_bottling_snapshot);

      ALTER TABLE public.wine_batches
        DROP COLUMN quality_index_bottling_snapshot;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_batches'
        AND column_name = 'taste_quality_index_bottling_snapshot'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD COLUMN taste_quality_index_bottling_snapshot numeric;
    END IF;

    -- Normalize existing data before range constraints are enforced.
    UPDATE public.wine_batches
    SET
      taste_quality_index = LEAST(1, GREATEST(0, COALESCE(taste_quality_index, 0.5))),
      taste_quality_index_harvest_snapshot = LEAST(1, GREATEST(0, COALESCE(taste_quality_index_harvest_snapshot, taste_quality_index, 0.5))),
      taste_quality_index_bottling_snapshot = CASE
        WHEN taste_quality_index_bottling_snapshot IS NULL THEN NULL
        ELSE LEAST(1, GREATEST(0, taste_quality_index_bottling_snapshot))
      END;

    -- Preserve a bottling snapshot for already bottled wines that predate the column.
    UPDATE public.wine_batches
    SET taste_quality_index_bottling_snapshot = taste_quality_index
    WHERE state = 'bottled'
      AND taste_quality_index_bottling_snapshot IS NULL;

    ALTER TABLE public.wine_batches
      ALTER COLUMN taste_quality_index SET DEFAULT 0.5;

    ALTER TABLE public.wine_batches
      ALTER COLUMN taste_quality_index_harvest_snapshot SET DEFAULT 0.5;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.wine_batches'::regclass
        AND conname = 'wine_batches_taste_quality_index_range'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD CONSTRAINT wine_batches_taste_quality_index_range
        CHECK (taste_quality_index >= 0 AND taste_quality_index <= 1);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.wine_batches'::regclass
        AND conname = 'wine_batches_taste_quality_index_harvest_snapshot_range'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD CONSTRAINT wine_batches_taste_quality_index_harvest_snapshot_range
        CHECK (taste_quality_index_harvest_snapshot >= 0 AND taste_quality_index_harvest_snapshot <= 1);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.wine_batches'::regclass
        AND conname = 'wine_batches_taste_quality_index_bottling_snapshot_range'
    ) THEN
      ALTER TABLE public.wine_batches
        ADD CONSTRAINT wine_batches_taste_quality_index_bottling_snapshot_range
        CHECK (taste_quality_index_bottling_snapshot >= 0 AND taste_quality_index_bottling_snapshot <= 1);
    END IF;

    COMMENT ON COLUMN public.wine_batches.taste_quality_index
      IS 'Computed wine taste quality index (0-1 scale)';

    COMMENT ON COLUMN public.wine_batches.taste_quality_index_harvest_snapshot
      IS 'Taste quality index captured at harvest (0-1 scale)';

    COMMENT ON COLUMN public.wine_batches.taste_quality_index_bottling_snapshot
      IS 'Taste quality index captured at bottling (0-1 scale)';
  END IF;

  -- ------------------------------------------------------------
  -- wine_log: bottled wine taste quality snapshot
  -- ------------------------------------------------------------
  IF to_regclass('public.wine_log') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'quality_index'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'taste_quality_index'
    ) THEN
      ALTER TABLE public.wine_log
        RENAME COLUMN quality_index TO taste_quality_index;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'quality_index'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'taste_quality_index'
    ) THEN
      UPDATE public.wine_log
      SET taste_quality_index = COALESCE(taste_quality_index, quality_index, 0.5);

      ALTER TABLE public.wine_log
        DROP COLUMN quality_index;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'taste_quality_index'
    ) THEN
      ALTER TABLE public.wine_log
        ADD COLUMN taste_quality_index numeric DEFAULT 0.5;
    END IF;

    -- Optional fallback for very old schemas that used grape_quality directly.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'grape_quality'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wine_log'
        AND column_name = 'taste_quality_index'
    ) THEN
      UPDATE public.wine_log
      SET taste_quality_index = COALESCE(taste_quality_index, grape_quality, 0.5)
      WHERE taste_quality_index IS NULL;
    END IF;

    UPDATE public.wine_log
    SET taste_quality_index = LEAST(1, GREATEST(0, COALESCE(taste_quality_index, 0.5)));

    ALTER TABLE public.wine_log
      ALTER COLUMN taste_quality_index SET DEFAULT 0.5;

    ALTER TABLE public.wine_log
      ALTER COLUMN taste_quality_index SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.wine_log'::regclass
        AND conname = 'wine_log_taste_quality_index_range'
    ) THEN
      ALTER TABLE public.wine_log
        ADD CONSTRAINT wine_log_taste_quality_index_range
        CHECK (taste_quality_index >= 0 AND taste_quality_index <= 1);
    END IF;

    COMMENT ON COLUMN public.wine_log.taste_quality_index
      IS 'Taste quality index captured for bottled wine log entry (0-1 scale)';
  END IF;
END $$;

COMMIT;

-- Optional verification after running:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('wine_batches', 'wine_log')
--   AND column_name LIKE '%quality_index%'
-- ORDER BY table_name, ordinal_position;
