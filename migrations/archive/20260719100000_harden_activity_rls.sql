-- Restrict activity records to the owning authenticated player.
-- Guest companies remain supported through the explicit anonymous policy below.
BEGIN;

DROP POLICY IF EXISTS "Users can manage company activities" ON activities;

CREATE POLICY "Authenticated users manage their company activities"
  ON activities FOR ALL
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Ownerless companies have no server-verifiable guest identity today. This
-- preserves guest gameplay, but is a shared anonymous scope rather than
-- per-guest privacy. Add a guest principal before treating guest data as
-- private between browsers.
CREATE POLICY "Anonymous clients manage unowned company activities"
  ON activities FOR ALL
  TO anon
  USING (company_id IN (SELECT id FROM companies WHERE user_id IS NULL))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IS NULL));

COMMIT;
