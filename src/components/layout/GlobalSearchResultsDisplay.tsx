import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks';
import { LandSearchResultsModal } from '@/components/ui/modals/activitymodals/LandSearchResultsModal';
import { StaffSearchResultsModal } from '@/components/ui/modals/activitymodals/StaffSearchResultsModal';
import { LenderSearchResultsModal } from '@/components/ui/modals/activitymodals/LenderSearchResultsModal';
import { clearPendingLandSearchResults, clearPendingCandidates, clearPendingLenderSearchResults } from '@/lib/services';

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
    if (gameState.pendingLenderSearchResults?.offers && !showLenderResults) {
      setShowLenderResults(true);
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

  return (
    <>
      {/* Land Search Results Modal */}
      {gameState.pendingLandSearchResults?.options && (
        <LandSearchResultsModal
          isOpen={showLandResults}
          onClose={handleCloseLandResults}
          options={gameState.pendingLandSearchResults.options}
        />
      )}

      {/* Staff Search Results Modal */}
      {gameState.pendingStaffCandidates?.candidates && (
        <StaffSearchResultsModal
          isOpen={showStaffResults}
          onClose={handleCloseStaffResults}
          candidates={gameState.pendingStaffCandidates.candidates}
        />
      )}

      {/* Lender Search Results Modal */}
      {gameState.pendingLenderSearchResults?.offers && (
        <LenderSearchResultsModal
          isOpen={showLenderResults}
          onClose={handleCloseLenderResults}
          offers={gameState.pendingLenderSearchResults.offers}
        />
      )}
    </>
  );
}
