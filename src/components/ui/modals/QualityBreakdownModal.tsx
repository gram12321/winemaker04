import React from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { QualityFactorsBreakdown } from '../components/QualityFactorsBreakdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../shadCN/dialog';

interface QualityBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch?: WineBatch;
  vineyard?: Vineyard;
  wineName?: string;
}

export const QualityBreakdownModal: React.FC<QualityBreakdownModalProps> = ({
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
          <DialogTitle>Quality Analysis - {wineName}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of quality factors contributing to this wine's value and market positioning.
          </DialogDescription>
        </DialogHeader>

        {vineyard && (
          <QualityFactorsBreakdown
            vineyard={vineyard}
            wineBatch={batch}
            showFactorDetails={true}
          />
        )}

        {!vineyard && batch && (
          <div className="text-center py-8 text-gray-500">
            <p>Quality factors unavailable - vineyard data not found for this wine batch.</p>
          </div>
        )}

        {!vineyard && !batch && (
          <div className="text-center py-8 text-gray-500">
            <p>No data available for quality analysis.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
