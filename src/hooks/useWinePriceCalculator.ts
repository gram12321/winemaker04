import { useState, useEffect, useCallback } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { calculateEstimatedPrice, getCurrentPrestige } from '@/lib/services';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';

/**
 * Shared hook for calculating wine prices with prestige bonuses
 * Loads prestige and vineyard data once per component and provides calculator functions
 * Efficient for calculating prices for multiple wines in lists/tables
 */
export function useWinePriceCalculator() {
  const [priceCalcData, setPriceCalcData] = useState<{
    prestige: number;
    vineyards: Vineyard[];
  }>({ prestige: 0, vineyards: [] });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Load prestige and vineyards once
  useEffect(() => {
    const loadPriceData = async () => {
      try {
        const [currentPrestige, vineyardsData] = await Promise.all([
          getCurrentPrestige(),
          loadVineyards()
        ]);
        setPriceCalcData({ prestige: currentPrestige, vineyards: vineyardsData });
      } catch (error) {
        console.error('Error loading price calculation data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPriceData();
  }, []);
  
  // Calculator function that uses the loaded prestige data
  const calculatePrice = useCallback((wine: WineBatch): number => {
    const vineyard = priceCalcData.vineyards.find(v => v.id === wine.vineyardId);
    return calculateEstimatedPrice(
      wine as any,
      vineyard as any,
      priceCalcData.prestige,
      vineyard?.vineyardPrestige
    );
  }, [priceCalcData]);
  
  // Helper to get asking price (user-set or calculated)
  const getAskingPrice = useCallback((wine: WineBatch): number => {
    if (wine.askingPrice !== undefined && wine.askingPrice !== null) {
      return wine.askingPrice;
    }
    return calculatePrice(wine);
  }, [calculatePrice]);
  
  return {
    calculatePrice,
    getAskingPrice,
    isLoading,
    prestige: priceCalcData.prestige,
    vineyards: priceCalcData.vineyards
  };
}
