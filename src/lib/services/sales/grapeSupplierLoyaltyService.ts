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
export type SupplierLoyaltyRecord = BuyGoodsSupplierRelationship;
export const getSupplierRelationshipPriceMultiplier = getBuyGoodsSupplierRelationshipPriceMultiplier;
export const getSupplierPersistenceBonus = getBuyGoodsSupplierPersistenceBonus;
export async function getSupplierLoyalties(supplierIds: string[]): Promise<Record<string, SupplierLoyaltyRecord>> { return getBuyGoodsSupplierRelationships('grapes', supplierIds); }
export const getSupplierPriorityProfiles = (limit = 12) => getBuyGoodsSupplierPriorityProfiles('grapes', limit);
export const recordSupplierPurchase = (supplierId: string, supplierName: string, unitsPurchased: number, _currentYear: number, purchaseValue: number) => recordBuyGoodsSupplierPurchase('grapes', supplierId, supplierName, unitsPurchased, purchaseValue);
