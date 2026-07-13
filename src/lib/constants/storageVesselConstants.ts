import type { StorageVesselMaterial, StorageVesselType } from '@/lib/types/storageVessels';

export interface StorageVesselCatalogEntry {
  id: string;
  name: string;
  vesselType: StorageVesselType;
  material: StorageVesselMaterial;
  capacityLitres: number;
  price: number;
  availableUnits: number;
}

export const STORAGE_VESSEL_CATALOG: readonly StorageVesselCatalogEntry[] = [
  {
    id: 'oak_cask_225',
    name: '225 L French Oak Cask',
    vesselType: 'cask',
    material: 'oak',
    capacityLitres: 225,
    price: 950,
    availableUnits: 4,
  },
  {
    id: 'oak_cask_500',
    name: '500 L French Oak Cask',
    vesselType: 'cask',
    material: 'oak',
    capacityLitres: 500,
    price: 1650,
    availableUnits: 2,
  },
];

export const STORAGE_VESSEL_OFFER_PREFIX = 'storage_vessel';
export const STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG = 0.5;
export const STORAGE_VESSEL_CAPACITY_UNIT = 'L';
