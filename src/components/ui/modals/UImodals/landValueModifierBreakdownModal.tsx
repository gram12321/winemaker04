import React from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { LandValueModifierFactorsBreakdown } from '../../components/landValueModifierBreakdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../shadCN/dialog';
import { DialogProps } from '@/lib/types/UItypes';

interface LandValueModifierBreakdownModalProps extends DialogProps {
  batch?: WineBatch;
  vineyard?: Vineyard;
  wineName?: string;
}

export const LandValueModifierBreakdownModal: React.FC<LandValueModifierBreakdownModalProps> = ({
  isOpen,
  onClose,
  batch,
  vineyard,
  wineName = "Wine"
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-styled">
        <DialogHeader>
          <DialogTitle>Land Value Modifier Analysis - {wineName}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of land-value modifier factors contributing to this wine's value and market positioning.
          </DialogDescription>
        </DialogHeader>

        {vineyard && (
          <LandValueModifierFactorsBreakdown
            vineyard={vineyard}
            wineBatch={batch}
            showFactorDetails={true}
          />
        )}

        {!vineyard && batch && (
          <div className="text-center py-8 text-gray-500">
            <p>Land-value modifier factors unavailable - vineyard data not found for this wine batch.</p>
          </div>
        )}

        {!vineyard && !batch && (
          <div className="text-center py-8 text-gray-500">
            <p>No data available for land-value modifier analysis.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

