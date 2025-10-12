// Feature Risk Display Component
// Generic component for displaying feature risk and status with tooltip

import { WineBatch } from '@/lib/types/types';
import { getFeature } from '@/lib/services';
import { getColorClass } from '@/lib/utils/utils';
import { getRiskSeverityLabel } from '@/lib/services/wine/featureRiskHelper';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';

interface FeatureRiskDisplayProps {
  batch: WineBatch;
  featureId: string;
  featureName: string;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Display feature risk or status for a wine batch
 * Shows risk percentage if not present, or feature icon/name if present
 * Optional tooltip with detailed information
 */
export function FeatureRiskDisplay({ 
  batch, 
  featureId, 
  featureName, 
  className = '', 
  showTooltip = true 
}: FeatureRiskDisplayProps) {
  const feature = getFeature(batch, featureId);
  
  if (!feature) {
    return (
      <div className={`text-xs text-gray-600 ${className}`}>
        <span className="font-medium">{featureName}:</span> <span className="text-gray-500">N/A</span>
      </div>
    );
  }
  
  // Use inverted color for risk (lower risk = better = green)
  const invertedRisk = 1 - feature.risk;
  const colorClass = getColorClass(invertedRisk);
  
  const riskDisplay = feature.isPresent 
    ? `${feature.icon} ${feature.name}`
    : `${(feature.risk * 100).toFixed(1)}% risk`;
  
  // Calculate expected weeks for time-based features
  const expectedWeeks = !feature.isPresent && feature.risk > 0 
    ? Math.ceil(1 / feature.risk)
    : null;

  const displayElement = (
    <div className={`text-xs text-gray-600 ${showTooltip ? 'cursor-help' : ''} ${className}`}>
      <span className="font-medium">{featureName}:</span>{' '}
      <span className={`font-medium ${colorClass}`}>{riskDisplay}</span>
    </div>
  );

  if (!showTooltip) {
    return displayElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {displayElement}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            {feature.isPresent ? (
              <>
                <p className="font-semibold text-red-600">{feature.name} detected</p>
                <p>This batch has {feature.name.toLowerCase()}.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {feature.name} Risk: {(feature.risk * 100).toFixed(1)}%
                  <span className="ml-2 text-xs opacity-80">({getRiskSeverityLabel(feature.risk)})</span>
                </p>
                <p>Weekly chance this batch develops {feature.name.toLowerCase()}.</p>
                {expectedWeeks !== null && expectedWeeks < 50 && (
                  <p className="text-yellow-600 mt-1">
                    Expected ~{expectedWeeks} weeks (statistical average)
                  </p>
                )}
                <p className="text-gray-500 mt-2">
                  Current state: <span className="font-medium">{batch.state}</span>
                </p>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

