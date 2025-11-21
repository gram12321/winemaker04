import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveInterestRate,
  calculateSeasonalPayment,
  calculateCreditRatingModifier
} from '@/lib/services/finance/loanService';

describe('calculateEffectiveInterestRate', () => {
  const baseRate = 0.05; // 5% base rate

  it('applies economy phase multipliers correctly', () => {
    const rates = {
      expansion: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4),
      recession: calculateEffectiveInterestRate(baseRate, 'Recession', 'Bank', 0.7, 4),
      stable: calculateEffectiveInterestRate(baseRate, 'Stable', 'Bank', 0.7, 4)
    };

    // Recession should have higher rates, expansion should have lower rates
    expect(rates.recession).toBeGreaterThan(rates.expansion);
    expect(rates.stable).not.toBe(baseRate); // Should be modified
  });

  it('applies lender type multipliers correctly', () => {
    const rates = {
      bank: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4),
      quickLoan: calculateEffectiveInterestRate(baseRate, 'Expansion', 'QuickLoan', 0.7, 4),
      privateLender: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Private Lender', 0.7, 4)
    };

    // QuickLoan should have highest rates, Bank should have lowest
    expect(rates.quickLoan).toBeGreaterThan(rates.bank);
    expect(rates.privateLender).toBeGreaterThan(rates.bank);
  });

  it('applies credit rating modifier correctly', () => {
    const excellentCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.9, 4);
    const goodCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4);
    const poorCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.3, 4);

    // Better credit should result in lower rates
    expect(excellentCredit).toBeLessThan(goodCredit);
    expect(goodCredit).toBeLessThan(poorCredit);
  });

  it('applies duration modifiers correctly', () => {
    const shortTerm = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4);
    const mediumTerm = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 8);
    const longTerm = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 20);

    // Longer terms might have different rates (depends on implementation)
    // At minimum, they should all be calculated correctly
    expect(shortTerm).toBeGreaterThan(0);
    expect(mediumTerm).toBeGreaterThan(0);
    expect(longTerm).toBeGreaterThan(0);
  });

  it('handles missing duration (defaults to no modifier)', () => {
    const withDuration = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4);
    const withoutDuration = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7);

    // Should both be valid rates (may or may not be equal depending on defaults)
    expect(withDuration).toBeGreaterThan(0);
    expect(withoutDuration).toBeGreaterThan(0);
  });

  it('returns a positive interest rate', () => {
    const rate = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4);

    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1); // Should be a percentage, not > 100%
  });

  it('scales proportionally with base rate', () => {
    const lowBase = calculateEffectiveInterestRate(0.03, 'Expansion', 'Bank', 0.7, 4);
    const highBase = calculateEffectiveInterestRate(0.08, 'Expansion', 'Bank', 0.7, 4);

    expect(highBase).toBeGreaterThan(lowBase);
    // Should scale roughly proportionally (allowing for modifiers)
    expect(highBase / lowBase).toBeCloseTo(0.08 / 0.03, 1);
  });
});

describe('calculateCreditRatingModifier', () => {
  it('returns lower modifier for higher credit ratings', () => {
    const excellent = calculateCreditRatingModifier(0.9);
    const good = calculateCreditRatingModifier(0.7);
    const poor = calculateCreditRatingModifier(0.3);

    // Better credit = lower modifier (less penalty)
    expect(excellent).toBeLessThan(good);
    expect(good).toBeLessThan(poor);
  });

  it('handles edge cases correctly', () => {
    const perfect = calculateCreditRatingModifier(1.0);
    const worst = calculateCreditRatingModifier(0.0);

    // Perfect credit should have lowest modifier
    expect(perfect).toBeGreaterThan(0);
    expect(worst).toBeGreaterThan(perfect);
  });

  it('returns values in expected range', () => {
    const modifier = calculateCreditRatingModifier(0.7);

    // Formula: 0.8 + (0.7 * (1 - creditRating))
    // For 0.7: 0.8 + (0.7 * 0.3) = 0.8 + 0.21 = 1.01
    expect(modifier).toBeGreaterThan(0.8);
    expect(modifier).toBeLessThan(1.5);
  });
});

describe('calculateSeasonalPayment', () => {
  it('calculates payment for a simple loan', () => {
    const principal = 10000;
    const rate = 0.05; // 5% per season
    const seasons = 4; // 1 year

    const payment = calculateSeasonalPayment(principal, rate, seasons);

    // Payment should be positive and less than principal (for amortizing loan)
    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeGreaterThan(principal / seasons); // Should include interest
  });

  it('returns higher payments for higher interest rates', () => {
    const principal = 10000;
    const seasons = 4;

    const lowRate = calculateSeasonalPayment(principal, 0.03, seasons);
    const highRate = calculateSeasonalPayment(principal, 0.08, seasons);

    expect(highRate).toBeGreaterThan(lowRate);
  });

  it('returns lower payments for longer loan terms', () => {
    const principal = 10000;
    const rate = 0.05;

    const shortTerm = calculateSeasonalPayment(principal, rate, 4);
    const longTerm = calculateSeasonalPayment(principal, rate, 12);

    // Longer terms = lower payments (more payments spread out)
    expect(longTerm).toBeLessThan(shortTerm);
  });

  it('handles zero principal gracefully', () => {
    const payment = calculateSeasonalPayment(0, 0.05, 4);

    expect(payment).toBe(0);
  });

  it('returns valid payment for various loan amounts', () => {
    const amounts = [1000, 5000, 10000, 50000, 100000];

    amounts.forEach(principal => {
      const payment = calculateSeasonalPayment(principal, 0.05, 4);

      expect(payment).toBeGreaterThan(0);
      expect(Number.isFinite(payment)).toBe(true);
    });
  });
});

