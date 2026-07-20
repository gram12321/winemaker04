-- Tracks loyalty progression for each grape buyer per company.
-- Used to show relationship depth and long-term sales history in the Sell Grapes modal.

CREATE TABLE IF NOT EXISTS grape_buyer_loyalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL,
  total_sales INTEGER NOT NULL DEFAULT 0,
  consecutive_years INTEGER NOT NULL DEFAULT 0,
  total_kg_sold INTEGER NOT NULL DEFAULT 0,
  loyalty_score INTEGER NOT NULL DEFAULT 0,
  year_guard_year INTEGER,
  year_kg_sold INTEGER NOT NULL DEFAULT 0,
  year_loyalty_points INTEGER NOT NULL DEFAULT 0,
  last_sale_year INTEGER,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, buyer_id)
);

ALTER TABLE grape_buyer_loyalty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their grape buyer loyalty" ON grape_buyer_loyalty;

CREATE POLICY "Users can manage their grape buyer loyalty"
  ON grape_buyer_loyalty
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
