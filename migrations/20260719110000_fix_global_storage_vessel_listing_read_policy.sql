-- Global used-market listings are intentionally visible to every company.
-- Ownership and transfer remain protected by the SECURITY DEFINER RPCs.
ALTER TABLE storage_vessel_market_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active global storage vessel listings" ON storage_vessel_market_listings;
CREATE POLICY "Anyone can view active global storage vessel listings"
  ON storage_vessel_market_listings FOR SELECT
  USING (status = 'active');
