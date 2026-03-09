import type { Vineyard } from './vineyardTypes';
import type { WineBatch } from './wineTypes';
import type { WineOrder } from './salesTypes';

export type PrestigeEventType =
  | 'company_finance'
  | 'company_story'
  | 'sale'
  | 'contract'
  | 'penalty'
  | 'cellar_collection'
  | 'achievement'
  | 'vineyard_sale'
  | 'vineyard_base'
  | 'vineyard_achievement'
  | 'vineyard_age'
  | 'vineyard_land'
  | 'wine_feature';

export interface PrestigePayloadBase {}

export interface PrestigePayloadCompanyFinance extends PrestigePayloadBase {
  companyNetWorth?: number;
  maxLandValue?: number;
  prestigeBase01?: number;
  reason?: string;
  lenderName?: string;
  lenderType?: string;
  loanAmount?: number;
  missedPaymentAmount?: number;
}

export interface PrestigePayloadVineyardCommon extends PrestigePayloadBase {
  vineyardId: string;
  vineyardName: string;
}

export interface PrestigePayloadVineyardAge extends PrestigePayloadVineyardCommon {
  vineAge: number;
  ageBase01: number;
  ageWithSuitability01: number;
}

export interface PrestigePayloadVineyardLand extends PrestigePayloadVineyardCommon {
  totalValue: number;
  landValuePerHectare: number;
  hectares: number;
  maxLandValue: number;
  landBase01: number;
  landWithSuitability01: number;
}

export interface PrestigePayloadVineyardSale extends PrestigePayloadVineyardCommon {
  customerName: string;
  wineName: string;
  saleValue: number;
  vineyardPrestigeFactor: number;
}

export interface PrestigePayloadVineyardAchievement extends PrestigePayloadVineyardCommon {
  event: 'planting' | 'aging' | 'improvement' | 'harvest';
}

export interface PrestigePayloadCompanyStory extends PrestigePayloadBase {
  title?: string;
  description?: string;
  summary?: string;
  origin?: string;
  family?: string;
}

export type PrestigeEventPayload =
  | { type: 'company_finance'; payload: PrestigePayloadCompanyFinance }
  | { type: 'company_story'; payload: PrestigePayloadCompanyStory }
  | { type: 'sale'; payload: { customerName: string; wineName: string; saleValue: number } }
  | { type: 'contract'; payload: Record<string, unknown> }
  | { type: 'penalty'; payload: Record<string, unknown> }
  | { type: 'vineyard_sale'; payload: PrestigePayloadVineyardSale }
  | { type: 'vineyard_base'; payload: PrestigePayloadVineyardCommon }
  | { type: 'vineyard_achievement'; payload: PrestigePayloadVineyardAchievement }
  | { type: 'vineyard_age'; payload: PrestigePayloadVineyardAge }
  | { type: 'vineyard_land'; payload: PrestigePayloadVineyardLand };

export interface PrestigeEvent {
  id: string;
  type: PrestigeEventType;
  amount: number;
  timestamp: number;
  decayRate: number;
  description?: string;
  sourceId?: string;
  created_at?: string;
  updated_at?: string;
  originalAmount?: number;
  currentAmount?: number;
  metadata?: PrestigeEventPayload extends { type: infer T; payload: infer P }
    ? T extends PrestigeEventType
      ? P
      : never
    : never;
}

export interface RelationshipBoost {
  id: string;
  customerId: string;
  amount: number;
  timestamp: number;
  decayRate: number;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrestigeComputationContext {
  order?: WineOrder;
  batch?: WineBatch;
  vineyard?: Vineyard;
}
