import { supabase } from './supabase';
import { AchievementUnlock, GameDate } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database table schema for achievements (existing table):
 *
 * achievements (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
 *   achievement_key TEXT NOT NULL,
 *   achievement_name TEXT NOT NULL,
 *   description TEXT,
 *   achieved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
 *   unlocked_game_week INTEGER,
 *   unlocked_game_season VARCHAR,
 *   unlocked_game_year INTEGER,
 *   progress JSONB DEFAULT '{}',
 *   metadata JSONB DEFAULT '{}',
 *   UNIQUE(id)
 * );
 *
 * CREATE INDEX idx_achievements_company ON achievements(company_id);
 */

/**
 * Database row structure
 */
interface AchievementRow {
  id: string;
  company_id: string;
  achievement_key: string;
  achievement_name: string;
  description?: string;
  achieved_at?: string;
  created_at?: string;
  unlocked_game_week?: number;
  unlocked_game_season?: string;
  unlocked_game_year?: number;
  progress?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Convert database row to AchievementUnlock
 */
function rowToAchievementUnlock(row: AchievementRow): AchievementUnlock {
  return {
    id: row.id,
    achievementId: row.achievement_key,
    companyId: row.company_id,
    unlockedAt: {
      week: row.unlocked_game_week || 1,
      season: (row.unlocked_game_season || 'Spring') as any,
      year: row.unlocked_game_year || 2024
    },
    unlockedAtTimestamp: row.unlocked_game_week || 1,
    progress: row.progress?.current,
    metadata: row.metadata
  };
}

/**
 * Convert AchievementUnlock to database row
 */
function achievementUnlockToRow(unlock: Partial<AchievementUnlock> & { achievementId: string; companyId: string; unlockedAt: GameDate; unlockedAtTimestamp: number }): Partial<AchievementRow> {
  return {
    id: unlock.id || uuidv4(),
    company_id: unlock.companyId,
    achievement_key: unlock.achievementId,
    achievement_name: '', // Will be filled from achievement config
    description: '', // Will be filled from achievement config
    unlocked_game_week: unlock.unlockedAt.week,
    unlocked_game_season: unlock.unlockedAt.season,
    unlocked_game_year: unlock.unlockedAt.year,
    progress: unlock.progress !== undefined ? { current: unlock.progress } : undefined,
    metadata: unlock.metadata
  };
}

/**
 * Create achievement unlock record
 */
export async function unlockAchievement(unlock: Omit<AchievementUnlock, 'id'>): Promise<AchievementUnlock> {
  // Get achievement config to fill in name and description
  const { getAchievementConfig } = await import('../../services/user/achievementService');
  const config = getAchievementConfig(unlock.achievementId);

  const row = achievementUnlockToRow({
    ...unlock,
    id: uuidv4()
  });

  const { data, error } = await supabase
    .from('achievements')
    .insert({
      ...row,
      achievement_name: config?.name || unlock.achievementId,
      description: config?.description || ''
    })
    .select()
    .single();
  
  if (error) {
    // If duplicate, it's already unlocked - fetch and return existing
    if (error.code === '23505') {
      const existing = await getAchievementUnlock(unlock.achievementId, unlock.companyId);
      if (existing) return existing;
    }
    console.error('Error unlocking achievement:', error);
    throw error;
  }
  
  return rowToAchievementUnlock(data);
}

/**
 * Get specific achievement unlock for a company
 */
export async function getAchievementUnlock(achievementId: string, companyId?: string): Promise<AchievementUnlock | null> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return null;
  
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('achievement_key', achievementId)
    .eq('company_id', targetCompanyId)
    .maybeSingle();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching achievement unlock:', error);
    throw error;
  }
  
  return data ? rowToAchievementUnlock(data) : null;
}

/**
 * Get all achievement unlocks for a company
 */
export async function getAllAchievementUnlocks(companyId?: string): Promise<AchievementUnlock[]> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return [];
  
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('company_id', targetCompanyId)
    .order('unlocked_game_year', { ascending: false })
    .order('unlocked_game_season', { ascending: false })
    .order('unlocked_game_week', { ascending: false });
  
  if (error) {
    console.error('Error fetching achievement unlocks:', error);
    throw error;
  }
  
  return (data || []).map(rowToAchievementUnlock);
}

/**
 * Check if achievement is unlocked for a company
 */
export async function isAchievementUnlocked(achievementId: string, companyId?: string): Promise<boolean> {
  const unlock = await getAchievementUnlock(achievementId, companyId);
  return unlock !== null;
}

/**
 * Update achievement progress
 */
export async function updateAchievementProgress(
  achievementId: string, 
  progress: number, 
  metadata?: Record<string, any>,
  companyId?: string
): Promise<void> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return;
  
  const { error } = await supabase
    .from('achievements')
    .update({
      progress: progress !== undefined ? { current: progress } : undefined,
      metadata: metadata || {},
      updated_at: new Date().toISOString()
    })
    .eq('achievement_key', achievementId)
    .eq('company_id', targetCompanyId);
  
  if (error) {
    console.error('Error updating achievement progress:', error);
    throw error;
  }
}

/**
 * Delete all achievements for a company (for testing/reset)
 */
export async function deleteAllAchievements(companyId?: string): Promise<void> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return;
  
  const { error } = await supabase
    .from('achievements')
    .delete()
    .eq('company_id', targetCompanyId);
  
  if (error) {
    console.error('Error deleting achievements:', error);
    throw error;
  }
}

/**
 * Get achievement unlock count by category
 */
export async function getAchievementCountByCategory(category: string, companyId?: string): Promise<number> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return 0;

  // Note: This requires achievement_key to match category pattern
  // For now, we'll get all and filter in memory
  const unlocks = await getAllAchievementUnlocks(targetCompanyId);

  // Import here to avoid circular dependencies
  const { ALL_ACHIEVEMENTS } = await import('../../constants/achievementConstants');

  return unlocks.filter(unlock => {
    const config = ALL_ACHIEVEMENTS.find(a => a.id === unlock.achievementId);
    return config?.category === category;
  }).length;
}

/**
 * Get total achievement count for a company
 */
export async function getTotalAchievementCount(companyId?: string): Promise<number> {
  const unlocks = await getAllAchievementUnlocks(companyId);
  return unlocks.length;
}

