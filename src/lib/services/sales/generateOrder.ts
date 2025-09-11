// Order generation service - handles wine order creation with pricing and rejection logic
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, OrderType } from '../../types';
import { saveWineOrder, loadWineBatches, loadVineyards } from '../../database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { getGameState } from '../../gameState';
import { formatCompletedWineName } from '../wineBatchService';
import { SALES_CONSTANTS } from '../../constants';
import { calculateOrderAmount, calculateSymmetricalMultiplier, calculateSteppedBalance } from '../../utils/calculator';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { getAvailableBottledWines } from '../../utils/wineFilters';

// Use order type configurations from constants
const ORDER_TYPE_CONFIG = SALES_CONSTANTS.ORDER_TYPES;

// ===== REJECTION CALCULATIONS =====

/**
 * Calculate rejection probability based on price ratio
 * Uses asymmetrical multiplier to create increasing rejection chance as bid price becomes too high
 * 
 * Business Logic:
 * - bidPrice: The value the buyer has to bid to get the wine (computer-generated customer offer)
 * - finalPrice: The calculated perceived value of the wine (using new pricing system)
 * - Customers reject when they have to pay MORE than the wine's perceived value (bad deal)
 * - Customers never reject when they can get wine at or below its perceived value (good deal)
 * - Premium order types (Private Collector, Export) are more tolerant of high prices
 * 
 * @param bidPrice - The price the customer is bidding (their offer)
 * @param finalPrice - The calculated perceived value of the wine (from pricing service)
 * @returns Rejection probability between 0 and 1
 */
function calculateRejectionProbability(bidPrice: number, finalPrice: number): number {
  if (bidPrice <= finalPrice) {
    console.log(`  → No rejection: bidPrice (€${bidPrice.toFixed(2)}) <= finalPrice (€${finalPrice.toFixed(2)})`);
    return 0; // No rejection if getting wine at or below its perceived value (good deal)
  }
  
  // Calculate how much above wine value the customer has to pay
  const premiumRatio = bidPrice / finalPrice; // > 1.0 means paying premium
  
  // Map unlimited premium ratio to 0-1 using sigmoid mapping (no tolerance)
  const mappedInput = 1 - (1 / premiumRatio);
  
  // Shift input up by 0.4 to skip polynomial range and get higher rejection rates
  const shiftedInput = Math.min(1.0, mappedInput + 0.4);
  
  // Use stepped balance function to get rejection probability 0-1
  const rejectionProbability = calculateSteppedBalance(shiftedInput);
  
  return rejectionProbability;
}

// ===== ORDER GENERATION =====

// Weighted random selection helper
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1]; // Fallback
}

// Generate a wine order when a customer is interested (wine value + quality-based decision)
export async function generateOrder(): Promise<WineOrder | null> {
  const allBatches = await loadWineBatches();
  const allVineyards = await loadVineyards();
  
  // Filter to only bottled wines with quantity > 0
  const bottledWines = getAvailableBottledWines(allBatches);
  
  if (bottledWines.length === 0) {
    return null; // No wines available for sale
  }
  
  // Randomly select a wine batch
  const selectedBatch = bottledWines[Math.floor(Math.random() * bottledWines.length)];
  
  // Find the corresponding vineyard for pricing context
  const vineyard = allVineyards.find(v => v.id === selectedBatch.vineyardId);
  
  if (!vineyard) {
    console.warn(`Vineyard not found for batch ${selectedBatch.id}`);
    return null;
  }
  
  // Randomly select order type
  const orderTypes = Object.keys(ORDER_TYPE_CONFIG) as OrderType[];
  const weights = orderTypes.map(type => ORDER_TYPE_CONFIG[type].chance);
  const selectedType = weightedRandomSelect(orderTypes, weights);
  
  const config = ORDER_TYPE_CONFIG[selectedType];
  
  // Get asking price (user-set or default) and base calculated price
  const askingPrice = selectedBatch.askingPrice ?? selectedBatch.finalPrice;
  const basePrice = selectedBatch.finalPrice; // This is now calculated by the new pricing service
  
  // Generate sophisticated price multiplier using symmetrical distribution
  const [minMultiplier, maxMultiplier] = config.priceMultiplierRange;
  const randomValue = Math.random(); // 0-1 random input
  const sophisticatedMultiplier = calculateSymmetricalMultiplier(randomValue, minMultiplier, maxMultiplier);
  const bidPrice = Math.round(askingPrice * sophisticatedMultiplier * 100) / 100;
  
  // Check for outright rejection based on price ratio
  const rejectionProbability = calculateRejectionProbability(bidPrice, basePrice);
  const rejectionRandomValue = Math.random();
  
  console.log(`=== PRICE REJECTION CHECK ===`);
  console.log(`Order Type: ${selectedType}`);
  console.log(`Wine: ${formatCompletedWineName(selectedBatch)}`);
  console.log(`Final Price (wine value): €${basePrice.toFixed(2)}`);
  console.log(`Asking Price: €${askingPrice.toFixed(2)}`);
  console.log(`Bid Price: €${bidPrice.toFixed(2)}`);
  console.log(`Premium Ratio: ${(bidPrice / basePrice).toFixed(2)}x`);
  console.log(`Rejection Probability: ${(rejectionProbability * 100).toFixed(1)}%`);
  console.log(`Random Value: ${(rejectionRandomValue * 100).toFixed(1)}%`);
  console.log(`Rejected: ${rejectionRandomValue < rejectionProbability ? 'YES' : 'NO'}`);
  console.log(`=============================`);
  
  if (rejectionRandomValue < rejectionProbability) {
    // Customer outright rejects the price and walks away
    const notificationMessage = `A ${selectedType} was interested in ${formatCompletedWineName(selectedBatch)}, but outright rejected our asking price.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }
  
  // Calculate order amount adjustment based on price difference
  const orderAmountMultiplier = calculateOrderAmount(
    { askingPrice },
    basePrice,
    selectedType
  );
  
  // Generate baseline quantity from order type range, then scale by price sensitivity
  // The range acts as a baseline market appetite; calculateOrderAmount scales this.
  const [minQty, maxQty] = config.quantityRange;
  const baseQuantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

  // Scale baseline by the computed multiplier - unlimited multiplication allowed
  const desiredQuantity = Math.floor(baseQuantity * orderAmountMultiplier);

  // Check if the desired quantity meets the minimum order requirement
  if (desiredQuantity < minQty) {
    
    // Order rejected - asking price too high, customer backs down
    const notificationMessage = `A ${selectedType} wanted to buy ${formatCompletedWineName(selectedBatch)}, but with our current asking price the amount they could afford simply became too low.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }

  // Calculate fulfillable quantity based on current inventory  
  const fulfillableQuantity = Math.min(desiredQuantity, selectedBatch.quantity);
  const fulfillableValue = Math.round(fulfillableQuantity * bidPrice * 100) / 100;
  
  const gameState = getGameState();
  const order: WineOrder = {
    id: uuidv4(),
    orderedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    },
    orderType: selectedType,
    wineBatchId: selectedBatch.id,
    wineName: formatCompletedWineName(selectedBatch),
    requestedQuantity: desiredQuantity,
    offeredPrice: bidPrice, // Store as offeredPrice in the order object for compatibility
    totalValue: Math.round(desiredQuantity * bidPrice * 100) / 100,
    fulfillableQuantity,
    fulfillableValue,
    askingPriceAtOrderTime: askingPrice, // Store the asking price at order time
    status: 'pending'
  };
  
  await saveWineOrder(order);
  triggerGameUpdate();
  return order;
}

