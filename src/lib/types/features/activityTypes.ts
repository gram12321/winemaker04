import type { WorkCategory } from '../shared/coreTypes';
import type { LoanOffer, LenderSearchOptions } from './financeTypes';
import type { Staff } from './staffTypes';

export interface Activity {
  id: string;
  category: WorkCategory;
  title: string;
  totalWork: number;
  completedWork: number;
  targetId?: string;
  params: Record<string, any>;
  status: 'active' | 'cancelled';
  gameWeek: number;
  gameSeason: string;
  gameYear: number;
  isCancellable: boolean;
  createdAt: Date;
}

export interface ActivityCreationOptions {
  category: WorkCategory;
  title: string;
  totalWork: number;
  targetId?: string;
  params?: Record<string, any>;
  isCancellable?: boolean;
  activityDetails?: string;
  skipNotification?: boolean;
}

export interface ActivityProgress {
  activityId: string;
  progress: number;
  isComplete: boolean;
  timeRemaining?: string;
}

export interface PendingStaffCandidates {
  activityId: string;
  candidates: Staff[];
  searchOptions: {
    numberOfCandidates: number;
    skillLevel: number;
    specializations: string[];
  };
  timestamp: number;
}

export interface PendingLandSearchResults {
  activityId: string;
  options: any[];
  searchOptions: {
    numberOfOptions: number;
    regions: string[];
    altitudeRange?: [number, number];
    aspectPreferences?: string[];
    hectareRange: [number, number];
    soilTypes?: string[];
    minGrapeSuitability?: number;
  };
  timestamp: number;
}

export interface PendingLenderSearchResults {
  activityId: string;
  offers: LoanOffer[];
  searchOptions: LenderSearchOptions;
  timestamp: number;
}
