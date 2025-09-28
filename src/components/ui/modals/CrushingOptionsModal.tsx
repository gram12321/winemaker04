import React, { useState, useMemo } from 'react';
import { WineBatch } from '@/lib/types/types';
import { createActivity } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculateCrushingWork, validateCrushingBatch } from '@/lib/services/activity/WorkCalculators/CrushingWorkCalculator';
import { getCrushingMethodInfo, CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/components/layout/NotificationCenter';
import { formatCurrency } from '@/lib/utils';

interface CrushingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: WineBatch | null;
}

export const CrushingOptionsModal: React.FC<CrushingOptionsModalProps> = ({ 
  isOpen, 
  batch, 
  onClose
}) => {
  const [options, setOptions] = useState<CrushingOptions>({
    method: 'Mechanical Press',
    destemming: true,
    coldSoak: false
  });

  // Get crushing method information for the UI
  const methodInfo = getCrushingMethodInfo();

  // Define the fields for the modal
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

  // Calculate work requirements whenever options change
  const workCalculation = useMemo((): { workEstimate: ActivityWorkEstimate; workFactors: WorkFactor[]; cost: number } | null => {
    if (!batch) return null;
    
    const validation = validateCrushingBatch(batch);
    if (!validation.valid) return null;
    
    const { totalWork, factors, cost } = calculateCrushingWork(batch, options);
    return { workEstimate: { totalWork }, workFactors: factors, cost };
  }, [batch, options]);

  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!batch || !workCalculation) return;
    
    const crushingOptions: CrushingOptions = {
      method: submittedOptions.method as CrushingOptions['method'],
      destemming: submittedOptions.destemming === 'true',
      coldSoak: submittedOptions.coldSoak === 'true'
    };
    
    // Create activity for crushing
    const activityId = await createActivity({
      category: WorkCategory.CRUSHING,
      title: `Crushing ${batch.vineyardName} ${batch.grape}`,
      totalWork: workCalculation.workEstimate.totalWork,
      targetId: batch.id,
      params: {
        batchId: batch.id,
        vineyardName: batch.vineyardName,
        grape: batch.grape,
        quantity: batch.quantity,
        crushingOptions,
        cost: workCalculation.cost
      },
      isCancellable: true
    });
    
    if (activityId) {
      // Success notification handled by activityManager
    } else {
      notificationService.error('Failed to create crushing activity.');
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

  // Validation function
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

  if (!batch) return null;
  if (!isOpen) return null;

  // Convert boolean options to strings for the form
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <ActivityOptionsModal
        onClose={onClose}
        title={`Crush Wine Batch`}
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
      />
    </div>
  );
};

export default CrushingOptionsModal;
