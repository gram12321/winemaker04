// Sales service for wine order management (fulfillment and rejection)
import { WineOrder, WineBatch } from '../../types/types';
import { loadWineOrders, updateWineOrderStatus, saveWineOrder } from '../../database/customers/salesDB';
import { loadWineBatches, saveWineBatch } from '../../database/activities/inventoryDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { addTransaction } from '../user/financeService';
import { createRelationshipBoost } from '../sales/relationshipService';
import { addSalePrestigeEvent, addVineyardSalePrestigeEvent, calculateVineyardPrestigeFromEvents } from '../prestige/prestigeService';
import { getCurrentPrestige } from '../core/gameState';

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
  const fulfillableValue = Math.round(fulfillableQuantity * order.offeredPrice * 100) / 100; // order.offeredPrice is the bidPrice
  
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
    'Wine Sales',
    false
  );
  
  // Create relationship boost and prestige event for successful order
  try {
    const currentPrestige = await getCurrentPrestige();
    
    // Create relationship boost
    await createRelationshipBoost(
      order.customerId,
      fulfillableValue,
      currentPrestige,
      `Order fulfilled: ${order.wineName} (${fulfillableQuantity} bottles)`
    );
    
    // Create vineyard-specific prestige event for the sale
    if (wineBatch.vineyardId) {
      // Get vineyard prestige factor for this vineyard
      const vineyardPrestigeFactor = await calculateVineyardPrestigeFromEvents(wineBatch.vineyardId);
      
      // Create vineyard-specific sale prestige event
      await addVineyardSalePrestigeEvent(
        fulfillableValue,
        order.customerName,
        order.wineName,
        wineBatch.vineyardId,
        Math.max(0.1, vineyardPrestigeFactor) // Ensure minimum factor of 0.1
      );
        } else {
          // Fallback to company-level prestige event if no vineyard ID
          await addSalePrestigeEvent(
            fulfillableValue,
            order.customerName,
            order.wineName
          );
        }
    
    // Prestige events created - will be reflected in next calculation
  } catch (error) {
    console.error('Failed to create relationship boost or prestige event:', error);
    // Don't fail the order fulfillment if these fail
  }
  
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

