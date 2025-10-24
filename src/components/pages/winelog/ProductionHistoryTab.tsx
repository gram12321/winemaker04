import React from 'react';
import { WineLogEntry, WineBatch } from '@/lib/types/types';
import { SimpleCard, Badge, Button } from '../../ui';
import { Wine } from 'lucide-react';
import { formatCurrency, formatGameDate, formatPercent } from '@/lib/utils/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/shadCN/tooltip';

interface ProductionHistoryTabProps {
  paginatedWineLog: WineLogEntry[];
  filteredWineLog: WineLogEntry[];
  selectedVineyard: string;
  vineyards: any[];
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  findCorrespondingBatch: (entry: WineLogEntry) => WineBatch | undefined;
  handleWineDetailsClick: (entry: WineLogEntry) => void;
}

// Component for combined balance and quality display (historical data)
const BalanceAndQualityDisplay: React.FC<{ entry: WineLogEntry }> = ({ entry }) => {
  const balancePercentage = Math.round(entry.balance * 100);
  const qualityPercentage = Math.round(entry.grapeQuality * 100);

  return (
    <div className="text-xs text-gray-600 space-y-1">
      <div>
        <span className="font-medium">Balance:</span> <span className="font-medium">{balancePercentage}%</span>
      </div>
      <div>
        <span className="font-medium">Quality:</span> <span className="font-medium">{qualityPercentage}%</span>
      </div>
    </div>
  );
};

// Component for wine score display with tooltip (historical data)
const WineScoreDisplay: React.FC<{ entry: WineLogEntry }> = ({ entry }) => {
  const wineScore = (entry.grapeQuality + entry.balance) / 2;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-full cursor-help">
            {formatPercent(wineScore, 0, true)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Wine Score Calculation</div>
            <div>Grape Quality: <span className="font-medium">{formatPercent(entry.grapeQuality, 1, true)}</span></div>
            <div>Balance: <span className="font-medium">{formatPercent(entry.balance, 1, true)}</span></div>
            <div className="border-t pt-1 mt-1">Wine Score: <span className="font-medium">{formatPercent(wineScore, 1, true)}</span></div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProductionHistoryTab: React.FC<ProductionHistoryTabProps> = ({
  paginatedWineLog,
  filteredWineLog,
  selectedVineyard,
  vineyards,
  page,
  pageSize,
  totalPages,
  setPage,
  findCorrespondingBatch,
  handleWineDetailsClick
}) => {
  const formatHarvestPeriod = (harvestDate: WineLogEntry['harvestDate']): string => {
    const start = `Week ${harvestDate.week}, ${harvestDate.season} ${harvestDate.year}`;
    return `${start} - ${start}`;
  };

  return (
    <SimpleCard
      title={selectedVineyard === 'all' ? 'All Wine Production' : `${vineyards.find(v => v.id === selectedVineyard)?.name} Production`}
      description={`${filteredWineLog.length} wine${filteredWineLog.length !== 1 ? 's' : ''} bottled`}
    >
      {paginatedWineLog.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Wine className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No wines have been bottled yet.</p>
          <p className="text-sm mt-1">Complete wine production in the winery to see entries here.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-gray-500">
                  <th className="pb-3">Wine</th>
                  <th className="pb-3">Vineyard</th>
                  <th className="pb-3">Vintage</th>
                  <th className="pb-3">Harvest Period</th>
                  <th className="pb-3">Bottles</th>
                  <th className="pb-3">Balance & Quality</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">Bottled</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedWineLog.map((entry) => {
                  const correspondingBatch = findCorrespondingBatch(entry);
                  
                  return (
                    <tr key={entry.id} className="text-sm hover:bg-gray-50">
                      <td className="py-3">
                        <div className="font-medium text-gray-900">
                          {entry.grape}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="text-gray-600">{entry.vineyardName}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">{entry.vintage}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="text-gray-600">{formatHarvestPeriod(entry.harvestDate)}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-medium">{entry.quantity} bottles</div>
                      </td>
                      <td className="py-3">
                        <BalanceAndQualityDisplay entry={entry} />
                      </td>
                      <td className="py-3">
                        <WineScoreDisplay entry={entry} />
                      </td>
                      <td className="py-3">
                        <div className="font-medium">{formatCurrency(entry.estimatedPrice)}</div>
                        <div className="text-xs text-gray-500">per bottle</div>
                      </td>
                      <td className="py-3">
                        <div className="text-gray-600">
                          {formatGameDate(entry.bottledDate.week, entry.bottledDate.season, entry.bottledDate.year)}
                        </div>
                      </td>
                      <td className="py-3">
                        {correspondingBatch ? (
                          <Button
                            onClick={() => handleWineDetailsClick(entry)}
                            size="sm"
                            variant="outline"
                            className="text-purple-600 border-purple-600 hover:bg-purple-50 text-xs px-2 py-1"
                          >
                            View Details
                          </Button>
                        ) : (
                          <div className="text-xs text-gray-400">
                            <div className="font-medium">Sold out</div>
                            <div className="text-[10px] text-gray-400">
                              Log: bottled state
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Desktop Pagination Controls */}
            {filteredWineLog.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredWineLog.length)} of {filteredWineLog.length} wines
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page >= totalPages}
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {paginatedWineLog.map((entry) => {
              const correspondingBatch = findCorrespondingBatch(entry);
              
              return (
                <div key={entry.id} className="bg-white rounded-lg shadow overflow-hidden border">
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 border-b">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{entry.grape}</h3>
                        <div className="text-sm text-gray-600 mt-1">{entry.vineyardName}</div>
                      </div>
                      <Badge variant="outline" className="text-sm">{entry.vintage}</Badge>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Score and Balance/Quality */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Wine Score</div>
                        <WineScoreDisplay entry={entry} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Price</div>
                        <div className="text-base font-bold text-green-600">
                          {formatCurrency(entry.estimatedPrice)}
                        </div>
                        <div className="text-xs text-gray-500">per bottle</div>
                      </div>
                    </div>
                    
                    {/* Balance & Quality Details */}
                    <div>
                      <BalanceAndQualityDisplay entry={entry} />
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bottles:</span>
                        <span className="font-medium">{entry.quantity} bottles</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Harvest Period:</span>
                        <span className="font-medium">{formatHarvestPeriod(entry.harvestDate)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bottled:</span>
                        <span className="font-medium">{formatGameDate(entry.bottledDate.week, entry.bottledDate.season, entry.bottledDate.year)}</span>
                      </div>
                    </div>

                    {/* View Details Button */}
                    {correspondingBatch && (
                      <div className="border-t pt-3">
                        <Button
                          onClick={() => handleWineDetailsClick(entry)}
                          size="sm"
                          variant="outline"
                          className="w-full text-purple-600 border-purple-600 hover:bg-purple-50 text-xs"
                        >
                          View Wine Details
                        </Button>
                      </div>
                    )}
                    
                    {!correspondingBatch && (
                      <div className="border-t pt-3 text-center text-xs text-gray-500">
                        <div className="font-medium text-gray-600 mb-1">Fully Sold</div>
                        <div>This wine has been completely sold - no current data available</div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Log shows bottled state • Features evolved until last bottle sold
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination */}
            {filteredWineLog.length > pageSize && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500 mb-3 text-center">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredWineLog.length)} of {filteredWineLog.length} wines
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <div className="flex items-center px-3 text-sm">
                    {page} / {totalPages}
                  </div>
                  <button
                    className="flex-1 px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SimpleCard>
  );
};

export default ProductionHistoryTab;


