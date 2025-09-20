import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Separator } from './separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Star, TrendingUp, Grape, DollarSign } from 'lucide-react';
import { PrestigeEvent } from '../../lib/types';
import { formatNumber, formatPercent } from '@/lib/utils/utils';
import { getVineyardPrestigeEventCalculation } from '@/lib/database/prestigeService';

interface PrestigeEventDisplay extends PrestigeEvent {
  originalAmount: number;
  currentAmount: number;
}

interface PrestigeModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPrestige: number;
  eventBreakdown: PrestigeEventDisplay[];
  companyPrestige?: number;
  vineyardPrestige?: number;
  vineyards?: Array<{
    id: string;
    name: string;
    prestige: number;
    events: Array<{
      id: string;
      type: string;
      description: string;
      originalAmount: number;
      currentAmount: number;
      decayRate: number;
    }>;
  }>;
}

const PrestigeModal: React.FC<PrestigeModalProps> = ({ 
  isOpen, 
  onClose, 
  totalPrestige, 
  eventBreakdown,
  companyPrestige = 0,
  vineyardPrestige = 0,
  vineyards = []
}) => {
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'company_value':
        return <DollarSign className="h-4 w-4" />;
      case 'vineyard':
        return <Grape className="h-4 w-4" />;
      case 'sale':
        return <TrendingUp className="h-4 w-4" />;
      case 'vineyard_sale':
        return <Grape className="h-4 w-4" />;
      case 'vineyard_base':
        return <Grape className="h-4 w-4" />;
      case 'vineyard_achievement':
        return <Star className="h-4 w-4" />;
      case 'vineyard_age':
        return <Star className="h-4 w-4" />;
      case 'vineyard_land':
        return <DollarSign className="h-4 w-4" />;
      case 'contract':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'company_value':
        return 'Company Value';
      case 'vineyard':
        return 'Vineyard (Legacy)';
      case 'sale':
        return 'Company Sales';
      case 'vineyard_sale':
        return 'Vineyard Sales';
      case 'vineyard_base':
        return 'Vineyard Base';
      case 'vineyard_achievement':
        return 'Vineyard Achievements';
      case 'vineyard_age':
        return 'Vine Age';
      case 'vineyard_land':
        return 'Land Value';
      case 'contract':
        return 'Contracts';
      case 'penalty':
        return 'Penalties';
      default:
        return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'company_value':
        return 'bg-blue-100 text-blue-800';
      case 'vineyard':
        return 'bg-green-100 text-green-800';
      case 'sale':
        return 'bg-emerald-100 text-emerald-800';
      case 'vineyard_sale':
        return 'bg-green-100 text-green-800';
      case 'vineyard_base':
        return 'bg-blue-100 text-blue-800';
      case 'vineyard_achievement':
        return 'bg-yellow-100 text-yellow-800';
      case 'vineyard_age':
        return 'bg-orange-100 text-orange-800';
      case 'vineyard_land':
        return 'bg-green-100 text-green-800';
      case 'contract':
        return 'bg-purple-100 text-purple-800';
      case 'penalty':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDecayRate = (decayRate: number) => {
    if (decayRate === 0) return 'No decay';
    const weeklyDecay = (1 - decayRate) * 100;
    return `${formatPercent(weeklyDecay / 100, 1, true)} weekly decay`;
  };

  const formatAmount = (amount: number) => {
    return formatNumber(amount, { decimals: 2, forceDecimals: true });
  };

  // Get filtered vineyard data based on selection
  const getFilteredVineyards = () => {
    if (selectedVineyard === 'all') {
      return vineyards;
    }
    return vineyards.filter(vineyard => vineyard.id === selectedVineyard);
  };

  // Separate company events (vineyard events are now handled via vineyards prop)
  const companyEvents = eventBreakdown.filter(event => 
    ['company_value', 'sale', 'contract', 'penalty'].includes(event.type)
  );

  // Group company events by type
  const groupedCompanyEvents = companyEvents.reduce((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = [];
    }
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, PrestigeEventDisplay[]>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Company Prestige Breakdown
          </DialogTitle>
          <DialogDescription>
            View detailed breakdown of your company's prestige from various sources including sales, vineyards, and company value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Prestige Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Total Prestige</span>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  <Star className="h-4 w-4 mr-1" />
                  {formatAmount(totalPrestige)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your company's total prestige is calculated from various sources. 
                  Some prestige sources decay over time, while others remain constant.
                </p>
                
                {/* Company vs Vineyard Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Company Prestige</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900 mt-1">
                      {formatAmount(companyPrestige)}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Grape className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Vineyard Prestige</span>
                    </div>
                    <p className="text-lg font-bold text-green-900 mt-1">
                      {formatAmount(vineyardPrestige)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Prestige Sources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Company Prestige Sources
            </h3>
            
            {Object.keys(groupedCompanyEvents).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No company prestige events found.
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedCompanyEvents).map(([type, events]) => (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getEventIcon(type)}
                      {getEventTypeLabel(type)}
                      <Badge className={getEventTypeColor(type)}>
                        {events.length} {events.length === 1 ? 'source' : 'sources'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {events.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm font-medium cursor-help">{event.description}</p>
                                </TooltipTrigger>
                                {(() => {
                                  const tooltipText = getVineyardPrestigeEventCalculation(event);
                                  return tooltipText ? (
                                    <TooltipContent>
                                      <p className="text-xs">{tooltipText}</p>
                                    </TooltipContent>
                                  ) : null;
                                })()}
                              </Tooltip>
                            </TooltipProvider>
                            <p className="text-xs text-muted-foreground">
                              {formatDecayRate(event.decayRate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatAmount(event.currentAmount)}
                            </p>
                            {event.originalAmount !== event.currentAmount && (
                              <p className="text-xs text-muted-foreground">
                                (was {formatAmount(event.originalAmount)})
                              </p>
                            )}
                          </div>
                        </div>
                        {index < events.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Vineyard Prestige Sources */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Grape className="h-5 w-5 text-green-600" />
                Vineyard Prestige Sources
              </h3>
              
              {/* Vineyard Filter */}
              {vineyards.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedVineyard('all')}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      selectedVineyard === 'all'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Vineyards
                  </button>
                  {vineyards.map((vineyard) => (
                    <button
                      key={vineyard.id}
                      onClick={() => setSelectedVineyard(vineyard.id)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        selectedVineyard === vineyard.id
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {vineyard.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {getFilteredVineyards().length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No vineyard prestige events found.
                </CardContent>
              </Card>
            ) : selectedVineyard === 'all' ? (
              // Summary view for "All Vineyards"
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Grape className="h-4 w-4 text-green-600" />
                    All Vineyards Summary
                    <Badge className="bg-green-100 text-green-800">
                      {vineyards.length} {vineyards.length === 1 ? 'vineyard' : 'vineyards'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {vineyards.map((vineyard) => (
                      <div key={vineyard.id} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Grape className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">{vineyard.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {vineyard.events.length} {vineyard.events.length === 1 ? 'source' : 'sources'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-green-900">
                            {formatAmount(vineyard.prestige)} prestige
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Detailed view for selected vineyard
              <div className="space-y-3">
                {getFilteredVineyards().map((vineyard) => (
                  <Card key={vineyard.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Grape className="h-4 w-4 text-green-600" />
                        {vineyard.name}
                        <Badge className="bg-green-100 text-green-800">
                          {vineyard.events.length} {vineyard.events.length === 1 ? 'source' : 'sources'}
                        </Badge>
                        <Badge variant="outline" className="ml-auto">
                          {formatAmount(vineyard.prestige)} prestige
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {vineyard.events.map((event, index) => (
                        <div key={event.id}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="text-sm font-medium cursor-help">{event.description}</p>
                                  </TooltipTrigger>
                                {(() => {
                                  const tooltipText = getVineyardPrestigeEventCalculation(event);
                                  return tooltipText ? (
                                    <TooltipContent>
                                      <p className="text-xs">{tooltipText}</p>
                                    </TooltipContent>
                                  ) : null;
                                })()}
                                </Tooltip>
                              </TooltipProvider>
                              <p className="text-xs text-muted-foreground">
                                {formatDecayRate(event.decayRate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {formatAmount(event.currentAmount)}
                              </p>
                              {event.originalAmount !== event.currentAmount && (
                                <p className="text-xs text-muted-foreground">
                                  (was {formatAmount(event.originalAmount)})
                                </p>
                              )}
                            </div>
                          </div>
                          {index < vineyard.events.length - 1 && <Separator className="mt-3" />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Prestige Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span><strong>Company Value:</strong> Based on your total money (€10M = 1 prestige)</span>
              </div>
              <div className="flex items-center gap-2">
                <Grape className="h-4 w-4 text-green-500" />
                <span><strong>Vineyards:</strong> Each vineyard contributes prestige (currently 1 per vineyard)</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span><strong>Sales:</strong> Wine sales add prestige (€10K = 1 prestige, decays 5% weekly)</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <span><strong>Contracts:</strong> Future feature for contract-based prestige</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrestigeModal;
