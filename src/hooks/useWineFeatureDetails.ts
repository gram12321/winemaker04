import { useState, useEffect } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { getPresentFeaturesSorted, getAllVineyards } from '@/lib/services';
import { calculateEstimatedPrice } from '@/lib/services/wine/winescore/wineScoreCalculation';

interface FeatureDetails {
  currentTasteIndex: number;
  tasteIndexPenalty: number;
  presentFeatures: Array<{ feature: any; config: any }>;
  hasTasteAffectingFeatures: boolean;
  /** Present features that contribute to estimated price via `effects.price` (see `calculateFeatureMarketPriceMultiplier`). */
  hasPriceAffectingFeatures: boolean;
  priceImpact: {
    currentPrice: number;
    priceWithoutFeatures: number;
    /** Signed delta from removing feature price multipliers only: positive = features increase price vs no features. */
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
        const currentTasteIndex = wineBatch.tasteIndex;
        const baselineTasteIndex = wineBatch.bornTasteIndex;
        const tasteIndexPenalty = baselineTasteIndex - currentTasteIndex;
        const presentFeatures = getPresentFeaturesSorted(wineBatch);
        const hasTasteAffectingFeatures = presentFeatures.some((f: any) => f.config.effects.quality !== undefined);
        const hasPriceAffectingFeatures = presentFeatures.some((f: any) => f.config.effects.price !== undefined);

        // Calculate price impact using complete service layer functions (async)
        let priceImpact = null;
        if (presentFeatures.length > 0 && hasPriceAffectingFeatures) {
          try {
            // Get vineyard data for accurate price calculation
            const vineyards = await getAllVineyards();
            const vineyard = vineyards.find((v: Vineyard) => v.id === wineBatch.vineyardId);
            
            if (vineyard) {
              // Calculate current price (with features)
              const currentPrice = calculateEstimatedPrice(wineBatch, vineyard);
              
              // Same batch scores; only strip features so delta matches `calculateFeatureMarketPriceMultiplier` only
              const wineWithoutFeatures: WineBatch = {
                ...wineBatch,
                features: []
              };
              const priceWithoutFeatures = calculateEstimatedPrice(wineWithoutFeatures, vineyard);
              const priceDifference = currentPrice - priceWithoutFeatures;
              
              priceImpact = {
                currentPrice,
                priceWithoutFeatures,
                priceDifference
              };
            }
          } catch (error) {
            console.warn('Error calculating price impact:', error);
          }
        }

        setFeatureDetails({
          currentTasteIndex,
          tasteIndexPenalty,
          presentFeatures,
          hasTasteAffectingFeatures,
          hasPriceAffectingFeatures,
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
