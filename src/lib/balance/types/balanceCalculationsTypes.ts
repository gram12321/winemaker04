import { WineCharacteristics } from '@/lib/types/types';

// Calculation result types
export interface BalanceCalculationResult {
  score: number;
  qualifies: boolean;
  adjustedRanges: Record<keyof WineCharacteristics, [number, number]>;
}

export interface CharacteristicCalculation {
  distanceInside: number;
  distanceOutside: number;
  penalty: number;
  baseTotalDistance: number;
  totalScalingMultiplier: number;
  finalTotalDistance: number;
  synergyReduction: number;
}

export interface PenaltyScalingResult {
  [source: string]: {
    [target: string]: number;
  };
}

export interface SynergyReductionResult {
  acidity: number;
  aroma: number;
  body: number;
  spice: number;
  sweetness: number;
  tannins: number;
}
