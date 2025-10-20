import { useState, useMemo } from 'react';
import { getCurrentPrestige } from '@/lib/services/core/gameState';
import { processGameTick } from '@/lib/services/core/gameTick';
import { formatCurrency, formatGameDate, formatNumber, formatCompact } from '@/lib/utils/utils';
import { NAVIGATION_EMOJIS } from '@/lib/utils';
import { Button, Badge, Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui';
import { NotificationCenter, useNotifications } from '@/components/layout/NotificationCenter';
import { useGameState, useGameStateWithData, useLoadingState } from '@/hooks';
import { CalendarDays, MessageSquareText, LogOut, MenuIcon, X } from 'lucide-react';
import PrestigeModal from '@/components/ui/modals/UImodals/prestigeModal';
import { calculateCurrentPrestige } from '@/lib/services/prestige/prestigeService';
import { getCurrentCompany } from '@/lib/services/core/gameState';
import { NavigationProps, CompanyProps } from '@/lib/types/UItypes';
import versionLogRaw from '../../../docs/versionlog.md?raw';

interface HeaderProps extends NavigationProps, CompanyProps {
  currentPage: string;
  onTimeAdvance: () => void;
  onBackToLogin?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, onTimeAdvance, onBackToLogin }) => {
  const gameState = useGameState();
  const [prestigeModalOpen, setPrestigeModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isLoading: isAdvancingTime, withLoading } = useLoadingState();
  const [prestigeData, setPrestigeData] = useState<any>({ 
    totalPrestige: 0, 
    eventBreakdown: [],
    companyPrestige: 0,
    vineyardPrestige: 0,
    vineyards: []
  });
  const consoleHook = useNotifications();
  
  // Extract latest version from docs/versionlog.md (first "## Version X" occurrence)
  const appVersion = useMemo(() => {
    try {
      const match = versionLogRaw.match(/^##\s+Version\s+([\d\.]+)/m);
      return match ? `v${match[1]}` : 'v0.0.0';
    } catch {
      return 'v0.0.0';
    }
  }, []);
  
  // Get current company once instead of multiple calls
  const currentCompany = getCurrentCompany();

  // Use consolidated hook for reactive prestige loading
  const currentPrestige = useGameStateWithData(getCurrentPrestige, 1);

  const handleIncrementWeek = () => {
    withLoading(async () => {
      await processGameTick();
      // Game state will be updated automatically via the useGameState hook
      onTimeAdvance();
    });
  };

  const handlePrestigeClick = async () => {
    try {
      const prestigeInfo = await calculateCurrentPrestige();
      setPrestigeData({
        totalPrestige: prestigeInfo.totalPrestige,
        eventBreakdown: prestigeInfo.eventBreakdown,
        companyPrestige: prestigeInfo.companyPrestige,
        vineyardPrestige: prestigeInfo.vineyardPrestige,
        vineyards: prestigeInfo.vineyards
      });
      setPrestigeModalOpen(true);
    } catch (error) {
      console.error('Error loading prestige data:', error);
    }
  };

  const handleNavigation = (page: string) => {
    onNavigate?.(page);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Company', icon: NAVIGATION_EMOJIS.dashboard },
    { id: 'vineyard', label: 'Vineyard', icon: NAVIGATION_EMOJIS.vineyard },
    { id: 'winery', label: 'Winery', icon: NAVIGATION_EMOJIS.winery },
    { id: 'sales', label: 'Sales', icon: NAVIGATION_EMOJIS.sales },
    { id: 'finance', label: 'Finance', icon: NAVIGATION_EMOJIS.finance },
    { id: 'staff', label: 'Staff', icon: '👥' }
  ];

  return (
    <>
      <header className="w-full bg-red-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center py-0.5 px-3 sm:px-4 md:px-6 lg:px-8 text-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => handleNavigation('dashboard')} className="text-sm font-semibold">
              🍷 Winery Management {appVersion}
            </button>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  variant={currentPage === item.id ? "secondary" : "ghost"}
                  size="sm"
                  className="bg-transparent hover:bg-red-700 text-white border-0"
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Time display - responsive */}
            <div className="flex items-center space-x-2 mr-2">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium whitespace-nowrap hidden sm:block">
                {formatGameDate(gameState.week, gameState.season, gameState.currentYear)}
              </span>
              <span className="text-[10px] font-medium whitespace-nowrap sm:hidden">
                W{gameState.week}
              </span>
            </div>
            
            {/* Increment Week button - responsive */}
            <Button 
              onClick={handleIncrementWeek}
              variant="secondary" 
              size="sm"
              disabled={isAdvancingTime}
              className="bg-red-600 hover:bg-red-700 text-white border-red-500 text-xs hidden sm:flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdvancingTime ? 'Processing...' : 'Increment Week'}
            </Button>
            
            <Button 
              onClick={handleIncrementWeek}
              variant="ghost" 
              size="icon"
              disabled={isAdvancingTime}
              className="sm:hidden text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            
            {/* Money display - responsive */}
            <Badge 
              variant="outline" 
              className="bg-red-700 text-white border-red-500 px-2 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors hidden sm:flex"
              onClick={() => handleNavigation('finance')}
              title="View Finance"
            >
              <span className="font-medium">{formatCurrency(gameState.money || 0)}</span>
            </Badge>
            
            <Badge 
              variant="outline" 
              className="bg-red-700 text-white border-red-500 px-1.5 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors sm:hidden"
              onClick={() => handleNavigation('finance')}
              title="View Finance"
            >
              <span className="font-medium text-xs">{formatCompact(gameState.money || 0, 1)}</span>
            </Badge>
            
            {/* Prestige display - responsive */}
            <Badge 
              variant="outline" 
              className="bg-red-700 text-white border-red-500 px-2 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors hidden sm:flex"
              onClick={handlePrestigeClick}
            >
              <span className="font-medium">⭐ {currentPrestige >= 1000 ? formatCompact(currentPrestige, 1) : formatNumber(currentPrestige, { decimals: 1, forceDecimals: true })}</span>
            </Badge>
            
            <Badge 
              variant="outline" 
              className="bg-red-700 text-white border-red-500 px-1.5 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors sm:hidden"
              onClick={handlePrestigeClick}
            >
              <span className="font-medium text-xs">⭐ {formatCompact(currentPrestige, 1)}</span>
            </Badge>
            
            {/* Console button - responsive */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => consoleHook.openHistory()}
              className="rounded-full h-8 w-8 flex items-center justify-center text-white hover:bg-red-700 relative hidden sm:flex"
            >
              <MessageSquareText className="h-4 w-4" />
              {consoleHook.messages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                  {Math.min(consoleHook.messages.length, 99)}
                </span>
              )}
            </Button>

            {/* Console button - mobile */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => consoleHook.openHistory()}
              className="rounded-full h-8 w-8 flex items-center justify-center text-white hover:bg-red-700 relative sm:hidden"
            >
              <MessageSquareText className="h-4 w-4" />
              {consoleHook.messages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                  {Math.min(consoleHook.messages.length, 99)}
                </span>
              )}
            </Button>
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-red-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
            
            {/* Desktop user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 p-1 rounded-full h-8 w-8 text-white hover:bg-red-700 hidden lg:flex">
                  <Avatar>
                    <AvatarImage src="/assets/icon/winery-icon.png" alt="Winery" />
                    <AvatarFallback className="bg-red-600 text-white">
                      {currentCompany?.name ? (() => {
                        const name = currentCompany.name;
                        const words = name.split(' ').filter((word: string) => word.length > 0);
                        
                        if (words.length === 1) {
                          // Single word: take first 2 letters
                          return words[0].substring(0, 2).toUpperCase();
                        } else {
                          // Multiple words: take first letter from first 2 words
                          return words.slice(0, 2).map((word: string) => word.charAt(0)).join('').toUpperCase();
                        }
                      })() : 'CO'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  {currentCompany?.name || gameState.companyName || 'My Winery'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation('profile')}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('admin')}>
                  Admin Dashboard
                </DropdownMenuItem>
                {onBackToLogin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onBackToLogin} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Switch Company
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => handleNavigation('achievements')}>
                  Achievements
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('wine-log')}>
                  Wine Production Log
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('highscores')}>
                  Global Leaderboards
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('winepedia')}>
                  Wine-Pedia
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    // Clear only app-specific keys and reset game
                    try {
                      const company = currentCompany;
                      const keysToRemove = [
                        'lastCompanyId',
                        'showNotifications'
                      ];
                      keysToRemove.forEach((key) => localStorage.removeItem(key));

                      // Remove company-scoped settings if present
                      if (company?.id) {
                        localStorage.removeItem(`company_settings_${company.id}`);
                      }

                      // Remove any legacy company settings keys
                      Object.keys(localStorage)
                        .filter((key) => key.startsWith('company_settings_'))
                        .forEach((key) => localStorage.removeItem(key));
                    } catch {}
                    window.location.reload();
                  }}
                  className="text-red-600 focus:text-red-500"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <nav className="fixed top-0 left-0 bottom-0 w-3/4 max-w-sm bg-white dark:bg-slate-800 p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-primary">Navigation</h2>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-col space-y-2 mb-6 p-3 bg-blue-50 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatGameDate(gameState.week, gameState.season, gameState.currentYear)}</span>
                  <Button 
                    onClick={() => {
                      handleIncrementWeek();
                      setMobileMenuOpen(false);
                    }}
                    variant="outline" 
                    size="sm"
                    disabled={isAdvancingTime}
                    className="flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>{isAdvancingTime ? 'Processing...' : 'End Week'}</span>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant="secondary" 
                    className="flex-1 py-1 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700"
                  >
                    <span>💰</span>
                    <span className="font-medium">
                      {formatCurrency(gameState.money || 0)}
                    </span>
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="flex-1 py-1 flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700"
                  >
                    <span>⭐</span>
                    <span className="font-medium">
                      {currentPrestige >= 1000 ? formatCompact(currentPrestige, 1) : formatNumber(currentPrestige, { decimals: 1, forceDecimals: true })}
                    </span>
                  </Badge>
                </div>
              </div>
              
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => handleNavigation(item.id)}
                  className={`w-full justify-start text-left mb-1 py-3 text-foreground ${
                    currentPage === item.id ? "bg-muted" : ""
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </div>
            
            <div className="mt-auto pt-6 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Account</h3>
              {[
                { id: 'profile', label: 'Profile' },
                { id: 'settings', label: 'Settings' },
                { id: 'admin', label: 'Admin Dashboard' },
                { id: 'highscores', label: 'Highscores' },
                { id: 'achievements', label: 'Achievements' },
                { id: 'wine-log', label: 'Wine Production Log' },
                { id: 'winepedia', label: 'Wine-Pedia' }
              ].map(({ id, label }) => (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => handleNavigation(id)}
                  className="w-full justify-start text-left py-2 text-foreground"
                >
                  {label}
                </Button>
              ))}
              
              <Button
                variant="ghost"
                onClick={onBackToLogin}
                className="w-full justify-start text-left py-2 text-destructive hover:text-destructive mt-2"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Switch Company
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => {
                  // Clear only app-specific keys and reset game
                  try {
                    const company = currentCompany;
                    const keysToRemove = [
                      'lastCompanyId',
                      'showNotifications'
                    ];
                    keysToRemove.forEach((key) => localStorage.removeItem(key));

                    // Remove company-scoped settings if present
                    if (company?.id) {
                      localStorage.removeItem(`company_settings_${company.id}`);
                    }

                    // Remove any legacy company settings keys
                    Object.keys(localStorage)
                      .filter((key) => key.startsWith('company_settings_'))
                      .forEach((key) => localStorage.removeItem(key));
                  } catch {}
                  window.location.reload();
                }}
                className="w-full justify-start text-left py-2 text-destructive hover:text-destructive mt-2"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Logout
              </Button>
            </div>
          </nav>
        </div>
      )}
      
      {/* Notification History Modal - controlled by NotificationCenter component */}
      {consoleHook.isHistoryOpen && 
        <NotificationCenter 
          isOpen={consoleHook.isHistoryOpen} 
          onClose={consoleHook.closeHistory} 
        />
      }
      
      {/* Prestige Breakdown Modal */}
      <PrestigeModal
        isOpen={prestigeModalOpen}
        onClose={() => setPrestigeModalOpen(false)}
        totalPrestige={prestigeData.totalPrestige}
        eventBreakdown={prestigeData.eventBreakdown}
        companyPrestige={prestigeData.companyPrestige}
        vineyardPrestige={prestigeData.vineyardPrestige}
        vineyards={prestigeData.vineyards}
      />
    </>
  );
};

export default Header;
