import { v4 as uuidv4 } from 'uuid';
import type { Vineyard, WineBatch, WineLogEntry } from '@/lib/types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { leaderboardsFeature } from '@/lib/features/leaderboards';
import { getGameState, getCurrentCompany } from '@/lib/services/core/gameState';
import {
  getWineProductionSummary as loadWineProductionSummary,
  insertWineLogEntry,
  loadWineLog,
  loadWineLogByVineyard,
  type WineLogData,
} from '@/lib/database';
import { calculateWineScore, getTasteQualityIndex } from '@/lib/services/wine/winescore/wineScoreCalculation';

const getEntryTasteQualityIndex = (entry: Pick<WineLogEntry, 'tasteQualityIndex'>): number =>
  entry.tasteQualityIndex;

const getEntryWineScore = (entry: Pick<WineLogEntry, 'wineScore' | 'tasteQualityIndex' | 'structureIndex'>): number =>
  entry.wineScore ?? ((getEntryTasteQualityIndex(entry) + entry.structureIndex) / 2);

const AGED_WINE_THRESHOLD_WEEKS = 156;

/**
 * Record a wine batch in the production log when it's bottled
 * This should be called when a wine batch reaches the 'bottled' stage
 */
export async function recordBottledWine(wineBatch: WineBatch): Promise<void> {
  try {
    if (wineBatch.state !== 'bottled') {
      throw new Error('Can only record bottled wines in the production log');
    }

    if (!wineBatch.bottledDate) {
      throw new Error('Bottled wine must have a completed date');
    }

    // Use bottled snapshots for historical records (immutable values at bottling time)
    // This ensures WineLog reflects the wine's quality at the moment it was bottled,
    // not its current quality which may continue evolving in the cellar
    const tasteQualityIndex = wineBatch.tasteQualityIndexBottlingSnapshot ?? getTasteQualityIndex(wineBatch);
    const landValueModifier = wineBatch.landValueModifierBottlingSnapshot ?? wineBatch.landValueModifier;
    const structureIndexSnapshot = wineBatch.structureIndexBottlingSnapshot ?? wineBatch.structureIndex;
    const wineScore = wineBatch.wineScoreBottlingSnapshot ?? calculateWineScore({ ...wineBatch, tasteQualityIndex, structureIndex: structureIndexSnapshot });

    const wineLogData: WineLogData = {
      id: uuidv4(),
      company_id: getCurrentCompanyId(),
      vineyard_id: wineBatch.vineyardId,
      vineyard_name: wineBatch.vineyardName,
      grape_variety: wineBatch.grape,
      vintage: wineBatch.harvestStartDate.year,
      quantity: wineBatch.quantity,
      taste_quality_index: tasteQualityIndex,
      land_value_modifier: landValueModifier,
      structure_index: structureIndexSnapshot,
      wine_score: wineScore, // Use bottled snapshot
      characteristics: wineBatch.characteristics,
      estimated_price: wineBatch.estimatedPrice,
      harvest_week: wineBatch.harvestStartDate.week,
      harvest_season: wineBatch.harvestStartDate.season,
      harvest_year: wineBatch.harvestStartDate.year,
      bottled_week: wineBatch.bottledDate.week,
      bottled_season: wineBatch.bottledDate.season,
      bottled_year: wineBatch.bottledDate.year
    };

    const result = await insertWineLogEntry(wineLogData);
    if (!result.success) throw new Error(result.error);

    // Submit wine-based highscores
    try {
      const gameState = getGameState();
      const currentCompany = getCurrentCompany();
      
      if (currentCompany && gameState) {
        await leaderboardsFeature.record.wine({
          companyId: currentCompany.id,
          companyName: currentCompany.name,
          gameWeek: gameState.week || 1,
          gameSeason: gameState.season || 'Spring',
          gameYear: gameState.currentYear || 2024,
          vineyardId: wineBatch.vineyardId,
          vineyardName: wineBatch.vineyardName,
          vintage: wineBatch.harvestStartDate.year,
          grape: wineBatch.grape,
          quantity: wineBatch.quantity,
          tasteQualityIndex,
          structureIndex: structureIndexSnapshot,
          wineScore,
          price: wineBatch.estimatedPrice,
        });

        // Also check if this vineyard should get a productivity record
        await updateVineyardProductivityHighscore(wineBatch.vineyardId, wineBatch.vineyardName);
      }
    } catch (highscoreError) {
      console.error('Failed to submit wine highscores:', highscoreError);
      // Don't fail the wine recording if highscore submission fails
    }
  } catch (error) {
    console.error('Error recording bottled wine:', error);
    throw error;
  }
}

/**
 * Get wine log entries for a specific vineyard
 */
export async function getVineyardWineHistory(vineyardId: string, companyId?: string): Promise<WineLogEntry[]> {
  return await loadWineLogByVineyard(vineyardId, companyId);
}

export async function getWineLogEntries(): Promise<WineLogEntry[]> {
  return await loadWineLog();
}

export async function getWineProductionSummary(companyId?: string) {
  return loadWineProductionSummary(companyId);
}


/**
 * Update vineyard productivity highscore based on total production
 */
async function updateVineyardProductivityHighscore(vineyardId: string, vineyardName: string): Promise<void> {
  try {
    const history = await getVineyardWineHistory(vineyardId);
    const totalBottles = history.reduce((sum, entry) => sum + entry.quantity, 0);
    
    const gameState = getGameState();
    const currentCompany = getCurrentCompany();
    
    if (currentCompany && gameState && totalBottles > 0) {
      await leaderboardsFeature.record.vineyard({
        companyId: currentCompany.id,
        companyName: currentCompany.name,
        gameWeek: gameState.week || 1,
        gameSeason: gameState.season || 'Spring',
        gameYear: gameState.currentYear || 2024,
        vineyardId,
        vineyardName,
        totalBottles,
      });
    }
  } catch (error) {
    console.error('Failed to update vineyard productivity highscore:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Enhanced vineyard analytics for statistics tab
 */
export interface VineyardAnalytics {
  // Production metrics
  totalBottles: number;
  totalRevenue: number;
  avgWineScore: number;
  avgQuality: number;
  avgPrice: number;
  revenuePerHectare: number;
  bottlesPerHectare: number;
  
  // Quality analysis
  consistencyScore: number;
  scoreTrend: number | null; // null for first vintage
  bestWine: WineLogEntry;
  
  // Rankings (among all vineyards)
  scoreRanking: number;
  priceRanking: number;
  roiRanking: number;
  totalVineyards: number;
  
  // Time-series data
  yearlyScores: Array<{ year: number; avgScore: number }>;
  
  // Grape performance
  grapePerformance: Array<{
    variety: string;
    vintages: number;
    avgWineScore: number;
    avgPrice: number;
  }>;
  
  // Feature statistics (from current cellar)
  featureStats: {
    terroir: number;
    oxidation: number;
    greenFlavor: number;
    bottleAging: number;
    total: number;
  };
  
  // Aging potential
  agingPotential: {
    agedWineCount: number;
    avgQuality: number | null;
  };
}

export interface VineyardAnalyticsInput {
  vineyardId: string;
  vineyardEntries: WineLogEntry[];
  allVineyards: Vineyard[];
  allWineLogGroups: Record<string, WineLogEntry[]>;
  allBatches: WineBatch[];
}

interface VineyardRankings {
  scoreRanking: Map<string, number>;
  priceRanking: Map<string, number>;
  roiRanking: Map<string, number>;
  totalVineyards: number;
}

function buildVineyardRankings(vineyards: Vineyard[], wineLogGroups: Record<string, WineLogEntry[]>): VineyardRankings {
  const producingVineyards = vineyards.filter(vineyard => (wineLogGroups[vineyard.id] || []).length > 0);
  const averages = producingVineyards.map(vineyard => {
    const entries = wineLogGroups[vineyard.id] || [];
    return {
      id: vineyard.id,
      avgWineScore: entries.reduce((sum, entry) => sum + getEntryWineScore(entry), 0) / entries.length,
      avgPrice: entries.reduce((sum, entry) => sum + entry.estimatedPrice, 0) / entries.length,
      revenuePerHa: entries.reduce((sum, entry) => sum + entry.quantity * entry.estimatedPrice, 0) / (vineyard.hectares || 1),
    };
  });

  const rank = (field: 'avgWineScore' | 'avgPrice' | 'revenuePerHa') => {
    const sorted = [...averages].sort((a, b) => b[field] - a[field]);
    return new Map(sorted.map((vineyard, index) => [vineyard.id, index + 1]));
  };

  return {
    scoreRanking: rank('avgWineScore'),
    priceRanking: rank('avgPrice'),
    roiRanking: rank('revenuePerHa'),
    totalVineyards: producingVineyards.length,
  };
}

/**
 * Calculate comprehensive analytics for a vineyard
 */
export function calculateVineyardAnalytics(
  { vineyardId, vineyardEntries, allVineyards, allWineLogGroups, allBatches }: VineyardAnalyticsInput,
  rankings = buildVineyardRankings(allVineyards, allWineLogGroups),
): VineyardAnalytics {
  // Production metrics
  const totalBottles = vineyardEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalRevenue = vineyardEntries.reduce((sum, entry) => sum + (entry.quantity * entry.estimatedPrice), 0);
  const avgQuality = vineyardEntries.reduce((sum, entry) => sum + getEntryTasteQualityIndex(entry), 0) / vineyardEntries.length;
  const avgWineScore = vineyardEntries.reduce((sum, entry) => sum + getEntryWineScore(entry), 0) / vineyardEntries.length;
  const avgPrice = vineyardEntries.reduce((sum, entry) => sum + entry.estimatedPrice, 0) / vineyardEntries.length;
  
  // Find vineyard for hectare calculations
  const vineyard = allVineyards.find(v => v.id === vineyardId);
  const hectares = vineyard?.hectares || 1;
  const revenuePerHectare = totalRevenue / hectares;
  const bottlesPerHectare = totalBottles / hectares;
  
  // Wine score consistency (standard deviation)
  const wineScores = vineyardEntries.map(e => getEntryWineScore(e));
  const scoreVariance = wineScores.reduce((sum, s) => sum + Math.pow(s - avgWineScore, 2), 0) / wineScores.length;
  const scoreStdDev = Math.sqrt(scoreVariance);
  const consistencyScore = Math.max(0, 100 - (scoreStdDev * 100));
  
  // Best wine (by wine score)
  const bestWine = vineyardEntries.reduce((best, entry) => {
    const entryScore = getEntryWineScore(entry);
    const bestScore = best ? getEntryWineScore(best) : 0;
    return !best || entryScore > bestScore ? entry : best;
  });
  
  // Wine score trend (first half vs second half)
  const midpoint = Math.floor(vineyardEntries.length / 2);
  const firstHalf = vineyardEntries.slice(0, midpoint);
  const secondHalf = vineyardEntries.slice(midpoint);
  const firstHalfAvg = firstHalf.length > 0 
    ? firstHalf.reduce((sum, e) => sum + getEntryWineScore(e), 0) / firstHalf.length 
    : 0;
  const secondHalfAvg = secondHalf.length > 0 
    ? secondHalf.reduce((sum, e) => sum + getEntryWineScore(e), 0) / secondHalf.length 
    : 0;
  const scoreTrend = vineyardEntries.length > 1 ? secondHalfAvg - firstHalfAvg : null;
  
  // Wine score by year (for sparkline visualization)
  const scoreByYear = vineyardEntries.reduce((acc, entry) => {
    if (!acc[entry.vintage]) {
      acc[entry.vintage] = { totalScore: 0, count: 0 };
    }
    acc[entry.vintage].totalScore += getEntryWineScore(entry);
    acc[entry.vintage].count += 1;
    return acc;
  }, {} as Record<number, { totalScore: number; count: number }>);
  
  const yearlyScores = Object.entries(scoreByYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      avgScore: data.totalScore / data.count
    }))
    .sort((a, b) => a.year - b.year);
  
  // Grape performance breakdown (by wine score)
  const grapePerformance = Object.entries(
    vineyardEntries.reduce((acc, entry) => {
      if (!acc[entry.grape]) {
        acc[entry.grape] = { scores: [], prices: [], count: 0 };
      }
      acc[entry.grape].scores.push(getEntryWineScore(entry));
      acc[entry.grape].prices.push(entry.estimatedPrice);
      acc[entry.grape].count += 1;
      return acc;
    }, {} as Record<string, { scores: number[]; prices: number[]; count: number }>)
  ).map(([grape, data]) => ({
    variety: grape,
    vintages: data.count,
    avgWineScore: data.scores.reduce((sum, s) => sum + s, 0) / data.count,
    avgPrice: data.prices.reduce((sum, p) => sum + p, 0) / data.count
  })).sort((a, b) => b.avgWineScore - a.avgWineScore);
  
  // Feature statistics (from current cellar wines)
  const cellarWinesFromVineyard = allBatches.filter(batch => 
    batch.vineyardId === vineyardId && batch.state === 'bottled' && batch.quantity > 0
  );
  
  const featureStats = {
    terroir: cellarWinesFromVineyard.filter(b => b.features?.some(f => f.id === 'terroir' && f.isPresent)).length,
    oxidation: cellarWinesFromVineyard.filter(b => b.features?.some(f => f.id === 'oxidation' && f.isPresent)).length,
    greenFlavor: cellarWinesFromVineyard.filter(b => b.features?.some(f => f.id === 'green_flavor' && f.isPresent)).length,
    bottleAging: cellarWinesFromVineyard.filter(b => b.features?.some(f => f.id === 'bottle_aging' && f.isPresent)).length,
    total: cellarWinesFromVineyard.length
  };
  
  // Aging potential analysis (wines that are still in cellar and aged 3+ years)
  const agedWinesFromVineyard = allBatches.filter(batch => 
    batch.vineyardId === vineyardId &&
    batch.state === 'bottled' &&
    batch.quantity > 0 &&
    (batch.agingProgress || 0) >= AGED_WINE_THRESHOLD_WEEKS
  );
  
  const avgAgingQuality = agedWinesFromVineyard.length > 0
    ? agedWinesFromVineyard.reduce((sum, b) => sum + getTasteQualityIndex(b), 0) / agedWinesFromVineyard.length
    : null;
  
  return {
    totalBottles,
    totalRevenue,
    avgWineScore,
    avgQuality,
    avgPrice,
    revenuePerHectare,
    bottlesPerHectare,
    consistencyScore,
    scoreTrend,
    bestWine,
    scoreRanking: rankings.scoreRanking.get(vineyardId) || 0,
    priceRanking: rankings.priceRanking.get(vineyardId) || 0,
    roiRanking: rankings.roiRanking.get(vineyardId) || 0,
    totalVineyards: rankings.totalVineyards,
    yearlyScores,
    grapePerformance,
    featureStats,
    agingPotential: {
      agedWineCount: agedWinesFromVineyard.length,
      avgQuality: avgAgingQuality
    }
  };
}

export function calculateAllVineyardAnalytics(
  vineyards: Vineyard[],
  allWineLogGroups: Record<string, WineLogEntry[]>,
  allBatches: WineBatch[],
): Record<string, VineyardAnalytics> {
  const rankings = buildVineyardRankings(vineyards, allWineLogGroups);

  return Object.fromEntries(
    vineyards
      .filter(vineyard => (allWineLogGroups[vineyard.id] || []).length > 0)
      .map(vineyard => [
        vineyard.id,
        calculateVineyardAnalytics({
          vineyardId: vineyard.id,
          vineyardEntries: allWineLogGroups[vineyard.id],
          allVineyards: vineyards,
          allWineLogGroups,
          allBatches,
        }, rankings),
      ]),
  );
}

