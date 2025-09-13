import { useState, useEffect } from 'react';
import { getGameState, getCurrentPrestige } from '@/lib/gameState';
import { processGameTick } from '@/lib/services/gameTickService';
import { formatCurrency } from '@/lib/utils/formatUtils';
import { NAVIGATION_EMOJIS } from '@/lib/utils/emojis';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NotificationCenter, useNotifications } from '@/components/layout/NotificationCenter';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { CalendarDays, MessageSquareText } from 'lucide-react';
import PrestigeModal from '@/components/ui/prestige-modal';
import { calculateCurrentPrestige } from '@/lib/database/prestigeService';

interface HeaderProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onTimeAdvance: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onPageChange, onTimeAdvance }) => {
  const [gameState, setGameState] = useState(getGameState());
  const [currentPrestige, setCurrentPrestige] = useState(0);
  const [prestigeModalOpen, setPrestigeModalOpen] = useState(false);
  const [prestigeData, setPrestigeData] = useState({ totalPrestige: 0, eventBreakdown: [] });
  const consoleHook = useNotifications();
  const { subscribe } = useGameUpdates();

  // Update game state when onTimeAdvance is called
  useEffect(() => {
    setGameState(getGameState());
  }, [onTimeAdvance]);

  // Subscribe to game updates to refresh header data
  useEffect(() => {
    const unsubscribe = subscribe(async () => {
      setGameState(getGameState());
      // Update prestige when game state changes
      try {
        const prestige = await getCurrentPrestige();
        setCurrentPrestige(prestige);
      } catch (error) {
        console.error('Failed to update prestige:', error);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  // Load initial prestige and set up periodic refresh
  useEffect(() => {
    const loadInitialPrestige = async () => {
      try {
        const prestige = await getCurrentPrestige();
        setCurrentPrestige(prestige);
      } catch (error) {
        console.error('Failed to load initial prestige:', error);
      }
    };
    
    loadInitialPrestige();
    
    // Set up periodic prestige refresh every 2 seconds for more responsive updates
    const intervalId = setInterval(loadInitialPrestige, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleIncrementWeek = async () => {
    try {
      await processGameTick();
      setGameState(getGameState()); // Update local state immediately
      onTimeAdvance();
    } catch (error) {
      console.error('Error advancing time:', error);
    }
  };

  const handlePrestigeClick = async () => {
    try {
      const prestigeInfo = await calculateCurrentPrestige();
      setPrestigeData(prestigeInfo);
      setPrestigeModalOpen(true);
    } catch (error) {
      console.error('Error loading prestige data:', error);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: NAVIGATION_EMOJIS.dashboard },
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
              W{gameState.week} | {gameState.season} | {gameState.currentYear}
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
            <span className="font-medium">⭐ {currentPrestige.toFixed(1)}</span>
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
                  <AvatarFallback className="bg-red-600 text-white">WM</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                {(gameState as any).companyName || 'My Winery'}
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
              <DropdownMenuItem onClick={() => onPageChange('achievements')}>
                Achievements
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPageChange('winepedia')}>
                Wine-Pedia
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  // Clear local storage and reset game
                  localStorage.clear();
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
      />
    </header>
  );
};

export default Header;
