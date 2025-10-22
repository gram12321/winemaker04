import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button, Label, Slider, Card, CardContent, CardHeader, CardTitle, Badge, Separator } from '@/components/ui';
import { Lender } from '@/lib/types/types';
import { applyForLoan, calculateEffectiveInterestRate, calculateOriginationFee, getGameState } from '@/lib/services';
import { formatCurrency, formatPercent, getLenderTypeColorClass } from '@/lib/utils';
import { ECONOMY_INTEREST_MULTIPLIERS, LENDER_TYPE_MULTIPLIERS } from '@/lib/constants/economyConstants';

interface LoanApplicationModalProps {
  lender: Lender;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function LoanApplicationModal({ lender, isOpen, onClose, onComplete }: LoanApplicationModalProps) {
  const [loanAmount, setLoanAmount] = useState(lender.minLoanAmount);
  const [durationSeasons, setDurationSeasons] = useState(lender.minDurationSeasons);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameState = getGameState();

  // Calculate effective interest rate
  const effectiveRate = calculateEffectiveInterestRate(
    lender.baseInterestRate,
    gameState.economyPhase || 'Recovery',
    lender.type,
    gameState.creditRating || 0.5,
    durationSeasons
  );

  // Calculate seasonal payment using loan amortization
  const calculateSeasonalPayment = (principal: number, rate: number, seasons: number): number => {
    if (rate === 0) {
      return principal / seasons;
    }
    return principal * (rate * Math.pow(1 + rate, seasons)) / (Math.pow(1 + rate, seasons) - 1);
  };

  const seasonalPayment = calculateSeasonalPayment(loanAmount, effectiveRate, durationSeasons);
  const totalRepayment = seasonalPayment * durationSeasons;
  
  // Calculate origination fee
  const originationFee = calculateOriginationFee(loanAmount, lender, gameState.creditRating || 0.5, durationSeasons);

  // Calculate rate breakdown for tooltip
  const economyMultiplier = ECONOMY_INTEREST_MULTIPLIERS[gameState.economyPhase || 'Recovery'];
  const lenderMultiplier = LENDER_TYPE_MULTIPLIERS[lender.type];
  const creditMultiplier = 0.8 + (0.7 * (1 - (gameState.creditRating || 0.5)));

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      await applyForLoan(lender.id, loanAmount, durationSeasons, lender);
      
      onComplete();
    } catch (error) {
      console.error('Error applying for loan:', error);
      setError('Failed to apply for loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🏦</span>
            Apply for Loan
          </DialogTitle>
          <DialogDescription>
            Configure your loan parameters and review the terms before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lender Information */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{lender.name}</CardTitle>
                <Badge className={getLenderTypeColorClass(lender.type)}>
                  {lender.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Base Interest Rate:</span>
                  <div className="font-medium">{formatPercent(lender.baseInterestRate)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Risk Tolerance:</span>
                  <div className="font-medium">{Math.round(lender.riskTolerance * 100)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Flexibility:</span>
                  <div className="font-medium">{Math.round(lender.flexibility * 100)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Market Presence:</span>
                  <div className="font-medium">{Math.round(lender.marketPresence * 100)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Parameters */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Loan Amount</Label>
              <div className="mt-2 space-y-2">
                <Slider
                  value={[loanAmount]}
                  onValueChange={(value) => setLoanAmount(value[0])}
                  min={lender.minLoanAmount}
                  max={lender.maxLoanAmount}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{formatCurrency(lender.minLoanAmount)}</span>
                  <span className="font-medium">{formatCurrency(loanAmount)}</span>
                  <span>{formatCurrency(lender.maxLoanAmount)}</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Duration (Years)</Label>
              <div className="mt-2 space-y-2">
                <Slider
                  value={[durationSeasons]}
                  onValueChange={(value) => setDurationSeasons(value[0])}
                  min={lender.minDurationSeasons}
                  max={lender.maxDurationSeasons}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{Math.round(lender.minDurationSeasons / 4 * 10) / 10} years</span>
                  <span className="font-medium">{Math.round(durationSeasons / 4 * 10) / 10} years</span>
                  <span>{Math.round(lender.maxDurationSeasons / 4 * 10) / 10} years</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Loan Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan Terms Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Principal Amount:</span>
                  <div className="font-medium text-lg">{formatCurrency(loanAmount)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Origination Fee:</span>
                  <div className="font-medium text-lg text-orange-600">{formatCurrency(originationFee)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Effective Interest Rate:</span>
                  <div className="font-medium text-lg">{formatPercent(effectiveRate)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Seasonal Payment:</span>
                  <div className="font-medium text-lg">{formatCurrency(seasonalPayment)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Interest:</span>
                  <div className="font-medium text-lg">{formatCurrency(totalRepayment - loanAmount)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Repayment:</span>
                  <div className="font-medium text-lg">{formatCurrency(totalRepayment)}</div>
                </div>
              </div>

              {/* Rate Breakdown */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium mb-2">Interest Rate Breakdown:</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base Rate:</span>
                    <span>{formatPercent(lender.baseInterestRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Economy Phase ({gameState.economyPhase}):</span>
                    <span>×{economyMultiplier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lender Type ({lender.type}):</span>
                    <span>×{lenderMultiplier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Credit Rating ({Math.round((gameState.creditRating || 0.5) * 100)}%):</span>
                    <span>×{creditMultiplier.toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Final Rate:</span>
                    <span>{formatPercent(effectiveRate)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Applying...' : 'Apply for Loan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
