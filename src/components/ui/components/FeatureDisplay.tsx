// Unified Feature Display Component
// Consolidated display for wine features with three distinct sections:
// 1. Evolving Features: Actively changing features with weekly effects
// 2. Active Features: Features currently affecting the wine (severity > 0)
// 3. Risks: Upcoming dangers (risk > 0)
// 
// This component consolidates functionality from:
// - WineryFeatureStatusGrid
// - WineryEvolvingFeaturesDisplay  
// - WineryFeatureRiskDisplay
// - FeatureBadge

import React from 'react';
import { WineBatch } from '@/lib/types/types';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { getColorClass } from '@/lib/utils/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';
import { Badge } from '../shadCN/badge';
import { inferRiskAccumulationStrategy } from '@/lib/types/wineFeatures';

interface FeatureDisplayProps {
  batch: WineBatch;
  className?: string;
  showEvolving?: boolean;
  showActive?: boolean;
  showRisks?: boolean;
  expanded?: boolean; // For WineModal vs Winery display
  displayMode?: 'detailed' | 'badges'; // New prop for badge display
}

/**
 * Unified display for wine features with three sections:
 * - Evolving Features: Actively changing features with weekly effects
 * - Active Features: Features currently affecting the wine
 * - Risks: Upcoming dangers
 */
export function FeatureDisplay({ 
  batch, 
  className = '', 
  showEvolving = true,
  showActive = true,
  showRisks = true,
  displayMode = 'detailed'
}: FeatureDisplayProps) {
  const configs = getAllFeatureConfigs();
  const features = batch.features || [];
  
  // Get all relevant features
  const relevantFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      const strategy = inferRiskAccumulationStrategy(config.riskAccumulation);
      
      return {
        feature: feature || { 
          id: config.id, 
          name: config.name, 
          icon: config.icon, 
          risk: 0, 
          isPresent: false, 
          severity: 0 
        },
        config,
        strategy
      };
    })
    .filter(({ feature }) => {
      // Filter based on what we want to show
      if (feature.isPresent && feature.severity > 0) return true; // Active features
      if (feature.risk > 0) return true; // Risks
      return false;
    });

  // Categorize features
  const evolvingFeatures = relevantFeatures.filter(({ feature, config }) => {
    if (!feature.isPresent || feature.severity === 0) return false;
    
    // Check if feature is actively evolving in current state
    const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
    const stateMultiplier = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
    const weeklyGrowthRate = Number(baseGrowthRate) * Number(stateMultiplier);
    
    return weeklyGrowthRate > 0;
  });

  const activeFeatures = relevantFeatures.filter(({ feature }) => 
    feature.isPresent && feature.severity > 0
  );

  const riskFeatures = relevantFeatures.filter(({ feature, strategy }) => 
    !feature.isPresent && feature.risk > 0 && strategy !== 'independent'
  );

  // Badge display mode
  if (displayMode === 'badges') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {activeFeatures.map(({ feature, config }) => (
          <FeatureBadge
            key={feature.id}
            feature={feature}
            config={config}
            showSeverity={true}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Evolving Features Section */}
      {showEvolving && evolvingFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Evolving Features:</div>
          <div className="space-y-1">
            {evolvingFeatures.map(({ feature, config }) => (
              <EvolvingFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch}
              />
            ))}
          </div>
          
          {/* Weekly Effects Display */}
          <WeeklyEffectsDisplay 
            evolvingFeatures={evolvingFeatures}
          />
        </div>
      )}

      {/* Active Features Section */}
      {showActive && activeFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Features:</div>
          <div className="space-y-1">
            {activeFeatures.map(({ feature, config }) => (
              <ActiveFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
              />
            ))}
          </div>
          
          {/* Combined Effects Display */}
          <CombinedEffectsDisplay 
            activeFeatures={activeFeatures}
            batch={batch}
          />
        </div>
      )}

      {/* Risks Section */}
      {showRisks && riskFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Risks:</div>
          <div className="space-y-1">
            {riskFeatures.map(({ feature, config }) => (
              <RiskFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Evolving Feature Item Component
interface EvolvingFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
}

function EvolvingFeatureItem({ feature, config, batch }: EvolvingFeatureItemProps) {
  const severity = feature.severity || 0;
  const severityPercent = Math.round(severity * 100);
  
  // Calculate actual weekly growth rate
  const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
  const stateMultiplier = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
  const weeklyGrowthRate = baseGrowthRate * stateMultiplier;
  const weeklyGrowthPercent = Math.round(weeklyGrowthRate * 100 * 10) / 10;
  
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
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Active Feature Item Component
interface ActiveFeatureItemProps {
  feature: any;
  config: any;
}

function ActiveFeatureItem({ feature, config }: ActiveFeatureItemProps) {
  const severity = feature.severity || 0;
  const severityPercent = Math.round(severity * 100);
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{config.icon} {config.name}:</span>{' '}
      <span className={config.type === 'fault' ? 'text-red-600' : 'text-green-600'}>
        {config.name} ({severityPercent}%)
      </span>
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
            
            <div>
              <p className="font-medium">{config.name} is present</p>
              <p>This batch has {config.name.toLowerCase()}.</p>
              {config.manifestation === 'graduated' && (
                <p>Severity: {Math.round(feature.severity * 100)}%</p>
              )}
            </div>
            
            {/* Characteristic effects */}
            {config.effects.characteristics && config.effects.characteristics.length > 0 && (
              <div className="border-t border-gray-600 pt-2">
                <p className="font-medium">Effects:</p>
                <div className="text-xs text-gray-300 space-y-1">
                  {config.effects.characteristics.map((effect: any) => {
                    const modifier = typeof effect.modifier === 'function' 
                      ? effect.modifier(feature.severity) 
                      : effect.modifier;
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
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Risk Feature Item Component
interface RiskFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
}

function RiskFeatureItem({ feature, config, batch }: RiskFeatureItemProps) {
  const risk = feature.risk || 0;
  const riskPercent = (risk * 100).toFixed(1);
  
  // Calculate expected weeks for time-based features
  const expectedWeeks = risk > 0 ? Math.ceil(1 / risk) : null;
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{config.icon} {config.name}:</span>{' '}
      <span className={getColorClass(1 - risk)}>
        {riskPercent}% risk
      </span>
      {expectedWeeks !== null && expectedWeeks < 50 && (
        <span className="text-gray-400 ml-1">(~{expectedWeeks} weeks)</span>
      )}
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
            
            <div>
              <p className="font-medium">
                {config.name} Risk: {riskPercent}%
              </p>
              <p>Chance this batch develops {config.name.toLowerCase()}.</p>
              {expectedWeeks !== null && expectedWeeks < 50 && (
                <p className="text-yellow-600 mt-1">
                  Expected ~{expectedWeeks} weeks (statistical average)
                </p>
              )}
              <p className="text-gray-500 mt-2">
                Current state: <span className="font-medium">{batch.state}</span>
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Weekly Effects Display Component
interface WeeklyEffectsDisplayProps {
  evolvingFeatures: Array<{ feature: any; config: any }>;
}

function WeeklyEffectsDisplay({ evolvingFeatures }: WeeklyEffectsDisplayProps) {
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
  
  if (Object.keys(combinedEffects).length === 0) return null;
  
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600">Weekly Effects:</div>
      <div className="flex flex-wrap gap-1">
        {Object.entries(combinedEffects).map(([characteristic, totalEffect]) => {
          if (Math.abs(totalEffect) > 0.001) {
            const percentage = (totalEffect * 100).toFixed(1);
            const isPositive = totalEffect > 0;
            const colorClass = isPositive ? 'text-green-700' : 'text-red-600';
            const bgClass = isPositive ? 'bg-green-100' : 'bg-red-100';
            const sign = isPositive ? '+' : '';
            
            return (
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
          return null;
        })}
      </div>
    </div>
  );
}

// Combined Effects Display Component
interface CombinedEffectsDisplayProps {
  activeFeatures: Array<{ feature: any; config: any }>;
  batch: WineBatch;
}

function CombinedEffectsDisplay({ activeFeatures, batch }: CombinedEffectsDisplayProps) {
  // batch parameter kept for potential future use
  // Combine all characteristic effects from all active features
  const combinedEffects: Record<string, number> = {};
  
  activeFeatures.forEach(({ feature, config }) => {
    if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
      config.effects.characteristics.forEach(({ characteristic, modifier }: { characteristic: string; modifier: number | ((severity: number) => number) }) => {
        const effectValue = typeof modifier === 'function' 
          ? modifier(feature.severity) 
          : modifier * feature.severity;
        
        combinedEffects[characteristic] = (combinedEffects[characteristic] || 0) + effectValue;
      });
    }
  });
  
  // Add combined quality effect
  let totalQualityEffect = 0;
  activeFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality) {
      const qualityEffect = config.effects.quality;
      let qualityImpact = 0;
      
      if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount * feature.severity;
      } else if (qualityEffect.type === 'power') {
        const penaltyFactor = Math.pow(feature.severity, qualityEffect.exponent!);
        qualityImpact = -qualityEffect.basePenalty! * (1 + penaltyFactor);
      } else if (qualityEffect.type === 'bonus') {
        qualityImpact = typeof qualityEffect.amount === 'function' 
          ? qualityEffect.amount(feature.severity)
          : qualityEffect.amount || 0;
      }
      
      totalQualityEffect += qualityImpact;
    }
  });
  
  if (Object.keys(combinedEffects).length === 0 && Math.abs(totalQualityEffect) < 0.001) return null;
  
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600">Effects:</div>
      <div className="flex flex-wrap gap-1">
        {/* Characteristic effects */}
        {Object.entries(combinedEffects).map(([characteristic, totalEffect]) => {
          if (Math.abs(totalEffect) > 0.001) {
            const percentage = (totalEffect * 100).toFixed(0);
            const isPositive = totalEffect > 0;
            const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
            const sign = isPositive ? '+' : '';
            
            return (
              <TooltipProvider key={characteristic}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs px-1.5 py-0.5 rounded bg-gray-100 ${colorClass} flex items-center gap-1 cursor-help`}>
                      <img src={`/assets/icons/characteristics/${characteristic}.png`} alt={`${characteristic} icon`} className="w-3 h-3 opacity-80" />
                      <span>{characteristic}: {sign}{percentage}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold capitalize">{characteristic}</p>
                      <div className="space-y-1">
                        {getCombinedCharacteristicBreakdown(characteristic, activeFeatures)}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return null;
        })}
        
        {/* Quality effect */}
        {Math.abs(totalQualityEffect) > 0.001 && (
          <TooltipProvider key="quality">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`text-xs px-1.5 py-0.5 rounded ${totalQualityEffect > 0 ? 'bg-green-100' : 'bg-red-100'} ${totalQualityEffect > 0 ? 'text-green-600' : 'text-red-600'} flex items-center gap-1 cursor-help`}>
                  <span>⭐</span>
                  <span>Quality {totalQualityEffect > 0 ? '+' : ''}{Math.round(totalQualityEffect * 100)}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Quality Impact</p>
                  <div className="space-y-1">
                    {getCombinedQualityBreakdown(activeFeatures)}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// Helper functions for tooltip breakdowns
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

function getCombinedCharacteristicBreakdown(characteristic: string, activeFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  activeFeatures.forEach(({ feature, config }) => {
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

function getCombinedQualityBreakdown(activeFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  activeFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality) {
      const qualityEffect = config.effects.quality;
      let qualityImpact = 0;
      let impactText = '';
      
      if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount * feature.severity;
        const impactPercent = (qualityImpact * 100).toFixed(1);
        impactText = `${qualityImpact >= 0 ? '+' : ''}${impactPercent}%`;
      } else if (qualityEffect.type === 'power') {
        const penaltyFactor = Math.pow(feature.severity, qualityEffect.exponent!);
        qualityImpact = -qualityEffect.basePenalty! * (1 + penaltyFactor);
        impactText = `${(qualityImpact * 100).toFixed(1)}%`;
      } else if (qualityEffect.type === 'bonus') {
        qualityImpact = typeof qualityEffect.amount === 'function' 
          ? qualityEffect.amount(feature.severity)
          : qualityEffect.amount || 0;
        impactText = `+${(qualityImpact * 100).toFixed(1)}%`;
      }
      
      if (Math.abs(qualityImpact) > 0.001) {
        contributions.push(
          <p key={config.id} className="text-gray-300">
            {config.name}: {impactText}
          </p>
        );
      }
    }
  });
  
  return contributions;
}

// Feature Badge Component (consolidated from FeatureBadge.tsx)
interface FeatureBadgeProps {
  feature: any;
  config: any;
  showSeverity?: boolean;
  className?: string;
}

// Map feature UI colors to ShadCN Badge variants
function getBadgeVariant(badgeColor: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (badgeColor) {
    case 'destructive':
      return 'destructive';
    case 'warning':
      return 'outline';
    case 'info':
      return 'secondary';
    case 'success':
      return 'default';
    default:
      return 'default';
  }
}

// Generate tooltip content for feature badges
function getFeatureTooltipContent(feature: any, config: any): string {
  if (config.manifestation === 'graduated' && feature.severity > 0) {
    const severityPercent = Math.round(feature.severity * 100);
    
    if (config.id === 'terroir') {
      return `Terroir Expression: ${severityPercent}% developed\n\nThis represents how much vineyard character has developed in this wine:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Early development - subtle characteristics emerging' : severityPercent < 50 ? 'Moderate development - noticeable vineyard influence' : severityPercent < 75 ? 'Strong development - pronounced terroir' : 'Full development - maximum vineyard character'}\n\nTerroir grows over time and affects grape quality and characteristics.`;
    } else if (config.id === 'oxidation') {
      return `Oxidation: ${severityPercent}% developed\n\nThis shows how oxidized the wine has become:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Minor oxidation - barely noticeable' : severityPercent < 50 ? 'Moderate oxidation - some off-flavors' : severityPercent < 75 ? 'Significant oxidation - clearly affected' : 'Severe oxidation - wine may be undrinkable'}\n\nOxidation reduces grape quality and can make it unsellable.`;
    } else if (config.id === 'green_flavor') {
      return `Green Flavor: ${severityPercent}% severity\n\nThis indicates the intensity of green, unripe flavors:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Subtle green notes' : severityPercent < 50 ? 'Noticeable unripe character' : severityPercent < 75 ? 'Strong green flavors' : 'Severe green, harsh taste'}\n\nGreen flavors reduce grape quality and marketability.`;
    } else if (config.id === 'bottle_aging') {
      return `Bottle Aging: ${severityPercent}% developed\n\nThis shows how much complexity and smoothness has developed through aging:\n• ${severityPercent}% = ${severityPercent < 25 ? 'Early development - subtle complexity emerging' : severityPercent < 50 ? 'Moderate aging - noticeable smoothness' : severityPercent < 75 ? 'Well-aged - pronounced complexity' : 'Fully matured - maximum aging benefits'}\n\nAging improves grape quality, characteristics, and increases value.`;
    }
    
    // Generic graduated feature tooltip
    return `${config.name}: ${severityPercent}% severity\n\nThis feature develops over time and affects wine characteristics.`;
  }
  
  // Binary feature tooltip
  return `${config.name}\n\n${config.description}`;
}

function FeatureBadge({ feature, config, showSeverity = false, className }: FeatureBadgeProps) {
  if (!feature.isPresent) return null;
  
  const variant = getBadgeVariant(config.ui.badgeColor);
  const colorClass = config.ui.badgeColor === 'success' ? 'bg-green-100 text-green-800' : '';
  const tooltipContent = getFeatureTooltipContent(feature, config);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`gap-1 cursor-help ${colorClass} ${className || ''}`}>
            <span>{config.icon}</span>
            <span>{config.name}</span>
            {showSeverity && config.manifestation === 'graduated' && feature.severity > 0 && (
              <span className="text-xs opacity-90">
                {Math.round(feature.severity * 100)}%
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs whitespace-pre-line">
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}