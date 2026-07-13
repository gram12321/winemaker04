import React, { useMemo, useState } from 'react';
import { useGameStateWithData } from '@/hooks';
import { getOwnedStorageVessels } from '@/lib/services';
import type { StorageVessel } from '@/lib/types/storageVessels';
import { Button, BuyMarketModal } from '@/components/ui';
import { formatNumber } from '@/lib/utils';

interface EquipmentProps {
  onNavigate?: (page: string) => void;
}

function vesselLabel(vessel: StorageVessel): string {
  return `${vessel.capacityLitres.toLocaleString()} L ${vessel.material} ${vessel.vesselType.replace('_', ' ')}`;
}

export const Equipment: React.FC<EquipmentProps> = () => {
  const vessels = useGameStateWithData(getOwnedStorageVessels, [], { topic: 'storage_vessels' });
  const [isBuyMarketOpen, setIsBuyMarketOpen] = useState(false);
  const summary = useMemo(() => vessels.reduce((result, vessel) => {
    result.totalLitres += vessel.capacityLitres;
    if (vessel.occupancy === 'available') result.availableLitres += vessel.capacityLitres;
    if (vessel.occupancy === 'reserved') result.reservedLitres += vessel.capacityLitres;
    if (vessel.occupancy === 'in_use') result.inUseLitres += vessel.capacityLitres;
    return result;
  }, { totalLitres: 0, availableLitres: 0, reservedLitres: 0, inUseLitres: 0 }), [vessels]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500">Owned cellar equipment and production capacity.</p>
        </div>
        <Button onClick={() => setIsBuyMarketOpen(true)} className="bg-amber-600 hover:bg-amber-500">Buy Equipment</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Vessels', vessels.length.toString()],
          ['Total capacity', formatNumber(summary.totalLitres, { decimals: 0 }) + ' L'],
          ['Available', formatNumber(summary.availableLitres, { decimals: 0 }) + ' L'],
          ['In use', formatNumber(summary.inUseLitres + summary.reservedLitres, { decimals: 0 }) + ' L'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Cellar Vessels</h2>
          <p className="text-xs text-gray-500">Each vessel is individually owned and has fixed capacity.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {vessels.length === 0 ? (
            <p className="text-sm text-gray-500">No Cellar Vessels owned yet. Buy casks from the market to begin production.</p>
          ) : vessels.map((vessel) => (
            <div key={vessel.id} className="rounded border border-gray-200 p-3">
              <div className="font-medium capitalize text-gray-900">{vesselLabel(vessel)}</div>
              <div className="mt-2 text-xs text-gray-500">Occupancy: <span className="capitalize">{vessel.occupancy.replace('_', ' ')}</span></div>
              <div className="text-xs text-gray-500">Condition: <span className="capitalize">{vessel.operationalStatus}</span></div>
              <div className="text-xs text-gray-500">Acquired for {formatNumber(vessel.acquisitionPrice, { currency: true, decimals: 0 })}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <h2 className="font-semibold text-gray-700">Machinery</h2>
        <p className="mt-1 text-sm text-gray-500">Machinery will appear here when its equipment family is introduced.</p>
      </section>
      <BuyMarketModal isOpen={isBuyMarketOpen} onClose={() => setIsBuyMarketOpen(false)} initialMarket="storage_vessels" />
    </div>
  );
};

export default Equipment;
