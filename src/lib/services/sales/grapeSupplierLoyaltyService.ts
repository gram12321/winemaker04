import { getCurrentCompanyId } from '../../utils/companyUtils';
import { calculateCompanyValue } from '../finance/financeService';
import {
  getMaxSupplierLoyaltyLevelRow,
  getSupplierLoyaltyRow,
  getSupplierLoyaltyRows,
  getSupplierPriorityRows,
  upsertSupplierLoyaltyRow,
} from '../../database/sales/grapeSupplierLoyaltyDB';

export type SupplierLoyaltyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface SupplierLoyaltyLevelConfig {
  level: SupplierLoyaltyLevel;
  name: string;
  minLoyaltyScore: number;
  priceMultiplier: number;
  persistenceBonus: number;
  benefits: string[];
  nextLevelHint?: string;
}

export const SUPPLIER_LOYALTY_LEVEL_SEQUENCE: SupplierLoyaltyLevel[] = [0, 1, 2, 3, 4, 5];

export const SUPPLIER_LOYALTY_LEVELS: Record<SupplierLoyaltyLevel, SupplierLoyaltyLevelConfig> = {
  0: {
    level: 0,
    name: 'Unknown Seller',
    minLoyaltyScore: 0,
    priceMultiplier: 1,
    persistenceBonus: 0,
    benefits: [],
    nextLevelHint: 'Purchase from this supplier to unlock Familiar Seller.',
  },
  1: {
    level: 1,
    name: 'Familiar Seller',
    minLoyaltyScore: 700,
    priceMultiplier: 0.99,
    persistenceBonus: 0.05,
    benefits: ['0.99x supplier relationship factor', '+5% persistence chance bonus'],
    nextLevelHint: 'Reach 2,000 trust score for Known Seller.',
  },
  2: {
    level: 2,
    name: 'Known Seller',
    minLoyaltyScore: 2000,
    priceMultiplier: 0.98,
    persistenceBonus: 0.1,
    benefits: ['0.98x supplier relationship factor', '+10% persistence chance bonus'],
    nextLevelHint: 'Reach 4,600 trust score for Trusted Supplier.',
  },
  3: {
    level: 3,
    name: 'Trusted Supplier',
    minLoyaltyScore: 4600,
    priceMultiplier: 0.97,
    persistenceBonus: 0.15,
    benefits: ['0.97x supplier relationship factor', '+15% persistence chance bonus'],
    nextLevelHint: 'Reach 8,500 trust score for Preferred Supplier.',
  },
  4: {
    level: 4,
    name: 'Preferred Supplier',
    minLoyaltyScore: 8500,
    priceMultiplier: 0.95,
    persistenceBonus: 0.22,
    benefits: ['0.95x supplier relationship factor', '+22% persistence chance bonus'],
    nextLevelHint: 'Reach 14,000 trust score for Strategic Supplier.',
  },
  5: {
    level: 5,
    name: 'Strategic Supplier',
    minLoyaltyScore: 14000,
    priceMultiplier: 0.93,
    persistenceBonus: 0.3,
    benefits: ['0.93x supplier relationship factor', '+30% persistence chance bonus'],
  },
};

export interface SupplierLoyaltyRecord {
  companyId: string;
  supplierId: string;
  supplierName: string;
  totalPurchases: number;
  consecutiveYears: number;
  totalKgPurchased: number;
  loyaltyScore: number;
  yearGuardYear: number | null;
  yearKgPurchased: number;
  yearLoyaltyPoints: number;
  lastPurchaseYear: number | null;
  level: SupplierLoyaltyLevel;
}

const BASE_KG_WEIGHT = 1;
const MAX_STREAK_MULTIPLIER_BONUS = 0.65;
const STREAK_MULTIPLIER_STEP = 0.14;

const RELATIONSHIP_DECAY_BY_LEVEL: Record<SupplierLoyaltyLevel, number> = {
  0: 0.01,
  1: 0.015,
  2: 0.025,
  3: 0.04,
  4: 0.06,
  5: 0.08,
};

function getYearlyLoyaltyCap(consecutiveYears: number): number {
  if (consecutiveYears <= 1) return 2600;
  if (consecutiveYears === 2) return 4300;
  if (consecutiveYears === 3) return 6200;
  return Math.min(13000, 6200 + (consecutiveYears - 3) * 1200);
}

function getCompanyValueLoyaltyCapScale(companyValue: number): number {
  if (companyValue <= 0) return 1;
  const normalized = Math.max(0, Math.log10(Math.max(50000, companyValue)) - 4.7);
  return Math.min(1.7, 1 + normalized * 0.22);
}

function getScaledYearlyLoyaltyCap(consecutiveYears: number, companyValue: number): number {
  const baseCap = getYearlyLoyaltyCap(consecutiveYears);
  return Math.max(500, Math.round(baseCap * getCompanyValueLoyaltyCapScale(companyValue)));
}

function computeLevel(loyaltyScore: number): SupplierLoyaltyLevel {
  for (const level of [...SUPPLIER_LOYALTY_LEVEL_SEQUENCE].reverse()) {
    if (loyaltyScore >= SUPPLIER_LOYALTY_LEVELS[level].minLoyaltyScore) return level;
  }
  return 0;
}

function calculateEarnedLoyaltyPoints(kgPurchased: number, consecutiveYears: number): number {
  const basePoints = kgPurchased * BASE_KG_WEIGHT + consecutiveYears;
  const streakMultiplier = 1 + Math.min(
    MAX_STREAK_MULTIPLIER_BONUS,
    Math.max(0, consecutiveYears - 1) * STREAK_MULTIPLIER_STEP
  );
  return Math.max(0, Math.round(basePoints * streakMultiplier));
}

export function getSupplierYearlyTrustCap(consecutiveYears: number, companyValue = 0): number {
  return getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
}

export function estimateSupplierTrustPointGain(
  kgPurchased: number,
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
  const rawPoints = calculateEarnedLoyaltyPoints(kgPurchased, consecutiveYears);
  const appliedPoints = Math.min(rawPoints, remainingCap);
  return {
    yearlyCap,
    remainingCap,
    rawPoints,
    appliedPoints,
  };
}

export function getSupplierRelationshipPriceMultiplier(level: SupplierLoyaltyLevel): number {
  return SUPPLIER_LOYALTY_LEVELS[level].priceMultiplier;
}

export function getSupplierPersistenceBonus(level: SupplierLoyaltyLevel): number {
  return SUPPLIER_LOYALTY_LEVELS[level].persistenceBonus;
}

function applyRelationshipDecay(currentScore: number, level: SupplierLoyaltyLevel, yearsElapsed: number): number {
  if (yearsElapsed <= 0 || currentScore <= 0) return currentScore;
  const decayRate = RELATIONSHIP_DECAY_BY_LEVEL[level];
  const retainedFactor = Math.pow(1 - decayRate, yearsElapsed);
  return Math.max(0, Math.round(currentScore * retainedFactor));
}

function mapRow(row: any): SupplierLoyaltyRecord {
  return {
    companyId: row.company_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? 'Unknown Supplier',
    totalPurchases: row.total_purchases,
    consecutiveYears: row.consecutive_years,
    totalKgPurchased: row.total_kg_purchased,
    loyaltyScore: row.loyalty_score ?? 0,
    yearGuardYear: row.year_guard_year ?? null,
    yearKgPurchased: row.year_kg_purchased ?? 0,
    yearLoyaltyPoints: row.year_loyalty_points ?? 0,
    lastPurchaseYear: row.last_purchase_year,
    level: row.level as SupplierLoyaltyLevel,
  };
}

export async function getSupplierLoyalty(supplierId: string): Promise<SupplierLoyaltyRecord | null> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return null;

  const { data, error } = await getSupplierLoyaltyRow(companyId, supplierId);
  if (error) {
    console.error('Failed to load supplier loyalty:', error);
    return null;
  }

  return data ? mapRow(data) : null;
}

export async function getSupplierLoyalties(supplierIds: string[]): Promise<Record<string, SupplierLoyaltyRecord>> {
  const companyId = getCurrentCompanyId();
  if (!companyId || supplierIds.length === 0) return {};

  const { data, error } = await getSupplierLoyaltyRows(companyId, supplierIds);
  if (error || !data) {
    if (error) {
      console.error('Failed to load supplier loyalties:', error);
    }
    return {};
  }

  const map: Record<string, SupplierLoyaltyRecord> = {};
  for (const row of data) {
    const loyalty = mapRow(row);
    map[loyalty.supplierId] = loyalty;
  }
  return map;
}

export async function getMaxSupplierLoyaltyLevel(): Promise<SupplierLoyaltyLevel> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return 0;

  const { data, error } = await getMaxSupplierLoyaltyLevelRow(companyId);
  if (error || !data || data.level === null || data.level === undefined) {
    return 0;
  }

  const level = Number(data.level);
  if (level >= 5) return 5;
  if (level >= 4) return 4;
  if (level >= 3) return 3;
  if (level >= 2) return 2;
  if (level >= 1) return 1;
  return 0;
}

export async function getSupplierPriorityProfiles(limit = 12): Promise<Array<{ supplierId: string; supplierName: string; loyaltyScore: number; level: SupplierLoyaltyLevel }>> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];

  const { data, error } = await getSupplierPriorityRows(companyId, limit);
  if (error || !data) return [];

  return data.map((row: any) => {
    const score = row.loyalty_score ?? 0;
    return {
      supplierId: row.supplier_id,
      supplierName: row.supplier_name ?? 'Unknown Supplier',
      loyaltyScore: score,
      level: computeLevel(score),
    };
  });
}

export async function recordSupplierPurchase(
  supplierId: string,
  supplierName: string,
  kgPurchased: number,
  currentYear: number
): Promise<SupplierLoyaltyRecord> {
  const companyId = getCurrentCompanyId();
  if (!companyId) {
    return {
      companyId: '',
      supplierId,
      supplierName,
      totalPurchases: 1,
      consecutiveYears: 1,
      totalKgPurchased: kgPurchased,
      loyaltyScore: kgPurchased,
      yearGuardYear: currentYear,
      yearKgPurchased: kgPurchased,
      yearLoyaltyPoints: kgPurchased,
      lastPurchaseYear: currentYear,
      level: 1,
    };
  }

  const companyValue = await calculateCompanyValue().catch(() => 0);
  const existing = await getSupplierLoyalty(supplierId);

  let consecutiveYears: number;
  let totalPurchases: number;
  let totalKgPurchased: number;
  let loyaltyScore: number;
  let yearGuardYear: number;
  let yearKgPurchased: number;
  let yearLoyaltyPoints: number;

  if (!existing) {
    consecutiveYears = 1;
    totalPurchases = 1;
    totalKgPurchased = kgPurchased;
    yearGuardYear = currentYear;
    yearKgPurchased = kgPurchased;
    const yearlyCap = getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
    const earnedPoints = Math.min(calculateEarnedLoyaltyPoints(kgPurchased, consecutiveYears), yearlyCap);
    yearLoyaltyPoints = earnedPoints;
    loyaltyScore = earnedPoints;
  } else {
    const yearsElapsed = existing.lastPurchaseYear === null ? 0 : Math.max(0, currentYear - existing.lastPurchaseYear);
    const decayedScore = applyRelationshipDecay(existing.loyaltyScore ?? 0, existing.level, yearsElapsed);
    totalPurchases = existing.totalPurchases + 1;
    totalKgPurchased = existing.totalKgPurchased + kgPurchased;

    if (existing.lastPurchaseYear === null) {
      consecutiveYears = 1;
    } else if (existing.lastPurchaseYear === currentYear) {
      consecutiveYears = existing.consecutiveYears;
    } else if (existing.lastPurchaseYear === currentYear - 1) {
      consecutiveYears = existing.consecutiveYears + 1;
    } else {
      consecutiveYears = 1;
    }

    const sameGuardYear = existing.yearGuardYear === currentYear;
    yearGuardYear = currentYear;
    const currentYearPoints = sameGuardYear ? existing.yearLoyaltyPoints : 0;
    const currentYearKg = sameGuardYear ? existing.yearKgPurchased : 0;
    const yearlyCap = getScaledYearlyLoyaltyCap(consecutiveYears, companyValue);
    const rawPoints = calculateEarnedLoyaltyPoints(kgPurchased, consecutiveYears);
    const remainingCap = Math.max(0, yearlyCap - currentYearPoints);
    const earnedPoints = Math.min(rawPoints, remainingCap);

    yearKgPurchased = currentYearKg + kgPurchased;
    yearLoyaltyPoints = currentYearPoints + earnedPoints;
    loyaltyScore = decayedScore + earnedPoints;
  }

  const level = computeLevel(loyaltyScore);

  const upsertPayload = {
    company_id: companyId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    total_purchases: totalPurchases,
    consecutive_years: consecutiveYears,
    total_kg_purchased: totalKgPurchased,
    loyalty_score: loyaltyScore,
    year_guard_year: yearGuardYear,
    year_kg_purchased: yearKgPurchased,
    year_loyalty_points: yearLoyaltyPoints,
    last_purchase_year: currentYear,
    level,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await upsertSupplierLoyaltyRow(upsertPayload);
  if (error || !data) {
    console.error('Failed to upsert supplier loyalty:', error);
    return {
      companyId,
      supplierId,
      supplierName,
      totalPurchases,
      consecutiveYears,
      totalKgPurchased,
      loyaltyScore,
      yearGuardYear,
      yearKgPurchased,
      yearLoyaltyPoints,
      lastPurchaseYear: currentYear,
      level,
    };
  }

  return mapRow(data);
}
