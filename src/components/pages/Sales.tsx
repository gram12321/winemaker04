
import React, { useState, useEffect } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { WineOrder, WineBatch, Customer, CustomerCountry, CustomerType, GameDate } from '@/lib/types/types';
import { fulfillWineOrder, rejectWineOrder, generateSophisticatedWineOrders, generateCustomer } from '@/lib/services';
import { loadWineBatches, saveWineBatch } from '@/lib/database/activities/inventoryDB';
import { loadWineOrders } from '@/lib/database/customers/salesDB';
import { formatNumber, formatCurrency, formatPercent, formatGameDateFromObject } from '@/lib/utils/utils';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WineCharacteristicsDisplay } from '../ui';
import { getFlagIcon, loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { calculateRelationshipBreakdown } from '@/lib/services/sales/relationshipService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { NavigationProps } from '../../lib/types/UItypes';
import { useGameUpdates } from '@/hooks';

interface SalesProps extends NavigationProps {
  // Inherits onNavigateToWinepedia from NavigationProps
}

/**
 * Create minimal customer object for relationship breakdown from order data
 * Used in Sales.tsx where we only have order information
 */
function createCustomerFromOrderData(
  customerId: string,
  customerName: string,
  customerCountry: CustomerCountry,
  customerType: CustomerType,
  customerRelationship?: number
): Customer {
  return {
    id: customerId,
    name: customerName,
    country: customerCountry,
    customerType,
    marketShare: 0.01, // Default value, will be overridden by actual customer data
    purchasingPower: 1.0,
    wineTradition: 1.0,
    priceMultiplier: 1.0,
    relationship: customerRelationship
  };
}

const Sales: React.FC<SalesProps> = ({ onNavigateToWinepedia }) => {
  const { isLoading, withLoading } = useLoadingState();
  
  // Helper function to create company-scoped customer key
  const getCustomerKey = (customerId: string): string => {
    try {
      const companyId = getCurrentCompanyId();
      return `${companyId}:${customerId}`;
    } catch (error) {
      // Fallback to just customerId if no company context
      return customerId;
    }
  };
  const [activeTab, setActiveTab] = useState<'cellar' | 'orders'>('cellar');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('all');
  const [showSoldOut, setShowSoldOut] = useState<boolean>(false);
  const [editingPrices, setEditingPrices] = useState<{[key: string]: string}>({});
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [orderChanceInfo, setOrderChanceInfo] = useState<{
    companyPrestige: number;
    availableWines: number;
    pendingOrders: number;
    baseChance: number;
    pendingPenalty: number;
    finalChance: number;
    randomRoll: number;
  } | null>(null);
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[key: string]: string}>({});
  const [computedRelationships, setComputedRelationships] = useState<{[key: string]: number}>({});
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const ordersPageSize = 20;


  // Use consolidated hooks for reactive data loading
  const allOrders = useGameStateWithData(
    () => loadWineOrders(),
    []
  );

  const allBatches = useGameStateWithData(
    () => loadWineBatches(),
    []
  );

  // Memoize filtered orders to prevent unnecessary recalculations
  const orders = React.useMemo(() => 
    orderStatusFilter === 'all' 
      ? allOrders 
      : allOrders.filter(order => order.status === orderStatusFilter),
    [allOrders, orderStatusFilter]
  );

  // Always-available list of pending orders for bulk actions
  const pendingOrders = React.useMemo(() => 
    allOrders.filter(order => order.status === 'pending'),
    [allOrders]
  );

  // Memoize filtered bottled wines
  const bottledWines = React.useMemo(() => 
    allBatches.filter(batch => 
      batch.state === 'bottled' && (showSoldOut || batch.quantity > 0)
    ),
    [allBatches, showSoldOut]
  );

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
    { key: 'customerName', label: 'Customer', sortable: true },
    { 
      key: 'customerRelationship', 
      label: 'Relationship', 
      sortable: true,
      accessor: (order) => order.customerRelationship ?? 0
    },
    { key: 'customerType', label: 'Customer Type', sortable: true },
    { key: 'wineName', label: 'Wine', sortable: true },
    { key: 'requestedQuantity', label: 'Quantity', sortable: true },
    {
      key: 'wineBatchId',
      label: 'Inventory',
      sortable: true,
      accessor: (order) => {
        const batch = allBatches.find(b => b.id === order.wineBatchId);
        return batch ? batch.quantity : 0;
      }
    },
    { 
      key: 'wineBatchId', 
      label: 'Asking Price', 
      sortable: true,
      accessor: (order) => getAskingPriceForOrder(order)
    },
    { key: 'offeredPrice', label: 'Bid Price', sortable: true },
    { 
      key: 'wineBatchId', 
      label: 'Premium/Discount', 
      sortable: true,
      accessor: (order) => (order.offeredPrice / getAskingPriceForOrder(order) - 1) * 100
    },
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

  // Helper function to format harvest period (start and end dates)
  const formatHarvestPeriod = (harvestDate: GameDate): string => {
    // For now, we'll show the harvest date as both start and end
    // In the future, this could be enhanced to show actual harvest period range
    const startDate = formatGameDateFromObject(harvestDate);
    return `${startDate} - ${startDate}`;
  };

  // Define sortable columns for wine cellar
  const cellarColumns: SortableColumn<WineBatch>[] = [
    { key: 'grape', label: 'Wine', sortable: true },
    { key: 'harvestDate', label: 'Vintage', sortable: true, accessor: (wine) => wine.harvestDate.year },
    { key: 'vineyardName', label: 'Vineyard', sortable: true },
    { 
      key: 'harvestDate', 
      label: 'Harvest Period', 
      sortable: true,
      accessor: (wine) => formatHarvestPeriod(wine.harvestDate)
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

  // Helper to fetch current inventory for an order's batch
  const getInventoryForOrder = React.useCallback((order: WineOrder): number => {
    const batch = allBatches.find(b => b.id === order.wineBatchId);
    return batch ? batch.quantity : 0;
  }, [allBatches]);

  // Paginate sorted orders
  const paginatedOrders = React.useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return sortedOrders.slice(start, start + ordersPageSize);
  }, [sortedOrders, ordersPage, ordersPageSize]);

  // Reset to first page when filter changes
  React.useEffect(() => {
    setOrdersPage(1);
  }, [orderStatusFilter]);

  const totalOrdersPages = Math.max(1, Math.ceil(sortedOrders.length / ordersPageSize));

  const {
    sortedData: sortedBottledWines,
    handleSort: handleCellarSort,
    getSortIndicator: getCellarSortIndicator,
    isColumnSorted: isCellarColumnSorted
  } = useTableSortWithAccessors(bottledWines, cellarColumns);

  // Load current customer acquisition chance
  const loadCustomerChance = async () => {
    try {
      const { chanceInfo } = await generateCustomer({ dryRun: true }); // dry run for display
      setOrderChanceInfo(chanceInfo);
    } catch (error) {
      console.error('Error loading customer acquisition chance:', error);
    }
  };

  // Memoize relationship breakdown loading to prevent duplicate calls
  const loadRelationshipBreakdown = React.useCallback(async (customerId: string, customer: Customer) => {
    try {
      const breakdown = await calculateRelationshipBreakdown(customer);
      const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
      const customerKey = getCustomerKey(customerId);
      
      setRelationshipBreakdowns(prev => ({
        ...prev,
        [customerKey]: formattedBreakdown
      }));
      
      setComputedRelationships(prev => ({
        ...prev,
        [customerKey]: breakdown.totalRelationship
      }));
    } catch (error) {
      console.error('Error loading relationship breakdown:', error);
    }
  }, []);

  // Load customer chance info on component mount
  useEffect(() => {
    loadCustomerChance();
  }, []);

  // Remove N+1 precompute loop - relationships are now loaded on-demand when hovering
  // This eliminates the performance bottleneck of loading all relationships upfront

  // Refresh relationship breakdown caches when game updates (e.g., order fulfilled)
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setRelationshipBreakdowns({});
      setComputedRelationships({});
    });
    return () => { unsubscribe(); };
  }, [subscribe]);

  // Handle order fulfillment
  const handleFulfillOrder = (orderId: string) => withLoading(async () => {
    const success = await fulfillWineOrder(orderId);
    if (!success) {
      alert('Failed to fulfill order - insufficient inventory');
    }
  });

  // Handle order rejection
  const handleRejectOrder = (orderId: string) => withLoading(async () => {
    await rejectWineOrder(orderId);
  });

  // Generate test order (customer acquisition + order creation)
  const handleGenerateOrder = () => withLoading(async () => {
    const { chanceInfo } = await generateSophisticatedWineOrders();
    
    // Store chance information for tooltip display
    setOrderChanceInfo(chanceInfo);
    
    // Data will be automatically refreshed by the reactive hooks
  });

  // Handle price editing
  const handlePriceEdit = (wineId: string, currentPrice: number) => {
    setEditingPrices(prev => ({
      ...prev,
      [wineId]: formatNumber(currentPrice, { decimals: 2, forceDecimals: true })
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
      // Data will be automatically refreshed by the reactive hooks
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
  const handleAcceptAll = () => withLoading(async () => {
    if (pendingOrders.length === 0) return;

    await Promise.allSettled(
      pendingOrders.map(order => fulfillWineOrder(order.id))
    );
    
    // Data will be automatically refreshed by the reactive hooks
  });

  const handleRejectAll = () => withLoading(async () => {
    if (pendingOrders.length === 0) return;

    await Promise.all(pendingOrders.map(order => rejectWineOrder(order.id)));
    // Data will be automatically refreshed by the reactive hooks
  });

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
          Orders ({allOrders.filter(o => o.status === 'pending').length})
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
        <div className="space-y-4">
          {/* Wine Cellar Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Wine Cellar Filter</h3>
                <p className="text-gray-500 text-sm">Filter wines by availability</p>
              </div>
              <div className="flex space-x-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showSoldOut}
                    onChange={(e) => setShowSoldOut(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Show Sold Out Wines</span>
                </label>
              </div>
            </div>
          </div>

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
                    Vintage
                  </TableHead>
                  <TableHead 
                    sortable 
                    onSort={() => handleCellarSort('harvestDate')}
                    sortIndicator={getCellarSortIndicator('harvestDate')}
                    isSorted={isCellarColumnSorted('harvestDate')}
                  >
                    Harvest Period
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
                    <React.Fragment key={wine.id}>
                      <TableRow>
                        <TableCell className="font-medium text-gray-900">
                          <button
                            onClick={() => setExpandedBatches(prev => ({ ...prev, [wine.id]: !prev[wine.id] }))}
                            className="mr-2 text-gray-600 hover:text-gray-900"
                            title={expandedBatches[wine.id] ? 'Hide details' : 'Show details'}
                          >
                            {expandedBatches[wine.id] ? '▼' : '▶'}
                          </button>
                          {wine.grape}
                        </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.vineyardName}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.harvestDate.year}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatHarvestPeriod(wine.harvestDate)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.quality >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.quality >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {formatPercent(wine.quality, 0, true)}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.balance >= 0.8 ? 'bg-green-100 text-green-800' :
                          wine.balance >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {formatPercent(wine.balance, 0, true)}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 font-medium">
                        {formatCurrency(wine.finalPrice, 2)}
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
                              {formatCurrency(wine.askingPrice ?? wine.finalPrice, 2)}
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
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          wine.quantity > 0 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {wine.quantity > 0 ? 'Ready for Sale' : 'Sold Out'}
                        </span>
                      </TableCell>
                      </TableRow>
                      {expandedBatches[wine.id] && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50">
                            <div className="p-3">
                              <WineCharacteristicsDisplay 
                                characteristics={wine.characteristics}
                                collapsible={false}
                                showBalanceScore={true}
                                title="Wine Characteristics"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Order Status Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Order Filter</h3>
                <p className="text-gray-500 text-sm">Filter orders by status</p>
              </div>
              <div className="flex space-x-2">
                {(['all', 'pending', 'fulfilled', 'rejected'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      orderStatusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
                    {status !== 'all' && (
                      <span className="ml-1 text-xs">
                        ({allOrders.filter(o => o.status === status).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Acquisition Chance Display */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Customer Acquisition</h3>
                <p className="text-gray-500 text-sm">Current chance to attract new customers</p>
              </div>
              <div className="flex items-center space-x-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 cursor-help">
                        <div className="text-sm text-blue-700">
                          <span className="font-medium">Customer Chance:</span>
                          <span className="ml-2 text-lg font-bold text-blue-800">
                            {orderChanceInfo ? formatPercent(orderChanceInfo.finalChance, 1, true) : '--'}
                          </span>
                        </div>
                        <div className="text-blue-500">ℹ️</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      {orderChanceInfo ? (
                        <div className="space-y-2 text-sm">
                          <div className="font-semibold">Customer Acquisition Details</div>
                          <div className="space-y-1">
                            <div>Company Prestige: <span className="font-medium">{formatNumber(orderChanceInfo.companyPrestige, { decimals: 1, forceDecimals: true })}</span></div>
                            <div>Available Wines: <span className="font-medium">{orderChanceInfo.availableWines}</span></div>
                            <div>Pending Orders: <span className="font-medium">{orderChanceInfo.pendingOrders}</span></div>
                            <div>Base Chance: <span className="font-medium">{formatPercent(orderChanceInfo.baseChance, 1, true)}</span></div>
                            <div>Pending Penalty: <span className="font-medium">{formatNumber(orderChanceInfo.pendingPenalty, { decimals: 2, forceDecimals: true })}x</span></div>
                            <div className="border-t pt-1">
                              <div>Final Chance: <span className="font-bold text-blue-300">{formatPercent(orderChanceInfo.finalChance, 1, true)}</span></div>
                              {orderChanceInfo.randomRoll > 0 ? (
                                <div>Last Roll: <span className="font-medium">{orderChanceInfo.randomRoll < orderChanceInfo.finalChance ? '✅ Customer Acquired' : '❌ No Customer'}</span></div>
                              ) : (
                                <div className="text-xs text-gray-400">Click "Generate Order" to see roll result</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <div className="font-semibold">Customer Acquisition</div>
                          <div>Click "Generate Order" to see your customer acquisition chance</div>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Order Management */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Order Management</h3>
                <p className="text-gray-500 text-sm">Generate test orders or manage pending orders</p>
              </div>
              <div className="flex space-x-2">
                {pendingOrders.length > 0 && (
                  <>
                    <button
                      onClick={handleAcceptAll}
                      disabled={isLoading}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      Accept All ({pendingOrders.length})
                    </button>
                    <button
                      onClick={handleRejectAll}
                      disabled={isLoading}
                      className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                    >
                      Reject All
                    </button>
                  </>
                )}
              <button
                onClick={handleGenerateOrder}
                disabled={isLoading || bottledWines.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Generating...' : 'Generate Order'}
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
                      onSort={() => handleOrderSort('customerName')}
                      sortIndicator={getOrderSortIndicator('customerName')}
                      isSorted={isOrderColumnSorted('customerName')}
                    >
                      Customer
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('customerRelationship')}
                      sortIndicator={getOrderSortIndicator('customerRelationship')}
                      isSorted={isOrderColumnSorted('customerRelationship')}
                    >
                      Relationship
                    </TableHead>
                    <TableHead 
                      sortable 
                      onSort={() => handleOrderSort('customerType')}
                      sortIndicator={getOrderSortIndicator('customerType')}
                      isSorted={isOrderColumnSorted('customerType')}
                    >
                      Customer Type
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
                    Inventory
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
                      onSort={() => handleOrderSort('wineBatchId')}
                      sortIndicator={getOrderSortIndicator('wineBatchId')}
                      isSorted={isOrderColumnSorted('wineBatchId')}
                    >
                      Premium/Discount
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
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-gray-500 py-8">
                        {orderStatusFilter === 'all' ? 'No orders found' : `No ${orderStatusFilter} orders`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-gray-900">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                  <button 
                                    onClick={() => onNavigateToWinepedia?.()}
                                    className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted flex items-center space-x-2 text-left"
                                    title="Click to view customer details in Winepedia"
                                  >
                                    <span className={getFlagIcon(order.customerCountry || '')}></span>
                                    <span>{order.customerName || 'Unknown Customer'}</span>
                                  </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <div className="space-y-2 text-sm">
                                  {order.calculationData ? (
                                    <>
                                      <div className="font-semibold">Price Multiplier Calculation</div>
                                      <div className="space-y-1 text-xs">
                                        <div>Formula: {formatNumber(order.calculationData.estimatedBaseMultiplier, { decimals: 3, forceDecimals: true })} (B) × {formatNumber(order.calculationData.purchasingPowerMultiplier, { decimals: 3, forceDecimals: true })} (PP) × {formatNumber(order.calculationData.wineTraditionMultiplier, { decimals: 3, forceDecimals: true })} (WT) × {formatNumber(order.calculationData.marketShareMultiplier, { decimals: 3, forceDecimals: true })} (MS) = {formatNumber(order.calculationData.finalPriceMultiplier, { decimals: 3, forceDecimals: true })}x (Mtp)</div>
                                      </div>
                                      <div className="font-semibold">Quantity Calculation</div>
                                      <div className="space-y-1 text-xs">
                                        <div>{order.calculationData.baseQuantity} (B) × {formatNumber(order.calculationData.priceSensitivity, { decimals: 3, forceDecimals: true })} (SENS) × {formatNumber(order.calculationData.purchasingPowerMultiplier, { decimals: 3, forceDecimals: true })} (PP) × {formatNumber(order.calculationData.wineTraditionMultiplier, { decimals: 3, forceDecimals: true })} (WT) × {formatNumber(order.calculationData.quantityMarketShareMultiplier, { decimals: 3, forceDecimals: true })} (MS) = {order.calculationData.finalQuantity} bottles</div>
                                      </div>
                                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-600">
                                        B=Base, PP=Purchasing Power, WT=Wine Tradition, MS=Market Share, SENS=Sensitivity
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-gray-500">Calculation data not available</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span 
                                  onMouseEnter={() => {
                                    const customerKey = getCustomerKey(order.customerId);
                                    if (!relationshipBreakdowns[customerKey]) {
                                      // Create a minimal customer object for the breakdown calculation
                                      const customer = createCustomerFromOrderData(
                                        order.customerId,
                                        order.customerName,
                                        order.customerCountry,
                                        order.customerType,
                                        order.customerRelationship
                                      );
                                      loadRelationshipBreakdown(order.customerId, customer);
                                    }
                                  }}
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-help ${
                                    (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 80 ? 'bg-green-100 text-green-800' :
                                    (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 40 ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                  {formatPercent((computedRelationships[getCustomerKey(order.customerId)] ?? 0) / 100, 0, true)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <div className="text-sm">
                                  <div className="font-semibold mb-2">Customer Relationship Breakdown</div>
                                  {relationshipBreakdowns[getCustomerKey(order.customerId)] ? (
                                    <div className="space-y-1 text-xs">
                                      {relationshipBreakdowns[getCustomerKey(order.customerId)].split('\n').map((line, index) => (
                                        <div key={index} className={line.startsWith('•') ? 'ml-2' : line === '' ? 'h-1' : ''}>
                                          {line}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500">
                                      Loading relationship breakdown...
                                      <div className="mt-2 text-blue-500">
                                        Hover to load detailed breakdown...
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 cursor-help">
                                  {order.customerType}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div className="font-semibold">Type Range</div>
                                  <div className="text-xs text-gray-500">
                                    {order.customerType === 'Restaurant' && '12-80 bottles (2-13 cases)'}
                                    {order.customerType === 'Wine Shop' && '18-120 bottles (3-20 cases)'}
                                    {order.customerType === 'Private Collector' && '3-36 bottles (0.5-6 cases)'}
                                    {order.customerType === 'Chain Store' && '60-300 bottles (10-50 cases)'}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                        <TableCell className="text-gray-500">
                          {getInventoryForOrder(order)}
                        </TableCell>
                        <TableCell className="text-gray-500 font-medium">
                          {formatCurrency(getAskingPriceForOrder(order), 2)}
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
                          {formatCurrency(order.offeredPrice, 2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`cursor-help font-medium ${
                                  order.offeredPrice > getAskingPriceForOrder(order)
                                    ? 'text-green-600' // Above asking price
                                    : order.offeredPrice < getAskingPriceForOrder(order)
                                    ? 'text-red-600' // Below asking price
                                    : 'text-gray-600' // Equal to asking price
                                }`}>
                                  {order.offeredPrice > getAskingPriceForOrder(order) ? '+' : ''}
                                  {formatPercent((order.offeredPrice - getAskingPriceForOrder(order)) / getAskingPriceForOrder(order), 1, true)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm space-y-1">
                                  <div className="font-semibold">Order Analysis</div>
                                  <div className="text-xs text-gray-500">
                                    {order.calculationData ? (
                                      <>
                                        <div>Multiple Order Penalty: {formatNumber(order.calculationData.multipleOrderModifier, { decimals: 3, forceDecimals: true })}x</div>
                                        <div>Final Rejection Probability: {formatPercent(order.calculationData.finalRejectionProbability, 1, true)}</div>
                                        <div>Random Value: {formatPercent(order.calculationData.randomValue, 1, true)}</div>
                                      </>
                                    ) : (
                                      <div>Analysis data not available</div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          <div className="flex flex-col">
                            <span>{formatCurrency(order.totalValue, 2)}</span>
                            {order.fulfillableValue !== undefined && order.fulfillableValue !== null && order.fulfillableValue < order.totalValue && (
                              <span className="text-xs text-orange-600">
                                (Can earn: {formatCurrency(order.fulfillableValue, 2)})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {order.fulfillableQuantity !== undefined && order.fulfillableQuantity !== null ? order.fulfillableQuantity : order.requestedQuantity} bottles
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {formatGameDateFromObject(order.orderedAt)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium space-x-2">
                          {order.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleFulfillOrder(order.id)}
                                disabled={isLoading}
                                className="text-green-600 hover:text-green-900 disabled:text-gray-400"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              {order.status === 'fulfilled' ? 'Completed' : 'Declined'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {sortedOrders.length > ordersPageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing {((ordersPage - 1) * ordersPageSize) + 1} to {Math.min(ordersPage * ordersPageSize, sortedOrders.length)} of {sortedOrders.length} orders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={ordersPage <= 1}
                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {ordersPage} of {totalOrdersPages}
                  </span>
                  <button
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={ordersPage >= totalOrdersPages}
                    onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
