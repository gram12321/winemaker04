
import React, { useState, useEffect } from 'react';
import { WineOrder, WineBatch } from '../../lib/types';
import { getPendingOrders, fulfillWineOrder, rejectWineOrder, generateWineOrder } from '../../lib/services/salesService';
import { loadWineBatches } from '../../lib/database';
import { useGameUpdates } from '../../hooks/useGameUpdates';
import { formatGameDate } from '../../lib/types';

const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cellar' | 'orders'>('cellar');
  const [orders, setOrders] = useState<WineOrder[]>([]);
  const [bottledWines, setBottledWines] = useState<WineBatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to game updates to refresh data
  useGameUpdates(() => {
    loadData();
  });

  // Load data function
  const loadData = async () => {
    try {
      const [pendingOrders, allBatches] = await Promise.all([
        getPendingOrders(),
        loadWineBatches()
      ]);
      
      setOrders(pendingOrders);
      setBottledWines(allBatches.filter(batch => 
        batch.stage === 'bottled' && batch.process === 'bottled'
      ));
    } catch (error) {
      console.error('Failed to load sales data:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Handle order fulfillment
  const handleFulfillOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const success = await fulfillWineOrder(orderId);
      if (success) {
        await loadData(); // Refresh data
      } else {
        alert('Failed to fulfill order - insufficient inventory');
      }
    } catch (error) {
      console.error('Error fulfilling order:', error);
      alert('Error fulfilling order');
    } finally {
      setLoading(false);
    }
  };

  // Handle order rejection
  const handleRejectOrder = async (orderId: string) => {
    setLoading(true);
    try {
      await rejectWineOrder(orderId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Error rejecting order');
    } finally {
      setLoading(false);
    }
  };

  // Generate test order
  const handleGenerateOrder = async () => {
    setLoading(true);
    try {
      const newOrder = await generateWineOrder();
      if (newOrder) {
        await loadData(); // Refresh data
      } else {
        alert('No bottled wines available for orders');
      }
    } catch (error) {
      console.error('Error generating order:', error);
      alert('Error generating order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Sales</h2>
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1">
        <button 
          onClick={() => setActiveTab('cellar')}
          className={`px-4 py-2 rounded ${
            activeTab === 'cellar' 
              ? 'bg-amber-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Wine Cellar
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded ${
            activeTab === 'orders' 
              ? 'bg-amber-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Orders ({orders.length})
        </button>
      </div>

      {/* Wine Cellar Image */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1510076857177-7470076d4098?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <h3 className="text-white text-xl font-semibold">
            {activeTab === 'cellar' ? 'Wine Cellar Inventory' : 'Pending Orders'}
          </h3>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'cellar' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Bottled Wines Available for Sale</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vineyard</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harvest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bottles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bottledWines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No bottled wines available for sale
                    </td>
                  </tr>
                ) : (
                  bottledWines.map((wine) => (
                    <tr key={wine.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {wine.grape}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {wine.vineyardName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatGameDate(wine.harvestDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.quality >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.quality >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(wine.quality * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.balance >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.balance >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(wine.balance * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium">
                        €{wine.basePrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {wine.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Ready for Sale
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Generate Order Button */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Order Management</h3>
                <p className="text-gray-500 text-sm">Generate test orders or manage pending orders</p>
              </div>
              <button
                onClick={handleGenerateOrder}
                disabled={loading || bottledWines.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Generating...' : 'Generate Order'}
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wine</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Bottle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No pending orders
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {order.orderType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {order.wineName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {order.requestedQuantity} bottles
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          €{order.offeredPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">
                          €{order.totalValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                          {formatGameDate(order.orderedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleFulfillOrder(order.id)}
                            disabled={loading}
                            className="text-green-600 hover:text-green-900 disabled:text-gray-400"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectOrder(order.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
