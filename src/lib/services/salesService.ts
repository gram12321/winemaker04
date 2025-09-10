// Sales service for wine order generation and fulfillment
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, WineBatch, OrderType } from '../types';
import { saveWineOrder, loadWineOrders, updateWineOrderStatus, loadWineBatches, saveWineBatch } from '../database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from '../gameState';
import { addTransaction } from './financeService';
import { formatCompletedWineName } from './wineBatchService';
import { SALES_CONSTANTS, PRICING_PLACEHOLDER_CONSTANTS } from '../constants';
import { calculateBaseWinePrice, calculateExtremeQualityMultiplier, calculateOrderAmount } from '../utils/calculator';
import { notificationService } from '../../components/layout/NotificationCenter';

// Use order type configurations from constants
const ORDER_TYPE_CONFIG = SALES_CONSTANTS.ORDER_TYPES;

// ===== PRICING CALCULATIONS =====

// Get the asking price from the wine batch (user-set or defaults to finalPrice)
export function getWineAskingPrice(wineBatch: WineBatch): number {
  // Use askingPrice if set, otherwise fall back to finalPrice
  return wineBatch.askingPrice ?? wineBatch.finalPrice;
}

// Get the base price from the wine batch (calculated price for comparison)
export function getWineBasePrice(wineBatch: WineBatch): number {
  // The base price is already calculated and stored in the wine batch
  // This is used for calculateOrderAmount comparison
  return wineBatch.finalPrice;
}

// Recalculate base price when wine properties change (for future use)
export function recalculateWineBasePrice(wineBatch: WineBatch): number {
  // Use new sophisticated pricing system
  // Base Price = (Land Value + Prestige) × Base Rate (with placeholders)
  const basePrice = calculateBaseWinePrice(
    PRICING_PLACEHOLDER_CONSTANTS.LAND_VALUE_PLACEHOLDER, 
    PRICING_PLACEHOLDER_CONSTANTS.PRESTIGE_PLACEHOLDER, 
    SALES_CONSTANTS.BASE_RATE_PER_BOTTLE
  );
  
  // Calculate quality/balance multiplier (50/50 combination)
  const combinedScore = (wineBatch.quality + wineBatch.balance) / 2;
  const qualityMultiplier = calculateExtremeQualityMultiplier(combinedScore);
  
  // Calculate final price: Base Price × Quality/Balance Multiplier
  const finalPrice = basePrice * qualityMultiplier;
  
  return Math.max(
    SALES_CONSTANTS.MIN_PRICE_PER_BOTTLE, 
    Math.round(finalPrice * 100) / 100
  );
}

// ===== ORDER GENERATION =====

// Generate a random wine order for available bottled wines
export async function generateWineOrder(): Promise<WineOrder | null> {
  const allBatches = await loadWineBatches();
  
  // Filter to only bottled wines with quantity > 0
  const bottledWines = allBatches.filter(batch => 
    batch.stage === 'bottled' && 
    batch.process === 'bottled' && 
    batch.quantity > 0
  );
  
  if (bottledWines.length === 0) {
    return null; // No wines available for sale
  }
  
  // Randomly select a wine batch
  const selectedBatch = bottledWines[Math.floor(Math.random() * bottledWines.length)];
  
  // Randomly select order type
  const orderTypes = Object.keys(ORDER_TYPE_CONFIG) as OrderType[];
  const weights = orderTypes.map(type => ORDER_TYPE_CONFIG[type].chance);
  const selectedType = weightedRandomSelect(orderTypes, weights);
  
  const config = ORDER_TYPE_CONFIG[selectedType];
  
  // Get asking price (user-set or default) and base calculated price
  const askingPrice = getWineAskingPrice(selectedBatch);
  const basePrice = getWineBasePrice(selectedBatch);
  const offeredPrice = Math.round(askingPrice * config.priceMultiplier * 100) / 100;
  
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
    const notificationMessage = `A ${selectedType} would have liked to buy ${formatCompletedWineName(selectedBatch)}, but the asking price was too high, so they decided to back down.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }

  // No inventory cap - allow orders larger than available inventory
  const requestedQuantity = desiredQuantity;
  
  // Calculate fulfillable quantity based on current inventory
  const fulfillableQuantity = Math.min(requestedQuantity, selectedBatch.quantity);
  const fulfillableValue = fulfillableQuantity * offeredPrice;
  
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
    requestedQuantity,
    offeredPrice,
    totalValue: requestedQuantity * offeredPrice,
    fulfillableQuantity,
    fulfillableValue,
    askingPriceAtOrderTime: askingPrice, // Store the asking price at order time
    status: 'pending'
  };
  
  await saveWineOrder(order);
  triggerGameUpdate();
  return order;
}

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

// ===== ORDER MANAGEMENT =====

// Get all pending wine orders
export async function getPendingOrders(): Promise<WineOrder[]> {
  return await loadWineOrders();
}

// Fulfill a wine order (sell the wine) - supports partial fulfillment
export async function fulfillWineOrder(orderId: string): Promise<boolean> {
  const orders = await loadWineOrders();
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return false;
  }
  
  // Get the wine batch
  const allBatches = await loadWineBatches();
  const wineBatch = allBatches.find(batch => batch.id === order.wineBatchId);
  
  if (!wineBatch) {
    return false;
  }
  
  // Calculate how many bottles we can actually fulfill
  const fulfillableQuantity = Math.min(order.requestedQuantity, wineBatch.quantity);
  const fulfillableValue = fulfillableQuantity * order.offeredPrice;
  
  if (fulfillableQuantity === 0) {
    return false; // No inventory available
  }
  
  // Remove bottles from inventory
  const updatedBatch: WineBatch = {
    ...wineBatch,
    quantity: wineBatch.quantity - fulfillableQuantity
  };
  
  await saveWineBatch(updatedBatch);
  
  // Add money to player account through finance system
  await addTransaction(
    fulfillableValue,
    `Wine Sale: ${order.wineName}${fulfillableQuantity < order.requestedQuantity ? ` (${fulfillableQuantity}/${order.requestedQuantity} bottles)` : ''}`,
    'Wine Sales'
  );
  
  // Update order with fulfillment details and mark as fulfilled or partially fulfilled
  const updatedOrder: WineOrder = {
    ...order,
    fulfillableQuantity,
    fulfillableValue,
    status: fulfillableQuantity < order.requestedQuantity ? 'partially_fulfilled' : 'fulfilled'
  };
  
  await saveWineOrder(updatedOrder);
  
  triggerGameUpdate();
  return true;
}

// Reject a wine order
export async function rejectWineOrder(orderId: string): Promise<boolean> {
  await updateWineOrderStatus(orderId, 'rejected');
  triggerGameUpdate();
  return true;
}

// Check if we should generate a new order (simple probability)
export function shouldGenerateOrder(): boolean {
  return Math.random() < SALES_CONSTANTS.ORDER_GENERATION_CHANCE;
}
