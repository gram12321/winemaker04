import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Building2, TrendingUp, Trophy, Calendar, BarChart3 } from 'lucide-react';
import { formatGameDateFromObject, formatNumber, calculateCompanyWeeks, formatGameDate } from '@/lib/utils/utils';
import { useGameState } from '@/hooks/useGameState';
import { getCurrentCompany } from '@/lib/services/gameState';
import { highscoreService } from '@/lib/services/highscoreService';

interface CompanyOverviewProps {
  onNavigate?: (page: string) => void;
}

interface CompanyRankings {
  company_value: { position: number; total: number };
  company_value_per_week: { position: number; total: number };
}

const CompanyOverview: React.FC<CompanyOverviewProps> = ({ onNavigate }) => {
  const gameState = useGameState();
  const company = getCurrentCompany();
  
  const [rankings, setRankings] = useState<CompanyRankings>({
    company_value: { position: 0, total: 0 },
    company_value_per_week: { position: 0, total: 0 }
  });
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);

  const gameDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };

  useEffect(() => {
    if (company) {
      loadCompanyRankings();
    }
  }, [company?.id]);

  const loadCompanyRankings = async () => {
    if (!company) return;
    
    setIsLoadingRankings(true);
    try {
      const companyRankings = await highscoreService.getCompanyRankings(company.id);
      setRankings(companyRankings);
    } catch (error) {
      console.error('Error loading company rankings:', error);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  const formatCompanyGameDate = () => {
    if (!company) return formatGameDateFromObject(gameDate);
    return formatGameDate(company.currentWeek, company.currentSeason, company.currentYear);
  };

  const formatRanking = (ranking: { position: number; total: number }): string => {
    if (ranking.position === 0) return "Not ranked";
    return `${ranking.position} / ${ranking.total}`;
  };

  // Calculate some basic stats using utility functions
  const weeksElapsed = company ? calculateCompanyWeeks(company.foundedYear, company.currentWeek, company.currentSeason, company.currentYear) : 1;
  const avgMoneyPerWeek = (gameState.money || 0) / weeksElapsed;
  const companyAge = `${Math.floor(weeksElapsed / 52)} years, ${weeksElapsed % 52} weeks`;

  return (
    <div className="space-y-6">
      {/* Company Banner */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-2xl font-semibold flex items-center gap-3">
                <Building2 className="h-6 w-6" />
                {company?.name || gameState.companyName || 'My Winery'}
              </h2>
              <p className="text-white/90 text-sm mt-1">{formatCompanyGameDate()}</p>
            </div>
            {onNavigate && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => onNavigate('profile')}
                >
                  Profile
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Money</p>
                  <p className="text-2xl font-bold">€{formatNumber(gameState.money || 0, 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  💰
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Prestige</p>
                  <p className="text-2xl font-bold">{formatNumber(gameState.prestige || 1, 1)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg/Week</p>
                  <p className="text-2xl font-bold">€{formatNumber(avgMoneyPerWeek, 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Company Age</p>
                  <p className="text-lg font-bold">{companyAge}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Financial Overview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Financial Overview
              </CardTitle>
              <CardDescription>
                Your company's financial performance and breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cash Money:</span>
                  <span className="text-lg font-semibold">€{formatNumber(gameState.money || 0, 2)}</span>
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
                  <span>€{formatNumber(avgMoneyPerWeek, 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Rankings
                </CardTitle>
                <CardDescription>Your position on the leaderboards</CardDescription>
              </div>
              {onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('highscores')}
                >
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingRankings ? (
                <p className="text-sm text-muted-foreground">Loading rankings...</p>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Company Value</div>
                    <div className="font-medium">{formatRanking(rankings.company_value)}</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Value Growth</div>
                    <div className="font-medium">{formatRanking(rankings.company_value_per_week)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

export default CompanyOverview;
