import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Separator } from './separator';
import { Star, TrendingUp, Building2, Grape, DollarSign } from 'lucide-react';
import { PrestigeEvent } from '../../lib/types';
import { formatNumber, formatPercent } from '@/lib/utils/utils';

interface PrestigeEventDisplay extends PrestigeEvent {
  originalAmount: number;
  currentAmount: number;
}

interface PrestigeModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPrestige: number;
  eventBreakdown: PrestigeEventDisplay[];
}

const PrestigeModal: React.FC<PrestigeModalProps> = ({ 
  isOpen, 
  onClose, 
  totalPrestige, 
  eventBreakdown 
}) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'company_value':
        return <DollarSign className="h-4 w-4" />;
      case 'vineyard':
        return <Grape className="h-4 w-4" />;
      case 'sale':
        return <TrendingUp className="h-4 w-4" />;
      case 'contract':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'company_value':
        return 'Company Value';
      case 'vineyard':
        return 'Vineyard';
      case 'sale':
        return 'Sales';
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

  // Group events by type for better organization
  const groupedEvents = eventBreakdown.reduce((acc, event) => {
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
              <p className="text-sm text-muted-foreground">
                Your company's total prestige is calculated from various sources. 
                Some prestige sources decay over time, while others remain constant.
              </p>
            </CardContent>
          </Card>

          {/* Prestige Sources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Prestige Sources</h3>
            
            {Object.keys(groupedEvents).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No prestige events found. Prestige will be calculated when you make sales or acquire assets.
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedEvents).map(([type, events]) => (
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
                            <p className="text-sm font-medium">{event.description}</p>
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
                <Building2 className="h-4 w-4 text-purple-500" />
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
