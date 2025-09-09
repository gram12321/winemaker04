
import React, { useState, useEffect } from 'react';
import { getAllInventoryItems, getTotalGrapeQuantity } from '../../lib/services/inventoryService';
import { useGameUpdates } from '../../hooks/useGameUpdates';
import { InventoryItem } from '../../lib/types';

const Winery: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [totalGrapes, setTotalGrapes] = useState(0);
  const { subscribe } = useGameUpdates();

  // Refresh inventory data
  const refreshInventory = async () => {
    const [inventoryData, totalGrapesData] = await Promise.all([
      getAllInventoryItems(),
      getTotalGrapeQuantity()
    ]);
    setInventory(inventoryData);
    setTotalGrapes(totalGrapesData);
  };

  // Update inventory when component mounts and subscribe to global updates
  useEffect(() => {
    refreshInventory();
    
    // Subscribe to global updates
    const unsubscribe = subscribe(() => {
      refreshInventory();
    });
    
    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Winery Management</h2>
      
      {/* Simple Inventory Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Total Grapes</h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalGrapes.toLocaleString()} kg
            </p>
            <p className="text-sm text-gray-500">
              {inventory.length} {inventory.length === 1 ? 'batch' : 'batches'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-purple-100 text-purple-800">
            <span className="text-2xl">🍇</span>
          </div>
        </div>
      </div>

      {/* Warehouse Storage */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1474722883778-792e7990302f?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Inventory Storage</h3>
            <div className="text-white text-right">
              <div className="text-sm opacity-80">Total Items</div>
              <div className="text-xl font-bold">{inventory.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h4 className="text-lg font-semibold text-gray-800">Detailed Inventory</h4>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grape Variety</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vineyard</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inventory.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No items in inventory. Harvest some grapes to get started!
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.grape}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.vineyardName}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Future Processing Section (Placeholder) */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Winery Processing</h3>
            <div className="text-white text-sm opacity-80">
              Coming Soon: Crush grapes, ferment must, age wine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Winery;
