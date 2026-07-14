import {
  getBuyGoodsSupplierPersistenceBonus,
  BUY_GOODS_SUPPLIER_LEVELS,
  getBuyGoodsSupplierPriorityProfiles,
  getBuyGoodsRelationshipPointsForPurchase,
  getBuyGoodsRelationshipYearlyCap,
  getBuyGoodsSupplierRelationshipPriceMultiplier,
  getBuyGoodsSupplierRelationships,
  recordBuyGoodsSupplierPurchase,
  type BuyGoodsSupplierRelationship,
  type BuyGoodsSupplierRelationshipLevel,
} from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';

// Grape procurement is a Buy Goods domain adapter. Its relationship rules live in the shared service.
export type SupplierLoyaltyLevel = BuyGoodsSupplierRelationshipLevel;
export type SupplierLoyaltyRecord = BuyGoodsSupplierRelationship;
export const SUPPLIER_LOYALTY_LEVELS = BUY_GOODS_SUPPLIER_LEVELS;
export const getSupplierRelationshipPriceMultiplier = getBuyGoodsSupplierRelationshipPriceMultiplier;
export const getSupplierPersistenceBonus = getBuyGoodsSupplierPersistenceBonus;
export async function getSupplierLoyalties(supplierIds: string[]): Promise<Record<string, SupplierLoyaltyRecord>> { return getBuyGoodsSupplierRelationships('grapes', supplierIds); }
export const getSupplierPriorityProfiles = (limit = 12) => getBuyGoodsSupplierPriorityProfiles('grapes', limit);
export const recordSupplierPurchase = (supplierId: string, supplierName: string, unitsPurchased: number, _currentYear: number, purchaseValue: number) => recordBuyGoodsSupplierPurchase('grapes', supplierId, supplierName, unitsPurchased, purchaseValue);
export const getSupplierYearlyTrustCap = (_consecutiveYears: number, companyValue = 0) => getBuyGoodsRelationshipYearlyCap(companyValue);
export const estimateSupplierTrustPointGain = (purchaseValue: number, _consecutiveYears: number, currentYearLoyaltyPoints: number, companyValue = 0) => { const yearlyCap = getBuyGoodsRelationshipYearlyCap(companyValue); const rawPoints = getBuyGoodsRelationshipPointsForPurchase(purchaseValue); return { yearlyCap, remainingCap: Math.max(0, yearlyCap - currentYearLoyaltyPoints), rawPoints, appliedPoints: Math.min(rawPoints, Math.max(0, yearlyCap - currentYearLoyaltyPoints)) }; };
