-- Storage vessel quality is a normalized 0-1 equipment attribute.
ALTER TABLE storage_vessels
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC NOT NULL DEFAULT 0.5
  CHECK (quality_score >= 0 AND quality_score <= 1);

UPDATE storage_vessels
SET quality_score = 0.78
WHERE source_offer_id = 'storage_vessel_oak_cask_225';

UPDATE storage_vessels
SET quality_score = 0.84
WHERE source_offer_id = 'storage_vessel_oak_cask_500';

-- Existing persistent catalogue offers receive their explicit catalogue quality.
UPDATE market_buy_offers
SET payload = jsonb_set(payload, '{qualityScore}', '0.78'::jsonb, TRUE)
WHERE ware_group = 'storage_vessels'
  AND offer_id = 'storage_vessel_oak_cask_225';

UPDATE market_buy_offers
SET payload = jsonb_set(payload, '{qualityScore}', '0.84'::jsonb, TRUE)
WHERE ware_group = 'storage_vessels'
  AND offer_id = 'storage_vessel_oak_cask_500';
