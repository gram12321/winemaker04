import { StartingCountry, StartingCondition, STARTING_CONDITIONS } from '@/lib/constants/startingConditions';
import { createStaff, addStaff } from '../user/staffService';
import { supabase } from '@/lib/database';
import type { Staff } from '@/lib/types/types';
import { getRandomAspect, getRandomAltitude, getRandomSoils, generateVineyardName } from '../vineyard/vineyardService';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants';
import { getStoryImageSrc } from '@/lib/utils';

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
}

/**
 * Generate a preview vineyard for a starting condition
 * This is called before the user confirms the selection
 */
export function generateVineyardPreview(condition: StartingCondition): VineyardPreview {
  const { country, region, minHectares, maxHectares } = condition.startingVineyard;
  
  // Generate random hectares within range
  const hectares = Number((minHectares + Math.random() * (maxHectares - minHectares)).toFixed(2));
  
  // Generate random vineyard properties
  const aspect = getRandomAspect();
  const name = generateVineyardName(country, aspect);
  const altitude = getRandomAltitude(country, region);
  const soil = getRandomSoils(country, region);
  const density = DEFAULT_VINE_DENSITY; // Use shared default density
  
  return {
    name,
    country,
    region,
    hectares,
    soil,
    altitude,
    aspect: aspect as string, // Convert Aspect type to string for preview
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
    
    // 1. Update company with starting country
    const { error: companyError } = await supabase
      .from('companies')
      .update({ starting_country: country })
      .eq('id', companyId);
      
    if (companyError) {
      console.error('Error updating company starting country:', companyError);
      return { success: false, error: 'Failed to update company' };
    }
    
    // 2. Set starting money on company (finance system will handle starting capital via initializeStartingCapital)
    // The starting capital is already set by GAME_INITIALIZATION.STARTING_MONEY constant
    // and applied by initializeStartingCapital in gameState.ts
    // We just need to update the company record with the starting_country
    // The actual money value doesn't change - it's already set to GAME_INITIALIZATION.STARTING_MONEY
    
    // 3. Create starting staff
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
      }
    }
    
    // 4. Create starting vineyard from preview
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
    
    const mentorMessage = buildMentorWelcomeMessage(condition, vineyardPreview);
    const mentorImageSrc = getStoryImageSrc(condition.mentorImage, { fallback: false }) ?? undefined;
    return {
      success: true,
      mentorMessage: mentorMessage ?? undefined,
      mentorName: condition.mentorName,
      mentorImage: mentorImageSrc
    };
  } catch (error) {
    console.error('Error applying starting conditions:', error);
    return { success: false, error: 'Failed to apply starting conditions' };
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

