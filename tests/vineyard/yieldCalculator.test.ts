/**
 * Vineyard Yield Calculation Tests
 * 
 * WHAT THIS TESTS:
 * The core vineyard yield formula that determines how many kilograms of grapes 
 * a vineyard produces when harvested. This directly affects:
 * - How much wine can be made
 * - Revenue from wine sales
 * - Game economy balance
 * 
 * FORMULA BEING TESTED:
 * yield = (hectares × density × 1.5 kg/vine) × (suitability × naturalYield × ripeness × vineYield × health)
 * 
 * WHY THESE TESTS MATTER:
 * If yield calculations break, players could harvest infinite grapes, get zero grapes
 * from perfect vineyards, or experience unrealistic economies. These tests prevent
 * those disasters from happening silently.
 */

import { describe, it, expect } from 'vitest';
import { calculateVineyardYield } from '@/lib/services/vineyard/vineyardManager';
import { type Vineyard } from '@/lib/types/types';

// Base test vineyard: 1 hectare of Sangiovese in Tuscany
// This is a realistic, well-maintained vineyard that should produce good yields
const baseVineyard: Vineyard = {
  id: 'test-vineyard',
  name: 'Test Vineyard',
  country: 'Italy',
  region: 'Tuscany',
  hectares: 1,
  grape: 'Sangiovese',
  vineAge: 5,
  soil: ['Clay', 'Limestone'],
  altitude: 300,
  aspect: 'South',
  density: 5000, // 5,000 vines per hectare (standard)
  vineyardHealth: 1.0, // Perfect health (100%)
  landValue: 50000,
  vineyardTotalValue: 50000,
  status: 'Planted',
  ripeness: 0.8, // 80% ripe (good but not perfect)
  vineyardPrestige: 0,
  vineYield: 1.0 // Mature vines (100% yield potential)
};

describe('calculateVineyardYield - Core Yield Formula', () => {
  
  describe('Edge Cases - Prevents Game-Breaking Bugs', () => {
    it('returns 0 kg when vineyard has no grape variety planted (cannot harvest barren land)', () => {
      // SCENARIO: Player hasn't planted grapes yet
      // EXPECTED: No yield possible
      // WHY IT MATTERS: Prevents harvesting from empty vineyards
      const vineyard: Vineyard = {
        ...baseVineyard,
        grape: null
      };

      const yield_ = calculateVineyardYield(vineyard);
      
      // Game rule: Unplanted vineyards produce zero grapes
      expect(yield_).toBe(0);
    });

    it('returns 0 kg when grapes are unripe (harvesting too early produces nothing)', () => {
      // SCENARIO: Player tries to harvest at 0% ripeness
      // EXPECTED: Zero yield (grapes not ready)
      // WHY IT MATTERS: Forces players to wait for proper harvest timing
      const vineyard: Vineyard = {
        ...baseVineyard,
        ripeness: 0
      };

      const yield_ = calculateVineyardYield(vineyard);
      
      // Game rule: Unripe grapes cannot be harvested
      expect(yield_).toBe(0);
    });

    it('handles missing optional fields gracefully (prevents crashes from incomplete data)', () => {
      // SCENARIO: Database returns incomplete vineyard data
      // EXPECTED: Function doesn't crash, returns 0 safely
      // WHY IT MATTERS: Prevents save file corruption or migration issues from breaking the game
      const vineyard: Vineyard = {
        ...baseVineyard,
        ripeness: undefined as any, // Missing data
        vineyardHealth: undefined as any,
        vineYield: undefined as any
      };

      // Should not throw an error - gracefully handles missing data
      const yield_ = calculateVineyardYield(vineyard);
      
      // Missing ripeness defaults to 0, which zeros the yield
      expect(yield_).toBe(0);
    });
  });

  describe('Scale Factors - Ensures Realistic Vineyard Economics', () => {
    it('yield scales proportionally with vineyard size (2 hectares = 2x grapes)', () => {
      // SCENARIO: Player buys a larger vineyard
      // EXPECTED: Double the size = double the grapes (all else equal)
      // WHY IT MATTERS: Makes vineyard purchases economically sensible
      // 
      // EXAMPLE:
      // 1 hectare → ~12,000 kg grapes
      // 2 hectares → ~24,000 kg grapes
      const vineyard1: Vineyard = {
        ...baseVineyard
      };

      const vineyard2: Vineyard = {
        ...baseVineyard,
        hectares: 2
      };

      const yield1 = calculateVineyardYield(vineyard1);
      const yield2 = calculateVineyardYield(vineyard2);

      // Business rule: Larger vineyards produce proportionally more grapes
      expect(yield2).toBeGreaterThan(yield1);
      // Should be roughly double (allowing for rounding)
      expect(yield2).toBeCloseTo(yield1 * 2, -2); // Within 2 orders of magnitude
    });

    it('yield scales proportionally with vine density (more vines = more grapes)', () => {
      // SCENARIO: High-density planting vs standard density
      // EXPECTED: More vines per hectare = more grapes
      // WHY IT MATTERS: Dense planting is a valid strategy (though requires more work)
      //
      // EXAMPLE:
      // 2,500 vines/ha → ~6,000 kg
      // 5,000 vines/ha → ~12,000 kg
      const vineyard1: Vineyard = {
        ...baseVineyard,
        density: 2500 // Lower density
      };

      // Standard density (5000) - already in baseVineyard
      const vineyard2: Vineyard = {
        ...baseVineyard
      };

      const yield1 = calculateVineyardYield(vineyard1);
      const yield2 = calculateVineyardYield(vineyard2);

      // Game mechanic: Density directly affects yield
      expect(yield2).toBeGreaterThan(yield1);
      expect(yield2).toBeCloseTo(yield1 * 2, -2);
    });
  });

  describe('Quality Multipliers - Rewards Good Vineyard Management', () => {
    it('damaged vineyards (50% health) produce roughly half the yield of healthy ones', () => {
      // SCENARIO: Neglected vineyard vs well-maintained vineyard
      // EXPECTED: Poor health = lower yields
      // WHY IT MATTERS: Incentivizes players to maintain vineyards (clearing activities)
      //
      // EXAMPLE:
      // Healthy (100%): ~12,000 kg
      // Damaged (50%): ~6,000 kg
      // Perfect health (1.0) - already in baseVineyard
      const healthyVineyard: Vineyard = {
        ...baseVineyard
      };

      const damagedVineyard: Vineyard = {
        ...baseVineyard,
        vineyardHealth: 0.5 // Poor health (from neglect)
      };

      const healthyYield = calculateVineyardYield(healthyVineyard);
      const damagedYield = calculateVineyardYield(damagedVineyard);

      // Game rule: Health multiplier directly reduces yield
      expect(damagedYield).toBeLessThan(healthyYield);
      expect(damagedYield).toBeCloseTo(healthyYield * 0.5, -2);
    });

    it('riper grapes (80%) produce roughly double the yield of unripe grapes (40%)', () => {
      // SCENARIO: Early harvest vs optimal harvest timing
      // EXPECTED: Waiting for ripeness = significantly more grapes
      // WHY IT MATTERS: Creates strategic timing decisions (harvest early or wait?)
      //
      // EXAMPLE:
      // Unripe (40%): ~6,000 kg
      // Ripe (80%): ~12,000 kg
      const unripeVineyard: Vineyard = {
        ...baseVineyard,
        ripeness: 0.4 // Early harvest
      };

      const ripeVineyard: Vineyard = {
        ...baseVineyard,
        ripeness: 0.8 // Optimal harvest time
      };

      const unripeYield = calculateVineyardYield(unripeVineyard);
      const ripeYield = calculateVineyardYield(ripeVineyard);

      // Game mechanic: Ripeness is a direct multiplier on yield
      expect(ripeYield).toBeGreaterThan(unripeYield);
      expect(ripeYield).toBeCloseTo(unripeYield * 2, -2);
    });

    it('mature vines (100% yield) produce double the yield of young vines (50% yield)', () => {
      // SCENARIO: Newly planted vineyard vs established vineyard
      // EXPECTED: Vine age affects yield potential
      // WHY IT MATTERS: Rewards long-term vineyard investments
      //
      // EXAMPLE:
      // Young vines (50%): ~6,000 kg
      // Mature vines (100%): ~12,000 kg
      const youngVineyard: Vineyard = {
        ...baseVineyard,
        vineYield: 0.5 // Young vines (just planted)
      };

      // Mature vines (1.0) - already in baseVineyard
      const matureVineyard: Vineyard = {
        ...baseVineyard
      };

      const youngYield = calculateVineyardYield(youngVineyard);
      const matureYield = calculateVineyardYield(matureVineyard);

      // Game progression: Vines improve with age
      expect(matureYield).toBeGreaterThan(youngYield);
      expect(matureYield).toBeCloseTo(youngYield * 2, -2);
    });
  });

  describe('Realistic Scenarios - Validates Game Balance', () => {
    it('produces realistic yields for an optimal 5-hectare vineyard', () => {
      // SCENARIO: Perfect vineyard setup (5 hectares, optimal conditions)
      // EXPECTED: Substantial but realistic yield
      // WHY IT MATTERS: Ensures the economy scales correctly for larger operations
      //
      // REAL-WORLD CONTEXT:
      // 5 hectares × 5,000 vines/ha = 25,000 vines
      // In reality: ~15-25 kg per vine = 375,000-625,000 kg
      // Game baseline: 1.5 kg/vine × multipliers = ~30,000-50,000 kg (scaled down for gameplay)
      // density: 5000, vineYield: 1.0, grape: 'Sangiovese' - already in baseVineyard
      const optimalVineyard: Vineyard = {
        ...baseVineyard,
        hectares: 5,
        ripeness: 0.9, // Very ripe
        vineyardHealth: 0.95, // Excellent health
        vineyardTotalValue: 250000 // Updated for 5 hectares
      };

      const yield_ = calculateVineyardYield(optimalVineyard);

      // Should produce a substantial yield (makes large vineyards worthwhile)
      expect(yield_).toBeGreaterThan(10000); // At least 10,000 kg
      // But not excessive (keeps economy balanced)
      expect(yield_).toBeLessThan(100000); // But not more than 100,000 kg
    });

    it('minimum health vineyards (10%) still produce some yield (prevents total crop failure)', () => {
      // SCENARIO: Severely neglected vineyard at minimum health threshold
      // EXPECTED: Still produces some grapes (10% of normal)
      // WHY IT MATTERS: Prevents players from losing everything, allows recovery
      const minHealthVineyard: Vineyard = {
        ...baseVineyard,
        vineyardHealth: 0.1 // Minimum health (10%)
      };

      const yield_ = calculateVineyardYield(minHealthVineyard);
      const maxYield = calculateVineyardYield({ ...baseVineyard, vineyardHealth: 1.0 });

      // Game design: Even terrible vineyards produce something
      expect(yield_).toBeGreaterThan(0);
      // Should be roughly 10% of maximum yield
      expect(yield_).toBeLessThan(maxYield);
      expect(yield_).toBeLessThan(maxYield * 0.15); // Within reasonable range
    });
  });
});
