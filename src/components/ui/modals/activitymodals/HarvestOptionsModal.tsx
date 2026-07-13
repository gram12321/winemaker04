import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, NotificationCategory } from '@/lib/types/types';
import { activateActivityWithParams, cancelActivity, createActivityWithResult, getGameState } from '@/lib/services';
import { WorkCategory, WorkFactor } from '@/lib/services/activity';
import { calculateHarvestWork } from '@/lib/services/activity';
import { ActivityOptionsModal, ActivityOptionField, ActivityWorkEstimate, WeatherOperationStatusNotice } from '@/components/ui';
import { notificationService } from '@/lib/services';
import { formatNumber } from '@/lib/utils';
import { DialogProps } from '@/lib/types/UItypes';
import { previewFeatureRisks, getFeatureConfig } from '@/lib/services';
import { createWeatherWeekContext, resolveWeatherOperationImpact } from '@/lib/features/weather';
import { canStoragePlanHoldVolume, createStorageAllocationPlan, getAvailableStorageVessels, initializeHarvestVolumeLitres, releaseStorageAllocationPlan } from '@/lib/services/wine/winery/storageVesselAllocationService';
import type { StorageVessel } from '@/lib/types/storageVessels';
import { findCompatibleWineBatch } from '@/lib/services/wine/winery/inventoryService';
import type { WineBatch } from '@/lib/types/types';

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
  const [availableVessels, setAvailableVessels] = useState<StorageVessel[]>([]);
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>([]);
  const [compatibleBatch, setCompatibleBatch] = useState<WineBatch | null>(null);
  const [compatiblePlanHasCapacity, setCompatiblePlanHasCapacity] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void getAvailableStorageVessels().then(setAvailableVessels).catch(() => setAvailableVessels([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !vineyard?.grape) {
      setCompatibleBatch(null);
      return;
    }
    const year = getGameState().currentYear ?? 2026;
    void findCompatibleWineBatch(vineyard.id, vineyard.grape, year).then(setCompatibleBatch).catch(() => setCompatibleBatch(null));
  }, [isOpen, vineyard]);

  const fields: ActivityOptionField[] = [];

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

  useEffect(() => {
    if (!isOpen || !compatibleBatch?.storagePlanId || !harvestCalculation) {
      setCompatiblePlanHasCapacity(false);
      return;
    }
    const remainingYield = Math.max(0, harvestCalculation.expectedYield - compatibleBatch.quantity);
    void canStoragePlanHoldVolume(compatibleBatch.storagePlanId, (compatibleBatch.volumeLitres ?? 0) + initializeHarvestVolumeLitres(remainingYield))
      .then(setCompatiblePlanHasCapacity)
      .catch(() => setCompatiblePlanHasCapacity(false));
  }, [compatibleBatch, harvestCalculation, isOpen]);

  const weatherImpact = useMemo(() => {
    if (!vineyard) return null;
    const gameState = getGameState();
    const season = gameState.season ?? 'Spring';
    return resolveWeatherOperationImpact({
      weather: createWeatherWeekContext(gameState),
      operation: 'harvesting',
      season,
    });
  }, [vineyard, isOpen]);

  // Event handlers
  const handleSubmit = async () => {
    if (!vineyard || !harvestCalculation) return;
    const selectedCapacity = availableVessels.filter((vessel) => selectedVesselIds.includes(vessel.id)).reduce((total, vessel) => total + vessel.capacityLitres, 0);
    const remainingYield = compatibleBatch ? Math.max(0, harvestCalculation.expectedYield - compatibleBatch.quantity) : 0;
    const compatibleHasCapacity = compatibleBatch?.storagePlanId && compatibleBatch.volumeLitres !== undefined
      ? await canStoragePlanHoldVolume(compatibleBatch.storagePlanId, compatibleBatch.volumeLitres + initializeHarvestVolumeLitres(remainingYield))
      : false;
    if (!compatibleHasCapacity && selectedCapacity <= 0) return;

    const activityId = uuidv4();
    const initialParams = { grape: vineyard.grape, harvestedSoFar: compatibleHasCapacity ? compatibleBatch!.quantity : 0, targetName: vineyard.name, outputBatchId: compatibleHasCapacity ? compatibleBatch!.id : uuidv4(), storageVesselIds: compatibleHasCapacity ? [] : selectedVesselIds };
    const creation = await createActivityWithResult({
      id: activityId,
      category: WorkCategory.HARVESTING,
      title: `Harvesting ${vineyard.name}`,
      totalWork: harvestCalculation.workEstimate.totalWork,
      activityDetails: `Expected yield: ${formatNumber(harvestCalculation.expectedYield, { smartDecimals: true })} kg`,
      targetId: vineyard.id,
      params: initialParams,
      isCancellable: true,
      initialStatus: 'paused',
    });
    
    if (!creation.activityId) {
      await notificationService.addMessage(
        creation.reason || 'Failed to create harvesting activity.',
        'harvestOptionsModal.handleStartHarvest',
        creation.reason ? 'Harvest Unavailable' : 'Harvest Error',
        NotificationCategory.SYSTEM
      );
      return;
    }

    const storagePlan = compatibleHasCapacity
      ? { planId: compatibleBatch!.storagePlanId! }
      : await createStorageAllocationPlan({ requiredLitres: selectedCapacity, vesselIds: selectedVesselIds, activityId: creation.activityId });
    if (!storagePlan.planId || !(await activateActivityWithParams(creation.activityId, { ...initialParams, storagePlanId: storagePlan.planId }))) {
      if (storagePlan.planId && !compatibleHasCapacity) await releaseStorageAllocationPlan(storagePlan.planId);
      await cancelActivity(creation.activityId);
      await notificationService.addMessage(storagePlan.error || 'Could not reserve Storage Vessel capacity.', 'harvestOptionsModal.storage', 'Storage Capacity', NotificationCategory.SYSTEM);
    }
    
    onClose();
  };

  // Validation
  const canSubmit = () => {
    if (!vineyard || !vineyard.grape) return false;
    if (vineyard.status !== 'Growing') return false;
    if (!weatherImpact?.allowed) return false;
    if (!harvestCalculation) return false;
    const selectedCapacity = availableVessels.filter((vessel) => selectedVesselIds.includes(vessel.id)).reduce((total, vessel) => total + vessel.capacityLitres, 0);
    return selectedCapacity > 0 || compatiblePlanHasCapacity;
  };

  const requiredLitres = harvestCalculation ? initializeHarvestVolumeLitres(harvestCalculation.expectedYield) : 0;
  const selectedCapacity = availableVessels.filter((vessel) => selectedVesselIds.includes(vessel.id)).reduce((total, vessel) => total + vessel.capacityLitres, 0);

  // Organized warning message for consolidated display
  const organizedWarnings = useMemo(() => {
    if (!isOpen || !vineyard || !vineyard.grape) return null;

    const ripenessPercent = (vineyard.ripeness || 0) * 100;
    const riskMessages: string[] = [];

    // Low yield warning
    if (ripenessPercent < 30) {
      riskMessages.push(`⚠️ Low ripeness (${formatNumber(ripenessPercent, { smartDecimals: true })}%) - harvest will yield very little.`);
    }

    // Check all harvest features
    const harvestFeatures = previewFeatureRisks(undefined, 'harvest', vineyard);
    for (const feature of harvestFeatures) {
      const riskPercent = formatNumber(feature.newRisk * 100, { smartDecimals: true });
      riskMessages.push(`📊 ${riskPercent}% chance of ${feature.featureName} (${feature.description || ''})`);

      // Pull tips from feature config
      const config = getFeatureConfig(feature.featureId);
      if (config?.tips) {
        const harvestTips = config.tips.filter(tip => tip.triggerEvent === 'harvest');
        harvestTips.forEach(tip => riskMessages.push(tip.message));
      }
    }

    return riskMessages.length > 0 ? riskMessages : null;
  }, [isOpen, vineyard]);

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
        disabledMessage={
          weatherImpact && !weatherImpact.allowed
            ? weatherImpact.reason
            : vineyard.status !== 'Growing' || !vineyard.grape
              ? 'Cannot harvest: the vineyard must be Growing and have planted grapes.'
              : selectedCapacity <= 0 && !compatibleBatch
                ? 'Select at least one available Storage Vessel before harvesting.'
                : 'Harvesting is unavailable with the current selection.'
        }
        options={{}}
        onOptionsChange={() => undefined}
      >
        {weatherImpact && <WeatherOperationStatusNotice operation="harvesting" impact={weatherImpact} />}
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Cellar Vessels</h4>
          <div className="text-sm text-gray-600">
            <div className="flex justify-between py-1">
              <span>Expected Yield:</span>
              <span className="font-medium text-green-600">
                {harvestCalculation ? formatNumber(harvestCalculation.expectedYield, { decimals: 0 }) : 0} kg
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Selected Storage:</span>
              <span className={selectedCapacity <= 0 ? 'text-red-600' : selectedCapacity >= requiredLitres ? 'text-green-600' : 'text-amber-600'}>{selectedCapacity.toLocaleString()} L / {requiredLitres.toLocaleString()} L</span>
            </div>
            {selectedCapacity > 0 && selectedCapacity < requiredLitres && <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Selected vessels hold only {selectedCapacity.toLocaleString()} L of the projected {requiredLitres.toLocaleString()} L. Harvesting can begin, then will pause when these vessels are full so you can continue with more capacity later.</div>}
            {compatibleBatch && <div className="mt-2 rounded border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-900">This harvest will continue the existing {compatibleBatch.grape} batch when its current vessel allocation has enough remaining capacity. Otherwise, select new vessels below.</div>}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {availableVessels.length === 0 && <div className="text-sm text-red-600 sm:col-span-2">Buy a Cellar Vessel before harvesting.</div>}
              {availableVessels.map((vessel) => (
                <label key={vessel.id} className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 bg-white p-2 text-sm">
                  <input type="checkbox" checked={selectedVesselIds.includes(vessel.id)} onChange={(event) => setSelectedVesselIds((current) => event.target.checked ? [...current, vessel.id] : current.filter((id) => id !== vessel.id))} />
                  <span>{vessel.capacityLitres.toLocaleString()} L {vessel.material} {vessel.vesselType.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">Storage capacity is reserved for this harvest and tracked as wine enters the selected vessels.</p>
          </div>
        </div>

        {/* Organized Risk Warnings */}
        {organizedWarnings && organizedWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>Harvest Warnings & Information</span>
            </h4>
            <div className="text-xs text-amber-800 space-y-2">
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
