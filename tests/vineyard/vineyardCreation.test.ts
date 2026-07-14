import { describe, expect, it, vi } from 'vitest';
import { getRandomHectares, HECTARE_BUCKETS } from '@/lib/utils/calculator';

describe('getRandomHectares', () => {
  it('selects every configured bucket at its weighted boundary', () => {
    const totalWeight = HECTARE_BUCKETS.reduce((sum, bucket) => sum + bucket.w, 0);
    let cumulativeWeight = 0;

    for (const bucket of HECTARE_BUCKETS) {
      const bucketDraw = (cumulativeWeight + bucket.w / 2) / totalWeight;
      const random = vi.spyOn(Math, 'random')
        .mockReturnValueOnce(bucketDraw)
        .mockReturnValueOnce(0.5);

      const hectares = getRandomHectares();

      expect(hectares).toBeGreaterThanOrEqual(bucket.min);
      expect(hectares).toBeLessThanOrEqual(bucket.max);
      expect(hectares).toBeGreaterThanOrEqual(0.05);
      expect(hectares).toBeLessThanOrEqual(2000);
      expect(Number(hectares.toFixed(2))).toBe(hectares);

      random.mockRestore();
      cumulativeWeight += bucket.w;
    }
  });

  it('rounds the generated size to hundredths without leaving its bucket', () => {
    const bucket = HECTARE_BUCKETS[1];
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.123456);

    const hectares = getRandomHectares();

    expect(hectares).toBeGreaterThanOrEqual(bucket.min);
    expect(hectares).toBeLessThan(bucket.max);
    expect(hectares.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    random.mockRestore();
  });
});
