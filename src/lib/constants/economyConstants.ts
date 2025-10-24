import { EconomyPhase } from '../types/types';

// Economy phase transition probabilities
export const ECONOMY_TRANSITION = {
  MIDDLE_PHASES: { // Recovery, Expansion
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
  'Recovery',
  'Expansion',
  'Boom'
] as const;

