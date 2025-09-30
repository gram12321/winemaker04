import React from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { BalanceScoreBreakdown } from '../components/BalanceScoreBreakdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../shadCN/dialog';
import { Button } from '../shadCN/button';

/**
 * Balance Breakdown Modal
 * Modal for displaying detailed wine balance score breakdown
 */

interface BalanceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  characteristics: WineCharacteristics;
  wineName?: string;
}

export const BalanceBreakdownModal: React.FC<BalanceBreakdownModalProps> = ({
  isOpen,
  onClose,
  characteristics,
  wineName = "Wine"
}) => {
  // Render
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Balance Score Breakdown - {wineName}
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown of wine balance score calculations and characteristics
          </DialogDescription>
        </DialogHeader>
        
                <div className="mt-4">
                  <BalanceScoreBreakdown 
                    characteristics={characteristics} 
                    showWineStyleRules={true}
                  />
                </div>
        
        <div className="flex justify-end mt-6">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
