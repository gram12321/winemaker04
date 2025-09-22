import { useState } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Label, Input, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';
import { 
  Settings, 
  Database, 
  Users, 
  Building2, 
  Trophy, 
  AlertTriangle,
  DollarSign,
  Trash2,
} from 'lucide-react';
import { highscoreService, initializeCustomers, addTransaction, getCurrentPrestige, getCurrentCompany, clearPrestigeCache } from '@/lib/services';
import { notificationService } from '@/components/layout/NotificationCenter';
import { formatCurrency } from '@/lib/utils/utils';
import { supabase } from '@/lib/database/supabase';
import { PageProps, NavigationProps } from '../ui/UItypes';

interface AdminDashboardProps extends PageProps, NavigationProps {
  // Inherits onBack and onNavigateToLogin from shared interfaces
}

export function AdminDashboard({ onBack, onNavigateToLogin }: AdminDashboardProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [goldAmount, setGoldAmount] = useState('10000');
  const [prestigeAmount, setPrestigeAmount] = useState('100');

  // Cheat functions (for development/testing)
  const handleAddGold = () => withLoading(async () => {
    const amount = parseFloat(goldAmount) || 10000;
    await addTransaction(amount, `Admin: Added ${formatCurrency(amount)}`, 'admin_cheat');
    notificationService.success(`Added ${formatCurrency(amount)} to active company`);
  });

  const handleAddPrestige = () => withLoading(async () => {
    const amount = parseFloat(prestigeAmount) || 100;
    
    // Add a prestige event directly to the database
    const { error } = await supabase.from('prestige_events').insert([{
      id: crypto.randomUUID(),
      type: 'admin_cheat',
      amount: amount,
      timestamp: Date.now(),
      decay_rate: 0, // Admin prestige doesn't decay
      description: `Admin: Added ${amount} prestige`,
      source_id: null,
      company_id: getCurrentCompany()?.id || '00000000-0000-0000-0000-000000000000'
    }]);
    
    if (error) {
      console.error('Failed to add prestige event:', error);
      notificationService.error('Failed to add prestige');
      return;
    }
    
    // Clear prestige cache to force recalculation
    clearPrestigeCache();
    await getCurrentPrestige();
    
    notificationService.success(`Added ${amount} prestige to active company`);
  });

  const handleClearAllHighscores = () => withLoading(async () => {
    const result = await highscoreService.clearHighscores();
    if (result.success) {
      notificationService.success('All highscores cleared successfully');
    } else {
      notificationService.error(result.error || 'Failed to clear highscores');
    }
  });

  const handleClearCompanyValueHighscores = () => withLoading(async () => {
    const result = await highscoreService.clearHighscores('company_value');
    if (result.success) {
      notificationService.success('Company value highscores cleared');
    } else {
      notificationService.error(result.error || 'Failed to clear company value highscores');
    }
  });

  const handleClearCompanyValuePerWeekHighscores = () => withLoading(async () => {
    const result = await highscoreService.clearHighscores('company_value_per_week');
    if (result.success) {
      notificationService.success('Company value per week highscores cleared');
    } else {
      notificationService.error(result.error || 'Failed to clear company value per week highscores');
    }
  });

  const handleTestNotifications = () => {
    notificationService.info('This is an info notification');
    setTimeout(() => notificationService.success('This is a success notification'), 1000);
    setTimeout(() => notificationService.warning('This is a warning notification'), 2000);
    setTimeout(() => notificationService.error('This is an error notification'), 3000);
  };

  // Database cleanup functions
  const handleClearAllCompanies = () => withLoading(async () => {
    const { error } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    notificationService.success('All companies cleared successfully');
    
    // Navigate to login and refresh browser
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllUsers = () => withLoading(async () => {
    const { error } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    notificationService.success('All users cleared successfully');
    
    // Navigate to login and refresh browser
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  const handleClearAllCompaniesAndUsers = async () => {
    withLoading(async () => {
      try {
        // Clear companies first (due to foreign key constraints)
        const { error: companiesError } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (companiesError) throw companiesError;
        
        // Then clear users
        const { error: usersError } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (usersError) throw usersError;
        
        notificationService.success('All companies and users cleared successfully');
        
        // Navigate to login and refresh browser
        if (onNavigateToLogin) {
          onNavigateToLogin();
        }
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('Error clearing companies and users:', error);
        notificationService.error('Failed to clear companies and users');
      }
    });
  };



  const handleRecreateCustomers = async () => {
    withLoading(async () => {
      try {
        // First clear all existing customers
        const { error: deleteError } = await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw deleteError;
        
        // Then recreate them
        await initializeCustomers(1); // Initialize with base prestige
        
        notificationService.success('All customers cleared and recreated successfully');
      } catch (error) {
        console.error('Error recreating customers:', error);
        notificationService.error('Failed to recreate customers');
      }
    });
  };


  const handleClearAllAchievements = async () => {
    withLoading(async () => {
      try {
        const { error } = await supabase.from('achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        notificationService.success('All achievements cleared successfully');
      } catch (error) {
        console.error('Error clearing achievements:', error);
        notificationService.error('Failed to clear achievements');
      }
    });
  };


  const handleFullDatabaseReset = async () => {
    withLoading(async () => {
      try {
        // Clear all tables in the correct order to respect foreign key constraints
        const tables = [
          'relationship_boosts',
          'wine_orders', 
          'wine_batches',
          'vineyards',
          'achievements',
          'user_settings',
          'highscores',
          'prestige_events',
          'transactions',
          'companies',
          'users',
          'customers',
          'game_state'
        ];

        // Clear all tables (RLS is now disabled)
        for (const table of tables) {
          try {
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
              console.error(`Error clearing table ${table}:`, error);
            } else {
              // Table cleared successfully
            }
          } catch (err) {
            console.error(`Exception clearing table ${table}:`, err);
          }
        }

        notificationService.success('Full database reset completed successfully');
        
        // Navigate to login and refresh browser
        if (onNavigateToLogin) {
          onNavigateToLogin();
        }
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('Error during full database reset:', error);
        notificationService.error('Failed to complete full database reset');
      }
    });
  };

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
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Game Data
                    </CardTitle>
                    <CardDescription>
                      Clear game-related data and progression
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Highscores Management
                    </CardTitle>
                    <CardDescription>
                      Manage global leaderboards and highscore data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                  </CardContent>
                </Card>
              </div>

              {/* System Data Cleanup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      System Data
                    </CardTitle>
                    <CardDescription>
                      Clear system and progression data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                  </CardContent>
                </Card>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Cheats
                  </CardTitle>
                  <CardDescription>
                    Add money and resources to the active company
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="goldAmount">Gold Amount</Label>
                    <Input
                      id="goldAmount"
                      type="number"
                      value={goldAmount}
                      onChange={(e) => setGoldAmount(e.target.value)}
                      placeholder="10000"
                    />
                    <Button
                      onClick={handleAddGold}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Add Gold to Active Company
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
                </CardContent>
              </Card>

            </div>
          </TabsContent>


          {/* Development Tools */}
          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Testing</CardTitle>
                  <CardDescription>
                    Test the notification system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleTestNotifications} className="w-full">
                    Test All Notification Types
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}