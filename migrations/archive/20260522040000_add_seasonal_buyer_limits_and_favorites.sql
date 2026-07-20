-- Extend grape market buyers with seasonal hard-cap and favorite-grape preferences.
-- Keep old yearly column for backward compatibility with existing environments.

ALTER TABLE grape_market_buyers
  ADD COLUMN IF NOT EXISTS base_season_limit_kg INTEGER,
  ADD COLUMN IF NOT EXISTS sold_this_season_kg INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_grape_1 TEXT,
  ADD COLUMN IF NOT EXISTS favorite_grape_2 TEXT;

UPDATE grape_market_buyers
SET
  base_season_limit_kg = COALESCE(base_season_limit_kg, GREATEST(200, base_yearly_limit_kg)),
  sold_this_season_kg = COALESCE(sold_this_season_kg, 0)
WHERE base_season_limit_kg IS NULL OR sold_this_season_kg IS NULL;

ALTER TABLE grape_market_buyers
  ALTER COLUMN base_season_limit_kg SET NOT NULL,
  ALTER COLUMN sold_this_season_kg SET NOT NULL;
