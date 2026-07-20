import type { StorageVesselMaterial } from '@/lib/types/storageVessels';

export interface StorageVesselSupplierProfile { id: string; name: string; basePriceMultiplier: number; }
export interface StorageVesselNpcMarketProfile {
  sellerId: string;
  sellerName: string;
  material: StorageVesselMaterial;
  capacityLitres: number;
}
export const STORAGE_VESSEL_SIZES_LITRES = [250, 500, 1000] as const;
export const STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES = 250;
export const STORAGE_VESSEL_SUPPLIERS: readonly StorageVesselSupplierProfile[] = [
  { id: 'cooperage_duval', name: 'Cooperage Duval', basePriceMultiplier: 1.04 },
  { id: 'nordic_cellar_craft', name: 'Nordic Cellar Craft', basePriceMultiplier: 0.97 },
  { id: 'heritage_coopers', name: 'Heritage Coopers', basePriceMultiplier: 1.1 },
];
export const STORAGE_VESSEL_BASE_PRICE = 850;
export const STORAGE_VESSEL_MIN_PRICE = 500;
export const STORAGE_VESSEL_MAX_PRICE = 10_000;
export const STORAGE_VESSEL_OFFER_RETENTION_CHANCE = 0.45;
export const STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS = {
  clean: 1,
  dirty: 0.8,
} as const;
// Oak character and commercial value decline quickly over the first several fills/years,
// then approach a small residual value for structurally usable neutral vessels.
export const STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS = 10;
export const STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER = 0.03;
export const STORAGE_VESSEL_MAX_GENERATED_AGE_YEARS = 40;
export const STORAGE_VESSEL_FILL_HISTORY_PRICE_DECAY = 0.035;

export const STORAGE_VESSEL_USED_MARKET_SELLBACK_MULTIPLIER = 0.7;
export const STORAGE_VESSEL_USED_MARKET_LISTING_WEEKS = 52;
export const STORAGE_VESSEL_USED_MARKET_CONDITION_DECAY_PER_WEEK = {
  oak: 0.0035,
  chestnut: 0.004,
  stainless_steel: 0.0008,
  concrete: 0.0015,
  ceramic: 0.0025,
  plastic: 0.0045,
} as const;
export const STORAGE_VESSEL_USED_MARKET_NPC_PROFILES: readonly StorageVesselNpcMarketProfile[] = [
  { sellerId: 'continental_cellar_exchange', sellerName: 'Continental Cellar Exchange', material: 'oak', capacityLitres: 250 },
  { sellerId: 'old_world_cooperage', sellerName: 'Old World Cooperage', material: 'chestnut', capacityLitres: 250 },
  { sellerId: 'vintner_recovery_house', sellerName: 'Vintner Recovery House', material: 'stainless_steel', capacityLitres: 500 },
  { sellerId: 'continental_cellar_exchange', sellerName: 'Continental Cellar Exchange', material: 'concrete', capacityLitres: 500 },
  { sellerId: 'old_world_cooperage', sellerName: 'Old World Cooperage', material: 'ceramic', capacityLitres: 1_000 },
  { sellerId: 'vintner_recovery_house', sellerName: 'Vintner Recovery House', material: 'plastic', capacityLitres: 1_000 },
];
export const STORAGE_VESSEL_USED_MARKET_NPC_LISTINGS_PER_SEASON = STORAGE_VESSEL_USED_MARKET_NPC_PROFILES.length;
export const STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_MIN = 0.35;
export const STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_RANGE = 0.55;
export const STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_MIN = 0.35;
export const STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_RANGE = 0.55;
export const STORAGE_VESSEL_USED_MARKET_NPC_MAX_FILL_HISTORY = 8;
export const STORAGE_VESSEL_USED_MARKET_NPC_MAX_AGE_YEARS = 20;
export const STORAGE_VESSEL_USED_MARKET_NPC_DIRTY_CHANCE = 1 / 3;

export const STORAGE_VESSEL_OFFER_PREFIX = 'storage_vessel';
export const STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG = 0.5;
export const STORAGE_VESSEL_CAPACITY_UNIT = 'L';
