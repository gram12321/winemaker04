import React, { useState } from 'react';
import { WineBatch } from '@/lib/types/types';
import { formatCurrency, formatNumber, formatPercent, formatGameDateFromObject, getWineQualityCategory, getColorCategory, getColorClass } from '@/lib/utils/utils';
import { SALES_CONSTANTS } from '@/lib/constants';
import { calculateAsymmetricalMultiplier } from '@/lib/utils/calculator';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, FeatureBadges } from '../../ui';
import { useWineBatchBalance, useFormattedBalance, useBalanceQuality, useWineCombinedScore, useWineFeatureDetails } from '@/hooks';
import { saveWineBatch } from '@/lib/database/activities/inventoryDB';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures';


// Component for wine batch balance display (needed to use hooks properly)
const WineBatchBalanceDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const balanceResult = useWineBatchBalance(batch);
  const formattedBalance = useFormattedBalance(balanceResult);
  const balanceQuality = useBalanceQuality(balanceResult);
  const colorClass = getColorClass(batch.balance);
  
  return (
    <div className="text-xs text-gray-600">
      <span className="font-medium">Balance:</span> <span className={`font-medium ${colorClass}`}>{formattedBalance}</span> ({balanceQuality})
    </div>
  );
};

// Component for wine quality category display
const WineQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const qualityCategory = getWineQualityCategory(batch.quality);
  const qualityLabel = getColorCategory(batch.quality);
  const colorClass = getColorClass(batch.quality);

  return (
    <div className="text-xs text-gray-600">
      <span className="font-medium">Quality:</span> <span className={`font-medium ${colorClass}`}>{qualityCategory}</span> ({qualityLabel})
    </div>
  );
};

// Component for wine characteristics display with icons and percentages
const WineCharacteristicsDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const characteristics = wine.characteristics;

  const characteristicLabels: Record<string, string> = {
    sweetness: 'sweetness',
    body: 'body',
    tannins: 'tannins',
    spice: 'spice',
    acidity: 'acidity',
    aroma: 'aroma',
    finish: 'finish'
  };

  return (
    <div className="text-xs space-y-1">
      {Object.entries(characteristics).map(([key, value]) => {
        const label = characteristicLabels[key] || key;
        const percentage = Math.round(value * 100);
        const isPositive = percentage > 0;
        const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
        
        return (
          <div key={key} className="flex items-center gap-1">
            <img 
              src={`/assets/icons/characteristics/${key}.png`} 
              alt={key}
              className="w-3 h-3"
            />
            <span className={colorClass}>
              {label}: {isPositive ? '+' : ''}{percentage}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Component for combined feature effects display
const WineFeatureEffectsDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const configs = getAllFeatureConfigs();
  const features = wine.features || [];
  
  // Get manifested features (features that are present)
  const manifestedFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      if (feature?.isPresent) {
        return { feature, config };
      }
      return null;
    })
    .filter(Boolean) as Array<{ feature: any; config: any }>;
  
  if (manifestedFeatures.length === 0) {
    return (
      <div className="text-xs text-gray-500">
        No active features
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      <FeatureBadges 
        features={features} 
        configs={configs}
        showSeverity
      />
    </div>
  );
};

// Component for wine score display with tooltip
const WineScoreDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
  const wineScoreData = useWineCombinedScore(wine);
  const featureDetails = useWineFeatureDetails(wine);
  
  if (!wineScoreData || !featureDetails) return null;
  
  const { effectiveQuality, qualityPenalty, presentFeatures, hasFaults } = featureDetails;
  
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
            <div>Base Quality: <span className="font-medium">{formatPercent(wine.quality, 1, true)}</span></div>
            {hasFaults && qualityPenalty > 0.001 && (
              <>
                <div className="text-red-600">
                  Feature Penalty: <span className="font-medium">-{formatPercent(qualityPenalty, 1, true)}</span>
                </div>
                <div className="ml-2 text-xs text-gray-600">
                  {presentFeatures.map((f: any, idx: number) => (
                    <div key={idx}>• {f.feature.icon} {f.config.name}</div>
                  ))}
                </div>
                <div>Effective Quality: <span className="font-medium">{formatPercent(effectiveQuality, 1, true)}</span></div>
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
  
  const { presentFeatures, hasFaults, priceImpact } = featureDetails;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{formatCurrency(wine.estimatedPrice, 2)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Estimated Price Calculation</div>
            <div>Wine Score: <span className="font-medium">{wineScoreData.formattedScore}</span></div>
            {hasFaults && priceImpact && priceImpact.priceDifference > 0.01 && (
              <>
                <div className="text-red-600 text-[10px]">
                  ⚠️ Price reduced by {formatCurrency(priceImpact.priceDifference, 2)} due to:
                </div>
                <div className="ml-2 text-[10px] text-gray-600">
                  {presentFeatures.map((f: any, idx: number) => (
                    <div key={idx}>• {f.feature.icon} {f.config.name}</div>
                  ))}
                </div>
              </>
            )}
            <div className="border-t pt-1 mt-1">Base Rate: <span className="font-medium">{formatCurrency(baseRate, 2)}/bottle</span></div>
            <div>Base Price: <span className="font-medium">{formatCurrency(basePrice, 2)}</span></div>
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

// Helper function to format harvest period (start and end dates)
const formatHarvestPeriod = (wine: WineBatch): string => {
  const startDate = formatGameDateFromObject(wine.harvestStartDate);
  const endDate = formatGameDateFromObject(wine.harvestEndDate);
  return `${startDate} - ${endDate}`;
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

  // Define sortable columns for wine cellar
  const cellarColumns: SortableColumn<WineBatch>[] = [
    { key: 'grape', label: 'Wine', sortable: true },
    { key: 'vineyardName', label: 'Vineyard', sortable: true },
    { key: 'harvestStartDate', label: 'Vintage', sortable: true, accessor: (wine) => wine.harvestStartDate.year },
    { 
      key: 'harvestStartDate', 
      label: 'Harvest Period', 
      sortable: true,
      accessor: (wine) => formatHarvestPeriod(wine)
    },
    { 
      key: 'wineScore' as any, 
      label: 'Wine Score', 
      sortable: true,
      accessor: (wine) => (wine.quality + wine.balance) / 2
    },
    { key: 'estimatedPrice' as any, label: 'Estimated Price', sortable: true },
    { 
      key: 'askingPrice', 
      label: 'Asking Price', 
      sortable: true,
      accessor: (wine) => wine.askingPrice ?? wine.estimatedPrice
    },
    { key: 'quantity', label: 'Bottles', sortable: true },
    { key: 'balance' as any, label: 'Balance', sortable: false },
    { key: 'characteristics' as any, label: 'Features', sortable: false },
    { key: 'quality' as any, label: 'Quality', sortable: false },
    { key: 'features' as any, label: 'Feature Effects', sortable: false },
    { key: 'actions' as any, label: 'Actions', sortable: false }
  ];

  const {
    sortedData: sortedBottledWines,
    handleSort: handleCellarSort,
    getSortIndicator: getCellarSortIndicator,
    isColumnSorted: isCellarColumnSorted
  } = useTableSortWithAccessors(bottledWines, cellarColumns);

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

  return (
    <div className="space-y-3">
      {/* Wine Cellar Filter */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Wine Cellar Filter</h3>
            <p className="text-gray-500 text-xs">Filter wines by availability</p>
          </div>
          <div className="flex space-x-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showSoldOut}
                onChange={(e) => setShowSoldOut(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium">Show Sold Out Wines</span>
            </label>
          </div>
        </div>
      </div>

      {/* Wine Cellar Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold">Bottled Wines Available for Sale</h3>
        </div>
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
                  onSort={() => handleCellarSort('harvestStartDate')}
                  sortIndicator={getCellarSortIndicator('harvestStartDate')}
                  isSorted={isCellarColumnSorted('harvestStartDate')}
                >
                  Vintage
                </TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleCellarSort('harvestStartDate')}
                  sortIndicator={getCellarSortIndicator('harvestStartDate')}
                  isSorted={isCellarColumnSorted('harvestStartDate')}
                >
                  Harvest Period
                </TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleCellarSort('wineScore' as any)}
                  sortIndicator={getCellarSortIndicator('wineScore' as any)}
                  isSorted={isCellarColumnSorted('wineScore' as any)}
                >
                  Wine Score
                </TableHead>
                <TableHead 
                  sortable 
                  onSort={() => handleCellarSort('estimatedPrice' as any)}
                  sortIndicator={getCellarSortIndicator('estimatedPrice' as any)}
                  isSorted={isCellarColumnSorted('estimatedPrice' as any)}
                >
                  Estimated Price
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
                <TableHead>Balance</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Feature Effects</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBottledWines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-gray-500 py-6">
                    No bottled wines available for sale
                  </TableCell>
                </TableRow>
              ) : (
                sortedBottledWines.map((wine) => (
                  <React.Fragment key={wine.id}>
                    <TableRow>
                      <TableCell className="font-medium text-gray-900">
                        {wine.grape}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.vineyardName}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {wine.harvestStartDate.year}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatHarvestPeriod(wine)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <WineScoreDisplay wine={wine} />
                      </TableCell>
                      <TableCell className="text-gray-500 font-medium">
                        <EstimatedPriceDisplay wine={wine} />
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
                              className="w-16 px-1.5 py-1 border rounded text-xs"
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
                                  ? 'text-red-600 font-medium' // Discounted
                                  : wine.askingPrice > wine.estimatedPrice
                                  ? 'text-orange-600 font-medium' // Premium
                                  : 'text-gray-900' // Same as base
                                : 'text-gray-900' // Default
                            }`}>
                              {formatCurrency(wine.askingPrice ?? wine.estimatedPrice, 2)}
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
                      <TableCell className="text-gray-500">
                        {wine.quantity}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <WineBatchBalanceDisplay batch={wine} />
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <WineCharacteristicsDisplay wine={wine} />
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <WineQualityDisplay batch={wine} />
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <WineFeatureEffectsDisplay wine={wine} />
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
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Wine Cellar Cards - Mobile */}
      <div className="lg:hidden space-y-4">
        {sortedBottledWines.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No bottled wines available for sale
          </div>
        ) : (
          sortedBottledWines.map((wine) => (
            <div key={wine.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-purple-50 to-amber-50 p-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{wine.grape}</h3>
                    <div className="text-sm text-gray-600 mt-1">{wine.vineyardName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Vintage {wine.harvestStartDate.year} • {formatHarvestPeriod(wine)}
                      {wine.bottledDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          Completed: Week {wine.bottledDate.week}, {wine.bottledDate.season} {wine.bottledDate.year}
                        </div>
                      )}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Quality</div>
                    <WineQualityDisplay batch={wine} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Wine Score</div>
                    <WineScoreDisplay wine={wine} />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs text-gray-500 uppercase mb-1">Features</div>
                  <WineFeatureEffectsDisplay wine={wine} />
                </div>

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
                          {formatCurrency(wine.askingPrice ?? wine.estimatedPrice, 2)}
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
                    Wine Details
                  </Button>
                </div>


              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WineCellarTab;
