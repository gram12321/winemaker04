import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, DialogFooter } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import { getStorageVesselMarketOffers, purchaseStorageVesselOffer, type StorageVesselMarketOffer } from '@/lib/services/market/storageVessels/storageVesselMarketAdapter';
import { formatNumber, getColorClass, getQualityInfo } from '@/lib/utils';
import { getGameState } from '@/lib/services/core/gameState';

interface StorageVesselMarketPanelProps {
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

export const StorageVesselMarketPanel: React.FC<StorageVesselMarketPanelProps> = ({ onClose, onPurchaseSuccess }) => {
  const [offers, setOffers] = useState<StorageVesselMarketOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [quantityByOfferId, setQuantityByOfferId] = useState<Record<string, number>>({});
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('quality');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');

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

  useEffect(() => { void loadOffers(); }, [loadOffers]);

  const sortedOffers = useMemo(() => !sortDirection ? offers : [...offers].sort((left, right) => {
    const value = (offer: StorageVesselMarketOffer): string | number => ({ supplier: offer.sellerName, capacity: offer.payload.capacityLitres, age: offer.payload.productionYear, quality: offer.payload.qualityScore, available: offer.availableUnits, price: offer.pricePerVessel }[sortKey] ?? offer.payload.qualityScore);
    const result = value(left) > value(right) ? 1 : value(left) < value(right) ? -1 : 0;
    return sortDirection === 'asc' ? result : -result;
  }), [offers, sortDirection, sortKey]);
  const selectedOffer = useMemo(() => sortedOffers.find((offer) => offer.id === selectedOfferId) ?? sortedOffers[0] ?? null, [selectedOfferId, sortedOffers]);
  const getQuantity = useCallback((offer: StorageVesselMarketOffer) => Math.max(1, Math.min(quantityByOfferId[offer.id] ?? 1, offer.availableUnits)), [quantityByOfferId]);
  const selectedQuantity = selectedOffer ? getQuantity(selectedOffer) : 1;
  const selectedTotal = selectedOffer ? selectedOffer.pricePerVessel * selectedQuantity : 0;

  const headerWithTooltip = useCallback((label: string, tooltip: string) => <UnifiedTooltip title={label} content={<span className="text-xs">{tooltip}</span>}><span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span></UnifiedTooltip>, []);
  const columns = useMemo<MarketOfferTableColumn<StorageVesselMarketOffer>[]>(() => [
    { key: 'supplier', header: headerWithTooltip('Supplier', 'Cask suppliers are independent from grape and future machinery suppliers.'), sortable: true, className: 'min-w-[160px]', render: (offer) => <div><div className="font-medium text-white">{offer.sellerName}</div><div className="text-[11px] text-cyan-200">Trust {offer.supplierLoyalty?.level ?? 0}</div></div> },
    {
      key: 'vessel', header: 'Storage Vessel', sortable: false, className: 'min-w-[190px]',
      render: (offer) => <div><div className="font-medium text-white">{offer.payload.capacityLitres} L {offer.payload.material === 'oak' ? 'Oak' : offer.payload.material} {offer.payload.vesselType.replace('_', ' ')}</div></div>,
    },
    { key: 'capacity', header: headerWithTooltip('Capacity', 'Fixed capacity for each individually owned vessel.'), sortable: true, className: 'text-right', render: (offer) => `${offer.payload.capacityLitres.toLocaleString()} L` },
    { key: 'age', header: headerWithTooltip('Cask age', 'Production year and current cask age.'), sortable: true, className: 'text-right', render: (offer) => `${Math.max(0, (new Date().getFullYear() - offer.payload.productionYear))} years (${offer.payload.productionYear})` },
    { key: 'quality', header: headerWithTooltip('Quality', 'Cask quality is shown now; its gameplay effects remain deferred.'), sortable: true, className: 'text-right', render: (offer) => <span className={getColorClass(offer.payload.qualityScore)}>{getQualityInfo(offer.payload.qualityScore).category} ({offer.payload.qualityScore.toFixed(2)})</span> },
    { key: 'available', header: headerWithTooltip('Supply', 'Finite supplier stock. Cask offers do not replenish during the season.'), sortable: true, className: 'text-right', render: (offer) => `${offer.availableUnits} vessels` },
    { key: 'price', header: headerWithTooltip('Price', 'Includes size, quality, supplier relationship, and company prestige.'), sortable: true, className: 'text-right text-amber-300', render: (offer) => formatNumber(offer.pricePerVessel, { currency: true, decimals: 0 }) },
    {
      key: 'quantity', header: 'Quantity', sortable: false, className: 'w-[160px] text-right',
      render: (offer) => <div onClick={(event) => event.stopPropagation()}><MarketQuickBuyRowAction quantity={getQuantity(offer)} maxQuantity={offer.availableUnits} unitLabel="vessel(s)" disabled={loading} onQuantityChange={(quantity) => setQuantityByOfferId((current) => ({ ...current, [offer.id]: quantity }))} />{errorByOfferId[offer.id] && <div className="mt-1 flex justify-end gap-1 text-[11px] text-red-300"><AlertTriangle className="h-3 w-3" />{errorByOfferId[offer.id]}</div>}</div>,
    },
  ], [errorByOfferId, getQuantity, headerWithTooltip, loading]);

  const handlePurchase = useCallback(async () => {
    if (!selectedOffer) return;
    setLoading(true);
    try {
      const result = await purchaseStorageVesselOffer(selectedOffer.id, selectedQuantity);
      if (!result.success) {
        setErrorByOfferId((current) => ({ ...current, [selectedOffer.id]: result.error ?? 'Purchase failed.' }));
        return;
      }
      onPurchaseSuccess();
    } finally {
      setLoading(false);
    }
  }, [onPurchaseSuccess, selectedOffer, selectedQuantity]);

  const marketState = getGameState();
  const selectedRelationship = selectedOffer?.supplierLoyalty;

  return <>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs"><div className="font-medium text-cyan-200">Market outlook</div><div className="mt-2 text-gray-200">{marketState.season} supply window · {marketState.economyPhase} economy · {marketState.weatherState ?? 'Clear'} logistics</div><p className="mt-2 text-gray-400">Finite cask stock is quoted for this season. New supplier offers replace this set when the season changes.</p></div>
        <div className="rounded border border-blue-800/70 bg-blue-950/20 p-3 text-xs"><div className="flex justify-between font-medium text-blue-200"><span>Supplier trust</span><span>Level {selectedRelationship?.level ?? 0}</span></div><div className="mt-2 text-gray-200">Supplier: {selectedOffer?.sellerName ?? 'Select an offer'}</div><div className="mt-1 text-gray-300">Purchases: {selectedRelationship?.totalPurchases ?? 0} · Total bought: {selectedRelationship?.totalUnitsPurchased ?? 0} vessels</div><p className="mt-2 text-amber-200">Relationship progress is based on purchase value.</p></div>
        <div className="rounded border border-gray-700 bg-gray-800 p-3 text-xs"><div className="font-medium uppercase tracking-wide text-gray-400">Purchase summary</div><div className="mt-2 flex justify-between text-gray-200"><span>{selectedQuantity} vessel{selectedQuantity === 1 ? '' : 's'} × {selectedOffer?.payload.capacityLitres ?? 0} L</span><strong className="text-amber-300">{formatNumber(selectedTotal, { currency: true, decimals: 0 })}</strong></div><div className="mt-2 text-gray-400">Price drivers: cask capacity, quality, supplier relationship, company prestige.</div></div>
      </div>
      <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-sm"><span className="font-medium text-cyan-200">Storage Vessels</span><p className="mt-1 text-xs text-gray-300">Each purchase creates a separately owned vessel with a fixed capacity. Wine and operation effects will be assigned explicitly in a later winery workflow.</p></div>
      <div className="rounded border border-gray-700 bg-gray-800/60 overflow-hidden"><div className="overflow-x-auto"><MarketOfferTable rows={sortedOffers} columns={columns} rowKey={(offer) => offer.id} sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => { if (key !== sortKey) { setSortKey(key); setSortDirection('asc'); } else { setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'); } }} selectedRowKey={selectedOffer?.id ?? null} onRowClick={(offer) => setSelectedOfferId(offer.id)} /></div></div>
      {selectedOffer && <div className="rounded border border-gray-700 bg-gray-800 p-3 text-sm"><div className="text-xs uppercase tracking-wide text-gray-400">Purchase summary</div><div className="mt-2 flex justify-between"><span>{selectedQuantity} vessel{selectedQuantity === 1 ? '' : 's'} × {selectedOffer.payload.capacityLitres} L</span><strong className="text-amber-300">{formatNumber(selectedTotal, { currency: true, decimals: 0 })}</strong></div></div>}
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button><Button className="bg-amber-600 hover:bg-amber-500" disabled={loading || !selectedOffer} onClick={() => void handlePurchase()}>{loading ? 'Buying…' : `Buy for ${formatNumber(selectedTotal, { currency: true, decimals: 0 })}`}</Button></DialogFooter>
  </>;
};
