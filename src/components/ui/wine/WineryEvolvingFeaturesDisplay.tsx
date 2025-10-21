import { WineBatch } from '@/lib/types/types';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';

interface EvolvingFeaturesDisplayProps {
  batch: WineBatch;
  className?: string;
}

/**
 * Display evolving positive features in the Current Activity section
 * Shows features that grow over time with weekly effects
 */
export function EvolvingFeaturesDisplay({ batch, className = '' }: EvolvingFeaturesDisplayProps) {
  const configs = getAllFeatureConfigs();
  const features = batch.features || [];
  
  // Find evolving positive features (graduated features that are present)
  const evolvingFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      
      // Show if: positive feature, graduated manifestation, and present
      const shouldShow = feature?.isPresent && 
                        config.type === 'feature' && 
                        config.manifestation === 'graduated';
      
      if (!shouldShow) return null;
      
      return { feature, config };
    })
    .filter(Boolean) as Array<{ feature: any; config: any }>;
  
  if (evolvingFeatures.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Evolving Features Section */}
      <div className="space-y-1">
        <div className="text-xs text-gray-600">Evolving Features:</div>
        <div className="flex flex-wrap gap-1">
          {evolvingFeatures.map(({ feature, config }) => (
            <EvolvingFeatureBadge
              key={feature.id}
              feature={feature}
              config={config}
              batch={batch}
            />
          ))}
        </div>
      </div>
      
      {/* Weekly Effects Section - Show combined effects from evolving features */}
      <div className="space-y-1">
        <div className="text-xs text-gray-600">Weekly Effects:</div>
        <div className="flex flex-wrap gap-1">
          <FeatureWeeklyEffectsBadges evolvingFeatures={evolvingFeatures} />
        </div>
      </div>
    </div>
  );
}

interface EvolvingFeatureBadgeProps {
  feature: any;
  config: any;
  batch: WineBatch;
}

function EvolvingFeatureBadge({ feature, config, batch }: EvolvingFeatureBadgeProps) {
  const severity = feature.severity || 0;
  const severityPercent = Math.round(severity * 100);
  
  // Calculate weekly growth rate based on current state
  const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
  const stateMultiplier = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
  const weeklyGrowthRate = baseGrowthRate * stateMultiplier;
  const weeklyGrowthPercent = Math.round(weeklyGrowthRate * 100 * 10) / 10; // Round to 1 decimal
  
  const displayElement = (
    <div className="flex items-center bg-green-100 px-2 py-1 rounded text-xs cursor-help">
      <span className="mr-1">{config.icon}</span>
      <span className="font-medium text-green-700">
        {config.name}: {severityPercent}%
      </span>
      <span className="ml-1 text-green-600">
        (+{weeklyGrowthPercent}%/week)
      </span>
    </div>
  );
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {displayElement}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="text-xs space-y-2">
            <div>
              <p className="font-semibold">{config.name}</p>
              <p className="text-gray-300">{config.description}</p>
            </div>
            
            <div>
              <p className="font-medium">Current Status:</p>
              <p className="text-xs text-gray-300">
                Severity: {severityPercent}% ({severity.toFixed(3)})
              </p>
              <p className="text-xs text-gray-300">
                Weekly growth: +{weeklyGrowthPercent}% per week
              </p>
            </div>
            
            <div>
              <p className="font-medium">State Effects:</p>
              <p className="text-xs text-gray-300">
                Current state: <span className="font-medium">{batch.state}</span>
              </p>
              <p className="text-xs text-gray-300">
                State multiplier: {stateMultiplier}x
              </p>
              <p className="text-xs text-gray-300 font-mono">
                Effective rate: {baseGrowthRate.toFixed(3)} × {stateMultiplier} = {weeklyGrowthRate.toFixed(3)}/week
              </p>
            </div>
            
            {/* Show characteristic effects if any */}
            {config.effects.characteristics && config.effects.characteristics.length > 0 && (
              <div className="border-t border-gray-600 pt-2">
                <p className="font-medium">Characteristic Effects:</p>
                <div className="text-xs text-gray-300 space-y-1">
                  {config.effects.characteristics.map((effect: any) => {
                    const modifier = typeof effect.modifier === 'function' 
                      ? effect.modifier(severity)
                      : effect.modifier * severity;
                    const modifierPercent = Math.round((modifier || 0) * 100 * 10) / 10;
                    
                    return (
                      <p key={effect.characteristic}>
                        • {effect.characteristic}: {modifier > 0 ? '+' : ''}{modifierPercent}%
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Show quality effect */}
            {config.effects.quality && (
              <div className="border-t border-gray-600 pt-2">
                <p className="font-medium">Quality Impact:</p>
                <p className="text-xs text-gray-300">
                  +{Math.round(((config.effects.quality.amount(severity) || 0) * 100) * 10) / 10}% quality bonus
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FeatureWeeklyEffectsBadgesProps {
  evolvingFeatures: Array<{ feature: any; config: any }>;
}

// Component to display combined weekly effects from evolving features
function FeatureWeeklyEffectsBadges({ evolvingFeatures }: FeatureWeeklyEffectsBadgesProps) {
  // Combine all characteristic effects from all evolving features
  const combinedEffects: Record<string, number> = {};
  
  evolvingFeatures.forEach(({ feature, config }) => {
    if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
      config.effects.characteristics.forEach(({ characteristic, modifier }: { characteristic: string; modifier: number | ((severity: number) => number) }) => {
        const effectValue = typeof modifier === 'function' 
          ? modifier(feature.severity) 
          : modifier * feature.severity;
        
        combinedEffects[characteristic] = (combinedEffects[characteristic] || 0) + effectValue;
      });
    }
  });
  
  // Create badges for combined effects
  const badges: React.JSX.Element[] = [];
  
  Object.entries(combinedEffects).forEach(([characteristic, totalEffect]) => {
    if (Math.abs(totalEffect) > 0.001) { // Only show significant effects
      const percentage = (totalEffect * 100).toFixed(1);
      const isPositive = totalEffect > 0;
      const colorClass = isPositive ? 'text-green-700' : 'text-red-600';
      const bgClass = isPositive ? 'bg-green-100' : 'bg-red-100';
      const sign = isPositive ? '+' : '';
      
      badges.push(
        <TooltipProvider key={characteristic}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`text-xs px-2 py-1 rounded ${bgClass} ${colorClass} flex items-center gap-1 cursor-help`}>
                <img src={`/assets/icons/characteristics/${characteristic}.png`} alt={`${characteristic} icon`} className="w-3 h-3" />
                <span className="font-medium">{sign}{percentage}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs space-y-1">
                <p className="font-semibold capitalize">{characteristic}</p>
                <div className="space-y-1">
                  {getCharacteristicBreakdown(characteristic, evolvingFeatures)}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  });
  
  // Add quality effect badge if any feature has quality effects
  let totalQualityEffect = 0;
  evolvingFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality && config.effects.quality.type === 'bonus') {
      const qualityBonus = typeof config.effects.quality.amount === 'function' 
        ? config.effects.quality.amount(feature.severity)
        : config.effects.quality.amount;
      totalQualityEffect += qualityBonus;
    }
  });
  
  if (totalQualityEffect > 0.001) {
    const qualityPercentage = (totalQualityEffect * 100).toFixed(1);
    badges.push(
      <TooltipProvider key="quality">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 flex items-center gap-1 cursor-help">
              <span>⭐</span>
              <span className="font-medium">+{qualityPercentage}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-semibold">Quality Bonus</p>
              <div className="space-y-1">
                {getQualityBreakdown(evolvingFeatures)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return <>{badges}</>;
}

// Helper function to get characteristic breakdown for tooltips
function getCharacteristicBreakdown(characteristic: string, evolvingFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  evolvingFeatures.forEach(({ feature, config }) => {
    if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
      const effect = config.effects.characteristics.find((e: any) => e.characteristic === characteristic);
      if (effect) {
        const effectValue = typeof effect.modifier === 'function' 
          ? effect.modifier(feature.severity) 
          : effect.modifier * feature.severity;
        
        if (Math.abs(effectValue) > 0.001) {
          const percentage = (effectValue * 100).toFixed(1);
          const sign = effectValue > 0 ? '+' : '';
          contributions.push(
            <p key={config.id} className="text-gray-300">
              {config.name}: {sign}{percentage}%
            </p>
          );
        }
      }
    }
  });
  
  return contributions;
}

// Helper function to get quality breakdown for tooltips
function getQualityBreakdown(evolvingFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  evolvingFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality && config.effects.quality.type === 'bonus') {
      const qualityBonus = typeof config.effects.quality.amount === 'function' 
        ? config.effects.quality.amount(feature.severity)
        : config.effects.quality.amount;
      
      if (qualityBonus > 0.001) {
        const percentage = (qualityBonus * 100).toFixed(1);
        contributions.push(
          <p key={config.id} className="text-gray-300">
            {config.name}: +{percentage}%
          </p>
        );
      }
    }
  });
  
  return contributions;
}
