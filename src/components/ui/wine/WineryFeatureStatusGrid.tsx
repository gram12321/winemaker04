// Feature Status Grid Component
// Unified display for wine features in batch cards with evolution patterns and impact previews

import React from 'react';
import { WineBatch } from '@/lib/types/types';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { getColorClass } from '@/lib/utils/utils';
import { getRiskSeverityLabel } from '@/lib/services/wine/features/featureRiskHelper';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';
import { inferRiskAccumulationStrategy } from '@/lib/types/wineFeatures';

interface FeatureStatusGridProps {
  batch: WineBatch;
  className?: string;
  showImpact?: boolean;
  showEvolution?: boolean;
}

/**
 * Display all relevant features for a wine batch in a compact grid format
 * Shows time-based risks, event-triggered risks, and present features
 */
export function FeatureStatusGrid({ 
  batch, 
  className = '', 
  showImpact = true,
  showEvolution = true 
}: FeatureStatusGridProps) {
  const configs = getAllFeatureConfigs();
  const features = batch.features || [];
  
  // Get all relevant features (time-based risks, event-triggered risks, present features)
  const relevantFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      const strategy = inferRiskAccumulationStrategy(config.riskAccumulation);
      
      // Determine if we should show this feature
      let shouldShow = false;
      
      if (feature?.isPresent) {
        // Always show manifested features
        shouldShow = true;
      } else if (strategy === 'independent') {
        // For independent features, only show if manifested (no risk display)
        // Historical event risks are not relevant once the event passes
        shouldShow = false;
      } else if (strategy === 'cumulative' || strategy === 'severity_growth') {
        // For cumulative/time-based features, show if they have significant risk
        shouldShow = (feature && feature.risk > 0.05) || config.riskAccumulation.trigger === 'time_based';
      }
      
      if (!shouldShow) return null;
      
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
    .filter(Boolean) as Array<{ feature: any; config: any; strategy: string }>;
  
  if (relevantFeatures.length === 0) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        <span className="font-medium">Features:</span> No active risks
      </div>
    );
  }
  
  // Get manifested features for effects display
  const manifestedFeatures = relevantFeatures.filter(({ feature }) => feature.isPresent);
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium text-gray-800">Features:</div>
      <div className="space-y-1">
        {relevantFeatures.map(({ feature, config, strategy }) => (
          <FeatureStatusItem
            key={feature.id}
            feature={feature}
            config={config}
            batch={batch}
            strategy={strategy}
            showImpact={showImpact}
            showEvolution={showEvolution}
          />
        ))}
      </div>
      
      {/* Effects Section - Show combined badges for all manifested features */}
      {manifestedFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Effects:</div>
          <div className="flex flex-wrap gap-1">
            <CombinedFeatureEffectsBadges 
              manifestedFeatures={manifestedFeatures}
              batch={batch}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface FeatureStatusItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  strategy: string;
  showImpact?: boolean;
  showEvolution?: boolean;
}

function FeatureStatusItem({ 
  feature, 
  config, 
  batch, 
  strategy,
  showImpact = true,
  showEvolution = true 
}: FeatureStatusItemProps) {
  const isPresent = feature.isPresent;
  const risk = feature.risk || 0;
  
  // Determine display style based on feature state
  let displayText = '';
  let colorClass = '';
  let icon = feature.icon;
  
  if (isPresent) {
    // Feature is manifested
    displayText = config.name;
    colorClass = config.type === 'fault' ? 'text-red-600' : 'text-green-600';
    icon = config.icon;
  } else if (strategy === 'independent') {
    // Independent features should not show risk once events have passed
    // This shouldn't happen due to filtering, but handle gracefully
    displayText = 'Event passed';
    colorClass = 'text-gray-500';
    icon = '✅';
  } else if (strategy === 'cumulative' || strategy === 'severity_growth') {
    // Time-based or cumulative risk
    const riskPercent = (risk * 100).toFixed(1);
    const evolutionIcon = showEvolution ? ' ↗️' : '';
    displayText = `${riskPercent}% risk${evolutionIcon}`;
    colorClass = getColorClass(1 - risk);
    icon = '⚠️';
  } else {
    // Fallback for unknown strategies
    displayText = 'Unknown risk';
    colorClass = 'text-gray-500';
    icon = '❓';
  }
  
  // Calculate impact preview
  let impactText = '';
  if (showImpact && config.effects.quality) {
    const qualityEffect = config.effects.quality;
    if (qualityEffect.type === 'linear') {
      const impact = Math.abs(qualityEffect.amount * 100);
      impactText = ` (-${impact}% quality if manifests)`;
    } else if (qualityEffect.type === 'power') {
      const impact = Math.abs(qualityEffect.basePenalty * 100);
      impactText = ` (-${impact}% quality if manifests)`;
    }
  }
  
  // Calculate expected manifestation time for time-based features
  let expectedText = '';
  if (showEvolution && !isPresent && config.riskAccumulation.trigger === 'time_based' && risk > 0) {
    const expectedWeeks = Math.ceil(1 / risk);
    if (expectedWeeks < 50) {
      expectedText = ` (~${expectedWeeks} weeks)`;
    }
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{icon} {config.name}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {impactText && <span className="text-gray-500">{impactText}</span>}
      {expectedText && <span className="text-gray-400">{expectedText}</span>}
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
            
            {isPresent ? (
              <div>
                <p className="font-medium text-red-600">{config.name} is present</p>
                <p>This batch has {config.name.toLowerCase()}.</p>
                {config.manifestation === 'graduated' && (
                  <p>Severity: {Math.round(feature.severity * 100)}%</p>
                )}
                
                {/* Characteristic effects - generic for all features */}
                {config.effects.characteristics && config.effects.characteristics.length > 0 && (
                  <div className="mt-2">
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
            ) : (
              <div>
                <p className="font-medium">
                  Risk: {(risk * 100).toFixed(1)}%
                  <span className="ml-2 text-xs opacity-80">({getRiskSeverityLabel(risk)})</span>
                </p>
                <p>Chance this batch develops {config.name.toLowerCase()}.</p>
                
                {/* Time-based accumulation with calculations */}
                {config.riskAccumulation.trigger === 'time_based' && (
                  <div className="mt-2">
                    <p className="font-medium">Time-based accumulation:</p>
                    <p className="text-xs text-gray-300">
                      Base rate: {(config.riskAccumulation.baseRate! * 100).toFixed(1)}% per week
                      {config.riskAccumulation.compoundEffect && ' (compound)'}
                    </p>
                    
                    {config.riskAccumulation.stateMultipliers && (() => {
                      const multiplierValue = config.riskAccumulation.stateMultipliers[batch.state as keyof typeof config.riskAccumulation.stateMultipliers];
                      const isFunction = typeof multiplierValue === 'function';
                      const actualValue = isFunction ? (multiplierValue as Function)(batch) : (multiplierValue || 1.0);
                      
                      return (
                        <>
                          <p className="text-xs text-gray-300">
                            Current state: <span className="font-medium">{batch.state}</span>
                          </p>
                          <p className="text-xs text-gray-300">
                            State multiplier: {actualValue.toFixed(2)}x
                            {isFunction && <span className="text-amber-300"> ⚙️</span>}
                          </p>
                          
                          {/* Show if activity-influenced with breakdown */}
                          {isFunction && (() => {
                            // Get base multiplier (call function without activity options)
                            const baseBatch = { ...batch };
                            if (batch.state === 'must_fermenting') {
                              delete (baseBatch as any).fermentationOptions;
                            }
                            const baseMultiplier = (multiplierValue as Function)(baseBatch);
                            const finalMultiplier = actualValue;
                            
                            // Calculate what's causing the difference
                            const ratio = finalMultiplier / baseMultiplier;
                            let explanation = '';
                            
                            if (batch.state === 'must_fermenting' && batch.fermentationOptions) {
                              const method = batch.fermentationOptions.method;
                              if (ratio < 1) {
                                explanation = `${method} reduces risk`;
                              } else if (ratio > 1) {
                                explanation = `${method} increases risk`;
                              } else {
                                explanation = `${method} has no effect`;
                              }
                            }
                            
                            return (
                              <div className="text-xs text-amber-300 bg-amber-900/20 p-2 rounded mt-1">
                                <p className="font-medium">⚙️ Activity-Influenced Multiplier:</p>
                                <p className="font-mono mt-1">
                                  Base: {baseMultiplier.toFixed(2)}x × {explanation}: {ratio.toFixed(2)}x = {finalMultiplier.toFixed(2)}x
                                </p>
                              </div>
                            );
                          })()}
                          
                          <p className="font-medium mt-1">Calculation:</p>
                          <p className="text-xs text-gray-300 font-mono">
                            Base rate: {(config.riskAccumulation.baseRate! * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-300 font-mono">
                            × State multiplier: {actualValue.toFixed(2)}x
                          </p>
                          {config.riskAccumulation.compoundEffect && (
                            <p className="text-xs text-gray-300 font-mono">
                              × (1 + current risk): {(1 + risk).toFixed(3)}x
                            </p>
                          )}
                          <p className="text-xs text-gray-300 font-mono font-medium">
                            = {((config.riskAccumulation.baseRate! * actualValue * (config.riskAccumulation.compoundEffect ? (1 + risk) : 1)) * 100).toFixed(2)}% per week
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                {/* Event-triggered with trigger details */}
                {config.riskAccumulation.trigger === 'event_triggered' && (
                  <div className="mt-2">
                    <p className="font-medium">Event-triggered</p>
                    <p className="text-xs text-gray-300">
                      Risk occurs during specific production events
                    </p>
                    
                    {strategy === 'independent' ? (
                      <>
                        <p className="font-medium mt-1">Independent Events:</p>
                        <p className="text-xs text-gray-300">
                          Each event is independent. Previous event risks are not relevant.
                        </p>
                        {feature.risk > 0 && (
                          <p className="text-xs text-gray-300">
                            Previous events did not manifest this feature.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Show historical risk if feature has accumulated risk */}
                        {feature.risk > 0 && (
                          <>
                            <p className="font-medium mt-1">Previous Events:</p>
                            <p className="text-xs text-gray-300 font-mono">
                              Accumulated risk: {(feature.risk * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-300">
                              (did not manifest yet)
                            </p>
                          </>
                        )}
                      </>
                    )}
                    
                    {/* Show available triggers */}
                    {config.riskAccumulation.eventTriggers && config.riskAccumulation.eventTriggers.length > 0 && (
                      <>
                        <p className="font-medium mt-1">Triggers:</p>
                        <div className="text-xs text-gray-300 space-y-1">
                          {config.riskAccumulation.eventTriggers.map((trigger: any, idx: number) => (
                            <p key={idx}>
                              • {trigger.event.charAt(0).toUpperCase() + trigger.event.slice(1)} event
                              {typeof trigger.riskIncrease === 'number' && ` (+${(trigger.riskIncrease * 100).toFixed(0)}% risk)`}
                            </p>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {showImpact && config.effects.quality && (
              <div className="border-t border-gray-600 pt-2">
                <p className="font-medium">Quality Impact:</p>
                {config.effects.quality.type === 'linear' && (
                  <p className="text-xs text-gray-300">
                    -{Math.abs(config.effects.quality.amount * 100)}% quality reduction
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


interface CombinedFeatureEffectsBadgesProps {
  manifestedFeatures: Array<{ feature: any; config: any }>;
  batch: WineBatch;
}

// Component to display combined effects from all manifested features
export function CombinedFeatureEffectsBadges({ manifestedFeatures, batch }: CombinedFeatureEffectsBadgesProps) {
  // Combine all characteristic effects from all manifested features
  const combinedEffects: Record<string, number> = {};
  
  manifestedFeatures.forEach(({ feature, config }) => {
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
      const percentage = (totalEffect * 100).toFixed(0);
      const isPositive = totalEffect > 0;
      const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
      const sign = isPositive ? '+' : '';
      
      badges.push(
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
                  {getCombinedCharacteristicBreakdown(characteristic, manifestedFeatures)}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  });
  
  // Add combined quality effect badge
  let totalQualityEffect = 0;
  manifestedFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality) {
      const qualityEffect = config.effects.quality;
      let qualityImpact = 0;
      
      if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount * feature.severity; // Don't use Math.abs() - preserve negative penalties
      } else if (qualityEffect.type === 'power') {
        const penaltyFactor = Math.pow(batch.grapeQuality, qualityEffect.exponent!);
        qualityImpact = -qualityEffect.basePenalty! * (1 + penaltyFactor); // Negative for penalties
      } else if (qualityEffect.type === 'bonus') {
        qualityImpact = typeof qualityEffect.amount === 'function' 
          ? qualityEffect.amount(feature.severity)
          : qualityEffect.amount || 0;
      }
      
      totalQualityEffect += qualityImpact;
    }
  });
  
  if (totalQualityEffect > 0.001) {
    const qualityPercentage = (totalQualityEffect * 100).toFixed(0);
    const isPositive = totalQualityEffect > 0;
    const bgClass = isPositive ? 'bg-green-100' : 'bg-red-100';
    const textClass = isPositive ? 'text-green-600' : 'text-red-600';
    const sign = isPositive ? '+' : '';
    
    badges.push(
      <TooltipProvider key="quality">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`text-xs px-1.5 py-0.5 rounded ${bgClass} ${textClass} flex items-center gap-1 cursor-help`}>
              <span>⭐</span>
              <span>Quality {sign}{qualityPercentage}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-semibold">Quality Impact</p>
              <div className="space-y-1">
                {getCombinedQualityBreakdown(manifestedFeatures)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return <>{badges}</>;
}

// Helper function to get characteristic breakdown for combined tooltips
function getCombinedCharacteristicBreakdown(characteristic: string, manifestedFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  manifestedFeatures.forEach(({ feature, config }) => {
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

// Helper function to get quality breakdown for combined tooltips
function getCombinedQualityBreakdown(manifestedFeatures: Array<{ feature: any; config: any }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  manifestedFeatures.forEach(({ feature, config }) => {
    if (config.effects.quality) {
      const qualityEffect = config.effects.quality;
      let qualityImpact = 0;
      let impactText = '';
      
      if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount * feature.severity; // Preserve negative penalties
        const impactPercent = (qualityImpact * 100).toFixed(1);
        impactText = `${qualityImpact >= 0 ? '+' : ''}${impactPercent}%`;
      } else if (qualityEffect.type === 'power') {
        const penaltyFactor = Math.pow(feature.severity, qualityEffect.exponent!);
        qualityImpact = -qualityEffect.basePenalty! * (1 + penaltyFactor); // Negative for penalties
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
