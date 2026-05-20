import React from 'react';
import { WineAnchorValues, WineCharacteristics } from '@/lib/types/types';
import { StructureIndexBreakdown } from '../../components/StructureIndexBreakdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../shadCN/dialog';
import { Button } from '../../shadCN/button';
import { DialogProps } from '@/lib/types/UItypes';

/**
 * Structure index breakdown modal
 */

interface StructureIndexBreakdownModalProps extends DialogProps {
  characteristics: WineCharacteristics;
  wineAnchors?: WineAnchorValues | null;
  wineName?: string;
}

export const StructureIndexBreakdownModal: React.FC<StructureIndexBreakdownModalProps> = ({
  isOpen,
  onClose,
  characteristics,
  wineAnchors = null,
  wineName = "Wine"
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto scrollbar-styled">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-semibold">
            Structure Index Breakdown - {wineName}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Detailed breakdown of wine structure index calculations and characteristics
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <StructureIndexBreakdown 
            characteristics={characteristics} 
            wineAnchors={wineAnchors}
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
