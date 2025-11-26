import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
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
  areDividendsDue,
  getShareMetrics,
  getShareholderBreakdown,
  getHistoricalShareMetrics,
  type ShareMetrics,
  type ShareholderBreakdown,
  type HistoricalShareMetric
} from '@/lib/services/finance/shareManagementService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { Company } from '@/lib/database';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

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
  const [shareMetrics, setShareMetrics] = useState<ShareMetrics | null>(null);
  const [shareholderBreakdown, setShareholderBreakdown] = useState<ShareholderBreakdown | null>(null);
  const [historicalMetrics, setHistoricalMetrics] = useState<HistoricalShareMetric[]>([]);

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

        // Load share metrics
        const metrics = await getShareMetrics(companyId);
        setShareMetrics(metrics);

        // Load shareholder breakdown
        const breakdown = await getShareholderBreakdown(companyId);
        setShareholderBreakdown(breakdown);

        // Load historical metrics
        const historical = await getHistoricalShareMetrics(companyId, 2);
        setHistoricalMetrics(historical);
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
        setSuccess(`Successfully issued ${formatNumber(issuingShares, { decimals: 0 })} shares. Capital raised: ${formatNumber(result.capitalRaised || 0, { currency: true })}`);
        setIssuingShares(0);
        // Reload company data
        const companyId = getCurrentCompanyId();
        if (companyId) {
          const companyData = await companyService.getCompany(companyId);
          if (companyData) setCompany(companyData);
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
          const metrics = await getShareMetrics(companyId);
          setShareMetrics(metrics);
          const latestBreakdown = await getShareholderBreakdown(companyId);
          setShareholderBreakdown(latestBreakdown);
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
        setSuccess(`Successfully bought back ${formatNumber(buybackShares, { decimals: 0 })} shares. Cost: ${formatNumber(result.cost || 0, { currency: true })}`);
        setBuybackShares(0);
        // Reload company data
        const companyId = getCurrentCompanyId();
        if (companyId) {
          const companyData = await companyService.getCompany(companyId);
          if (companyData) setCompany(companyData);
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
          const metrics = await getShareMetrics(companyId);
          setShareMetrics(metrics);
          const latestBreakdown = await getShareholderBreakdown(companyId);
          setShareholderBreakdown(latestBreakdown);
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
          const metrics = await getShareMetrics(companyId);
          setShareMetrics(metrics);
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

  // Color mappings for metrics (matching the reference image style)
  const metricColors = {
    sharePrice: '#3b82f6',      // Blue
    bookValue: '#10b981',       // Green
    revenue: '#ef4444',         // Red
    earnings: '#f97316',        // Orange
    dividend: '#a855f7',        // Purple
    assets: '#6366f1',          // Indigo
    cash: '#06b6d4',            // Cyan
    debt: '#f59e0b',            // Amber
  };

  // Prepare pie chart data for shareholder breakdown
  const pieChartData = shareholderBreakdown ? [
    { name: 'Player', value: shareholderBreakdown.playerShares, pct: shareholderBreakdown.playerPct, color: '#3b82f6' },
    { name: 'Family', value: shareholderBreakdown.familyShares, pct: shareholderBreakdown.familyPct, color: '#10b981' },
    { name: 'Outside', value: shareholderBreakdown.outsideShares, pct: shareholderBreakdown.outsidePct, color: '#f97316' }
  ].filter(item => item.value > 0) : [];

  // Prepare historical graph data (simplified - show key metrics)
  const graphData = historicalMetrics.map(point => ({
    period: `${point.season.substring(0, 3)} ${point.year}`,
    sharePrice: point.sharePrice,
    bookValue: point.bookValuePerShare,
    earnings: point.earningsPerShare,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Management</CardTitle>
        <CardDescription>Manage company shares, dividends, and market value</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public Company Overview and Per-Share Metrics in 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Public Company Overview */}
          <div className="border border-gray-300 rounded-md p-4 bg-gradient-to-br from-blue-50 to-green-50">
            <h3 className="font-semibold text-gray-800 mb-3 uppercase text-sm tracking-wider">Public Company Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Market Capitalization</div>
                <div className="font-semibold text-lg text-green-600">
                  {formatNumber(marketValue.marketCap, { currency: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Share Price</div>
                <div className="font-semibold text-lg text-blue-600">
                  {formatNumber(marketValue.sharePrice, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Player Ownership</div>
                <div className="font-semibold text-lg text-green-600">
                  {formatNumber(playerOwnershipPct, { decimals: 2, forceDecimals: true })}%
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
              <div className="space-y-1 col-span-2">
                <div className="text-xs text-gray-600">Dividend Rate</div>
                <div className="font-semibold text-base text-purple-600">
                  {dividendRate > 0 ? formatNumber(dividendRate, { currency: true, decimals: 4 }) + '/share' : 'Not set'}
                </div>
              </div>
            </div>
          </div>

          {/* Per-Share Metrics */}
          {shareMetrics && (
            <div className="border border-gray-200 rounded-md p-4 bg-white">
              <h3 className="font-semibold text-gray-800 mb-3 uppercase text-sm tracking-wider">Per-Share Metrics</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.sharePrice }}></div>
                  <div className="text-xs text-gray-600">Share Price</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(marketValue.sharePrice, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.bookValue }}></div>
                  <div className="text-xs text-gray-600">Book Value / Share</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.bookValuePerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.revenue }}></div>
                  <div className="text-xs text-gray-600">Revenue / Share (YTD)</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.revenuePerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.earnings }}></div>
                  <div className="text-xs text-gray-600">Earnings / Share</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.earningsPerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.dividend }}></div>
                  <div className="text-xs text-gray-600">Dividend / Share (YTD)</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.dividendPerShareCurrentYear, { currency: true, decimals: 4 })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.assets }}></div>
                  <div className="text-xs text-gray-600">Assets / Share</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.assetPerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.cash }}></div>
                  <div className="text-xs text-gray-600">Cash / Share</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.cashPerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.debt }}></div>
                  <div className="text-xs text-gray-600">Debt / Share</div>
                </div>
                <div className="font-semibold text-gray-900">
                  {formatNumber(shareMetrics.debtPerShare, { currency: true, decimals: 2, forceDecimals: true })}
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts in Tabs */}
        <Tabs defaultValue="breakdown" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="breakdown">Shareholder Breakdown</TabsTrigger>
            <TabsTrigger value="trends">Historical Trends</TabsTrigger>
          </TabsList>
          
          <TabsContent value="breakdown" className="mt-4">
            {shareholderBreakdown && pieChartData.length > 0 ? (
              <div className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-64 w-full" style={{ minHeight: '256px' }}>
                    <ResponsiveContainer width="100%" height={256}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name}: ${formatNumber(entry.pct, { decimals: 1 })}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, _name: string, props: any) => [
                            `${formatNumber(value, { decimals: 0 })} shares (${formatNumber(props.payload.pct, { decimals: 1 })}%)`,
                            props.payload.name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-3">
                    {pieChartData.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{item.name}</div>
                          <div className="text-xs text-gray-600">
                            {formatNumber(item.value, { decimals: 0 })} shares ({formatNumber(item.pct, { decimals: 1 })}%)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-4 bg-white text-center text-gray-500">
                No shareholder data available
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="trends" className="mt-4">
            {historicalMetrics.length > 0 ? (
              <div className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="w-full" style={{ height: '256px', minHeight: '256px' }}>
                  <ResponsiveContainer width="100%" height={256}>
                    <LineChart data={graphData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => formatNumber(value, { currency: true, decimals: 0 })}
                      />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          formatNumber(value, { currency: true, decimals: 2 }),
                          name
                        ]}
                        labelFormatter={(label) => `Period: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="sharePrice" 
                        stroke={metricColors.sharePrice} 
                        strokeWidth={2} 
                        dot={false}
                        name="Share Price"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="bookValue" 
                        stroke={metricColors.bookValue} 
                        strokeWidth={2} 
                        dot={false}
                        name="Book Value"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="earnings" 
                        stroke={metricColors.earnings} 
                        strokeWidth={2} 
                        dot={false}
                        name="Earnings"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-4 bg-white text-center text-gray-500">
                No historical data available
              </div>
            )}
          </TabsContent>
        </Tabs>

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

