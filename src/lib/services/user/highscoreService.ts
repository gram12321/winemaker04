import { supabase } from '../../database/supabase';
import { notificationService } from '@/components/layout/NotificationCenter';
import { Season } from '../../types';

export type ScoreType = 'company_value' | 'company_value_per_week';

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
}

export interface HighscoreSubmission {
  companyId: string;
  companyName: string;
  scoreType: ScoreType;
  scoreValue: number;
  gameWeek?: number;
  gameSeason?: Season;
  gameYear?: number;
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

      // Only update if the new score is higher
      if (existingScore && existingScore.score_value >= submission.scoreValue) {
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
      const { data: scores, error } = await supabase
        .from('highscores')
        .select('*')
        .eq('score_type', scoreType)
        .order('score_value', { ascending: false })
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
    const scoreTypes: ScoreType[] = ['company_value', 'company_value_per_week'];
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
      createdAt: new Date(dbScore.created_at)
    };
  }
}

export const highscoreService = new HighscoreService();
export default highscoreService;
