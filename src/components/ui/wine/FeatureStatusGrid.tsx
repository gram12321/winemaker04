// Feature Status Grid Component
// Unified display for wine features in batch cards with evolution patterns and impact previews

import React from 'react';
import { WineBatch } from '@/lib/types/types';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures';
import { getColorClass } from '@/lib/utils/utils';
import { getRiskSeverityLabel } from '@/lib/services/wine/featureRiskHelper';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';

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
      
      // Show if:
      // 1. Feature is present (manifested)
      // 2. Feature has risk > 5% (time-based)
      // 3. Feature has event triggers (event-triggered)
      // 4. Feature is time-based and should be visible (always show time-based features)
      const shouldShow = feature?.isPresent || 
                        (feature && feature.risk > 0.05) ||
                        config.riskAccumulation.trigger === 'event_triggered' ||
                        config.riskAccumulation.trigger === 'time_based';
      
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
        config
      };
    })
    .filter(Boolean) as Array<{ feature: any; config: any }>;
  
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
        {relevantFeatures.map(({ feature, config }) => (
          <FeatureStatusItem
            key={feature.id}
            feature={feature}
            config={config}
            batch={batch}
            showImpact={showImpact}
            showEvolution={showEvolution}
          />
        ))}
      </div>
      
      {/* Effects Section - Show badges for manifested features */}
      {manifestedFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Effects:</div>
          <div className="flex flex-wrap gap-1">
            {manifestedFeatures.map(({ feature, config }) => (
              <FeatureEffectsBadges
                key={`effects-${feature.id}`}
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

interface FeatureStatusItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  showImpact?: boolean;
  showEvolution?: boolean;
}

function FeatureStatusItem({ 
  feature, 
  config, 
  batch, 
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
  } else if (config.riskAccumulation.trigger === 'time_based') {
    // Time-based risk
    const riskPercent = (risk * 100).toFixed(1);
    const evolutionIcon = showEvolution ? ' ↗️' : '';
    displayText = `${riskPercent}% risk${evolutionIcon}`;
    colorClass = getColorClass(1 - risk);
    icon = '⚠️';
  } else {
    // Event-triggered risk
    const riskPercent = (risk * 100).toFixed(1);
    displayText = risk > 0 ? `${riskPercent}% event risk` : 'Low risk';
    
    if (risk > 0) {
      colorClass = getColorClass(1 - risk);
      icon = '⚠️';
    } else {
      colorClass = 'text-gray-500';
      icon = '✅';
    }
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
                      {config.effects.characteristics.map((effect: any) => (
                        <p key={effect.characteristic}>
                          • {effect.characteristic}: {effect.modifier > 0 ? '+' : ''}{(effect.modifier * 100).toFixed(0)}%
                        </p>
                      ))}
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
                    
                    {config.riskAccumulation.stateMultipliers && (
                      <>
                        <p className="text-xs text-gray-300">
                          Current state: <span className="font-medium">{batch.state}</span>
                        </p>
                        <p className="text-xs text-gray-300">
                          State multiplier: {config.riskAccumulation.stateMultipliers[batch.state as keyof typeof config.riskAccumulation.stateMultipliers] || 1.0}x
                        </p>
                        
                        <p className="font-medium mt-1">Calculation:</p>
                        <p className="text-xs text-gray-300 font-mono">
                          Base rate: {(config.riskAccumulation.baseRate! * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-300 font-mono">
                          × State multiplier: {config.riskAccumulation.stateMultipliers[batch.state as keyof typeof config.riskAccumulation.stateMultipliers] || 1.0}x
                        </p>
                        {config.riskAccumulation.compoundEffect && (
                          <p className="text-xs text-gray-300 font-mono">
                            × (1 + current risk): {(1 + risk).toFixed(3)}x
                          </p>
                        )}
                        <p className="text-xs text-gray-300 font-mono font-medium">
                          = {((config.riskAccumulation.baseRate! * (config.riskAccumulation.stateMultipliers[batch.state as keyof typeof config.riskAccumulation.stateMultipliers] || 1.0) * (config.riskAccumulation.compoundEffect ? (1 + risk) : 1)) * 100).toFixed(2)}% per week
                        </p>
                      </>
                    )}
                  </div>
                )}
                
                {/* Event-triggered with trigger details */}
                {config.riskAccumulation.trigger === 'event_triggered' && (
                  <div className="mt-2">
                    <p className="font-medium">Event-triggered</p>
                    <p className="text-xs text-gray-300">
                      Risk occurs during specific production events
                    </p>
                    
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

// Component to display effect badges for manifested features
function FeatureEffectsBadges({ feature, config, batch }: FeatureEffectsBadgesProps) {
  if (!feature.isPresent || !config.effects) return null;
  
  const badges: React.JSX.Element[] = [];
  
  // Add characteristic effect badges
  if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
    config.effects.characteristics.forEach(({ characteristic, modifier }: { characteristic: string; modifier: number }) => {
      if (typeof modifier === 'number' && modifier !== 0) {
        const percentage = (modifier * 100).toFixed(0);
        const isPositive = modifier > 0;
        const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
        const sign = isPositive ? '+' : '';
        
        badges.push(
          <div key={characteristic} className={`text-xs px-1.5 py-0.5 rounded bg-gray-100 ${colorClass} flex items-center gap-1`}>
            <img src={`/assets/icons/characteristics/${characteristic}.png`} alt={`${characteristic} icon`} className="w-3 h-3 opacity-80" />
            <span>{characteristic}: {sign}{percentage}%</span>
          </div>
        );
      }
    });
  }
  
  // Add quality effect badge
  if (config.effects.quality) {
    const qualityEffect = config.effects.quality;
    let qualityImpact = '';
    
    if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
      const impact = Math.abs(qualityEffect.amount * feature.severity * 100);
      qualityImpact = `-${impact.toFixed(0)}%`;
    } else if (qualityEffect.type === 'power') {
      const penaltyFactor = Math.pow(batch.quality, qualityEffect.exponent!);
      const scaledPenalty = qualityEffect.basePenalty! * (1 + penaltyFactor);
      qualityImpact = `-${(scaledPenalty * 100).toFixed(0)}%`;
    }
    
    if (qualityImpact) {
      badges.push(
        <div key="quality" className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex items-center gap-1">
          <span>⭐</span>
          <span>Quality {qualityImpact}</span>
        </div>
      );
    }
  }
  
  return <>{badges}</>;
}

interface FeatureEffectsBadgesProps {
  feature: any;
  config: any;
  batch: any;
}
