import React, { useState, useEffect } from 'react';
import { useCustomerData } from '@/hooks';
import { SimpleCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import { getFlagIcon } from '@/lib/utils';
import { Customer } from '@/lib/types/types';
import { formatNumber, formatPercent, getColorClass } from '@/lib/utils/utils';

export function CustomersTab() {
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);
  const [page, setPage] = useState<number>(1);
  const [showAllCustomers, setShowAllCustomers] = useState<boolean>(false);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState<boolean>(false);
  const pageSize = 25;

  const { 
    customers, 
    activeCustomers, 
    allCustomers,
    relationshipBreakdowns, 
    computedRelationships,
    relationshipBoosts,
    boostDetails,
    getCustomerKey, 
    loadRelationshipBreakdown,
    loadAllCustomersWithRelationships,
    isLoadingAllCustomers
  } = useCustomerData(false); // Load all customers on mount

  // Determine which customers to show based on toggle (default to active only)
  const displayCustomers = showAllCustomers ? allCustomers : activeCustomers;

  const filteredCustomers = React.useMemo(() => {
    let filtered = displayCustomers;
    
    if (countryFilter) {
      filtered = displayCustomers.filter(customer => customer.country === countryFilter);
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
  }, [displayCustomers, countryFilter, sortConfig]);

  useEffect(() => { setPage(1); }, [countryFilter, sortConfig, displayCustomers.length]);
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

  const formatRelationship = (value: number, isCached: boolean = false) => {
    const normalizedValue = Math.min(value / 100, 1);
    const colorClass = getColorClass(normalizedValue);
    
    return (
      <span className={`${colorClass} ${isCached ? 'opacity-100' : 'opacity-75'}`}>
        {formatNumber(value, { decimals: 1, forceDecimals: true })}
        {isCached && <span className="ml-1 text-xs">✓</span>}
      </span>
    );
  };


  const availableCountries = React.useMemo(() => (
    [...new Set(displayCustomers.map(customer => customer.country))]
  ), [displayCustomers]);
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  // Handle toggle between active and all customers
  const handleToggleCustomers = async () => {
    if (!showAllCustomers && allCustomers.length > 0) {
      // Switching to all customers - load their relationships
      setIsLoadingRelationships(true);
      try {
        await loadAllCustomersWithRelationships();
      } finally {
        setIsLoadingRelationships(false);
      }
    }
    setShowAllCustomers(!showAllCustomers);
  };

  return (
    <SimpleCard
      title="Wine Customers Directory"
      description={`${showAllCustomers ? 'All' : 'Active'} wine customers and their market relationships. Showing ${pagedCustomers.length} of ${filteredCustomers.length} (Active: ${activeCustomers.length}, Total: ${allCustomers.length})`}
    >
      <div className="space-y-6">
        {/* Filter controls */}
        <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex w-full flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="country-filter" className="text-sm font-medium text-gray-700">
                Filter by Country:
              </label>
              <select
                id="country-filter"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="min-h-11 max-w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="">All Countries</option>
                {availableCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
            
            {/* Customer type toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleCustomers}
                disabled={isLoadingAllCustomers || isLoadingRelationships}
                className={`min-h-11 px-3 py-2 text-sm rounded transition-colors ${
                  showAllCustomers 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${(isLoadingAllCustomers || isLoadingRelationships) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {(isLoadingAllCustomers || isLoadingRelationships) 
                  ? 'Loading...' 
                  : showAllCustomers 
                    ? 'Show Active Only' 
                    : 'Show All Customers'}
              </button>
            </div>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-2 text-sm">
            <button
              className="min-h-11 min-w-11 px-2 py-1 border rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              className="min-h-11 min-w-11 px-2 py-1 border rounded disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="md:hidden">
          <label htmlFor="customer-sort" className="text-sm font-medium">Sort customers</label>
          <select id="customer-sort" className="min-h-11 w-full rounded border px-3" value={sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : ''} onChange={(event) => {
            const [key, direction] = event.target.value.split(':');
            setSortConfig(key ? { key: key as keyof Customer, direction: direction as 'asc' | 'desc' } : null);
          }}>
            <option value="">Default order</option>
            {([
              ['country', 'Country'], ['name', 'Name'], ['customerType', 'Type'], ['marketShare', 'Market Share'], ['purchasingPower', 'Purchasing Power'], ['wineTradition', 'Wine Tradition'], ['relationship', 'Relationship'],
            ] as const).map(([key, label]) => <optgroup key={key} label={label}><option value={`${key}:asc`}>{label}: ascending</option><option value={`${key}:desc`}>{label}: descending</option></optgroup>)}
          </select>
        </div>
        {/* Customers table */}
        {pagedCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="block md:table [&_tbody]:block md:[&_tbody]:table-row-group [&_tbody_tr]:mb-3 [&_tbody_tr]:block [&_tbody_tr]:rounded-lg [&_tbody_tr]:border md:[&_tbody_tr]:table-row md:[&_tbody_tr]:border-x-0 [&_td]:grid [&_td]:gap-1 [&_td]:px-3 [&_td]:py-2 md:[&_td]:table-cell">
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('country')}>{'Country'}{getSortIndicator('country')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('name')}>{'Name'}{getSortIndicator('name')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('customerType')}>{'Type'}{getSortIndicator('customerType')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('marketShare')}>{'Market Share'}{getSortIndicator('marketShare')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('purchasingPower')}>{'Purchasing Power'}{getSortIndicator('purchasingPower')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('wineTradition')}>{'Wine Tradition'}{getSortIndicator('wineTradition')}</button></TableHead>
                  <TableHead><button type="button" className="min-h-11 text-left hover:bg-gray-50" onClick={() => handleSort('relationship')}>{'Relationship'}{getSortIndicator('relationship')}</button></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50">
                    <TableCell data-label="Country"><span className="font-medium text-muted-foreground md:hidden">Country</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${getFlagIcon(customer.country)} text-lg`}></span>
                        {customer.country}
                      </div>
                    </TableCell>
                    <TableCell data-label="Name" className="font-medium"><span className="font-medium text-muted-foreground md:hidden">Name</span>{customer.name}</TableCell>
                    <TableCell data-label="Type"><span className="font-medium text-muted-foreground md:hidden">Type</span>{customer.customerType}</TableCell>
                    <TableCell data-label="Market Share"><span className="font-medium text-muted-foreground md:hidden">Market Share</span>{formatPercent(customer.marketShare, 1, true)}</TableCell>
                    <TableCell data-label="Purchasing Power"><span className="font-medium text-muted-foreground md:hidden">Purchasing Power</span>{formatPercent(customer.purchasingPower, 0, true)}</TableCell>
                    <TableCell data-label="Wine Tradition"><span className="font-medium text-muted-foreground md:hidden">Wine Tradition</span>{formatPercent(customer.wineTradition, 0, true)}</TableCell>
                    <TableCell data-label="Relationship"><span className="font-medium text-muted-foreground md:hidden">Relationship</span>
                      <div className="flex flex-col gap-1">
                      <UnifiedTooltip
                        content={
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
                                {computedRelationships[getCustomerKey(customer.id)] ?
                                  'Click to load detailed breakdown...' :
                                  'Loading relationship data...'
                                }
                              </div>
                            )}
                          </div>
                        }
                        title="Customer Relationship Breakdown"
                        side="top"
                        sideOffset={8}
                        className="max-w-md"
                        variant="panel"
                        density="compact"
                        onClick={() => {
                          const customerKey = getCustomerKey(customer.id);
                          if (!relationshipBreakdowns[customerKey]) {
                            loadRelationshipBreakdown(customer);
                          }
                        }}
                      >
                          <span
                            className="cursor-help"
                          >
                            {formatRelationship(
                              computedRelationships[getCustomerKey(customer.id)] ?? 0,
                              !!relationshipBreakdowns[getCustomerKey(customer.id)]
                            )}
                          </span>
                      </UnifiedTooltip>
                          {relationshipBoosts[getCustomerKey(customer.id)] !== undefined &&
                           relationshipBoosts[getCustomerKey(customer.id)] > 0 && (
                            <UnifiedTooltip
                              content={
                                <div className="text-xs">
                                  <div className="font-semibold mb-2">Relationship Boost Details</div>
                                  {boostDetails[getCustomerKey(customer.id)] && boostDetails[getCustomerKey(customer.id)].length > 0 ? (
                                    <div className="space-y-1 text-[10px]">
                                      {boostDetails[getCustomerKey(customer.id)].slice(0, 5).map((boost, index) => (
                                        <div key={index}>
                                          • {boost.description} ({formatNumber(boost.weeksAgo, { decimals: 1, forceDecimals: true })}w ago): +{formatNumber(boost.decayedAmount, { decimals: 3, forceDecimals: true })}%
                                        </div>
                                      ))}
                                      {boostDetails[getCustomerKey(customer.id)].length > 5 && (
                                        <div className="text-[9px] opacity-70">
                                          ... and {boostDetails[getCustomerKey(customer.id)].length - 5} more
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
                              title="Relationship Boost Details"
                              side="top"
                              sideOffset={4}
                              className="max-w-xs"
                              variant="panel"
                              density="compact"
                            >
                              <span className="inline-flex w-fit px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-100 text-purple-800 cursor-help">
                                Boost: {formatPercent((relationshipBoosts[getCustomerKey(customer.id)] ?? 0) / 100, 1, true)}
                              </span>
                            </UnifiedTooltip>
                          )}
                      </div>
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
