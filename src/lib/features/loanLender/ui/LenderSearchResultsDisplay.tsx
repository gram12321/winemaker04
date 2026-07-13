import { useEffect, useState } from 'react';
import { useGameState } from '@/hooks';
import { isModalMinimized } from '@/lib/utils';
import { LenderSearchResultsModal } from './LenderSearchResultsModal';

export function LenderSearchResultsDisplay() {
  const gameState = useGameState();
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (gameState.pendingLenderSearchResults?.offers?.length) {
      setShowResults(true);
      return;
    }

    setShowResults(false);
  }, [gameState.pendingLenderSearchResults]);

  const handleClose = () => {
    setShowResults(false);
  };

  if (!gameState.pendingLenderSearchResults?.offers?.length) {
    return null;
  }

  return (
    <LenderSearchResultsModal
      isOpen={showResults && !isModalMinimized('lender')}
      onClose={handleClose}
      offers={gameState.pendingLenderSearchResults.offers}
    />
  );
}
