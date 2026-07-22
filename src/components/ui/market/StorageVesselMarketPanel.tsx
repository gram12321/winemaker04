import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, DialogFooter } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import { BuyMarketCounterpartyPanel, getBuyMarketCounterpartyTrustColor } from './BuyMarketCounterpartyPanel';
import {
  getStorageVesselMarketOffers,
  purchaseUsedStorageVesselOffer,
  type StorageVesselMarketOffer,
  type StorageVesselPriceBreakdown,
} from '@/lib/services/market/storageVessels/storageVesselMarketAdapter';
import { purchaseBuyMarketOfferForDomain } from '@/lib/services/market/buyMarketService';
import { formatNumber, getColorClass, getQualityInfo } from '@/lib/utils';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getGameState } from '@/lib/services/core/gameState';
import { STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES } from '@/lib/constants/storageVesselConstants';
import {
  BUY_MARKET_COUNTERPARTY_LEVELS,
  getBuyMarketRelationshipPreview,
} from '@/lib/services/market/buyMarketCounterpartyRelationshipService';
import { getBuyMarketOfferSourcePresentation, isBuyMarketOfferInSourceFilter } from '@/lib/services/market/buyMarketOfferSource';
import type { BuyMarketSourceFilter } from '@/lib/types/market';

interface StorageVesselMarketPanelProps {
  onClose: () => void;
  sourceFilter?: BuyMarketSourceFilter;
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
  classify(priceBreakdown.ageMultiplier, 'cask age');
  classify(priceBreakdown.supplierBaseMultiplier, 'supplier terms');
  classify(priceBreakdown.conditionMultiplier, 'vessel condition');
  classify(priceBreakdown.fillHistoryMultiplier, 'fill history');
  classify(priceBreakdown.supplierRelationshipMultiplier, 'market relationship');
  classify(priceBreakdown.companyPrestigeMultiplier, 'company reputation');

  return { increases, reduces };
}

const PriceCalculationTooltip: React.FC<{
  breakdown: StorageVesselPriceBreakdown;
  isSupplierStock: boolean;
  children: React.ReactNode;
}> = ({ breakdown, isSupplierStock, children }) => (
  <UnifiedTooltip
    title="Cask price calculation"
    content={(
      <div className="min-w-[230px] space-y-1 text-xs leading-snug">
        <div className="text-gray-300">Base price x vessel size x quality x age x condition x fills x cleanliness x market relationship.{isSupplierStock ? ' Local supplier stock also uses supplier terms and company reputation.' : ''}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span>Base price ({STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES} L)</span><span className="text-right">{formatNumber(breakdown.basePrice, { currency: true, decimals: 0 })}</span>
          <span>Vessel size</span><span className="text-right">x{breakdown.capacityMultiplier.toFixed(2)}</span>
          <span>Cask quality ({Math.round(breakdown.qualityScore * 100)}%)</span><span className="text-right">x{breakdown.qualityMultiplier.toFixed(2)}</span>
          <span>Cask age ({breakdown.ageYears} years)</span><span className="text-right">x{breakdown.ageMultiplier.toFixed(2)}</span>
          <span>Cleanliness</span><span className="text-right">x{breakdown.cleanlinessMultiplier.toFixed(2)}</span>
          <span>Condition</span><span className="text-right">x{breakdown.conditionMultiplier.toFixed(2)}</span>
          <span>Fill history</span><span className="text-right">x{breakdown.fillHistoryMultiplier.toFixed(2)}</span>
          {isSupplierStock && <><span>Supplier terms</span><span className="text-right">x{breakdown.supplierBaseMultiplier.toFixed(2)}</span>
          <span>Company reputation</span><span className="text-right">x{breakdown.companyPrestigeMultiplier.toFixed(2)}</span></>}
          <span>Market relationship</span><span className="text-right">x{breakdown.supplierRelationshipMultiplier.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-600 pt-1 text-gray-300">
          {Number.isFinite(breakdown.minimumPrice) && Number.isFinite(breakdown.maximumPrice)
            ? <>Floor: {formatNumber(breakdown.minimumPrice, { currency: true, decimals: 0 })} · Cap: {formatNumber(breakdown.maximumPrice, { currency: true, decimals: 0 })} · </>
            : 'Calculated price · '}
          Final: {formatNumber(breakdown.finalPricePerVessel, { currency: true, decimals: 0 })}
        </div>
      </div>
    )}
  >
    {children}
  </UnifiedTooltip>
);

export const StorageVesselMarketPanel: React.FC<StorageVesselMarketPanelProps> = ({ onClose, sourceFilter = 'all' }) => {
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

  const filteredOffers = useMemo(() => offers.filter((offer) => isBuyMarketOfferInSourceFilter(offer, sourceFilter)), [offers, sourceFilter]);

  const sortedOffers = useMemo(() => !sortDirection ? filteredOffers : [...filteredOffers].sort((left, right) => {
    const value = (offer: StorageVesselMarketOffer): string | number => ({
      supplier: offer.source.seller.name,
      source: offer.source.kind,
      vessel: offer.payload.vesselName ?? '',
      capacity: offer.payload.capacityLitres,
      age: offer.payload.productionYear,
      quality: offer.payload.qualityScore,
      available: offer.availableUnits,
      price: offer.pricePerVessel,
    }[sortKey] ?? offer.payload.qualityScore);
    const result = value(left) > value(right) ? 1 : value(left) < value(right) ? -1 : 0;
    return sortDirection === 'asc' ? result : -result;
  }), [filteredOffers, sortDirection, sortKey]);

  const selectedOffer = useMemo(() => sortedOffers.find((offer) => offer.id === selectedOfferId) ?? sortedOffers[0] ?? null, [selectedOfferId, sortedOffers]);
  const getQuantity = useCallback((offer: StorageVesselMarketOffer) => Math.max(1, Math.min(quantityByOfferId[offer.id] ?? 1, offer.availableUnits)), [quantityByOfferId]);
  const selectedQuantity = selectedOffer ? getQuantity(selectedOffer) : 1;
  const selectedPriceBreakdown = selectedOffer?.priceBreakdown;
  const selectedTotal = selectedOffer ? selectedOffer.pricePerVessel * selectedQuantity : 0;
  const marketState = getGameState();
  const selectedRelationship = selectedOffer?.counterpartyRelationship;
  const currentYear = marketState.currentYear ?? 0;

  const trustPreview = useMemo(() => {
    if (!selectedOffer) return null;
    return getBuyMarketRelationshipPreview(selectedRelationship, selectedTotal, companyValue, currentYear);
  }, [companyValue, currentYear, selectedOffer, selectedRelationship, selectedTotal]);

  const headerWithTooltip = useCallback((label: string, tooltip: string) => (
    <UnifiedTooltip title={label} content={<span className="text-xs leading-snug">{tooltip}</span>}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span>
    </UnifiedTooltip>
  ), []);

  const columns = useMemo<MarketOfferTableColumn<StorageVesselMarketOffer>[]>(() => [
    {
      key: 'source',
      header: 'Market source',
      sortable: true,
      className: 'min-w-[180px]',
      render: (offer) => {
        const source = getBuyMarketOfferSourcePresentation(offer.source);
        const level = offer.counterpartyRelationship?.level ?? 0;
        return <div><div className="font-medium text-white">{source.label}</div><div className="text-[11px] text-gray-300">{source.sellerLabel}</div><div className={`text-[11px] ${getBuyMarketCounterpartyTrustColor(level)}`}>Relationship {level} · {BUY_MARKET_COUNTERPARTY_LEVELS[level].name}</div></div>;
      },
    },
    {
      key: 'vessel',
      header: 'Vessel ID',
      sortable: false,
      className: 'min-w-[190px]',
      render: (offer) => <div className="font-medium text-white">{offer.payload.vesselName ?? 'Assigned on purchase'}</div>,
    },
    { key: 'capacity', header: headerWithTooltip('Capacity', 'Fixed capacity for each individually owned vessel.'), sortable: true, className: 'text-right', render: (offer) => `${offer.payload.capacityLitres.toLocaleString()} L` },
    { key: 'material', header: 'Material', sortable: false, className: 'text-right capitalize', render: (offer) => offer.payload.material.replace('_', ' ') },
    { key: 'age', header: headerWithTooltip('Cask age', 'Production year and current cask age.'), sortable: true, className: 'text-right', render: (offer) => `${Math.max(0, (currentYear || offer.payload.productionYear) - offer.payload.productionYear)} years (${offer.payload.productionYear})` },
    { key: 'quality', header: headerWithTooltip('Quality', 'Cask quality is shown now; its gameplay effects remain deferred.'), sortable: true, className: 'text-right', render: (offer) => <span className={getColorClass(offer.payload.qualityScore)}>{getQualityInfo(offer.payload.qualityScore).category} ({offer.payload.qualityScore.toFixed(2)})</span> },
    { key: 'condition', header: 'Condition', sortable: false, className: 'text-right', render: (offer) => `${Math.round((offer.payload.condition ?? 1) * 100)}%` },
    { key: 'fills', header: 'Fills', sortable: false, className: 'text-right', render: (offer) => offer.payload.fillHistory ?? 0 },
    { key: 'cleanliness', header: 'Cleanliness', sortable: false, className: 'text-right capitalize', render: (offer) => offer.payload.cleanliness ?? 'clean' },
    { key: 'available', header: headerWithTooltip('Supply', 'Global assets are one-off. Local supplier stock is company-specific.'), sortable: true, className: 'text-right', render: (offer) => offer.source.kind === 'supplier_stock' ? `${offer.availableUnits} vessels` : '1 vessel' },
    {
      key: 'price',
      header: headerWithTooltip('Price', 'Hover the price to see the factors used for this market source.'),
      sortable: true,
      className: 'text-right text-amber-300',
      render: (offer) => <PriceCalculationTooltip breakdown={offer.priceBreakdown} isSupplierStock={offer.source.kind === 'supplier_stock'}><span className="cursor-help underline decoration-dotted underline-offset-2">{formatNumber(offer.pricePerVessel, { currency: true, decimals: 0 })}</span></PriceCalculationTooltip>,
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
      const result = selectedOffer.kind === 'used_listing'
        ? await purchaseUsedStorageVesselOffer(selectedOffer)
        : await purchaseBuyMarketOfferForDomain('storage_vessels', selectedOffer.id, selectedQuantity);
      if (!result.success) {
        setErrorByOfferId((current) => ({ ...current, [selectedOffer.id]: result.error ?? 'Purchase failed.' }));
        return;
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose, selectedOffer, selectedQuantity]);

  const totalAvailable = filteredOffers.reduce((total, offer) => total + offer.availableUnits, 0);
  const drivers = selectedPriceBreakdown ? getPriceDriverSummary(selectedPriceBreakdown) : null;

  return <>
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
      <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-cyan-200">Market outlook</span>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-900/30 px-2 py-1 text-emerald-200">{marketState.season} rotation</span>
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-gray-300">
          <div><span className="font-medium text-cyan-300">Supply outlook:</span> {totalAvailable} casks across {filteredOffers.length} offers.</div>
          <div><span className="font-medium text-amber-300">Rotation:</span> Local supplier stock rotates by season; global assets evolve from their listing date.</div>
          <div><span className="font-medium text-blue-300">Price outlook:</span> Each adapter sets its base value; your relationship with the displayed seller adjusts your quote.</div>
        </div>
      </div>

      <BuyMarketCounterpartyPanel counterpartyName={selectedOffer?.source.seller.name} relationship={selectedRelationship} companyValue={companyValue} currentYear={currentYear} unitsLabel="vessels" />

      {selectedOffer && selectedPriceBreakdown ? (
        <div className="rounded border border-gray-700/70 bg-gray-800 p-3 text-sm">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Purchase Summary</div>
          <div className="flex items-end justify-between gap-3 border-b border-gray-700 pb-3">
            <div>
              <PriceCalculationTooltip breakdown={selectedPriceBreakdown} isSupplierStock={selectedOffer.source.kind === 'supplier_stock'}>
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
            <UnifiedTooltip title="What affects cask price?" content={<span className="text-xs leading-snug">Vessel state and the seller relationship adjust each quote. Local supplier stock also has supplier terms and company reputation. Hover the price for exact multipliers.</span>}>
              <div className="inline-flex cursor-help items-center gap-1 text-gray-400"><span>Price drivers</span><span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300">?</span></div>
            </UnifiedTooltip>
            {drivers && drivers.increases.length > 0 && <div className="mt-1 text-amber-200">Higher: {drivers.increases.join(' · ')}</div>}
            {drivers && drivers.reduces.length > 0 && <div className="mt-1 text-emerald-200">Lower: {drivers.reduces.join(' · ')}</div>}
            {drivers && drivers.increases.length === 0 && drivers.reduces.length === 0 && <div className="mt-1 text-gray-300">Close to the reference cask price.</div>}
          </div>
          {trustPreview && <div className="mt-2 border border-gray-700/70 bg-gray-900/40 p-2 text-xs text-cyan-300">Relationship preview: +{trustPreview.appliedPoints.toLocaleString()} points this purchase{trustPreview.cappedPoints > 0 ? ` (${trustPreview.rawPoints.toLocaleString()} raw, ${trustPreview.cappedPoints.toLocaleString()} capped by yearly limit)` : ''}</div>}
        </div>
      ) : (
        <div className="rounded border border-gray-700/70 bg-gray-800 p-3 text-sm text-gray-300">Select an offer to inspect price breakdown.</div>
      )}
    </div>

    <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-sm"><span className="font-medium text-cyan-200">Storage Vessels</span><p className="mt-1 text-xs text-gray-300">Supplier casks are new stock. Used listings are the same globally listed assets and retain their name, material, condition, cleanliness, age, and fill history when purchased.</p></div>
    <div className="overflow-hidden rounded border border-gray-700 bg-gray-800/60"><div className="overflow-x-auto"><MarketOfferTable rows={sortedOffers} columns={columns} rowKey={(offer) => offer.id} sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => { if (key !== sortKey) { setSortKey(key); setSortDirection('asc'); } else { setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'); } }} selectedRowKey={selectedOffer?.id ?? null} onRowClick={(offer) => setSelectedOfferId(offer.id)} /></div></div>
    {sortedOffers.length === 0 && <div className="rounded border border-gray-700 bg-gray-800/90 p-4 text-sm text-gray-300">No cask offers are currently available for this source.</div>}

    <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button><Button className="bg-amber-600 hover:bg-amber-500" disabled={loading || !selectedOffer} onClick={() => void handlePurchase()}>{loading ? 'Buying...' : `Buy for ${formatNumber(selectedTotal, { currency: true, decimals: 0 })}`}</Button></DialogFooter>
  </>;
};
