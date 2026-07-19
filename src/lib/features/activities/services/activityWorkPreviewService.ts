import type { Activity, GameState, Staff } from '@/lib/types/types';
import { WorkCategory } from '@/lib/types/types';
import { createWeatherWeekContext, resolveWeatherOperationImpact } from '@/lib/features/weather';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { getActivityGrapeContext } from './activityWorkContext';
import { calculateStaffWorkAllocation, type StaffContributionOptions, type StaffWorkAllocation } from './workcalculators/workCalculator';

export interface ActivityStaffWorkContext {
  grapeVariety: ReturnType<typeof getActivityGrapeContext>;
  staffTaskCounts: Map<string, number>;
  staffContributionOptions: StaffContributionOptions;
  workMultiplier: number;
}

export interface ActivityStaffWorkPreview {
  workPerWeek: number;
  remainingWork: number;
  weeksToComplete: number;
  allocation: StaffWorkAllocation;
}

type PreviewGameState = Partial<Pick<GameState, 'season' | 'weatherState' | 'weatherIntensity'>>;

export function calculateActivityStaffWorkPreview(activity: Activity, assignedStaff: Staff[], context: ActivityStaffWorkContext): ActivityStaffWorkPreview {
  const remainingWork = Math.max(0, activity.totalWork - activity.completedWork);
  const raw = assignedStaff.length > 0 && context.workMultiplier > 0
    ? calculateStaffWorkAllocation(assignedStaff, activity.category, context.staffTaskCounts, context.grapeVariety, context.staffContributionOptions)
    : { totalWork: 0, contributions: new Map<string, number>() };
  const allocation = {
    totalWork: raw.totalWork * context.workMultiplier,
    contributions: new Map([...raw.contributions].map(([id, work]) => [id, work * context.workMultiplier])),
  };

  return {
    workPerWeek: allocation.totalWork,
    remainingWork,
    weeksToComplete: allocation.totalWork > 0 ? Math.ceil(remainingWork / allocation.totalWork) : 0,
    allocation,
  };
}

export async function getActivityStaffWorkContext(
  activity: Activity,
  allActivities: Activity[],
  gameState: PreviewGameState,
  assignedStaffIds: string[] = activity.params.assignedStaffIds || [],
): Promise<ActivityStaffWorkContext> {
  const researchEffects = await researchUpgradeFeature.effects.getPermanentEffects();
  const activeActivities = allActivities.filter(candidate => candidate.status === 'active');
  if (!activeActivities.some(candidate => candidate.id === activity.id)) activeActivities.push({ ...activity, status: 'active' });

  const staffTaskCounts = new Map<string, number>();
  activeActivities.forEach(candidate => {
    const ids = candidate.id === activity.id ? assignedStaffIds : candidate.params.assignedStaffIds || [];
    ids.forEach((id: string) => staffTaskCounts.set(id, (staffTaskCounts.get(id) || 0) + 1));
  });

  const weather = createWeatherWeekContext(gameState);
  const weatherImpact = activity.category === WorkCategory.PLANTING || activity.category === WorkCategory.HARVESTING
    ? resolveWeatherOperationImpact({ weather, operation: activity.category === WorkCategory.PLANTING ? 'planting' : 'harvesting', season: gameState.season ?? 'Spring' })
    : { allowed: true, workMultiplier: 1 };
  const researchActivity = activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH;

  return {
    grapeVariety: getActivityGrapeContext(activity),
    staffTaskCounts,
    staffContributionOptions: {
      allStaffWorkMultiplier: researchEffects.allStaffWorkMultiplier,
      ...(researchActivity ? { researchSkillMultiplier: researchEffects.researchSkillMultiplier } : {}),
    },
    workMultiplier: weatherImpact.allowed ? weatherImpact.workMultiplier : 0,
  };
}
