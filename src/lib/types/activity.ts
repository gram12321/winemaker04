import { WorkCategory } from '@/lib/services/work';

export interface Activity {
  id: string;
  category: WorkCategory;
  title: string;
  totalWork: number;
  completedWork: number;
  targetId?: string; // vineyard ID, building ID, etc.
  params: Record<string, any>; // grape variety, density, etc.
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
}

export interface ActivityProgress {
  activityId: string;
  progress: number; // 0-100
  isComplete: boolean;
  timeRemaining?: string; // estimated time remaining
}
