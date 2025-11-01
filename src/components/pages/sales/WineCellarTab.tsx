import React, { useState, useMemo } from 'react';
import { WineBatch } from '@/lib/types/types';
import { formatNumber, formatPercent, getGrapeQualityCategory, getColorClass } from '@/lib/utils/utils';
import { SALES_CONSTANTS } from '@/lib/constants';
import { calculateAsymmetricalMultiplier } from '@/lib/utils/calculator';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../ui';
import { useWineBatchBalance, useFormattedBalance, useBalanceQuality, useWineCombinedScore, useWineFeatureDetails } from '@/hooks';
import { saveWineBatch } from '@/lib/database/activities/inventoryDB';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { calculateAgingStatus } from '@/lib/services';


// Component for combined balance and quality display
const BalanceAndQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const balanceResult = useWineBatchBalance(batch);
  const formattedBalance = useFormattedBalance(balanceResult);
  const balanceQuality = useBalanceQuality(balanceResult);
  const balanceColorClass = getColorClass(batch.balance);
  
  const qualityCategory = getGrapeQualityCategory(batch.grapeQuality);
  const qualityColorClass = getColorClass(batch.grapeQuality);
  const qualityPercentage = formatNumber(batch.grapeQuality * 100, { smartDecimals: true });

  return (
    <div className="text-xs text-gray-600 space-y-1">
      <div>
        <span className="font-medium">Balance:</span> <span className={`font-medium ${balanceColorClass}`}>{formattedBalance}</span> ({balanceQuality})
      </div>
      <div>
        <span className="font-medium">Quality:</span> <span className={`font-medium ${qualityColorClass}`}>{qualityPercentage}%</span> ({qualityCategory})
      </div>
    </div>
  );
};

// Component for wine score display with tooltip
const WineScoreDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const wineScoreData = useWineCombinedScore(wine);
  const featureDetails = useWineFeatureDetails(wine);
  
  if (!wineScoreData || !featureDetails) return null;
  
  const { currentGrapeQuality, grapeQualityPenalty, presentFeatures, hasQualityAffectingFeatures } = featureDetails;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full cursor-help ${wineScoreData.badgeClasses.bg} ${wineScoreData.badgeClasses.text}`}>
            {wineScoreData.formattedScore}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Wine Score Calculation</div>
            <div>Base Grape Quality: <span className="font-medium">{formatPercent(wine.grapeQuality, 1, true)}</span></div>
            {hasQualityAffectingFeatures && grapeQualityPenalty > 0.001 && (
              <>
                <div className="text-red-600">
                  Feature Penalty: <span className="font-medium">-{formatPercent(grapeQualityPenalty, 1, true)}</span>
                </div>
                <div className="ml-2 text-xs text-gray-600">
                  {presentFeatures.map((f: any, idx: number) => (
                    <div key={idx}>• {f.feature.icon} {f.config.name}</div>
                  ))}
                </div>
                <div>Current Grape Quality: <span className="font-medium">{formatPercent(currentGrapeQuality, 1, true)}</span></div>
              </>
            )}
            <div>Balance: <span className="font-medium">{formatPercent(wine.balance, 1, true)}</span></div>
            <div className="border-t pt-1 mt-1">Wine Score: <span className="font-medium">{wineScoreData.formattedScore}</span></div>
            <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
              Formula: (Effective Quality + Balance) ÷ 2
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


// Component for estimated price display with tooltip
const EstimatedPriceDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const wineScoreData = useWineCombinedScore(wine);
  const featureDetails = useWineFeatureDetails(wine);
  
  if (!wineScoreData || !featureDetails) return null;
  
  const baseRate = SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  const basePrice = wineScoreData.score * baseRate;
  const multiplier = calculateAsymmetricalMultiplier(wineScoreData.score);
  
  const { presentFeatures, hasQualityAffectingFeatures, priceImpact } = featureDetails;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{formatNumber(wine.estimatedPrice, { currency: true, decimals: 2 })}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Estimated Price Calculation</div>
            <div>Wine Score: <span className="font-medium">{wineScoreData.formattedScore}</span></div>
            {hasQualityAffectingFeatures && priceImpact && priceImpact.priceDifference > 0.01 && (
              <>
                <div className="text-red-600 text-[10px]">
                  ⚠️ Price reduced by {formatNumber(priceImpact.priceDifference, { currency: true, decimals: 2 })} due to:
                </div>
                <div className="ml-2 text-[10px] text-gray-600">
                  {presentFeatures.map((f: any, idx: number) => (
                    <div key={idx}>• {f.feature.icon} {f.config.name}</div>
                  ))}
                </div>
              </>
            )}
            <div className="border-t pt-1 mt-1">Base Rate: <span className="font-medium">{formatNumber(baseRate, { currency: true, decimals: 2 })}/bottle</span></div>
            <div>Base Price: <span className="font-medium">{formatNumber(basePrice, { currency: true, decimals: 2 })}</span></div>
            <div>Quality Multiplier: <span className="font-medium">{formatNumber(multiplier, { decimals: 2, forceDecimals: true })}×</span></div>
            <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
              Formula: (Wine Score × Base Rate) × Multiplier
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


// Use centralized aging calculation service (imported from services)

// Component for aging progress bar with visual indicators
const AgingProgressBar: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const status = calculateAgingStatus(wine);
  
  const peakStatusLabels = {
    'developing': '🟡 Developing',
    'early-peak': '🟢 Early Peak',
    'peak': '🟢 Peak Window',
    'mature': '🔵 Mature',
    'past-peak': '🟠 Past Peak'
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full space-y-1 cursor-help">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">
                {status.ageInYears >= 1 
                  ? `${formatNumber(status.ageInYears, { decimals: 1, adaptiveNearOne: true })} years` 
                  : `${status.ageInWeeks} weeks`
                }
              </span>
              <span className="text-[10px] text-gray-500">{status.agingStage}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${status.progressColor} transition-all duration-300`}
                style={{ width: `${status.progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-600">{peakStatusLabels[status.peakStatus]} • {formatNumber(status.progressPercent / 100, { decimals: 2, adaptiveNearOne: true })}%</div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Aging Progress</div>
            <div>Age: <span className="font-medium">{formatNumber(status.ageInYears, { decimals: 2, adaptiveNearOne: true })} years ({status.ageInWeeks} weeks)</span></div>
            <div>Status: <span className="font-medium">{peakStatusLabels[status.peakStatus]}</span></div>
            <div>Maturity: <span className="font-medium">{formatNumber(status.progressPercent / 100, { decimals: 3, adaptiveNearOne: true })}%</span></div>
            <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
              Aging improves quality, characteristics, and value. Risk of oxidation increases over time.
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Component for compact feature icons (inline in table)
const CompactFeatureIcons: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const configs = getAllFeatureConfigs();
  const features = wine.features || [];
  
  const manifestedFeatures = configs
    .filter(config => {
      const feature = features.find(f => f.id === config.id);
      return feature?.isPresent;
    });
  
  if (manifestedFeatures.length === 0) {
    return <span className="text-[10px] text-gray-400">—</span>;
  }
  
  return (
    <div className="flex gap-1">
      {manifestedFeatures.map(config => (
        <TooltipProvider key={config.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm cursor-help">{config.icon}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">{config.name}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
};

interface WineCellarTabProps {
  bottledWines: WineBatch[];
  showSoldOut: boolean;
  setShowSoldOut: (show: boolean) => void;
  onWineDetailsClick: (batchId: string) => void;
}

const WineCellarTab: React.FC<WineCellarTabProps> = ({
  bottledWines,
  showSoldOut,
  setShowSoldOut,
  onWineDetailsClick
}) => {
  const [editingPrices, setEditingPrices] = useState<{[key: string]: string}>({});
  
  // Advanced filtering state
  const [filters, setFilters] = useState({
    vineyard: 'all',
    grape: 'all',
    vintage: 'all',
    agingStatus: 'all',
    features: 'all'
  });
  
  // Collapsible vintage groups state (for desktop hierarchical view)
  const [expandedVintages, setExpandedVintages] = useState<Set<number>>(new Set());
  
  // Get unique filter options from wines
  const filterOptions = useMemo(() => {
    const vineyards = new Set(bottledWines.map(w => w.vineyardName));
    const grapes = new Set(bottledWines.map(w => w.grape));
    const vintages = new Set(bottledWines.map(w => w.harvestStartDate.year));
    
    return {
      vineyards: Array.from(vineyards).sort(),
      grapes: Array.from(grapes).sort(),
      vintages: Array.from(vintages).sort((a, b) => b - a)
    };
  }, [bottledWines]);
  
  // Apply filters
  const filteredWines = useMemo(() => {
    return bottledWines.filter(wine => {
      // Vineyard filter
      if (filters.vineyard !== 'all' && wine.vineyardName !== filters.vineyard) return false;
      
      // Grape filter
      if (filters.grape !== 'all' && wine.grape !== filters.grape) return false;
      
      // Vintage filter
      if (filters.vintage !== 'all' && wine.harvestStartDate.year !== parseInt(filters.vintage)) return false;
      
      // Aging status filter
      if (filters.agingStatus !== 'all') {
        const status = calculateAgingStatus(wine);
        if (filters.agingStatus !== status.peakStatus) return false;
      }
      
      // Features filter
      if (filters.features !== 'all') {
        const hasFeature = wine.features?.some(f => f.id === filters.features && f.isPresent);
        if (!hasFeature) return false;
      }
      
      return true;
    });
  }, [bottledWines, filters]);

  // Define sortable columns for wine cellar
  const cellarColumns: SortableColumn<WineBatch>[] = [
    { key: 'grape', label: 'Wine', sortable: true },
    { key: 'vineyardName', label: 'Vineyard', sortable: true },
    { key: 'harvestStartDate', label: 'Vintage', sortable: true, accessor: (wine) => wine.harvestStartDate.year },
    { 
      key: 'agingProgress' as any, 
      label: 'Aging Progress', 
      sortable: true,
      accessor: (wine) => wine.agingProgress || 0
    },
    { key: 'balance' as any, label: 'Balance & Quality', sortable: false },
    { 
      key: 'wineScore' as any, 
      label: 'Score', 
      sortable: true,
      accessor: (wine) => (wine.grapeQuality + wine.balance) / 2
    },
    { key: 'estimatedPrice' as any, label: 'Est. Price', sortable: true },
    { 
      key: 'askingPrice', 
      label: 'Asking Price', 
      sortable: true,
      accessor: (wine) => wine.askingPrice ?? wine.estimatedPrice
    },
    { key: 'quantity', label: 'Bottles', sortable: true },
    { key: 'features' as any, label: 'Features', sortable: false },
    { key: 'actions' as any, label: 'Actions', sortable: false }
  ];

  const {
    sortedData: sortedBottledWines,
    handleSort: handleCellarSort,
    getSortIndicator: getCellarSortIndicator,
    isColumnSorted: isCellarColumnSorted
  } = useTableSortWithAccessors(filteredWines, cellarColumns);

  // Group wines by vintage year for hierarchical display
  const winesByVintage = useMemo(() => {
    return sortedBottledWines.reduce((groups, wine) => {
      const vintage = wine.harvestStartDate.year;
      if (!groups[vintage]) {
        groups[vintage] = [];
      }
      groups[vintage].push(wine);
      return groups;
    }, {} as Record<number, WineBatch[]>);
  }, [sortedBottledWines]);

  // Sort vintage years (newest first)
  const sortedVintages = useMemo(() => {
    return Object.keys(winesByVintage)
      .map(Number)
      .sort((a, b) => b - a);
  }, [winesByVintage]);
  
  // Toggle vintage group expansion
  const toggleVintage = (vintage: number) => {
    const newExpanded = new Set(expandedVintages);
    if (newExpanded.has(vintage)) {
      newExpanded.delete(vintage);
    } else {
      newExpanded.add(vintage);
    }
    setExpandedVintages(newExpanded);
  };
  
  // Expand all / Collapse all
  const expandAll = () => setExpandedVintages(new Set(sortedVintages));
  const collapseAll = () => setExpandedVintages(new Set());

  // Handle price editing
  const handlePriceEdit = (wineId: string, currentPrice: number) => {
    setEditingPrices(prev => ({
      ...prev,
      [wineId]: currentPrice.toFixed(2) // Use toFixed for HTML number input compatibility (requires period separator)
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
  
  // Calculate filter summary stats
  const filterStats = useMemo(() => {
    const total = filteredWines.length;
    const totalBottles = filteredWines.reduce((sum, w) => sum + w.quantity, 0);
    const totalValue = filteredWines.reduce((sum, w) => sum + (w.quantity * (w.askingPrice ?? w.estimatedPrice)), 0);
    
    return { total, totalBottles, totalValue };
  }, [filteredWines]);

  return (
    <div className="space-y-3">
      {/* Advanced Filters */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold">Wine Cellar Filters</h3>
            <p className="text-gray-500 text-xs">
              {filterStats.total} wine{filterStats.total !== 1 ? 's' : ''} • {filterStats.totalBottles} bottles • {formatNumber(filterStats.totalValue, { currency: true, decimals: 0 })} total value
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showSoldOut}
                onChange={(e) => setShowSoldOut(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium">Show Sold Out</span>
            </label>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          <div>
            <label className="block text-gray-600 mb-1">Vineyard</label>
            <select 
              className="w-full border rounded px-2 py-1 text-xs"
              value={filters.vineyard}
              onChange={(e) => setFilters(prev => ({ ...prev, vineyard: e.target.value }))}
            >
              <option value="all">All Vineyards</option>
              {filterOptions.vineyards.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-600 mb-1">Grape</label>
            <select 
              className="w-full border rounded px-2 py-1 text-xs"
              value={filters.grape}
              onChange={(e) => setFilters(prev => ({ ...prev, grape: e.target.value }))}
            >
              <option value="all">All Grapes</option>
              {filterOptions.grapes.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-600 mb-1">Vintage</label>
            <select 
              className="w-full border rounded px-2 py-1 text-xs"
              value={filters.vintage}
              onChange={(e) => setFilters(prev => ({ ...prev, vintage: e.target.value }))}
            >
              <option value="all">All Vintages</option>
              {filterOptions.vintages.map(v => (
                <option key={v} value={v.toString()}>{v}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-gray-600 mb-1">Aging Status</label>
            <select 
              className="w-full border rounded px-2 py-1 text-xs"
              value={filters.agingStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, agingStatus: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="developing">🟡 Developing</option>
              <option value="early-peak">🟢 Early Peak</option>
              <option value="peak">🟢 Peak Window</option>
              <option value="mature">🔵 Mature</option>
              <option value="past-peak">🟠 Past Peak</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-600 mb-1">Features</label>
            <select 
              className="w-full border rounded px-2 py-1 text-xs"
              value={filters.features}
              onChange={(e) => setFilters(prev => ({ ...prev, features: e.target.value }))}
            >
              <option value="all">All Features</option>
              <option value="terroir">🌿 Terroir</option>
              <option value="oxidation">⚠️ Oxidation</option>
              <option value="bottle_aging">🕰️ Bottle Aging</option>
              <option value="green_flavor">🟢 Green Flavor</option>
              <option value="stuck_fermentation">🛑 Stuck Fermentation</option>
            </select>
          </div>
        </div>
        
        {/* Active filters indicator */}
        {(filters.vineyard !== 'all' || filters.grape !== 'all' || filters.vintage !== 'all' || filters.agingStatus !== 'all' || filters.features !== 'all') && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-600">Active filters:</span>
            <div className="flex gap-1 flex-wrap">
              {filters.vineyard !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                  {filters.vineyard}
                  <button onClick={() => setFilters(prev => ({ ...prev, vineyard: 'all' }))} className="ml-1 hover:text-blue-900">×</button>
                </span>
              )}
              {filters.grape !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                  {filters.grape}
                  <button onClick={() => setFilters(prev => ({ ...prev, grape: 'all' }))} className="ml-1 hover:text-purple-900">×</button>
                </span>
              )}
              {filters.vintage !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                  {filters.vintage}
                  <button onClick={() => setFilters(prev => ({ ...prev, vintage: 'all' }))} className="ml-1 hover:text-amber-900">×</button>
                </span>
              )}
              {filters.agingStatus !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                  Aging: {filters.agingStatus}
                  <button onClick={() => setFilters(prev => ({ ...prev, agingStatus: 'all' }))} className="ml-1 hover:text-green-900">×</button>
                </span>
              )}
              {filters.features !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
                  Feature: {filters.features}
                  <button onClick={() => setFilters(prev => ({ ...prev, features: 'all' }))} className="ml-1 hover:text-orange-900">×</button>
                </span>
              )}
              <button 
                onClick={() => setFilters({ vineyard: 'all', grape: 'all', vintage: 'all', agingStatus: 'all', features: 'all' })}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wine Cellar Table - Desktop (Hierarchical Vintage Grouping) */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Wine Cellar Inventory</h3>
          <div className="flex gap-2">
            <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800">Expand All</button>
            <button onClick={collapseAll} className="text-xs text-blue-600 hover:text-blue-800">Collapse All</button>
          </div>
        </div>
        
        {sortedBottledWines.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No wines match the current filters
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedVintages.map((vintage) => {
              const vintageWines = winesByVintage[vintage];
              const isExpanded = expandedVintages.has(vintage);
              const vintageBottles = vintageWines.reduce((sum, w) => sum + w.quantity, 0);
              const vintageValue = vintageWines.reduce((sum, w) => sum + (w.quantity * (w.askingPrice ?? w.estimatedPrice)), 0);
              
              return (
                <div key={vintage} className="bg-white">
                  {/* Vintage Header (Collapsible) */}
                  <div 
                    className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex justify-between items-center"
                    onClick={() => toggleVintage(vintage)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Vintage {vintage}</h3>
                        <p className="text-xs text-gray-600">
                          {vintageWines.length} wine{vintageWines.length !== 1 ? 's' : ''} • {vintageBottles} bottles • {formatNumber(vintageValue, { currency: true, decimals: 0 })} total
                        </p>
                      </div>
                    </div>
        </div>
                  
                  {/* Vintage Wines Table (Collapsible) */}
                  {isExpanded && (
        <div className="overflow-x-auto">
          <Table className="text-xs">
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
                              onSort={() => handleCellarSort('agingProgress' as any)}
                              sortIndicator={getCellarSortIndicator('agingProgress' as any)}
                              isSorted={isCellarColumnSorted('agingProgress' as any)}
                              className="w-48"
                            >
                              Aging Progress
                </TableHead>
                            <TableHead>Balance & Quality</TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleCellarSort('wineScore' as any)}
                  sortIndicator={getCellarSortIndicator('wineScore' as any)}
                  isSorted={isCellarColumnSorted('wineScore' as any)}
                >
                              Score
                </TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleCellarSort('estimatedPrice' as any)}
                  sortIndicator={getCellarSortIndicator('estimatedPrice' as any)}
                  isSorted={isCellarColumnSorted('estimatedPrice' as any)}
                >
                              Est. Price
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
                            <TableHead>Features</TableHead>
                            <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                          {vintageWines.map((wine) => (
                            <TableRow key={wine.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">
                        {wine.grape}
                      </TableCell>
                              <TableCell className="text-gray-600">
                        {wine.vineyardName}
                      </TableCell>
                              <TableCell className="text-gray-600">
                                <AgingProgressBar wine={wine} />
                              </TableCell>
                              <TableCell className="text-gray-600">
                                <BalanceAndQualityDisplay batch={wine} />
                      </TableCell>
                              <TableCell className="text-gray-600">
                        <WineScoreDisplay wine={wine} />
                      </TableCell>
                              <TableCell className="text-gray-600 font-medium">
                        <EstimatedPriceDisplay wine={wine} />
                      </TableCell>
                              <TableCell className="text-gray-600 font-medium">
                        {editingPrices[wine.id] !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingPrices[wine.id]}
                              onChange={(e) => handlePriceChange(wine.id, e.target.value)}
                                      className="w-20 px-1.5 py-1 border rounded text-xs"
                            />
                            <button
                              onClick={() => handlePriceSave(wine)}
                              className="text-green-600 hover:text-green-800 text-xs"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handlePriceCancel(wine.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`${
                              wine.askingPrice !== undefined 
                                ? wine.askingPrice < wine.estimatedPrice
                                          ? 'text-red-600 font-medium'
                                  : wine.askingPrice > wine.estimatedPrice
                                          ? 'text-orange-600 font-medium'
                                          : 'text-gray-900'
                                        : 'text-gray-900'
                            }`}>
                              {formatNumber(wine.askingPrice ?? wine.estimatedPrice, { currency: true, decimals: 2 })}
                            </span>
                            {wine.askingPrice !== undefined && wine.askingPrice !== wine.estimatedPrice && (
                              <span className="text-[10px] text-gray-500">
                                {wine.askingPrice < wine.estimatedPrice ? '📉' : '📈'}
                              </span>
                            )}
                            <button
                              onClick={() => handlePriceEdit(wine.id, wine.askingPrice ?? wine.estimatedPrice)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </TableCell>
                              <TableCell className="text-gray-600">
                        {wine.quantity}
                      </TableCell>
                              <TableCell className="text-gray-600">
                                <CompactFeatureIcons wine={wine} />
                              </TableCell>
                      <TableCell>
                                  <Button
                                  onClick={() => onWineDetailsClick(wine.id)}
                                    size="sm"
                                    variant="outline"
                                  className="text-purple-600 border-purple-600 hover:bg-purple-50 text-xs px-2 py-1"
                                >
                                  Details
                                  </Button>
                        </TableCell>
                      </TableRow>
                          ))}
            </TableBody>
          </Table>
        </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wine Cellar Cards - Mobile (Enhanced) */}
      <div className="lg:hidden space-y-4">
        {sortedBottledWines.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No wines match the current filters
          </div>
        ) : (
          sortedVintages.map((vintage) => (
            <div key={vintage} className="space-y-3">
              {/* Vintage Year Header */}
              <div className="bg-gradient-to-r from-amber-100 to-amber-200 rounded-lg p-3 border-l-4 border-amber-500">
                <h2 className="text-lg font-bold text-gray-900">
                  Vintage {vintage}
                </h2>
                <p className="text-sm text-gray-700">
                  {winesByVintage[vintage].length} wine{winesByVintage[vintage].length !== 1 ? 's' : ''} • {winesByVintage[vintage].reduce((sum, w) => sum + w.quantity, 0)} bottles
                </p>
              </div>
              
              {/* Wines for this vintage */}
              <div className="space-y-3 ml-2">
                {winesByVintage[vintage].map((wine) => (
            <div key={wine.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-purple-50 to-amber-50 p-4 border-b">
                <div className="flex justify-between items-start">
                        <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{wine.grape}</h3>
                    <div className="text-sm text-gray-600 mt-1">{wine.vineyardName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                            Vintage {wine.harvestStartDate.year}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    wine.quantity > 0 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {wine.quantity > 0 ? 'Available' : 'Sold Out'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-4">
                      {/* Aging Progress */}
                  <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Aging Progress</div>
                        <AgingProgressBar wine={wine} />
                  </div>

                      {/* Score & Features */}
                      <div className="grid grid-cols-2 gap-4">
                  <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Wine Score</div>
                          <WineScoreDisplay wine={wine} />
                  </div>
                  <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Features</div>
                          <CompactFeatureIcons wine={wine} />
                  </div>
                </div>

                      {/* Pricing */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Estimated Price:</span>
                    <EstimatedPriceDisplay wine={wine} />
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Asking Price:</span>
                    {editingPrices[wine.id] !== undefined ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingPrices[wine.id]}
                          onChange={(e) => handlePriceChange(wine.id, e.target.value)}
                          className="w-24 px-2 py-1 border rounded text-sm"
                        />
                        <button
                          onClick={() => handlePriceSave(wine)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handlePriceCancel(wine.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          wine.askingPrice !== undefined 
                            ? wine.askingPrice < wine.estimatedPrice
                              ? 'text-red-600' 
                              : wine.askingPrice > wine.estimatedPrice
                              ? 'text-orange-600'
                              : 'text-gray-900'
                            : 'text-gray-900'
                        }`}>
                          {formatNumber(wine.askingPrice ?? wine.estimatedPrice, { currency: true, decimals: 2 })}
                        </span>
                        <button
                          onClick={() => handlePriceEdit(wine.id, wine.askingPrice ?? wine.estimatedPrice)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Bottles:</span>
                    <span className="text-lg font-bold text-gray-900">{wine.quantity}</span>
                  </div>
                </div>

                      {/* Wine Details Button */}
                <div className="flex gap-2">
                  <Button
                          onClick={() => onWineDetailsClick(wine.id)}
                    size="sm"
                    variant="outline"
                          className="flex-1 text-purple-600 border-purple-600 hover:bg-purple-50 text-xs"
                        >
                          View Details
                  </Button>
                </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WineCellarTab;
