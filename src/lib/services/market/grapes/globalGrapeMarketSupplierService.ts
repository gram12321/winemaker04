import { GRAPE_CONST, MARKET_CRUSHING_PROFILE_BY_COLOR, MARKET_FERMENTATION_PROFILE_BY_COLOR, STATE_DISTRIBUTION } from '@/lib/constants';
import { deterministicSeasonalVariation } from '@/lib/utils';
import { ensureNpcGlobalGrapeMarketListings, type NpcGlobalGrapeListingInput } from '@/lib/database/market/globalGrapeMarketListingsDB';
import { buildMarketPreviewBatch } from '@/lib/services/wine/winery/inventoryService';
import { ensureGlobalMarketSupplierListings, registerGlobalMarketSupplierAdapter, type GlobalMarketSupplierAdapter, type GlobalMarketSupplierDate } from '@/lib/services/market/globalMarketSupplierService';
import type { MarketBatchProvenanceSnapshot } from '@/lib/types/types';
import { getGlobalGrapeMarketBasePricePerKg } from './globalGrapeMarketPricingService';

function provenance(seed: string, quality: number): MarketBatchProvenanceSnapshot {
  return {
    country: 'France', region: 'Bordeaux', soil: ['Clay'], aspect: 'South', altitude: Math.round(deterministicSeasonalVariation(`${seed}:altitude`, 30, 260)),
    density: 4500, vineyardHealth: quality, ripeness: quality, vineAge: Math.round(deterministicSeasonalVariation(`${seed}:age`, 6, 30)),
    landValue: 65000, vineyardPrestige: quality * .6, overgrowth: { vegetation: 0, debris: 0, uproot: 0, replant: 0 }, pendingFeatures: [], baseQualityScore: quality,
  };
}

const globalGrapeSupplierAdapter: GlobalMarketSupplierAdapter<NpcGlobalGrapeListingInput> = {
  id: 'grapes:npc_global',
  wareGroup: 'grapes',
  async generateListings(date) {
    const grapes = Object.keys(GRAPE_CONST).slice(0, 3) as Array<keyof typeof GRAPE_CONST>;
    return Promise.all(grapes.map(async (grape, index) => {
      const seed = `npc-global-grape:${date.year}:${date.season}:${grape}`;
      const state = STATE_DISTRIBUTION[index % STATE_DISTRIBUTION.length];
      const quality = Number(deterministicSeasonalVariation(`${seed}:quality`, .45, .82).toFixed(3));
      const color = GRAPE_CONST[grape].grapeColor;
      const snapshot = await buildMarketPreviewBatch({
        supplierId: 'npc-global-grape-merchant', supplierName: 'Continental Grape Exchange', originTag: 'seasonal_rotation', source: provenance(seed, quality),
        grape: grape as any, quantity: Math.round(deterministicSeasonalVariation(`${seed}:quantity`, 250, 800)),
        harvestStartDate: { year: date.year, season: date.season as any, week: date.week }, harvestEndDate: { year: date.year, season: date.season as any, week: date.week },
        stateProfile: state === 'grapes' ? { state } : state === 'must_ready'
          ? { state, crushingOptions: MARKET_CRUSHING_PROFILE_BY_COLOR[color], featureLifecycleWeeks: 1 }
          : { state, crushingOptions: MARKET_CRUSHING_PROFILE_BY_COLOR[color], fermentationOptions: MARKET_FERMENTATION_PROFILE_BY_COLOR[color], fermentationProgress: Math.round(deterministicSeasonalVariation(`${seed}:fermentation`, 20, 65)), fermentationWeeksApplied: 1, featureLifecycleWeeks: 1 },
      });
      return { evolutionSeed: seed, sellerCounterpartyId: 'npc:continental-grape-exchange', sellerName: 'Continental Grape Exchange', availableKg: snapshot.quantity, basePricePerKg: getGlobalGrapeMarketBasePricePerKg(), qualityScore: quality, batchState: state, grapeVariety: grape as any, batchSnapshot: snapshot };
    }));
  },
  async persistListings(date, listings) {
    const { error } = await ensureNpcGlobalGrapeMarketListings({ year: date.year, season: date.season as any, week: date.week, listings });
    if (error) throw error;
  },
};

registerGlobalMarketSupplierAdapter(globalGrapeSupplierAdapter);

export function ensureGlobalGrapeSupplierListings(date: GlobalMarketSupplierDate): Promise<void> {
  return ensureGlobalMarketSupplierListings(globalGrapeSupplierAdapter, date);
}
