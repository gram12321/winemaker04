import type { GrapeVariety, Vineyard } from '@/lib/types/types';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { SOIL_DIFFICULTY_MODIFIERS } from '@/lib/constants/vineyardConstants';
import { getAltitudeRating } from '../../vineyard/vineyardValueCalc';

export function getGrapeFragilityModifier(grape: GrapeVariety): number {
  return GRAPE_CONST[grape]?.fragile ?? 0;
}

export function getVineyardAltitudeModifier(vineyard: Vineyard): number {
  return getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
}

export function getVineyardSoilModifier(soil: string[]): number {
  const modifiers: number[] = soil
    .map(soilType => SOIL_DIFFICULTY_MODIFIERS[soilType as keyof typeof SOIL_DIFFICULTY_MODIFIERS])
    .filter(modifier => modifier !== undefined);

  return modifiers.length > 0
    ? modifiers.reduce((total, modifier) => total + modifier, 0) / modifiers.length
    : 0;
}
