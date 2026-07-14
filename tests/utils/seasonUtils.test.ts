import { describe, expect, it } from 'vitest';
import { getNextSeasonDate } from '@/lib/utils';

describe('getNextSeasonDate', () => {
  it('advances to the next season without changing the year', () => {
    expect(getNextSeasonDate('Spring', 2026)).toEqual({ season: 'Summer', year: 2026 });
  });

  it('advances Summer to Fall without changing the year', () => {
    expect(getNextSeasonDate('Summer', 2026)).toEqual({ season: 'Fall', year: 2026 });
  });

  it('advances Fall to Winter without changing the year', () => {
    expect(getNextSeasonDate('Fall', 2026)).toEqual({ season: 'Winter', year: 2026 });
  });

  it('rolls Winter over to Spring in the following year', () => {
    expect(getNextSeasonDate('Winter', 2026)).toEqual({ season: 'Spring', year: 2027 });
  });
});
