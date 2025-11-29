import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Input } from '@/components/ui/shadCN/input';
import { Label } from '@/components/ui/shadCN/label';
import { formatNumber } from '@/lib/utils';
import { Info } from 'lucide-react';
import { useGameState, useGameStateWithData } from '@/hooks';
import { companyService } from '@/lib/services/user/companyService';
import { getMarketValue, updateMarketValue, getSharePriceBreakdown, issueStock, buyBackStock, updateDividendRate, calculateDividendPayment, areDividendsDue, getShareMetrics, getShareholderBreakdown, getHistoricalShareMetrics } from '@/lib/services';
import type { ShareMetrics, ShareholderBreakdown, ShareHistoricalMetric } from '@/lib/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { Company } from '@/lib/database';
import { getCompanyShares } from '@/lib/database/core/companySharesDB';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { loadTransactions } from '@/lib/services/finance/financeService';
import { listPrestigeEventsForUI } from '@/lib/database/customers/prestigeEventsDB';
import type { PrestigeEvent } from '@/lib/types/types';

export function ShareManagementPanel() {
  const gameState = useGameState();
  const [company, setCompany] = useState<Company | null>(null);
  const [sharesData, setSharesData] = useState<{ totalShares: number; outstandingShares: number; playerShares: number; dividendRate: number } | null>(null);
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
  const [historicalMetrics, setHistoricalMetrics] = useState<ShareHistoricalMetric[]>([]);
  const [sharePriceBreakdown, setSharePriceBreakdown] = useState<Awaited<ReturnType<typeof getSharePriceBreakdown>>['data'] | null>(null);
  const [showMetricDetails, setShowMetricDetails] = useState(false);
  const [showExpectedValuesCalc, setShowExpectedValuesCalc] = useState(false);
  const [recentShareChanges, setRecentShareChanges] = useState<Array<{
    type: 'issuance' | 'buyback';
    shares: number;
    price: number;
    date: string;
  }>>([]);
  const [recentDividendChanges, setRecentDividendChanges] = useState<Array<{
    oldRate: number;
    newRate: number;
    prestigeImpact: number;
    date: string;
  }>>([]);

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
        }

        // Get share data
        const shares = await getCompanyShares(companyId);
        if (shares) {
          setSharesData({
            totalShares: shares.totalShares,
            outstandingShares: shares.outstandingShares,
            playerShares: shares.playerShares,
            dividendRate: shares.dividendRate
          });
          setDividendRate(shares.dividendRate);
          setDividendRateInput(shares.dividendRate.toString());
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
        
        // Load share price breakdown data
        const breakdownResult = await getSharePriceBreakdown(companyId);
        if (breakdownResult.success && breakdownResult.data) {
          setSharePriceBreakdown(breakdownResult.data);
        }

        // Load recent share structure changes and dividend changes
        try {
          const transactions = await loadTransactions();
          const prestigeEvents = await listPrestigeEventsForUI();
          
          // Find recent share issuance/buyback transactions (last 12 weeks)
          const currentWeek = gameState.week || 1;
          const currentSeason = gameState.season || 'Spring';
          const currentYear = gameState.currentYear || 2024;
          const seasonOrder = ['Spring', 'Summer', 'Fall', 'Winter'];
          
          const shareTransactions = transactions
            .filter(t => {
              const isShareTransaction = t.description.includes('Stock Issuance') || t.description.includes('Stock Buyback');
              if (!isShareTransaction) return false;
              
              // Check if transaction is within last 12 weeks
              const weeksDiff = (currentYear - t.date.year) * 48 + 
                (seasonOrder.indexOf(currentSeason) - seasonOrder.indexOf(t.date.season)) * 12 + 
                (currentWeek - t.date.week);
              return weeksDiff >= 0 && weeksDiff <= 12;
            })
            .slice(0, 5) // Last 5 transactions
            .map(t => {
              const isIssuance = t.description.includes('Stock Issuance');
              const sharesMatch = t.description.match(/([\d,]+)\s+shares/);
              const priceMatch = t.description.match(/@\s*([\d.]+)€/);
              const shares = sharesMatch ? parseInt(sharesMatch[1].replace(/,/g, '')) : 0;
              const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
              
              return {
                type: (isIssuance ? 'issuance' : 'buyback') as 'issuance' | 'buyback',
                shares,
                price,
                date: `W${t.date.week} ${t.date.season.substring(0, 3)} ${t.date.year}`
              };
            });
          
          setRecentShareChanges(shareTransactions);
          
          // Find recent dividend change prestige events (last 12 weeks)
          // Events are already sorted by recency from listPrestigeEventsForUI
          const dividendEvents = prestigeEvents
            .filter((event: PrestigeEvent) => {
              if (event.type !== 'penalty') return false;
              const metadata: any = (event as any).metadata?.payload ?? (event as any).metadata ?? {};
              if (metadata.event !== 'dividend_change') return false;
              
              // For timestamp-based filtering, we'll just take the most recent ones
              // The listPrestigeEventsForUI already sorts by created_game_week descending
              return true;
            })
            .slice(0, 5) // Last 5 events (already sorted by recency)
            .map((event: PrestigeEvent) => {
              const metadata: any = (event as any).metadata?.payload ?? (event as any).metadata ?? {};
              
              // Try to get week from metadata or use a simple date format
              // If we have created_at, use that, otherwise use "Recent"
              let dateStr = 'Recent';
              if (event.created_at) {
                try {
                  const eventDate = new Date(event.created_at);
                  dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                } catch (e) {
                  // Fallback
                }
              }
              
              return {
                oldRate: metadata.oldRate ?? 0,
                newRate: metadata.newRate ?? 0,
                prestigeImpact: event.amount,
                date: dateStr
              };
            });
          
          setRecentDividendChanges(dividendEvents);
        } catch (err) {
          console.error('Error loading recent share/dividend changes:', err);
        }
      } catch (err) {
        console.error('Error loading share management data:', err);
        setError('Failed to load share data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [gameState.money, gameState.economyPhase, gameState.week, gameState.season]); // Reload when money, economy phase, week, or season changes

  const playerOwnershipPct = sharesData && sharesData.totalShares && sharesData.playerShares
    ? (sharesData.playerShares / sharesData.totalShares) * 100
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
          
          // Reload share data
          const shares = await getCompanyShares(companyId);
          if (shares) {
            setSharesData({
              totalShares: shares.totalShares,
              outstandingShares: shares.outstandingShares,
              playerShares: shares.playerShares,
              dividendRate: shares.dividendRate
            });
          }
          
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
          const metrics = await getShareMetrics(companyId);
          setShareMetrics(metrics);
          const latestBreakdown = await getShareholderBreakdown(companyId);
          setShareholderBreakdown(latestBreakdown);
          // Refresh share price breakdown data
          const breakdownResult = await getSharePriceBreakdown(companyId);
          if (breakdownResult.success && breakdownResult.data) {
            setSharePriceBreakdown(breakdownResult.data);
          }
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
          
          // Reload share data
          const shares = await getCompanyShares(companyId);
          if (shares) {
            setSharesData({
              totalShares: shares.totalShares,
              outstandingShares: shares.outstandingShares,
              playerShares: shares.playerShares,
              dividendRate: shares.dividendRate
            });
          }
          
          await updateMarketValue(companyId);
          const marketData = await getMarketValue(companyId);
          setMarketValue(marketData);
          const metrics = await getShareMetrics(companyId);
          setShareMetrics(metrics);
          const latestBreakdown = await getShareholderBreakdown(companyId);
          setShareholderBreakdown(latestBreakdown);
          // Refresh share price breakdown data
          const breakdownResult = await getSharePriceBreakdown(companyId);
          if (breakdownResult.success && breakdownResult.data) {
            setSharePriceBreakdown(breakdownResult.data);
          }
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
    profitMargin: '#8b5cf6',    // Violet
    revenueGrowth: '#ec4899',   // Pink
  };

  // Prepare pie chart data for shareholder breakdown
  const pieChartData = shareholderBreakdown ? [
    { name: 'Player', value: shareholderBreakdown.playerShares, pct: shareholderBreakdown.playerPct, color: '#3b82f6' },
    { name: 'Family', value: shareholderBreakdown.familyShares, pct: shareholderBreakdown.familyPct, color: '#10b981' },
    { name: 'Outside', value: shareholderBreakdown.outsideShares, pct: shareholderBreakdown.outsidePct, color: '#f97316' }
  ].filter(item => item.value > 0) : [];

  // Prepare historical graph data (weekly granularity)
  const graphData = historicalMetrics.map(point => ({
    period: `${point.season.substring(0, 3)} W${point.week} ${point.year}`,
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
      <CardContent>
        <Tabs defaultValue="management" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="management">Share Information & Management</TabsTrigger>
            <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          </TabsList>
          
          <TabsContent value="management" className="space-y-6 mt-0">
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
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  Share Price
                  <button
                    onClick={() => {
                      try {
                        localStorage.setItem('winepedia_view', 'shareMarket');
                        // Dispatch custom event for navigation
                        window.dispatchEvent(new CustomEvent('navigateToWinepedia'));
                      } catch (e) {
                        console.error('Failed to set winepedia view:', e);
                      }
                    }}
                    className="inline-flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
                    title="Learn more about share price valuation"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </div>
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
                  {formatNumber(sharesData?.totalShares || 0, { decimals: 0 })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Outstanding Shares</div>
                <div className="font-semibold text-base">
                  {formatNumber(sharesData?.outstandingShares || 0, { decimals: 0 })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Player Shares</div>
                <div className="font-semibold text-base">
                  {formatNumber(sharesData?.playerShares || 0, { decimals: 0 })}
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
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.profitMargin }}></div>
                        <div className="text-xs text-gray-600">Profit Margin</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatNumber(shareMetrics.profitMargin, { percent: true, decimals: 2, percentIsDecimal: true })}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: metricColors.revenueGrowth }}></div>
                        <div className="text-xs text-gray-600">Revenue Growth (YOY)</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatNumber(shareMetrics.revenueGrowth, { percent: true, decimals: 2, percentIsDecimal: true })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                    (Max: {formatNumber(sharesData?.outstandingShares || 0, { decimals: 0 })})
                  </span>
                </Label>
                <Input
                  id="buyback-shares"
                  type="number"
                  min="1"
                  max={sharesData?.outstandingShares || 0}
                  value={buybackShares || ''}
                  onChange={(e) => setBuybackShares(Math.max(0, Math.min(sharesData?.outstandingShares || 0, parseInt(e.target.value) || 0)))}
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
                disabled={isProcessing || buybackShares <= 0 || buybackShares > (sharesData?.outstandingShares || 0)}
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
                {sharesData && sharesData.totalShares && dividendRate > 0 && (
                  <div className="text-gray-500 mt-1">
                    ({formatNumber(sharesData.totalShares, { decimals: 0 })} shares × {formatNumber(dividendRate, { currency: true, decimals: 4 })})
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
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs">
                <div className="text-blue-800">
                  <span className="font-semibold">ℹ️ Automatic Payments:</span> Dividends are automatically paid on week 1 of each season (season change).
                </div>
              </div>
            </CardContent>
              </Card>
            </div>

            {/* Share Price Breakdown Panel */}
            {sharePriceBreakdown && (
          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Share Price Breakdown</CardTitle>
                  <CardDescription className="text-xs">How your share price adjusts based on performance (Rolling 48-week comparison)</CardDescription>
                </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExpectedValuesCalc(!showExpectedValuesCalc)}
                    >
                      {showExpectedValuesCalc ? 'Hide Expected Values' : 'Show Expected Values'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMetricDetails(!showMetricDetails)}
                    >
                      {showMetricDetails ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Current Price</div>
                  <div className="font-semibold text-blue-600">
                    {formatNumber(sharePriceBreakdown.currentPrice, { currency: true, decimals: 2 })}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Anchor (Book Value)</div>
                  <div className="font-semibold text-green-600">
                    {formatNumber(sharePriceBreakdown.basePrice, { currency: true, decimals: 2 })}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Weekly Adjustment</div>
                  <div className={`font-semibold ${sharePriceBreakdown.adjustment.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(sharePriceBreakdown.adjustment.adjustment, { currency: true, decimals: 4, forceDecimals: true })}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({formatNumber((sharePriceBreakdown.adjustment.adjustment / sharePriceBreakdown.currentPrice) * 100, { decimals: 2, forceDecimals: true })}%)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Next Price</div>
                  <div className="font-semibold text-blue-600">
                    {formatNumber(sharePriceBreakdown.adjustment.newPrice, { currency: true, decimals: 2 })}
                  </div>
                </div>
              </div>

              {/* Recent Share Structure & Dividend Changes */}
              {(recentShareChanges.length > 0 || recentDividendChanges.length > 0) && (
                <div className="border border-gray-200 rounded-md p-4 bg-blue-50/50">
                  <h3 className="font-semibold text-sm mb-3 text-gray-800">Recent Share Structure & Dividend Changes</h3>
                  <div className="text-xs space-y-3">
                    {/* Share Structure Changes */}
                    {recentShareChanges.length > 0 && (
                      <div>
                        <div className="font-semibold mb-2 text-gray-700">Share Structure Changes (Last 12 weeks):</div>
                        <div className="space-y-1 pl-4">
                          {recentShareChanges.map((change, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${change.type === 'issuance' ? 'text-blue-600' : 'text-purple-600'}`}>
                                  {change.type === 'issuance' ? '📈 Issued' : '📉 Bought Back'}
                                </span>
                                <span className="text-gray-600">
                                  {formatNumber(change.shares, { decimals: 0 })} shares @ {formatNumber(change.price, { currency: true, decimals: 2 })}
                                </span>
                              </div>
                              <div className="text-gray-500 text-xs">
                                {change.date}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pl-4 text-gray-600 italic text-xs">
                          Note: Share issuance causes immediate price drop (dilution), buyback causes immediate price boost (concentration)
                        </div>
                      </div>
                    )}
                    
                    {/* Dividend Changes */}
                    {recentDividendChanges.length > 0 && (
                      <div>
                        <div className="font-semibold mb-2 text-gray-700">Dividend Changes (Last 12 weeks):</div>
                        <div className="space-y-1 pl-4">
                          {recentDividendChanges.map((change, idx) => {
                            const isCut = change.newRate < change.oldRate;
                            const changePercent = change.oldRate > 0 
                              ? ((change.newRate - change.oldRate) / change.oldRate) * 100 
                              : (change.newRate > 0 ? 100 : 0);
                            return (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isCut ? 'text-red-600' : 'text-green-600'}`}>
                                    {isCut ? '📉 Cut' : '📈 Increased'}
                                  </span>
                                  <span className="text-gray-600">
                                    {formatNumber(change.oldRate, { currency: true, decimals: 4 })} → {formatNumber(change.newRate, { currency: true, decimals: 4 })}/share
                                  </span>
                                  <span className={`text-xs ${isCut ? 'text-red-600' : 'text-green-600'}`}>
                                    ({formatNumber(Math.abs(changePercent), { decimals: 1 })}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${change.prestigeImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    Prestige: {formatNumber(change.prestigeImpact, { decimals: 3, forceDecimals: true })}
                                  </span>
                                  <span className="text-gray-500 text-xs">
                                    {change.date}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pl-4 text-gray-600 italic text-xs">
                          Note: Dividend changes affect share price indirectly through prestige (affects expected values) and dividend per share metric
                        </div>
                      </div>
                    )}
                    
                    {recentShareChanges.length === 0 && recentDividendChanges.length === 0 && (
                      <div className="text-gray-500 italic text-xs">
                        No recent share structure or dividend changes in the last 12 weeks
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expected Improvement Rates Calculation */}
              {showExpectedValuesCalc && sharePriceBreakdown?.expectedValuesCalc && (
                <div className="border border-gray-200 rounded-md p-4 bg-green-50/50">
                  <h3 className="font-semibold text-sm mb-3 text-gray-800">Expected Improvement Rates Calculation</h3>
                  <div className="text-xs space-y-3">
                    <div>
                      <div className="font-semibold mb-1">Baseline Improvement Rates (per 48 weeks):</div>
                      <div className="text-gray-600 text-xs mb-2 pl-4">
                        These are the "normal" expected improvement rates in a stable economy with average prestige.
                        All metrics compare current 48-week rolling to previous 48-week rolling values.
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-4">
                        <div>Earnings/Share Baseline:</div>
                        <div className="font-mono">1.2%</div>
                        <div>Revenue/Share Baseline:</div>
                        <div className="font-mono">1.2%</div>
                        <div>Dividend/Share Baseline:</div>
                        <div className="font-mono">0.3%</div>
                        <div>Revenue Growth Baseline:</div>
                        <div className="font-mono">1.2%</div>
                        <div>Profit Margin Baseline:</div>
                        <div className="font-mono">0.8%</div>
                        <div>Credit Rating Baseline:</div>
                        <div className="font-mono">0.4%</div>
                        <div>Fixed Asset Ratio Baseline:</div>
                        <div className="font-mono">0.2%</div>
                        <div>Prestige Baseline:</div>
                        <div className="font-mono">0.5%</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Multipliers (adjust baseline by context):</div>
                      <div className="grid grid-cols-2 gap-2 pl-4">
                        <div>Economy Phase → Multiplier:</div>
                        <div className="font-mono">{sharePriceBreakdown.expectedValuesCalc.economyPhase} → {formatNumber(sharePriceBreakdown.expectedValuesCalc.economyMultiplier, { decimals: 3 })}</div>
                        <div>Prestige ({formatNumber(sharePriceBreakdown.expectedValuesCalc.prestige, { decimals: 0 })}, norm: {formatNumber(sharePriceBreakdown.expectedValuesCalc.normalizedPrestige, { decimals: 3 })}):</div>
                        <div className="font-mono">{formatNumber(sharePriceBreakdown.expectedValuesCalc.prestigeMultiplier, { decimals: 3 })}</div>
                        <div>Growth Trend Multiplier:</div>
                        <div className="font-mono">{formatNumber(sharePriceBreakdown.expectedValuesCalc.growthTrendMultiplier, { decimals: 3 })}</div>
                        {(sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement !== undefined && (sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement > 0 && (
                          <>
                            <div>Market Cap Requirement:</div>
                            <div className="font-mono text-orange-600 font-semibold">
                              +{formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%
                            </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              Market Cap: {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCap ?? 0, { currency: true, decimals: 0 })}
                              {' '}(Additional expectation for larger companies)
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-gray-300 pt-2">
                      <div className="font-semibold mb-1">Expected Improvement Rates (per 48 weeks):</div>
                      <div className="text-gray-600 text-xs mb-2 pl-4">
                        Formula: (Baseline × Economy × Prestige × Growth) + Market Cap Requirement = Expected Improvement %
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-4">
                        <div>Improvement Multiplier:</div>
                        <div className="font-mono text-blue-600 font-semibold">
                          {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                        </div>
                        <div className="text-gray-600 text-xs col-span-2 pl-4">
                          = {formatNumber(sharePriceBreakdown.expectedValuesCalc.economyMultiplier, { decimals: 3 })} × {formatNumber(sharePriceBreakdown.expectedValuesCalc.prestigeMultiplier, { decimals: 3 })} × {formatNumber(sharePriceBreakdown.expectedValuesCalc.growthTrendMultiplier, { decimals: 3 })}
                        </div>
                        {sharePriceBreakdown.expectedImprovementRates && (
                          <>
                            <div>Expected EPS Improvement:</div>
                        <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.earningsPerShare, { decimals: 2, forceDecimals: true })}%
                        </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 1.2% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                              {((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement ?? 0) > 0 && (
                                <> + {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%</>
                              )}
                            </div>
                            <div>Expected Revenue/Share Improvement:</div>
                        <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.revenuePerShare, { decimals: 2, forceDecimals: true })}%
                        </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 1.2% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                              {((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement ?? 0) > 0 && (
                                <> + {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%</>
                              )}
                            </div>
                            <div>Expected Revenue Growth Improvement:</div>
                        <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.revenueGrowth, { decimals: 2, forceDecimals: true })}%
                        </div>
                        <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 1.2% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                        </div>
                            <div>Expected Profit Margin Improvement:</div>
                        <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.profitMargin, { decimals: 2, forceDecimals: true })}%
                        </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 0.8% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                              {((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement ?? 0) > 0 && (
                                <> + {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%</>
                              )}
                            </div>
                            <div>Expected Credit Rating Improvement:</div>
                            <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.creditRating, { decimals: 2, forceDecimals: true })}%
                      </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 0.4% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                              {((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement ?? 0) > 0 && (
                                <> + {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%</>
                              )}
                    </div>
                            <div>Expected Prestige Improvement:</div>
                            <div className="font-mono text-green-600 font-semibold">
                              {formatNumber(sharePriceBreakdown.expectedImprovementRates.prestige, { decimals: 2, forceDecimals: true })}%
                  </div>
                            <div className="text-gray-600 text-xs col-span-2 pl-4">
                              = 0.5% × {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).improvementMultiplier ?? 1.0, { decimals: 3 })}
                              {((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement ?? 0) > 0 && (
                                <> + {formatNumber((sharePriceBreakdown.expectedValuesCalc as any).marketCapRequirement, { decimals: 2, forceDecimals: true })}%</>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metric Breakdown Table - Shows 48-week rolling metrics */}
              {showMetricDetails && sharePriceBreakdown && (
                <div className="mt-4 border border-gray-200 rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold text-gray-700">Metric</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-700">Current (48w)</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-700">Previous (48w ago)</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-700">Delta (%)</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-700">Contribution (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* Earnings Per Share (48-week rolling) */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Earnings/Share <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber(sharePriceBreakdown.currentValues48Weeks?.earningsPerShare ?? 0, { currency: true, decimals: 4 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.earningsPerShare !== null && sharePriceBreakdown.previousValues48WeeksAgo?.earningsPerShare !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.earningsPerShare, { currency: true, decimals: 4 })
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.earningsPerShare, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.earningsPerShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.earningsPerShare, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.earningsPerShare.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.earningsPerShare.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Revenue Per Share (48-week rolling) */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Revenue/Share <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber(sharePriceBreakdown.currentValues48Weeks?.revenuePerShare ?? 0, { currency: true, decimals: 4 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.revenuePerShare !== null && sharePriceBreakdown.previousValues48WeeksAgo?.revenuePerShare !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.revenuePerShare, { currency: true, decimals: 4 })
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.revenuePerShare, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.revenuePerShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.revenuePerShare, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.revenuePerShare.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.revenuePerShare.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Dividend Per Share (48-week rolling) */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Dividend/Share <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber(sharePriceBreakdown.currentValues48Weeks?.dividendPerShare ?? 0, { currency: true, decimals: 4 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.dividendPerShare !== null && sharePriceBreakdown.previousValues48WeeksAgo?.dividendPerShare !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.dividendPerShare, { currency: true, decimals: 4 })
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                            <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.dividendPerShare, { decimals: 1, forceDecimals: true })}%)
                            </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.dividendPerShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.dividendPerShare, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.dividendPerShare.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.dividendPerShare.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Revenue Growth (48-week rolling) */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Revenue Growth <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber((sharePriceBreakdown.currentValues48Weeks?.revenueGrowth ?? 0) * 100, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.revenueGrowth !== null && sharePriceBreakdown.previousValues48WeeksAgo?.revenueGrowth !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.revenueGrowth * 100, { decimals: 2, forceDecimals: true }) + '%'
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.revenueGrowth, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.revenueGrowth, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.revenueGrowth.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.revenueGrowth.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Profit Margin (48-week rolling) */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Profit Margin <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber((sharePriceBreakdown.currentValues48Weeks?.profitMargin ?? 0) * 100, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.profitMargin !== null && sharePriceBreakdown.previousValues48WeeksAgo?.profitMargin !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.profitMargin * 100, { decimals: 2, forceDecimals: true }) + '%'
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.profitMargin, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.profitMargin, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.profitMargin.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.profitMargin.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Credit Rating */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Credit Rating <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber(sharePriceBreakdown.currentValues?.creditRating ?? 0, { decimals: 3 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.creditRating !== null && sharePriceBreakdown.previousValues48WeeksAgo?.creditRating !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.creditRating, { decimals: 3 })
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.creditRating, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.creditRating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.creditRating, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.creditRating.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.creditRating.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Fixed Asset Ratio */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Fixed Asset Ratio <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber((sharePriceBreakdown.currentValues?.fixedAssetRatio ?? 0) * 100, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.fixedAssetRatio !== null && sharePriceBreakdown.previousValues48WeeksAgo?.fixedAssetRatio !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.fixedAssetRatio * 100, { decimals: 2, forceDecimals: true }) + '%'
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.fixedAssetRatio, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.fixedAssetRatio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.fixedAssetRatio, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.fixedAssetRatio.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.fixedAssetRatio.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Prestige */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">
                            Prestige <span className="text-xs text-gray-500">(48 weeks)</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNumber(sharePriceBreakdown.currentValues?.prestige ?? 0, { decimals: 2 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sharePriceBreakdown.previousValues48WeeksAgo?.prestige !== null && sharePriceBreakdown.previousValues48WeeksAgo?.prestige !== undefined
                              ? formatNumber(sharePriceBreakdown.previousValues48WeeksAgo.prestige, { decimals: 2 })
                              : <span className="text-gray-400 italic">N/A</span>}
                            {sharePriceBreakdown.expectedImprovementRates && (
                              <span className="text-xs text-gray-500 ml-1">
                                (exp: {formatNumber(sharePriceBreakdown.expectedImprovementRates.prestige, { decimals: 1, forceDecimals: true })}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.deltas.prestige >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.deltas.prestige, { decimals: 2, forceDecimals: true })}%
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${sharePriceBreakdown.adjustment.contributions.prestige.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.contributions.prestige.contribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                        
                        {/* Total Row */}
                        <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                          <td className="px-4 py-2">Total</td>
                          <td className="px-4 py-2 text-right" colSpan={2}></td>
                          <td className="px-4 py-2 text-right text-gray-700">—</td>
                          <td className={`px-4 py-2 text-right ${sharePriceBreakdown.adjustment.totalContribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatNumber(sharePriceBreakdown.adjustment.totalContribution, { currency: true, decimals: 4, forceDecimals: true })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            )}

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
          </TabsContent>
          
          <TabsContent value="diagrams" className="space-y-6 mt-0">
            {/* Shareholder Breakdown */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Shareholder Breakdown</h3>
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
            </div>
            
            {/* Historical Trends */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Historical Trends</h3>
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

