import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from '../../market/MarketOfferTable';
import { MarketQuickBuyRowAction } from '../../market/MarketQuickBuyRowAction';
import {
  getBuyGrapeMarketOffers,
  getBuyOfferPriceBreakdown,
  getBuyOfferStateLabel,
  purchaseBuyGrapeOffer,
  type BuyGrapeMarketOffer,
} from '@/lib/services/sales/buyGrapeMarketService';
import { formatNumber, getColorClass, getQualityCategory } from '@/lib/utils';

type SortDirection = 'asc' | 'desc' | null;

interface BuyFromMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getSeasonVolatilityIcon(season?: string): string {
  if (season === 'Winter') return '❄';
  if (season === 'Fall') return '🍂';
  if (season === 'Summer') return '☀';
  return '🌱';
}

function getEconomyVolatilityIcon(phase?: string): string {
  if (phase === 'Crash') return '📉';
  if (phase === 'Recession') return '⚠';
  if (phase === 'Expansion') return '📈';
  if (phase === 'Boom') return '🚀';
  return '⚖';
}

function getWeatherVolatilityIcon(state?: string): string {
  if (state === 'Rain') return '🌧';
  if (state === 'Heat') return '🌡';
  if (state === 'Frost') return '🧊';
  if (state === 'Storm') return '⛈';
  if (state === 'Snow') return '❄';
  return '☀';
}

function formatVolatilityDelta(multiplier: number): string {
  const deltaPercent = (multiplier - 1) * 100;
  const rounded = Math.round(deltaPercent * 10) / 10;
  const display = rounded.toFixed(1).replace(/\.0$/, '');
  return `${rounded >= 0 ? '+' : ''}${display}%`;
}

function getOriginLabel(originTag: BuyGrapeMarketOffer['originTag']): string {
  if (originTag === 'trusted_carryover') return 'Trusted Carryover';
  if (originTag === 'country_special') return 'Country Special';
  return 'Seasonal Rotation';
}

function getDemandPressureIndex(offer: Pick<BuyGrapeMarketOffer, 'demandFactors'>): number {
  return (
    offer.demandFactors.seasonPriceMultiplier
    * offer.demandFactors.economyPriceMultiplier
    * offer.demandFactors.yearCyclePriceMultiplier
    * offer.demandFactors.volatilityPriceMultiplier
    * (offer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1)
  );
}

function getVolatilityRiskIndex(offer: Pick<BuyGrapeMarketOffer, 'demandFactors'>): number {
  return (
    offer.demandFactors.volatilityPriceMultiplier
    * (offer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1)
  );
}

const BuyFromMarketModal: React.FC<BuyFromMarketModalProps> = ({ isOpen, onClose }) => {
  const [offers, setOffers] = useState<BuyGrapeMarketOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [grapeFilter, setGrapeFilter] = useState<'all' | string>('all');
  const [stateFilter, setStateFilter] = useState<'all' | BuyGrapeMarketOffer['batchState']>('all');
  const [sortKey, setSortKey] = useState<string>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const nextOffers = await getBuyGrapeMarketOffers();
      setOffers(nextOffers);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    void loadOffers();
  }, [isOpen, loadOffers]);

  useEffect(() => {
    if (isOpen) {
      setShowAllOffers(false);
      setShowFormulaDetails(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setShowAllOffers(false);
  }, [grapeFilter, stateFilter, sortKey, sortDirection]);

  const handleBuy = useCallback(async (offerId: string, quantityKg: number) => {
    const result = await purchaseBuyGrapeOffer(offerId, quantityKg);

    if (!result.success) {
      setErrorByOfferId((current) => ({
        ...current,
        [offerId]: result.error || 'Purchase failed.',
      }));
      return;
    }

    setErrorByOfferId((current) => {
      const next = { ...current };
      delete next[offerId];
      return next;
    });

    await loadOffers();
  }, [loadOffers]);

  const grapeFilterOptions = useMemo(() => {
    return Array.from(new Set(offers.map((offer) => offer.grapeVariety))).sort();
  }, [offers]);

  const filteredAndSortedOffers = useMemo(() => {
    const filtered = offers.filter((offer) => {
      if (grapeFilter !== 'all' && offer.grapeVariety !== grapeFilter) return false;
      if (stateFilter !== 'all' && offer.batchState !== stateFilter) return false;
      return true;
    });

    if (!sortDirection) {
      return filtered;
    }

    const sorted = [...filtered].sort((left, right) => {
      const leftDemand = getDemandPressureIndex(left);
      const rightDemand = getDemandPressureIndex(right);
      const leftVolatility = getVolatilityRiskIndex(left);
      const rightVolatility = getVolatilityRiskIndex(right);

      const leftValue =
        sortKey === 'offer' ? left.supplierName
              : sortKey === 'available' ? left.availableKg
                : sortKey === 'quality' ? left.qualityScore
                  : sortKey === 'price' ? left.effectivePricePerKg
                : sortKey === 'market' ? leftDemand + leftVolatility
                  : sortKey === 'demand' ? leftDemand
                    : sortKey === 'volatility' ? leftVolatility
                          : left.qualityScore;

      const rightValue =
        sortKey === 'offer' ? right.supplierName
              : sortKey === 'available' ? right.availableKg
                : sortKey === 'quality' ? right.qualityScore
                  : sortKey === 'price' ? right.effectivePricePerKg
                : sortKey === 'market' ? rightDemand + rightVolatility
                  : sortKey === 'demand' ? rightDemand
                    : sortKey === 'volatility' ? rightVolatility
                          : right.qualityScore;

      if (leftValue === rightValue) return 0;
      const result = leftValue > rightValue ? 1 : -1;
      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [grapeFilter, offers, sortDirection, sortKey, stateFilter]);

  const handleSort = useCallback((columnKey: string) => {
    if (sortKey !== columnKey) {
      setSortKey(columnKey);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
    } else {
      setSortDirection('asc');
    }
  }, [sortDirection, sortKey]);

  useEffect(() => {
    if (filteredAndSortedOffers.length === 0) {
      setSelectedOfferId(null);
      return;
    }

    const hasSelected = filteredAndSortedOffers.some((offer) => offer.id === selectedOfferId);
    if (!hasSelected) {
      setSelectedOfferId(filteredAndSortedOffers[0].id);
    }
  }, [filteredAndSortedOffers, selectedOfferId]);

  const selectedOffer = useMemo(() => {
    if (!selectedOfferId) return filteredAndSortedOffers[0] ?? null;
    return filteredAndSortedOffers.find((offer) => offer.id === selectedOfferId) ?? filteredAndSortedOffers[0] ?? null;
  }, [filteredAndSortedOffers, selectedOfferId]);

  const displayedOffers = useMemo(() => {
    if (showAllOffers) return filteredAndSortedOffers;
    return filteredAndSortedOffers.slice(0, 6);
  }, [filteredAndSortedOffers, showAllOffers]);

  useEffect(() => {
    if (displayedOffers.length === 0) return;
    if (!selectedOffer) return;
    const inVisibleRows = displayedOffers.some((offer) => offer.id === selectedOffer.id);
    if (!inVisibleRows) {
      setSelectedOfferId(displayedOffers[0].id);
    }
  }, [displayedOffers, selectedOffer]);

  const priceBreakdown = useMemo(() => {
    if (!selectedOffer) return null;
    return getBuyOfferPriceBreakdown(selectedOffer);
  }, [selectedOffer]);

  const selectedDemandPressureIndex = useMemo(() => {
    if (!selectedOffer) return 1;
    return getDemandPressureIndex(selectedOffer);
  }, [selectedOffer]);

  const selectedVolatilityRiskIndex = useMemo(() => {
    if (!selectedOffer) return 1;
    return getVolatilityRiskIndex(selectedOffer);
  }, [selectedOffer]);

  const selectedRawPricePerKg = useMemo(() => {
    if (!priceBreakdown) return 0;
    return (
      priceBreakdown.basePricePerKg
      * priceBreakdown.qualityMultiplier
      * priceBreakdown.seasonPriceMultiplier
      * priceBreakdown.economyPriceMultiplier
      * priceBreakdown.yearCyclePriceMultiplier
      * priceBreakdown.volatilityPriceMultiplier
      * priceBreakdown.buyerSensitivityMultiplier
      * priceBreakdown.statePremiumMultiplier
      * priceBreakdown.marketSpreadMultiplier
    );
  }, [priceBreakdown]);

  const headerWithTooltip = useCallback((label: string, tooltip: string) => (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <UnifiedTooltip
        title={label}
        content={<span className="text-xs leading-snug">{tooltip}</span>}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300"
          onClick={(event) => event.stopPropagation()}
        >
          ?
        </span>
      </UnifiedTooltip>
    </span>
  ), []);

  const columns = useMemo<MarketOfferTableColumn<BuyGrapeMarketOffer>[]>(() => [
    {
      key: 'offer',
      header: 'Offer',
      sortable: true,
      className: 'w-[31%] min-w-[230px]',
      render: (offer) => (
        <div className="space-y-1">
          <div className="font-medium text-white leading-tight">{offer.supplierName}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
            <span>{getOriginLabel(offer.originTag)}</span>
            <span className="text-gray-600">•</span>
            <span>{offer.grapeVariety}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-gray-300">{getBuyOfferStateLabel(offer.batchState)}</span>
            <UnifiedTooltip
              title="Weeks On Market"
              content={<span className="text-xs leading-snug">How many weeks this listing has been on the market. Older offers generally decay in quality over time.</span>}
            >
              <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-cyan-200">{offer.weeksOnMarket}w</span>
            </UnifiedTooltip>
          </div>
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      sortable: true,
      className: 'w-[11%] text-right text-gray-200 whitespace-nowrap min-w-[84px]',
      render: (offer) => `${offer.availableKg.toLocaleString()} kg`,
    },
    {
      key: 'quality',
      header: headerWithTooltip('Quality', 'Grape quality score. Higher quality increases effective price and usually means better processing potential.'),
      sortable: true,
      className: 'w-[14%] text-right min-w-[118px]',
      render: (offer) => (
        <div>
          <div className={`font-medium ${getColorClass(offer.qualityScore)}`}>{Math.round(offer.qualityScore * 100)}%</div>
          <div className="text-[11px] text-gray-400 whitespace-nowrap">{getQualityCategory(offer.qualityScore)}</div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price/kg',
      sortable: true,
      className: 'w-[10%] text-right text-amber-300 whitespace-nowrap min-w-[84px]',
      render: (offer) => formatNumber(offer.effectivePricePerKg, { currency: true, decimals: 2 }),
    },
    {
      key: 'market',
      header: headerWithTooltip('Market', 'Price context summary. Pressure is the combined market index, and Risk is volatility-sensitive pressure.'),
      sortable: true,
      className: 'w-[16%] text-right min-w-[150px]',
      render: (offer) => {
        const demandMultiplier = getDemandPressureIndex(offer);
        const volatilityMultiplier = getVolatilityRiskIndex(offer);

        return (
          <div className="space-y-0.5">
            <div className="text-[11px] whitespace-nowrap">
              <UnifiedTooltip
                title="Market Pressure Index"
                content={<span className="text-xs leading-snug">Pressure = Season × Economy × Cycle × Volatility Price × Supplier Sensitivity.</span>}
              >
                <span className="text-blue-300 font-medium">Pressure {demandMultiplier.toFixed(2)}x</span>
              </UnifiedTooltip>
              <span className="text-gray-500"> · </span>
              <UnifiedTooltip
                title="Volatility Risk Index"
                content={<span className="text-xs leading-snug">Risk = Volatility Price × Supplier Sensitivity.</span>}
              >
                <span className="text-purple-300 font-medium">Risk {volatilityMultiplier.toFixed(2)}x</span>
              </UnifiedTooltip>
            </div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">{offer.demandFactors.volatilityEconomyPhase} / {offer.demandFactors.volatilityWeatherState}</div>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      className: 'w-[18%] text-right min-w-[160px]',
      render: (offer) => (
        <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
          <MarketQuickBuyRowAction
            offerId={offer.id}
            maxQuantity={offer.availableKg}
            onBuy={handleBuy}
            disabled={loading}
          />
          {errorByOfferId[offer.id] && (
            <div className="text-[11px] text-red-300 flex items-center justify-end gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{errorByOfferId[offer.id]}</span>
            </div>
          )}
        </div>
      ),
    },
  ], [errorByOfferId, handleBuy, headerWithTooltip, loading]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[98vw] max-w-[96rem] max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle>
          <DialogDescription className="sr-only">
            Browse and purchase grape market offers, compare quality and pricing pressure, and buy directly from each row.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-3 items-start">
            {selectedOffer?.demandFactors ? (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-cyan-200 font-medium">Market volatility outlook</span>
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-900/30 px-2 py-1 text-emerald-200">
                    <span>{getSeasonVolatilityIcon(selectedOffer.demandFactors.volatilitySeason)}</span>
                    <span>{selectedOffer.demandFactors.volatilitySeason}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-indigo-700/70 bg-indigo-900/30 px-2 py-1 text-indigo-200">
                    <span>{getEconomyVolatilityIcon(selectedOffer.demandFactors.volatilityEconomyPhase)}</span>
                    <span>{selectedOffer.demandFactors.volatilityEconomyPhase}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-blue-700/70 bg-blue-900/30 px-2 py-1 text-blue-200">
                    <span>{getWeatherVolatilityIcon(selectedOffer.demandFactors.volatilityWeatherState)}</span>
                    <span>{selectedOffer.demandFactors.volatilityWeatherState} ({selectedOffer.demandFactors.volatilityWeatherIntensity})</span>
                  </span>
                  <UnifiedTooltip
                    title="Price Volatility Factor"
                    content={<span className="text-xs leading-snug">This is the volatility price multiplier. It flows into Risk, and then into Pressure with season, economy, and cycle factors.</span>}
                  >
                    <span className="inline-flex items-center gap-1 rounded border border-cyan-700/70 bg-cyan-900/30 px-2 py-1 text-cyan-200">
                      <span>💶</span>
                      <span>Price {formatVolatilityDelta(selectedOffer.demandFactors.volatilityPriceMultiplier)}</span>
                    </span>
                  </UnifiedTooltip>
                  <UnifiedTooltip
                    title="Supply Volatility Factor"
                    content={<span className="text-xs leading-snug">This is the volatility supply multiplier. It signals market tightness and availability pressure, but it is not multiplied directly into final price/kg.</span>}
                  >
                    <span className="inline-flex items-center gap-1 rounded border border-amber-700/70 bg-amber-900/30 px-2 py-1 text-amber-200">
                      <span>📦</span>
                      <span>Supply {formatVolatilityDelta(selectedOffer.demandFactors.volatilityLimitMultiplier)}</span>
                    </span>
                  </UnifiedTooltip>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-gray-300">
                  {selectedOffer.demandFactors.volatilityPriceReason && (
                    <div><span className="text-cyan-300 font-medium">Price outlook:</span> {selectedOffer.demandFactors.volatilityPriceReason}</div>
                  )}
                  {selectedOffer.demandFactors.volatilityLimitReason && (
                    <div><span className="text-amber-300 font-medium">Supply outlook:</span> {selectedOffer.demandFactors.volatilityLimitReason}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs text-gray-300">
                Select an offer to inspect market volatility details.
              </div>
            )}

            {priceBreakdown && selectedOffer ? (
              <div className="bg-gray-800 rounded p-3 text-sm border border-gray-700/70">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Price Summary</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between gap-3"><span className="text-gray-400">Supplier</span><span className="text-right">{selectedOffer.supplierName}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-400">Base Price</span><span className="text-right">{formatNumber(priceBreakdown.basePricePerKg, { currency: true, decimals: 2 })}/kg</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-400">Quality Impact ({Math.round(selectedOffer.qualityScore * 100)}%)</span><span className="text-right">x{priceBreakdown.qualityMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-400">Market Pressure Index</span><span className="text-right text-blue-300">x{selectedDemandPressureIndex.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-400">Volatility Risk Index</span><span className="text-right text-purple-300">x{selectedVolatilityRiskIndex.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-gray-400">State Premium Factor</span><span className="text-right">x{priceBreakdown.statePremiumMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between gap-3 sm:col-span-2 border-t border-gray-700 pt-2 mt-1"><span className="text-gray-400">Final Price per kg</span><span className="text-right">{formatNumber(priceBreakdown.finalPricePerKg, { currency: true, decimals: 2 })}</span></div>
                </div>

                <div className="mt-2 rounded border border-gray-700/70 bg-gray-900/40 p-2 text-xs text-gray-300 space-y-1">
                  <div className="text-gray-400">Exact calculation (raw)</div>
                  <div className="leading-snug break-words">
                    {formatNumber(priceBreakdown.basePricePerKg, { currency: true, decimals: 2 })}
                    {' × '}{priceBreakdown.qualityMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.seasonPriceMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.economyPriceMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.yearCyclePriceMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.volatilityPriceMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.buyerSensitivityMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.statePremiumMultiplier.toFixed(3)}
                    {' × '}{priceBreakdown.marketSpreadMultiplier.toFixed(3)}
                    {' = '}{formatNumber(selectedRawPricePerKg, { currency: true, decimals: 3 })}/kg
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Rounded display price: {formatNumber(priceBreakdown.finalPricePerKg, { currency: true, decimals: 2 })}/kg
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-700/70 pt-2">
                  <button
                    type="button"
                    className="text-xs text-cyan-300 hover:text-cyan-200"
                    onClick={() => setShowFormulaDetails((current) => !current)}
                  >
                    {showFormulaDetails ? 'Hide detailed formula factors' : 'Show detailed formula factors'}
                  </button>

                  {showFormulaDetails && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Season Factor</span><span className="text-right">x{priceBreakdown.seasonPriceMultiplier.toFixed(3)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Economy Factor</span><span className="text-right">x{priceBreakdown.economyPriceMultiplier.toFixed(3)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Cycle Factor</span><span className="text-right">x{priceBreakdown.yearCyclePriceMultiplier.toFixed(3)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Volatility Price Factor</span><span className="text-right">x{priceBreakdown.volatilityPriceMultiplier.toFixed(3)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Supplier Sensitivity Factor</span><span className="text-right">x{priceBreakdown.buyerSensitivityMultiplier.toFixed(3)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-400">Market Margin Factor</span><span className="text-right">x{priceBreakdown.marketSpreadMultiplier.toFixed(3)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded p-3 text-sm border border-gray-700/70 text-gray-300">
                Select an offer to inspect price breakdown.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Waregroup: Grapes</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                value={grapeFilter}
                onChange={(event) => setGrapeFilter(event.target.value)}
              >
                <option value="all">All Grapes</option>
                {grapeFilterOptions.map((grape) => (
                  <option key={grape} value={grape}>{grape}</option>
                ))}
              </select>
              <select
                className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value as 'all' | BuyGrapeMarketOffer['batchState'])}
              >
                <option value="all">All States</option>
                <option value="grapes">Grapes</option>
                <option value="must_ready">Must</option>
                <option value="must_fermenting">Fermenting</option>
              </select>
              <Button variant="outline" size="sm" className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700" onClick={() => void loadOffers()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="rounded border border-gray-700 bg-gray-800/60 overflow-hidden">
            <div className="overflow-x-auto max-h-[56vh]">
              <MarketOfferTable
                rows={displayedOffers}
                columns={columns}
                rowKey={(offer) => offer.id}
                className="table-fixed"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                selectedRowKey={selectedOffer?.id ?? null}
                onRowClick={(offer) => setSelectedOfferId(offer.id)}
              />
            </div>
          </div>

          {filteredAndSortedOffers.length > 6 && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                onClick={() => setShowAllOffers((current) => !current)}
              >
                {showAllOffers ? 'Show Less' : `Show More (${filteredAndSortedOffers.length - 6} more)`}
              </Button>
            </div>
          )}

          {filteredAndSortedOffers.length === 0 && (
            <div className="rounded border border-gray-700 bg-gray-800/90 p-4 text-sm text-gray-300">
              No offers match the current filters.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyFromMarketModal;
