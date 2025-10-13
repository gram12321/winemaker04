import React, { useState, useMemo } from 'react';
import { Vineyard, NotificationCategory } from '@/lib/types/types';
import { createActivity } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculateHarvestWork } from '@/lib/services/activity/workcalculators/vineyardWorkCalculator';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/components/layout/NotificationCenter';
import { formatNumber } from '@/lib/utils';
import { DialogProps } from '@/lib/types/UItypes';
import { getHarvestRisks, getHarvestInfluences } from '@/lib/services/wine/features/featureRiskHelper';

/**
 * Harvest Options Modal
 * Modal for configuring harvest options and starting harvest activities
 */

interface HarvestOptionsModalProps extends DialogProps {
  vineyard: Vineyard | null;
}

export const HarvestOptionsModal: React.FC<HarvestOptionsModalProps> = ({ 
  isOpen, 
  vineyard, 
  onClose
}) => {
  // State initialization
  const [options, setOptions] = useState({
    storageSelection: 'auto' // Placeholder for future storage management
  });

  // Field definitions
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

  // Work calculation
  const harvestCalculation = useMemo((): { 
    workEstimate: ActivityWorkEstimate; 
    workFactors: WorkFactor[];
    expectedYield: number;
  } | null => {
    if (!vineyard || !vineyard.grape) return null;
    
    const { totalWork, expectedYield, factors } = calculateHarvestWork(vineyard);
    return { workEstimate: { totalWork }, workFactors: factors, expectedYield };
  }, [vineyard]);

  // Event handlers
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
      await notificationService.addMessage('Failed to create harvesting activity.', 'harvestOptionsModal.handleStartHarvest', 'Harvest Error', NotificationCategory.SYSTEM);
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  // Validation
  const canSubmit = () => {
    if (!vineyard || !vineyard.grape) return false;
    if (vineyard.status !== 'Growing') return false;
    return true;
  };

  // Organized warning message for consolidated display
  const organizedWarnings = useMemo(() => {
    if (!vineyard) return null;

    const ripenessPercent = (vineyard.ripeness || 0) * 100;
    const riskMessages: string[] = [];

    // Low yield warning
    if (ripenessPercent < 30) {
      riskMessages.push(`⚠️ Low ripeness (${Math.round(ripenessPercent)}%) - harvest will yield very little.`);
    }

    // Check harvest risks only (not influences)
    const harvestRisks = getHarvestRisks(undefined, 'harvest', vineyard);
    for (const risk of harvestRisks) {
      const riskPercent = (risk.newRisk * 100).toFixed(1);
      riskMessages.push(`📊 ${riskPercent}% chance of ${risk.featureName} (${risk.description || ''})`);

      // Add tips based on feature
      if (risk.config.id === 'green_flavor') {
        riskMessages.push(`💡 TIP: Wait for ripeness ≥ 50% to avoid green flavor risk.`);
      }
    }

    // Check harvest influences (positive features)
    const harvestInfluences = getHarvestInfluences(undefined, 'harvest', vineyard);
    for (const influence of harvestInfluences) {
      if (influence.config.id === 'terroir') {
        riskMessages.push(`🌿 Terroir Expression will develop in this wine over time, enhancing quality and characteristics.`);
      }
    }

    return riskMessages.length > 0 ? riskMessages : null;
  }, [vineyard]);

  // Early returns
  if (!vineyard) return null;
  if (!isOpen) return null;

  // Render
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

        {/* Organized Risk Warnings */}
        {organizedWarnings && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>Harvest Warnings & Information</span>
            </h4>
            <div className="text-sm text-amber-800 space-y-2">
              {organizedWarnings.map((warning, index) => (
                <div key={index} className="mb-1">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}
      </ActivityOptionsModal>
    </div>
  );
};

export default HarvestOptionsModal;
