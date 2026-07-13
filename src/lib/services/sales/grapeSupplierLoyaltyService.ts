import {
  getBuyGoodsSupplierPersistenceBonus,
  getBuyGoodsSupplierPriorityProfiles,
  getBuyGoodsSupplierRelationshipPriceMultiplier,
  getBuyGoodsSupplierRelationships,
  recordBuyGoodsSupplierPurchase,
  type BuyGoodsSupplierRelationship,
  type BuyGoodsSupplierRelationshipLevel,
} from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';

// Grape procurement is a Buy Goods domain adapter. Its relationship rules live in the shared service.
export type SupplierLoyaltyLevel = BuyGoodsSupplierRelationshipLevel;
export type SupplierLoyaltyRecord = BuyGoodsSupplierRelationship & { consecutiveYears: number; totalKgPurchased: number; yearLoyaltyPoints: number; };
export const SUPPLIER_LOYALTY_LEVELS: Record<SupplierLoyaltyLevel, { name: string; minLoyaltyScore: number; benefits: string[] }> = {
  0: { name: 'Unknown Seller', minLoyaltyScore: 0, benefits: [] }, 1: { name: 'Familiar Seller', minLoyaltyScore: 700, benefits: ['0.99x supplier relationship factor'] }, 2: { name: 'Known Seller', minLoyaltyScore: 2000, benefits: ['0.98x supplier relationship factor'] }, 3: { name: 'Trusted Supplier', minLoyaltyScore: 4600, benefits: ['0.97x supplier relationship factor'] }, 4: { name: 'Preferred Supplier', minLoyaltyScore: 8500, benefits: ['0.95x supplier relationship factor'] }, 5: { name: 'Strategic Supplier', minLoyaltyScore: 14000, benefits: ['0.93x supplier relationship factor'] },
};
export const getSupplierRelationshipPriceMultiplier = getBuyGoodsSupplierRelationshipPriceMultiplier;
export const getSupplierPersistenceBonus = getBuyGoodsSupplierPersistenceBonus;
export async function getSupplierLoyalties(supplierIds: string[]): Promise<Record<string, SupplierLoyaltyRecord>> { const relationships = await getBuyGoodsSupplierRelationships('grapes', supplierIds); return Object.fromEntries(Object.entries(relationships).map(([id, relation]) => [id, { ...relation, consecutiveYears: 0, totalKgPurchased: relation.totalUnitsPurchased, yearLoyaltyPoints: 0 }])); }
export const getSupplierPriorityProfiles = (limit = 12) => getBuyGoodsSupplierPriorityProfiles('grapes', limit);
export const recordSupplierPurchase = (supplierId: string, supplierName: string, unitsPurchased: number, _currentYear: number, purchaseValue: number) => recordBuyGoodsSupplierPurchase('grapes', supplierId, supplierName, unitsPurchased, purchaseValue);
export const getSupplierYearlyTrustCap = (_consecutiveYears: number, _companyValue = 0) => 2600;
export const estimateSupplierTrustPointGain = (kgPurchased: number, _consecutiveYears: number, currentYearLoyaltyPoints: number, _companyValue = 0) => ({ yearlyCap: 2600, remainingCap: Math.max(0, 2600 - currentYearLoyaltyPoints), rawPoints: kgPurchased, appliedPoints: Math.min(kgPurchased, Math.max(0, 2600 - currentYearLoyaltyPoints)) });
