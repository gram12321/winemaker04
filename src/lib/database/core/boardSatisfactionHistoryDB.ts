import { supabase } from './supabase';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils';

const BOARD_SATISFACTION_HISTORY_TABLE = 'board_satisfaction_history';

export interface BoardSatisfactionSnapshot {
  id: string;
  companyId: string;
  week: number;
  season: string;
  year: number;
  satisfactionScore: number;
  performanceScore: number;
  stabilityScore: number;
  consistencyScore: number;
  ownershipPressure: number;
  playerOwnershipPct: number;
  createdAt: Date;
}

export interface BoardSatisfactionSnapshotData {
  id?: string;
  company_id: string;
  snapshot_week: number;
  snapshot_season: string;
  snapshot_year: number;
  satisfaction_score: number;
  performance_score: number;
  stability_score: number;
  consistency_score: number;
  ownership_pressure: number;
  player_ownership_pct: number;
  created_at?: string;
}

/**
 * Map database row to BoardSatisfactionSnapshot
 */
function rowToBoardSatisfactionSnapshot(row: BoardSatisfactionSnapshotData): BoardSatisfactionSnapshot {
  return {
    id: row.id || '',
    companyId: row.company_id,
    week: row.snapshot_week,
    season: row.snapshot_season,
    year: row.snapshot_year,
    satisfactionScore: Number(row.satisfaction_score),
    performanceScore: Number(row.performance_score),
    stabilityScore: Number(row.stability_score),
    consistencyScore: Number(row.consistency_score),
    ownershipPressure: Number(row.ownership_pressure),
    playerOwnershipPct: Number(row.player_ownership_pct),
    createdAt: row.created_at ? new Date(row.created_at) : new Date()
  };
}


/**
 * Insert a snapshot of board satisfaction
 * Called each week during game tick
 * Checks for existing snapshot before inserting to prevent duplicates
 */
export async function insertBoardSatisfactionSnapshot(data: {
  companyId?: string;
  week: number;
  season: string;
  year: number;
  satisfactionScore: number;
  performanceScore: number;
  stabilityScore: number;
  consistencyScore: number;
  ownershipPressure: number;
  playerOwnershipPct: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const companyId = data.companyId || getCurrentCompanyId();
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    // Check if snapshot already exists for this week/season/year
    // This prevents duplicates even if unique constraint isn't applied yet
    const { data: existing, error: checkError } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .select('id')
      .eq('company_id', companyId)
      .eq('snapshot_week', data.week)
      .eq('snapshot_season', data.season)
      .eq('snapshot_year', data.year)
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine - means no duplicate
      console.error('Error checking for existing board satisfaction snapshot:', checkError);
      // Continue anyway - try to insert
    }

    // If snapshot already exists, skip insertion
    if (existing) {
      return { success: true }; // Already exists, no error
    }

    const snapshotData: BoardSatisfactionSnapshotData = {
      company_id: companyId,
      snapshot_week: data.week,
      snapshot_season: data.season,
      snapshot_year: data.year,
      satisfaction_score: data.satisfactionScore,
      performance_score: data.performanceScore,
      stability_score: data.stabilityScore,
      consistency_score: data.consistencyScore,
      ownership_pressure: data.ownershipPressure,
      player_ownership_pct: data.playerOwnershipPct
    };

    // Use insert - unique constraint will also prevent duplicates as backup
    // If duplicate exists, PostgreSQL will return error code 23505
    const { error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .insert(snapshotData);

    // If error is a unique constraint violation, treat as success (duplicate)
    if (error) {
      // PostgreSQL unique constraint violation code is 23505
      // Supabase may also return it in different formats
      if (error.code === '23505' || 
          error.code === 'PGRST116' || 
          error.message?.toLowerCase().includes('unique') || 
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('already exists')) {
        return { success: true }; // Duplicate, no error - snapshot already exists
      }
      console.error('Error inserting board satisfaction snapshot:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error inserting board satisfaction snapshot:', error);
    return { success: false, error: 'Failed to insert snapshot' };
  }
}

/**
 * Get the board satisfaction snapshot from exactly N weeks ago
 * Returns the snapshot closest to the target date
 */
export async function getBoardSatisfactionSnapshotNWeeksAgo(
  weeksAgo: number,
  companyId?: string
): Promise<BoardSatisfactionSnapshot | null> {
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

    // OPTIMIZATION: Calculate approximate target date and query only nearby snapshots
    // Instead of fetching 200 rows, we'll fetch a smaller window around the target
    // Calculate approximate target season/year based on weeks
    const weeksPerYear = 48; // 4 seasons * 12 weeks
    const approximateYearsAgo = Math.floor(weeksAgo / weeksPerYear);
    const targetYear = currentDate.year - approximateYearsAgo;
    
    // Query only snapshots from target year and nearby years (max 2 years = ~96 weeks)
    // This reduces data transfer significantly
    const { data, error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .gte('snapshot_year', Math.max(2024, targetYear - 1)) // Include previous year for safety
      .lte('snapshot_year', currentDate.year) // Don't query future
      .order('snapshot_year', { ascending: false })
      .order('snapshot_season', { ascending: false })
      .order('snapshot_week', { ascending: false })
      .limit(60); // Reduced from 200 - 60 snapshots = ~1.25 years, enough for lookback

    if (error) {
      console.error('Error fetching board satisfaction snapshot:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Find the snapshot closest to target date
    let closestSnapshot: BoardSatisfactionSnapshotData | null = null;
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

    return rowToBoardSatisfactionSnapshot(closestSnapshot);
  } catch (error) {
    console.error('Error getting board satisfaction snapshot:', error);
    return null;
  }
}

/**
 * Get all historical board satisfaction snapshots for a company
 * Ordered by date (oldest first)
 */
export async function getBoardSatisfactionHistory(
  companyId?: string,
  weeksBack: number = 48 * 2 // Default: 2 years
): Promise<BoardSatisfactionSnapshot[]> {
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

    // OPTIMIZATION: Use database-level filtering instead of fetching all and filtering in JS
    // Calculate approximate start year based on weeksBack
    const weeksPerYear = 48; // 4 seasons * 12 weeks
    const approximateYearsBack = Math.ceil(weeksBack / weeksPerYear);
    const startYear = Math.max(2024, currentDate.year - approximateYearsBack - 1); // Add buffer
    
    // Query only snapshots within the date range - database does the filtering
    const maxSnapshots = Math.min(weeksBack + 20, 100); // Reduced limit, database filters
    const { data, error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .gte('snapshot_year', startYear) // Database-level filtering
      .lte('snapshot_year', currentDate.year)
      .order('snapshot_year', { ascending: true })
      .order('snapshot_season', { ascending: true })
      .order('snapshot_week', { ascending: true })
      .limit(maxSnapshots);

    if (error) {
      console.error('Error fetching board satisfaction history:', error);
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

    return filtered.map(rowToBoardSatisfactionSnapshot);
  } catch (error) {
    console.error('Error getting board satisfaction history:', error);
    return [];
  }
}
