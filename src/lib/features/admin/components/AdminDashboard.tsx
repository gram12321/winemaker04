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
} from '@/components/ui';
import { Settings, Users, AlertTriangle, Trash2 } from 'lucide-react';
import { PageProps, NavigationProps } from '@/lib/types/UItypes';
import type { AdminDashboardDependencies } from '../internalTypes';
import TestLabPage from './TestLabPage';
interface AdminDashboardProps extends PageProps, NavigationProps, AdminDashboardDependencies {}

export function AdminDashboard({ onBack, onNavigateToLogin, database, testLab, renderResearchInspector }: AdminDashboardProps) {
  const { isLoading, withLoading } = useLoadingState();

  const handleClearAllHighscores = () => withLoading(async () => {
    await database.clearAllHighscores();
  });

  const handleClearCompanyValueHighscores = () => withLoading(async () => {
    await database.clearCompanyValueHighscores();
  });

  const handleClearCompanyValuePerWeekHighscores = () => withLoading(async () => {
    await database.clearCompanyValuePerWeekHighscores();
  });

  const handleClearAllCompanies = () => withLoading(async () => {
    await database.clearAllCompanies();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllUsers = () => withLoading(async () => {
    await database.clearAllUsers();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllCompaniesAndUsers = () => withLoading(async () => {
    await database.clearAllCompaniesAndUsers();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleRecreateCustomers = () => withLoading(async () => {
    await database.recreateCustomers();
  });

  const handleClearAllAchievements = () => withLoading(async () => {
    await database.clearAllAchievements();
  });

  const handleFullDatabaseReset = () => withLoading(async () => {
    await database.fullDatabaseReset();
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });

  const handleClearGlobalMarket = () => withLoading(async () => {
    await database.clearGlobalMarket();
  });

  const handleClearGlobalMarketGoods = (goods: 'grapes' | 'storage_vessels') => withLoading(async () => {
    await database.clearGlobalMarketGoods(goods);
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
          <TabsTrigger value="company-administration">Company Administration</TabsTrigger>
          <TabsTrigger value="manual-test-setup">Manual Test Setup</TabsTrigger>
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

            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SimpleCard
                title="Buy Market Management"
                description="Clear generated market offers and global used-vessel listings. The next market open regenerates stock."
              >
                <Button
                  variant="destructive"
                  onClick={handleClearGlobalMarket}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Market Goods
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleClearGlobalMarketGoods('grapes')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear Grape Market
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleClearGlobalMarketGoods('storage_vessels')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Clear Storage Vessel Market
                </Button>
              </SimpleCard>

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

        <TabsContent value="company-administration">
          <div className="space-y-6">
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Company Administration
                </CardTitle>
                <CardDescription>
                  Direct maintenance, inspection, and state overrides for the active company.
                </CardDescription>
              </CardHeader>
            </Card>

            <TestLabPage
              testLab={testLab}
              mode="company-administration"
              renderResearchInspector={renderResearchInspector}
            />

          </div>
        </TabsContent>

        <TabsContent value="manual-test-setup">
          <TestLabPage testLab={testLab} mode="manual-test-setup" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
