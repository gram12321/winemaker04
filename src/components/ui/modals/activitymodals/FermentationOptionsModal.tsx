import React, { useState, useMemo } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { WineBatch, NotificationCategory } from '@/lib/types/types';
import { WorkFactor, WorkCategory } from '@/lib/services/activity';
import { calculateFermentationWork, validateFermentationBatch } from '@/lib/services/activity';
import { getFermentationMethodInfo, getFermentationTemperatureInfo, FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { startFermentationActivity } from '@/lib/services/wine/winery/fermentationManager';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/lib/services';
import { formatNumber, getCharacteristicDisplayName, getColorClass, getCharacteristicEffectColorInfo, getCharacteristicEffectColorClass } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { DialogProps } from '@/lib/types/UItypes';
import { previewFeatureRisks, calculateCumulativeRisk, getPresentFeaturesInfo, getAtRiskFeaturesInfo } from '@/lib/services/';

/**
 * Fermentation Options Modal
 * Modal for configuring fermentation options and starting fermentation activities
 */

interface FermentationOptionsModalProps extends DialogProps {
  batch: WineBatch | null;
}

export const FermentationOptionsModal: React.FC<FermentationOptionsModalProps> = ({ 
  isOpen, 
  batch, 
  onClose
}) => {
  // State initialization
  const [options, setOptions] = useState<FermentationOptions>({
    method: 'Basic',
    temperature: 'Ambient'
  });

  // Helper data and functions
  const methodInfo = getFermentationMethodInfo();
  const temperatureInfo = getFermentationTemperatureInfo();

  // Modal-level tooltip text (moved from inline panel)
  const modalTooltip = `This activity sets up fermentation. Once started, characteristics develop automatically each game week based on method and temperature. Duration is player-controlled: fermentation continues until you bottle the wine.`;

  // Helper function to parse characteristic effects and create visual display
  const parseCharacteristicEffects = (effectsText: string): Array<{ value: number; characteristic: string }> => {
    if (!effectsText || effectsText === 'No additional effects') return [];

    const effects: Array<{ value: number; characteristic: string }> = [];
    const matches = effectsText.match(/([+-]?\d+\.?\d*)%\s+(\w+)/g);
    if (matches) {
      matches.forEach(match => {
        const [, value, characteristic] = match.match(/([+-]?\d+\.?\d*)%\s+(\w+)/) || [];
        if (value && characteristic) {
          effects.push({ value: parseFloat(value), characteristic });
        }
      });
    }

    // Sort characteristics alphabetically
    return effects.sort((a, b) => a.characteristic.localeCompare(b.characteristic));
  };

  // Helper function to get oxidation risk modifier based on fermentation method
  const getOxidationRiskModifier = (method: FermentationOptions['method']): number => {
    switch (method) {
      case 'Temperature Controlled':
        return -0.4; // 40% decrease
      case 'Extended Maceration':
        return 0.4;  // 40% increase
      default:
        return 0;    // No change
    }
  };



  // Combined effects display (moved before early returns to fix hooks order)
  const combinedEffects = useMemo(() => {
    const methodEffects = methodInfo[options.method]?.weeklyEffects || '';
    const temperatureEffects = temperatureInfo[options.temperature]?.weeklyEffects || '';

    // Clean up the text by removing redundant "Weekly:" and "per week"
    const cleanMethodEffects = methodEffects.replace(/^Weekly:\s*/, '').replace(/\s+per week$/, '');
    const cleanTemperatureEffects = temperatureEffects.replace(/^Weekly:\s*/, '').replace(/\s+per week$/, '');

    // Parse effects for visual display
    const methodEffectsParsed = parseCharacteristicEffects(cleanMethodEffects);
    const temperatureEffectsParsed = parseCharacteristicEffects(cleanTemperatureEffects);

    // Combine effects intelligently
    let combined = cleanMethodEffects;
    if (cleanTemperatureEffects !== 'No additional effects') {
      combined += ` + ${cleanTemperatureEffects}`;
    }

    return {
      method: cleanMethodEffects,
      temperature: cleanTemperatureEffects,
      combined: combined,
      methodParsed: methodEffectsParsed,
      temperatureParsed: temperatureEffectsParsed
    };
  }, [options.method, options.temperature, methodInfo, temperatureInfo]);

  // Feature risk calculations using helper service (same pattern as CrushingOptionsModal.tsx)
  const featureRiskData = useMemo(() => {
    if (!batch) return null;

    // Preview ALL event risks for this fermentation action
    const eventRisks = previewFeatureRisks(batch, 'fermentation', options);


    // Calculate cumulative for each risk
    const cumulativeRisks = eventRisks.map(risk => ({
      ...risk,
      cumulative: calculateCumulativeRisk(batch, risk.featureId, risk.riskIncrease, 'Fermentation')
    }));

    return {
      presentFeatures: getPresentFeaturesInfo(batch),
      atRiskFeatures: getAtRiskFeaturesInfo(batch, 0.05),
      eventRisks: eventRisks,
      cumulativeRisks: cumulativeRisks
    };
  }, [batch, options]);

  // Field definitions
  const fields: ActivityOptionField[] = [
    {
      id: 'method',
      label: 'Fermentation Method',
      type: 'select',
      defaultValue: options.method,
      options: Object.entries(methodInfo).map(([method, info]) => ({
        value: method,
        label: method,
        description: `${info.description} - ${info.effects} (${info.costPenalty > 0 ? `+${formatNumber(info.costPenalty, { currency: true })}` : 'No cost'}) | ${info.weeklyEffects}`
      })),
      required: true,
      tooltip: `Choose fermentation method. Each method affects setup work, cost, and weekly characteristic development.

Selected Method Effects: ${methodInfo[options.method]?.weeklyEffects || 'Standard development'}

Work Multiplier: ${methodInfo[options.method]?.workMultiplier || 1}x`
    },
    {
      id: 'temperature',
      label: 'Temperature Control',
      type: 'select',
      defaultValue: options.temperature,
      options: Object.entries(temperatureInfo).map(([temperature, info]) => ({
        value: temperature,
        label: temperature,
        description: `${info.description} - ${info.effects} (${info.costModifier > 0 ? `+${formatNumber(info.costModifier, { currency: true })}` : 'No cost'}) | ${info.weeklyEffects}`
      })),
      required: true,
      tooltip: `Choose temperature control. Temperature affects weekly characteristic development during fermentation.

Selected Temperature Effects: ${temperatureInfo[options.temperature]?.effects || 'Standard progression'}
Weekly Development: ${temperatureInfo[options.temperature]?.weeklyEffects || 'No additional effects'}

Note: These effects apply each week while fermentation is active.`
    }
  ];

  // Work calculation
  const workCalculation = useMemo((): { workEstimate: ActivityWorkEstimate; workFactors: WorkFactor[]; cost: number } | null => {
    if (!batch) return null;
    
    const validation = validateFermentationBatch(batch);
    if (!validation.valid) return null;
    
    const { totalWork, factors, cost } = calculateFermentationWork(batch, options);
    return { workEstimate: { totalWork }, workFactors: factors, cost };
  }, [batch, options]);

  // Event handlers
  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!batch) return;
    
    const fermentationOptions: FermentationOptions = {
      method: submittedOptions.method as FermentationOptions['method'],
      temperature: submittedOptions.temperature as FermentationOptions['temperature']
    };
    
    // Use fermentation manager to start the activity
    const result = await startFermentationActivity(batch, fermentationOptions);
    
    if (!result.success) {
      await notificationService.addMessage(result.error || 'Failed to start fermentation activity', 'fermentationOptionsModal.handleStartFermentation', 'Fermentation Error', NotificationCategory.SYSTEM);
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setOptions((prev: FermentationOptions) => ({ ...prev, ...newOptions }));
  };

  // Validation
  const canSubmit = (currentOptions: Record<string, any>) => {
    if (!batch) return false;
    const validation = validateFermentationBatch(batch);
    
    return validation.valid && currentOptions.method && currentOptions.temperature;
  };

  // Early returns
  if (!batch) return null;
  if (!isOpen) return null;

  // Data preparation
  const validation = validateFermentationBatch(batch);
  if (!validation.valid) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Cannot Start Fermentation</h2>
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



  // Compact info button with tooltip (replaces previous inline info panel)
  const customContent = (
    <div className="mb-4 space-y-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <span className="mr-1">ⓘ</span>
            Fermentation Process
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="whitespace-pre-line text-xs">
            {modalTooltip}
          </div>
        </TooltipContent>
      </Tooltip>
      
      {/* Combined Effects Display */}
      <div className="bg-green-50 border border-green-200 rounded p-3">
        <h4 className="font-medium text-green-800 mb-3 flex items-center">
          <span className="mr-2">⚗️</span>
          Weekly Characteristic Development
        </h4>
        <div className="text-sm text-green-700 space-y-3">
          {/* Method Effects */}
          <div>
            <div className="font-medium text-green-800 mb-1">{options.method} Method</div>
            <div className="flex flex-wrap gap-1">
              {combinedEffects.methodParsed.map((effect, index) => {
                // Convert percentage to decimal modifier (e.g., 5% -> 0.05)
                const modifier = effect.value / 100;
                const currentValue = batch?.characteristics[effect.characteristic as keyof typeof batch.characteristics] || 0;
                const balancedRange = BASE_BALANCED_RANGES[effect.characteristic as keyof typeof BASE_BALANCED_RANGES];
                const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
                const colorInfo = getCharacteristicEffectColorInfo(currentValue, modifier, balancedRangeCopy);
                const colorClass = getCharacteristicEffectColorClass(currentValue, modifier, balancedRangeCopy);
                const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
                
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center ${bgClass} px-2 py-1 rounded text-xs cursor-help`}>
                        <img 
                          src={`/assets/icons/characteristics/${effect.characteristic}.png`} 
                          alt={effect.characteristic}
                          className="w-3 h-3 mr-1"
                        />
                        <span className={colorClass}>
                          {effect.value > 0 ? '+' : ''}{effect.value}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        {getCharacteristicDisplayName(effect.characteristic)}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Temperature Effects */}
          <div>
            <div className="font-medium text-green-800 mb-1">{options.temperature} Temperature</div>
            <div className="flex flex-wrap gap-1">
              {combinedEffects.temperatureParsed.map((effect, index) => {
                // Convert percentage to decimal modifier (e.g., 5% -> 0.05)
                const modifier = effect.value / 100;
                const currentValue = batch?.characteristics[effect.characteristic as keyof typeof batch.characteristics] || 0;
                const balancedRange = BASE_BALANCED_RANGES[effect.characteristic as keyof typeof BASE_BALANCED_RANGES];
                const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
                const colorInfo = getCharacteristicEffectColorInfo(currentValue, modifier, balancedRangeCopy);
                const colorClass = getCharacteristicEffectColorClass(currentValue, modifier, balancedRangeCopy);
                const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
                
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center ${bgClass} px-2 py-1 rounded text-xs cursor-help`}>
                        <img 
                          src={`/assets/icons/characteristics/${effect.characteristic}.png`} 
                          alt={effect.characteristic}
                          className="w-3 h-3 mr-1"
                        />
                        <span className={colorClass}>
                          {effect.value > 0 ? '+' : ''}{effect.value}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        {getCharacteristicDisplayName(effect.characteristic)}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Total Development */}
          <div className="border-t border-green-300 pt-2 mt-2">
            <div className="font-medium text-green-800 mb-1">Total Weekly Development</div>
            <div className="flex flex-wrap gap-1">
              {parseCharacteristicEffects(combinedEffects.combined).map((effect, index) => {
                // Convert percentage to decimal modifier (e.g., 5% -> 0.05)
                const modifier = effect.value / 100;
                const currentValue = batch?.characteristics[effect.characteristic as keyof typeof batch.characteristics] || 0;
                const balancedRange = BASE_BALANCED_RANGES[effect.characteristic as keyof typeof BASE_BALANCED_RANGES];
                const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
                const colorInfo = getCharacteristicEffectColorInfo(currentValue, modifier, balancedRangeCopy);
                const colorClass = getCharacteristicEffectColorClass(currentValue, modifier, balancedRangeCopy);
                const bgClass = colorInfo.isGood ? 'bg-green-200' : 'bg-red-200';
                
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center ${bgClass} px-2 py-1 rounded text-xs cursor-help`}>
                        <img 
                          src={`/assets/icons/characteristics/${effect.characteristic}.png`} 
                          alt={effect.characteristic}
                          className="w-3 h-3 mr-1"
                        />
                        <span className={colorClass}>
                          {effect.value > 0 ? '+' : ''}{effect.value}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        {getCharacteristicDisplayName(effect.characteristic)}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Fermentation Risk Calculations */}
      {featureRiskData && (featureRiskData.presentFeatures.filter(f => f.qualityImpact && Math.abs(f.qualityImpact) > 0.001).length > 0 || featureRiskData.atRiskFeatures.length > 0 || featureRiskData.eventRisks.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
          <span>⚠️</span>
          <span>Fermentation Risks & Information</span>
        </h4>
        <div className="text-xs text-amber-800 space-y-3">
          {/* Oxidation Risk Calculation */}
          <div className="bg-amber-100 border border-amber-200 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">⚠️ Oxidation Risk:</span>
              <span className={`font-mono ${getOxidationRiskModifier(options.method) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(Math.abs(getOxidationRiskModifier(options.method) * 100), { smartDecimals: true })}%
              </span>
            </div>
            <p className="text-xs text-amber-700">
              {getOxidationRiskModifier(options.method) < 0
                ? `Temperature Controlled reduces oxidation risk by ${formatNumber(Math.abs(getOxidationRiskModifier(options.method) * 100), { smartDecimals: true })}%`
                : `Extended Maceration increases oxidation risk by ${formatNumber(getOxidationRiskModifier(options.method) * 100, { smartDecimals: true })}%`
              }
            </p>
          </div>

           {/* Stuck Fermentation Risk Calculation - use feature risk data */}
           {(() => {
             const stuckRisk = featureRiskData?.cumulativeRisks.find(r => r.featureId === 'stuck_fermentation');
             
             if (!stuckRisk) {
               return null; // Don't show if no risk detected
             }

             return (
               <div className="bg-red-100 border border-red-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">🧊 Stuck Fermentation Risk:</span>
                  <span className={`font-mono ${getColorClass(1 - stuckRisk.cumulative.total)}`}>
                    {formatNumber(stuckRisk.cumulative.total * 100, { smartDecimals: true })}%
                  </span>
                </div>
                 <p className="text-xs text-red-700">
                   {batch?.grapeColor === 'red' && options.temperature === 'Cool'
                     ? 'Red wines + Cool temperatures create high stuck fermentation risk (tannins inhibit yeast)'
                     : options.method === 'Temperature Controlled'
                       ? `${batch?.grapeColor === 'red' ? 'Red' : 'White'} grapes have ${batch?.grapeColor === 'red' ? '8%' : '3%'} base risk. Temperature Controlled reduces this risk.`
                       : `${batch?.grapeColor === 'red' ? 'Red' : 'White'} grapes have ${batch?.grapeColor === 'red' ? '8%' : '3%'} base risk of stuck fermentation. This can be modified by controlling temperature during fermentation.`
                   }
                 </p>
               </div>
             );
           })()}
        </div>
      </div>
      )}
    </div>
  );

  // Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <ActivityOptionsModal
        onClose={onClose}
        title={`Start Fermentation`}
        subtitle={`Configure fermentation process for ${batch.quantity}kg of ${batch.grape} must from ${batch.vineyardName}. Choose method and temperature control that will affect weekly characteristic development.`}
        category={WorkCategory.FERMENTATION}
        fields={fields}
        workEstimate={workCalculation?.workEstimate || { totalWork: 0 }}
        workFactors={workCalculation?.workFactors}
        onSubmit={handleSubmit}
        submitLabel="Start Fermentation Activity"
        canSubmit={canSubmit}
        options={options}
        onOptionsChange={handleOptionsChange}
        maxWidth="2xl"
        maxHeight="90vh"
      >
        {customContent}
      </ActivityOptionsModal>
    </div>
  );
};

export default FermentationOptionsModal;
