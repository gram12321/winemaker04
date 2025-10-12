// Feature Risk Service
// Handles risk accumulation, manifestation checks, and feature state updates

import { WineBatch } from '../../types/types';
import { WineFeature, FeatureConfig, CreateFeatureOptions } from '../../types/wineFeatures';
import { getAllFeatureConfigs, getTimeBasedFeatures, getEventTriggeredFeatures } from '../../constants/wineFeatures';
import { loadWineBatches, updateWineBatch } from '../../database/activities/inventoryDB';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { NotificationCategory } from '../../types/types';
import { addFeaturePrestigeEvent } from '../prestige/prestigeService';

/**
 * Create a new feature instance from config
 */
export function createNewFeature(config: FeatureConfig, options?: Partial<CreateFeatureOptions>): WineFeature {
  return {
    id: config.id,
    risk: options?.initialRisk ?? 0,
    isPresent: options?.isPresent ?? false,
    severity: options?.severity ?? 0,
    name: config.name,
    type: config.type,
    icon: config.icon
  };
}

/**
 * Initialize features array for a new wine batch
 * Creates feature instances for all active features
 */
export function initializeBatchFeatures(): WineFeature[] {
  const configs = getAllFeatureConfigs();
  return configs.map(config => createNewFeature(config));
}

/**
 * Get or create a feature in a batch's features array
 */
function getOrCreateFeature(features: WineFeature[], config: FeatureConfig): WineFeature {
  const existing = features.find(f => f.id === config.id);
  if (existing) return existing;
  return createNewFeature(config);
}

/**
 * Calculate risk increase for time-based features
 */
function calculateRiskIncrease(batch: WineBatch, config: FeatureConfig, feature: WineFeature): number {
  const baseRate = config.riskAccumulation.baseRate || 0;
  
  // Get state multiplier if applicable
  const stateMultiplier = config.riskAccumulation.stateMultipliers?.[batch.state] ?? 1.0;
  
  // Apply compound effect if configured
  const compoundMultiplier = config.riskAccumulation.compoundEffect 
    ? (1 + feature.risk)
    : 1.0;
  
  // For oxidation: also multiply by proneToOxidation
  // This is oxidation-specific but won't affect other features
  const oxidationMultiplier = config.id === 'oxidation' 
    ? batch.proneToOxidation 
    : 1.0;
  
  return baseRate * stateMultiplier * compoundMultiplier * oxidationMultiplier;
}

/**
 * Check if feature manifests (random roll)
 */
function checkManifestation(risk: number): boolean {
  return Math.random() < risk;
}

/**
 * Process time-based feature for a single batch
 */
async function processTimeBased(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[],
  vineyard?: any
): Promise<WineFeature[]> {
  const feature = getOrCreateFeature(features, config);
  
  // Binary features don't update once manifested
  if (feature.isPresent && config.manifestation === 'binary') {
    return features;
  }
  
  // Calculate risk increase
  const riskIncrease = calculateRiskIncrease(batch, config, feature);
  const newRisk = Math.min(1.0, feature.risk + riskIncrease);
  
  // Track for warnings
  const previousRisk = feature.risk;
  
  // Check for manifestation
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  
  if (!isPresent) {
    // Roll for manifestation
    isPresent = checkManifestation(newRisk);
    
    if (isPresent) {
      // Feature manifested!
      severity = config.manifestation === 'binary' ? 1.0 : newRisk;
      
      // Send notification
      await sendManifestationNotification(batch, config);
      
      // Trigger prestige event if configured (with vineyard context for dynamic calculation)
      if (config.effects.prestige?.onManifestation) {
        console.log(`🍷 [FEATURE RISK] Triggering manifestation prestige event for ${config.name}`);
        console.log(`🍷 [FEATURE RISK] Vineyard context:`, vineyard?.name, vineyard?.vineyardPrestige);
        await addFeaturePrestigeEvent(batch, config, 'manifestation', {
          vineyard
        });
      } else {
        console.log(`🍷 [FEATURE RISK] No manifestation prestige config for ${config.name}`);
      }
    }
  } else if (config.manifestation === 'graduated') {
    // Grow severity for graduated features
    const growthRate = config.riskAccumulation.severityGrowth?.rate || 0;
    const cap = config.riskAccumulation.severityGrowth?.cap || 1.0;
    severity = Math.min(cap, severity + growthRate);
  }
  
  // Check for risk warnings (only for features that haven't manifested)
  if (!isPresent && shouldWarnAboutRisk(config, previousRisk, newRisk)) {
    await sendRiskWarning(batch, config, newRisk);
  }
  
  // Update feature
  const updatedFeature: WineFeature = {
    ...feature,
    risk: newRisk,
    isPresent,
    severity
  };
  
  // Replace or add feature in array
  const featureIndex = features.findIndex(f => f.id === config.id);
  if (featureIndex >= 0) {
    const updated = [...features];
    updated[featureIndex] = updatedFeature;
    return updated;
  } else {
    return [...features, updatedFeature];
  }
}

/**
 * Process weekly risk accumulation for all time-based features
 * Called by game tick system
 */
export async function processWeeklyFeatureRisks(): Promise<void> {
  try {
    const batches = await loadWineBatches();
    const vineyards = await loadVineyards();
    const timeBasedConfigs = getTimeBasedFeatures();
    
    for (const batch of batches) {
      let updatedFeatures = [...(batch.features || [])];
      
      // Find vineyard for prestige context
      const vineyard = vineyards.find(v => v.id === batch.vineyardId);
      
      for (const config of timeBasedConfigs) {
        updatedFeatures = await processTimeBased(batch, config, updatedFeatures, vineyard);
      }
      
      // Only update if features changed
      if (JSON.stringify(updatedFeatures) !== JSON.stringify(batch.features)) {
        await updateWineBatch(batch.id, { features: updatedFeatures });
      }
    }
  } catch (error) {
    console.error('Error processing weekly feature risks:', error);
  }
}

/**
 * Process event-triggered features
 * Called when production events happen (harvest, crushing, etc.)
 */
export async function processEventTrigger(
  batch: WineBatch,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Promise<WineBatch> {
  const eventConfigs = getEventTriggeredFeatures(event);
  let updatedFeatures = [...(batch.features || [])];
  
  // Get vineyard for prestige context (context might be a vineyard for harvest events)
  const vineyard = event === 'harvest' ? context : undefined;
  
  for (const config of eventConfigs) {
    const triggers = config.riskAccumulation.eventTriggers || [];
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        // Check condition
        const conditionMet = trigger.condition(context);
        
        if (conditionMet) {
          // Calculate risk increase
          const riskIncrease = typeof trigger.riskIncrease === 'function'
            ? trigger.riskIncrease(context)
            : trigger.riskIncrease;
          
          // Apply risk increase with vineyard context
          updatedFeatures = await applyRiskIncrease(batch, config, updatedFeatures, riskIncrease, vineyard);
        }
      }
    }
  }
  
  return { ...batch, features: updatedFeatures };
}

/**
 * Apply risk increase to a feature
 */
async function applyRiskIncrease(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[],
  riskIncrease: number,
  vineyard?: any
): Promise<WineFeature[]> {
  const feature = getOrCreateFeature(features, config);
  
  // Already manifested binary features don't change
  if (feature.isPresent && config.manifestation === 'binary') {
    return features;
  }
  
  const newRisk = Math.min(1.0, feature.risk + riskIncrease);
  
  // Check for manifestation
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  
  if (!isPresent) {
    isPresent = checkManifestation(newRisk);
    
    if (isPresent) {
      severity = config.manifestation === 'binary' ? 1.0 : newRisk;
      await sendManifestationNotification(batch, config);
      
      if (config.effects.prestige?.onManifestation) {
        console.log(`🍷 [FEATURE RISK] Triggering manifestation prestige event for ${config.name} (event-triggered)`);
        console.log(`🍷 [FEATURE RISK] Vineyard context:`, vineyard?.name, vineyard?.vineyardPrestige);
        await addFeaturePrestigeEvent(batch, config, 'manifestation', {
          vineyard
        });
      } else {
        console.log(`🍷 [FEATURE RISK] No manifestation prestige config for ${config.name} (event-triggered)`);
      }
    }
  }
  
  const updatedFeature: WineFeature = {
    ...feature,
    risk: newRisk,
    isPresent,
    severity
  };
  
  const featureIndex = features.findIndex(f => f.id === config.id);
  if (featureIndex >= 0) {
    const updated = [...features];
    updated[featureIndex] = updatedFeature;
    return updated;
  } else {
    return [...features, updatedFeature];
  }
}

/**
 * Preview risk increases for event-triggered features (READ-ONLY for UI)
 * Does NOT modify batch, only calculates what would happen
 * 
 * @param batch - Wine batch to preview
 * @param event - Event type
 * @param context - Event context (vineyard, crushing options, etc.)
 * @returns Array of risks that would be triggered
 */
export function previewEventRisks(
  batch: WineBatch,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Array<{ featureId: string; featureName: string; icon: string; riskIncrease: number; currentRisk: number; newRisk: number }> {
  const eventConfigs = getEventTriggeredFeatures(event);
  const results: Array<{ featureId: string; featureName: string; icon: string; riskIncrease: number; currentRisk: number; newRisk: number }> = [];
  
  for (const config of eventConfigs) {
    const feature = batch.features?.find(f => f.id === config.id);
    const currentRisk = feature?.risk || 0;
    
    // Skip if already present (binary features)
    if (feature?.isPresent && config.manifestation === 'binary') {
      continue;
    }
    
    const triggers = config.riskAccumulation.eventTriggers || [];
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        const conditionMet = trigger.condition(context);
        
        if (conditionMet) {
          const riskIncrease = typeof trigger.riskIncrease === 'function'
            ? trigger.riskIncrease(context)
            : trigger.riskIncrease;
          
          const newRisk = Math.min(1.0, currentRisk + riskIncrease);
          
          results.push({
            featureId: config.id,
            featureName: config.name,
            icon: config.icon,
            riskIncrease,
            currentRisk,
            newRisk
          });
        }
      }
    }
  }
  
  return results;
}

/**
 * Check if we should warn about risk level change
 */
function shouldWarnAboutRisk(config: FeatureConfig, previousRisk: number, newRisk: number): boolean {
  const thresholds = config.ui.warningThresholds || [];
  
  for (const threshold of thresholds) {
    if (previousRisk < threshold && newRisk >= threshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Send notification when feature manifests
 */
async function sendManifestationNotification(batch: WineBatch, config: FeatureConfig): Promise<void> {
  const message = config.type === 'fault'
    ? `${config.name}! ${batch.vineyardName} ${batch.grape} (${batch.state}) has developed ${config.name.toLowerCase()}.`
    : `${config.name}! ${batch.vineyardName} ${batch.grape} (${batch.state}) now shows ${config.name.toLowerCase()}.`;
  
  await notificationService.addMessage(
    message,
    `wine.feature.${config.id}`,
    config.name,
    NotificationCategory.WINEMAKING_PROCESS
  );
}

/**
 * Send risk warning notification
 */
async function sendRiskWarning(batch: WineBatch, config: FeatureConfig, risk: number): Promise<void> {
  const riskPercent = (risk * 100).toFixed(1);
  const thresholds = config.ui.warningThresholds || [];
  
  let severity: 'info' | 'warning' | 'critical' = 'info';
  let title = `${config.name} Risk`;
  
  if (thresholds.length >= 3) {
    if (risk >= thresholds[2]) {
      severity = 'critical';
      title = `Critical ${config.name} Risk`;
    } else if (risk >= thresholds[1]) {
      severity = 'warning';
      title = `High ${config.name} Risk`;
    }
  }
  
  const message = severity === 'critical'
    ? `Critical Risk! ${batch.vineyardName} ${batch.grape} has ${riskPercent}% ${config.name.toLowerCase()} risk (${batch.state}). Process immediately!`
    : `${title}: ${batch.vineyardName} ${batch.grape} has ${riskPercent}% ${config.name.toLowerCase()} risk (${batch.state}).`;
  
  await notificationService.addMessage(
    message,
    `wine.feature.${config.id}.risk`,
    title,
    NotificationCategory.WINEMAKING_PROCESS
  );
}

