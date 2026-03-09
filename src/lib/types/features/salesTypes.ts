import type { GameDate, Season } from '../shared/coreTypes';
import type { GrapeVariety } from './vineyardTypes';
import type { WineCharacteristics } from './wineTypes';

export type CustomerType = 'Restaurant' | 'Wine Shop' | 'Private Collector' | 'Chain Store';

export type CustomerCountry = 'France' | 'Germany' | 'Italy' | 'Spain' | 'United States';

export interface DifficultyPreference {
  target: number;
  tolerance: number;
  weight: number;
  bias: number;
}

export interface Customer {
  id: string;
  name: string;
  country: CustomerCountry;
  customerType: CustomerType;
  purchasingPower: number;
  wineTradition: number;
  marketShare: number;
  priceMultiplier: number;
  relationship?: number;
  activeCustomer?: boolean;
  difficultyPreference?: DifficultyPreference;
}

export interface WineOrder {
  id: string;
  orderedAt: GameDate;
  customerType: CustomerType;
  wineBatchId: string;
  wineName: string;
  requestedQuantity: number;
  offeredPrice: number;
  totalValue: number;
  fulfillableQuantity?: number;
  fulfillableValue?: number;
  askingPriceAtOrderTime?: number;
  status: 'pending' | 'fulfilled' | 'rejected' | 'partially_fulfilled' | 'expired';
  expiresAt: number;
  expiresWeek: number;
  expiresSeason: Season;
  expiresYear: number;
  customerId: string;
  customerName: string;
  customerCountry: CustomerCountry;
  customerRelationship?: number;
  calculationData?: {
    estimatedBaseMultiplier: number;
    purchasingPowerMultiplier: number;
    wineTraditionMultiplier: number;
    marketShareMultiplier: number;
    finalPriceMultiplier: number;
    featurePriceMultiplier?: number;
    relationshipBonusMultiplier: number;
    relationshipAdjustedMultiplier: number;
    baseQuantity: number;
    priceSensitivity: number;
    quantityMarketShareMultiplier: number;
    finalQuantity: number;
    baseRejectionProbability: number;
    multipleOrderModifier: number;
    finalRejectionProbability: number;
    randomValue: number;
    wasRejected: boolean;
    difficulty?: {
      grapeDifficulty: number;
      affinity: number;
      priceFactor: number;
      quantityFactor: number;
      rejectionFactor: number;
    };
  };
}

export type ContractRequirementType =
  | 'quality'
  | 'minimumVintage'
  | 'specificVintage'
  | 'balance'
  | 'landValue'
  | 'grape'
  | 'grapeColor'
  | 'altitude'
  | 'aspect'
  | 'characteristicMin'
  | 'characteristicMax'
  | 'characteristicBalance';

export interface ContractRequirement {
  type: ContractRequirementType;
  value: number;
  params?: {
    minAge?: number;
    maxAge?: number;
    targetYear?: number;
    targetGrape?: GrapeVariety;
    targetGrapeColor?: 'red' | 'white';
    targetCharacteristic?: keyof WineCharacteristics;
  };
}

export type ContractStatus = 'pending' | 'fulfilled' | 'rejected' | 'expired';

export interface ContractTerms {
  durationYears: number;
  deliveriesPerYear: number;
  totalDeliveries: number;
  deliveriesCompleted: number;
  nextDeliveryDate?: GameDate;
}

export interface WineContract {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerCountry: CustomerCountry;
  customerType: CustomerType;
  requirements: ContractRequirement[];
  requestedQuantity: number;
  offeredPrice: number;
  totalValue: number;
  status: ContractStatus;
  createdWeek: number;
  createdSeason: Season;
  createdYear: number;
  expiresWeek: number;
  expiresSeason: Season;
  expiresYear: number;
  fulfilledWeek?: number;
  fulfilledSeason?: Season;
  fulfilledYear?: number;
  rejectedWeek?: number;
  rejectedSeason?: Season;
  rejectedYear?: number;
  terms?: ContractTerms;
  fulfilledWineBatchIds?: string[];
  relationshipAtCreation: number;
  createdAt?: Date;
  updatedAt?: Date;
}
