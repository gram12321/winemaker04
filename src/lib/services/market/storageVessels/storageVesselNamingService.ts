import { NAMES } from '@/lib/constants/namesConstants';
import type { StorageVesselMaterial } from '@/lib/types/storageVessels';

const MATERIAL_NAME_COUNTRY: Record<StorageVesselMaterial, keyof typeof NAMES> = {
  oak: 'Italy',
  chestnut: 'Italy',
  stainless_steel: 'France',
  concrete: 'Germany',
  ceramic: 'Spain',
  plastic: 'United States',
};

function hashNameSeed(seed: string): number {
  return Array.from(seed).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
}

export function getStorageVesselNameBase(seed: string, material: StorageVesselMaterial, capacityLitres: number): string {
  const country = MATERIAL_NAME_COUNTRY[material];
  const gender = capacityLitres <= 500 ? 'female' : 'male';
  const names = NAMES[country].firstNames[gender];
  return names[hashNameSeed(`${seed}:${material}:${gender}`) % names.length];
}

export function getStorageVesselName(seed: string, material: StorageVesselMaterial, capacityLitres: number, sequence = 1): string {
  return `${getStorageVesselNameBase(seed, material, capacityLitres)} #${sequence}`;
}
