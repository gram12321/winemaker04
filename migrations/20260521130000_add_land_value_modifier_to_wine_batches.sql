-- Add land_value_modifier columns to wine_batches.
-- These track the vineyard land value modifier at harvest time,
-- during fermentation/aging, and at bottling.

ALTER TABLE public.wine_batches
  ADD COLUMN IF NOT EXISTS land_value_modifier numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS land_value_modifier_harvest_snapshot numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS land_value_modifier_bottling_snapshot numeric;

COMMENT ON COLUMN public.wine_batches.land_value_modifier IS 'Current land value modifier for this batch (0-1+ range, updated during processing).';
COMMENT ON COLUMN public.wine_batches.land_value_modifier_harvest_snapshot IS 'Land value modifier captured at harvest time.';
COMMENT ON COLUMN public.wine_batches.land_value_modifier_bottling_snapshot IS 'Land value modifier captured at bottling time (null until bottled).';
