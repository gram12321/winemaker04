import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, ScrollArea, StartingConditionsModal } from '../ui';
import { Building2, User, UserPlus } from 'lucide-react';
import { leaderboardsFeature, type LeaderboardEntry } from '@/lib/features/leaderboards';
import { companyFeature, type CompanyCreateResult, type CompanyRecord } from '@/lib/features/company';
import { userFeature } from '@/lib/features/user';
import type { PlayerProfile } from '@/lib/features/user';
import { formatDate } from '@/lib/utils';
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
  onCompanySelected: (company: CompanyRecord) => void;
  onCompanyCreated: (input: { name: string; ownerId?: string }) => Promise<CompanyCreateResult>;
  forcePlayerSelection?: boolean;
}

export function Login({ onCompanySelected, onCompanyCreated, forcePlayerSelection = false }: LoginProps) {
  // State
  const { isLoading, withLoading } = useLoadingState();
  const [error, setError] = useState('');
  const [allCompanies, setAllCompanies] = useState<CompanyRecord[]>([]);
  const [companiesWithoutUsers, setCompaniesWithoutUsers] = useState<CompanyRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<PlayerProfile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<PlayerProfile[]>([]);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [highscores, setHighscores] = useState<{
    company_value: LeaderboardEntry[];
    company_value_per_week: LeaderboardEntry[];
  }>({
    company_value: [],
    company_value_per_week: []
  });
  const [isReadmeOpen, setIsReadmeOpen] = useState(false);
  const [isVersionLogOpen, setIsVersionLogOpen] = useState(false);
  const [showStartingConditions, setShowStartingConditions] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<CompanyRecord | null>(null);
  const [pendingMentorWelcome, setPendingMentorWelcome] = useState<MentorWelcomeData | null>(null);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: () => void = () => undefined;
    void userFeature.account.observeCurrentPlayer((player) => {
      if (isActive) setCurrentUser(player);
    }).then((listenerCleanup) => {
      if (isActive) {
        unsubscribe = listenerCleanup;
      } else {
        listenerCleanup();
      }
    });
    
    loadHighscores();
    
    return () => {
      isActive = false;
      unsubscribe();
    };
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
    const companies = await companyFeature.records.listAll(20);
    
    if (companies.length === 0) return;

    // Check if there's a last company and detect company-linked user
    try {
      const lastCompanyId = localStorage.getItem('lastCompanyId');
      if (!forcePlayerSelection && lastCompanyId) {
        const match = companies.find(c => c.id === lastCompanyId);
        if (match) {
          // If this company has a user_id, load that user's companies instead
          if (match.ownerId) {
            await loadCompanyLinkedUser(match.ownerId);
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
    const companiesWithUsers = companies.filter(c => c.ownerId);
    const orphanCompanies = companies.filter(c => !c.ownerId);
    setCompaniesWithoutUsers(orphanCompanies);
    
    if (companiesWithUsers.length > 0) {
      // Get unique user IDs
      const uniqueUserIds = [...new Set(companiesWithUsers.map(c => c.ownerId))].filter((id): id is string => !!id);
      
      if (forcePlayerSelection || uniqueUserIds.length > 1) {
        const loadedUsers = await Promise.all(
          uniqueUserIds.map(userId => userFeature.account.getPlayer(userId))
        );
        const validUsers = loadedUsers.filter((user): user is PlayerProfile => !!user);
        if (validUsers.length > 0) {
          setAvailableUsers(validUsers);
          setShowUserSelection(true);
          return;
        }
      }

      // A normal app entry can restore the only known player. Explicit logout
      // passes forcePlayerSelection and deliberately skips this branch.
      if (uniqueUserIds.length === 1) {
        // All companies belong to the same user - detect and load that user
        await loadCompanyLinkedUser(uniqueUserIds[0]);
        return;
      }
      
    }
    
    // If no autologin happened and no single user detected, show all companies
    setAllCompanies(companies);
  };

  const loadCompanyLinkedUser = async (userId: string) => {
    try {
      const user = await userFeature.account.getPlayer(userId);
      
      if (user) {
        await userFeature.account.selectPlayer(user);
        setCurrentUser(user);
        // loadUserCompanies will be called automatically by the useEffect
      }
    } catch (error) {
      console.error('Error loading company-linked user:', error);
    }
  };

  const loadUserCompanies = async () => {
    if (!currentUser) return;
    
    const companies = await companyFeature.records.listForOwner(currentUser.id);
    setAllCompanies(companies);
    
    if (companies.length === 0) return;

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
      leaderboardsFeature.views.list('company_value', 5),
      leaderboardsFeature.views.list('company_value_per_week', 5)
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

    const result = await userFeature.account.createLocalPlayer(newUserName.trim());

    if (result.success && result.user) {
      setNewUserName('');
      setShowCreateUser(false);
      setCurrentUser(result.user);
    } else {
      setError(result.error || 'Failed to create user');
    }
  });

  const handleGatewayCompanyCreated = async ({ name, createPlayerName }: { name: string; createPlayerName?: string }): Promise<CompanyCreateResult> => {
    return (await withLoading(async () => {
      let ownerId = currentUser?.id;
      if (!ownerId && createPlayerName) {
        const playerResult = await userFeature.account.createLocalPlayer(createPlayerName);
        if (!playerResult.success || !playerResult.user) {
          return { success: false, error: playerResult.error || 'Failed to create user profile' };
        }
        ownerId = playerResult.user.id;
        setCurrentUser(playerResult.user);
      }

      const result = await onCompanyCreated({ name, ownerId });
      if (result.company) {
        setPendingCompany(result.company);
        setShowStartingConditions(true);
      }
      return result;
    })) ?? { success: false, error: 'Failed to create company' };
  };
  
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

  const handleGatewayCompanyDeleted = async (companyId: string) => {
    const result = await companyFeature.records.remove(companyId);
    if (result.success) window.location.reload();
    return result;
  };

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
                            void userFeature.account.selectPlayer(null);
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
                            void userFeature.account.selectPlayer(user);
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
                

                {/* Create User (shown when multiple users exist) */}
                {showUserSelection && (
                  <div className="pt-3 border-t">
                    {!showCreateUser ? (
                      <div className="space-y-2">
                        <Button 
                          onClick={() => setShowCreateUser(true)}
                          className="w-full border-wine text-wine hover:bg-wine hover:text-white text-sm"
                          variant="outline"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create New User
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
                    ) : null}
                  </div>
                )}

                {companyFeature.ui.renderGateway({
                  companies: allCompanies,
                  unownedCompanies: companiesWithoutUsers,
                  showUnownedCompanies: showUserSelection,
                  currentOwnerId: currentUser?.id,
                  isLoading,
                  onCompanySelected,
                  onCompanyCreated: handleGatewayCompanyCreated,
                  onCompanyDeleted: handleGatewayCompanyDeleted,
                })}

                {error && <div className="mt-3 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">{error}</div>}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Highscores */}
            <div className="grid grid-cols-1 gap-2.5">
              {leaderboardsFeature.ui.renderSummary({ entries: highscores.company_value, title: 'Top Companies', isLoading })}
              {leaderboardsFeature.ui.renderSummary({ entries: highscores.company_value_per_week, title: 'Fastest Growing', isLoading })}
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
