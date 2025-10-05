import React from 'react';
import { Vineyard } from '@/lib/types/types';
import { getColorClass, formatNumber, QUALITY_FACTOR_EMOJIS } from '@/lib/utils/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';

// Quality factor types for wine value calculation
export type QualityFactorType =
  | 'landValue'
  | 'vineyardPrestige'
  | 'regionalPrestige'
  | 'altitudeRating'
  | 'aspectRating'
  | 'grapeSuitability';

interface QualityFactorBarProps {
  factorType: QualityFactorType;
  label: string;
  value: number;
  vineyard?: Vineyard;
  showValue?: boolean;
  className?: string;
  // Optional raw values for tooltips
  rawValue?: string | number;
  // Show factor icon
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
    return QUALITY_FACTOR_EMOJIS[factorType] || '❓';
  };

  // Clamp value to 0-1 range
  const displayValue = Math.max(0, Math.min(1, value));

  // Build tooltip with factor-specific information
  const buildTooltip = () => {
    let base = `Current Value: ${formatNumber(displayValue, { decimals: 2, forceDecimals: true })}`;

    if (rawValue !== undefined) {
      if (factorType === 'landValue' && typeof rawValue === 'number') {
        base += `\nRaw Value: €${formatNumber(rawValue, { decimals: 0, forceDecimals: false })}/hectare`;
      } else {
        base += `\nRaw Value: ${rawValue}`;
      }
    }

    // Add factor-specific explanations
    switch (factorType) {
      case 'landValue':
        base += '\nFactor: Normalized land value (logarithmic scale)';
        base += '\nWeight: 60% of wine value index';
        break;
      case 'vineyardPrestige':
        base += '\nFactor: Combined vineyard prestige from all sources';
        base += '\nWeight: 40% of wine value index';
        break;
      case 'regionalPrestige':
        if (vineyard) {
          base += `\nRegion: ${vineyard.region}, ${vineyard.country}`;
          base += `\nRegional prestige factor for wine quality`;
        }
        break;
      case 'altitudeRating':
        if (vineyard) {
          base += `\nAltitude: ${vineyard.altitude}m`;
          base += `\nOptimal Range: Based on ${vineyard.region} conditions`;
        }
        break;
      case 'aspectRating':
        if (vineyard) {
          base += `\nAspect: ${vineyard.aspect}`;
          base += `\nRating: Based on ${vineyard.region} conditions`;
        }
        break;
      case 'grapeSuitability':
        if (vineyard?.grape) {
          base += `\nGrape: ${vineyard.grape}`;
          base += `\nSuitability: How well this grape fits the region`;
        }
        break;
    }

    return base;
  };

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
        <div
          className="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden"
          title={buildTooltip()}
        >
          {/* Background bar */}
          <div
            className="absolute inset-0 bg-gray-200 rounded-full"
            title={buildTooltip()}
          ></div>

          {/* Quality range visualization - show as gradient from poor to excellent */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full"></div>

          {/* Value marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-black z-10 rounded-full"
            style={{ left: `${displayValue * 100}%` }}
            title={`Current Value: ${formatNumber(displayValue, { decimals: 2, forceDecimals: true })}`}
          ></div>
        </div>

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

  const content = (
    <div className="space-y-1">
      {/* Quality Score Display */}
      {showQualityScore && qualityScore !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Current Quality Score:</span>
          <span className={`text-2xl font-bold ${getColorClass(qualityScore)}`}>
            {formatNumber(qualityScore, { decimals: 2, forceDecimals: true })}
          </span>
        </div>
      )}

      {Object.entries(factors).map(([key, value]) => (
        <QualityFactorBar
          key={key}
          factorType={key as QualityFactorType}
          label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
          value={value}
          vineyard={vineyard}
          showValue={showValues}
          rawValue={rawValues?.[key as QualityFactorType]}
        />
      ))}
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
