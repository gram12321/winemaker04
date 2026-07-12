import { v4 as uuidv4 } from 'uuid';
import { getCompanyStorageVessels, insertStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import { GAME_INITIALIZATION } from '@/lib/constants';
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
    companyId,
    vesselType: payload.vesselType,
    material: payload.material,
    capacityLitres: payload.capacityLitres,
    acquisitionPrice,
    sourceOfferId,
    state: 'empty',
    purchasedYear: gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    purchasedSeason: gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    purchasedWeek: gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  }));

  const { error } = await insertStorageVessels(vessels);
  if (error) throw error;
  return vessels;
}
