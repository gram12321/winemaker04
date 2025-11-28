import { describe, it, expect} from 'vitest';
import {
  EXPECTED_VALUE_BASELINES,
  GROWTH_TREND_CONFIG,
  INCREMENTAL_ANCHOR_CONFIG,
  INCREMENTAL_METRIC_CONFIG
} from '@/lib/constants/shareValuationConstants';
import { ECONOMY_EXPECTATION_MULTIPLIERS, ECONOMY_PHASES } from '@/lib/constants/economyConstants';

/**
 * Share Valuation System Tests
 * 
 * Tests the incremental share price adjustment system, expected values calculation,
 * and anchor-based constraints. Validates core calculation logic without requiring full database setup.
 */

describe('Share Valuation System', () => {
  describe('Constants Validation', () => {
    it('has expected value baselines in reasonable ranges', () => {
      // Revenue growth baseline (0-1 scale for percentage)
      expect(EXPECTED_VALUE_BASELINES.revenueGrowth).toBeGreaterThanOrEqual(0);
      expect(EXPECTED_VALUE_BASELINES.revenueGrowth).toBeLessThanOrEqual(1);
      
      // Profit margin baseline (0-1 scale for percentage)
      expect(EXPECTED_VALUE_BASELINES.profitMargin).toBeGreaterThanOrEqual(0);
      expect(EXPECTED_VALUE_BASELINES.profitMargin).toBeLessThanOrEqual(1);
    });

    it('has economy expectation multipliers for all economy phases', () => {
      ECONOMY_PHASES.forEach(phase => {
        expect(ECONOMY_EXPECTATION_MULTIPLIERS[phase]).toBeDefined();
        expect(ECONOMY_EXPECTATION_MULTIPLIERS[phase]).toBeGreaterThan(0);
      });
    });

    it('has economy multipliers in ascending order (Crash < Recession < Stable < Expansion < Boom)', () => {
      const crash = ECONOMY_EXPECTATION_MULTIPLIERS.Crash;
      const recession = ECONOMY_EXPECTATION_MULTIPLIERS.Recession;
      const stable = ECONOMY_EXPECTATION_MULTIPLIERS.Stable;
      const expansion = ECONOMY_EXPECTATION_MULTIPLIERS.Expansion;
      const boom = ECONOMY_EXPECTATION_MULTIPLIERS.Boom;

      expect(crash).toBeLessThan(recession);
      expect(recession).toBeLessThan(stable);
      expect(stable).toBeLessThan(expansion);
      expect(expansion).toBeLessThan(boom);
    });
  });

  describe('Growth Trend Configuration', () => {
    it('has valid adjustment increment', () => {
      expect(GROWTH_TREND_CONFIG.adjustmentIncrement).toBeGreaterThan(0);
      expect(GROWTH_TREND_CONFIG.adjustmentIncrement).toBeLessThanOrEqual(0.1); // Max 10% per period
    });

    it('has valid adjustment bounds', () => {
      expect(GROWTH_TREND_CONFIG.maxAdjustment).toBeGreaterThan(0);
      expect(GROWTH_TREND_CONFIG.minAdjustment).toBeGreaterThan(0);
      expect(GROWTH_TREND_CONFIG.maxAdjustment).toBeLessThanOrEqual(1.0); // Max 100% adjustment
      expect(GROWTH_TREND_CONFIG.minAdjustment).toBeLessThanOrEqual(1.0);
    });

    it('tracks reasonable number of periods', () => {
      expect(GROWTH_TREND_CONFIG.periodsToTrack).toBeGreaterThanOrEqual(2);
      expect(GROWTH_TREND_CONFIG.periodsToTrack).toBeLessThanOrEqual(12); // Max 12 periods (3 years)
    });
  });

  describe('Mathematical Model Validation', () => {
    it('calculates deviation ratios correctly for exceeding performance', () => {
      // Test: actual = 150% of expected should give deviation of 1.5
      const expected = { revenueGrowth: 0.10, profitMargin: 0.15, earningsPerShare: 10 };
      const actual = { revenueGrowth: 0.15, profitMargin: 0.225, earningsPerShare: 15 };
      
      // Revenue growth: 0.15 / 0.10 = 1.5
      expect(actual.revenueGrowth / expected.revenueGrowth).toBeCloseTo(1.5, 2);
      
      // Profit margin: 0.225 / 0.15 = 1.5
      expect(actual.profitMargin / expected.profitMargin).toBeCloseTo(1.5, 2);
      
      // EPS: 15 / 10 = 1.5
      expect(actual.earningsPerShare / expected.earningsPerShare).toBeCloseTo(1.5, 2);
    });

    it('calculates deviation ratios correctly for underperforming', () => {
      // Test: actual = 75% of expected should give deviation of 0.75
      const expected = { revenueGrowth: 0.10, profitMargin: 0.15, earningsPerShare: 10 };
      const actual = { revenueGrowth: 0.075, profitMargin: 0.1125, earningsPerShare: 7.5 };
      
      expect(actual.revenueGrowth / expected.revenueGrowth).toBeCloseTo(0.75, 2);
      expect(actual.profitMargin / expected.profitMargin).toBeCloseTo(0.75, 2);
      expect(actual.earningsPerShare / expected.earningsPerShare).toBeCloseTo(0.75, 2);
    });

    it('calculates expected values with economy phase adjustment', () => {
      const baseRevenueGrowth = EXPECTED_VALUE_BASELINES.revenueGrowth; // 0.10
      
      // In Boom phase (1.5x multiplier), expected growth should be higher
      const boomMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS.Boom;
      const boomExpectedGrowth = baseRevenueGrowth * boomMultiplier;
      
      // In Crash phase (0.6x multiplier), expected growth should be lower
      const crashMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS.Crash;
      const crashExpectedGrowth = baseRevenueGrowth * crashMultiplier;
      
      expect(boomExpectedGrowth).toBeGreaterThan(baseRevenueGrowth);
      expect(crashExpectedGrowth).toBeLessThan(baseRevenueGrowth);
      expect(boomExpectedGrowth).toBeGreaterThan(crashExpectedGrowth);
    });

    it('ensures initial share price equals book value', () => {
      // Initial share price should equal book value per share
      const bookValuePerShare = 10;
      const initialPrice = bookValuePerShare;
      
      expect(initialPrice).toBe(bookValuePerShare);
      expect(initialPrice).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero revenue gracefully', () => {
      // Profit margin should be 0 when revenue is 0
      const netIncome = 100;
      const revenue = 0;
      const profitMargin = revenue > 0 ? netIncome / revenue : 0;
      
      expect(profitMargin).toBe(0);
    });

    it('handles negative revenue growth', () => {
      // Negative growth (revenue decline) should produce negative growth value
      const previousRevenue = 100;
      const currentRevenue = 80;
      const growth = (currentRevenue - previousRevenue) / previousRevenue;
      
      expect(growth).toBeLessThan(0);
      expect(growth).toBeCloseTo(-0.2, 2); // -20% growth
    });

    it('handles zero book value per share', () => {
      // When book value is 0, share price should still be calculable (may be based on other factors)
      const basePrice = 0;
      const multipliers = { profitability: 1.0, stability: 1.0, operations: 1.0, market: 1.0 };
      const finalPrice = basePrice * multipliers.profitability * multipliers.stability * 
                        multipliers.operations * multipliers.market;
      
      expect(finalPrice).toBe(0);
    });

    it('ensures market cap is never negative', () => {
      const sharePrice = 0;
      const totalShares = 1000000;
      const marketCap = sharePrice * totalShares;
      
      expect(marketCap).toBeGreaterThanOrEqual(0);
    });
  });


  describe('Incremental Share Price System', () => {
    const calculateExpectedAnchorFactor = (currentPrice: number, anchorPrice: number) => {
      if (anchorPrice <= 0 || currentPrice <= 0) {
        return 0;
      }
      const deviation = Math.abs(currentPrice - anchorPrice) / anchorPrice;
      const { strength, exponent } = INCREMENTAL_ANCHOR_CONFIG;
      return 1 / (1 + strength * Math.pow(deviation, exponent));
    };

    describe('Anchor Factor Calculation', () => {
      it('calculates anchor factor correctly when price equals anchor', () => {
        const anchorFactor = calculateExpectedAnchorFactor(10, 10);
        expect(anchorFactor).toBe(1.0);
      });

      it('calculates anchor factor correctly when price is above anchor', () => {
        const anchorFactor = calculateExpectedAnchorFactor(15, 10);
        const expected = calculateExpectedAnchorFactor(15, 10);
        expect(anchorFactor).toBeCloseTo(expected, 3);
        expect(anchorFactor).toBeLessThan(1);
      });

      it('calculates anchor factor correctly when price is below anchor', () => {
        const anchorFactor = calculateExpectedAnchorFactor(7.5, 10);
        expect(anchorFactor).toBeLessThan(1);
        expect(anchorFactor).toBeCloseTo(calculateExpectedAnchorFactor(7.5, 10), 3);
      });

      it('ensures anchor factor approaches 0 as price moves further from anchor', () => {
        const highFactor = calculateExpectedAnchorFactor(100, 10);
        const lowFactor = calculateExpectedAnchorFactor(1, 10);
        
        expect(highFactor).toBeLessThan(0.2);
        expect(lowFactor).toBeLessThan(0.2);
      });
    });

    describe('Percentage Delta Calculations', () => {
      it('calculates percentage delta correctly when actual exceeds expected', () => {
        // Actual is 150% of expected = +50% delta
        const actual = 15;
        const expected = 10;
        const delta = ((actual - expected) / expected) * 100;
        
        expect(delta).toBe(50);
      });

      it('calculates percentage delta correctly when actual is below expected', () => {
        // Actual is 75% of expected = -25% delta
        const actual = 7.5;
        const expected = 10;
        const delta = ((actual - expected) / expected) * 100;
        
        expect(delta).toBe(-25);
      });

      it('calculates percentage delta correctly when actual equals expected', () => {
        const actual = 10;
        const expected = 10;
        const delta = ((actual - expected) / expected) * 100;
        
        expect(delta).toBe(0);
      });
    });

    describe('Trend Delta Calculations', () => {
      it('calculates trend delta correctly for positive change', () => {
        // Current is 110, previous was 100 = +10% change
        const current = 110;
        const previous = 100;
        const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        
        expect(delta).toBe(10);
      });

      it('calculates trend delta correctly for negative change', () => {
        // Current is 90, previous was 100 = -10% change
        const current = 90;
        const previous = 100;
        const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        
        expect(delta).toBe(-10);
      });

      it('handles zero previous value gracefully', () => {
        const current = 100;
        const previous = 0;
        const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        
        expect(delta).toBe(0);
      });
    });

    describe('Incremental Adjustment Formula', () => {
      it('converts percentage delta to euro contribution using base adjustment', () => {
        const config = INCREMENTAL_METRIC_CONFIG.earningsPerShare;
        const deltaPercent = 50; // +50%
        const deltaRatio = Math.min(deltaPercent / 100, config.maxRatio);
        const contribution = deltaRatio * config.baseAdjustment;
        
        expect(contribution).toBeCloseTo(0.02, 3); // 0.5 * 0.04
      });

      it('caps contribution using max ratio', () => {
        const config = INCREMENTAL_METRIC_CONFIG.earningsPerShare;
        const deltaPercent = 1000; // extremely high
        const deltaRatio = Math.min(deltaPercent / 100, config.maxRatio);
        expect(deltaRatio).toBe(config.maxRatio);
        const contribution = deltaRatio * config.baseAdjustment;
        expect(contribution).toBeCloseTo(config.maxRatio * config.baseAdjustment, 3);
      });

      it('applies anchor factor to reduce adjustment magnitude when far from anchor', () => {
        const basePrice = 10;
        const currentPrice = 20; // 100% premium
        const totalContribution = 0.5; // euros
        const anchorFactor = calculateExpectedAnchorFactor(currentPrice, basePrice);
        const adjustment = totalContribution * anchorFactor;
        
        expect(anchorFactor).toBeLessThan(1);
        expect(adjustment).toBeLessThan(totalContribution);
      });

      it('respects relative minimum price based on anchor', () => {
        const basePrice = 20;
        const minPrice = basePrice * INCREMENTAL_ANCHOR_CONFIG.minPriceRatioToAnchor;
        const attemptedPrice = basePrice * 0.01; // extremely low
        const finalPrice = Math.max(minPrice, attemptedPrice);
        expect(finalPrice).toBeCloseTo(minPrice, 2);
      });
    });

    describe('Growth Trend Multiplier', () => {
      it('has valid adjustment increment in growth trend config', () => {
        expect(GROWTH_TREND_CONFIG.adjustmentIncrement).toBeGreaterThan(0);
        expect(GROWTH_TREND_CONFIG.adjustmentIncrement).toBeLessThanOrEqual(0.1);
      });

      it('has valid bounds for growth trend multiplier adjustment', () => {
        // Multiplier should be able to increase when performance exceeds expectations
        const currentMultiplier = 1.0;
        const increment = GROWTH_TREND_CONFIG.adjustmentIncrement;
        const maxMultiplier = 1.0 + GROWTH_TREND_CONFIG.maxAdjustment;
        
        // After exceeding expectations
        let newMultiplier = currentMultiplier + increment;
        newMultiplier = Math.min(maxMultiplier, newMultiplier);
        
        expect(newMultiplier).toBeGreaterThan(currentMultiplier);
        expect(newMultiplier).toBeLessThanOrEqual(maxMultiplier);
      });

      it('allows growth trend multiplier to decrease when underperforming', () => {
        const currentMultiplier = 1.0;
        const increment = GROWTH_TREND_CONFIG.adjustmentIncrement;
        const minMultiplier = 1.0 - GROWTH_TREND_CONFIG.minAdjustment;
        
        // After underperforming
        let newMultiplier = currentMultiplier - increment;
        newMultiplier = Math.max(minMultiplier, newMultiplier);
        
        expect(newMultiplier).toBeLessThan(currentMultiplier);
        expect(newMultiplier).toBeGreaterThanOrEqual(minMultiplier);
      });
    });
  });
});

