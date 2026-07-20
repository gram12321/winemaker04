import { v4 as uuidv4 } from 'uuid';
import { FIRST_COMPANY_PLAYER_BALANCE_SEED, FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION, STARTING_CONDITIONS, type StartingCondition, type StartingCountry, type StartingLoanConfig } from '@/lib/constants/startingConditions';
import { staffFeature } from '@/lib/features/staff';
import type { Aspect, Staff, GameDate } from '@/lib/types/types';
import { getPlantedVineyardStatus } from '@/lib/services/vineyard/vineyardService';
import { TRANSACTION_CATEGORIES, GAME_INITIALIZATION } from '@/lib/constants';
import { formatNumber, getStoryImageSrc } from '@/lib/utils';
import { addTransaction } from '@/lib/services/finance/financeService';
import { companyFeature } from '@/lib/features/company';
import { upsertPrestigeEventBySource } from '@/lib/database/customers/prestigeEventsDB';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';
import { calculateLandValue, calculateAdjustedLandValue } from '@/lib/services/vineyard/vineyardValueCalc';
import { calculateBaselineVineYieldForAge } from '@/lib/services/vineyard/vineyardManager';
import { DEFAULT_VINE_DENSITY } from '@/lib/features/activities/constants/activityConstants';
import { userFeature } from '@/lib/features/user';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { createStartingVineyard } from '@/lib/database/activities/vineyardDB';
import type { ApplyStartingConditionsResult, VineyardPreview } from '../featureTypes';

/**
 * Apply starting conditions to a new company
 * This is called after the user confirms the selection
 */
export async function applyStartingConditions(
  companyId: string,
  country: StartingCountry,
  vineyardPreview: VineyardPreview
): Promise<ApplyStartingConditionsResult> {
  try {
    const condition = STARTING_CONDITIONS[country];
    if (!condition) {
      return { success: false, error: 'Invalid starting country' };
    }

    // Get company to check if it has a user
    const company = await companyFeature.records.get(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Check if this is the first company for the user
    let isFirstCompany = true;
    let userId: string | undefined;
    if (company.ownerId) {
      userId = company.ownerId;
      const userCompanies = await companyFeature.records.listForOwner(userId);
      // Exclude the current company being created
      const otherCompanies = userCompanies.filter(c => c.id !== companyId);
      isFirstCompany = otherCompanies.length === 0;
    }

    // Determine player cash contribution
    // For first company: use country-specific base investment
    // For subsequent companies: use country-specific base investment
    let playerCashContributionAmount: number;
    if (isFirstCompany) {
      playerCashContributionAmount = FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION;
    } else {
      playerCashContributionAmount = condition.startingMoney;
    }
    
    // Calculate vineyard value as part of player contribution (calculate once, use everywhere)
    const previewAspect = (vineyardPreview.aspect as Aspect) || 'South';
    const landValuePerHectare = calculateLandValue(
      vineyardPreview.country,
      vineyardPreview.region,
      vineyardPreview.altitude,
      previewAspect
    );
    
    // If vineyard is planted, use adjusted land value
    let vineyardValue = Math.round(landValuePerHectare * vineyardPreview.hectares);
    let adjustedLandValuePerHectare = landValuePerHectare;
    if (condition.startingUnlockedGrape) {
      adjustedLandValuePerHectare = calculateAdjustedLandValue(
        vineyardPreview.country,
        vineyardPreview.region,
        vineyardPreview.altitude,
        previewAspect,
        {
          grape: condition.startingUnlockedGrape,
          vineAge: condition.startingVineyard.startingVineAge,
          vineyardPrestige: 0,
          soil: vineyardPreview.soil
        }
      );
      vineyardValue = Math.round(adjustedLandValuePerHectare * vineyardPreview.hectares);
    }
    
    let startingLoanId: string | undefined;

    // 1. Update company metadata via service
    const { success: companyUpdateSuccess, error: companyUpdateError } = await companyFeature.records.update(companyId, {
      startingCountry: country
    });

    if (!companyUpdateSuccess) {
      console.error('Error updating company starting country:', companyUpdateError);
      return { success: false, error: 'Failed to update company' };
    }

    // 2. Handle player balance deduction
    if (userId) {
      if (isFirstCompany) {
        await userFeature.wallet.setBalance(userId, FIRST_COMPANY_PLAYER_BALANCE_SEED);
      }
      
      const playerCashRequirement = playerCashContributionAmount;
      
      // Check player balance
      const playerBalance = await userFeature.wallet.getBalance(userId);
      if (playerBalance < playerCashRequirement) {
        return { 
          success: false, 
          error: `Insufficient balance. You have ${formatNumber(playerBalance, { currency: true })} but need ${formatNumber(playerCashRequirement, { currency: true })} in cash for this company.`
        };
      }

      // Deduct total contribution from player balance
      const balanceResult = await userFeature.wallet.applyChange(userId, -playerCashRequirement);
      if (!balanceResult.success) {
        return { success: false, error: balanceResult.error || 'Failed to deduct from player balance' };
      }
    }

    // 3. Add starting capital (player cash investment)
    let workingMoney = company.money ?? 0;
    
    if (playerCashContributionAmount !== 0) {
      try {
        await addTransaction(
          playerCashContributionAmount,
          'Initial Capital: Player cash contribution',
          TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
          false,
          companyId
        );
        workingMoney += playerCashContributionAmount;
      } catch (transactionError) {
        console.error('Error adding player capital contribution:', transactionError);
        return { success: false, error: 'Failed to record player capital contribution' };
      }
    }
    
    // 4. Apply optional starting loan before staffing to ensure capital reflects loan
    if (condition.startingLoan) {
      const loanResult = await applyStartingLoan(condition.startingLoan);
      if (!loanResult.success) {
        return { success: false, error: loanResult.error ?? 'Failed to apply starting loan' };
      }
      startingLoanId = loanResult.loanId;

      if (condition.startingLoan.principal > 0) {
        const loanDescription = condition.startingLoan.label
          ? `Starting loan proceeds: ${condition.startingLoan.label}`
          : `Starting loan proceeds from ${condition.startingLoan.lenderType}`;
        try {
          await addTransaction(
            condition.startingLoan.principal,
            loanDescription,
            TRANSACTION_CATEGORIES.LOAN_RECEIVED,
            false,
            companyId
          );
          workingMoney += condition.startingLoan.principal;
        } catch (loanTransactionError) {
          console.error('Error adding starting loan proceeds:', loanTransactionError);
          return { success: false, error: 'Failed to record starting loan proceeds' };
        }
      }
    }

    // 5. Create starting staff
    const createdStaff: Staff[] = [];
    for (const staffConfig of condition.staff) {
      const gameState = getGameState();
      const staff = staffFeature.records.create({
        firstName: staffConfig.firstName,
        lastName: staffConfig.lastName,
        skillLevel: staffConfig.skillLevel,
        nationality: staffConfig.nationality as import('@/lib/types/types').Nationality,
        hireDate: { week: gameState.week || 1, season: gameState.season || 'Spring', year: gameState.currentYear || 2025 },
        isFounder: staffConfig.isFounder ?? false,
        specializedRoles: staffConfig.specializedRoles,
      });

      const addedStaff = await staffFeature.records.add(staff);
      if (addedStaff) {
        createdStaff.push(addedStaff);

      }
    }

    // 6. Create starting vineyard from preview
    // Use the same values calculated above to ensure consistency
    // vineyardValue was calculated using previewAspect and vineyardPreview data above
    // Verification: vineyardValue should equal adjustedLandValuePerHectare * vineyardPreview.hectares (rounded)
    // This ensures the stored vineyard_total_value matches what was used for ownership calculation
    const baseTotalValue = vineyardValue; // This matches the value used for ownership calculation
    

    // Determine if vineyard should be planted with starting grape
    const startingGrape = condition.startingUnlockedGrape ?? null;
    const startingVineAge = condition.startingVineyard.startingVineAge;
    const isPlanted = startingGrape !== null;
    const startingVineYield = isPlanted ? calculateBaselineVineYieldForAge(startingVineAge) : 0.02;

    // Determine initial status based on current season (uses shared logic from vineyardService)
    const vineyardStatus = getPlantedVineyardStatus(isPlanted);

    try {
      await createStartingVineyard({
        companyId,
        name: vineyardPreview.name,
        country: vineyardPreview.country,
        region: vineyardPreview.region,
        hectares: vineyardPreview.hectares,
        soil: vineyardPreview.soil,
        altitude: vineyardPreview.altitude,
        aspect: previewAspect,
        density: isPlanted ? DEFAULT_VINE_DENSITY : 0,
        status: vineyardStatus,
        grape: startingGrape,
        vineAge: isPlanted ? startingVineAge : null,
        ripeness: 0,
        vineYield: startingVineYield,
        vineyardHealth: 0.6,
        vineyardPrestige: 0,
        landValue: adjustedLandValuePerHectare,
        vineyardTotalValue: baseTotalValue
      });
    } catch (vineyardError) {
      console.error('Error creating starting vineyard:', vineyardError);
      return { success: false, error: 'Failed to create starting vineyard' };
    }

    // Refresh company money after all financial adjustments (capital + loan)
    let resolvedStartingMoney = workingMoney;
    try {
      const updatedCompany = await companyFeature.records.get(companyId);
      if (updatedCompany) {
        resolvedStartingMoney = updatedCompany.money;
      }
    } catch (moneyError) {
      console.warn('Unable to resolve updated company money after starting conditions:', moneyError);
    }
    
    if (condition.startingPrestige) {
      try {
        const gameState = getGameState();
        const createdWeek = calculateAbsoluteWeeks(
          gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
          gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON,
          gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR
        );

        const prestigeConfig = condition.startingPrestige;
        // Starting conditions may be retried after a partial setup failure. Keep
        // their prestige grant to one stable row instead of attempting a second
        // insert for the same company and country.
        await upsertPrestigeEventBySource(prestigeConfig.type ?? 'company_story', `starting_conditions:${condition.id}`, {
          id: uuidv4(),
          amount_base: prestigeConfig.amount,
          created_game_week: createdWeek,
          decay_rate: prestigeConfig.decayRate ?? 0.98,
          description: prestigeConfig.description ?? 'Vineyard Legacy Prestige',
          payload: {
            event: 'starting_conditions',
            country: condition.id,
            ...(prestigeConfig.payload ?? {})
          }
        });
      } catch (prestigeError) {
        console.error('Error creating starting prestige event:', prestigeError);
      }
    }

    // 8. Unlock starting grape variety (if specified)
    if (condition.startingUnlockedGrape) {
      try {
        const gameState = getGameState();
        const gameDate: GameDate = {
          week: gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
          season: (gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON) as any,
          year: gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR
        };
        
        const absoluteWeeks = calculateAbsoluteWeeks(
          gameDate.week,
          gameDate.season,
          gameDate.year
        );

        await researchUpgradeFeature.setup.grantStartingGrapeUnlock({
          companyId,
          grape: condition.startingUnlockedGrape,
          countryId: condition.id,
          gameDate,
          absoluteWeeks
        });
      } catch (grapeUnlockError) {
        console.error('Error unlocking starting grape:', grapeUnlockError);
        // Don't fail the entire process if grape unlock fails
      }
    }

    // 9. Pre-unlock regional starting research (bypasses prestige gates)
    if (condition.startingResearch && condition.startingResearch.length > 0) {
      try {
        const gameState = getGameState();
        const gameDate: GameDate = {
          week: gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
          season: (gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON) as any,
          year: gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR
        };
        const absoluteWeeks = calculateAbsoluteWeeks(
          gameDate.week,
          gameDate.season,
          gameDate.year
        );

        for (const researchId of condition.startingResearch) {
        await researchUpgradeFeature.setup.grantResearchUnlock({
            researchId,
            companyId,
            gameDate,
            absoluteWeeks,
            metadata: { origin: 'starting_conditions', country: condition.id }
          });
        }
      } catch (researchUnlockError) {
        console.error('Error unlocking starting research:', researchUnlockError);
        // Don't fail the entire process if research unlock fails
      }
    }

    const mentorMessage = buildMentorWelcomeMessage(condition, vineyardPreview);
    const mentorImageSrc = getStoryImageSrc(condition.mentorImage, { fallback: false }) ?? undefined;
    return {
      success: true,
      mentorMessage: mentorMessage ?? undefined,
      mentorName: condition.mentorName,
      mentorImage: mentorImageSrc,
      startingMoney: resolvedStartingMoney, // Return actual cash amount after all transactions (vineyard value is separate asset)
      startingLoanId,
      startingPrestige: condition.startingPrestige?.amount
    };
  } catch (error) {
    console.error('Error applying starting conditions:', error);
    return { success: false, error: 'Failed to apply starting conditions' };
  }
}

interface StartingLoanResult {
  success: boolean;
  error?: string;
  loanId?: string;
}

async function applyStartingLoan(config: StartingLoanConfig): Promise<StartingLoanResult> {
  try {
    const loanId = await loanLenderFeature.setup.applyStartingLoan(config);
    return { success: true, loanId };
  } catch (error) {
    console.error('Error applying starting loan:', error);
    return { success: false, error: 'Failed to apply starting loan' };
  }
}

function buildMentorWelcomeMessage(condition: StartingCondition, vineyardPreview: VineyardPreview): string | null {
  const mentorName = condition.mentorName;
  const region = condition.startingVineyard.region;
  const vineyardName = vineyardPreview.name;

  switch (condition.id) {
    case 'France':
      return `Bonjour! I am ${mentorName ?? 'your mentor'} from the hills of ${region}. ${vineyardName} may be young, but with patient hands it will learn to whisper the stories of Burgundy.`;
    case 'Italy':
      return `Ciao! I am ${mentorName ?? 'your mentor'}, and together we will honor the rhythm of ${region}. ${vineyardName} is our canvas—let us paint it with Tuscan sunlight and care.`;
    case 'Germany':
      return `Guten Tag! ${mentorName ?? 'Your mentor'} welcomes you to the Mosel terraces. ${vineyardName} clings to the slate for a reason—walk with me and you will feel the strength beneath your feet.`;
    case 'Spain':
      return `Hola! I am ${mentorName ?? 'your mentor'}, and Rioja has been waiting for you. ${vineyardName} will teach you that passion and patience share the same heartbeat.`;
    case 'United States':
      return `Welcome! I am ${mentorName ?? 'your mentor'} from Napa Valley. ${vineyardName} is your foothold in this frontier—let’s blend heritage and innovation until it sings.`;
    default:
      return mentorName
        ? `Welcome! I am ${mentorName}. This land is your new beginning, and ${vineyardName} will carry your legacy forward.`
        : `Welcome to ${condition.name}! ${vineyardName} is ready to become the first chapter of your story.`;
  }
}


