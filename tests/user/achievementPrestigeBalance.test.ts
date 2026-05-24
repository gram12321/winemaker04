import { describe, expect, it } from 'vitest';
import { achievementLevels } from '@/lib/constants/achievementConstants';

describe('achievement prestige balance', () => {
  it('uses the reduced active achievement prestige tier values', () => {
    expect(achievementLevels[1].prestige).toBe(0.1);
    expect(achievementLevels[2].prestige).toBe(3);
    expect(achievementLevels[3].prestige).toBe(20);
    expect(achievementLevels[4].prestige).toBe(100);
    expect(achievementLevels[5].prestige).toBe(300);
  });
});
