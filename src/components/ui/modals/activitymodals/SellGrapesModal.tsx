import React, { useState, useMemo, useEffect } from 'react';
import { WineBatch } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Slider } from '@/components/ui';
import {
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
  const [sellPercentage, setSellPercentage] = useState(100);
  const [membership, setMembership] = useState<CooperativeMembership | null>(null);
  const [buyerLoyaltyById, setBuyerLoyaltyById] = useState<Record<string, BuyerLoyaltyRecord>>({});
  const [companyValue, setCompanyValue] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSellPercentage(100);
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
  const maxSelectableKg = useMemo(() => {
    if (!batch) return 0;
    if (!selectedBuyer || selectedBuyer.remainingSeasonLimitKg === undefined) return batch.quantity;
    return Math.max(0, Math.min(batch.quantity, selectedBuyer.remainingSeasonLimitKg));
  }, [batch, selectedBuyer]);
  const maxSelectablePercent = useMemo(() => {
    if (!batch || batch.quantity <= 0) return 1;
    const percent = Math.floor((maxSelectableKg / batch.quantity) * 100);
    return Math.max(1, Math.min(100, percent));
  }, [batch, maxSelectableKg]);

  useEffect(() => {
    setSellPercentage(prev => Math.max(1, Math.min(prev, maxSelectablePercent)));
  }, [maxSelectablePercent]);

  const selectedQuantityKg = useMemo(() => {
    if (!batch || maxSelectableKg <= 0) return 0;
    return Math.max(1, Math.min(maxSelectableKg, Math.round((batch.quantity * sellPercentage) / 100)));
  }, [batch, sellPercentage, maxSelectableKg]);
  const exceedsBuyerCap = useMemo(() => {
    return selectedQuantityKg > maxSelectableKg;
  }, [selectedQuantityKg, maxSelectableKg]);
  const loyaltyCapWarning = useMemo(() => {
    if (!selectedBuyer || selectedQuantityKg <= 0) return null;
    const consecutiveYears = Math.max(1, buyerLoyalty?.consecutiveYears ?? 1);
    const yearPoints = Math.max(0, buyerLoyalty?.yearLoyaltyPoints ?? 0);
    const preview = estimateBuyerLoyaltyPointGain(selectedQuantityKg, consecutiveYears, yearPoints, companyValue);
    const cappedPoints = Math.max(0, preview.rawPoints - preview.appliedPoints);

    if (cappedPoints <= 0) return null;
    return {
      cappedPoints,
      rawPoints: preview.rawPoints,
      appliedPoints: preview.appliedPoints,
      yearlyCap: preview.yearlyCap,
      currentYearPoints: yearPoints,
    };
  }, [selectedBuyer, selectedQuantityKg, buyerLoyalty, companyValue]);

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

  if (!batch) return null;

  const qualityPercent = pricing ? Math.round(pricing.wineScore * 100) : 0;
  const qualityColor = qualityPercent >= 70 ? 'text-green-400' : qualityPercent >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto scrollbar-styled bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Sell Grapes</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] gap-4 items-start">
          <div className="space-y-3">
            <div className="bg-gray-800 rounded p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Variety</span>
                <span className="font-medium">{batch.grape}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity</span>
                <span className="font-medium">{batch.quantity.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Grape Quality</span>
                <span className={`font-medium ${qualityColor}`}>{qualityPercent}%</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded p-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-xs">Sale Amount</p>
                <span className="font-semibold text-amber-400">{sellPercentage}%</span>
              </div>
              <Slider
                value={[sellPercentage]}
                onValueChange={([value]) => setSellPercentage(value ?? 100)}
                min={1}
                max={maxSelectablePercent}
                step={1}
                className="py-1"
                disabled={maxSelectableKg <= 0}
              />
              <div className="flex justify-between text-gray-300">
                <span>Selling now</span>
                <span className="font-medium text-white">{selectedQuantityKg.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Remaining in batch</span>
                <span className="font-medium text-white">{Math.max(0, batch.quantity - selectedQuantityKg).toLocaleString()} kg</span>
              </div>
              <div className="text-[11px] text-gray-400 border-t border-gray-700 pt-2">
                Seasonal hard limit currently allows up to {maxSelectableKg.toLocaleString()} kg this sale.
              </div>
              {loyaltyCapWarning && (
                <div className="rounded border border-amber-800 bg-amber-950/30 p-2 text-[11px] text-amber-300">
                  Relationship growth cap warning: this sale can only apply {loyaltyCapWarning.appliedPoints.toLocaleString()} of {loyaltyCapWarning.rawPoints.toLocaleString()} potential loyalty points this year ({loyaltyCapWarning.currentYearPoints.toLocaleString()} / {loyaltyCapWarning.yearlyCap.toLocaleString()} already used).
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Select Buyer</p>
            <div className="pr-1 space-y-2">
              {buyers.map(buyer => {
                const hasRelationship = (buyerLoyaltyById[buyer.id]?.loyaltyScore ?? 0) > 0;
                return (
                  <div key={buyer.id}>
                    <button
                      onClick={() => setSelectedBuyerId(buyer.id)}
                      className={`w-full text-left rounded border p-3 transition-colors ${
                        selectedBuyerId === buyer.id
                          ? 'border-amber-400 bg-amber-900/20'
                          : hasRelationship
                            ? 'border-cyan-700/70 bg-cyan-900/10 hover:border-cyan-500'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className="font-medium text-sm">{buyer.name}</span>
                          <p className="text-xs text-gray-400 mt-1">{buyer.description}</p>
                        </div>
                        <span className="text-xs text-amber-400 shrink-0">{buyer.priceMultiplier.toFixed(2)}×</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-gray-300">
                        <div>
                          Multiplier range: {buyer.multiplierRangeMin !== undefined && buyer.multiplierRangeMax !== undefined
                            ? `${buyer.multiplierRangeMin.toFixed(2)}× - ${buyer.multiplierRangeMax.toFixed(2)}×`
                            : 'Static'}
                        </div>
                        <div>
                          Relationship multiplier: ×{(buyer.relationshipMultiplier ?? 1).toFixed(2)}
                        </div>
                        <div>
                          Seasonal hard limit: {buyer.effectiveSeasonLimitKg !== undefined ? `${buyer.effectiveSeasonLimitKg.toLocaleString()} kg` : 'No hard cap'}
                        </div>
                        <div>
                          Remaining this season: {buyer.remainingSeasonLimitKg !== undefined ? `${buyer.remainingSeasonLimitKg.toLocaleString()} kg` : 'Unlimited'}
                        </div>
                      </div>
                      {buyer.favoriteGrapes && buyer.favoriteGrapes.length > 0 && (
                        <div className="mt-2 text-[11px] text-purple-300">
                          Favorite grapes: {buyer.favoriteGrapes.join(', ')}
                        </div>
                      )}
                      {hasRelationship && (
                        <div className="mt-2 text-[11px] text-cyan-300">Existing relationship</div>
                      )}
                      {buyer.originTag && (
                        <div className="mt-2 inline-flex rounded border border-gray-600 bg-gray-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
                          {buyer.originTag}
                        </div>
                      )}
                      {buyer.originReason && (
                        <div className="mt-1 text-[11px] text-gray-400">
                          {buyer.originReason}
                        </div>
                      )}
                    </button>
                    {buyer.id === 'winzergenossenschaft' && (
                      <CooperativeMembershipPanel
                        membership={membership}
                        isSelected={selectedBuyerId === buyer.id}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <BuyerLoyaltyPanel buyer={selectedBuyer} loyalty={buyerLoyalty} companyValue={companyValue} />

        {exceedsBuyerCap && selectedBuyer?.remainingSeasonLimitKg !== undefined && (
          <div className="rounded border border-red-800 bg-red-950/30 p-2 text-xs text-red-300">
            Selected amount ({selectedQuantityKg.toLocaleString()} kg) exceeds this buyer's remaining seasonal capacity ({selectedBuyer.remainingSeasonLimitKg.toLocaleString()} kg).
          </div>
        )}

        {/* Pricing Breakdown */}
        {pricing && (
          <div className="bg-gray-800 rounded p-3 space-y-1 text-sm">
            <p className="text-gray-400 font-medium uppercase tracking-wide text-xs mb-2">Price Breakdown</p>
            <div className="flex justify-between text-gray-300">
              <span>Base price</span>
              <span>{formatNumber(3, { currency: true, decimals: 2 })}/kg</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Quality ({qualityPercent}%)</span>
              <span>×{pricing.qualityMultiplier.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Prestige bonus</span>
              <span>×{pricing.prestigeBonus.toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-gray-400">
              Prestige bonus reflects your winery reputation and company standing. Higher prestige increases buyer confidence and sale price.
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Buyer multiplier</span>
              <span>×{pricing.buyerMultiplier.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Relationship bonus</span>
              <span>×{(pricing.relationshipMultiplier ?? 1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Favorite grape bonus</span>
              <span>+{(pricing.favoriteGrapeBonusMultiplier ?? 0).toFixed(2)}×</span>
            </div>
            {pricing.appliedFloor && pricing.effectiveFloorPrice > 0 && (
              <div className="text-xs text-green-400 pt-1">
                ✓ Cooperative floor applied ({formatNumber(pricing.effectiveFloorPrice, { currency: true, decimals: 2 })}/kg)
              </div>
            )}
            <div className="flex justify-between font-medium text-white border-t border-gray-600 pt-2 mt-1">
              <span>Price per kg</span>
              <span>{formatNumber(pricing.finalPricePerKg, { currency: true, decimals: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Sale quantity</span>
              <span>{pricing.quantityKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between font-bold text-amber-400 text-base">
              <span>Total Revenue</span>
              <span>{formatNumber(pricing.totalRevenue, { currency: true, decimals: 0 })}</span>
            </div>
            {loyaltyPreview && (
              <div className="mt-2 border-t border-gray-700 pt-2 text-xs text-cyan-300">
                Loyalty preview: +{loyaltyPreview.appliedPoints.toLocaleString()} points this sale
                {loyaltyPreview.cappedPoints > 0 ? ` (${loyaltyPreview.rawPoints.toLocaleString()} raw, ${loyaltyPreview.cappedPoints.toLocaleString()} capped by yearly limit)` : ''}
              </div>
            )}
          </div>
        )}

        {selectedBuyer && loyaltyPreview && (
          <div className="rounded border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
            Sale preview with {selectedBuyer.name}: +{loyaltyPreview.appliedPoints.toLocaleString()} loyalty points, then {selectedBuyer.remainingSeasonLimitKg !== undefined ? `${Math.max(0, selectedBuyer.remainingSeasonLimitKg - selectedQuantityKg).toLocaleString()} kg seasonal capacity remains` : 'seasonal capacity remains unrestricted'}.
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
