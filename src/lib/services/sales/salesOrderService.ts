// Sales order orchestration service - coordinates customer acquisition and order generation
import { WineOrder } from '../../types';
import { generateCustomer } from './generateCustomer';
import { generateOrder } from './generateOrder';


/**
 * Complete order generation process: Customer acquisition + Order creation
 * This combines both systems: first acquire a customer, then create their order
 * 
 * @returns Object with order result and customer acquisition chance information
 */
export async function generateWineOrder(): Promise<{
  order: WineOrder | null;
  chanceInfo: {
    companyPrestige: number;
    availableWines: number;
    pendingOrders: number;
    baseChance: number;
    pendingPenalty: number;
    finalChance: number;
    randomRoll: number;
  };
}> {
  // Step 1: Check if company prestige allows customer acquisition
  const { customerAcquired, chanceInfo } = await generateCustomer({ dryRun: false }); // actual roll
  
  if (!customerAcquired) {
    return { order: null, chanceInfo }; // No customer acquired due to company prestige/pending orders
  }
  
  // Step 2: Customer is interested, now create their order (wine value + quality-based)
  const order = await generateOrder();
  return { order, chanceInfo };
}

