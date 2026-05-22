import { WineBatch } from '../../types/types';
import { NotificationCategory } from '../../types/types';
import { calculateWineScore } from '../wine/winescore/wineScoreCalculation';
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { addTransaction } from '../finance/financeService';
import { getWineBatchById, deleteWineBatch, updateWineBatch } from '../../database/activities/inventoryDB';
import { triggerTopicUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { getGameState } from '../core/gameState';
import { getCooperativeMembership, recordCooperativeSale, getCooperativeFloorPrice } from './cooperativeService';
import { recordBuyerSale } from '@/lib/services';
import { getBulkBuyer, getSeasonalBuyers, recordMarketBuyerSale } from './grapeBuyerMarketService';
import { GrapeVariety } from '../../types/types';

// ===== CONSTANTS =====

export const BASE_GRAPE_PRICE_PER_KG = 3.0;
export const GRAPE_SALE_PRESTIGE_MAX_BONUS = 0.3; // max +30% from prestige (vs wine's +250%)
export const FAVORITE_GRAPE_PRIMARY_BONUS = 0.18;
export const FAVORITE_GRAPE_SECONDARY_BONUS = 0.1;

// ===== TYPES =====

export interface GrapeBuyer {
  id: string;
  name: string;
  description: string;
  priceMultiplier: number;
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
}

export interface GrapeSalePricing {
  wineScore: number;
  qualityMultiplier: number;
  prestigeBonus: number;
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

  const relationshipMultiplier = buyer.relationshipMultiplier ?? 1;
  const favoriteGrapeBonusMultiplier = getFavoriteGrapeBonusMultiplier(buyer, batch);
  const effectiveBuyerMultiplier = buyer.priceMultiplier * (1 + favoriteGrapeBonusMultiplier);

  const rawPricePerKg = BASE_GRAPE_PRICE_PER_KG * qualityMultiplier * prestigeBonus * effectiveBuyerMultiplier * relationshipMultiplier;
  const effectiveFloorPrice = floorPriceOverride !== undefined ? floorPriceOverride : buyer.floorPricePerKg;
  const appliedFloor = rawPricePerKg < effectiveFloorPrice;
  const finalPricePerKg = Math.max(rawPricePerKg, effectiveFloorPrice);
  const quantityKg = Math.max(1, Math.min(batch.quantity, Math.round(quantityKgOverride ?? batch.quantity)));

  return {
    wineScore,
    qualityMultiplier,
    prestigeBonus,
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
  const batch = await getWineBatchById(batchId);
  if (!batch) return { success: false, revenue: 0, error: 'Batch not found' };
  if (batch.state !== 'grapes') return { success: false, revenue: 0, error: 'Batch is not in grape state' };
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

  // Remove sold grapes from inventory, preserving the remainder when partially sold.
  const remainingQuantity = batch.quantity - quantityKg;
  const inventoryUpdated = remainingQuantity > 0
    ? await updateWineBatch(batchId, { quantity: remainingQuantity })
    : await deleteWineBatch(batchId);
  if (!inventoryUpdated) return { success: false, revenue: 0, error: 'Failed to update grape inventory' };

  // Record the transaction
  await addTransaction(
    pricing.totalRevenue,
    `Grape Sale: ${quantityKg} kg ${batch.grape} → ${buyer.name} (${pricing.buyerMultiplier.toFixed(2)}x multiplier, ${pricing.relationshipMultiplier.toFixed(2)}x relationship)`,
    TRANSACTION_CATEGORIES.GRAPE_SALES,
    false
  );

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

  // Notify player
  await notificationService.addMessage(
    `Sold ${quantityKg} kg of ${batch.grape} to ${buyer.name} for €${pricing.totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    'sellGrapesService.sellGrapes',
    'Grape Sale',
    NotificationCategory.WINEMAKING_PROCESS
  );

  triggerTopicUpdate('wine_batches');

  return { success: true, revenue: pricing.totalRevenue };
}
