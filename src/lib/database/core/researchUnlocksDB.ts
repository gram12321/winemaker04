import { supabase } from './supabase';
import { GameDate } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Research unlock record (database record)
 */
export interface ResearchUnlock {
  id: string;
  researchId: string;
  companyId: string;
  unlockedAt: GameDate;
  unlockedAtTimestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Database row structure
 */
interface ResearchUnlockRow {
  id: string;
  company_id: string;
  research_id: string;
  unlocked_game_week?: number;
  unlocked_game_season?: string;
  unlocked_game_year?: number;
  metadata?: Record<string, any>;
  created_at?: string;
}

/**
 * Convert database row to ResearchUnlock
 */
function rowToResearchUnlock(row: ResearchUnlockRow): ResearchUnlock {
  return {
    id: row.id,
    researchId: row.research_id,
    companyId: row.company_id,
    unlockedAt: {
      week: row.unlocked_game_week || 1,
      season: (row.unlocked_game_season || 'Spring') as any,
      year: row.unlocked_game_year || 2024
    },
    unlockedAtTimestamp: row.unlocked_game_week || 1,
    metadata: row.metadata
  };
}

/**
 * Convert ResearchUnlock to database row
 */
function researchUnlockToRow(unlock: Partial<ResearchUnlock> & { researchId: string; companyId: string; unlockedAt: GameDate; unlockedAtTimestamp: number }): Partial<ResearchUnlockRow> {
  return {
    id: unlock.id || uuidv4(),
    company_id: unlock.companyId,
    research_id: unlock.researchId,
    unlocked_game_week: unlock.unlockedAt.week,
    unlocked_game_season: unlock.unlockedAt.season,
    unlocked_game_year: unlock.unlockedAt.year,
    metadata: unlock.metadata
  };
}

/**
 * Create research unlock record
 */
export async function unlockResearch(unlock: Omit<ResearchUnlock, 'id'>): Promise<ResearchUnlock> {
  const row = researchUnlockToRow({
    ...unlock,
    id: uuidv4()
  });

  const { data, error } = await supabase
    .from('research_unlocks')
    .insert(row)
    .select()
    .single();
  
  if (error) {
    // If duplicate, it's already unlocked - fetch and return existing
    if (error.code === '23505') {
      const existing = await getResearchUnlock(unlock.researchId, unlock.companyId);
      if (existing) return existing;
    }
    console.error('Error unlocking research:', error);
    throw error;
  }
  
  return rowToResearchUnlock(data);
}

/**
 * Get specific research unlock for a company
 */
export async function getResearchUnlock(researchId: string, companyId?: string): Promise<ResearchUnlock | null> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return null;
  
  const { data, error } = await supabase
    .from('research_unlocks')
    .select('*')
    .eq('research_id', researchId)
    .eq('company_id', targetCompanyId)
    .maybeSingle();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching research unlock:', error);
    throw error;
  }
  
  return data ? rowToResearchUnlock(data) : null;
}

/**
 * Get all research unlocks for a company
 */
export async function getAllResearchUnlocks(companyId?: string): Promise<ResearchUnlock[]> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return [];
  
  const { data, error } = await supabase
    .from('research_unlocks')
    .select('*')
    .eq('company_id', targetCompanyId)
    .order('unlocked_game_year', { ascending: false })
    .order('unlocked_game_season', { ascending: false })
    .order('unlocked_game_week', { ascending: false });
  
  if (error) {
    console.error('Error fetching research unlocks:', error);
    throw error;
  }
  
  return (data || []).map(rowToResearchUnlock);
}

/**
 * Check if research is unlocked for a company
 */
export async function isResearchUnlocked(researchId: string, companyId?: string): Promise<boolean> {
  const unlock = await getResearchUnlock(researchId, companyId);
  return unlock !== null;
}

/**
 * Get all unlocked research IDs for a company
 */
export async function getUnlockedResearchIds(companyId?: string): Promise<string[]> {
  const unlocks = await getAllResearchUnlocks(companyId);
  return unlocks.map(unlock => unlock.researchId);
}

