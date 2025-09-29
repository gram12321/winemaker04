import React, { useState, useMemo } from 'react';
import { GrapeVariety, Vineyard } from '@/lib/types/types';
import { createActivity } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculatePlantingWork } from '@/lib/services/activity/WorkCalculators/VineyardWorkCalculator';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/components/layout/NotificationCenter';
import { GRAPE_VARIETIES } from '@/lib/types/types';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants/activityConstants';


/**
 * Planting Options Modal
 * Modal for configuring planting options and starting planting activities
 */

interface PlantingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vineyard: Vineyard | null;
}

export const PlantingOptionsModal: React.FC<PlantingOptionsModalProps> = ({ 
  isOpen, 
  vineyard, 
  onClose
}) => {
  // State initialization
  const [options, setOptions] = useState({
    grape: 'Chardonnay' as GrapeVariety,
    density: DEFAULT_VINE_DENSITY
  });

  // Field definitions
  const fields: ActivityOptionField[] = [
    {
      id: 'grape',
      label: 'Grape Variety',
      type: 'select',
      defaultValue: options.grape,
      options: GRAPE_VARIETIES.map((grape: GrapeVariety) => ({ value: grape, label: grape })),
      required: true,
      tooltip: 'Select the type of grape to plant in this vineyard.'
    },
    {
      id: 'density',
      label: 'Planting Density (vines per hectare)',
      type: 'range',
      defaultValue: options.density,
      min: 1500,
      max: 10000,
      step: 500,
      required: true,
      tooltip: `Recommended density is around ${DEFAULT_VINE_DENSITY}. Higher density can increase yield but may affect quality and require more work.`
    }
  ];

  // Work calculation
  const workCalculation = useMemo((): { workEstimate: ActivityWorkEstimate; workFactors: WorkFactor[] } | null => {
    if (!vineyard) return null;
    
    const { totalWork, factors } = calculatePlantingWork(vineyard, { grape: options.grape, density: options.density });
    return { workEstimate: { totalWork }, workFactors: factors };
  }, [vineyard, options.grape, options.density]);

  // Event handlers
  const handleSubmit = async (submittedOptions: Record<string, any>) => {
    if (!vineyard || !workCalculation) return;
    
    const grape = submittedOptions.grape as GrapeVariety;
    const density = submittedOptions.density as number;
    
    // Create activity instead of directly planting
    const activityId = await createActivity({
      category: WorkCategory.PLANTING,
      title: `Planting ${vineyard.name}`,
      totalWork: workCalculation.workEstimate.totalWork,
      targetId: vineyard.id,
      params: {
        grape,
        density,
        targetName: vineyard.name
      },
      isCancellable: true
    });
    
    if (activityId) {
      // Success handled by notificationService in activityManager
    } else {
      notificationService.error('Failed to create planting activity.');
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  // Early returns
  if (!vineyard) return null;
  if (!isOpen) return null;

  // Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <ActivityOptionsModal
        onClose={onClose}
        title={`Plant Vineyard: ${vineyard.name}`}
        subtitle={`Configure planting options for this ${vineyard.hectares} hectare vineyard. Work calculations include grape suitability and altitude factors.`}
        category={WorkCategory.PLANTING}
        fields={fields}
        workEstimate={workCalculation?.workEstimate || { totalWork: 0 }}
        workFactors={workCalculation?.workFactors}
        onSubmit={handleSubmit}
        submitLabel="Start Planting Activity"
        options={options}
        onOptionsChange={handleOptionsChange}
      />
    </div>
  );
};

export default PlantingOptionsModal;
