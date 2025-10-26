import { useState, useEffect } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { getPresentFeaturesSorted, getAllVineyards } from '@/lib/services';
import { calculateEstimatedPrice } from '@/lib/services/wine/winescore/wineScoreCalculation';

interface FeatureDetails {
  currentGrapeQuality: number;
  grapeQualityPenalty: number;
  presentFeatures: Array<{ feature: any; config: any }>;
  hasQualityAffectingFeatures: boolean;
  priceImpact: {
    currentPrice: number;
    priceWithoutFeatures: number;
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
        // Use current grape quality (feature effects are already applied)
        const currentGrapeQuality = wineBatch.grapeQuality;
        const grapeQualityPenalty = wineBatch.bornGrapeQuality - currentGrapeQuality;
        const presentFeatures = getPresentFeaturesSorted(wineBatch);
        const hasQualityAffectingFeatures = presentFeatures.some((f: any) => f.config.effects.quality !== undefined);

        // Calculate price impact using complete service layer functions (async)
        let priceImpact = null;
        if (hasQualityAffectingFeatures && grapeQualityPenalty > 0.001) {
          try {
            // Get vineyard data for accurate price calculation
            const vineyards = await getAllVineyards();
            const vineyard = vineyards.find((v: Vineyard) => v.id === wineBatch.vineyardId);
            
            if (vineyard) {
              // Calculate current price (with features)
              const currentPrice = calculateEstimatedPrice(wineBatch, vineyard);
              
              // Calculate price without features (remove all features temporarily)
              const wineWithoutFeatures: WineBatch = {
                ...wineBatch,
                features: [] // Remove all features for comparison
              };
              const priceWithoutFeatures = calculateEstimatedPrice(wineWithoutFeatures, vineyard);
              const priceDifference = priceWithoutFeatures - currentPrice;
              
              priceImpact = {
                currentPrice,
                priceWithoutFeatures,
                priceDifference: Math.max(0, priceDifference) // Don't show negative differences
              };
            }
          } catch (error) {
            console.warn('Error calculating price impact:', error);
          }
        }

        setFeatureDetails({
          currentGrapeQuality,
          grapeQualityPenalty,
          presentFeatures,
          hasQualityAffectingFeatures,
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
