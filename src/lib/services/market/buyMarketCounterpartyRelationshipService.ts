import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import {
  BUY_MARKET_COUNTERPARTY_LEVELS,
  BUY_MARKET_RELATIONSHIP_POINTS_PER_CURRENCY,
  BUY_MARKET_RELATIONSHIP_YEARLY_CAP_BASE,
  BUY_MARKET_RELATIONSHIP_YEARLY_CAP_MAX_MULTIPLIER,
  BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_FLOOR,
  BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_LOG_OFFSET,
  BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_SCALE,
  GAME_INITIALIZATION,
  type BuyMarketCounterpartyRelationshipLevel,
} from '@/lib/constants';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import {
  getBuyMarketCounterpartyPriorityRows,
  getBuyMarketCounterpartyRelationshipRows,
  recordBuyMarketCounterpartyPurchase,
} from '@/lib/database/market/buyMarketCounterpartyRelationshipsDB';
import type { BuyMarketOfferSeller } from '@/lib/types/market';

export type { BuyMarketCounterpartyLevelConfig, BuyMarketCounterpartyRelationshipLevel } from '@/lib/constants';
export { BUY_MARKET_COUNTERPARTY_LEVELS } from '@/lib/constants';
export type BuyMarketCounterparty = BuyMarketOfferSeller;
export interface BuyMarketCounterpartyRelationship { buyerCompanyId: string; counterpartyKind: BuyMarketCounterparty['kind']; counterpartyId: string; counterpartyName: string; totalPurchases: number; totalUnitsPurchased: number; loyaltyScore: number; level: BuyMarketCounterpartyRelationshipLevel; lastPurchaseYear: number | null; consecutiveYears: number; yearUnitsPurchased: number; yearRelationshipPoints: number; yearGuardYear: number | null; }

export function getBuyMarketCounterpartyKey(counterparty: Pick<BuyMarketCounterparty, 'kind' | 'id'>): string { return `${counterparty.kind}:${counterparty.id}`; }
function levelFor(score: number): BuyMarketCounterpartyRelationshipLevel { return ([5, 4, 3, 2, 1, 0] as const).find((level) => score >= BUY_MARKET_COUNTERPARTY_LEVELS[level].minLoyaltyScore) ?? 0; }
function mapRow(row: any): BuyMarketCounterpartyRelationship { return { buyerCompanyId: row.buyer_company_id, counterpartyKind: row.counterparty_kind, counterpartyId: row.counterparty_id, counterpartyName: row.counterparty_name, totalPurchases: row.total_purchases, totalUnitsPurchased: row.total_units_purchased, loyaltyScore: row.loyalty_score, level: levelFor(row.loyalty_score), lastPurchaseYear: row.last_purchase_year, consecutiveYears: row.consecutive_years ?? 0, yearUnitsPurchased: row.year_units_purchased ?? 0, yearRelationshipPoints: row.year_relationship_points ?? 0, yearGuardYear: row.year_guard_year ?? null }; }

export function getBuyMarketCounterpartyPriceMultiplier(level: BuyMarketCounterpartyRelationshipLevel): number { return BUY_MARKET_COUNTERPARTY_LEVELS[level].priceMultiplier; }
export function getBuyMarketCounterpartyPersistenceBonus(level: BuyMarketCounterpartyRelationshipLevel): number { return BUY_MARKET_COUNTERPARTY_LEVELS[level].persistenceBonus; }

export async function getBuyMarketCounterpartyRelationships(counterparties: BuyMarketCounterparty[]): Promise<Record<string, BuyMarketCounterpartyRelationship>> {
  const buyerCompanyId = getCurrentCompanyId(); if (!buyerCompanyId || counterparties.length === 0) return {};
  const { data, error } = await getBuyMarketCounterpartyRelationshipRows(buyerCompanyId, counterparties); if (error) return {};
  return Object.fromEntries((data ?? []).map((row: any) => { const relation = mapRow(row); return [getBuyMarketCounterpartyKey({ kind: relation.counterpartyKind, id: relation.counterpartyId }), relation]; }));
}

export async function getBuyMarketCounterpartyPriorityProfiles(counterpartyKind: BuyMarketCounterparty['kind'], limit = 12) {
  const buyerCompanyId = getCurrentCompanyId(); if (!buyerCompanyId) return [];
  const { data, error } = await getBuyMarketCounterpartyPriorityRows(buyerCompanyId, counterpartyKind, limit); if (error) return [];
  return (data ?? []).map((row: any) => ({ counterpartyId: row.counterparty_id, counterpartyName: row.counterparty_name, loyaltyScore: row.loyalty_score, level: levelFor(row.loyalty_score) }));
}

export function getBuyMarketRelationshipPointsForPurchase(purchaseValue: number): number { return Math.max(0, Math.round(purchaseValue * BUY_MARKET_RELATIONSHIP_POINTS_PER_CURRENCY)); }
export function getBuyMarketRelationshipYearlyCap(companyValue: number): number { return Math.round(BUY_MARKET_RELATIONSHIP_YEARLY_CAP_BASE * Math.min(BUY_MARKET_RELATIONSHIP_YEARLY_CAP_MAX_MULTIPLIER, Math.max(1, 1 + Math.max(0, Math.log10(Math.max(BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_FLOOR, companyValue)) - BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_LOG_OFFSET) * BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_SCALE))); }
export interface BuyMarketRelationshipPreview { rawPoints: number; appliedPoints: number; cappedPoints: number; yearlyCap: number; }
export function getBuyMarketRelationshipPreview(relationship: Pick<BuyMarketCounterpartyRelationship, 'yearGuardYear' | 'yearRelationshipPoints'> | null | undefined, purchaseValue: number, companyValue: number, currentYear: number): BuyMarketRelationshipPreview {
  const yearlyCap = getBuyMarketRelationshipYearlyCap(companyValue);
  const yearPoints = relationship?.yearGuardYear === currentYear ? relationship.yearRelationshipPoints : 0;
  const rawPoints = getBuyMarketRelationshipPointsForPurchase(purchaseValue);
  const appliedPoints = Math.min(rawPoints, Math.max(0, yearlyCap - yearPoints));
  return { rawPoints, appliedPoints, cappedPoints: Math.max(0, rawPoints - appliedPoints), yearlyCap };
}
export async function recordBuyMarketCounterpartyPurchaseForActiveCompany(counterparty: BuyMarketCounterparty, unitsPurchased: number, purchaseValue: number): Promise<BuyMarketCounterpartyRelationship | null> {
  const buyerCompanyId = getCurrentCompanyId(); if (!buyerCompanyId) return null;
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const currentYear = getGameState().currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;
  const { data, error } = await recordBuyMarketCounterpartyPurchase({ buyerCompanyId, counterpartyKind: counterparty.kind, counterpartyId: counterparty.id, counterpartyName: counterparty.name, unitsPurchased, points: getBuyMarketRelationshipPointsForPurchase(purchaseValue), currentYear, yearlyCap: getBuyMarketRelationshipYearlyCap(companyValue) });
  return error || !data ? null : mapRow(data);
}
