import { WineCharacteristics } from '../../types/types';

export interface HarvestInputs {
  ripeness: number; // 0-1
  qualityFactor: number; // 0-1 (vine/grape quality)
  suitability: number; // 0-1 (region × grape suitability)
  altitude: number; // meters
  medianAltitude: number; // meters
  maxAltitude: number; // meters
  grapeColor: 'red' | 'white';
}

export interface HarvestDebugBreakdown {
  base: WineCharacteristics;
  ripenessDelta: Partial<WineCharacteristics>;
  qualityDelta: Partial<WineCharacteristics>;
  altitudeDelta: Partial<WineCharacteristics>;
  suitabilityDelta: Partial<WineCharacteristics>;
  final: WineCharacteristics;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Derive starting characteristics for a harvested batch from grape base characteristics
 * and vineyard conditions. Deterministic, no randomness. Does not compute balance.
 */
export function deriveHarvestCharacteristics(
  base: WineCharacteristics,
  inputs: HarvestInputs
): { characteristics: WineCharacteristics; debug: HarvestDebugBreakdown } {
  const { ripeness, qualityFactor, suitability, altitude, medianAltitude, maxAltitude, grapeColor } = inputs;

  // Normalize altitude effect to roughly [-1, 1]
  const denom = Math.max(1, maxAltitude - medianAltitude);
  const altitudeEffect = (altitude - medianAltitude) / denom;

  // Baseline = grape base characteristics
  const result: WineCharacteristics = { ...base };

  // Ripeness effects (late harvest → sweeter, fuller, less acidic; slight tannin increase)
  const ripenessCentered = ripeness - 0.5;
  const ripenessDelta: Partial<WineCharacteristics> = {
    sweetness: ripenessCentered * 0.4,
    acidity: -ripenessCentered * 0.3,
    tannins: ripenessCentered * 0.2,
    body: ripenessCentered * 0.1,
    aroma: ripenessCentered * 0.05,
  };

  // Quality factor effects (do not raise all traits; focus on body/aroma/tannins)
  // Slight color-aware emphasis: reds boost tannins slightly more; whites boost aroma/body slightly more
  const q = qualityFactor - 0.5;
  const qualityDelta: Partial<WineCharacteristics> = {
    body: q * (grapeColor === 'white' ? 0.18 : 0.15),
    aroma: q * (grapeColor === 'white' ? 0.22 : 0.18),
    tannins: q * (grapeColor === 'red' ? 0.22 : 0.12),
  };

  // Altitude effects (higher altitude → more acidity/aroma; slightly less body)
  const altitudeDelta: Partial<WineCharacteristics> = {
    acidity: altitudeEffect * 0.2,
    aroma: altitudeEffect * 0.15,
    body: -altitudeEffect * 0.1,
  };

  // Regional suitability effects (better suited regions emphasize aroma and body)
  const suit = suitability - 0.5;
  const suitabilityDelta: Partial<WineCharacteristics> = {
    body: suit * 0.2,
    aroma: suit * 0.3,
  };

  // Apply deltas
  const applyDelta = (key: keyof WineCharacteristics, delta?: number) => {
    if (typeof delta === 'number' && delta !== 0) {
      result[key] = clamp01(result[key] + delta);
    }
  };

  (Object.keys(ripenessDelta) as (keyof WineCharacteristics)[]).forEach(k => applyDelta(k, ripenessDelta[k] as number));
  (Object.keys(qualityDelta) as (keyof WineCharacteristics)[]).forEach(k => applyDelta(k, qualityDelta[k] as number));
  (Object.keys(altitudeDelta) as (keyof WineCharacteristics)[]).forEach(k => applyDelta(k, altitudeDelta[k] as number));
  (Object.keys(suitabilityDelta) as (keyof WineCharacteristics)[]).forEach(k => applyDelta(k, suitabilityDelta[k] as number));

  const debug: HarvestDebugBreakdown = {
    base: { ...base },
    ripenessDelta,
    qualityDelta,
    altitudeDelta,
    suitabilityDelta,
    final: { ...result },
  };

  return { characteristics: result, debug };
}


