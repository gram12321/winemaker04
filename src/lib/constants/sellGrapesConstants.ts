import type { WineBatchState } from '@/lib/types/types';
import { BUY_MARKET_FIXED_SPREAD } from './buyGrapeMarketConstants';

export const BASE_GRAPE_PRICE_PER_KG = 3.0;
export const GRAPE_SALE_PRESTIGE_MAX_BONUS = 0.3;
export const GRAPE_SALE_FIXED_MARKET_PENALTY = 1 / (1 + BUY_MARKET_FIXED_SPREAD);
export const FAVORITE_GRAPE_PRIMARY_BONUS = 0.18;
export const FAVORITE_GRAPE_SECONDARY_BONUS = 0.1;

export const SELLABLE_BATCH_STATES: Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>[] = [
  'grapes',
  'must_ready',
  'must_fermenting',
];

export const SELL_STATE_PRICE_MULTIPLIERS: Record<Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>, number> = {
  grapes: 1.0,
  must_ready: 1.08,
  must_fermenting: 1.15,
};
