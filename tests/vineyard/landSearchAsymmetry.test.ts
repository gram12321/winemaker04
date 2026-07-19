import { describe, it, expect } from 'vitest';

import { ASPECTS } from '@/lib/types/types';
import { ALL_SOIL_TYPES } from '@/lib/constants/vineyardConstants';
import {
  type LandSearchOptions,
  calculateLandSearchCost
} from '@/lib/services/vineyard/landSearchService';
import { calculateLandSearchWork } from '@/lib/features/activities/services/workcalculators/landSearchWorkCalculator';
import {
  probabilityMassInRange,
  getAsymmetricHectareMassRemoved
} from '@/lib/utils/calculator';

function createOptions(
  hectareRange: [number, number],
  hectarePenaltyReferenceRange?: [number, number]
): LandSearchOptions {
  return {
    numberOfOptions: 3,
    regions: [],
    selectedCountries: [],
    hectareRange,
    hectarePenaltyReferenceRange,
    altitudeRange: [0, 1],
    soilTypes: [...ALL_SOIL_TYPES],
    aspectPreferences: [...ASPECTS],
    minGrapeSuitability: 0,
    grapeVarieties: []
  };
}

describe('land search asymmetric hectare penalty', () => {
  it('applies relief for tiny capped ranges compared to symmetric removed-mass baseline', () => {
    const minHa = 0.05;
    const maxHa = 0.1;

    const symmetricMassRemoved = 1 - probabilityMassInRange(minHa, maxHa);
    const asymmetricMassRemoved = getAsymmetricHectareMassRemoved(minHa, maxHa);

    expect(asymmetricMassRemoved).toBeLessThan(symmetricMassRemoved);
    expect(asymmetricMassRemoved).toBeGreaterThanOrEqual(0);
  });

  it('keeps tiny-cap ranges cheaper than equivalent restrictive large-property ranges', () => {
    const tinyCapOptions = createOptions([0.05, 0.1]);
    const largePropertyOptions = createOptions([50, 100]);

    const tinyCapCost = calculateLandSearchCost(tinyCapOptions, 0);
    const largePropertyCost = calculateLandSearchCost(largePropertyOptions, 0);

    expect(tinyCapCost).toBeGreaterThan(0);
    expect(largePropertyCost).toBeGreaterThan(tinyCapCost);
  });

  it('keeps tiny-cap work lower than equivalent restrictive large-property ranges', () => {
    const tinyCapOptions = createOptions([0.05, 0.1]);
    const largePropertyOptions = createOptions([50, 100]);

    const tinyCapWork = calculateLandSearchWork(tinyCapOptions, 0).totalWork;
    const largePropertyWork = calculateLandSearchWork(largePropertyOptions, 0).totalWork;

    expect(tinyCapWork).toBeGreaterThan(0);
    expect(largePropertyWork).toBeGreaterThan(tinyCapWork);
  });

  it('still preserves baseline behavior for full-range search', () => {
    const fullRangeOptions = createOptions([0.05, 2000]);

    const effectiveRemovedMass = getAsymmetricHectareMassRemoved(0.05, 2000);
    const fullRangeCost = calculateLandSearchCost(fullRangeOptions, 0);
    const fullRangeWork = calculateLandSearchWork(fullRangeOptions, 0).totalWork;

    expect(effectiveRemovedMass).toBe(0);
    expect(fullRangeCost).toBeGreaterThan(0);
    expect(fullRangeWork).toBeGreaterThan(0);
  });

  it('does not penalize full coverage inside a research-limited reference range', () => {
    const globalBaseline = createOptions([0.05, 0.5]);
    const referenceAware = createOptions([0.05, 0.5], [0.05, 0.5]);
    const narrowedWithinReference = createOptions([0.05, 0.3], [0.05, 0.5]);

    const globalCost = calculateLandSearchCost(globalBaseline, 0);
    const referenceAwareCost = calculateLandSearchCost(referenceAware, 0);
    const narrowedWithinReferenceCost = calculateLandSearchCost(narrowedWithinReference, 0);

    const globalWork = calculateLandSearchWork(globalBaseline, 0).totalWork;
    const referenceAwareWork = calculateLandSearchWork(referenceAware, 0).totalWork;
    const narrowedWithinReferenceWork = calculateLandSearchWork(narrowedWithinReference, 0).totalWork;

    expect(referenceAwareCost).toBeLessThan(globalCost);
    expect(referenceAwareWork).toBeLessThan(globalWork);
    expect(narrowedWithinReferenceCost).toBeGreaterThan(referenceAwareCost);
    expect(narrowedWithinReferenceWork).toBeGreaterThan(referenceAwareWork);
  });
});
