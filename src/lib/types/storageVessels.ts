export type StorageVesselType = 'cask' | 'steel_tank' | 'concrete_tank' | 'container';
export type StorageVesselMaterial = 'oak' | 'stainless_steel' | 'concrete' | 'neutral';
export type StorageVesselState = 'empty' | 'allocated' | 'maintenance';

export interface StorageVessel {
  id: string;
  companyId: string;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  capacityLitres: number;
  acquisitionPrice: number;
  sourceOfferId: string;
  state: StorageVesselState;
  purchasedYear: number;
  purchasedSeason: string;
  purchasedWeek: number;
}

export interface StorageVesselOfferPayload {
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  capacityLitres: number;
}
