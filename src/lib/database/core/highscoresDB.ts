import { supabase } from './supabase';

const HIGHSCORES_TABLE = 'highscores';

/**
 * Highscores Database Operations
 * Pure CRUD operations for highscores data persistence
 */

export type ScoreType = 
  | 'company_value' 
  | 'company_value_per_week'
  | 'highest_vintage_quantity'
  | 'most_productive_vineyard'
  | 'highest_wine_score'
  | 'highest_taste_quality_index'
  | 'highest_structure_index'
  | 'highest_price'
  | 'lowest_price';

export interface HighscoreData {
  company_id: string;
  company_name: string;
  score_type: ScoreType;
  score_value: number;
  game_week?: number;
  game_season?: string;
  game_year?: number;
  vineyard_id?: string;
  vineyard_name?: string;
  wine_vintage?: number;
  grape_variety?: string;
  achieved_at: string;
}

export const upsertHighscore = async (highscoreData: HighscoreData): Promise<{ success: boolean; error?: string }> => {
  try {
    const isCompanyAggregate = highscoreData.score_type === 'company_value' || highscoreData.score_type === 'company_value_per_week';

    if (isCompanyAggregate) return upsertCompanyAggregateHighscore(highscoreData);

    // For non-aggregate types, allow multiple entries per company
    const { error } = await supabase
      .from(HIGHSCORES_TABLE)
      .insert(highscoreData);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error upserting/inserting highscore:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

/** Atomically keep the best aggregate score for one company and score type. */
export const upsertCompanyAggregateHighscore = async (highscoreData: HighscoreData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('upsert_company_aggregate_highscore', {
      p_company_id: highscoreData.company_id,
      p_company_name: highscoreData.company_name,
      p_score_type: highscoreData.score_type,
      p_score_value: highscoreData.score_value,
      p_game_week: highscoreData.game_week ?? null,
      p_game_season: highscoreData.game_season ?? null,
      p_game_year: highscoreData.game_year ?? null,
      p_achieved_at: highscoreData.achieved_at,
    });
    if (error) return { success: false, error: error.message };
    return data?.success === false ? { success: false, error: data.error } : { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export interface HighscoreEntry {
  id: string;
  companyId: string;
  companyName: string;
  scoreType: ScoreType;
  scoreValue: number;
  gameWeek?: number;
  gameSeason?: string;
  gameYear?: number;
  achievedAt: Date;
  createdAt: Date;
  vineyardId?: string;
  vineyardName?: string;
  wineVintage?: number;
  grapeVariety?: string;
}

export interface CompanyLeaderboardContextData {
  position: number;
  total: number;
  startIndex: number;
  entries: HighscoreEntry[];
}

/**
 * Map database row to HighscoreEntry
 */
function mapHighscoreFromDB(dbScore: any): HighscoreEntry {
  return {
    id: dbScore.id,
    companyId: dbScore.company_id,
    companyName: dbScore.company_name,
    scoreType: dbScore.score_type as ScoreType,
    scoreValue: dbScore.score_value,
    gameWeek: dbScore.game_week,
    gameSeason: dbScore.game_season,
    gameYear: dbScore.game_year,
    achievedAt: new Date(dbScore.achieved_at),
    createdAt: new Date(dbScore.created_at),
    vineyardId: dbScore.vineyard_id,
    vineyardName: dbScore.vineyard_name,
    wineVintage: dbScore.wine_vintage,
    grapeVariety: dbScore.grape_variety
  };
}

export const loadHighscores = async (scoreType: ScoreType, limit: number = 20): Promise<HighscoreEntry[]> => {
  try {
    const ascending = scoreType === 'lowest_price';
    
    const { data, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('*')
      .eq('score_type', scoreType)
      .order('score_value', { ascending })
      .order('achieved_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapHighscoreFromDB);
  } catch (error) {
    console.error('Error loading highscores:', error);
    return [];
  }
};

/**
 * Produces a single ordered company ranking projection for one score type.
 * Historical entries are reduced to the company’s best record before ranking.
 */
export const loadCompanyLeaderboardContext = async (
  companyId: string,
  scoreType: ScoreType,
  window = 2,
): Promise<CompanyLeaderboardContextData | null> => {
  try {
    const { data, error } = await supabase.rpc('get_company_leaderboard_context', {
      p_company_id: companyId,
      p_score_type: scoreType,
      p_window: window,
    });
    if (error) throw error;
    if (!data || data.total === 0) return null;

    return {
      position: data.position,
      total: data.total,
      startIndex: data.startIndex,
      entries: (data.entries || []).map(mapHighscoreFromDB),
    };
  } catch (error) {
    console.error('Error loading company leaderboard context:', error);
    return null;
  }
};

export const deleteHighscores = async (scoreType?: ScoreType): Promise<{ success: boolean; error?: string }> => {
  try {
    let query = supabase.from(HIGHSCORES_TABLE).delete();
    
    if (scoreType) {
      query = query.eq('score_type', scoreType);
    } else {
      query = query.neq('id', ''); // Delete all
    }

    const { error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting highscores:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

