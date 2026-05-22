import { describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/utils/utils';

describe('formatNumber currency formatting', () => {
  it('uses the euro symbol for invalid currency values', () => {
    expect(formatNumber(Number.NaN, { currency: true })).toBe('€0');
  });

  it('uses the euro symbol for compact currency formatting', () => {
    expect(formatNumber(1234567, { currency: true, compact: true })).toBe('€1.2M');
  });

  it('uses the euro symbol for standard currency formatting', () => {
    expect(formatNumber(1234.56, { currency: true })).toBe('€1,235');
  });
});
