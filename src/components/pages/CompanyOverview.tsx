import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '../ui';
import { Building2, TrendingUp, Trophy, Calendar, BarChart3, Wine } from 'lucide-react';
import { formatGameDateFromObject, formatCurrency, calculateCompanyWeeks, formatGameDate, formatNumber } from '@/lib/utils/utils';
import { useGameState, useGameUpdates } from '@/hooks';
import { getCurrentCompany, highscoreService } from '@/lib/services';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { NavigationProps } from '../../lib/types/UItypes';

interface CompanyOverviewProps extends NavigationProps {
  // Inherits onNavigate from NavigationProps
}

interface CompanyRankings {
  company_value: { position: number; total: number };
  company_value_per_week: { position: number; total: number };
}

const CompanyOverview: React.FC<CompanyOverviewProps> = ({ onNavigate }) => {
  const { isLoading, withLoading } = useLoadingState();
  const gameState = useGameState();
  const company = getCurrentCompany();
  
  const [rankings, setRankings] = useState<CompanyRankings>({
    company_value: { position: 0, total: 0 },
    company_value_per_week: { position: 0, total: 0 }
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

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Current Money</p>
                  <p className="text-lg font-bold">{formatCurrency(gameState.money || 0, 0, (gameState.money || 0) >= 1000)}</p>
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
                  <p className="text-lg font-bold">{formatCurrency(gameState.prestige || 1, 1, (gameState.prestige || 1) >= 1000).replace('€', '')}</p>
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
                  <p className="text-lg font-bold">{formatCurrency(avgMoneyPerWeek, 0, avgMoneyPerWeek >= 1000)}</p>
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
                  <span className="text-sm font-semibold">{formatCurrency(gameState.money || 0, 2, (gameState.money || 0) >= 1000)}</span>
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
                  <span>{formatCurrency(avgMoneyPerWeek, 0, avgMoneyPerWeek >= 1000)}</span>
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
                <div className="space-y-2.5">
                  <div className="border rounded-md p-2">
                    <div className="text-xs text-muted-foreground">Company Value</div>
                    <div className="text-sm font-medium">{formatRanking(rankings.company_value)}</div>
                  </div>
                  <div className="border rounded-md p-2">
                    <div className="text-xs text-muted-foreground">Value Growth</div>
                    <div className="text-sm font-medium">{formatRanking(rankings.company_value_per_week)}</div>
                  </div>
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
                  <span className="text-sm font-semibold">{formatCurrency(cellarStats.totalWineValue, 0, cellarStats.totalWineValue >= 1000)}</span>
                </div>
                <div className="border-t pt-1.5 mt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Aged Wines (5+ years):</span>
                    <span className="text-xs font-semibold text-amber-600">{cellarStats.agedWineCount} batches</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground text-xs">Aged Wine Value:</span>
                    <span className="text-xs font-semibold text-amber-600">{formatCurrency(cellarStats.agedWineValue, 0, cellarStats.agedWineValue >= 1000)}</span>
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
