import { ASPECTS, type Aspect } from '@/lib/types/types';
import { NAMES, REGION_ALTITUDE_RANGES, REGION_SOIL_TYPES } from '@/lib/constants';
import { getRandomFromArray, randomInt } from '@/lib/utils/utils';

export function getRandomAspect(): Aspect {
  return getRandomFromArray(ASPECTS);
}

export function getRandomSoils(country: string, region: string): string[] {
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? (countryData[region as keyof typeof countryData] as readonly string[] || []) : [];
  const numberOfSoils = Math.floor(Math.random() * 3) + 1;
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

export function getRandomAltitude(country: string, region: string): number {
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange: [number, number] = countryData
    ? (countryData[region as keyof typeof countryData] as [number, number] || [0, 100])
    : [0, 100];
  const [min, max] = altitudeRange;
  return randomInt(min, max);
}

export function generateVineyardName(country: string, aspect: Aspect): string {
  const isFemaleAspect = ['East', 'Southeast', 'South', 'Southwest'].includes(aspect);
  const nameData = NAMES[country as keyof typeof NAMES];

  if (!nameData) {
    console.error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
    throw new Error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
  }

  const names = isFemaleAspect ? nameData.firstNames.female : nameData.firstNames.male;
  const selectedName = getRandomFromArray(names);
  return `${selectedName}'s ${aspect} Vineyard`;
}
