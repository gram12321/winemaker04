import { describe, it, expect } from 'vitest';
import {
  applyWeeklyFermentationEffects,
  getCombinedFermentationEffects,
  getFermentationMethodInfo,
  getFermentationTemperatureInfo,
  type FermentationInputs
} from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import type { WineCharacteristics } from '@/lib/types/types';

const baseCharacteristics: WineCharacteristics = {
  acidity: 0.5,
  aroma: 0.5,
  body: 0.5,
  spice: 0.5,
  sweetness: 0.5,
  tannins: 0.5
};

describe('fermentationCharacteristics', () => {
  describe('applyWeeklyFermentationEffects', () => {
    it('applies basic fermentation method effects correctly', () => {
      const inputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Basic',
        temperature: 'Ambient'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      // Basic method should increase aroma and body slightly
      expect(result.characteristics.aroma).toBeGreaterThan(baseCharacteristics.aroma);
      expect(result.characteristics.body).toBeGreaterThan(baseCharacteristics.body);
    });

    it('applies temperature controlled method effects', () => {
      const inputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Temperature Controlled',
        temperature: 'Ambient'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      // Temperature controlled should enhance aroma, body, and acidity
      expect(result.characteristics.aroma).toBeGreaterThan(baseCharacteristics.aroma);
      expect(result.characteristics.body).toBeGreaterThan(baseCharacteristics.body);
      expect(result.characteristics.acidity).toBeGreaterThan(baseCharacteristics.acidity);
    });

    it('applies extended maceration method effects', () => {
      const inputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Extended Maceration',
        temperature: 'Ambient'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      // Extended maceration should significantly increase tannins, body, spice, and aroma
      expect(result.characteristics.tannins).toBeGreaterThan(baseCharacteristics.tannins);
      expect(result.characteristics.body).toBeGreaterThan(baseCharacteristics.body);
      expect(result.characteristics.spice).toBeGreaterThan(baseCharacteristics.spice);
      expect(result.characteristics.aroma).toBeGreaterThan(baseCharacteristics.aroma);
    });

    it('maintains characteristic values within valid 0-1 range', () => {
      const highCharacteristics: WineCharacteristics = {
        acidity: 0.95,
        aroma: 0.95,
        body: 0.95,
        spice: 0.95,
        sweetness: 0.95,
        tannins: 0.95
      };

      const inputs: FermentationInputs = {
        baseCharacteristics: highCharacteristics,
        method: 'Extended Maceration',
        temperature: 'Warm'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      // All characteristics should stay within 0-1 range (clamped)
      Object.values(result.characteristics).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('preserves low characteristic values when effects are minimal', () => {
      const lowCharacteristics: WineCharacteristics = {
        acidity: 0.1,
        aroma: 0.1,
        body: 0.1,
        spice: 0.1,
        sweetness: 0.1,
        tannins: 0.1
      };

      const inputs: FermentationInputs = {
        baseCharacteristics: lowCharacteristics,
        method: 'Basic',
        temperature: 'Cool'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      // Characteristics should increase slightly but remain low
      expect(result.characteristics.aroma).toBeGreaterThan(lowCharacteristics.aroma);
      expect(result.characteristics.aroma).toBeLessThan(0.3); // Still relatively low
    });

    it('returns breakdown with base, effects, and final characteristics', () => {
      const inputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Basic',
        temperature: 'Ambient'
      };

      const result = applyWeeklyFermentationEffects(inputs);

      expect(result.breakdown.base).toEqual(baseCharacteristics);
      expect(result.breakdown.effects).toBeDefined();
      expect(result.breakdown.final).toEqual(result.characteristics);
    });

    it('applies different temperature settings correctly', () => {
      const basicInputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Basic',
        temperature: 'Cool'
      };

      const warmInputs: FermentationInputs = {
        baseCharacteristics,
        method: 'Basic',
        temperature: 'Warm'
      };

      const coolResult = applyWeeklyFermentationEffects(basicInputs);
      const warmResult = applyWeeklyFermentationEffects(warmInputs);

      // Temperature should affect the final characteristics
      // (exact differences depend on implementation, but should be different)
      expect(warmResult.characteristics).not.toEqual(coolResult.characteristics);
    });
  });

  describe('getCombinedFermentationEffects', () => {
    it('returns effects array for basic method and ambient temperature', () => {
      const effects = getCombinedFermentationEffects('Basic', 'Ambient');
      
      expect(Array.isArray(effects)).toBe(true);
      expect(effects.length).toBeGreaterThan(0);
    });

    it('returns effects array for extended maceration method', () => {
      const effects = getCombinedFermentationEffects('Extended Maceration', 'Ambient');
      
      expect(Array.isArray(effects)).toBe(true);
      // Extended maceration should have multiple effects
      expect(effects.length).toBeGreaterThan(0);
    });
  });

  describe('getFermentationMethodInfo', () => {
    it('returns method information for all available methods', () => {
      const methods = getFermentationMethodInfo();
      
      expect(methods['Basic']).toBeDefined();
      expect(methods['Temperature Controlled']).toBeDefined();
      expect(methods['Extended Maceration']).toBeDefined();
    });

    it('includes work multipliers and costs for each method', () => {
      const methods = getFermentationMethodInfo();
      
      Object.values(methods).forEach(method => {
        expect(method.workMultiplier).toBeGreaterThan(0);
        expect(typeof method.costPenalty).toBe('number');
        expect(method.description).toBeDefined();
      });
    });

    it('has Basic method as baseline (workMultiplier 1.0, no cost)', () => {
      const methods = getFermentationMethodInfo();
      
      expect(methods['Basic'].workMultiplier).toBe(1.0);
      expect(methods['Basic'].costPenalty).toBe(0);
    });
  });

  describe('getFermentationTemperatureInfo', () => {
    it('returns temperature information for all available temperatures', () => {
      const temperatures = getFermentationTemperatureInfo();
      
      expect(temperatures['Ambient']).toBeDefined();
      expect(temperatures['Cool']).toBeDefined();
      expect(temperatures['Warm']).toBeDefined();
    });

    it('includes cost modifiers for temperature control', () => {
      const temperatures = getFermentationTemperatureInfo();
      
      Object.values(temperatures).forEach(temp => {
        expect(typeof temp.costModifier).toBe('number');
        expect(temp.description).toBeDefined();
      });
    });
  });
});

