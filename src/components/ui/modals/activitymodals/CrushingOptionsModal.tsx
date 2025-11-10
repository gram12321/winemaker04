import React, { useState, useMemo } from 'react';
import { WineBatch, NotificationCategory } from '@/lib/types/types';
import { WorkFactor, WorkCategory } from '@/lib/services/activity';
import { calculateCrushingWork, validateCrushingBatch } from '@/lib/services/activity';
import { getCrushingMethodInfo, CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import { startCrushingActivity } from '@/lib/services/wine/winery/crushingManager';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { FeatureDisplay } from '@/components/ui';
import { notificationService } from '@/lib/services';
import { formatNumber, getColorClass, getCharacteristicEffectColorInfo, getCharacteristicEffectColorClass, getCharacteristicIconSrc } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { DialogProps } from '@/lib/types/UItypes';
import { getAllFeatureConfigs, getFeatureConfig } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { previewFeatureRisks, calculateCumulativeRisk, getPresentFeaturesInfo, getAtRiskFeaturesInfo } from '@/lib/services/';
import { calculateYieldMultiplier, calculatePressingQualityPenalty, getPressingIntensityCharacteristicEffects } from '@/lib/services/wine/characteristics/crushingCharacteristics';

/**
 * Crushing Options Modal
 * Modal for configuring crushing options and starting crushing activities
 */

interface CrushingOptionsModalProps extends DialogProps {
  batch: WineBatch | null;
}

export const CrushingOptionsModal: React.FC<CrushingOptionsModalProps> = ({ 
  isOpen, 
  batch, 
  onClose
}) => {
  // State initialization
  const [options, setOptions] = useState<CrushingOptions>({
    method: 'Mechanical Press',
    destemming: true,
    coldSoak: false,
    pressingIntensity: 0.5 // Default to medium pressure
  });

  // Helper data and functions
  const methodInfo = getCrushingMethodInfo();
  
  // Get max pressure for selected method
  const maxPressure = methodInfo[options.method]?.maxPressure || 1.0;

  // Field definitions
  const fields: ActivityOptionField[] = [
    {
      id: 'method',
      label: 'Crushing Method',
      type: 'radio-group',
      defaultValue: options.method,
      options: Object.entries(methodInfo).map(([method, info]) => ({
        value: method,
        label: method,
        description: `${info.description} - ${info.throughput} (${info.costPenalty > 0 ? `+${formatNumber(info.costPenalty, { currency: true })}` : 'No cost'})`
      })),
      required: true,
      tooltip: `Choose crushing method. Each method affects work time, cost, and wine characteristics.

Processing Effects: ${methodInfo[options.method]?.effects || 'No specific effects'}

Work Multiplier: ${methodInfo[options.method]?.workMultiplier || 1}x`
    },
    {
      id: 'destemming',
      label: 'Remove Stems (Destemming)',
      type: 'select',
      defaultValue: options.destemming ? 'true' : 'false',
      options: [
        { value: 'true', label: 'Yes - Remove stems (+20% work, raises body & tannins)' },
        { value: 'false', label: 'No - Keep stems (may lower quality)' }
      ],
      required: true,
      tooltip: `Destemming removes stems before crushing, affecting wine characteristics and requiring more work.

Processing Effects:
• Yes: Raises body, tannins, and spice characteristics
• No: May lower overall quality due to stem influence`
    },
    {
      id: 'coldSoak',
      label: 'Cold Soak (Pre-fermentation)',
      type: 'select',
      defaultValue: options.coldSoak ? 'true' : 'false',
      options: [
        { value: 'false', label: 'No - Standard processing' },
        { value: 'true', label: 'Yes - Cold soak (+15% work, raises characteristics)' }
      ],
      required: true,
      tooltip: `Cold soaking affects wine characteristics through extended pre-fermentation contact.

Processing Effects:
• Yes: Raises aroma, body, and tannin characteristics
• No: Standard processing without additional extraction effects`
    },
    {
      id: 'pressingIntensity',
      label: `Pressing Intensity (Max: ${formatNumber(maxPressure * 100, { smartDecimals: true })}% for ${options.method})`,
      type: 'range',
      defaultValue: Math.min(options.pressingIntensity, maxPressure),
      min: 0,
      max: maxPressure,
      step: 0.05,
      required: true,
      tooltip: `Control pressing pressure - tradeoff between yield and quality.

EFFECTS BY INTENSITY:
• Very Gentle (0-10%): No effects
  → 85-88% yield, no quality impact

• Light (10-30%): Minimal extraction
  → Slight characteristic changes
  → 88-94% yield, minor quality impact

• Medium (30-60%): Balanced extraction
  → Moderate characteristic changes
  → 94-103% yield, moderate quality impact

• High (60-100%): Aggressive extraction
  → Significant characteristic changes
  → 103-115% yield, major quality impact

CHARACTERISTIC EFFECTS (Power Function + Method Multipliers):
• Hand Press: 1.0x multiplier (gentle extraction)
• Mechanical Press: 1.5x multiplier (efficient extraction)
• Pneumatic Press: 1.9x multiplier (maximum extraction)

Base Effects (before method multiplier):
• Tannins: +20% max (hard pressing extracts more)
• Spice: -15% max (delicate compounds damaged)
• Aroma: -12% max (volatile compounds lost)

MAX PRESSURE BY METHOD:
• Hand Press: 50% (gentle only)
• Mechanical: 80% (good range)
• Pneumatic: 100% (full control)`
    }
  ];

  // Work calculation
  const workCalculation = useMemo((): { workEstimate: ActivityWorkEstimate; workFactors: WorkFactor[]; cost: number } | null => {
    if (!batch) return null;
    
    const validation = validateCrushingBatch(batch);
    if (!validation.valid) return null;
    
    const { totalWork, factors, cost } = calculateCrushingWork(batch, options);
    return { workEstimate: { totalWork }, workFactors: factors, cost };
  }, [batch, options]);

  // Feature risk calculations using helper service (GENERIC for all features)
  const featureRiskData = useMemo(() => {
    if (!batch) return null;
    
    // Preview ALL event risks for this crushing action (generic)
    const eventRisks = previewFeatureRisks(batch, 'crushing', options);
    
    // Calculate cumulative for each risk
    const cumulativeRisks = eventRisks.map(risk => ({
      ...risk,
      cumulative: calculateCumulativeRisk(batch, risk.featureId, risk.riskIncrease, 'Crushing')
    }));
    
    return {
      presentFeatures: getPresentFeaturesInfo(batch),
      atRiskFeatures: getAtRiskFeaturesInfo(batch, 0.05),
      eventRisks: eventRisks,
      cumulativeRisks: cumulativeRisks
    };
  }, [batch, options]);

  // Organized warning message for consolidated display in Wine Features Status section
  const organizedWarnings = useMemo(() => {
    if (!batch || !featureRiskData) return null;

    const riskMessages: string[] = [];

    // Process each cumulative risk in organized format
    for (const cumulativeRisk of featureRiskData.cumulativeRisks) {
      const config = getAllFeatureConfigs().find(c => c.id === cumulativeRisk.featureId);
      const isTriggered = config?.behavior === 'triggered';

      // Format main risk message
      const riskPercent = formatNumber(cumulativeRisk.cumulative.total * 100, { smartDecimals: true });

      if (isTriggered) {
        // For triggered features, only show current event risk
        riskMessages.push(`📊 ${riskPercent}% chance of ${cumulativeRisk.featureName} (${config?.description || ''})`);
      } else {
        // For accumulation features, show total risk with breakdown
        if (cumulativeRisk.cumulative.sources.length > 1) {
          const total = formatNumber(cumulativeRisk.cumulative.total * 100, { smartDecimals: true });
          const sources = cumulativeRisk.cumulative.sources
            .map(s => `${formatNumber(s.risk * 100, { smartDecimals: true })}% ${s.source}`)
            .join(' + ');
          riskMessages.push(`📊 ${riskPercent}% chance of ${cumulativeRisk.featureName} (${config?.description || ''}). CUMULATIVE RISK: ${total}% total (${sources})`);
        } else {
          riskMessages.push(`📊 ${riskPercent}% chance of ${cumulativeRisk.featureName} (${config?.description || ''})`);
        }
      }

      // Pull tips from feature config
      const featureConfig = getFeatureConfig(cumulativeRisk.featureId);
      if (featureConfig?.tips) {
        const crushingTips = featureConfig.tips.filter(tip => tip.triggerEvent === 'crushing');
        crushingTips.forEach(tip => riskMessages.push(tip.message));
      }
    }

    return riskMessages.length > 0 ? riskMessages : null;
  }, [batch, featureRiskData]);

  // Event handlers
  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!batch) return;
    
    const crushingOptions: CrushingOptions = {
      method: submittedOptions.method as CrushingOptions['method'],
      destemming: submittedOptions.destemming === 'true',
      coldSoak: submittedOptions.coldSoak === 'true',
      pressingIntensity: parseFloat(submittedOptions.pressingIntensity) || 0.5
    };
    
    // Use crushing manager to start the activity
    const result = await startCrushingActivity(batch, crushingOptions);
    
    if (!result.success) {
      await notificationService.addMessage(result.error || 'Failed to start crushing activity', 'crushingOptionsModal.handleStartCrushing', 'Crushing Error', NotificationCategory.SYSTEM);
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    // Convert string boolean values back to actual booleans for internal state
    const convertedOptions = { ...newOptions };
    if ('destemming' in convertedOptions) {
      convertedOptions.destemming = convertedOptions.destemming === 'true';
    }
    if ('coldSoak' in convertedOptions) {
      convertedOptions.coldSoak = convertedOptions.coldSoak === 'true';
    }
    
    // Clamp pressingIntensity to method's max pressure when method changes
    if ('method' in convertedOptions && 'pressingIntensity' in convertedOptions) {
      const newMethod = convertedOptions.method as CrushingOptions['method'];
      const newMaxPressure = methodInfo[newMethod]?.maxPressure || 1.0;
      convertedOptions.pressingIntensity = Math.min(
        parseFloat(convertedOptions.pressingIntensity) || 0.5,
        newMaxPressure
      );
    } else if ('method' in convertedOptions) {
      // Only method changed - clamp existing intensity
      const newMethod = convertedOptions.method as CrushingOptions['method'];
      const newMaxPressure = methodInfo[newMethod]?.maxPressure || 1.0;
      convertedOptions.pressingIntensity = Math.min(options.pressingIntensity, newMaxPressure);
    }
    
    setOptions((prev: CrushingOptions) => ({ ...prev, ...convertedOptions }));
  };

  // Validation
  const canSubmit = (currentOptions: Record<string, any>) => {
    if (!batch) return false;
    const validation = validateCrushingBatch(batch);
    
    // Handle both boolean and string values for destemming and coldSoak
    const hasValidDestemming = typeof currentOptions.destemming === 'boolean' || 
                              currentOptions.destemming === 'true' || 
                              currentOptions.destemming === 'false';
    const hasValidColdSoak = typeof currentOptions.coldSoak === 'boolean' || 
                            currentOptions.coldSoak === 'true' || 
                            currentOptions.coldSoak === 'false';
    const hasValidIntensity = typeof currentOptions.pressingIntensity === 'number' || 
                             !isNaN(parseFloat(currentOptions.pressingIntensity));
    
    return validation.valid && currentOptions.method && hasValidDestemming && hasValidColdSoak && hasValidIntensity;
  };

  // Early returns
  if (!batch) return null;
  if (!isOpen) return null;

  // Data preparation
  const formOptions = {
    ...options,
    destemming: options.destemming ? 'true' : 'false',
    coldSoak: options.coldSoak ? 'true' : 'false'
  };

  const validation = validateCrushingBatch(batch);
  if (!validation.valid) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Cannot Crush Batch</h2>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <p className="text-red-600 mb-4">{validation.reason}</p>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <ActivityOptionsModal
        onClose={onClose}
        title="Crush Wine Batch"
        subtitle={`Configure crushing options for ${batch.quantity}kg of ${batch.grape} grapes from ${batch.vineyardName}. Choose method and processing options that will affect the final wine characteristics.`}
        category={WorkCategory.CRUSHING}
        fields={fields}
        workEstimate={workCalculation?.workEstimate || { totalWork: 0 }}
        workFactors={workCalculation?.workFactors}
        onSubmit={handleSubmit}
        submitLabel="Start Crushing Activity"
        canSubmit={canSubmit}
        options={formOptions}
        onOptionsChange={handleOptionsChange}
        maxWidth="2xl"
        maxHeight="90vh"
      >
        {/* Pressing Intensity Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span>⚙️</span>
            <span>Pressing Intensity Effects</span>
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Left: Yield Impact */}
            <div>
              <p className="font-medium text-blue-800 mb-2">Yield Impact:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-700">Current Quantity:</span>
                  <span className="font-mono text-blue-900">{batch?.quantity || 0} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Yield Multiplier:</span>
                  <span className="font-mono text-blue-900">
                    {formatNumber(calculateYieldMultiplier(options.pressingIntensity) * 100, { smartDecimals: true })}%
                  </span>
                </div>
                <div className="flex justify-between border-t border-blue-300 pt-1">
                  <span className="text-blue-800 font-medium">Final Quantity:</span>
                  <span className="font-mono text-blue-900 font-medium">
                    {formatNumber((batch?.quantity || 0) * calculateYieldMultiplier(options.pressingIntensity), { smartDecimals: true })} kg
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right: Quality Impact */}
            <div>
              <p className="font-medium text-blue-800 mb-2">Quality Impact:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-700">Current Quality:</span>
                  <span className={`font-mono ${getColorClass(batch?.grapeQuality || 0)}`}>
                    {formatNumber((batch?.grapeQuality || 0) * 100, { smartDecimals: true })}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Pressure Impact:</span>
                  <span className={`font-mono ${calculatePressingQualityPenalty(options.pressingIntensity) < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                    {formatNumber(calculatePressingQualityPenalty(options.pressingIntensity) * 100, { smartDecimals: true })}%
                  </span>
                </div>
                <div className="flex justify-between border-t border-blue-300 pt-1">
                  <span className="text-blue-800 font-medium">After Crushing:</span>
                  <span className={`font-mono font-medium ${getColorClass(Math.max(0, Math.min(1, (batch?.grapeQuality || 0) + calculatePressingQualityPenalty(options.pressingIntensity))))}`}>
                    {formatNumber(Math.max(0, Math.min(1, (batch?.grapeQuality || 0) + calculatePressingQualityPenalty(options.pressingIntensity))) * 100, { smartDecimals: true })}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Characteristic Effects Badges */}
          {getPressingIntensityCharacteristicEffects(options.pressingIntensity, options.method).length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs font-medium text-blue-800 mb-2">Characteristic Changes:</p>
              <div className="flex flex-wrap gap-1">
                {getPressingIntensityCharacteristicEffects(options.pressingIntensity, options.method).map((effect) => {
                  const percentage = formatNumber(effect.modifier * 100, { smartDecimals: true });
                  const sign = effect.modifier > 0 ? '+' : '';
                  
                  // Use balance-aware color coding for effects
                  const currentValue = batch?.characteristics[effect.characteristic as keyof typeof batch.characteristics] || 0;
                  const balancedRange = BASE_BALANCED_RANGES[effect.characteristic as keyof typeof BASE_BALANCED_RANGES];
                  const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
                  const colorInfo = getCharacteristicEffectColorInfo(currentValue, effect.modifier, balancedRangeCopy);
                  const colorClass = getCharacteristicEffectColorClass(currentValue, effect.modifier, balancedRangeCopy);
                  const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
                  
                  return (
                    <div key={effect.characteristic} className={`text-xs px-1.5 py-0.5 rounded ${bgClass} ${colorClass} flex items-center gap-1`}>
                      <img src={getCharacteristicIconSrc(effect.characteristic)} alt={`${effect.characteristic} icon`} className="w-3 h-3 opacity-80" />
                      <span>{effect.characteristic}: {sign}{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Intensity Level Description */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-800">
              {options.pressingIntensity <= 0.1 && (
                <span>🌿 <strong>Very Gentle Pressing:</strong> No effects, maximum quality retention, lower yield.</span>
              )}
              {options.pressingIntensity > 0.1 && options.pressingIntensity <= 0.3 && (
                <span>🌱 <strong>Light Pressing:</strong> Minimal extraction with slight characteristic changes.</span>
              )}
              {options.pressingIntensity > 0.3 && options.pressingIntensity <= 0.6 && (
                <span>⚖️ <strong>Balanced Pressing:</strong> Standard extraction with moderate characteristic changes.</span>
              )}
              {options.pressingIntensity > 0.6 && (
                <span>⚠️ <strong>Aggressive Pressing:</strong> Maximum extraction with significant characteristic changes and quality impact.</span>
              )}
            </p>
          </div>
        </div>
        
        {/* Feature Badges (if present) */}
        {featureRiskData && featureRiskData.presentFeatures.filter(f => f.qualityImpact && Math.abs(f.qualityImpact) > 0.001).length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Current Features:</span>
            <FeatureDisplay 
              batch={batch}
              displayMode="badges"
              showActive={true}
              showEvolving={false}
              showRisks={false}
            />
          </div>
        )}
        
        {/* Wine Features Status Panel - Using FeatureDisplay style */}
        {featureRiskData && (featureRiskData.presentFeatures.filter(f => f.qualityImpact && Math.abs(f.qualityImpact) > 0.001).length > 0 || featureRiskData.atRiskFeatures.length > 0 || featureRiskData.eventRisks.length > 0 || organizedWarnings) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span>⚗️</span>
              <span>Wine Features Status</span>
            </h4>

            {/* Organized Risk Warnings */}
            {organizedWarnings && (
              <div className="mb-3 p-2 bg-amber-100 rounded text-xs">
                {organizedWarnings.map((warning, index) => (
                  <div key={index} className="mb-1 text-xs">
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Present Features - Only show if they have actual impact */}
            {featureRiskData.presentFeatures.filter(f => f.qualityImpact && Math.abs(f.qualityImpact) > 0.001).length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-amber-800 mb-2">Current Features:</div>
                <div className="space-y-1">
                  {featureRiskData.presentFeatures
                    .filter(f => f.qualityImpact && Math.abs(f.qualityImpact) > 0.001)
                    .map(feature => (
                      <div key={feature.featureId} className="text-xs">
                        <span className="font-medium">{feature.icon} {feature.featureName}:</span>{' '}
                        <span className="text-red-600">
                          {feature.featureName} (Quality: {feature.qualityImpact && feature.qualityImpact > 0 ? '+' : ''}{formatNumber((feature.qualityImpact || 0) * 100, { smartDecimals: true })}%)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Historical Event Risks (only for cumulative features) */}
            {(() => {
              // Filter to only accumulation features with actual risks
              const cumulativeFeatures = featureRiskData.atRiskFeatures.filter(feature => {
                const config = getAllFeatureConfigs().find(c => c.id === feature.featureId);
                return config?.behavior === 'accumulation' && feature.currentRisk > 0;
              });

              if (cumulativeFeatures.length === 0) return null;

              return (
                <div className="mb-3">
                  <div className="text-xs font-medium text-amber-800 mb-2">Previous Event Risks:</div>
                  <div className="space-y-1">
                    {cumulativeFeatures.map(feature => (
                      <div key={feature.featureId} className="text-xs">
                        <span className="font-medium">{feature.icon} {feature.featureName}:</span>{' '}
                        <span className="text-amber-600">
                          {formatNumber(feature.currentRisk * 100, { smartDecimals: true })}% risk (from harvest)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </ActivityOptionsModal>
    </div>
  );
};

export default CrushingOptionsModal;

