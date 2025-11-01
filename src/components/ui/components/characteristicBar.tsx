import React from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { getColorClass, formatNumber, getWineBalanceCategory, getRangeColor, getRatingForRange } from '@/lib/utils/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';
import { useWineBalance } from '@/hooks';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, MobileDialogWrapper, TooltipSection, TooltipRow, tooltipStyles } from '../shadCN/tooltip';

interface CharacteristicBarProps {
  characteristicName: keyof WineCharacteristics;
  label: string;
  value: number;
  adjustedRanges: [number, number]; // Adjusted ranges from balance calculation (always provided)
  showValue?: boolean;
  className?: string;
  // Optional tooltip text to explain deltas (e.g., from harvest debug)
  deltaTooltip?: string;
  // Optional reference base value (e.g., grape base characteristic)
  baseValue?: number;
  // Show characteristic icon
  showIcon?: boolean;
}

export const CharacteristicBar: React.FC<CharacteristicBarProps> = ({ 
  characteristicName,
  label, 
  value,
  adjustedRanges,
  showValue = true,
  className = "",
  deltaTooltip,
  baseValue,
  showIcon = true
}) => {
  const ICON_SRC: Record<keyof WineCharacteristics, string> = {
    acidity: '/assets/icons/characteristics/acidity.png',
    aroma: '/assets/icons/characteristics/aroma.png',
    body: '/assets/icons/characteristics/body.png',
    spice: '/assets/icons/characteristics/spice.png',
    sweetness: '/assets/icons/characteristics/sweetness.png',
    tannins: '/assets/icons/characteristics/tannins.png'
  };

  // Clamp value to 0-1 range
  const displayValue = Math.max(0, Math.min(1, value));
  const baseDisplay = typeof baseValue === 'number' ? Math.max(0, Math.min(1, baseValue)) : undefined;
  
  // Use adjustedRanges (always provided from balance calculation)
  const [rMin, rMax] = adjustedRanges;

  // Build tooltip content JSX
  const buildTooltipContent = () => {

    // Distances per new naming
    const midpoint = (rMin + rMax) / 2;
    const distanceInside = Math.abs(displayValue - midpoint);
    const distanceOutside = displayValue < rMin ? (rMin - displayValue) : (displayValue > rMax ? (displayValue - rMax) : 0);
    const penalty = 2 * distanceOutside;
    const totalDistance = distanceInside + penalty;

    let status = 'Average';
    if (displayValue >= rMin && displayValue <= rMax) status = 'In balanced range';
    else if (displayValue < rMin - 0.2 || displayValue > rMax + 0.2) status = 'Far outside range';
    else status = 'Slightly outside range';

    // Calculate rating for color coding (same as getValueColor uses)
    const valueRating = getRatingForRange(displayValue, 0, 1, 'balanced', rMin, rMax);
    
    // Calculate status rating (higher rating = better status)
    const statusRating = displayValue >= rMin && displayValue <= rMax 
      ? 0.8 // In range = good
      : displayValue < rMin - 0.2 || displayValue > rMax + 0.2
        ? 0.2 // Far outside = bad
        : 0.5; // Slightly outside = average

    // Calculate ratings for distance metrics (lower is better, so use 'lower_better' strategy)
    // Using stricter maximums that reflect realistic "problematic" thresholds
    // Values above these thresholds should be clearly red/orange
    const distanceInsideRating = getRatingForRange(distanceInside, 0, 0.2, 'lower_better'); // Max 0.2 = problematic
    const distanceOutsideRating = getRatingForRange(distanceOutside, 0, 0.2, 'lower_better'); // Max 0.2 = problematic
    const penaltyRating = getRatingForRange(penalty, 0, 0.4, 'lower_better'); // Max 0.4 = problematic (2 × 0.2)
    const totalDistanceRating = getRatingForRange(totalDistance, 0, 0.6, 'lower_better'); // Max 0.6 = problematic (0.2 + 0.4)

    return (
      <div className={tooltipStyles.text}>
        <TooltipSection title={`${label} Details`}>
          <TooltipRow 
            label="Current Value:" 
            value={formatNumber(displayValue, { decimals: 2, forceDecimals: true })}
            valueRating={valueRating}
          />
          <TooltipRow 
            label="Range:" 
            value={`${formatNumber(rMin, { decimals: 2, forceDecimals: true })} - ${formatNumber(rMax, { decimals: 2, forceDecimals: true })}`}
          />
          <TooltipRow 
            label="Status:" 
            value={status}
            valueRating={statusRating}
          />
          <div className="mt-2 pt-2 border-t border-gray-600">
            <TooltipRow 
              label="DistanceInside:" 
              value={formatNumber(distanceInside, { decimals: 2, forceDecimals: true })}
              valueRating={distanceInsideRating}
              monospaced
            />
            <TooltipRow 
              label="DistanceOutside:" 
              value={formatNumber(distanceOutside, { decimals: 2, forceDecimals: true })}
              valueRating={distanceOutsideRating}
              monospaced
            />
            <TooltipRow 
              label="Penalty:" 
              value={formatNumber(penalty, { decimals: 2, forceDecimals: true })}
              valueRating={penaltyRating}
              monospaced
            />
            <TooltipRow 
              label="TotalDistance:" 
              value={formatNumber(totalDistance, { decimals: 2, forceDecimals: true })}
              valueRating={totalDistanceRating}
              monospaced
            />
          </div>
          {deltaTooltip && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <TooltipRow 
                label="Deltas:" 
                value={deltaTooltip}
              />
            </div>
          )}
        </TooltipSection>
      </div>
    );
  };
  
  // Get color class based on whether value is in balanced range
  // Uses the balanced strategy from getRangeColor which handles ideal ranges
  const getValueColor = () => {
    return getRangeColor(displayValue, 0, 1, 'balanced', rMin, rMax).text;
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center py-2 border-b last:border-b-0 border-gray-200 gap-2 sm:gap-0 ${className}`}>
      {/* Label */}
      <div className="sm:w-1/4 sm:pr-2 text-sm font-medium text-gray-700 capitalize flex items-center gap-2">
        {showIcon && (
          <img
            src={ICON_SRC[characteristicName]}
            alt={`${label} icon`}
            className="w-3 h-3 sm:w-4 sm:h-4 object-contain opacity-80"
            loading="lazy"
          />
        )}
        <span className="text-xs sm:text-sm">{label}</span>
      </div>
      
      {/* Bar Container */}
      <div className="sm:w-3/4 flex items-center flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <MobileDialogWrapper 
                content={buildTooltipContent()} 
                title={`${label} Details`}
                triggerClassName="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help"
              >
        <div 
                  className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-help"
        >
                  {/* Background bar */}
          <div 
            className="absolute inset-0 bg-gray-200 rounded-full"
          ></div>
          
                  {/* Adjusted ranges (green) - shows optimal zone from balance calculation */}
              <div 
                className="absolute top-0 bottom-0 bg-green-500/60 rounded-full"
                style={{
                      left: `${rMin * 100}%`,
                      width: `${(rMax - rMin) * 100}%`
                }}
              ></div>

          {/* Value marker */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
            style={{ left: `${displayValue * 100}%` }}
          ></div>

          {/* Base grape value marker (if provided) */}
          {typeof baseDisplay === 'number' && (
            <div 
              className="absolute top-0 bottom-0 w-1 bg-blue-700 z-10 rounded-full opacity-80"
              style={{ left: `${baseDisplay * 100}%` }}
            ></div>
          )}
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
          <span className={`ml-2 sm:ml-3 text-xs sm:text-sm font-medium w-10 sm:w-12 text-right ${getValueColor()}`}>
            {formatNumber(displayValue, { decimals: 2, forceDecimals: true })}
          </span>
        )}
      </div>
    </div>
  );
};

// Component for displaying multiple characteristics
interface WineCharacteristicsDisplayProps {
  characteristics: WineCharacteristics;
  adjustedRanges?: Record<keyof WineCharacteristics, [number, number]>; // Optional override (e.g., from user sliders)
  showValues?: boolean;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  title?: string;
  // Optional map of tooltip texts for each characteristic
  tooltips?: Partial<Record<keyof WineCharacteristics, string>>;
  // Optional map of base reference values to show as markers
  baseValues?: Partial<Record<keyof WineCharacteristics, number>>;
  // Show balance score at the top
  showBalanceScore?: boolean;
  // Optional pre-calculated balance value (if not provided, will recalculate from characteristics)
  balanceValue?: number;
}

export const WineCharacteristicsDisplay: React.FC<WineCharacteristicsDisplayProps> = ({
  characteristics,
  adjustedRanges: adjustedRangesOverride,
  showValues = true,
  className = "",
  collapsible = false,
  defaultExpanded = true,
  title = "Wine Characteristics",
  tooltips,
  baseValues,
  showBalanceScore = false,
  balanceValue
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  
  // Always calculate balance to get adjustedRanges (always defined, equals base ranges if no adjustments)
  const calculatedBalance = useWineBalance(characteristics);
  
  // Use provided balance value or calculated balance for score display
  const balanceResult = balanceValue !== undefined 
    ? { score: balanceValue, qualifies: true, adjustedRanges: calculatedBalance?.adjustedRanges || {} as any }
    : calculatedBalance;

  // Use adjustedRanges from balance calculation (always available since characteristics is provided), override with prop if provided
  // calculatedBalance.adjustedRanges is always defined when characteristics is provided
  const effectiveAdjustedRanges = adjustedRangesOverride || calculatedBalance?.adjustedRanges!;

  const content = (
    <div className="space-y-1">
      {/* Balance Score Display */}
      {showBalanceScore && balanceResult && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Current Balance Score:</span>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getColorClass(balanceResult.score)}`}>
              {formatNumber(balanceResult.score, { decimals: 2, forceDecimals: true })}
            </div>
            <div className="text-sm text-gray-600">{getWineBalanceCategory(balanceResult.score)}</div>
          </div>
        </div>
      )}
      
      {Object.entries(characteristics)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically by characteristic name
        .map(([key, value]) => {
          const charKey = key as keyof WineCharacteristics;
          const ranges = effectiveAdjustedRanges?.[charKey];
          // adjustedRanges should always be defined from balance calculation
          if (!ranges) {
            console.error(`Missing adjustedRanges for ${key}`);
            return null;
          }
          return (
          <CharacteristicBar
            key={key}
              characteristicName={charKey}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={value}
              adjustedRanges={ranges}
            showValue={showValues}
              deltaTooltip={tooltips?.[charKey]}
              baseValue={baseValues?.[charKey]}
          />
          );
        })}
      <CharacteristicBarLegend />
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

// Legend component for explaining the colors
export const CharacteristicBarLegend: React.FC = () => {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
      <div className="flex items-center gap-1">
        <div className="w-3 h-2 bg-green-500/60 rounded"></div>
        <span>Adjusted Range</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1 h-2 bg-black rounded"></div>
        <span>Current Value</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1 h-2 bg-blue-700 rounded"></div>
        <span>Base (Grape)</span>
      </div>
    </div>
  );
};
