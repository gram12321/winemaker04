-- Tracks trust progression for each grape supplier per company.
-- Used by buy-market pricing and relationship panels in Buy from Market.

CREATE TABLE IF NOT EXISTS grape_supplier_loyalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  consecutive_years INTEGER NOT NULL DEFAULT 0,
  total_kg_purchased INTEGER NOT NULL DEFAULT 0,
  loyalty_score INTEGER NOT NULL DEFAULT 0,
  year_guard_year INTEGER,
  year_kg_purchased INTEGER NOT NULL DEFAULT 0,
  year_loyalty_points INTEGER NOT NULL DEFAULT 0,
  last_purchase_year INTEGER,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, supplier_id)
);

ALTER TABLE grape_supplier_loyalty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their grape supplier loyalty" ON grape_supplier_loyalty;

CREATE POLICY "Users can manage their grape supplier loyalty"
  ON grape_supplier_loyalty
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
