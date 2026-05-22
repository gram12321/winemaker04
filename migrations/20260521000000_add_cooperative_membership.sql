-- Cooperative membership tracking for Germany's Winzergenossenschaft mechanic.
-- Tracks how many consecutive years a German company has sold grapes to the cooperative.
-- Membership level (0–3) determines the guaranteed floor price and unlocks vineyard benefits.

CREATE TABLE IF NOT EXISTS cooperative_membership (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  total_sales INTEGER NOT NULL DEFAULT 0,       -- lifetime number of sales to the coop
  consecutive_years INTEGER NOT NULL DEFAULT 0, -- unbroken yearly streak (resets if a year is missed)
  total_kg_sold INTEGER NOT NULL DEFAULT 0,     -- lifetime kg sold to the coop
  last_sale_year INTEGER,                       -- game year of the most recent sale
  level INTEGER NOT NULL DEFAULT 0,             -- 0=none, 1=basic(1yr), 2=active(3yrs), 3=senior(6yrs)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
);

ALTER TABLE cooperative_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their cooperative membership" ON cooperative_membership;

CREATE POLICY "Users can manage their cooperative membership"
  ON cooperative_membership
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));
