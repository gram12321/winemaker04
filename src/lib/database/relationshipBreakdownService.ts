// Relationship breakdown service - calculates and explains customer relationship factors
import { Customer } from '../types';
import { calculateCustomerRelationshipBoost } from './prestigeService';
import { calculateCurrentPrestige } from './prestigeService';
import { getCurrentCompany } from '../services/gameState';
import { supabase } from './supabase';

export interface RelationshipBreakdown {
  totalRelationship: number;
  baseRelationship: number;
  prestigeContribution: number;
  marketShareImpact: number;
  relationshipBoosts: number;
  factors: {
    companyPrestige: number;
    customerMarketShare: number;
    prestigeFactor: number;
    marketShareDivisor: number;
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
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || 'default';
  }

  // Get current company prestige
  const { totalPrestige: companyPrestige } = await calculateCurrentPrestige(companyId);
  
  // Calculate base relationship components
  const baseRelationship = 0.1;
  const prestigeContribution = Math.log(companyPrestige + 1) * 3.3;
  const marketShareImpact = 1 + 0.7 * Math.pow(customer.marketShare, 0.25) + Math.pow(customer.marketShare, 0.9);
  
  // Calculate relationship boosts
  const relationshipBoosts = await calculateCustomerRelationshipBoost(customer.id, companyId);
  
  // Get detailed boost information
  const boostDetails = await getRelationshipBoostDetails(customer.id, companyId);
  
  // Use the stored relationship value from the customer object
  const totalRelationship = customer.relationship || 0;
  
  // Calculate what the base relationship would be without boosts
  // const baseCalculatedRelationship = baseRelationship + (prestigeContribution / marketShareImpact);
  
  return {
    totalRelationship,
    baseRelationship,
    prestigeContribution,
    marketShareImpact,
    relationshipBoosts,
    factors: {
      companyPrestige,
      customerMarketShare: customer.marketShare,
      prestigeFactor: prestigeContribution,
      marketShareDivisor: marketShareImpact,
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
      const currentCompany = getCurrentCompany();
      companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
    }

    
    const { data, error } = await supabase
      .from('relationship_boosts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false });

    if (error || !data) {
      return [];
    }

    const currentTime = Date.now();
    
    return data.map(row => {
      const timeElapsed = currentTime - row.timestamp;
      const weeksElapsed = timeElapsed / (1000 * 60 * 60 * 24 * 7);
      const decayedAmount = row.amount * Math.pow(row.decay_rate, weeksElapsed);
      
      return {
        description: row.description,
        amount: row.amount,
        weeksAgo: Math.round(weeksElapsed * 10) / 10,
        decayedAmount: Math.max(0, decayedAmount)
      };
    }).filter(boost => boost.decayedAmount > 0.01); // Only show meaningful boosts
    
  } catch (error) {
    console.error('Failed to get relationship boost details:', error);
    return [];
  }
}

/**
 * Format relationship breakdown for display in tooltips
 */
export function formatRelationshipBreakdown(breakdown: RelationshipBreakdown): string {
  // Calculate what the formula would give us
  const calculatedRelationship = breakdown.baseRelationship + (breakdown.prestigeContribution / breakdown.marketShareImpact) + breakdown.relationshipBoosts;
  const baseRelationshipWithoutBoosts = breakdown.baseRelationship + (breakdown.prestigeContribution / breakdown.marketShareImpact);
  
  const lines = [
    `Total Relationship: ${breakdown.totalRelationship.toFixed(1)}% (stored value)`,
    '',
    'Formula Calculation:',
    `Base + (Prestige ÷ Market Impact) + Boosts`,
    `= ${breakdown.baseRelationship.toFixed(1)}% + (${breakdown.prestigeContribution.toFixed(1)}% ÷ ${breakdown.marketShareImpact.toFixed(2)}) + ${breakdown.relationshipBoosts.toFixed(2)}%`,
    `= ${breakdown.baseRelationship.toFixed(1)}% + ${(breakdown.prestigeContribution / breakdown.marketShareImpact).toFixed(1)}% + ${breakdown.relationshipBoosts.toFixed(2)}%`,
    `= ${baseRelationshipWithoutBoosts.toFixed(1)}% + ${breakdown.relationshipBoosts.toFixed(2)}%`,
    `= ${calculatedRelationship.toFixed(1)}%`,
    '',
    // Add note if there's a discrepancy
    ...(Math.abs(calculatedRelationship - breakdown.totalRelationship) > 0.1 ? [
      '',
      `Note: Formula calculates ${calculatedRelationship.toFixed(1)}% but stored value is ${breakdown.totalRelationship.toFixed(1)}%`,
      `This difference (${(calculatedRelationship - breakdown.totalRelationship).toFixed(1)}%) may be due to:`,
      `• Different calculation parameters when stored`,
      `• Manual adjustments or corrections`,
      `• Rounding differences in the original calculation`
    ] : []),
    '',
    'Components:',
    `• Base Relationship: ${breakdown.baseRelationship.toFixed(1)}% (fixed)`,
    `• Prestige Contribution: ${breakdown.prestigeContribution.toFixed(1)}% (log(${breakdown.factors.companyPrestige.toFixed(1)} + 1) × 3.3)`,
    `• Market Share Impact: ${breakdown.marketShareImpact.toFixed(2)}x divisor (1 + 0.7×${(breakdown.factors.customerMarketShare * 100).toFixed(1)}%^0.25 + ${(breakdown.factors.customerMarketShare * 100).toFixed(1)}%^0.9)`,
    `• Relationship Boosts: ${breakdown.relationshipBoosts.toFixed(2)}% (from ${breakdown.factors.boostCount} sales)`,
    '',
    'Company Factors:',
    `• Company Prestige: ${breakdown.factors.companyPrestige.toFixed(1)}`,
    `• Customer Market Share: ${(breakdown.factors.customerMarketShare * 100).toFixed(1)}%`
  ];
  
  if (breakdown.factors.boostDetails.length > 0) {
    lines.push('');
    lines.push('Recent Boost Events:');
    breakdown.factors.boostDetails.slice(0, 3).forEach(boost => {
      lines.push(`• ${boost.description} (${boost.weeksAgo}w ago): +${boost.decayedAmount.toFixed(2)}%`);
    });
    
    if (breakdown.factors.boostDetails.length > 3) {
      lines.push(`• ... and ${breakdown.factors.boostDetails.length - 3} more`);
    }
  }
  
  return lines.join('\n');
}

