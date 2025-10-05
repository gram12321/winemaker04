import React, { useState, useEffect } from 'react';
import { useCustomerData } from '@/hooks';
import { SimpleCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { getCountryCode } from '@/lib/services';
import { Customer } from '@/lib/types/types';
import { formatNumber, formatPercent, getColorClass } from '@/lib/utils/utils';

export function CustomersTab() {
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const { customers, relationshipBreakdowns, computedRelationships, getCustomerKey, loadRelationshipBreakdown } = useCustomerData();
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

  useEffect(() => { setPage(1); }, [countryFilter, sortConfig, customers.length]);
  const pagedCustomers = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page]);

  const handleSort = (key: keyof Customer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatRelationship = (value: number) => {
    const normalizedValue = Math.min(value / 100, 1);
    const colorClass = getColorClass(normalizedValue);
    
    return (
      <span className={colorClass}>
        {formatNumber(value, { decimals: 1, forceDecimals: true })}
      </span>
    );
  };


  const availableCountries = React.useMemo(() => (
    [...new Set(customers.map(customer => customer.country))]
  ), [customers]);
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  return (
    <SimpleCard
      title="Wine Customers Directory"
      description={`Global wine customers and their market relationships. Showing ${pagedCustomers.length} of ${filteredCustomers.length} (Total: ${customers.length})`}
    >
      <div className="space-y-6">
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
      </div>
    </SimpleCard>
  );
}
