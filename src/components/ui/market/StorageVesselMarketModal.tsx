import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import { getStorageVesselMarketOffers, purchaseStorageVesselOffer, type StorageVesselMarketOffer } from '@/lib/services/market/storageVessels/storageVesselMarketAdapter';
import { formatNumber } from '@/lib/utils';

interface StorageVesselMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowGrapes: () => void;
}

export const StorageVesselMarketModal: React.FC<StorageVesselMarketModalProps> = ({ isOpen, onClose, onShowGrapes }) => {
  const [offers, setOffers] = useState<StorageVesselMarketOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [quantityByOfferId, setQuantityByOfferId] = useState<Record<string, number>>({});
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const nextOffers = await getStorageVesselMarketOffers();
      setOffers(nextOffers);
      setSelectedOfferId((current) => current && nextOffers.some((offer) => offer.id === current) ? current : nextOffers[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void loadOffers();
  }, [isOpen, loadOffers]);

  const selectedOffer = useMemo(() => offers.find((offer) => offer.id === selectedOfferId) ?? offers[0] ?? null, [offers, selectedOfferId]);
  const getQuantity = useCallback((offer: StorageVesselMarketOffer) => Math.max(1, Math.min(quantityByOfferId[offer.id] ?? 1, offer.availableUnits)), [quantityByOfferId]);
  const selectedQuantity = selectedOffer ? getQuantity(selectedOffer) : 1;
  const selectedTotal = selectedOffer ? selectedOffer.pricePerVessel * selectedQuantity : 0;

  const columns = useMemo<MarketOfferTableColumn<StorageVesselMarketOffer>[]>(() => [
    {
      key: 'vessel', header: 'Storage Vessel', sortable: false, className: 'w-[34%] min-w-[230px]',
      render: (offer) => <div className="space-y-1"><div className="font-medium text-white">{offer.payload.capacityLitres} L {offer.payload.material === 'oak' ? 'Oak' : offer.payload.material} {offer.payload.vesselType.replace('_', ' ')}</div><div className="text-xs text-gray-400">Creates an individual fixed-capacity vessel.</div></div>,
    },
    { key: 'capacity', header: 'Capacity', sortable: false, className: 'text-right', render: (offer) => `${offer.payload.capacityLitres.toLocaleString()} L` },
    { key: 'available', header: 'Available', sortable: false, className: 'text-right', render: (offer) => `${offer.availableUnits} vessels` },
    { key: 'price', header: 'Price per vessel', sortable: false, className: 'text-right text-amber-300', render: (offer) => formatNumber(offer.pricePerVessel, { currency: true, decimals: 0 }) },
    {
      key: 'quantity', header: 'Quantity', sortable: false, className: 'w-[160px] text-right',
      render: (offer) => <div onClick={(event) => event.stopPropagation()}><MarketQuickBuyRowAction quantity={getQuantity(offer)} maxQuantity={offer.availableUnits} unitLabel="vessel(s)" disabled={loading} onQuantityChange={(quantity) => setQuantityByOfferId((current) => ({ ...current, [offer.id]: quantity }))} />{errorByOfferId[offer.id] && <div className="mt-1 flex justify-end gap-1 text-[11px] text-red-300"><AlertTriangle className="h-3 w-3" />{errorByOfferId[offer.id]}</div>}</div>,
    },
  ], [errorByOfferId, getQuantity, loading]);

  const handlePurchase = useCallback(async () => {
    if (!selectedOffer) return;
    setLoading(true);
    try {
      const result = await purchaseStorageVesselOffer(selectedOffer.id, selectedQuantity);
      if (!result.success) {
        setErrorByOfferId((current) => ({ ...current, [selectedOffer.id]: result.error ?? 'Purchase failed.' }));
        return;
      }
      await loadOffers();
    } finally {
      setLoading(false);
    }
  }, [loadOffers, selectedOffer, selectedQuantity]);

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="w-[98vw] max-w-[72rem] max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
      <DialogHeader><DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle><DialogDescription className="sr-only">Purchase individual storage vessels for the winery.</DialogDescription></DialogHeader>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onShowGrapes}>Grapes</Button><Button size="sm" className="bg-amber-600 hover:bg-amber-500">Casks</Button></div>
      <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-sm"><span className="font-medium text-cyan-200">Storage Vessels</span><p className="mt-1 text-xs text-gray-300">Each purchase creates a separately owned vessel with a fixed capacity. Wine and operation effects will be assigned explicitly in a later winery workflow.</p></div>
      <div className="rounded border border-gray-700 bg-gray-800/60 overflow-hidden"><div className="overflow-x-auto"><MarketOfferTable rows={offers} columns={columns} rowKey={(offer) => offer.id} selectedRowKey={selectedOffer?.id ?? null} onRowClick={(offer) => setSelectedOfferId(offer.id)} /></div></div>
      {selectedOffer && <div className="rounded border border-gray-700 bg-gray-800 p-3 text-sm"><div className="text-xs uppercase tracking-wide text-gray-400">Purchase summary</div><div className="mt-2 flex justify-between"><span>{selectedQuantity} vessel{selectedQuantity === 1 ? '' : 's'} × {selectedOffer.payload.capacityLitres} L</span><strong className="text-amber-300">{formatNumber(selectedTotal, { currency: true, decimals: 0 })}</strong></div></div>}
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button><Button className="bg-amber-600 hover:bg-amber-500" disabled={loading || !selectedOffer} onClick={() => void handlePurchase()}>{loading ? 'Buying…' : `Buy for ${formatNumber(selectedTotal, { currency: true, decimals: 0 })}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
