import { calculateAsymmetricalMultiplier } from '@/lib/utils';
import {
  STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS,
  STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER,
  STORAGE_VESSEL_BASE_PRICE,
  STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS,
  STORAGE_VESSEL_FILL_HISTORY_PRICE_DECAY,
  STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES,
  STORAGE_VESSEL_USED_MARKET_CONDITION_DECAY_PER_WEEK,
} from '@/lib/constants';
import { isBuyMarketDateInWindow, toBuyMarketAbsoluteWeek, type BuyMarketGameDate } from '@/lib/services/market/buyMarketDate';
import type { StorageVessel, StorageVesselMarketListing } from '@/lib/types/storageVessels';
import type { BuyMarketLifecycleAdapter } from '@/lib/services/market/buyMarketLifecycleService';

export function projectUsedStorageVesselCondition(listing: StorageVesselMarketListing, vessel: StorageVessel, date: BuyMarketGameDate): number {
  const elapsedWeeks = Math.max(0, toBuyMarketAbsoluteWeek(date) - toBuyMarketAbsoluteWeek({ year: listing.listedYear, season: listing.listedSeason, week: listing.listedWeek }));
  const decay = STORAGE_VESSEL_USED_MARKET_CONDITION_DECAY_PER_WEEK[vessel.material];
  return Math.max(0, Number((listing.startingCondition - elapsedWeeks * decay).toFixed(4)));
}

export function isUsedStorageVesselListingVisible(listing: StorageVesselMarketListing, date: BuyMarketGameDate): boolean {
  return listing.status === 'active' && isBuyMarketDateInWindow(date,
    { year: listing.listedYear, season: listing.listedSeason, week: listing.listedWeek },
    { year: listing.retiredYear, season: listing.retiredSeason, week: listing.retiredWeek },
  );
}

export const storageVesselMarketLifecycleAdapter: BuyMarketLifecycleAdapter<
  StorageVesselMarketListing,
  StorageVessel,
  number
> = {
  project: projectUsedStorageVesselCondition,
  isVisible: isUsedStorageVesselListingVisible,
};

export function calculateUsedStorageVesselMarketValue(vessel: StorageVessel, condition: number, currentYear: number): number {
  const ageYears = Math.max(0, currentYear - vessel.productionYear);
  const ageMultiplier = STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER
    + (1 - STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER) * Math.exp(-ageYears / STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS);
  const qualityMultiplier = vessel.qualityScore * calculateAsymmetricalMultiplier(vessel.qualityScore);
  const fillMultiplier = 1 / (1 + vessel.fillHistory * STORAGE_VESSEL_FILL_HISTORY_PRICE_DECAY);
  const price = STORAGE_VESSEL_BASE_PRICE
    * (vessel.capacityLitres / STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES)
    * qualityMultiplier * ageMultiplier * condition * fillMultiplier
    * STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS[vessel.cleanliness];
  return Math.max(0, Number(price.toFixed(2)));
}
