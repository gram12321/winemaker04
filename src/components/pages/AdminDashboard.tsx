import { useState } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { SimpleCard, Button, Label, Input, Tabs, TabsContent, TabsList, TabsTrigger, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';
import { Settings, Users, AlertTriangle, Trash2 } from 'lucide-react';
import { PageProps, NavigationProps } from '../../lib/types/UItypes';
import TestViewer from '../../../test-viewer/TestViewer';
import {
  adminSetGoldToCompany, adminSetPlayerBalance, adminAddPrestigeToCompany, adminClearAllHighscores, adminClearCompanyValueHighscores, adminClearCompanyValuePerWeekHighscores, adminClearAllCompanies, adminClearAllUsers, adminClearAllCompaniesAndUsers, adminRecreateCustomers, adminGenerateTestOrders, adminGenerateTestContract, adminClearAllAchievements, adminFullDatabaseReset, adminSetGameDate, adminGrantAllResearch, adminRemoveAllResearch, adminSetStaffXP
} from '@/lib/services';
import { getAllStaff } from '@/lib/services/user/staffService';
import { GAME_INITIALIZATION, SEASONS, WEEKS_PER_SEASON } from '@/lib/constants';
import type { Season } from '@/lib/types/types';

interface AdminDashboardProps extends PageProps, NavigationProps {
  // Inherits onBack and onNavigateToLogin from shared interfaces
}

export function AdminDashboard({ onBack, onNavigateToLogin }: AdminDashboardProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [goldAmount, setGoldAmount] = useState('10000');
  const [playerBalanceAmount, setPlayerBalanceAmount] = useState('10000');
  const [prestigeAmount, setPrestigeAmount] = useState('100');
  const [gameWeek, setGameWeek] = useState(String(GAME_INITIALIZATION.STARTING_WEEK));
  const [gameSeason, setGameSeason] = useState<Season>(GAME_INITIALIZATION.STARTING_SEASON);
  const [gameYear, setGameYear] = useState(String(GAME_INITIALIZATION.STARTING_YEAR));

  // Staff XP state
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [xpCategory, setXpCategory] = useState('skill:field');
  const [xpAmount, setXpAmount] = useState('1000');

  const weekOptions = Array.from({ length: WEEKS_PER_SEASON }, (_, index) => index + 1);
  const allStaff = useGameStateWithData(() => getAllStaff(), []);

  // Cheat functions (for development/testing)
  const handleSetGold = () => withLoading(async () => {
    const amount = parseFloat(goldAmount) || 10000;
    await adminSetGoldToCompany(amount);
  });

  const handleSetPlayerBalance = () => withLoading(async () => {
    const amount = parseFloat(playerBalanceAmount) || 10000;
    const result = await adminSetPlayerBalance(amount);
    if (result.success) {
      console.log(result.message);
    } else {
      console.error(result.error || 'Failed to set player balance');
      alert(result.error || 'Failed to set player balance');
    }
  });

  const handleAddPrestige = () => withLoading(async () => {
    const amount = parseFloat(prestigeAmount) || 100;
    await adminAddPrestigeToCompany(amount);
  });

  const handleSetStaffXP = () => withLoading(async () => {
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }
    const amount = parseFloat(xpAmount) || 1000;
    const result = await adminSetStaffXP(selectedStaffId, xpCategory, amount);
    if (result.success) {
      console.log(result.message);
      alert(result.message);
    } else {
      console.error(result.error);
      alert(result.error);
    }
  });

  const handleSetGameDate = () => withLoading(async () => {
    const parsedWeek = Number.parseInt(gameWeek, 10);
    const safeWeek = Number.isNaN(parsedWeek)
      ? GAME_INITIALIZATION.STARTING_WEEK
      : Math.min(Math.max(parsedWeek, 1), WEEKS_PER_SEASON);

    const parsedYear = Number.parseInt(gameYear, 10);
    const minimumYear = GAME_INITIALIZATION.STARTING_YEAR;
    const safeYear = Number.isNaN(parsedYear)
      ? minimumYear
      : Math.max(parsedYear, minimumYear);

    await adminSetGameDate({
      week: safeWeek,
      season: gameSeason,
      year: safeYear
    });

    setGameWeek(String(safeWeek));
    setGameYear(String(safeYear));
  });

  const handleGrantAllResearch = () => withLoading(async () => {
    const result = await adminGrantAllResearch();
    console.log(`Research granted: ${result.unlocked} unlocked, ${result.alreadyUnlocked} already unlocked`);
  });

  const handleRemoveAllResearch = () => withLoading(async () => {
    const result = await adminRemoveAllResearch();
    console.log(`Research removed: ${result.removed} unlocks removed`);
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

  const handleGenerateTestContract = () => withLoading(async () => {
    await adminGenerateTestContract();
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cheats">Cheats</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
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
                <Label htmlFor="goldAmount">Company Gold Amount to Set</Label>
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
                <Label htmlFor="playerBalanceAmount">Player Balance Amount to Set</Label>
                <Input
                  id="playerBalanceAmount"
                  type="number"
                  value={playerBalanceAmount}
                  onChange={(e) => setPlayerBalanceAmount(e.target.value)}
                  placeholder="10000"
                />
                <Button
                  onClick={handleSetPlayerBalance}
                  disabled={isLoading}
                  className="w-full"
                >
                  Set Player Balance
                </Button>
                <p className="text-xs text-gray-500">
                  Sets the cash balance for the user associated with the active company
                </p>
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

            <SimpleCard
              title="Game Date Control"
              description="Adjust the current in-game timeline"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="game-season-select">Season</Label>
                  <Select
                    value={gameSeason}
                    onValueChange={(value) => setGameSeason(value as Season)}
                  >
                    <SelectTrigger id="game-season-select">
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASONS.map(season => (
                        <SelectItem key={season} value={season}>
                          {season}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game-week-select">Week</Label>
                  <Select
                    value={gameWeek}
                    onValueChange={(value) => setGameWeek(value)}
                  >
                    <SelectTrigger id="game-week-select">
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map(week => (
                        <SelectItem key={week} value={String(week)}>
                          Week {week}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game-year-input">Year</Label>
                  <Input
                    id="game-year-input"
                    type="number"
                    value={gameYear}
                    onChange={(e) => setGameYear(e.target.value)}
                    min={GAME_INITIALIZATION.STARTING_YEAR}
                  />
                </div>

                <Button
                  onClick={handleSetGameDate}
                  disabled={isLoading}
                  className="w-full"
                >
                  Set Game Date
                </Button>
              </div>
            </SimpleCard>

            <SimpleCard
              title="Research Management"
              description="Grant or remove all research projects"
            >
              <Button
                onClick={handleGrantAllResearch}
                disabled={isLoading}
                className="w-full"
              >
                🔬 Grant All Research
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Unlocks all research projects for the active company
              </p>

              <Button
                variant="destructive"
                onClick={handleRemoveAllResearch}
                disabled={isLoading}
                className="w-full mt-4"
              >
                🗑️ Remove All Research
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Removes all research unlocks from the active company
              </p>
            </SimpleCard>

            <SimpleCard
              title="Staff XP Management"
              description="Set experience points for staff members"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-select">Select Staff Member</Label>
                  <Select
                    value={selectedStaffId}
                    onValueChange={(value) => setSelectedStaffId(value)}
                  >
                    <SelectTrigger id="staff-select">
                      <SelectValue placeholder="Select a staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStaff.length === 0 ? (
                        <SelectItem value="none" disabled>No staff members found</SelectItem>
                      ) : (
                        allStaff.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xp-category-select">XP Category</Label>
                  <Select
                    value={xpCategory}
                    onValueChange={(value) => setXpCategory(value)}
                  >
                    <SelectTrigger id="xp-category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skill:field">Skill: Field</SelectItem>
                      <SelectItem value="skill:winery">Skill: Winery</SelectItem>
                      <SelectItem value="skill:financeAndStaff">Skill: Finance & Staff</SelectItem>
                      <SelectItem value="skill:sales">Skill: Sales</SelectItem>
                      <SelectItem value="skill:administrationAndResearch">Skill: Admin & Research</SelectItem>
                      <SelectItem value="grape:Chardonnay">Grape: Chardonnay</SelectItem>
                      <SelectItem value="grape:Pinot Noir">Grape: Pinot Noir</SelectItem>
                      <SelectItem value="grape:Sauvignon Blanc">Grape: Sauvignon Blanc</SelectItem>
                      <SelectItem value="grape:Sangiovese">Grape: Sangiovese</SelectItem>
                      <SelectItem value="grape:Tempranillo">Grape: Tempranillo</SelectItem>
                      <SelectItem value="grape:Barbera">Grape: Barbera</SelectItem>
                      <SelectItem value="grape:Primitivo">Grape: Primitivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xp-amount">XP Amount</Label>
                  <Input
                    id="xp-amount"
                    type="number"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(e.target.value)}
                    placeholder="1000"
                  />
                </div>

                <Button
                  onClick={handleSetStaffXP}
                  disabled={isLoading || !selectedStaffId}
                  className="w-full"
                >
                  ⭐ Set Staff XP
                </Button>
                <p className="text-xs text-gray-500">
                  Sets the XP value for the selected skill or grape variety (replaces current XP)
                </p>
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
                Bypasses prestige checks to force order generation
              </p>
            </SimpleCard>

            <SimpleCard
              title="Contract Testing"
              description="Generate test contracts for development and testing"
            >
              <Button
                onClick={handleGenerateTestContract}
                disabled={isLoading}
                className="w-full"
              >
                📋 Generate Test Contract
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Bypasses relationship/prestige checks to force contract generation
              </p>
            </SimpleCard>


          </div>

        </TabsContent>

        {/* Test Viewer */}
        <TabsContent value="tests">
          <TestViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}