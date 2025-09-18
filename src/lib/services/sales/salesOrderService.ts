// Sales order orchestration service - coordinates sophisticated customer acquisition and multiple order generation
import { WineOrder } from '../../types';
import { generateCustomer } from './generateCustomer';
import { generateOrder } from './generateOrder';
import { getAllCustomers } from './createCustomer';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { loadWineBatches } from '../../database/database';
import { getAvailableBottledWines } from '../../utils/UIWineFilters';
import { SALES_CONSTANTS } from '../../constants/constants';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';


/**
 * Full wine iteration system - customers browse ALL available wines
 * Single customer per tick, iterates through all wines and places 0-N orders
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
  
  // Step 2: Select an existing customer
  const allCustomers = await getAllCustomers();
  
  if (allCustomers.length === 0) {
    return {
      orders: [],
      customersGenerated: 0,
      totalOrdersCreated: 0,
      chanceInfo
    };
  }
  
  // Randomly select a customer
  const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
  const customerTypeConfig = SALES_CONSTANTS.CUSTOMER_TYPES[customer.customerType];
  
    // Customer is browsing wine selection (no logging needed)
  
  try {
    // Step 3: Load all available wines
    const allBatches = await loadWineBatches();
    const availableWines = getAvailableBottledWines(allBatches);
    
    if (availableWines.length === 0) {
      // No wines available for customer to browse (no logging needed)
      return {
        orders: [],
        customersGenerated: 1,
        totalOrdersCreated: 0,
        chanceInfo
      };
    }
    
    // Step 4: Iterate through each available wine with diminishing returns for multiple orders
    const orders: WineOrder[] = [];
    // Customer is browsing wines (no logging needed)
    
    for (let i = 0; i < availableWines.length; i++) {
      const wineBatch = availableWines[i];
      const ordersPlaced = orders.length;
      
      // Calculate diminishing returns: each accepted order reduces chance for next order
      const multipleOrderModifier = Math.pow(customerTypeConfig.multipleOrderPenalty, ordersPlaced);
      
      // Evaluate wine for order (no logging needed)
      
      // Use the existing generateOrder system - it handles all pricing, rejection, quantity logic
      // Apply multiple order modifier to affect rejection probability
      const order = await generateOrder(customer, wineBatch, multipleOrderModifier);
      
      if (order) {
        orders.push(order);
        // Order placed successfully (no logging needed)
      } else {
        // Order rejected (no logging needed)
      }
    }
    
    // Step 5: Log results and send notifications
    if (orders.length > 0) {
      const totalValue = orders.reduce((sum, order) => sum + (order.offeredPrice * order.requestedQuantity), 0);
      // Customer completed browsing (no logging needed)
      
      // Send notification about successful customer
      if (orders.length === 1) {
        notificationService.info(
          `${customer.name} from ${customer.country} placed an order for ${orders[0].wineName}`
        );
      } else {
        notificationService.info(
          `${customer.name} from ${customer.country} placed ${orders.length} orders worth €${totalValue.toFixed(2)}`
        );
      }
    } else {
      // Customer browsed all wines but didn't place any orders (no logging needed)
    }
    
    // Trigger update once at the end, after all orders are generated
    if (orders.length > 0) {
      triggerGameUpdate();
    }
    
    return {
      orders,
      customersGenerated: 1,
      totalOrdersCreated: orders.length,
      chanceInfo
    };
  } catch (error) {
    console.warn(`Failed to generate orders for customer ${customer.name}:`, error);
    return {
      orders: [],
      customersGenerated: 1,
      totalOrdersCreated: 0,
      chanceInfo
    };
  }
}

