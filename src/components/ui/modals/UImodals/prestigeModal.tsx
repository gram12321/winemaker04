import React, { useState } from 'react';
import { PrestigeEvent } from '@/lib/types/types';
import { formatNumber, formatPercent } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Badge } from '../../shadCN/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Separator } from '../../shadCN/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shadCN/tooltip';
import { Star, TrendingUp, Grape, DollarSign } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';

/**
 * Prestige Modal
 * Modal for displaying detailed prestige breakdown and sources
 */
interface PrestigeModalProps extends DialogProps {
  totalPrestige: number;
  eventBreakdown: PrestigeEvent[];
  companyPrestige?: number;
  vineyardPrestige?: number;
  vineyards?: Array<{
    id: string;
    name: string;
    prestige: number;
    events: PrestigeEvent[];
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
  // State initialization
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');

  const eventConfig = {
    company_value: { icon: DollarSign, label: 'Company Value', color: 'bg-blue-100 text-blue-800' },
    vineyard: { icon: Grape, label: 'Vineyard (Legacy)', color: 'bg-green-100 text-green-800' },
    sale: { icon: TrendingUp, label: 'Company Sales', color: 'bg-emerald-100 text-emerald-800' },
    vineyard_sale: { icon: Grape, label: 'Vineyard Sales', color: 'bg-green-100 text-green-800' },
    vineyard_base: { icon: Grape, label: 'Vineyard Base', color: 'bg-blue-100 text-blue-800' },
    vineyard_achievement: { icon: Star, label: 'Vineyard Achievements', color: 'bg-yellow-100 text-yellow-800' },
    vineyard_age: { icon: Star, label: 'Vine Age', color: 'bg-orange-100 text-orange-800' },
    vineyard_land: { icon: DollarSign, label: 'Land Value', color: 'bg-green-100 text-green-800' },
    contract: { icon: DollarSign, label: 'Contracts', color: 'bg-purple-100 text-purple-800' },
    penalty: { icon: Star, label: 'Penalties', color: 'bg-red-100 text-red-800' },
  };

  const getEventConfig = (type: string) => eventConfig[type as keyof typeof eventConfig] || { icon: Star, label: type, color: 'bg-gray-100 text-gray-800' };

  const formatDecayRate = (decayRate: number) => 
    decayRate === 0 ? 'No decay' : `${formatPercent((1 - decayRate), 1, true)} weekly decay`;

  const formatAmount = (amount: number) => formatNumber(amount, { decimals: 2, forceDecimals: true });

  const EventDisplay = ({ event }: { event: PrestigeEvent }) => {
    const label = (event.metadata as any)?.label || event.type;
    const title = event.description || label;

    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-medium cursor-help">{title}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs whitespace-pre-wrap">Event Type: {event.type}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">{formatDecayRate(event.decayRate)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatAmount(event.currentAmount ?? event.amount)}</p>
          {event.originalAmount !== event.currentAmount && (
            <p className="text-xs text-muted-foreground">
              (was {formatAmount(event.originalAmount ?? event.amount)})
            </p>
          )}
        </div>
      </div>
    );
  };

  const getFilteredVineyards = () => 
    selectedVineyard === 'all' ? vineyards : vineyards.filter(vineyard => vineyard.id === selectedVineyard);

  const companyEventTypes = ['company_value', 'sale', 'contract', 'penalty'];
  const companyEvents = eventBreakdown.filter(event => companyEventTypes.includes(event.type));

  const groupedCompanyEvents = companyEvents.reduce((acc, event) => {
    if (!acc[event.type]) acc[event.type] = [];
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, PrestigeEvent[]>);

  // Render
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      {(() => {
                        const config = getEventConfig(type);
                        const IconComponent = config.icon;
                        return <IconComponent className="h-4 w-4" />;
                      })()}
                      {getEventConfig(type).label}
                      <Badge className={getEventConfig(type).color}>
                        {events.length} {events.length === 1 ? 'source' : 'sources'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {events.map((event, index) => (
                      <div key={event.id}>
                        <EventDisplay event={event} />
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
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedVineyard('all')}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
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
                      className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
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
                          <EventDisplay event={event} />
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
                <span><strong>Company Value:</strong> Log-normalized by max land value; adds a steady, non-decaying base.</span>
              </div>
              <div className="flex items-center gap-2">
                <Grape className="h-4 w-4 text-green-500" />
                <span><strong>Vineyard (Base):</strong> Two permanent sources per vineyard — Land Value and Vine Age.</span>
              </div>
              <div className="ml-6 text-xs text-muted-foreground space-y-1">
                <div>• Land Value: log(totalValue/max + 1) → × suitability → asym(0–1) − 1</div>
                <div>• Vine Age: ageModifier(0–1) → × suitability → asym(0–1) − 1</div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span><strong>Sales:</strong> Add temporary prestige that decays weekly (e.g., 5%).</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span><strong>Achievements:</strong> Special events; amounts and decay may vary.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrestigeModal;
