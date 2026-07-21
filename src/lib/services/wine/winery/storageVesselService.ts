import { v4 as uuidv4 } from 'uuid';
import { deleteStorageVessels, getCompanyStorageVessels, insertStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState, getCurrentCompany } from '@/lib/services/core/gameState';
import { GAME_INITIALIZATION, GLOBAL_MARKET_IMMEDIATE_PAYOUT_MULTIPLIER } from '@/lib/constants';
import { sellStorageVesselToMarket } from '@/lib/database/market/storageVesselMarketListingsDB';
import { calculateUsedStorageVesselMarketValue } from '@/lib/services/market/storageVessels/usedStorageVesselMarketService';
import { activitiesFeature } from '@/lib/features/activities';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import type { StorageVessel, StorageVesselOfferPayload } from '@/lib/types/storageVessels';

export async function getOwnedStorageVessels(): Promise<StorageVessel[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const { data, error } = await getCompanyStorageVessels(companyId);
  if (error) throw error;
  return data;
}

export async function createPurchasedStorageVessels(
  payload: StorageVesselOfferPayload,
  sourceOfferId: string,
  acquisitionPrice: number,
  quantity: number,
): Promise<StorageVessel[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) throw new Error('No active company selected.');

  const gameState = getGameState();
  const safeQuantity = Math.max(1, Math.round(quantity));
  const vessels: StorageVessel[] = Array.from({ length: safeQuantity }, () => ({
    id: uuidv4(),
    ownerKind: 'company',
    ownerCompanyId: companyId,
    vesselType: payload.vesselType,
    material: payload.material,
    qualityScore: payload.qualityScore,
    condition: 1,
    fillHistory: 0,
    productionYear: payload.productionYear,
    capacityLitres: payload.capacityLitres,
    acquisitionPrice,
    sourceOfferId,
    operationalStatus: 'operational',
    cleanliness: 'clean',
    occupancy: 'available',
    purchasedYear: gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    purchasedSeason: gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    purchasedWeek: gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  }));

  const { error } = await insertStorageVessels(vessels);
  if (error) throw error;
  return vessels;
}

export function getStorageVesselDisplayName(vessel: StorageVessel): string {
  return vessel.vesselName ?? `Vessel ${vessel.id.slice(-4).toUpperCase()}`;
}

export function getStorageVesselSellbackEligibility(vessel: StorageVessel, activities: Awaited<ReturnType<typeof activitiesFeature.reads.getAll>>): { eligible: boolean; reasons: string[] } {
  const reasons = [
    ...(vessel.occupancy !== 'available' ? ['Vessel is allocated or contains wine.'] : []),
    ...(vessel.operationalStatus !== 'operational' ? ['Vessel is under maintenance.'] : []),
    ...activities.filter((activity) => (activity.status === 'active' || activity.status === 'paused') && (
      activity.params.vesselId === vessel.id || activity.params.storagePlanId === vessel.activePlanId
    )).map((activity) => `Ongoing activity: ${activity.title}`),
  ];
  return { eligible: reasons.length === 0, reasons };
}

export async function sellOwnedStorageVesselToMarket(vessel: StorageVessel, activities: Awaited<ReturnType<typeof activitiesFeature.reads.getAll>>): Promise<{ success: boolean; error?: string; payout?: number }> {
  const companyId = getCurrentCompanyId();
  if (!companyId || vessel.ownerKind !== 'company' || vessel.ownerCompanyId !== companyId) return { success: false, error: 'Vessel is not owned by the active company.' };
  const eligibility = getStorageVesselSellbackEligibility(vessel, activities);
  if (!eligibility.eligible) return { success: false, error: eligibility.reasons.join(' ') };
  const state = getGameState();
  const year = state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;
  const payout = Number((calculateUsedStorageVesselMarketValue(vessel, vessel.condition, year) * GLOBAL_MARKET_IMMEDIATE_PAYOUT_MULTIPLIER).toFixed(2));
  const { data, error } = await sellStorageVesselToMarket({
    companyId, companyName: getCurrentCompany()?.name ?? 'Unknown Winery', vesselId: vessel.id, payout, year,
    season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON, week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  });
  if (error || !data) return { success: false, error: 'Could not list this vessel on the used market.' };
  triggerTopicUpdate('storage_vessels');
  return { success: true, payout };
}

export async function removePurchasedStorageVessels(vesselIds: string[]): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId || vesselIds.length === 0) return;
  const { error } = await deleteStorageVessels(companyId, vesselIds);
  if (error) throw error;
}
