-- Add wine presale fields to existing wine contracts and create grape forward contracts table.

ALTER TABLE IF EXISTS wine_contracts
  ADD COLUMN IF NOT EXISTS contract_mode TEXT NOT NULL DEFAULT 'spot',
  ADD COLUMN IF NOT EXISTS upfront_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS upfront_paid_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS final_payment_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS default_penalty_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS accepted_week INTEGER,
  ADD COLUMN IF NOT EXISTS accepted_season TEXT,
  ADD COLUMN IF NOT EXISTS accepted_year INTEGER,
  ADD COLUMN IF NOT EXISTS defaulted_week INTEGER,
  ADD COLUMN IF NOT EXISTS defaulted_season TEXT,
  ADD COLUMN IF NOT EXISTS defaulted_year INTEGER;

CREATE TABLE IF NOT EXISTS grape_forward_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  target_state TEXT NOT NULL,
  target_grape TEXT,
  quantity_kg INTEGER NOT NULL,
  delivered_kg INTEGER NOT NULL DEFAULT 0,
  unit_price_per_kg NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  upfront_percent NUMERIC NOT NULL,
  upfront_paid_amount NUMERIC NOT NULL,
  final_payment_amount NUMERIC NOT NULL,
  default_penalty_amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  created_week INTEGER NOT NULL,
  created_season TEXT NOT NULL,
  created_year INTEGER NOT NULL,
  due_week INTEGER NOT NULL,
  due_season TEXT NOT NULL,
  due_year INTEGER NOT NULL,
  accepted_week INTEGER,
  accepted_season TEXT,
  accepted_year INTEGER,
  settled_week INTEGER,
  settled_season TEXT,
  settled_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grape_forward_contracts_company ON grape_forward_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_grape_forward_contracts_status ON grape_forward_contracts(company_id, status);

ALTER TABLE grape_forward_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage grape forward contracts" ON grape_forward_contracts;

CREATE POLICY "Users can manage grape forward contracts"
  ON grape_forward_contracts
  FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies
  ));
