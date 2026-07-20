import { describe, expect, it } from 'vitest';
import { addBuyMarketWeeks } from '@/lib/services/market/buyMarketDate';
import { calculateUsedStorageVesselMarketValue, isUsedStorageVesselListingVisible, projectUsedStorageVesselCondition } from '@/lib/services/market/storageVessels/usedStorageVesselMarketService';
import type { StorageVessel, StorageVesselMarketListing } from '@/lib/types/storageVessels';

const vessel = (material: StorageVessel['material'] = 'oak'): StorageVessel => ({
  id: 'vessel-1', vesselName: 'Alice #1', ownerKind: 'npc_market', vesselType: 'cask', material,
  qualityScore: 0.7, condition: 0.8, fillHistory: 3, productionYear: 2020, capacityLitres: 500,
  acquisitionPrice: 1000, sourceOfferId: 'npc', operationalStatus: 'operational', cleanliness: 'dirty', occupancy: 'available',
  purchasedYear: 2026, purchasedSeason: 'Spring', purchasedWeek: 1,
});
const listing = (): StorageVesselMarketListing => ({
  id: 'listing-1', vesselId: 'vessel-1', sellerKind: 'npc', sellerCounterpartyId: 'npc:npc', sellerName: 'NPC', origin: 'npc_generated', status: 'active', evolutionSeed: 'seed',
  startingCondition: 0.8, listedYear: 2026, listedSeason: 'Spring', listedWeek: 1,
  retiredYear: 2027, retiredSeason: 'Spring', retiredWeek: 1,
});

describe('used storage vessel market lifecycle', () => {
  it('shows a listing only inside its game-date visibility window', () => {
    const value = listing();
    expect(isUsedStorageVesselListingVisible(value, { year: 2025, season: 'Winter', week: 12 })).toBe(false);
    expect(isUsedStorageVesselListingVisible(value, { year: 2026, season: 'Spring', week: 1 })).toBe(true);
    expect(isUsedStorageVesselListingVisible(value, { year: 2027, season: 'Spring', week: 1 })).toBe(false);
  });

  it('projects deterministic material-specific condition without mutating the vessel', () => {
    const date = addBuyMarketWeeks({ year: 2026, season: 'Spring', week: 1 }, 20);
    const oak = projectUsedStorageVesselCondition(listing(), vessel('oak'), date);
    const steel = projectUsedStorageVesselCondition(listing(), vessel('stainless_steel'), date);
    expect(oak).toBeLessThan(steel);
    expect(vessel().condition).toBe(0.8);
  });

  it('uses condition, fills, cleanliness, quality, and age in global used value', () => {
    const clean = { ...vessel(), cleanliness: 'clean' as const, fillHistory: 0 };
    const neglected = { ...vessel(), condition: 0.35, fillHistory: 8 };
    expect(calculateUsedStorageVesselMarketValue(clean, 1, 2026)).toBeGreaterThan(calculateUsedStorageVesselMarketValue(neglected, 0.35, 2026));
  });
});
