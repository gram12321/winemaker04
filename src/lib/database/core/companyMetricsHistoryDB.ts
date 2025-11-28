import { supabase } from './supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { getGameState } from '../../services/core/gameState';
import { calculateAbsoluteWeeks } from '../../utils/utils';
import { toOptionalNumber } from '../dbMapperUtils';

const COMPANY_METRICS_HISTORY_TABLE = 'company_metrics_history';

export interface CompanyMetricsSnapshot {
  id: string;
  companyId: string;
  week: number;
  season: string;
  year: number;
  creditRating: number;
  prestige: number;
  fixedAssetRatio: number;
  sharePrice: number;
  bookValuePerShare: number;
  earningsPerShare48W: number;
  revenuePerShare48W: number;
  dividendPerShare48W: number;
  profitMargin48W?: number;  // Profit margin (48-week rolling) at snapshot time
  revenueGrowth48W?: number; // Revenue growth (48-week rolling) at snapshot time
  createdAt: Date;
}

export interface CompanyMetricsSnapshotData {
  id?: string;
  company_id: string;
  snapshot_week: number;
  snapshot_season: string;
  snapshot_year: number;
  credit_rating: number;
  prestige: number;
  fixed_asset_ratio: number;
  share_price: number;
  book_value_per_share: number;
  earnings_per_share_48w: number;
  revenue_per_share_48w: number;
  dividend_per_share_48w: number;
  profit_margin_48w?: number;  // Profit margin (48-week rolling) at snapshot time
  revenue_growth_48w?: number;  // Revenue growth (48-week rolling) at snapshot time
  created_at?: string;
}

/**
 * Insert a snapshot of company metrics (all metrics for historical tracking)
 * Called each week when share price is adjusted
 */
export async function insertCompanyMetricsSnapshot(data: {
  companyId?: string;
  week: number;
  season: string;
  year: number;
  creditRating: number;
  prestige: number;
  fixedAssetRatio: number;
  sharePrice: number;
  bookValuePerShare: number;
  earningsPerShare48W: number;
  revenuePerShare48W: number;
  dividendPerShare48W: number;
  profitMargin48W?: number;  // Profit margin (48-week rolling)
  revenueGrowth48W?: number;  // Revenue growth (48-week rolling)
}): Promise<{ success: boolean; error?: string }> {
  try {
    const companyId = data.companyId || getCurrentCompanyId();
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    const snapshotData: CompanyMetricsSnapshotData = {
      company_id: companyId,
      snapshot_week: data.week,
      snapshot_season: data.season,
      snapshot_year: data.year,
      credit_rating: data.creditRating,
      prestige: data.prestige,
      fixed_asset_ratio: data.fixedAssetRatio,
      share_price: data.sharePrice,
      book_value_per_share: data.bookValuePerShare,
      earnings_per_share_48w: data.earningsPerShare48W,
      revenue_per_share_48w: data.revenuePerShare48W,
      dividend_per_share_48w: data.dividendPerShare48W,
      profit_margin_48w: data.profitMargin48W,
      revenue_growth_48w: data.revenueGrowth48W
    };

    const { error } = await supabase
      .from(COMPANY_METRICS_HISTORY_TABLE)
      .insert(snapshotData);

    if (error) {
      console.error('Error inserting company metrics snapshot:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error inserting company metrics snapshot:', error);
    return { success: false, error: 'Failed to insert snapshot' };
  }
}

/**
 * Get the metrics snapshot from exactly N weeks ago
 * Returns the snapshot closest to the target date
 */
export async function getCompanyMetricsSnapshotNWeeksAgo(
  weeksAgo: number,
  companyId?: string
): Promise<CompanyMetricsSnapshot | null> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    if (!companyId) {
      return null;
    }

    // Calculate target date
    const gameState = getGameState();
    const currentDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };

    // Calculate target date by subtracting weeks
    const currentAbsoluteWeeks = calculateAbsoluteWeeks(
      currentDate.week,
      currentDate.season,
      currentDate.year,
      1,
      'Spring',
      2024
    );
    const targetAbsoluteWeeks = Math.max(1, currentAbsoluteWeeks - weeksAgo);
    // targetAbsoluteWeeks already calculated above

    // Query for snapshot closest to target date (within a small window)
    // Get snapshots from 1 week before to 1 week after the target
    const { data, error } = await supabase
      .from(COMPANY_METRICS_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('snapshot_year', { ascending: false })
      .order('snapshot_season', { ascending: false })
      .order('snapshot_week', { ascending: false });

    if (error) {
      console.error('Error fetching company metrics snapshot:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Find the snapshot closest to target date
    let closestSnapshot: CompanyMetricsSnapshotData | null = null;
    let closestDistance = Infinity;

    for (const snapshot of data) {
      const snapshotAbsoluteWeeks = calculateAbsoluteWeeks(
        snapshot.snapshot_week,
        snapshot.snapshot_season,
        snapshot.snapshot_year,
        1,
        'Spring',
        2024
      );

      const distance = Math.abs(snapshotAbsoluteWeeks - targetAbsoluteWeeks);
      
      if (distance < closestDistance && snapshotAbsoluteWeeks <= targetAbsoluteWeeks) {
        closestDistance = distance;
        closestSnapshot = snapshot;
      }
    }

    // Also check if any snapshot is close enough (within 4 weeks)
    if (!closestSnapshot || closestDistance > 4) {
      // If no close snapshot found, return the oldest snapshot available
      const oldestSnapshot = data[data.length - 1];
      if (oldestSnapshot) {
        const oldestAbsoluteWeeks = calculateAbsoluteWeeks(
          oldestSnapshot.snapshot_week,
          oldestSnapshot.snapshot_season,
          oldestSnapshot.snapshot_year,
          1,
          'Spring',
          2024
        );
        
        // Only return if it's before the target (can't compare to future)
        if (oldestAbsoluteWeeks <= targetAbsoluteWeeks) {
          closestSnapshot = oldestSnapshot;
        }
      }
    }

    if (!closestSnapshot) {
      return null;
    }

    return {
      id: closestSnapshot.id || '',
      companyId: closestSnapshot.company_id,
      week: closestSnapshot.snapshot_week,
      season: closestSnapshot.snapshot_season,
      year: closestSnapshot.snapshot_year,
      creditRating: Number(closestSnapshot.credit_rating),
      prestige: Number(closestSnapshot.prestige),
      fixedAssetRatio: Number(closestSnapshot.fixed_asset_ratio),
      sharePrice: toOptionalNumber(closestSnapshot.share_price) ?? 0,
      bookValuePerShare: toOptionalNumber(closestSnapshot.book_value_per_share) ?? 0,
      earningsPerShare48W: toOptionalNumber(closestSnapshot.earnings_per_share_48w) ?? 0,
      revenuePerShare48W: toOptionalNumber(closestSnapshot.revenue_per_share_48w) ?? 0,
      dividendPerShare48W: toOptionalNumber(closestSnapshot.dividend_per_share_48w) ?? 0,
      profitMargin48W: toOptionalNumber(closestSnapshot.profit_margin_48w),
      revenueGrowth48W: toOptionalNumber(closestSnapshot.revenue_growth_48w),
      createdAt: closestSnapshot.created_at ? new Date(closestSnapshot.created_at) : new Date()
    };
  } catch (error) {
    console.error('Error getting company metrics snapshot:', error);
    return null;
  }
}

/**
 * Get all historical snapshots for a company (for charts/diagrams)
 * Ordered by date (oldest first)
 */
export async function getCompanyMetricsHistory(
  companyId?: string,
  weeksBack: number = 48 * 2 // Default: 2 years 48 weeks in a gameyear
): Promise<CompanyMetricsSnapshot[]> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    if (!companyId) {
      return [];
    }

    const gameState = getGameState();
    const currentDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };

    // Calculate start date by subtracting weeks
    const currentAbsoluteWeeks = calculateAbsoluteWeeks(
      currentDate.week,
      currentDate.season,
      currentDate.year,
      1,
      'Spring',
      2024
    );
    const startAbsoluteWeeks = Math.max(1, currentAbsoluteWeeks - weeksBack);
    // startAbsoluteWeeks already calculated above

    const { data, error } = await supabase
      .from(COMPANY_METRICS_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('snapshot_year', { ascending: true })
      .order('snapshot_season', { ascending: true })
      .order('snapshot_week', { ascending: true });

    if (error) {
      console.error('Error fetching company metrics history:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter to only snapshots within the time range
    const filtered = data.filter(snapshot => {
      const snapshotAbsoluteWeeks = calculateAbsoluteWeeks(
        snapshot.snapshot_week,
        snapshot.snapshot_season,
        snapshot.snapshot_year,
        1,
        'Spring',
        2024
      );
      return snapshotAbsoluteWeeks >= startAbsoluteWeeks;
    });

    return filtered.map(snapshot => ({
      id: snapshot.id || '',
      companyId: snapshot.company_id,
      week: snapshot.snapshot_week,
      season: snapshot.snapshot_season,
      year: snapshot.snapshot_year,
      creditRating: Number(snapshot.credit_rating),
      prestige: Number(snapshot.prestige),
      fixedAssetRatio: Number(snapshot.fixed_asset_ratio),
      sharePrice: toOptionalNumber(snapshot.share_price) ?? 0,
      bookValuePerShare: toOptionalNumber(snapshot.book_value_per_share) ?? 0,
      earningsPerShare48W: toOptionalNumber(snapshot.earnings_per_share_48w) ?? 0,
      revenuePerShare48W: toOptionalNumber(snapshot.revenue_per_share_48w) ?? 0,
      dividendPerShare48W: toOptionalNumber(snapshot.dividend_per_share_48w) ?? 0,
      profitMargin48W: toOptionalNumber(snapshot.profit_margin_48w),
      revenueGrowth48W: toOptionalNumber(snapshot.revenue_growth_48w),
      createdAt: snapshot.created_at ? new Date(snapshot.created_at) : new Date()
    }));
  } catch (error) {
    console.error('Error getting company metrics history:', error);
    return [];
  }
}
