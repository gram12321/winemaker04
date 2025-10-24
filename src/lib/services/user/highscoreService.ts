import { notificationService } from '@/lib/services';
import { Season, NotificationCategory } from '../../types/types';
import { getExistingScore, upsertHighscore, loadHighscores, getCompanyScore, countHigherScores, countTotalScores, deleteHighscores, type ScoreType, type HighscoreData, type HighscoreEntry } from '@/lib/database';

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
      const existingScore = await getExistingScore(submission.companyId, submission.scoreType);

      // For most scores, higher is better. For lowest_price, lower is better.
      const isLowerBetter = submission.scoreType === 'lowest_price';
      const shouldUpdate = !existingScore || 
        (isLowerBetter ? 
          submission.scoreValue < existingScore.score_value : 
          submission.scoreValue > existingScore.score_value);

      if (!shouldUpdate) {
        return { success: true }; // Score not improved, but not an error
      }

      const highscoreData: HighscoreData = {
        company_id: submission.companyId,
        company_name: submission.companyName,
        score_type: submission.scoreType,
        score_value: submission.scoreValue,
        game_week: submission.gameWeek,
        game_season: submission.gameSeason,
        game_year: submission.gameYear,
        vineyard_id: submission.vineyardId,
        vineyard_name: submission.vineyardName,
        wine_vintage: submission.wineVintage,
        grape_variety: submission.grapeVariety,
        achieved_at: new Date().toISOString()
      };

      return await upsertHighscore(highscoreData);
    } catch (error) {
      console.error('Error submitting highscore:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getHighscores(scoreType: ScoreType, limit: number = 20): Promise<HighscoreEntry[]> {
    try {
      return await loadHighscores(scoreType, limit);
    } catch (error) {
      console.error('Error getting highscores:', error);
      return [];
    }
  }

  public async getCompanyRanking(companyId: string, scoreType: ScoreType): Promise<{ position: number; total: number } | null> {
    try {
      // Get the company's score
      const companyScore = await getCompanyScore(companyId, scoreType);

      if (!companyScore) {
        return null;
      }

      // Count how many companies have a higher score
      const higherCount = await countHigherScores(scoreType, companyScore.score_value);
      
      // Count total companies for this score type
      const totalCount = await countTotalScores(scoreType);

      if (higherCount === null || totalCount === null) {
        return null;
      }

      return {
        position: higherCount + 1,
        total: totalCount
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
      'highest_wine_score',
      'highest_grape_quality',
      'highest_balance',
      'highest_price',
      'lowest_price'
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
      grapeQuality: number;
      balance: number;
      wineScore: number;
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

      // Use the pre-calculated wine score from the database
      const wineScore = wineData.wineScore;

      const submissions: HighscoreSubmission[] = [
        {
          ...baseSubmission,
          scoreType: 'highest_vintage_quantity',
          scoreValue: wineData.quantity
        },
        {
          ...baseSubmission,
          scoreType: 'highest_wine_score',
          scoreValue: wineScore
        },
        {
          ...baseSubmission,
          scoreType: 'highest_grape_quality',
          scoreValue: wineData.grapeQuality
        },
        {
          ...baseSubmission,
          scoreType: 'highest_balance',
          scoreValue: wineData.balance
        },
        {
          ...baseSubmission,
          scoreType: 'highest_price',
          scoreValue: wineData.price
        },
        {
          ...baseSubmission,
          scoreType: 'lowest_price',
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
      const result = await deleteHighscores(scoreType);
      
      if (result.success) {
        const message = scoreType 
          ? `Cleared ${scoreType} highscores`
          : 'Cleared all highscores';
        await notificationService.addMessage(message, 'highscoreService.clearHighscores', 'Highscores Cleared', NotificationCategory.SYSTEM);
      }
      
      return result;
    } catch (error) {
      console.error('Error clearing highscores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
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
      'highest_wine_score': 'Highest Wine Score',
      'highest_grape_quality': 'Highest Grape Quality',
      'highest_balance': 'Highest Balance',
      'highest_price': 'Highest Price',
      'lowest_price': 'Lowest Price'
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
      'highest_wine_score': '%',
      'highest_grape_quality': '%',
      'highest_balance': '%',
      'highest_price': '€',
      'lowest_price': '€'
    };
    return units[scoreType] || '';
  }

  /**
   * Submit company highscores with business logic
   * This method handles the calculation of company value metrics and submits them
   */
  public async submitCompanyHighscores(
    companyId: string,
    companyName: string,
    gameWeek: number,
    gameSeason: Season,
    gameYear: number,
    foundedYear: number,
    currentCompanyValue: number,
    startingValue: number = 100000 // Default starting value from GAME_INITIALIZATION.STARTING_MONEY
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Calculate per-week metrics
      const weeksElapsed = Math.max(1, (gameYear - foundedYear) * 52 + gameWeek);
      const companyValuePerWeek = Math.max(0, currentCompanyValue - startingValue) / weeksElapsed;
      
      return await this.submitAllCompanyScores(
        companyId,
        companyName,
        gameWeek,
        gameSeason,
        gameYear,
        {
          companyValue: currentCompanyValue,
          companyValuePerWeek
        }
      );
    } catch (error) {
      console.error('Error submitting company highscores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }
}

export const highscoreService = new HighscoreService();
export default highscoreService;
