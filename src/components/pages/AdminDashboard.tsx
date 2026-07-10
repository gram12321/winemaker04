import { useState } from 'react';
import { useLoadingState } from '@/hooks';
import {
  SimpleCard,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui';
import { Settings, Users, AlertTriangle, Trash2, TestTube2, RefreshCw } from 'lucide-react';
import { PageProps, NavigationProps } from '../../lib/types/UItypes';
import TestLabPage from './admin/TestLabPage';
import { ResearchAdminInspector } from '@/lib/features/researchUpgrade/components/ResearchAdminInspector';
import {
  adminClearAllAchievements,
  adminClearAllCompanies,
  adminClearAllCompaniesAndUsers,
  adminClearAllHighscores,
  adminClearAllUsers,
  adminClearCompanyValueHighscores,
  adminClearCompanyValuePerWeekHighscores,
  adminFullDatabaseReset,
  adminRecreateCustomers,
  recreateBuyGrapeMarketOffers
} from '@/lib/services';

interface AdminDashboardProps extends PageProps, NavigationProps {
  // Inherits onBack and onNavigateToLogin from shared interfaces
}

export function AdminDashboard({ onBack, onNavigateToLogin }: AdminDashboardProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [showAllResearch, setShowAllResearch] = useState(false);

  const handleClearAllHighscores = () => withLoading(async () => {
    await adminClearAllHighscores();
  });

  const handleClearCompanyValueHighscores = () => withLoading(async () => {
    await adminClearCompanyValueHighscores();
  });

  const handleClearCompanyValuePerWeekHighscores = () => withLoading(async () => {
    await adminClearCompanyValuePerWeekHighscores();
  });

  const handleClearAllCompanies = () => withLoading(async () => {
    await adminClearAllCompanies();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllUsers = () => withLoading(async () => {
    await adminClearAllUsers();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllCompaniesAndUsers = () => withLoading(async () => {
    await adminClearAllCompaniesAndUsers();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleRecreateCustomers = () => withLoading(async () => {
    await adminRecreateCustomers();
  });

  const handleClearAllAchievements = () => withLoading(async () => {
    await adminClearAllAchievements();
  });

  const handleRecreateBuyGrapeOffers = () => withLoading(async () => {
    await recreateBuyGrapeMarketOffers();
  });

  const handleFullDatabaseReset = () => withLoading(async () => {
    await adminFullDatabaseReset();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-bold text-gray-800">
            <Settings className="h-8 w-8" />
            Admin Dashboard
          </h2>
          <p className="mt-1 text-muted-foreground">
            Advanced game management and administrative tools
          </p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

      <Tabs defaultValue="database" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cheats">Cheats</TabsTrigger>
          <TabsTrigger value="tests">Test Systems</TabsTrigger>
        </TabsList>

        <TabsContent value="database">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SimpleCard
                title="Game Data"
                description="Clear game-related data and progression"
              >
                <Button
                  variant="destructive"
                  onClick={handleClearAllCompanies}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Companies
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleClearAllUsers}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Clear All Users
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleClearAllCompaniesAndUsers}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Companies & Users
                </Button>
              </SimpleCard>

              <SimpleCard
                title="Highscores Management"
                description="Manage global leaderboards and highscore data"
              >
                <Button
                  variant="destructive"
                  onClick={handleClearAllHighscores}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Highscores
                </Button>

                <Button
                  variant="outline"
                  onClick={handleClearCompanyValueHighscores}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear Company Value Highscores
                </Button>

                <Button
                  variant="outline"
                  onClick={handleClearCompanyValuePerWeekHighscores}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear Company Value Per Week Highscores
                </Button>
              </SimpleCard>

              <SimpleCard
                title="Bulk Grape Market"
                description="Regenerate all current-company supplier offers without changing inventory or supplier loyalty"
              >
                <Button
                  variant="outline"
                  onClick={handleRecreateBuyGrapeOffers}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recreate Bulk Offers
                </Button>
              </SimpleCard>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SimpleCard
                title="System Data"
                description="Clear system and progression data"
              >
                <Button
                  variant="destructive"
                  onClick={handleRecreateCustomers}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear & Recreate All Customers
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleClearAllAchievements}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear All Achievements
                </Button>
              </SimpleCard>
            </div>

            <Card className="border-destructive bg-destructive/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Nuclear Option
                </CardTitle>
                <CardDescription className="text-destructive/80">
                  Complete database wipe. Removes all data from all tables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleFullDatabaseReset}
                  disabled={isLoading}
                  className="w-full"
                >
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Full Database Reset
                </Button>
                <p className="mt-2 text-center text-xs text-destructive/70">
                  This removes everything and cannot be undone.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cheats">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SimpleCard
              title="Mutation Controls"
              description="Use the Test Lab for active-company mutations so there is one path per action"
            >
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Money, player balance, prestige, game date, sales shortcuts, staff XP, and instant activity completion now live under the Test Systems tab.
              </div>
            </SimpleCard>

            <SimpleCard
              title="Research Visibility"
              description="Keep the bypass panel here for inspecting research content without mutating through the old admin buttons"
            >
              <Button
                variant="outline"
                onClick={() => setShowAllResearch(value => !value)}
                className="w-full"
              >
                {showAllResearch ? 'Hide Research Inspector' : 'Show All Research'}
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                Shows research projects without prestige or prerequisite gates.
              </p>
            </SimpleCard>

            {showAllResearch && (
              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>All Research Projects</CardTitle>
                    <CardDescription>
                      Gates bypassed for inspection.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResearchAdminInspector />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tests">
          <div className="space-y-6">
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TestTube2 className="h-4 w-4" />
                  Test Lab
                </CardTitle>
                <CardDescription>
                  Automated test runs, active-company mutations, fixture scenarios, and instant activity completion live here.
                </CardDescription>
              </CardHeader>
            </Card>

            <TestLabPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
