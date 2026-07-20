import type { ComponentProps, ReactNode } from 'react';
import type {
  Activity,
  ActivityCreationOptions,
  ActivityProgress,
  GameState,
  Staff,
} from '@/lib/types/types';
import type { ActivityStaffWorkContext, ActivityStaffWorkPreview } from './services/activityWorkPreviewService';
import type { LandSearchOptionsModal } from './ui/modals/LandSearchOptionsModal';
import type { LandSearchResultsModal } from './ui/modals/LandSearchResultsModal';
import type PlantingOptionsModal from './ui/modals/PlantingOptionsModal';
import type HarvestOptionsModal from './ui/modals/HarvestOptionsModal';
import type ClearingOptionsModal from './ui/modals/ClearingOptionsModal';
import type { StaffSearchOptionsModal } from './ui/modals/StaffSearchOptionsModal';
import type { StaffSearchResultsModal } from './ui/modals/StaffSearchResultsModal';
import type CrushingOptionsModal from './ui/modals/CrushingOptionsModal';
import type { FermentationOptionsModal } from './ui/modals/FermentationOptionsModal';
import type { ClearingTask } from './constants/activityConstants';

export interface ActivityCreationResult {
  activityId: string | null;
  reason?: string;
}

export interface ActivitiesFeature {
  config: { defaultVineDensity: number };
  catalog: {
    workCategoryInfo: typeof import('./constants/activityConstants').WORK_CATEGORY_INFO;
    getClearingTask(taskId: string): ClearingTask | undefined;
    getTaskTypeDisplayName(taskType: string): string;
    isStaffSpecializationCategory(value: unknown): value is import('@/lib/types/types').WorkCategory;
    getStaffSpecializationDisplayName(category: import('@/lib/types/types').WorkCategory): string;
  };
  lifecycle: {
    create(options: ActivityCreationOptions): Promise<string | null>;
    createWithResult(options: ActivityCreationOptions): Promise<ActivityCreationResult>;
    update(id: string, updates: Partial<Activity>): Promise<boolean>;
    pause(id: string): Promise<boolean>;
    resume(id: string): Promise<boolean>;
    activate(id: string, params: Record<string, unknown>): Promise<boolean>;
    completeNow(id: string): Promise<{ success: boolean; error?: string; activity?: Activity }>;
    cancel(id: string): Promise<boolean>;
    remove(id: string): Promise<boolean>;
    clearPendingLandSearchResults(): Promise<void>;
    clearPendingStaffCandidates(): Promise<void>;
  };
  reads: {
    getAll(): Promise<Activity[]>;
    getById(id: string): Promise<Activity | null>;
    getByTarget(targetId: string): Promise<Activity[]>;
    getProgress(id: string): Promise<ActivityProgress | null>;
  };
  work: {
    getContext(
      activity: Activity,
      allActivities: Activity[],
      gameState: Partial<Pick<GameState, 'season' | 'weatherState' | 'weatherIntensity'>>,
      assignedStaffIds?: string[],
    ): Promise<ActivityStaffWorkContext>;
    getPreview(activity: Activity, assignedStaff: Staff[], context: ActivityStaffWorkContext): ActivityStaffWorkPreview;
    calculateClearing: typeof import('./services/workcalculators/clearingWorkCalculator').calculateClearingWork;
    calculateCrushing: typeof import('./services/workcalculators/crushingWorkCalculator').calculateCrushingWork;
    validateCrushingBatch: typeof import('./services/workcalculators/crushingWorkCalculator').validateCrushingBatch;
    calculateFermentation: typeof import('./services/workcalculators/fermentationWorkCalculator').calculateFermentationWork;
    calculateHarvest: typeof import('./services/workcalculators/harvestingWorkCalculator').calculateHarvestWork;
    calculateLandSearch: typeof import('./services/workcalculators/landSearchWorkCalculator').calculateLandSearchWork;
    calculateLenderSearch: typeof import('./services/workcalculators/lenderSearchWorkCalculator').calculateLenderSearchWork;
    calculateLenderSearchCost: typeof import('./services/workcalculators/lenderSearchWorkCalculator').calculateLenderSearchCost;
    calculateResearch: typeof import('./services/workcalculators/researchWorkCalculator').calculateResearchWork;
    calculateResearchCost: typeof import('./services/workcalculators/researchWorkCalculator').calculateResearchCost;
    calculateCleanStorageVessel: typeof import('./services/workcalculators/storageVesselMaintenanceWorkCalculator').calculateCleanStorageVesselWork;
    calculateEmptyStorageVessel: typeof import('./services/workcalculators/storageVesselMaintenanceWorkCalculator').calculateEmptyStorageVesselWork;
    calculateTakeLoan: typeof import('./services/workcalculators/takeLoanWorkCalculator').calculateTakeLoanWork;
  };
  ticks: {
    progress(): Promise<void>;
    checkAndTriggerBookkeeping(newSeason?: string, economyPhaseMessage?: string | null, wageMessage?: string | null): Promise<void>;
  };
  setup: { initialize(): Promise<void> };
  ui: {
    renderActivityPanel(): ReactNode;
    renderLandSearchOptions(props: ComponentProps<typeof LandSearchOptionsModal>): ReactNode;
    renderLandSearchResults(props: ComponentProps<typeof LandSearchResultsModal>): ReactNode;
    renderPlantingOptions(props: ComponentProps<typeof PlantingOptionsModal>): ReactNode;
    renderHarvestOptions(props: ComponentProps<typeof HarvestOptionsModal>): ReactNode;
    renderClearingOptions(props: ComponentProps<typeof ClearingOptionsModal>): ReactNode;
    renderStaffSearchOptions(props: ComponentProps<typeof StaffSearchOptionsModal>): ReactNode;
    renderStaffSearchResults(props: ComponentProps<typeof StaffSearchResultsModal>): ReactNode;
    renderCrushingOptions(props: ComponentProps<typeof CrushingOptionsModal>): ReactNode;
    renderFermentationOptions(props: ComponentProps<typeof FermentationOptionsModal>): ReactNode;
  };
}

export type { ActivityStaffWorkContext, ActivityStaffWorkPreview };
export type { WorkFactor } from './services/workcalculators/workCalculator';
