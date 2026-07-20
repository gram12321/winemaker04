import React from 'react';
import {
  BUY_MARKET_COUNTERPARTY_LEVELS,
  getBuyMarketRelationshipYearlyCap,
  type BuyMarketCounterpartyRelationship,
  type BuyMarketCounterpartyRelationshipLevel,
} from '@/lib/services/market/buyMarketCounterpartyRelationshipService';

export function getBuyMarketCounterpartyTrustColor(level: BuyMarketCounterpartyRelationshipLevel): string {
  if (level === 0) return 'text-gray-400';
  if (level <= 2) return 'text-blue-300';
  if (level <= 4) return 'text-cyan-300';
  return 'text-amber-300';
}

function getTrustIcon(level: BuyMarketCounterpartyRelationshipLevel): string {
  if (level === 0) return '○';
  if (level <= 2) return '◔';
  if (level <= 4) return '◕';
  return '●';
}

interface BuyMarketCounterpartyPanelProps {
  counterpartyName?: string;
  relationship?: BuyMarketCounterpartyRelationship | null;
  companyValue: number;
  currentYear: number;
  unitsLabel: string;
}

export const BuyMarketCounterpartyPanel: React.FC<BuyMarketCounterpartyPanelProps> = ({ counterpartyName, relationship, companyValue, currentYear, unitsLabel }) => {
  const level = relationship?.level ?? 0;
  const config = BUY_MARKET_COUNTERPARTY_LEVELS[level];
  const nextLevel = level < 5 ? BUY_MARKET_COUNTERPARTY_LEVELS[(level + 1) as BuyMarketCounterpartyRelationshipLevel] : null;
  const score = relationship?.loyaltyScore ?? 0;
  const scoreToNext = nextLevel ? Math.max(0, nextLevel.minLoyaltyScore - score) : 0;
  const yearlyCap = getBuyMarketRelationshipYearlyCap(companyValue);
  const yearPoints = relationship?.yearGuardYear === currentYear ? relationship.yearRelationshipPoints : 0;

  return <div className="space-y-2 rounded border border-blue-900/60 bg-blue-950/30 p-3 text-xs">
    <div className="flex items-center justify-between"><span className="font-semibold text-blue-300">{getTrustIcon(level)} Market relationship</span><span className={`font-bold ${getBuyMarketCounterpartyTrustColor(level)}`}>{config.name}</span></div>
    <div className="text-gray-400">Seller: <strong className="text-white">{counterpartyName ?? relationship?.counterpartyName ?? 'Unknown'}</strong></div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400"><span>Total purchases: <strong className="text-white">{relationship?.totalPurchases ?? 0}</strong></span><span>Streak: <strong className="text-white">{relationship?.consecutiveYears ?? 0} {(relationship?.consecutiveYears ?? 0) === 1 ? 'year' : 'years'}</strong></span><span>Total bought: <strong className="text-white">{(relationship?.totalUnitsPurchased ?? 0).toLocaleString()} {unitsLabel}</strong></span></div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-300"><span>Relationship score: <strong className="text-white">{score.toLocaleString()}</strong></span><span>Year cap: <strong className="text-white">{yearPoints.toLocaleString()} / {yearlyCap.toLocaleString()}</strong></span></div>
    {config.benefits.length > 0 && <ul className="space-y-0.5 text-gray-300">{config.benefits.map((benefit) => <li key={benefit}>• {benefit}</li>)}</ul>}
    {nextLevel && <div className="border-t border-blue-900/40 pt-2 text-amber-300">{scoreToNext === 0 ? `Ready to advance to ${nextLevel.name}!` : `${scoreToNext.toLocaleString()} relationship score to reach ${nextLevel.name}`}</div>}
    {!relationship && <div className="border-t border-blue-900/40 pt-2 text-amber-300">First purchase from this seller will establish this relationship.</div>}
  </div>;
};
