import type { WineAnchorValues, WineBatch } from '@/lib/types/types';

export interface AnchorEffectEntry {
  anchor: keyof WineAnchorValues;
  modifier: number;
  description: string;
}

const EPSILON = 0.000001;

const ANCHOR_KEYS = [
  'sugarPotential',
  'acidPotential',
  'phenolicPotential',
  'aromaticPotential',
  'bodyPotential',
  'extractionState',
  'fermentationState',
  'leesState',
  'oxidationPressure',
  'maturationState',
  'terroirExpression',
  'processFootprint'
] as const satisfies readonly (keyof WineAnchorValues)[];

export function diffAnchorEffects(
  before: WineAnchorValues,
  after: WineAnchorValues,
  description: string
): AnchorEffectEntry[] {
  const effects: AnchorEffectEntry[] = [];
  for (const key of ANCHOR_KEYS) {
    const modifier = after[key] - before[key];
    if (Math.abs(modifier) <= EPSILON) continue;
    effects.push({
      anchor: key,
      modifier,
      description
    });
  }
  return effects;
}

export function buildAnchorEffectsFromNeutral(
  anchors: WineAnchorValues,
  description: string
): AnchorEffectEntry[] {
  const effects: AnchorEffectEntry[] = [];
  for (const key of ANCHOR_KEYS) {
    effects.push({
      anchor: key,
      modifier: anchors[key] - 0.5,
      description
    });
  }
  return effects;
}

export function appendAnchorEffects(
  breakdown: WineBatch['breakdown'] | undefined,
  newEffects: AnchorEffectEntry[]
): WineBatch['breakdown'] {
  return {
    effects: [...(breakdown?.effects || [])],
    anchorEffects: [...(breakdown?.anchorEffects || []), ...newEffects]
  };
}
