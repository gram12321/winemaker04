import { v4 as uuidv4 } from 'uuid';
import { StartingCountry, StartingCondition, STARTING_CONDITIONS, StartingLoanConfig } from '@/lib/constants/startingConditions';
import { createStaff, addStaff } from '../user/staffService';
import { assignStaffToTeam, getAllTeams } from '../user/teamService';
import { supabase } from '@/lib/database';
import type { Staff } from '@/lib/types/types';
import { getRandomAspect, getRandomAltitude, getRandomSoils, generateVineyardName } from '../vineyard/vineyardService';
import { DEFAULT_VINE_DENSITY, TRANSACTION_CATEGORIES, GAME_INITIALIZATION } from '@/lib/constants';
import { getStoryImageSrc, getRandomFromArray } from '@/lib/utils';
import { addTransaction } from '../finance/financeService';
import { companyService } from '../user/companyService';
import { getAllLenders } from '../finance/lenderService';
import { applyForLoan } from '../finance/loanService';
import { insertPrestigeEvent } from '@/lib/database/customers/prestigeEventsDB';
import { getGameState } from './gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';

// Preview vineyard type (not yet saved to database)
export interface VineyardPreview {
  name: string;
  country: string;
  region: string;
  hectares: number;
  soil: string[];
  altitude: number;
  aspect: string;
  density: number;
}

export interface ApplyStartingConditionsResult {
  success: boolean;
  error?: string;
  mentorMessage?: string;
  mentorName?: string;
  mentorImage?: string;
  startingMoney?: number;
  startingLoanId?: string;
  startingPrestige?: number;
}

const SPECIALIZATION_TEAM_TASKS: Record<string, string[]> = {
  administration: ['administration'],
  maintenance: ['maintenance'],
  field: ['planting', 'harvesting', 'clearing'],
  winery: ['fermentation', 'crushing'],
  sales: ['sales']
};

/**
 * Generate a preview vineyard for a starting condition
 * This is called before the user confirms the selection
 */
export function generateVineyardPreview(condition: StartingCondition): VineyardPreview {
  const {
    country,
    region,
    minHectares,
    maxHectares,
    minAltitude,
    maxAltitude,
    preferredAspects
  } = condition.startingVineyard;
  
  // Generate random hectares within range
  const hectares = Number((minHectares + Math.random() * (maxHectares - minHectares)).toFixed(2));
  
  // Generate random vineyard properties
  const aspect = preferredAspects && preferredAspects.length > 0
    ? getRandomFromArray(preferredAspects)
    : getRandomAspect();
  const name = generateVineyardName(country, aspect);
  const altitude =
    minAltitude !== undefined && maxAltitude !== undefined
      ? Math.round(minAltitude + Math.random() * (maxAltitude - minAltitude))
      : getRandomAltitude(country, region);
  const soil = getRandomSoils(country, region);
  const density = DEFAULT_VINE_DENSITY; // Use shared default density
  
  return {
    name,
    country,
    region,
    hectares,
    soil,
    altitude,
    aspect: aspect as string,
    density
  };
}

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
    
    const startingMoney = condition.startingMoney;
    let startingLoanId: string | undefined;
    const availableTeams = getAllTeams();

    // 1. Update company metadata via service (starting country)
    const { success: companyUpdateSuccess, error: companyUpdateError } = await companyService.updateCompany(companyId, {
      startingCountry: country
    });

    if (!companyUpdateSuccess) {
      console.error('Error updating company starting country:', companyUpdateError);
      return { success: false, error: 'Failed to update company' };
    }

    // 2. Adjust starting capital using finance service utilities
    const moneyDifference = startingMoney - GAME_INITIALIZATION.STARTING_MONEY;
    if (moneyDifference !== 0) {
      try {
        await addTransaction(
          moneyDifference,
          'Starting Capital Adjustment',
          TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
          false,
          companyId
        );
      } catch (transactionError) {
        console.error('Error adjusting starting capital:', transactionError);
        return { success: false, error: 'Failed to adjust starting capital' };
      }
    }

    // 3. Apply optional starting loan before staffing to ensure capital reflects loan
    if (condition.startingLoan) {
      const loanResult = await applyStartingLoan(condition.startingLoan);
      if (!loanResult.success) {
        return { success: false, error: loanResult.error ?? 'Failed to apply starting loan' };
      }
      startingLoanId = loanResult.loanId;
    }

    // 4. Create starting staff
    const createdStaff: Staff[] = [];
    for (const staffConfig of condition.staff) {
      const staff = createStaff(
        staffConfig.firstName,
        staffConfig.lastName,
        staffConfig.skillLevel,
        staffConfig.specializations,
        staffConfig.nationality as any // Nationality type
      );
      
      const addedStaff = await addStaff(staff);
      if (addedStaff) {
        createdStaff.push(addedStaff);
        
        if (availableTeams.length > 0 && staffConfig.specializations?.length) {
          const teamIdsToAssign = new Set<string>();
          
          for (const specialization of staffConfig.specializations) {
            const taskTypes = SPECIALIZATION_TEAM_TASKS[specialization];
            if (!taskTypes) continue;
            
            const matchingTeam = availableTeams.find((team) =>
              taskTypes.some((task) => team.defaultTaskTypes.includes(task))
            );
            
            if (matchingTeam) {
              teamIdsToAssign.add(matchingTeam.id);
            }
          }
          
          for (const teamId of teamIdsToAssign) {
            const success = await assignStaffToTeam(addedStaff.id, teamId);
            if (!success) {
              console.warn(`Failed to assign starting staff ${addedStaff.name} to team ${teamId}`);
            }
          }
        }
      }
    }
    
    // 5. Create starting vineyard from preview
    const { error: vineyardError } = await supabase
      .from('vineyards')
      .insert({
        company_id: companyId,
        name: vineyardPreview.name,
        country: vineyardPreview.country,
        region: vineyardPreview.region,
        hectares: vineyardPreview.hectares,
        soil: vineyardPreview.soil,
        altitude: vineyardPreview.altitude,
        aspect: vineyardPreview.aspect,
        density: 0, // Not yet planted
        status: 'Barren',
        grape_variety: null,
        vine_age: null,
        ripeness: 0,
        vine_yield: 0.02,
        vineyard_health: 0.6, // Default starting health
        vineyard_prestige: 0,
        vineyard_total_value: 0,
        created_at: new Date().toISOString()
      });
      
    if (vineyardError) {
      console.error('Error creating starting vineyard:', vineyardError);
      return { success: false, error: 'Failed to create starting vineyard' };
    }
    
    // Refresh company money after all financial adjustments (capital + loan)
    let resolvedStartingMoney = startingMoney;
    try {
      const updatedCompany = await companyService.getCompany(companyId);
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
        await insertPrestigeEvent({
          id: uuidv4(),
          type: prestigeConfig.type ?? 'company_story',
          amount_base: prestigeConfig.amount,
          created_game_week: createdWeek,
          decay_rate: prestigeConfig.decayRate ?? 0.98,
          description: prestigeConfig.description ?? 'Vineyard Legacy Prestige',
          source_id: null,
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

    const mentorMessage = buildMentorWelcomeMessage(condition, vineyardPreview);
    const mentorImageSrc = getStoryImageSrc(condition.mentorImage, { fallback: false }) ?? undefined;
    return {
      success: true,
      mentorMessage: mentorMessage ?? undefined,
      mentorName: condition.mentorName,
      mentorImage: mentorImageSrc,
      startingMoney: resolvedStartingMoney,
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
    const lenders = await getAllLenders();
    if (!lenders || lenders.length === 0) {
      return { success: false, error: 'No lenders available for starting loan' };
    }

    const lender = lenders.find((entry) => entry.type === config.lenderType && !entry.blacklisted);
    if (!lender) {
      return { success: false, error: `No ${config.lenderType} lenders available for starting loan` };
    }

    const { principal, durationSeasons } = config;
    const interestOverride = config.interestRate;

    const loanId = await applyForLoan(
      lender.id,
      principal,
      durationSeasons,
      lender,
      {
        loanCategory: 'standard',
        skipAdministrationPenalty: config.skipAdministrationPenalty ?? true,
        skipTransactions: true,
        overrideBaseRate: interestOverride,
        overrideEffectiveRate: interestOverride,
        skipLimitCheck: true
      }
    );

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

