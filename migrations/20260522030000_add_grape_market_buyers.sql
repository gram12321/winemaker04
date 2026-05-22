-- Dynamic seasonal grape buyers per company.
-- Keeps a rotating roster of buyers and supports yearly capacity limits.

CREATE TABLE IF NOT EXISTS grape_market_buyers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  description TEXT,
  is_germany_coop BOOLEAN NOT NULL DEFAULT FALSE,
  base_multiplier NUMERIC NOT NULL,
  multiplier_min NUMERIC NOT NULL,
  multiplier_max NUMERIC NOT NULL,
  base_yearly_limit_kg INTEGER NOT NULL,
  last_active_year INTEGER,
  last_active_season TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, buyer_id)
);

ALTER TABLE grape_market_buyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grape market buyers" ON grape_market_buyers;

CREATE POLICY "Users can manage grape market buyers"
  ON grape_market_buyers
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
