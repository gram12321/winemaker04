// Feature Risk Helper
// Business logic for presenting feature risks in UI (generic for all features)
// Keeps UI components clean by extracting risk calculations

import { WineBatch } from '../../../types/types';
import { getFeature } from './featureEffectsService';
import { getFeatureConfig } from '../../../constants/wineFeatures';
import { previewEventRisks } from './featureRiskService';
import { inferRiskAccumulationStrategy } from '../../../types/wineFeatures';

/**
 * Risk information for a single feature (generic for all features)
 */
export interface FeatureRiskInfo {
  featureId: string;
  featureName: string;
  icon: string;
  currentRisk: number;      // 0-1 scale
  newRisk: number;          // 0-1 scale after action
  riskIncrease: number;     // 0-1 scale
  isPresent: boolean;
  severity: number;
  qualityImpact?: number;   // Quality impact from config
  description?: string;
}

/**
 * Preview event risks for UI display (GENERIC - works for all features)
 * Wraps featureRiskService.previewEventRisks() with UI-friendly format
 * 
 * @param batch - Wine batch (or undefined for new harvest)
 * @param event - Event type
 * @param context - Event context (vineyard, crushing options, etc.)
 * @returns Array of FeatureRiskInfo for affected features
 */
export function previewFeatureRisks(
  batch: WineBatch | undefined,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): FeatureRiskInfo[] {
  // For harvest events, create a temporary batch structure
  const targetBatch = batch || {
    features: [],
    id: 'preview',
    vineyardId: context.id,
    vineyardName: context.name,
    grape: context.grape,
    quantity: 0,
    state: 'grapes' as const,
    quality: 0,
    balance: 0,
    characteristics: { acidity: 0, aroma: 0, body: 0, spice: 0, sweetness: 0, tannins: 0 },
    estimatedPrice: 0,
    grapeColor: 'red' as const,
    naturalYield: 0,
    fragile: 0,
    proneToOxidation: 0,
    harvestStartDate: { week: 1, season: 'Spring' as const, year: 2024 },
    harvestEndDate: { week: 1, season: 'Spring' as const, year: 2024 }
  };
  
  const risks = previewEventRisks(targetBatch, event, context);
  
  return risks.map(risk => {
    const config = getFeatureConfig(risk.featureId);
    return {
      featureId: risk.featureId,
      featureName: risk.featureName,
      icon: risk.icon,
      currentRisk: risk.currentRisk,
      newRisk: risk.newRisk,
      riskIncrease: risk.riskIncrease,
      isPresent: false,
      severity: 0,
      qualityImpact: config?.effects.quality.type === 'linear'
        ? (config.effects.quality.amount as number)
        : undefined,
      description: config?.description
    };
  });
}

/**
 * Convert wine feature to FeatureRiskInfo (shared helper)
 */
function featureToRiskInfo(feature: any, config: any, isPresent: boolean): FeatureRiskInfo {
  return {
    featureId: feature.id,
    featureName: feature.name,
    icon: feature.icon,
    currentRisk: feature.risk,
    newRisk: feature.risk,
    riskIncrease: 0,
    isPresent,
    severity: isPresent ? feature.severity : 0,
    qualityImpact: config?.effects.quality.type === 'linear' 
      ? (config.effects.quality.amount as number)
      : undefined,
    description: config?.description
  };
}

/**
 * Get all present features on a batch with their details
 * For displaying existing features in modals
 */
export function getPresentFeaturesInfo(batch: WineBatch): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => f.isPresent)
    .map(feature => featureToRiskInfo(feature, getFeatureConfig(feature.id), true));
}

/**
 * Get all at-risk features on a batch (not yet present but accumulating risk)
 * For displaying potential risks in modals
 */
export function getAtRiskFeaturesInfo(batch: WineBatch, threshold: number = 0.05): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => !f.isPresent && f.risk >= threshold)
    .map(feature => featureToRiskInfo(feature, getFeatureConfig(feature.id), false));
}

/**
 * Calculate cumulative risks for a specific feature across multiple events (GENERIC)
 * Shows how risks stack from previous actions
 * 
 * @param batch - Wine batch
 * @param featureId - Feature to calculate for (e.g., 'green_flavor', 'oxidation')
 * @param newRiskIncrease - Risk increase from current action
 * @param newSource - Description of current risk source
 * @returns Total risk and breakdown by source
 */
export function calculateCumulativeRisk(
  batch: WineBatch,
  featureId: string,
  newRiskIncrease: number,
  newSource: string
): { total: number; sources: Array<{ source: string; risk: number }> } {
  const existingFeature = getFeature(batch, featureId);
  
  // If already present, no additional risk
  if (existingFeature?.isPresent) {
    return { total: 1.0, sources: [{ source: 'Already present', risk: 1.0 }] };
  }
  
  // Get feature config and infer accumulation strategy
  const config = getFeatureConfig(featureId);
  const strategy = config?.riskAccumulation ? inferRiskAccumulationStrategy(config.riskAccumulation) : 'cumulative';
  
  const sources: Array<{ source: string; risk: number }> = [];
  let total = 0;
  
  if (strategy === 'independent') {
    // Independent events - only show current event risk
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total = newRiskIncrease;
    }
  } else {
    // Cumulative or severity_growth - include previous risk
    total = existingFeature?.risk || 0;
    
    // Existing risk from previous events
    if (existingFeature && existingFeature.risk > 0) {
      sources.push({ source: 'Previous events', risk: existingFeature.risk });
    }
    
    // New risk from current action
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total += newRiskIncrease;
    }
  }
  
  return { total: Math.min(1.0, total), sources };
}

/**
 * Get risk severity label based on risk value (0-1)
 * Used for consistent risk communication across all features
 * 
 * @param risk - Risk value (0-1 scale)
 * @returns Risk label string
 */
export function getRiskSeverityLabel(risk: number): string {
  if (risk < 0.05) return 'Minimal Risk';
  if (risk < 0.08) return 'Low Risk';
  if (risk < 0.15) return 'Moderate Risk';
  if (risk < 0.30) return 'High Risk';
  return 'Critical Risk';
}

/**
 * Get risk severity icon with label based on risk value
 * Used for warning messages and UI display
 * 
 * @param risk - Risk value (0-1 scale)
 * @returns Icon string with optional severity text
 */
export function getRiskSeverityIcon(risk: number): string {
  if (risk < 0.08) return 'ℹ️';
  if (risk < 0.15) return '⚠️ MODERATE RISK';
  if (risk < 0.30) return '⚠️ HIGH RISK';
  return '🚨 CRITICAL RISK';
}

/**
 * Format risk as warning message
 * Helper for UI components
 */
export function formatFeatureRiskWarning(riskInfo: FeatureRiskInfo): string {
  const riskPercent = (riskInfo.newRisk * 100).toFixed(1);
  const severityIcon = getRiskSeverityIcon(riskInfo.newRisk);
  
  const parts: string[] = [];
  parts.push(`${severityIcon}: ${riskPercent}% chance of ${riskInfo.featureName} (${riskInfo.description}).`);
  
  if (riskInfo.qualityImpact) {
    const impactPercent = Math.abs(riskInfo.qualityImpact * 100);
    parts.push(`Wine quality will be reduced by ${impactPercent}% if this occurs.`);
  }
  
  return parts.join(' ');
}

/**
 * Get harvest risks (negative features that can occur during harvest)
 */
export function getHarvestRisks(batch?: WineBatch, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling' = 'harvest', context?: any): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  return risks
    .map(risk => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter(riskWithConfig => 
      riskWithConfig.config?.harvestContext?.isHarvestRisk === true
    );
}

/**
 * Get harvest influences (positive features that manifest during harvest)
 */
export function getHarvestInfluences(batch?: WineBatch, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling' = 'harvest', context?: any): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  return risks
    .map(risk => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter(riskWithConfig => 
      riskWithConfig.config?.harvestContext?.isHarvestInfluence === true
    );
}

