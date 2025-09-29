// Wine production log service - tracks finished wine production history
import { v4 as uuidv4 } from 'uuid';
import { WineLogEntry, WineBatch } from '../../types/types';
import { supabase } from '../../database/core/supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { highscoreService } from './highscoreService';
import { getGameState, getCurrentCompany } from '../core/gameState';

const WINE_LOG_TABLE = 'wine_log';

/**
 * Record a wine batch in the production log when it's bottled
 * This should be called when a wine batch reaches the 'bottled' stage
 */
export async function recordBottledWine(wineBatch: WineBatch): Promise<void> {
  try {
    if (wineBatch.stage !== 'bottled') {
      throw new Error('Can only record bottled wines in the production log');
    }

    if (!wineBatch.completedAt) {
      throw new Error('Bottled wine must have a completed date');
    }

    const wineLogEntry = {
      id: uuidv4(),
      company_id: getCurrentCompanyId(),
      vineyard_id: wineBatch.vineyardId,
      vineyard_name: wineBatch.vineyardName,
      grape_variety: wineBatch.grape,
      vintage: wineBatch.harvestDate.year,
      quantity: wineBatch.quantity,
      quality: wineBatch.quality,
      balance: wineBatch.balance,
      characteristics: wineBatch.characteristics,
      final_price: wineBatch.finalPrice,
      harvest_week: wineBatch.harvestDate.week,
      harvest_season: wineBatch.harvestDate.season,
      harvest_year: wineBatch.harvestDate.year,
      bottled_week: wineBatch.completedAt.week,
      bottled_season: wineBatch.completedAt.season,
      bottled_year: wineBatch.completedAt.year,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from(WINE_LOG_TABLE)
      .insert(wineLogEntry);

    if (error) throw error;

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
            vintage: wineBatch.harvestDate.year,
            grape: wineBatch.grape,
            quantity: wineBatch.quantity,
            quality: wineBatch.quality,
            balance: wineBatch.balance,
            price: wineBatch.finalPrice
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
 * Load all wine log entries for the current company
 */
export async function loadWineLog(): Promise<WineLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from(WINE_LOG_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('bottled_year', { ascending: false })
      .order('bottled_season', { ascending: false })
      .order('bottled_week', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      vineyardId: row.vineyard_id,
      vineyardName: row.vineyard_name,
      grape: row.grape_variety,
      vintage: row.vintage,
      quantity: row.quantity,
      quality: row.quality,
      balance: row.balance,
      characteristics: row.characteristics,
      finalPrice: row.final_price,
      harvestDate: {
        week: row.harvest_week,
        season: row.harvest_season,
        year: row.harvest_year
      },
      bottledDate: {
        week: row.bottled_week,
        season: row.bottled_season,
        year: row.bottled_year
      },
      created_at: row.created_at
    }));
  } catch (error) {
    console.error('Error loading wine log:', error);
    return [];
  }
}

/**
 * Get wine log entries for a specific vineyard
 */
export async function getVineyardWineHistory(vineyardId: string): Promise<WineLogEntry[]> {
  try {
    const allEntries = await loadWineLog();
    return allEntries.filter(entry => entry.vineyardId === vineyardId);
  } catch (error) {
    console.error('Error loading vineyard wine history:', error);
    return [];
  }
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
  const averagePrice = history.reduce((sum, entry) => sum + entry.finalPrice, 0) / history.length;
  
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
