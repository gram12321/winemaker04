import { describe, expect, it } from 'vitest';
import {
  calculateStorageVesselContactIntensity,
  calculateStorageVesselExpression,
  
} from '@/lib/services/wine/winery/storageVesselExposureService';
import type { StorageVessel } from '@/lib/types/storageVessels';

function vessel(overrides: Partial<StorageVessel> = {}): StorageVessel {
  return {
    id: 'vessel-1', catalogueId: 'oak_cask_250', ownerKind: 'company', ownerCompanyId: 'company-1', vesselType: 'cask', material: 'oak',
    qualityScore: 1, condition: 1, fillHistory: 0, productionYear: 2026, capacityLitres: 250,
    acquisitionPrice: 850, sourceOfferId: 'offer-1', operationalStatus: 'operational', cleanliness: 'clean', occupancy: 'available',
    purchasedYear: 2026, purchasedSeason: 'Spring', purchasedWeek: 1,
    ...overrides,
  };
}

describe('Storage Vessel exposure indexes', () => {
  it('uses a gentle surface-to-volume curve for baseline contact intensity', () => {
    expect(calculateStorageVesselContactIntensity(vessel({ capacityLitres: 250 }))).toBe(1);
    expect(calculateStorageVesselContactIntensity(vessel({ capacityLitres: 1_000 }))).toBeCloseTo(0.63, 2);
    expect(calculateStorageVesselContactIntensity(vessel({ capacityLitres: 5_000 }))).toBeCloseTo(0.37, 2);
  });

  it('derives expression from quality, condition, fills, and age', () => {
    const newVessel = vessel();
    const usedVessel = vessel({ qualityScore: 0.7, condition: 0.8, fillHistory: 8, productionYear: 2010 });

    expect(calculateStorageVesselExpression(newVessel, 2026)).toBe(1);
    expect(calculateStorageVesselExpression(usedVessel, 2026)).toBeLessThan(0.3);
    expect(calculateStorageVesselExpression(usedVessel, 2026)).toBeGreaterThan(0);
  });


});
