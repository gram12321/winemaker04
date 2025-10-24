import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Badge, Button } from '../ui';
import { Trophy, Medal, Award, TrendingUp, RefreshCw } from 'lucide-react';
import { highscoreService } from '@/lib/services';
import { type HighscoreEntry, type ScoreType } from '@/lib/database';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { PageProps, CompanyProps } from '../../lib/types/UItypes';

interface HighscoresProps extends PageProps, CompanyProps {
  // Inherits currentCompanyId and onBack from shared interfaces
}

export function Highscores({ currentCompanyId, onBack }: HighscoresProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [highscores, setHighscores] = useState<Record<ScoreType, HighscoreEntry[]>>({
    company_value: [],
    company_value_per_week: [],
    highest_vintage_quantity: [],
    most_productive_vineyard: [],
    highest_wine_score: [],
    highest_grape_quality: [],
    highest_balance: [],
    highest_price: [],
    lowest_price: []
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllHighscores();
  }, []);

  const loadAllHighscores = () => withLoading(async () => {
    setError(null);

    const [
      companyValueScores, 
      companyValuePerWeekScores,
      highestVintageQuantityScores,
      mostProductiveVineyardScores,
      highestWineScoreScores,
      highestGrapeQualityScores,
      highestBalanceScores,
      highestPriceScores,
      lowestPriceScores
    ] = await Promise.all([
      highscoreService.getHighscores('company_value', 50),
      highscoreService.getHighscores('company_value_per_week', 50),
      highscoreService.getHighscores('highest_vintage_quantity', 50),
      highscoreService.getHighscores('most_productive_vineyard', 50),
      highscoreService.getHighscores('highest_wine_score', 50),
      highscoreService.getHighscores('highest_grape_quality', 50),
      highscoreService.getHighscores('highest_balance', 50),
      highscoreService.getHighscores('highest_price', 50),
      highscoreService.getHighscores('lowest_price', 50)
    ]);

    setHighscores({
      company_value: companyValueScores,
      company_value_per_week: companyValuePerWeekScores,
      highest_vintage_quantity: highestVintageQuantityScores,
      most_productive_vineyard: mostProductiveVineyardScores,
      highest_wine_score: highestWineScoreScores,
      highest_grape_quality: highestGrapeQualityScores,
      highest_balance: highestBalanceScores,
      highest_price: highestPriceScores,
      lowest_price: lowestPriceScores
    });
  });

  const formatGameDate = (entry: HighscoreEntry): string => {
    if (!entry.gameWeek || !entry.gameSeason || !entry.gameYear) {
      return 'N/A';
    }
    return `Week ${entry.gameWeek}, ${entry.gameSeason} ${entry.gameYear}`;
  };

  const getRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-sm font-medium">{index + 1}</span>;
    }
  }, []);

  const getColumnTitle = useCallback((scoreType: ScoreType): string => {
    return highscoreService.getScoreTypeName(scoreType);
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

  const renderHighscoreTable = useCallback((scoreType: ScoreType) => {
    const scores = highscores[scoreType];
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Loading leaderboard...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadAllHighscores} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (scores.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No scores submitted yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Be the first to establish your winemaking empire!
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Company Name</TableHead>
                {scoreType.includes('wine') || scoreType.includes('vintage') || scoreType.includes('vineyard') ? (
                  <>
                    <TableHead>Vineyard</TableHead>
                    <TableHead>Vintage</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">{getColumnTitle(scoreType)}</TableHead>
                <TableHead className="text-right">Game Date</TableHead>
                <TableHead className="text-right">Achieved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((score, index) => (
                <TableRow 
                  key={`${score.companyId}-${index}`}
                  className={currentCompanyId === score.companyId ? 'bg-primary/5 border-primary/20' : ''}
                >
                  <TableCell className="flex items-center justify-center">
                    {getRankIcon(index)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {score.companyName}
                      {currentCompanyId === score.companyId && (
                        <Badge variant="outline" className="text-xs">Your Company</Badge>
                      )}
                    </div>
                  </TableCell>
                  {scoreType.includes('wine') || scoreType.includes('vintage') || scoreType.includes('vineyard') ? (
                    <>
                      <TableCell className="text-sm">
                        {score.vineyardName || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {score.wineVintage ? `${score.wineVintage} ${score.grapeVariety || ''}` : 'N/A'}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-right font-mono">
                    {scoreType.includes('price') ? 
                      formatCurrency(score.scoreValue, 2) :
                      scoreType.includes('quality') || scoreType.includes('balance') ?
                        formatPercent(score.scoreValue, 1, true) :
                        formatNumber(score.scoreValue, { decimals: 0, forceDecimals: true })
                    }
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatGameDate(score)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {score.achievedAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {scores.map((score, index) => (
            <Card 
              key={`${score.companyId}-${index}`}
              className={currentCompanyId === score.companyId ? 'border-primary border-2 bg-primary/5' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(index)}
                    </div>
                    <div>
                      <div className="font-medium text-base">{score.companyName}</div>
                      {currentCompanyId === score.companyId && (
                        <Badge variant="outline" className="text-xs mt-1">Your Company</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {(scoreType.includes('wine') || scoreType.includes('vintage') || scoreType.includes('vineyard')) && (
                  <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b">
                    {score.vineyardName && (
                      <div>
                        <div className="text-xs text-gray-500">Vineyard</div>
                        <div className="text-sm font-medium">{score.vineyardName}</div>
                      </div>
                    )}
                    {score.wineVintage && (
                      <div>
                        <div className="text-xs text-gray-500">Vintage</div>
                        <div className="text-sm font-medium">{score.wineVintage} {score.grapeVariety || ''}</div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{getColumnTitle(scoreType)}:</span>
                    <span className="text-lg font-bold text-primary">
                      {scoreType.includes('price') ? 
                        formatCurrency(score.scoreValue, 2) :
                        scoreType.includes('quality') || scoreType.includes('balance') ?
                          formatPercent(score.scoreValue, 1, true) :
                          formatNumber(score.scoreValue, { decimals: 0, forceDecimals: true })
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Game Date:</span>
                    <span className="text-gray-900">{formatGameDate(score)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Achieved:</span>
                    <span className="text-gray-900">{score.achievedAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }, [error, highscores, isLoading, currentCompanyId, getColumnTitle, getRankIcon]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              Global Leaderboards
            </h1>
            <p className="text-muted-foreground mt-1">
              Top performing wine companies from around the world
            </p>
          </div>
          <div className="flex gap-2">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={loadAllHighscores}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Leaderboard Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Competition Rankings
            </CardTitle>
            <CardDescription>
              Compare your winemaking empire with companies worldwide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="company_value" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                {firstTabGroup.map((scoreType) => (
                  <TabsTrigger key={scoreType} value={scoreType} className="flex items-center gap-2">
                    <span>{getTabIcon(scoreType)}</span>
                    <span className="hidden sm:inline">{getTabTitle(scoreType)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <TabsList className="grid w-full grid-cols-4 mb-6">
                {secondTabGroup.map((scoreType) => (
                  <TabsTrigger key={scoreType} value={scoreType} className="flex items-center gap-2">
                    <span>{getTabIcon(scoreType)}</span>
                    <span className="hidden sm:inline">{getTabTitle(scoreType)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="company_value" className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">Top Companies by Total Value</h3>
                  <p className="text-sm text-muted-foreground">
                    Rankings based on overall company worth including assets and cash
                  </p>
                </div>
                {renderHighscoreTable('company_value')}
              </TabsContent>

              <TabsContent value="company_value_per_week" className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">Fastest Growing Companies</h3>
                  <p className="text-sm text-muted-foreground">
                    Best company value growth rate per week
                  </p>
                </div>
                {renderHighscoreTable('company_value_per_week')}
              </TabsContent>

              <TabsContent value="highest_vintage_quantity" className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">Largest Single Vintage Production</h3>
                  <p className="text-sm text-muted-foreground">
                    Most bottles produced in a single wine batch
                  </p>
                </div>
                {renderHighscoreTable('highest_vintage_quantity')}
              </TabsContent>

              <TabsContent value="most_productive_vineyard" className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">Most Productive Vineyards</h3>
                  <p className="text-sm text-muted-foreground">
                    Total bottles produced across all vintages
                  </p>
                </div>
                {renderHighscoreTable('most_productive_vineyard')}
              </TabsContent>

               <TabsContent value="highest_wine_score" className="space-y-4">
                 <div className="text-center mb-4">
                   <h3 className="text-lg font-semibold">Highest Wine Score</h3>
                   <p className="text-sm text-muted-foreground">
                     Best overall wine score achieved
                   </p>
                 </div>
                 {renderHighscoreTable('highest_wine_score')}
               </TabsContent>

               <TabsContent value="highest_grape_quality" className="space-y-4">
                 <div className="text-center mb-4">
                   <h3 className="text-lg font-semibold">Highest Grape Quality</h3>
                   <p className="text-sm text-muted-foreground">
                     Best grape quality achieved
                   </p>
                 </div>
                 {renderHighscoreTable('highest_grape_quality')}
               </TabsContent>

               <TabsContent value="highest_balance" className="space-y-4">
                 <div className="text-center mb-4">
                   <h3 className="text-lg font-semibold">Best Balance</h3>
                   <p className="text-sm text-muted-foreground">
                     Most perfectly balanced wines
                   </p>
                 </div>
                 {renderHighscoreTable('highest_balance')}
               </TabsContent>

               <TabsContent value="highest_price" className="space-y-4">
                 <div className="text-center mb-4">
                   <h3 className="text-lg font-semibold">Most Expensive Wines</h3>
                   <p className="text-sm text-muted-foreground">
                     Highest price per bottle achieved
                   </p>
                 </div>
                 {renderHighscoreTable('highest_price')}
               </TabsContent>

               <TabsContent value="lowest_price" className="space-y-4">
                 <div className="text-center mb-4">
                   <h3 className="text-lg font-semibold">Most Affordable Wines</h3>
                   <p className="text-sm text-muted-foreground">
                     Lowest price per bottle achieved
                   </p>
                 </div>
                 {renderHighscoreTable('lowest_price')}
               </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        {/* Information Footer */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Leaderboards are updated in real-time as companies achieve new milestones.
                Rankings are based on the highest scores achieved by each company.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
