import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoadingState } from '@/hooks';
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui';
import { User, Building2, Edit, Trash2, RefreshCw, BarChart3 } from 'lucide-react';
import { authService, companyService } from '@/lib/services';
import { type AuthUser, type Company, supabase } from '@/lib/database';
import type { CompanyStats } from '@/lib/services/user/companyService';
import { formatNumber, formatCurrency, calculateCompanyWeeks, formatDate } from '@/lib/utils/utils';
import { PageProps, CompanyProps } from '../../lib/types/UItypes';

// Avatar options
const AVATAR_OPTIONS = [
  { id: 'default', emoji: '👤', label: 'Default' },
  { id: 'businessman', emoji: '👨‍💼', label: 'Businessman' },
  { id: 'businesswoman', emoji: '👩‍💼', label: 'Businesswoman' },
  { id: 'scientist', emoji: '🧑‍🔬', label: 'Scientist' },
  { id: 'farmer', emoji: '👨‍🌾', label: 'Farmer' },
  { id: 'chef', emoji: '👩‍🍳', label: 'Chef' },
  { id: 'astronaut', emoji: '👨‍🚀', label: 'Astronaut' },
  { id: 'construction', emoji: '👷', label: 'Construction' },
  { id: 'mechanic', emoji: '🧑‍🔧', label: 'Mechanic' },
  { id: 'office', emoji: '🧑‍💻', label: 'Office Worker' },
  { id: 'teacher', emoji: '👨‍🏫', label: 'Teacher' },
  { id: 'artist', emoji: '👩‍🎨', label: 'Artist' },
  { id: 'superhero', emoji: '🦸', label: 'Superhero' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'royal', emoji: '👑', label: 'Royal' },
  { id: 'mage', emoji: '🧙', label: 'Mage' }
];

// Color options
const COLOR_OPTIONS = [
  { id: 'blue', value: 'bg-blue-100 text-blue-800', label: 'Blue' },
  { id: 'green', value: 'bg-green-100 text-green-800', label: 'Green' },
  { id: 'red', value: 'bg-red-100 text-red-800', label: 'Red' },
  { id: 'purple', value: 'bg-purple-100 text-purple-800', label: 'Purple' },
  { id: 'yellow', value: 'bg-yellow-100 text-yellow-800', label: 'Yellow' },
  { id: 'pink', value: 'bg-pink-100 text-pink-800', label: 'Pink' },
  { id: 'indigo', value: 'bg-indigo-100 text-indigo-800', label: 'Indigo' },
  { id: 'gray', value: 'bg-gray-100 text-gray-800', label: 'Gray' }
];

interface ProfileProps extends PageProps, CompanyProps {
  onCompanySelected: (company: Company) => void;
  onBackToLogin: () => void;
}

export function Profile({ currentCompany, onCompanySelected, onBackToLogin }: ProfileProps) {
  // State
  const { isLoading, withLoading } = useLoadingState();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyStats>({ totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 });
  const [error, setError] = useState('');

  // Edit profile state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('default');
  const [selectedColor, setSelectedColor] = useState('blue');

  // Sorting
  const [sortOption, setSortOption] = useState<'name' | 'money' | 'lastPlayed' | 'age'>('name');

  useEffect(() => {
    // Listen for auth changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
      if (user) {
        loadUserData(user.id);
        setEditName(user.name);
        setSelectedAvatar(user.avatar || 'default');
        setSelectedColor(user.avatarColor || 'blue');
      } else {
        // If no authenticated user but there's a current company, show it
        if (currentCompany) {
          setUserCompanies([currentCompany]);
          setCompanyStats({ 
            totalCompanies: 1, 
            totalGold: currentCompany.money, 
            totalValue: currentCompany.money, // For now, simple calculation
            avgWeeks: Math.max(1, (currentCompany.currentYear - currentCompany.foundedYear) * 52 + currentCompany.currentWeek)
          });
          
          // If the company has a user_id, try to load that user's information
          if (currentCompany.userId) {
            loadCompanyUserData(currentCompany.userId);
          }
        } else {
          setUserCompanies([]);
          setCompanyStats({ totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 });
        }
      }
    });

    return unsubscribe;
  }, [currentCompany]);

  const loadUserData = (userId: string) => withLoading(async () => {
    const [companies, stats] = await Promise.all([
      companyService.getUserCompanies(userId),
      companyService.getCompanyStats(userId)
    ]);
    
    setUserCompanies(companies);
    setCompanyStats(stats);
  });

  const loadCompanyUserData = async (userId: string) => {
    try {
      // Load user data from the database for companies with user_id
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading company user data:', error);
        return;
      }

      if (user) {
        // Create a mock AuthUser object for display purposes
        const mockUser: AuthUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          avatarColor: user.avatar_color,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at)
        };
        
        setCurrentUser(mockUser);
        setEditName(user.name);
        setSelectedAvatar(user.avatar || 'default');
        setSelectedColor(user.avatar_color || 'blue');
      }
    } catch (error) {
      console.error('Error loading company user data:', error);
    }
  };

  const handleRefresh = () => {
    if (currentUser) {
      loadUserData(currentUser.id);
    }
  };

  const handleUpdateProfile = () => withLoading(async () => {
    if (!currentUser) return;

    setError('');

    const result = await authService.updateProfile({
      name: editName.trim(),
      avatar: selectedAvatar,
      avatarColor: selectedColor
    });

    if (result.success) {
      setIsEditDialogOpen(false);
    } else {
      setError(result.error || 'Failed to update profile');
    }
  });

  const handleSelectCompany = (company: Company) => withLoading(async () => {
    // Update the company's last played time
    await companyService.updateCompany(company.id, {});
    
    onCompanySelected(company);
  });

  const handleDeleteAccount = () => withLoading(async () => {
    if (!currentUser) return;
    
    if (confirm('Are you sure you want to permanently delete your account? This will delete all your companies and cannot be undone.')) {
      const result = await authService.deleteAccount();
      
      if (result.success) {
        onBackToLogin();
      } else {
        setError(result.error || 'Failed to delete account');
      }
    }
  });

  const formatLastPlayed = useCallback((date: Date): string => {
    // Handle invalid dates
    if (!date || isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  }, []);

  const getColorClass = (colorId: string) => {
    return COLOR_OPTIONS.find(c => c.id === colorId)?.value || COLOR_OPTIONS[0].value;
  };

  const getSortedCompanies = useMemo(() => {
    return [...userCompanies].sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'money':
          return b.money - a.money;
        case 'lastPlayed':
          return new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime();
        case 'age':
          // Calculate weeks elapsed using utility function
          const aWeeks = calculateCompanyWeeks(a.foundedYear, a.currentWeek, a.currentSeason, a.currentYear);
          const bWeeks = calculateCompanyWeeks(b.foundedYear, b.currentWeek, b.currentSeason, b.currentYear);
          return bWeeks - aWeeks;
        default:
          return 0;
      }
    });
  }, [userCompanies, sortOption]);

  if (!currentUser && !currentCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              No User Profile
            </CardTitle>
            <CardDescription>
              You need to be signed in to view your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBackToLogin} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avatarEmoji = AVATAR_OPTIONS.find(a => a.id === selectedAvatar)?.emoji || '👤';
  const colorClass = getColorClass(currentUser?.avatarColor || 'blue');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <User className="h-6 w-6" />
            Player Profile
          </h2>
          <p className="text-muted-foreground">Manage your profile and companies</p>
        </div>
        <Button variant="outline" onClick={onBackToLogin}>
          Back to Login
        </Button>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle>Profile</CardTitle>
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                          Customize your profile information and avatar
                        </DialogDescription>
                      </DialogHeader>
                      <Tabs defaultValue="basic">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="basic">Basic Info</TabsTrigger>
                          <TabsTrigger value="avatar">Avatar</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="basic" className="space-y-4">
                          <div>
                            <Label htmlFor="editName">Name</Label>
                            <Input
                              id="editName"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="avatar" className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium">Avatar</Label>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {AVATAR_OPTIONS.map((avatar) => (
                                <div
                                  key={avatar.id}
                                  className={`p-3 border rounded-md flex items-center justify-center cursor-pointer text-2xl transition-all ${
                                    selectedAvatar === avatar.id ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                                  }`}
                                  onClick={() => setSelectedAvatar(avatar.id)}
                                >
                                  {avatar.emoji}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium">Color</Label>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {COLOR_OPTIONS.map((color) => (
                                <div
                                  key={color.id}
                                  className={`${color.value} h-8 rounded-md border cursor-pointer flex items-center justify-center text-xs font-medium ${
                                    selectedColor === color.id ? 'ring-2 ring-primary' : ''
                                  }`}
                                  onClick={() => setSelectedColor(color.id)}
                                >
                                  {color.label}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t">
                            <Label className="text-sm font-medium">Preview</Label>
                            <div className="flex justify-center mt-2">
                              <div className={`w-16 h-16 ${getColorClass(selectedColor)} rounded-full flex items-center justify-center`}>
                                <span className="text-2xl">
                                  {AVATAR_OPTIONS.find(a => a.id === selectedAvatar)?.emoji}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                      
                      {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                          {error}
                        </div>
                      )}
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleUpdateProfile} disabled={isLoading}>
                          {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-2">
                <div className={`w-24 h-24 ${colorClass} rounded-full flex items-center justify-center mb-4`}>
                  <span className="text-4xl">{avatarEmoji}</span>
                </div>
                <h2 className="text-xl font-semibold">{currentUser?.name || 'Anonymous User'}</h2>
                <p className="text-sm text-muted-foreground">
                  {currentUser ? `Member since ${formatDate(currentUser.createdAt)}` : 'Playing as guest'}
                </p>
                {currentUser && (
                  <div className="mt-4 w-full space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="truncate ml-2">{currentUser.email || 'Not provided'}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              {currentUser && (
                <CardFooter className="pt-0">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAccount}
                    className="w-full"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </CardFooter>
              )}
            </Card>

            {/* Portfolio Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Portfolio Stats
                </CardTitle>
                <CardDescription>Combined statistics for all your companies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Companies</p>
                      <p className="text-xl font-semibold">{companyStats.totalCompanies}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Avg. Week</p>
                      <p className="text-xl font-semibold">{companyStats.avgWeeks}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Money</p>
                      <p className="text-xl font-semibold">{formatCurrency(companyStats.totalGold, 0, companyStats.totalGold >= 1000)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                      <p className="text-xl font-semibold">{formatCurrency(companyStats.totalValue, 0, companyStats.totalValue >= 1000)}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Companies List */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Your Companies
                </CardTitle>
                <CardDescription>Click on a company to switch to it</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={sortOption}
                  onValueChange={(value: any) => setSortOption(value)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="age">Age (Weeks)</SelectItem>
                    <SelectItem value="money">Money</SelectItem>
                    <SelectItem value="lastPlayed">Last played</SelectItem>
                  </SelectContent>
                </Select>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleRefresh}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh company data</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              {userCompanies.length === 0 ? (
                <div className="text-center p-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">You don't have any companies yet.</p>
                  <Button onClick={onBackToLogin} variant="outline">
                    Create Your First Company
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getSortedCompanies.map((company: Company) => (
                    <Card 
                      key={company.id}
                      className={`hover:bg-accent/50 cursor-pointer transition-colors ${
                        currentCompany?.id === company.id ? 'border-primary border-2' : ''
                      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => handleSelectCompany(company)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {company.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold">{company.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Week {company.currentWeek}, {company.currentSeason} {company.currentYear}
                              </p>
                            </div>
                          </div>
                          {currentCompany?.id === company.id && (
                            <Badge>Current</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Money</span>
                            <div className="font-medium">€{formatNumber(company.money, { decimals: 0, forceDecimals: true })}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prestige</span>
                            <div className="font-medium">{formatNumber(company.prestige, { decimals: 1, forceDecimals: true })}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last Played</span>
                            <div className="font-medium">{formatLastPlayed(company.lastPlayed)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}