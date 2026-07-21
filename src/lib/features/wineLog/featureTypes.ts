import type { ReactElement } from 'react';
import type { WineBatch, WineLogEntry } from '@/lib/types/types';

export interface WineProductionSummary {
  totalWinesProduced: number;
  totalBottlesProduced: number;
}

export interface WineLogFeature {
  records: {
    recordBottledWine(batch: WineBatch): Promise<void>;
    getVineyardHistory(vineyardId: string, companyId?: string): Promise<WineLogEntry[]>;
    getProductionSummary(companyId?: string): Promise<WineProductionSummary>;
  };
  ui: {
    renderPage(input: { currentCompany: import('@/lib/features/company').CompanyRecord | null }): ReactElement;
  };
}
