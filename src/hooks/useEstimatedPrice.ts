import { useMemo, useState, useEffect } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { calculateEstimatedPrice, getCurrentPrestige } from '@/lib/services';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';

/**
 * Calculate estimated price with prestige bonuses included
 * This matches the logic used in order generation
 */
export function useEstimatedPrice(wineBatch: WineBatch | null): number {
  const [prestige, setPrestige] = useState<number>(0);
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  
  // Load prestige and vineyard data
  useEffect(() => {
    if (!wineBatch) return;
    
    const loadData = async () => {
      try {
        const currentPrestige = await getCurrentPrestige();
        setPrestige(currentPrestige);
        
        const vineyards = await loadVineyards();
        const vineyardData = vineyards.find(v => v.id === wineBatch.vineyardId);
        setVineyard(vineyardData || null);
      } catch (error) {
        console.error('Error loading price data:', error);
      }
    };
    
    loadData();
  }, [wineBatch?.id, wineBatch?.vineyardId]);
  
  return useMemo(() => {
    if (!wineBatch) return 0;
    // Include prestige and vineyard data for accurate pricing (matches order generation logic)
    return calculateEstimatedPrice(
      wineBatch as any, 
      vineyard as any,
      prestige,
      vineyard?.vineyardPrestige
    );
  }, [wineBatch, prestige, vineyard]);
}


