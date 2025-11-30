// Starting Conditions Modal
// Allows users to select their starting country and preview starting conditions

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Button } from '../../shadCN/button';
import { ScrollArea } from '../../shadCN/scroll-area';
import { Slider } from '../../shadCN/slider';
import { Label } from '../../shadCN/label';
import { StartingCountry, STARTING_CONDITIONS, getStartingCountries } from '@/lib/constants/startingConditions';
import {
  generateVineyardPreview,
  applyStartingConditions,
  VineyardPreview,
  type ApplyStartingConditionsResult,
  FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION
} from '@/lib/services/core/startingConditionsService';
import { formatNumber, getFlagIcon, StoryPortrait } from '@/lib/utils';
import { calculateLandValue, calculateAdjustedLandValue } from '@/lib/services/vineyard/vineyardValueCalc';
import type { Aspect } from '@/lib/types/types';
import { companyService } from '@/lib/services/user/companyService';
import { getPlayerBalance } from '@/lib/services/user/userBalanceService';

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
  const [vineyardPreviews, setVineyardPreviews] = useState<Record<StartingCountry, VineyardPreview | null>>({} as Record<StartingCountry, VineyardPreview | null>);
  const [isApplying, setIsApplying] = useState(false);
  const [outsideInvestment, setOutsideInvestment] = useState<number>(0); // Public investment: 0 to 1,000,000€
  const [playerBalance, setPlayerBalance] = useState<number>(0);
  const [isFirstCompany, setIsFirstCompany] = useState<boolean>(true);
  const [playerCashContribution, setPlayerCashContribution] = useState<number>(0);
  
  const selectedCondition = STARTING_CONDITIONS[selectedCountry];
  
  // Load player balance and check if first company
  useEffect(() => {
    const loadPlayerData = async () => {
      try {
        const company = await companyService.getCompany(companyId);
        if (company?.userId) {
          const balance = await getPlayerBalance(company.userId);
          setPlayerBalance(balance);
          
          // Check if this is the first company
          // Get all companies for this user, excluding the current one
          const userCompanies = await companyService.getUserCompanies(company.userId);
          const otherCompanies = userCompanies.filter(c => c.id !== companyId);
          const isFirst = otherCompanies.length === 0;
          setIsFirstCompany(isFirst);
          
          // Set initial player cash contribution (for subsequent companies)
          // Default to 0 so user can adjust up to their available balance
          if (!isFirst) {
            setPlayerCashContribution(0);
          }
        } else {
          // No userId means anonymous company - always first company behavior
          setIsFirstCompany(true);
          setPlayerBalance(0);
        }
      } catch (error) {
        console.error('Error loading player data:', error);
        // Default to first company on error
        setIsFirstCompany(true);
      }
    };
    
    if (isOpen) {
      loadPlayerData();
    }
  }, [isOpen, companyId, selectedCondition.startingMoney]);
  
  // Reset player cash contribution to 0 when country changes (for subsequent companies)
  // This ensures the slider starts at 0 and user can adjust up to their available balance
  useEffect(() => {
    if (!isFirstCompany) {
      setPlayerCashContribution(0);
    }
  }, [selectedCountry, isFirstCompany]);
  
  // Generate preview once per country when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset previews when modal closes
      setVineyardPreviews({} as Record<StartingCountry, VineyardPreview | null>);
      return;
    }
    
    // Generate previews for all countries when modal opens (only once)
    const countries = getStartingCountries();
    const newPreviews: Record<StartingCountry, VineyardPreview | null> = {} as Record<StartingCountry, VineyardPreview | null>;
    
    countries.forEach((country) => {
      const condition = STARTING_CONDITIONS[country];
      if (condition) {
        newPreviews[country] = generateVineyardPreview(condition);
      }
    });
    
    setVineyardPreviews(newPreviews);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only regenerate when modal opens/closes
  
  // Get the preview for the currently selected country
  const vineyardPreview = vineyardPreviews[selectedCountry] || null;
  
  // Calculate vineyard value as part of player contribution
  // This calculation must match exactly what applyStartingConditions uses
  const estimatedVineyardValue = vineyardPreview ? (() => {
    const previewAspect = (vineyardPreview.aspect as Aspect) || 'South';
    const landValuePerHectare = calculateLandValue(
      vineyardPreview.country,
      vineyardPreview.region,
      vineyardPreview.altitude,
      previewAspect
    );
    
    // If vineyard is planted, use adjusted land value (must match service calculation)
    if (selectedCondition.startingUnlockedGrape) {
      const adjustedValuePerHectare = calculateAdjustedLandValue(
        vineyardPreview.country,
        vineyardPreview.region,
        vineyardPreview.altitude,
        previewAspect,
        {
          grape: selectedCondition.startingUnlockedGrape,
          vineAge: selectedCondition.startingVineyard.startingVineAge,
          vineyardPrestige: 0,
          soil: vineyardPreview.soil
        }
      );
      return Math.round(adjustedValuePerHectare * vineyardPreview.hectares);
    }
    
    return Math.round(landValuePerHectare * vineyardPreview.hectares);
  })() : 0;
  
  // Calculate derived values (after selectedCondition is defined)
  const familyContribution = estimatedVineyardValue;
  const playerShareContribution = isFirstCompany
    ? FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION
    : playerCashContribution;
  const maxPlayerCashContribution = isFirstCompany
    ? FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION
    : Math.max(0, playerBalance);
  const canAffordContribution = isFirstCompany || (playerBalance >= playerShareContribution);
  const baseOutsideInvestmentCap = Math.max(playerShareContribution || 0, FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION);
  const MAX_OUTSIDE_INVESTMENT = baseOutsideInvestmentCap * 10; // Allow up to 10x player equity
  const safeOutsideInvestment = Math.min(outsideInvestment, MAX_OUTSIDE_INVESTMENT);
  const totalContributions = playerShareContribution + familyContribution + safeOutsideInvestment;
  const loanPrincipal = selectedCondition.startingLoan?.principal ?? 0;
  const liquidStartingCapital = playerShareContribution + safeOutsideInvestment + loanPrincipal;
  const playerOwnershipPct = totalContributions > 0 ? (playerShareContribution / totalContributions) * 100 : 100;
  const familyOwnershipPct = totalContributions > 0 ? (familyContribution / totalContributions) * 100 : 0;
  const outsideOwnershipPct = totalContributions > 0 ? (safeOutsideInvestment / totalContributions) * 100 : 0;
  
  useEffect(() => {
    setOutsideInvestment((prev) => Math.min(prev, MAX_OUTSIDE_INVESTMENT));
  }, [MAX_OUTSIDE_INVESTMENT]);
  
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
    
    // Validate player contribution for subsequent companies
    if (!isFirstCompany) {
      if (!canAffordContribution) {
        alert(`Insufficient balance. You have ${formatNumber(playerBalance, { currency: true })} but need ${formatNumber(playerShareContribution, { currency: true })} in cash for this company.`);
        return;
      }
      if (playerCashContribution < 0) {
        alert('Player cash contribution cannot be negative');
        return;
      }
    }
    
    setIsApplying(true);
    try {
      const result: ApplyStartingConditionsResult = await applyStartingConditions(
        companyId,
        selectedCountry,
        vineyardPreview,
        safeOutsideInvestment,
        isFirstCompany ? undefined : playerCashContribution
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
                      {formatNumber(liquidStartingCapital, { currency: true })}
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

                  {selectedCondition.startingUnlockedGrape && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Starting Grape:</span>
                      <span className="font-semibold text-right text-green-600">
                        {selectedCondition.startingUnlockedGrape}
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

              {/* Ownership & Investment Section */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900">Company Ownership</h3>
                
                {/* Player Balance Display (for subsequent companies) */}
                {!isFirstCompany && (
                  <div className="bg-white rounded-md p-3 border border-blue-300 mb-3">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-700 font-semibold">Your Balance:</span>
                      <span className={`font-semibold ${playerBalance >= playerShareContribution ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(playerBalance, { currency: true })}
                      </span>
                    </div>
                    {!canAffordContribution && (
                      <div className="text-xs text-red-600 mt-1">
                        ⚠️ Insufficient balance for this contribution
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      {/* Player Cash Contribution - editable for subsequent companies */}
                      {!isFirstCompany ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <Label htmlFor="player-cash-contribution" className="text-gray-700">
                              Player Cash Contribution:
                            </Label>
                            <span className="font-semibold text-green-600">
                              {formatNumber(playerShareContribution, { currency: true })}
                            </span>
                          </div>
                          {maxPlayerCashContribution > 0 ? (
                            <>
                              <Slider
                                id="player-cash-contribution"
                                value={[playerCashContribution]}
                                onValueChange={(value) => {
                                  const newValue = Math.max(0, Math.min(maxPlayerCashContribution, value[0]));
                                  setPlayerCashContribution(newValue);
                                }}
                                min={0}
                                max={maxPlayerCashContribution}
                                step={Math.max(1, Math.floor(maxPlayerCashContribution / 100) || 1)}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>€0</span>
                                <span>{formatNumber(maxPlayerCashContribution, { currency: true })}</span>
                              </div>
                            </>
                          ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-700">
                              No liquid funds available for an additional cash contribution.
                            </div>
                          )}
                          <div className="text-xs text-gray-600">
                            Available balance: <span className="font-semibold">{formatNumber(playerBalance, { currency: true })}</span>
                            {maxPlayerCashContribution >= 0 && (
                              <> • Max cash: <span className="font-semibold">{formatNumber(maxPlayerCashContribution, { currency: true })}</span></>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">Player Cash Contribution:</span>
                          <span className="font-semibold text-green-600">
                            {formatNumber(playerShareContribution, { currency: true })}
                          </span>
                        </div>
                      )}
                      {vineyardPreview && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">Family Vineyard Contribution:</span>
                          <span className="font-semibold text-amber-600">
                            {formatNumber(familyContribution, { currency: true })}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm pt-1 border-t border-blue-200">
                        <span className="text-gray-700 font-semibold">Player Equity Contribution:</span>
                        <span className={`font-semibold ${canAffordContribution ? 'text-green-600' : 'text-red-600'}`}>
                          {formatNumber(playerShareContribution, { currency: true })}
                        </span>
                      </div>
                      {!isFirstCompany && !canAffordContribution && (
                        <div className="text-xs text-red-600 mt-1">
                          Required: {formatNumber(playerShareContribution, { currency: true })}, Available: {formatNumber(playerBalance, { currency: true })}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Public Investment:</span>
                        <span className="font-semibold text-blue-600">
                          {formatNumber(safeOutsideInvestment, { currency: true })}
                        </span>
                      </div>
                      
                      <Slider
                        value={[safeOutsideInvestment]}
                        onValueChange={(value) => setOutsideInvestment(Math.min(value[0], MAX_OUTSIDE_INVESTMENT))}
                        min={0}
                        max={MAX_OUTSIDE_INVESTMENT}
                        step={10000}
                        className="w-full"
                      />
                      
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>€0</span>
                        <span>{formatNumber(MAX_OUTSIDE_INVESTMENT, { currency: true })}</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-blue-200 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Total Contributions:</span>
                        <span className="font-semibold text-gray-900">
                          {formatNumber(totalContributions, { currency: true })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Player Ownership:</span>
                        <span className="font-semibold text-green-600">
                          {playerOwnershipPct.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Family Ownership:</span>
                        <span className="font-semibold text-amber-600">
                          {familyOwnershipPct.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Public Investor Ownership:</span>
                        <span className="font-semibold text-blue-600">
                          {outsideOwnershipPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
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
                    
                    {selectedCondition.startingUnlockedGrape && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Grape Variety:</span>
                          <span className="font-semibold text-green-600">
                            {selectedCondition.startingUnlockedGrape}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Vine Age:</span>
                          <span className="font-semibold">
                            {selectedCondition.startingVineyard.startingVineAge} years
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-600 italic">
                    {selectedCondition.startingUnlockedGrape 
                      ? `This vineyard comes with ${selectedCondition.startingUnlockedGrape} vines that are ${selectedCondition.startingVineyard.startingVineAge} years old. You can purchase additional land later.`
                      : 'This vineyard will be granted to you when you start. You can purchase additional land later.'}
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

