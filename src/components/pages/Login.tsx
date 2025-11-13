import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Button, Input, Label, Switch, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, ScrollArea, StartingConditionsModal } from '../ui';
import { Building2, Trophy, User, UserPlus } from 'lucide-react';
import { companyService, highscoreService, createNewCompany, authService } from '@/lib/services';
import { type Company, type HighscoreEntry, type AuthUser, getUserById, insertUser } from '@/lib/database';
import { formatNumber, formatDate } from '@/lib/utils';
import { AVATAR_OPTIONS } from '@/lib/utils/icons';
import ReactMarkdown from 'react-markdown';
import readmeContent from '../../../readme.md?raw';
import versionLogContent from '../../../docs/versionlog.md?raw';
import { CompanyProps } from '../../lib/types/UItypes';

type MentorWelcomeData = {
  mentorName: string | null;
  mentorMessage: string;
  mentorImage: string | null | undefined;
};

interface LoginProps extends CompanyProps {
  onCompanySelected: (company: Company) => void;
}

export function Login({ onCompanySelected }: LoginProps) {
  // State
  const { isLoading, withLoading } = useLoadingState();
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
  const [createUserProfile, setCreateUserProfile] = useState(false);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companiesWithoutUsers, setCompaniesWithoutUsers] = useState<Company[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AuthUser[]>([]);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [highscores, setHighscores] = useState<{
    company_value: HighscoreEntry[];
    company_value_per_week: HighscoreEntry[];
  }>({
    company_value: [],
    company_value_per_week: []
  });
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<string | null>(null);
  const [isReadmeOpen, setIsReadmeOpen] = useState(false);
  const [isVersionLogOpen, setIsVersionLogOpen] = useState(false);
  const [showStartingConditions, setShowStartingConditions] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<Company | null>(null);
  const [pendingMentorWelcome, setPendingMentorWelcome] = useState<MentorWelcomeData | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
    });
    
    loadHighscores();
    
    return unsubscribe;
  }, []);

  // Load companies when user state changes
  useEffect(() => {
    if (currentUser) {
      loadUserCompanies();
    } else {
      // If no authenticated user, try autologin with lastCompanyId
      loadAllCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadAllCompanies = async () => {
    const companies = await companyService.getAllCompanies(20);
    
    // If no companies exist, show create form
    if (companies.length === 0) {
      setShowCreateCompany(true);
      return;
    }

    // Check if there's a last company and detect company-linked user
    try {
      const lastCompanyId = localStorage.getItem('lastCompanyId');
      if (lastCompanyId) {
        const match = companies.find(c => c.id === lastCompanyId);
        if (match) {
          // If this company has a user_id, load that user's companies instead
          if (match.userId) {
            await loadCompanyLinkedUser(match.userId);
            return;
          }
          
          // Otherwise, autologin to this company (no user linked)
          onCompanySelected(match);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking lastCompanyId:', error);
    }
    
    // Separate companies with and without users
    const companiesWithUsers = companies.filter(c => c.userId);
    const orphanCompanies = companies.filter(c => !c.userId);
    setCompaniesWithoutUsers(orphanCompanies);
    
    if (companiesWithUsers.length > 0) {
      // Get unique user IDs
      const uniqueUserIds = [...new Set(companiesWithUsers.map(c => c.userId))].filter((id): id is string => !!id);
      
      // If there's exactly one unique user, use that user
      if (uniqueUserIds.length === 1) {
        // All companies belong to the same user - detect and load that user
        await loadCompanyLinkedUser(uniqueUserIds[0]);
        return;
      }
      
      // If multiple users exist, load them and show user selection UI
      const loadedUsers = await Promise.all(
        uniqueUserIds.map(userId => getUserById(userId))
      );
      
      const validUsers = loadedUsers.filter((user): user is AuthUser => !!user);
      
      if (validUsers.length > 0) {
        setAvailableUsers(validUsers);
        setShowUserSelection(true);
        return;
      }
    }
    
    // If no autologin happened and no single user detected, show all companies
    setAllCompanies(companies);
  };

  const loadCompanyLinkedUser = async (userId: string) => {
    try {
      const user = await getUserById(userId);
      
      if (user) {
        // Set the user state manually
        setCurrentUser(user);
        // loadUserCompanies will be called automatically by the useEffect
      }
    } catch (error) {
      console.error('Error loading company-linked user:', error);
    }
  };

  const loadUserCompanies = async () => {
    if (!currentUser) return;
    
    const companies = await companyService.getUserCompanies(currentUser.id);
    setAllCompanies(companies);
    
    // If no companies exist for this user, show create form
    if (companies.length === 0) {
      setShowCreateCompany(true);
      return;
    }

    // Attempt auto-login to last active company if it belongs to this user
    try {
      const lastCompanyId = localStorage.getItem('lastCompanyId');
      if (lastCompanyId) {
        const match = companies.find(c => c.id === lastCompanyId);
        if (match) {
          onCompanySelected(match);
        }
      }
    } catch {}
  };

  const loadHighscores = () => withLoading(async () => {
    const [companyValue, companyValuePerWeek] = await Promise.all([
      highscoreService.getHighscores('company_value', 5),
      highscoreService.getHighscores('company_value_per_week', 5)
    ]);

    setHighscores({
      company_value: companyValue,
      company_value_per_week: companyValuePerWeek
    });
  });

  const handleCreateUser = (e: React.FormEvent) => withLoading(async () => {
    e.preventDefault();
    setError('');

    if (!newUserName.trim()) {
      setError('Please enter a username');
      return;
    }

    const result = await insertUser({
      name: newUserName.trim(),
      created_at: new Date().toISOString()
    });

    if (result.success && result.data) {
      const newUser: AuthUser = {
        id: result.data.id,
        email: result.data.email,
        name: result.data.name,
        avatar: result.data.avatar,
        avatarColor: result.data.avatar_color,
        createdAt: new Date(result.data.created_at),
        updatedAt: new Date(result.data.updated_at)
      };
      
      setNewUserName('');
      setShowCreateUser(false);
      setCurrentUser(newUser);
    } else {
      setError(result.error || 'Failed to create user');
    }
  });

  const handleCreateCompany = (e: React.FormEvent) => withLoading(async () => {
    e.preventDefault();
    setError('');

    const company = await createNewCompany(companyName, createUserProfile, createUserProfile ? userName : undefined);

    if (company) {
      setCompanyName('');
      setUserName('');
      setCreateUserProfile(false);
      setShowCreateCompany(false);
      
      // Store pending company and show starting conditions modal
      setPendingCompany(company);
      setShowStartingConditions(true);
    } else {
      setError('Failed to create company');
    }
  });
  
  const handleStartingConditionsComplete = async (startingMoney?: number) => {
    setShowStartingConditions(false);

    if (pendingMentorWelcome) {
      try {
        sessionStorage.setItem('mentorWelcome', JSON.stringify(pendingMentorWelcome));
      } catch (storageError) {
        console.error('Failed to persist mentor welcome:', storageError);
      }
      setPendingMentorWelcome(null);
    }
    
    if (pendingCompany) {
      const companyToSelect = startingMoney !== undefined
        ? { ...pendingCompany, money: startingMoney }
        : pendingCompany;
 
       // Reload appropriate company list
       if (currentUser) {
         await loadUserCompanies();
       } else {
         await loadAllCompanies();
       }
 
       // Select the company and navigate to game
       onCompanySelected(companyToSelect);
       setPendingCompany(null);
     }
  };

  const handleSelectCompany = (company: Company) => {
    onCompanySelected(company);
  };

  const handleDeleteCompany = (companyId: string, event: React.MouseEvent) => withLoading(async () => {
    event.stopPropagation(); // Prevent card click from triggering
    
    if (deletingCompany === companyId) {
      // Confirm delete - second click
      setError('');

      const result = await companyService.deleteCompany(companyId);
      
      if (result.success) {
        setDeletingCompany(null);
        // Refresh the page to ensure clean state
        window.location.reload();
      } else {
        setError(result.error || 'Failed to delete company');
        setDeletingCompany(null);
      }
    } else {
      // First click - show confirmation state
      setDeletingCompany(companyId);
      
      // Auto-reset confirmation state after 5 seconds
      setTimeout(() => {
        setDeletingCompany(null);
      }, 5000);
    }
  });

  const formatLastPlayed = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return formatDate(date);
  };

  const renderHighscoreTable = (scores: HighscoreEntry[], title: string) => (
    <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
      <CardContent className="p-3">
        <div className="font-semibold text-sm mb-2 flex items-center gap-1 text-wine">
          <Trophy className="h-4 w-4" />
          {title}
        </div>
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : scores.length === 0 ? (
          <div className="text-xs text-muted-foreground">No data</div>
        ) : (
          <div className="space-y-1">
            {scores.map((score, idx) => (
              <div key={score.id} className="flex justify-between text-xs">
                <span className="truncate max-w-[100px]">
                  {idx + 1}. {score.companyName}
                </span>
                <span className="font-medium">
                  {formatNumber(score.scoreValue, { currency: true, decimals: 0 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-3 text-sm"
      style={{
        backgroundImage: 'url("/assets/pic/loginbg.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Main Container */}
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-white/20">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold mb-1 text-wine drop-shadow-lg">Welcome to Winemaker</h1>
          <p className="text-muted-foreground text-xs drop-shadow-md">
            Manage your wine empire and compete with other vintners
          </p>
          {currentUser && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <User className="h-3 w-3 text-wine" />
              <span className="text-wine font-medium">{currentUser.name}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl text-sm">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-wine text-base">
                      {showUserSelection ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      {showUserSelection ? 'User Selection' : currentUser ? 'My Companies' : 'Company Selection'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {showUserSelection 
                        ? 'Select a user or create a new one'
                        : currentUser 
                        ? 'Select one of your companies or create a new one'
                        : 'Select an existing company or create a new one'}
                    </CardDescription>
                  </div>
                  {currentUser && !showUserSelection && availableUsers.length > 0 && (
                    <Button
                      onClick={() => {
                        setCurrentUser(null);
                        setShowUserSelection(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                    >
                      ← Back
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 py-3">
                {/* User Selection */}
                {showUserSelection && availableUsers.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableUsers.map((user) => (
                        <Card 
                          key={user.id}
                          className="hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setCurrentUser(user);
                            setShowUserSelection(false);
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                                {AVATAR_OPTIONS.find(a => a.id === user.avatar)?.emoji || AVATAR_OPTIONS[0].emoji}
                              </div>
                              <div>
                                <h4 className="font-medium">{user.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  Member since {formatDate(user.createdAt)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Companies Without Users (shown on User Selection screen) */}
                {showUserSelection && companiesWithoutUsers.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Unassigned Companies</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {companiesWithoutUsers.map((company) => (
                        <Card 
                          key={company.id}
                          className="hover:bg-accent/50 transition-colors"
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectCompany(company)}
                              >
                                <h4 className="font-medium">{company.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  Week {company.currentWeek}, {company.currentSeason} {company.currentYear}
                                </p>
                                <p className="text-xs">
                                  {formatNumber(company.money, { currency: true, decimals: 0 })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right text-[10px] text-muted-foreground">
                                  {formatLastPlayed(company.lastPlayed)}
                                </div>
                                <button
                                  onClick={(e) => handleDeleteCompany(company.id, e)}
                                  className={`p-1 rounded hover:bg-destructive/10 transition-colors text-xs ${
                                    deletingCompany === company.id ? 'text-destructive animate-pulse bg-destructive/10' : 'text-muted-foreground'
                                  }`}
                                  title={deletingCompany === company.id ? 'Click again to confirm deletion' : 'Delete company'}
                                >
                                  {deletingCompany === company.id ? '🗑️' : '🗑️'}
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Recent Companies */}
                {allCompanies.length > 0 && !showCreateCompany && !showUserSelection && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Recent Companies</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {allCompanies.map((company) => (
                        <Card 
                          key={company.id}
                          className="hover:bg-accent/50 transition-colors"
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectCompany(company)}
                              >
                                <h4 className="font-medium">{company.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  Week {company.currentWeek}, {company.currentSeason} {company.currentYear}
                                </p>
                                <p className="text-xs">
                                  {formatNumber(company.money, { currency: true, decimals: 0 })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right text-[10px] text-muted-foreground">
                                  {formatLastPlayed(company.lastPlayed)}
                                </div>
                                <button
                                  onClick={(e) => handleDeleteCompany(company.id, e)}
                                  className={`p-1 rounded hover:bg-destructive/10 transition-colors text-xs ${
                                    deletingCompany === company.id ? 'text-destructive animate-pulse bg-destructive/10' : 'text-muted-foreground'
                                  }`}
                                  title={deletingCompany === company.id ? 'Click again to confirm deletion' : 'Delete company'}
                                >
                                  {deletingCompany === company.id ? '🗑️' : '🗑️'}
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create User (shown when multiple users exist) */}
                {showUserSelection && (
                  <div className="pt-3 border-t">
                    {!showCreateUser && !showCreateCompany ? (
                      <div className="space-y-2">
                        <Button 
                          onClick={() => setShowCreateUser(true)}
                          className="w-full border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          variant="outline"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create New User
                        </Button>
                        <Button 
                          onClick={() => setShowCreateCompany(true)}
                          className="w-full border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          variant="outline"
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Create Company Without User
                        </Button>
                      </div>
                    ) : showCreateUser ? (
                      <form onSubmit={handleCreateUser} className="space-y-3">
                        <div>
                          <Label htmlFor="newUserName">User Name</Label>
                          <Input
                            id="newUserName"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Enter your username"
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            disabled={isLoading}
                            className="bg-wine hover:bg-wine-dark text-white text-sm"
                          >
                            {isLoading ? 'Creating...' : 'Create User'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                              setShowCreateUser(false);
                              setNewUserName('');
                            }}
                            className="border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : showCreateCompany ? (
                      <form onSubmit={handleCreateCompany} className="space-y-3">
                        <div>
                          <Label htmlFor="companyName">Company Name</Label>
                          <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Enter company name"
                            required
                          />
                        </div>

                        {/* User Creation Toggle */}
                        <div className="flex items-center space-x-3 p-2.5 bg-gray-50 rounded-lg border">
                          <Switch
                            id="createUser"
                            checked={createUserProfile}
                            onCheckedChange={setCreateUserProfile}
                          />
                          <Label htmlFor="createUser" className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            {createUserProfile ? <User className="h-3.5 w-3.5 text-wine" /> : <UserPlus className="h-3.5 w-3.5 text-gray-500" />}
                            Create a user profile?
                          </Label>
                        </div>

                        {/* User Name Input - Only show when toggle is on */}
                        {createUserProfile && (
                          <div className="p-2.5 bg-wine/5 rounded-lg border border-wine/20">
                            <Label htmlFor="userName" className="text-xs font-medium text-wine">User Name</Label>
                            <Input
                              id="userName"
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              placeholder="Enter your username"
                              required={createUserProfile}
                              className="mt-1 border-wine/30 focus:border-wine focus:ring-wine/20 text-sm"
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            disabled={isLoading}
                            className="bg-wine hover:bg-wine-dark text-white text-sm"
                          >
                            {isLoading ? 'Creating...' : 'Start'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                              setShowCreateCompany(false);
                              setCompanyName('');
                              setUserName('');
                              setCreateUserProfile(false);
                            }}
                            className="border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                )}

                {/* Create Company (shown when NOT on User Selection screen) */}
                {!showUserSelection && (
                  <div className="pt-3 border-t">
                    {!showCreateCompany ? (
                      <Button 
                        onClick={() => setShowCreateCompany(true)}
                        className="w-full border-wine text-wine hover:bg-wine hover:text-white text-sm"
                        variant="outline"
                      >
                        Create New Company
                      </Button>
                    ) : (
                    <form onSubmit={handleCreateCompany} className="space-y-3">
                      <div>
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Enter company name"
                          required
                        />
                      </div>

                      {/* User Creation Toggle */}
                      <div className="flex items-center space-x-3 p-2.5 bg-gray-50 rounded-lg border">
                        <Switch
                          id="createUser"
                          checked={createUserProfile}
                          onCheckedChange={setCreateUserProfile}
                        />
                        <Label htmlFor="createUser" className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                          {createUserProfile ? <User className="h-3.5 w-3.5 text-wine" /> : <UserPlus className="h-3.5 w-3.5 text-gray-500" />}
                          Create a user profile?
                        </Label>
                      </div>

                      {/* User Name Input - Only show when toggle is on */}
                      {createUserProfile && (
                        <div className="p-2.5 bg-wine/5 rounded-lg border border-wine/20">
                          <Label htmlFor="userName" className="text-xs font-medium text-wine">User Name</Label>
                          <Input
                            id="userName"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Enter your username"
                            required={createUserProfile}
                            className="mt-1 border-wine/30 focus:border-wine focus:ring-wine/20 text-sm"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          disabled={isLoading}
                          className="bg-wine hover:bg-wine-dark text-white text-sm"
                        >
                          {isLoading ? 'Creating...' : 'Start'}
                        </Button>
                        {allCompanies.length > 0 && (
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => setShowCreateCompany(false)}
                            className="border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  )}
                  </div>
                )}

                {error && (
                  <div className="mt-3 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Highscores */}
            <div className="grid grid-cols-1 gap-2.5">
              {renderHighscoreTable(highscores.company_value, 'Top Companies')}
              {renderHighscoreTable(highscores.company_value_per_week, 'Fastest Growing')}
            </div>

            {/* Info */}
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl text-sm">
              <CardContent className="p-3">
                <h3 className="font-medium mb-1.5 text-wine">Getting Started</h3>
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>• Create a company to start your wine empire</p>
                  <p>• Plant vineyards and craft premium wines</p>
                  <p>• Build relationships with customers</p>
                  <p>• Compete on the global leaderboards</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Links Container */}
        <div className="mt-4 flex items-center justify-center gap-3 text-xs">
          <a 
            href="https://trello.com/b/sipiTJrV/winemaker" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1"
            title="View Development Roadmap"
          >
            <span className="text-base">📋</span>
            <span>Trello Board</span>
          </a>
          
          <button 
            onClick={() => setIsReadmeOpen(true)}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1"
            title="View technical README"
          >
            <span className="text-base">📖</span>
            <span>README</span>
          </button>

          <button 
            onClick={() => setIsVersionLogOpen(true)}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1"
            title="View Version Log"
          >
            <span className="text-base">📝</span>
            <span>Version Log</span>
          </button>
        </div>
      </div>

      {/* README Modal */}
      <Dialog open={isReadmeOpen} onOpenChange={setIsReadmeOpen}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col text-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Winemaker - Project README</DialogTitle>
            <DialogDescription className="text-xs">
              Comprehensive overview of the Winemaker game project
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-3">
            <div className="prose dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{readmeContent}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Version Log Modal */}
      <Dialog open={isVersionLogOpen} onOpenChange={setIsVersionLogOpen}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col text-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Winemaker - Version Log</DialogTitle>
            <DialogDescription className="text-xs">
              Project development history and roadmap
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-3">
            <div className="prose dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{versionLogContent}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Starting Conditions Modal */}
      {pendingCompany && (
        <StartingConditionsModal
          isOpen={showStartingConditions}
          onClose={() => {
            setShowStartingConditions(false);
            setPendingCompany(null);
            setPendingMentorWelcome(null);
          }}
          companyId={pendingCompany.id}
          companyName={pendingCompany.name}
          onComplete={handleStartingConditionsComplete}
          onMentorReady={setPendingMentorWelcome}
        />
      )}
    </div>
  );
}