import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks';
import { LandSearchResultsModal, StaffSearchResultsModal, LenderSearchResultsModal } from '@/components/ui';
import { clearPendingLandSearchResults, clearPendingCandidates, clearPendingLenderSearchResults } from '@/lib/services';
import { getMinimizedModals, restoreModal, isModalMinimized } from '@/lib/utils';

type ModalType = 'land' | 'staff' | 'lender' | 'loan';
import { Button } from '@/components/ui';
import { Maximize2 } from 'lucide-react';

/**
 * Global display for search result modals
 * Shows land search, staff search, and lender search results regardless of current page
 * Uses the existing game state system for reactivity
 */
export function GlobalSearchResultsDisplay() {
  const gameState = useGameState();
  const [showLandResults, setShowLandResults] = useState(false);
  const [showStaffResults, setShowStaffResults] = useState(false);
  const [showLenderResults, setShowLenderResults] = useState(false);
  const [minimizedModals, setMinimizedModals] = useState<ModalType[]>([]);

  // Track minimized modals and auto-show when restored
  useEffect(() => {
    let previousMinimized: ModalType[] = [];
    
    const checkMinimized = () => {
      const currentMinimized = getMinimizedModals();
      
      // Check if any modals were restored (were minimized, now not)
      const restoredModals = previousMinimized.filter(type => !currentMinimized.includes(type));
      
      // Auto-show restored modals
      restoredModals.forEach(type => {
        if (type === 'land' && gameState.pendingLandSearchResults?.options) {
          setShowLandResults(true);
        } else if (type === 'staff' && gameState.pendingStaffCandidates?.candidates) {
          setShowStaffResults(true);
        } else if (type === 'lender' && gameState.pendingLenderSearchResults?.offers?.length) {
          setShowLenderResults(true);
        }
      });
      
      previousMinimized = currentMinimized;
      setMinimizedModals(currentMinimized);
    };
    
    // Check periodically for minimized modals
    const interval = setInterval(checkMinimized, 100);
    checkMinimized();
    
    return () => clearInterval(interval);
  }, [gameState]);

  // Check for pending land search results
  useEffect(() => {
    if (gameState.pendingLandSearchResults?.options && !showLandResults) {
      setShowLandResults(true);
    }
  }, [gameState.pendingLandSearchResults, showLandResults]);

  // Check for pending staff search results
  useEffect(() => {
    if (gameState.pendingStaffCandidates?.candidates && !showStaffResults) {
      setShowStaffResults(true);
    }
  }, [gameState.pendingStaffCandidates, showStaffResults]);

  // Check for pending lender search results
  useEffect(() => {
    if (gameState.pendingLenderSearchResults?.offers && 
        gameState.pendingLenderSearchResults.offers.length > 0) {
      if (!showLenderResults) {
        setShowLenderResults(true);
      }
    } else if (!gameState.pendingLenderSearchResults && showLenderResults) {
      // Reset when results are cleared
      setShowLenderResults(false);
    }
  }, [gameState.pendingLenderSearchResults, showLenderResults]);

  const handleCloseLandResults = () => {
    setShowLandResults(false);
    clearPendingLandSearchResults();
  };

  const handleCloseStaffResults = () => {
    setShowStaffResults(false);
    clearPendingCandidates();
  };

  const handleCloseLenderResults = () => {
    setShowLenderResults(false);
    clearPendingLenderSearchResults();
  };

  const getModalTitle = (type: ModalType): string => {
    switch (type) {
      case 'land':
        return 'Land Search';
      case 'staff':
        return 'Staff Search';
      case 'lender':
        return 'Lender Search';
      case 'loan':
        return 'Loan Warning';
      default:
        return 'Search Results';
    }
  };

  const handleRestore = (type: ModalType) => {
    restoreModal(type);
    // Re-open the modal if it was minimized
    if (type === 'land' && gameState.pendingLandSearchResults?.options) {
      setShowLandResults(true);
    } else if (type === 'staff' && gameState.pendingStaffCandidates?.candidates) {
      setShowStaffResults(true);
    } else if (type === 'lender' && gameState.pendingLenderSearchResults?.offers?.length) {
      setShowLenderResults(true);
    }
  };

  return (
    <>
      {/* Land Search Results Modal */}
      {gameState.pendingLandSearchResults?.options && (
        <LandSearchResultsModal
          isOpen={showLandResults && !isModalMinimized('land')}
          onClose={handleCloseLandResults}
          options={gameState.pendingLandSearchResults.options}
        />
      )}

      {/* Staff Search Results Modal */}
      {gameState.pendingStaffCandidates?.candidates && (
        <StaffSearchResultsModal
          isOpen={showStaffResults && !isModalMinimized('staff')}
          onClose={handleCloseStaffResults}
          candidates={gameState.pendingStaffCandidates.candidates}
        />
      )}

      {/* Lender Search Results Modal */}
      {gameState.pendingLenderSearchResults?.offers && 
       gameState.pendingLenderSearchResults.offers.length > 0 && (
        <LenderSearchResultsModal
          isOpen={showLenderResults && !isModalMinimized('lender')}
          onClose={handleCloseLenderResults}
          offers={gameState.pendingLenderSearchResults.offers}
        />
      )}

      {/* Floating Restore Buttons for Minimized Modals */}
      {minimizedModals.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {minimizedModals.map((type) => (
            <Button
              key={type}
              onClick={() => handleRestore(type)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center gap-2"
              title={`Restore ${getModalTitle(type)}`}
            >
              <Maximize2 className="h-4 w-4" />
              <span>{getModalTitle(type)}</span>
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
