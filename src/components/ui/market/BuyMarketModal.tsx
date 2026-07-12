import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { MarketOfferTable, type MarketOfferTableColumn } from './MarketOfferTable';
import { MarketQuickBuyRowAction } from './MarketQuickBuyRowAction';
import {
  getBuyGrapeMarketOffers,
  getBuyOfferPriceBreakdown,
  getBuyOfferStateLabel,
  type BuyGrapeMarketOffer,
} from '@/lib/services/sales/buyGrapeMarketService';
import { purchaseBuyMarketOffer } from '@/lib/services/market/buyMarketService';
import {
  estimateSupplierTrustPointGain,
  SUPPLIER_LOYALTY_LEVELS,
  type SupplierLoyaltyLevel,
  type SupplierLoyaltyRecord,
  getSupplierYearlyTrustCap,
} from '@/lib/services/sales/grapeSupplierLoyaltyService';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { formatNumber, getColorClass, getQualityCategory } from '@/lib/utils';
import { getFeatureConfig } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import type { WineFeature } from '@/lib/types/wineFeatures';
import type { WeatherState } from '@/lib/types/types';
import { getWeatherIcon, getWeatherLabel } from '@/lib/features/weather';
import { StorageVesselMarketModal } from './StorageVesselMarketModal';

type SortDirection = 'asc' | 'desc' | null;

interface BuyMarketModalProps {
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
  classify(priceBreakdown.supplierRelationshipMultiplier, 'supplier relationship');
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
            <span>Supplier relationship</span><span className="text-right">×{breakdown.supplierRelationshipMultiplier.toFixed(2)}</span>
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

function getTrustIcon(level: SupplierLoyaltyLevel): string {
  if (level === 0) return '○';
  if (level <= 2) return '◔';
  if (level <= 4) return '◕';
  return '●';
}

function getTrustColor(level: SupplierLoyaltyLevel): string {
  if (level === 0) return 'text-gray-400';
  if (level <= 2) return 'text-blue-300';
  if (level <= 4) return 'text-cyan-300';
  return 'text-amber-300';
}

const SupplierTrustPanel: React.FC<{
  supplierName?: string;
  loyalty: SupplierLoyaltyRecord | null;
  companyValue: number;
}> = ({ supplierName, loyalty, companyValue }) => {
  const level = (loyalty?.level ?? 0) as SupplierLoyaltyLevel;
  const config = SUPPLIER_LOYALTY_LEVELS[level];
  const nextLevel = level < 5 ? SUPPLIER_LOYALTY_LEVELS[(level + 1) as SupplierLoyaltyLevel] : null;
  const score = loyalty?.loyaltyScore ?? 0;
  const scoreToNext = nextLevel ? Math.max(0, nextLevel.minLoyaltyScore - score) : 0;
  const yearlyCap = getSupplierYearlyTrustCap(Math.max(1, loyalty?.consecutiveYears ?? 1), companyValue);

  return (
    <div className="rounded border border-blue-900/60 bg-blue-950/30 p-3 text-xs space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-blue-300">{getTrustIcon(level)} Supplier Trust</span>
        <span className={`font-bold ${getTrustColor(level)}`}>{config.name}</span>
      </div>

      <div className="flex gap-4 text-gray-400">
        <span>Supplier: <strong className="text-white">{supplierName ?? loyalty?.supplierName ?? 'Unknown'}</strong></span>
      </div>

      <div className="flex gap-4 text-gray-400">
        <span>Total purchases: <strong className="text-white">{(loyalty?.totalPurchases ?? 0)}</strong></span>
        <span>Streak: <strong className="text-white">{(loyalty?.consecutiveYears ?? 0)} {(loyalty?.consecutiveYears ?? 0) === 1 ? 'year' : 'years'}</strong></span>
        <span>Total bought: <strong className="text-white">{(loyalty?.totalKgPurchased ?? 0).toLocaleString()} kg</strong></span>
      </div>

      <div className="flex gap-4 text-gray-300">
        <span>Trust score: <strong className="text-white">{score.toLocaleString()}</strong></span>
        <span>Year cap: <strong className="text-white">{(loyalty?.yearLoyaltyPoints ?? 0).toLocaleString()} / {yearlyCap.toLocaleString()}</strong></span>
      </div>

      {config.benefits.length > 0 && (
        <ul className="space-y-0.5 text-gray-300">
          {config.benefits.map((benefit, i) => <li key={i}>• {benefit}</li>)}
        </ul>
      )}

      {nextLevel && (
        <div className="border-t border-blue-900/40 pt-2 text-amber-300">
          {scoreToNext === 0
            ? `Ready to advance to ${nextLevel.name}!`
            : `${scoreToNext.toLocaleString()} trust score to reach ${nextLevel.name}`
          }
        </div>
      )}

      {!loyalty && (
        <div className="border-t border-blue-900/40 pt-2 text-amber-300">
          First purchase from this supplier will establish this relationship.
        </div>
      )}
    </div>
  );
};

const BuyMarketModal: React.FC<BuyMarketModalProps> = ({ isOpen, onClose }) => {
  const [showStorageVessels, setShowStorageVessels] = useState(false);
  const [offers, setOffers] = useState<BuyGrapeMarketOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorByOfferId, setErrorByOfferId] = useState<Record<string, string>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [grapeFilter, setGrapeFilter] = useState<'all' | string>('all');
  const [stateFilter, setStateFilter] = useState<'all' | BuyGrapeMarketOffer['batchState']>('all');
  const [sortKey, setSortKey] = useState<string>('quality');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [companyValue, setCompanyValue] = useState(0);
  const [purchaseQuantityByOfferId, setPurchaseQuantityByOfferId] = useState<Record<string, number>>({});

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const nextOffers = await getBuyGrapeMarketOffers();
      setOffers(nextOffers);
      const computedCompanyValue = await calculateCompanyValue().catch(() => 0);
      setCompanyValue(computedCompanyValue);
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
    }
  }, [isOpen]);

  useEffect(() => {
    setShowAllOffers(false);
  }, [grapeFilter, stateFilter, sortKey, sortDirection]);

  const handleBuy = useCallback(async (offerId: string, quantityKg: number) => {
    const result = await purchaseBuyMarketOffer(offerId, quantityKg);

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
  }, [onClose]);

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

  const trustPreview = useMemo(() => {
    if (!selectedOffer || selectedPurchaseKg <= 0) return null;
    const loyalty = selectedOffer.supplierLoyalty;
    const consecutiveYears = Math.max(1, loyalty?.consecutiveYears ?? 1);
    const yearPoints = Math.max(0, loyalty?.yearLoyaltyPoints ?? 0);
    const preview = estimateSupplierTrustPointGain(selectedPurchaseKg, consecutiveYears, yearPoints, companyValue);

    return {
      rawPoints: preview.rawPoints,
      appliedPoints: preview.appliedPoints,
      cappedPoints: Math.max(0, preview.rawPoints - preview.appliedPoints),
      yearPoints,
      yearlyCap: preview.yearlyCap,
    };
  }, [companyValue, selectedOffer, selectedPurchaseKg]);

  const displayedOffers = useMemo(() => {
    if (showAllOffers) return filteredAndSortedOffers;
    return filteredAndSortedOffers.slice(0, 5);
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
      header: 'Offer',
      sortable: true,
      className: 'w-[23%] min-w-[205px]',
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
            <UnifiedTooltip
              title="Supplier Trust Level"
              content={<span className="text-xs leading-snug">Persistent trust with this supplier can improve relationship pricing and listing persistence over time.</span>}
            >
              <span className={`rounded border border-gray-700 px-2 py-0.5 text-[10px] ${getTrustColor((offer.supplierLoyalty?.level ?? 0) as SupplierLoyaltyLevel)}`}>
                Trust {offer.supplierLoyalty?.level ?? 0}
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

  if (showStorageVessels) {
    return <StorageVesselMarketModal isOpen={isOpen} onClose={onClose} onShowGrapes={() => setShowStorageVessels(false)} />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[98vw] max-w-[96rem] max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Buy from Market</DialogTitle>
          <DialogDescription className="sr-only">
            Browse and purchase grape market offers, compare quality and pricing pressure, and buy directly from each row.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-500">Grapes</Button>
          <Button variant="outline" size="sm" onClick={() => setShowStorageVessels(true)}>Casks</Button>
        </div>

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

            <SupplierTrustPanel
              supplierName={selectedOffer?.supplierName}
              loyalty={selectedOffer?.supplierLoyalty ?? null}
              companyValue={companyValue}
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
                        content={<span className="text-xs leading-snug">Wine potential, market conditions, supplier relationship, and processing stage can move the final price. Winepedia explains the usual direction of each factor without exposing the formula.</span>}
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
                    Trust preview: +{trustPreview.appliedPoints.toLocaleString()} points this purchase
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

          {filteredAndSortedOffers.length > 5 && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                onClick={() => setShowAllOffers((current) => !current)}
              >
                {showAllOffers ? 'Show Less' : `Show More (${filteredAndSortedOffers.length - 5} more)`}
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
          <Button
            onClick={() => {
              if (!selectedOffer) return;
              const safeQty = Math.max(1, Math.min(selectedPurchaseKg, selectedOffer.availableKg));
              void handleBuy(selectedOffer.id, safeQty);
            }}
            disabled={loading || !selectedOffer || !priceBreakdown}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {loading
              ? 'Buying…'
              : `Buy for ${priceBreakdown ? formatNumber(selectedTotalCost, { currency: true, decimals: 0 }) : '—'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyMarketModal;
