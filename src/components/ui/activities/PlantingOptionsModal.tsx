import React, { useState, useMemo } from 'react';
import { GrapeVariety, Vineyard } from '@/lib/types';
import { GRAPE_VARIETIES, createActivity } from '@/lib/services';
import { getAltitudeRating } from '@/lib/services/wine/vineyardValueCalc';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { DEFAULT_VINE_DENSITY, calculateTotalWork, WorkCategory, TASK_RATES, INITIAL_WORK, DENSITY_BASED_TASKS, WorkFactor } from '@/lib/services/work';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate } from '@/components/ui';
import { notificationService } from '@/components/layout/NotificationCenter';


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
  const [options, setOptions] = useState({
    grape: 'Chardonnay' as GrapeVariety,
    density: DEFAULT_VINE_DENSITY
  });

  // Define the fields for the modal
  const fields: ActivityOptionField[] = [
    {
      id: 'grape',
      label: 'Grape Variety',
      type: 'select',
      defaultValue: options.grape,
      options: GRAPE_VARIETIES.map(grape => ({ value: grape, label: grape })),
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

  // Calculate work requirements whenever options change
  const workCalculation = useMemo((): { workEstimate: ActivityWorkEstimate; workFactors: WorkFactor[] } | null => {
    if (!vineyard) return null;
    
    // Calculate grape fragility and altitude modifiers
    const grapeMetadata = GRAPE_CONST[options.grape];
    const grapeFragility = grapeMetadata.fragile; // 0=robust, 1=fragile
    const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
    
    // Convert to work modifiers (higher fragility/altitude = more work)
    const grapeFragilityModifier = grapeFragility; // Direct modifier: fragile grapes need more work
    const altitudeModifier = (1 - altitudeRating) * 0.3; // Max 30% increase
    
    // Use generic calculateTotalWork function
    const category = WorkCategory.PLANTING;
    const rate = TASK_RATES[category];
    const initialWork = INITIAL_WORK[category];
    const workModifiers = [grapeFragilityModifier, altitudeModifier];
    
    const totalWork = calculateTotalWork(vineyard.hectares, {
      rate,
      initialWork,
      density: options.density > 0 ? options.density : undefined,
      useDensityAdjustment: DENSITY_BASED_TASKS.includes(category),
      workModifiers
    });
    
    // Build factors array for UI display
    const workFactors: WorkFactor[] = [
      {
        label: "Area to Plant",
        value: vineyard.hectares,
        unit: "hectares",
        isPrimary: true
      },
      {
        label: "Vine Density",
        value: options.density > 0 ? options.density : "Not set",
        unit: options.density > 0 ? "vines/ha" : "",
        isPrimary: true
      },
      {
        label: "Base Rate",
        value: rate,
        unit: "ha/week"
      },
      {
        label: "Initial Setup Work",
        value: initialWork,
        unit: "work units"
      }
    ];

    // Add modifiers if they exist
    if (grapeFragilityModifier > 0) {
      workFactors.push({
        label: "Grape Fragility Impact",
        value: `${(grapeFragility * 100).toFixed(0)}% fragile`,
        modifier: grapeFragilityModifier,
        modifierLabel: "grape fragility"
      });
    }

    if (altitudeModifier > 0) {
      workFactors.push({
        label: "Altitude Impact",
        value: "Difficult conditions",
        modifier: altitudeModifier,
        modifierLabel: "planting difficulty"
      });
    }
    
    return {
      workEstimate: { totalWork },
      workFactors
    };
  }, [vineyard, options.grape, options.density]);

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

  if (!vineyard) return null;

  if (!isOpen) return null;

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
