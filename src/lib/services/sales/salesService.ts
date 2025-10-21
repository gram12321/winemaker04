// Sales service for wine order management (fulfillment and rejection)
import { WineOrder, WineBatch } from '../../types/types';
import { loadWineOrders, updateWineOrderStatus, saveWineOrder, getOrderById } from '../../database/customers/salesDB';
import { saveWineBatch, getWineBatchById } from '../../database/activities/inventoryDB';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { addTransaction } from '../user/financeService';
import { createRelationshipBoost } from '../sales/relationshipService';
import { addSalePrestigeEvent, addVineyardSalePrestigeEvent, getBaseVineyardPrestige, addFeaturePrestigeEvent } from '../prestige/prestigeService';
import { getCurrentPrestige } from '../core/gameState';
import { SALES_CONSTANTS } from '../../constants/constants';
import { getAllFeatureConfigs } from '../../constants/wineFeatures/commonFeaturesUtil';

// ===== ORDER MANAGEMENT =====

// Get all pending wine orders
export async function getPendingOrders(): Promise<WineOrder[]> {
  return await loadWineOrders();
}

// Fulfill a wine order (sell the wine) - supports partial fulfillment
export async function fulfillWineOrder(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  
  if (!order) {
    return false;
  }
  
  // Get the wine batch
  const wineBatch = await getWineBatchById(order.wineBatchId);
  
  if (!wineBatch) {
    return false;
  }
  
  // Calculate how many bottles we can actually fulfill
  const fulfillableQuantity = Math.min(order.requestedQuantity, wineBatch.quantity);
  let fulfillableValue = Math.round(fulfillableQuantity * order.offeredPrice * 100) / 100; // order.offeredPrice is the bidPrice
  
  // Cap the fulfillable value to prevent database overflow
  fulfillableValue = Math.min(fulfillableValue, SALES_CONSTANTS.MAX_PRICE);
  
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
      const basePermanentPrestige = await getBaseVineyardPrestige(wineBatch.vineyardId);
      const vineyardPrestigeFactor = Math.max(0.1, basePermanentPrestige);
      
      await addVineyardSalePrestigeEvent(
        fulfillableValue,
        order.customerName,
        order.wineName,
        wineBatch.vineyardId,
        Math.max(0.1, vineyardPrestigeFactor)
      );
        } else {
          // Fallback to company-level prestige event if no vineyard ID
          await addSalePrestigeEvent(
            fulfillableValue,
            order.customerName,
            order.wineName,
            fulfillableQuantity  // Pass volume for dynamic calculation
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
  
  // Check for wine features with onSale prestige events (e.g., oxidation, green flavor)
  try {
    const configs = getAllFeatureConfigs();
    const presentFeatures = (wineBatch.features || []).filter(f => f.isPresent);
    
    if (presentFeatures.length > 0) {
      // Load vineyard and current prestige for dynamic calculation
      const vineyards = await loadVineyards();
      const vineyard = vineyards.find(v => v.id === wineBatch.vineyardId);
      const currentPrestige = await getCurrentPrestige();
      
      for (const feature of presentFeatures) {
        const config = configs.find(c => c.id === feature.id);
        if (config?.effects.prestige?.onSale) {
          // Pass full context for dynamic prestige calculation
          await addFeaturePrestigeEvent(wineBatch, config, 'sale', {
            customerName: order.customerName,
            order: updatedOrder,  // Full order with actual fulfillable volume and value
            vineyard,
            currentCompanyPrestige: currentPrestige
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to create feature prestige events:', error);
    // Don't fail the order fulfillment if these fail
  }
  
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

