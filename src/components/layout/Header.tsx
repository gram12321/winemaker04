import { useState } from 'react';
import { getCurrentPrestige } from '@/lib/services/core/gameState';
import { processGameTick } from '@/lib/services/core/gameTick';
import { formatCurrency, formatGameDate, formatNumber, formatCompact } from '@/lib/utils/utils';
import { NAVIGATION_EMOJIS } from '@/lib/utils';
import { Button, Badge, Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui';
import { NotificationCenter, useNotifications } from '@/components/layout/NotificationCenter';
import { useGameState, useGameStateWithData } from '@/hooks';
import { CalendarDays, MessageSquareText, LogOut } from 'lucide-react';
import PrestigeModal from '@/components/ui/modals/prestigeModal';
import { calculateCurrentPrestige } from '@/lib/database/prestige';
import { Company } from '@/lib/services/user/companyService';
import { getCurrentCompany } from '@/lib/services/core/gameState';

interface HeaderProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onTimeAdvance: () => void;
  currentCompany?: Company | null;
  onBackToLogin?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onPageChange, onTimeAdvance, onBackToLogin }) => {
  const gameState = useGameState();
  const [prestigeModalOpen, setPrestigeModalOpen] = useState(false);
  const [prestigeData, setPrestigeData] = useState<any>({ 
    totalPrestige: 0, 
    eventBreakdown: [],
    companyPrestige: 0,
    vineyardPrestige: 0,
    vineyards: []
  });
  const consoleHook = useNotifications();
  
  // Get current company once instead of multiple calls
  const currentCompany = getCurrentCompany();

  // Use consolidated hook for reactive prestige loading
  const currentPrestige = useGameStateWithData(getCurrentPrestige, 1);

  const handleIncrementWeek = async () => {
    try {
      await processGameTick();
      // Game state will be updated automatically via the useGameState hook
      onTimeAdvance();
    } catch (error) {
      console.error('Error advancing time:', error);
    }
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

  const navItems = [
    { id: 'dashboard', label: 'Company', icon: NAVIGATION_EMOJIS.dashboard },
    { id: 'vineyard', label: 'Vineyard', icon: NAVIGATION_EMOJIS.vineyard },
    { id: 'winery', label: 'Winery', icon: NAVIGATION_EMOJIS.winery },
    { id: 'sales', label: 'Sales', icon: NAVIGATION_EMOJIS.sales },
    { id: 'finance', label: 'Finance', icon: NAVIGATION_EMOJIS.finance }
  ];

  return (
    <header className="w-full bg-red-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
        <div className="flex items-center space-x-6">
          <button onClick={() => onPageChange('dashboard')} className="text-xl font-bold">
            🍷 Winery Management
          </button>
          
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.id}
                onClick={() => onPageChange(item.id)}
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
        
        <div className="flex items-center space-x-4">
          {/* Time display */}
          <div className="flex items-center space-x-2 mr-2">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm font-medium whitespace-nowrap">
              {formatGameDate(gameState.week, gameState.season, gameState.currentYear)}
            </span>
          </div>
          
          {/* Increment Week button */}
          <Button 
            onClick={handleIncrementWeek}
            variant="secondary" 
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white border-red-500 text-xs"
          >
            Increment Week
          </Button>
          
          <Badge variant="outline" className="bg-red-700 text-white border-red-500 px-3 py-1 flex items-center">
            <span className="font-medium">{formatCurrency(gameState.money || 0)}</span>
          </Badge>
          
          <Badge 
            variant="outline" 
            className="bg-red-700 text-white border-red-500 px-3 py-1 flex items-center cursor-pointer hover:bg-red-600 transition-colors"
            onClick={handlePrestigeClick}
          >
            <span className="font-medium">⭐ {currentPrestige >= 1000 ? formatCompact(currentPrestige, 1) : formatNumber(currentPrestige, { decimals: 1, forceDecimals: true })}</span>
          </Badge>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => consoleHook.openHistory()}
            className="rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-red-700"
          >
            <MessageSquareText className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-1 rounded-full h-10 w-10 text-white hover:bg-red-700">
                <Avatar>
                  <AvatarImage src="/assets/icon/winery-icon.png" alt="Winery" />
                  <AvatarFallback className="bg-red-600 text-white">
                    {currentCompany?.name ? (() => {
                      const name = currentCompany.name;
                      const words = name.split(' ').filter(word => word.length > 0);
                      
                      if (words.length === 1) {
                        // Single word: take first 2 letters
                        return words[0].substring(0, 2).toUpperCase();
                      } else {
                        // Multiple words: take first letter from first 2 words
                        return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
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
              <DropdownMenuItem onClick={() => onPageChange('profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPageChange('settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPageChange('admin')}>
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
              <DropdownMenuItem onClick={() => onPageChange('achievements')}>
                Achievements
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPageChange('highscores')}>
                Global Leaderboards
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPageChange('winepedia')}>
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
    </header>
  );
};

export default Header;
