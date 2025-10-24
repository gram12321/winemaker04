import { useState, useEffect } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { calculateEffectiveGrapeQuality, getPresentFeaturesSorted, getAllVineyards } from '@/lib/services';
import { calculateEstimatedPrice } from '@/lib/services/wine/winescore/wineScoreCalculation';

interface FeatureDetails {
  effectiveGrapeQuality: number;
  qualityPenalty: number;
  presentFeatures: Array<{ feature: any; config: any }>;
  hasFaults: boolean;
  priceImpact: {
    currentPrice: number;
    priceWithoutFaults: number;
    priceDifference: number;
  } | null;
}

/**
 * Hook to get feature impact details for wine display
 * Encapsulates all feature-related calculations for UI components
 */
export function useWineFeatureDetails(wineBatch: WineBatch | null): FeatureDetails | null {
  const [featureDetails, setFeatureDetails] = useState<FeatureDetails | null>(null);

  useEffect(() => {
    if (!wineBatch) {
      setFeatureDetails(null);
      return;
    }

    const calculateFeatureDetails = async () => {
      try {
        // Calculate feature impact on quality (synchronous)
        const effectiveGrapeQuality = calculateEffectiveGrapeQuality(wineBatch);
        const qualityPenalty = wineBatch.grapeQuality - effectiveGrapeQuality;
        const presentFeatures = getPresentFeaturesSorted(wineBatch);
        const hasFaults = presentFeatures.some((f: any) => f.config.type === 'fault');

        // Calculate price impact using complete service layer functions (async)
        let priceImpact = null;
        if (hasFaults && qualityPenalty > 0.001) {
          try {
            // Get vineyard data for accurate price calculation
            const vineyards = await getAllVineyards();
            const vineyard = vineyards.find((v: Vineyard) => v.id === wineBatch.vineyardId);
            
            if (vineyard) {
              // Calculate current price (with features)
              const currentPrice = calculateEstimatedPrice(wineBatch, vineyard);
              
              // Calculate price without features (remove all features temporarily)
              const wineWithoutFaults: WineBatch = {
                ...wineBatch,
                features: [] // Remove all features for comparison
              };
              const priceWithoutFaults = calculateEstimatedPrice(wineWithoutFaults, vineyard);
              const priceDifference = priceWithoutFaults - currentPrice;
              
              priceImpact = {
                currentPrice,
                priceWithoutFaults,
                priceDifference: Math.max(0, priceDifference) // Don't show negative differences
              };
            }
          } catch (error) {
            console.warn('Error calculating price impact:', error);
          }
        }

        setFeatureDetails({
          effectiveGrapeQuality,
          qualityPenalty,
          presentFeatures,
          hasFaults,
          priceImpact
        });
      } catch (error) {
        console.warn('Error calculating feature details:', error);
        setFeatureDetails(null);
      }
    };

    calculateFeatureDetails();
  }, [wineBatch]);

  return featureDetails;
}
