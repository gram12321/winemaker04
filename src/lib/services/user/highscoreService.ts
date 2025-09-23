import { supabase } from '../../database/supabase';
import { notificationService } from '@/components/layout/NotificationCenter';
import { Season } from '../../types/types';

export type ScoreType = 
  | 'company_value' 
  | 'company_value_per_week'
  | 'highest_vintage_quantity'
  | 'most_productive_vineyard'
  | 'highest_wine_quality'
  | 'highest_wine_balance'
  | 'highest_wine_price'
  | 'lowest_wine_price';

export interface HighscoreEntry {
  id: string;
  companyId: string;
  companyName: string;
  scoreType: ScoreType;
  scoreValue: number;
  gameWeek?: number;
  gameSeason?: Season;
  gameYear?: number;
  achievedAt: Date;
  createdAt: Date;
  
  // Wine-specific data
  vineyardId?: string;
  vineyardName?: string;
  wineVintage?: number;
  grapeVariety?: string;
}

export interface HighscoreSubmission {
  companyId: string;
  companyName: string;
  scoreType: ScoreType;
  scoreValue: number;
  gameWeek?: number;
  gameSeason?: Season;
  gameYear?: number;
  
  // Wine-specific data
  vineyardId?: string;
  vineyardName?: string;
  wineVintage?: number;
  grapeVariety?: string;
}

class HighscoreService {
  public async submitHighscore(submission: HighscoreSubmission): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if there's an existing highscore for this company and score type
      const { data: existingScores, error: existingError } = await supabase
        .from('highscores')
        .select('score_value')
        .eq('company_id', submission.companyId)
        .eq('score_type', submission.scoreType)
        .limit(1);

      if (existingError) {
        console.error('Error checking existing score:', existingError);
        return { success: false, error: existingError.message };
      }

      const existingScore = existingScores?.[0];

      // For most scores, higher is better. For lowest_wine_price, lower is better.
      const isLowerBetter = submission.scoreType === 'lowest_wine_price';
      const shouldUpdate = !existingScore || 
        (isLowerBetter ? 
          submission.scoreValue < existingScore.score_value : 
          submission.scoreValue > existingScore.score_value);

      if (!shouldUpdate) {
        return { success: true }; // Score not improved, but not an error
      }

      const { error } = await supabase
        .from('highscores')
        .upsert({
          company_id: submission.companyId,
          company_name: submission.companyName,
          score_type: submission.scoreType,
          score_value: submission.scoreValue, // Store in euros directly
          game_week: submission.gameWeek,
          game_season: submission.gameSeason,
          game_year: submission.gameYear,
          vineyard_id: submission.vineyardId,
          vineyard_name: submission.vineyardName,
          wine_vintage: submission.wineVintage,
          grape_variety: submission.grapeVariety,
          achieved_at: new Date().toISOString()
        }, {
          onConflict: 'company_id,score_type'
        });

      if (error) {
        console.error('Error submitting highscore:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting highscore:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getHighscores(scoreType: ScoreType, limit: number = 20): Promise<HighscoreEntry[]> {
    try {
      // For lowest_wine_price, order ascending (lowest first). For others, descending (highest first).
      const ascending = scoreType === 'lowest_wine_price';
      
      const { data: scores, error } = await supabase
        .from('highscores')
        .select('*')
        .eq('score_type', scoreType)
        .order('score_value', { ascending })
        .limit(limit);

      if (error) {
        console.error('Error getting highscores:', error);
        return [];
      }

      return scores.map(this.mapDatabaseHighscore);
    } catch (error) {
      console.error('Error getting highscores:', error);
      return [];
    }
  }

  public async getCompanyRanking(companyId: string, scoreType: ScoreType): Promise<{ position: number; total: number } | null> {
    try {
      // Get the company's score
      const { data: companyScores, error } = await supabase
        .from('highscores')
        .select('score_value')
        .eq('company_id', companyId)
        .eq('score_type', scoreType);

      if (error) {
        console.error('Error getting company score:', error);
        return null;
      }

      if (!companyScores || companyScores.length === 0) {
        return null;
      }

      const companyScore = companyScores[0];

      // Count how many companies have a higher score
      const { count: higherCount, error: higherCountError } = await supabase
        .from('highscores')
        .select('*', { count: 'exact', head: true })
        .eq('score_type', scoreType)
        .gt('score_value', companyScore.score_value);

      if (higherCountError) {
        console.error('Error counting higher scores:', higherCountError);
        return null;
      }

      // Count total companies for this score type
      const { count: totalCount, error: totalCountError } = await supabase
        .from('highscores')
        .select('*', { count: 'exact', head: true })
        .eq('score_type', scoreType);

      if (totalCountError) {
        console.error('Error counting total scores:', totalCountError);
        return null;
      }

      return {
        position: (higherCount || 0) + 1,
        total: totalCount || 0
      };
    } catch (error) {
      console.error('Error getting company ranking:', error);
      return null;
    }
  }

  public async getCompanyRankings(companyId: string): Promise<Record<ScoreType, { position: number; total: number }>> {
    const scoreTypes: ScoreType[] = [
      'company_value', 
      'company_value_per_week',
      'highest_vintage_quantity',
      'most_productive_vineyard',
      'highest_wine_quality',
      'highest_wine_balance',
      'highest_wine_price',
      'lowest_wine_price'
    ];
    const rankings: Record<ScoreType, { position: number; total: number }> = {} as any;

    for (const scoreType of scoreTypes) {
      const ranking = await this.getCompanyRanking(companyId, scoreType);
      rankings[scoreType] = ranking || { position: 0, total: 0 };
    }

    return rankings;
  }

  public async submitAllCompanyScores(
    companyId: string,
    companyName: string,
    gameWeek: number,
    gameSeason: Season,
    gameYear: number,
    scores: {
      companyValue: number;
      companyValuePerWeek: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const submissions: HighscoreSubmission[] = [
        {
          companyId,
          companyName,
          scoreType: 'company_value',
          scoreValue: scores.companyValue,
          gameWeek,
          gameSeason,
          gameYear
        },
        {
          companyId,
          companyName,
          scoreType: 'company_value_per_week',
          scoreValue: scores.companyValuePerWeek,
          gameWeek,
          gameSeason,
          gameYear
        }
      ];

      for (const submission of submissions) {
        const result = await this.submitHighscore(submission);
        if (!result.success && result.error) {
          return result;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting all company scores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Submit wine-based highscores from a wine log entry
   */
  public async submitWineHighscores(
    companyId: string,
    companyName: string,
    gameWeek: number,
    gameSeason: Season,
    gameYear: number,
    wineData: {
      vineyardId: string;
      vineyardName: string;
      vintage: number;
      grape: string;
      quantity: number;
      quality: number;
      balance: number;
      price: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseSubmission = {
        companyId,
        companyName,
        gameWeek,
        gameSeason,
        gameYear,
        vineyardId: wineData.vineyardId,
        vineyardName: wineData.vineyardName,
        wineVintage: wineData.vintage,
        grapeVariety: wineData.grape
      };

      const submissions: HighscoreSubmission[] = [
        {
          ...baseSubmission,
          scoreType: 'highest_vintage_quantity',
          scoreValue: wineData.quantity
        },
        {
          ...baseSubmission,
          scoreType: 'highest_wine_quality',
          scoreValue: wineData.quality
        },
        {
          ...baseSubmission,
          scoreType: 'highest_wine_balance',
          scoreValue: wineData.balance
        },
        {
          ...baseSubmission,
          scoreType: 'highest_wine_price',
          scoreValue: wineData.price
        },
        {
          ...baseSubmission,
          scoreType: 'lowest_wine_price',
          scoreValue: wineData.price
        }
      ];

      for (const submission of submissions) {
        const result = await this.submitHighscore(submission);
        if (!result.success && result.error) {
          return result;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting wine highscores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Submit most productive vineyard highscore
   */
  public async submitVineyardProductivityHighscore(
    companyId: string,
    companyName: string,
    gameWeek: number,
    gameSeason: Season,
    gameYear: number,
    vineyardData: {
      vineyardId: string;
      vineyardName: string;
      totalBottles: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const submission: HighscoreSubmission = {
        companyId,
        companyName,
        scoreType: 'most_productive_vineyard',
        scoreValue: vineyardData.totalBottles,
        gameWeek,
        gameSeason,
        gameYear,
        vineyardId: vineyardData.vineyardId,
        vineyardName: vineyardData.vineyardName
      };

      return await this.submitHighscore(submission);
    } catch (error) {
      console.error('Error submitting vineyard productivity highscore:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async clearHighscores(scoreType?: ScoreType): Promise<{ success: boolean; error?: string }> {
    try {
      let query = supabase.from('highscores').delete();
      
      if (scoreType) {
        query = query.eq('score_type', scoreType);
      } else {
        query = query.neq('id', ''); // Delete all
      }

      const { error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      const message = scoreType 
        ? `Cleared ${scoreType} highscores`
        : 'Cleared all highscores';
      notificationService.info(message);
      return { success: true };
    } catch (error) {
      console.error('Error clearing highscores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  private mapDatabaseHighscore(dbScore: any): HighscoreEntry {
    return {
      id: dbScore.id,
      companyId: dbScore.company_id,
      companyName: dbScore.company_name,
      scoreType: dbScore.score_type as ScoreType,
      scoreValue: dbScore.score_value, // Already in euros
      gameWeek: dbScore.game_week,
      gameSeason: dbScore.game_season as Season,
      gameYear: dbScore.game_year,
      achievedAt: new Date(dbScore.achieved_at),
      createdAt: new Date(dbScore.created_at),
      vineyardId: dbScore.vineyard_id,
      vineyardName: dbScore.vineyard_name,
      wineVintage: dbScore.wine_vintage,
      grapeVariety: dbScore.grape_variety
    };
  }

  /**
   * Get human-readable name for score type
   */
  public getScoreTypeName(scoreType: ScoreType): string {
    const names: Record<ScoreType, string> = {
      'company_value': 'Company Value',
      'company_value_per_week': 'Company Value per Week',
      'highest_vintage_quantity': 'Highest Single Vintage Quantity',
      'most_productive_vineyard': 'Most Productive Vineyard',
      'highest_wine_quality': 'Highest Wine Quality',
      'highest_wine_balance': 'Highest Wine Balance',
      'highest_wine_price': 'Highest Wine Price',
      'lowest_wine_price': 'Lowest Wine Price'
    };
    return names[scoreType] || scoreType;
  }

  /**
   * Get appropriate unit for score type
   */
  public getScoreUnit(scoreType: ScoreType): string {
    const units: Record<ScoreType, string> = {
      'company_value': '€',
      'company_value_per_week': '€/week',
      'highest_vintage_quantity': 'bottles',
      'most_productive_vineyard': 'bottles',
      'highest_wine_quality': '%',
      'highest_wine_balance': '%',
      'highest_wine_price': '€',
      'lowest_wine_price': '€'
    };
    return units[scoreType] || '';
  }
}

export const highscoreService = new HighscoreService();
export default highscoreService;
