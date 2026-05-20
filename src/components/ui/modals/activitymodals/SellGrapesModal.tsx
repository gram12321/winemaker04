import React, { useState, useMemo, useEffect } from 'react';
import { WineBatch } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { Button } from '@/components/ui';
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
import { getGameState } from '@/lib/services/core/gameState';
import { companyService } from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

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
          Floor price: <strong>€{config.floorPricePerKg.toFixed(2)}/kg</strong>
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
            : `${yearsToNext} more consecutive ${yearsToNext === 1 ? 'year' : 'years'} → ${nextLevel.name} (€${nextLevel.floorPricePerKg.toFixed(2)}/kg floor)`
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

const SellGrapesModal: React.FC<SellGrapesModalProps> = ({ isOpen, onClose, batch }) => {
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('bulk_buyer');
  const [isSelling, setIsSelling] = useState(false);
  const [startingCountry, setStartingCountry] = useState<string | undefined>();
  const [membership, setMembership] = useState<CooperativeMembership | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const companyId = getCurrentCompanyId();
    if (!companyId) return;
    companyService.getCompany(companyId).then(company => {
      const country = company?.startingCountry;
      setStartingCountry(country);
      if (country === 'Germany') {
        getCooperativeMembership().then(setMembership);
      }
    });
  }, [isOpen]);

  const buyers = useMemo(() => getAvailableBuyers(startingCountry), [startingCountry]);

  // Auto-select the country-exclusive buyer if available, else bulk_buyer
  useEffect(() => {
    if (!startingCountry) return;
    const exclusive = buyers.find(b => b.exclusiveCountry === startingCountry);
    if (exclusive) setSelectedBuyerId(exclusive.id);
  }, [startingCountry, buyers]);

  const selectedBuyer: GrapeBuyer | undefined = buyers.find(b => b.id === selectedBuyerId);

  const pricing: GrapeSalePricing | null = useMemo(() => {
    if (!batch || !selectedBuyer) return null;
    const prestige = getGameState().prestige ?? 0;
    // For the cooperative, use the membership-aware floor price
    let floorOverride: number | undefined;
    if (selectedBuyer.id === 'winzergenossenschaft') {
      floorOverride = getCooperativeFloorPrice((membership?.level ?? 0) as 0 | 1 | 2 | 3);
    }
    return calculateGrapeSalePrice(batch, selectedBuyer, prestige, floorOverride);
  }, [batch, selectedBuyer, membership]);

  const handleSell = async () => {
    if (!batch || !selectedBuyer) return;
    setIsSelling(true);
    try {
      const result = await sellGrapes(batch.id, selectedBuyer);
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
      <DialogContent className="max-w-lg bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg">Sell Grapes</DialogTitle>
        </DialogHeader>

        {/* Batch Info */}
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

        {/* Buyer Selection */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Select Buyer</p>
          {buyers.map(buyer => (
            <div key={buyer.id}>
              <button
                onClick={() => setSelectedBuyerId(buyer.id)}
                className={`w-full text-left rounded border p-3 transition-colors ${
                  selectedBuyerId === buyer.id
                    ? 'border-amber-400 bg-amber-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm">{buyer.name}</span>
                  <span className="text-xs text-amber-400 ml-4 shrink-0">{buyer.priceMultiplier}× multiplier</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{buyer.description}</p>
              </button>
              {/* Cooperative membership panel inline under the coop button */}
              {buyer.id === 'winzergenossenschaft' && (
                <CooperativeMembershipPanel
                  membership={membership}
                  isSelected={selectedBuyerId === buyer.id}
                />
              )}
            </div>
          ))}
        </div>

        {/* Pricing Breakdown */}
        {pricing && (
          <div className="bg-gray-800 rounded p-3 space-y-1 text-sm">
            <p className="text-gray-400 font-medium uppercase tracking-wide text-xs mb-2">Price Breakdown</p>
            <div className="flex justify-between text-gray-300">
              <span>Base price</span>
              <span>€3.00/kg</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Quality ({qualityPercent}%)</span>
              <span>×{pricing.qualityMultiplier.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Prestige bonus</span>
              <span>×{pricing.prestigeBonus.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Buyer multiplier</span>
              <span>×{pricing.buyerMultiplier.toFixed(1)}</span>
            </div>
            {pricing.appliedFloor && pricing.effectiveFloorPrice > 0 && (
              <div className="text-xs text-green-400 pt-1">
                ✓ Cooperative floor applied (€{pricing.effectiveFloorPrice.toFixed(2)}/kg)
              </div>
            )}
            <div className="flex justify-between font-medium text-white border-t border-gray-600 pt-2 mt-1">
              <span>Price per kg</span>
              <span>€{pricing.finalPricePerKg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-amber-400 text-base">
              <span>Total Revenue</span>
              <span>€{pricing.totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSelling}>
            Cancel
          </Button>
          <Button
            onClick={handleSell}
            disabled={isSelling || !selectedBuyer || !pricing}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {isSelling ? 'Selling…' : `Sell for €${pricing?.totalRevenue.toLocaleString('de-DE', { maximumFractionDigits: 0 }) ?? '—'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SellGrapesModal;
