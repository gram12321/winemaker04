import React from 'react';
import { useGameStateWithData } from '@/hooks';
import { getOwnedStorageVessels } from '@/lib/services';
import { formatNumber, getQualityInfo } from '@/lib/utils';

export const StorageVesselInventory: React.FC = () => {
  const vessels = useGameStateWithData(getOwnedStorageVessels, [], { topic: 'storage_vessels' });

  return <div className="bg-white rounded-lg shadow overflow-hidden">
    <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-800">Storage Vessels</h4><span className="text-xs text-gray-500">{vessels.length} owned</span></div>
    <div className="p-3">
      {vessels.length === 0 ? <p className="text-xs text-gray-500">Buy casks from the market to build winery storage. Each purchase creates an individual vessel with fixed capacity.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {vessels.map((vessel) => <div key={vessel.id} className="rounded border border-gray-200 p-2 text-xs"><div className="font-medium text-gray-800">{vessel.capacityLitres.toLocaleString()} L {vessel.material === 'oak' ? 'Oak' : vessel.material} {vessel.vesselType.replace('_', ' ')}</div><div className="mt-1 text-gray-500">Quality: {getQualityInfo(vessel.qualityScore).category} ({vessel.qualityScore.toFixed(2)})</div><div className="text-gray-500">Status: {vessel.occupancy.replace('_', ' ')}</div><div className="text-gray-500">Acquired for {formatNumber(vessel.acquisitionPrice, { currency: true, decimals: 0 })}</div></div>)}
      </div>}
    </div>
  </div>;
};
