import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '@/components/ui';
import { Trophy, Medal, Lock, Calendar, Coins, Wine, Star } from 'lucide-react';
import { formatNumber, formatPercent, formatGameDateFromObject } from '@/lib/utils';
import { PageProps, CompanyProps } from '@/lib/types/UItypes';
import type { AchievementLevel, AchievementWithStatus } from '@/lib/types/types';
import type { AchievementStats, AchievementsFeature } from '../featureTypes';

interface AchievementsProps extends PageProps, CompanyProps {
  views: AchievementsFeature['views'];
  catalog: AchievementsFeature['catalog'];
}

const CATEGORY_OPTIONS = [
  { value: 'financial', label: 'Financial', icon: Coins },
  { value: 'production', label: 'Production', icon: Wine },
  { value: 'time', label: 'Time', icon: Calendar },
  { value: 'prestige', label: 'Prestige', icon: Star },
  { value: 'sales', label: 'Sales', icon: Trophy },
  { value: 'vineyard', label: 'Vineyard', icon: Medal },
] as const;

export function AchievementsPage({ currentCompany, onBack, views, catalog }: AchievementsProps) {
  const { withLoading } = useLoadingState();
  const [achievementsWithStatus, setAchievementsWithStatus] = useState<AchievementWithStatus[]>([]);
  const [achievementStats, setAchievementStats] = useState<AchievementStats | null>(null);
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

        const workspace = await views.getWorkspace();
        setAchievementsWithStatus(workspace.achievements);
        setAchievementStats(workspace.stats);
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
    return catalog.getLevelInfo(achievementLevel as AchievementLevel);
  };

  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_OPTIONS.find(option => option.value === category)?.icon || Medal;
    return <Icon className="h-4 w-4" />;
  };

  const categoryFilteredAchievements = selectedCategory === 'all'
    ? achievementsWithStatus
    : achievementsWithStatus.filter(a => a.category === selectedCategory);

  const filteredAchievements = views.filterForDisplay(categoryFilteredAchievements);

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
              {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={selectedCategory === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(value)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-3 w-3" />
                  {label} ({achievementStats?.byCategory?.[value]?.total || 0})
                </Button>
              ))}
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
