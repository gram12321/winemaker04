import type { ReactNode } from 'react';
import type {
  Activity,
  ActivityCreationOptions,
  ActivityProgress,
  GameState,
  Staff,
} from '@/lib/types/types';
import type { ActivityStaffWorkContext, ActivityStaffWorkPreview } from './services/activityWorkPreviewService';

export interface ActivityCreationResult {
  activityId: string | null;
  reason?: string;
}

export interface ActivitiesFeature {
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
  };
  ticks: {
    progress(): Promise<void>;
    checkAndTriggerBookkeeping(newSeason?: string, economyPhaseMessage?: string | null, wageMessage?: string | null): Promise<void>;
  };
  setup: { initialize(): Promise<void> };
  ui: {
    renderActivityPanel(): ReactNode;
  };
}

export type { ActivityStaffWorkContext, ActivityStaffWorkPreview };
