import { describe, it, expect } from 'vitest';
import { getRandomHectares, HECTARE_BUCKETS } from '@/lib/utils/calculator';

/**
 * Human Automation Test: Vineyard Creation - Size Distribution
 * 
 * This test validates that vineyard creation produces realistic size distributions
 * matching the expected probability buckets. This is critical for game balance
 * and ensures players encounter a realistic mix of small, medium, and large vineyards.
 * 
 * Manual testing equivalent: Creating 100+ vineyards and checking size distribution
 */

describe('Vineyard Creation - Size Distribution', () => {
  describe('getRandomHectares() distribution validation', () => {
    it('generates hectares within valid range (0.05 to 2000)', () => {
      const samples = Array.from({ length: 1000 }, () => getRandomHectares());
      
      samples.forEach(hectares => {
        expect(hectares).toBeGreaterThanOrEqual(0.05);
        expect(hectares).toBeLessThanOrEqual(2000);
      });
    });

    it('generates hectares with 0.01 precision (2 decimal places)', () => {
      const samples = Array.from({ length: 100 }, () => getRandomHectares());
      
      samples.forEach(hectares => {
        const decimals = hectares.toString().split('.')[1] || '';
        expect(decimals.length).toBeLessThanOrEqual(2);
      });
    });

    it('distributes vineyards across size buckets with expected probabilities', () => {
      const sampleSize = 10000; // Large sample for statistical validation
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      // Count how many fall into each bucket
      const bucketCounts = HECTARE_BUCKETS.map(bucket => ({
        bucket,
        count: samples.filter(ha => ha >= bucket.min && ha < bucket.max).length
      }));
      
      // Calculate total weight for normalization
      const totalWeight = HECTARE_BUCKETS.reduce((sum, b) => sum + b.w, 0);
      
      // Validate each bucket's distribution (allow ±5% tolerance for randomness)
      bucketCounts.forEach(({ bucket, count }) => {
        const expectedProportion = bucket.w / totalWeight;
        const actualProportion = count / sampleSize;
        const tolerance = 0.05; // 5% tolerance
        
        expect(actualProportion).toBeGreaterThanOrEqual(expectedProportion - tolerance);
        expect(actualProportion).toBeLessThanOrEqual(expectedProportion + tolerance);
      });
    });

    it('produces more small vineyards (0.05-2.5 ha) than large ones (10+ ha)', () => {
      const sampleSize = 5000;
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const smallCount = samples.filter(ha => ha >= 0.05 && ha < 2.5).length;
      const largeCount = samples.filter(ha => ha >= 10).length;
      
      // Small vineyards should be significantly more common
      expect(smallCount).toBeGreaterThan(largeCount * 10); // At least 10x more common
    });

    it('produces very small vineyards (0.05-0.5 ha) at expected rate (~25%)', () => {
      const sampleSize = 5000;
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const verySmallCount = samples.filter(ha => ha >= 0.05 && ha < 0.5).length;
      const proportion = verySmallCount / sampleSize;
      
      // Very small bucket has weight 0.25, should be ~25% of samples (±5% tolerance)
      expect(proportion).toBeGreaterThanOrEqual(0.20); // 20% minimum
      expect(proportion).toBeLessThanOrEqual(0.30);    // 30% maximum
    });

    it('produces small vineyards (0.5-2.5 ha) at expected rate (~35%)', () => {
      const sampleSize = 5000;
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const smallCount = samples.filter(ha => ha >= 0.5 && ha < 2.5).length;
      const proportion = smallCount / sampleSize;
      
      // Small bucket has weight 0.35, should be ~35% of samples (±5% tolerance)
      expect(proportion).toBeGreaterThanOrEqual(0.30); // 30% minimum
      expect(proportion).toBeLessThanOrEqual(0.40);    // 40% maximum
    });

    it('produces medium vineyards (2.5-5 ha) at expected rate (~28%)', () => {
      const sampleSize = 5000;
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const mediumCount = samples.filter(ha => ha >= 2.5 && ha < 5).length;
      const proportion = mediumCount / sampleSize;
      
      // Medium bucket has weight 0.28, should be ~28% of samples (±5% tolerance)
      expect(proportion).toBeGreaterThanOrEqual(0.23); // 23% minimum
      expect(proportion).toBeLessThanOrEqual(0.33);    // 33% maximum
    });

    it('produces large vineyards (5-10 ha) at expected rate (~7%)', () => {
      const sampleSize = 5000;
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const largeCount = samples.filter(ha => ha >= 5 && ha < 10).length;
      const proportion = largeCount / sampleSize;
      
      // Large bucket has weight 0.07, should be ~7% of samples (±3% tolerance for rare events)
      expect(proportion).toBeGreaterThanOrEqual(0.04); // 4% minimum
      expect(proportion).toBeLessThanOrEqual(0.10);    // 10% maximum
    });

    it('produces very large vineyards (10+ ha) at expected rare rate (~5.5% combined)', () => {
      const sampleSize = 10000; // Larger sample for rare events
      const samples = Array.from({ length: sampleSize }, () => getRandomHectares());
      
      const veryLargeCount = samples.filter(ha => ha >= 10).length;
      const proportion = veryLargeCount / sampleSize;
      
      // Combined weights for 10+ ha buckets: 0.03 + 0.014 + 0.005 + 0.001 = 0.05 (5%)
      // Allow ±2% tolerance for rare events
      expect(proportion).toBeGreaterThanOrEqual(0.03); // 3% minimum
      expect(proportion).toBeLessThanOrEqual(0.07);    // 7% maximum
    });

    it('never produces hectares below 0.05 (minimum bucket)', () => {
      const samples = Array.from({ length: 1000 }, () => getRandomHectares());
      
      samples.forEach(hectares => {
        expect(hectares).toBeGreaterThanOrEqual(0.05);
      });
    });

    it('produces hectares that fall within defined bucket ranges', () => {
      const samples = Array.from({ length: 1000 }, () => getRandomHectares());
      
      samples.forEach(hectares => {
        const inAnyBucket = HECTARE_BUCKETS.some(
          bucket => hectares >= bucket.min && hectares < bucket.max
        );
        // Last bucket is inclusive of max, so check separately
        const inLastBucket = hectares >= HECTARE_BUCKETS[HECTARE_BUCKETS.length - 1].min &&
                            hectares <= HECTARE_BUCKETS[HECTARE_BUCKETS.length - 1].max;
        
        expect(inAnyBucket || inLastBucket).toBe(true);
      });
    });
  });
});

