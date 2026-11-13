import { deterministicSeasonalVariation } from '@/lib/utils';
import {
  STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_MIN,
  STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_RANGE,
  STORAGE_VESSEL_USED_MARKET_NPC_DIRTY_CHANCE,
  STORAGE_VESSEL_USED_MARKET_NPC_MAX_AGE_YEARS,
  STORAGE_VESSEL_USED_MARKET_NPC_MAX_FILL_HISTORY,
  STORAGE_VESSEL_USED_MARKET_NPC_PROFILES,
  STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_MIN,
  STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_RANGE,
} from '@/lib/constants';
import { STORAGE_VESSEL_CATALOGUE } from '@/lib/constants';
import { ensureNpcUsedStorageVesselListings, type NpcStorageVesselListingInput } from '@/lib/database/market/storageVesselMarketListingsDB';
import { ensureGlobalMarketSupplierListings, registerGlobalMarketSupplierAdapter, type GlobalMarketSupplierAdapter, type GlobalMarketSupplierDate } from '@/lib/services/market/globalMarketSupplierService';
import { getStorageVesselNameBase } from './storageVesselNamingService';

const globalStorageVesselSupplierAdapter: GlobalMarketSupplierAdapter<NpcStorageVesselListingInput> = {
  id: 'storage_vessels:npc_used',
  wareGroup: 'storage_vessels',
  generateListings(date) {
    const nameCounts = new Map<string, number>();
    return STORAGE_VESSEL_USED_MARKET_NPC_PROFILES.map((profile) => {
      const catalogue = STORAGE_VESSEL_CATALOGUE.find((entry) => entry.material === profile.material && entry.capacityLitres === profile.capacityLitres);
      if (!catalogue) throw new Error(`No storage vessel catalogue entry for ${profile.material}/${profile.capacityLitres}`);
      const generationKey = `npc-used:${date.year}:${date.season}:${catalogue.id}`;
      const nameBase = getStorageVesselNameBase(generationKey, profile.material, profile.capacityLitres);
      const nameSequence = (nameCounts.get(nameBase) ?? 0) + 1;
      nameCounts.set(nameBase, nameSequence);
      return {
        generationKey,
        catalogueId: catalogue.id,
        vesselType: catalogue.vesselType,
        sellerCounterpartyId: `npc:${profile.sellerId}`,
        sellerName: profile.sellerName,
        vesselName: `${nameBase} #${nameSequence}`,
        material: profile.material,
        capacityLitres: profile.capacityLitres,
        qualityScore: Number((STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_MIN + deterministicSeasonalVariation(`${generationKey}:quality`, 0, STORAGE_VESSEL_USED_MARKET_NPC_QUALITY_RANGE)).toFixed(2)),
        condition: Number((STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_MIN + deterministicSeasonalVariation(`${generationKey}:condition`, 0, STORAGE_VESSEL_USED_MARKET_NPC_CONDITION_RANGE)).toFixed(2)),
        fillHistory: Math.floor(deterministicSeasonalVariation(`${generationKey}:fills`, 0, STORAGE_VESSEL_USED_MARKET_NPC_MAX_FILL_HISTORY + 1)),
        productionYear: date.year - Math.floor(deterministicSeasonalVariation(`${generationKey}:age`, 0, STORAGE_VESSEL_USED_MARKET_NPC_MAX_AGE_YEARS + 1)),
        cleanliness: deterministicSeasonalVariation(`${generationKey}:cleanliness`, 0, 1) < STORAGE_VESSEL_USED_MARKET_NPC_DIRTY_CHANCE ? 'dirty' : 'clean',
      };
    });
  },
  async persistListings(date, listings) {
    const { error } = await ensureNpcUsedStorageVesselListings({ ...date, listings });
    if (error) throw error;
  },
};

registerGlobalMarketSupplierAdapter(globalStorageVesselSupplierAdapter);

export function ensureGlobalStorageVesselSupplierListings(date: GlobalMarketSupplierDate): Promise<void> {
  return ensureGlobalMarketSupplierListings(globalStorageVesselSupplierAdapter, date);
}
