import { v4 as uuidv4 } from 'uuid';
import { WineBatch, WineLogEntry } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { highscoreService } from './highscoreService';
import { getGameState, getCurrentCompany } from '../core/gameState';
import { insertWineLogEntry, loadWineLogByVineyard, type WineLogData } from '@/lib/database';

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

    const wineLogData: WineLogData = {
      id: uuidv4(),
      company_id: getCurrentCompanyId(),
      vineyard_id: wineBatch.vineyardId,
      vineyard_name: wineBatch.vineyardName,
      grape_variety: wineBatch.grape,
      vintage: wineBatch.harvestStartDate.year,
      quantity: wineBatch.quantity,
      quality: wineBatch.quality,
      balance: wineBatch.balance,
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
        await highscoreService.submitWineHighscores(
          currentCompany.id,
          currentCompany.name,
          gameState.week || 1,
          gameState.season || 'Spring',
          gameState.currentYear || 2024,
          {
            vineyardId: wineBatch.vineyardId,
            vineyardName: wineBatch.vineyardName,
            vintage: wineBatch.harvestStartDate.year,
            grape: wineBatch.grape,
            quantity: wineBatch.quantity,
            quality: wineBatch.quality,
            balance: wineBatch.balance,
      price: wineBatch.estimatedPrice
          }
        );

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
export async function getVineyardWineHistory(vineyardId: string): Promise<WineLogEntry[]> {
  return await loadWineLogByVineyard(vineyardId);
}


/**
 * Calculate statistics for a vineyard based on its wine log
 */
export interface VineyardStats {
  totalBottles: number;
  totalVintages: number;
  averageQuality: number;
  averageBalance: number;
  averagePrice: number;
  bestVintage?: { year: number; quality: number };
  mostRecentVintage?: WineLogEntry;
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
      await highscoreService.submitVineyardProductivityHighscore(
        currentCompany.id,
        currentCompany.name,
        gameState.week || 1,
        gameState.season || 'Spring',
        gameState.currentYear || 2024,
        {
          vineyardId,
          vineyardName,
          totalBottles
        }
      );
    }
  } catch (error) {
    console.error('Failed to update vineyard productivity highscore:', error);
    // Don't throw - this is a background operation
  }
}

export async function calculateVineyardStats(vineyardId: string): Promise<VineyardStats> {
  const history = await getVineyardWineHistory(vineyardId);
  
  if (history.length === 0) {
    return {
      totalBottles: 0,
      totalVintages: 0,
      averageQuality: 0,
      averageBalance: 0,
      averagePrice: 0
    };
  }

  const totalBottles = history.reduce((sum, entry) => sum + entry.quantity, 0);
  const averageQuality = history.reduce((sum, entry) => sum + entry.quality, 0) / history.length;
  const averageBalance = history.reduce((sum, entry) => sum + entry.balance, 0) / history.length;
  const averagePrice = history.reduce((sum, entry) => sum + entry.estimatedPrice, 0) / history.length;
  
  const bestVintage = history.reduce((best, entry) => 
    !best || entry.quality > best.quality ? { year: entry.vintage, quality: entry.quality } : best
  , null as { year: number; quality: number } | null);

  const mostRecentVintage = history[0]; // Already sorted by bottled date descending

  return {
    totalBottles,
    totalVintages: history.length,
    averageQuality,
    averageBalance,
    averagePrice,
    bestVintage: bestVintage || undefined,
    mostRecentVintage
  };
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

/**
 * Calculate comprehensive analytics for a vineyard
 */
export function calculateVineyardAnalytics(
  vineyardId: string,
  vineyardEntries: WineLogEntry[],
  allVineyards: any[],
  allWineLogGroups: Record<string, WineLogEntry[]>,
  allBatches: WineBatch[]
): VineyardAnalytics {
  // Production metrics
  const totalBottles = vineyardEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalRevenue = vineyardEntries.reduce((sum, entry) => sum + (entry.quantity * entry.estimatedPrice), 0);
  const avgQuality = vineyardEntries.reduce((sum, entry) => sum + entry.quality, 0) / vineyardEntries.length;
  const avgWineScore = vineyardEntries.reduce((sum, entry) => sum + ((entry.quality + entry.balance) / 2), 0) / vineyardEntries.length;
  const avgPrice = vineyardEntries.reduce((sum, entry) => sum + entry.estimatedPrice, 0) / vineyardEntries.length;
  
  // Find vineyard for hectare calculations
  const vineyard = allVineyards.find(v => v.id === vineyardId);
  const hectares = vineyard?.hectares || 1;
  const revenuePerHectare = totalRevenue / hectares;
  const bottlesPerHectare = totalBottles / hectares;
  
  // Wine score consistency (standard deviation)
  const wineScores = vineyardEntries.map(e => (e.quality + e.balance) / 2);
  const scoreVariance = wineScores.reduce((sum, s) => sum + Math.pow(s - avgWineScore, 2), 0) / wineScores.length;
  const scoreStdDev = Math.sqrt(scoreVariance);
  const consistencyScore = Math.max(0, 100 - (scoreStdDev * 100));
  
  // Best wine (by wine score)
  const bestWine = vineyardEntries.reduce((best, entry) => {
    const entryScore = (entry.quality + entry.balance) / 2;
    const bestScore = best ? (best.quality + best.balance) / 2 : 0;
    return !best || entryScore > bestScore ? entry : best;
  });
  
  // Rankings among all producing vineyards
  const producingVineyards = allVineyards.filter(v => (allWineLogGroups[v.id] || []).length > 0);
  const vineyardAvgs = producingVineyards.map(v => {
    const entries = allWineLogGroups[v.id] || [];
    return {
      id: v.id,
      avgWineScore: entries.reduce((sum, e) => sum + ((e.quality + e.balance) / 2), 0) / entries.length,
      avgPrice: entries.reduce((sum, e) => sum + e.estimatedPrice, 0) / entries.length,
      revenuePerHa: entries.reduce((sum, e) => sum + (e.quantity * e.estimatedPrice), 0) / (v.hectares || 1)
    };
  });
  
  const scoreRanked = [...vineyardAvgs].sort((a, b) => b.avgWineScore - a.avgWineScore);
  const priceRanked = [...vineyardAvgs].sort((a, b) => b.avgPrice - a.avgPrice);
  const roiRanked = [...vineyardAvgs].sort((a, b) => b.revenuePerHa - a.revenuePerHa);
  
  const scoreRanking = scoreRanked.findIndex(v => v.id === vineyardId) + 1;
  const priceRanking = priceRanked.findIndex(v => v.id === vineyardId) + 1;
  const roiRanking = roiRanked.findIndex(v => v.id === vineyardId) + 1;
  
  // Wine score trend (first half vs second half)
  const midpoint = Math.floor(vineyardEntries.length / 2);
  const firstHalf = vineyardEntries.slice(0, midpoint);
  const secondHalf = vineyardEntries.slice(midpoint);
  const firstHalfAvg = firstHalf.length > 0 
    ? firstHalf.reduce((sum, e) => sum + ((e.quality + e.balance) / 2), 0) / firstHalf.length 
    : 0;
  const secondHalfAvg = secondHalf.length > 0 
    ? secondHalf.reduce((sum, e) => sum + ((e.quality + e.balance) / 2), 0) / secondHalf.length 
    : 0;
  const scoreTrend = vineyardEntries.length > 1 ? secondHalfAvg - firstHalfAvg : null;
  
  // Wine score by year (for sparkline visualization)
  const scoreByYear = vineyardEntries.reduce((acc, entry) => {
    if (!acc[entry.vintage]) {
      acc[entry.vintage] = { totalScore: 0, count: 0 };
    }
    acc[entry.vintage].totalScore += (entry.quality + entry.balance) / 2;
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
      acc[entry.grape].scores.push((entry.quality + entry.balance) / 2);
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
    (batch.agingProgress || 0) >= 156 // 3+ years
  );
  
  const avgAgingQuality = agedWinesFromVineyard.length > 0
    ? agedWinesFromVineyard.reduce((sum, b) => sum + b.quality, 0) / agedWinesFromVineyard.length
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
    scoreRanking,
    priceRanking,
    roiRanking,
    totalVineyards: producingVineyards.length,
    yearlyScores,
    grapePerformance,
    featureStats,
    agingPotential: {
      agedWineCount: agedWinesFromVineyard.length,
      avgQuality: avgAgingQuality
    }
  };
}