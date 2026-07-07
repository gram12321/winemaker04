ALTER TABLE grape_market_buy_offers
  ADD COLUMN IF NOT EXISTS provenance_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS preview_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS preview_version INTEGER;

ALTER TABLE wine_batches
  ADD COLUMN IF NOT EXISTS origin_snapshot JSONB;
