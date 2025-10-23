import React, { useState, useEffect } from 'react';
import { LoanOffer } from '@/lib/types/types';
import { formatCurrency, formatPercent, getLenderTypeColorClass } from '@/lib/utils';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { X } from 'lucide-react';
import { startTakeLoan } from '@/lib/services';
import { WarningModal } from '@/components/ui/modals/UImodals/WarningModal';
import { LoanApplicationModal } from '@/components/ui/modals/LoanApplicationModal';

interface LenderSearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offers: LoanOffer[];
}

/**
 * Modal displaying lender search results
 * Shows loan offers with option to accept as-is or adjust terms
 */
export const LenderSearchResultsModal: React.FC<LenderSearchResultsModalProps> = ({
  isOpen,
  onClose,
  offers
}) => {
  // Track which offers have been accepted (by ID)
  const [acceptedOfferIds, setAcceptedOfferIds] = useState<Set<string>>(new Set());
  // Track which offer is selected for preview
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  // Track if adjustment modal is open
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  
  // Filter out offers that have already been accepted
  const availableOffers = offers?.filter(o => !acceptedOfferIds.has(o.id)) || [];
  
  // Auto-select first available offer when modal opens or when offers change
  useEffect(() => {
    if (availableOffers.length > 0 && !selectedOfferId) {
      setSelectedOfferId(availableOffers[0].id);
    } else if (availableOffers.length > 0 && selectedOfferId && !availableOffers.find(o => o.id === selectedOfferId)) {
      // If currently selected offer was accepted, select the first available one
      setSelectedOfferId(availableOffers[0].id);
    } else if (availableOffers.length === 0) {
      // No offers available, clear selection
      setSelectedOfferId(null);
    }
  }, [availableOffers, selectedOfferId]);

  if (!isOpen || !offers || offers.length === 0) return null;

  const handleAcceptAsIs = async (offer: LoanOffer) => {
    // Accept offer without adjustments (base work)
    const success = await startTakeLoan(offer, false);
    if (success) {
      // Mark this offer as accepted (remove from available list)
      setAcceptedOfferIds(prev => new Set([...prev, offer.id]));
    }
  };

  const handleAdjustOffer = (offer: LoanOffer) => {
    // Open adjustment modal for this offer
    setSelectedOfferId(offer.id);
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustedOfferAccept = async (offer: LoanOffer) => {
    // Accept adjusted offer (increased work penalty)
    const success = await startTakeLoan(offer, true);
    if (success) {
      // Mark this offer as accepted and close adjustment modal
      setAcceptedOfferIds(prev => new Set([...prev, offer.id]));
      setIsAdjustmentModalOpen(false);
    }
  };

  const handleClose = () => {
    setAcceptedOfferIds(new Set()); // Reset accepted list
    setSelectedOfferId(null); // Reset selected offer
    setIsAdjustmentModalOpen(false);
    onClose();
  };

  const handleOfferSelect = (offerId: string) => {
    setSelectedOfferId(offerId);
  };

  // Get the selected offer for preview
  const selectedOffer = selectedOfferId 
    ? offers.find(o => o.id === selectedOfferId)
    : null;

  // If all offers have been accepted, show completion message
  if (availableOffers.length === 0 && acceptedOfferIds.size > 0) {
    return (
      <WarningModal
        isOpen={true}
        onClose={handleClose}
        severity="info"
        title="All Offers Processed!"
        message={`You've processed all ${acceptedOfferIds.size} loan offer${acceptedOfferIds.size !== 1 ? 's' : ''} from this search.`}
        actions={[
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'default'
          }
        ]}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">Lender Search Results</h2>
              <p className="text-sm text-gray-400 mt-1">
                {availableOffers.length} offer{availableOffers.length !== 1 ? 's' : ''} available
                {acceptedOfferIds.size > 0 && ` (${acceptedOfferIds.size} already processed)`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column - Offer List */}
            <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Available Offers</h3>
                <div className="space-y-3">
                  {availableOffers.map((offer) => {
                    const isSelected = selectedOfferId === offer.id;
                    
                    return (
                      <div 
                        key={offer.id} 
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-600 border-blue-500' 
                            : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                        } ${!offer.isAvailable ? 'opacity-60' : ''}`}
                        onClick={() => offer.isAvailable && handleOfferSelect(offer.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-white text-sm">{offer.lender.name}</span>
                              <Badge className={getLenderTypeColorClass(offer.lender.type)}>
                                {offer.lender.type}
                              </Badge>
                            </div>

                            {/* Compact details: Amount / Duration / Rate */}
                            <div className="grid grid-cols-2 gap-y-1 text-xs">
                              <div className="text-gray-400">Amount:</div>
                              <div className="text-white font-medium">{formatCurrency(offer.principalAmount)}</div>

                              <div className="text-gray-400">Duration:</div>
                              <div className="text-white">{Math.round(offer.durationSeasons / 4)} years</div>

                              <div className="text-gray-400">Interest Rate:</div>
                              <div className="text-white">{formatPercent(offer.effectiveInterestRate)}</div>

                              <div className="text-gray-400">Total Cost:</div>
                              <div className={`${offer.isAvailable ? 'text-green-400' : 'text-red-400'} font-medium`}>
                                {formatCurrency(offer.totalExpenses)}
                              </div>
                            </div>

                            {!offer.isAvailable && (
                              <div className="text-[10px] text-red-400 mt-1">{offer.unavailableReason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Offer Preview */}
            <div className="w-1/2 overflow-y-auto">
              {selectedOffer ? (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Offer Preview</h3>
                  
                  <div className="space-y-6">
                    {/* Lender Information */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-4">Lender Information</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Lender:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{selectedOffer.lender.name}</span>
                            <Badge className={getLenderTypeColorClass(selectedOffer.lender.type)}>
                              {selectedOffer.lender.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Loan Terms */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-4">Loan Terms</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Principal Amount:</span>
                          <span className="text-white font-medium">{formatCurrency(selectedOffer.principalAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white">{Math.round(selectedOffer.durationSeasons / 4)} years ({selectedOffer.durationSeasons} seasons)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Interest Rate:</span>
                          <span className="text-white">{formatPercent(selectedOffer.effectiveInterestRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Seasonal Payment:</span>
                          <span className="text-white">{formatCurrency(selectedOffer.seasonalPayment)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-4">Cost Breakdown</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Origination Fee:</span>
                          <span className="text-orange-400 font-medium">{formatCurrency(selectedOffer.originationFee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Interest:</span>
                          <span className="text-yellow-400">{formatCurrency(selectedOffer.totalInterest)}</span>
                        </div>
                        <div className="border-t border-gray-600 pt-2 flex justify-between">
                          <span className="text-white font-medium">Total Expenses:</span>
                          <span className="text-red-400 font-bold">{formatCurrency(selectedOffer.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {selectedOffer.isAvailable ? (
                      <div className="space-y-3">
                        <Button
                          onClick={() => handleAcceptAsIs(selectedOffer)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          Accept As-Is (Base Work)
                        </Button>
                        <Button
                          onClick={() => handleAdjustOffer(selectedOffer)}
                          variant="outline"
                          className="w-full"
                        >
                          Adjust Terms (+50% Work Penalty)
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">
                          <strong>Not Available:</strong> {selectedOffer.unavailableReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="text-lg mb-2">Select an offer</div>
                    <div className="text-sm">Choose an offer from the list to view details</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              <span className="font-medium text-white">{availableOffers.length}</span> offer{availableOffers.length !== 1 ? 's' : ''} remaining
            </div>
            <Button
              variant="outline"
              onClick={handleClose}
              className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Loan Adjustment Modal */}
      {isAdjustmentModalOpen && selectedOffer && (
        <LoanApplicationModal
          lender={selectedOffer.lender}
          isOpen={isAdjustmentModalOpen}
          onClose={() => setIsAdjustmentModalOpen(false)}
          onComplete={() => {
            handleAdjustedOfferAccept(selectedOffer);
          }}
          isActivityMode={true}
        />
      )}
    </>
  );
};

