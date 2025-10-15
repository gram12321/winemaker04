import React, { useState, useCallback } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { WineBatch } from '@/lib/types/types';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { loadWineOrders } from '@/lib/database/customers/salesDB';
import { WineModal } from '../ui';
import { NavigationProps } from '../../lib/types/UItypes';
import WineCellarTab from './sales/WineCellarTab';
import OrdersTab from './sales/OrdersTab';

interface SalesProps extends NavigationProps {
  // Inherits onNavigateToWinepedia from NavigationProps
}

const Sales: React.FC<SalesProps> = ({ onNavigateToWinepedia }) => {
  const { isLoading, withLoading } = useLoadingState();
  
  const [activeTab, setActiveTab] = useState<'cellar' | 'orders'>('cellar');
  const [showSoldOut, setShowSoldOut] = useState<boolean>(false);

  // Wine modal state
  const [wineModalOpen, setWineModalOpen] = useState(false);
  const [selectedWineBatch, setSelectedWineBatch] = useState<WineBatch | null>(null);

  // Use consolidated hooks for reactive data loading
  const allOrders = useGameStateWithData(
    () => loadWineOrders(),
    []
  );

  const allBatches = useGameStateWithData(
    () => loadWineBatches(),
    []
  );


  // Memoize filtered bottled wines
  const bottledWines = React.useMemo(() => 
    allBatches.filter(batch => 
      batch.state === 'bottled' && (showSoldOut || batch.quantity > 0)
    ),
    [allBatches, showSoldOut]
  );

  // Handle opening wine modal
  const handleWineDetailsClick = useCallback((batchId: string) => {
    const batch = allBatches.find(b => b.id === batchId);
    if (batch) {
      setSelectedWineBatch(batch);
      setWineModalOpen(true);
    }
  }, [allBatches]);

  // Handle closing wine modal
  const handleWineModalClose = useCallback(() => {
    setWineModalOpen(false);
    setSelectedWineBatch(null);
  }, []);

  return (
    <div className="space-y-3 text-sm">
      {/* Page Hero */}
      <div 
        className="h-28 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1510076857177-7470076d4098?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-2.5">
          <h3 className="text-white text-sm font-semibold">
            {activeTab === 'cellar' ? 'Wine Cellar Inventory' : 'Pending Orders'}
          </h3>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-800">Sales</h2>
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1 text-xs">
        <button 
          onClick={() => setActiveTab('cellar')}
          className={`px-3 py-1.5 rounded ${
            activeTab === 'cellar' 
              ? 'bg-amber-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Wine Cellar
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-3 py-1.5 rounded ${
            activeTab === 'orders' 
              ? 'bg-amber-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Orders ({allOrders.filter(o => o.status === 'pending').length})
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'cellar' && (
        <WineCellarTab
          bottledWines={bottledWines}
          showSoldOut={showSoldOut}
          setShowSoldOut={setShowSoldOut}
          onWineDetailsClick={handleWineDetailsClick}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab
          allOrders={allOrders}
          allBatches={allBatches}
          bottledWines={bottledWines}
          isLoading={isLoading}
          withLoading={withLoading as any}
          onNavigateToWinepedia={onNavigateToWinepedia}
        />
      )}

      {/* Wine Modal */}
      <WineModal
        isOpen={wineModalOpen}
        onClose={handleWineModalClose}
        wineBatch={selectedWineBatch}
        wineName={selectedWineBatch ? `${selectedWineBatch.grape} - ${selectedWineBatch.vineyardName}` : "Wine"}
      />
    </div>
  );
};

export default Sales;