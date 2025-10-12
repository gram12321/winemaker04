// Harvest Risks Display Component
// Shows event-triggered risks for vineyard harvest context

import { Vineyard } from '@/lib/types/types';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures';
import { getColorClass } from '@/lib/utils/utils';
import { getRiskSeverityLabel } from '@/lib/services/wine/featureRiskHelper';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';

interface HarvestRisksDisplayProps {
  vineyard: Vineyard;
  className?: string;
}

/**
 * Display harvest-related risks for a vineyard
 * Shows event-triggered risks that could occur during harvest
 */
export function HarvestRisksDisplay({ vineyard, className = '' }: HarvestRisksDisplayProps) {
  const configs = getAllFeatureConfigs();
  
  // Find event-triggered features that have harvest triggers
  const harvestRisks = configs
    .filter(config => {
      const triggers = config.riskAccumulation.eventTriggers || [];
      return triggers.some(trigger => trigger.event === 'harvest');
    })
    .map(config => {
      const triggers = config.riskAccumulation.eventTriggers || [];
      const harvestTrigger = triggers.find(trigger => trigger.event === 'harvest');
      
      if (!harvestTrigger) return null;
      
      // Check if condition is met
      const conditionMet = harvestTrigger.condition(vineyard);
      const riskIncrease = typeof harvestTrigger.riskIncrease === 'function'
        ? harvestTrigger.riskIncrease(vineyard)
        : harvestTrigger.riskIncrease;
      
      return {
        config,
        conditionMet,
        riskIncrease,
        currentRisk: conditionMet ? riskIncrease : 0
      };
    })
    .filter(Boolean) as Array<{ config: any; conditionMet: boolean; riskIncrease: number; currentRisk: number }>;
  
  if (harvestRisks.length === 0) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        <span className="font-medium">Harvest Risks:</span> None detected
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium text-gray-800">Harvest Risks:</div>
      <div className="space-y-1">
        {harvestRisks.map(({ config, conditionMet, currentRisk }) => (
          <HarvestRiskItem
            key={config.id}
            config={config}
            vineyard={vineyard}
            conditionMet={conditionMet}
            currentRisk={currentRisk}
          />
        ))}
      </div>
    </div>
  );
}

interface HarvestRiskItemProps {
  config: any;
  vineyard: Vineyard;
  conditionMet: boolean;
  currentRisk: number;
}

function HarvestRiskItem({ config, vineyard, conditionMet, currentRisk }: HarvestRiskItemProps) {
  let displayText = '';
  let colorClass = '';
  let icon = config.icon;
  
  if (conditionMet) {
    // Risk condition is met
    const riskPercent = (currentRisk * 100).toFixed(1);
    displayText = `${riskPercent}% risk`;
    
    // Use inverted color for risk (lower risk = better = green)
    const invertedRisk = 1 - currentRisk;
    colorClass = getColorClass(invertedRisk);
    icon = '⚠️';
  } else {
    // No risk
    displayText = 'Low risk';
    colorClass = 'text-gray-500';
    icon = '✅';
  }
  
  // Get context about why risk exists or doesn't exist
  let contextText = '';
  if (config.id === 'green_flavor') {
    const ripeness = vineyard.ripeness || 0;
    if (ripeness < 0.5) {
      contextText = `(Ripeness ${Math.round(ripeness * 100)}% - Underripe)`;
    } else {
      contextText = `(Ripeness ${Math.round(ripeness * 100)}% - Good level)`;
    }
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{icon} {config.name}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {contextText && <span className="text-gray-500"> {contextText}</span>}
    </div>
  );
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {displayElement}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="text-xs space-y-2">
            <div>
              <p className="font-semibold">{config.name}</p>
              <p className="text-gray-300">{config.description}</p>
            </div>
            
            {conditionMet ? (
              <div>
                <p className="font-medium">
                  Risk: {(currentRisk * 100).toFixed(1)}% ({getRiskSeverityLabel(currentRisk)})
                </p>
                
                {/* Show calculation for green flavor specifically */}
                {config.id === 'green_flavor' && (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium">Calculation:</p>
                    <p className="text-xs text-gray-300 font-mono">
                      Risk = (0.5 - ripeness) × 0.6
                    </p>
                    <p className="text-xs text-gray-300 font-mono">
                      = (0.5 - {((vineyard.ripeness || 0)).toFixed(2)}) × 0.6
                    </p>
                    <p className="text-xs text-gray-300 font-mono">
                      = {(0.5 - (vineyard.ripeness || 0)).toFixed(2)} × 0.6
                    </p>
                    <p className="text-xs text-gray-300 font-mono font-medium">
                      = {(currentRisk * 100).toFixed(1)}%
                    </p>
                    
                    <p className="text-xs text-gray-300 mt-2">
                      Ripeness {Math.round((vineyard.ripeness || 0) * 100)}% is below threshold (50%) → triggers green flavor risk
                    </p>
                  </div>
                )}
                
                {/* Generic calculation info for other features */}
                {config.id !== 'green_flavor' && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-300">
                      Current conditions trigger this feature during harvest
                    </p>
                    {contextText && (
                      <p className="text-xs text-gray-300 font-mono">
                        {contextText}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="font-medium text-green-600">Low Risk</p>
                
                {config.id === 'green_flavor' && (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-gray-300 font-mono">
                      Current ripeness: {Math.round((vineyard.ripeness || 0) * 100)}% (≥ 50%)
                    </p>
                    <p className="text-xs text-gray-300">
                      Adequate ripeness prevents green flavors
                    </p>
                  </div>
                )}
                
                {config.id !== 'green_flavor' && contextText && (
                  <p className="text-xs text-gray-300 mt-1 font-mono">
                    {contextText}
                  </p>
                )}
              </div>
            )}
            
            {config.effects.quality && (
              <div className="border-t border-gray-600 pt-2">
                <p className="font-medium">Quality Impact:</p>
                {config.effects.quality.type === 'linear' && (
                  <p className="text-xs text-gray-300">
                    -{Math.abs(config.effects.quality.amount * 100)}% quality reduction if manifests
                  </p>
                )}
                {config.effects.quality.type === 'power' && (
                  <p className="text-xs text-gray-300">
                    -{Math.abs(config.effects.quality.basePenalty * 100)}% base reduction
                    <br />
                    (Premium wines hit harder)
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
