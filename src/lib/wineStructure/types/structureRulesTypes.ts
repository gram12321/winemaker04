import { WineCharacteristics } from '@/lib/types/types';

// Base types
export type CharacteristicKey = keyof WineCharacteristics;
export type Direction = 'above' | 'below';

// Rule base interface
export interface BaseRule {
  name: string;
  description: string;
  requirement: string;
}

// Range adjustment rules
export interface RangeShiftRule extends BaseRule {
  target: CharacteristicKey;
  shiftPerUnit: number;
  clamp?: [number, number];
}

// Rule system - works for both penalties and synergies
export interface Rule extends BaseRule {
  sources: CharacteristicKey[]; // Which characteristics trigger the rule
  targets: CharacteristicKey[]; // Which characteristics are affected
  condition: (wine: WineCharacteristics) => boolean;
  // Scaling - same math for both penalties and synergies
  k?: number; // Scaling factor (default 0.2)
  p?: number; // Power factor (default 1.2) 
  cap?: number; // Maximum effect (default 2.0 for penalties, 0.75 for synergies)
}


// Configuration interfaces
export interface RangeAdjustmentConfig {
  [source: string]: {
    [direction in Direction]?: {
      rangeShifts: RangeShiftRule[];
    };
  };
}

// Configuration for both penalties and synergies
export interface RuleConfig {
  penalties: Rule[];
  synergies: Rule[];
}

