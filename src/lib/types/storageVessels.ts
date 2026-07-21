import type { BuyGoodsPriceQuoteInput } from '@/lib/types/market';

export type StorageVesselType = 'cask' | 'steel_tank' | 'concrete_tank' | 'container';
export type StorageVesselMaterial = 'oak' | 'chestnut' | 'stainless_steel' | 'concrete' | 'ceramic' | 'plastic';
export type StorageVesselOperationalStatus = 'operational' | 'maintenance';
export type StorageVesselCleanliness = 'clean' | 'dirty';
export type StorageVesselOccupancy = 'available' | 'reserved' | 'in_use' | 'maintenance';
export type StorageVesselOwnerKind = 'company' | 'npc_market';
export type StorageVesselCatalogueId =
  | 'oak_cask_250'
  | 'oak_cask_500'
  | 'oak_cask_1000'
  | 'chestnut_cask_500'
  | 'chestnut_cask_1000'
  | 'chestnut_cask_2000'
  | 'stainless_steel_tank_500'
  | 'stainless_steel_tank_1000'
  | 'stainless_steel_tank_2500'
  | 'concrete_tank_750'
  | 'concrete_tank_1500'
  | 'concrete_tank_3000'
  | 'ceramic_container_250'
  | 'ceramic_container_500'
  | 'ceramic_container_1000'
  | 'plastic_container_1000'
  | 'plastic_container_2500'
  | 'plastic_container_5000';
export type StorageVesselMarketListingStatus = 'active' | 'sold' | 'retired';
export type StorageVesselMarketListingOrigin = 'npc_generated' | 'player_sellback';
export type StorageAllocationPlanStatus = 'reserved' | 'active' | 'released';

export interface StorageVesselAllocationPlan {
  id: string;
  companyId: string;
  activityId?: string;
  wineBatchId?: string;
  status: StorageAllocationPlanStatus;
  requiredLitres: number;
  createdYear: number;
  createdSeason: string;
  createdWeek: number;
  activatedYear?: number;
  activatedSeason?: string;
  activatedWeek?: number;
  releasedYear?: number;
  releasedSeason?: string;
  releasedWeek?: number;
}

export interface StorageVesselAllocation {
  id: string;
  companyId: string;
  planId: string;
  vesselId: string;
  assignedCapacityLitres: number;
  filledLitres: number;
  releasedAt?: string;
}

export interface StorageVessel {
  id: string;
  catalogueId: StorageVesselCatalogueId;
  vesselName?: string;
  ownerKind: StorageVesselOwnerKind;
  ownerCompanyId?: string;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  qualityScore: number;
  condition: number;
  fillHistory: number;
  productionYear: number;
  capacityLitres: number;
  acquisitionPrice: number;
  sourceOfferId: string;
  operationalStatus: StorageVesselOperationalStatus;
  cleanliness: StorageVesselCleanliness;
  occupancy: StorageVesselOccupancy;
  activePlanId?: string;
  activeWineBatchId?: string;
  purchasedYear: number;
  purchasedSeason: string;
  purchasedWeek: number;
}

export interface StorageVesselMarketListing {
  id: string;
  vesselId: string;
  sellerKind: 'npc' | 'company';
  sellerCounterpartyId: string;
  sellerName: string;
  sellerCompanyId?: string;
  origin: StorageVesselMarketListingOrigin;
  status: StorageVesselMarketListingStatus;
  evolutionSeed: string;
  generationKey?: string;
  startingCondition: number;
  listedYear: number;
  listedSeason: string;
  listedWeek: number;
  retiredYear: number;
  retiredSeason: string;
  retiredWeek: number;
}

export interface UsedStorageVesselMarketOffer {
  id: string;
  kind: 'used_listing';
  sellerName: string;
  listing: StorageVesselMarketListing;
  vessel: StorageVessel;
  projectedCondition: number;
  pricePerVessel: number;
}

export interface StorageVesselOfferPriceSnapshot extends BuyGoodsPriceQuoteInput {
  supplierBaseMultiplier: number;
}

export interface StorageVesselOfferPayload {
  catalogueId: StorageVesselCatalogueId;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  qualityScore: number;
  vesselName?: string;
  condition?: number;
  fillHistory?: number;
  cleanliness?: StorageVesselCleanliness;
  productionYear: number;
  capacityLitres: number;
  priceSnapshot: StorageVesselOfferPriceSnapshot;
}
