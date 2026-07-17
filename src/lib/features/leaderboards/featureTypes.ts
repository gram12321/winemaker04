import type { ReactElement } from 'react';
import type { Season } from '@/lib/types/types';

export type LeaderboardKind =
  | 'company_value'
  | 'company_value_per_week'
  | 'highest_vintage_quantity'
  | 'most_productive_vineyard'
  | 'highest_wine_score'
  | 'highest_taste_quality_index'
  | 'highest_structure_index'
  | 'highest_price'
  | 'lowest_price';

/** Stable leaderboard read model. Database columns stay inside the feature adapter. */
export interface LeaderboardEntry {
  id: string;
  companyId: string;
  companyName: string;
  kind: LeaderboardKind;
  value: number;
  gameWeek?: number;
  gameSeason?: Season;
  gameYear?: number;
  achievedAt: Date;
  vineyardId?: string;
  vineyardName?: string;
  wineVintage?: number;
  grapeVariety?: string;
}

export interface LeaderboardCompanyRecordInput {
  companyId: string;
  companyName: string;
  gameWeek: number;
  gameSeason: Season;
  gameYear: number;
  foundedYear: number;
  companyValue: number;
  startingValue?: number;
}

export interface LeaderboardWineRecordInput {
  companyId: string;
  companyName: string;
  gameWeek: number;
  gameSeason: Season;
  gameYear: number;
  vineyardId: string;
  vineyardName: string;
  vintage: number;
  grape: string;
  quantity: number;
  tasteQualityIndex: number;
  structureIndex: number;
  wineScore: number;
  price: number;
  bottledAt?: string;
}

export interface LeaderboardVineyardRecordInput {
  companyId: string;
  companyName: string;
  gameWeek: number;
  gameSeason: Season;
  gameYear: number;
  vineyardId: string;
  vineyardName: string;
  totalBottles: number;
}

export interface LeaderboardRanking { position: number; total: number; }
export interface LeaderboardContext {
  position: number;
  total: number;
  entries: LeaderboardEntry[];
  startIndex: number;
}
export interface LeaderboardSummaryInput {
  entries: LeaderboardEntry[];
  title: string;
  isLoading?: boolean;
}
export type LeaderboardResult = { success: boolean; error?: string };
export interface LeaderboardPageInput { currentCompanyId?: string; onBack?: () => void; }

export interface LeaderboardFeature {
  record: {
    company(input: LeaderboardCompanyRecordInput): Promise<LeaderboardResult>;
    wine(input: LeaderboardWineRecordInput): Promise<LeaderboardResult>;
    vineyard(input: LeaderboardVineyardRecordInput): Promise<LeaderboardResult>;
  };
  views: {
    list(kind: LeaderboardKind, limit?: number): Promise<LeaderboardEntry[]>;
    rankings(companyId: string): Promise<Record<LeaderboardKind, LeaderboardRanking>>;
    context(companyId: string, kind: LeaderboardKind, window?: number): Promise<LeaderboardContext | null>;
    kindName(kind: LeaderboardKind): string;
    kindUnit(kind: LeaderboardKind): string;
  };
  maintenance: { clear(kind?: LeaderboardKind): Promise<LeaderboardResult>; };
  ui: { renderPage(input: LeaderboardPageInput): ReactElement; renderSummary(input: LeaderboardSummaryInput): ReactElement; };
}
