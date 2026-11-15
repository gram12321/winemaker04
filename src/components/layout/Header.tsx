import { useState, useMemo, useEffect } from 'react';
import { getCurrentPrestige, processGameTick } from '@/lib/services';
import { formatGameDate, formatNumber } from '@/lib/utils';
import { NAVIGATION_EMOJIS } from '@/lib/utils';
import { Button, Badge, Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { NotificationCenter, useNotifications } from '@/components/layout/NotificationCenter';
import { useGameState, useGameStateWithData, useLoadingState } from '@/hooks';
import { CalendarDays, MessageSquareText, LogOut, MenuIcon } from 'lucide-react';
import { getCurrentCompany } from '@/lib/services';
import { prestigeFeature } from '@/lib/features/prestige';
import { createWeatherWeekContext, getWeatherIcon, getWeatherLabel } from '@/lib/features/weather';
import { NavigationProps, CompanyProps } from '@/lib/types/UItypes';
import { getEconomyPhaseColorClass } from '@/lib/utils';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';
import versionLogRaw from '../../../docs/versionlog.md?raw';


interface HeaderProps extends NavigationProps, CompanyProps {
  currentPage: string;
  onTimeAdvance: () => void;
  onBackToLogin?: () => void;
  onLogout: () => void | Promise<void>;
  adminAvailable: boolean;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, onTimeAdvance, onBackToLogin, onLogout, adminAvailable }) => {
  const gameState = useGameState();
  const weather = useMemo(() => createWeatherWeekContext(gameState), [gameState]);
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
  const showAdminDashboard = adminAvailable;

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setMobileMenuOpen(false);
    };
    closeOnDesktop();
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, []);

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
      const prestigeInfo = await prestigeFeature.reads.calculateCurrent();
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
    { id: 'finance', label: 'Finance', icon: NAVIGATION_EMOJIS.finance },
    { id: 'research', label: 'Research', icon: NAVIGATION_EMOJIS.research },
    { id: 'weather-center', label: 'Weather', icon: '🌦' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'vineyard', label: 'Vineyard', icon: NAVIGATION_EMOJIS.vineyard },
    { id: 'winery', label: 'Winery', icon: NAVIGATION_EMOJIS.winery },
    { id: 'equipment', label: 'Equipment', icon: '⚙️' },
    { id: 'sales', label: 'Sales', icon: NAVIGATION_EMOJIS.sales }
  ];
  const isCurrentNavItem = (id: string) => id === 'dashboard'
    ? currentPage === 'dashboard' || currentPage === 'company-overview'
    : currentPage === id;

  return (
    <>
      <header className="w-full bg-red-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto py-0.5 px-3 sm:px-4 md:px-6 lg:px-8 text-sm">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
            <div className="flex min-w-0 items-center justify-center sm:justify-start">
              <button type="button" aria-label="Open company overview" onClick={() => handleNavigation('dashboard')} className="text-sm font-semibold">
                🍷 Winery Management {appVersion}
              </button>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1 sm:w-auto sm:flex-nowrap sm:gap-2">
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
              aria-label={isAdvancingTime ? 'Advancing week' : 'Advance one week'}
              title={isAdvancingTime ? 'Advancing week' : 'Advance one week'}
              disabled={isAdvancingTime}
              className="sm:hidden min-h-10 min-w-10 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            
            {/* Money display - responsive */}
            <Badge 
              variant="outline" 
              role="button"
              tabIndex={0}
              aria-label={`Open finance, cash ${formatNumber(gameState.money || 0, { currency: true })}`}
              className="bg-red-700 text-white border-red-500 px-2 py-0.5 items-center cursor-pointer hover:bg-red-600 transition-colors hidden sm:flex"
              onClick={() => handleNavigation('finance')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleNavigation('finance');
                }
              }}
              title="View Finance"
            >
              <span className="font-medium">{formatNumber(gameState.money || 0, { currency: true })}</span>
            </Badge>
            
            <Badge 
              variant="outline" 
              role="button"
              tabIndex={0}
              aria-label={`Open finance, cash ${formatNumber(gameState.money || 0, { currency: true })}`}
              className="bg-red-700 text-white border-red-500 px-1.5 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors sm:hidden"
              onClick={() => handleNavigation('finance')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleNavigation('finance');
                }
              }}
              title="View Finance"
            >
              <span className="font-medium text-xs">{formatNumber(gameState.money || 0, { currency: true, compact: true, decimals: 1 })}</span>
            </Badge>
            
            {/* Prestige display - responsive */}
            <Badge 
              variant="outline" 
              role="button"
              tabIndex={0}
              aria-label={`Open prestige breakdown, ${formatNumber(currentPrestige, { decimals: 1 })}`}
              className="bg-red-700 text-white border-red-500 px-2 py-0.5 items-center cursor-pointer hover:bg-red-600 transition-colors hidden sm:flex"
              onClick={handlePrestigeClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void handlePrestigeClick();
                }
              }}
            >
              <span className="font-medium">⭐ {currentPrestige >= 1000 ? formatNumber(currentPrestige, { compact: true, decimals: 1 }) : formatNumber(currentPrestige, { decimals: 1, forceDecimals: true })}</span>
            </Badge>
            
            <Badge 
              variant="outline" 
              role="button"
              tabIndex={0}
              aria-label={`Open prestige breakdown, ${formatNumber(currentPrestige, { decimals: 1 })}`}
              className="bg-red-700 text-white border-red-500 px-1.5 py-0.5 flex items-center cursor-pointer hover:bg-red-600 transition-colors sm:hidden"
              onClick={handlePrestigeClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void handlePrestigeClick();
                }
              }}
            >
              <span className="font-medium text-xs">⭐ {formatNumber(currentPrestige, { compact: true, decimals: 1 })}</span>
            </Badge>

            {/* Economy Phase display - responsive with tooltip */}
            <UnifiedTooltip
              content={
                <div className="space-y-1">
                  <p className="font-semibold">Economy Effects</p>
                  <p className="text-xs text-gray-300">Impacts sales, event frequency, and risks.</p>
                </div>
              }
              side="bottom"
              variant="panel"
              density="compact"
              className="max-w-sm"
              showMobileHint={false}
            >
              <Badge 
                variant="outline" 
                role="button"
                tabIndex={0}
                aria-label={`Open economy details, ${gameState.economyPhase || 'Stable'}`}
                className={`px-2 py-0.5 items-center cursor-pointer transition-colors hidden sm:flex ${getEconomyPhaseColorClass(gameState.economyPhase || 'Stable')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  try { localStorage.setItem('winepedia_view', 'economy'); } catch {}
                  handleNavigation('winepedia');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    try { localStorage.setItem('winepedia_view', 'economy'); } catch {}
                    handleNavigation('winepedia');
                  }
                }}
              >
                <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>
                <span className="font-medium">{gameState.economyPhase || 'Stable'}</span>
              </Badge>
            </UnifiedTooltip>
            
            <Badge 
              variant="outline" 
              role="button"
              tabIndex={0}
              aria-label={`Open economy details, ${gameState.economyPhase || 'Stable'}`}
              className={`px-1.5 py-0.5 flex items-center cursor-pointer transition-colors sm:hidden ${getEconomyPhaseColorClass(gameState.economyPhase || 'Stable')}`}
              onClick={() => {
                try { localStorage.setItem('winepedia_view', 'economy'); } catch {}
                handleNavigation('winepedia');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  try { localStorage.setItem('winepedia_view', 'economy'); } catch {}
                  handleNavigation('winepedia');
                }
              }}>
              <span className="font-medium text-xs">{gameState.economyPhase}</span>
            </Badge>

            <UnifiedTooltip
              content={
                <div className="space-y-1">
                  <p className="font-semibold">Weather Outlook</p>
                  <p className="text-xs text-gray-300">Current: {getWeatherLabel(weather.state, weather.intensity)}</p>
                  <p className="text-xs text-gray-300">Next-week forecast: {getWeatherLabel(weather.forecast.state, weather.forecast.intensity)} ({weather.forecast.confidence} confidence)</p>
                </div>
              }
              side="bottom"
              variant="panel"
              density="compact"
              className="max-w-sm"
              showMobileHint={false}
            >
              <Badge
                variant="outline"
                role="button"
                tabIndex={0}
                aria-label={`Open Weather Center, ${weather.state}`}
                className="px-2 py-0.5 hidden sm:flex items-center cursor-pointer bg-red-700 text-white border-red-500 hover:bg-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('weather-center');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleNavigation('weather-center');
                  }
                }}
              >
                <span className="mr-1.5">{getWeatherIcon(weather.state)}</span>
                <span className="font-medium">{weather.state}</span>
              </Badge>
            </UnifiedTooltip>

            <Badge
              variant="outline"
              role="button"
              tabIndex={0}
              aria-label={`Open Weather Center, ${weather.state}`}
              className="px-1.5 py-0.5 sm:hidden flex items-center cursor-pointer bg-red-700 text-white border-red-500 hover:bg-red-600"
              onClick={() => {
                handleNavigation('weather-center');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleNavigation('weather-center');
                }
              }}
            >
              <span className="mr-1">{getWeatherIcon(weather.state)}</span>
              <span className="font-medium text-xs">{weather.state}</span>
            </Badge>
            
            {/* Console button - responsive */}
            <Button 
              variant="ghost" 
              size="icon"
              aria-label={`Open notifications${consoleHook.unreadCount > 0 ? `, ${consoleHook.unreadCount} unread` : ''}`}
              onClick={() => consoleHook.openHistory()}
              className="rounded-full h-10 w-10 items-center justify-center text-white hover:bg-red-700 relative hidden sm:flex"
            >
              <MessageSquareText className="h-4 w-4" />
              {consoleHook.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                  {Math.min(consoleHook.unreadCount, 99)}
                </span>
              )}
            </Button>

            {/* Console button - mobile */}
            <Button 
              variant="ghost" 
              size="icon"
              aria-label={`Open notifications${consoleHook.unreadCount > 0 ? `, ${consoleHook.unreadCount} unread` : ''}`}
              onClick={() => consoleHook.openHistory()}
              className="rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-red-700 relative sm:hidden"
            >
              <MessageSquareText className="h-4 w-4" />
              {consoleHook.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                  {Math.min(consoleHook.unreadCount, 99)}
                </span>
              )}
            </Button>
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden text-white hover:bg-red-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
            
            {/* Desktop user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="items-center space-x-2 p-1 rounded-full h-8 w-8 text-white hover:bg-red-700 hidden lg:flex">
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
                {showAdminDashboard && (
                  <DropdownMenuItem onClick={() => handleNavigation('admin')}>
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
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
                  onClick={() => { void onLogout(); }}
                  className="text-red-600 focus:text-red-500"
                >
                  Log out player
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center justify-center gap-1 pt-1 pb-0.5">
            {navItems.map((item) => (
              <Button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
              variant={isCurrentNavItem(item.id) ? "secondary" : "ghost"}
                size="sm"
              aria-current={isCurrentNavItem(item.id) ? 'page' : undefined}
                className="bg-transparent hover:bg-red-700 text-white border-0 px-2"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>
      
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent id="game-mobile-navigation" className="fixed inset-y-0 left-0 right-auto m-0 flex h-dvh max-h-dvh w-[min(88vw,24rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-r bg-white p-0 pt-[env(safe-area-inset-top)] dark:bg-slate-800 lg:hidden">
          <DialogHeader className="border-b px-5 py-4 pr-14 text-left">
            <DialogTitle className="text-xl font-semibold text-primary">Navigation</DialogTitle>
            <DialogDescription className="sr-only">Choose a game area, account page, or player action.</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex flex-col gap-2 rounded-md bg-blue-50 p-3 text-slate-900 dark:bg-slate-700 dark:text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formatGameDate(gameState.week, gameState.season, gameState.currentYear)}</span>
                <Button
                  onClick={() => {
                    handleIncrementWeek();
                    setMobileMenuOpen(false);
                  }}
                  variant="outline"
                  disabled={isAdvancingTime}
                  className="min-h-11 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>{isAdvancingTime ? 'Processing...' : 'End Week'}</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex-1 py-1 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700">
                  <span aria-hidden="true">💰</span>
                  <span className="font-medium">{formatNumber(gameState.money || 0, { currency: true })}</span>
                  <span className="sr-only">Current company cash</span>
                </Badge>
                <Badge variant="secondary" className="flex-1 py-1 flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700">
                  <span aria-hidden="true">⭐</span>
                  <span className="font-medium">
                    {currentPrestige >= 1000 ? formatNumber(currentPrestige, { compact: true, decimals: 1 }) : formatNumber(currentPrestige, { decimals: 1, forceDecimals: true })}
                  </span>
                  <span className="sr-only">Company prestige</span>
                </Badge>
              </div>
            </div>

            <nav aria-label="Main navigation" className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => handleNavigation(item.id)}
                  aria-current={isCurrentNavItem(item.id) ? 'page' : undefined}
                  className={`min-h-11 w-full justify-start text-left text-foreground ${isCurrentNavItem(item.id) ? "bg-muted" : ""}`}
                >
                  <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </nav>

            <div className="border-t pt-4">
              <h3 className="mb-2 px-3 text-sm font-medium text-muted-foreground">Account and reference</h3>
              {[
                { id: 'profile', label: 'Profile' },
                { id: 'settings', label: 'Settings' },
                ...(showAdminDashboard ? [{ id: 'admin', label: 'Admin Dashboard' }] : []),
                { id: 'highscores', label: 'Highscores' },
                { id: 'achievements', label: 'Achievements' },
                { id: 'wine-log', label: 'Wine Production Log' },
                { id: 'winepedia', label: 'Wine-Pedia' },
              ].map(({ id, label }) => (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => handleNavigation(id)}
                  aria-current={currentPage === id ? 'page' : undefined}
                  className="min-h-11 w-full justify-start text-left text-foreground"
                >
                  {label}
                </Button>
              ))}

              {onBackToLogin && (
                <Button variant="ghost" onClick={onBackToLogin} className="min-h-11 w-full justify-start text-left text-destructive hover:text-destructive">
                  <LogOut className="mr-3 h-4 w-4" />
                  Switch Company
                </Button>
              )}

              <Button variant="ghost" onClick={() => { void onLogout(); }} className="min-h-11 w-full justify-start text-left text-destructive hover:text-destructive">
                <LogOut className="mr-3 h-4 w-4" />
                Log out player
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Notification History Modal - controlled by NotificationCenter component */}
      {consoleHook.isHistoryOpen && 
        <NotificationCenter 
          isOpen={consoleHook.isHistoryOpen} 
          onClose={consoleHook.closeHistory} 
        />
      }
      
      {/* Prestige Breakdown Modal */}
      {prestigeModalOpen && prestigeFeature.ui.renderModal({
        isOpen: prestigeModalOpen,
        onClose: () => setPrestigeModalOpen(false),
        totalPrestige: prestigeData.totalPrestige,
        eventBreakdown: prestigeData.eventBreakdown,
        companyPrestige: prestigeData.companyPrestige,
        vineyardPrestige: prestigeData.vineyardPrestige,
        vineyards: prestigeData.vineyards,
      })}
    </>
  );
};

export default Header;
