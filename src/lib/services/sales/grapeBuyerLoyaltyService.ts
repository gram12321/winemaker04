import { getCurrentCompanyId } from '../../utils/companyUtils';
import { calculateCompanyValue } from '../finance/financeService';
import {
  getBuyerLoyaltyRow,
  getBuyerLoyaltyRows,
  getMaxBuyerLoyaltyLevelRow,
  upsertBuyerLoyaltyRow,
} from '../../database/sales/grapeBuyerLoyaltyDB';

export type BuyerLoyaltyLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface BuyerLoyaltyLevelConfig {
  level: BuyerLoyaltyLevel;
  name: string;
  minLoyaltyScore: number;
  priceMultiplier: number;
  yearlyLimitBonus: number;
  benefits: string[];
  nextLevelHint?: string;
}

export const BUYER_LOYALTY_LEVEL_SEQUENCE: BuyerLoyaltyLevel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const BUYER_LOYALTY_LEVELS: Record<BuyerLoyaltyLevel, BuyerLoyaltyLevelConfig> = {
  0: {
    level: 0,
    name: 'New Contact',
    minLoyaltyScore: 0,
    priceMultiplier: 1,
    yearlyLimitBonus: 0,
    benefits: [],
    nextLevelHint: 'Complete your first sale to unlock Familiar Contact status.',
  },
  1: {
    level: 1,
    name: 'Familiar Contact',
    minLoyaltyScore: 600,
    priceMultiplier: 1.01,
    yearlyLimitBonus: 0.05,
    benefits: [
      'Buyer now recognizes your winery in repeat transactions',
      '1.01x relationship price multiplier',
      '+5% yearly limit bonus',
    ],
    nextLevelHint: 'Build 1,800 loyalty score to become a Known Seller.',
  },
  2: {
    level: 2,
    name: 'Known Seller',
    minLoyaltyScore: 1800,
    priceMultiplier: 1.02,
    yearlyLimitBonus: 0.08,
    benefits: [
      'Established working relationship with this buyer',
      '1.02x relationship price multiplier',
      '+8% yearly limit bonus',
    ],
    nextLevelHint: 'Build 4,000 loyalty score to become a Trusted Seller.',
  },
  3: {
    level: 3,
    name: 'Trusted Seller',
    minLoyaltyScore: 4000,
    priceMultiplier: 1.03,
    yearlyLimitBonus: 0.12,
    benefits: [
      'Top-tier buyer relationship',
      '1.03x relationship price multiplier',
      '+12% yearly limit bonus',
    ],
    nextLevelHint: 'Build 7,000 loyalty score to become a Preferred Seller.',
  },
  4: {
    level: 4,
    name: 'Preferred Seller',
    minLoyaltyScore: 7000,
    priceMultiplier: 1.05,
    yearlyLimitBonus: 0.16,
    benefits: [
      'Buyer gives your winery stronger priority',
      '1.05x relationship price multiplier',
      '+16% yearly limit bonus',
    ],
    nextLevelHint: 'Build 11,000 loyalty score to become a Preferred Partner.',
  },
  5: {
    level: 5,
    name: 'Preferred Partner',
    minLoyaltyScore: 11000,
    priceMultiplier: 1.07,
    yearlyLimitBonus: 0.2,
    benefits: [
      'Established preferred relationship',
      '1.07x relationship price multiplier',
      '+20% yearly limit bonus',
    ],
    nextLevelHint: 'Build 16,000 loyalty score to become a Strategic Partner.',
  },
  6: {
    level: 6,
    name: 'Strategic Partner',
    minLoyaltyScore: 16000,
    priceMultiplier: 1.09,
    yearlyLimitBonus: 0.25,
    benefits: [
      'Buyer treats your supply as strategically important',
      '1.09x relationship price multiplier',
      '+25% yearly limit bonus',
    ],
    nextLevelHint: 'Build 22,500 loyalty score to become a Core Partner.',
  },
  7: {
    level: 7,
    name: 'Core Partner',
    minLoyaltyScore: 22500,
    priceMultiplier: 1.11,
    yearlyLimitBonus: 0.3,
    benefits: [
      'Core buyer relationship for regular supply',
      '1.11x relationship price multiplier',
      '+30% yearly limit bonus',
    ],
    nextLevelHint: 'Build 31,000 loyalty score to become an Elite Partner.',
  },
  8: {
    level: 8,
    name: 'Elite Partner',
    minLoyaltyScore: 31000,
    priceMultiplier: 1.14,
    yearlyLimitBonus: 0.36,
    benefits: [
      'Elite relationship with substantial bargaining power',
      '1.14x relationship price multiplier',
      '+36% yearly limit bonus',
    ],
    nextLevelHint: 'Build 41,000 loyalty score to become a Premier Partner.',
  },
  9: {
    level: 9,
    name: 'Premier Partner',
    minLoyaltyScore: 41000,
    priceMultiplier: 1.17,
    yearlyLimitBonus: 0.43,
    benefits: [
      'Premier relationship with major demand leverage',
      '1.17x relationship price multiplier',
      '+43% yearly limit bonus',
    ],
    nextLevelHint: 'Build 53,000 loyalty score to become a Legacy Partner.',
  },
  10: {
    level: 10,
    name: 'Legacy Partner',
    minLoyaltyScore: 53000,
    priceMultiplier: 1.2,
    yearlyLimitBonus: 0.5,
    benefits: [
      'Highest trust tier with this buyer',
      '1.20x relationship price multiplier',
      '+50% yearly limit bonus',
    ],
  },
};

export interface BuyerLoyaltyRecord {
  companyId: string;
  buyerId: string;
  totalSales: number;
  consecutiveYears: number;
  totalKgSold: number;
  loyaltyScore: number;
  yearGuardYear: number | null;
  yearKgSold: number;
  yearLoyaltyPoints: number;
  lastSaleYear: number | null;
  level: BuyerLoyaltyLevel;
}

const BASE_KG_WEIGHT = 1;
const MAX_STREAK_MULTIPLIER_BONUS = 0.75;
const STREAK_MULTIPLIER_STEP = 0.15;

export const RELATIONSHIP_DECAY_BY_LEVEL: Record<BuyerLoyaltyLevel, number> = {
  0: 0.01,
  1: 0.015,
  2: 0.02,
  3: 0.03,
  4: 0.04,
  5: 0.055,
  6: 0.07,
  7: 0.09,
  8: 0.11,
  9: 0.13,
  10: 0.15,
};

function getYearlyLoyaltyCap(consecutiveYears: number): number {
  if (consecutiveYears <= 1) return 3000;
  if (consecutiveYears === 2) return 5000;
  if (consecutiveYears === 3) return 7000;
  return Math.min(15000, 7000 + (consecutiveYears - 3) * 1500);
}

function getCompanyValueLoyaltyCapScale(companyValue: number): number {
  if (companyValue <= 0) return 1;
  const normalized = Math.max(0, Math.log10(Math.max(50000, companyValue)) - 4.7);
  return Math.min(1.8, 1 + normalized * 0.25);
}

function getScaledYearlyLoyaltyCap(consecutiveYears: number, companyValue: number): number {
  const baseCap = getYearlyLoyaltyCap(consecutiveYears);
  return Math.max(500, Math.round(baseCap * getCompanyValueLoyaltyCapScale(companyValue)));
}

function computeLevel(loyaltyScore: number): BuyerLoyaltyLevel {
  for (const level of [...BUYER_LOYALTY_LEVEL_SEQUENCE].reverse()) {
    if (loyaltyScore >= BUYER_LOYALTY_LEVELS[level].minLoyaltyScore) return level;
  }
  return 0;
}

function calculateEarnedLoyaltyPoints(kgSold: number, consecutiveYears: number): number {
  const basePoints = kgSold * BASE_KG_WEIGHT + consecutiveYears;
  const streakMultiplier = 1 + Math.min(
    MAX_STREAK_MULTIPLIER_BONUS,
    Math.max(0, consecutiveYears - 1) * STREAK_MULTIPLIER_STEP
  );
  return Math.max(0, Math.round(basePoints * streakMultiplier));
}

export function getBuyerYearlyLoyaltyCap(consecutiveYears: number, companyValue = 0): number {
  return getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
}

export function estimateBuyerLoyaltyPointGain(
  kgSold: number,
  consecutiveYears: number,
  currentYearLoyaltyPoints: number,
  companyValue = 0
): {
  yearlyCap: number;
  remainingCap: number;
  rawPoints: number;
  appliedPoints: number;
} {
  const yearlyCap = getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
  const remainingCap = Math.max(0, yearlyCap - currentYearLoyaltyPoints);
  const rawPoints = calculateEarnedLoyaltyPoints(kgSold, consecutiveYears);
  const appliedPoints = Math.min(rawPoints, remainingCap);
  return {
    yearlyCap,
    remainingCap,
    rawPoints,
    appliedPoints,
  };
}

export function getBuyerRelationshipPriceMultiplier(level: BuyerLoyaltyLevel): number {
  return BUYER_LOYALTY_LEVELS[level].priceMultiplier;
}

export function getBuyerRelationshipYearlyLimitBonus(level: BuyerLoyaltyLevel): number {
  return BUYER_LOYALTY_LEVELS[level].yearlyLimitBonus;
}

function applyRelationshipDecay(
  currentScore: number,
  level: BuyerLoyaltyLevel,
  yearsElapsed: number
): number {
  if (yearsElapsed <= 0 || currentScore <= 0) return currentScore;
  const decayRate = RELATIONSHIP_DECAY_BY_LEVEL[level];
  const retainedFactor = Math.pow(1 - decayRate, yearsElapsed);
  return Math.max(0, Math.round(currentScore * retainedFactor));
}

function mapRow(row: any): BuyerLoyaltyRecord {
  return {
    companyId: row.company_id,
    buyerId: row.buyer_id,
    totalSales: row.total_sales,
    consecutiveYears: row.consecutive_years,
    totalKgSold: row.total_kg_sold,
    loyaltyScore: row.loyalty_score ?? 0,
    yearGuardYear: row.year_guard_year ?? null,
    yearKgSold: row.year_kg_sold ?? 0,
    yearLoyaltyPoints: row.year_loyalty_points ?? 0,
    lastSaleYear: row.last_sale_year,
    level: row.level as BuyerLoyaltyLevel,
  };
}

export async function getBuyerLoyalty(buyerId: string): Promise<BuyerLoyaltyRecord | null> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return null;

  const { data, error } = await getBuyerLoyaltyRow(companyId, buyerId);

  if (error) {
    console.error('Failed to load buyer loyalty:', error);
    return null;
  }

  return data ? mapRow(data) : null;
}

export async function getBuyerLoyalties(buyerIds: string[]): Promise<Record<string, BuyerLoyaltyRecord>> {
  const companyId = getCurrentCompanyId();
  if (!companyId || buyerIds.length === 0) return {};

  const { data, error } = await getBuyerLoyaltyRows(companyId, buyerIds);

  if (error || !data) {
    if (error) {
      console.error('Failed to load buyer loyalties:', error);
    }
    return {};
  }

  const map: Record<string, BuyerLoyaltyRecord> = {};
  for (const row of data) {
    const loyalty = mapRow(row);
    map[loyalty.buyerId] = loyalty;
  }
  return map;
}

export async function getMaxBuyerLoyaltyLevel(): Promise<BuyerLoyaltyLevel> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return 0;

  const { data, error } = await getMaxBuyerLoyaltyLevelRow(companyId);

  if (error || !data || data.level === null || data.level === undefined) {
    return 0;
  }

  const level = Number(data.level);
  if (level >= 10) return 10;
  if (level >= 9) return 9;
  if (level >= 8) return 8;
  if (level >= 7) return 7;
  if (level >= 6) return 6;
  if (level >= 5) return 5;
  if (level >= 4) return 4;
  if (level >= 3) return 3;
  if (level >= 2) return 2;
  if (level >= 1) return 1;
  return 0;
}

export async function recordBuyerSale(
  buyerId: string,
  kgSold: number,
  currentYear: number
): Promise<BuyerLoyaltyRecord> {
  const companyId = getCurrentCompanyId();
  if (!companyId) {
    return {
      companyId: '',
      buyerId,
      totalSales: 1,
      consecutiveYears: 1,
      totalKgSold: kgSold,
      loyaltyScore: kgSold,
      yearGuardYear: currentYear,
      yearKgSold: kgSold,
      yearLoyaltyPoints: kgSold,
      lastSaleYear: currentYear,
      level: 1,
    };
  }

  const companyValue = await calculateCompanyValue().catch(() => 0);
  const existing = await getBuyerLoyalty(buyerId);

  let consecutiveYears: number;
  let totalSales: number;
  let totalKgSold: number;
  let loyaltyScore: number;
  let yearGuardYear: number;
  let yearKgSold: number;
  let yearLoyaltyPoints: number;

  if (!existing) {
    consecutiveYears = 1;
    totalSales = 1;
    totalKgSold = kgSold;
    yearGuardYear = currentYear;
    yearKgSold = kgSold;
    const yearlyCap = getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
    const earnedPoints = Math.min(calculateEarnedLoyaltyPoints(kgSold, consecutiveYears), yearlyCap);
    yearLoyaltyPoints = earnedPoints;
    loyaltyScore = earnedPoints;
  } else {
    const yearsElapsed = existing.lastSaleYear === null ? 0 : Math.max(0, currentYear - existing.lastSaleYear);
    const decayedScore = applyRelationshipDecay(existing.loyaltyScore ?? 0, existing.level, yearsElapsed);
    totalSales = existing.totalSales + 1;
    totalKgSold = existing.totalKgSold + kgSold;

    if (existing.lastSaleYear === null) {
      consecutiveYears = 1;
    } else if (existing.lastSaleYear === currentYear) {
      consecutiveYears = existing.consecutiveYears;
    } else if (existing.lastSaleYear === currentYear - 1) {
      consecutiveYears = existing.consecutiveYears + 1;
    } else {
      consecutiveYears = 1;
    }

    const sameGuardYear = existing.yearGuardYear === currentYear;
    yearGuardYear = currentYear;
    const currentYearPoints = sameGuardYear ? existing.yearLoyaltyPoints : 0;
    const currentYearKg = sameGuardYear ? existing.yearKgSold : 0;
    const yearlyCap = getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
    const rawPoints = calculateEarnedLoyaltyPoints(kgSold, consecutiveYears);
    const remainingCap = Math.max(0, yearlyCap - currentYearPoints);
    const earnedPoints = Math.min(rawPoints, remainingCap);

    yearKgSold = currentYearKg + kgSold;
    yearLoyaltyPoints = currentYearPoints + earnedPoints;
    loyaltyScore = decayedScore + earnedPoints;
  }

  const level = computeLevel(loyaltyScore);

  const upsertData = {
    company_id: companyId,
    buyer_id: buyerId,
    total_sales: totalSales,
    consecutive_years: consecutiveYears,
    total_kg_sold: totalKgSold,
    loyalty_score: loyaltyScore,
    year_guard_year: yearGuardYear,
    year_kg_sold: yearKgSold,
    year_loyalty_points: yearLoyaltyPoints,
    last_sale_year: currentYear,
    level,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await upsertBuyerLoyaltyRow(upsertData);

  if (error) {
    console.error('Failed to record buyer loyalty sale:', error);
    return {
      companyId,
      buyerId,
      totalSales,
      consecutiveYears,
      totalKgSold,
      loyaltyScore,
      yearGuardYear,
      yearKgSold,
      yearLoyaltyPoints,
      lastSaleYear: currentYear,
      level,
    };
  }

  return mapRow(data);
}