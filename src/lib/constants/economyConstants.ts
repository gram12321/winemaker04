import { EconomyPhase } from '../types/types';

// Economy phase transition probabilities
export const ECONOMY_TRANSITION = {
  MIDDLE_PHASES: { // Recession, Stable, Expansion
    SHIFT_PROBABILITY: 0.25,
    STAY_PROBABILITY: 0.5
  },
  EDGE_PHASES: { // Crash, Boom
    SHIFT_PROBABILITY: 0.33,
    STAY_PROBABILITY: 0.67
  }
} as const;

// Economy phase order for navigation
export const ECONOMY_PHASES: readonly EconomyPhase[] = [
  'Crash',
  'Recession', 
  'Stable',
  'Expansion',
  'Boom'
] as const;

// Sales-related multipliers per economy phase
// - frequencyMultiplier: scales weekly customer acquisition chance
// - quantityMultiplier: scales desired order quantity
// - priceToleranceMultiplier: >1 means customers reject less for high prices
// - multipleOrderPenaltyMultiplier: >1 means more likely to place multiple orders
export const ECONOMY_SALES_MULTIPLIERS: Record<EconomyPhase, {
  frequencyMultiplier: number;
  quantityMultiplier: number;
  priceToleranceMultiplier: number;
  multipleOrderPenaltyMultiplier: number;
}> = {
  Crash: {
    frequencyMultiplier: 0.5,
    quantityMultiplier: 0.6,
    priceToleranceMultiplier: 0.85,
    multipleOrderPenaltyMultiplier: 0.8
  },
  Recession: {
    frequencyMultiplier: 0.8,
    quantityMultiplier: 0.85,
    priceToleranceMultiplier: 0.95,
    multipleOrderPenaltyMultiplier: 0.9
  },
  Stable: {
    frequencyMultiplier: 1.0,
    quantityMultiplier: 1.0,
    priceToleranceMultiplier: 1.0,
    multipleOrderPenaltyMultiplier: 1.0
  },
  Expansion: {
    frequencyMultiplier: 1.2,
    quantityMultiplier: 1.15,
    priceToleranceMultiplier: 1.05,
    multipleOrderPenaltyMultiplier: 1.05
  },
  Boom: {
    frequencyMultiplier: 1.5,
    quantityMultiplier: 1.3,
    priceToleranceMultiplier: 1.15,
    multipleOrderPenaltyMultiplier: 1.1
  }
};

