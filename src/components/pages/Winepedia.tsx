import React, { useState, useEffect } from 'react';
import { useGameStateWithData } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WineCharacteristicsDisplay, CharacteristicBarLegend } from "../ui";
import { SALES_CONSTANTS, CUSTOMER_REGIONAL_DATA } from '../../lib/constants';
import { getAllCustomers, getCountryCode } from '@/lib/services';
import { Customer } from '@/lib/types';
import { loadFormattedRelationshipBreakdown } from '@/lib/utils/UIWineFilters';
import { formatNumber, formatPercent } from '@/lib/utils/utils';
import { PageProps } from '../UItypes';
import { generateDefaultCharacteristics } from '@/lib/services/balanceCalculator';

interface WinepediaProps extends PageProps {
  view?: string;
}

// Remove the old inline component since we now have the proper one

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState(view === 'customers' ? 'customers' : 'grapeVarieties');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[customerId: string]: string}>({});

  // Remove this condition as it was preventing navigation with view prop
  // if (view && view !== 'winepedia') return null;

  // Update active tab when view prop changes
  useEffect(() => {
    if (view === 'customers') {
      setActiveTab('customers');
    }
  }, [view]);

  // Use consolidated hook for reactive customer loading (only when customers tab is active)
  const loadCustomersData = React.useCallback(async () => {
    if (activeTab === 'customers') {
      return await getAllCustomers();
    }
    return [];
  }, [activeTab]);

  const customers = useGameStateWithData(loadCustomersData, []);

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
    const colorClass = normalizedValue > 0.7 ? 'text-green-600' : 
                      normalizedValue > 0.4 ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <span className={colorClass}>
        {formatNumber(value, 1)}
      </span>
    );
  };

  // Load relationship breakdown for a customer on-demand
  const loadRelationshipBreakdown = async (customer: Customer) => {
    try {
      const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
      setRelationshipBreakdowns(prev => ({
        ...prev,
        [customer.id]: formattedBreakdown
      }));
    } catch (error) {
      console.error('Error loading relationship breakdown:', error);
    }
  };

  // Get unique countries from customers for filter dropdown
  const availableCountries = [...new Set(customers.map(customer => customer.country))];

  // Get sort indicator
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Grape varieties with characteristics
  const grapeVarieties = [
    {
      name: 'Chardonnay',
      description: 'A noble grape variety producing aromatic, medium-bodied wines with moderate acidity.',
      characteristics: generateDefaultCharacteristics('Chardonnay')
    },
    {
      name: 'Pinot Noir',
      description: 'A delicate grape creating light-bodied, aromatic wines with high acidity and soft tannins.',
      characteristics: generateDefaultCharacteristics('Pinot Noir')
    },
    {
      name: 'Cabernet Sauvignon',
      description: 'A bold grape producing full-bodied, structured wines with high tannins and good aging potential.',
      characteristics: generateDefaultCharacteristics('Cabernet Sauvignon')
    },
    {
      name: 'Merlot',
      description: 'A smooth grape variety creating medium to full-bodied wines with soft tannins and rich fruit flavors.',
      characteristics: generateDefaultCharacteristics('Merlot')
    }
  ];

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Wine-Pedia</h1>
      
      <div className="space-y-6">
        {/* Navigation tabs */}
        <div className="flex space-x-1 border-b">
          {[
            { id: 'grapeVarieties', label: 'Grape Varieties' },
            { id: 'customerTypes', label: 'Customer Types' },
            { id: 'countries', label: 'Countries' },
            { id: 'wineRegions', label: 'Wine Regions' },
            { id: 'winemaking', label: 'Winemaking' },
            { id: 'customers', label: 'Customers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {activeTab === 'grapeVarieties' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grapeVarieties.map((grape, index) => (
              <Card 
                key={index} 
                className="hover:shadow-md transition-shadow cursor-pointer"
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-700 font-bold">{grape.name.charAt(0)}</span>
                  </div>
                  <CardTitle>{grape.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">{grape.description}</p>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Wine Characteristics:</h4>
                    <WineCharacteristicsDisplay characteristics={grape.characteristics} />
                    <CharacteristicBarLegend />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'customerTypes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(SALES_CONSTANTS.CUSTOMER_TYPES).map(([typeName, config]) => (
              <Card key={typeName} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-700 font-bold">{typeName.charAt(0)}</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{typeName}</CardTitle>
                    <CardDescription>Customer type characteristics</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Price Range:</span>
                      <p className="text-gray-600">
                        {formatPercent(config.priceMultiplierRange[0], 0, true)} - {formatPercent(config.priceMultiplierRange[1], 0, true)} of base price
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Quantity Range:</span>
                      <p className="text-gray-600">
                        {config.quantityRange[0]} - {config.quantityRange[1]} bottles
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Base Multiplier:</span>
                      <p className="text-gray-600">{config.baseQuantityMultiplier}x</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Multiple Order Penalty:</span>
                      <p className="text-gray-600">{formatPercent(config.multipleOrderPenalty, 0, true)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'countries' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(CUSTOMER_REGIONAL_DATA).map(([countryName, data]) => (
              <Card key={countryName} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-bold">{countryName.charAt(0)}</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{countryName}</CardTitle>
                    <CardDescription>Regional characteristics</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Purchasing Power:</span>
                      <span className={`font-bold ${data.purchasingPower >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(data.purchasingPower, 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Wine Tradition:</span>
                      <span className={`font-bold ${data.wineTradition >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(data.wineTradition, 0, true)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <h4 className="font-medium text-gray-700 mb-2">Customer Type Distribution:</h4>
                    <div className="space-y-1">
                      {Object.entries(data.customerTypeWeights).map(([type, weight]) => (
                        <div key={type} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{type}:</span>
                          <span className="font-medium">{formatPercent(weight, 0, true)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'wineRegions' && (
          <Card>
            <CardHeader>
              <CardTitle>Wine Regions</CardTitle>
              <CardDescription>Learn about different wine regions around the world</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Content coming soon...</p>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'winemaking' && (
          <Card>
            <CardHeader>
              <CardTitle>Winemaking Process</CardTitle>
              <CardDescription>Understand the steps involved in creating fine wines</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Content coming soon...</p>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'customers' && (
          <Card>
            <CardHeader>
              <CardTitle>Wine Customers Directory</CardTitle>
              <CardDescription>
                Global wine customers and their market relationships. Total customers: {customers.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter controls */}
              <div className="mb-4 flex gap-4 items-center">
                <div>
                  <label htmlFor="country-filter" className="text-sm font-medium text-gray-700 mr-2">
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
                <div className="text-sm text-gray-600">
                  Showing {filteredCustomers.length} of {customers.length} customers
                </div>
              </div>

              {/* Customers table */}
              {filteredCustomers.length > 0 ? (
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
                      {filteredCustomers.map((customer) => (
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
                                      if (!relationshipBreakdowns[customer.id]) {
                                        loadRelationshipBreakdown(customer);
                                      }
                                    }}
                                    className="cursor-help"
                                  >
                                    {formatRelationship(customer.relationship || 0)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <div className="text-sm">
                                    <div className="font-semibold mb-2">Customer Relationship Breakdown</div>
                                    {relationshipBreakdowns[customer.id] ? (
                                      <div className="space-y-1 text-xs">
                                        {relationshipBreakdowns[customer.id].split('\n').map((line, index) => (
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
        )}
      </div>
    </div>
  );
}
