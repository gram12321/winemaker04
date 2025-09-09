// Simplified inventory management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { InventoryItem, GrapeVariety } from '../types';
import { saveInventoryItem, loadInventoryItems, deleteInventoryItem } from '../database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';

// Add grapes to inventory (simplified)
export async function addGrapesToInventory(
  grape: GrapeVariety,
  quantity: number,
  vineyardName: string
): Promise<InventoryItem> {
  const inventory = await loadInventoryItems();
  
  // Check if we already have this grape from this vineyard
  const existingItem = inventory.find(item => 
    item.grape === grape && item.vineyardName === vineyardName
  );

  if (existingItem) {
    // Update existing item
    const updatedItem: InventoryItem = {
      ...existingItem,
      quantity: existingItem.quantity + quantity
    };
    
    await saveInventoryItem(updatedItem);
    triggerGameUpdate();
    return updatedItem;
  } else {
    // Create new item
    const id = uuidv4();
    const inventoryItem: InventoryItem = {
      id,
      grape,
      quantity,
      vineyardName
    };

    await saveInventoryItem(inventoryItem);
    triggerGameUpdate();
    return inventoryItem;
  }
}

// Get all inventory items
export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  return await loadInventoryItems();
}

// Get total quantity of all grapes
export async function getTotalGrapeQuantity(): Promise<number> {
  const inventory = await loadInventoryItems();
  return inventory.reduce((total, item) => total + item.quantity, 0);
}

// Delete an inventory item
export async function deleteInventoryItemById(itemId: string): Promise<boolean> {
  try {
    await deleteInventoryItem(itemId);
    triggerGameUpdate();
    return true;
  } catch (error) {
    return false;
  }
}