-- Adds loyalty score and yearly guard fields for buyer loyalty formula.
-- Safe to run on environments where grape_buyer_loyalty already exists.

ALTER TABLE grape_buyer_loyalty
  ADD COLUMN IF NOT EXISTS loyalty_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_guard_year INTEGER,
  ADD COLUMN IF NOT EXISTS year_kg_sold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_loyalty_points INTEGER NOT NULL DEFAULT 0;
