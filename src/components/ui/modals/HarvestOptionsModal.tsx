import React, { useState, useMemo } from 'react';
import { Vineyard } from '@/lib/types/types';
import { createActivity } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculateHarvestWork } from '@/lib/services/activity/VineyardWorkCalculator';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/components/layout/NotificationCenter';
import { formatNumber } from '@/lib/utils/utils';

interface HarvestOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vineyard: Vineyard | null;
}

export const HarvestOptionsModal: React.FC<HarvestOptionsModalProps> = ({ 
  isOpen, 
  vineyard, 
  onClose
}) => {
  const [options, setOptions] = useState({
    storageSelection: 'auto' // Placeholder for future storage management
  });

  // Define the fields for the modal (minimal for now)
  const fields: ActivityOptionField[] = [
    {
      id: 'storageSelection',
      label: 'Storage Management',
      type: 'select',
      defaultValue: options.storageSelection,
      options: [
        { value: 'auto', label: 'Automatic Storage (Default)' },
        { value: 'manual', label: 'Manual Storage Selection (Coming Soon)' }
      ],
      required: true,
      tooltip: 'Storage management options will be expanded in future updates.'
    }
  ];

  // Calculate expected yield and work requirements
  const harvestCalculation = useMemo((): { 
    workEstimate: ActivityWorkEstimate; 
    workFactors: WorkFactor[];
    expectedYield: number;
  } | null => {
    if (!vineyard || !vineyard.grape) return null;
    
    const { totalWork, expectedYield, factors } = calculateHarvestWork(vineyard);
    return { workEstimate: { totalWork }, workFactors: factors, expectedYield };
  }, [vineyard]);

  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!vineyard || !harvestCalculation) return;
    
    // Create harvesting activity
    const activityId = await createActivity({
      category: WorkCategory.HARVESTING,
      title: `Harvesting ${vineyard.name}`,
      totalWork: harvestCalculation.workEstimate.totalWork,
      targetId: vineyard.id,
      params: {
        grape: vineyard.grape,
        harvestedSoFar: 0,
        targetName: vineyard.name,
        storageSelection: submittedOptions.storageSelection
      },
      isCancellable: true
    });
    
    if (activityId) {
      // Success handled by notificationService in activityManager
    } else {
      notificationService.error('Failed to create harvesting activity.');
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  // Validate that harvest can proceed
  const canSubmit = () => {
    if (!vineyard || !vineyard.grape) return false;
    if (vineyard.status !== 'Growing') return false;
    return true;
  };

  // Warning message for low ripeness
  const warningMessage = useMemo(() => {
    if (!vineyard) return undefined;
    
    const ripenessPercent = (vineyard.ripeness || 0) * 100;
    if (ripenessPercent < 30) {
      return `⚠️ Low ripeness (${Math.round(ripenessPercent)}%) - harvest will yield very little. Consider waiting for grapes to ripen more.`;
    }
    return undefined;
  }, [vineyard]);

  if (!vineyard) return null;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <ActivityOptionsModal
        onClose={onClose}
        title={`Harvest Vineyard: ${vineyard.name}`}
        subtitle={`Configure harvesting options for this ${vineyard.hectares} hectare vineyard. Expected yield: ${harvestCalculation ? formatNumber(harvestCalculation.expectedYield, { decimals: 0 }) : 0} kg.`}
        category={WorkCategory.HARVESTING}
        fields={fields}
        workEstimate={harvestCalculation?.workEstimate || { totalWork: 0 }}
        workFactors={harvestCalculation?.workFactors}
        onSubmit={handleSubmit}
        submitLabel="Start Harvesting Activity"
        canSubmit={canSubmit}
        warningMessage={warningMessage}
        disabledMessage="Cannot harvest: vineyard must be in Growing status with planted grapes"
        options={options}
        onOptionsChange={handleOptionsChange}
      >
        {/* Storage Selection Placeholder */}
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Storage Options</h4>
          <div className="text-sm text-gray-600">
            <div className="flex justify-between py-1">
              <span>Expected Yield:</span>
              <span className="font-medium text-green-600">
                {harvestCalculation ? formatNumber(harvestCalculation.expectedYield, { decimals: 0 }) : 0} kg
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Selected Storage:</span>
              <span className="text-gray-500">Auto-managed (0 kg / {harvestCalculation ? formatNumber(harvestCalculation.expectedYield, { decimals: 0 }) : 0} kg)</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              📋 Storage management will be available in future updates
            </div>
          </div>
        </div>
      </ActivityOptionsModal>
    </div>
  );
};

export default HarvestOptionsModal;
