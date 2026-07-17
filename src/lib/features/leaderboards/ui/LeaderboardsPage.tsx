import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Badge, Button } from '@/components/ui';
import { Trophy, Medal, Award, TrendingUp, RefreshCw } from 'lucide-react';
import { leaderboardsFeature } from '../feature';
import { formatNumber, formatPercent, getColorClass, getQualityCategory, getWineStructureCategory } from '@/lib/utils';
import type { LeaderboardEntry, LeaderboardKind, LeaderboardPageInput } from '../featureTypes';

const LEADERBOARD_DEFINITIONS: Record<LeaderboardKind, {
  tabTitle: string;
  heading: string;
  description: string;
  group: 1 | 2;
}> = {
  company_value: { tabTitle: 'Company Value', heading: 'Top Companies by Total Value', description: 'Rankings based on overall company worth including assets and cash', group: 1 },
  company_value_per_week: { tabTitle: 'Company Value/Week', heading: 'Fastest Growing Companies', description: 'Best company value growth rate per week', group: 1 },
  highest_vintage_quantity: { tabTitle: 'Vintage Quantity', heading: 'Largest Single Vintage Production', description: 'Most bottles produced in a single wine batch', group: 1 },
  most_productive_vineyard: { tabTitle: 'Vineyard Production', heading: 'Most Productive Vineyards', description: 'Total bottles produced across all vintages', group: 1 },
  highest_wine_score: { tabTitle: 'Wine Score', heading: 'Highest Wine Score', description: 'Best overall wine score achieved', group: 2 },
  highest_taste_quality_index: { tabTitle: 'Taste Quality', heading: 'Highest Taste Quality', description: 'Best taste quality achieved', group: 2 },
  highest_structure_index: { tabTitle: 'Structure', heading: 'Best Structure', description: 'Highest structure index wines', group: 2 },
  highest_price: { tabTitle: 'Highest Price', heading: 'Most Expensive Wines', description: 'Highest price per bottle achieved', group: 2 },
  lowest_price: { tabTitle: 'Lowest Price', heading: 'Most Affordable Wines', description: 'Lowest price per bottle achieved', group: 2 },
};

const LEADERBOARD_KINDS = Object.keys(LEADERBOARD_DEFINITIONS) as LeaderboardKind[];

function emptyHighscores(): Record<LeaderboardKind, LeaderboardEntry[]> {
  return Object.fromEntries(LEADERBOARD_KINDS.map((kind) => [kind, []])) as unknown as Record<LeaderboardKind, LeaderboardEntry[]>;
}

export function LeaderboardsPage({ currentCompanyId, onBack }: LeaderboardPageInput) {
  const { isLoading, withLoading } = useLoadingState();
  const [highscores, setHighscores] = useState<Record<LeaderboardKind, LeaderboardEntry[]>>(emptyHighscores);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllHighscores();
  }, []);

  const loadAllHighscores = () => withLoading(async () => {
    setError(null);

    const scores = await Promise.all(LEADERBOARD_KINDS.map((kind) => leaderboardsFeature.views.list(kind, 50)));
    setHighscores(Object.fromEntries(LEADERBOARD_KINDS.map((kind, index) => [kind, scores[index]])) as unknown as Record<LeaderboardKind, LeaderboardEntry[]>);
  });

  const formatGameDate = (entry: LeaderboardEntry): string => {
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

  const getColumnTitle = useCallback((scoreType: LeaderboardKind): string => {
    return leaderboardsFeature.views.kindName(scoreType);
  }, []);

  const getTabIcon = useCallback((scoreType: LeaderboardKind) => {
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
      case 'highest_taste_quality_index':
        return '⭐';
      case 'highest_structure_index':
        return '⚖️';
      case 'highest_price':
        return '💰';
      case 'lowest_price':
        return '💸';
      default:
        return '🏆';
    }
  }, []);

  const tabGroups = useMemo(() => [
    LEADERBOARD_KINDS.filter((kind) => LEADERBOARD_DEFINITIONS[kind].group === 1),
    LEADERBOARD_KINDS.filter((kind) => LEADERBOARD_DEFINITIONS[kind].group === 2),
  ], []);

  const getScoreColorClass = useCallback((scoreType: LeaderboardKind, scoreValue: number, index: number, totalScores: number): string => {
    // For wine quality metrics (0-1 range), use direct color mapping
    if (scoreType === 'highest_wine_score' || scoreType === 'highest_taste_quality_index' || scoreType === 'highest_structure_index') {
      return getColorClass(scoreValue);
    }
    
    // For ranking-based coloring (top performers get better colors)
    // Normalize position to 0-1 (1st place = 1.0, last place = 0.0)
    const normalizedPosition = totalScores > 1 ? 1 - (index / (totalScores - 1)) : 1;
    
    // Use exponential scaling for ranking colors (top ranks get better colors)
    if (normalizedPosition >= 0.9) return getColorClass(0.95); // Top 10%
    if (normalizedPosition >= 0.7) return getColorClass(0.85); // Top 30%
    if (normalizedPosition >= 0.5) return getColorClass(0.7);  // Top 50%
    if (normalizedPosition >= 0.3) return getColorClass(0.5);  // Top 70%
    return getColorClass(0.3); // Bottom 30%
  }, []);

  const getScoreCategory = useCallback((scoreType: LeaderboardKind, scoreValue: number): string | null => {
    if (scoreType === 'highest_wine_score' || scoreType === 'highest_taste_quality_index') {
      return getQualityCategory(scoreValue);
    }
    if (scoreType === 'highest_structure_index') {
      return getWineStructureCategory(scoreValue);
    }
    return null;
  }, []);

  const renderHighscoreTable = useCallback((scoreType: LeaderboardKind) => {
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
                {(scoreType.includes('wine') || scoreType.includes('vintage') || scoreType.includes('vineyard')) ? (
                  <>
                    <TableHead>Vineyard</TableHead>
                    {scoreType !== 'most_productive_vineyard' && (
                      <TableHead>Vintage</TableHead>
                    )}
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
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-mono font-semibold ${getScoreColorClass(scoreType, score.value, index, scores.length)}`}>
                        {scoreType === 'highest_wine_score' ?
                          formatNumber(score.value, { decimals: 1, forceDecimals: true }) :
                          scoreType.includes('price') ? 
                            formatNumber(score.value, { currency: true, decimals: 2 }) :
                            scoreType.includes('quality') || scoreType.includes('structure') ?
                              formatPercent(score.value, 1, true) :
                              formatNumber(score.value, { decimals: 0, forceDecimals: true })
                        }
                      </span>
                      {getScoreCategory(scoreType, score.value) && (
                        <span className="text-xs text-muted-foreground">
                          {getScoreCategory(scoreType, score.value)}
                        </span>
                      )}
                    </div>
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
                    {score.wineVintage && scoreType !== 'most_productive_vineyard' && (
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
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-lg font-bold ${getScoreColorClass(scoreType, score.value, index, scores.length)}`}>
                        {scoreType === 'highest_wine_score' ?
                          formatNumber(score.value, { decimals: 1, forceDecimals: true }) :
                          scoreType.includes('price') ?
                            formatNumber(score.value, { currency: true, decimals: 2 }) :
                            scoreType.includes('quality') || scoreType.includes('structure') ?
                              formatPercent(score.value, 1, true) :
                              formatNumber(score.value, { decimals: 0, forceDecimals: true })
                        }
                      </span>
                      {getScoreCategory(scoreType, score.value) && (
                        <span className="text-xs text-muted-foreground">
                          {getScoreCategory(scoreType, score.value)}
                        </span>
                      )}
                    </div>
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
  }, [error, highscores, isLoading, currentCompanyId, getColumnTitle, getRankIcon, getScoreColorClass, getScoreCategory]);

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
              {tabGroups.map((group) => (
                <TabsList key={group[0]} className="w-full mb-6 flex flex-wrap gap-2 h-auto">
                  {group.map((scoreType) => (
                    <TabsTrigger
                      key={scoreType}
                      value={scoreType}
                      className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm truncate"
                    >
                      <span>{getTabIcon(scoreType)}</span>
                      <span className="truncate max-w-[42vw] sm:max-w-none">{LEADERBOARD_DEFINITIONS[scoreType].tabTitle}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              ))}

              {LEADERBOARD_KINDS.map((scoreType) => {
                const definition = LEADERBOARD_DEFINITIONS[scoreType];
                return (
                  <TabsContent key={scoreType} value={scoreType} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold">{definition.heading}</h3>
                      <p className="text-sm text-muted-foreground">{definition.description}</p>
                    </div>
                    {renderHighscoreTable(scoreType)}
                  </TabsContent>
                );
              })}

            </Tabs>
          </CardContent>
        </Card>

        {/* Information Footer */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Leaderboards are updated as companies achieve new milestones.
                Company-value boards retain each company’s best score; wine and vineyard boards preserve historical achievements.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

