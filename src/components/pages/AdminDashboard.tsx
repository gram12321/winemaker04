import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notificationService } from '../layout/NotificationCenter';
import { addTransaction } from '@/lib/services/financeService';
import { getGameState, updateGameState } from '@/lib/gameState';
import { initializeCustomers } from '@/lib/services/sales/createCustomer';

interface AdminDashboardProps {
  view?: string;
}

export default function AdminDashboard({ view }: AdminDashboardProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState<{
    clearStorage: boolean;
    clearSupabase: boolean;
    addMoney: boolean;
    addPrestige: boolean;
    reinitializeCustomers: boolean;
  }>({
    clearStorage: false,
    clearSupabase: false,
    addMoney: false,
    addPrestige: false,
    reinitializeCustomers: false,
  });

  if (view && view !== 'admin') return null;

  const clearLocalStorage = async () => {
    try {
      setIsLoading(prev => ({ ...prev, clearStorage: true }));
      
      // Clear all game-related data from localStorage
      const keysToRemove = ['gameState', 'notifications', 'showNotifications'];
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Clear messages from the notification service
      notificationService.clearMessages();
      
      setMessage({ type: 'success', text: 'Local storage and notifications cleared successfully.' });
      notificationService.success('Local storage and notifications cleared');
    } catch (error) {
      console.error('Error clearing local storage:', error);
      setMessage({ type: 'error', text: 'Error clearing local storage.' });
      notificationService.error('Failed to clear local storage');
    } finally {
      setIsLoading(prev => ({ ...prev, clearStorage: false }));
    }
  };

  const clearSupabaseData = async () => {
    if (!confirm('Are you sure you want to delete all data from Supabase? This will remove ALL game data and cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, clearSupabase: true }));
      
      // Define the actual tables that exist in our Supabase database
      const gameTables = [
        'vineyards',
        'game_state',
        'wine_batches', 
        'wine_orders',
        'transactions'
      ];

      // Clear each known table
      const clearPromises = gameTables.map(async (tableName) => {
        try {
          // Use different delete strategies based on table structure
          let deleteQuery;
          if (tableName === 'vineyards' || tableName === 'transactions') {
            // For UUID tables, use a valid UUID that won't exist
            deleteQuery = supabase
              .from(tableName)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            // For text ID tables, use a string that won't exist
            deleteQuery = supabase
              .from(tableName)
              .delete()
              .neq('id', 'impossible-id');
          }
          
          const { error } = await deleteQuery;
          
          if (error) {
            console.error(`Failed to clear table ${tableName}:`, error);
            return { success: false, table: tableName, error: error.message };
          }
          
          return { success: true, table: tableName };
        } catch (err) {
          console.error(`Error clearing table ${tableName}:`, err);
          return { success: false, table: tableName, error: String(err) };
        }
      });

      const results = await Promise.all(clearPromises);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      if (failed.length === 0) {
        setMessage({ type: 'success', text: `Successfully cleared ${successful.length} tables from Supabase.` });
        notificationService.success(`Cleared ${successful.length} Supabase tables`);
      } else {
        setMessage({ 
          type: 'error', 
          text: `Cleared ${successful.length} tables, but ${failed.length} failed. Check console for details.` 
        });
        notificationService.warning(`Partially cleared Supabase: ${successful.length} success, ${failed.length} failed`);
        console.log('Failed tables:', failed);
      }
    } catch (error) {
      console.error('Error clearing Supabase:', error);
      setMessage({ type: 'error', text: `Error clearing Supabase data: ${error}` });
      notificationService.error('Failed to clear Supabase data');
    } finally {
      setIsLoading(prev => ({ ...prev, clearSupabase: false }));
    }
  };

  const handleAddMoney = async () => {
    try {
      setIsLoading(prev => ({ ...prev, addMoney: true }));
      
      // Add €1,000,000 through the finance system
      await addTransaction(
        1000000,
        'Admin: Capital Injection',
        'Capital'
      );

      setMessage({ type: 'success', text: 'Added €1,000,000 to treasury successfully.' });
      notificationService.success('Added €1,000,000 to treasury');
    } catch (error) {
      console.error('Error adding money:', error);
      setMessage({ type: 'error', text: `Error adding money: ${error}` });
      notificationService.error('Failed to add money');
    } finally {
      setIsLoading(prev => ({ ...prev, addMoney: false }));
    }
  };

  const handleAddPrestige = async () => {
    try {
      setIsLoading(prev => ({ ...prev, addPrestige: true }));
      
      // Get current game state and increase prestige by 100
      const currentState = getGameState();
      const newPrestige = (currentState.prestige || 0) + 100;
      
      // Update game state with new prestige value
      updateGameState({ prestige: newPrestige });

      setMessage({ type: 'success', text: `Added +100 prestige. New prestige: ${newPrestige}` });
      notificationService.success(`Added +100 prestige (Total: ${newPrestige})`);
    } catch (error) {
      console.error('Error adding prestige:', error);
      setMessage({ type: 'error', text: `Error adding prestige: ${error}` });
      notificationService.error('Failed to add prestige');
    } finally {
      setIsLoading(prev => ({ ...prev, addPrestige: false }));
    }
  };

  const handleReinitializeCustomers = async () => {
    if (!confirm('Are you sure you want to clear all customers and regenerate them? This will delete all existing customer data and create new customers based on current prestige.')) {
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, reinitializeCustomers: true }));
      
      // Get current game state for prestige
      const currentState = getGameState();
      const currentPrestige = currentState.prestige || 1;
      
      // Clear existing customers and reinitialize
      await initializeCustomers(currentPrestige);

      setMessage({ type: 'success', text: `Successfully reinitialized customers with prestige ${currentPrestige}.` });
      notificationService.success('Customers reinitialized successfully');
    } catch (error) {
      console.error('Error reinitializing customers:', error);
      setMessage({ type: 'error', text: `Error reinitializing customers: ${error}` });
      notificationService.error('Failed to reinitialize customers');
    } finally {
      setIsLoading(prev => ({ ...prev, reinitializeCustomers: false }));
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'error' 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            <div>
              <h4 className="font-medium">{message.type === 'error' ? 'Error' : 'Success'}</h4>
              <p className="text-sm">{message.text}</p>
            </div>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Game Data Management</CardTitle>
          <CardDescription>
            Advanced options for managing game data. Use with caution!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Local Storage</h3>
            <p className="text-sm text-gray-500">
              Clear all locally stored game data from this browser. This action cannot be undone.
            </p>
            <Button 
              variant="destructive" 
              onClick={clearLocalStorage} 
              disabled={isLoading.clearStorage}
            >
              {isLoading.clearStorage ? 'Clearing...' : 'Clear Local Storage'}
            </Button>
          </div>
          
          <hr className="my-4" />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Supabase Database</h3>
            <p className="text-sm text-gray-500">
              Delete all game data from the Supabase database. This affects all users and cannot be undone.
            </p>
            <Button 
              variant="destructive" 
              onClick={clearSupabaseData}
              disabled={isLoading.clearSupabase}
            >
              {isLoading.clearSupabase ? 'Clearing...' : 'Clear Supabase Data'}
            </Button>
          </div>
          
          <hr className="my-4" />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Financial Management</h3>
            <p className="text-sm text-gray-500">
              Add money to the treasury through the finance system.
            </p>
            <Button 
              variant="default" 
              onClick={handleAddMoney}
              disabled={isLoading.addMoney}
            >
              {isLoading.addMoney ? 'Adding...' : 'Add €1,000,000'}
            </Button>
          </div>
          
          <hr className="my-4" />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Company Prestige</h3>
            <p className="text-sm text-gray-500">
              Increase company prestige by +100. Higher prestige affects order generation and customer behavior.
            </p>
            <Button 
              variant="default" 
              onClick={handleAddPrestige}
              disabled={isLoading.addPrestige}
            >
              {isLoading.addPrestige ? 'Adding...' : 'Add +100 Prestige'}
            </Button>
          </div>
          
          <hr className="my-4" />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Customer Management</h3>
            <p className="text-sm text-gray-500">
              Clear all existing customers and regenerate them with the new market share distribution system. Uses current company prestige for relationship calculations.
            </p>
            <Button 
              variant="default" 
              onClick={handleReinitializeCustomers}
              disabled={isLoading.reinitializeCustomers}
            >
              {isLoading.reinitializeCustomers ? 'Reinitializing...' : 'Reinitialize Customers'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
