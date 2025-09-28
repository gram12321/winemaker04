import { WineCharacteristics } from '@/lib/types/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';

export function calculateMidpointCharacteristics(): WineCharacteristics {
  return {
    acidity: (BASE_BALANCED_RANGES.acidity[0] + BASE_BALANCED_RANGES.acidity[1]) / 2,
    aroma: (BASE_BALANCED_RANGES.aroma[0] + BASE_BALANCED_RANGES.aroma[1]) / 2,
    body: (BASE_BALANCED_RANGES.body[0] + BASE_BALANCED_RANGES.body[1]) / 2,
    spice: (BASE_BALANCED_RANGES.spice[0] + BASE_BALANCED_RANGES.spice[1]) / 2,
    sweetness: (BASE_BALANCED_RANGES.sweetness[0] + BASE_BALANCED_RANGES.sweetness[1]) / 2,
    tannins: (BASE_BALANCED_RANGES.tannins[0] + BASE_BALANCED_RANGES.tannins[1]) / 2
  };
}

export function createAdjustedRangesRecord(): Record<keyof WineCharacteristics, [number, number]> {
  return {
    acidity: [...BASE_BALANCED_RANGES.acidity] as [number, number],
    aroma: [...BASE_BALANCED_RANGES.aroma] as [number, number],
    body: [...BASE_BALANCED_RANGES.body] as [number, number],
    spice: [...BASE_BALANCED_RANGES.spice] as [number, number],
    sweetness: [...BASE_BALANCED_RANGES.sweetness] as [number, number],
    tannins: [...BASE_BALANCED_RANGES.tannins] as [number, number]
  };
}

/**
 * Common class names for reset buttons
 */
export const RESET_BUTTON_CLASSES = "px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors";

/**
 * Clamp value to 0-1 range
 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Common slider component props for characteristic sliders
 */
export interface CharacteristicSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  icon: string;
}

/**
 * Generate slider props for all wine characteristics
 */
export function generateCharacteristicSliders(
  characteristics: WineCharacteristics,
  onChange: (key: keyof WineCharacteristics, value: number) => void
): CharacteristicSliderProps[] {
  return Object.entries(characteristics).map(([key, value]) => ({
    value,
    onChange: (newValue: number) => onChange(key as keyof WineCharacteristics, newValue),
    label: key.charAt(0).toUpperCase() + key.slice(1),
    icon: `/assets/icons/characteristics/${key}.png`
  }));
}
