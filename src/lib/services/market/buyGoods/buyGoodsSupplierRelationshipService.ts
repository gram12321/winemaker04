import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import {
  getBuyGoodsSupplierRelationshipRows,
  getBuyGoodsSupplierPriorityRows,
  recordBuyGoodsSupplierRelationshipPurchase,
} from '@/lib/database/market/buyGoodsSupplierRelationshipsDB';
import type { BuyMarketWareGroup } from '@/lib/types/market';

export type BuyGoodsSupplierRelationshipLevel = 0 | 1 | 2 | 3 | 4 | 5;
export interface BuyGoodsSupplierRelationship { companyId: string; goodsDomain: BuyMarketWareGroup; supplierId: string; supplierName: string; totalPurchases: number; totalUnitsPurchased: number; loyaltyScore: number; level: BuyGoodsSupplierRelationshipLevel; lastPurchaseYear: number | null; consecutiveYears: number; yearUnitsPurchased: number; yearRelationshipPoints: number; yearGuardYear: number | null; }

export interface BuyGoodsSupplierLevelConfig {
  name: string;
  minLoyaltyScore: number;
  priceMultiplier: number;
  persistenceBonus: number;
  benefits: string[];
}

export const BUY_GOODS_SUPPLIER_LEVELS: Record<BuyGoodsSupplierRelationshipLevel, BuyGoodsSupplierLevelConfig> = {
  0: { name: 'Unknown Seller', minLoyaltyScore: 0, priceMultiplier: 1, persistenceBonus: 0, benefits: [] },
  1: { name: 'Familiar Seller', minLoyaltyScore: 700, priceMultiplier: .99, persistenceBonus: .05, benefits: ['0.99x supplier relationship factor'] },
  2: { name: 'Known Seller', minLoyaltyScore: 2000, priceMultiplier: .98, persistenceBonus: .1, benefits: ['0.98x supplier relationship factor'] },
  3: { name: 'Trusted Supplier', minLoyaltyScore: 4600, priceMultiplier: .97, persistenceBonus: .15, benefits: ['0.97x supplier relationship factor'] },
  4: { name: 'Preferred Supplier', minLoyaltyScore: 8500, priceMultiplier: .95, persistenceBonus: .22, benefits: ['0.95x supplier relationship factor'] },
  5: { name: 'Strategic Supplier', minLoyaltyScore: 14000, priceMultiplier: .93, persistenceBonus: .3, benefits: ['0.93x supplier relationship factor'] },
};
function levelFor(score: number): BuyGoodsSupplierRelationshipLevel { return ([5, 4, 3, 2, 1, 0] as const).find((level) => score >= BUY_GOODS_SUPPLIER_LEVELS[level].minLoyaltyScore) ?? 0; }
function mapRow(row: any): BuyGoodsSupplierRelationship { return { companyId: row.company_id, goodsDomain: row.goods_domain, supplierId: row.supplier_id, supplierName: row.supplier_name, totalPurchases: row.total_purchases, totalUnitsPurchased: row.total_units_purchased, loyaltyScore: row.loyalty_score, level: levelFor(row.loyalty_score), lastPurchaseYear: row.last_purchase_year, consecutiveYears: row.consecutive_years ?? 0, yearUnitsPurchased: row.year_units_purchased ?? 0, yearRelationshipPoints: row.year_relationship_points ?? 0, yearGuardYear: row.year_guard_year ?? null }; }

export function getBuyGoodsSupplierRelationshipPriceMultiplier(level: BuyGoodsSupplierRelationshipLevel): number { return BUY_GOODS_SUPPLIER_LEVELS[level].priceMultiplier; }
export function getBuyGoodsSupplierPersistenceBonus(level: BuyGoodsSupplierRelationshipLevel): number { return BUY_GOODS_SUPPLIER_LEVELS[level].persistenceBonus; }

export async function getBuyGoodsSupplierRelationships(goodsDomain: BuyMarketWareGroup, supplierIds: string[]): Promise<Record<string, BuyGoodsSupplierRelationship>> {
  const companyId = getCurrentCompanyId(); if (!companyId || supplierIds.length === 0) return {};
  const { data, error } = await getBuyGoodsSupplierRelationshipRows(companyId, goodsDomain, supplierIds); if (error) return {};
  return Object.fromEntries((data ?? []).map((row: any) => { const relation = mapRow(row); return [relation.supplierId, relation]; }));
}

export async function getBuyGoodsSupplierPriorityProfiles(goodsDomain: BuyMarketWareGroup, limit = 12) {
  const companyId = getCurrentCompanyId(); if (!companyId) return [];
  const { data, error } = await getBuyGoodsSupplierPriorityRows(companyId, goodsDomain, limit); if (error) return [];
  return (data ?? []).map((row: any) => ({ supplierId: row.supplier_id, supplierName: row.supplier_name, loyaltyScore: row.loyalty_score, level: levelFor(row.loyalty_score) }));
}

export const BUY_GOODS_RELATIONSHIP_POINTS_PER_CURRENCY = 0.25;

export function getBuyGoodsRelationshipPointsForPurchase(purchaseValue: number): number {
  return Math.max(0, Math.round(purchaseValue * BUY_GOODS_RELATIONSHIP_POINTS_PER_CURRENCY));
}

export function getBuyGoodsRelationshipYearlyCap(companyValue: number): number {
  return Math.round(2600 * Math.min(1.7, Math.max(1, 1 + Math.max(0, Math.log10(Math.max(50_000, companyValue)) - 4.7) * .22)));
}

export interface BuyGoodsSupplierTrustPreview {
  rawPoints: number;
  appliedPoints: number;
  cappedPoints: number;
  yearlyCap: number;
}

export function getBuyGoodsSupplierTrustPreview(
  relationship: Pick<BuyGoodsSupplierRelationship, 'yearGuardYear' | 'yearRelationshipPoints'> | null | undefined,
  purchaseValue: number,
  companyValue: number,
  currentYear: number,
): BuyGoodsSupplierTrustPreview {
  const yearlyCap = getBuyGoodsRelationshipYearlyCap(companyValue);
  const yearPoints = relationship?.yearGuardYear === currentYear ? relationship.yearRelationshipPoints : 0;
  const rawPoints = getBuyGoodsRelationshipPointsForPurchase(purchaseValue);
  const appliedPoints = Math.min(rawPoints, Math.max(0, yearlyCap - yearPoints));
  return { rawPoints, appliedPoints, cappedPoints: Math.max(0, rawPoints - appliedPoints), yearlyCap };
}

export async function recordBuyGoodsSupplierPurchase(goodsDomain: BuyMarketWareGroup, supplierId: string, supplierName: string, unitsPurchased: number, purchaseValue: number): Promise<BuyGoodsSupplierRelationship | null> {
  const companyId = getCurrentCompanyId(); if (!companyId) return null;
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const currentYear = getGameState().currentYear ?? 2024;
  const yearlyCap = getBuyGoodsRelationshipYearlyCap(companyValue);
  const { data, error } = await recordBuyGoodsSupplierRelationshipPurchase({ companyId, goodsDomain, supplierId, supplierName, unitsPurchased, points: getBuyGoodsRelationshipPointsForPurchase(purchaseValue), currentYear, yearlyCap });
  return error || !data ? null : mapRow(data);
}
