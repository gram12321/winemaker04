import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { BUY_MARKET_DOMAINS } from '@/lib/services/market/buyMarketDomainRegistry';
import type { BuyMarketWareGroup } from '@/lib/types/market';
import { GrapeMarketPanel } from './GrapeMarketPanel';
import { StorageVesselMarketPanel } from './StorageVesselMarketPanel';

interface BuyMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMarket?: BuyMarketWareGroup;
}

const BuyMarketModal: React.FC<BuyMarketModalProps> = ({ isOpen, onClose, initialMarket = 'grapes' }) => {
  const [activeDomain, setActiveDomain] = useState<BuyMarketWareGroup>(initialMarket);

  useEffect(() => {
    if (isOpen) setActiveDomain(initialMarket);
  }, [initialMarket, isOpen]);

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

      {activeDomain === 'grapes'
        ? <GrapeMarketPanel key="grapes" onClose={onClose} />
        : <StorageVesselMarketPanel key="storage_vessels" onClose={onClose} onPurchaseSuccess={onClose} />}
    </DialogContent>
  </Dialog>;
};

export default BuyMarketModal;
