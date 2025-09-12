import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { SALES_CONSTANTS, CUSTOMER_REGIONAL_DATA } from '../../lib/constants';
import { getAllCustomers, getCountryCode } from '../../lib/services/sales/createCustomer';
import { Customer } from '../../lib/types';

interface WinepediaProps {
  view?: string;
}

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState('grapeVarieties');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);

  if (view && view !== 'winepedia') return null;

  // Load customers when the customers tab is first accessed
  useEffect(() => {
    if (activeTab === 'customers' && customers.length === 0) {
      console.log('[Winepedia] Loading customers from database...');
      const loadCustomersData = async () => {
        try {
          const loadedCustomers = await getAllCustomers();
          setCustomers(loadedCustomers);
          setFilteredCustomers(loadedCustomers);
        } catch (error) {
          console.error('[Winepedia] Failed to load customers:', error);
          // Fallback to empty array
          setCustomers([]);
          setFilteredCustomers([]);
        }
      };
      loadCustomersData();
    }
  }, [activeTab, customers.length]);

  // Filter customers by country
  useEffect(() => {
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
    
    setFilteredCustomers(filtered);
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
        {value.toFixed(1)}
      </span>
    );
  };

  // Get unique countries from customers for filter dropdown
  const availableCountries = [...new Set(customers.map(customer => customer.country))];

  // Get sort indicator
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Mock grape varieties
  const grapeVarieties = [
    {
      name: 'Barbera',
      description: 'A versatile grape known for high acidity and moderate tannins, producing medium-bodied wines.'
    },
    {
      name: 'Chardonnay',
      description: 'A noble grape variety producing aromatic, medium-bodied wines with moderate acidity.'
    },
    {
      name: 'Pinot Noir',
      description: 'A delicate grape creating light-bodied, aromatic wines with high acidity and soft tannins.'
    },
    {
      name: 'Primitivo',
      description: 'A robust grape yielding full-bodied, aromatic wines with natural sweetness and high tannins.'
    },
    {
      name: 'Sauvignon Blanc',
      description: 'A crisp grape variety producing aromatic, light-bodied wines with high acidity.'
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
                <CardContent>
                  <p className="text-gray-600">{grape.description}</p>
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
                    <CardDescription>{(config.chance * 100).toFixed(0)}% chance of appearing</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Price Range:</span>
                      <p className="text-gray-600">
                        {(config.priceMultiplierRange[0] * 100).toFixed(0)}% - {(config.priceMultiplierRange[1] * 100).toFixed(0)}% of base price
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
                      <p className="text-gray-600">{(config.multipleOrderPenalty * 100).toFixed(0)}%</p>
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
                        {(data.purchasingPower * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Wine Tradition:</span>
                      <span className={`font-bold ${data.wineTradition >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(data.wineTradition * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <h4 className="font-medium text-gray-700 mb-2">Customer Type Distribution:</h4>
                    <div className="space-y-1">
                      {Object.entries(data.customerTypeWeights).map(([type, weight]) => (
                        <div key={type} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{type}:</span>
                          <span className="font-medium">{(weight * 100).toFixed(0)}%</span>
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
                          <TableCell>{(customer.marketShare * 100).toFixed(1)}%</TableCell>
                          <TableCell>{(customer.purchasingPower * 100).toFixed(0)}%</TableCell>
                          <TableCell>{(customer.wineTradition * 100).toFixed(0)}%</TableCell>
                          <TableCell>{formatRelationship(customer.relationship || 0)}</TableCell>
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
