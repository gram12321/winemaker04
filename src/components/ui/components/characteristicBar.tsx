import React from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants';
import { getColorClass, formatNumber } from '@/lib/utils/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';
import { useWineBalance } from '@/hooks';

interface CharacteristicBarProps {
  characteristicName: keyof WineCharacteristics;
  label: string;
  value: number;
  adjustedRanges?: [number, number]; // For future Phase 2 dynamic ranges
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
  
  // Get base balanced ranges
  const [minBalance, maxBalance] = BASE_BALANCED_RANGES[characteristicName];
  

  // Build user-friendly tooltip with new terminology
  const buildTooltip = () => {
    const base = `Current Value: ${formatNumber(displayValue, { decimals: 2, forceDecimals: true })}`;
    const [rMin, rMax] = adjustedRanges ?? [minBalance, maxBalance];
    const rangeLine = `Range: ${formatNumber(rMin, { decimals: 2, forceDecimals: true })} - ${formatNumber(rMax, { decimals: 2, forceDecimals: true })}`;

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

    const statusLine = `Status: ${status}`;
    const details = `DistanceInside: ${formatNumber(distanceInside, { decimals: 2, forceDecimals: true })} | DistanceOutside: ${formatNumber(distanceOutside, { decimals: 2, forceDecimals: true })}\nPenalty: ${formatNumber(penalty, { decimals: 2, forceDecimals: true })} | TotalDistance: ${formatNumber(totalDistance, { decimals: 2, forceDecimals: true })}`;
    const deltaLine = deltaTooltip ? `Deltas: ${deltaTooltip}` : '';
    return [base, rangeLine, statusLine, details, deltaLine].filter(Boolean).join('\n');
  };
  
  // Get color class based on whether value is in balanced range
  const getValueColor = () => {
    if (adjustedRanges) {
      const [adjMin, adjMax] = adjustedRanges;
      if (displayValue >= adjMin && displayValue <= adjMax) return getColorClass(0.8); // Good quality
      if (displayValue < adjMin - 0.2 || displayValue > adjMax + 0.2) return getColorClass(0.2); // Poor quality
      return getColorClass(0.5); // Average quality
    } else {
      if (displayValue >= minBalance && displayValue <= maxBalance) return getColorClass(0.8); // Good quality
      if (displayValue < minBalance - 0.2 || displayValue > maxBalance + 0.2) return getColorClass(0.2); // Poor quality
      return getColorClass(0.5); // Average quality
    }
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
        <div 
          className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden"
          title={buildTooltip()}
        >
          {/* Background bar with informative title */}
          <div 
            className="absolute inset-0 bg-gray-200 rounded-full"
            title={buildTooltip()}
          ></div>
          
          {/* Base balanced range (green) */}
          <div 
            className="absolute top-0 bottom-0 bg-green-300/75 rounded-full"
            style={{
              left: `${minBalance * 100}%`,
              width: `${(maxBalance - minBalance) * 100}%`
            }}
          ></div>

          {/* Adjusted ranges (for Phase 2) - darker green for optimal zone */}
          {adjustedRanges && (
            <>
              <div 
                className="absolute top-0 bottom-0 bg-green-500/60 rounded-full"
                style={{
                  left: `${adjustedRanges[0] * 100}%`,
                  width: `${(adjustedRanges[1] - adjustedRanges[0]) * 100}%`
                }}
              ></div>
            </>
          )}

          {/* Value marker */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
            style={{ left: `${displayValue * 100}%` }}
            title={`Current Value: ${formatNumber(displayValue, { decimals: 2, forceDecimals: true })}`}
          ></div>

          {/* Base grape value marker (if provided) */}
          {typeof baseDisplay === 'number' && (
            <div 
              className="absolute top-0 bottom-0 w-1 bg-blue-700 z-10 rounded-full opacity-80"
              style={{ left: `${baseDisplay * 100}%` }}
            ></div>
          )}
        </div>
        
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
  adjustedRanges?: Record<keyof WineCharacteristics, [number, number]>;
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
}

export const WineCharacteristicsDisplay: React.FC<WineCharacteristicsDisplayProps> = ({
  characteristics,
  adjustedRanges,
  showValues = true,
  className = "",
  collapsible = false,
  defaultExpanded = true,
  title = "Wine Characteristics",
  tooltips,
  baseValues,
  showBalanceScore = false
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  
  // Calculate balance score if requested
  const balanceResult = showBalanceScore ? useWineBalance(characteristics) : null;

  const content = (
    <div className="space-y-1">
      {/* Balance Score Display */}
      {showBalanceScore && balanceResult && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Current Balance Score:</span>
          <span className={`text-2xl font-bold ${getColorClass(balanceResult.score)}`}>
            {formatNumber(balanceResult.score, { decimals: 2, forceDecimals: true })}
          </span>
        </div>
      )}
      
      {Object.entries(characteristics)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically by characteristic name
        .map(([key, value]) => (
          <CharacteristicBar
            key={key}
            characteristicName={key as keyof WineCharacteristics}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={value}
            adjustedRanges={adjustedRanges?.[key as keyof WineCharacteristics]}
            showValue={showValues}
            deltaTooltip={tooltips?.[key as keyof WineCharacteristics]}
            baseValue={baseValues?.[key as keyof WineCharacteristics]}
          />
        ))}
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
        <div className="w-3 h-2 bg-green-300/75 rounded"></div>
        <span>Balanced Range</span>
      </div>
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
