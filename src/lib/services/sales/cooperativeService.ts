import { supabase } from '../../database/core/supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

// ===== LEVEL DEFINITIONS =====

export interface CooperativeLevelConfig {
  level: 0 | 1 | 2 | 3;
  name: string;
  minConsecutiveYears: number;
  floorPricePerKg: number;
  benefits: string[];
  nextLevelHint?: string;
}

export const COOPERATIVE_LEVELS: Record<0 | 1 | 2 | 3, CooperativeLevelConfig> = {
  0: {
    level: 0,
    name: 'Non-Member',
    minConsecutiveYears: 0,
    floorPricePerKg: 0,
    benefits: [],
    nextLevelHint: 'Sell grapes once to become a Basic Member and unlock the €0.80/kg floor price.',
  },
  1: {
    level: 1,
    name: 'Basic Member',
    minConsecutiveYears: 1,
    floorPricePerKg: 0.80,
    benefits: [
      'Guaranteed €0.80/kg floor price',
      '1.5× price multiplier',
    ],
    nextLevelHint: 'Sell grapes 3 years in a row to become an Active Member (€1.00/kg floor).',
  },
  2: {
    level: 2,
    name: 'Active Member',
    minConsecutiveYears: 3,
    floorPricePerKg: 1.00,
    benefits: [
      'Guaranteed €1.00/kg floor price',
      '1.5× price multiplier',
      'Shared equipment: 10% reduced work for vineyard activities',
    ],
    nextLevelHint: 'Sell grapes 6 years in a row to become a Senior Member (€1.20/kg floor + passive vineyard support).',
  },
  3: {
    level: 3,
    name: 'Senior Member',
    minConsecutiveYears: 6,
    floorPricePerKg: 1.20,
    benefits: [
      'Guaranteed €1.20/kg floor price',
      '1.5× price multiplier',
      'Shared equipment: 15% reduced work for vineyard activities',
      'Passive vine health maintenance support each season',
    ],
  },
};

// ===== MEMBERSHIP TYPE =====

export interface CooperativeMembership {
  companyId: string;
  totalSales: number;
  consecutiveYears: number;
  totalKgSold: number;
  lastSaleYear: number | null;
  level: 0 | 1 | 2 | 3;
}

// ===== LEVEL COMPUTATION =====

function computeLevel(consecutiveYears: number): 0 | 1 | 2 | 3 {
  if (consecutiveYears >= COOPERATIVE_LEVELS[3].minConsecutiveYears) return 3;
  if (consecutiveYears >= COOPERATIVE_LEVELS[2].minConsecutiveYears) return 2;
  if (consecutiveYears >= COOPERATIVE_LEVELS[1].minConsecutiveYears) return 1;
  return 0;
}

/** Returns the floor price for a given membership level. */
export function getCooperativeFloorPrice(level: 0 | 1 | 2 | 3): number {
  return COOPERATIVE_LEVELS[level].floorPricePerKg;
}

// ===== DB OPERATIONS =====

const TABLE = 'cooperative_membership';

function mapRow(row: any): CooperativeMembership {
  return {
    companyId: row.company_id,
    totalSales: row.total_sales,
    consecutiveYears: row.consecutive_years,
    totalKgSold: row.total_kg_sold,
    lastSaleYear: row.last_sale_year,
    level: row.level as 0 | 1 | 2 | 3,
  };
}

export async function getCooperativeMembership(): Promise<CooperativeMembership | null> {
  const companyId = getCurrentCompanyId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load cooperative membership:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

/**
 * Records a cooperative sale and updates membership level.
 * Consecutive-year streak: if last_sale_year === currentYear - 1 → streak continues.
 * If last_sale_year === currentYear → already sold this year, just add kg.
 * Anything older → streak resets to 1 (this sale counts as year 1).
 */
export async function recordCooperativeSale(
  kgSold: number,
  currentYear: number
): Promise<CooperativeMembership> {
  const companyId = getCurrentCompanyId();

  // Load existing record (if any)
  const existing = await getCooperativeMembership();

  let consecutiveYears: number;
  let totalSales: number;
  let totalKgSold: number;

  if (!existing) {
    // First ever sale
    consecutiveYears = 1;
    totalSales = 1;
    totalKgSold = kgSold;
  } else {
    totalSales = existing.totalSales + 1;
    totalKgSold = existing.totalKgSold + kgSold;

    if (existing.lastSaleYear === null) {
      consecutiveYears = 1;
    } else if (existing.lastSaleYear === currentYear) {
      // Multiple sales in the same year — don't increment streak
      consecutiveYears = existing.consecutiveYears;
    } else if (existing.lastSaleYear === currentYear - 1) {
      // Previous year sold — streak continues
      consecutiveYears = existing.consecutiveYears + 1;
    } else {
      // Missed one or more years — reset streak
      consecutiveYears = 1;
    }
  }

  const level = computeLevel(consecutiveYears);

  const upsertData = {
    company_id: companyId,
    total_sales: totalSales,
    consecutive_years: consecutiveYears,
    total_kg_sold: totalKgSold,
    last_sale_year: currentYear,
    level,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(upsertData, { onConflict: 'company_id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to record cooperative sale:', error);
    // Return computed state even on DB error so the sale still goes through
    return {
      companyId,
      totalSales,
      consecutiveYears,
      totalKgSold,
      lastSaleYear: currentYear,
      level,
    };
  }

  return mapRow(data);
}
