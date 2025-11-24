import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/shadCN/input';
import { Label } from '@/components/ui/shadCN/label';
import { formatNumber } from '@/lib/utils';
import { useGameState, useGameStateWithData } from '@/hooks';
import { companyService } from '@/lib/services/user/companyService';
import { getMarketValue, updateMarketValue } from '@/lib/services/finance/shareValueService';
import {
  issueStock,
  buyBackStock,
  updateDividendRate,
  payDividends,
  calculateDividendPayment,
  areDividendsDue
} from '@/lib/services/finance/shareManagementService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { Company } from '@/lib/database';

export function ShareManagementPanel() {
  const gameState = useGameState();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketValue, setMarketValue] = useState({ marketCap: 0, sharePrice: 0 });
  const [issuingShares, setIssuingShares] = useState(0);
  const [buybackShares, setBuybackShares] = useState(0);
  const [dividendRate, setDividendRate] = useState(0);
  const [dividendRateInput, setDividendRateInput] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dividendsDue, setDividendsDue] = useState(false);

  // Load company data and market value
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const companyId = getCurrentCompanyId();
        if (!companyId) {
          setError('No company selected');
          return;
        }

        const companyData = await companyService.getCompany(companyId);
        if (companyData) {
          setCompany(companyData);
          const rate = companyData.dividendRate || 0;
          setDividendRate(rate);
          setDividendRateInput(rate.toString());
        }

        // Update market value
        await updateMarketValue(companyId);
        const marketData = await getMarketValue(companyId);
        setMarketValue(marketData);

        // Check if dividends are due
        const isDue = await areDividendsDue(companyId);
        setDividendsDue(isDue);
      } catch (err) {
        console.error('Error loading share management data:', err);
        setError('Failed to load share data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [gameState.money, gameState.economyPhase, gameState.week, gameState.season]); // Reload when money, economy phase, week, or season changes

  const playerOwnershipPct = company && company.totalShares && company.playerShares
    ? (company.playerShares / company.totalShares) * 100
    : 100;

  const handleIssueStock = async () => {
    if (issuingShares <= 0) {
      setError('Number of shares must be greater than 0');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await issueStock(issuingShares);
      if (result.success) {
        setSuccess(`Successfully issued ${issuingShares.toLocaleString()} shares. Capital raised: ${formatNumber(result.capitalRaised || 0, { currency: true })}`);
        setIssuingShares(0);
        // Reload company data
        const companyId = getCurrentCompanyId();
        if (companyId) {
          const companyData = await companyService.getCompany(companyId);
          if (companyData) setCompany(companyData);
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
        }
      } else {
        setError(result.error || 'Failed to issue stock');
      }
    } catch (err) {
      console.error('Error issuing stock:', err);
      setError('Failed to issue stock');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuyBackStock = async () => {
    if (buybackShares <= 0) {
      setError('Number of shares must be greater than 0');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await buyBackStock(buybackShares);
      if (result.success) {
        setSuccess(`Successfully bought back ${buybackShares.toLocaleString()} shares. Cost: ${formatNumber(result.cost || 0, { currency: true })}`);
        setBuybackShares(0);
        // Reload company data
        const companyId = getCurrentCompanyId();
        if (companyId) {
          const companyData = await companyService.getCompany(companyId);
          if (companyData) setCompany(companyData);
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
        }
      } else {
        setError(result.error || 'Failed to buy back stock');
      }
    } catch (err) {
      console.error('Error buying back stock:', err);
      setError('Failed to buy back stock');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateDividendRate = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateDividendRate(dividendRate);
      if (result.success) {
        setSuccess(`Dividend rate updated to ${formatNumber(dividendRate, { currency: true, decimals: 4 })} per share`);
      } else {
        setError(result.error || 'Failed to update dividend rate');
      }
    } catch (err) {
      console.error('Error updating dividend rate:', err);
      setError('Failed to update dividend rate');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayDividends = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await payDividends();
      if (result.success) {
        setSuccess(`Dividends paid: ${formatNumber(result.totalPayment || 0, { currency: true })} (Player: ${formatNumber(result.playerPayment || 0, { currency: true })})`);
        // Reload company data
        const companyId = getCurrentCompanyId();
        if (companyId) {
          const companyData = await companyService.getCompany(companyId);
          if (companyData) setCompany(companyData);
          // Check if dividends are still due after payment
          const isDue = await areDividendsDue(companyId);
          setDividendsDue(isDue);
        }
      } else {
        setError(result.error || 'Failed to pay dividends');
      }
    } catch (err) {
      console.error('Error paying dividends:', err);
      setError('Failed to pay dividends');
    } finally {
      setIsProcessing(false);
    }
  };

  const dividendPayment = useGameStateWithData(
    () => calculateDividendPayment(),
    0
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading share data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">No company data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Management</CardTitle>
        <CardDescription>Manage company shares, dividends, and market value</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public Company Overview */}
        <div className="border border-gray-300 rounded-md p-4 bg-gradient-to-br from-blue-50 to-green-50">
          <h3 className="font-semibold text-gray-800 mb-3 uppercase text-sm tracking-wider">Public Company Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Market Capitalization</div>
              <div className="font-semibold text-lg text-green-600">
                {formatNumber(marketValue.marketCap, { currency: true })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Share Price</div>
              <div className="font-semibold text-lg text-blue-600">
                {formatNumber(marketValue.sharePrice, { currency: true })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Player Ownership</div>
              <div className="font-semibold text-lg text-green-600">
                {playerOwnershipPct.toFixed(2)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Total Shares</div>
              <div className="font-semibold text-base">
                {formatNumber(company.totalShares || 0, { decimals: 0 })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Outstanding Shares</div>
              <div className="font-semibold text-base">
                {formatNumber(company.outstandingShares || 0, { decimals: 0 })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Player Shares</div>
              <div className="font-semibold text-base">
                {formatNumber(company.playerShares || 0, { decimals: 0 })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Dividend Rate</div>
              <div className="font-semibold text-base text-purple-600">
                {dividendRate > 0 ? formatNumber(dividendRate, { currency: true, decimals: 4 }) + '/share' : 'Not set'}
              </div>
            </div>
          </div>
        </div>

        {/* Market Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Issue Stock Card */}
          <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Issue Stock</CardTitle>
              <CardDescription className="text-xs">Raise capital by issuing new shares</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="issue-shares" className="text-xs">Number of Shares</Label>
                <Input
                  id="issue-shares"
                  type="number"
                  min="1"
                  value={issuingShares || ''}
                  onChange={(e) => setIssuingShares(Math.max(0, parseInt(e.target.value) || 0))}
                  className="mt-1"
                />
              </div>
              <div className="bg-blue-50 rounded-md p-2 text-xs">
                <div className="text-gray-600">Capital Raised:</div>
                <div className="font-semibold text-blue-600">
                  {formatNumber(issuingShares * marketValue.sharePrice, { currency: true })}
                </div>
              </div>
              <Button
                onClick={handleIssueStock}
                disabled={isProcessing || issuingShares <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? 'Processing...' : 'Issue Stock'}
              </Button>
            </CardContent>
          </Card>

          {/* Buy Back Stock Card */}
          <Card className="border-2 border-purple-200 hover:border-purple-400 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Buy Back Stock</CardTitle>
              <CardDescription className="text-xs">Increase ownership by buying back shares</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="buyback-shares" className="text-xs">
                  Number of Shares
                  <span className="text-gray-500 ml-1">
                    (Max: {formatNumber(company.outstandingShares || 0, { decimals: 0 })})
                  </span>
                </Label>
                <Input
                  id="buyback-shares"
                  type="number"
                  min="1"
                  max={company.outstandingShares || 0}
                  value={buybackShares || ''}
                  onChange={(e) => setBuybackShares(Math.max(0, Math.min(company.outstandingShares || 0, parseInt(e.target.value) || 0)))}
                  className="mt-1"
                />
              </div>
              <div className="bg-purple-50 rounded-md p-2 text-xs">
                <div className="text-gray-600">Estimated Cost:</div>
                <div className="font-semibold text-purple-600">
                  {formatNumber(buybackShares * marketValue.sharePrice, { currency: true })}
                </div>
              </div>
              <Button
                onClick={handleBuyBackStock}
                disabled={isProcessing || buybackShares <= 0 || buybackShares > (company.outstandingShares || 0)}
                className="w-full bg-purple-600 hover:bg-purple-700"
                variant="outline"
              >
                {isProcessing ? 'Processing...' : 'Buy Back Stock'}
              </Button>
            </CardContent>
          </Card>

          {/* Dividend Management Card */}
          <Card className={`border-2 transition-colors ${dividendsDue ? 'border-yellow-400 hover:border-yellow-500 bg-yellow-50/30' : 'border-green-200 hover:border-green-400'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Dividend Management</span>
                {dividendsDue && (
                  <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full font-semibold">
                    Due
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">Set and pay dividends to shareholders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="dividend-rate" className="text-xs">Current Dividend Rate (€ per share)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="dividend-rate"
                    type="text"
                    value={dividendRateInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Allow empty string, numbers, and decimal point
                      if (inputValue === '' || inputValue === '.' || /^\d*\.?\d*$/.test(inputValue)) {
                        setDividendRateInput(inputValue);
                        // Parse and update the actual rate if it's a valid number
                        const parsed = parseFloat(inputValue);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setDividendRate(parsed);
                        } else if (inputValue === '' || inputValue === '.') {
                          setDividendRate(0);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // On blur, ensure we have a valid number
                      const parsed = parseFloat(e.target.value);
                      if (isNaN(parsed) || parsed < 0) {
                        setDividendRateInput('0');
                        setDividendRate(0);
                      } else {
                        setDividendRateInput(parsed.toString());
                        setDividendRate(parsed);
                      }
                    }}
                    className="flex-1"
                    placeholder="0.0000"
                  />
                  {dividendRate > 0 && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatNumber(dividendRate, { currency: true, decimals: 4 })}/share
                    </span>
                  )}
                </div>
              </div>
              {dividendsDue && (
                <div className="bg-yellow-100 border border-yellow-300 rounded-md p-2 text-xs">
                  <div className="font-semibold text-yellow-800">⚠️ Dividends are due this week!</div>
                  <div className="text-yellow-700 mt-1">Pay dividends to avoid missing the payment deadline.</div>
                </div>
              )}
              <div className="bg-green-50 rounded-md p-2 text-xs">
                <div className="text-gray-600">Total Payment:</div>
                <div className="font-semibold text-green-600">
                  {formatNumber(dividendPayment, { currency: true })}
                </div>
                {company && company.totalShares && dividendRate > 0 && (
                  <div className="text-gray-500 mt-1">
                    ({formatNumber(company.totalShares, { decimals: 0 })} shares × {formatNumber(dividendRate, { currency: true, decimals: 4 })})
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateDividendRate}
                  disabled={isProcessing}
                  className="flex-1"
                  variant="outline"
                >
                  {isProcessing ? 'Updating...' : 'Update Rate'}
                </Button>
                <Button
                  onClick={handlePayDividends}
                  disabled={isProcessing || dividendRate <= 0}
                  className={`flex-1 ${dividendsDue ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {isProcessing ? 'Processing...' : dividendsDue ? 'Pay Dividends (Due)' : 'Pay Dividends'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-600">
            {success}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

