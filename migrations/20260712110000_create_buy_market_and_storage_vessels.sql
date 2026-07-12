-- Generic persisted Buy Market offers. Adapter-specific values live in payload.
CREATE TABLE IF NOT EXISTS market_buy_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  ware_group TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  origin_tag TEXT NOT NULL,
  available_units INTEGER NOT NULL CHECK (available_units >= 0),
  unit TEXT NOT NULL,
  base_price_per_unit NUMERIC NOT NULL,
  effective_price_per_unit NUMERIC NOT NULL,
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
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_market_buy_offers_company_group ON market_buy_offers(company_id, ware_group);
CREATE INDEX IF NOT EXISTS idx_market_buy_offers_active ON market_buy_offers(company_id, ware_group, available_units);

ALTER TABLE market_buy_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage market buy offers" ON market_buy_offers;
CREATE POLICY "Users can manage market buy offers"
  ON market_buy_offers FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

-- Preserve every grape offer while moving grape-only fields into the adapter payload.
INSERT INTO market_buy_offers (
  company_id, offer_id, ware_group, seller_id, seller_name, origin_tag,
  available_units, unit, base_price_per_unit, effective_price_per_unit, is_persistent,
  created_year, created_season, created_week,
  last_refreshed_year, last_refreshed_season, last_refreshed_week,
  expires_year, expires_season, expires_week, payload, updated_at
)
SELECT
  company_id, offer_id, 'grapes', supplier_id, supplier_name, origin_tag,
  available_kg, 'kg', base_price_per_kg, effective_price_per_kg, is_persistent,
  created_year, created_season, created_week,
  last_refreshed_year, last_refreshed_season, last_refreshed_week,
  expires_year, expires_season, expires_week,
  jsonb_build_object(
    'batchState', batch_state,
    'grapeVariety', grape_variety,
    'qualityScore', quality_score,
    'weeksOnMarket', weeks_on_market,
    'qualityDecayPerWeek', quality_decay_per_week,
    'minQualityFloor', min_quality_floor,
    'provenanceSnapshot', provenance_snapshot,
    'previewSnapshot', preview_snapshot,
    'previewVersion', preview_version
  ),
  updated_at
FROM grape_market_buy_offers
ON CONFLICT (company_id, offer_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS storage_vessels (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vessel_type TEXT NOT NULL,
  material TEXT NOT NULL,
  capacity_litres NUMERIC NOT NULL CHECK (capacity_litres > 0),
  acquisition_price NUMERIC NOT NULL CHECK (acquisition_price >= 0),
  source_offer_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'empty',
  purchased_year INTEGER NOT NULL,
  purchased_season TEXT NOT NULL,
  purchased_week INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_vessels_company ON storage_vessels(company_id);
ALTER TABLE storage_vessels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage storage vessels" ON storage_vessels;
CREATE POLICY "Users can manage storage vessels"
  ON storage_vessels FOR ALL
  USING (company_id IN (SELECT id FROM companies))
  WITH CHECK (company_id IN (SELECT id FROM companies));

-- Availability claim is atomic even if two purchase actions reach the client simultaneously.
CREATE OR REPLACE FUNCTION claim_market_buy_offer_units(
  p_company_id UUID,
  p_offer_id TEXT,
  p_units INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_units <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE market_buy_offers
  SET available_units = available_units - p_units, updated_at = NOW()
  WHERE company_id = p_company_id
    AND offer_id = p_offer_id
    AND available_units >= p_units;

  RETURN FOUND;
END;
$$;

-- The application no longer reads this table after this migration.
DROP TABLE IF EXISTS grape_market_buy_offers;
