import type { ReactElement } from 'react';
import type { FeatureConfig } from '@/lib/types/wineFeatures';
import type { AchievementCategory, AchievementLevel, PrestigeEvent, Vineyard, WineBatch, WineOrder } from '@/lib/types/types';

export interface PrestigeSummary {
  totalPrestige: number;
  companyPrestige: number;
  vineyardPrestige: number;
  eventBreakdown: PrestigeEvent[];
  vineyards: Array<{ id: string; name: string; prestige: number; events: PrestigeEvent[] }>;
}

export interface PrestigeModalInput extends PrestigeSummary {
  isOpen: boolean;
  onClose: () => void;
}

export interface PrestigeEventDisplayInput {
  type: string;
  amount: number;
  description?: string;
  metadata?: PrestigeEvent['metadata'];
}

export interface PrestigeEventDisplayData {
  title: string;
  titleBase: string;
  amountText?: string;
  calc?: string;
  displayInfo?: string;
  calculationData?: {
    type: 'company_value' | 'vineyard_land' | 'vineyard_age' | 'wine_feature';
    [key: string]: unknown;
  };
}

export interface VineyardPrestigeBreakdownEvent extends PrestigeEventDisplayInput {
  decayRate: number;
  originalAmount: number;
  currentAmount: number;
}

export type VineyardPrestigeBreakdown = Record<string, {
  totalPrestige: number;
  events: VineyardPrestigeBreakdownEvent[];
}>;

export interface PrestigeEventContext {
  customerName?: string;
  order?: WineOrder;
  vineyard?: Vineyard;
  currentCompanyPrestige?: number;
}

export interface ContractOutcomePrestigeInput {
  outcome: 'presale_fulfilled' | 'presale_defaulted' | 'forward_fulfilled' | 'forward_defaulted';
  baseAmount: number;
  description: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FinancePrestigePenaltyInput {
  amount: number;
  decayRate: number;
  reason: string;
  lenderName: string;
  lenderType: string;
  loanAmount: number;
  missedPaymentAmount: number;
  basePrestigePenalty: number;
  currentPrestige: number;
  prestigeFameComponent: number;
}

export interface AchievementPrestigeInput {
  companyId: string;
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  achievementCategory: AchievementCategory;
  achievementLevel?: AchievementLevel;
  amount: number;
  decayRate: number;
  unlockedValue?: number;
}

export interface VineyardAchievementPrestigeInput extends AchievementPrestigeInput {
  vineyardId: string;
  vineyardName: string;
}

export interface StartingConditionPrestigeInput {
  conditionId: string;
  type: string;
  amount: number;
  decayRate: number;
  description: string;
  payload?: Record<string, unknown>;
}

export interface PrestigeFeature {
  lifecycle: {
    initialize(): Promise<void>;
    initializeVineyards(): Promise<void>;
    updateCompanyValue(money: number): Promise<void>;
    updateVineyard(vineyardId: string): Promise<void>;
    updateCellarCollection(): Promise<void>;
    decayOneWeek(): Promise<void>;
  };
  reads: {
    calculateCurrent(): Promise<PrestigeSummary>;
    calculateVineyard(vineyardId: string): Promise<number>;
    getBaseVineyard(vineyardId: string): Promise<number>;
    getBreakdown(): Promise<VineyardPrestigeBreakdown>;
    getEventDisplayData(event: PrestigeEventDisplayInput): PrestigeEventDisplayData;
  };
  events: {
    addSale(saleValue: number, customerName: string, wineName: string, quantity?: number): Promise<void>;
    addContractOutcome(input: ContractOutcomePrestigeInput): Promise<void>;
    addVineyardSale(saleValue: number, customerName: string, wineName: string, vineyardId: string, vineyardPrestigeFactor: number, quantity?: number): Promise<void>;
    addVineyardAchievement(eventType: 'planting' | 'aging' | 'improvement' | 'harvest', vineyardId: string, amount: number): Promise<void>;
    addFeature(batch: WineBatch, config: FeatureConfig, eventType: 'manifestation' | 'sale', context?: PrestigeEventContext): Promise<void>;
    addResearch(projectTitle: string, projectId: string, prestigeAmount: number): Promise<void>;
    recordFinancePenalty(input: FinancePrestigePenaltyInput): Promise<void>;
    recordAchievement(input: AchievementPrestigeInput): Promise<void>;
    recordVineyardAchievement(input: VineyardAchievementPrestigeInput): Promise<void>;
    recordStartingCondition(input: StartingConditionPrestigeInput): Promise<void>;
    recordBookkeepingPenalty(penalty: number, taskCount: number): Promise<void>;
    recordAdminAdjustment(amount: number): Promise<void>;
  };
  calculations: {
    boundedVineyardFactor(vineyard: Vineyard): {
      suitability: number;
      ageBase01: number;
      ageWithSuitability01: number;
      ageScaled: number;
      landBase01: number;
      landWithSuitability01: number;
      landPerHa: number;
      sqrtHectares: number;
      sizeFactor: number;
      landScaled: number;
      permanentRaw: number;
      decayingComponent: number;
      combinedRaw: number;
      boundedFactor: number;
    };
  };
  ui: {
    renderModal(input: PrestigeModalInput): ReactElement;
  };
}

export type { PrestigeEvent, Vineyard, WineBatch, WineOrder };
