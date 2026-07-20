import { describe, expect, it } from 'vitest';
import { getBuyMarketOfferSourcePresentation } from '@/lib/services/market/buyMarketOfferSource';

describe('Buy Market offer source presentation', () => {
  it('uses one seller relationship presentation for supplier and global offers', () => {
    expect(getBuyMarketOfferSourcePresentation({
      kind: 'supplier_stock', seller: { kind: 'supplier', id: 'cooper', name: 'Cooperage Duval' },
    })).toEqual({ label: 'Local supplier', sellerLabel: 'Cooperage Duval', usesMarketRelationship: true });

    expect(getBuyMarketOfferSourcePresentation({
      kind: 'company_listing', seller: { kind: 'company', id: 'company-2', companyId: 'company-2', name: 'Nordic Cellar Craft' },
    })).toEqual({ label: 'Global Market', sellerLabel: 'Nordic Cellar Craft', usesMarketRelationship: true });
  });
});
