import { Activity, GrapeVariety, GRAPE_VARIETIES, WorkCategory } from '@/lib/types/types';

const GRAPE_AWARE_CATEGORIES = new Set<WorkCategory>([
  WorkCategory.PLANTING,
  WorkCategory.HARVESTING,
  WorkCategory.CRUSHING,
  WorkCategory.FERMENTATION,
]);

export function getGrapeWorkContext(category: WorkCategory, grape?: unknown): GrapeVariety | undefined {
  return GRAPE_AWARE_CATEGORIES.has(category)
    && typeof grape === 'string'
    && GRAPE_VARIETIES.includes(grape as GrapeVariety)
    ? grape as GrapeVariety
    : undefined;
}

/**
 * Returns the immutable grape snapshot an activity is allowed to use for work
 * and XP. A generic `params.grape` is not sufficient: only grape-aware work
 * categories carry grape mastery through the activity lifecycle.
 */
export function getActivityGrapeContext(activity: Activity): GrapeVariety | undefined {
  return getGrapeWorkContext(activity.category, activity.params?.grape);
}
