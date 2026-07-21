import {
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
  BUYER_SEASON_PRICE_MULTIPLIERS,
  GAME_INITIALIZATION,
  GLOBAL_GRAPE_MARKET_BASE_PRICE_PER_KG,
  GLOBAL_GRAPE_MARKET_QUALITY_FLOOR,
  GLOBAL_MARKET_IMMEDIATE_PAYOUT_MULTIPLIER,
  STATE_PREMIUMS,
  YEAR_PRICE_CYCLE,
} from '@/lib/constants';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateWineScore } from '@/lib/services/wine/winescore/wineScoreCalculation';
import type { WineBatch } from '@/lib/types/types';
import { calculateAsymmetricalMultiplier } from '@/lib/utils/calculator';

/**
 * Shared, seller-independent base for a globally listed grape lot. Current
 * weather is company-scoped, so it intentionally does not enter this quote.
 */
export function getGlobalGrapeMarketBasePricePerKg(): number {
  const state = getGameState();
  const season = state.season ?? GAME_INITIALIZATION.STARTING_SEASON;
  const economy = state.economyPhase ?? 'Stable';
  const year = state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;
  const yearMultiplier = YEAR_PRICE_CYCLE[Math.abs(year) % YEAR_PRICE_CYCLE.length] ?? 1;

  return Number((GLOBAL_GRAPE_MARKET_BASE_PRICE_PER_KG
    * (BUYER_SEASON_PRICE_MULTIPLIERS[season] ?? 1)
    * (BUYER_ECONOMY_PRICE_MULTIPLIERS[economy] ?? 1)
    * yearMultiplier).toFixed(2));
}

export function getGlobalGrapeMarketPricePerKg(basePricePerKg: number, state: WineBatch['state'], quality: number): number {
  const normalizedQuality = Math.max(GLOBAL_GRAPE_MARKET_QUALITY_FLOOR, Math.min(1, quality));
  const stateMultiplier = STATE_PREMIUMS[state as keyof typeof STATE_PREMIUMS] ?? 1;
  return Number((basePricePerKg
    * normalizedQuality
    * calculateAsymmetricalMultiplier(normalizedQuality)
    * stateMultiplier).toFixed(2));
}

export function getGlobalGrapeMarketPublicPricePerKg(batch: WineBatch): number {
  return getGlobalGrapeMarketPricePerKg(
    getGlobalGrapeMarketBasePricePerKg(),
    batch.state,
    calculateWineScore(batch),
  );
}

export function getGlobalGrapeMarketSellbackPayout(batch: WineBatch, quantityKg: number): number {
  return Number((getGlobalGrapeMarketPublicPricePerKg(batch)
    * Math.max(1, Math.round(quantityKg))
    * GLOBAL_MARKET_IMMEDIATE_PAYOUT_MULTIPLIER).toFixed(2));
}
