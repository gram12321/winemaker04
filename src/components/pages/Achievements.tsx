import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '../ui';
import { Trophy, Medal, Lock, Calendar, Coins, Wine, Star } from 'lucide-react';
import { formatNumber, formatPercent, formatGameDateFromObject } from '@/lib/utils/utils';
import { PageProps, CompanyProps } from '../../lib/types/UItypes';
import { getAllAchievementsWithStatus, getAchievementStats } from '@/lib/services';
import { getAchievementLevelInfo } from '@/lib/services/user/achievementService';
import { AchievementLevel } from '@/lib/types/types';

interface AchievementsProps extends PageProps, CompanyProps {
  // Inherits currentCompany and onBack from shared interfaces
}

// Achievement types are now imported from the service layer

export function Achievements({ currentCompany, onBack }: AchievementsProps) {
  const { withLoading } = useLoadingState();
  const [achievementsWithStatus, setAchievementsWithStatus] = useState<any[]>([]);
  const [achievementStats, setAchievementStats] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadAchievementsData();
    }
  }, [currentCompany]);

  const loadAchievementsData = async () => {
    await withLoading(async () => {
      if (!currentCompany) return;

      try {
        setLoading(true);

        // Load achievements with status
        const achievements = await getAllAchievementsWithStatus();
        setAchievementsWithStatus(achievements);

        // Load achievement statistics
        const stats = await getAchievementStats();
        setAchievementStats(stats);
      } catch (error) {
        console.error('Error loading achievements data:', error);
      } finally {
        setLoading(false);
      }
    });
  };

  const getAchievementLevelDisplayInfo = (achievementLevel?: number) => {
    if (!achievementLevel || achievementLevel < 1 || achievementLevel > 5) {
      return { name: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
    return getAchievementLevelInfo(achievementLevel as AchievementLevel);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial':
        return <Coins className="h-4 w-4" />;
      case 'production':
        return <Wine className="h-4 w-4" />;
      case 'time':
        return <Calendar className="h-4 w-4" />;
      case 'prestige':
        return <Star className="h-4 w-4" />;
      case 'sales':
        return <Trophy className="h-4 w-4" />;
      case 'vineyard':
        return <Medal className="h-4 w-4" />;
      default:
        return <Medal className="h-4 w-4" />;
    }
  };

  // Filter achievements to show only completed tiers and next achievable tier in each series
  const filterAchievementsBySeries = (achievements: any[]) => {
    // Group achievements by series (base ID without tier)
    const seriesMap = new Map<string, any[]>();
    const nonTieredAchievements: any[] = [];
    
    achievements.forEach(achievement => {
      // Check if this is a tiered achievement
      if (achievement.id.includes('_tier_')) {
        // Extract base ID (remove _tier_X suffix)
        const baseId = achievement.id.replace(/_tier_\d+$/, '');
        if (!seriesMap.has(baseId)) {
          seriesMap.set(baseId, []);
        }
        seriesMap.get(baseId)!.push(achievement);
      } else {
        // Non-tiered achievements (like vineyard achievements)
        nonTieredAchievements.push(achievement);
      }
    });

    const filteredAchievements: any[] = [];
    
    // Process tiered achievements
    seriesMap.forEach((seriesAchievements) => {
      // Sort by tier (extract tier number from ID)
      const sortedAchievements = seriesAchievements.sort((a, b) => {
        const aTier = parseInt(a.id.match(/_tier_(\d+)$/)?.[1] || '0');
        const bTier = parseInt(b.id.match(/_tier_(\d+)$/)?.[1] || '0');
        return aTier - bTier;
      });

      // Find the highest completed tier
      let highestCompletedTier = -1;
      for (let i = 0; i < sortedAchievements.length; i++) {
        if (sortedAchievements[i].isUnlocked) {
          highestCompletedTier = i;
        }
      }

      // Add all completed tiers
      for (let i = 0; i <= highestCompletedTier; i++) {
        filteredAchievements.push(sortedAchievements[i]);
      }

      // Add the next achievable tier (if any)
      const nextTierIndex = highestCompletedTier + 1;
      if (nextTierIndex < sortedAchievements.length) {
        filteredAchievements.push(sortedAchievements[nextTierIndex]);
      }
    });

    // Add all non-tiered achievements (individual achievements that don't follow the _tier_X pattern)
    filteredAchievements.push(...nonTieredAchievements);

    return filteredAchievements;
  };

  const categoryFilteredAchievements = selectedCategory === 'all'
    ? achievementsWithStatus
    : achievementsWithStatus.filter(a => a.category === selectedCategory);

  const filteredAchievements = filterAchievementsBySeries(categoryFilteredAchievements);

  const unlockedCount = achievementStats?.unlockedCount || 0;
  const totalCount = achievementStats?.totalAchievements || 0;

  if (!currentCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              No Active Company
            </CardTitle>
            <CardDescription>
              You need to select a company to view achievements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {onBack && (
              <Button onClick={onBack} className="w-full">
                Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Achievements & Records
          </h2>
          <p className="text-muted-foreground mt-1">
            Track your progress, achievements, and wine production history for {currentCompany.name}
          </p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

      <div className="space-y-6">

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Progress Overview</h3>
                <p className="text-muted-foreground">
                  {unlockedCount} of {totalCount} achievements unlocked
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-600">
                  {formatPercent((achievementStats?.unlockedPercent || 0) / 100, 0, true)}
                </div>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Category Filter */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All ({totalCount})
              </Button>
              <Button
                variant={selectedCategory === 'financial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('financial')}
                className="flex items-center gap-2"
              >
                <Coins className="h-3 w-3" />
                Financial ({achievementStats?.byCategory?.financial?.total || 0})
              </Button>
              <Button
                variant={selectedCategory === 'production' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('production')}
                className="flex items-center gap-2"
              >
                <Wine className="h-3 w-3" />
                Production ({achievementStats?.byCategory?.production?.total || 0})
              </Button>
              <Button
                variant={selectedCategory === 'time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('time')}
                className="flex items-center gap-2"
              >
                <Calendar className="h-3 w-3" />
                Time ({achievementStats?.byCategory?.time?.total || 0})
              </Button>
              <Button
                variant={selectedCategory === 'prestige' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('prestige')}
                className="flex items-center gap-2"
              >
                <Star className="h-3 w-3" />
                Prestige ({achievementStats?.byCategory?.prestige?.total || 0})
              </Button>
              <Button
                variant={selectedCategory === 'sales' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('sales')}
                className="flex items-center gap-2"
              >
                <Trophy className="h-3 w-3" />
                Sales ({achievementStats?.byCategory?.sales?.total || 0})
              </Button>
              <Button
                variant={selectedCategory === 'vineyard' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('vineyard')}
                className="flex items-center gap-2"
              >
                <Medal className="h-3 w-3" />
                Vineyard ({achievementStats?.byCategory?.vineyard?.total || 0})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="h-2 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredAchievements.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No achievements found for the selected category.
            </div>
          ) : (
            filteredAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={`transition-all duration-200 ${
                  achievement.isUnlocked
                    ? 'border-yellow-200 bg-yellow-50 shadow-md'
                    : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl p-2 rounded-lg ${
                        achievement.isUnlocked ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {achievement.isUnlocked ? achievement.icon : <Lock className="h-5 w-5 text-gray-400" />}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${
                          achievement.isUnlocked ? 'text-yellow-800' : 'text-gray-600'
                        }`}>
                          {achievement.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getCategoryIcon(achievement.category)}
                          <Badge className={getAchievementLevelDisplayInfo(achievement.achievementLevel).color}>
                            {getAchievementLevelDisplayInfo(achievement.achievementLevel).name}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className={`text-sm mb-3 ${
                    achievement.isUnlocked ? 'text-gray-700' : 'text-gray-500'
                  }`}>
                    {achievement.description}
                  </p>

                  {achievement.progress && (
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-xs">
                        <span>Progress</span>
                        <span>
                          {achievement.progress.target >= 1000
                            ? formatNumber(achievement.progress.current, { compact: true })
                            : formatNumber(achievement.progress.current)
                          } / {
                            achievement.progress.target >= 1000
                              ? formatNumber(achievement.progress.target, { compact: true })
                              : formatNumber(achievement.progress.target)
                          } {achievement.progress.unit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            achievement.isUnlocked ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min((achievement.progress.current / achievement.progress.target) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {achievement.isUnlocked && achievement.unlockedAt && (
                    <div className="pt-3 border-t border-yellow-200">
                      <p className="text-xs text-yellow-700">
                        Unlocked on {formatGameDateFromObject(achievement.unlockedAt)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </div>
    </div>
  );
}