import { supabase } from './supabase';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { toOptionalNumber } from '../dbMapperUtils';

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
 * Map BoardSatisfactionSnapshot to database row
 */
function boardSatisfactionSnapshotToRow(snapshot: Omit<BoardSatisfactionSnapshot, 'id' | 'createdAt'>): BoardSatisfactionSnapshotData {
  return {
    company_id: snapshot.companyId,
    snapshot_week: snapshot.week,
    snapshot_season: snapshot.season,
    snapshot_year: snapshot.year,
    satisfaction_score: snapshot.satisfactionScore,
    performance_score: snapshot.performanceScore,
    stability_score: snapshot.stabilityScore,
    consistency_score: snapshot.consistencyScore,
    ownership_pressure: snapshot.ownershipPressure,
    player_ownership_pct: snapshot.playerOwnershipPct
  };
}

/**
 * Insert a snapshot of board satisfaction
 * Called each week during game tick
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

    const { error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .insert(snapshotData);

    if (error) {
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

    // Query for snapshots
    const { data, error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('snapshot_year', { ascending: false })
      .order('snapshot_season', { ascending: false })
      .order('snapshot_week', { ascending: false });

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

    const { data, error } = await supabase
      .from(BOARD_SATISFACTION_HISTORY_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('snapshot_year', { ascending: true })
      .order('snapshot_season', { ascending: true })
      .order('snapshot_week', { ascending: true });

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
