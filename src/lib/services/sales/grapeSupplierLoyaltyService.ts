import {
  getBuyMarketCounterpartyPersistenceBonus,
  getBuyMarketCounterpartyPriceMultiplier,
  getBuyMarketCounterpartyPriorityProfiles,
  getBuyMarketCounterpartyRelationships,
  recordBuyMarketCounterpartyPurchaseForActiveCompany,
  type BuyMarketCounterpartyRelationship,
  type BuyMarketCounterpartyRelationshipLevel,
} from '@/lib/services/market/buyMarketCounterpartyRelationshipService';

// Grape procurement is a domain adapter: it keeps supplier-specific market
// selection semantics while delegating relationship state and terms to Buy Market.
export type SupplierLoyaltyLevel = BuyMarketCounterpartyRelationshipLevel;
export type SupplierLoyaltyRecord = BuyMarketCounterpartyRelationship;
export const getSupplierRelationshipPriceMultiplier = getBuyMarketCounterpartyPriceMultiplier;
export const getSupplierPersistenceBonus = getBuyMarketCounterpartyPersistenceBonus;
export async function getSupplierLoyalties(supplierIds: string[]): Promise<Record<string, SupplierLoyaltyRecord>> {
  const relationships = await getBuyMarketCounterpartyRelationships(supplierIds.map((id) => ({ kind: 'supplier' as const, id, name: id })));
  return Object.fromEntries(supplierIds
    .map((id) => [id, relationships[`supplier:${id}`]] as const)
    .filter((entry): entry is readonly [string, SupplierLoyaltyRecord] => Boolean(entry[1])));
}
export const getSupplierPriorityProfiles = async (limit = 12) => (await getBuyMarketCounterpartyPriorityProfiles('supplier', limit)).map((profile) => ({ supplierId: profile.counterpartyId, supplierName: profile.counterpartyName, loyaltyScore: profile.loyaltyScore, level: profile.level }));
export const recordSupplierPurchase = (supplierId: string, supplierName: string, unitsPurchased: number, _currentYear: number, purchaseValue: number) => recordBuyMarketCounterpartyPurchaseForActiveCompany({ kind: 'supplier', id: supplierId, name: supplierName }, unitsPurchased, purchaseValue);
