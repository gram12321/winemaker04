import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_BUY_MARKET_DEMAND_FACTORS, GLOBAL_GRAPE_MARKET_BASE_PRICE_PER_KG, GLOBAL_GRAPE_MARKET_IMMEDIATE_PAYOUT_RATE, GLOBAL_GRAPE_MARKET_PRICE_QUALITY_LINEAR_BASE, GLOBAL_GRAPE_MARKET_PRICE_QUALITY_LINEAR_SCALE, GLOBAL_GRAPE_MARKET_PRICE_QUALITY_MIN_MULTIPLIER, GLOBAL_GRAPE_MARKET_QUALITY_FLOOR, STATE_PREMIUMS, type BuyMarketDemandFactors } from '@/lib/constants';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateCompanyValue, syncPersistedTransaction } from '@/lib/services/finance/financeService';
import { getBuyMarketCounterpartyPriceMultiplier, getBuyMarketCounterpartyRelationships, getBuyMarketRelationshipPointsForPurchase, getBuyMarketRelationshipYearlyCap } from '@/lib/services/market/buyMarketCounterpartyRelationshipService';
import { initializeHarvestVolumeLitres } from '@/lib/services/wine/winery/storageVesselAllocationService';
import { prepareWineBatchForInsert } from '@/lib/database/activities/inventoryDB';
import { getActiveGlobalGrapeMarketListings, purchaseGlobalGrapeMarketListing } from '@/lib/database/market/globalGrapeMarketListingsDB';
import { GAME_INITIALIZATION } from '@/lib/constants';
import type { BuyGrapeMarketOffer } from '@/lib/services/sales/buyGrapeMarketService';
import type { GlobalGrapeMarketListing } from '@/lib/types/market';
import type { Season, WineBatch } from '@/lib/types/types';
import { projectGlobalGrapeLot } from './globalGrapeMarketLifecycleService';
import { ensureGlobalGrapeSupplierListings } from './globalGrapeMarketSupplierService';

function now() {
  const state = getGameState();
  return {
    week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    season: (state.season ?? GAME_INITIALIZATION.STARTING_SEASON) as Season,
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
  };
}

function priceSnapshot(multiplier: number) {
  return {
    supplierRelationshipMultiplier: multiplier,
    marketRelationshipMultiplier: multiplier,
    companyPrestige: 0,
    seasonPriceMultiplier: 1,
    economyPriceMultiplier: 1,
    yearCyclePriceMultiplier: 1,
    volatilityPriceMultiplier: 1,
    volatilityBuyerPriceSensitivityMultiplier: 1,
  };
}

function pricePerKg(listing: GlobalGrapeMarketListing, quality: number, relationshipMultiplier: number): number {
  const qualityMultiplier = Math.max(GLOBAL_GRAPE_MARKET_PRICE_QUALITY_MIN_MULTIPLIER, quality * (GLOBAL_GRAPE_MARKET_PRICE_QUALITY_LINEAR_BASE + quality * GLOBAL_GRAPE_MARKET_PRICE_QUALITY_LINEAR_SCALE));
  return Number((listing.basePricePerKg * qualityMultiplier * STATE_PREMIUMS[listing.batchState] * relationshipMultiplier).toFixed(2));
}

function toOffer(listing: GlobalGrapeMarketListing, relationship: Awaited<ReturnType<typeof getBuyMarketCounterpartyRelationships>>[string] | undefined): BuyGrapeMarketOffer | null {
  const date = now();
  const projection = projectGlobalGrapeLot({
    batch: listing.batchSnapshot,
    qualityScore: listing.qualityScore,
    batchState: listing.batchState,
    qualityDecayPerWeek: listing.qualityDecayPerWeek,
    minQualityFloor: listing.minQualityFloor,
  }, { year: listing.createdYear, season: listing.createdSeason, week: listing.createdWeek }, date);
  if (!projection.visible || listing.availableKg <= 0) return null;
  const multiplier = getBuyMarketCounterpartyPriceMultiplier(relationship?.level ?? 0);
  const effectivePricePerKg = pricePerKg(listing, projection.qualityScore, multiplier);
  return {
    id: listing.id,
    supplierId: listing.seller.id,
    supplierName: listing.seller.name,
    originTag: 'seasonal_rotation',
    batchState: listing.batchState,
    grapeVariety: listing.grapeVariety,
    availableKg: listing.availableKg,
    qualityScore: projection.qualityScore,
    basePricePerKg: listing.basePricePerKg,
    effectivePricePerKg,
    priceSnapshot: priceSnapshot(multiplier),
    weeksOnMarket: projection.elapsedWeeks,
    qualityDecayPerWeek: listing.qualityDecayPerWeek,
    minQualityFloor: listing.minQualityFloor,
    isPersistent: false,
    createdYear: listing.createdYear,
    createdSeason: listing.createdSeason,
    createdWeek: listing.createdWeek,
    supplierLoyalty: null,
    demandFactors: DEFAULT_BUY_MARKET_DEMAND_FACTORS as BuyMarketDemandFactors,
    provenanceSnapshot: listing.provenanceSnapshot ?? projection.batch.originSnapshot?.provenance ?? {
      country: 'France', region: 'Bordeaux', soil: ['Clay'], aspect: 'South', altitude: 0, density: 4000,
      vineyardHealth: 0.5, ripeness: 0.5, vineAge: 8, landValue: 50000, vineyardPrestige: 0.3, baseQualityScore: projection.qualityScore,
    },
    previewBatch: projection.batch,
    previewVersion: 1,
    source: { kind: listing.origin === 'company_listing' ? 'company_listing' : 'npc_used', seller: listing.seller },
    counterpartyRelationship: relationship ?? null,
  };
}

export async function getGlobalGrapeMarketOffers(): Promise<BuyGrapeMarketOffer[]> {
  await ensureGlobalGrapeSupplierListings(now()).catch((error) => console.warn('Could not ensure global grape listings.', error));
  const { data, error } = await getActiveGlobalGrapeMarketListings();
  if (error) return [];
  const relationships = await getBuyMarketCounterpartyRelationships(data.map((listing) => listing.seller));
  return data.map((listing) => toOffer(listing, relationships[`${listing.seller.kind}:${listing.seller.id}`])).filter((offer): offer is BuyGrapeMarketOffer => Boolean(offer));
}

export async function purchaseGlobalGrapeOffer(offerId: string, quantityKg: number, storageVesselIds: string[]): Promise<{ success: boolean; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const offer = (await getGlobalGrapeMarketOffers()).find((candidate) => candidate.id === offerId);
  if (!offer) return { success: false, error: 'Global listing is no longer available.' };
  const quantity = Math.max(1, Math.min(offer.availableKg, Math.round(quantityKg)));
  if (storageVesselIds.length === 0) return { success: false, error: 'Select enough Storage Vessel capacity before purchasing this batch.' };
  const state = getGameState();
  const cost = Number((offer.effectivePricePerKg * quantity).toFixed(2));
  if ((state.money ?? 0) < cost) return { success: false, error: 'Insufficient funds.' };
  const purchased: WineBatch = { ...offer.previewBatch, id: uuidv4(), quantity, volumeLitres: initializeHarvestVolumeLitres(quantity) };
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const purchase = await purchaseGlobalGrapeMarketListing({
    companyId, purchaseId: uuidv4(), listingId: offer.id, quantityKg: quantity, vesselIds: storageVesselIds,
    requiredLitres: purchased.volumeLitres!, batch: await prepareWineBatchForInsert(purchased, companyId), cost,
    relationshipPoints: getBuyMarketRelationshipPointsForPurchase(cost), relationshipYearlyCap: getBuyMarketRelationshipYearlyCap(companyValue),
    ...now(),
  });
  if (purchase.error || !purchase.data?.transaction) return { success: false, error: 'Listing availability, vessel capacity, or funds changed. Please reopen the market.' };
  await syncPersistedTransaction(purchase.data.transaction);
  return { success: true };
}

export function getGlobalGrapeMarketBaseValue(batch: WineBatch): number {
  const stateMultiplier = STATE_PREMIUMS[batch.state as keyof typeof STATE_PREMIUMS] ?? 1;
  const quality = Math.max(GLOBAL_GRAPE_MARKET_QUALITY_FLOOR, Math.min(1, (batch.structureIndex + batch.tasteQualityIndex) / 2));
  return Number((GLOBAL_GRAPE_MARKET_BASE_PRICE_PER_KG * quality * stateMultiplier).toFixed(2));
}

export function getGlobalGrapeMarketSellbackPayout(batch: WineBatch, quantityKg: number): number {
  return Number((getGlobalGrapeMarketBaseValue(batch) * Math.max(1, Math.round(quantityKg)) * GLOBAL_GRAPE_MARKET_IMMEDIATE_PAYOUT_RATE).toFixed(2));
}
