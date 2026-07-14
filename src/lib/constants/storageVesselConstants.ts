export interface StorageVesselSupplierProfile { id: string; name: string; basePriceMultiplier: number; }
export const STORAGE_VESSEL_SIZES_LITRES = [250, 500, 1000] as const;
export const STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES = 250;
export const STORAGE_VESSEL_QUALITY_BASE_MULTIPLIER = 0.65;
export const STORAGE_VESSEL_QUALITY_SCORE_MULTIPLIER = 0.7;
export const STORAGE_VESSEL_SUPPLIERS: readonly StorageVesselSupplierProfile[] = [
  { id: 'cooperage_duval', name: 'Cooperage Duval', basePriceMultiplier: 1.04 },
  { id: 'nordic_cellar_craft', name: 'Nordic Cellar Craft', basePriceMultiplier: 0.97 },
  { id: 'heritage_coopers', name: 'Heritage Coopers', basePriceMultiplier: 1.1 },
];
export const STORAGE_VESSEL_BASE_PRICE = 850;
export const STORAGE_VESSEL_MIN_PRICE = 500;
export const STORAGE_VESSEL_MAX_PRICE = 10_000;
export const STORAGE_VESSEL_OFFER_RETENTION_CHANCE = 0.45;

export const STORAGE_VESSEL_OFFER_PREFIX = 'storage_vessel';
export const STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG = 0.5;
export const STORAGE_VESSEL_CAPACITY_UNIT = 'L';
