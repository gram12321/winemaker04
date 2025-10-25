import React from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { GrapeQualityFactorsBreakdown } from '../../components/grapeQualityBreakdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../shadCN/dialog';
import { DialogProps } from '@/lib/types/UItypes';

interface GrapeQualityBreakdownModalProps extends DialogProps {
  batch?: WineBatch;
  vineyard?: Vineyard;
  wineName?: string;
}

export const GrapeQualityBreakdownModal: React.FC<GrapeQualityBreakdownModalProps> = ({
  isOpen,
  onClose,
  batch,
  vineyard,
  wineName = "Wine"
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grape Quality Analysis - {wineName}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of grape quality factors contributing to this wine's value and market positioning.
          </DialogDescription>
        </DialogHeader>

        {vineyard && (
          <GrapeQualityFactorsBreakdown
            vineyard={vineyard}
            wineBatch={batch}
            showFactorDetails={true}
          />
        )}

        {!vineyard && batch && (
          <div className="text-center py-8 text-gray-500">
            <p>Grape quality factors unavailable - vineyard data not found for this wine batch.</p>
          </div>
        )}

        {!vineyard && !batch && (
          <div className="text-center py-8 text-gray-500">
            <p>No data available for grape quality analysis.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
