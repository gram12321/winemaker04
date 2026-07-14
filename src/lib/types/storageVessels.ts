import type { BuyGoodsPriceQuoteInput } from '@/lib/types/market';

export type StorageVesselType = 'cask' | 'steel_tank' | 'concrete_tank' | 'container';
export type StorageVesselMaterial = 'oak' | 'stainless_steel' | 'concrete' | 'neutral';
export type StorageVesselOperationalStatus = 'operational' | 'maintenance' | 'retired';
export type StorageVesselOccupancy = 'available' | 'reserved' | 'in_use' | 'maintenance' | 'retired';
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
  companyId: string;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  qualityScore: number;
  productionYear: number;
  capacityLitres: number;
  acquisitionPrice: number;
  sourceOfferId: string;
  operationalStatus: StorageVesselOperationalStatus;
  occupancy: StorageVesselOccupancy;
  activePlanId?: string;
  activeWineBatchId?: string;
  purchasedYear: number;
  purchasedSeason: string;
  purchasedWeek: number;
}

export interface StorageVesselOfferPriceSnapshot extends BuyGoodsPriceQuoteInput {
  supplierBaseMultiplier: number;
}

export interface StorageVesselOfferPayload {
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  qualityScore: number;
  productionYear: number;
  capacityLitres: number;
  priceSnapshot: StorageVesselOfferPriceSnapshot;
}
