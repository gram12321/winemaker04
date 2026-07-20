-- Rename legacy "balance" columns to structure index naming (idempotent for fresh DBs that already use new names).
-- Run against your Supabase project when deploying this branch.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wine_batches' AND column_name = 'balance'
  ) THEN
    ALTER TABLE public.wine_batches RENAME COLUMN balance TO structure_index;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wine_batches' AND column_name = 'born_balance'
  ) THEN
    ALTER TABLE public.wine_batches RENAME COLUMN born_balance TO born_structure_index;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wine_batches' AND column_name = 'bottled_balance'
  ) THEN
    ALTER TABLE public.wine_batches RENAME COLUMN bottled_balance TO bottled_structure_index;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wine_log' AND column_name = 'balance'
  ) THEN
    ALTER TABLE public.wine_log RENAME COLUMN balance TO structure_index;
  END IF;
END $$;

UPDATE public.highscores
SET score_type = 'highest_structure_index'
WHERE score_type = 'highest_balance';
