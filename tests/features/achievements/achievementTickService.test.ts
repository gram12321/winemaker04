import { afterEach, describe, expect, it } from 'vitest';
import {
  resetAchievementTickScheduleForTests,
  recordAchievementCheck,
  shouldRunAchievementCheck,
} from '../../../src/lib/features/achievements/achievementTickService';

describe('achievement tick cadence', () => {
  afterEach(() => {
    resetAchievementTickScheduleForTests();
  });

  it('tracks the check interval independently for each company', () => {
    expect(shouldRunAchievementCheck('company-a', 100)).toBe(true);
    recordAchievementCheck('company-a', 100);
    expect(shouldRunAchievementCheck('company-a', 101)).toBe(false);
    expect(shouldRunAchievementCheck('company-b', 10)).toBe(true);
    expect(shouldRunAchievementCheck('company-a', 104)).toBe(true);
  });

  it('runs immediately when a company timeline moves backwards', () => {
    expect(shouldRunAchievementCheck('company-a', 100)).toBe(true);
    recordAchievementCheck('company-a', 100);
    expect(shouldRunAchievementCheck('company-a', 10)).toBe(true);
  });
});
