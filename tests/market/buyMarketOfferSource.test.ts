import { describe, expect, it } from 'vitest';
import { getBuyMarketOfferSourcePresentation, isBuyMarketOfferInSourceFilter } from '@/lib/services/market/buyMarketOfferSource';

describe('Buy Market offer source presentation', () => {
  it('uses one seller relationship presentation for supplier and global offers', () => {
    expect(getBuyMarketOfferSourcePresentation({
      kind: 'supplier_stock', seller: { kind: 'supplier', id: 'cooper', name: 'Cooperage Duval' },
    })).toEqual({ label: 'Local supplier', sellerLabel: 'Cooperage Duval', usesMarketRelationship: true });

    expect(getBuyMarketOfferSourcePresentation({
      kind: 'company_listing', seller: { kind: 'company', id: 'company-2', companyId: 'company-2', name: 'Nordic Cellar Craft' },
    })).toEqual({ label: 'Global Market', sellerLabel: 'Nordic Cellar Craft', usesMarketRelationship: true });
  });

  it('classifies all global sellers through the same global-market filter', () => {
    const local = { source: { kind: 'supplier_stock' as const, seller: { kind: 'supplier' as const, id: 's', name: 'Local' } } };
    const global = { source: { kind: 'company_listing' as const, seller: { kind: 'company' as const, id: 'c', companyId: 'c', name: 'Cellar' } } };
    expect(isBuyMarketOfferInSourceFilter(local, 'local_supplier')).toBe(true);
    expect(isBuyMarketOfferInSourceFilter(local, 'global_market')).toBe(false);
    expect(isBuyMarketOfferInSourceFilter(global, 'global_market')).toBe(true);
  });
});
