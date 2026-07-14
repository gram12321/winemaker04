import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, DialogFooter } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import { BuyGoodsSupplierTrustPanel, getBuyGoodsSupplierTrustColor } from './BuyGoodsSupplierTrustPanel';
import {
  getStorageVesselMarketOffers,
  purchaseStorageVesselOffer,
  type StorageVesselMarketOffer,
  type StorageVesselPriceBreakdown,
} from '@/lib/services/market/storageVessels/storageVesselMarketAdapter';
import { formatNumber, getColorClass, getQualityInfo } from '@/lib/utils';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getGameState } from '@/lib/services/core/gameState';
import { STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES } from '@/lib/constants';
import {
  BUY_GOODS_SUPPLIER_LEVELS,
  getBuyGoodsSupplierTrustPreview,
} from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';

interface StorageVesselMarketPanelProps {
  onClose: () => void;
}

function getPriceDriverSummary(priceBreakdown: StorageVesselPriceBreakdown): { increases: string[]; reduces: string[] } {
  const increases: string[] = [];
  const reduces: string[] = [];
  const classify = (multiplier: number, label: string) => {
    if (multiplier > 1.01) increases.push(label);
    if (multiplier < 0.99) reduces.push(label);
  };

  classify(priceBreakdown.capacityMultiplier, 'vessel size');
  classify(priceBreakdown.qualityMultiplier, 'cask quality');
  classify(priceBreakdown.supplierBaseMultiplier, 'supplier terms');
  classify(priceBreakdown.supplierRelationshipMultiplier, 'supplier relationship');
  classify(priceBreakdown.companyPrestigeMultiplier, 'company reputation');

  return { increases, reduces };
}

const PriceCalculationTooltip: React.FC<{
  breakdown: StorageVesselPriceBreakdown;
  children: React.ReactNode;
}> = ({ breakdown, children }) => (
  <UnifiedTooltip
    title="Cask price calculation"
    content={(
      <div className="min-w-[230px] space-y-1 text-xs leading-snug">
        <div className="text-gray-300">Base price x vessel size x quality x supplier terms x relationship x company reputation.</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span>Base price ({STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES} L)</span><span className="text-right">{formatNumber(breakdown.basePrice, { currency: true, decimals: 0 })}</span>
          <span>Vessel size</span><span className="text-right">x{breakdown.capacityMultiplier.toFixed(2)}</span>
          <span>Cask quality ({Math.round(breakdown.qualityScore * 100)}%)</span><span className="text-right">x{breakdown.qualityMultiplier.toFixed(2)}</span>
          <span>Supplier terms</span><span className="text-right">x{breakdown.supplierBaseMultiplier.toFixed(2)}</span>
          <span>Supplier relationship</span><span className="text-right">x{breakdown.supplierRelationshipMultiplier.toFixed(2)}</span>
          <span>Company reputation</span><span className="text-right">x{breakdown.companyPrestigeMultiplier.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-600 pt-1 text-gray-300">
          Floor: {formatNumber(breakdown.minimumPrice, { currency: true, decimals: 0 })} · Cap: {formatNumber(breakdown.maximumPrice, { currency: true, decimals: 0 })} · Final: {formatNumber(breakdown.finalPricePerVessel, { currency: true, decimals: 0 })}
        </div>
      </div>
    )}
  >
    {children}
  </UnifiedTooltip>
);

export const StorageVesselMarketPanel: React.FC<StorageVesselMarketPanelProps> = ({ onClose }) => {
  const [offers, setOffers] = useState<StorageVesselMarketOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [quantityByOfferId, setQuantityByOfferId] = useState<Record<string, number>>({});
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('quality');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [companyValue, setCompanyValue] = useState(0);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOffers, computedCompanyValue] = await Promise.all([
        getStorageVesselMarketOffers(),
        calculateCompanyValue().catch(() => 0),
      ]);
      setOffers(nextOffers);
      setCompanyValue(computedCompanyValue);
      setSelectedOfferId((current) => current && nextOffers.some((offer) => offer.id === current) ? current : nextOffers[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOffers(); }, [loadOffers]);

  const sortedOffers = useMemo(() => !sortDirection ? offers : [...offers].sort((left, right) => {
    const value = (offer: StorageVesselMarketOffer): string | number => ({
      supplier: offer.sellerName,
      capacity: offer.payload.capacityLitres,
      age: offer.payload.productionYear,
      quality: offer.payload.qualityScore,
      available: offer.availableUnits,
      price: offer.pricePerVessel,
    }[sortKey] ?? offer.payload.qualityScore);
    const result = value(left) > value(right) ? 1 : value(left) < value(right) ? -1 : 0;
    return sortDirection === 'asc' ? result : -result;
  }), [offers, sortDirection, sortKey]);

  const selectedOffer = useMemo(() => sortedOffers.find((offer) => offer.id === selectedOfferId) ?? sortedOffers[0] ?? null, [selectedOfferId, sortedOffers]);
  const getQuantity = useCallback((offer: StorageVesselMarketOffer) => Math.max(1, Math.min(quantityByOfferId[offer.id] ?? 1, offer.availableUnits)), [quantityByOfferId]);
  const selectedQuantity = selectedOffer ? getQuantity(selectedOffer) : 1;
  const selectedPriceBreakdown = selectedOffer?.priceBreakdown;
  const selectedTotal = selectedOffer ? selectedOffer.pricePerVessel * selectedQuantity : 0;
  const marketState = getGameState();
  const selectedRelationship = selectedOffer?.supplierLoyalty;
  const currentYear = marketState.currentYear ?? 0;

  const trustPreview = useMemo(() => {
    if (!selectedOffer) return null;
    return getBuyGoodsSupplierTrustPreview(selectedRelationship, selectedTotal, companyValue, currentYear);
  }, [companyValue, currentYear, selectedOffer, selectedRelationship, selectedTotal]);

  const headerWithTooltip = useCallback((label: string, tooltip: string) => (
    <UnifiedTooltip title={label} content={<span className="text-xs leading-snug">{tooltip}</span>}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span>
    </UnifiedTooltip>
  ), []);

  const columns = useMemo<MarketOfferTableColumn<StorageVesselMarketOffer>[]>(() => [
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      className: 'min-w-[180px]',
      render: (offer) => {
        const level = offer.supplierLoyalty?.level ?? 0;
        return <div><div className="font-medium text-white">{offer.sellerName}</div><div className={`text-[11px] ${getBuyGoodsSupplierTrustColor(level)}`}>Trust {level} · {BUY_GOODS_SUPPLIER_LEVELS[level].name}</div></div>;
      },
    },
    {
      key: 'vessel',
      header: 'Storage Vessel',
      sortable: false,
      className: 'min-w-[190px]',
      render: (offer) => <div><div className="font-medium text-white">{offer.payload.capacityLitres} L {offer.payload.material === 'oak' ? 'Oak' : offer.payload.material} {offer.payload.vesselType.replace('_', ' ')}</div></div>,
    },
    { key: 'capacity', header: headerWithTooltip('Capacity', 'Fixed capacity for each individually owned vessel.'), sortable: true, className: 'text-right', render: (offer) => `${offer.payload.capacityLitres.toLocaleString()} L` },
    { key: 'age', header: headerWithTooltip('Cask age', 'Production year and current cask age.'), sortable: true, className: 'text-right', render: (offer) => `${Math.max(0, (currentYear || offer.payload.productionYear) - offer.payload.productionYear)} years (${offer.payload.productionYear})` },
    { key: 'quality', header: headerWithTooltip('Quality', 'Cask quality is shown now; its gameplay effects remain deferred.'), sortable: true, className: 'text-right', render: (offer) => <span className={getColorClass(offer.payload.qualityScore)}>{getQualityInfo(offer.payload.qualityScore).category} ({offer.payload.qualityScore.toFixed(2)})</span> },
    { key: 'available', header: headerWithTooltip('Supply', 'Finite supplier stock. Cask offers do not replenish during the season.'), sortable: true, className: 'text-right', render: (offer) => `${offer.availableUnits} vessels` },
    {
      key: 'price',
      header: headerWithTooltip('Price', 'Hover the price to see vessel size, quality, supplier terms, relationship, and company reputation factors.'),
      sortable: true,
      className: 'text-right text-amber-300',
      render: (offer) => <PriceCalculationTooltip breakdown={offer.priceBreakdown}><span className="cursor-help underline decoration-dotted underline-offset-2">{formatNumber(offer.pricePerVessel, { currency: true, decimals: 0 })}</span></PriceCalculationTooltip>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      sortable: false,
      className: 'w-[160px] text-right',
      render: (offer) => <div onClick={(event) => event.stopPropagation()}><MarketQuickBuyRowAction quantity={getQuantity(offer)} maxQuantity={offer.availableUnits} unitLabel="vessel(s)" disabled={loading} onQuantityChange={(quantity) => setQuantityByOfferId((current) => ({ ...current, [offer.id]: quantity }))} />{errorByOfferId[offer.id] && <div className="mt-1 flex justify-end gap-1 text-[11px] text-red-300"><AlertTriangle className="h-3 w-3" />{errorByOfferId[offer.id]}</div>}</div>,
    },
  ], [currentYear, errorByOfferId, getQuantity, headerWithTooltip, loading]);

  const handlePurchase = useCallback(async () => {
    if (!selectedOffer) return;
    setLoading(true);
    try {
      const result = await purchaseStorageVesselOffer(selectedOffer.id, selectedQuantity);
      if (!result.success) {
        setErrorByOfferId((current) => ({ ...current, [selectedOffer.id]: result.error ?? 'Purchase failed.' }));
        return;
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose, selectedOffer, selectedQuantity]);

  const totalAvailable = offers.reduce((total, offer) => total + offer.availableUnits, 0);
  const drivers = selectedPriceBreakdown ? getPriceDriverSummary(selectedPriceBreakdown) : null;

  return <>
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
      <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-cyan-200">Market outlook</span>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-900/30 px-2 py-1 text-emerald-200">{marketState.season} rotation</span>
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-gray-300">
          <div><span className="font-medium text-cyan-300">Supply outlook:</span> {totalAvailable} casks across {offers.length} rotating supplier offers.</div>
          <div><span className="font-medium text-amber-300">Rotation:</span> Unpurchased stock is replaced or retained when the season changes.</div>
          <div><span className="font-medium text-blue-300">Price outlook:</span> Capacity and quality set vessel value; supplier terms, trust, and reputation adjust the quote.</div>
        </div>
      </div>

      <BuyGoodsSupplierTrustPanel supplierName={selectedOffer?.sellerName} relationship={selectedRelationship} companyValue={companyValue} currentYear={currentYear} unitsLabel="vessels" />

      {selectedOffer && selectedPriceBreakdown ? (
        <div className="rounded border border-gray-700/70 bg-gray-800 p-3 text-sm">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Purchase Summary</div>
          <div className="flex items-end justify-between gap-3 border-b border-gray-700 pb-3">
            <div>
              <PriceCalculationTooltip breakdown={selectedPriceBreakdown}>
                <div className="cursor-help text-2xl font-bold text-amber-300 underline decoration-dotted underline-offset-4">{formatNumber(selectedPriceBreakdown.finalPricePerVessel, { currency: true, decimals: 0 })}<span className="ml-1 text-sm font-normal text-gray-400 no-underline">/cask</span></div>
              </PriceCalculationTooltip>
              <div className="mt-1 text-xs text-gray-400">Final market price</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-300">{selectedQuantity} cask{selectedQuantity === 1 ? '' : 's'} · {selectedOffer.payload.capacityLitres.toLocaleString()} L each</div>
              <div className="text-lg font-bold text-amber-400">{formatNumber(selectedTotal, { currency: true, decimals: 0 })} total</div>
            </div>
          </div>
          <div className="mt-3 text-xs">
            <UnifiedTooltip title="What affects cask price?" content={<span className="text-xs leading-snug">Vessel size, cask quality, supplier terms, supplier relationship, and company reputation move the final price. Hover the price for the exact multiplier breakdown.</span>}>
              <div className="inline-flex cursor-help items-center gap-1 text-gray-400"><span>Price drivers</span><span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300">?</span></div>
            </UnifiedTooltip>
            {drivers && drivers.increases.length > 0 && <div className="mt-1 text-amber-200">Higher: {drivers.increases.join(' · ')}</div>}
            {drivers && drivers.reduces.length > 0 && <div className="mt-1 text-emerald-200">Lower: {drivers.reduces.join(' · ')}</div>}
            {drivers && drivers.increases.length === 0 && drivers.reduces.length === 0 && <div className="mt-1 text-gray-300">Close to the reference cask price.</div>}
          </div>
          {trustPreview && <div className="mt-2 border border-gray-700/70 bg-gray-900/40 p-2 text-xs text-cyan-300">Trust preview: +{trustPreview.appliedPoints.toLocaleString()} points this purchase{trustPreview.cappedPoints > 0 ? ` (${trustPreview.rawPoints.toLocaleString()} raw, ${trustPreview.cappedPoints.toLocaleString()} capped by yearly limit)` : ''}</div>}
        </div>
      ) : (
        <div className="rounded border border-gray-700/70 bg-gray-800 p-3 text-sm text-gray-300">Select an offer to inspect price breakdown.</div>
      )}
    </div>

    <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-sm"><span className="font-medium text-cyan-200">Storage Vessels</span><p className="mt-1 text-xs text-gray-300">Each purchase creates a separately owned vessel with a fixed capacity. Wine and operation effects will be assigned explicitly in a later winery workflow.</p></div>
    <div className="overflow-hidden rounded border border-gray-700 bg-gray-800/60"><div className="overflow-x-auto"><MarketOfferTable rows={sortedOffers} columns={columns} rowKey={(offer) => offer.id} sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => { if (key !== sortKey) { setSortKey(key); setSortDirection('asc'); } else { setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'); } }} selectedRowKey={selectedOffer?.id ?? null} onRowClick={(offer) => setSelectedOfferId(offer.id)} /></div></div>
    {sortedOffers.length === 0 && <div className="rounded border border-gray-700 bg-gray-800/90 p-4 text-sm text-gray-300">No cask offers are currently available.</div>}

    <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button><Button className="bg-amber-600 hover:bg-amber-500" disabled={loading || !selectedOffer} onClick={() => void handlePurchase()}>{loading ? 'Buying...' : `Buy for ${formatNumber(selectedTotal, { currency: true, decimals: 0 })}`}</Button></DialogFooter>
  </>;
};
