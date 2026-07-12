import type { StorageVessel } from '@/lib/types/storageVessels';

/**
 * Future allocation seam. WineBatch quantities currently use kg or bottles,
 * so allocation remains unavailable until an explicit capacity conversion is approved.
 */
export function getStorageVesselAllocationAvailability(vessel: StorageVessel): { available: boolean; reason: string } {
  return {
    available: false,
    reason: `${vessel.capacityLitres.toLocaleString()} L ${vessel.vesselType.replace('_', ' ')} allocation requires an approved batch-volume conversion.`,
  };
}
