import { Season } from '@/lib/types/types';
import { GAME_INITIALIZATION } from '@/lib/constants/constants';
import { WEEKS_PER_YEAR } from '@/lib/constants/timeConstants';
import { upsertCompanyAggregateHighscore, upsertHighscore, loadCompanyLeaderboardContext, loadHighscores, deleteHighscores, type HighscoreData, type HighscoreEntry } from '@/lib/database';
import type {
  LeaderboardCompanyRecordInput,
  LeaderboardContext,
  LeaderboardEntry,
  LeaderboardKind,
  LeaderboardRanking,
  LeaderboardResult,
  LeaderboardVineyardRecordInput,
  LeaderboardWineRecordInput,
} from '../featureTypes';

const LEADERBOARD_KINDS: LeaderboardKind[] = [
  'company_value',
  'company_value_per_week',
  'highest_vintage_quantity',
  'most_productive_vineyard',
  'highest_wine_score',
  'highest_taste_quality_index',
  'highest_structure_index',
  'highest_price',
  'lowest_price',
];

interface HighscoreSubmission {
  companyId: string;
  companyName: string;
  scoreType: LeaderboardKind;
  scoreValue: number;
  gameWeek?: number;
  gameSeason?: Season;
  gameYear?: number;
  achievedAt?: string; // ISO string; when provided, overrides default now
  
  // Wine-specific data
  vineyardId?: string;
  vineyardName?: string;
  wineVintage?: number;
  grapeVariety?: string;
}

function mapEntry(entry: HighscoreEntry): LeaderboardEntry {
  return {
    id: entry.id,
    companyId: entry.companyId,
    companyName: entry.companyName,
    kind: entry.scoreType,
    value: entry.scoreValue,
    gameWeek: entry.gameWeek,
    gameSeason: entry.gameSeason as Season | undefined,
    gameYear: entry.gameYear,
    achievedAt: entry.achievedAt,
    vineyardId: entry.vineyardId,
    vineyardName: entry.vineyardName,
    wineVintage: entry.wineVintage,
    grapeVariety: entry.grapeVariety,
  };
}

export class LeaderboardService {
  private async submitHighscore(submission: HighscoreSubmission): Promise<LeaderboardResult> {
    try {
      const isCompanyAggregate = submission.scoreType === 'company_value' || submission.scoreType === 'company_value_per_week';

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
        achieved_at: submission.achievedAt || new Date().toISOString()
      };

      return isCompanyAggregate
        ? upsertCompanyAggregateHighscore(highscoreData)
        : upsertHighscore(highscoreData);
    } catch (error) {
      console.error('Error submitting highscore:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getHighscores(scoreType: LeaderboardKind, limit: number = 20): Promise<LeaderboardEntry[]> {
    try {
      return (await loadHighscores(scoreType, limit)).map(mapEntry);
    } catch (error) {
      console.error('Error getting highscores:', error);
      return [];
    }
  }

  public async getCompanyRanking(companyId: string, scoreType: LeaderboardKind): Promise<LeaderboardRanking | null> {
    try {
      const context = await loadCompanyLeaderboardContext(companyId, scoreType, 0);
      return context ? { position: context.position, total: context.total } : null;
    } catch (error) {
      console.error('Error getting company ranking:', error);
      return null;
    }
  }

  public async getCompanyRankings(companyId: string): Promise<Record<LeaderboardKind, LeaderboardRanking>> {
    const rankings = await Promise.all(
      LEADERBOARD_KINDS.map(async (scoreType) => [
        scoreType,
        (await this.getCompanyRanking(companyId, scoreType)) || { position: 0, total: 0 },
      ] as const),
    );
    return Object.fromEntries(rankings) as Record<LeaderboardKind, LeaderboardRanking>;
  }

  /**
   * Get a company's leaderboard context: two entries above and two below (window configurable)
   */
  public async getCompanyHighscoreContext(
    companyId: string,
    scoreType: LeaderboardKind,
    window: number = 2
  ): Promise<LeaderboardContext | null> {
    try {
      const context = await loadCompanyLeaderboardContext(companyId, scoreType, window);
      return context
        ? {
            position: context.position,
            total: context.total,
            entries: context.entries.map(mapEntry),
            startIndex: context.startIndex,
          }
        : null;
    } catch (error) {
      console.error('Error getting company highscore context:', error);
      return null;
    }
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
  public async submitWineHighscores(input: LeaderboardWineRecordInput): Promise<LeaderboardResult> {
    try {
      const { companyId, companyName, gameWeek, gameSeason, gameYear, ...wineData } = input;
      const baseSubmission = {
        companyId,
        companyName,
        gameWeek,
        gameSeason,
        gameYear,
        vineyardId: wineData.vineyardId,
        vineyardName: wineData.vineyardName,
        wineVintage: wineData.vintage,
        grapeVariety: wineData.grape,
        achievedAt: wineData.bottledAt
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
          scoreType: 'highest_taste_quality_index',
          scoreValue: wineData.tasteQualityIndex
        },
        {
          ...baseSubmission,
          scoreType: 'highest_structure_index',
          scoreValue: wineData.structureIndex
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
  public async submitVineyardProductivityHighscore(input: LeaderboardVineyardRecordInput): Promise<LeaderboardResult> {
    try {
      const { companyId, companyName, gameWeek, gameSeason, gameYear, ...vineyardData } = input;
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

  public async clearHighscores(scoreType?: LeaderboardKind): Promise<LeaderboardResult> {
    try {
      return await deleteHighscores(scoreType);
    } catch (error) {
      console.error('Error clearing highscores:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get human-readable name for score type
   */
  public getScoreTypeName(scoreType: LeaderboardKind): string {
    const names: Record<LeaderboardKind, string> = {
      'company_value': 'Company Value',
      'company_value_per_week': 'Company Value per Week',
      'highest_vintage_quantity': 'Highest Single Vintage Quantity',
      'most_productive_vineyard': 'Most Productive Vineyard',
      'highest_wine_score': 'Highest Wine Score',
      'highest_taste_quality_index': 'Highest Taste Quality',
      'highest_structure_index': 'Highest Structure Index',
      'highest_price': 'Highest Price',
      'lowest_price': 'Lowest Price'
    };
    return names[scoreType] || scoreType;
  }

  /**
   * Get appropriate unit for score type
   */
  public getScoreUnit(scoreType: LeaderboardKind): string {
    const units: Record<LeaderboardKind, string> = {
      'company_value': '€',
      'company_value_per_week': '€/week',
      'highest_vintage_quantity': 'bottles',
      'most_productive_vineyard': 'bottles',
      'highest_wine_score': '%',
      'highest_taste_quality_index': '%',
      'highest_structure_index': '%',
      'highest_price': '€',
      'lowest_price': '€'
    };
    return units[scoreType] || '';
  }

  /**
   * Submit company highscores with business logic
   * This method handles the calculation of company value metrics and submits them
   */
  public async submitCompanyHighscores(input: LeaderboardCompanyRecordInput): Promise<LeaderboardResult> {
    try {
      const {
        companyId,
        companyName,
        gameWeek,
        gameSeason,
        gameYear,
        foundedYear,
        companyValue: currentCompanyValue,
        startingValue = GAME_INITIALIZATION.STARTING_MONEY,
      } = input;
      // Calculate per-week metrics
      const weeksElapsed = Math.max(1, (gameYear - foundedYear) * WEEKS_PER_YEAR + gameWeek);
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

export const leaderboardService = new LeaderboardService();

