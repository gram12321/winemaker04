import { describe, expect, it } from 'vitest';
import { calculateStorageCapacitySummary } from '@/lib/services/wine/winery/storageVesselAllocationService';
import type { StorageVessel } from '@/lib/types/storageVessels';

function vessel(id: string, capacityLitres: number, occupancy: StorageVessel['occupancy'], operationalStatus: StorageVessel['operationalStatus'] = 'operational'): StorageVessel {
  return { id, capacityLitres, occupancy, operationalStatus, cleanliness: 'clean' } as StorageVessel;
}

describe('Storage Vessel capacity summary', () => {
  it('does not count maintenance or retired vessels as available capacity', () => {
    const summary = calculateStorageCapacitySummary([
      vessel('available', 500, 'available'),
      vessel('maintenance', 250, 'available', 'maintenance'),
      vessel('retired', 1000, 'available', 'retired'),
      vessel('reserved', 250, 'reserved'),
      vessel('used', 500, 'in_use'),
    ]);

    expect(summary).toEqual({
      totalLitres: 2500,
      availableLitres: 500,
      reservedLitres: 250,
      inUseLitres: 500,
      availableVesselCount: 1,
    });
  });

  it('does not count dirty vessels as available capacity', () => {
    const summary = calculateStorageCapacitySummary([
      vessel('clean', 500, 'available'),
      { ...vessel('dirty', 250, 'available'), cleanliness: 'dirty' },
    ]);
    expect(summary.availableLitres).toBe(500);
    expect(summary.availableVesselCount).toBe(1);
  });
});
