-- Hotfix for environments where grape_buyer_loyalty was already created
-- with auth.uid()-based policy and causes 42501 on insert/upsert.

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
