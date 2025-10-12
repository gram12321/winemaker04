import React, { useState, useMemo } from 'react';
import { WineBatch, NotificationCategory } from '@/lib/types/types';
import { WorkFactor, WorkCategory } from '@/lib/services/activity';
import { calculateCrushingWork, validateCrushingBatch } from '@/lib/services/activity/workcalculators/crushingWorkCalculator';
import { getCrushingMethodInfo, CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import { startCrushingActivity } from '@/lib/services/wine/winery/crushingManager';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { FeatureBadges } from '@/components/ui/wine/FeatureBadge';
import { notificationService } from '@/components/layout/NotificationCenter';
import { formatCurrency } from '@/lib/utils';
import { DialogProps } from '@/lib/types/UItypes';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures';
import { 
  previewFeatureRisks,
  calculateCumulativeRisk,
  getPresentFeaturesInfo,
  getAtRiskFeaturesInfo,
  formatFeatureRiskWarning
} from '@/lib/services/wine/featureRiskHelper';

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
    coldSoak: false
  });

  // Helper data and functions
  const methodInfo = getCrushingMethodInfo();

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
        description: `${info.description} - ${info.throughput} (${info.costPenalty > 0 ? `+${formatCurrency(info.costPenalty)}` : 'No cost'})`
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

  // Warning message (GENERIC for all event-triggered features)
  const warningMessage = useMemo(() => {
    if (!batch || !featureRiskData) return undefined;
    
    const warnings: string[] = [];
    
    // Show warnings for ALL triggered feature risks (generic)
    for (const cumulativeRisk of featureRiskData.cumulativeRisks) {
      warnings.push(formatFeatureRiskWarning(cumulativeRisk));
      
      // Show cumulative if there's existing risk
      if (cumulativeRisk.cumulative.sources.length > 1) {
        const total = (cumulativeRisk.cumulative.total * 100).toFixed(1);
        const sources = cumulativeRisk.cumulative.sources
          .map(s => `${(s.risk * 100).toFixed(0)}% ${s.source}`)
          .join(' + ');
        warnings.push(`📊 CUMULATIVE RISK: ${total}% total (${sources})`);
      }
      
      // Feature-specific tips
      if (cumulativeRisk.featureId === 'green_flavor') {
        warnings.push(`💡 TIP: Enable destemming or use Mechanical/Pneumatic Press to avoid this risk.`);
      }
    }
    
    return warnings.length > 0 ? warnings.join('\n\n') : undefined;
  }, [batch, featureRiskData]);

  // Event handlers
  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!batch) return;
    
    const crushingOptions: CrushingOptions = {
      method: submittedOptions.method as CrushingOptions['method'],
      destemming: submittedOptions.destemming === 'true',
      coldSoak: submittedOptions.coldSoak === 'true'
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
    
    return validation.valid && currentOptions.method && hasValidDestemming && hasValidColdSoak;
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
        warningMessage={warningMessage}
        options={formOptions}
        onOptionsChange={handleOptionsChange}
        maxWidth="2xl"
        maxHeight="90vh"
      >
        {/* Feature Badges (if present) */}
        {featureRiskData && featureRiskData.presentFeatures.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Current Features:</span>
            <FeatureBadges 
              features={batch.features || []} 
              configs={getAllFeatureConfigs()} 
              showSeverity 
            />
          </div>
        )}
        
        {/* Feature Risk Summary Panel */}
        {featureRiskData && (featureRiskData.presentFeatures.length > 0 || featureRiskData.atRiskFeatures.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span>⚗️</span>
              <span>Wine Features Status</span>
            </h4>
            
            {/* Present Features */}
            {featureRiskData.presentFeatures.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-amber-800 mb-2">Current Features:</p>
                {featureRiskData.presentFeatures.map(feature => (
                  <div key={feature.featureId} className="text-xs text-amber-900 ml-2 mb-1">
                    <span className="font-medium">{feature.icon} {feature.featureName}</span>
                    {feature.qualityImpact && (
                      <span className="text-red-600 ml-2">
                        (Quality: {feature.qualityImpact > 0 ? '+' : ''}{(feature.qualityImpact * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* At Risk Features */}
            {featureRiskData.atRiskFeatures.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-800 mb-2">Accumulating Risk:</p>
                {featureRiskData.atRiskFeatures.map(feature => (
                  <div key={feature.featureId} className="text-xs text-amber-900 ml-2 mb-1">
                    <span className="font-medium">{feature.icon} {feature.featureName}:</span>
                    <span className="ml-2">{(feature.currentRisk * 100).toFixed(1)}% risk</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ActivityOptionsModal>
    </div>
  );
};

export default CrushingOptionsModal;
