import React from 'react';
import { WineCharacteristics } from '@/lib/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants';
import { getColorClass } from '@/lib/utils/utils';

interface CharacteristicBarProps {
  characteristicName: keyof WineCharacteristics;
  label: string;
  value: number;
  adjustedRanges?: [number, number]; // For future Phase 2 dynamic ranges
  showValue?: boolean;
  className?: string;
}

export const CharacteristicBar: React.FC<CharacteristicBarProps> = ({ 
  characteristicName,
  label, 
  value,
  adjustedRanges,
  showValue = true,
  className = ""
}) => {
  // Clamp value to 0-1 range
  const displayValue = Math.max(0, Math.min(1, value));
  
  // Get base balanced ranges
  const [minBalance, maxBalance] = BASE_BALANCED_RANGES[characteristicName];
  
  // Format percentage for display
  const formatPercentage = (val: number) => `${Math.round(val * 100)}%`;
  
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
    <div className={`flex items-center py-2 border-b last:border-b-0 border-gray-200 ${className}`}>
      {/* Label */}
      <div className="w-1/4 pr-2 text-sm font-medium text-gray-700 capitalize">
        {label}
      </div>
      
      {/* Bar Container */}
      <div className="w-3/4 flex items-center">
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Background bar */}
          <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
          
          {/* Base balanced range (green) */}
          <div 
            className="absolute top-0 bottom-0 bg-green-300/75 rounded-full"
            style={{
              left: `${minBalance * 100}%`,
              width: `${(maxBalance - minBalance) * 100}%`
            }}
            title={`Balanced Range: ${formatPercentage(minBalance)} - ${formatPercentage(maxBalance)}`}
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
                title={`Adjusted Range: ${formatPercentage(adjustedRanges[0])} - ${formatPercentage(adjustedRanges[1])}`}
              ></div>
            </>
          )}

          {/* Value marker */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
            style={{ left: `${displayValue * 100}%` }}
            title={`Current Value: ${formatPercentage(displayValue)}`}
          ></div>
        </div>
        
        {/* Value display */}
        {showValue && (
          <span className={`ml-3 text-sm font-medium w-12 text-right ${getValueColor()}`}>
            {formatPercentage(displayValue)}
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
}

export const WineCharacteristicsDisplay: React.FC<WineCharacteristicsDisplayProps> = ({
  characteristics,
  adjustedRanges,
  showValues = true,
  className = ""
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {Object.entries(characteristics).map(([key, value]) => (
        <CharacteristicBar
          key={key}
          characteristicName={key as keyof WineCharacteristics}
          label={key.charAt(0).toUpperCase() + key.slice(1)}
          value={value}
          adjustedRanges={adjustedRanges?.[key as keyof WineCharacteristics]}
          showValue={showValues}
        />
      ))}
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
        <span>Optimal Zone</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1 h-2 bg-black rounded"></div>
        <span>Current Value</span>
      </div>
    </div>
  );
};
