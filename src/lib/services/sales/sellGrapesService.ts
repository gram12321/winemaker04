import { WineBatch } from '../../types/types';
import { NotificationCategory } from '../../types/types';
import { calculateWineScore } from '../wine/winescore/wineScoreCalculation';
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { addTransaction } from '../finance/financeService';
import { getWineBatchById, deleteWineBatch } from '../../database/activities/inventoryDB';
import { triggerTopicUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { getGameState } from '../core/gameState';
import { getCooperativeMembership, recordCooperativeSale, getCooperativeFloorPrice } from './cooperativeService';

// ===== CONSTANTS =====

export const BASE_GRAPE_PRICE_PER_KG = 3.0;
export const GRAPE_SALE_PRESTIGE_MAX_BONUS = 0.3; // max +30% from prestige (vs wine's +250%)

// ===== TYPES =====

export interface GrapeBuyer {
  id: string;
  name: string;
  description: string;
  priceMultiplier: number;
  floorPricePerKg: number;
  exclusiveCountry?: string;
  specialMechanic?: string;
}

export interface GrapeSalePricing {
  wineScore: number;
  qualityMultiplier: number;
  prestigeBonus: number;
  buyerMultiplier: number;
  rawPricePerKg: number;
  effectiveFloorPrice: number; // the actual floor used (membership-aware for coop)
  appliedFloor: boolean;
  finalPricePerKg: number;
  totalRevenue: number;
  quantityKg: number;
}

// ===== BUYER REGISTRY =====

const ALL_BUYERS: GrapeBuyer[] = [
  {
    id: 'bulk_buyer',
    name: 'Bulk Wine Merchant',
    description: 'A generic merchant buying grapes for blended bulk production. Available everywhere, no minimums.',
    priceMultiplier: 1.0,
    floorPricePerKg: 0,
  },
  {
    id: 'negociant',
    name: 'Négociant',
    description: 'A French wine merchant who buys grapes from small producers to blend and bottle under their own label. Pays a premium for quality.',
    priceMultiplier: 1.2,
    floorPricePerKg: 0,
    exclusiveCountry: 'France',
  },
  {
    id: 'cantina_sociale',
    name: 'Cantina Sociale',
    description: 'Italian cooperative winery that produces wines for the local and regional market. Members benefit from collective bargaining.',
    priceMultiplier: 1.2,
    floorPricePerKg: 0,
    exclusiveCountry: 'Italy',
  },
  {
    id: 'bodega_cooperativa',
    name: 'Bodega Cooperativa',
    description: 'Spanish wine cooperative that processes grapes from small local growers. Reliable buyer with fair prices.',
    priceMultiplier: 1.15,
    floorPricePerKg: 0,
    exclusiveCountry: 'Spain',
  },
  {
    id: 'winzergenossenschaft',
    name: 'Winzergenossenschaft',
    description: 'German wine cooperative with guaranteed floor prices. Build your membership over years to unlock better floor prices and shared equipment benefits.',
    priceMultiplier: 1.5,
    floorPricePerKg: 0.80, // Level 1 base — overridden by membership level at runtime
    exclusiveCountry: 'Germany',
    specialMechanic: 'Cooperative Member: Sell grapes every year to build your membership standing and unlock better floor prices and vineyard support.',
  },
];

export function getAvailableBuyers(startingCountry?: string): GrapeBuyer[] {
  return ALL_BUYERS.filter(
    buyer => !buyer.exclusiveCountry || buyer.exclusiveCountry === startingCountry
  );
}

// ===== PRICING =====

export function calculateGrapeSalePrice(
  batch: WineBatch,
  buyer: GrapeBuyer,
  companyPrestige: number,
  floorPriceOverride?: number // pass membership floor for cooperative
): GrapeSalePricing {
  const wineScore = calculateWineScore(batch);
  const qualityMultiplier = wineScore * calculateAsymmetricalMultiplier(wineScore);

  const normalizedPrestige = NormalizeScrewed1000To01WithTail(companyPrestige);
  const prestigeBonus = 1 + normalizedPrestige * GRAPE_SALE_PRESTIGE_MAX_BONUS;

  const rawPricePerKg = BASE_GRAPE_PRICE_PER_KG * qualityMultiplier * prestigeBonus * buyer.priceMultiplier;
  const effectiveFloorPrice = floorPriceOverride !== undefined ? floorPriceOverride : buyer.floorPricePerKg;
  const appliedFloor = rawPricePerKg < effectiveFloorPrice;
  const finalPricePerKg = Math.max(rawPricePerKg, effectiveFloorPrice);
  const quantityKg = batch.quantity;

  return {
    wineScore,
    qualityMultiplier,
    prestigeBonus,
    buyerMultiplier: buyer.priceMultiplier,
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
  buyer: GrapeBuyer
): Promise<{ success: boolean; revenue: number; error?: string }> {
  const batch = await getWineBatchById(batchId);
  if (!batch) return { success: false, revenue: 0, error: 'Batch not found' };
  if (batch.state !== 'grapes') return { success: false, revenue: 0, error: 'Batch is not in grape state' };
  if (batch.quantity <= 0) return { success: false, revenue: 0, error: 'No grapes to sell' };

  const gameState = getGameState();
  const prestige = gameState.prestige ?? 0;
  const currentYear = gameState.currentYear ?? 1;

  // For the cooperative, resolve the current membership floor price before pricing
  let floorPriceOverride: number | undefined;
  if (buyer.id === 'winzergenossenschaft') {
    const membership = await getCooperativeMembership();
    const currentLevel = membership?.level ?? 0;
    floorPriceOverride = getCooperativeFloorPrice(currentLevel as 0 | 1 | 2 | 3);
  }

  const pricing = calculateGrapeSalePrice(batch, buyer, prestige, floorPriceOverride);

  // Remove grapes from inventory
  const deleted = await deleteWineBatch(batchId);
  if (!deleted) return { success: false, revenue: 0, error: 'Failed to remove grapes from inventory' };

  // Record the transaction
  await addTransaction(
    pricing.totalRevenue,
    `Grape Sale: ${batch.quantity} kg ${batch.grape} → ${buyer.name}`,
    TRANSACTION_CATEGORIES.GRAPE_SALES,
    false
  );

  // Update cooperative membership (after money is recorded, fire-and-forget on error)
  if (buyer.id === 'winzergenossenschaft') {
    try {
      await recordCooperativeSale(batch.quantity, currentYear);
    } catch (err) {
      console.error('Failed to record cooperative membership sale:', err);
    }
  }

  // Notify player
  await notificationService.addMessage(
    `Sold ${batch.quantity} kg of ${batch.grape} to ${buyer.name} for €${pricing.totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    'sellGrapesService.sellGrapes',
    'Grape Sale',
    NotificationCategory.WINEMAKING_PROCESS
  );

  triggerTopicUpdate('wine_batches');

  return { success: true, revenue: pricing.totalRevenue };
}
