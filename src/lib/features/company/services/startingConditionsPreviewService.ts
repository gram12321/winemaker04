import { type StartingCondition } from '@/lib/constants/startingConditions';
import { DEFAULT_VINE_DENSITY } from '@/lib/features/activities/constants/activityConstants';
import { getRandomAspect, getRandomAltitude, getRandomSoils, generateVineyardName } from '@/lib/services/vineyard/vineyardGeneration';
import { getRandomFromArray } from '@/lib/utils/utils';
import type { VineyardPreview } from '../featureTypes';

export function generateVineyardPreview(condition: StartingCondition): VineyardPreview {
  const {
    country,
    region,
    minHectares,
    maxHectares,
    minAltitude,
    maxAltitude,
    preferredAspects,
  } = condition.startingVineyard;

  const hectares = Number((minHectares + Math.random() * (maxHectares - minHectares)).toFixed(2));
  const aspect = preferredAspects && preferredAspects.length > 0
    ? getRandomFromArray(preferredAspects)
    : getRandomAspect();
  const name = generateVineyardName(country, aspect);
  const altitude =
    minAltitude !== undefined && maxAltitude !== undefined
      ? Math.round(minAltitude + Math.random() * (maxAltitude - minAltitude))
      : getRandomAltitude(country, region);
  const soil = getRandomSoils(country, region);
  const density = DEFAULT_VINE_DENSITY;

  return {
    name,
    country,
    region,
    hectares,
    soil,
    altitude,
    aspect: aspect as string,
    density,
  };
}
