// Wine production log component - shows history of bottled wines by vineyard
import { useState } from 'react';
import { useGameStateWithData } from '@/hooks';
import { 
  loadWineLog, 
  calculateVineyardStats,
  getAllVineyards,
  type VineyardStats 
} from '@/lib/services';
import { WineLogEntry, Vineyard } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';
import { Wine, TrendingUp, Award, Calendar, BarChart3 } from 'lucide-react';
import { 
  getWineQualityCategory, 
  getColorCategory, 
  getColorClass, 
  formatCurrency,
  formatGameDate 
} from '@/lib/utils/utils';

interface WineLogProps {
  currentCompany?: any;
}

export function WineLog({ currentCompany }: WineLogProps) {
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');
  const wineLog = useGameStateWithData(loadWineLog, []);
  const vineyards = useGameStateWithData(getAllVineyards, []);

  // Filter wine log by selected vineyard
  const filteredWineLog = selectedVineyard === 'all' 
    ? wineLog 
    : wineLog.filter(entry => entry.vineyardId === selectedVineyard);

  // Group wine log entries by vineyard for statistics
  const vineyardGroups = wineLog.reduce((groups, entry) => {
    if (!groups[entry.vineyardId]) {
      groups[entry.vineyardId] = [];
    }
    groups[entry.vineyardId].push(entry);
    return groups;
  }, {} as Record<string, WineLogEntry[]>);

  // Calculate overall statistics
  const totalBottles = wineLog.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalVintages = wineLog.length;
  const averageQuality = wineLog.length > 0 
    ? wineLog.reduce((sum, entry) => sum + entry.quality, 0) / wineLog.length 
    : 0;

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
                <div className="text-2xl font-bold">{totalBottles.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">{totalVintages}</div>
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
                <div className={`text-2xl font-bold ${getColorClass(averageQuality)}`}>
                  {getWineQualityCategory(averageQuality)}
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

          {/* Wine History Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedVineyard === 'all' ? 'All Wine Production' : `${vineyards.find(v => v.id === selectedVineyard)?.name} Production`}
              </CardTitle>
              <CardDescription>
                {filteredWineLog.length} wine{filteredWineLog.length !== 1 ? 's' : ''} bottled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredWineLog.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Wine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No wines have been bottled yet.</p>
                  <p className="text-sm mt-1">Complete wine production in the winery to see entries here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left text-sm text-gray-500">
                        <th className="pb-3">Wine</th>
                        <th className="pb-3">Vineyard</th>
                        <th className="pb-3">Vintage</th>
                        <th className="pb-3">Quantity</th>
                        <th className="pb-3">Quality</th>
                        <th className="pb-3">Price</th>
                        <th className="pb-3">Bottled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredWineLog.map((entry) => (
                        <tr key={entry.id} className="text-sm">
                          <td className="py-3">
                            <div className="font-medium">{entry.grape}</div>
                          </td>
                          <td className="py-3">
                            <div className="text-gray-600">{entry.vineyardName}</div>
                          </td>
                          <td className="py-3">
                            <Badge variant="outline">{entry.vintage}</Badge>
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{entry.quantity} bottles</div>
                          </td>
                          <td className="py-3">
                            <div className={`font-medium ${getColorClass(entry.quality)}`}>
                              {getWineQualityCategory(entry.quality)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getColorCategory(entry.quality)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{formatCurrency(entry.finalPrice)}</div>
                            <div className="text-xs text-gray-500">per bottle</div>
                          </td>
                          <td className="py-3">
                            <div className="text-gray-600">
                              {formatGameDate(entry.bottledDate.week, entry.bottledDate.season, entry.bottledDate.year)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vineyard-stats" className="space-y-4">
          {/* Vineyard Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vineyards.map(vineyard => {
              const vineyardEntries = vineyardGroups[vineyard.id] || [];
              const hasProduction = vineyardEntries.length > 0;
              
              if (!hasProduction) return null;

              const totalBottles = vineyardEntries.reduce((sum, entry) => sum + entry.quantity, 0);
              const avgQuality = vineyardEntries.reduce((sum, entry) => sum + entry.quality, 0) / vineyardEntries.length;
              const avgPrice = vineyardEntries.reduce((sum, entry) => sum + entry.finalPrice, 0) / vineyardEntries.length;
              const bestWine = vineyardEntries.reduce((best, entry) => 
                !best || entry.quality > best.quality ? entry : best
              );

              return (
                <Card key={vineyard.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{vineyard.name}</CardTitle>
                    <CardDescription>{vineyard.region}, {vineyard.country}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold">{totalBottles}</div>
                        <div className="text-sm text-gray-500">Total Bottles</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{vineyardEntries.length}</div>
                        <div className="text-sm text-gray-500">Vintages</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Average Quality:</span>
                        <span className={`text-sm font-medium ${getColorClass(avgQuality)}`}>
                          {getWineQualityCategory(avgQuality)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Average Price:</span>
                        <span className="text-sm font-medium">{formatCurrency(avgPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Best Wine:</span>
                        <span className={`text-sm font-medium ${getColorClass(bestWine.quality)}`}>
                          {bestWine.vintage} {bestWine.grape}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {Object.keys(vineyardGroups).length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Data</h3>
                <p className="text-gray-500">
                  Start producing and bottling wines to see vineyard statistics here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
