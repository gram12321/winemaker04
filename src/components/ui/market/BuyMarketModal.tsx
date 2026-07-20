import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { BUY_MARKET_DOMAINS } from '@/lib/services/market/buyMarketDomainRegistry';
import type { BuyMarketSourceFilter, BuyMarketWareGroup } from '@/lib/types/market';
import { GrapeMarketPanel } from './GrapeMarketPanel';
import { StorageVesselMarketPanel } from './StorageVesselMarketPanel';

interface BuyMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMarket?: BuyMarketWareGroup;
}

const MARKET_PANELS: Record<BuyMarketWareGroup, React.ComponentType<{ onClose: () => void; sourceFilter: BuyMarketSourceFilter }>> = {
  grapes: GrapeMarketPanel,
  storage_vessels: StorageVesselMarketPanel,
};

const BuyMarketModal: React.FC<BuyMarketModalProps> = ({ isOpen, onClose, initialMarket = 'grapes' }) => {
  const [activeDomain, setActiveDomain] = useState<BuyMarketWareGroup>(initialMarket);
  const [sourceFilter, setSourceFilter] = useState<BuyMarketSourceFilter>('all');

  useEffect(() => {
    if (isOpen) {
      setActiveDomain(initialMarket);
      setSourceFilter('all');
    }
  }, [initialMarket, isOpen]);

  const ActivePanel = MARKET_PANELS[activeDomain];

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="dark w-[98vw] max-w-[96rem] max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
      <DialogHeader>
        <DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle>
        <DialogDescription className="sr-only">Browse and purchase offers from every active Buy Market domain.</DialogDescription>
      </DialogHeader>

      <div className="flex gap-2">
        {BUY_MARKET_DOMAINS.map((domain) => <Button
          key={domain.id}
          size="sm"
          variant={activeDomain === domain.id ? 'default' : 'outline'}
          className={activeDomain === domain.id ? 'bg-amber-600 hover:bg-amber-500' : 'border-gray-600 bg-gray-800 text-white hover:bg-gray-700 hover:text-white'}
          onClick={() => setActiveDomain(domain.id)}
        >
          {domain.label}
        </Button>)}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 pb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Market source</span>
        {([
          ['all', 'All sources'],
          ['local_supplier', 'Local supplier'],
          ['global_supplier', 'Global suppliers'],
        ] as const).map(([filter, label]) => <Button
          key={filter}
          size="sm"
          variant={sourceFilter === filter ? 'default' : 'outline'}
          className={sourceFilter === filter ? 'bg-cyan-700 hover:bg-cyan-600' : 'border-gray-600 bg-gray-800 text-white hover:bg-gray-700 hover:text-white'}
          onClick={() => setSourceFilter(filter)}
        >
          {label}
        </Button>)}
      </div>

      <ActivePanel key={`${activeDomain}:${sourceFilter}`} onClose={onClose} sourceFilter={sourceFilter} />
    </DialogContent>
  </Dialog>;
};

export default BuyMarketModal;
