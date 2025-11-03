import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '../ui';
import { Building2, TrendingUp, Trophy, Calendar, BarChart3, Wine } from 'lucide-react';
import { formatGameDateFromObject, calculateCompanyWeeks, formatGameDate, formatNumber } from '@/lib/utils/utils';
import { useGameState, useGameUpdates } from '@/hooks';
import { getCurrentCompany, highscoreService } from '@/lib/services';
import { type ScoreType } from '@/lib/database';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { NavigationProps } from '../../lib/types/UItypes';

interface CompanyOverviewProps extends NavigationProps {
  // Inherits onNavigate from NavigationProps
}

type CompanyRankings = Record<ScoreType, { position: number; total: number }>;

const CompanyOverview: React.FC<CompanyOverviewProps> = ({ onNavigate }) => {
  const { isLoading, withLoading } = useLoadingState();
  const gameState = useGameState();
  const company = getCurrentCompany();
  
  const [rankings, setRankings] = useState<CompanyRankings>({
    company_value: { position: 0, total: 0 },
    company_value_per_week: { position: 0, total: 0 },
    highest_vintage_quantity: { position: 0, total: 0 },
    most_productive_vineyard: { position: 0, total: 0 },
    highest_wine_score: { position: 0, total: 0 },
    highest_grape_quality: { position: 0, total: 0 },
    highest_balance: { position: 0, total: 0 },
    highest_price: { position: 0, total: 0 },
    lowest_price: { position: 0, total: 0 }
  });
  
  const [cellarStats, setCellarStats] = useState({
    totalWineValue: 0,
    bottledWineCount: 0,
    bottledBottles: 0,
    agedWineValue: 0,
    agedWineCount: 0
  });

  const gameDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };

  useEffect(() => {
    if (company) {
      loadCompanyRankings();
      loadCellarStats();
    }
  }, [company?.id]);
  
  // Reactive update for cellar stats when game state changes
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      loadCellarStats();
    });
    return () => { unsubscribe(); };
  }, [subscribe]);

  const loadCompanyRankings = () => withLoading(async () => {
    if (!company) return;
    
    const companyRankings = await highscoreService.getCompanyRankings(company.id);
    setRankings(companyRankings);
  });
  
  const loadCellarStats = async () => {
    try {
      const batches = await loadWineBatches();
      const bottledWines = batches.filter(b => b.state === 'bottled');
      const agedWines = bottledWines.filter(b => (b.agingProgress || 0) >= 260); // 5+ years
      
      const totalWineValue = bottledWines.reduce((sum, b) => sum + (b.quantity * b.estimatedPrice), 0);
      const bottledBottles = bottledWines.reduce((sum, b) => sum + b.quantity, 0);
      const agedWineValue = agedWines.reduce((sum, b) => sum + (b.quantity * b.estimatedPrice), 0);
      
      setCellarStats({
        totalWineValue,
        bottledWineCount: bottledWines.length,
        bottledBottles,
        agedWineValue,
        agedWineCount: agedWines.length
      });
    } catch (error) {
      console.error('Error loading cellar stats:', error);
    }
  };

  const formatCompanyGameDate = useCallback(() => {
    if (!company) return formatGameDateFromObject(gameDate);
    return formatGameDate(company.currentWeek, company.currentSeason, company.currentYear);
  }, [company, gameDate]);

  const formatRanking = useCallback((ranking: { position: number; total: number }): string => {
    if (ranking.position === 0) return "Not ranked";
    return `${ranking.position} / ${ranking.total}`;
  }, []);

  const getTabTitle = useCallback((scoreType: ScoreType): string => {
    const fullName = highscoreService.getScoreTypeName(scoreType);
    switch (scoreType) {
      case 'company_value':
        return 'Company Value';
      case 'company_value_per_week':
        return 'Value/Week';
      case 'highest_vintage_quantity':
        return 'Vintage Quantity';
      case 'most_productive_vineyard':
        return 'Vineyard Production';
      case 'highest_wine_score':
        return 'Wine Score';
      case 'highest_grape_quality':
        return 'Grape Quality';
      case 'highest_balance':
        return 'Balance';
      case 'highest_price':
        return 'Highest Price';
      case 'lowest_price':
        return 'Lowest Price';
      default:
        return fullName;
    }
  }, []);

  const getTabIcon = useCallback((scoreType: ScoreType) => {
    switch (scoreType) {
      case 'company_value':
        return '🏢';
      case 'company_value_per_week':
        return '🚀';
      case 'highest_vintage_quantity':
        return '🍾';
      case 'most_productive_vineyard':
        return '🍇';
      case 'highest_wine_score':
        return '🏆';
      case 'highest_grape_quality':
        return '⭐';
      case 'highest_balance':
        return '⚖️';
      case 'highest_price':
        return '💰';
      case 'lowest_price':
        return '💸';
      default:
        return '🏆';
    }
  }, []);

  const firstTabGroup = useMemo(() => (
    ['company_value', 'company_value_per_week', 'highest_vintage_quantity', 'most_productive_vineyard'] as ScoreType[]
  ), []);

  const secondTabGroup = useMemo(() => (
    ['highest_wine_score', 'highest_grape_quality', 'highest_balance', 'highest_price', 'lowest_price'] as ScoreType[]
  ), []);

  // Calculate some basic stats using utility functions - memoized for performance
  const { weeksElapsed, avgMoneyPerWeek, companyAge } = useMemo(() => {
    const weeks = company ? calculateCompanyWeeks(company.foundedYear, company.currentWeek, company.currentSeason, company.currentYear) : 1;
    const avgMoney = (gameState.money || 0) / weeks;
    const age = `${formatNumber(Math.floor(weeks / 52), { decimals: 0, forceDecimals: true })} years, ${formatNumber(weeks % 52, { decimals: 0, forceDecimals: true })} weeks`;
    return { weeksElapsed: weeks, avgMoneyPerWeek: avgMoney, companyAge: age };
  }, [company, gameState.money]);

  return (
    <div className="space-y-3">
      {/* Company Banner */}
      <div 
        className="h-28 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-2">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {company?.name || gameState.companyName || 'My Winery'}
              </h2>
              <p className="text-white/90 text-[10px] mt-0.5">{formatCompanyGameDate()}</p>
            </div>
            {onNavigate && (
              <div className="flex gap-1.5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2 py-1"
                  onClick={() => onNavigate('profile')}
                >
                  Profile
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2 py-1"
                  onClick={() => onNavigate('highscores')}
                >
                  Leaderboards
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Main Stats Grid - Desktop/Tablet (hidden on mobile) */}
        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Current Money</p>
                  <p className="text-lg font-bold">{formatNumber(gameState.money || 0, { currency: true, decimals: 0, compact: (gameState.money || 0) >= 1000 })}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  💰
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Prestige</p>
                  <p className="text-lg font-bold">{formatNumber(gameState.prestige || 1, { compact: (gameState.prestige || 1) >= 1000, decimals: 1 })}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Trophy className="h-3.5 w-3.5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Avg/Week</p>
                  <p className="text-lg font-bold">{formatNumber(avgMoneyPerWeek, { currency: true, decimals: 0, compact: avgMoneyPerWeek >= 1000 })}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Company Age</p>
                  <p className="text-sm font-bold">{companyAge}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Stats Grid - Mobile (2x2 grid) */}
        <div className="lg:hidden grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg shadow">
            <div className="text-base font-bold text-gray-900">{formatNumber(gameState.money || 0, { currency: true, decimals: 0, compact: (gameState.money || 0) >= 1000 })}</div>
            <div className="text-xs text-gray-500">Current Money</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow">
            <div className="text-base font-bold text-purple-600">{formatNumber(gameState.prestige || 1, { compact: (gameState.prestige || 1) >= 1000, decimals: 1 })}</div>
            <div className="text-xs text-gray-500">Prestige</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow">
            <div className="text-base font-bold text-blue-600">{formatNumber(avgMoneyPerWeek, { currency: true, decimals: 0, compact: avgMoneyPerWeek >= 1000 })}</div>
            <div className="text-xs text-gray-500">Avg/Week</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow">
            <div className="text-sm font-bold text-amber-600">{companyAge}</div>
            <div className="text-xs text-gray-500">Company Age</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Financial Overview */}
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-3.5 w-3.5" />
                Financial Overview
              </CardTitle>
              <CardDescription className="text-xs">
                Your company's financial performance and breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cash Money:</span>
                  <span className="text-sm font-semibold">{formatNumber(gameState.money || 0, { currency: true, decimals: 2, compact: (gameState.money || 0) >= 1000 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Founded:</span>
                  <span>{company?.foundedYear || gameState.foundedYear || 2024}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Game Time:</span>
                  <span>{formatCompanyGameDate()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Weeks in Business:</span>
                  <span>{weeksElapsed} weeks</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Average per Week:</span>
                  <span>{formatNumber(avgMoneyPerWeek, { currency: true, decimals: 0, compact: avgMoneyPerWeek >= 1000 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Trophy className="h-3.5 w-3.5" />
                  Rankings
                </CardTitle>
                <CardDescription className="text-xs">Your position on the leaderboards</CardDescription>
              </div>
              {onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 py-1"
                  onClick={() => onNavigate('highscores')}
                >
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Loading rankings...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...firstTabGroup, ...secondTabGroup].map((scoreType) => (
                    <div
                      key={scoreType}
                      className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 max-w-full"
                    >
                      <span className="shrink-0">{getTabIcon(scoreType)}</span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[28vw] sm:max-w-[14vw] md:max-w-[10vw]">
                        {getTabTitle(scoreType)}
                      </span>
                      <span className="text-[11px] font-medium text-foreground/90 whitespace-nowrap">
                        {formatRanking(rankings[scoreType])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Wine Cellar Stats */}
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wine className="h-3.5 w-3.5" />
                Wine Cellar
              </CardTitle>
              <CardDescription className="text-xs">
                Your bottled wine inventory and aged collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Bottled Wines:</span>
                  <span className="text-sm font-semibold">{cellarStats.bottledWineCount} batches</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Bottles:</span>
                  <span className="text-sm font-semibold">{cellarStats.bottledBottles.toLocaleString()} bottles</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cellar Value:</span>
                  <span className="text-sm font-semibold">{formatNumber(cellarStats.totalWineValue, { currency: true, decimals: 0, compact: cellarStats.totalWineValue >= 1000 })}</span>
                </div>
                <div className="border-t pt-1.5 mt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Aged Wines (5+ years):</span>
                    <span className="text-xs font-semibold text-amber-600">{cellarStats.agedWineCount} batches</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground text-xs">Aged Wine Value:</span>
                    <span className="text-xs font-semibold text-amber-600">{formatNumber(cellarStats.agedWineValue, { currency: true, decimals: 0, compact: cellarStats.agedWineValue >= 1000 })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

export default CompanyOverview;
