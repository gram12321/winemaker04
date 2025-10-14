import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '../ui';
import { Trophy, Award, Medal, Lock, Calendar, TrendingUp } from 'lucide-react';
// import { Company } from '@/lib/services'; // Not needed with shared interfaces
import { formatNumber, formatCompact, formatPercent } from '@/lib/utils/utils';
import { PageProps, CompanyProps } from '../../lib/types/UItypes';

interface AchievementsProps extends PageProps, CompanyProps {
  // Inherits currentCompany and onBack from shared interfaces
}

// Placeholder achievement definitions
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'financial' | 'production' | 'time' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: string;
  isUnlocked: boolean;
  unlockedAt?: Date;
  progress?: {
    current: number;
    target: number;
    unit: string;
  };
}

const PLACEHOLDER_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_sale',
    name: 'First Sale',
    description: 'Make your first wine sale',
    icon: '🍷',
    category: 'production',
    rarity: 'common',
    requirement: 'Sell 1 bottle of wine',
    isUnlocked: false,
    progress: { current: 0, target: 1, unit: 'sales' }
  },
  {
    id: 'millionaire',
    name: 'Millionaire',
    description: 'Accumulate €1,000,000 in cash',
    icon: '💰',
    category: 'financial',
    rarity: 'rare',
    requirement: 'Reach €1,000,000 cash',
    isUnlocked: false,
    progress: { current: 0, target: 1000000, unit: 'euros' }
  },
  {
    id: 'wine_master',
    name: 'Wine Master',
    description: 'Produce 100 bottles of wine',
    icon: '🍾',
    category: 'production',
    rarity: 'epic',
    requirement: 'Produce 100 bottles',
    isUnlocked: false,
    progress: { current: 0, target: 100, unit: 'bottles' }
  },
  {
    id: 'veteran_vintner',
    name: 'Veteran Vintner',
    description: 'Run your company for 5 years',
    icon: '⏰',
    category: 'time',
    rarity: 'rare',
    requirement: 'Operate for 5 game years',
    isUnlocked: false,
    progress: { current: 0, target: 5, unit: 'years' }
  },
  {
    id: 'global_leader',
    name: 'Global Leader',
    description: 'Reach #1 on any leaderboard',
    icon: '🌍',
    category: 'special',
    rarity: 'legendary',
    requirement: 'Top the global rankings',
    isUnlocked: false
  },
  {
    id: 'prestigious_company',
    name: 'Prestigious Company',
    description: 'Accumulate 1000 prestige points',
    icon: '⭐',
    category: 'special',
    rarity: 'epic',
    requirement: 'Reach 1000 prestige',
    isUnlocked: false,
    progress: { current: 0, target: 1000, unit: 'prestige' }
  }
];

export function Achievements({ currentCompany, onBack }: AchievementsProps) {
  const { withLoading } = useLoadingState();
  const [achievements, setAchievements] = useState<Achievement[]>(PLACEHOLDER_ACHIEVEMENTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    // Simulate updating progress based on current company
    if (currentCompany) {
      updateAchievementProgress();
    }
  }, [currentCompany]);

  const updateAchievementProgress = () => withLoading(async () => {
    if (!currentCompany) return;

    const updatedAchievements = achievements.map(achievement => {
      const updated = { ...achievement };

      switch (achievement.id) {
        case 'millionaire':
          if (updated.progress) {
            updated.progress.current = currentCompany.money;
            updated.isUnlocked = currentCompany.money >= 1000000;
          }
          break;
        case 'veteran_vintner':
          if (updated.progress) {
            const yearsInBusiness = currentCompany.currentYear - currentCompany.foundedYear;
            updated.progress.current = yearsInBusiness;
            updated.isUnlocked = yearsInBusiness >= 5;
          }
          break;
        case 'prestigious_company':
          if (updated.progress) {
            updated.progress.current = currentCompany.prestige;
            updated.isUnlocked = currentCompany.prestige >= 1000;
          }
          break;
      }

      return updated;
    });

    setAchievements(updatedAchievements);
  });

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-100 text-gray-800';
      case 'rare':
        return 'bg-blue-100 text-blue-800';
      case 'epic':
        return 'bg-purple-100 text-purple-800';
      case 'legendary':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: Achievement['category']) => {
    switch (category) {
      case 'financial':
        return <TrendingUp className="h-4 w-4" />;
      case 'production':
        return <Award className="h-4 w-4" />;
      case 'time':
        return <Calendar className="h-4 w-4" />;
      case 'special':
        return <Trophy className="h-4 w-4" />;
      default:
        return <Medal className="h-4 w-4" />;
    }
  };

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;

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
                  {formatPercent(unlockedCount / totalCount, 0, true)}
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
                <TrendingUp className="h-3 w-3" />
                Financial ({achievements.filter(a => a.category === 'financial').length})
              </Button>
              <Button
                variant={selectedCategory === 'production' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('production')}
                className="flex items-center gap-2"
              >
                <Award className="h-3 w-3" />
                Production ({achievements.filter(a => a.category === 'production').length})
              </Button>
              <Button
                variant={selectedCategory === 'time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('time')}
                className="flex items-center gap-2"
              >
                <Calendar className="h-3 w-3" />
                Time ({achievements.filter(a => a.category === 'time').length})
              </Button>
              <Button
                variant={selectedCategory === 'special' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('special')}
                className="flex items-center gap-2"
              >
                <Trophy className="h-3 w-3" />
                Special ({achievements.filter(a => a.category === 'special').length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map((achievement) => (
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
                        <Badge className={getRarityColor(achievement.rarity)}>
                          {achievement.rarity}
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

                <p className="text-xs text-muted-foreground mb-3">
                  {achievement.requirement}
                </p>

                {achievement.progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Progress</span>
                      <span>
                        {achievement.progress.target >= 1000 ? formatCompact(achievement.progress.current) : formatNumber(achievement.progress.current)} / {achievement.progress.target >= 1000 ? formatCompact(achievement.progress.target) : formatNumber(achievement.progress.target)} {achievement.progress.unit}
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
                  <div className="mt-3 pt-3 border-t border-yellow-200">
                    <p className="text-xs text-yellow-700">
                      Unlocked on {achievement.unlockedAt.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Development Notice */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <Trophy className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                <h3 className="font-semibold text-blue-900 mb-2">Achievement System Preview</h3>
                <p className="text-sm text-blue-800 mb-4">
                  This is a preview of the achievement system. Currently showing placeholder achievements 
                  with simulated progress based on your company data.
                </p>
                <p className="text-xs text-blue-700">
                  The full achievement system will be integrated as game features are completed, 
                  with real progress tracking and rewards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}