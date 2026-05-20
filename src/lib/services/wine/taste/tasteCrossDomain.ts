/**
 * Structure → flavor family nudges (`crossDomainInteractions` in design doc).
 */
import type { FlavorFamilyId, WineCharacteristics } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

export function applyStructureToFlavorCrossDomain(
  c: WineCharacteristics,
  raw: Record<FlavorFamilyId, number>
): void {
  raw.blackFruit = clamp01(raw.blackFruit + c.tannins * 0.12 + c.body * 0.04);
  raw.redFruit = clamp01(raw.redFruit + c.tannins * 0.08);
  raw.citrus = clamp01(raw.citrus + c.acidity * 0.1);
  raw.treeFruit = clamp01(raw.treeFruit + c.aroma * 0.06 + c.body * 0.05);
  raw.tropicalFruit = clamp01(raw.tropicalFruit + c.sweetness * 0.08);
  raw.spiceFlavor = clamp01(raw.spiceFlavor + c.spice * 0.1);
  raw.flower = clamp01(raw.flower + c.aroma * 0.05);
  raw.driedFruit = clamp01(raw.driedFruit + c.sweetness * 0.05);
}
