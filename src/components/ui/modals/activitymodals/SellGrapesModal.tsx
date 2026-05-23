import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { WineBatch, type GrapeVariety } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Slider, UnifiedTooltip } from '@/components/ui';
import { MarketOfferTable, type MarketOfferTableColumn } from '../../market/MarketOfferTable';
import {
  BASE_GRAPE_PRICE_PER_KG,
  GrapeBuyer,
  GrapeSalePricing,
  getAvailableBuyers,
  calculateGrapeSalePrice,
  sellGrapes,
} from '@/lib/services/sales/sellGrapesService';
import {
  CooperativeMembership,
  getCooperativeMembership,
  getCooperativeFloorPrice,
  COOPERATIVE_LEVELS,
} from '@/lib/services/sales/cooperativeService';
import {
  BUYER_LOYALTY_LEVELS,
  BuyerLoyaltyRecord,
  type BuyerLoyaltyLevel,
  estimateBuyerLoyaltyPointGain,
  getBuyerLoyalties,
  getBuyerYearlyLoyaltyCap,
} from '@/lib/services/sales/grapeBuyerLoyaltyService';
import { getGameState } from '@/lib/services/core/gameState';
import { companyService } from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { formatNumber } from '@/lib/utils/utils';
import { GrapeIcon } from '@/lib/utils/icons';

function isSeasonalGeneratedDescription(description?: string): boolean {
  if (!description) return false;
  return /active for/i.test(description);
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

function getDemandPressureIndex(buyer?: GrapeBuyer): number {
  if (!buyer?.demandFactors) return 1;
  return (
    buyer.demandFactors.seasonPriceMultiplier
    * buyer.demandFactors.economyPriceMultiplier
    * buyer.demandFactors.yearCyclePriceMultiplier
    * buyer.demandFactors.volatilityPriceMultiplier
    * (buyer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1)
  );
}

function getVolatilityRiskIndex(buyer?: GrapeBuyer): number {
  if (!buyer?.demandFactors) return 1;
  return (
    buyer.demandFactors.volatilityPriceMultiplier
    * (buyer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1)
  );
}
interface SellGrapesModalProps extends DialogProps {
  batch: WineBatch | null;
}

const LEVEL_ICONS = ['🌱', '🌿', '🍃', '🏆'];
const LEVEL_COLORS = [
  'text-gray-400',
  'text-green-400',
  'text-emerald-400',
  'text-amber-400',
];

function getLoyaltyIcon(level: BuyerLoyaltyLevel): string {
  if (level === 0) return '○';
  if (level <= 3) return '◔';
  if (level <= 7) return '◕';
  return '●';
}

function getLoyaltyColor(level: BuyerLoyaltyLevel): string {
  if (level === 0) return 'text-gray-400';
  if (level <= 3) return 'text-blue-300';
  if (level <= 7) return 'text-cyan-300';
  return 'text-amber-300';
}

const CooperativeMembershipPanel: React.FC<{
  membership: CooperativeMembership | null;
  isSelected: boolean;
}> = ({ membership, isSelected }) => {
  if (!isSelected) return null;

  const level = (membership?.level ?? 0) as 0 | 1 | 2 | 3;
  const config = COOPERATIVE_LEVELS[level];
  const streak = membership?.consecutiveYears ?? 0;
  const totalSales = membership?.totalSales ?? 0;
  const nextLevel = (level < 3 ? COOPERATIVE_LEVELS[(level + 1) as 1 | 2 | 3] : null);
  const yearsToNext = nextLevel ? Math.max(0, nextLevel.minConsecutiveYears - streak) : 0;

  return (
    <div className="mt-2 rounded border border-green-900/60 bg-green-950/30 p-3 text-xs space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-green-300">
          {LEVEL_ICONS[level]} Cooperative Membership
        </span>
        <span className={`font-bold ${LEVEL_COLORS[level]}`}>{config.name}</span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-gray-400">
        <span>Streak: <strong className="text-white">{streak} {streak === 1 ? 'year' : 'years'}</strong></span>
        <span>Total sales: <strong className="text-white">{totalSales}</strong></span>
        {membership?.totalKgSold ? (
          <span>Total sold: <strong className="text-white">{membership.totalKgSold.toLocaleString()} kg</strong></span>
        ) : null}
      </div>

      {/* Floor price highlight */}
      {level > 0 && (
        <div className="text-green-300">
          Floor price: <strong>{formatNumber(config.floorPricePerKg, { currency: true, decimals: 2 })}/kg</strong>
          {level === 0 && <span className="text-gray-500"> (first sale unlocks floor)</span>}
        </div>
      )}

      {/* Benefits */}
      {config.benefits.length > 0 && (
        <ul className="space-y-0.5 text-gray-300">
          {config.benefits.map((b, i) => <li key={i}>✓ {b}</li>)}
        </ul>
      )}

      {/* Progress to next level */}
      {nextLevel && (
        <div className="border-t border-green-900/40 pt-2 text-amber-300">
          {yearsToNext === 0
            ? `Ready to advance to ${nextLevel.name}!`
            : `${yearsToNext} more consecutive ${yearsToNext === 1 ? 'year' : 'years'} → ${nextLevel.name} (${formatNumber(nextLevel.floorPricePerKg, { currency: true, decimals: 2 })}/kg floor)`
          }
        </div>
      )}

      {/* Hint for non-members */}
      {level === 0 && (
        <div className="border-t border-green-900/40 pt-2 text-amber-300">
          {config.nextLevelHint}
        </div>
      )}
    </div>
  );
};

const BuyerLoyaltyPanel: React.FC<{
  buyer: GrapeBuyer | undefined;
  loyalty: BuyerLoyaltyRecord | null;
  companyValue: number;
}> = ({ buyer, loyalty, companyValue }) => {
  if (!buyer) return null;

  const level = (loyalty?.level ?? 0) as BuyerLoyaltyLevel;
  const config = BUYER_LOYALTY_LEVELS[level];
  const nextLevel = level < 10 ? BUYER_LOYALTY_LEVELS[(level + 1) as BuyerLoyaltyLevel] : null;
  const score = loyalty?.loyaltyScore ?? 0;
  const scoreToNext = nextLevel ? Math.max(0, nextLevel.minLoyaltyScore - score) : 0;
  const yearlyCap = getBuyerYearlyLoyaltyCap(loyalty?.consecutiveYears ?? 1, companyValue);

  return (
    <div className="rounded border border-blue-900/60 bg-blue-950/30 p-3 text-xs space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-blue-300">{getLoyaltyIcon(level)} Buyer Loyalty</span>
        <span className={`font-bold ${getLoyaltyColor(level)}`}>{config.name}</span>
      </div>

      <div className="flex gap-4 text-gray-400">
        <span>Total sales: <strong className="text-white">{(loyalty?.totalSales ?? 0)}</strong></span>
        <span>Streak: <strong className="text-white">{(loyalty?.consecutiveYears ?? 0)} {(loyalty?.consecutiveYears ?? 0) === 1 ? 'year' : 'years'}</strong></span>
        <span>Total sold: <strong className="text-white">{(loyalty?.totalKgSold ?? 0).toLocaleString()} kg</strong></span>
      </div>

      <div className="flex gap-4 text-gray-300">
        <span>Loyalty score: <strong className="text-white">{score.toLocaleString()}</strong></span>
        <span>Relationship growth cap (year): <strong className="text-white">{(loyalty?.yearLoyaltyPoints ?? 0).toLocaleString()} / {yearlyCap.toLocaleString()}</strong></span>
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
            : `${scoreToNext.toLocaleString()} loyalty score to reach ${nextLevel.name}`
          }
        </div>
      )}

      {!loyalty && (
        <div className="border-t border-blue-900/40 pt-2 text-amber-300">
          First sale to {buyer.name} will establish this relationship.
        </div>
      )}
    </div>
  );
};

const SellGrapesModal: React.FC<SellGrapesModalProps> = ({ isOpen, onClose, batch }) => {
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('bulk_buyer');
  const [buyers, setBuyers] = useState<GrapeBuyer[]>([]);
  const [isSelling, setIsSelling] = useState(false);
  const [salePercentageByBuyerId, setSalePercentageByBuyerId] = useState<Record<string, number>>({});
  const [grapeFilter, setGrapeFilter] = useState<'all' | string>('all');
  const [sortKey, setSortKey] = useState<string>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [membership, setMembership] = useState<CooperativeMembership | null>(null);
  const [buyerLoyaltyById, setBuyerLoyaltyById] = useState<Record<string, BuyerLoyaltyRecord>>({});
  const [companyValue, setCompanyValue] = useState(0);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowFormulaDetails(false);
      setSalePercentageByBuyerId({});
    }
  }, [isOpen, batch?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const companyId = getCurrentCompanyId();
    if (!companyId) return;
    companyService.getCompany(companyId).then(async company => {
      const country = company?.startingCountry;
      const seasonalBuyers = await getAvailableBuyers(country);
      setBuyers(seasonalBuyers);
      const loyalties = await getBuyerLoyalties(seasonalBuyers.map(b => b.id));
      setBuyerLoyaltyById(loyalties);
      const computedCompanyValue = await calculateCompanyValue().catch(() => 0);
      setCompanyValue(computedCompanyValue);
      if (seasonalBuyers.length > 0) {
        const preferred = seasonalBuyers.find(b => b.id !== 'bulk_buyer') || seasonalBuyers[0];
        setSelectedBuyerId(preferred.id);
      }
      if (country === 'Germany') {
        getCooperativeMembership().then(setMembership);
      }
    });
  }, [isOpen]);

  const selectedBuyer: GrapeBuyer | undefined = buyers.find(b => b.id === selectedBuyerId);
  const buyerLoyalty = selectedBuyer ? (buyerLoyaltyById[selectedBuyer.id] ?? null) : null;
  const prestige = getGameState().prestige ?? 0;

  const grapeFilterOptions = useMemo(() => {
    return Array.from(new Set(buyers.flatMap((buyer) => buyer.favoriteGrapes ?? []))).sort();
  }, [buyers]);

  const getBuyerPriceBreakdown = useCallback((buyer: GrapeBuyer) => {
    if (!batch) return null;
    const floorOverride = buyer.id === 'winzergenossenschaft'
      ? Math.max(getCooperativeFloorPrice((membership?.level ?? 0) as 0 | 1 | 2 | 3), buyer.floorPricePerKg ?? 0)
      : undefined;

    return calculateGrapeSalePrice(batch, buyer, prestige, floorOverride, 1);
  }, [batch, membership, prestige]);

  const getBuyerTrustLevel = useCallback((buyer: GrapeBuyer) => {
    return Math.max(0, buyerLoyaltyById[buyer.id]?.level ?? 0);
  }, [buyerLoyaltyById]);

  const filteredAndSortedBuyers = useMemo(() => {
    const filtered = buyers.filter((buyer) => {
      if (grapeFilter !== 'all' && buyer.favoriteGrapes && !buyer.favoriteGrapes.includes(grapeFilter as GrapeVariety)) return false;
      return true;
    });

    if (!sortDirection) return filtered;

    const sorted = [...filtered].sort((left, right) => {
      const leftPrice = getBuyerPriceBreakdown(left)?.finalPricePerKg ?? 0;
      const rightPrice = getBuyerPriceBreakdown(right)?.finalPricePerKg ?? 0;
      const leftTrust = getBuyerTrustLevel(left);
      const rightTrust = getBuyerTrustLevel(right);
      const leftCaps = left.remainingSeasonLimitKg ?? Number.MAX_SAFE_INTEGER;
      const rightCaps = right.remainingSeasonLimitKg ?? Number.MAX_SAFE_INTEGER;
      const leftQuantity = Math.max(1, Math.min(batch?.quantity ?? 0, left.remainingSeasonLimitKg ?? batch?.quantity ?? 0));
      const rightQuantity = Math.max(1, Math.min(batch?.quantity ?? 0, right.remainingSeasonLimitKg ?? batch?.quantity ?? 0));
      const leftMarket = getDemandPressureIndex(left) + getVolatilityRiskIndex(left);
      const rightMarket = getDemandPressureIndex(right) + getVolatilityRiskIndex(right);

      const leftValue = sortKey === 'offer' ? left.name
        : sortKey === 'batch' ? (batch?.state ?? '')
          : sortKey === 'favorite' ? (left.favoriteGrapes?.join(', ') ?? '')
          : sortKey === 'state' ? (batch?.state ?? '')
            : sortKey === 'trust' ? leftTrust
              : sortKey === 'market' ? leftMarket
                : sortKey === 'price' ? leftPrice
                  : sortKey === 'caps' ? leftCaps
                    : sortKey === 'quantity' ? leftQuantity
                      : sortKey === 'supply' ? (left.remainingSeasonLimitKg ?? 0)
                        : left.name;

      const rightValue = sortKey === 'offer' ? right.name
        : sortKey === 'batch' ? (batch?.state ?? '')
          : sortKey === 'favorite' ? (right.favoriteGrapes?.join(', ') ?? '')
          : sortKey === 'state' ? (batch?.state ?? '')
            : sortKey === 'trust' ? rightTrust
              : sortKey === 'market' ? rightMarket
                : sortKey === 'price' ? rightPrice
                  : sortKey === 'caps' ? rightCaps
                    : sortKey === 'quantity' ? rightQuantity
                      : sortKey === 'supply' ? (right.remainingSeasonLimitKg ?? 0)
                        : right.name;

      if (leftValue === rightValue) return 0;
      const result = leftValue > rightValue ? 1 : -1;
      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [batch, buyers, grapeFilter, getBuyerPriceBreakdown, getBuyerTrustLevel, sortDirection, sortKey]);

  useEffect(() => {
    if (filteredAndSortedBuyers.length === 0) {
      setSelectedBuyerId('');
      return;
    }

    const hasSelected = filteredAndSortedBuyers.some((buyer) => buyer.id === selectedBuyerId);
    if (!hasSelected) {
      setSelectedBuyerId(filteredAndSortedBuyers[0].id);
    }
  }, [filteredAndSortedBuyers, selectedBuyerId]);

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

  const getSalePercentageForBuyer = useCallback((buyer: GrapeBuyer): number => {
    const current = salePercentageByBuyerId[buyer.id];
    if (typeof current !== 'number') return 100;
    return Math.max(1, Math.min(100, Math.round(current)));
  }, [salePercentageByBuyerId]);

  const selectedSellPercentage = useMemo(() => {
    if (!selectedBuyer) return 100;
    return getSalePercentageForBuyer(selectedBuyer);
  }, [getSalePercentageForBuyer, selectedBuyer]);
  const maxSelectableKg = useMemo(() => {
    if (!batch) return 0;
    if (!selectedBuyer || selectedBuyer.remainingSeasonLimitKg === undefined) return batch.quantity;
    return Math.max(0, Math.min(batch.quantity, selectedBuyer.remainingSeasonLimitKg));
  }, [batch, selectedBuyer]);

  const selectedQuantityKg = useMemo(() => {
    if (!batch || maxSelectableKg <= 0) return 0;
    return Math.max(1, Math.min(maxSelectableKg, Math.round((batch.quantity * selectedSellPercentage) / 100)));
  }, [batch, selectedSellPercentage, maxSelectableKg]);
  const exceedsBuyerCap = useMemo(() => {
    return selectedQuantityKg > maxSelectableKg;
  }, [selectedQuantityKg, maxSelectableKg]);

  const loyaltyPreview = useMemo(() => {
    if (!selectedBuyer || selectedQuantityKg <= 0) return null;
    const consecutiveYears = Math.max(1, buyerLoyalty?.consecutiveYears ?? 1);
    const yearPoints = Math.max(0, buyerLoyalty?.yearLoyaltyPoints ?? 0);
    const preview = estimateBuyerLoyaltyPointGain(selectedQuantityKg, consecutiveYears, yearPoints, companyValue);

    return {
      rawPoints: preview.rawPoints,
      appliedPoints: preview.appliedPoints,
      cappedPoints: Math.max(0, preview.rawPoints - preview.appliedPoints),
      yearPoints,
      yearlyCap: preview.yearlyCap,
    };
  }, [selectedBuyer, selectedQuantityKg, buyerLoyalty, companyValue]);

  const pricing: GrapeSalePricing | null = useMemo(() => {
    if (!batch || !selectedBuyer) return null;
    const prestige = getGameState().prestige ?? 0;
    // For the cooperative, use the membership-aware floor price
    let floorOverride: number | undefined;
    if (selectedBuyer.id === 'winzergenossenschaft') {
      floorOverride = Math.max(
        selectedBuyer.floorPricePerKg ?? 0,
        getCooperativeFloorPrice((membership?.level ?? 0) as 0 | 1 | 2 | 3)
      );
    }
    return calculateGrapeSalePrice(batch, selectedBuyer, prestige, floorOverride, selectedQuantityKg);
  }, [batch, selectedBuyer, membership, selectedQuantityKg]);

  const handleSell = async () => {
    if (!batch || !selectedBuyer || selectedQuantityKg <= 0) return;
    setIsSelling(true);
    try {
      const result = await sellGrapes(batch.id, selectedBuyer, selectedQuantityKg);
      if (result.success) {
        onClose();
      } else {
        console.error('Sell grapes failed:', result.error);
      }
    } finally {
      setIsSelling(false);
    }
  };

  const qualityPercent = pricing ? Math.round(pricing.wineScore * 100) : 0;
  const volatilitySeason = selectedBuyer?.demandFactors?.volatilitySeason;
  const seasonIcon = getSeasonVolatilityIcon(volatilitySeason);
  const volatilityEconomyPhase = selectedBuyer?.demandFactors?.volatilityEconomyPhase;
  const economyIcon = getEconomyVolatilityIcon(volatilityEconomyPhase);
  const volatilityWeatherState = selectedBuyer?.demandFactors?.volatilityWeatherState;
  const volatilityWeatherIntensity = selectedBuyer?.demandFactors?.volatilityWeatherIntensity;
  const weatherIcon = getWeatherVolatilityIcon(volatilityWeatherState);
  const volatilityPrice = selectedBuyer?.demandFactors?.volatilityPriceMultiplier ?? 1;
  const volatilityLimit = selectedBuyer?.demandFactors?.volatilityLimitMultiplier ?? 1;
  const selectedDemandPressureIndex = getDemandPressureIndex(selectedBuyer);
  const selectedVolatilityRiskIndex = getVolatilityRiskIndex(selectedBuyer);

  const buyerColumns = useMemo<MarketOfferTableColumn<GrapeBuyer>[]>(() => {
    if (!batch) return [];

    const columnHeader = (label: string, tooltip: string) => (
      <UnifiedTooltip title={label} content={<span className="text-xs leading-snug">{tooltip}</span>}>
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300">?</span>
        </span>
      </UnifiedTooltip>
    );

    return [
      {
        key: 'offer',
        header: columnHeader('Offer', 'Buyer name and relationship context. Use this column to inspect the buyer first.'),
        sortable: true,
        className: 'w-[22%] min-w-[220px]',
        render: (buyer) => {
          const trustLevel = getBuyerTrustLevel(buyer);
          const showInlineDescription = Boolean(buyer.description) && !isSeasonalGeneratedDescription(buyer.description);
          const topBadgeLabel = buyer.originTag === 'Relationship carry-over' ? 'RELATIONSHIP CARRY-OVER • EXISTING' : buyer.originTag;

          return (
            <div className="space-y-1">
              <div className="font-medium text-white leading-tight">{buyer.name}</div>
              <div className="flex flex-wrap gap-1.5">
                <UnifiedTooltip title="Trust Badge" content={<span className="text-xs leading-snug">Relationship trust with this buyer. Higher trust improves sale opportunities and caps over time.</span>}>
                  <span className={`rounded border border-gray-700 px-2 py-0.5 text-[10px] ${getLoyaltyColor(trustLevel as BuyerLoyaltyLevel)}`}>
                    Trust {trustLevel}
                  </span>
                </UnifiedTooltip>
                {topBadgeLabel && (
                  <UnifiedTooltip
                    title="Buyer Context"
                    content={
                      <div className="space-y-1">
                        {buyer.originReason ? <div className="text-gray-200">{buyer.originReason}</div> : null}
                        {buyer.description ? <div className="text-gray-400">{buyer.description}</div> : null}
                      </div>
                    }
                    side="top"
                  >
                    <span className="inline-flex rounded border border-gray-600 bg-gray-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300 cursor-help">
                      {topBadgeLabel}
                    </span>
                  </UnifiedTooltip>
                )}
              </div>
              {showInlineDescription && <div className="text-[11px] text-gray-400">{buyer.description}</div>}
            </div>
          );
        },
      },
      {
        key: 'batch',
        header: columnHeader('Batch', 'The selected batch details. This stays visible while you compare buyers.'),
        sortable: true,
        className: 'w-[18%] min-w-[150px]',
        render: () => (
          <div className="space-y-0.5 text-[11px]">
            <div className="text-white font-medium">{batch.grape}</div>
            <div className="text-gray-400">{batch.quantity.toLocaleString()} kg</div>
            <div className="text-gray-300">Quality {qualityPercent}%</div>
            <div className="text-gray-500">State {batch.state}</div>
          </div>
        ),
      },
      {
        key: 'favorite',
        header: columnHeader('Favorite Grape', 'Buyer preferred grapes. Matching grapes can grant a favorite-grape bonus.'),
        sortable: true,
        className: 'w-[12%] min-w-[140px]',
        render: (buyer) => {
          const favorites = buyer.favoriteGrapes ?? [];

          if (favorites.length === 0) {
            return <span className="text-[11px] text-gray-500">No preference</span>;
          }

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {favorites.slice(0, 2).map((grape) => (
                <div key={`${buyer.id}-${grape}`} className="inline-flex items-center rounded border border-gray-700 px-1.5 py-1">
                  <GrapeIcon variety={grape as GrapeVariety} size="xs" tooltip={grape} />
                </div>
              ))}
            </div>
          );
        },
      },
      {
        key: 'state',
        header: columnHeader('State', 'The current sellable batch state. Different states can carry different value.'),
        sortable: true,
        className: 'w-[10%] min-w-[95px] text-right',
        render: () => (
          <div className="space-y-0.5 text-[11px] text-gray-300">
            <div>{batch.state === 'grapes' ? 'Grapes' : batch.state === 'must_ready' ? 'Must' : batch.state === 'must_fermenting' ? 'Fermenting' : batch.state}</div>
          </div>
        ),
      },
      {
        key: 'market',
        header: columnHeader('Market', 'Market pressure and volatility risk used in the price calculation.'),
        sortable: true,
        className: 'w-[14%] min-w-[135px] text-right',
        render: (buyer) => {
          const pressure = getDemandPressureIndex(buyer);
          const risk = getVolatilityRiskIndex(buyer);
          return (
            <div className="space-y-0.5 text-[11px]">
              <div>
                <span className="text-blue-300 font-medium">Pressure {pressure.toFixed(2)}x</span>
                <span className="text-gray-500"> · </span>
                <span className="text-purple-300 font-medium">Risk {risk.toFixed(2)}x</span>
              </div>
              <div className="text-gray-400">{buyer.demandFactors?.volatilityEconomyPhase ?? 'Economy'} / {buyer.demandFactors?.volatilityWeatherState ?? 'Weather'}</div>
            </div>
          );
        },
      },
      {
        key: 'price',
        header: columnHeader('Price per kg', 'The final sell price per kilogram for this buyer and batch state.'),
        sortable: true,
        className: 'w-[11%] min-w-[105px] text-right text-amber-300',
        render: (buyer) => {
          const rowPricing = getBuyerPriceBreakdown(buyer);
          return rowPricing ? formatNumber(rowPricing.finalPricePerKg, { currency: true, decimals: 2 }) : '—';
        },
      },
      {
        key: 'caps',
        header: columnHeader('Caps', 'Seasonal capacity and yearly relationship growth cap.'),
        sortable: true,
        className: 'w-[14%] min-w-[150px] text-right',
        render: (buyer) => {
          const loyaltyForBuyer = buyerLoyaltyById[buyer.id] ?? null;
          const buyerYearlyCap = getBuyerYearlyLoyaltyCap(Math.max(1, loyaltyForBuyer?.consecutiveYears ?? 1), companyValue);

          return (
            <div className="space-y-0.5 text-[11px]">
              <div className="text-gray-300">Season {buyer.effectiveSeasonLimitKg !== undefined ? `${buyer.effectiveSeasonLimitKg.toLocaleString()} kg` : '∞'}</div>
              <div className="text-gray-400">Remain {buyer.remainingSeasonLimitKg !== undefined ? `${buyer.remainingSeasonLimitKg.toLocaleString()} kg` : '∞'}</div>
              <div className="text-cyan-300">Growth {Math.max(0, loyaltyForBuyer?.yearLoyaltyPoints ?? 0).toLocaleString()}/{buyerYearlyCap.toLocaleString()}</div>
            </div>
          );
        },
      },
      {
        key: 'quantity',
        header: columnHeader('Quantity', 'Choose how much of the batch to sell to this buyer.'),
        sortable: true,
        className: 'w-[20%] min-w-[160px] text-right',
        render: (buyer) => {
          const buyerQuantity = getSalePercentageForBuyer(buyer);
          const buyerMaxSelectableKg = Math.max(0, Math.min(batch.quantity, buyer.remainingSeasonLimitKg ?? batch.quantity));
          const buyerMaxSelectablePercent = Math.max(1, Math.min(100, Math.floor((buyerMaxSelectableKg / batch.quantity) * 100)));

          return (
            <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
              <Slider
                value={[Math.min(buyerQuantity, buyerMaxSelectablePercent)]}
                onValueChange={([value]) => {
                  const safePercent = Math.max(1, Math.min(Math.round(value ?? 100), buyerMaxSelectablePercent));
                  setSalePercentageByBuyerId((current) => ({
                    ...current,
                    [buyer.id]: safePercent,
                  }));
                }}
                min={1}
                max={buyerMaxSelectablePercent}
                step={1}
                className="py-1"
                disabled={buyerMaxSelectableKg <= 0}
              />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>{Math.max(1, Math.min(buyerQuantity, buyerMaxSelectablePercent))}%</span>
                <span className="text-white">{Math.max(1, Math.min(buyerMaxSelectableKg, Math.round((batch.quantity * buyerQuantity) / 100))).toLocaleString()} kg</span>
              </div>
            </div>
          );
        },
      },
    ];
  }, [batch, buyerLoyaltyById, companyValue, getBuyerPriceBreakdown, getBuyerTrustLevel, getSalePercentageForBuyer, qualityPercent]);

  if (!batch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Sell Grapes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
            {selectedBuyer?.demandFactors ? (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-cyan-200 font-medium">Market volatility outlook</span>
                  <span className="inline-flex items-center gap-1 rounded border border-sky-700/70 bg-sky-900/30 px-2 py-1 text-sky-200">
                    <span>{seasonIcon}</span>
                    <span>{volatilitySeason ?? 'Season'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-indigo-700/70 bg-indigo-900/30 px-2 py-1 text-indigo-200">
                    <span>{economyIcon}</span>
                    <span>{volatilityEconomyPhase ?? 'Economy'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-blue-700/70 bg-blue-900/30 px-2 py-1 text-blue-200">
                    <span>{weatherIcon}</span>
                    <span>{volatilityWeatherState ?? 'Weather'} {volatilityWeatherIntensity ? `(${volatilityWeatherIntensity})` : ''}</span>
                  </span>
                  <UnifiedTooltip
                    title="Price Volatility Factor"
                    content={<span className="text-xs leading-snug">This is the volatility price multiplier. It contributes to Risk, then combines with season, economy, and cycle factors for Pressure.</span>}
                  >
                    <span className="inline-flex items-center gap-1 rounded border border-cyan-700/70 bg-cyan-900/30 px-2 py-1 text-cyan-200">
                      <span>💶</span>
                      <span>Price {formatVolatilityDelta(volatilityPrice)}</span>
                    </span>
                  </UnifiedTooltip>
                  <UnifiedTooltip
                    title="Supply Volatility Factor"
                    content={<span className="text-xs leading-snug">This is the volatility supply multiplier. It signals market tightness and availability pressure, but it is not multiplied directly into final price/kg.</span>}
                  >
                    <span className="inline-flex items-center gap-1 rounded border border-amber-700/70 bg-amber-900/30 px-2 py-1 text-amber-200">
                      <span>📦</span>
                      <span>Supply {formatVolatilityDelta(volatilityLimit)}</span>
                    </span>
                  </UnifiedTooltip>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-gray-300">
                  {selectedBuyer.demandFactors.volatilityPriceReason && (
                    <div><span className="text-cyan-200">Price outlook:</span> {selectedBuyer.demandFactors.volatilityPriceReason}</div>
                  )}
                  {selectedBuyer.demandFactors.volatilityLimitReason && (
                    <div><span className="text-amber-200">Supply outlook:</span> {selectedBuyer.demandFactors.volatilityLimitReason}</div>
                  )}
                  {selectedBuyer.demandFactors.volatilityBuyerSensitivityReason && (
                    <div><span className="text-blue-200">Buyer profile:</span> {selectedBuyer.demandFactors.volatilityBuyerSensitivityReason}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded border border-cyan-800/70 bg-cyan-950/20 p-3 text-xs text-gray-300">
                Select a buyer to inspect market volatility details.
              </div>
            )}

            <div className="space-y-3">
              <BuyerLoyaltyPanel buyer={selectedBuyer} loyalty={buyerLoyalty} companyValue={companyValue} />
              {selectedBuyer?.id === 'winzergenossenschaft' && (
                <CooperativeMembershipPanel membership={membership} isSelected={true} />
              )}
            </div>

            <div className="space-y-3">
              {pricing && (
                <div className="bg-gray-800 rounded p-3 space-y-3 text-sm border border-gray-700/70">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 font-medium uppercase tracking-wide text-xs">Price Summary</p>
                    <span className="text-xs text-gray-400">{selectedBuyer?.name ?? 'Buyer'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Base Price</span><span className="text-right">{formatNumber(BASE_GRAPE_PRICE_PER_KG, { currency: true, decimals: 2 })}/kg</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Price per kg</span><span className="text-right text-white">{formatNumber(pricing.finalPricePerKg, { currency: true, decimals: 2 })}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Quality Impact ({qualityPercent}%)</span><span className="text-right">×{pricing.qualityMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Prestige Factor</span><span className="text-right">×{pricing.prestigeBonus.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">State Factor</span><span className="text-right">×{pricing.stateMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Market Pressure Index</span><span className="text-right text-blue-300">×{selectedDemandPressureIndex.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Volatility Risk Index</span><span className="text-right text-purple-300">×{selectedVolatilityRiskIndex.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Market Context Factor</span><span className="text-right">×{pricing.marketContextMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Supplier Sensitivity Factor</span><span className="text-right">×{pricing.marketSensitivityMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Anti-Arbitrage Penalty</span><span className="text-right">×{pricing.marketPenaltyMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Buyer Market Multiplier</span><span className="text-right">×{pricing.buyerMultiplier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Relationship Factor</span><span className="text-right">×{(pricing.relationshipMultiplier ?? 1).toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Favorite Grape Bonus</span><span className="text-right">+{(pricing.favoriteGrapeBonusMultiplier ?? 0).toFixed(3)}×</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Sale quantity</span><span className="text-right">{pricing.quantityKg.toLocaleString()} kg</span></div>
                  </div>

                  {pricing.appliedFloor && pricing.effectiveFloorPrice > 0 && (
                    <div className="rounded border border-green-900/70 bg-green-950/20 px-3 py-2 text-xs text-green-300">
                      Cooperative floor applied at {formatNumber(pricing.effectiveFloorPrice, { currency: true, decimals: 2 })}/kg.
                    </div>
                  )}

                  <div className="rounded border border-gray-700/70 bg-gray-900/40 p-2 text-xs text-gray-300 space-y-1">
                    <div className="text-gray-400">Exact calculation (raw)</div>
                    <div className="leading-snug break-words">
                      {formatNumber(BASE_GRAPE_PRICE_PER_KG, { currency: true, decimals: 2 })}
                      {' × '}{pricing.qualityMultiplier.toFixed(3)}
                      {' × '}{pricing.prestigeBonus.toFixed(3)}
                      {' × '}{pricing.stateMultiplier.toFixed(3)}
                      {' × '}{pricing.marketContextMultiplier.toFixed(3)}
                      {' × '}{pricing.marketSensitivityMultiplier.toFixed(3)}
                      {' × '}{pricing.marketPenaltyMultiplier.toFixed(3)}
                      {' × '}{pricing.buyerMultiplier.toFixed(3)}
                      {' × '}{pricing.relationshipMultiplier.toFixed(3)}
                      {' = '}{formatNumber(pricing.rawPricePerKg, { currency: true, decimals: 3 })}/kg
                      {pricing.appliedFloor
                        ? ` (floor raises to ${formatNumber(pricing.effectiveFloorPrice, { currency: true, decimals: 2 })}/kg)`
                        : ''}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Rounded display price: {formatNumber(pricing.finalPricePerKg, { currency: true, decimals: 2 })}/kg
                    </div>
                  </div>

                  <div className="border-t border-gray-700/70 pt-2">
                    <button
                      type="button"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                      onClick={() => setShowFormulaDetails((current) => !current)}
                    >
                      {showFormulaDetails ? 'Hide detailed formula factors' : 'Show detailed formula factors'}
                    </button>

                    {showFormulaDetails && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Quality Factor</span><span className="text-right">×{pricing.qualityMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Prestige Factor</span><span className="text-right">×{pricing.prestigeBonus.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">State Factor</span><span className="text-right">×{pricing.stateMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Market Context Factor</span><span className="text-right">×{pricing.marketContextMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Supplier Sensitivity Factor</span><span className="text-right">×{pricing.marketSensitivityMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Anti-Arbitrage Penalty</span><span className="text-right">×{pricing.marketPenaltyMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Buyer Market Multiplier</span><span className="text-right">×{pricing.buyerMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Relationship Factor</span><span className="text-right">×{pricing.relationshipMultiplier.toFixed(3)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Favorite Grape Bonus</span><span className="text-right">+{pricing.favoriteGrapeBonusMultiplier.toFixed(3)}×</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-400">Floor Price</span><span className="text-right">{formatNumber(pricing.effectiveFloorPrice, { currency: true, decimals: 2 })}/kg</span></div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between font-bold text-amber-400 text-base border-t border-gray-600 pt-2">
                    <span>Total Revenue</span>
                    <span>{formatNumber(pricing.totalRevenue, { currency: true, decimals: 0 })}</span>
                  </div>
                  {loyaltyPreview && (
                    <div className="border-t border-gray-700 pt-2 text-xs text-cyan-300">
                      Loyalty preview: +{loyaltyPreview.appliedPoints.toLocaleString()} points this sale
                      {loyaltyPreview.cappedPoints > 0 ? ` (${loyaltyPreview.rawPoints.toLocaleString()} raw, ${loyaltyPreview.cappedPoints.toLocaleString()} capped by yearly limit)` : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Offers</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                value={grapeFilter}
                onChange={(event) => setGrapeFilter(event.target.value)}
              >
                <option value="all">All Favorite Grapes</option>
                {grapeFilterOptions.map((grape) => (
                  <option key={grape} value={grape}>{grape}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded border border-gray-700 bg-gray-800/60 overflow-hidden">
            <div className="overflow-x-auto max-h-[42vh]">
              <MarketOfferTable
                rows={filteredAndSortedBuyers}
                columns={buyerColumns}
                rowKey={(buyer) => buyer.id}
                className="table-fixed"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                selectedRowKey={selectedBuyerId}
                onRowClick={(buyer) => setSelectedBuyerId(buyer.id)}
              />
            </div>
          </div>
        </div>

        {exceedsBuyerCap && selectedBuyer?.remainingSeasonLimitKg !== undefined && (
          <div className="rounded border border-red-800 bg-red-950/30 p-2 text-xs text-red-300">
            Selected amount ({selectedQuantityKg.toLocaleString()} kg) exceeds this buyer's remaining seasonal capacity ({selectedBuyer.remainingSeasonLimitKg.toLocaleString()} kg).
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSelling}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSell}
            disabled={isSelling || !selectedBuyer || !pricing || exceedsBuyerCap || selectedQuantityKg <= 0}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {isSelling ? 'Selling…' : `Sell for ${pricing ? formatNumber(pricing.totalRevenue, { currency: true, decimals: 0 }) : '—'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SellGrapesModal;
