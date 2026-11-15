import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
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
    <DialogContent className="dark fixed inset-0 left-0 top-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-gray-900 p-0 pb-[env(safe-area-inset-bottom)] text-white sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[96rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-4 sm:overflow-y-auto sm:rounded-lg sm:border sm:border-gray-700 sm:p-4 lg:p-6">
      <DialogHeader className="shrink-0 border-b border-gray-700 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] text-left sm:border-0 sm:p-0">
        <DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle>
        <DialogDescription className="sr-only">Browse and purchase offers from every active Buy Market domain.</DialogDescription>
      </DialogHeader>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gray-700 px-3 py-3 lg:hidden">
        <label className="grid min-w-0 gap-1 text-[11px] uppercase tracking-wide text-gray-400">
          Market
          <Select value={activeDomain} onValueChange={(value) => setActiveDomain(value as BuyMarketWareGroup)}>
            <SelectTrigger className="min-h-11 min-w-0 border-gray-600 bg-gray-800 text-white" aria-label="Choose market">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUY_MARKET_DOMAINS.map((domain) => <SelectItem key={domain.id} value={domain.id}>{domain.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1 text-[11px] uppercase tracking-wide text-gray-400">
          Source
          <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as BuyMarketSourceFilter)}>
            <SelectTrigger className="min-h-11 min-w-0 border-gray-600 bg-gray-800 text-white" aria-label="Choose market source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="local_supplier">Local supplier</SelectItem>
              <SelectItem value="global_market">Global market</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="hidden flex-wrap gap-2 lg:flex">
        {BUY_MARKET_DOMAINS.map((domain) => <Button
          key={domain.id}
          size="sm"
          variant={activeDomain === domain.id ? 'default' : 'outline'}
          className={activeDomain === domain.id ? 'min-h-11 bg-amber-600 hover:bg-amber-500' : 'min-h-11 border-gray-600 bg-gray-800 text-white hover:bg-gray-700 hover:text-white'}
          onClick={() => setActiveDomain(domain.id)}
        >
          {domain.label}
        </Button>)}
      </div>

      <div className="hidden flex-wrap items-center gap-2 border-b border-gray-700 pb-3 lg:flex">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Market source</span>
        {([
          ['all', 'All sources'],
          ['local_supplier', 'Local supplier'],
          ['global_market', 'Global market'],
        ] as const).map(([filter, label]) => <Button
          key={filter}
          size="sm"
          variant={sourceFilter === filter ? 'default' : 'outline'}
          className={sourceFilter === filter ? 'min-h-11 bg-cyan-700 hover:bg-cyan-600' : 'min-h-11 border-gray-600 bg-gray-800 text-white hover:bg-gray-700 hover:text-white'}
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
