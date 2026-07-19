import React, { useCallback, useMemo, useState } from 'react';
import { Button, BuyMarketModal, WarningModal } from '@/components/ui';
import { useGameStateWithData, useLoadingState } from '@/hooks';
import {
  getAllActivities,
  getAllWineBatches,
  calculateStorageCapacitySummary,
  getOwnedStorageVessels,
  getStorageVesselDisplayName,
  getWineBatchDisplayName,
  getStorageVesselAllocationAvailability,
  getGameState,
  isStorageVesselEmptyingInProgress,
  startEmptyStorageVesselActivity,
  isStorageVesselCleaningInProgress,
  startCleanStorageVesselActivity,
} from '@/lib/services';
import type { StorageVessel } from '@/lib/types/storageVessels';
import type { WineBatch } from '@/lib/types/types';
import { formatNumber, getColorClass, getQualityInfo } from '@/lib/utils';
import { UnifiedTooltip, TooltipRow } from '@/components/ui/shadCN/tooltip';

interface EquipmentProps {
  onNavigate?: (page: string) => void;
}

export const Equipment: React.FC<EquipmentProps> = () => {
  const { withLoading } = useLoadingState();
  const vessels = useGameStateWithData(getOwnedStorageVessels, [] as StorageVessel[], { topic: 'storage_vessels' });
  const batches = useGameStateWithData(getAllWineBatches, [] as WineBatch[], { topic: 'wine_batches' });
  const activities = useGameStateWithData(getAllActivities, [], { topic: 'activities' });
  const [isBuyMarketOpen, setIsBuyMarketOpen] = useState(false);
  const [emptyingRequest, setEmptyingRequest] = useState<{ vessel: StorageVessel; batch: WineBatch } | null>(null);
  const [emptyingError, setEmptyingError] = useState<string | null>(null);
  const [cleaningRequest, setCleaningRequest] = useState<StorageVessel | null>(null);
  const [cleaningError, setCleaningError] = useState<string | null>(null);
  const summary = useMemo(() => calculateStorageCapacitySummary(vessels), [vessels]);
  const currentYear = getGameState().currentYear ?? 2024;

  const handleEmptyVessel = useCallback(async () => {
    if (!emptyingRequest) return;
    const { vessel } = emptyingRequest;
    setEmptyingRequest(null);
    await withLoading(async () => {
      const result = await startEmptyStorageVesselActivity(vessel.id);
      if (!result.success) setEmptyingError(result.error ?? 'Could not start the Empty Vessel activity.');
    });
  }, [emptyingRequest, withLoading]);

  const handleCleanVessel = useCallback(async () => {
    if (!cleaningRequest) return;
    const vessel = cleaningRequest;
    setCleaningRequest(null);
    await withLoading(async () => {
      const result = await startCleanStorageVesselActivity(vessel.id);
      if (!result.success) setCleaningError(result.error ?? 'Could not start the Clean Vessel activity.');
    });
  }, [cleaningRequest, withLoading]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500">Owned cellar equipment and production capacity.</p>
        </div>
        <Button onClick={() => setIsBuyMarketOpen(true)} className="bg-amber-600 hover:bg-amber-500">Buy Equipment</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-500">Vessels</div><div className="text-lg font-semibold">{vessels.length}</div></div>
        <div className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-500">Total capacity</div><div className="text-lg font-semibold">{formatNumber(summary.totalLitres, { decimals: 0 })} L</div></div>
        <div className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-500">Available</div><div className="text-lg font-semibold">{formatNumber(summary.availableLitres, { decimals: 0 })} L</div></div>
        <div className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-500">Reserved</div><div className="text-lg font-semibold">{formatNumber(summary.reservedLitres, { decimals: 0 })} L</div></div>
        <div className="rounded-lg border bg-white p-3"><div className="text-xs text-gray-500">In use</div><div className="text-lg font-semibold">{formatNumber(summary.inUseLitres, { decimals: 0 })} L</div></div>
      </div>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Cellar Vessels</h2></div>
        <div className="hidden grid-cols-[1.5fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr_0.7fr_1fr_1.2fr_1.8fr_auto] gap-2 border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-gray-500 md:grid">
          <span>Vessel ID</span><span>Age</span><span>Material</span><span>Size</span><span>Quality</span><span>Condition</span><span>Cleanliness</span><span>Fills</span><span>Availability</span><span>Acquisition</span><span>Contents</span><span>Actions</span>
        </div>
        <div className="divide-y">
          {vessels.length === 0 ? <p className="p-4 text-sm text-gray-500">No Cellar Vessels owned yet.</p> : vessels.map((vessel) => {
            const batch = batches.find((candidate) => candidate.id === vessel.activeWineBatchId || candidate.storagePlanId === vessel.activePlanId);
            const activity = activities.find((candidate) => candidate.params.storagePlanId === vessel.activePlanId);
            const emptyingActivity = isStorageVesselEmptyingInProgress(vessel.id);
            const cleaningActivity = isStorageVesselCleaningInProgress(vessel.id);
            const baseAvailability = getStorageVesselAllocationAvailability(vessel);
            const relatedActivities = activities.filter((candidate) =>
              (candidate.status === 'active' || candidate.status === 'paused')
              && (
                candidate.params.vesselId === vessel.id
                || (vessel.activePlanId && candidate.params.storagePlanId === vessel.activePlanId)
                || (batch && (candidate.params.batchId === batch.id || candidate.params.outputBatchId === batch.id))
              )
            );
            const availabilityReasons = [
              ...(!baseAvailability.available && baseAvailability.reason ? [baseAvailability.reason] : []),
              ...relatedActivities.map((candidate) => `Ongoing activity: ${candidate.title}`),
            ].filter((reason, index, reasons) => reasons.indexOf(reason) === index);
            const availability = { available: availabilityReasons.length === 0, reasons: availabilityReasons };

            return (
              <div key={vessel.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.5fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr_0.7fr_1fr_1.2fr_1.8fr_auto]">
                <div className="font-medium">{getStorageVesselDisplayName(vessel)}</div>
                <div className="text-xs text-gray-600">{vessel.productionYear} ({Math.max(0, currentYear - vessel.productionYear)} years)</div>
                <div className="text-xs capitalize text-gray-600">{vessel.material.replace('_', ' ')}</div>
                <div className="text-xs text-gray-600">{formatNumber(vessel.capacityLitres, { decimals: 0 })} L</div>
                <div className={`text-xs ${getColorClass(vessel.qualityScore)}`}>{getQualityInfo(vessel.qualityScore).category} ({vessel.qualityScore.toFixed(2)})</div>
                <div className="text-xs text-gray-600">{Math.round(vessel.condition * 100)}%</div>
                <div className={`text-xs font-medium ${vessel.cleanliness === 'clean' ? 'text-emerald-700' : 'text-amber-600'}`}>{vessel.cleanliness}</div>
                <div className="text-xs text-gray-600">{vessel.fillHistory}</div>
                <UnifiedTooltip
                  title={availability.available ? 'Available' : 'Unavailable'}
                  content={availability.available
                    ? <TooltipRow label="Status" value="Ready for allocation" />
                     : <div className="space-y-1">{availability.reasons.map((reason) => <TooltipRow key={reason} label="Reason" value={reason} tone="danger" />)}</div>}
                  side="top"
                  variant="panel"
                  density="compact"
                  triggerClassName="inline-block"
                  showMobileHint={true}
                  mobileHintVariant="underline"
                >
                  <div
                    className={`cursor-help text-xs font-medium ${availability.available ? 'text-emerald-700' : 'text-red-700'}`}
                    aria-label={availability.available ? 'Available for allocation' : `Unavailable: ${availability.reasons.join('; ')}`}
                  >
                    <span aria-hidden="true">●</span> {availability.available ? 'Available' : 'Unavailable'}
                  </div>
                </UnifiedTooltip>
                <div className="text-xs text-gray-600">{formatNumber(vessel.acquisitionPrice, { currency: true, decimals: 0 })}</div>
                <div className="text-xs text-gray-600">
                  {batch ? <><span className="font-medium">Contains: {batch.grape} {batch.harvestStartDate.year}, {batch.vineyardName}</span>{emptyingActivity && <div className="mt-1 text-amber-700">Emptying in progress</div>}</>
                    : activity ? `Harvesting ${activity.params.targetName ?? 'batch'}`
                      : 'Empty'}
                </div>
                <div>
                  {batch && vessel.occupancy === 'in_use' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={emptyingActivity}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => setEmptyingRequest({ vessel, batch })}
                    >
                      {emptyingActivity ? 'Emptying…' : 'Empty Vessel'}
                    </Button>
                  )}
                  {!batch && vessel.occupancy === 'available' && vessel.operationalStatus === 'operational' && vessel.cleanliness === 'dirty' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cleaningActivity}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => setCleaningRequest(vessel)}
                    >
                      {cleaningActivity ? 'Cleaning…' : 'Clean Vessel'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <BuyMarketModal isOpen={isBuyMarketOpen} onClose={() => setIsBuyMarketOpen(false)} initialMarket="storage_vessels" />
      <WarningModal
        isOpen={Boolean(emptyingRequest)}
        onClose={() => setEmptyingRequest(null)}
        severity="critical"
        title="Empty Vessel?"
        message={emptyingRequest ? `Start maintenance to discard the contents of ${getStorageVesselDisplayName(emptyingRequest.vessel)}.` : ''}
        details={emptyingRequest ? `${getWineBatchDisplayName(emptyingRequest.batch)} will lose only the volume currently held by this vessel. Other vessels holding the same batch remain allocated.` : undefined}
        actions={[
          { label: 'Cancel', variant: 'outline', onClick: () => setEmptyingRequest(null) },
          { label: 'Start Empty Vessel', variant: 'destructive', onClick: () => void handleEmptyVessel() },
        ]}
      />
      <WarningModal
        isOpen={Boolean(cleaningRequest)}
        onClose={() => setCleaningRequest(null)}
        severity="warning"
        title="Clean Vessel?"
        message={cleaningRequest ? `Start maintenance to clean ${getStorageVesselDisplayName(cleaningRequest)} for reuse.` : ''}
        actions={[
          { label: 'Cancel', variant: 'outline', onClick: () => setCleaningRequest(null) },
          { label: 'Start Clean Vessel', variant: 'default', onClick: () => void handleCleanVessel() },
        ]}
      />
      <WarningModal
        isOpen={Boolean(cleaningError)}
        onClose={() => setCleaningError(null)}
        severity="error"
        title="Clean Vessel Could Not Start"
        message={cleaningError ?? ''}
      />
      <WarningModal
        isOpen={Boolean(emptyingError)}
        onClose={() => setEmptyingError(null)}
        severity="error"
        title="Empty Vessel Could Not Start"
        message={emptyingError ?? ''}
      />
    </div>
  );
};

export default Equipment;
