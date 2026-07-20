-- Dynamic seasonal grape suppliers per company (buy-side NPC roster).
-- Mirrors grape_market_buyers pattern for sell-side NPC maintenance.

CREATE TABLE IF NOT EXISTS grape_market_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  description TEXT,
  is_bulk_supplier BOOLEAN NOT NULL DEFAULT FALSE,
  base_price_multiplier NUMERIC NOT NULL,
  multiplier_min NUMERIC NOT NULL,
  multiplier_max NUMERIC NOT NULL,
  base_season_supply_kg INTEGER NOT NULL,
  supplied_this_season_kg INTEGER NOT NULL DEFAULT 0,
  last_active_year INTEGER,
  last_active_season TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_grape_market_suppliers_company ON grape_market_suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_grape_market_suppliers_company_country ON grape_market_suppliers(company_id, country);

ALTER TABLE grape_market_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grape market suppliers" ON grape_market_suppliers;

CREATE POLICY "Users can manage grape market suppliers"
  ON grape_market_suppliers
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
