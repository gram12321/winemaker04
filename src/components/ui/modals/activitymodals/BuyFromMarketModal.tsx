import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Slider } from '@/components/ui';
import { MarketOfferTable, type MarketOfferTableColumn } from '@/components/ui/market/MarketOfferTable';
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

function getSellerStanding(offer: BuyGrapeMarketOffer | null): { title: string; detail: string } {
  if (!offer) {
    return {
      title: 'No Seller Selected',
      detail: 'Choose an offer to inspect seller context and pricing details.',
    };
  }

  if (offer.originTag === 'trusted_carryover' || offer.isPersistent) {
    return {
      title: 'Returning Contact',
      detail: 'This supplier survived the last market rotation and carries more stable stock discipline.',
    };
  }

  if (offer.originTag === 'country_special') {
    return {
      title: 'Regional Specialist',
      detail: 'This supplier represents a country-specific supply lane with more distinct profile signals.',
    };
  }

  return {
    title: 'Market Spot Seller',
    detail: 'This is a seasonal spot offer. Good for opportunistic buys, but not a persistent lane yet.',
  };
}

const BuyFromMarketModal: React.FC<BuyFromMarketModalProps> = ({ isOpen, onClose }) => {
  const [offers, setOffers] = useState<BuyGrapeMarketOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [purchasePercentage, setPurchasePercentage] = useState(100);
  const [grapeFilter, setGrapeFilter] = useState<'all' | string>('all');
  const [stateFilter, setStateFilter] = useState<'all' | BuyGrapeMarketOffer['batchState']>('all');
  const [sortKey, setSortKey] = useState<string>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      setPurchasePercentage(100);
    }
  }, [isOpen]);

  useEffect(() => {
    setPurchasePercentage(100);
  }, [selectedOfferId]);

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
      const leftDemand =
        left.demandFactors.seasonPriceMultiplier
        * left.demandFactors.economyPriceMultiplier
        * left.demandFactors.yearCyclePriceMultiplier
        * left.demandFactors.volatilityPriceMultiplier
        * (left.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);
      const rightDemand =
        right.demandFactors.seasonPriceMultiplier
        * right.demandFactors.economyPriceMultiplier
        * right.demandFactors.yearCyclePriceMultiplier
        * right.demandFactors.volatilityPriceMultiplier
        * (right.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);

      const leftVolatility = left.demandFactors.volatilityPriceMultiplier * (left.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);
      const rightVolatility = right.demandFactors.volatilityPriceMultiplier * (right.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);

      const leftValue =
        sortKey === 'supplier' ? left.supplierName
          : sortKey === 'state' ? getBuyOfferStateLabel(left.batchState)
            : sortKey === 'grape' ? left.grapeVariety
              : sortKey === 'available' ? left.availableKg
                : sortKey === 'quality' ? left.qualityScore
                  : sortKey === 'price' ? left.effectivePricePerKg
                    : sortKey === 'freshness' ? left.weeksOnMarket
                      : sortKey === 'demand' ? leftDemand
                        : sortKey === 'volatility' ? leftVolatility
                          : left.qualityScore;

      const rightValue =
        sortKey === 'supplier' ? right.supplierName
          : sortKey === 'state' ? getBuyOfferStateLabel(right.batchState)
            : sortKey === 'grape' ? right.grapeVariety
              : sortKey === 'available' ? right.availableKg
                : sortKey === 'quality' ? right.qualityScore
                  : sortKey === 'price' ? right.effectivePricePerKg
                    : sortKey === 'freshness' ? right.weeksOnMarket
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

  const maxSelectablePercent = useMemo(() => {
    if (!selectedOffer || selectedOffer.availableKg <= 0) return 1;
    return 100;
  }, [selectedOffer]);

  useEffect(() => {
    setPurchasePercentage((current) => Math.max(1, Math.min(current, maxSelectablePercent)));
  }, [maxSelectablePercent]);

  const selectedQuantityKg = useMemo(() => {
    if (!selectedOffer || selectedOffer.availableKg <= 0) return 0;
    return Math.max(1, Math.min(selectedOffer.availableKg, Math.round((selectedOffer.availableKg * purchasePercentage) / 100)));
  }, [purchasePercentage, selectedOffer]);

  const priceBreakdown = useMemo(() => {
    if (!selectedOffer) return null;
    return getBuyOfferPriceBreakdown(selectedOffer);
  }, [selectedOffer]);

  const totalCost = useMemo(() => {
    if (!selectedOffer || selectedQuantityKg <= 0) return 0;
    return selectedOffer.effectivePricePerKg * selectedQuantityKg;
  }, [selectedOffer, selectedQuantityKg]);

  const selectedDemandMultiplier = useMemo(() => {
    if (!selectedOffer) return 1;
    return (
      selectedOffer.demandFactors.seasonPriceMultiplier
      * selectedOffer.demandFactors.economyPriceMultiplier
      * selectedOffer.demandFactors.yearCyclePriceMultiplier
      * selectedOffer.demandFactors.volatilityPriceMultiplier
      * (selectedOffer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1)
    );
  }, [selectedOffer]);

  const selectedVolatilityMultiplier = useMemo(() => {
    if (!selectedOffer) return 1;
    return selectedOffer.demandFactors.volatilityPriceMultiplier * (selectedOffer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);
  }, [selectedOffer]);

  const handlePurchaseSelected = useCallback(async () => {
    if (!selectedOffer || selectedQuantityKg <= 0) return;
    await handleBuy(selectedOffer.id, selectedQuantityKg);
  }, [handleBuy, selectedOffer, selectedQuantityKg]);

  const sellerStanding = useMemo(() => getSellerStanding(selectedOffer), [selectedOffer]);

  const qualityColor = selectedOffer ? getColorClass(selectedOffer.qualityScore) : 'text-gray-300';

  const columns = useMemo<MarketOfferTableColumn<BuyGrapeMarketOffer>[]>(() => [
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      render: (offer) => (
        <div>
          <div className="font-medium text-white">{offer.supplierName}</div>
          <div className="text-[11px] text-gray-400">{getOriginLabel(offer.originTag)}</div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      render: (offer) => (
        <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300">
          {getBuyOfferStateLabel(offer.batchState)}
        </span>
      ),
    },
    {
      key: 'grape',
      header: 'Variety',
      sortable: true,
      render: (offer) => <span className="text-gray-200">{offer.grapeVariety}</span>,
    },
    {
      key: 'available',
      header: 'Available',
      sortable: true,
      className: 'text-right text-gray-200 whitespace-nowrap',
      render: (offer) => `${offer.availableKg.toLocaleString()} kg`,
    },
    {
      key: 'quality',
      header: 'Quality',
      sortable: true,
      className: 'text-right',
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
      className: 'text-right text-amber-300 whitespace-nowrap',
      render: (offer) => formatNumber(offer.effectivePricePerKg, { currency: true, decimals: 2 }),
    },
    {
      key: 'freshness',
      header: 'Weeks',
      sortable: true,
      className: 'text-right text-gray-200',
      render: (offer) => offer.weeksOnMarket,
    },
    {
      key: 'demand',
      header: 'Demand',
      sortable: true,
      className: 'text-right',
      render: (offer) => {
        const demandMultiplier =
          offer.demandFactors.seasonPriceMultiplier
          * offer.demandFactors.economyPriceMultiplier
          * offer.demandFactors.yearCyclePriceMultiplier
          * offer.demandFactors.volatilityPriceMultiplier
          * (offer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);

        return (
          <div>
            <div className="font-medium text-blue-300">{demandMultiplier.toFixed(2)}x</div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">{offer.demandFactors.volatilityEconomyPhase}</div>
          </div>
        );
      },
    },
    {
      key: 'volatility',
      header: 'Volatility',
      sortable: true,
      className: 'text-right',
      render: (offer) => {
        const volatilityMultiplier =
          offer.demandFactors.volatilityPriceMultiplier
          * (offer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1);

        return (
          <div>
            <div className="font-medium text-purple-300">{volatilityMultiplier.toFixed(2)}x</div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">{offer.demandFactors.volatilityWeatherState}</div>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      className: 'text-right',
      render: (offer) => (
        <Button
          type="button"
          size="sm"
          variant={offer.id === selectedOffer?.id ? 'default' : 'outline'}
          className={offer.id === selectedOffer?.id ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700'}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedOfferId(offer.id);
          }}
        >
          {offer.id === selectedOffer?.id ? 'Selected' : 'Inspect'}
        </Button>
      ),
    },
  ], [selectedOffer?.id]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle>
        </DialogHeader>

        {selectedOffer?.demandFactors && (
          <div className="mb-3 rounded border border-cyan-800/70 bg-cyan-950/20 p-3">
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
              <span className="inline-flex items-center gap-1 rounded border border-cyan-700/70 bg-cyan-900/30 px-2 py-1 text-cyan-200">
                <span>💶</span>
                <span>Price {formatVolatilityDelta(selectedOffer.demandFactors.volatilityPriceMultiplier)}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-amber-700/70 bg-amber-900/30 px-2 py-1 text-amber-200">
                <span>📦</span>
                <span>Supply {formatVolatilityDelta(selectedOffer.demandFactors.volatilityLimitMultiplier)}</span>
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-gray-300">
              {selectedOffer.demandFactors.volatilityPriceReason && (
                <div><span className="text-cyan-300 font-medium">Price outlook:</span> {selectedOffer.demandFactors.volatilityPriceReason}</div>
              )}
              {selectedOffer.demandFactors.volatilityLimitReason && (
                <div><span className="text-amber-300 font-medium">Supply outlook:</span> {selectedOffer.demandFactors.volatilityLimitReason}</div>
              )}
              {selectedOffer.demandFactors.volatilityBuyerSensitivityReason && (
                <div><span className="text-blue-300 font-medium">Seller profile:</span> {selectedOffer.demandFactors.volatilityBuyerSensitivityReason}</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Waregroup: Grapes</p>
              <p className="text-xs text-gray-400">One row per offer. Click a row to inspect deeper market details below.</p>
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
            <div className="overflow-x-auto">
              <MarketOfferTable
                rows={filteredAndSortedOffers}
                columns={columns}
                rowKey={(offer) => offer.id}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                selectedRowKey={selectedOffer?.id ?? null}
                onRowClick={(offer) => setSelectedOfferId(offer.id)}
              />
            </div>
          </div>

          {filteredAndSortedOffers.length === 0 && (
            <div className="rounded border border-gray-700 bg-gray-800/90 p-4 text-sm text-gray-300">
              No offers match the current filters.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,1.1fr)] gap-4 items-start">
            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3 text-xs space-y-2 border border-gray-700/70">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 uppercase tracking-wide">Selected Seller</span>
                  <span className="text-cyan-300 font-semibold">{sellerStanding.title}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white text-sm">{selectedOffer?.supplierName ?? 'No offer selected'}</div>
                    <div className="text-gray-400">{selectedOffer ? getOriginLabel(selectedOffer.originTag) : 'Choose an offer from the table.'}</div>
                  </div>
                  {selectedOffer && (
                    <span className="rounded border border-cyan-800/70 bg-cyan-950/30 px-2 py-1 text-cyan-200">
                      {selectedOffer.isPersistent ? 'Persistent lane' : 'Spot lane'}
                    </span>
                  )}
                </div>
                <div className="text-gray-300">{sellerStanding.detail}</div>
                {selectedOffer && (
                  <div className="grid grid-cols-2 gap-2 pt-1 text-gray-300">
                    <div className="rounded bg-gray-900/60 p-2">
                      <div className="text-gray-500">Demand multiplier</div>
                      <div className="font-semibold text-blue-300">{selectedDemandMultiplier.toFixed(2)}x</div>
                    </div>
                    <div className="rounded bg-gray-900/60 p-2">
                      <div className="text-gray-500">Volatility</div>
                      <div className="font-semibold text-purple-300">{selectedVolatilityMultiplier.toFixed(2)}x</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded p-3 space-y-1 text-sm border border-gray-700/70">
                <div className="flex justify-between">
                  <span className="text-gray-400">Variety</span>
                  <span className="font-medium text-white">{selectedOffer?.grapeVariety ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">State</span>
                  <span className="font-medium text-white">{selectedOffer ? getBuyOfferStateLabel(selectedOffer.batchState) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Available</span>
                  <span className="font-medium text-white">{selectedOffer ? `${selectedOffer.availableKg.toLocaleString()} kg` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Quality</span>
                  <span className={`font-medium ${qualityColor}`}>{selectedOffer ? `${Math.round(selectedOffer.qualityScore * 100)}%` : '—'}</span>
                </div>
                {selectedOffer && (
                  <div className="text-right text-xs text-gray-400">{getQualityCategory(selectedOffer.qualityScore)}</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3 space-y-3 text-sm border border-gray-700/70">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 font-medium uppercase tracking-wide text-xs">Purchase Amount</p>
                  <span className="text-cyan-300 font-semibold">{purchasePercentage}%</span>
                </div>
                <Slider
                  value={[purchasePercentage]}
                  onValueChange={([value]) => setPurchasePercentage(value ?? 100)}
                  min={1}
                  max={maxSelectablePercent}
                  step={1}
                  className="py-1"
                  disabled={!selectedOffer || selectedOffer.availableKg <= 0}
                />
                <div className="flex justify-between text-gray-300">
                  <span>Buying now</span>
                  <span className="font-semibold text-white">{selectedQuantityKg.toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Remaining in listing</span>
                  <span className="font-semibold text-white">{Math.max(0, (selectedOffer?.availableKg ?? 0) - selectedQuantityKg).toLocaleString()} kg</span>
                </div>
                <div className="text-[11px] text-gray-400 border-t border-gray-700 pt-2">
                  Market offers are one-off listings. Buying reduces this listing directly instead of reserving future seller capacity.
                </div>
                {selectedOffer && errorByOfferId[selectedOffer.id] && (
                  <div className="rounded border border-red-800 bg-red-950/30 p-2 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errorByOfferId[selectedOffer.id]}</span>
                  </div>
                )}
              </div>

              {selectedOffer && (
                <div className="rounded border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
                  Buy preview from {selectedOffer.supplierName}: {formatNumber(totalCost, { currency: true, decimals: 0 })} total for {selectedQuantityKg.toLocaleString()} kg at {formatNumber(selectedOffer.effectivePricePerKg, { currency: true, decimals: 2 })}/kg.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded border border-blue-900/60 bg-blue-950/30 p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-300">Seller Profile</span>
                  <span className="font-bold text-cyan-300">{selectedOffer ? getOriginLabel(selectedOffer.originTag) : 'No selection'}</span>
                </div>
                <div className="flex gap-4 text-gray-400">
                  <span>Lane type: <strong className="text-white">{selectedOffer?.isPersistent ? 'Persistent' : 'Spot'}</strong></span>
                  <span>Freshness: <strong className="text-white">{selectedOffer?.weeksOnMarket ?? 0} weeks</strong></span>
                </div>
                <div className="flex gap-4 text-gray-300">
                  <span>Quality floor: <strong className="text-white">{selectedOffer ? `${Math.round(selectedOffer.minQualityFloor * 100)}%` : '—'}</strong></span>
                  <span>Decay / week: <strong className="text-white">{selectedOffer ? `${Math.round(selectedOffer.qualityDecayPerWeek * 1000) / 10}%` : '—'}</strong></span>
                </div>
                <div className="border-t border-blue-900/40 pt-2 text-amber-300">
                  Supplier relationship tracking is not persistent yet. This panel shows current lane quality and reliability signals for the selected offer.
                </div>
              </div>

              {priceBreakdown && selectedOffer && (
                <div className="bg-gray-800 rounded p-3 space-y-1 text-sm border border-gray-700/70">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Price Breakdown</div>
                  <div className="flex justify-between"><span className="text-gray-400">Base price</span><span>{formatNumber(priceBreakdown.basePricePerKg, { currency: true, decimals: 2 })}/kg</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Quality ({Math.round(selectedOffer.qualityScore * 100)}%)</span><span>x{priceBreakdown.qualityMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Season pressure</span><span>x{priceBreakdown.seasonPriceMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Economy pressure</span><span>x{priceBreakdown.economyPriceMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Year cycle</span><span>x{priceBreakdown.yearCyclePriceMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Volatility</span><span>x{priceBreakdown.volatilityPriceMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Seller sensitivity</span><span>x{priceBreakdown.buyerSensitivityMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">State premium</span><span>x{priceBreakdown.statePremiumMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Market spread</span><span>x{priceBreakdown.marketSpreadMultiplier.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-gray-700 pt-2"><span className="text-gray-400">Price per kg</span><span>{formatNumber(priceBreakdown.finalPricePerKg, { currency: true, decimals: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Purchase quantity</span><span>{selectedQuantityKg.toLocaleString()} kg</span></div>
                  <div className="flex justify-between text-amber-300 font-semibold pt-1"><span>Total Cost</span><span>{formatNumber(totalCost, { currency: true, decimals: 0 })}</span></div>
                </div>
              )}
            </div>
          </div>
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
          <Button
            onClick={() => void handlePurchaseSelected()}
            disabled={loading || !selectedOffer || selectedQuantityKg <= 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {loading ? 'Buying…' : `Buy for ${formatNumber(totalCost, { currency: true, decimals: 0 })}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyFromMarketModal;
