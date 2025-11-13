import React, { useState, useEffect } from 'react';
import { LenderSearchOptions, LenderType, Lender } from '@/lib/types/types';
import { formatNumber, formatPercent, getLenderTypeColorClass } from '@/lib/utils';
import { Button, Label, Slider, Card, CardContent, CardHeader, CardTitle, Badge, Separator } from '@/components/ui';
import { X } from 'lucide-react';
import { getGameState, calculateLoanTerms } from '@/lib/services';
import { calculateLenderSearchCost, calculateLenderSearchWork } from '@/lib/services';
import { LOAN_AMOUNT_RANGES, LOAN_DURATION_RANGES, LENDER_TYPE_DISTRIBUTION } from '@/lib/constants/loanConstants';
import { getScaledLoanAmountLimit, getCurrentCreditRating } from '@/lib/services/finance/loanService';
import { calculateTotalAssets } from '@/lib/services/finance/financeService';
import { loadLenders } from '@/lib/database/core/lendersDB';
import * as SliderPrimitive from '@radix-ui/react-slider';

interface LenderSearchOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchStarted?: () => void;
  selectedLender?: Lender; // Optional: if provided, show loan parameter configuration
}

const LENDER_TYPES = Object.keys(LENDER_TYPE_DISTRIBUTION) as LenderType[];

// Dual slider component for range selection
const DualSlider: React.FC<{
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  onChange: (value: [number, number]) => void;
}> = ({ value, min, max, step = 1, onChange }) => {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(v) => onChange([v[0] as number, v[1] as number])}
      className="relative flex items-center select-none touch-none w-full h-6"
    >
      <SliderPrimitive.Track className="bg-gray-700 relative grow rounded-full h-2">
        <SliderPrimitive.Range className="absolute bg-blue-500 rounded-full h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </SliderPrimitive.Root>
  );
};

export const LenderSearchOptionsModal: React.FC<LenderSearchOptionsModalProps> = ({
  isOpen,
  onClose,
  onSearchStarted,
  selectedLender
}) => {
  const [options, setOptions] = useState<LenderSearchOptions>({
    numberOfOffers: 10,
    lenderTypes: LENDER_TYPES, // All types selected by default
    loanAmountRange: [LOAN_AMOUNT_RANGES.MIN, LOAN_AMOUNT_RANGES.MAX],
    durationRange: [LOAN_DURATION_RANGES.MIN, LOAN_DURATION_RANGES.MAX],
    searchCost: 0,
    searchWork: 0
  });

  // Dynamic max loan amount based on credit rating and assets
  const [maxAllowedLoanAmount, setMaxAllowedLoanAmount] = useState<number>(LOAN_AMOUNT_RANGES.MAX);
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Sync local state with options
  const [loanAmountRange, setLoanAmountRange] = useState<[number, number]>([LOAN_AMOUNT_RANGES.MIN, LOAN_AMOUNT_RANGES.MAX]);
  const [durationRange, setDurationRange] = useState<[number, number]>([LOAN_DURATION_RANGES.MIN, LOAN_DURATION_RANGES.MAX]);

  // Loan parameter state (when selectedLender is provided)
  const [loanAmount, setLoanAmount] = useState(selectedLender?.minLoanAmount || 50000);
  const [durationSeasons, setDurationSeasons] = useState(selectedLender?.minDurationSeasons || 8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview calculations for search
  const [previewStats, setPreviewStats] = useState<{
    totalCost: number;
    totalWork: number;
  }>({
    totalCost: 0,
    totalWork: 0
  });

  // Get company for calculations
  const gameState = getGameState();

  // Loan calculations (when selectedLender is provided)
  const loanTerms = selectedLender ? calculateLoanTerms(
    selectedLender,
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

  // Calculate max allowed loan amount based on credit rating and assets
  useEffect(() => {
    if (!isOpen) return;
    
    const calculateMaxAllowed = async () => {
      try {
        setIsCalculatingMax(true);
        const [creditRating, totalAssets] = await Promise.all([
          getCurrentCreditRating(),
          calculateTotalAssets()
        ]);

        let maxAllowed: number;

        if (selectedLender) {
          // For selected lender mode, calculate max for this specific lender
          const limitInfo = await getScaledLoanAmountLimit(selectedLender, creditRating, { totalAssets });
          maxAllowed = Math.min(limitInfo.maxAllowed, selectedLender.maxLoanAmount);
        } else {
          // For lender search mode, calculate max across all lenders
          const allLenders = await loadLenders();
          const maxAllowedPromises = allLenders
            .filter(lender => !lender.blacklisted)
            .map(lender => getScaledLoanAmountLimit(lender, creditRating, { totalAssets }));

          const limits = await Promise.all(maxAllowedPromises);
          maxAllowed = limits.length > 0
            ? Math.max(...limits.map(limit => limit.maxAllowed))
            : LOAN_AMOUNT_RANGES.MAX;
        }

        // Ensure it's at least the minimum, and cap at the theoretical max
        const finalMax = Math.max(
          LOAN_AMOUNT_RANGES.MIN,
          Math.min(maxAllowed, LOAN_AMOUNT_RANGES.MAX)
        );

        setMaxAllowedLoanAmount(finalMax);

        // Update loan amount range if current max exceeds the new limit (only for search mode)
        if (!selectedLender && loanAmountRange[1] > finalMax) {
          const newRange: [number, number] = [
            Math.min(loanAmountRange[0], finalMax),
            finalMax
          ];
          setLoanAmountRange(newRange);
          setOptions(prev => ({ ...prev, loanAmountRange: newRange }));
        }

        // Update loan amount if it exceeds the limit (for selected lender mode)
        if (selectedLender && loanAmount > finalMax) {
          setLoanAmount(Math.min(loanAmount, finalMax));
        }
      } catch (error) {
        console.error('Error calculating max allowed loan amount:', error);
        // Fallback to default max
        setMaxAllowedLoanAmount(selectedLender ? selectedLender.maxLoanAmount : LOAN_AMOUNT_RANGES.MAX);
      } finally {
        setIsCalculatingMax(false);
      }
    };

    calculateMaxAllowed();
  }, [isOpen, selectedLender]);

  // Calculate preview stats whenever options change
  useEffect(() => {
    const totalCost = calculateLenderSearchCost(options);
    const { totalWork } = calculateLenderSearchWork(options);
    
    // Apply loan constraint multipliers - smooth scaling based on range restriction
    const amountRange = loanAmountRange[1] - loanAmountRange[0];
    const maxAmountRange = maxAllowedLoanAmount - LOAN_AMOUNT_RANGES.MIN;
    const durationRangeValue = durationRange[1] - durationRange[0];
    const maxDurationRange = LOAN_DURATION_RANGES.MAX - LOAN_DURATION_RANGES.MIN;
    
    // Calculate restriction ratios (0 = no restriction, 1 = maximum restriction)
    const amountRestrictionRatio = maxAmountRange > 0 ? 1 - (amountRange / maxAmountRange) : 0;
    const durationRestrictionRatio = 1 - (durationRangeValue / maxDurationRange);
    
    // Smooth scaling: 1.0x (no restriction) to 2.0x (maximum restriction)
    const amountMultiplier = 1 + (amountRestrictionRatio * 1.0);
    const durationMultiplier = 1 + (durationRestrictionRatio * 1.0);
    
    const adjustedWork = totalWork * amountMultiplier * durationMultiplier;
    const adjustedCost = totalCost * amountMultiplier * durationMultiplier;

    setPreviewStats({
      totalCost: adjustedCost,
      totalWork: adjustedWork
    });
  }, [options, loanAmountRange, durationRange, maxAllowedLoanAmount]);

  // Handle submit
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (selectedLender) {
        // Direct loan application mode
        const { startTakeLoan } = await import('@/lib/services');
        const { v4: uuidv4 } = await import('uuid');
        
        const loanOffer = {
          id: uuidv4(),
          lender: selectedLender,
          principalAmount: loanAmount,
          durationSeasons,
          effectiveInterestRate: effectiveRate,
          seasonalPayment,
          originationFee,
          totalInterest,
          totalExpenses,
          isAvailable: true
        };
        
        await startTakeLoan(loanOffer, true); // true = adjusted (work penalty)
      } else {
        // Lender search mode
        const { startLenderSearch } = await import('@/lib/services');
        const activityId = await startLenderSearch(options);
        if (activityId) {
          onClose();
          if (onSearchStarted) {
            onSearchStarted();
          }
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to process request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Toggle lender type selection
  const toggleLenderType = (type: LenderType) => {
    const currentTypes = options.lenderTypes;
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    setOptions(prev => ({ ...prev, lenderTypes: newTypes }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col scrollbar-styled">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {selectedLender ? 'Apply for Loan' : 'Lender Search'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {selectedLender 
                ? `Configure loan parameters with ${selectedLender.name}`
                : 'Configure parameters for finding loan offers'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-styled">
          {selectedLender ? (
            // Loan Application Mode
            <div className="space-y-6">
              {/* Lender Information */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedLender.name}</CardTitle>
                    <Badge className={getLenderTypeColorClass(selectedLender.type)}>
                      {selectedLender.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-600">Base Interest Rate:</span>
                      <div className="font-medium">{formatPercent(selectedLender.baseInterestRate)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Risk Tolerance:</span>
                      <div className="font-medium">{formatNumber(selectedLender.riskTolerance * 100, { smartDecimals: true })}%</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Flexibility:</span>
                      <div className="font-medium">{formatNumber(selectedLender.flexibility * 100, { smartDecimals: true })}%</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Market Presence:</span>
                      <div className="font-medium">{formatNumber(selectedLender.marketPresence * 100, { smartDecimals: true })}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loan Parameters */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium text-white">Loan Amount</Label>
                  <div className="mt-2 space-y-2">
                    {isCalculatingMax ? (
                      <div className="text-xs text-gray-400 py-2">Calculating borrowing limit...</div>
                    ) : (
                      <>
                        <Slider
                          value={[loanAmount]}
                          onValueChange={(value) => setLoanAmount(value[0])}
                          min={selectedLender.minLoanAmount}
                          max={maxAllowedLoanAmount}
                          step={1000}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>{formatNumber(selectedLender.minLoanAmount, { currency: true })}</span>
                          <span className="font-medium text-white">{formatNumber(loanAmount, { currency: true })}</span>
                          <span className="font-medium text-blue-400">
                            Max: {formatNumber(maxAllowedLoanAmount, { currency: true })}
                          </span>
                        </div>
                        {maxAllowedLoanAmount < selectedLender.maxLoanAmount && (
                          <p className="text-xs text-amber-400 mt-1">
                            Your borrowing limit is {formatNumber(maxAllowedLoanAmount, { currency: true })} based on your credit rating and total assets (lender max: {formatNumber(selectedLender.maxLoanAmount, { currency: true })}).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium text-white">Duration (Years)</Label>
                  <div className="mt-2 space-y-2">
                    <Slider
                      value={[durationSeasons]}
                      onValueChange={(value) => setDurationSeasons(value[0])}
                      min={selectedLender.minDurationSeasons}
                      max={selectedLender.maxDurationSeasons}
                      step={1}
                      className="w-full"
                    />
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>{formatNumber(selectedLender.minDurationSeasons / 4, { smartDecimals: true })} years</span>
                        <span className="font-medium text-white">{formatNumber(durationSeasons / 4, { smartDecimals: true })} years</span>
                        <span>{formatNumber(selectedLender.maxDurationSeasons / 4, { smartDecimals: true })} years</span>
                      </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-700" />

              {/* Loan Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-white">Loan Terms Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400">Principal Amount:</span>
                      <div className="font-medium text-lg text-white">{formatNumber(loanAmount, { currency: true })}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Origination Fee:</span>
                      <div className="font-medium text-lg text-orange-400">{formatNumber(originationFee, { currency: true })}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Effective Interest Rate:</span>
                      <div className="font-medium text-lg text-white">{formatPercent(effectiveRate)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Seasonal Payment:</span>
                      <div className="font-medium text-lg text-white">{formatNumber(seasonalPayment, { currency: true })}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Interest:</span>
                      <div className="font-medium text-lg text-white">{formatNumber(totalInterest, { currency: true })}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Expenses:</span>
                      <div className="font-medium text-lg text-red-400">{formatNumber(totalExpenses, { currency: true })}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Lender Search Mode
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Search Parameters */}
              <div className="space-y-6">
                {/* Number of Offers */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Number of Offers ({options.numberOfOffers})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={options.numberOfOffers}
                    onChange={(e) => setOptions(prev => ({ ...prev, numberOfOffers: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 offer</span>
                    <span>20 offers</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Request multiple loan offers from different lenders. More offers increase search cost and time.
                  </p>
                </div>

                {/* Lender Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Lender Types (select to constrain, empty = all types)
                  </label>
                  <div className="space-y-2">
                    {LENDER_TYPES.map((type) => {
                      const isSelected = options.lenderTypes.includes(type);
                      return (
                        <div
                          key={type}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                          }`}
                          onClick={() => toggleLenderType(type)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{type}</span>
                            <span className="text-xs">
                              {isSelected ? '✓ Selected' : 'Click to select'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Constraining to specific lender types slightly increases search complexity. Leave all unselected to search all types.
                  </p>
                </div>

                {/* Loan Parameters */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Loan Parameters
                  </label>
                  
                  <div className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                    {/* Loan Amount Range */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Loan Amount Range: {formatNumber(loanAmountRange[0], { currency: true })} - {formatNumber(loanAmountRange[1], { currency: true })}
                      </label>
                      {isCalculatingMax ? (
                        <div className="text-xs text-gray-400 py-2">Calculating borrowing limit...</div>
                      ) : (
                        <>
                          <DualSlider
                            value={loanAmountRange}
                            min={LOAN_AMOUNT_RANGES.MIN}
                            max={maxAllowedLoanAmount}
                            step={LOAN_AMOUNT_RANGES.STEP}
                            onChange={(value) => {
                              setLoanAmountRange([value[0], value[1]]);
                              setOptions(prev => ({ ...prev, loanAmountRange: [value[0], value[1]] }));
                            }}
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>{formatNumber(LOAN_AMOUNT_RANGES.MIN, { currency: true })}</span>
                            <span className="font-medium text-blue-400">
                              Max: {formatNumber(maxAllowedLoanAmount, { currency: true })}
                            </span>
                          </div>
                          {maxAllowedLoanAmount < LOAN_AMOUNT_RANGES.MAX && (
                            <p className="text-xs text-amber-400 mt-2">
                              Your borrowing limit is {formatNumber(maxAllowedLoanAmount, { currency: true })} based on your credit rating and total assets.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Duration Range */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Duration Range: {formatNumber(durationRange[0] / 4, { smartDecimals: true })} - {formatNumber(durationRange[1] / 4, { smartDecimals: true })} years
                      </label>
                      <DualSlider
                        value={durationRange}
                        min={LOAN_DURATION_RANGES.MIN}
                        max={LOAN_DURATION_RANGES.MAX}
                        step={LOAN_DURATION_RANGES.STEP}
                        onChange={(value) => {
                          setDurationRange([value[0], value[1]]);
                          setOptions(prev => ({ ...prev, durationRange: [value[0], value[1]] }));
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{formatNumber(LOAN_DURATION_RANGES.MIN / 4, { smartDecimals: true })} years</span>
                        <span>{formatNumber(LOAN_DURATION_RANGES.MAX / 4, { smartDecimals: true })} years</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-2">
                    Constraining loan parameters increases search complexity but helps find more targeted offers.
                  </p>
                </div>
              </div>

              {/* Right Column - Preview & Estimates */}
              <div className="space-y-6">
                {/* Search Preview */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Expected Results</h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    {/* Offer Count */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Loan Offers to Find</h4>
                      <div className="bg-blue-600 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{options.numberOfOffers}</div>
                        <div className="text-xs text-blue-100 mt-1">offers will be generated</div>
                      </div>
                    </div>

                    {/* Lender Types */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Lender Types</h4>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <div className="text-lg font-bold text-white text-center">
                          {options.lenderTypes.length === 0 ? 'All Types' : options.lenderTypes.join(', ')}
                        </div>
                        <div className="text-xs text-gray-300 mt-1 text-center">
                          {options.lenderTypes.length === 0 
                            ? 'Searching all lender types'
                            : `Searching ${options.lenderTypes.length} of 3 types`
                          }
                        </div>
                      </div>
                    </div>

                    {/* Loan Parameters */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Loan Parameters</h4>
                      <div className="bg-gray-700 rounded-lg p-3 space-y-2">
                        <div className="text-center">
                          <div className="text-sm font-medium text-white">
                            Amount: {formatNumber(loanAmountRange[0], { currency: true })} - {formatNumber(loanAmountRange[1], { currency: true })}
                          </div>
                          <div className="text-xs text-gray-300">
                            Range: {formatNumber(loanAmountRange[1] - loanAmountRange[0], { currency: true })}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-white">
                            Duration: {formatNumber(durationRange[0] / 4, { smartDecimals: true })} - {formatNumber(durationRange[1] / 4, { smartDecimals: true })} years
                          </div>
                          <div className="text-xs text-gray-300">
                            Range: {formatNumber((durationRange[1] - durationRange[0]) / 4, { smartDecimals: true })} years
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Estimates */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Search Estimates</h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Search Cost:</span>
                      <span className="text-white font-medium">{formatNumber(previewStats.totalCost, { currency: true })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Work Required:</span>
                      <span className="text-white font-medium">{formatNumber(previewStats.totalWork, { smartDecimals: true })} units</span>
                    </div>
                  </div>
                </div>

                {/* Search Criteria Summary */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Search Criteria</h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Offers:</span>
                      <span className="text-white">{options.numberOfOffers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lender Types:</span>
                      <span className="text-white">
                        {options.lenderTypes.length === 0 ? 'All' : `${options.lenderTypes.length} selected`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount Range:</span>
                      <span className="text-white">{formatNumber(loanAmountRange[0], { currency: true })} - {formatNumber(loanAmountRange[1], { currency: true })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration Range:</span>
                      <span className="text-white">{formatNumber(durationRange[0] / 4, { smartDecimals: true })} - {formatNumber(durationRange[1] / 4, { smartDecimals: true })} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Available Funds:</span>
                      <span className="text-white">{formatNumber(gameState.money || 0, { currency: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          {error && (
            <div className="flex-1 p-3 bg-red-900 border border-red-700 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className={selectedLender 
              ? "bg-blue-600 hover:bg-blue-700 text-white" 
              : "bg-green-600 hover:bg-green-700 text-white"
            }
            disabled={isSubmitting || (!selectedLender && previewStats.totalCost > 0 && (gameState.money || 0) < previewStats.totalCost)}
          >
            {isSubmitting 
              ? (selectedLender ? 'Processing...' : 'Starting...') 
              : selectedLender 
                ? 'Accept Adjusted Offer (+50% Work)' 
                : `Start Search (${formatNumber(previewStats.totalCost, { currency: true })})`
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

