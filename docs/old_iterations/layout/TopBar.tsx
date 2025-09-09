import { useState } from 'react';
import { getGameState } from '../../gameState';
import { Console, useConsole, consoleService } from '../ui/Console';
import { incrementWeek } from '@/lib/game/gameTick';
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, navigationMenuTriggerStyle } from "../../components/ui/navigation-menu";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { cn } from "@/lib/core/utils/utils";
import { MessageSquareText, CalendarDays } from 'lucide-react';
import { handleLogout } from '@/lib/database/gameStateDB';

interface TopBarProps {
  view: string;
  setView: (view: string) => void;
}

export default function TopBar({ view, setView }: TopBarProps) {
  const gameState = getGameState();
  const consoleHook = useConsole();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Handle week increment
  const handleIncrementWeek = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await incrementWeek();
    } catch (error) {
      console.error("Error incrementing week:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle UI aspects of logout
  const onLogout = async () => {
    // Call database function to handle state/storage
    await handleLogout();
    
    // Reset console messages in UI
    consoleService.clearMessages();
    
    // Navigate to login view
    setView('login');
  };
  
  return (
    <div className="w-full bg-wine text-white p-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <button onClick={() => setView('mainMenu')} className="text-xl font-bold">
            Winery Management
          </button>
          
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <button
                  onClick={() => setView('mainMenu')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'mainMenu' ? "bg-wine-dark" : ""
                  )}
                >
                  Main Menu
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('vineyard')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'vineyard' ? "bg-wine-dark" : ""
                  )}
                >
                  Vineyard
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('inventory')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'inventory' ? "bg-wine-dark" : ""
                  )}
                >
                  Inventory
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('staff')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'staff' ? "bg-wine-dark" : ""
                  )}
                >
                  Staff
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('buildings')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'buildings' ? "bg-wine-dark" : ""
                  )}
                >
                  Buildings
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('sales')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'sales' ? "bg-wine-dark" : ""
                  )}
                >
                  Sales
                </button>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <button
                  onClick={() => setView('finance')}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "bg-transparent hover:bg-wine-dark focus:bg-wine-dark",
                    view === 'finance' ? "bg-wine-dark" : ""
                  )}
                >
                  Finance
                </button>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
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
            disabled={isProcessing}
            variant="secondary" 
            size="sm"
            className="bg-wine-light hover:bg-wine-dark text-white border-wine-dark text-xs"
          >
            {isProcessing ? "Processing..." : "Increment Week"}
          </Button>
          
          <Badge variant="outline" className="bg-wine-light text-white border-wine-dark px-3 py-1 flex items-center">
            <span className="mr-1">€</span>
            <span className="font-medium">{gameState.player?.money?.toLocaleString() || 0}</span>
          </Badge>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => consoleHook.openHistory()}
            className="rounded-full h-10 w-10 flex items-center justify-center"
          >
            <MessageSquareText className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-1 rounded-full h-10 w-10">
                <Avatar>
                  <AvatarImage src="/assets/icon/winery-icon.png" alt="Winery" />
                  <AvatarFallback className="bg-wine-dark text-white">WM</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                {gameState.player?.companyName || 'My Winery'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView('profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('admin')}>
                Admin Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('achievements')}>
                Achievements
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('winepedia')}>
                Wine-Pedia
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onLogout}
                className="text-red-600 focus:text-red-500"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Message History Modal - controlled by Console component */}
      {consoleHook.isHistoryOpen && 
        <Console 
          showConsole={true} 
          isOpen={consoleHook.isHistoryOpen} 
          onClose={consoleHook.closeHistory} 
        />
      }
    </div>
  );
} 