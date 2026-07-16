import { Activity, GrapeVariety, GRAPE_VARIETIES, WorkCategory } from '@/lib/types/types';

/**
 * Returns the immutable grape snapshot an activity is allowed to use for work
 * and XP. A generic `params.grape` is not sufficient: only grape-aware work
 * categories carry grape mastery through the activity lifecycle.
 */
export function getActivityGrapeContext(activity: Activity): GrapeVariety | undefined {
  const grape = activity.params?.grape;
  const grapeAware = activity.category === WorkCategory.PLANTING
    || activity.category === WorkCategory.HARVESTING
    || activity.category === WorkCategory.CRUSHING
    || activity.category === WorkCategory.FERMENTATION;

  return grapeAware && typeof grape === 'string' && GRAPE_VARIETIES.includes(grape as GrapeVariety)
    ? grape as GrapeVariety
    : undefined;
}
