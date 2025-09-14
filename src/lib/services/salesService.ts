// Sales service for wine order management (fulfillment and rejection)
import { WineOrder, WineBatch } from '../types';
import { loadWineOrders, updateWineOrderStatus, loadWineBatches, saveWineBatch, saveWineOrder } from '../database/database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { addTransaction } from './financeService';
import { createRelationshipBoost, addSalePrestigeEvent } from '../database/prestigeService';
import { getCurrentPrestige } from './gameState';
import { getCurrentCompanyId } from '../utils/companyUtils';

// ===== ORDER MANAGEMENT =====

// Get all pending wine orders
export async function getPendingOrders(): Promise<WineOrder[]> {
  const companyId = getCurrentCompanyId();
  return await loadWineOrders(companyId);
}

// Fulfill a wine order (sell the wine) - supports partial fulfillment
export async function fulfillWineOrder(orderId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  
  const orders = await loadWineOrders(companyId);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return false;
  }
  
  // Get the wine batch
  const allBatches = await loadWineBatches(companyId);
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
  
  await saveWineBatch(updatedBatch, companyId);
  
  // Add money to player account through finance system
  await addTransaction(
    fulfillableValue,
    `Wine Sale: ${order.wineName}${fulfillableQuantity < order.requestedQuantity ? ` (${fulfillableQuantity}/${order.requestedQuantity} bottles)` : ''}`,
    'Wine Sales',
    false,
    companyId
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
    
    // Create prestige event for the sale
    await addSalePrestigeEvent(
      fulfillableValue,
      order.customerName,
      order.wineName
    );
    
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
  
  await saveWineOrder(updatedOrder, companyId);
  
  triggerGameUpdate();
  return true;
}

// Reject a wine order
export async function rejectWineOrder(orderId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  await updateWineOrderStatus(orderId, 'rejected', companyId);
  triggerGameUpdate();
  return true;
}

