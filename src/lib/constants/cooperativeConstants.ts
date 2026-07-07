export interface CooperativeLevelConfig {
  level: 0 | 1 | 2 | 3;
  name: string;
  minConsecutiveYears: number;
  floorPricePerKg: number;
  benefits: string[];
  nextLevelHint?: string;
}

export const COOPERATIVE_LEVELS: Record<0 | 1 | 2 | 3, CooperativeLevelConfig> = {
  0: {
    level: 0,
    name: 'Non-Member',
    minConsecutiveYears: 0,
    floorPricePerKg: 0,
    benefits: [],
    nextLevelHint: 'Sell grapes once to become a Basic Member and unlock the EUR0.80/kg floor price.',
  },
  1: {
    level: 1,
    name: 'Basic Member',
    minConsecutiveYears: 1,
    floorPricePerKg: 0.80,
    benefits: [
      'Guaranteed EUR0.80/kg floor price',
      '1.5x price multiplier',
    ],
    nextLevelHint: 'Sell grapes 3 years in a row to become an Active Member (EUR1.00/kg floor).',
  },
  2: {
    level: 2,
    name: 'Active Member',
    minConsecutiveYears: 3,
    floorPricePerKg: 1.00,
    benefits: [
      'Guaranteed EUR1.00/kg floor price',
      '1.5x price multiplier',
      'Shared equipment: 10% reduced work for vineyard activities',
    ],
    nextLevelHint: 'Sell grapes 6 years in a row to become a Senior Member (EUR1.20/kg floor + passive vineyard support).',
  },
  3: {
    level: 3,
    name: 'Senior Member',
    minConsecutiveYears: 6,
    floorPricePerKg: 1.20,
    benefits: [
      'Guaranteed EUR1.20/kg floor price',
      '1.5x price multiplier',
      'Shared equipment: 15% reduced work for vineyard activities',
      'Passive vine health maintenance support each season',
    ],
  },
};
