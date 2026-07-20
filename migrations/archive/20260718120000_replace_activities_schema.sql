-- Development-only replacement of the activity record schema.
-- Existing activity rows and the retired table shape are intentionally removed;
-- there is no backfill or compatibility view.
BEGIN;

DROP TABLE IF EXISTS activities CASCADE;

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  total_work NUMERIC NOT NULL CHECK (total_work >= 0),
  completed_work NUMERIC NOT NULL DEFAULT 0 CHECK (completed_work >= 0),
  target_id TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  game_week INTEGER NOT NULL,
  game_season TEXT NOT NULL,
  game_year INTEGER NOT NULL,
  is_cancellable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT activities_completed_work_within_total CHECK (completed_work <= total_work)
);

CREATE INDEX activities_company_status_created_idx
  ON activities(company_id, status, created_at DESC);
CREATE INDEX activities_company_target_status_idx
  ON activities(company_id, target_id, status);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage company activities"
  ON activities FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

ALTER TABLE storage_vessel_allocation_plans
  ADD CONSTRAINT storage_vessel_allocation_plans_activity_id_fkey
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL;

COMMIT;
