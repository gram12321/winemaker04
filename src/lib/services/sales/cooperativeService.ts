import { COOPERATIVE_LEVELS } from '@/lib/constants/cooperativeConstants';
import { loadCooperativeMembershipRow, upsertCooperativeMembershipRow } from '@/lib/database';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

export interface CooperativeMembership {
  companyId: string;
  totalSales: number;
  consecutiveYears: number;
  totalKgSold: number;
  lastSaleYear: number | null;
  level: 0 | 1 | 2 | 3;
}

function computeLevel(consecutiveYears: number): 0 | 1 | 2 | 3 {
  if (consecutiveYears >= COOPERATIVE_LEVELS[3].minConsecutiveYears) return 3;
  if (consecutiveYears >= COOPERATIVE_LEVELS[2].minConsecutiveYears) return 2;
  if (consecutiveYears >= COOPERATIVE_LEVELS[1].minConsecutiveYears) return 1;
  return 0;
}

export function getCooperativeFloorPrice(level: 0 | 1 | 2 | 3): number {
  return COOPERATIVE_LEVELS[level].floorPricePerKg;
}

function mapRow(row: {
  company_id: string;
  total_sales: number;
  consecutive_years: number;
  total_kg_sold: number;
  last_sale_year: number | null;
  level: 0 | 1 | 2 | 3;
}): CooperativeMembership {
  return {
    companyId: row.company_id,
    totalSales: row.total_sales,
    consecutiveYears: row.consecutive_years,
    totalKgSold: row.total_kg_sold,
    lastSaleYear: row.last_sale_year,
    level: row.level,
  };
}

export async function getCooperativeMembership(): Promise<CooperativeMembership | null> {
  const row = await loadCooperativeMembershipRow();
  return row ? mapRow(row) : null;
}

export async function recordCooperativeSale(
  kgSold: number,
  currentYear: number
): Promise<CooperativeMembership> {
  const companyId = getCurrentCompanyId();
  const existing = await getCooperativeMembership();

  let consecutiveYears: number;
  let totalSales: number;
  let totalKgSold: number;

  if (!existing) {
    consecutiveYears = 1;
    totalSales = 1;
    totalKgSold = kgSold;
  } else {
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
  }

  const level = computeLevel(consecutiveYears);
  const persistedRow = await upsertCooperativeMembershipRow({
    company_id: companyId,
    total_sales: totalSales,
    consecutive_years: consecutiveYears,
    total_kg_sold: totalKgSold,
    last_sale_year: currentYear,
    level,
  });

  if (!persistedRow) {
    return {
      companyId,
      totalSales,
      consecutiveYears,
      totalKgSold,
      lastSaleYear: currentYear,
      level,
    };
  }

  return mapRow(persistedRow);
}
