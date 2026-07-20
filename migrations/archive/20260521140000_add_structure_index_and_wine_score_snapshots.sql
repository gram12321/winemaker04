-- Add missing snapshot columns to wine_batches.
-- structure_index_harvest_snapshot, structure_index_bottling_snapshot,
-- and wine_score_bottling_snapshot had no prior migration.

ALTER TABLE public.wine_batches
  ADD COLUMN IF NOT EXISTS structure_index_harvest_snapshot numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS structure_index_bottling_snapshot numeric,
  ADD COLUMN IF NOT EXISTS wine_score_bottling_snapshot numeric;

COMMENT ON COLUMN public.wine_batches.structure_index_harvest_snapshot IS 'Structure index captured at harvest time.';
COMMENT ON COLUMN public.wine_batches.structure_index_bottling_snapshot IS 'Structure index captured at bottling time (null until bottled).';
COMMENT ON COLUMN public.wine_batches.wine_score_bottling_snapshot IS 'Overall wine score captured at bottling time (null until bottled).';
