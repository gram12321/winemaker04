import React, { useState, useCallback } from 'react';
import { useGameStateWithData } from '@/hooks';
import { getAllVineyards } from '@/lib/services';
import { loadWineLog } from '@/lib/database';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { WineLogEntry, WineBatch } from '@/lib/types/types';
import { Tabs, TabsContent, TabsList, TabsTrigger, Card, CardContent, CardHeader, CardTitle, CardDescription, WineModal } from '../ui';
import { Wine, Award, BarChart3 } from 'lucide-react';
import { getGrapeQualityCategory, getColorClass, formatNumber } from '@/lib/utils/utils';
import { CompanyProps } from '@/lib/types/UItypes';
import ProductionHistoryTab from './winelog/ProductionHistoryTab';
import VineyardStatisticsTab from './winelog/VineyardStatisticsTab';

interface WineLogProps extends CompanyProps {
  // Inherits currentCompany from CompanyProps
}

export function WineLog({ currentCompany }: WineLogProps) {
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  
  // Wine modal state
  const [wineModalOpen, setWineModalOpen] = useState(false);
  const [selectedWineBatch, setSelectedWineBatch] = useState<WineBatch | null>(null);
  
  const wineLog = useGameStateWithData(loadWineLog, []);
  const vineyards = useGameStateWithData(getAllVineyards, []);
  
  // Load current wine batches to link log entries to live wines
  const allBatches = useGameStateWithData(
    () => loadWineBatches(),
    []
  );

  const filteredWineLog = React.useMemo(() => 
    selectedVineyard === 'all' 
      ? wineLog 
      : wineLog.filter(entry => entry.vineyardId === selectedVineyard),
    [wineLog, selectedVineyard]
  );

  const paginatedWineLog = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWineLog.slice(start, start + pageSize);
  }, [filteredWineLog, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedVineyard]);

  const totalPages = Math.max(1, Math.ceil(filteredWineLog.length / pageSize));

  
  // Find corresponding wine batch for a log entry (if still exists)
  const findCorrespondingBatch = useCallback((entry: WineLogEntry): WineBatch | undefined => {
    return allBatches.find(batch => 
      batch.vineyardId === entry.vineyardId &&
      batch.grape === entry.grape &&
      batch.harvestStartDate.year === entry.vintage
    );
  }, [allBatches]);
  
  // Handle opening wine modal
  const handleWineDetailsClick = useCallback((entry: WineLogEntry) => {
    const batch = findCorrespondingBatch(entry);
    if (batch) {
      setSelectedWineBatch(batch);
      setWineModalOpen(true);
    }
  }, [findCorrespondingBatch]);
  
  // Handle closing wine modal
  const handleWineModalClose = useCallback(() => {
    setWineModalOpen(false);
    setSelectedWineBatch(null);
  }, []);

  const vineyardGroups = React.useMemo(() => 
    wineLog.reduce((groups, entry) => {
      if (!groups[entry.vineyardId]) {
        groups[entry.vineyardId] = [];
      }
      groups[entry.vineyardId].push(entry);
      return groups;
    }, {} as Record<string, WineLogEntry[]>),
    [wineLog]
  );

  // Memoize overall statistics
  const statistics = React.useMemo(() => {
    const totalBottles = wineLog.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalVintages = wineLog.length;
    const averageQuality = wineLog.length > 0 
      ? wineLog.reduce((sum, entry) => sum + entry.grapeQuality, 0) / wineLog.length 
      : 0;
    return { totalBottles, totalVintages, averageQuality };
  }, [wineLog]);

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5" />
              No Active Company
            </CardTitle>
            <CardDescription>
              You need to select a company to view wine production history
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3 mb-2">
          <Wine className="h-6 w-6 text-purple-600" />
          Wine Production Log
        </h3>
        <p className="text-muted-foreground">
          Complete history of wines produced and bottled by {currentCompany.name}
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="text-blue-600 text-sm">ℹ️</div>
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> This log shows grape quality and characteristics <strong>at bottling time</strong>. 
              For wines still in your cellar, features may continue evolving until the last bottle is sold. 
              Use "View Details" to see current wine state.
            </div>
          </div>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wine className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatNumber(statistics.totalBottles, { decimals: 0, forceDecimals: true })}</div>
                <div className="text-sm text-gray-500">Total Bottles Produced</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{statistics.totalVintages}</div>
                <div className="text-sm text-gray-500">Wine Batches Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className={`text-2xl font-bold ${getColorClass(statistics.averageQuality)}`}>
                  {getGrapeQualityCategory(statistics.averageQuality)}
                </div>
                <div className="text-sm text-gray-500">Average Quality</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history">Production History</TabsTrigger>
          <TabsTrigger value="vineyard-stats">Vineyard Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          {/* Vineyard Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedVineyard('all')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedVineyard === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Vineyards ({wineLog.length})
                </button>
                {vineyards.map(vineyard => {
                  const count = vineyardGroups[vineyard.id]?.length || 0;
                  return (
                    <button
                      key={vineyard.id}
                      onClick={() => setSelectedVineyard(vineyard.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedVineyard === vineyard.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {vineyard.name} ({count})
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Wine History Table - Using Dedicated Component */}
          <ProductionHistoryTab
            paginatedWineLog={paginatedWineLog}
            filteredWineLog={filteredWineLog}
            selectedVineyard={selectedVineyard}
            vineyards={vineyards}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            setPage={setPage}
            findCorrespondingBatch={findCorrespondingBatch}
            handleWineDetailsClick={handleWineDetailsClick}
          />
        </TabsContent>

        <TabsContent value="vineyard-stats" className="space-y-4">
          <VineyardStatisticsTab
            vineyards={vineyards}
            vineyardGroups={vineyardGroups}
            allBatches={allBatches}
          />
        </TabsContent>
      </Tabs>
      
      {/* Wine Modal */}
      <WineModal
        isOpen={wineModalOpen}
        onClose={handleWineModalClose}
        wineBatch={selectedWineBatch}
        wineName={selectedWineBatch ? `${selectedWineBatch.grape} - ${selectedWineBatch.vineyardName}` : "Wine"}
      />
    </div>
  );
}
