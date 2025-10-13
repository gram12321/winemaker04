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
  | 'highest_wine_quality'
  | 'highest_wine_balance'
  | 'highest_wine_price'
  | 'lowest_wine_price';

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

export const getExistingScore = async (companyId: string, scoreType: ScoreType): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('score_value')
      .eq('company_id', companyId)
      .eq('score_type', scoreType)
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error getting existing score:', error);
    return null;
  }
};

export const upsertHighscore = async (highscoreData: HighscoreData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(HIGHSCORES_TABLE)
      .upsert(highscoreData, {
        onConflict: 'company_id,score_type'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error upserting highscore:', error);
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
    const ascending = scoreType === 'lowest_wine_price';
    
    const { data, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('*')
      .eq('score_type', scoreType)
      .order('score_value', { ascending })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapHighscoreFromDB);
  } catch (error) {
    console.error('Error loading highscores:', error);
    return [];
  }
};

export const getCompanyScore = async (companyId: string, scoreType: ScoreType): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('score_value')
      .eq('company_id', companyId)
      .eq('score_type', scoreType);

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error getting company score:', error);
    return null;
  }
};

export const countHigherScores = async (scoreType: ScoreType, scoreValue: number): Promise<number | null> => {
  try {
    const { count, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('score_type', scoreType)
      .gt('score_value', scoreValue);

    if (error) throw error;
    return count;
  } catch (error) {
    console.error('Error counting higher scores:', error);
    return null;
  }
};

export const countTotalScores = async (scoreType: ScoreType): Promise<number | null> => {
  try {
    const { count, error } = await supabase
      .from(HIGHSCORES_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('score_type', scoreType);

    if (error) throw error;
    return count;
  } catch (error) {
    console.error('Error counting total scores:', error);
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

