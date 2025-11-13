// Starting Conditions Modal
// Allows users to select their starting country and preview starting conditions

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Button } from '../../shadCN/button';
import { ScrollArea } from '../../shadCN/scroll-area';
import { StartingCountry, STARTING_CONDITIONS, getStartingCountries } from '@/lib/constants/startingConditions';
import {
  generateVineyardPreview,
  applyStartingConditions,
  VineyardPreview,
  type ApplyStartingConditionsResult
} from '@/lib/services/core/startingConditionsService';
import { formatNumber, getFlagIcon, StoryPortrait } from '@/lib/utils';

type MentorWelcomeData = {
  mentorName: string | null;
  mentorMessage: string;
  mentorImage: string | null | undefined;
};

interface StartingConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  onComplete: (startingMoney?: number) => void;
  onMentorReady?: (welcome: MentorWelcomeData) => void;
}

export const StartingConditionsModal: React.FC<StartingConditionsModalProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  onComplete,
  onMentorReady
}) => {
  const [selectedCountry, setSelectedCountry] = useState<StartingCountry>('France');
  const [vineyardPreview, setVineyardPreview] = useState<VineyardPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  
  // Generate preview when country changes
  useEffect(() => {
    if (!selectedCountry) return;
    const condition = STARTING_CONDITIONS[selectedCountry];
    if (condition) {
      const preview = generateVineyardPreview(condition);
      setVineyardPreview(preview);
    }
  }, [selectedCountry]);
  
  const modalTitle = companyName
    ? `Select Starting Conditions for ${companyName}`
    : 'Select Starting Conditions';

  const modalDescription = companyName
    ? `Choose where ${companyName} begins its journey. Each location offers unique resources and challenges.`
    : 'Choose where to start your winery. Each location offers a unique beginning with different resources and challenges.';

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = async () => {
    if (!vineyardPreview) return;
    
    setIsApplying(true);
    try {
      const result: ApplyStartingConditionsResult = await applyStartingConditions(
        companyId,
        selectedCountry,
        vineyardPreview
      );
      
      if (result.success) {
        const appliedStartingMoney = result.startingMoney ?? selectedCondition.startingMoney;
        if (result.mentorMessage) {
          const condition = STARTING_CONDITIONS[selectedCountry];
          onMentorReady?.({
            mentorMessage: result.mentorMessage,
            mentorName: result.mentorName ?? condition.mentorName ?? condition.name,
            mentorImage: result.mentorImage ?? condition.mentorImage ?? null
          });
        }
        onComplete(appliedStartingMoney);
      } else {
        alert(result.error || 'Failed to apply starting conditions. Please try again.');
      }
    } catch (error) {
      console.error('Error applying starting conditions:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };
  
  const selectedCondition = STARTING_CONDITIONS[selectedCountry];
  const countries = getStartingCountries();
  
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-7xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        <div className="bg-wine text-white px-6 py-4">
          <h2 className="text-2xl font-semibold">{modalTitle}</h2>
          <p className="text-sm text-white/80 mt-1">{modalDescription}</p>
        </div>

        <div className="flex-1 min-h-0 px-6 py-6 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1.4fr)_320px]">
            {/* Country Selection */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 uppercase">Select Country</h3>
              <ScrollArea className="h-[380px] pr-2">
                <div className="space-y-2">
                  {countries.map((country) => {
                    const condition = STARTING_CONDITIONS[country];
                    const isSelected = selectedCountry === country;
                    
                    return (
                      <div
                        key={country}
                        className={`
                          p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${isSelected 
                            ? 'border-wine bg-wine/10' 
                            : 'border-gray-200 hover:border-wine/50 hover:bg-gray-50'
                          }
                        `}
                        onClick={() => setSelectedCountry(country)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={getFlagIcon(country)}></span>
                          <h4 className="font-semibold">{condition.name}</h4>
                        </div>
                        <p className="text-xs text-gray-600">{condition.description}</p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Details Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-lg">
                  <span className={getFlagIcon(selectedCountry)}></span>
                  {selectedCondition.name} Details
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Starting Capital:</span>
                    <span className="font-semibold text-green-600">
                      {formatNumber(selectedCondition.startingMoney, { currency: true })}
                    </span>
                  </div>

                  {selectedCondition.startingLoan && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Starting Loan:</span>
                      <span className="font-semibold text-right text-red-600">
                        {formatNumber(selectedCondition.startingLoan.principal, { currency: true })} ·{' '}
                        {selectedCondition.startingLoan.durationSeasons} seasons
                      </span>
                    </div>
                  )}

                  {selectedCondition.startingPrestige && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Starting Prestige:</span>
                      <span className="font-semibold text-right text-purple-600">
                        +{formatNumber(selectedCondition.startingPrestige.amount, { decimals: 0 })} pts
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-semibold text-right">
                      {selectedCondition.startingVineyard.region}, {selectedCondition.name}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Starting Staff:</span>
                    <span className="font-semibold">{selectedCondition.staff.length} members</span>
                  </div>
                </div>
                
                {/* Staff List */}
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Family Members</h4>
                  <div className="space-y-1">
                    {selectedCondition.staff.map((member, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="text-gray-500 text-right">
                          {member.specializations.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {vineyardPreview && (
                <div className="bg-green-50 rounded-lg p-4 space-y-3 border border-green-200">
                  <h3 className="font-semibold text-green-900">Starting Vineyard Preview</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-semibold">{vineyardPreview.name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Size:</span>
                      <span className="font-semibold">{vineyardPreview.hectares} hectares</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Soil:</span>
                      <span className="font-semibold">{vineyardPreview.soil.join(', ')}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Altitude:</span>
                      <span className="font-semibold">{vineyardPreview.altitude}m</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Aspect:</span>
                      <span className="font-semibold">{vineyardPreview.aspect}</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-600 italic">
                    This vineyard will be granted to you when you start. You can purchase additional land later.
                  </p>
                </div>
              )}
            </div>

            {/* Portrait Column */}
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <StoryPortrait
                  image={selectedCondition.familyPicture}
                  alt={`${selectedCondition.name} family`}
                  className="w-full h-[28rem]"
                  rounded={false}
                />
              </div>

              <div className="bg-white rounded-lg border p-4 text-sm text-gray-600">
                <h4 className="font-semibold text-gray-900 mb-2">Need to know</h4>
                <p>
                  Each family comes with its own starting capital, staff talents, and land profile. Take your time to explore the differences before committing to your legacy.
                </p>
                {selectedCondition.startingLoan && (
                  <p className="mt-2 text-gray-600">
                    You will also begin with a {selectedCondition.startingLoan.label ?? selectedCondition.startingLoan.lenderType.replace(/([A-Z])/g, ' $1').toLowerCase()} loan worth{' '}
                    {formatNumber(selectedCondition.startingLoan.principal, { currency: true })}, scheduled over{' '}
                    {selectedCondition.startingLoan.durationSeasons} seasons. Plan your cash flow accordingly from day one.
                  </p>
                )}
                {selectedCondition.startingPrestige && (
                  <p className="mt-2 text-gray-600">
                    A {selectedCondition.startingPrestige.description ?? 'prestige event'} grants{' '}
                    {formatNumber(selectedCondition.startingPrestige.amount, { decimals: 0 })} immediate prestige to honor the
                    company’s legacy.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isApplying}
              className="bg-wine hover:bg-wine-dark text-white"
            >
              {isApplying ? 'Starting...' : `Start in ${selectedCondition.name}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

