// Relationship breakdown service - calculates and explains customer relationship factors
import { Customer } from '../../types/types';
import { calculateCustomerRelationshipBoosts } from './relationshipBoostsService';
import { calculateCurrentPrestige } from '../prestige/prestigeEventsService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { calculateAbsoluteWeeks, formatNumber } from '../../utils/utils';
import { calculateInvertedSkewedMultiplier } from '../../utils/calculator';
import { getGameState } from '../../services/core/gameState';
import { supabase } from '../supabase';

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

/**
 * Calculate detailed relationship breakdown for a customer
 */
export async function calculateRelationshipBreakdown(customer: Customer, companyId?: string): Promise<RelationshipBreakdown> {
  // Get current company ID if not provided
  if (!companyId) {
    companyId = getCurrentCompanyId();
  }

  // Get current company prestige
  const { totalPrestige: companyPrestige } = await calculateCurrentPrestige();
  
  // Calculate relationship components (simplified model)
  // Minimal baseline from prestige, scaled via natural log (no extra multiplier)
  const prestigeContribution = Math.log(companyPrestige + 1);
  // Market share acts as a difficulty modifier (larger customers reduce impact)
  // Uses inverted skewed multiplier for optimal penalty distribution
  // Use inverted skewed multiplier - but reverse the penalty
  // High market share = harder to impress (lower modifier)
  // Low market share = easier to impress (higher modifier)
  const marketShareModifier = 1 - calculateInvertedSkewedMultiplier(customer.marketShare);
  
  // Calculate relationship boosts
  const relationshipBoosts = await calculateCustomerRelationshipBoosts(customer.id);
  
  // Get detailed boost information
  const boostDetails = await getRelationshipBoostDetails(customer.id, companyId);
  
  // Compute current relationship purely from formula (no stored value)
  const totalRelationship =
    prestigeContribution * marketShareModifier +
    relationshipBoosts * marketShareModifier;
  
  return {
    totalRelationship,
    prestigeContribution,
    marketShareModifier,
    relationshipBoosts,
    factors: {
      companyPrestige,
      customerMarketShare: customer.marketShare,
      prestigeFactor: prestigeContribution,
      marketShareModifier,
      boostCount: boostDetails.length,
      boostDetails
    }
  };
}

/**
 * Get detailed information about relationship boosts for a customer
 */
async function getRelationshipBoostDetails(customerId: string, companyId?: string): Promise<Array<{
  description: string;
  amount: number;
  weeksAgo: number;
  decayedAmount: number;
}>> {
  try {
    // Get current company ID if not provided
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }

    
    const { data, error } = await supabase
      .from('relationship_boosts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      // Order by game time only; avoid realtime timestamps
      .order('created_game_week', { ascending: false });

    if (error || !data) {
      return [];
    }

    const gs = getGameState();
    const currentAbsWeeks = calculateAbsoluteWeeks(gs.week!, gs.season!, gs.currentYear!);
    
    return data.map(row => {
      const createdWeek = (row as any).created_game_week || currentAbsWeeks;
      const weeksElapsed = Math.max(0, currentAbsWeeks - createdWeek);
      const currentAmount = row.amount;
      
      return {
        description: row.description,
        amount: row.amount,
        weeksAgo: Math.round(weeksElapsed * 10) / 10,
        decayedAmount: Math.max(0, currentAmount)
      };
    // Show virtually all boosts; only exclude true zeros and negatives
    }).filter(boost => boost.decayedAmount > 0.00001);
    
  } catch (error) {
    console.error('Failed to get relationship boost details:', error);
    return [];
  }
}

/**
 * Format relationship breakdown for display in tooltips
 */
export function formatRelationshipBreakdown(breakdown: RelationshipBreakdown): string {
  // Calculate relationship per simplified model:
  // (Prestige × Modifier) + (Boost × Modifier)
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
    `Market Share Modifier: ${formatNumber(breakdown.marketShareModifier, { decimals: 3, forceDecimals: true })} (customer market share: ${formatNumber(breakdown.factors.customerMarketShare * 100, { decimals: 3, forceDecimals: true })}%)`
  ];
  
  if (breakdown.factors.boostDetails.length > 0) {
    lines.push('');
    lines.push('Recent Boost Events:');
    // Show more events for better transparency
    breakdown.factors.boostDetails.slice(0, 5).forEach(boost => {
      lines.push(`• ${boost.description} (${formatNumber(boost.weeksAgo, { decimals: 3, forceDecimals: true })}w ago): +${formatNumber(boost.decayedAmount, { decimals: 3, forceDecimals: true })}%`);
    });
    
    if (breakdown.factors.boostDetails.length > 5) {
      lines.push(`• ... and ${breakdown.factors.boostDetails.length - 5} more`);
    }
  }
  
  return lines.join('\n');
}

