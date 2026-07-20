import { describe, expect, it } from 'vitest';
import { NAMES } from '@/lib/constants';
import { getStorageVesselName, getStorageVesselNameBase } from '@/lib/services/market/storageVessels/storageVesselNamingService';

describe('Storage Vessel naming service', () => {
  it('uses Italian female names for small oak vessels', () => {
    const name = getStorageVesselNameBase('supplier:oak:2026', 'oak', 250);

    expect(NAMES.Italy.firstNames.female).toContain(name);
    expect(getStorageVesselName('supplier:oak:2026', 'oak', 250)).toBe(`${name} #1`);
  });

  it('uses US male names for large plastic vessels', () => {
    const name = getStorageVesselNameBase('global:plastic:2026', 'plastic', 1_000);

    expect(NAMES['United States'].firstNames.male).toContain(name);
  });

  it('is deterministic for supplier and global-market generation', () => {
    expect(getStorageVesselName('npc-used:2026:Spring:ceramic', 'ceramic', 500))
      .toBe(getStorageVesselName('npc-used:2026:Spring:ceramic', 'ceramic', 500));
  });
});
