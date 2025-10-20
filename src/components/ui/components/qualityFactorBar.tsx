import React from 'react';
import { Vineyard } from '@/lib/types/types';
import { getColorClass, formatNumber, getColorCategory, getBadgeColorClasses } from '@/lib/utils/utils';
import { ChevronDownIcon, ChevronRightIcon, QUALITY_FACTOR_EMOJIS } from '@/lib/utils';
import { getRegionalPriceRange } from '@/lib/services';
import { REGION_ALTITUDE_RANGES, REGION_ASPECT_RATINGS } from '@/lib/constants/vineyardConstants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';

// Quality factor types for wine value calculation
export type QualityFactorType =
  | 'landValue'
  | 'vineyardPrestige'
  | 'regionalPrestige'
  | 'altitudeRating'
  | 'aspectRating'
  | 'grapeSuitability'
  | 'overgrowthPenalty';

interface QualityFactorBarProps {
  factorType: QualityFactorType;
  label: string;
  value: number;
  vineyard?: Vineyard;
  showValue?: boolean;
  className?: string;
  rawValue?: string | number;
  showIcon?: boolean;
}

export const QualityFactorBar: React.FC<QualityFactorBarProps> = ({
  factorType,
  label,
  value,
  vineyard,
  showValue = true,
  className = "",
  rawValue,
  showIcon = true
}) => {
  const getIcon = (factorType: QualityFactorType): string => {
    return (QUALITY_FACTOR_EMOJIS as any)[factorType] || '❓';
  };

  // Clamp value to 0-1 range
  const displayValue = Math.max(0, Math.min(1, value));


  // Get color class based on factor value
  const getValueColor = () => {
    return getColorClass(displayValue);
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center py-4 px-2 border-b last:border-b-0 border-gray-200 gap-3 sm:gap-0 ${className}`}>
      {/* Label */}
      <div className="sm:w-1/4 sm:pr-2 text-sm font-medium text-gray-700 capitalize flex items-center gap-2">
        {showIcon && (
          <span className="text-sm" role="img" aria-label={`${label} icon`}>
            {getIcon(factorType)}
          </span>
        )}
        <span className="text-xs sm:text-sm">{label}</span>
      </div>

      {/* Bar Container */}
      <div className="sm:w-3/4 flex items-center flex-1 gap-3 sm:gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden cursor-help">
                {/* Background bar */}
                <div className="absolute inset-0 bg-gray-200 rounded-full"></div>

                {/* Quality range visualization - show as gradient from poor to excellent */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full"></div>

                {/* Value marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
                  style={{ left: `${displayValue * 100}%` }}
                ></div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Current Value: {formatNumber(displayValue, { decimals: 2, forceDecimals: true })}</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColorClasses(displayValue).bg} ${getBadgeColorClasses(displayValue).text}`}>
                    {getColorCategory(displayValue)}
                  </span>
                </div>
                
                {rawValue !== undefined && (
                  <p className="text-xs mb-2 text-gray-300">
                    {factorType === 'landValue' && typeof rawValue === 'number' 
                      ? `Raw Value: €${formatNumber(rawValue, { decimals: 0, forceDecimals: false })}/hectare`
                      : `Raw Value: ${rawValue}`
                    }
                  </p>
                )}

                {/* Factor-specific explanations */}
                {factorType === 'landValue' && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">💰 Land Value Factor</p>
                    <p className="text-xs text-blue-300 font-medium">DIRECT INFLUENCE - Weighted Calculation</p>
                    <p className="text-xs text-gray-300">Normalized land value (logarithmic scale)</p>
                    <p className="text-xs text-blue-300">Weight: 60% of wine value index</p>
                    {vineyard && (
                      <p className="text-xs text-gray-300">
                        Regional Range: €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })}/hectare
                      </p>
                    )}
                  </div>
                )}

                {factorType === 'vineyardPrestige' && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">🌟 Vineyard Prestige</p>
                    <p className="text-xs text-blue-300 font-medium">DIRECT INFLUENCE - Weighted Calculation</p>
                    <p className="text-xs text-gray-300">Combined prestige from all sources</p>
                    <p className="text-xs text-purple-300">Weight: 40% of wine value index</p>
                  </div>
                )}

                {factorType === 'regionalPrestige' && vineyard && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">🏛️ Regional Prestige</p>
                    <p className="text-xs text-green-300 font-medium">INDIRECT INFLUENCE - Environmental Factor</p>
                    <p className="text-xs text-gray-300">Region: {vineyard.region}, {vineyard.country}</p>
                    <p className="text-xs text-gray-300">Regional prestige factor for wine quality</p>
                    <p className="text-xs text-gray-300 mt-2">
                      <strong>Impact:</strong> These factors are permanent and represent the natural advantages of your vineyard's location. Premium regions like Bordeaux, Tuscany, or Napa Valley have higher regional prestige.
                    </p>
                  </div>
                )}

                {factorType === 'altitudeRating' && vineyard && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">⛰️ Altitude Rating</p>
                    <p className="text-xs text-green-300 font-medium">INDIRECT INFLUENCE - Environmental Factor</p>
                    <p className="text-xs text-gray-300">Altitude: {vineyard.altitude}m</p>
                    {(() => {
                      const countryData = REGION_ALTITUDE_RANGES[vineyard.country as keyof typeof REGION_ALTITUDE_RANGES];
                      const altitudeRange = countryData?.[vineyard.region as keyof typeof countryData];
                      if (altitudeRange) {
                        return <p className="text-xs text-green-300">Regional Range: {altitudeRange[0]}m - {altitudeRange[1]}m</p>;
                      }
                      return null;
                    })()}
                    <p className="text-xs text-gray-300">Optimal Range: Based on {vineyard.region} conditions</p>
                  </div>
                )}

                {factorType === 'aspectRating' && vineyard && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">🧭 Aspect Rating</p>
                    <p className="text-xs text-green-300 font-medium">INDIRECT INFLUENCE - Environmental Factor</p>
                    <p className="text-xs text-gray-300">Aspect: {vineyard.aspect}</p>
                    {(() => {
                      const countryData = REGION_ASPECT_RATINGS[vineyard.country as keyof typeof REGION_ASPECT_RATINGS];
                      const aspectRatings = countryData?.[vineyard.region as keyof typeof countryData];
                      if (aspectRatings) {
                        const values = Object.values(aspectRatings) as number[];
                        const minRating = Math.min(...values);
                        const maxRating = Math.max(...values);
                        return <p className="text-xs text-green-300">Regional Range: {formatNumber(minRating, { decimals: 2, forceDecimals: true })} - {formatNumber(maxRating, { decimals: 2, forceDecimals: true })}</p>;
                      }
                      return null;
                    })()}
                    <p className="text-xs text-gray-300">Rating: Based on {vineyard.region} conditions</p>
                  </div>
                )}

                {factorType === 'grapeSuitability' && vineyard?.grape && (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">🍇 Grape Suitability</p>
                    <p className="text-xs text-green-300 font-medium">INDIRECT INFLUENCE - Environmental Factor</p>
                    <p className="text-xs text-gray-300">Grape: {vineyard.grape}</p>
                    <p className="text-xs text-gray-300">Suitability: How well this grape fits the region</p>
                    <p className="text-xs text-gray-300 mt-2">
                      <strong>Regional Match:</strong> Some grape varieties are naturally suited to specific regions (e.g., Pinot Noir in Burgundy, Cabernet in Bordeaux). Your {formatNumber(displayValue * 100, { decimals: 0, forceDecimals: true })}% suitability indicates how well {vineyard.grape} thrives in {vineyard.region}.
                    </p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Value display */}
        {showValue && (
          <span className={`text-sm font-medium w-12 sm:w-14 text-right flex-shrink-0 ${getValueColor()}`}>
            {formatNumber(displayValue, { decimals: 2, forceDecimals: true })}
          </span>
        )}
      </div>
    </div>
  );
};

// Component for displaying multiple quality factors
interface QualityFactorsDisplayProps {
  factors: Record<QualityFactorType, number>;
  vineyard?: Vineyard;
  showValues?: boolean;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  title?: string;
  // Optional raw values for detailed tooltips
  rawValues?: Partial<Record<QualityFactorType, string | number>>;
  // Show quality score at the top
  showQualityScore?: boolean;
  // The final quality score (0-1)
  qualityScore?: number;
}

export const QualityFactorsDisplay: React.FC<QualityFactorsDisplayProps> = ({
  factors,
  vineyard,
  showValues = true,
  className = "",
  collapsible = false,
  defaultExpanded = true,
  title = "Quality Factors",
  rawValues,
  showQualityScore = false,
  qualityScore
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  // Separate factors into direct, indirect, and quality modifiers
  const directFactors = ['landValue', 'vineyardPrestige'] as const;
  const indirectFactors = ['regionalPrestige', 'altitudeRating', 'aspectRating', 'grapeSuitability'] as const;
  const qualityModifiers = ['overgrowthPenalty'] as const;

  const content = (
    <div className="space-y-4">
      {/* Quality Score Display */}
      {showQualityScore && qualityScore !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Current Quality Score:</span>
          <span className={`text-2xl font-bold ${getColorClass(qualityScore)}`}>
            {formatNumber(qualityScore, { decimals: 2, forceDecimals: true })}
          </span>
        </div>
      )}

      {/* Direct Influence Factors */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-700">Direct Influence (Weighted Calculation)</h3>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 space-y-1">
          {directFactors.map((key) => (
            <QualityFactorBar
              key={key}
              factorType={key}
              label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
              value={factors[key]}
              vineyard={vineyard}
              showValue={showValues}
              rawValue={rawValues?.[key]}
            />
          ))}
        </div>
      </div>

      {/* Indirect Influence Factors */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-700">Indirect Influence (Regional & Environmental)</h3>
        </div>
        <div className="bg-green-50 rounded-lg p-2 space-y-1">
          {indirectFactors.map((key) => (
            <QualityFactorBar
              key={key}
              factorType={key}
              label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
              value={factors[key]}
              vineyard={vineyard}
              showValue={showValues}
              rawValue={rawValues?.[key]}
            />
          ))}
        </div>
      </div>

      {/* Quality Modifiers */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-700">Quality Modifiers (Final Adjustments)</h3>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 space-y-1">
          {qualityModifiers.map((key) => (
            <QualityFactorBar
              key={key}
              factorType={key}
              label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
              value={factors[key]}
              vineyard={vineyard}
              showValue={showValues}
              rawValue={rawValues?.[key]}
            />
          ))}
        </div>
      </div>

      <QualityFactorLegend />
    </div>
  );

  if (!collapsible) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={className}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors mb-2"
      >
        <span>{title}</span>
        <span className="text-xs">
          {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        </span>
      </button>

      {isExpanded && (
        <div className="p-3 bg-gray-50 rounded-lg">
          {content}
        </div>
      )}
    </div>
  );
};

// Legend component for explaining quality factor colors
export const QualityFactorLegend: React.FC = () => {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
      <div className="flex items-center gap-1">
        <div className="w-3 h-2 bg-gradient-to-r from-red-200 to-green-200 rounded"></div>
        <span>Undrinkable to Vintage Perfection</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1 h-2 bg-black rounded"></div>
        <span>Current Value</span>
      </div>
    </div>
  );
};
