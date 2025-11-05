// Unified Feature Display Component
// Consolidated display for wine features with multiple sections:
// 1. Evolving Features: Actively changing features with weekly effects
// 2. Active Features: Features currently affecting the wine (severity > 0)
// 3. Risks: Upcoming dangers (risk > 0)
// 4. Preview Risks: Potential risks for upcoming actions (vineyard/winery contexts)
// 
// This component consolidates functionality from:
// - WineryFeatureStatusGrid
// - WineryEvolvingFeaturesDisplay  
// - WineryFeatureRiskDisplay
// - FeatureBadge
// - FeatureRiskDisplay

import React from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { formatNumber, getRangeColor, getRatingForRange, getCharacteristicEffectColorInfo, getCharacteristicEffectColorClass } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, TooltipSection, TooltipRow, TooltipScrollableContent, tooltipStyles, MobileDialogWrapper } from '../shadCN/tooltip';
import { Badge } from '../shadCN/badge';
import { getFeatureDisplayData, FeatureRiskDisplayData, FeatureRiskContext, getFeatureRisksForDisplay, getRiskSeverityLabel, getRiskColorClass, getNextWineryAction, getFeatureDisplaySeverity } from '@/lib/services/wine/features/featureService';

interface FeatureDisplayProps {
  batch?: WineBatch;
  vineyard?: Vineyard;
  className?: string;
  showEvolving?: boolean;
  showActive?: boolean;
  showRisks?: boolean;
  showPreviewRisks?: boolean; // Show preview risks for upcoming actions
  showForNextAction?: boolean; // Show only next action risks
  expanded?: boolean; // For WineModal vs Winery display
  displayMode?: 'detailed' | 'badges'; // New prop for badge display
  compact?: boolean; // Compact mode for preview risks
}

/**
 * Unified display for wine features with multiple sections:
 * - Evolving Features: Actively changing features with weekly effects
 * - Active Features: Features currently affecting the wine
 * - Risks: Upcoming dangers
 * - Preview Risks: Potential risks for upcoming actions
 */
export function FeatureDisplay({ 
  batch, 
  vineyard,
  className = '', 
  showEvolving = true,
  showActive = true,
  showRisks = true,
  showPreviewRisks = false,
  showForNextAction = false,
  displayMode = 'detailed',
  compact = false
}: FeatureDisplayProps) {
  // Preview risk mode (vineyard or winery preview)
  if (showPreviewRisks && (vineyard || batch)) {
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

    const featureData = getFeatureRisksForDisplay(context);
    
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

        {featureData.features.length > 0 && (
          <div className="space-y-1">
            {featureData.features.map((feature) => (
              <PreviewRiskFeatureItem
                key={feature.featureId}
                feature={feature}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular batch feature display mode
  if (!batch) return null;

  const displayData = getFeatureDisplayData(batch);

  // Badge display mode
  if (displayMode === 'badges') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {displayData.activeFeatures.map(({ feature, config }) => (
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
      {showEvolving && displayData.evolvingFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Evolving Features:</div>
          <div className="space-y-1">
            {displayData.evolvingFeatures.map(({ feature, config, weeklyGrowthRate }) => (
              <EvolvingFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch}
                weeklyGrowthRate={weeklyGrowthRate}
              />
            ))}
          </div>
          
          {/* Weekly Effects Display */}
          <WeeklyEffectsDisplay 
            combinedWeeklyEffects={displayData.combinedWeeklyEffects}
            evolvingFeatures={displayData.evolvingFeatures}
            batch={batch}
          />
        </div>
      )}

      {/* Active Features Section */}
      {showActive && displayData.activeFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Features:</div>
          <div className="space-y-1">
            {displayData.activeFeatures.map(({ feature, config, qualityImpact, characteristicEffects }) => (
              <ActiveFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                qualityImpact={qualityImpact}
                characteristicEffects={characteristicEffects}
                batch={batch}
              />
            ))}
          </div>
          
          {/* Combined Effects Display */}
          <CombinedEffectsDisplay 
            combinedActiveEffects={displayData.combinedActiveEffects}
            totalQualityEffect={displayData.totalQualityEffect}
            activeFeatures={displayData.activeFeatures}
            batch={batch}
          />
        </div>
      )}

      {/* Risks Section */}
      {showRisks && displayData.riskFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-800">Risks:</div>
          <div className="space-y-1">
            {displayData.riskFeatures.map(({ feature, config, expectedWeeks }) => (
              <RiskFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch}
                expectedWeeks={expectedWeeks}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== EVOLVING FEATURE COMPONENT =====

interface EvolvingFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  weeklyGrowthRate: number;
}

function EvolvingFeatureItem({ feature, config, batch, weeklyGrowthRate }: EvolvingFeatureItemProps) {
  // Use getFeatureDisplaySeverity for bottle_aging to ensure it syncs with agingProgress
  const severity = config.id === 'bottle_aging' 
    ? (getFeatureDisplaySeverity(batch, 'bottle_aging') || 0)
    : (feature.severity || 0);
  const severityPercent = formatNumber(severity * 100, { smartDecimals: true });
  const weeklyGrowthPercent = formatNumber(weeklyGrowthRate * 100, { smartDecimals: true });
  
  // Use intelligent color coding for severity
  const growthColorClass = getRangeColor(weeklyGrowthRate, 0, 0.05, 'higher_better').text; // 0-5% weekly growth range
  
  const displayElement = (
    <div className="flex items-center bg-green-100 px-2 py-1 rounded text-xs cursor-help">
      <span className="mr-1">{config.icon}</span>
      <span className="font-medium text-green-700">
        {config.name}: {severityPercent}%
      </span>
      <span className={`ml-1 ${growthColorClass}`}>
        (+{weeklyGrowthPercent}%/week)
      </span>
    </div>
  );
  
  const tooltipBody = (
    <div className={`${tooltipStyles.text} space-y-2`}>
      <TooltipSection>
        <p className={tooltipStyles.title}>{config.name}</p>
        <p className={tooltipStyles.muted}>{config.description}</p>
      </TooltipSection>
      <TooltipSection title="Current Status">
        <TooltipRow 
          label="Severity" 
          value={`${severityPercent}% (${formatNumber(severity, { smartDecimals: true })})`} 
          valueRating={getRatingForRange(severity, 0, 1, 'higher_better')}
          monospaced={true} 
        />
        <TooltipRow 
          label="Weekly growth" 
          value={`+${weeklyGrowthPercent}% per week`} 
          valueRating={getRatingForRange(weeklyGrowthRate, 0, 0.1, 'higher_better')}
          monospaced={true} 
        />
      </TooltipSection>
      <TooltipSection title="State Effects">
        <div className={`${tooltipStyles.text} ${tooltipStyles.muted}`}>Current state: <span className={tooltipStyles.subtitle}>{batch.state}</span></div>
        <TooltipRow 
          label="Weekly growth" 
          value={`+${weeklyGrowthPercent}% per week`} 
          valueRating={getRatingForRange(weeklyGrowthRate, 0, 0.1, 'higher_better')}
          monospaced={true} 
        />
      </TooltipSection>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
          <MobileDialogWrapper content={tooltipBody} title={`${config.name} Details`} triggerClassName="inline-block">
            {displayElement}
          </MobileDialogWrapper>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact">
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ===== ACTIVE FEATURE COMPONENT =====

interface ActiveFeatureItemProps {
  feature: any;
  config: any;
  qualityImpact: number;
  characteristicEffects: Record<string, number>;
  batch?: WineBatch;
}

function ActiveFeatureItem({ feature, config, qualityImpact, batch }: ActiveFeatureItemProps & { batch?: WineBatch }) {
  // Use getFeatureDisplaySeverity for bottle_aging to ensure consistency
  const severity = config.id === 'bottle_aging' && batch
    ? (getFeatureDisplaySeverity(batch, 'bottle_aging') || 0)
    : (feature.severity || 0);
  const severityPercent = formatNumber(severity * 100, { smartDecimals: true });
  
  // Use intelligent color coding based on feature type and severity
  let colorClass: string;
  if (config.badgeColor === 'destructive') {
    // For destructive features, higher severity = worse (redder)
    colorClass = getRangeColor(1 - severity, 0, 1, 'higher_better').text;
  } else if (config.badgeColor === 'success') {
    // For success features, higher severity = better (greener)
    colorClass = getRangeColor(severity, 0, 1, 'higher_better').text;
  } else if (config.badgeColor === 'warning') {
    // For warning features, use amber colors
    colorClass = getRangeColor(severity, 0, 1, 'higher_better').text;
  } else {
    // Default to blue for info features
    colorClass = getRangeColor(severity, 0, 1, 'higher_better').text;
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{config.icon} {config.name}:</span>{' '}
      <span className={colorClass}>
        {config.name} ({severityPercent}%)
      </span>
    </div>
  );
  
  const tooltipBody = (
    <div className={`${tooltipStyles.text} space-y-2`}>
      <TooltipSection>
        <p className={tooltipStyles.title}>{config.name}</p>
        <p className={tooltipStyles.muted}>{config.description}</p>
      </TooltipSection>
      <TooltipSection>
        <p className={tooltipStyles.subtitle}>{config.name} is present</p>
        <p>This batch has {config.name.toLowerCase()}.</p>
        {config.behavior === 'evolving' && (
          <TooltipRow label="Severity" value={`${formatNumber(feature.severity * 100, { smartDecimals: true })}%`} monospaced={true} />
        )}
      </TooltipSection>
      {Math.abs(qualityImpact) > 0.001 && (
        <TooltipSection title="Quality Impact">
          <TooltipRow 
            label="Quality change" 
            value={`${qualityImpact < 0 ? '-' : '+'}${formatNumber(Math.abs(qualityImpact * 100), { smartDecimals: true })}%`}
            valueRating={getRatingForRange(qualityImpact, -0.5, 0.5, 'higher_better')}
            monospaced={true}
          />
        </TooltipSection>
      )}
      {config.effects.characteristics && config.effects.characteristics.length > 0 && (
        <TooltipSection title="Effects">
          <div className={`${tooltipStyles.text} ${tooltipStyles.muted} space-y-1`}>
            {config.effects.characteristics.map((effect: any) => {
              const modifier = typeof effect.modifier === 'function' 
                ? effect.modifier(feature.severity) 
                : effect.modifier;
              const modifierPercent = formatNumber((modifier || 0) * 100, { smartDecimals: true });
              return (
                <p key={effect.characteristic}>
                  • {effect.characteristic}: {modifier > 0 ? '+' : ''}{modifierPercent}%
                </p>
              );
            })}
          </div>
        </TooltipSection>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
          <MobileDialogWrapper content={tooltipBody} title={`${config.name} Details`} triggerClassName="inline-block">
            <div className="cursor-help">
              {displayElement}
            </div>
          </MobileDialogWrapper>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact">
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ===== RISK FEATURE COMPONENT =====

interface RiskFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  expectedWeeks?: number;
}

function RiskFeatureItem({ feature, config, batch, expectedWeeks }: RiskFeatureItemProps) {
  const risk = feature.risk || 0;
  const riskPercent = formatNumber(risk * 100, { smartDecimals: true });
  
  // Use intelligent color coding for risk (lower risk = better colors)
  const riskColorClass = getRangeColor(1 - risk, 0, 1, 'higher_better').text;
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{config.icon} {config.name}:</span>{' '}
      <span className={riskColorClass}>
        {riskPercent}% risk
      </span>
      {expectedWeeks !== undefined && expectedWeeks < 50 && (
        <span className="text-gray-400 ml-1">(~{expectedWeeks} weeks)</span>
      )}
    </div>
  );
  
  const tooltipBody = (
    <div className={`${tooltipStyles.text} space-y-2`}>
      <TooltipSection>
        <p className={tooltipStyles.title}>{config.name}</p>
        <p className={tooltipStyles.muted}>{config.description}</p>
      </TooltipSection>
      <TooltipSection>
        <TooltipRow 
          label={`${config.name} Risk`} 
          value={`${riskPercent}%`}
          valueRating={getRatingForRange(1 - risk, 0, 1, 'higher_better')}
          monospaced={true}
        />
        <p className={tooltipStyles.muted}>Chance this batch develops {config.name.toLowerCase()}.</p>
        {expectedWeeks !== undefined && expectedWeeks < 50 && (
          <div className={`${tooltipStyles.warning} mt-1`}>Expected ~{expectedWeeks} weeks (statistical average)</div>
        )}
        <p className="mt-2">
          <span className={tooltipStyles.muted}>Current state:</span> <span className={tooltipStyles.subtitle}>{batch.state}</span>
        </p>
      </TooltipSection>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
          <MobileDialogWrapper content={tooltipBody} title={`${config.name} Risk Details`} triggerClassName="inline-block">
            <div className="cursor-help">
              {displayElement}
            </div>
          </MobileDialogWrapper>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact">
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ===== EFFECTS DISPLAY COMPONENTS =====

interface WeeklyEffectsDisplayProps {
  combinedWeeklyEffects: Record<string, number>;
  evolvingFeatures: Array<{ feature: any; config: any; weeklyEffects: Record<string, number> }>;
  batch: WineBatch; // Need batch for current characteristic values
}

function WeeklyEffectsDisplay({ combinedWeeklyEffects, evolvingFeatures, batch }: WeeklyEffectsDisplayProps) {
  if (Object.keys(combinedWeeklyEffects).length === 0) return null;
  
  const displayData = getFeatureDisplayData(batch);
  const effectiveCharacteristics: Record<string, number> = { ...batch.characteristics };
  
  Object.entries(displayData.combinedActiveEffects).forEach(([char, effect]) => {
    if (effect !== undefined && effect !== null && !isNaN(effect)) {
      effectiveCharacteristics[char] = (effectiveCharacteristics[char] || 0) + effect;
    }
  });
  
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600">Weekly Effects:</div>
      <div className="flex flex-wrap gap-1">
        {Object.entries(combinedWeeklyEffects).map(([key, totalEffect]) => {
          // Lower threshold for weekly effects (0.01% = 0.0001) to show small incremental changes
          if (Math.abs(totalEffect) > 0.0001) {
            const percentage = formatNumber(totalEffect * 100, { smartDecimals: true });
            const sign = totalEffect > 0 ? '+' : '';
            
            // Special handling for quality vs characteristics
            const isQuality = key === 'quality';
            
            // For quality: positive = good (green), negative = bad (red)
            // For characteristics: use balance-aware coloring
            let bgClass: string;
            let colorClass: string;
            
            if (isQuality) {
              bgClass = totalEffect > 0 ? 'bg-green-100' : 'bg-red-100';
              // Use intensity based on absolute value for quality
              colorClass = getRangeColor(totalEffect, -0.5, 0.5, 'higher_better').text;
            } else {
              // Characteristic: determine if moving towards balance
              // Use effective current value (base + active effects) for accurate evaluation
              // Ensure we always use the calculated effective value, not fallback to base
              const baseValue = batch.characteristics[key as keyof typeof batch.characteristics] || 0;
              const activeEffect = displayData.combinedActiveEffects[key] || 0;
              const currentValue = effectiveCharacteristics[key] ?? (baseValue + activeEffect);
              const balancedRange = BASE_BALANCED_RANGES[key as keyof typeof BASE_BALANCED_RANGES];
              const colorInfo = getCharacteristicEffectColorInfo(currentValue, totalEffect, balancedRange);
              bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
              colorClass = getCharacteristicEffectColorClass(currentValue, totalEffect, balancedRange);
            }
            
            return (
              <TooltipProvider key={key}>
                <Tooltip>
                  <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
                    <MobileDialogWrapper
                      content={
                        <div className={`${tooltipStyles.text} space-y-1`}>
                          <TooltipSection>
                            <p className={`${tooltipStyles.title} capitalize`}>{isQuality ? 'Quality' : key}</p>
                            {isQuality ? (
                              <p className={tooltipStyles.muted}>Weekly quality change from evolving features</p>
                            ) : (
                              <TooltipScrollableContent maxHeight="max-h-60">
                                <div className="space-y-1">
                                  {getCharacteristicBreakdown(key, evolvingFeatures)}
                                </div>
                              </TooltipScrollableContent>
                            )}
                          </TooltipSection>
                        </div>
                      }
                      title={`${isQuality ? 'Quality' : key.charAt(0).toUpperCase() + key.slice(1)} Effects`}
                      triggerClassName="inline-block"
                    >
                      <div className={`text-xs px-2 py-1 rounded ${bgClass} ${colorClass} flex items-center gap-1 cursor-help`}>
                        {isQuality ? (
                          <span>⭐</span>
                        ) : (
                          <img src={`/assets/icons/characteristics/${key}.png`} alt={`${key} icon`} className="w-3 h-3" />
                        )}
                        <span className="font-medium">{sign}{percentage}%</span>
                      </div>
                    </MobileDialogWrapper>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs" variant="panel" density="compact">
                    <div className={`${tooltipStyles.text} space-y-1`}>
                      <TooltipSection>
                        <p className={`${tooltipStyles.title} capitalize`}>{isQuality ? 'Quality' : key}</p>
                        {isQuality ? (
                          <p className={tooltipStyles.muted}>Weekly quality change from evolving features</p>
                        ) : (
                          <TooltipScrollableContent maxHeight="max-h-60">
                            <div className="space-y-1">
                              {getCharacteristicBreakdown(key, evolvingFeatures)}
                            </div>
                          </TooltipScrollableContent>
                        )}
                      </TooltipSection>
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
  combinedActiveEffects: Record<string, number>;
  totalQualityEffect: number;
  activeFeatures: Array<{ feature: any; config: any; qualityImpact: number; characteristicEffects: Record<string, number> }>;
  batch: WineBatch; // Need batch for current characteristic values
}

function CombinedEffectsDisplay({ combinedActiveEffects, totalQualityEffect, activeFeatures, batch }: CombinedEffectsDisplayProps) {
  if (Object.keys(combinedActiveEffects).length === 0 && Math.abs(totalQualityEffect) < 0.001) return null;
  
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600">Effects:</div>
      <div className="flex flex-wrap gap-1">
        {/* Characteristic effects */}
        {Object.entries(combinedActiveEffects).map(([characteristic, totalEffect]) => {
          if (Math.abs(totalEffect) > 0.001) {
            const percentage = formatNumber(totalEffect * 100, { smartDecimals: true });
            const sign = totalEffect > 0 ? '+' : '';
            
            // Use balance-aware color coding for characteristic effects
            // For combined effects, we need to evaluate against the base value (before active effects)
            // because combinedActiveEffects represents the total change from base
            const currentValue = batch.characteristics[characteristic as keyof typeof batch.characteristics] || 0;
            const balancedRange = BASE_BALANCED_RANGES[characteristic as keyof typeof BASE_BALANCED_RANGES];
            const colorInfo = getCharacteristicEffectColorInfo(currentValue, totalEffect, balancedRange);
            const colorClass = getCharacteristicEffectColorClass(currentValue, totalEffect, balancedRange);
            const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
            
            return (
              <TooltipProvider key={characteristic}>
                <Tooltip>
                  <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
                    <MobileDialogWrapper
                      content={
                        <div className={`${tooltipStyles.text} space-y-1`}>
                          <TooltipSection>
                            <p className={`${tooltipStyles.title} capitalize`}>{characteristic}</p>
                            <TooltipScrollableContent maxHeight="max-h-60">
                              <div className="space-y-1">
                                {getCombinedCharacteristicBreakdown(characteristic, activeFeatures)}
                              </div>
                            </TooltipScrollableContent>
                          </TooltipSection>
                        </div>
                      }
                      title={`${characteristic.charAt(0).toUpperCase() + characteristic.slice(1)} Effects`}
                      triggerClassName="inline-block"
                    >
                      <div className={`text-xs px-1.5 py-0.5 rounded ${bgClass} ${colorClass} flex items-center gap-1 cursor-help`}>
                        <img src={`/assets/icons/characteristics/${characteristic}.png`} alt={`${characteristic} icon`} className="w-3 h-3 opacity-80" />
                        <span>{characteristic}: {sign}{percentage}%</span>
                      </div>
                    </MobileDialogWrapper>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs" variant="panel" density="compact">
                    <div className={`${tooltipStyles.text} space-y-1`}>
                      <TooltipSection>
                        <p className={`${tooltipStyles.title} capitalize`}>{characteristic}</p>
                        <TooltipScrollableContent maxHeight="max-h-60">
                          <div className="space-y-1">
                            {getCombinedCharacteristicBreakdown(characteristic, activeFeatures)}
                          </div>
                        </TooltipScrollableContent>
                      </TooltipSection>
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
              <TooltipTrigger asChild showMobileHint mobileHintVariant="underline">
                <MobileDialogWrapper
                  content={
                    <div className={`${tooltipStyles.text} space-y-1`}>
                      <TooltipSection>
                        <p className={tooltipStyles.title}>Quality Impact</p>
                        <div className="space-y-1">
                          {getCombinedQualityBreakdown(activeFeatures)}
                        </div>
                      </TooltipSection>
                    </div>
                  }
                  title="Quality Effects"
                  triggerClassName="inline-block"
                >
                  <div className={`text-xs px-1.5 py-0.5 rounded ${totalQualityEffect > 0 ? 'bg-green-100' : 'bg-red-100'} ${getRangeColor(totalQualityEffect, -0.5, 0.5, 'higher_better').text} flex items-center gap-1 cursor-help`}>
                    <span>⭐</span>
                    <span>Quality {totalQualityEffect > 0 ? '+' : ''}{formatNumber(totalQualityEffect * 100, { smartDecimals: true })}%</span>
                  </div>
                </MobileDialogWrapper>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs" variant="panel" density="compact">
                <div className={`${tooltipStyles.text} space-y-1`}>
                  <TooltipSection>
                    <p className={tooltipStyles.title}>Quality Impact</p>
                    <div className="space-y-1">
                      {getCombinedQualityBreakdown(activeFeatures)}
                    </div>
                  </TooltipSection>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// ===== UTILITY FUNCTIONS =====

function getCharacteristicBreakdown(characteristic: string, evolvingFeatures: Array<{ feature: any; config: any; weeklyEffects: Record<string, number> }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  evolvingFeatures.forEach(({ config, weeklyEffects }) => {
    const effectValue = weeklyEffects[characteristic];
    if (effectValue && Math.abs(effectValue) > 0.001) {
      const percentage = formatNumber(effectValue * 100, { smartDecimals: true });
      const sign = effectValue > 0 ? '+' : '';
      contributions.push(
        <p key={config.id} className="text-gray-300">
          {config.name}: {sign}{percentage}%
        </p>
      );
    }
  });
  
  return contributions;
}

function getCombinedCharacteristicBreakdown(characteristic: string, activeFeatures: Array<{ feature: any; config: any; characteristicEffects: Record<string, number> }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  activeFeatures.forEach(({ config, characteristicEffects }) => {
    const effectValue = characteristicEffects[characteristic];
    if (effectValue && Math.abs(effectValue) > 0.001) {
      const percentage = formatNumber(effectValue * 100, { smartDecimals: true });
      const sign = effectValue > 0 ? '+' : '';
      contributions.push(
        <p key={config.id} className="text-gray-300">
          {config.name}: {sign}{percentage}%
        </p>
      );
    }
  });
  
  return contributions;
}

function getCombinedQualityBreakdown(activeFeatures: Array<{ feature: any; config: any; qualityImpact: number }>): React.ReactNode[] {
  const contributions: React.ReactNode[] = [];
  
  activeFeatures.forEach(({ config, qualityImpact }) => {
    if (Math.abs(qualityImpact) > 0.001) {
      const impactPercent = formatNumber(qualityImpact * 100, { smartDecimals: true });
      const impactText = `${qualityImpact >= 0 ? '+' : ''}${impactPercent}%`;
      
      contributions.push(
        <p key={config.id} className="text-gray-300">
          {config.name}: {impactText}
        </p>
      );
    }
  });
  
  return contributions;
}

// ===== FEATURE BADGE COMPONENT =====

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
  // Use custom tooltip from config if available
  if (config.tooltip && feature.severity > 0) {
    return config.tooltip(feature.severity);
  }
  
  // Fallback for evolving features with severity
  if (config.behavior === 'evolving' && feature.severity > 0) {
    const severityPercent = feature.severity * 100;
    const severityPercentFormatted = formatNumber(severityPercent, { smartDecimals: true });
    
    // Generic graduated feature tooltip
    return `${config.name}: ${severityPercentFormatted}% severity\n\nThis feature develops over time and affects wine characteristics.`;
  }
  
  // Binary feature tooltip
  return `${config.name}\n\n${config.description}`;
}

function FeatureBadge({ feature, config, showSeverity = false, className }: FeatureBadgeProps) {
  if (!feature.isPresent) return null;
  
  const variant = getBadgeVariant(config.badgeColor);
  const colorClass = config.badgeColor === 'success' ? 'bg-green-100 text-green-800' : '';
  const tooltipContent = getFeatureTooltipContent(feature, config);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`gap-1 cursor-help ${colorClass} ${className || ''}`}>
            <span>{config.icon}</span>
            <span>{config.name}</span>
            {showSeverity && config.behavior === 'evolving' && feature.severity > 0 && (
              <span className="text-xs opacity-90">
                {formatNumber(feature.severity * 100, { smartDecimals: true })}%
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

// ===== PREVIEW RISK COMPONENTS =====

interface PreviewRiskFeatureItemProps {
  feature: FeatureRiskDisplayData['features'][0];
}

function PreviewRiskFeatureItem({ feature }: PreviewRiskFeatureItemProps) {
  let displayText: string;
  let colorClass: string;
  let additionalInfo: React.ReactNode = null;
  
  if (feature.riskRanges && feature.riskRanges.length > 0) {
    const minRisk = feature.riskRanges[0].minRisk;
    const maxRisk = feature.riskRanges[0].maxRisk;
    const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
    const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}%`
      : `${minPercent}%-${maxPercent}%`;
    
    colorClass = getRangeColor(1 - maxRisk, 0, 1, 'higher_better').text; // Lower risk = better colors
  } else if (feature.riskCombinations && feature.riskCombinations.length > 0) {
    const risks = feature.riskCombinations.map((c: any) => c.risk);
    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    const minPercent = formatNumber(minRisk * 100, { smartDecimals: true });
    const maxPercent = formatNumber(maxRisk * 100, { smartDecimals: true });
    
    displayText = minRisk === maxRisk 
      ? `${maxPercent}%`
      : `${minPercent}%-${maxPercent}%`;
    
    colorClass = getRangeColor(1 - maxRisk, 0, 1, 'higher_better').text; // Lower risk = better colors
  } else if (feature.config?.behavior === 'accumulation') {
    const currentRiskPercent = formatNumber(feature.currentRisk * 100, { smartDecimals: true });
    
    if (feature.weeklyRiskIncrease !== undefined && feature.weeklyRiskIncrease > 0) {
      const weeklyIncreasePercent = formatNumber(feature.weeklyRiskIncrease * 100, { smartDecimals: true });
      const estimatedWeeks = Math.ceil((1.0 - feature.currentRisk) / feature.weeklyRiskIncrease);
      
      displayText = `${currentRiskPercent}% (+${weeklyIncreasePercent}%/week)`;
      colorClass = getRangeColor(1 - feature.currentRisk, 0, 1, 'higher_better').text; // Lower risk = better colors
      
      if (estimatedWeeks < 50) {
        additionalInfo = <span className="text-gray-400 ml-1">(~{estimatedWeeks} weeks)</span>;
      }
    } else {
      displayText = `${currentRiskPercent}%`;
      colorClass = getRangeColor(1 - feature.currentRisk, 0, 1, 'higher_better').text; // Lower risk = better colors
    }
  } else {
    const riskPercent = formatNumber(feature.newRisk * 100, { smartDecimals: true });
    displayText = `${riskPercent}%`;
    colorClass = getRangeColor(1 - feature.newRisk, 0, 1, 'higher_better').text; // Lower risk = better colors
  }
  
  const displayElement = (
    <div className="text-xs">
      <span className="font-medium">{feature.icon} {feature.featureName}:</span>{' '}
      <span className={colorClass}>{displayText}</span>
      {additionalInfo}
      {feature.contextInfo && <span className="text-gray-500"> {feature.contextInfo}</span>}
    </div>
  );
  
  return wrapPreviewWithTooltip(displayElement, feature);
}

function wrapPreviewWithTooltip(element: React.ReactNode, feature: PreviewRiskFeatureItemProps['feature']) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {element}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact">
          <PreviewRiskTooltipContent feature={feature} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PreviewRiskTooltipContent({ feature }: { feature: PreviewRiskFeatureItemProps['feature'] }) {
  const config = feature.config;
  
  return (
    <div className={`${tooltipStyles.text} space-y-2`}>
      {/* TEMP: Visual marker to verify new tooltip implementation */}
      <div>
        <p className={tooltipStyles.title}>{feature.featureName}</p>
        <p className={tooltipStyles.muted}>{feature.description}</p>
      </div>
      
      <div>
        <p className="font-medium">
          {feature.riskRanges && feature.riskRanges.length > 0 ? (
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
            `Risk: ${formatNumber(feature.newRisk * 100, { smartDecimals: true })}% (${getRiskSeverityLabel(feature.newRisk)})`
          )}
        </p>
        
          {feature.config?.behavior === 'accumulation' && feature.weeklyRiskIncrease !== undefined && feature.weeklyRiskIncrease > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className={`${tooltipStyles.subtitle} ${tooltipStyles.warning}`}>Cumulative Risk</p>
            <p className={`${tooltipStyles.muted} ${tooltipStyles.text}`}>
              Current risk: {formatNumber(feature.currentRisk * 100, { smartDecimals: true })}%
            </p>
            <p className={`${tooltipStyles.muted} ${tooltipStyles.text}`}>
              Weekly increase: +{formatNumber(feature.weeklyRiskIncrease * 100, { smartDecimals: true })}%
            </p>
            <p className={`${tooltipStyles.muted} ${tooltipStyles.text} mt-1`}>
              This risk accumulates over time. Each tick adds the calculated amount to your current risk level.
            </p>
            {feature.contextInfo && (
              <p className={`${tooltipStyles.text} text-gray-400 mt-1`}>
                {feature.contextInfo}
              </p>
            )}
          </div>
        )}

        {feature.qualityImpact && (
          <div className="border-t border-gray-600 pt-2">
            <p className={tooltipStyles.subtitle}>Quality Impact if Manifests</p>
            <p className={`${tooltipStyles.muted} ${tooltipStyles.text}`}>
              {feature.qualityImpact < 0 ? '-' : '+'}{formatNumber(Math.abs(feature.qualityImpact * 100), { smartDecimals: true })}% quality change
            </p>
          </div>
        )}
        
        {config?.effects?.characteristics && config.effects.characteristics.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <p className={tooltipStyles.subtitle}>Characteristic Effects:</p>
            <div className={`${tooltipStyles.text} ${tooltipStyles.muted} space-y-1`}>
              {config.effects.characteristics.map((effect: any) => {
                const baseModifier = typeof effect.modifier === 'function' 
                  ? effect.modifier(1.0)
                  : effect.modifier;
                
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
        
        {config?.effects?.prestige && (
          <div className="border-t border-gray-600 pt-2">
            <p className={tooltipStyles.subtitle}>Prestige Impact:</p>
            <div className={`${tooltipStyles.text} ${tooltipStyles.muted} space-y-1`}>
              {config.effects.prestige.onManifestation && (
                <div>
                  <p className={`${tooltipStyles.subtitle} ${tooltipStyles.warning}`}>On Manifestation:</p>
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
                  <p className={`${tooltipStyles.subtitle} ${tooltipStyles.warning}`}>On Sale:</p>
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
            <p className={tooltipStyles.subtitle}>Risk by Processing Options:</p>
            <div className="space-y-2">
              {feature.riskRanges.map((range: any, index: number) => (
                <div key={index} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`${tooltipStyles.muted} ${tooltipStyles.subtitle}`}>{range.groupLabel}</span>
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
            <p className={tooltipStyles.subtitle}>Risk by Processing Options:</p>
            <div className="space-y-1">
              {feature.riskCombinations.slice(0, 10).map((combination: any, index: number) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className={`${tooltipStyles.muted} truncate mr-2`}>{combination.label}</span>
                  <span className={`font-mono ${getRiskColorClass(combination.risk)}`}>
                    {formatNumber(combination.risk * 100, { smartDecimals: true })}%
                  </span>
                </div>
              ))}
              {feature.riskCombinations.length > 10 && (
                <div className={`${tooltipStyles.text} text-gray-400 italic`}>
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