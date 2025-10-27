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
import { formatNumber } from '@/lib/utils/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadCN/tooltip';
import { Badge } from '../shadCN/badge';
import { getFeatureDisplayData, FeatureRiskDisplayData, FeatureRiskContext, getFeatureRisksForDisplay, getRiskSeverityLabel, getRiskColorClass, getNextWineryAction } from '@/lib/services/wine/features/featureService';

// ===== CORE INTERFACES =====

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

interface EvolvingFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  weeklyGrowthRate: number;
}

interface ActiveFeatureItemProps {
  feature: any;
  config: any;
  qualityImpact: number;
}

interface RiskFeatureItemProps {
  feature: any;
  config: any;
  batch: WineBatch;
  expectedWeeks?: number;
}

interface WeeklyEffectsDisplayProps {
  combinedWeeklyEffects: Record<string, number>;
  evolvingFeatures: Array<{ feature: any; config: any; weeklyEffects: Record<string, number> }>;
}

interface CombinedEffectsDisplayProps {
  combinedActiveEffects: Record<string, number>;
  totalQualityEffect: number;
  activeFeatures: Array<{ feature: any; config: any; qualityImpact: number }>;
}

interface FeatureBadgeProps {
  feature: any;
  config: any;
  showSeverity?: boolean;
  className?: string;
}

interface PreviewRiskFeatureItemProps {
  feature: any;
}

// ===== MAIN COMPONENT =====

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
  displayMode = 'detailed',
  compact = false
}: FeatureDisplayProps) {
  // Get feature display data
  const displayData = batch ? getFeatureDisplayData(batch) : null;
  
  // Get preview risks if needed
  let previewRisks: FeatureRiskDisplayData | null = null;
  if (showPreviewRisks && (batch || vineyard)) {
    const context: FeatureRiskContext = {
      type: batch ? 'winery' : 'vineyard',
      event: batch ? 'crushing' : 'harvest',
      batch,
      vineyard,
      nextAction: batch ? getNextWineryAction(batch) || undefined : undefined
    };
    previewRisks = getFeatureRisksForDisplay(context);
  }

  // Badge mode - simplified display
  if (displayMode === 'badges') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {displayData?.activeFeatures.map(({ feature, config }) => (
          <FeatureBadge 
            key={feature.id} 
            feature={feature} 
            config={config} 
            showSeverity={true}
          />
        ))}
        {displayData?.riskFeatures.map(({ feature, config }) => (
          <FeatureBadge 
            key={feature.id} 
            feature={feature} 
            config={config} 
            showSeverity={false}
          />
        ))}
      </div>
    );
  }

  // Detailed mode - full display
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Evolving Features */}
      {showEvolving && displayData?.evolvingFeatures && displayData.evolvingFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Evolving Features</h4>
          <div className="space-y-2">
            {displayData.evolvingFeatures.map(({ feature, config, weeklyGrowthRate }) => (
              <EvolvingFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch!}
                weeklyGrowthRate={weeklyGrowthRate}
              />
            ))}
          </div>
          {displayData && displayData.combinedWeeklyEffects && Object.keys(displayData.combinedWeeklyEffects).length > 0 && (
            <WeeklyEffectsDisplay
              combinedWeeklyEffects={displayData.combinedWeeklyEffects}
              evolvingFeatures={displayData.evolvingFeatures}
            />
          )}
        </div>
      )}

      {/* Active Features */}
      {showActive && displayData?.activeFeatures && displayData.activeFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Active Features</h4>
          <div className="space-y-2">
            {displayData.activeFeatures.map(({ feature, config, qualityImpact }) => (
              <ActiveFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                qualityImpact={qualityImpact}
              />
            ))}
          </div>
          {displayData && ((displayData.combinedActiveEffects && Object.keys(displayData.combinedActiveEffects).length > 0) || displayData.totalQualityEffect !== 0) ? (
            <CombinedEffectsDisplay
              combinedActiveEffects={displayData.combinedActiveEffects}
              totalQualityEffect={displayData.totalQualityEffect}
              activeFeatures={displayData.activeFeatures}
            />
          ) : null}
        </div>
      )}

      {/* Risk Features */}
      {showRisks && displayData?.riskFeatures && displayData.riskFeatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Risk Features</h4>
          <div className="space-y-2">
            {displayData.riskFeatures.map(({ feature, config, expectedWeeks }) => (
              <RiskFeatureItem
                key={feature.id}
                feature={feature}
                config={config}
                batch={batch!}
                expectedWeeks={expectedWeeks}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preview Risks */}
      {showPreviewRisks && previewRisks && previewRisks.features.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {previewRisks.showForNextAction 
              ? `Next Action Risks (${previewRisks.nextAction})`
              : 'Preview Risks'
            }
          </h4>
          <div className={`space-y-2 ${compact ? 'space-y-1' : ''}`}>
            {previewRisks.features.map((feature) => (
              <PreviewRiskFeatureItem
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

// ===== FEATURE ITEM COMPONENTS =====

function EvolvingFeatureItem({ feature, config, weeklyGrowthRate }: EvolvingFeatureItemProps) {
  const severityPercent = Math.round(feature.severity * 100);
  const growthPercent = Math.round(weeklyGrowthRate * 100);
  
  return (
    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <img src={config.icon} alt={config.name} className="w-6 h-6" />
        <div>
          <div className="font-medium text-blue-900">{config.name}</div>
          <div className="text-sm text-blue-700">
            Severity: {severityPercent}% (+{growthPercent}%/week)
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-blue-900">
          {formatNumber(feature.severity, { decimals: 3 })}
        </div>
        <div className="text-xs text-blue-600">
          +{formatNumber(weeklyGrowthRate, { decimals: 3 })}/week
        </div>
      </div>
    </div>
  );
}

function ActiveFeatureItem({ feature, config, qualityImpact }: ActiveFeatureItemProps) {
  const severityPercent = Math.round(feature.severity * 100);
  const impactPercent = Math.round(Math.abs(qualityImpact) * 100);
  
  return (
    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <img src={config.icon} alt={config.name} className="w-6 h-6" />
        <div>
          <div className="font-medium text-red-900">{config.name}</div>
          <div className="text-sm text-red-700">
            Severity: {severityPercent}%
            {qualityImpact !== 0 && (
              <span className="ml-2">
                Quality Impact: {qualityImpact > 0 ? '+' : '-'}{impactPercent}%
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-red-900">
          {formatNumber(feature.severity, { decimals: 3 })}
        </div>
        {qualityImpact !== 0 && (
          <div className={`text-xs ${qualityImpact > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {qualityImpact > 0 ? '+' : ''}{formatNumber(qualityImpact, { decimals: 3 })}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskFeatureItem({ feature, config, expectedWeeks }: RiskFeatureItemProps) {
  const riskPercent = Math.round((feature.risk || 0) * 100);
  const riskLabel = getRiskSeverityLabel(feature.risk || 0);
  const riskColor = getRiskColorClass(feature.risk || 0);
  
  return (
    <div className={`flex items-center justify-between p-3 bg-${riskColor}-50 border border-${riskColor}-200 rounded-lg`}>
      <div className="flex items-center space-x-3">
        <img src={config.icon} alt={config.name} className="w-6 h-6" />
        <div>
          <div className={`font-medium text-${riskColor}-900`}>{config.name}</div>
          <div className={`text-sm text-${riskColor}-700`}>
            Risk: {riskPercent}% ({riskLabel})
            {expectedWeeks && (
              <span className="ml-2">Expected: ~{expectedWeeks} weeks</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium text-${riskColor}-900`}>
          {formatNumber(feature.risk || 0, { decimals: 3 })}
        </div>
        {expectedWeeks && (
          <div className={`text-xs text-${riskColor}-600`}>
            ~{expectedWeeks}w
          </div>
        )}
      </div>
    </div>
  );
}

// ===== EFFECT DISPLAY COMPONENTS =====

function WeeklyEffectsDisplay({ combinedWeeklyEffects, evolvingFeatures }: WeeklyEffectsDisplayProps) {
  const characteristics = Object.keys(combinedWeeklyEffects);
  
  if (characteristics.length === 0) return null;
  
  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <h5 className="text-sm font-medium text-gray-700 mb-2">Weekly Effects</h5>
      <div className="space-y-1">
        {characteristics.map(characteristic => (
          <div key={characteristic} className="flex justify-between text-sm">
            <span className="text-gray-600 capitalize">{characteristic}:</span>
            <span className={`font-medium ${combinedWeeklyEffects[characteristic] > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {combinedWeeklyEffects[characteristic] > 0 ? '+' : ''}{formatNumber(combinedWeeklyEffects[characteristic], { decimals: 3 })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Breakdown: {getCharacteristicBreakdown(characteristics[0], evolvingFeatures).map((item, index) => (
          <span key={index}>{item}{index < getCharacteristicBreakdown(characteristics[0], evolvingFeatures).length - 1 ? ', ' : ''}</span>
        ))}
      </div>
    </div>
  );
}

function CombinedEffectsDisplay({ combinedActiveEffects, totalQualityEffect, activeFeatures }: CombinedEffectsDisplayProps) {
  const characteristics = Object.keys(combinedActiveEffects);
  
  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <h5 className="text-sm font-medium text-gray-700 mb-2">Combined Effects</h5>
      <div className="space-y-1">
        {characteristics.map(characteristic => (
          <div key={characteristic} className="flex justify-between text-sm">
            <span className="text-gray-600 capitalize">{characteristic}:</span>
            <span className={`font-medium ${combinedActiveEffects[characteristic] > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {combinedActiveEffects[characteristic] > 0 ? '+' : ''}{formatNumber(combinedActiveEffects[characteristic], { decimals: 3 })}
            </span>
          </div>
        ))}
        {totalQualityEffect !== 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Quality:</span>
            <span className={`font-medium ${totalQualityEffect > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalQualityEffect > 0 ? '+' : ''}{formatNumber(totalQualityEffect, { decimals: 3 })}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Breakdown: {characteristics.length > 0 && getCombinedCharacteristicBreakdown(characteristics[0], activeFeatures.map(f => ({ ...f, characteristicEffects: {} }))).map((item, index) => (
          <span key={index}>{item}{index < getCombinedCharacteristicBreakdown(characteristics[0], activeFeatures.map(f => ({ ...f, characteristicEffects: {} }))).length - 1 ? ', ' : ''}</span>
        ))}
        {totalQualityEffect !== 0 && (
          <span>
            {characteristics.length > 0 ? ', ' : ''}
            Quality: {getCombinedQualityBreakdown(activeFeatures).map((item, index) => (
              <span key={index}>{item}{index < getCombinedQualityBreakdown(activeFeatures).length - 1 ? ', ' : ''}</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ===== UTILITY FUNCTIONS =====

function getCharacteristicBreakdown(characteristic: string, evolvingFeatures: Array<{ feature: any; config: any; weeklyEffects: Record<string, number> }>): React.ReactNode[] {
  return evolvingFeatures
    .filter(({ weeklyEffects }) => weeklyEffects[characteristic] !== undefined)
    .map(({ feature, config, weeklyEffects }) => (
      <span key={feature.id}>
        {config.name}: {weeklyEffects[characteristic] > 0 ? '+' : ''}{formatNumber(weeklyEffects[characteristic], { decimals: 3 })}
      </span>
    ));
}

function getCombinedCharacteristicBreakdown(characteristic: string, activeFeatures: Array<{ feature: any; config: any; characteristicEffects: Record<string, number> }>): React.ReactNode[] {
  return activeFeatures
    .filter(({ characteristicEffects }) => characteristicEffects[characteristic] !== undefined)
    .map(({ feature, config, characteristicEffects }) => (
      <span key={feature.id}>
        {config.name}: {characteristicEffects[characteristic] > 0 ? '+' : ''}{formatNumber(characteristicEffects[characteristic], { decimals: 3 })}
      </span>
    ));
}

function getCombinedQualityBreakdown(activeFeatures: Array<{ feature: any; config: any; qualityImpact: number }>): React.ReactNode[] {
  return activeFeatures
    .filter(({ qualityImpact }) => qualityImpact !== 0)
    .map(({ feature, config, qualityImpact }) => (
      <span key={feature.id}>
        {config.name}: {qualityImpact > 0 ? '+' : ''}{formatNumber(qualityImpact, { decimals: 3 })}
      </span>
    ));
}

// ===== BADGE COMPONENTS =====

function getBadgeVariant(badgeColor: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (badgeColor) {
    case 'red':
      return 'destructive';
    case 'blue':
      return 'default';
    case 'yellow':
      return 'secondary';
    case 'green':
      return 'outline';
    default:
      return 'default';
  }
}

function getFeatureTooltipContent(feature: any, config: any): string {
  const severityPercent = Math.round(feature.severity * 100);
  const riskPercent = Math.round((feature.risk || 0) * 100);
  
  let content = `${config.name}\n${config.description}`;
  
  if (feature.isPresent) {
    content += `\n\nSeverity: ${severityPercent}%`;
  } else if (feature.risk && feature.risk > 0) {
    content += `\n\nRisk: ${riskPercent}%`;
  }
  
  return content;
}

function FeatureBadge({ feature, config, showSeverity = false, className }: FeatureBadgeProps) {
  const severityPercent = Math.round(feature.severity * 100);
  const riskPercent = Math.round((feature.risk || 0) * 100);
  
  let badgeColor = 'gray';
  let badgeText = config.name;
  
  if (feature.isPresent) {
    badgeColor = 'red';
    if (showSeverity) {
      badgeText = `${config.name} (${severityPercent}%)`;
    }
  } else if (feature.risk && feature.risk > 0) {
    badgeColor = 'yellow';
    badgeText = `${config.name} (${riskPercent}%)`;
  }
  
  const variant = getBadgeVariant(badgeColor);
  const tooltipContent = getFeatureTooltipContent(feature, config);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={className}>
            {badgeText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ===== PREVIEW RISK COMPONENTS =====

function PreviewRiskFeatureItem({ feature }: PreviewRiskFeatureItemProps) {
  const riskPercent = Math.round(feature.newRisk * 100);
  const riskLabel = getRiskSeverityLabel(feature.newRisk);
  const riskColor = getRiskColorClass(feature.newRisk);
  
  return wrapPreviewWithTooltip(
    <div className={`flex items-center justify-between p-2 bg-${riskColor}-50 border border-${riskColor}-200 rounded`}>
      <div className="flex items-center space-x-2">
        <img src={feature.icon} alt={feature.featureName} className="w-5 h-5" />
        <div>
          <div className={`text-sm font-medium text-${riskColor}-900`}>{feature.featureName}</div>
          <div className={`text-xs text-${riskColor}-700`}>
            {riskPercent}% ({riskLabel})
            {feature.contextInfo && <span className="ml-1">{feature.contextInfo}</span>}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium text-${riskColor}-900`}>
          {formatNumber(feature.newRisk, { decimals: 3 })}
        </div>
        {feature.weeklyRiskIncrease && (
          <div className={`text-xs text-${riskColor}-600`}>
            +{formatNumber(feature.weeklyRiskIncrease, { decimals: 3 })}/week
          </div>
        )}
      </div>
    </div>,
    feature
  );
}

function wrapPreviewWithTooltip(element: React.ReactNode, feature: PreviewRiskFeatureItemProps['feature']) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {element}
        </TooltipTrigger>
        <TooltipContent>
          <PreviewRiskTooltipContent feature={feature} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PreviewRiskTooltipContent({ feature }: { feature: PreviewRiskFeatureItemProps['feature'] }) {
  const riskPercent = Math.round(feature.newRisk * 100);
  const riskLabel = getRiskSeverityLabel(feature.newRisk);
  
  return (
    <div className="space-y-2">
      <div>
        <div className="font-medium">{feature.featureName}</div>
        <div className="text-sm text-gray-600">{feature.description}</div>
      </div>
      
      <div className="text-sm">
        <div className="font-medium">Risk Level: {riskPercent}% ({riskLabel})</div>
        {feature.qualityImpact && (
          <div className="text-red-600">
            Quality Impact: {Math.round(Math.abs(feature.qualityImpact) * 100)}%
          </div>
        )}
      </div>
      
      {feature.contextInfo && (
        <div className="text-xs text-gray-500">
          {feature.contextInfo}
        </div>
      )}
      
      {feature.riskCombinations && feature.riskCombinations.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-medium">Risk by Options:</div>
          <div className="text-xs space-y-1">
            {feature.riskCombinations.slice(0, 5).map((combo: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{combo.label}</span>
                <span>{Math.round(combo.risk * 100)}%</span>
              </div>
            ))}
            {feature.riskCombinations.length > 5 && (
              <div className="text-gray-500">...and {feature.riskCombinations.length - 5} more</div>
            )}
          </div>
        </div>
      )}
      
      {feature.riskRanges && feature.riskRanges.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-medium">Risk Ranges:</div>
          <div className="text-xs space-y-1">
            {feature.riskRanges.slice(0, 3).map((range: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{range.groupLabel}</span>
                <span>{Math.round(range.minRisk * 100)}-{Math.round(range.maxRisk * 100)}%</span>
              </div>
            ))}
            {feature.riskRanges.length > 3 && (
              <div className="text-gray-500">...and {feature.riskRanges.length - 3} more ranges</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}