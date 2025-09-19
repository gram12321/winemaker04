// Customer relationship boosts management service
import { supabase } from '../supabase';
import { v4 as uuidv4 } from 'uuid';
import { getGameState } from '../../services/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../../utils/utils';

/**
 * Create a relationship boost when an order is accepted
 */
export async function createRelationshipBoost(
  customerId: string,
  orderValue: number,
  companyPrestige: number,
  description: string
): Promise<void> {
  // Calculate boost amount with diminishing returns for higher prestige companies
  const prestigeFactor = 1 / (1 + companyPrestige / 100);
  const boostAmount = (orderValue / 10000) * prestigeFactor * 0.1;

  const { error } = await supabase
    .from('relationship_boosts')
    .insert([{
      id: uuidv4(),
      customer_id: customerId,
      amount: boostAmount,
      created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
      decay_rate: 0.95, // Same as sales prestige events
      description,
      company_id: getCurrentCompanyId()
    }]);

  if (error) {
    console.error('Failed to create relationship boost:', error);
  } else {
    triggerGameUpdate(); // Notify UI of relationship changes
  }
}

/**
 * Calculate current relationship boost for a customer (amounts are pre-decayed on weekly ticks)
 */
export async function calculateCustomerRelationshipBoosts(customerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('*')
    .eq('company_id', getCurrentCompanyId())
    .eq('customer_id', customerId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to load relationship boosts:', error);
    return 0;
  }

  const boosts = data || [];
  
  // Sum current amounts directly; decay occurs on weekly ticks
  const totalBoost = boosts.reduce((sum, row) => sum + (row.amount || 0), 0);
  return totalBoost;
}
