// Sales order orchestration service - coordinates sophisticated customer acquisition and multiple order generation
import { WineOrder, Vineyard, NotificationCategory, EconomyPhase } from '../../types/types';
import { generateCustomer } from './generateCustomer';
import { generateOrder } from './generateOrder';
import { getAllCustomers } from './createCustomer';
import { notificationService } from '../core/notificationService';
import { loadWineBatches } from '../../database/activities/inventoryDB';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { SALES_CONSTANTS } from '../../constants/constants';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { ECONOMY_SALES_MULTIPLIERS } from '../../constants/economyConstants';
import { getGameState } from '../core/gameState';


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
    economyPhase: EconomyPhase;
    economyFrequencyMultiplier: number;
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
    // Step 3: Load all available wines and vineyards once (batched operations)
    const [allBatches, allVineyards] = await Promise.all([
      loadWineBatches(),
      loadVineyards()
    ]);
    const availableWines = allBatches.filter(batch => batch.state === 'bottled' && batch.quantity > 0);
    
    if (availableWines.length === 0) {
      return {
        orders: [],
        customersGenerated: 1,
        totalOrdersCreated: 0,
        chanceInfo
      };
    }
    
    // Get current prestige once for all order evaluations
    const currentPrestige = chanceInfo.companyPrestige;
    
    // Step 4: Iterate through each available wine with diminishing returns for multiple orders
    const orders: WineOrder[] = [];
    
    for (let i = 0; i < availableWines.length; i++) {
      const wineBatch = availableWines[i];
      const ordersPlaced = orders.length;
      
      // Calculate diminishing returns: each accepted order reduces chance for next order
      const economyPhase = (getGameState().economyPhase ) as keyof typeof ECONOMY_SALES_MULTIPLIERS;
      const multiplePenaltyBoost = ECONOMY_SALES_MULTIPLIERS[economyPhase].multipleOrderPenaltyMultiplier;
      const effectivePenalty = customerTypeConfig.multipleOrderPenalty * multiplePenaltyBoost;
      const multipleOrderModifier = Math.pow(effectivePenalty, ordersPlaced);
      
      // Find vineyard for this wine batch
      const vineyard = allVineyards.find((v: Vineyard) => v.id === wineBatch.vineyardId);
      
      if (!vineyard) {
        continue; // Skip if vineyard not found
      }
      
      // Use optimized generateOrder with pre-loaded data
      const order = await generateOrder(customer, wineBatch, multipleOrderModifier, vineyard, currentPrestige);
      
      if (order) {
        orders.push(order);
      }
    }
    
    // Step 5: Log results and send notifications (handled here, not in gameTick)
    if (orders.length > 0) {
      const totalValue = orders.reduce((sum, order) => {
        const orderValue = order.offeredPrice * order.requestedQuantity;
        return sum + Math.min(orderValue, SALES_CONSTANTS.MAX_PRICE);
      }, 0);

      // Send notification about successful customer
      if (orders.length === 1) {
        await notificationService.addMessage(
          `${customer.name} from ${customer.country} placed an order for ${orders[0].wineName}`,
          'salesOrderService.generateOrdersForCustomer',
          'New Order',
          NotificationCategory.SALES_ORDERS
        );
      } else {
        await notificationService.addMessage(
          `${customer.name} from ${customer.country} placed ${orders.length} orders worth €${totalValue.toFixed(2)}`,
          'salesOrderService.generateOrdersForCustomer',
          'New Orders',
          NotificationCategory.SALES_ORDERS
        );
      }

      // Trigger update once at the end, after all orders are generated
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

