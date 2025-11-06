import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WineOrder, WineBatch, Customer, CustomerCountry, CustomerType } from '@/lib/types/types';
import { fulfillWineOrder, rejectWineOrder, generateCustomer } from '@/lib/services';
import { formatNumber, formatPercent, formatGameDateFromObject, getBadgeColorClasses} from '@/lib/utils/utils';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, UnifiedTooltip } from '../../ui';
import { getFlagIcon, loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { calculateRelationshipBreakdown, clearRelationshipBreakdownCache } from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { useGameUpdates } from '@/hooks';
import { NavigationProps, LoadingProps } from '@/lib/types/UItypes';
import { getCurrentCompany } from '@/lib/services';
import { calculateEstimatedPrice } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { SALES_CONSTANTS } from '@/lib/constants';

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
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('pending');
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
  const [relationshipBoosts, setRelationshipBoosts] = useState<{[key: string]: number}>({});
  const [boostDetails, setBoostDetails] = useState<{[key: string]: Array<{
    description: string;
    amount: number;
    weeksAgo: number;
    decayedAmount: number;
  }>}>({});
  const [isLoadingRelationships, setIsLoadingRelationships] = useState<boolean>(false);
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

  // Helper function to get relationship badge colors based on value (0-100 scale)
  const getRelationshipBadgeColors = (value: number): string => {
    const normalizedValue = value / 100; // Convert to 0-1 scale
    const { text, bg } = getBadgeColorClasses(normalizedValue);
    return `${text} ${bg}`;
  };

  // Helper function to format customer type quantity range for display
  const getCustomerTypeRange = (customerType: CustomerType): string => {
    const config = SALES_CONSTANTS.CUSTOMER_TYPES[customerType];
    if (!config) return '';
    const [min, max] = config.quantityRange;
    const minCases = (min / 6).toFixed(1);
    const maxCases = (max / 6).toFixed(0);
    return `${min}-${max} bottles (${minCases}-${maxCases} cases)`;
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
    if (!wineBatch) return 0;
    const computed = calculateEstimatedPrice(wineBatch as any, undefined as any);
    return wineBatch.askingPrice ?? computed;
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
      key: 'inventoryQuantity' as keyof WineOrder,
      label: 'Inventory',
      sortable: true,
      accessor: (order) => {
        const batch = allBatches.find(b => b.id === order.wineBatchId);
        return batch ? batch.quantity : 0;
      }
    },
    { 
      key: 'askingPrice' as keyof WineOrder, 
      label: 'Asking Price', 
      sortable: true,
      accessor: (order) => getAskingPriceForOrder(order)
    },
    { key: 'offeredPrice', label: 'Bid Price', sortable: true },
    { 
      key: 'premiumDiscount' as keyof WineOrder, 
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
      // Guard: only compute chance when a company is active
      const company = getCurrentCompany();
      if (!company) {
        return;
      }
      const { chanceInfo } = await generateCustomer({ dryRun: true }); // dry run for display
      setOrderChanceInfo(chanceInfo);
    } catch (error) {
      console.error('Error loading customer acquisition chance:', error);
    }
  };

  // Pre-load all relationship breakdowns for orders on component mount
  const loadAllRelationshipBreakdowns = useCallback(async () => {
    if (isLoadingRelationships || allOrders.length === 0) return;
    
    // Check if we already have relationships loaded for all orders
    const hasAllRelationships = allOrders.every(order => 
      computedRelationships[getCustomerKey(order.customerId)] !== undefined
    );
    if (hasAllRelationships) return;
    
    setIsLoadingRelationships(true);
    try {
      // Get unique customers from orders
      const uniqueCustomers = new Map<string, Customer>();
      allOrders.forEach(order => {
        if (order.customerId && !uniqueCustomers.has(order.customerId)) {
          uniqueCustomers.set(order.customerId, createCustomerFromOrderData(
            order.customerId,
            order.customerName,
            order.customerCountry,
            order.customerType,
            order.customerRelationship
          ));
        }
      });

      const customers = Array.from(uniqueCustomers.values());
      if (customers.length === 0) {
        setIsLoadingRelationships(false);
        return;
      }

      // Calculate relationship breakdowns for each customer (with caching)
      const formattedBreakdowns: {[key: string]: string} = {};
      const computedRels: {[key: string]: number} = {};
      const boosts: {[key: string]: number} = {};
      const details: {[key: string]: Array<{
        description: string;
        amount: number;
        weeksAgo: number;
        decayedAmount: number;
      }>} = {};
      
      for (const customer of customers) {
        const customerKey = getCustomerKey(customer.id);
        const breakdown = await calculateRelationshipBreakdown(customer);
        const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
        
        formattedBreakdowns[customerKey] = formattedBreakdown;
        computedRels[customerKey] = breakdown.totalRelationship;
        boosts[customerKey] = breakdown.relationshipBoosts;
        details[customerKey] = breakdown.factors.boostDetails;
      }
      
      setRelationshipBreakdowns(formattedBreakdowns);
      setComputedRelationships(computedRels);
      setRelationshipBoosts(boosts);
      setBoostDetails(details);
    } catch (error) {
      console.error('Error loading relationship breakdowns:', error);
    } finally {
      setIsLoadingRelationships(false);
    }
  }, [allOrders, getCustomerKey]);

  // Load customer chance info and relationship breakdowns on component mount
  useEffect(() => {
    loadCustomerChance();
    if (allOrders.length > 0) {
      loadAllRelationshipBreakdowns();
    }
  }, [allOrders.length]); // Only depend on allOrders.length, not the function

  // Refresh relationship breakdown caches when game updates (e.g., order fulfilled)
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      clearRelationshipBreakdownCache();
      setRelationshipBreakdowns({});
      setComputedRelationships({});
      setRelationshipBoosts({});
      setBoostDetails({});
      // Only reload if we have orders and not currently loading
      if (allOrders.length > 0 && !isLoadingRelationships) {
        loadAllRelationshipBreakdowns();
      }
    });
    return () => { unsubscribe(); };
  }, [subscribe, allOrders.length, isLoadingRelationships]);

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
            <UnifiedTooltip
              content={
                orderChanceInfo ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold">Customer Acquisition Details</div>
                    <div className="text-[10px] text-gray-400 mb-2">This chance is automatically evaluated every game tick</div>
                    <div className="space-y-1">
                      <div>Company Prestige: <span className="font-medium">{formatNumber(orderChanceInfo.companyPrestige, { decimals: 1, forceDecimals: true })}</span></div>
                      <div>Available Wines: <span className="font-medium">{orderChanceInfo.availableWines}</span></div>
                      <div>Pending Orders: <span className="font-medium">{orderChanceInfo.pendingOrders}</span></div>
                      <div>Base Chance: <span className="font-medium">{formatPercent(orderChanceInfo.baseChance, 1, true)}</span></div>
                      <div>Pending Penalty: <span className="font-medium">{formatNumber(orderChanceInfo.pendingPenalty, { decimals: 2, forceDecimals: true })}x</span></div>
                      <div className="border-t pt-1">
                        <div>Final Chance: <span className="font-bold text-blue-300">{formatPercent(orderChanceInfo.finalChance, 1, true)}</span></div>
                        <div className="text-[10px] text-gray-400 mt-1">Updated each game tick</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs">
                    <div className="font-semibold">Customer Acquisition</div>
                    <div>Loading customer acquisition chance...</div>
                  </div>
                )
              }
              className="max-w-xs"
              variant="default"
            >
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 cursor-help">
                <div className="text-xs text-blue-700">
                  <span className="font-medium">Customer Chance:</span>
                  <span className="ml-2 text-sm font-bold text-blue-800">
                    {orderChanceInfo ? formatPercent(orderChanceInfo.finalChance, 1, true) : '--'}
                  </span>
                </div>
                <div className="text-blue-500">ℹ️</div>
              </div>
            </UnifiedTooltip>
          </div>
        </div>
      </div>

      {/* Order Management */}
      {pendingOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Order Management</h3>
              <p className="text-gray-500 text-xs">Manage pending orders</p>
            </div>
            <div className="flex space-x-2">
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
            </div>
          </div>
        </div>
      )}

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
                  onSort={() => handleOrderSort('inventoryQuantity' as keyof WineOrder)}
                  sortIndicator={getOrderSortIndicator('inventoryQuantity' as keyof WineOrder)}
                  isSorted={isOrderColumnSorted('inventoryQuantity' as keyof WineOrder)}
                >
                  Inventory
                </TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleOrderSort('askingPrice' as keyof WineOrder)}
                  sortIndicator={getOrderSortIndicator('askingPrice' as keyof WineOrder)}
                  isSorted={isOrderColumnSorted('askingPrice' as keyof WineOrder)}
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
                  onSort={() => handleOrderSort('premiumDiscount' as keyof WineOrder)}
                  sortIndicator={getOrderSortIndicator('premiumDiscount' as keyof WineOrder)}
                  isSorted={isOrderColumnSorted('premiumDiscount' as keyof WineOrder)}
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
                      <UnifiedTooltip
                        content={
                          <div className="text-xs">
                            <div className="font-semibold">Customer Information</div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              Click to view detailed customer information in Winepedia
                            </div>
                          </div>
                        }
                        variant="default"
                      >
                        <button 
                          onClick={() => onNavigateToWinepedia?.()}
                          className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted flex items-center space-x-1.5 text-left"
                          title="Click to view customer details in Winepedia"
                        >
                          <span className={`${getFlagIcon(order.customerCountry || '')} text-lg`}></span>
                          <span>{order.customerName || 'Unknown Customer'}</span>
                        </button>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      <UnifiedTooltip
                        content={
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
                                {isLoadingRelationships ? 'Loading relationship breakdown...' : 'Relationship data not available'}
                              </div>
                            )}
                          </div>
                        }
                        className="max-w-xs"
                        variant="default"
                      >
                        <div className="flex flex-col gap-1">
                          <span 
                            className={`inline-flex w-fit px-2 py-1 text-[10px] font-semibold rounded-full cursor-help ${
                              getRelationshipBadgeColors(computedRelationships[getCustomerKey(order.customerId)] ?? 0)
                            }`}>
                            {isLoadingRelationships ? (
                              <span className="text-xs text-gray-500">Loading...</span>
                            ) : (
                              formatPercent((computedRelationships[getCustomerKey(order.customerId)] ?? 0) / 100, 0, true)
                            )}
                          </span>
                          {relationshipBoosts[getCustomerKey(order.customerId)] !== undefined && 
                           relationshipBoosts[getCustomerKey(order.customerId)] > 0 && (
                            <UnifiedTooltip
                              content={
                                <div className="text-xs">
                                  <div className="font-semibold mb-2">Relationship Boost Details</div>
                                  {boostDetails[getCustomerKey(order.customerId)] && boostDetails[getCustomerKey(order.customerId)].length > 0 ? (
                                    <div className="space-y-1 text-[10px]">
                                      {boostDetails[getCustomerKey(order.customerId)].slice(0, 5).map((boost, index) => (
                                        <div key={index}>
                                          • {boost.description} ({formatNumber(boost.weeksAgo, { decimals: 1, forceDecimals: true })}w ago): +{formatNumber(boost.decayedAmount, { decimals: 3, forceDecimals: true })}%
                                        </div>
                                      ))}
                                      {boostDetails[getCustomerKey(order.customerId)].length > 5 && (
                                        <div className="text-[9px] opacity-70">
                                          ... and {boostDetails[getCustomerKey(order.customerId)].length - 5} more
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] opacity-70">
                                      No boost events found
                                    </div>
                                  )}
                                </div>
                              }
                              className="max-w-xs"
                              variant="default"
                            >
                              <span className="inline-flex w-fit px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-100 text-purple-800 cursor-help">
                                Boost: {formatPercent((relationshipBoosts[getCustomerKey(order.customerId)] ?? 0) / 100, 1, true)}
                              </span>
                            </UnifiedTooltip>
                          )}
                        </div>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell>
                      <UnifiedTooltip
                        content={
                          <div className="text-xs">
                            <div className="font-semibold">Type Range</div>
                            <div className="text-[10px] text-gray-500">
                              {getCustomerTypeRange(order.customerType)}
                            </div>
                          </div>
                        }
                        variant="default"
                      >
                        <span className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800 cursor-help">
                          {order.customerType}
                        </span>
                      </UnifiedTooltip>
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
                      {formatNumber(getAskingPriceForOrder(order), { currency: true, decimals: 2 })}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      <UnifiedTooltip
                        content={
                          <div className="space-y-2 text-xs">
                            {order.calculationData ? (
                              <>
                                <div className="font-semibold">Bid Price Calculation</div>
                                <div className="space-y-1 text-[10px]">
                                  <div>Asking Price: <span className="font-medium">{formatNumber(getAskingPriceForOrder(order), { currency: true, decimals: 2 })}</span></div>
                                  <div>Customer Multiplier: <span className="font-medium">{formatNumber(order.calculationData.finalPriceMultiplier, { decimals: 3, forceDecimals: true })}x</span></div>
                                  {order.calculationData.featurePriceMultiplier !== undefined && order.calculationData.featurePriceMultiplier < 1.0 && (
                                    <div className="text-red-600">
                                      Feature Penalty: <span className="font-medium">{formatNumber(order.calculationData.featurePriceMultiplier, { decimals: 3, forceDecimals: true })}x</span>
                                      <div className="text-[10px] mt-1">Wine features reduce customer bid price</div>
                                    </div>
                                  )}
                                  <div className="border-t pt-1 mt-1">
                                    <div className="text-[10px] text-gray-500 mb-1">Formula: Asking × Customer × Features</div>
                                    <div>Final Bid: <span className="font-bold">{formatNumber(order.offeredPrice, { currency: true, decimals: 2 })}</span></div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-500">Calculation data not available</div>
                            )}
                          </div>
                        }
                        className="max-w-xs"
                        variant="default"
                      >
                        <span className={`cursor-help ${
                          order.offeredPrice > getAskingPriceForOrder(order)
                            ? 'text-green-600 font-medium' // Above asking price
                            : order.offeredPrice < getAskingPriceForOrder(order)
                            ? 'text-red-600 font-medium' // Below asking price
                            : 'text-gray-900' // Equal to asking price
                        }`}>
                          {formatNumber(order.offeredPrice, { currency: true, decimals: 2 })}
                        </span>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      <UnifiedTooltip
                        content={
                          <div className="text-xs space-y-1">
                            <div className="font-semibold">Price Difference Analysis</div>
                            <div className="text-[10px] space-y-1">
                              <div>Asking Price: <span className="font-medium">{formatNumber(getAskingPriceForOrder(order), { currency: true, decimals: 2 })}</span></div>
                              <div>Bid Price: <span className="font-medium">{formatNumber(order.offeredPrice, { currency: true, decimals: 2 })}</span></div>
                              <div className="border-t pt-1">
                                <div className="font-medium">
                                  {order.offeredPrice > getAskingPriceForOrder(order) ? (
                                    <span className="text-green-600">Customer is paying premium</span>
                                  ) : order.offeredPrice < getAskingPriceForOrder(order) ? (
                                    <span className="text-red-600">Customer wants discount</span>
                                  ) : (
                                    <span className="text-gray-600">Customer accepts asking price</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                        variant="default"
                      >
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
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      <div className="flex flex-col">
                        <span>{formatNumber(order.totalValue, { currency: true, decimals: 2 })}</span>
                        {order.fulfillableValue !== undefined && order.fulfillableValue !== null && order.fulfillableValue < order.totalValue && (
                          <span className="text-[10px] text-orange-600">
                            (Can earn: {formatNumber(order.fulfillableValue, { currency: true, decimals: 2 })})
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
                          <span className={`${getFlagIcon(order.customerCountry || '')} text-lg`}></span>
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
                        <div className="flex flex-col gap-1">
                          <span 
                            className={`inline-flex w-fit px-2 py-1 text-xs font-semibold rounded-full ${
                              getRelationshipBadgeColors(computedRelationships[customerKey] ?? 0)
                            }`}>
                            {isLoadingRelationships ? (
                              <span className="text-xs text-gray-500">Loading...</span>
                            ) : (
                              formatPercent((computedRelationships[customerKey] ?? 0) / 100, 0, true)
                            )}
                          </span>
                          {relationshipBoosts[customerKey] !== undefined && relationshipBoosts[customerKey] > 0 && (
                            <UnifiedTooltip
                              content={
                                <div className="text-xs">
                                  <div className="font-semibold mb-2">Relationship Boost Details</div>
                                  {boostDetails[customerKey] && boostDetails[customerKey].length > 0 ? (
                                    <div className="space-y-1 text-[10px]">
                                      {boostDetails[customerKey].slice(0, 5).map((boost, index) => (
                                        <div key={index}>
                                          • {boost.description} ({formatNumber(boost.weeksAgo, { decimals: 1, forceDecimals: true })}w ago): +{formatNumber(boost.decayedAmount, { decimals: 3, forceDecimals: true })}%
                                        </div>
                                      ))}
                                      {boostDetails[customerKey].length > 5 && (
                                        <div className="text-[9px] opacity-70">
                                          ... and {boostDetails[customerKey].length - 5} more
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] opacity-70">
                                      No boost events found
                                    </div>
                                  )}
                                </div>
                              }
                              className="max-w-xs"
                              variant="default"
                            >
                              <span className="inline-flex w-fit px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-800 cursor-help">
                                Boost: {formatPercent((relationshipBoosts[customerKey] ?? 0) / 100, 1, true)}
                              </span>
                            </UnifiedTooltip>
                          )}
                        </div>
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
                        <span className="font-medium">{formatNumber(askingPrice, { currency: true, decimals: 2 })}</span>
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
                          {formatNumber(order.offeredPrice, { currency: true, decimals: 2 })}
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
                          {formatNumber(order.totalValue, { currency: true, decimals: 2 })}
                        </div>
                        {order.fulfillableValue !== undefined && order.fulfillableValue !== null && order.fulfillableValue < order.totalValue && (
                          <div className="text-xs text-orange-600 mt-1">
                            Can earn: {formatNumber(order.fulfillableValue, { currency: true, decimals: 2 })}
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
