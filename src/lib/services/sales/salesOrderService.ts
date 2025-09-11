// Sales order orchestration service - coordinates sophisticated customer acquisition and multiple order generation
import { WineOrder } from '../../types';
import { generateCustomer } from './generateCustomer';
import { generateOrder } from './generateOrder';
import { createCustomer } from './createCustomer';
import { notificationService } from '../../../components/layout/NotificationCenter';

/**
 * Legacy single-order generation (kept for compatibility)
 * Complete order generation process: Customer acquisition + Order creation
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

/**
 * Simplified sophisticated order generation system
 * Single customer per tick, but they can browse all available wines
 * 
 * @returns Object with all orders and customer acquisition info
 */
export async function generateSophisticatedWineOrders(): Promise<{
  orders: WineOrder[];
  customersGenerated: number;
  totalOrdersCreated: number;
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
  const { customerAcquired, chanceInfo } = await generateCustomer({ dryRun: false });
  
  if (!customerAcquired) {
    return { 
      orders: [], 
      customersGenerated: 0, 
      totalOrdersCreated: 0, 
      chanceInfo 
    };
  }
  
  // Step 2: Generate a single sophisticated customer
  const customer = createCustomer();
  
  try {
    // Step 3: Generate a single order for this customer
    const order = await generateOrder(customer);
    
    // Log successful customer interaction
    if (order) {
      console.log(`[Sophisticated Orders] ${customer.name} (${customer.country}) placed an order for ${order.wineName}`);
      
      // Show notification for the customer
      notificationService.info(
        `${customer.name} from ${customer.country} placed an order for ${order.wineName}`
      );
    }
    
    return {
      orders: order ? [order] : [],
      customersGenerated: 1,
      totalOrdersCreated: order ? 1 : 0,
      chanceInfo
    };
  } catch (error) {
    console.warn(`Failed to generate order for customer ${customer.name}:`, error);
    return {
      orders: [],
      customersGenerated: 1,
      totalOrdersCreated: 0,
      chanceInfo
    };
  }
}

