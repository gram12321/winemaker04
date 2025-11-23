import React, { useState, useMemo, useEffect } from 'react';
import { GrapeVariety, Vineyard, NotificationCategory } from '@/lib/types/types';
import { createActivity } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculatePlantingWork } from '@/lib/services/activity';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate, WarningModal } from '@/components/ui';
import { notificationService } from '@/lib/services';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants/activityConstants';
import { DialogProps } from '@/lib/types/UItypes';
import { calculateGrapeSuitabilityMetrics } from '@/lib/services';
import { getBadgeColorClasses, formatNumber, getUnlockedGrapes } from '@/lib/utils';


/**
 * Planting Options Modal
 * Modal for configuring planting options and starting planting activities
 */

interface PlantingOptionsModalProps extends DialogProps {
  vineyard: Vineyard | null;
}

export const PlantingOptionsModal: React.FC<PlantingOptionsModalProps> = ({ 
  isOpen, 
  vineyard, 
  onClose
}) => {
  // State initialization
  const [unlockedGrapes, setUnlockedGrapes] = useState<GrapeVariety[]>([]);
  const [options, setOptions] = useState({
    grape: 'Chardonnay' as GrapeVariety,
    density: DEFAULT_VINE_DENSITY
  });

  // Load unlocked grapes on mount
  useEffect(() => {
    const loadUnlockedGrapes = async () => {
      const unlocked = await getUnlockedGrapes();
      setUnlockedGrapes(unlocked);
      
      // If current selection is not unlocked, switch to first unlocked grape
      if (unlocked.length > 0 && !unlocked.includes(options.grape)) {
        setOptions(prev => ({ ...prev, grape: unlocked[0] }));
      }
    };
    
    if (isOpen) {
      loadUnlockedGrapes();
    }
  }, [isOpen]);

  // Field definitions - only show unlocked grapes
  const fields: ActivityOptionField[] = [
    {
      id: 'grape',
      label: 'Grape Variety',
      type: 'select',
      defaultValue: options.grape,
      options: unlockedGrapes.length > 0 
        ? unlockedGrapes.map((grape: GrapeVariety) => ({ value: grape, label: grape }))
        : [],
      required: true,
      tooltip: unlockedGrapes.length === 0 
        ? 'No grape varieties unlocked. Complete research projects to unlock new grapes.'
        : 'Select the type of grape to plant in this vineyard.'
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

  // Grape suitability calculation
  const grapeSuitabilityMetrics = useMemo(() => {
    if (!vineyard) return null;
    return calculateGrapeSuitabilityMetrics(
      options.grape,
      vineyard.region,
      vineyard.country,
      vineyard.altitude,
      vineyard.aspect,
      vineyard.soil
    );
  }, [vineyard, options.grape]);

  const grapeSuitability = grapeSuitabilityMetrics ? grapeSuitabilityMetrics.overall : null;

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
    
    // Initialize planting immediately (set grape variety, status='Planting', density=0)
    const { initializePlanting } = await import('@/lib/services');
    const initialized = await initializePlanting(vineyard.id, grape);
    
    if (!initialized) {
      await notificationService.addMessage('Failed to initialize planting.', 'plantingOptionsModal.handlePlant', 'Planting Error', NotificationCategory.SYSTEM);
      return;
    }
    
    // Create activity for progressive density increase
    const activityId = await createActivity({
      category: WorkCategory.PLANTING,
      title: `Planting ${vineyard.name}`,
      totalWork: workCalculation.workEstimate.totalWork,
      activityDetails: `Grape: ${grape}, Density: ${density} vines/ha`,
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
      await notificationService.addMessage('Failed to create planting activity.', 'plantingOptionsModal.handlePlant', 'Planting Error', NotificationCategory.SYSTEM);
    }
    
    onClose();
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  // Early returns
  if (!vineyard) return null;
  if (!isOpen) return null;
  
  // Show message if no grapes are unlocked
  if (unlockedGrapes.length === 0) {
    return (
      <WarningModal
        isOpen={isOpen}
        onClose={onClose}
        severity="warning"
        title="No Grape Varieties Unlocked"
        message="You need to complete research projects to unlock grape varieties before you can plant them."
        details="Visit the Research panel in the Finance section to start unlocking grapes. Each grape variety requires completing its corresponding research project."
      />
    );
  }

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
      >
        {/* Grape Suitability Info */}
        {grapeSuitability !== null && grapeSuitabilityMetrics && (() => {
          const colors = getBadgeColorClasses(grapeSuitability);
          return (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Grape Suitability for {vineyard.region}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    How well {options.grape} grows in this region
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.text} ${colors.bg}`}>
                    {formatNumber(grapeSuitability * 100, { smartDecimals: true })}%
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {grapeSuitability >= 0.9 ? '✅ Excellent match - this grape thrives here!' :
                 grapeSuitability >= 0.7 ? '👍 Good match - suitable for quality wine production' :
                 grapeSuitability >= 0.5 ? '⚠️ Moderate match - can work but not ideal' :
                 '❌ Poor match - this grape struggles in this region'}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="font-medium text-gray-700">Region match</span>
                  <span>{formatNumber(grapeSuitabilityMetrics.region * 100, { smartDecimals: true })}%</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="font-medium text-gray-700">Altitude match</span>
                  <span>{formatNumber(grapeSuitabilityMetrics.altitude * 100, { smartDecimals: true })}%</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="font-medium text-gray-700">Sun exposure match</span>
                  <span>{formatNumber(grapeSuitabilityMetrics.sunExposure * 100, { smartDecimals: true })}%</span>
                </div>
              </div>
            </div>
          );
        })()}
      </ActivityOptionsModal>
    </div>
  );
};

export default PlantingOptionsModal;
