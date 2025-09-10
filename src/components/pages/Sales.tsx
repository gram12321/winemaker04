
import { useState, useEffect } from 'react';
import { WineOrder, WineBatch } from '../../lib/types';
import { getPendingOrders, fulfillWineOrder, rejectWineOrder, generateWineOrder } from '../../lib/services/salesService';
import { loadWineBatches, saveWineBatch } from '../../lib/database';
import { useGameUpdates } from '../../hooks/useGameUpdates';
import { formatGameDate } from '../../lib/types';
import { useTableSortWithAccessors, SortableColumn } from '../../hooks/useTableSort';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';

const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cellar' | 'orders'>('cellar');
  const [orders, setOrders] = useState<WineOrder[]>([]);
  const [bottledWines, setBottledWines] = useState<WineBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState<{[key: string]: string}>({});

  // Listen to game updates to refresh data
  const { subscribe } = useGameUpdates();
  
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [subscribe]);

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

  // Helper function to get asking price for an order
  const getAskingPriceForOrder = (order: WineOrder): number => {
    // Use the asking price at order time if available, otherwise fall back to current asking price
    if (order.askingPriceAtOrderTime !== undefined && order.askingPriceAtOrderTime !== null) {
      return order.askingPriceAtOrderTime;
    }
    
    // Fallback to current asking price for old orders without stored asking price
    const wineBatch = bottledWines.find(batch => batch.id === order.wineBatchId);
    return wineBatch ? (wineBatch.askingPrice ?? wineBatch.finalPrice) : 0;
  };

  // Define sortable columns for orders
  const orderColumns: SortableColumn<WineOrder>[] = [
    { key: 'orderType', label: 'Order Type', sortable: true },
    { key: 'wineName', label: 'Wine', sortable: true },
    { key: 'requestedQuantity', label: 'Quantity', sortable: true },
    { 
      key: 'wineBatchId', 
      label: 'Asking Price', 
      sortable: true,
      accessor: (order) => getAskingPriceForOrder(order)
    },
    { key: 'offeredPrice', label: 'Bid Price', sortable: true },
    { key: 'totalValue', label: 'Total Value', sortable: true },
    { 
      key: 'fulfillableQuantity', 
      label: 'Fulfillable', 
      sortable: true,
      accessor: (order) => order.fulfillableQuantity ?? order.requestedQuantity
    },
    { 
      key: 'orderedAt', 
      label: 'Ordered', 
      sortable: true,
      accessor: (order) => `${order.orderedAt.year}-${order.orderedAt.season}-${order.orderedAt.week}`
    }
  ];

  // Define sortable columns for wine cellar
  const cellarColumns: SortableColumn<WineBatch>[] = [
    { key: 'grape', label: 'Wine', sortable: true },
    { key: 'vineyardName', label: 'Vineyard', sortable: true },
    { 
      key: 'harvestDate', 
      label: 'Harvest', 
      sortable: true,
      accessor: (wine) => `${wine.harvestDate.year}-${wine.harvestDate.season}-${wine.harvestDate.week}`
    },
    { key: 'quality', label: 'Quality', sortable: true },
    { key: 'balance', label: 'Balance', sortable: true },
    { key: 'finalPrice', label: 'Base Price', sortable: true },
    { 
      key: 'askingPrice', 
      label: 'Asking Price', 
      sortable: true,
      accessor: (wine) => wine.askingPrice ?? wine.finalPrice
    },
    { key: 'quantity', label: 'Bottles', sortable: true }
  ];

  // Use sorting hooks
  const {
    sortedData: sortedOrders,
    handleSort: handleOrderSort,
    getSortIndicator: getOrderSortIndicator,
    isColumnSorted: isOrderColumnSorted
  } = useTableSortWithAccessors(orders, orderColumns);

  const {
    sortedData: sortedBottledWines,
    handleSort: handleCellarSort,
    getSortIndicator: getCellarSortIndicator,
    isColumnSorted: isCellarColumnSorted
  } = useTableSortWithAccessors(bottledWines, cellarColumns);

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
        // Remove the fulfilled order from state
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
        // Update wine quantities in state
        setBottledWines(prevWines => {
          return prevWines.map(wine => {
            const order = orders.find(o => o.id === orderId);
            if (order && order.wineBatchId === wine.id) {
              const fulfillableQuantity = Math.min(order.requestedQuantity, wine.quantity);
              return {
                ...wine,
                quantity: wine.quantity - fulfillableQuantity
              };
            }
            return wine;
          });
        });
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
      // Remove the rejected order from state
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
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
        // Add the new order to state
        setOrders(prevOrders => [...prevOrders, newOrder]);
      }
      // If newOrder is null, it means the order was rejected due to high asking price
      // The notification system already handles this case with appropriate messaging
    } catch (error) {
      console.error('Error generating order:', error);
      alert('Error generating order');
    } finally {
      setLoading(false);
    }
  };

  // Handle price editing
  const handlePriceEdit = (wineId: string, currentPrice: number) => {
    setEditingPrices(prev => ({
      ...prev,
      [wineId]: currentPrice.toFixed(2)
    }));
  };

  const handlePriceChange = (wineId: string, value: string) => {
    setEditingPrices(prev => ({
      ...prev,
      [wineId]: value
    }));
  };

  const handlePriceSave = async (wine: WineBatch) => {
    const newPriceStr = editingPrices[wine.id];
    const newPrice = parseFloat(newPriceStr);
    
    // Enhanced validation
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Please enter a valid price (must be positive)');
      return;
    }
    
    if (newPrice < 0.01) {
      alert('Price must be at least €0.01');
      return;
    }
    
    if (newPrice > 10000) {
      alert('Price seems unusually high. Please confirm this is correct.');
      return;
    }

    try {
      const updatedWine: WineBatch = {
        ...wine,
        askingPrice: newPrice
      };
      
      await saveWineBatch(updatedWine);
      setEditingPrices(prev => {
        const updated = { ...prev };
        delete updated[wine.id];
        return updated;
      });
      // Update the wine in state
      setBottledWines(prevWines => 
        prevWines.map(w => w.id === wine.id ? updatedWine : w)
      );
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error updating price');
    }
  };

  const handlePriceCancel = (wineId: string) => {
    setEditingPrices(prev => {
      const updated = { ...prev };
      delete updated[wineId];
      return updated;
    });
  };

  // Bulk actions for orders
  const handleAcceptAll = async () => {
    if (orders.length === 0) return;

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        orders.map(order => fulfillWineOrder(order.id))
      );
      
      // Update state based on successful fulfillments
      const successfulOrders = results
        .map((result, index) => result.status === 'fulfilled' ? orders[index] : null)
        .filter(Boolean);
      
      // Remove successful orders from state
      setOrders(prevOrders => 
        prevOrders.filter(order => !successfulOrders.some(so => so?.id === order.id))
      );
      
      // Update wine quantities for successful orders
      setBottledWines(prevWines => {
        return prevWines.map(wine => {
          const successfulOrder = successfulOrders.find(so => so?.wineBatchId === wine.id);
          if (successfulOrder) {
            const fulfillableQuantity = Math.min(successfulOrder.requestedQuantity, wine.quantity);
            return {
              ...wine,
              quantity: wine.quantity - fulfillableQuantity
            };
          }
          return wine;
        });
      });
    } catch (error) {
      console.error('Error in bulk accept:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAll = async () => {
    if (orders.length === 0) return;

    setLoading(true);
    try {
      await Promise.all(orders.map(order => rejectWineOrder(order.id)));
      // Clear all orders from state
      setOrders([]);
    } catch (error) {
      console.error('Error in bulk reject:', error);
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('grape')}
                    sortIndicator={getCellarSortIndicator('grape')}
                    isSorted={isCellarColumnSorted('grape')}
                  >
                    Wine
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('vineyardName')}
                    sortIndicator={getCellarSortIndicator('vineyardName')}
                    isSorted={isCellarColumnSorted('vineyardName')}
                  >
                    Vineyard
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('harvestDate')}
                    sortIndicator={getCellarSortIndicator('harvestDate')}
                    isSorted={isCellarColumnSorted('harvestDate')}
                  >
                    Harvest
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('quality')}
                    sortIndicator={getCellarSortIndicator('quality')}
                    isSorted={isCellarColumnSorted('quality')}
                  >
                    Quality
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('balance')}
                    sortIndicator={getCellarSortIndicator('balance')}
                    isSorted={isCellarColumnSorted('balance')}
                  >
                    Balance
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('finalPrice')}
                    sortIndicator={getCellarSortIndicator('finalPrice')}
                    isSorted={isCellarColumnSorted('finalPrice')}
                  >
                    Base Price
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('askingPrice')}
                    sortIndicator={getCellarSortIndicator('askingPrice')}
                    isSorted={isCellarColumnSorted('askingPrice')}
                  >
                    Asking Price
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('quantity')}
                    sortIndicator={getCellarSortIndicator('quantity')}
                    isSorted={isCellarColumnSorted('quantity')}
                  >
                    Bottles
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBottledWines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No bottled wines available for sale
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBottledWines.map((wine) => (
                    <TableRow key={wine.id}>
                      <TableCell className="font-medium text-gray-900">
                        {wine.grape}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.vineyardName}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatGameDate(wine.harvestDate)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.quality >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.quality >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(wine.quality * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.balance >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.balance >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(wine.balance * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 font-medium">
                        €{wine.finalPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-gray-500 font-medium">
                        {editingPrices[wine.id] !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingPrices[wine.id]}
                              onChange={(e) => handlePriceChange(wine.id, e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                            <button
                              onClick={() => handlePriceSave(wine)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handlePriceCancel(wine.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`${
                              wine.askingPrice !== undefined 
                                ? wine.askingPrice < wine.finalPrice
                                  ? 'text-red-600 font-medium' // Discounted
                                  : wine.askingPrice > wine.finalPrice
                                  ? 'text-orange-600 font-medium' // Premium
                                  : 'text-gray-900' // Same as base
                                : 'text-gray-900' // Default
                            }`}>
                              €{(wine.askingPrice ?? wine.finalPrice).toFixed(2)}
                            </span>
                            {wine.askingPrice !== undefined && wine.askingPrice !== wine.finalPrice && (
                              <span className="text-xs text-gray-500">
                                {wine.askingPrice < wine.finalPrice ? '📉' : '📈'}
                              </span>
                            )}
                            <button
                              onClick={() => handlePriceEdit(wine.id, wine.askingPrice ?? wine.finalPrice)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.quantity}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Ready for Sale
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Order Management */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Order Management</h3>
                <p className="text-gray-500 text-sm">Generate test orders or manage pending orders</p>
              </div>
              <div className="flex space-x-2">
                {orders.length > 0 && (
                  <>
                    <button
                      onClick={handleAcceptAll}
                      disabled={loading}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      Accept All ({orders.length})
                    </button>
                    <button
                      onClick={handleRejectAll}
                      disabled={loading}
                      className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                    >
                      Reject All
                    </button>
                  </>
                )}
              <button
                onClick={handleGenerateOrder}
                disabled={loading || bottledWines.length === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Generating...' : 'Generate Order'}
              </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('orderType')}
                      sortIndicator={getOrderSortIndicator('orderType')}
                      isSorted={isOrderColumnSorted('orderType')}
                    >
                      Order Type
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('wineName')}
                      sortIndicator={getOrderSortIndicator('wineName')}
                      isSorted={isOrderColumnSorted('wineName')}
                    >
                      Wine
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('requestedQuantity')}
                      sortIndicator={getOrderSortIndicator('requestedQuantity')}
                      isSorted={isOrderColumnSorted('requestedQuantity')}
                    >
                      Quantity
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('wineBatchId')}
                      sortIndicator={getOrderSortIndicator('wineBatchId')}
                      isSorted={isOrderColumnSorted('wineBatchId')}
                    >
                      Asking Price
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('offeredPrice')}
                      sortIndicator={getOrderSortIndicator('offeredPrice')}
                      isSorted={isOrderColumnSorted('offeredPrice')}
                    >
                      Bid Price
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('totalValue')}
                      sortIndicator={getOrderSortIndicator('totalValue')}
                      isSorted={isOrderColumnSorted('totalValue')}
                    >
                      Total Value
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('fulfillableQuantity')}
                      sortIndicator={getOrderSortIndicator('fulfillableQuantity')}
                      isSorted={isOrderColumnSorted('fulfillableQuantity')}
                    >
                      Fulfillable
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('orderedAt')}
                      sortIndicator={getOrderSortIndicator('orderedAt')}
                      isSorted={isOrderColumnSorted('orderedAt')}
                    >
                      Ordered
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                        No pending orders
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {order.orderType}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {order.wineName}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          <div className="flex flex-col">
                            <span>{order.requestedQuantity} bottles</span>
                            {order.fulfillableQuantity !== undefined && order.fulfillableQuantity !== null && order.fulfillableQuantity < order.requestedQuantity && (
                              <span className="text-xs text-orange-600">
                                (Can fulfill: {order.fulfillableQuantity})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500 font-medium">
                          €{getAskingPriceForOrder(order).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          <div className="flex items-center space-x-1">
                            <span className={`${
                              order.offeredPrice > getAskingPriceForOrder(order)
                                ? 'text-green-600 font-medium' // Above asking price
                                : order.offeredPrice < getAskingPriceForOrder(order)
                                ? 'text-red-600 font-medium' // Below asking price
                                : 'text-gray-900' // Equal to asking price
                            }`}>
                          €{order.offeredPrice.toFixed(2)}
                            </span>
                            {order.offeredPrice !== getAskingPriceForOrder(order) && (
                              <span className="text-xs text-gray-500">
                                {order.offeredPrice > getAskingPriceForOrder(order) ? '📈' : '📉'}
                                <span className="ml-1 text-xs">
                                  {order.offeredPrice > getAskingPriceForOrder(order) 
                                    ? `+${(((order.offeredPrice - getAskingPriceForOrder(order)) / getAskingPriceForOrder(order)) * 100).toFixed(0)}%`
                                    : `${(((order.offeredPrice - getAskingPriceForOrder(order)) / getAskingPriceForOrder(order)) * 100).toFixed(0)}%`
                                  }
                                </span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          <div className="flex flex-col">
                            <span>€{order.totalValue.toFixed(2)}</span>
                            {order.fulfillableValue !== undefined && order.fulfillableValue !== null && order.fulfillableValue < order.totalValue && (
                              <span className="text-xs text-orange-600">
                                (Can earn: €{order.fulfillableValue.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {order.fulfillableQuantity !== undefined && order.fulfillableQuantity !== null ? order.fulfillableQuantity : order.requestedQuantity} bottles
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {formatGameDate(order.orderedAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium space-x-2">
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
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
