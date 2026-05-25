import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '../ui';
import { formatNumber } from '@/lib/utils';
import { getAllStaff, buyoutFounder, calculateCompanyValue } from '@/lib/services';
import { useGameStateWithData } from '@/hooks';
import { Crown, AlertCircle } from 'lucide-react';
import { FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT, FOUNDER_BUYOUT_PERCENT_OF_ASSETS } from '@/lib/constants/staffConstants';

export function FounderPanel() {
  const [buyingOut, setBuyingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyValue, setCompanyValue] = useState<number>(0);

  const staff = useGameStateWithData(() => getAllStaff(), []);
  const founders = staff.filter(s => s.isFounder === true);

  // Refresh company value for buyout cost display
  useGameStateWithData(
    async () => {
      const value = await calculateCompanyValue();
      setCompanyValue(value);
      return value;
    },
    [0],
    { topic: 'finance' }
  );

  if (founders.length === 0) return null;

  const buyoutCostPerFounder = Math.round(companyValue * FOUNDER_BUYOUT_PERCENT_OF_ASSETS);

  async function handleBuyout(staffId: string, name: string) {
    setBuyingOut(staffId);
    setError(null);
    const result = await buyoutFounder(staffId);
    setBuyingOut(null);
    if (result) setError(result);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          Founding Partners
        </CardTitle>
        <CardDescription>
          Founders work for a profit share instead of a fixed wage. Each founder receives{' '}
          <strong>{FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}%</strong> of yearly net profit at
          year-end (zero cost in lean years with no net profit).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Founder list */}
          <div className="border border-amber-200 rounded-md divide-y divide-amber-100">
            {founders.map((founder) => (
              <div
                key={founder.id}
                className="flex items-center justify-between p-3 bg-amber-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{founder.name}</span>
                    <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300">
                      Founder
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {founder.nationality} · {founder.specializations.join(', ')} ·{' '}
                    <span className="text-amber-700 font-medium">
                      {FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}% of yearly profit at year-end
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleBuyout(founder.id, founder.name)}
                  disabled={buyingOut === founder.id}
                  className="ml-4 text-xs px-3 py-1 h-auto bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                >
                  {buyingOut === founder.id
                    ? 'Processing…'
                    : `Buy Out — ${formatNumber(buyoutCostPerFounder, { currency: true, decimals: 0 })}`}
                </Button>
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Buyout info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 space-y-1">
            <p>
              <strong>Buyout cost:</strong>{' '}
              {Math.round(FOUNDER_BUYOUT_PERCENT_OF_ASSETS * 100)}% of total company asset value
              per founder. Currently <strong>{formatNumber(buyoutCostPerFounder, { currency: true, decimals: 0 })}</strong> per
              founder (company assets:{' '}
              {formatNumber(companyValue, { currency: true, decimals: 0 })}).
            </p>
            <p>
              After buyout the founder becomes a salaried employee and their wage is calculated
              from their skills and specializations.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
