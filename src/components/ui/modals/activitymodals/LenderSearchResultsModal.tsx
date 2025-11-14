import React, { useState, useEffect } from 'react';
import { LoanOffer } from '@/lib/types/types';
import { formatNumber, formatPercent, getLenderTypeColorClass, setModalMinimized } from '@/lib/utils';
import { Button, Label, Slider, Badge, Separator } from '@/components/ui';
import { X, Minimize2 } from 'lucide-react';
import { startTakeLoan, getGameState, calculateLoanTerms } from '@/lib/services';
import { calculateTakeLoanWork } from '@/lib/services/activity/workcalculators/takeLoanWorkCalculator';
import { WarningModal } from '@/components/ui';
import { getScaledLoanAmountLimit } from '@/lib/services/finance/loanService';
import { calculateTotalAssets } from '@/lib/services/finance/financeService';

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
  // Track if modal is minimized
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Loan parameter state for third column
  const [loanAmount, setLoanAmount] = useState(50000);
  const [durationSeasons, setDurationSeasons] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loanAmountCap, setLoanAmountCap] = useState<number | null>(null);
  
  // Update loan parameters when selected offer changes
  useEffect(() => {
    if (selectedOfferId) {
      const offer = offers.find(o => o.id === selectedOfferId);
      if (offer) {
        setLoanAmount(offer.principalAmount);
        setDurationSeasons(offer.durationSeasons);
      }
    }
  }, [selectedOfferId, offers]);
  
  // Get game state for calculations
  const gameState = getGameState();
  
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

  // Loan calculations for third column
  const selectedOffer = selectedOfferId 
    ? offers.find(o => o.id === selectedOfferId)
    : null;

  // Resolve borrower-specific cap for the selected lender
  useEffect(() => {
    let isMounted = true;

    async function resolveLoanCap() {
      if (!selectedOffer) {
        if (isMounted) {
          setLoanAmountCap(null);
        }
        return;
      }

      try {
        const totalAssets = await calculateTotalAssets();
        const limitInfo = await getScaledLoanAmountLimit(
          selectedOffer.lender,
          gameState.creditRating ?? 0.5,
          { totalAssets }
        );
        if (!isMounted) return;

        const cap = Math.min(limitInfo.maxAllowed, selectedOffer.lender.maxLoanAmount);
        setLoanAmountCap(cap);
        setLoanAmount(prev => Math.min(prev, cap));
      } catch (capError) {
        if (!isMounted) return;
        console.error('Unable to resolve loan cap for selected offer:', capError);
        setLoanAmountCap(selectedOffer.lender.maxLoanAmount);
      }
    }

    resolveLoanCap();

    return () => {
      isMounted = false;
    };
  }, [selectedOffer, gameState.creditRating]);

  if (!isOpen || !offers || offers.length === 0) return null;

  const loanTerms = selectedOffer ? calculateLoanTerms(
    selectedOffer.lender,
    loanAmount,
    durationSeasons,
    gameState.creditRating || 0.5,
    gameState.economyPhase || 'Stable'
  ) : {
    effectiveInterestRate: 0,
    seasonalPayment: 0,
    totalRepayment: 0,
    totalInterest: 0,
    originationFee: 0,
    totalExpenses: 0
  };

  const {
    effectiveInterestRate: effectiveRate,
    seasonalPayment,
    totalInterest,
    originationFee,
    totalExpenses
  } = loanTerms;

  // Calculate work based on adjustments from original offer
  const workCalculation = selectedOffer ? calculateTakeLoanWork(
    selectedOffer,
    loanAmount,
    durationSeasons
  ) : { totalWork: 0, factors: [] };

  const handleApplyForLoan = async () => {
    if (!selectedOffer) return;
    
    try {
      setIsSubmitting(true);
      setError(null);

      const { v4: uuidv4 } = await import('uuid');
      
      const loanOffer = {
        id: uuidv4(),
        lender: selectedOffer.lender,
        principalAmount: loanAmount,
        durationSeasons,
        effectiveInterestRate: effectiveRate,
        seasonalPayment,
        originationFee,
        totalInterest,
        totalExpenses,
        isAvailable: true
      };
      
      const success = await startTakeLoan(loanOffer, true, loanAmount, durationSeasons); // true = adjusted (work penalty)
      if (success) {
        // Close modal after successful loan application
        handleClose();
      }
    } catch (error) {
      console.error('Error applying for loan:', error);
      setError('Failed to apply for loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setModalMinimized('lender', true, handleRestore);
  };

  const handleRestore = () => {
    setIsMinimized(false);
    setModalMinimized('lender', false);
  };

  const handleClose = () => {
    setAcceptedOfferIds(new Set()); // Reset accepted list
    setSelectedOfferId(null); // Reset selected offer
    setError(null); // Reset error
    setIsMinimized(false); // Reset minimized state
    setModalMinimized('lender', false); // Clear from global state
    onClose();
  };

  const handleOfferSelect = (offerId: string) => {
    setSelectedOfferId(offerId);
  };


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

  // If minimized, don't render the modal (will be handled by restore button in GlobalSearchResultsDisplay)
  if (isMinimized) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col scrollbar-styled">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">Lender Search Results</h2>
              <p className="text-sm text-gray-400 mt-1">
                {availableOffers.length} offer{availableOffers.length !== 1 ? 's' : ''} available
                {acceptedOfferIds.size > 0 && ` (${acceptedOfferIds.size} already processed)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMinimize}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                title="Minimize"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column - Offer List */}
            <div className="w-1/3 border-r border-gray-700 overflow-y-auto scrollbar-styled">
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
                              <div className="text-white font-medium">{formatNumber(offer.principalAmount, { currency: true })}</div>

                              <div className="text-gray-400">Duration:</div>
                              <div className="text-white">{formatNumber(offer.durationSeasons / 4, { smartDecimals: true })} years</div>

                              <div className="text-gray-400">Interest Rate:</div>
                              <div className="text-white">{formatPercent(offer.effectiveInterestRate)}</div>

                              <div className="text-gray-400">Total Cost:</div>
                              <div className={`${offer.isAvailable ? 'text-green-400' : 'text-red-400'} font-medium`}>
                                {formatNumber(offer.totalExpenses, { currency: true })}
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

            {/* Middle Column - Apply for Loan */}
            <div className="w-1/3 border-r border-gray-700 overflow-y-auto scrollbar-styled">
              {selectedOffer && selectedOffer.isAvailable ? (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Apply for Loan</h3>
                  
                  <div className="space-y-6">
                    {/* Lender Information */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-white">{selectedOffer.lender.name}</h4>
                        <Badge className={getLenderTypeColorClass(selectedOffer.lender.type)}>
                          {selectedOffer.lender.type}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Base Interest Rate:</span>
                          <span className="text-white font-medium">{formatPercent(selectedOffer.lender.baseInterestRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Risk Tolerance:</span>
                          <span className="text-white font-medium">{formatNumber(selectedOffer.lender.riskTolerance * 100, { smartDecimals: true })}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Loan Parameters */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-medium text-white">Loan Amount</Label>
                        <div className="mt-2 space-y-2">
                          <Slider
                            value={[loanAmount]}
                            onValueChange={(value) => setLoanAmount(value[0])}
                            min={selectedOffer.lender.minLoanAmount}
                            max={loanAmountCap ?? selectedOffer.lender.maxLoanAmount}
                            step={1000}
                            className="w-full"
                          />
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>{formatNumber(selectedOffer.lender.minLoanAmount, { currency: true })}</span>
                            <span className="font-medium text-white">{formatNumber(loanAmount, { currency: true })}</span>
                            <span>
                              {loanAmountCap && loanAmountCap < selectedOffer.lender.maxLoanAmount
                                ? `${formatNumber(loanAmountCap, { currency: true })} cap`
                                : formatNumber(selectedOffer.lender.maxLoanAmount, { currency: true })}
                            </span>
                          </div>
                          {loanAmountCap && loanAmountCap < selectedOffer.lender.maxLoanAmount && (
                            <p className="text-xs text-amber-400">
                              Limited by company borrowing capacity to {formatNumber(loanAmountCap, { currency: true })}.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-base font-medium text-white">Duration (Years)</Label>
                        <div className="mt-2 space-y-2">
                          <Slider
                            value={[durationSeasons]}
                            onValueChange={(value) => setDurationSeasons(value[0])}
                            min={selectedOffer.lender.minDurationSeasons}
                            max={selectedOffer.lender.maxDurationSeasons}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>{formatNumber(selectedOffer.lender.minDurationSeasons / 4, { smartDecimals: true })} years</span>
                            <span className="font-medium text-white">{formatNumber(durationSeasons / 4, { smartDecimals: true })} years</span>
                            <span>{formatNumber(selectedOffer.lender.maxDurationSeasons / 4, { smartDecimals: true })} years</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-gray-700" />

                    {/* Error Display */}
                    {error && (
                      <div className="p-3 bg-red-900 border border-red-700 rounded-lg">
                        <p className="text-red-200 text-sm">{error}</p>
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

            {/* Right Column - Offer Preview */}
            <div className="w-1/3 overflow-y-auto scrollbar-styled">
              {selectedOffer ? (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Offer Preview</h3>
                  
                  <div className="space-y-6">
                    {/* Loan Terms */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-4">Loan Terms</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Principal Amount:</span>
                          <span className="text-white font-medium">{formatNumber(loanAmount, { currency: true })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white">{formatNumber(durationSeasons / 4, { smartDecimals: true })} years ({durationSeasons} seasons)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Interest Rate:</span>
                          <span className="text-white">{formatPercent(effectiveRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Seasonal Payment:</span>
                          <span className="text-white">{formatNumber(seasonalPayment, { currency: true })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-4">Cost Breakdown</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Origination Fee:</span>
                          <span className="text-orange-400 font-medium">{formatNumber(originationFee, { currency: true })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Interest:</span>
                          <span className="text-yellow-400">{formatNumber(totalInterest, { currency: true })}</span>
                        </div>
                        <div className="border-t border-gray-600 pt-2 flex justify-between">
                          <span className="text-white font-medium">Total Expenses:</span>
                          <span className="text-red-400 font-bold">{formatNumber(totalExpenses, { currency: true })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Work Information */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-white mb-3">Work Required</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Work:</span>
                          <span className="text-white font-medium">{formatNumber(workCalculation.totalWork, { smartDecimals: true })} work units</span>
                        </div>
                        {workCalculation.factors.length > 3 && (
                          <div className="text-xs text-gray-500">
                            Includes adjustment complexity for parameter changes
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="space-y-3">
                      <Button
                        onClick={handleApplyForLoan}
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isSubmitting ? 'Processing...' : `Apply for Loan (${formatNumber(workCalculation.totalWork, { smartDecimals: true })} work)`}
                      </Button>
                    </div>
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleMinimize}
                className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600 flex items-center gap-2"
              >
                <Minimize2 className="h-4 w-4" />
                Minimize
              </Button>
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
      </div>

    </>
  );
};

