import { ASPECT_RIPENESS_MODIFIERS, RIPENESS_INCREASE, SEASONAL_RIPENESS_RANDOMNESS } from '@/lib/constants/vineyardConstants';
import type { Season, Vineyard } from '@/lib/types/types';
import { deterministicSeasonalVariation } from '@/lib/utils';

/**
 * Calculate dynamic ripeness increase for a vineyard based on season, aspect, and randomness.
 */
export function calculateDynamicRipenessIncrease(
  vineyard: Vineyard,
  season: string,
  deterministicMultiplier?: number
): number {
  const baseIncrease = RIPENESS_INCREASE[season as keyof typeof RIPENESS_INCREASE] || 0;

  if (baseIncrease <= 0) {
    return 0;
  }

  const randomnessRange = SEASONAL_RIPENESS_RANDOMNESS[season as keyof typeof SEASONAL_RIPENESS_RANDOMNESS];
  if (!randomnessRange || randomnessRange.min === randomnessRange.max) {
    return baseIncrease;
  }

  const resolvedMultiplier = deterministicMultiplier
    ?? deterministicSeasonalVariation(
      `${vineyard.id}:${season}:ripeness-randomness:default`,
      randomnessRange.min,
      randomnessRange.max
    );

  const aspectModifier = ASPECT_RIPENESS_MODIFIERS[vineyard.aspect as keyof typeof ASPECT_RIPENESS_MODIFIERS] || 0;
  const aspectMultiplier = 1 + aspectModifier;
  const finalIncrease = baseIncrease * resolvedMultiplier * aspectMultiplier;

  return Math.max(0, finalIncrease);
}

export function calculateWinterRipenessDegradation(week: number): number {
  const safeWeek = Math.max(1, Number.isFinite(week) ? week : 1);
  const baseDegradation = 0.03;
  const accelerationFactor = 0.01;
  return baseDegradation + (accelerationFactor * (safeWeek - 1));
}

export function calculateWeeklyBaselineRipenessDelta(
  vineyard: Vineyard,
  season: string,
  week: number,
  companyId: string,
  year: number,
  plantingProgressRatio: number = 1
): number {
  const currentRipeness = vineyard.ripeness || 0;
  const safePlantingProgressRatio = Math.max(0, Math.min(1, plantingProgressRatio));

  if (season === 'Winter') {
    if (currentRipeness <= 0) return 0;
    const weeklyDegradation = calculateWinterRipenessDegradation(week);
    const ripenessLoss = Math.min(currentRipeness, weeklyDegradation);
    return -ripenessLoss;
  }

  const randomnessRange = SEASONAL_RIPENESS_RANDOMNESS[season as keyof typeof SEASONAL_RIPENESS_RANDOMNESS] || { min: 1, max: 1 };
  const ripenessMultiplier = deterministicSeasonalVariation(
    `${companyId}:${year}:${season}:${week}:${vineyard.id}:ripeness-randomness`,
    randomnessRange.min,
    randomnessRange.max
  );
  const ripenessIncrease = calculateDynamicRipenessIncrease(vineyard, season, ripenessMultiplier);
  if (ripenessIncrease <= 0) {
    return 0;
  }

  const scaledRipenessIncrease = ripenessIncrease * safePlantingProgressRatio;
  return Math.min(1 - currentRipeness, scaledRipenessIncrease);
}

export function getSeasonalWeeklyHealthDegradation(season: string): number {
  switch (season) {
    case 'Spring':
      return 0.002;
    case 'Summer':
      return 0.006;
    case 'Fall':
      return 0.01;
    case 'Winter':
      return 0.001;
    default:
      return 0.005;
  }
}

export function calculateWeeklyBaselineHealthDelta(
  vineyard: Vineyard,
  season: string,
  week: number,
  companyId: string,
  year: number,
  healthDecayMultiplier: number = 1
): number {
  if (vineyard.vineyardHealth <= 0.1) return 0;

  let weeklyDegradation = getSeasonalWeeklyHealthDegradation(season);
  const variationSeed = `${companyId}:${year}:${season}:${week}:${vineyard.id}:health-variation`;
  const variation = deterministicSeasonalVariation(variationSeed, -0.2, 0.2);
  weeklyDegradation *= (1 + variation);
  weeklyDegradation *= Math.max(0.1, healthDecayMultiplier);

  return -weeklyDegradation;
}

export function isRipenessGrowthActiveForWeek(
  status: Vineyard['status'],
  season: Season,
  week: number
): boolean {
  if (status === 'Growing' || status === 'Planting') {
    return true;
  }

  if (
    season === 'Spring' &&
    week === 1 &&
    (status === 'Dormant' || status === 'Planted' || status === 'Harvested')
  ) {
    return true;
  }

  return false;
}
