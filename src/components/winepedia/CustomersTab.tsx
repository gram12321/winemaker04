import React, { useState, useEffect, useCallback } from 'react';
import { useGameStateWithData, useGameUpdates } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui';
import { getAllCustomers, getCountryCode } from '@/lib/services';
import { Customer } from '@/lib/types/types';
import { loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { formatNumber, formatPercent, getColorClass } from '@/lib/utils/utils';
import { calculateRelationshipBreakdown } from '@/lib/database/prestige/relationshipBreakdownService';

export function CustomersTab() {
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[key: string]: string}>({});
  const [computedRelationships, setComputedRelationships] = useState<{[key: string]: number}>({});
  // Simple pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

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

  // Use consolidated hook for reactive customer loading
  const loadCustomersData = useCallback(async () => {
    return await getAllCustomers();
  }, []);

  const customers = useGameStateWithData(loadCustomersData, []);

  // Remove eager precompute that caused N+1 queries; compute on hover or per-page when needed
  // Refresh relationship breakdown caches on game updates (e.g., after sales)
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setRelationshipBreakdowns({});
      setComputedRelationships({});
    });
    return () => { unsubscribe(); };
  }, [subscribe]);

  // Filter and sort customers (computed value instead of useEffect)
  const filteredCustomers = React.useMemo(() => {
    let filtered = customers;
    
    if (countryFilter) {
      filtered = customers.filter(customer => customer.country === countryFilter);
    }
    
    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
        
        return 0;
      });
    }
    
    return filtered;
  }, [customers, countryFilter, sortConfig]);

  // Reset to first page when filter or list changes
  useEffect(() => { setPage(1); }, [countryFilter, sortConfig, customers.length]);

  // Current page slice (lazy display)
  const pagedCustomers = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page]);

  // Handle sorting
  const handleSort = (key: keyof Customer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Helper function to format relationship display
  const formatRelationship = (value: number) => {
    // Normalize relationship to 0-1 range for color coding
    const normalizedValue = Math.min(value / 100, 1);
    const colorClass = getColorClass(normalizedValue);
    
    return (
      <span className={colorClass}>
        {formatNumber(value, { decimals: 1, forceDecimals: true })}
      </span>
    );
  };

  // Load relationship breakdown for a customer on-demand (memoized)
  const loadRelationshipBreakdown = useCallback(async (customer: Customer) => {
    try {
      const breakdown = await calculateRelationshipBreakdown(customer);
      const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
      const customerKey = getCustomerKey(customer.id);
      
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

  // Get unique countries from customers for filter dropdown
  const availableCountries = React.useMemo(() => (
    [...new Set(customers.map(customer => customer.country))]
  ), [customers]);

  // Get sort indicator
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wine Customers Directory</CardTitle>
        <CardDescription>
          Global wine customers and their market relationships. Showing {pagedCustomers.length} of {filteredCustomers.length} (Total: {customers.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter controls */}
        <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="country-filter" className="text-sm font-medium text-gray-700">
              Filter by Country:
            </label>
            <select
              id="country-filter"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="">All Countries</option>
              {availableCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-2 text-sm">
            <button
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>

        {/* Customers table */}
        {pagedCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('country')}
                  >
                    Country{getSortIndicator('country')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('name')}
                  >
                    Name{getSortIndicator('name')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('customerType')}
                  >
                    Type{getSortIndicator('customerType')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('marketShare')}
                  >
                    Market Share{getSortIndicator('marketShare')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('purchasingPower')}
                  >
                    Purchasing Power{getSortIndicator('purchasingPower')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('wineTradition')}
                  >
                    Wine Tradition{getSortIndicator('wineTradition')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('relationship')}
                  >
                    Relationship{getSortIndicator('relationship')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`fi fi-${getCountryCode(customer.country)} text-lg`}></span>
                        {customer.country}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.customerType}</TableCell>
                    <TableCell>{formatPercent(customer.marketShare, 1, true)}</TableCell>
                    <TableCell>{formatPercent(customer.purchasingPower, 0, true)}</TableCell>
                    <TableCell>{formatPercent(customer.wineTradition, 0, true)}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span 
                              onMouseEnter={() => {
                                const customerKey = getCustomerKey(customer.id);
                                if (!relationshipBreakdowns[customerKey]) {
                                  loadRelationshipBreakdown(customer);
                                }
                              }}
                              className="cursor-help"
                            >
                              {formatRelationship(computedRelationships[getCustomerKey(customer.id)] ?? 0)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <div className="text-sm">
                              <div className="font-semibold mb-2">Customer Relationship Breakdown</div>
                              {relationshipBreakdowns[getCustomerKey(customer.id)] ? (
                                <div className="space-y-1 text-xs">
                                  {relationshipBreakdowns[getCustomerKey(customer.id)].split('\n').map((line, index) => (
                                    <div key={index} className={line.startsWith('•') ? 'ml-2' : line === '' ? 'h-1' : ''}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">
                                  Hover to load detailed breakdown...
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {customers.length === 0 ? 'Loading customers...' : 'No customers match the current filter.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
