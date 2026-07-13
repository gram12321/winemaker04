import { describe, expect, it } from 'vitest';
import { achievementsFeature } from '@/lib/features/achievements';

describe('achievement prestige balance', () => {
  it('uses the reduced active achievement prestige tier values', () => {
    expect(achievementsFeature.catalog.getLevelInfo(1).prestige).toBe(0.1);
    expect(achievementsFeature.catalog.getLevelInfo(2).prestige).toBe(3);
    expect(achievementsFeature.catalog.getLevelInfo(3).prestige).toBe(20);
    expect(achievementsFeature.catalog.getLevelInfo(4).prestige).toBe(100);
    expect(achievementsFeature.catalog.getLevelInfo(5).prestige).toBe(300);
  });
});
