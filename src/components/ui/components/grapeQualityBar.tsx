import React from 'react';
import { Vineyard } from '@/lib/types/types';
import { ChevronDownIcon, ChevronRightIcon, QUALITY_FACTOR_EMOJIS, getColorClass, formatNumber, getColorCategory, formatPercent } from '@/lib/utils';
import { getRegionalPriceRange } from '@/lib/services';
import { REGION_ALTITUDE_RANGES, REGION_ASPECT_RATINGS } from '@/lib/constants/';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, MobileDialogWrapper, TooltipSection, TooltipRow, tooltipStyles } from '../shadCN/tooltip';

// Grape quality factor types for wine value calculation
export type GrapeQualityFactorType =
  | 'landValue'
  | 'vineyardPrestige'
  | 'regionalPrestige'
  | 'altitudeRating'
  | 'aspectRating'
  | 'grapeSuitability'
  | 'overgrowthPenalty'
  | 'densityPenalty';

interface GrapeQualityFactorBarProps {
  factorType: GrapeQualityFactorType;
  label: string;
  value: number;
  vineyard?: Vineyard;
  showValue?: boolean;
  className?: string;
  rawValue?: string | number;
  showIcon?: boolean;
}

export const GrapeQualityFactorBar: React.FC<GrapeQualityFactorBarProps> = ({
  factorType,
  label,
  value,
  vineyard,
  showValue = true,
  className = "",
  rawValue,
  showIcon = true
}) => {
  const getIcon = (factorType: GrapeQualityFactorType): string => {
    return (QUALITY_FACTOR_EMOJIS as any)[factorType] || '❓';
  };

  // Clamp value to 0-1 range
  const displayValue = Math.max(0, Math.min(1, value));


  // Get color class based on factor value
  const getValueColor = () => {
    return getColorClass(displayValue);
  };

  // Build tooltip content JSX
  const buildTooltipContent = () => {
    return (
      <div className={tooltipStyles.text}>
        <TooltipSection title={`${label} Details`}>
          <TooltipRow 
            label="Current Value:" 
            value={formatNumber(displayValue, { decimals: 2, forceDecimals: true })}
            valueRating={displayValue}
          />
          <TooltipRow 
            label="Category:" 
            value={getColorCategory(displayValue)}
            badge
            valueRating={displayValue}
          />
          
          {rawValue !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <TooltipRow 
                label="Raw Value:" 
                value={
                  factorType === 'landValue' && typeof rawValue === 'number' 
                    ? `${formatNumber(rawValue, { currency: true })}/hectare`
                    : String(rawValue)
                }
              />
            </div>
          )}

          {/* Factor-specific explanations */}
          {factorType === 'landValue' && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">💰 Land Value Factor</div>
              <div className="text-xs text-blue-300 font-medium mb-1">DIRECT INFLUENCE</div>
              <div className="text-xs text-gray-300 mb-1">Normalized land value (logarithmic scale)</div>
              <TooltipRow label="Weight:" value="60% of wine value index" />
              {vineyard && (
                <div className="text-xs text-gray-300 mt-1">
                  Regional Range: {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { currency: true })} - {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { currency: true })}/hectare
                </div>
              )}
            </div>
          )}

          {factorType === 'vineyardPrestige' && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🌟 Vineyard Prestige</div>
              <div className="text-xs text-blue-300 font-medium mb-1">DIRECT INFLUENCE</div>
              <div className="text-xs text-gray-300 mb-1">Combined prestige from all sources</div>
              <TooltipRow label="Weight:" value="40% of wine value index" />
            </div>
          )}

          {factorType === 'regionalPrestige' && vineyard && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🏛️ Regional Prestige</div>
              <div className="text-xs text-green-300 font-medium mb-1">INDIRECT INFLUENCE - Environmental Factor</div>
              <TooltipRow label="Region:" value={`${vineyard.region}, ${vineyard.country}`} />
              <div className="text-xs text-gray-300 mb-1">Regional prestige factor for grape quality</div>
              <div className="text-xs text-gray-300 mt-2">
                <strong>Impact:</strong> These factors are permanent and represent the natural advantages of your vineyard's location. Premium regions like Bordeaux, Tuscany, or Napa Valley have higher regional prestige.
              </div>
            </div>
          )}

          {factorType === 'altitudeRating' && vineyard && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">⛰️ Altitude Rating</div>
              <div className="text-xs text-green-300 font-medium mb-1">INDIRECT INFLUENCE - Environmental Factor</div>
              <TooltipRow label="Altitude:" value={`${vineyard.altitude}m`} />
              {(() => {
                const countryData = REGION_ALTITUDE_RANGES[vineyard.country as keyof typeof REGION_ALTITUDE_RANGES];
                const altitudeRange = countryData?.[vineyard.region as keyof typeof countryData];
                if (altitudeRange) {
                  return <TooltipRow label="Regional Range:" value={`${altitudeRange[0]}m - ${altitudeRange[1]}m`} />;
                }
                return null;
              })()}
              <div className="text-xs text-gray-300 mt-1">Optimal Range: Based on {vineyard.region} conditions</div>
            </div>
          )}

          {factorType === 'aspectRating' && vineyard && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🧭 Aspect Rating</div>
              <div className="text-xs text-green-300 font-medium mb-1">INDIRECT INFLUENCE - Environmental Factor</div>
              <TooltipRow label="Aspect:" value={vineyard.aspect} />
              {(() => {
                const countryData = REGION_ASPECT_RATINGS[vineyard.country as keyof typeof REGION_ASPECT_RATINGS];
                const aspectRatings = countryData?.[vineyard.region as keyof typeof countryData];
                if (aspectRatings) {
                  const values = Object.values(aspectRatings) as number[];
                  const minRating = Math.min(...values);
                  const maxRating = Math.max(...values);
                  return <TooltipRow label="Regional Range:" value={`${formatNumber(minRating, { decimals: 2, forceDecimals: true })} - ${formatNumber(maxRating, { decimals: 2, forceDecimals: true })}`} />;
                }
                return null;
              })()}
              <div className="text-xs text-gray-300 mt-1">Rating: Based on {vineyard.region} conditions</div>
            </div>
          )}

          {factorType === 'grapeSuitability' && vineyard?.grape && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🍇 Grape Suitability</div>
              <div className="text-xs text-green-300 font-medium mb-1">INDIRECT INFLUENCE - Environmental Factor</div>
              <TooltipRow label="Grape:" value={vineyard.grape} />
              <TooltipRow 
                label="Suitability:" 
                value={formatPercent(displayValue)}
                valueRating={displayValue}
              />
              <div className="text-xs text-gray-300 mt-2">
                <strong>Regional Match:</strong> Some grape varieties are naturally suited to specific regions (e.g., Pinot Noir in Burgundy, Cabernet in Bordeaux). Your {formatPercent(displayValue)} suitability indicates how well {vineyard.grape} thrives in {vineyard.region}.
              </div>
            </div>
          )}

          {factorType === 'overgrowthPenalty' && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🌿 Overgrowth Penalty</div>
              <div className="text-xs text-orange-300 font-medium mb-1">GRAPE QUALITY MODIFIER</div>
              <div className="text-xs text-gray-300 mb-1">Penalty for vineyard neglect</div>
              <div className="text-xs text-gray-300">Values below 1.0 indicate quality reduction from overgrowth</div>
            </div>
          )}

          {factorType === 'densityPenalty' && vineyard && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs font-medium text-gray-300 mb-1">🌳 Density Penalty</div>
              <div className="text-xs text-orange-300 font-medium mb-1">GRAPE QUALITY MODIFIER</div>
              <TooltipRow label="Vine Density:" value={`${vineyard.density || 0} vines/ha`} />
              <div className="text-xs text-gray-300 mb-1">Optimal: 1500 vines/ha (no penalty)</div>
              <div className="text-xs text-gray-300 mb-1">Max Penalty: 15000 vines/ha (50% reduction)</div>
              <div className="text-xs text-gray-300 mt-2">
                <strong>Density Impact:</strong> Lower density means higher grape quality (more resources per vine). Progressively reduces quality as density increases. Also affects vineyard prestige.
              </div>
            </div>
          )}
        </TooltipSection>
      </div>
    );
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
              <MobileDialogWrapper 
                content={buildTooltipContent()} 
                title={`${label} Details`}
                triggerClassName="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden cursor-help"
              >
                <div className="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden cursor-help">
                  {/* Background bar */}
                  <div className="absolute inset-0 bg-gray-200 rounded-full"></div>

                  {/* Grape quality range visualization - show as gradient from poor to excellent */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full"></div>

                  {/* Value marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
                    style={{ left: `${displayValue * 100}%` }}
                  ></div>
                </div>
              </MobileDialogWrapper>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="max-w-sm" variant="panel" density="compact">
              {buildTooltipContent()}
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

// Component for displaying multiple grape quality factors
interface GrapeQualityFactorsDisplayProps {
  factors: Record<GrapeQualityFactorType, number>;
  vineyard?: Vineyard;
  showValues?: boolean;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  title?: string;
  // Optional raw values for detailed tooltips
  rawValues?: Partial<Record<GrapeQualityFactorType, string | number>>;
  // Show grape quality score at the top
  showGrapeQualityScore?: boolean;
  // The final grape quality score (0-1)
  grapeQualityScore?: number;
}

export const GrapeQualityFactorsDisplay: React.FC<GrapeQualityFactorsDisplayProps> = ({
  factors,
  vineyard,
  showValues = true,
  className = "",
  collapsible = false,
  defaultExpanded = true,
  title = "Grape Quality Factors",
  rawValues,
  showGrapeQualityScore = false,
  grapeQualityScore
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  // Separate factors into direct, indirect, and grape quality modifiers
  const directFactors = ['landValue', 'vineyardPrestige'] as const;
  const indirectFactors = ['regionalPrestige', 'altitudeRating', 'aspectRating', 'grapeSuitability'] as const;
  const grapeQualityModifiers = ['overgrowthPenalty', 'densityPenalty'] as const;

  const content = (
    <div className="space-y-4">
      {/* Grape Quality Score Display */}
      {showGrapeQualityScore && grapeQualityScore !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Current Grape Quality Score:</span>
          <span className={`text-2xl font-bold ${getColorClass(grapeQualityScore)}`}>
            {formatNumber(grapeQualityScore, { decimals: 2, forceDecimals: true })}
          </span>
        </div>
      )}

      {/* Direct Influence Factors */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-700">Direct Influence</h3>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 space-y-1">
          {directFactors.map((key) => (
            <GrapeQualityFactorBar
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
            <GrapeQualityFactorBar
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

      {/* Grape Quality Modifiers */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-700">Grape Quality Modifiers</h3>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 space-y-1">
          {grapeQualityModifiers.map((key) => (
            <GrapeQualityFactorBar
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

      <GrapeQualityFactorLegend />
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

// Legend component for explaining grape quality factor colors
export const GrapeQualityFactorLegend: React.FC = () => {
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
