import {
  STORAGE_VESSEL_CONTACT_INTENSITY_REFERENCE_CAPACITY_LITRES,
  STORAGE_VESSEL_EXPRESSION_AGE_HALF_LIFE_YEARS,
  STORAGE_VESSEL_EXPRESSION_FILL_HALF_LIFE,
} from '@/lib/constants';
import type { StorageVessel } from '@/lib/types/storageVessels';
import { clamp01 } from '@/lib/utils';

/**
 * Returns the baseline vessel-scale contact for one week of wine contact.
 *
 * This uses the surface-area-to-volume relationship of similarly shaped
 * vessels: capacity grows with the cube of a vessel dimension, while contact
 * area grows with its square. Material, fill level, and contact duration are
 * intentionally outside this first, material-neutral index.
 */
export function calculateStorageVesselContactIntensity(vessel: Pick<StorageVessel, 'capacityLitres'>): number {
  const capacityLitres = Math.max(1, vessel.capacityLitres);
  return clamp01((STORAGE_VESSEL_CONTACT_INTENSITY_REFERENCE_CAPACITY_LITRES / capacityLitres) ** (1 / 3));
}

/**
 * Returns the controlled expression potential retained by a vessel.
 *
 * Quality and physical condition describe how well the vessel can deliver an
 * intended influence. Fill history is the dominant neutralisation factor;
 * calendar age is a gentler secondary factor. Fault and contamination risk
 * remain separate future mechanics rather than being folded into this value.
 */
export function calculateStorageVesselExpression(vessel: Pick<StorageVessel, 'qualityScore' | 'condition' | 'fillHistory' | 'productionYear'>, currentYear: number): number {
  const quality = clamp01(vessel.qualityScore);
  const condition = clamp01(vessel.condition);
  const fills = Math.max(0, vessel.fillHistory);
  const ageYears = Math.max(0, currentYear - vessel.productionYear);

  const fillRetention = 0.5 ** (fills / STORAGE_VESSEL_EXPRESSION_FILL_HALF_LIFE);
  const ageRetention = 0.5 ** (ageYears / STORAGE_VESSEL_EXPRESSION_AGE_HALF_LIFE_YEARS);
  const seasoningRetention = 0.7 * fillRetention + 0.3 * ageRetention;

  return clamp01(quality * condition * seasoningRetention);
}

