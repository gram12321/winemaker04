import { useState } from 'react';
import { useLoadingState } from '@/hooks';
import { SimpleCard, Button, Label, Input, Tabs, TabsContent, TabsList, TabsTrigger, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { Settings, Users, AlertTriangle, Trash2 } from 'lucide-react';
import { PageProps, NavigationProps } from '../../lib/types/UItypes';
import {
  adminSetGoldToCompany, adminAddPrestigeToCompany, adminClearAllHighscores, adminClearCompanyValueHighscores, adminClearCompanyValuePerWeekHighscores, adminClearAllCompanies, adminClearAllUsers, adminClearAllCompaniesAndUsers, adminRecreateCustomers, adminGenerateTestOrders, adminClearAllAchievements, adminFullDatabaseReset
} from '@/lib/services';

interface AdminDashboardProps extends PageProps, NavigationProps {
  // Inherits onBack and onNavigateToLogin from shared interfaces
}

export function AdminDashboard({ onBack, onNavigateToLogin }: AdminDashboardProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [goldAmount, setGoldAmount] = useState('10000');
  const [prestigeAmount, setPrestigeAmount] = useState('100');

  // Cheat functions (for development/testing)
  const handleSetGold = () => withLoading(async () => {
    const amount = parseFloat(goldAmount) || 10000;
    await adminSetGoldToCompany(amount);
  });

  const handleAddPrestige = () => withLoading(async () => {
    const amount = parseFloat(prestigeAmount) || 100;
    await adminAddPrestigeToCompany(amount);
  });

  const handleClearAllHighscores = () => withLoading(async () => {
    await adminClearAllHighscores();
  });

  const handleClearCompanyValueHighscores = () => withLoading(async () => {
    await adminClearCompanyValueHighscores();
  });

  const handleClearCompanyValuePerWeekHighscores = () => withLoading(async () => {
    await adminClearCompanyValuePerWeekHighscores();
  });


  // Database cleanup functions
  const handleClearAllCompanies = () => withLoading(async () => {
    await adminClearAllCompanies();
    // Navigate to login and refresh browser
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllUsers = () => withLoading(async () => {
    await adminClearAllUsers();
    // Navigate to login and refresh browser
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllCompaniesAndUsers = () => withLoading(async () => {
    await adminClearAllCompaniesAndUsers();
    // Navigate to login and refresh browser
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

  const handleGenerateTestOrder = () => withLoading(async () => {
    await adminGenerateTestOrders();
  });



  const handleClearAllAchievements = () => withLoading(async () => {
    await adminClearAllAchievements();
  });


  const handleFullDatabaseReset = () => withLoading(async () => {
    await adminFullDatabaseReset();
    // Navigate to login and refresh browser
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Admin Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
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
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          {/* Database Management */}
          <TabsContent value="database">
            <div className="space-y-6">

              {/* Game Data Cleanup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Companies
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={handleClearAllUsers}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Clear All Users
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={handleClearAllCompaniesAndUsers}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
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
                      <Trash2 className="h-4 w-4 mr-2" />
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

              {/* System Data Cleanup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      👥 Clear & Recreate All Customers
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={handleClearAllAchievements}
                      disabled={isLoading}
                      className="w-full"
                    >
                      🏆 Clear All Achievements
                    </Button>
                </SimpleCard>
              </div>

              {/* Full Database Reset */}
              <Card className="border-destructive bg-destructive/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    NUCLEAR OPTION
                  </CardTitle>
                  <CardDescription className="text-destructive/80">
                    Complete database wipe - removes ALL data from ALL tables
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
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    FULL DATABASE RESET
                  </Button>
                  <p className="text-xs text-destructive/70 mt-2 text-center">
                    This will delete EVERYTHING and cannot be undone!
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* Cheat Tools */}
          <TabsContent value="cheats">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SimpleCard
                title="Financial Cheats"
                description="Set money and resources for the active company"
              >
                  <div className="space-y-2">
                    <Label htmlFor="goldAmount">Gold Amount to Set</Label>
                    <Input
                      id="goldAmount"
                      type="number"
                      value={goldAmount}
                      onChange={(e) => setGoldAmount(e.target.value)}
                      placeholder="10000"
                    />
                    <Button
                      onClick={handleSetGold}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Set Gold for Active Company
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prestigeAmount">Prestige Amount</Label>
                    <Input
                      id="prestigeAmount"
                      type="number"
                      value={prestigeAmount}
                      onChange={(e) => setPrestigeAmount(e.target.value)}
                      placeholder="100"
                    />
                    <Button
                      onClick={handleAddPrestige}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Add Prestige to Active Company
                    </Button>
                  </div>
              </SimpleCard>

            </div>
          </TabsContent>


          {/* Development Tools */}
          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SimpleCard
                title="Order Testing"
                description="Generate test orders for development and testing"
              >
                <Button
                  onClick={handleGenerateTestOrder}
                  disabled={isLoading}
                  className="w-full"
                >
                  🛒 Generate Test Order
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Simulates the automatic customer acquisition process and order generation
                </p>
              </SimpleCard>

            </div>

          </TabsContent>
        </Tabs>
    </div>
  );
}