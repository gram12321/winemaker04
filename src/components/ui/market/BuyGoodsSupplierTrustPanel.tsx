import React from 'react';
import {
  BUY_GOODS_SUPPLIER_LEVELS,
  getBuyGoodsRelationshipYearlyCap,
  type BuyGoodsSupplierRelationship,
  type BuyGoodsSupplierRelationshipLevel,
} from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';

export function getBuyGoodsSupplierTrustColor(level: BuyGoodsSupplierRelationshipLevel): string {
  if (level === 0) return 'text-gray-400';
  if (level <= 2) return 'text-blue-300';
  if (level <= 4) return 'text-cyan-300';
  return 'text-amber-300';
}

function getBuyGoodsSupplierTrustIcon(level: BuyGoodsSupplierRelationshipLevel): string {
  if (level === 0) return '○';
  if (level <= 2) return '◔';
  if (level <= 4) return '◕';
  return '●';
}

interface BuyGoodsSupplierTrustPanelProps {
  supplierName?: string;
  relationship?: BuyGoodsSupplierRelationship | null;
  companyValue: number;
  currentYear: number;
  unitsLabel: string;
}

export const BuyGoodsSupplierTrustPanel: React.FC<BuyGoodsSupplierTrustPanelProps> = ({
  supplierName,
  relationship,
  companyValue,
  currentYear,
  unitsLabel,
}) => {
  const level = (relationship?.level ?? 0) as BuyGoodsSupplierRelationshipLevel;
  const config = BUY_GOODS_SUPPLIER_LEVELS[level];
  const nextLevel = level < 5 ? BUY_GOODS_SUPPLIER_LEVELS[(level + 1) as BuyGoodsSupplierRelationshipLevel] : null;
  const score = relationship?.loyaltyScore ?? 0;
  const scoreToNext = nextLevel ? Math.max(0, nextLevel.minLoyaltyScore - score) : 0;
  const yearlyCap = getBuyGoodsRelationshipYearlyCap(companyValue);
  const yearPoints = relationship?.yearGuardYear === currentYear ? relationship.yearRelationshipPoints : 0;

  return (
    <div className="space-y-2 rounded border border-blue-900/60 bg-blue-950/30 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-blue-300">{getBuyGoodsSupplierTrustIcon(level)} Supplier Trust</span>
        <span className={`font-bold ${getBuyGoodsSupplierTrustColor(level)}`}>{config.name}</span>
      </div>
      <div className="text-gray-400">Supplier: <strong className="text-white">{supplierName ?? relationship?.supplierName ?? 'Unknown'}</strong></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400">
        <span>Total purchases: <strong className="text-white">{relationship?.totalPurchases ?? 0}</strong></span>
        <span>Streak: <strong className="text-white">{relationship?.consecutiveYears ?? 0} {(relationship?.consecutiveYears ?? 0) === 1 ? 'year' : 'years'}</strong></span>
        <span>Total bought: <strong className="text-white">{(relationship?.totalUnitsPurchased ?? 0).toLocaleString()} {unitsLabel}</strong></span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-300">
        <span>Trust score: <strong className="text-white">{score.toLocaleString()}</strong></span>
        <span>Year cap: <strong className="text-white">{yearPoints.toLocaleString()} / {yearlyCap.toLocaleString()}</strong></span>
      </div>
      {config.benefits.length > 0 && <ul className="space-y-0.5 text-gray-300">{config.benefits.map((benefit) => <li key={benefit}>• {benefit}</li>)}</ul>}
      {nextLevel && <div className="border-t border-blue-900/40 pt-2 text-amber-300">{scoreToNext === 0 ? `Ready to advance to ${nextLevel.name}!` : `${scoreToNext.toLocaleString()} trust score to reach ${nextLevel.name}`}</div>}
      {!relationship && <div className="border-t border-blue-900/40 pt-2 text-amber-300">First purchase from this supplier will establish this relationship.</div>}
    </div>
  );
};
