// Unified Feature Risk Display Component
// Replaces HarvestFeatureRisksDisplay.tsx with generic system for vineyard and winery contexts

import { WineBatch, Vineyard } from '@/lib/types/types';
import { FeatureRiskDisplayData, FeatureRiskContext, getFeatureRisksForDisplay, getRiskSeverityLabel, getRiskColorClass, getNextWineryAction } from '@/lib/services/wine/features/featureRiskService';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';
import { formatNumber } from '@/lib/utils/utils';

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
}

// Helper function to wrap display elements with tooltips
function wrapWithTooltip(element: React.ReactNode, feature: FeatureItemProps['feature']) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {element}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <FeatureTooltipContent feature={feature} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FeatureItem({ feature }: FeatureItemProps) {
  // For option-dependent features, show the range as the main risk instead of single value
  let displayText: string;
  let colorClass: string;
  let additionalInfo: React.ReactNode = null;
  
  if (feature.riskRanges && feature.riskRanges.length > 0) {
    // Show range as main risk for option-dependent features
    const minRisk = feature.riskRanges[0].minRisk;
    const maxRisk = feature.riskRanges[0].maxRisk;
    const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
    const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}%`
      : `${minPercent}%-${maxPercent}%`;
    
    colorClass = getRiskColorClass(maxRisk);
  } else if (feature.riskCombinations && feature.riskCombinations.length > 0) {
    // For features with discrete option combinations, calculate min/max from all combinations
    const risks = feature.riskCombinations.map((c: any) => c.risk);
    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
    const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}%`
      : `${minPercent}%-${maxPercent}%`;
    
    colorClass = getRiskColorClass(maxRisk);
  } else if (feature.config?.behavior === 'accumulation') {
    // Accumulation features: show current risk + weekly increase
    const currentRiskPercent = formatNumber(feature.currentRisk * 100, { smartDecimals: true });
    
    if (feature.weeklyRiskIncrease !== undefined && feature.weeklyRiskIncrease > 0) {
      const weeklyIncreasePercent = formatNumber(feature.weeklyRiskIncrease * 100, { smartDecimals: true });
      const estimatedWeeks = Math.ceil((1.0 - feature.currentRisk) / feature.weeklyRiskIncrease);
      
      displayText = `${currentRiskPercent}% (+${weeklyIncreasePercent}%/week)`;
      colorClass = getRiskColorClass(feature.currentRisk);
      
      if (estimatedWeeks < 50) {
        additionalInfo = <span className="text-gray-400 ml-1">(~{estimatedWeeks} weeks)</span>;
      }
    } else {
      displayText = `${currentRiskPercent}%`;
      colorClass = getRiskColorClass(feature.currentRisk);
    }
  } else {
    // Non-accumulation features: show new risk
    const riskPercent = formatNumber(feature.newRisk * 100, { smartDecimals: true });
    displayText = `${riskPercent}%`;
    colorClass = getRiskColorClass(feature.newRisk);
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{feature.icon} {feature.featureName}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {additionalInfo}
      {feature.contextInfo && <span className="text-gray-500"> {feature.contextInfo}</span>}
    </div>
  );
  
  return wrapWithTooltip(displayElement, feature);
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
            // Show range for grouped option-dependent features
            (() => {
              const minRisk = feature.riskRanges[0].minRisk;
              const maxRisk = feature.riskRanges[0].maxRisk;
              const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
              const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
              const riskText = minRisk === maxRisk 
                ? `${maxPercent}%`
                : `${minPercent}%-${maxPercent}%`;
              return `Risk: ${riskText} (${getRiskSeverityLabel(maxRisk)})`;
            })()
          ) : feature.riskCombinations && feature.riskCombinations.length > 0 ? (
            // Show range for discrete option combinations
            (() => {
              const risks = feature.riskCombinations.map((c: any) => c.risk);
              const minRisk = Math.min(...risks);
              const maxRisk = Math.max(...risks);
              const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
              const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
              const riskText = minRisk === maxRisk 
                ? `${maxPercent}%`
                : `${minPercent}%-${maxPercent}%`;
              return `Risk: ${riskText} (${getRiskSeverityLabel(maxRisk)})`;
            })()
          ) : (
            // Show single value for non-option-dependent features
            `Risk: ${formatNumber(feature.newRisk * 100, { smartDecimals: true })}% (${getRiskSeverityLabel(feature.newRisk)})`
          )}
        </p>
        
        {/* Show cumulative risk explanation for accumulation features */}
        {feature.config?.behavior === 'accumulation' && feature.weeklyRiskIncrease !== undefined && feature.weeklyRiskIncrease > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className="font-medium text-yellow-400">Cumulative Risk</p>
            <p className="text-gray-300 text-xs">
              Current risk: {formatNumber(feature.currentRisk * 100, { smartDecimals: true })}%
            </p>
            <p className="text-gray-300 text-xs">
              Weekly increase: +{formatNumber(feature.weeklyRiskIncrease * 100, { smartDecimals: true })}%
            </p>
            <p className="text-gray-300 text-xs mt-1">
              This risk accumulates over time. Each tick adds the calculated amount to your current risk level.
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
              {feature.qualityImpact < 0 ? '-' : '+'}{formatNumber(Math.abs(feature.qualityImpact * 100), { smartDecimals: true })}% quality change
            </p>
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
                  const minPercent = formatNumber(minModifier * 100, { smartDecimals: true });
                  const maxPercent = formatNumber(maxModifier * 100, { smartDecimals: true });
                  displayText = minModifier === maxModifier 
                    ? `${maxModifier > 0 ? '+' : ''}${maxPercent}%`
                    : `${minModifier > 0 ? '+' : ''}${minPercent}% to ${maxModifier > 0 ? '+' : ''}${maxPercent}%`;
                } else {
                  const percent = formatNumber(baseModifier * 100, { smartDecimals: true });
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
                const percentChangeFixed = formatNumber(Math.abs(percentChange), { smartDecimals: true });
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
                        ? `${formatNumber(range.maxRisk * 100, { smartDecimals: true })}%`
                        : `${formatNumber(range.minRisk * 100, { smartDecimals: true })}% - ${formatNumber(range.maxRisk * 100, { smartDecimals: true })}%`
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
                    {formatNumber(combination.risk * 100, { smartDecimals: true })}%
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

