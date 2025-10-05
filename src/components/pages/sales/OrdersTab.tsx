import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WineOrder, WineBatch, Customer, CustomerCountry, CustomerType } from '@/lib/types/types';
import { fulfillWineOrder, rejectWineOrder, generateSophisticatedWineOrders, generateCustomer } from '@/lib/services';
import { formatNumber, formatCurrency, formatPercent, formatGameDateFromObject} from '@/lib/utils/utils';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui';
import { getFlagIcon, loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { calculateRelationshipBreakdown } from '@/lib/services/sales/relationshipService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { useGameUpdates } from '@/hooks';
import { NavigationProps, LoadingProps } from '@/lib/types/UItypes';

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

interface OrdersTabProps extends NavigationProps, LoadingProps {
  allOrders: WineOrder[];
  allBatches: WineBatch[];
  bottledWines: WineBatch[];
  withLoading: (fn: () => Promise<void>) => Promise<void>;
}

const OrdersTab: React.FC<OrdersTabProps> = ({
  allOrders,
  allBatches,
  bottledWines,
  isLoading,
  withLoading,
  onNavigateToWinepedia
}) => {
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('all');
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

  // Memoize filtered orders to prevent unnecessary recalculations
  const orders = useMemo(() => 
    orderStatusFilter === 'all' 
      ? allOrders 
      : allOrders.filter(order => order.status === orderStatusFilter),
    [allOrders, orderStatusFilter]
  );

  // Always-available list of pending orders for bulk actions
  const pendingOrders = useMemo(() => 
    allOrders.filter(order => order.status === 'pending'),
    [allOrders]
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

  // Use sorting hooks
  const {
    sortedData: sortedOrders,
    handleSort: handleOrderSort,
    getSortIndicator: getOrderSortIndicator,
    isColumnSorted: isOrderColumnSorted
  } = useTableSortWithAccessors(orders, orderColumns);

  // Helper to fetch current inventory for an order's batch
  const getInventoryForOrder = useCallback((order: WineOrder): number => {
    const batch = allBatches.find(b => b.id === order.wineBatchId);
    return batch ? batch.quantity : 0;
  }, [allBatches]);

  // Paginate sorted orders
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return sortedOrders.slice(start, start + ordersPageSize);
  }, [sortedOrders, ordersPage, ordersPageSize]);

  // Reset to first page when filter changes
  useEffect(() => {
    setOrdersPage(1);
  }, [orderStatusFilter]);

  const totalOrdersPages = Math.max(1, Math.ceil(sortedOrders.length / ordersPageSize));

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
  const loadRelationshipBreakdown = useCallback(async (customerId: string, customer: Customer) => {
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
    <div className="space-y-3">
      {/* Order Status Filter */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Order Filter</h3>
            <p className="text-gray-500 text-xs">Filter orders by status</p>
          </div>
          <div className="flex space-x-2 text-xs">
            {(['all', 'pending', 'fulfilled', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setOrderStatusFilter(status)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  orderStatusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className="ml-1 text-[10px]">
                    ({allOrders.filter(o => o.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Acquisition Chance Display */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Customer Acquisition</h3>
            <p className="text-gray-500 text-xs">Current chance to attract new customers</p>
          </div>
          <div className="flex items-center space-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 cursor-help">
                    <div className="text-xs text-blue-700">
                      <span className="font-medium">Customer Chance:</span>
                      <span className="ml-2 text-sm font-bold text-blue-800">
                        {orderChanceInfo ? formatPercent(orderChanceInfo.finalChance, 1, true) : '--'}
                      </span>
                    </div>
                    <div className="text-blue-500">ℹ️</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {orderChanceInfo ? (
                    <div className="space-y-2 text-xs">
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
                            <div className="text-[10px] text-gray-400">Click "Generate Order" to see roll result</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs">
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
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Order Management</h3>
            <p className="text-gray-500 text-xs">Generate test orders or manage pending orders</p>
          </div>
          <div className="flex space-x-2">
            {pendingOrders.length > 0 && (
              <>
                <button
                  onClick={handleAcceptAll}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-2.5 py-1.5 rounded hover:bg-green-700 disabled:bg-gray-400 text-xs"
                >
                  Accept All ({pendingOrders.length})
                </button>
                <button
                  onClick={handleRejectAll}
                  disabled={isLoading}
                  className="bg-red-600 text-white px-2.5 py-1.5 rounded hover:bg-red-700 disabled:bg-gray-400 text-xs"
                >
                  Reject All
                </button>
              </>
            )}
            <button
              onClick={handleGenerateOrder}
              disabled={isLoading || bottledWines.length === 0}
              className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs"
            >
              {isLoading ? 'Generating...' : 'Generate Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-xs">
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
                  <TableCell colSpan={14} className="text-center text-gray-500 py-6">
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
                                className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted flex items-center space-x-1.5 text-left"
                                title="Click to view customer details in Winepedia"
                              >
                                <span className={getFlagIcon(order.customerCountry || '')}></span>
                                <span>{order.customerName || 'Unknown Customer'}</span>
                              </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2 text-xs">
                              {order.calculationData ? (
                                <>
                                  <div className="font-semibold">Price Multiplier Calculation</div>
                                  <div className="space-y-1 text-[10px]">
                                    <div>Formula: {formatNumber(order.calculationData.estimatedBaseMultiplier, { decimals: 3, forceDecimals: true })} (B) × {formatNumber(order.calculationData.purchasingPowerMultiplier, { decimals: 3, forceDecimals: true })} (PP) × {formatNumber(order.calculationData.wineTraditionMultiplier, { decimals: 3, forceDecimals: true })} (WT) × {formatNumber(order.calculationData.marketShareMultiplier, { decimals: 3, forceDecimals: true })} (MS) = {formatNumber(order.calculationData.finalPriceMultiplier, { decimals: 3, forceDecimals: true })}x (Mtp)</div>
                                  </div>
                                  <div className="font-semibold">Quantity Calculation</div>
                                  <div className="space-y-1 text-[10px]">
                                    <div>{order.calculationData.baseQuantity} (B) × {formatNumber(order.calculationData.priceSensitivity, { decimals: 3, forceDecimals: true })} (SENS) × {formatNumber(order.calculationData.purchasingPowerMultiplier, { decimals: 3, forceDecimals: true })} (PP) × {formatNumber(order.calculationData.wineTraditionMultiplier, { decimals: 3, forceDecimals: true })} (WT) × {formatNumber(order.calculationData.quantityMarketShareMultiplier, { decimals: 3, forceDecimals: true })} (MS) = {order.calculationData.finalQuantity} bottles</div>
                                  </div>
                                  <div className="text-xs text-gray-500 pt-2 border-top border-gray-600">
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
                              className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full cursor-help ${
                                (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 80 ? 'bg-green-100 text-green-800' :
                                (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                (computedRelationships[getCustomerKey(order.customerId)] ?? 0) >= 40 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {formatPercent((computedRelationships[getCustomerKey(order.customerId)] ?? 0) / 100, 0, true)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs">
                              <div className="font-semibold mb-2">Customer Relationship Breakdown</div>
                              {relationshipBreakdowns[getCustomerKey(order.customerId)] ? (
                                <div className="space-y-1 text-[10px]">
                                  {relationshipBreakdowns[getCustomerKey(order.customerId)].split('\n').map((line, index) => (
                                    <div key={index} className={line.startsWith('•') ? 'ml-2' : line === '' ? 'h-1' : ''}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[10px] text-gray-500">
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
                            <span className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800 cursor-help">
                              {order.customerType}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div className="font-semibold">Type Range</div>
                              <div className="text-[10px] text-gray-500">
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
                          <span className="text-[10px] text-orange-600">
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
                            <div className="text-xs space-y-1">
                              <div className="font-semibold">Order Analysis</div>
                              <div className="text-[10px] text-gray-500">
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
                          <span className="text-[10px] text-orange-600">
                            (Can earn: {formatCurrency(order.fulfillableValue, 2)})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {order.fulfillableQuantity !== undefined && order.fulfillableQuantity !== null ? order.fulfillableQuantity : order.requestedQuantity} bottles
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatGameDateFromObject(order.orderedAt)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium space-x-2">
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
                        <span className="text-gray-400 text-[10px]">
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
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 text-xs">
            <div className="text-gray-500">
              Showing {((ordersPage - 1) * ordersPageSize) + 1} to {Math.min(ordersPage * ordersPageSize, sortedOrders.length)} of {sortedOrders.length} orders
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-2.5 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={ordersPage <= 1}
                onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {ordersPage} of {totalOrdersPages}
              </span>
              <button
                className="px-2.5 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={ordersPage >= totalOrdersPages}
                onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders Cards - Mobile */}
      <div className="lg:hidden space-y-4">
        {paginatedOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            {orderStatusFilter === 'all' ? 'No orders found' : `No ${orderStatusFilter} orders`}
          </div>
        ) : (
          <>
            {paginatedOrders.map((order) => {
              const askingPrice = getAskingPriceForOrder(order);
              const inventory = getInventoryForOrder(order);
              const customerKey = getCustomerKey(order.customerId);
              
              return (
                <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 border-b">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={getFlagIcon(order.customerCountry || '')}></span>
                          <h3 className="text-base font-bold text-gray-900">{order.customerName}</h3>
                        </div>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {order.customerType}
                        </span>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="text-sm font-medium text-gray-900 mt-2">{order.wineName}</div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Relationship</div>
                        <span 
                          onTouchStart={() => {
                            if (!relationshipBreakdowns[customerKey]) {
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
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (computedRelationships[customerKey] ?? 0) >= 80 ? 'bg-green-100 text-green-800' :
                            (computedRelationships[customerKey] ?? 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            (computedRelationships[customerKey] ?? 0) >= 40 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {formatPercent((computedRelationships[customerKey] ?? 0) / 100, 0, true)}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Quantity</div>
                        <div className="text-sm font-bold text-gray-900">{order.requestedQuantity} bottles</div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Inventory:</span>
                        <span className="font-medium">{inventory} bottles</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Asking Price:</span>
                        <span className="font-medium">{formatCurrency(askingPrice, 2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Bid Price:</span>
                        <span className={`font-medium ${
                          order.offeredPrice > askingPrice
                            ? 'text-green-600'
                            : order.offeredPrice < askingPrice
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {formatCurrency(order.offeredPrice, 2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Premium/Discount:</span>
                        <span className={`font-medium ${
                          order.offeredPrice > askingPrice ? 'text-green-600' : 
                          order.offeredPrice < askingPrice ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {order.offeredPrice > askingPrice ? '+' : ''}
                          {formatPercent((order.offeredPrice - askingPrice) / askingPrice, 1, true)}
                        </span>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center mt-2">
                        <div className="text-xs text-gray-600 mb-1">Total Value</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(order.totalValue, 2)}
                        </div>
                        {order.fulfillableValue !== undefined && order.fulfillableValue !== null && order.fulfillableValue < order.totalValue && (
                          <div className="text-xs text-orange-600 mt-1">
                            Can earn: {formatCurrency(order.fulfillableValue, 2)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-3 text-xs text-gray-500">
                      <div className="flex justify-between mb-1">
                        <span>Ordered:</span>
                        <span>{formatGameDateFromObject(order.orderedAt)}</span>
                      </div>
                      {order.fulfillableQuantity !== undefined && order.fulfillableQuantity !== null && order.fulfillableQuantity < order.requestedQuantity && (
                        <div className="text-orange-600">
                          Can fulfill: {order.fulfillableQuantity} bottles
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer - Actions */}
                  {order.status === 'pending' && (
                    <div className="bg-gray-50 px-4 py-3 border-t flex gap-2">
                      <button
                        onClick={() => handleFulfillOrder(order.id)}
                        disabled={isLoading}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.id)}
                        disabled={isLoading}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Mobile Pagination */}
            {sortedOrders.length > ordersPageSize && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500 mb-3 text-center">
                  Showing {((ordersPage - 1) * ordersPageSize) + 1} to {Math.min(ordersPage * ordersPageSize, sortedOrders.length)} of {sortedOrders.length} orders
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={ordersPage <= 1}
                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <div className="flex items-center px-3 text-sm">
                    {ordersPage} / {totalOrdersPages}
                  </div>
                  <button
                    className="flex-1 px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={ordersPage >= totalOrdersPages}
                    onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersTab;
