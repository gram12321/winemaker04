-- Buy-side grape market offers per company.
-- Supports weekly quality decay and seasonal rotations with trusted carry-over offers.

CREATE TABLE IF NOT EXISTS grape_market_buy_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  ware_group TEXT NOT NULL DEFAULT 'grapes',
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  origin_tag TEXT NOT NULL,
  batch_state TEXT NOT NULL,
  grape_variety TEXT NOT NULL,
  available_kg INTEGER NOT NULL,
  quality_score NUMERIC NOT NULL,
  base_price_per_kg NUMERIC NOT NULL,
  effective_price_per_kg NUMERIC NOT NULL,
  weeks_on_market INTEGER NOT NULL DEFAULT 0,
  quality_decay_per_week NUMERIC NOT NULL,
  min_quality_floor NUMERIC NOT NULL,
  is_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  created_year INTEGER NOT NULL,
  created_season TEXT NOT NULL,
  created_week INTEGER NOT NULL,
  last_refreshed_year INTEGER NOT NULL,
  last_refreshed_season TEXT NOT NULL,
  last_refreshed_week INTEGER NOT NULL,
  expires_year INTEGER,
  expires_season TEXT,
  expires_week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_grape_market_buy_offers_company ON grape_market_buy_offers(company_id);
CREATE INDEX IF NOT EXISTS idx_grape_market_buy_offers_company_group ON grape_market_buy_offers(company_id, ware_group);

ALTER TABLE grape_market_buy_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grape market buy offers" ON grape_market_buy_offers;

CREATE POLICY "Users can manage grape market buy offers"
  ON grape_market_buy_offers
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
