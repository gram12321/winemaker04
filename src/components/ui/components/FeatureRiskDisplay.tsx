// Unified Feature Risk Display Component
// Replaces HarvestFeatureRisksDisplay.tsx with generic system for vineyard and winery contexts

import { WineBatch, Vineyard } from '@/lib/types/types';
import { FeatureRiskDisplayData, FeatureRiskContext, getFeatureRisksForDisplay, getRiskSeverityLabel, getRiskColorClass, getNextWineryAction } from '@/lib/services/wine/features/featureRiskService';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';

interface FeatureRiskDisplayProps {
  // Vineyard context
  vineyard?: Vineyard;
  // Winery context  
  batch?: WineBatch;
  // Display options
  showForNextAction?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Unified feature risk display for both vineyard and winery contexts
 * Shows risks and influences based on context and next available action
 */
export function FeatureRiskDisplay({ 
  vineyard, 
  batch, 
  showForNextAction = false, 
  className = '',
  compact = false 
}: FeatureRiskDisplayProps) {
  // Determine context type and event
  const context: FeatureRiskContext = vineyard 
    ? {
        type: 'vineyard',
        event: 'harvest',
        vineyard
      }
    : {
        type: 'winery',
        event: batch?.state === 'grapes' ? 'crushing' : 
               batch?.state === 'must_ready' ? 'fermentation' : 'bottling',
        batch,
        nextAction: batch ? getNextWineryAction(batch) || undefined : undefined
      };

  // Get risk data for display
  const riskData = getFeatureRisksForDisplay(context);
  
  // Don't show if no risks or influences and not in compact mode
  if (riskData.risks.length === 0 && riskData.influences.length === 0) {
    if (compact) return null;
    
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        <span className="font-medium">
          {context.type === 'vineyard' ? 'Harvest Features:' : 'Production Features:'}
        </span> None detected
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      {!compact && (
        <div className="text-xs font-medium text-gray-800">
          {context.type === 'vineyard' ? 'Harvest Features' : 'Production Features'}
          {showForNextAction && riskData.nextAction && (
            <span className="text-gray-500 ml-1">
              (Next: {riskData.nextAction})
            </span>
          )}
        </div>
      )}

      {/* Risks */}
      {riskData.risks.length > 0 && (
        <div className="space-y-1">
          {!compact && (
            <div className="text-xs font-medium text-gray-800">Risks:</div>
          )}
          <div className="space-y-1">
            {riskData.risks.map((risk) => (
              <RiskItem
                key={risk.featureId}
                risk={risk}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Influences */}
      {riskData.influences.length > 0 && (
        <div className="space-y-1">
          {!compact && (
            <div className="text-xs font-medium text-green-700">Influences:</div>
          )}
          <div className="space-y-1">
            {riskData.influences.map((influence) => (
              <InfluenceItem
                key={influence.featureId}
                influence={influence}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface RiskItemProps {
  risk: FeatureRiskDisplayData['risks'][0];
  compact: boolean;
}

function RiskItem({ risk, compact }: RiskItemProps) {
  // For option-dependent features, show the range as the main risk instead of single value
  let displayText: string;
  let colorClass: string;
  let icon: string;
  
  if (risk.riskRanges && risk.riskRanges.length > 0) {
    // Show range as main risk for option-dependent features
    const minRisk = risk.riskRanges[0].minRisk;
    const maxRisk = risk.riskRanges[0].maxRisk;
    const minPercent = (minRisk * 100).toFixed(1);
    const maxPercent = (maxRisk * 100).toFixed(1);
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}% risk`
      : `${minPercent}%-${maxPercent}% risk`;
    
    // Use the higher risk for color coding
    colorClass = getRiskColorClass(maxRisk);
    icon = maxRisk > 0 ? '⚠️' : '✅';
  } else {
    // Fallback to single risk value for non-option-dependent features
    const riskPercent = (risk.newRisk * 100).toFixed(1);
    displayText = `${riskPercent}% risk`;
    colorClass = getRiskColorClass(risk.newRisk);
    icon = risk.newRisk > 0 ? '⚠️' : '✅';
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{icon} {risk.featureName}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {risk.contextInfo && <span className="text-gray-500"> {risk.contextInfo}</span>}
    </div>
  );
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {displayElement}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <RiskTooltipContent risk={risk} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {displayElement}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <RiskTooltipContent risk={risk} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface InfluenceItemProps {
  influence: FeatureRiskDisplayData['influences'][0];
  compact: boolean;
}

function InfluenceItem({ influence, compact }: InfluenceItemProps) {
  const displayElement = (
    <div className="flex items-center justify-between bg-green-50 px-2 py-1 rounded text-xs">
      <div className="flex items-center">
        <span className="mr-2">{influence.icon}</span>
        <span className="font-medium text-green-700">{influence.featureName}</span>
        {influence.contextInfo && (
          <span className="text-green-600 ml-1">({influence.contextInfo})</span>
        )}
      </div>
      <span className="text-green-600 font-medium">Positive</span>
    </div>
  );
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {displayElement}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <InfluenceTooltipContent influence={influence} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {displayElement}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <InfluenceTooltipContent influence={influence} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RiskTooltipContent({ risk }: { risk: RiskItemProps['risk'] }) {
  
  return (
    <div className="text-xs space-y-2">
      <div>
        <p className="font-semibold">{risk.featureName}</p>
        <p className="text-gray-300">{risk.description}</p>
      </div>
      
      <div>
        <p className="font-medium">
          {risk.riskRanges && risk.riskRanges.length > 0 ? (
            // Show range for option-dependent features
            (() => {
              const minRisk = risk.riskRanges[0].minRisk;
              const maxRisk = risk.riskRanges[0].maxRisk;
              const minPercent = (minRisk * 100).toFixed(1);
              const maxPercent = (maxRisk * 100).toFixed(1);
              const riskText = minRisk === maxRisk 
                ? `${maxPercent}%`
                : `${minPercent}%-${maxPercent}%`;
              return `Risk: ${riskText} (${getRiskSeverityLabel(maxRisk)})`;
            })()
          ) : (
            // Show single value for non-option-dependent features
            `Risk: ${(risk.newRisk * 100).toFixed(1)}% (${getRiskSeverityLabel(risk.newRisk)})`
          )}
        </p>
        
        {/* Show cumulative risk explanation for oxidation */}
        {risk.featureId === 'oxidation' && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium text-yellow-400">Cumulative Risk</p>
            <p className="text-gray-300 text-xs">
              This risk accumulates over time. Each tick adds the calculated amount to your current risk level.
              Higher fragility and oxidation-prone grapes increase the risk faster.
            </p>
            {risk.contextInfo && (
              <p className="text-gray-400 text-xs mt-1">
                {risk.contextInfo}
              </p>
            )}
          </div>
        )}

        {/* Show quality impact if the feature manifests */}
        {risk.qualityImpact && risk.qualityImpact > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium text-red-400">Quality Impact if Manifests</p>
            <p className="text-gray-300 text-xs">
              -{(risk.qualityImpact * 100).toFixed(1)}% quality reduction
            </p>
            {risk.featureId === 'oxidation' && (
              <p className="text-gray-400 text-xs mt-1">
                Higher quality wines are affected more severely. Also reduces aroma, acidity, and body.
              </p>
            )}
          </div>
        )}
        
        {risk.riskRanges && risk.riskRanges.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Risk by Processing Options:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {risk.riskRanges.map((range, index) => (
                <div key={index} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">{range.groupLabel}</span>
                    <span className={`font-mono ${getRiskColorClass(range.maxRisk)}`}>
                      {range.minRisk === range.maxRisk 
                        ? `${(range.maxRisk * 100).toFixed(1)}%`
                        : `${(range.minRisk * 100).toFixed(1)}% - ${(range.maxRisk * 100).toFixed(1)}%`
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!risk.riskRanges && risk.riskCombinations && risk.riskCombinations.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Risk by Processing Options:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {risk.riskCombinations.slice(0, 10).map((combination, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-300 truncate mr-2">{combination.label}</span>
                  <span className={`font-mono ${getRiskColorClass(combination.risk)}`}>
                    {(combination.risk * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {risk.riskCombinations.length > 10 && (
                <div className="text-xs text-gray-400 italic">
                  ... and {risk.riskCombinations.length - 10} more combinations
                </div>
              )}
            </div>
          </div>
        )}
        
        {risk.qualityImpact && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Quality Impact:</p>
            <p className="text-xs text-gray-300">
              -{Math.abs(risk.qualityImpact * 100)}% quality reduction if manifests
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfluenceTooltipContent({ influence }: { influence: InfluenceItemProps['influence'] }) {
  return (
    <div className="text-xs space-y-2">
      <div>
        <p className="font-semibold">{influence.featureName}</p>
        <p className="text-gray-300">{influence.description}</p>
      </div>
      
      <div>
        <p className="font-medium">Effect:</p>
        <p className="text-xs text-gray-300">
          This positive feature will develop in wine over time.
        </p>
      </div>
      
      {influence.qualityImpact && (
        <div className="border-t border-gray-600 pt-2">
          <p className="font-medium">Quality Impact:</p>
          <p className="text-xs text-gray-300">
            +{Math.round((influence.qualityImpact * 100) * 10) / 10}% quality bonus when fully developed
          </p>
        </div>
      )}
    </div>
  );
}

