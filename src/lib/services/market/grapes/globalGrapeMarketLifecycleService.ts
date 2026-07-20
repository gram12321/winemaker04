import {
  GLOBAL_GRAPE_MARKET_MAX_WEEKS,
  MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS,
  type BuyOfferBatchState,
} from '@/lib/constants';
import { addBuyMarketWeeks, isBuyMarketDateInWindow, toBuyMarketAbsoluteWeek, type BuyMarketGameDate } from '@/lib/services/market/buyMarketDate';
import type { WineBatch } from '@/lib/types/types';

export interface GlobalGrapeLotLifecycleSnapshot {
  batch: WineBatch;
  qualityScore: number;
  batchState: BuyOfferBatchState;
  qualityDecayPerWeek: number;
  minQualityFloor: number;
}

export interface GlobalGrapeLotProjection {
  batch: WineBatch;
  qualityScore: number;
  elapsedWeeks: number;
  retirementDate: BuyMarketGameDate;
  visible: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The pure global-lot evolution rule. It deliberately performs no database
 * writes: every company therefore sees the same lot at the same game date.
 */
export function projectGlobalGrapeLot(
  snapshot: GlobalGrapeLotLifecycleSnapshot,
  listedAt: BuyMarketGameDate,
  date: BuyMarketGameDate,
): GlobalGrapeLotProjection {
  const elapsedWeeks = Math.max(0, toBuyMarketAbsoluteWeek(date) - toBuyMarketAbsoluteWeek(listedAt));
  const batch = clone(snapshot.batch);
  const qualityScore = Math.max(
    snapshot.minQualityFloor,
    Number((snapshot.qualityScore - elapsedWeeks * snapshot.qualityDecayPerWeek).toFixed(3)),
  );

  let retirementDate = addBuyMarketWeeks(listedAt, GLOBAL_GRAPE_MARKET_MAX_WEEKS[snapshot.batchState]);
  if (snapshot.batchState === 'must_fermenting') {
    const startingProgress = Math.max(0, Math.min(100, snapshot.batch.fermentationProgress ?? 0));
    const weeklyProgress = 100 / MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS;
    const progress = Math.min(100, Math.round(startingProgress + elapsedWeeks * weeklyProgress));
    batch.fermentationProgress = progress;
    const weeksUntilComplete = Math.max(0, Math.ceil((100 - startingProgress) / weeklyProgress));
    const completionDate = addBuyMarketWeeks(listedAt, weeksUntilComplete);
    if (toBuyMarketAbsoluteWeek(completionDate) < toBuyMarketAbsoluteWeek(retirementDate)) {
      retirementDate = completionDate;
    }
  }

  return {
    batch,
    qualityScore,
    elapsedWeeks,
    retirementDate,
    visible: isBuyMarketDateInWindow(date, listedAt, retirementDate),
  };
}
