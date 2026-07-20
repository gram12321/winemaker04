import type { BuyMarketOfferSource, BuyMarketOfferView, BuyMarketSourceFilter } from '@/lib/types/market';

export interface BuyMarketOfferSourcePresentation {
  label: string;
  sellerLabel: string;
  usesMarketRelationship: boolean;
}


export function getBuyMarketOfferSourcePresentation(source: BuyMarketOfferSource): BuyMarketOfferSourcePresentation {
  switch (source.kind) {
    case 'supplier_stock':
      return { label: 'Local supplier', sellerLabel: source.seller.name, usesMarketRelationship: true };
    case 'npc_used':
      return { label: 'Global Market', sellerLabel: source.seller.name, usesMarketRelationship: true };
    case 'company_listing':
      return { label: 'Global Market', sellerLabel: source.seller.name, usesMarketRelationship: true };
  }
}

export function isBuyMarketOfferInSourceFilter(
  offer: Pick<BuyMarketOfferView, 'source'>,
  filter: BuyMarketSourceFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'local_supplier') return offer.source.kind === 'supplier_stock';
  return offer.source.kind !== 'supplier_stock';
}
