import { v4 as uuidv4 } from 'uuid';
import { Customer } from '../../types/types';
import { calculateAbsoluteWeeks, formatNumber } from '../../utils/utils';
import { getGameState } from '../core/gameState';
import { calculateCurrentPrestige } from '../prestige/prestigeService';
import { calculateInvertedSkewedMultiplier } from '../../utils/calculator';
import { insertRelationshipBoost, getRelationshipBoostsByCustomer } from '../../database/customers/relationshipBoostsDB';

/**
 * Create a relationship boost when an order is accepted
 */
export async function createRelationshipBoost(
  customerId: string,
  orderValue: number,
  companyPrestige: number,
  description: string
): Promise<void> {
  const prestigeFactor = 1 / (1 + companyPrestige / 100);
  const boostAmount = (orderValue / 10000) * prestigeFactor * 0.1;

  await insertRelationshipBoost({
    id: uuidv4(),
    customer_id: customerId,
    amount: boostAmount,
    created_game_week: calculateAbsoluteWeeks(
      getGameState().week!,
      getGameState().season!,
      getGameState().currentYear!
    ),
    decay_rate: 0.95,
    description,
  });
}

/**
 * Calculate current relationship boost for a customer (amounts are pre-decayed on weekly ticks)
 */
export async function calculateCustomerRelationshipBoosts(customerId: string): Promise<number> {
  const boosts = await getRelationshipBoostsByCustomer(customerId);
  return boosts.reduce((sum, row) => sum + (row.amount || 0), 0);
}


export interface RelationshipBreakdown {
  totalRelationship: number;
  prestigeContribution: number;
  marketShareModifier: number;
  relationshipBoosts: number;
  factors: {
    companyPrestige: number;
    customerMarketShare: number;
    prestigeFactor: number;
    marketShareModifier: number;
    boostCount: number;
    boostDetails: Array<{
      description: string;
      amount: number;
      weeksAgo: number;
      decayedAmount: number;
    }>;
  };
}

// Simple cache for relationship breakdowns
const relationshipBreakdownCache = new Map<string, RelationshipBreakdown>();
let cachedPrestige: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Calculate detailed relationship breakdown for a customer
 * Optimized with simple caching
 */
export async function calculateRelationshipBreakdown(customer: Customer): Promise<RelationshipBreakdown> {
  const customerKey = customer.id;
  const now = Date.now();
  
  // Check cache first
  if (relationshipBreakdownCache.has(customerKey) && (now - cacheTimestamp) < CACHE_TTL) {
    return relationshipBreakdownCache.get(customerKey)!;
  }

  // Get company prestige (cached)
  if (!cachedPrestige || (now - cacheTimestamp) > CACHE_TTL) {
    const { totalPrestige: companyPrestige } = await calculateCurrentPrestige();
    cachedPrestige = companyPrestige;
    cacheTimestamp = now;
  }

  const prestigeContribution = Math.log(cachedPrestige + 1);
  const marketShareModifier = 1 - calculateInvertedSkewedMultiplier(customer.marketShare);
  const relationshipBoosts = await calculateCustomerRelationshipBoosts(customer.id);
  const boostDetails = await getRelationshipBoostDetails(customer.id);

  const totalRelationship =
    prestigeContribution * marketShareModifier +
    relationshipBoosts * marketShareModifier;

  const breakdown: RelationshipBreakdown = {
    totalRelationship,
    prestigeContribution,
    marketShareModifier,
    relationshipBoosts,
    factors: {
      companyPrestige: cachedPrestige,
      customerMarketShare: customer.marketShare,
      prestigeFactor: prestigeContribution,
      marketShareModifier,
      boostCount: boostDetails.length,
      boostDetails,
    },
  };

  // Cache the result
  relationshipBreakdownCache.set(customerKey, breakdown);
  return breakdown;
}

/**
 * Clear relationship breakdown cache
 */
export function clearRelationshipBreakdownCache(): void {
  relationshipBreakdownCache.clear();
  cachedPrestige = null;
  cacheTimestamp = 0;
}

/**
 * Get detailed information about relationship boosts for a customer
 */
export async function getRelationshipBoostDetails(customerId: string): Promise<Array<{
  description: string;
  amount: number;
  weeksAgo: number;
  decayedAmount: number;
}>> {
  const boosts = await getRelationshipBoostsByCustomer(customerId);
  const gs = getGameState();
  const currentAbsWeeks = calculateAbsoluteWeeks(gs.week!, gs.season!, gs.currentYear!);

  return boosts
    .map(row => {
      const createdWeek = (row as any).created_game_week || currentAbsWeeks;
      const weeksElapsed = Math.max(0, currentAbsWeeks - createdWeek);
      const currentAmount = row.amount;
      return {
        description: row.description,
        amount: row.amount,
        weeksAgo: Math.round(weeksElapsed * 10) / 10,
        decayedAmount: Math.max(0, currentAmount),
      };
    })
    .filter(boost => boost.decayedAmount >= 0.001);
}

/**
 * Format relationship breakdown for display in tooltips
 */
export function formatRelationshipBreakdown(breakdown: RelationshipBreakdown): string {
  const calculatedRelationship =
    breakdown.prestigeContribution * breakdown.marketShareModifier +
    breakdown.relationshipBoosts * breakdown.marketShareModifier;

  const lines = [
    'Customer Relationship Breakdown',
    `Relationship: ${formatNumber(calculatedRelationship, { decimals: 3, forceDecimals: true })}%`,
    '',
    'Current Model:',
    `Relationship = ( (log(Prestige + 1)) × Market Modifier) + (Boost × Modifier)`,
    `= (${formatNumber(breakdown.prestigeContribution, { decimals: 3, forceDecimals: true })} × ${formatNumber(breakdown.marketShareModifier, { decimals: 3, forceDecimals: true })}) + (${formatNumber(breakdown.relationshipBoosts, { decimals: 3, forceDecimals: true })} × ${formatNumber(breakdown.marketShareModifier, { decimals: 3, forceDecimals: true })}) = ${formatNumber(calculatedRelationship, { decimals: 3, forceDecimals: true })}%`,
    '',
    `Market Share Modifier: ${formatNumber(breakdown.marketShareModifier, { decimals: 3, forceDecimals: true })} (customer market share: ${formatNumber(breakdown.factors.customerMarketShare * 100, { decimals: 3, forceDecimals: true })}%)`,
  ];

  if (breakdown.factors.boostDetails.length > 0) {
    lines.push('');
    lines.push('Recent Boost Events:');
    breakdown.factors.boostDetails.slice(0, 5).forEach(boost => {
      lines.push(`• ${boost.description} (${formatNumber(boost.weeksAgo, { decimals: 3, forceDecimals: true })}w ago): +${formatNumber(boost.decayedAmount, { decimals: 3, forceDecimals: true })}%`);
    });
    if (breakdown.factors.boostDetails.length > 5) {
      lines.push(`• ... and ${breakdown.factors.boostDetails.length - 5} more`);
    }
  }

  return lines.join('\n');
}



