import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import {
  getBuyGoodsSupplierRelationshipRow,
  getBuyGoodsSupplierRelationshipRows,
  getBuyGoodsSupplierPriorityRows,
  upsertBuyGoodsSupplierRelationshipRow,
} from '@/lib/database/market/buyGoodsSupplierRelationshipsDB';
import type { BuyMarketWareGroup } from '@/lib/types/market';

export type BuyGoodsSupplierRelationshipLevel = 0 | 1 | 2 | 3 | 4 | 5;
export interface BuyGoodsSupplierRelationship { companyId: string; goodsDomain: BuyMarketWareGroup; supplierId: string; supplierName: string; totalPurchases: number; totalUnitsPurchased: number; loyaltyScore: number; level: BuyGoodsSupplierRelationshipLevel; lastPurchaseYear: number | null; }

const LEVELS: Record<BuyGoodsSupplierRelationshipLevel, { minimum: number; priceMultiplier: number; persistenceBonus: number }> = {
  0: { minimum: 0, priceMultiplier: 1, persistenceBonus: 0 }, 1: { minimum: 700, priceMultiplier: .99, persistenceBonus: .05 }, 2: { minimum: 2000, priceMultiplier: .98, persistenceBonus: .1 }, 3: { minimum: 4600, priceMultiplier: .97, persistenceBonus: .15 }, 4: { minimum: 8500, priceMultiplier: .95, persistenceBonus: .22 }, 5: { minimum: 14000, priceMultiplier: .93, persistenceBonus: .3 },
};
function levelFor(score: number): BuyGoodsSupplierRelationshipLevel { return ([5, 4, 3, 2, 1, 0] as const).find((level) => score >= LEVELS[level].minimum) ?? 0; }
function mapRow(row: any): BuyGoodsSupplierRelationship { return { companyId: row.company_id, goodsDomain: row.goods_domain, supplierId: row.supplier_id, supplierName: row.supplier_name, totalPurchases: row.total_purchases, totalUnitsPurchased: row.total_units_purchased, loyaltyScore: row.loyalty_score, level: levelFor(row.loyalty_score), lastPurchaseYear: row.last_purchase_year }; }

export function getBuyGoodsSupplierRelationshipPriceMultiplier(level: BuyGoodsSupplierRelationshipLevel): number { return LEVELS[level].priceMultiplier; }
export function getBuyGoodsSupplierPersistenceBonus(level: BuyGoodsSupplierRelationshipLevel): number { return LEVELS[level].persistenceBonus; }

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

export async function recordBuyGoodsSupplierPurchase(goodsDomain: BuyMarketWareGroup, supplierId: string, supplierName: string, unitsPurchased: number, purchaseValue: number): Promise<BuyGoodsSupplierRelationship | null> {
  const companyId = getCurrentCompanyId(); if (!companyId) return null;
  const existingResult = await getBuyGoodsSupplierRelationshipRow(companyId, goodsDomain, supplierId);
  const existing = existingResult.data ? mapRow(existingResult.data) : null;
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const currentYear = getGameState().currentYear ?? 2024;
  const yearlyCap = Math.round(2600 * Math.min(1.7, Math.max(1, 1 + Math.max(0, Math.log10(Math.max(50_000, companyValue)) - 4.7) * .22)));
  const priorYearPoints = existing?.lastPurchaseYear === currentYear ? existing.loyaltyScore : 0;
  const gained = Math.min(getBuyGoodsRelationshipPointsForPurchase(purchaseValue), Math.max(0, yearlyCap - priorYearPoints));
  const loyaltyScore = (existing?.loyaltyScore ?? 0) + gained;
  const row = { company_id: companyId, goods_domain: goodsDomain, supplier_id: supplierId, supplier_name: supplierName, total_purchases: (existing?.totalPurchases ?? 0) + 1, total_units_purchased: (existing?.totalUnitsPurchased ?? 0) + unitsPurchased, loyalty_score: loyaltyScore, last_purchase_year: currentYear, level: levelFor(loyaltyScore), updated_at: new Date().toISOString() };
  const { data, error } = await upsertBuyGoodsSupplierRelationshipRow(row); return error || !data ? null : mapRow(data);
}
