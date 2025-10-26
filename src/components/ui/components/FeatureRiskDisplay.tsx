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

  // Get feature data for display
  const featureData = getFeatureRisksForDisplay(context);
  
  // Don't show if no features and not in compact mode
  if (featureData.features.length === 0) {
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
          {showForNextAction && featureData.nextAction && (
            <span className="text-gray-500 ml-1">
              (Next: {featureData.nextAction})
            </span>
          )}
        </div>
      )}

      {/* All Features */}
      {featureData.features.length > 0 && (
        <div className="space-y-1">
          <div className="space-y-1">
            {featureData.features.map((feature) => (
              <FeatureItem
                key={feature.featureId}
                feature={feature}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FeatureItemProps {
  feature: FeatureRiskDisplayData['features'][0];
  compact: boolean;
}

function FeatureItem({ feature, compact }: FeatureItemProps) {
  // For option-dependent features, show the range as the main risk instead of single value
  let displayText: string;
  let colorClass: string;
  
  if (feature.riskRanges && feature.riskRanges.length > 0) {
    // Show range as main risk for option-dependent features
    const minRisk = feature.riskRanges[0].minRisk;
    const maxRisk = feature.riskRanges[0].maxRisk;
    const minPercent = (minRisk * 100).toFixed(1);
    const maxPercent = (maxRisk * 100).toFixed(1);
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}%`
      : `${minPercent}%-${maxPercent}%`;
    
    // Use the higher risk for color coding
    colorClass = getRiskColorClass(maxRisk);
  } else {
    // Fallback to single risk value for non-option-dependent features
    const riskPercent = (feature.newRisk * 100).toFixed(1);
    displayText = `${riskPercent}%`;
    colorClass = getRiskColorClass(feature.newRisk);
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{feature.icon} {feature.featureName}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {feature.contextInfo && <span className="text-gray-500"> {feature.contextInfo}</span>}
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
            <FeatureTooltipContent feature={feature} />
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
          <FeatureTooltipContent feature={feature} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FeatureTooltipContent({ feature }: { feature: FeatureItemProps['feature'] }) {
  const config = feature.config;
  
  return (
    <div className="text-xs space-y-2">
      <div>
        <p className="font-semibold">{feature.featureName}</p>
        <p className="text-gray-300">{feature.description}</p>
      </div>
      
      <div>
        <p className="font-medium">
          {feature.riskRanges && feature.riskRanges.length > 0 ? (
            // Show range for option-dependent features
            (() => {
              const minRisk = feature.riskRanges[0].minRisk;
              const maxRisk = feature.riskRanges[0].maxRisk;
              const minPercent = (minRisk * 100).toFixed(1);
              const maxPercent = (maxRisk * 100).toFixed(1);
              const riskText = minRisk === maxRisk 
                ? `${maxPercent}%`
                : `${minPercent}%-${maxPercent}%`;
              return `Risk: ${riskText} (${getRiskSeverityLabel(maxRisk)})`;
            })()
          ) : (
            // Show single value for non-option-dependent features
            `Risk: ${(feature.newRisk * 100).toFixed(1)}% (${getRiskSeverityLabel(feature.newRisk)})`
          )}
        </p>
        
        {/* Show cumulative risk explanation for oxidation */}
        {feature.featureId === 'oxidation' && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium text-yellow-400">Cumulative Risk</p>
            <p className="text-gray-300 text-xs">
              This risk accumulates over time. Each tick adds the calculated amount to your current risk level.
              Higher fragility and oxidation-prone grapes increase the risk faster.
            </p>
            {feature.contextInfo && (
              <p className="text-gray-400 text-xs mt-1">
                {feature.contextInfo}
              </p>
            )}
          </div>
        )}

        {/* Show quality impact if the feature manifests */}
        {feature.qualityImpact && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Quality Impact if Manifests</p>
            <p className="text-gray-300 text-xs">
              {feature.qualityImpact < 0 ? '-' : '+'}{Math.abs(feature.qualityImpact * 100).toFixed(1)}% quality change
            </p>
            {feature.featureId === 'oxidation' && (
              <p className="text-gray-400 text-xs mt-1">
                Higher quality wines are affected more severely. Also reduces aroma, acidity, and body.
              </p>
            )}
          </div>
        )}
        
        {/* Show characteristic effects */}
        {config?.effects?.characteristics && config.effects.characteristics.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Characteristic Effects:</p>
            <div className="text-xs text-gray-300 space-y-1">
              {config.effects.characteristics.map((effect: any) => {
                const baseModifier = typeof effect.modifier === 'function' 
                  ? effect.modifier(1.0)  // Use max severity for range display
                  : effect.modifier;
                
                // Calculate range for severity-based modifiers
                let displayText: string;
                if (typeof effect.modifier === 'function') {
                  const minModifier = effect.modifier(0);
                  const maxModifier = effect.modifier(1.0);
                  const minPercent = (minModifier * 100).toFixed(0);
                  const maxPercent = (maxModifier * 100).toFixed(0);
                  displayText = minModifier === maxModifier 
                    ? `${maxModifier > 0 ? '+' : ''}${maxPercent}%`
                    : `${minModifier > 0 ? '+' : ''}${minPercent}% to ${maxModifier > 0 ? '+' : ''}${maxPercent}%`;
                } else {
                  const percent = (baseModifier * 100).toFixed(0);
                  displayText = `${baseModifier > 0 ? '+' : ''}${percent}%`;
                }
                
                return (
                  <p key={effect.characteristic}>
                    • {effect.characteristic}: {displayText}
                  </p>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Show prestige effects summary */}
        {config?.effects?.prestige && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Prestige Impact:</p>
            <div className="text-xs text-gray-300 space-y-1">
              {config.effects.prestige.onManifestation && (
                <div>
                  <p className="font-medium text-yellow-400">On Manifestation:</p>
                  {config.effects.prestige.onManifestation.company && (
                    <p className="ml-2">
                      • Company: up to {config.effects.prestige.onManifestation.company.maxImpact && config.effects.prestige.onManifestation.company.maxImpact < 0 ? '-' : ''}{Math.abs(config.effects.prestige.onManifestation.company.maxImpact || 0).toFixed(1)} prestige
                    </p>
                  )}
                  {config.effects.prestige.onManifestation.vineyard && (
                    <p className="ml-2">
                      • Vineyard: up to {config.effects.prestige.onManifestation.vineyard.maxImpact && config.effects.prestige.onManifestation.vineyard.maxImpact < 0 ? '-' : ''}{Math.abs(config.effects.prestige.onManifestation.vineyard.maxImpact || 0).toFixed(1)} prestige
                    </p>
                  )}
                </div>
              )}
              {config.effects.prestige.onSale && (
                <div>
                  <p className="font-medium text-yellow-400">On Sale:</p>
                  {config.effects.prestige.onSale.company && (
                    <p className="ml-2">
                      • Company: up to {config.effects.prestige.onSale.company.maxImpact && config.effects.prestige.onSale.company.maxImpact < 0 ? '-' : ''}{Math.abs(config.effects.prestige.onSale.company.maxImpact || 0).toFixed(1)} prestige
                    </p>
                  )}
                  {config.effects.prestige.onSale.vineyard && (
                    <p className="ml-2">
                      • Vineyard: up to {config.effects.prestige.onSale.vineyard.maxImpact && config.effects.prestige.onSale.vineyard.maxImpact < 0 ? '-' : ''}{Math.abs(config.effects.prestige.onSale.vineyard.maxImpact || 0).toFixed(1)} prestige
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Show customer sensitivity */}
        {config?.customerSensitivity && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Customer Price Sensitivity:</p>
            <div className="text-xs text-gray-300 space-y-1">
              {Object.entries(config.customerSensitivity).map(([customerType, sensitivity]: [string, any]) => {
                const percentChange = (sensitivity - 1.0) * 100;
                const percentChangeFixed = Math.abs(percentChange).toFixed(0);
                const sensitivityText = sensitivity === 1.0 
                  ? 'No change'
                  : sensitivity < 1.0 
                    ? `-${percentChangeFixed}%`
                    : `+${percentChangeFixed}%`;
                return (
                  <p key={customerType}>
                    • {customerType}: {sensitivityText}
                  </p>
                );
              })}
            </div>
          </div>
        )}
        
        {feature.riskRanges && feature.riskRanges.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Risk by Processing Options:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {feature.riskRanges.map((range: any, index: number) => (
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
        
        {!feature.riskRanges && feature.riskCombinations && feature.riskCombinations.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium">Risk by Processing Options:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {feature.riskCombinations.slice(0, 10).map((combination: any, index: number) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-300 truncate mr-2">{combination.label}</span>
                  <span className={`font-mono ${getRiskColorClass(combination.risk)}`}>
                    {(combination.risk * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {feature.riskCombinations.length > 10 && (
                <div className="text-xs text-gray-400 italic">
                  ... and {feature.riskCombinations.length - 10} more combinations
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

