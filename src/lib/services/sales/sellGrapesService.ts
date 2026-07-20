import { EconomyPhase, Season, WeatherIntensity, WeatherState, WineBatch, type WineBatchState } from '../../types/types';
import { NotificationCategory } from '../../types/types';
import { calculateWineScore } from '../wine/winescore/wineScoreCalculation';
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { syncPersistedTransaction } from '../finance/financeService';
import { getInventoryBatchById } from '../wine/winery/inventoryService';
import { sellStorageBackedWineBatch } from '@/lib/database/activities/inventoryDB';
import { listGrapeBatchOnGlobalMarket } from '@/lib/database/market/globalGrapeMarketListingsDB';
import { getGlobalGrapeMarketBaseValue, getGlobalGrapeMarketSellbackPayout } from '@/lib/services/market/grapes/globalGrapeMarketService';
import { companyFeature } from '@/lib/features/company';
import { triggerTopicUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { getGameState } from '../core/gameState';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import {
  BASE_GRAPE_PRICE_PER_KG,
  FAVORITE_GRAPE_PRIMARY_BONUS,
  FAVORITE_GRAPE_SECONDARY_BONUS,
  GRAPE_SALE_FIXED_MARKET_PENALTY,
  GRAPE_SALE_PRESTIGE_MAX_BONUS,
  SELLABLE_BATCH_STATES,
  SELL_STATE_PRICE_MULTIPLIERS
} from '@/lib/constants';
import { getCooperativeMembership, recordCooperativeSale, getCooperativeFloorPrice } from './cooperativeService';
import { recordBuyerSale } from '@/lib/services';
import { getBulkBuyer, getSeasonalBuyers, recordMarketBuyerSale } from './grapeBuyerMarketService';
import { GrapeVariety } from '../../types/types';
import { formatNumber } from '../../utils/utils';

export { getGlobalGrapeMarketSellbackPayout } from '@/lib/services/market/grapes/globalGrapeMarketService';

// ===== TYPES =====

export interface GrapeBuyer {
  id: string;
  name: string;
  description: string;
  priceMultiplier: number;
  marketContextMultiplier?: number;
  marketSensitivityMultiplier?: number;
  floorPricePerKg: number;
  exclusiveCountry?: string;
  specialMechanic?: string;
  multiplierRangeMin?: number;
  multiplierRangeMax?: number;
  baseSeasonLimitKg?: number;
  effectiveSeasonLimitKg?: number;
  soldThisSeasonKg?: number;
  remainingSeasonLimitKg?: number;
  relationshipMultiplier?: number;
  favoriteGrapes?: GrapeVariety[];
  buyerCategory?: 'bulk' | 'seasonal' | 'cooperative';
  originTag?: 'Relationship carry-over' | 'Seasonal rotation' | 'Country special';
  originReason?: string;
  dealStyle?: 'spot' | 'quality_bonus' | 'volume_bonus' | 'relationship_bonus';
  demandFactors?: {
    volatilitySeason?: Season;
    volatilityEconomyPhase?: EconomyPhase;
    volatilityWeatherState?: WeatherState;
    volatilityWeatherIntensity?: WeatherIntensity;
    seasonPriceMultiplier: number;
    seasonLimitMultiplier: number;
    economyPriceMultiplier: number;
    economyLimitMultiplier: number;
    yearCyclePriceMultiplier: number;
    yearCycleLimitMultiplier: number;
    volatilityPriceMultiplier: number;
    volatilityLimitMultiplier: number;
    volatilitySeasonPressureMultiplier?: number;
    volatilityEconomyPressureMultiplier?: number;
    volatilityWeatherPricePressureMultiplier?: number;
    volatilityWeatherLimitPressureMultiplier?: number;
    volatilitySentimentPriceMultiplier?: number;
    volatilitySentimentLimitMultiplier?: number;
    volatilityBuyerPriceSensitivityMultiplier?: number;
    volatilityBuyerLimitSensitivityMultiplier?: number;
    volatilityBuyerSensitivityReason?: string;
    volatilityWeatherReason?: string;
    volatilityPriceReason?: string;
    volatilityLimitReason?: string;
  };
}

export interface GrapeSalePricing {
  wineScore: number;
  qualityMultiplier: number;
  prestigeBonus: number;
  stateMultiplier: number;
  marketContextMultiplier: number;
  marketSensitivityMultiplier: number;
  marketPenaltyMultiplier: number;
  buyerMultiplier: number;
  relationshipMultiplier: number;
  favoriteGrapeBonusMultiplier: number;
  rawPricePerKg: number;
  effectiveFloorPrice: number; // the actual floor used (membership-aware for coop)
  appliedFloor: boolean;
  finalPricePerKg: number;
  totalRevenue: number;
  quantityKg: number;
}

/**
 * A relative, UI-safe indication of how strongly current market conditions
 * affect a buyer. It is deliberately only for comparing offers, not pricing.
 */
export function getGrapeBuyerMarketIndex(buyer?: GrapeBuyer): number {
  if (!buyer?.demandFactors) return 2;

  const factors = buyer.demandFactors;
  const demandPressure = factors.seasonPriceMultiplier
    * factors.economyPriceMultiplier
    * factors.yearCyclePriceMultiplier
    * factors.volatilityPriceMultiplier
    * (factors.volatilityBuyerPriceSensitivityMultiplier ?? 1);
  const volatilityRisk = factors.volatilityPriceMultiplier
    * (factors.volatilityBuyerPriceSensitivityMultiplier ?? 1);

  return demandPressure + volatilityRisk;
}

function getFavoriteGrapeBonusMultiplier(buyer: GrapeBuyer, batch: WineBatch): number {
  const favorites = buyer.favoriteGrapes || [];
  if (favorites.length === 0) return 0;
  if (favorites[0] === batch.grape) return FAVORITE_GRAPE_PRIMARY_BONUS;
  if (favorites[1] === batch.grape) return FAVORITE_GRAPE_SECONDARY_BONUS;
  return 0;
}

// ===== BUYER REGISTRY =====

const BULK_FALLBACK_BUYER: GrapeBuyer = {
  id: 'bulk_buyer',
  name: 'Bulk Grape Merchant',
  description: 'A generic merchant buying grapes for blended bulk production. Available everywhere, no minimums.',
  priceMultiplier: 1.0,
  marketSensitivityMultiplier: 1.0,
  floorPricePerKg: 0,
  buyerCategory: 'bulk',
  originTag: 'Country special',
  originReason: 'Always available fallback buyer for immediate liquidity.',
  dealStyle: 'spot',
};

export async function getAvailableBuyers(startingCountry?: string): Promise<GrapeBuyer[]> {
  const seasonalBuyers = await getSeasonalBuyers(startingCountry);
  const bulkBuyer = await getBulkBuyer(startingCountry) || BULK_FALLBACK_BUYER;
  return [bulkBuyer, ...seasonalBuyers];
}

// ===== PRICING =====

export function calculateGrapeSalePrice(
  batch: WineBatch,
  buyer: GrapeBuyer,
  companyPrestige: number,
  floorPriceOverride?: number, // pass membership floor for cooperative
  quantityKgOverride?: number
): GrapeSalePricing {
  const wineScore = calculateWineScore(batch);
  const qualityMultiplier = wineScore * calculateAsymmetricalMultiplier(wineScore);

  const normalizedPrestige = NormalizeScrewed1000To01WithTail(companyPrestige);
  const prestigeBonus = 1 + normalizedPrestige * GRAPE_SALE_PRESTIGE_MAX_BONUS;
  const stateMultiplier = SELL_STATE_PRICE_MULTIPLIERS[batch.state as Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>] ?? 1;
  const marketPenaltyMultiplier = GRAPE_SALE_FIXED_MARKET_PENALTY;
  const marketContextMultiplier = buyer.marketContextMultiplier ?? 1;
  const marketSensitivityMultiplier = buyer.marketSensitivityMultiplier ?? 1;

  const relationshipMultiplier = buyer.relationshipMultiplier ?? 1;
  const favoriteGrapeBonusMultiplier = getFavoriteGrapeBonusMultiplier(buyer, batch);
  const effectiveBuyerMultiplier = buyer.priceMultiplier * (1 + favoriteGrapeBonusMultiplier);

  const rawPricePerKg = BASE_GRAPE_PRICE_PER_KG * qualityMultiplier * prestigeBonus * stateMultiplier * marketContextMultiplier * marketSensitivityMultiplier * marketPenaltyMultiplier * effectiveBuyerMultiplier * relationshipMultiplier;
  const effectiveFloorPrice = floorPriceOverride !== undefined ? floorPriceOverride : buyer.floorPricePerKg;
  const appliedFloor = rawPricePerKg < effectiveFloorPrice;
  const finalPricePerKg = Math.max(rawPricePerKg, effectiveFloorPrice);
  const quantityKg = Math.max(1, Math.min(batch.quantity, Math.round(quantityKgOverride ?? batch.quantity)));

  return {
    wineScore,
    qualityMultiplier,
    prestigeBonus,
    stateMultiplier,
    marketContextMultiplier,
    marketSensitivityMultiplier,
    marketPenaltyMultiplier,
    buyerMultiplier: effectiveBuyerMultiplier,
    relationshipMultiplier,
    favoriteGrapeBonusMultiplier,
    rawPricePerKg,
    effectiveFloorPrice,
    appliedFloor,
    finalPricePerKg,
    totalRevenue: Math.round(finalPricePerKg * quantityKg * 100) / 100,
    quantityKg,
  };
}

// ===== SELL ACTION =====

export async function sellGrapes(
  batchId: string,
  buyer: GrapeBuyer,
  quantityKgOverride?: number
): Promise<{ success: boolean; revenue: number; error?: string }> {
  const batch = await getInventoryBatchById(batchId);
  if (!batch) return { success: false, revenue: 0, error: 'Batch not found' };
  if (!SELLABLE_BATCH_STATES.includes(batch.state as Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>)) {
    return { success: false, revenue: 0, error: 'Batch is not in a sellable state' };
  }
  if (batch.quantity <= 0) return { success: false, revenue: 0, error: 'No grapes to sell' };
  const quantityKg = Math.max(1, Math.min(batch.quantity, Math.round(quantityKgOverride ?? batch.quantity)));

  const gameState = getGameState();
  const prestige = gameState.prestige ?? 0;
  const currentYear = gameState.currentYear ?? 1;

  // Enforce buyer-specific seasonal hard cap before pricing.
  if (buyer.effectiveSeasonLimitKg !== undefined) {
    const soldThisSeason = buyer.soldThisSeasonKg ?? 0;
    const remainingCap = Math.max(0, buyer.effectiveSeasonLimitKg - soldThisSeason);
    if (remainingCap <= 0) {
      return {
        success: false,
        revenue: 0,
        error: `${buyer.name} has reached their seasonal capacity. Try another buyer or wait for next season.`
      };
    }
    if (quantityKg > remainingCap) {
      return {
        success: false,
        revenue: 0,
        error: `Requested quantity exceeds ${buyer.name}'s remaining seasonal limit (${remainingCap.toLocaleString()} kg).`
      };
    }
  }

  // For the cooperative, resolve the current membership floor price before pricing
  let floorPriceOverride: number | undefined;
  if (buyer.id === 'winzergenossenschaft') {
    const membership = await getCooperativeMembership();
    const currentLevel = membership?.level ?? 0;
    const loyaltyFloor = buyer.floorPricePerKg ?? 0;
    floorPriceOverride = Math.max(getCooperativeFloorPrice(currentLevel as 0 | 1 | 2 | 3), loyaltyFloor);
  }

  const pricing = calculateGrapeSalePrice(batch, buyer, prestige, floorPriceOverride, quantityKg);

  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, revenue: 0, error: 'No active company selected' };
  const description = `Grape Sale: ${quantityKg} kg ${batch.grape} → ${buyer.name} (${pricing.buyerMultiplier.toFixed(2)}x multiplier, ${pricing.relationshipMultiplier.toFixed(2)}x relationship)`;
  const sale = await sellStorageBackedWineBatch({
    companyId,
    batchId,
    quantity: quantityKg,
    amount: pricing.totalRevenue,
    description,
    category: TRANSACTION_CATEGORIES.GRAPE_SALES,
    week: gameState.week ?? 1,
    season: gameState.season ?? 'Spring',
    year: currentYear,
  });
  if (sale.error || !sale.data) return { success: false, revenue: 0, error: 'Failed to complete grape sale' };
  await syncPersistedTransaction(sale.data);

  // Update cooperative membership (after money is recorded, fire-and-forget on error)
  if (buyer.id === 'winzergenossenschaft') {
    try {
      await recordCooperativeSale(quantityKg, currentYear);
    } catch (err) {
      console.error('Failed to record cooperative membership sale:', err);
    }
  }

  try {
    await recordMarketBuyerSale(buyer.id, quantityKg, currentYear, gameState.season ?? 'Spring');
  } catch (err) {
    console.error('Failed to record market buyer seasonal sale:', err);
  }

  // Update per-buyer loyalty for all grape buyers.
  try {
    await recordBuyerSale(buyer.id, quantityKg, currentYear);
  } catch (err) {
    console.error('Failed to record buyer loyalty sale:', err);
  }

  try {
    await notificationService.addMessage(
      `Sold ${quantityKg} kg of ${batch.grape} to ${buyer.name} for ${formatNumber(pricing.totalRevenue, { currency: true, decimals: 0 })}`,
      'sellGrapesService.sellGrapes',
      'Grape Sale',
      NotificationCategory.WINEMAKING_PROCESS
    );
  } catch (error) {
    console.warn('Grape sale completed without notification:', error);
  }

  triggerTopicUpdate('wine_batches');

  return { success: true, revenue: pricing.totalRevenue };
}

/**
 * Lists a sellable lot in the shared global market. The market pays 70% now,
 * then holds the lot in NPC custody while preserving this company as seller.
 */
export async function listGrapesOnGlobalMarket(
  batchId: string,
  quantityKgOverride?: number,
): Promise<{ success: boolean; payout: number; error?: string }> {
  const batch = await getInventoryBatchById(batchId);
  if (!batch) return { success: false, payout: 0, error: 'Batch not found.' };
  if (!SELLABLE_BATCH_STATES.includes(batch.state as Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>)) {
    return { success: false, payout: 0, error: 'Batch is not in a sellable state.' };
  }
  const quantityKg = Math.max(1, Math.min(batch.quantity, Math.round(quantityKgOverride ?? batch.quantity)));
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, payout: 0, error: 'No active company selected.' };
  const company = await companyFeature.records.get(companyId).catch(() => null);
  const state = getGameState();
  const snapshot: WineBatch = {
    ...batch,
    quantity: quantityKg,
    volumeLitres: batch.volumeLitres === undefined ? undefined : Number((batch.volumeLitres * quantityKg / batch.quantity).toFixed(3)),
  };
  const basePricePerKg = getGlobalGrapeMarketBaseValue(snapshot);
  const payout = getGlobalGrapeMarketSellbackPayout(snapshot, quantityKg);
  const listed = await listGrapeBatchOnGlobalMarket({
    companyId,
    companyName: company?.name ?? 'Winery',
    batchId,
    quantityKg,
    payout,
    batchSnapshot: snapshot,
    basePricePerKg,
    qualityScore: Math.max(0.16, Math.min(1, (batch.structureIndex + batch.tasteQualityIndex) / 2)),
    week: state.week ?? 1,
    season: (state.season ?? 'Spring') as Season,
    year: state.currentYear ?? 1,
  });
  if (listed.error || !listed.data?.transaction) return { success: false, payout: 0, error: 'Could not list this lot on the global market.' };
  await syncPersistedTransaction(listed.data.transaction);
  triggerTopicUpdate('wine_batches');
  triggerTopicUpdate('buy_grape_market');
  return { success: true, payout };
}
