import type { StorageVesselCatalogueId, StorageVesselMaterial, StorageVesselType } from '@/lib/types/storageVessels';

export interface StorageVesselCatalogueEntry {
  id: StorageVesselCatalogueId;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  capacityLitres: number;
  materialPriceMultiplier: number;
  label: string;
}

export const STORAGE_VESSEL_CATALOGUE: readonly StorageVesselCatalogueEntry[] = [
  ['oak_cask_250','cask','oak',250,1.4,'Oak cask — 250 L'], ['oak_cask_500','cask','oak',500,1.4,'Oak cask — 500 L'], ['oak_cask_1000','cask','oak',1000,1.4,'Oak cask — 1,000 L'],
  ['chestnut_cask_500','cask','chestnut',500,1.25,'Chestnut cask — 500 L'], ['chestnut_cask_1000','cask','chestnut',1000,1.25,'Chestnut cask — 1,000 L'], ['chestnut_cask_2000','cask','chestnut',2000,1.25,'Chestnut cask — 2,000 L'],
  ['stainless_steel_tank_500','steel_tank','stainless_steel',500,1,'Stainless steel tank — 500 L'], ['stainless_steel_tank_1000','steel_tank','stainless_steel',1000,1,'Stainless steel tank — 1,000 L'], ['stainless_steel_tank_2500','steel_tank','stainless_steel',2500,1,'Stainless steel tank — 2,500 L'],
  ['concrete_tank_750','concrete_tank','concrete',750,1.2,'Concrete tank — 750 L'], ['concrete_tank_1500','concrete_tank','concrete',1500,1.2,'Concrete tank — 1,500 L'], ['concrete_tank_3000','concrete_tank','concrete',3000,1.2,'Concrete tank — 3,000 L'],
  ['ceramic_container_250','container','ceramic',250,1.45,'Ceramic amphora — 250 L'], ['ceramic_container_500','container','ceramic',500,1.45,'Ceramic amphora — 500 L'], ['ceramic_container_1000','container','ceramic',1000,1.45,'Ceramic amphora — 1,000 L'],
  ['plastic_container_1000','container','plastic',1000,0.55,'Food-grade plastic — 1,000 L'], ['plastic_container_2500','container','plastic',2500,0.55,'Food-grade plastic — 2,500 L'], ['plastic_container_5000','container','plastic',5000,0.55,'Food-grade plastic — 5,000 L'],
].map(([id,vesselType,material,capacityLitres,materialPriceMultiplier,label]) => ({ id, vesselType, material, capacityLitres, materialPriceMultiplier, label } as StorageVesselCatalogueEntry));
export const STORAGE_VESSEL_CATALOGUE_BY_ID = Object.fromEntries(STORAGE_VESSEL_CATALOGUE.map((entry) => [entry.id, entry])) as Record<StorageVesselCatalogueId, StorageVesselCatalogueEntry>;
export function getStorageVesselCatalogueEntry(id: StorageVesselCatalogueId) { return STORAGE_VESSEL_CATALOGUE_BY_ID[id]; }

export interface StorageVesselSupplierProfile { id: string; name: string; basePriceMultiplier: number; }
export interface StorageVesselNpcMarketProfile {
  sellerId: string;
  sellerName: string;
  material: StorageVesselMaterial;
  capacityLitres: number;
}
export const STORAGE_VESSEL_SIZES_LITRES = [250, 500, 1000] as const;
export const STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES = 250;
/** A 250 L vessel is the maximum baseline contact-intensity reference point. */
export const STORAGE_VESSEL_CONTACT_INTENSITY_REFERENCE_CAPACITY_LITRES = STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES;
/** Repeated fills are the main source of a vessel becoming more neutral. */
export const STORAGE_VESSEL_EXPRESSION_FILL_HALF_LIFE = 4;
/** Calendar age softens expression more slowly than actual fills. */
export const STORAGE_VESSEL_EXPRESSION_AGE_HALF_LIFE_YEARS = 20;
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
  { sellerId: 'old_world_cooperage', sellerName: 'Old World Cooperage', material: 'chestnut', capacityLitres: 500 },
  { sellerId: 'vintner_recovery_house', sellerName: 'Vintner Recovery House', material: 'stainless_steel', capacityLitres: 500 },
  { sellerId: 'continental_cellar_exchange', sellerName: 'Continental Cellar Exchange', material: 'concrete', capacityLitres: 750 },
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
