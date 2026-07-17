import { describe, expect, it } from 'vitest';
import { calculateClearingHealth } from '@/lib/services/vineyard/clearingRules';

describe('calculateClearingHealth', () => {
  it('applies additive improvements before set-health tasks', () => {
    expect(calculateClearingHealth(0.5, {
      'clear-vegetation': true,
      'remove-debris': true,
      'uproot-vines': true,
    }, 50)).toBeCloseTo(0.625);
  });

  it('keeps the result within the runtime health bounds', () => {
    expect(calculateClearingHealth(0, {})).toBe(0.1);
    expect(calculateClearingHealth(1, { 'clear-vegetation': true })).toBe(1);
  });
});
