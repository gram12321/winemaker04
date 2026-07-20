import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, DialogFooter } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import { BuyMarketCounterpartyPanel, getBuyMarketCounterpartyTrustColor } from './BuyMarketCounterpartyPanel';
import {
  getBuyGrapeMarketOffers,
  getBuyOfferPriceBreakdown,
  getBuyOfferStateLabel,
  type BuyGrapeMarketOffer,
} from '@/lib/services/sales/buyGrapeMarketService';
import { purchaseBuyMarketOfferForDomain } from '@/lib/services/market/buyMarketService';
import { getBuyMarketRelationshipPreview, type BuyMarketCounterpartyRelationshipLevel } from '@/lib/services/market/buyMarketCounterpartyRelationshipService';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { formatNumber, getColorClass, getQualityCategory } from '@/lib/utils';
import { getFeatureConfig } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { getGameState } from '@/lib/services/core/gameState';
import { STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG } from '@/lib/constants';
import type { WineFeature } from '@/lib/types/wineFeatures';
import type { WeatherState } from '@/lib/types/types';
import { getWeatherIcon, getWeatherLabel } from '@/lib/features/weather';
import { getAvailableStorageVessels, initializeHarvestVolumeLitres } from '@/lib/services/wine/winery/storageVesselAllocationService';
import type { StorageVessel } from '@/lib/types/storageVessels';
import type { BuyMarketSourceFilter } from '@/lib/types/market';
import { getBuyMarketOfferSourcePresentation, isBuyMarketOfferInSourceFilter } from '@/lib/services/market/buyMarketOfferSource';

type SortDirection = 'asc' | 'desc' | null;

interface GrapeMarketPanelProps {
  onClose: () => void;
  sourceFilter?: BuyMarketSourceFilter;
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

function getOriginLabel(originTag: BuyGrapeMarketOffer['originTag']): string {
  if (originTag === 'trusted_carryover') return 'Trusted Carryover';
  if (originTag === 'country_special') return 'Country Special';
  return 'Seasonal Rotation';
}

function getActiveFeatureSignalClass(feature: WineFeature): string {
  const badgeColor = getFeatureConfig(feature.id)?.badgeColor;
  if (badgeColor === 'destructive') return 'border-red-700/70 bg-red-950/40 text-red-200';
  if (badgeColor === 'warning') return 'border-amber-700/70 bg-amber-950/40 text-amber-200';
  if (badgeColor === 'success') return 'border-emerald-700/70 bg-emerald-950/40 text-emerald-200';
  return 'border-blue-700/70 bg-blue-950/40 text-blue-200';
}

function formatFeatureSignalPercent(value: number): string {
  return `${formatNumber(value * 100, { smartDecimals: true })}%`;
}

const MarketFeatureSignals: React.FC<{ offer: BuyGrapeMarketOffer }> = ({ offer }) => {
  const activeFeatures = offer.previewBatch.features.filter((feature) => feature.isPresent);
  const riskFeatures = offer.previewBatch.features.filter((feature) => !feature.isPresent && (feature.risk ?? 0) > 0);

  if (activeFeatures.length === 0 && riskFeatures.length === 0) {
    return <span className="text-[11px] text-gray-500">Clear</span>;
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {activeFeatures.map((feature) => (
        <UnifiedTooltip
          key={`feature-${feature.id}`}
          title={feature.name}
          content={<span className="text-xs leading-snug">Active feature · severity {formatFeatureSignalPercent(feature.severity)}</span>}
        >
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${getActiveFeatureSignalClass(feature)}`}>
            <span>{feature.icon}</span>
            <span>{formatFeatureSignalPercent(feature.severity)}</span>
          </span>
        </UnifiedTooltip>
      ))}
      {riskFeatures.map((feature) => (
        <UnifiedTooltip
          key={`risk-${feature.id}`}
          title={`${feature.name} risk`}
          content={<span className="text-xs leading-snug">Pending risk · {formatFeatureSignalPercent(feature.risk ?? 0)} chance</span>}
        >
          <span className="inline-flex items-center gap-1 rounded border border-amber-700/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-200">
            <span>{feature.icon}</span>
            <span>{formatFeatureSignalPercent(feature.risk ?? 0)}</span>
          </span>
        </UnifiedTooltip>
      ))}
    </div>
  );
};

function getPriceDriverSummary(priceBreakdown: ReturnType<typeof getBuyOfferPriceBreakdown>): {
  increases: string[];
  reduces: string[];
} {
  const increases: string[] = [];
  const reduces: string[] = [];
  const classify = (multiplier: number, label: string) => {
    if (multiplier > 1.01) increases.push(label);
    if (multiplier < 0.99) reduces.push(label);
  };

  classify(priceBreakdown.qualityMultiplier * priceBreakdown.previewValueMultiplier, 'wine potential');
  classify(
    priceBreakdown.seasonPriceMultiplier
      * priceBreakdown.economyPriceMultiplier
      * priceBreakdown.yearCyclePriceMultiplier
      * priceBreakdown.volatilityPriceMultiplier
      * priceBreakdown.buyerSensitivityMultiplier,
    'market conditions'
  );
  classify(priceBreakdown.supplierRelationshipMultiplier, 'market relationship');
  classify(priceBreakdown.companyPrestigeMultiplier, 'company reputation');
  classify(priceBreakdown.statePremiumMultiplier, 'processing stage');

  return { increases, reduces };
}

const PriceCalculationTooltip: React.FC<{
  breakdown: ReturnType<typeof getBuyOfferPriceBreakdown>;
  children: React.ReactNode;
}> = ({ breakdown, children }) => {
  return (
    <UnifiedTooltip
      title="Bulk price calculation"
      content={(
        <div className="space-y-1 text-xs leading-snug min-w-[220px]">
          <div className="text-gray-300">Base price × price factors, then processing stage and market spread.</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>Base price</span><span className="text-right">{formatNumber(breakdown.basePricePerKg, { currency: true, decimals: 2 })}/kg</span>
            <span>Grape quality</span><span className="text-right">×{breakdown.qualityMultiplier.toFixed(2)}</span>
            <span>Wine potential</span><span className="text-right">×{breakdown.previewValueMultiplier.toFixed(2)}</span>
            <span>Season × economy × cycle</span><span className="text-right">×{(breakdown.seasonPriceMultiplier * breakdown.economyPriceMultiplier * breakdown.yearCyclePriceMultiplier).toFixed(2)}</span>
            <span>Volatility × sensitivity</span><span className="text-right">×{(breakdown.volatilityPriceMultiplier * breakdown.buyerSensitivityMultiplier).toFixed(2)}</span>
            <span>Market relationship</span><span className="text-right">×{breakdown.supplierRelationshipMultiplier.toFixed(2)}</span>
            <span>Company reputation</span><span className="text-right">×{breakdown.companyPrestigeMultiplier.toFixed(2)}</span>
            <span>Processing stage</span><span className="text-right">×{breakdown.statePremiumMultiplier.toFixed(2)}</span>
            <span>Market spread</span><span className="text-right">×{breakdown.marketSpreadMultiplier.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-600 pt-1 text-gray-300">
            Floor: {formatNumber(breakdown.marketFloorPrice, { currency: true, decimals: 2 })}/kg · Final: {formatNumber(breakdown.finalPricePerKg, { currency: true, decimals: 2 })}/kg
          </div>
        </div>
      )}
    >
      {children}
    </UnifiedTooltip>
  );
};

export const GrapeMarketPanel: React.FC<GrapeMarketPanelProps> = ({ onClose, sourceFilter = 'all' }) => {
  const [offers, setOffers] = useState<BuyGrapeMarketOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [grapeFilter, setGrapeFilter] = useState<'all' | string>('all');
  const [stateFilter, setStateFilter] = useState<'all' | BuyGrapeMarketOffer['batchState']>('all');
  const [sortKey, setSortKey] = useState<string>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyValue, setCompanyValue] = useState(0);
  const [purchaseQuantityByOfferId, setPurchaseQuantityByOfferId] = useState<Record<string, number>>({});
  const [availableVessels, setAvailableVessels] = useState<StorageVessel[]>([]);
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>([]);
  const currentYear = getGameState().currentYear ?? 0;

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const nextOffers = await getBuyGrapeMarketOffers();
      setOffers(nextOffers);
      const vessels = await getAvailableStorageVessels();
      setAvailableVessels(vessels);
      setSelectedVesselIds([]);
      const computedCompanyValue = await calculateCompanyValue().catch(() => 0);
      setCompanyValue(computedCompanyValue);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  React.useEffect(() => { void loadOffers(); }, [loadOffers]);

  const handleBuy = useCallback(async (offerId: string, quantityKg: number, vesselIds: string[]) => {
    setLoading(true);
    try {
      const result = await purchaseBuyMarketOfferForDomain('grapes', offerId, quantityKg, { storageVesselIds: vesselIds });

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

      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  const grapeFilterOptions = useMemo(() => {
    return Array.from(new Set(offers.map((offer) => offer.grapeVariety))).sort();
  }, [offers]);

  const filteredAndSortedOffers = useMemo(() => {
    const filtered = offers.filter((offer) => {
      if (!isBuyMarketOfferInSourceFilter(offer, sourceFilter)) return false;
      if (grapeFilter !== 'all' && offer.grapeVariety !== grapeFilter) return false;
      if (stateFilter !== 'all' && offer.batchState !== stateFilter) return false;
      return true;
    });

    if (!sortDirection) {
      return filtered;
    }

    const sorted = [...filtered].sort((left, right) => {
      const leftValue =
        sortKey === 'offer' ? left.supplierName
              : sortKey === 'available' ? left.availableKg
                : sortKey === 'quality' ? left.qualityScore
                  : sortKey === 'price' ? left.effectivePricePerKg
                    : sortKey === 'quantity' ? getOfferQuantity(left)
                      : left.qualityScore;

      const rightValue =
        sortKey === 'offer' ? right.supplierName
              : sortKey === 'available' ? right.availableKg
                : sortKey === 'quality' ? right.qualityScore
                  : sortKey === 'price' ? right.effectivePricePerKg
                    : sortKey === 'quantity' ? getOfferQuantity(right)
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

  const getOfferQuantity = useCallback((offer: BuyGrapeMarketOffer): number => {
    const current = purchaseQuantityByOfferId[offer.id];
    if (typeof current !== 'number') {
      return Math.min(100, Math.max(1, offer.availableKg));
    }

    return Math.max(1, Math.min(current, offer.availableKg));
  }, [purchaseQuantityByOfferId]);

  const selectedPurchaseKg = useMemo(() => {
    if (!selectedOffer) return 1;
    return getOfferQuantity(selectedOffer);
  }, [getOfferQuantity, selectedOffer]);

  const selectedVesselCapacity = useMemo(() => availableVessels
    .filter((vessel) => selectedVesselIds.includes(vessel.id))
    .reduce((total, vessel) => total + vessel.capacityLitres, 0), [availableVessels, selectedVesselIds]);
  const requiredStorageLitres = initializeHarvestVolumeLitres(selectedPurchaseKg);

  const trustPreview = useMemo(() => {
    if (!selectedOffer || selectedPurchaseKg <= 0) return null;
    return getBuyMarketRelationshipPreview(selectedOffer.counterpartyRelationship, selectedOffer.effectivePricePerKg * selectedPurchaseKg, companyValue, currentYear);
  }, [companyValue, currentYear, selectedOffer, selectedPurchaseKg]);

  const displayedOffers = filteredAndSortedOffers;

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

  const selectedTotalCost = useMemo(() => {
    if (!priceBreakdown || !selectedOffer) return 0;
    const safeQty = Math.max(1, Math.min(selectedPurchaseKg, selectedOffer.availableKg));
    return priceBreakdown.finalPricePerKg * safeQty;
  }, [priceBreakdown, selectedOffer, selectedPurchaseKg]);

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
      header: 'Market source',
      sortable: true,
      className: 'w-[23%] min-w-[205px]',
      render: (offer) => (
        <div className="space-y-1">
          <div className="font-medium text-white leading-tight">{getBuyMarketOfferSourcePresentation(offer.source).sellerLabel}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
            <span>{getBuyMarketOfferSourcePresentation(offer.source).label}</span>
            <span className="text-gray-600">•</span>
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
            <UnifiedTooltip
              title="Market Relationship"
              content={<span className="text-xs leading-snug">A relationship with this seller can improve pricing and, for local supplier stock, listing persistence over time.</span>}
            >
              <span className={`rounded border border-gray-700 px-2 py-0.5 text-[10px] ${getBuyMarketCounterpartyTrustColor((offer.counterpartyRelationship?.level ?? 0) as BuyMarketCounterpartyRelationshipLevel)}`}>
                Relationship {offer.counterpartyRelationship?.level ?? 0}
              </span>
            </UnifiedTooltip>
          </div>
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Supply',
      sortable: true,
      className: 'w-[9%] text-right text-gray-200 whitespace-nowrap min-w-[78px]',
      render: (offer) => `${offer.availableKg.toLocaleString()} kg`,
    },
    {
      key: 'quality',
      header: headerWithTooltip('Quality', 'Higher grape quality, structure, and taste usually increase bulk price and improve the wine’s potential.'),
      sortable: true,
      className: 'w-[13%] text-right min-w-[130px]',
      render: (offer) => (
        <div>
          <div className={`font-medium ${getColorClass(offer.qualityScore)}`}>{Math.round(offer.qualityScore * 100)}%</div>
          <div className="text-[11px] text-gray-400 whitespace-nowrap">{getQualityCategory(offer.qualityScore)}</div>
          <div className="mt-0.5 text-[10px] text-emerald-200 whitespace-nowrap">
            Struct {Math.round(offer.previewBatch.structureIndex * 100)}% · Taste {Math.round(offer.previewBatch.tasteQualityIndex * 100)}%
          </div>
        </div>
      ),
    },
    {
      key: 'features',
      header: headerWithTooltip('Features & Risks', 'Positive manifested features, such as Terroir Expression, usually increase bulk price. Pending risks reduce it. Green shows a present feature; amber shows risk chance.'),
      sortable: false,
      className: 'w-[13%] text-right min-w-[130px]',
      render: (offer) => <MarketFeatureSignals offer={offer} />,
    },
    {
      key: 'price',
      header: 'Price per kg',
      sortable: true,
      className: 'w-[9%] text-right text-amber-300 whitespace-nowrap min-w-[80px]',
      render: (offer) => (
        <PriceCalculationTooltip breakdown={getBuyOfferPriceBreakdown(offer)}>
          <span className="cursor-help underline decoration-dotted underline-offset-2">
            {formatNumber(offer.effectivePricePerKg, { currency: true, decimals: 2 })}
          </span>
        </PriceCalculationTooltip>
      ),
    },
    {
      key: 'action',
      header: headerWithTooltip('Quantity', 'Purchase quantity selected for this offer. You can sort by the amount you plan to buy.'),
      sortable: true,
      className: 'w-[16%] text-right min-w-[150px]',
      render: (offer) => (
        <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
          <MarketQuickBuyRowAction
            quantity={getOfferQuantity(offer)}
            maxQuantity={offer.availableKg}
            onQuantityChange={(quantity) => {
              const safe = Math.max(1, Math.min(Math.round(quantity), offer.availableKg));
              setPurchaseQuantityByOfferId((current) => ({
                ...current,
                [offer.id]: safe,
              }));
            }}
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
  ], [errorByOfferId, getOfferQuantity, headerWithTooltip, loading]);

  return <>
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
            {selectedOffer?.demandFactors ? (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-cyan-200 font-medium">Market outlook</span>
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-900/30 px-2 py-1 text-emerald-200">
                    <span>{getSeasonVolatilityIcon(selectedOffer.demandFactors.volatilitySeason)}</span>
                    <span>{selectedOffer.demandFactors.volatilitySeason}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-indigo-700/70 bg-indigo-900/30 px-2 py-1 text-indigo-200">
                    <span>{getEconomyVolatilityIcon(selectedOffer.demandFactors.volatilityEconomyPhase)}</span>
                    <span>{selectedOffer.demandFactors.volatilityEconomyPhase}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-blue-700/70 bg-blue-900/30 px-2 py-1 text-blue-200">
                    <span>{getWeatherIcon((selectedOffer.demandFactors.volatilityWeatherState ?? 'Clear') as WeatherState)}</span>
                    <span>{getWeatherLabel((selectedOffer.demandFactors.volatilityWeatherState ?? 'Clear') as WeatherState, selectedOffer.demandFactors.volatilityWeatherIntensity ?? 'Mild')}</span>
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
                    <div><span className="text-blue-300 font-medium">Supplier profile:</span> {selectedOffer.demandFactors.volatilityBuyerSensitivityReason}</div>
                  )}
                </div>

              </div>
            ) : (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs text-gray-300">
                Select an offer to inspect market volatility details.
              </div>
            )}

            <BuyMarketCounterpartyPanel
              counterpartyName={selectedOffer?.supplierName}
              relationship={selectedOffer?.counterpartyRelationship ?? null}
              companyValue={companyValue}
              currentYear={currentYear}
              unitsLabel="kg"
            />

            {priceBreakdown && selectedOffer ? (
              <div className="bg-gray-800 rounded p-3 text-sm border border-gray-700/70">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Purchase Summary</div>
                <div className="flex items-end justify-between gap-3 border-b border-gray-700 pb-3">
                  <div>
                    <PriceCalculationTooltip breakdown={priceBreakdown}>
                      <div className="text-2xl font-bold text-amber-300 cursor-help underline decoration-dotted underline-offset-4">{formatNumber(priceBreakdown.finalPricePerKg, { currency: true, decimals: 2 })}<span className="ml-1 text-sm font-normal text-gray-400 no-underline">/kg</span></div>
                    </PriceCalculationTooltip>
                    <div className="mt-1 text-xs text-gray-400">Final market price</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-300">{Math.max(1, Math.min(selectedPurchaseKg, selectedOffer.availableKg)).toLocaleString()} kg</div>
                    <div className="text-lg font-bold text-amber-400">{formatNumber(selectedTotalCost, { currency: true, decimals: 0 })} total</div>
                  </div>
                </div>

                {(() => {
                  const drivers = getPriceDriverSummary(priceBreakdown);
                  return (
                    <div className="mt-3 text-xs">
                      <UnifiedTooltip
                        title="What affects bulk price?"
                        content={<span className="text-xs leading-snug">Wine potential, market conditions, your relationship with the seller, and processing stage can move the final price. Winepedia explains the usual direction of each factor without exposing the formula.</span>}
                      >
                        <div className="inline-flex items-center gap-1 text-gray-400">
                          <span>Price drivers</span>
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300">?</span>
                        </div>
                      </UnifiedTooltip>
                      {drivers.increases.length > 0 && <div className="mt-1 text-amber-200">Higher: {drivers.increases.join(' · ')}</div>}
                      {drivers.reduces.length > 0 && <div className="mt-1 text-emerald-200">Lower: {drivers.reduces.join(' · ')}</div>}
                      {drivers.increases.length === 0 && drivers.reduces.length === 0 && <div className="mt-1 text-gray-300">Close to the normal market price.</div>}
                    </div>
                  );
                })()}

                {trustPreview && (
                  <div className="mt-2 border border-gray-700/70 bg-gray-900/40 p-2 text-xs text-cyan-300">
                    Relationship preview: +{trustPreview.appliedPoints.toLocaleString()} points this purchase
                    {trustPreview.cappedPoints > 0 ? ` (${trustPreview.rawPoints.toLocaleString()} raw, ${trustPreview.cappedPoints.toLocaleString()} capped by yearly limit)` : ''}
                  </div>
                )}

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

          {filteredAndSortedOffers.length === 0 && (
            <div className="rounded border border-gray-700 bg-gray-800/90 p-4 text-sm text-gray-300">
              No offers match the current filters.
            </div>
          )}

          {selectedOffer && (
            <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-sm">
              <div className="font-medium text-cyan-200">Assign Storage Vessels</div>
              <div className="mt-1 text-xs text-gray-300">This purchase creates a WineBatch and requires capacity now. Initial planning uses {STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG} L/kg as a temporary bootstrap ratio; future operation losses and conversions will update volume.</div>
              <div className="mt-2 flex justify-between text-xs"><span>Selected capacity</span><span className={selectedVesselCapacity >= requiredStorageLitres ? 'text-green-300' : 'text-red-300'}>{selectedVesselCapacity.toLocaleString()} L / {requiredStorageLitres.toLocaleString()} L</span></div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {availableVessels.length === 0 && <div className="text-red-300">Buy a Storage Vessel before purchasing grapes.</div>}
                {availableVessels.map((vessel) => <label key={vessel.id} className="flex items-center gap-2 rounded border border-gray-700 bg-gray-900/50 p-2 text-xs"><input type="checkbox" checked={selectedVesselIds.includes(vessel.id)} onChange={(event) => setSelectedVesselIds((current) => event.target.checked ? [...current, vessel.id] : current.filter((id) => id !== vessel.id))} /><span>{vessel.capacityLitres.toLocaleString()} L {vessel.material} {vessel.vesselType.replace('_', ' ')}</span></label>)}
              </div>
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
          <Button
            onClick={() => {
              if (!selectedOffer) return;
              const safeQty = Math.max(1, Math.min(selectedPurchaseKg, selectedOffer.availableKg));
              void handleBuy(selectedOffer.id, safeQty, selectedVesselIds);
            }}
            disabled={loading || !selectedOffer || !priceBreakdown || selectedVesselCapacity < requiredStorageLitres}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {loading
              ? 'Buying…'
              : `Buy for ${priceBreakdown ? formatNumber(selectedTotalCost, { currency: true, decimals: 0 }) : '—'}`}
          </Button>
        </DialogFooter>
  </>;
};
