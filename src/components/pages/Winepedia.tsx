import React, { useState, useEffect, useMemo } from 'react';
import { useGameStateWithData } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WineCharacteristicsDisplay } from "../ui";
import { SALES_CONSTANTS, CUSTOMER_REGIONAL_DATA } from '../../lib/constants/constants';
import { getAllCustomers, getCountryCode } from '@/lib/services';
import { Customer } from '@/lib/types';
import { loadFormattedRelationshipBreakdown } from '@/lib/utils/UIWineFilters';
import { calculateRelationshipBreakdown } from '@/lib/database/relationshipBreakdownService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { formatNumber, formatPercent, getColorCategory, getColorClass, getWineQualityInfo } from '@/lib/utils/utils';
import { PageProps } from '../UItypes';
import { generateDefaultCharacteristics } from '@/lib/services/wine/balanceCalculator';
import { GRAPE_VARIETY_INFO } from '@/lib/constants/constants';
import { useGameUpdates } from '@/hooks';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { calculateSkewedMultiplier, calculateInvertedSkewedMultiplier, calculateAsymmetricalMultiplier, calculateSymmetricalMultiplier, vineyardAgePrestigeModifier } from '@/lib/utils/calculator';

interface WinepediaProps extends PageProps {
  view?: string;
}

// Remove the old inline component since we now have the proper one

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState(view === 'customers' ? 'customers' : 'grapeVarieties');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: keyof Customer; direction: 'asc' | 'desc'} | null>(null);
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[key: string]: string}>({});
  const [computedRelationships, setComputedRelationships] = useState<{[key: string]: number}>({});

  // Memoize chart data generation to prevent continuous rerendering
  const chartData = useMemo(() => {
    const generateChartData = (func: (x: number) => number, start: number, end: number, steps: number, xLabel: string, yLabel: string) => {
      const data = [];
      for (let i = 0; i <= steps; i++) {
        const x = start + (end - start) * (i / steps);
        const y = func(x);
        data.push({
          [xLabel]: x,
          [yLabel]: y,
          displayX: formatNumber(x, { decimals: 2, forceDecimals: true }),
          displayY: formatNumber(y, { decimals: 3, forceDecimals: true })
        });
      }
      return data;
    };

    // Generate skewed data with more points at extremes (0-0.1 and 0.9-1.0)
    const generateSkewedData = () => {
      const data = [];
      // Dense points at low end (0-0.1): 20 points
      for (let i = 0; i <= 20; i++) {
        const x = i / 200; // 0 to 0.1
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      // Medium density in middle (0.1-0.9): 30 points
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8; // 0.1 to 0.9
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      // Dense points at high end (0.9-1.0): 20 points
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1; // 0.9 to 1.0
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      return data;
    };

    // Generate inverted skewed data (same distribution as skewed)
    const generateInvertedSkewedData = () => {
      const data = [];
      // Dense points at low end (0-0.1): 20 points
      for (let i = 0; i <= 20; i++) {
        const x = i / 200; // 0 to 0.1
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      // Medium density in middle (0.1-0.9): 30 points
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8; // 0.1 to 0.9
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      // Dense points at high end (0.9-1.0): 20 points
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1; // 0.9 to 1.0
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      return data;
    };

    // Generate asymmetrical data with more points at high end (0.8-1.0)
    const generateAsymmetricalData = () => {
      const data = [];
      // Low to medium density (0-0.8): 30 points
      for (let i = 0; i <= 30; i++) {
        const x = (i / 30) * 0.8; // 0 to 0.8
        const y = calculateAsymmetricalMultiplier(x);
        data.push({ input: x, multiplier: y });
      }
      // High density at high end (0.8-1.0): 40 points
      for (let i = 1; i <= 40; i++) {
        const x = 0.8 + (i / 40) * 0.2; // 0.8 to 1.0
        const y = calculateAsymmetricalMultiplier(x);
        data.push({ input: x, multiplier: y });
      }
      return data;
    };

    // Generate symmetrical data with more points at extremes (0-0.1 and 0.9-1.0)
    const generateSymmetricalData = () => {
      const data = [];
      // Dense points at low end (0-0.1): 20 points
      for (let i = 0; i <= 20; i++) {
        const x = i / 200; // 0 to 0.1
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      // Medium density in middle (0.1-0.9): 30 points
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8; // 0.1 to 0.9
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      // Dense points at high end (0.9-1.0): 20 points
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1; // 0.9 to 1.0
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      return data;
    };

    // Generate age data extending to 200 years
    const generateAgeData = () => {
      const data = [];
      // More points in early years (0-25): 30 points
      for (let i = 0; i <= 30; i++) {
        const age = (i / 30) * 25; // 0 to 25 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      // Medium density (25-100): 25 points
      for (let i = 1; i <= 25; i++) {
        const age = 25 + (i / 25) * 75; // 25 to 100 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      // High density at high end (100-200): 20 points
      for (let i = 1; i <= 20; i++) {
        const age = 100 + (i / 20) * 100; // 100 to 200 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      return data;
    };

    return {
      skewedData: generateSkewedData(),
      invertedSkewedData: generateInvertedSkewedData(),
      asymmetricalData: generateAsymmetricalData(),
      symmetricalData: generateSymmetricalData(),
      ageData: generateAgeData()
    };
  }, []); // Empty dependency array - only generate once
  
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

  // Pre-compute relationships for all customers when customers tab is active
  useEffect(() => {
    const precomputeRelationships = async () => {
      if (activeTab === 'customers' && customers.length > 0) {
        for (const customer of customers) {
          const customerKey = getCustomerKey(customer.id);
          if (!computedRelationships[customerKey]) {
            await loadRelationshipBreakdown(customer);
          }
        }
      }
    };
    
    precomputeRelationships();
  }, [customers, activeTab]);

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

  // Load relationship breakdown for a customer on-demand
  const loadRelationshipBreakdown = async (customer: Customer) => {
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
  };

  // Get unique countries from customers for filter dropdown
  const availableCountries = [...new Set(customers.map(customer => customer.country))];

  // Get sort indicator
  const getSortIndicator = (key: keyof Customer) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Grape varieties with characteristics (using constants)
  const grapeVarieties = GRAPE_VARIETY_INFO.map(grape => ({
    name: grape.name,
    description: grape.description,
    characteristics: generateDefaultCharacteristics(grape.name)
  }));

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Wine-Pedia</h1>
      
      <div className="space-y-6">
        {/* Navigation tabs */}
        <div className="flex space-x-1 border-b">
          {[
            { id: 'grapeVarieties', label: 'Grape Varieties' },
            { id: 'wineQuality', label: 'Wine Quality' },
            { id: 'customerTypes', label: 'Customer Types' },
            { id: 'countries', label: 'Countries' },
            { id: 'wineRegions', label: 'Wine Regions' },
            { id: 'winemaking', label: 'Winemaking' },
            { id: 'mathematicalModels', label: 'Mathematical Models' },
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
                  <WineCharacteristicsDisplay 
                    characteristics={grape.characteristics} 
                    collapsible={true}
                    defaultExpanded={false}
                    title="Wine Characteristics"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'wineQuality' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wine Quality Categories</CardTitle>
                <CardDescription>
                  Understanding wine quality ratings and what they mean for your winery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { min: 0.9, max: 1.0 },
                    { min: 0.8, max: 0.9 },
                    { min: 0.7, max: 0.8 },
                    { min: 0.6, max: 0.7 },
                    { min: 0.5, max: 0.6 },
                    { min: 0.4, max: 0.5 },
                    { min: 0.3, max: 0.4 },
                    { min: 0.2, max: 0.3 },
                    { min: 0.1, max: 0.2 },
                    { min: 0.0, max: 0.1 }
                  ].map((quality, index) => {
                    const sampleQuality = (quality.min + quality.max) / 2;
                    const qualityInfo = getWineQualityInfo(sampleQuality);
                    const colorClass = getColorClass(sampleQuality);
                    const qualityLabel = getColorCategory(sampleQuality);
                    
                    return (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-semibold ${colorClass}`}>{qualityInfo.category}</h4>
                          <span className="text-sm text-gray-500">
                            {formatNumber(quality.min * 100, { decimals: 0, forceDecimals: true })}-{formatNumber(quality.max * 100, { decimals: 0, forceDecimals: true })}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{qualityInfo.description}</p>
                        <div className="text-xs text-gray-500">
                          Quality Level: <span className="font-medium">{qualityLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Quality Factors</CardTitle>
                <CardDescription>
                  What influences wine quality in your winery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Grape Quality</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Grape variety characteristics</li>
                      <li>• Vineyard location and terroir</li>
                      <li>• Harvest timing and conditions</li>
                      <li>• Vine age and health</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Winemaking Process</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Fermentation control and timing</li>
                      <li>• Aging conditions and duration</li>
                      <li>• Wine balance and characteristics</li>
                      <li>• Bottling and storage practices</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                      <span className={`font-bold ${getColorClass(data.purchasingPower)}`}>
                        {formatPercent(data.purchasingPower, 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Wine Tradition:</span>
                      <span className={`font-bold ${getColorClass(data.wineTradition)}`}>
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
        
        {activeTab === 'mathematicalModels' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mathematical Models</CardTitle>
                <CardDescription>
                  Advanced mathematical functions used throughout the game for realistic scaling and probability calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  
                  {/* Skewed Multiplier */}
                  <div className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Skewed Multiplier</h3>
                    <p className="text-gray-600 mb-4">
                      Maps 0-1 input to 0-1 output heavily skewed toward 0 with exponential approach to 1.
                      Used for quality-based calculations where most values are low.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
                        <div className="space-y-1 text-sm font-mono">
                          <div>0.0 → 0.000</div>
                          <div>0.1 → 0.015</div>
                          <div>0.2 → 0.060</div>
                          <div>0.3 → 0.135</div>
                          <div>0.4 → 0.240</div>
                          <div>0.5 → 0.370</div>
                          <div>0.6 → 0.480</div>
                          <div>0.7 → 0.560</div>
                          <div>0.8 → 0.710</div>
                          <div>0.9 → 0.860</div>
                          <div>0.95 → 0.960</div>
                          <div>0.99 → 0.992</div>
                          <div>1.0 → 1.000</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• 0.0-0.4: Polynomial (x² × 1.5)</div>
                          <div>• 0.4-0.7: Logarithmic scaling</div>
                          <div>• 0.7-0.9: Linear scaling</div>
                          <div>• 0.9-0.95: Exponential</div>
                          <div>• 0.95-0.99: Logistic curve</div>
                          <div>• 0.99-1.0: Sigmoid</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Usage in Game:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• <strong>Wine Quality Index</strong> - Converts combined wine quality score to 0-1 index</div>
                          <div>• <strong>Customer Market Share</strong> - Generates realistic market share distribution (most customers have small shares)</div>
                          <div>• <strong>Order Rejection Probability</strong> - Calculates order rejection probability based on price ratio</div>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-semibold mb-2">Curve Shape:</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData.skewedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                                <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                                <RechartsTooltip 
                                  formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Output']}
                                  labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                                />
                                <Line type="monotone" dataKey="output" stroke="#3b82f6" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inverted Skewed Multiplier */}
                  <div className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Inverted Skewed Multiplier</h3>
                    <p className="text-gray-600 mb-4">
                      Mathematical inverse of Skewed Multiplier. Maps 0-1 input to 0-1 output heavily skewed toward 1.
                      Used for market share penalties where small customers get high modifiers.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
                        <div className="space-y-1 text-sm font-mono">
                          <div>0.0 → 1.000</div>
                          <div>0.1 → 0.985</div>
                          <div>0.2 → 0.940</div>
                          <div>0.3 → 0.865</div>
                          <div>0.4 → 0.760</div>
                          <div>0.5 → 0.630</div>
                          <div>0.6 → 0.520</div>
                          <div>0.7 → 0.440</div>
                          <div>0.8 → 0.290</div>
                          <div>0.9 → 0.140</div>
                          <div>0.95 → 0.040</div>
                          <div>0.99 → 0.008</div>
                          <div>1.0 → 0.000</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Usage in Game:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• <strong>Customer Relationship.ts</strong> - Market share modifier for customer relationship calculation</div>
                          <div>• <strong>Formula:</strong> marketShareModifier = 1 - calculateInvertedSkewedMultiplier(customer.marketShare)</div>
                          <div>• <strong>Effect:</strong> Small customers (1% market share) get ~0.99 modifier, large customers (50%+) get ~0.4 modifier</div>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-semibold mb-2">Curve Shape:</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData.invertedSkewedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                                <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                                <RechartsTooltip 
                                  formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Output']}
                                  labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                                />
                                <Line type="monotone" dataKey="output" stroke="#ef4444" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Mathematical Properties:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• Formula: 1 - calculateSkewedMultiplier(1 - score)</div>
                          <div>• Perfect inverse of Skewed Multiplier</div>
                          <div>• Small inputs → High outputs</div>
                          <div>• Large inputs → Low outputs</div>
                          <div>• Ideal for penalty systems</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asymmetrical Multiplier */}
                  <div className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Asymmetrical Multiplier</h3>
                    <p className="text-gray-600 mb-4">
                      Creates asymmetrical distribution with modest multipliers for low values and astronomical multipliers for extreme values.
                      Used for quality multipliers and rejection probabilities.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
                        <div className="space-y-1 text-sm font-mono">
                          <div>0.0 → 1.0x</div>
                          <div>0.1 → 1.02x</div>
                          <div>0.2 → 1.08x</div>
                          <div>0.3 → 1.18x</div>
                          <div>0.4 → 1.35x</div>
                          <div>0.5 → 1.55x</div>
                          <div>0.6 → 1.78x</div>
                          <div>0.7 → 2.28x</div>
                          <div>0.8 → 2.78x</div>
                          <div>0.9 → 5.28x</div>
                          <div>0.95 → 15.28x</div>
                          <div>0.98 → 55.28x</div>
                          <div>0.99 → 5,000x</div>
                          <div>1.0 → 50,000,000x</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Usage in Game:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• <strong>Wine Pricing</strong> - Quality multiplier for final wine price calculation</div>
                          <div>• <strong>Formula:</strong> finalPrice = basePrice × calculateAsymmetricalMultiplier(qualityIndex)</div>
                          <div>• <strong>Example:</strong> 0.95 quality wine gets 15.28x price multiplier, 0.99 quality gets 5,000x multiplier</div>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-semibold mb-2">Curve Shape:</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData.asymmetricalData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                                <YAxis scale="log" domain={[1, 100000000]} tickFormatter={(value) => {
                                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                                  return value.toFixed(0);
                                }} />
                                <RechartsTooltip 
                                  formatter={(value: number) => [formatNumber(value, { decimals: 1, forceDecimals: true }) + 'x', 'Multiplier']}
                                  labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                                />
                                <Line type="monotone" dataKey="multiplier" stroke="#10b981" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• 0.0-0.3: Polynomial (x² × 2 + 1.0)</div>
                          <div>• 0.3-0.6: Logarithmic scaling</div>
                          <div>• 0.6-0.8: Linear scaling</div>
                          <div>• 0.8-0.9: Exponential</div>
                          <div>• 0.9-0.95: Strong exponential</div>
                          <div>• 0.95-0.98: Very strong exponential</div>
                          <div>• 0.98-1.0: Unlimited exponential</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Symmetrical Multiplier */}
                  <div className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Symmetrical Multiplier</h3>
                    <p className="text-gray-600 mb-4">
                      Creates bell curve distribution where input 0.5 maps to exactly 1.0x multiplier.
                      Most values cluster around 1.0x with rare extremes.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Input → Output Mappings (0.7-1.3 range):</h4>
                        <div className="space-y-1 text-sm font-mono">
                          <div>0.0 → 0.701x</div>
                          <div>0.1 → 0.85x</div>
                          <div>0.2 → 0.95x</div>
                          <div>0.3 → 0.98x</div>
                          <div>0.4 → 0.99x</div>
                          <div>0.5 → 1.00x</div>
                          <div>0.6 → 0.99x</div>
                          <div>0.7 → 0.98x</div>
                          <div>0.8 → 0.95x</div>
                          <div>0.9 → 0.85x</div>
                          <div>1.0 → 0.701x</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Usage in Game:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• <strong>Currently Unused</strong> - Available for future features</div>

                        </div>
                        <div className="mt-3">
                          <h5 className="font-semibold mb-2">Curve Shape:</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData.symmetricalData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                                <YAxis domain={[0.7, 1.3]} allowDataOverflow={false} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true }) + 'x'} />
                                <RechartsTooltip 
                                  formatter={(value: number) => [formatNumber(value, { decimals: 2, forceDecimals: true }) + 'x', 'Multiplier']}
                                  labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                                />
                                <Line type="monotone" dataKey="multiplier" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Features:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• Perfect symmetry around 0.5</div>
                          <div>• Bell curve distribution</div>
                          <div>• Configurable min/max range</div>
                          <div>• Smooth transitions</div>
                          <div>• Ideal for balanced systems</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vineyard Age Prestige Modifier */}
                  <div className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Vineyard Age Prestige Modifier</h3>
                    <p className="text-gray-600 mb-4">
                      Calculates prestige modifier based on vine age using different mathematical approaches for different age ranges.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Age → Modifier Mappings:</h4>
                        <div className="space-y-1 text-sm font-mono">
                          <div>0 years → 0.01</div>
                          <div>1 year → 0.02</div>
                          <div>3 years → 0.10</div>
                          <div>10 years → 0.26</div>
                          <div>25 years → 0.50</div>
                          <div>50 years → 0.80</div>
                          <div>100 years → 0.95</div>
                          <div>200+ years → 0.95</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Usage in Game:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• <strong>Vineyard Value Calculation</strong> - Age contribution (30% of vineyard value calculation)</div>
                          <div>• <strong>Formula:</strong> ageContribution = vineyardAgePrestigeModifier(vineyard.vineAge) × 0.3</div>
                          <div>• <strong>Effect:</strong> 25-year-old vines contribute 0.15 to vineyard value, 100-year-old vines contribute 0.285</div>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-semibold mb-2">Curve Shape:</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData.ageData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="age" domain={[0, 200]} tickFormatter={(value) => `${value}y`} />
                                <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                                <RechartsTooltip 
                                  formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Modifier']}
                                  labelFormatter={(value: number) => `Age: ${value} years`}
                                />
                                <Line type="monotone" dataKey="modifier" stroke="#f59e0b" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
                        <div className="space-y-1 text-sm">
                          <div>• 0-3 years: Polynomial (x²/100 + 0.01)</div>
                          <div>• 3-25 years: Linear progression</div>
                          <div>• 25-100 years: Arctangent curve</div>
                          <div>• 100+ years: Capped at 0.95</div>
                          <div>• Realistic aging simulation</div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>
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
        )}
      </div>
    </div>
  );
}
