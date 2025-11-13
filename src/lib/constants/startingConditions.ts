import type { Aspect, Nationality, LenderType } from '@/lib/types/types';

export type StartingCountry = Nationality;

export interface StartingStaffMember {
  firstName: string;
  lastName: string;
  nationality: Nationality;
  skillLevel: number;
  specializations: string[];
}

export interface StartingVineyardConfig {
  country: StartingCountry;
  region: string;
  minHectares: number;
  maxHectares: number;
  minAltitude?: number;
  maxAltitude?: number;
  preferredAspects?: Aspect[];
}

export interface StartingLoanConfig {
  lenderType: LenderType;
  principal: number;
  durationSeasons: number;
  label?: string;
  description?: string;
  skipAdministrationPenalty?: boolean;
  interestRate?: number;
}

export interface StartingPrestigeConfig {
  amount: number;
  type?: string;
  decayRate?: number;
  description?: string;
  payload?: Record<string, any>;
}

export interface StartingCondition {
  id: StartingCountry;
  name: string;
  description: string;
  startingMoney: number;
  flagCode: string;
  familyPicture?: string | null;
  staff: StartingStaffMember[];
  startingVineyard: StartingVineyardConfig;
  // Future: tutorial mentor character
  mentorName?: string;
  mentorImage?: string | null;
  startingLoan?: StartingLoanConfig;
  startingPrestige?: StartingPrestigeConfig;
}

// Starting conditions configuration
export const STARTING_CONDITIONS: Record<StartingCountry, StartingCondition> = {
  'France': {
    id: 'France',
    name: 'France',
    description: 'Start your winery in the beautiful French countryside. You will begin with a small vineyard in Burgundy, guided by the Latosha family tradition.',
    startingMoney: 40000,
    flagCode: 'fr',
    familyPicture: 'pierrecamille.webp',
    mentorName: 'Pierre Latosha',
    mentorImage: 'pierre.webp',
    staff: [
      {
        firstName: 'Pierre',
        lastName: 'Latosha',
        nationality: 'France',
        skillLevel: 0.5,
        specializations: ['winery']
      },
      {
        firstName: 'Camille',
        lastName: 'Latosha',
        nationality: 'France',
        skillLevel: 0.5,
        specializations: ['administration']
      }
    ],
    startingVineyard: {
      country: 'France',
      region: 'Bourgogne',
      minHectares: 0.04,
      maxHectares: 0.05,
      minAltitude: 200,
      maxAltitude: 220,
      preferredAspects: ['North', 'Northwest'] as Aspect[]
    },
    startingLoan: {
      lenderType: 'Bank',
      principal: 80000, //lowerd by 5k because of the prestige
      durationSeasons: 40,
      label: 'Founders’ Bank Note',
      description: 'Traditional bank financing extended to cover essential launch costs.',
      skipAdministrationPenalty: true,
      interestRate: 0.015
    },
    startingPrestige: {
      amount: 5,
      type: 'company_story',
      decayRate: 0.999,
      description: 'Vineyard Legacy Prestige',
      payload: { origin: 'starting_conditions', family: 'Latosha' }
    }
  },
  
  'Italy': {
    id: 'Italy',
    name: 'Italy',
    description: 'Begin your journey in the rolling hills of Tuscany. The De Luca family will guide you through the Italian winemaking tradition.',
    startingMoney: 55000,
    flagCode: 'it',
    familyPicture: 'robertobianca.webp',
    mentorName: 'Roberto De Luca',
    mentorImage: 'roberto.webp',
    staff: [
      {
        firstName: 'Roberto',
        lastName: 'De Luca',
        nationality: 'Italy',
        skillLevel: 0.5,
        specializations: ['winery']
      },
      {
        firstName: 'Bianca',
        lastName: 'De Luca',
        nationality: 'Italy',
        skillLevel: 0.5,
        specializations: ['field']
      }
    ],
    startingVineyard: {
      country: 'Italy',
      region: 'Tuscany',
      minHectares: 0.12,
      maxHectares: 0.16,
      minAltitude: 260,
      maxAltitude: 340,
      preferredAspects: ['Southeast', 'South'] as Aspect[]
    },
    startingLoan: {
      lenderType: 'Bank',
      principal: 48000, //lowerd by 2k because of the prestige
      durationSeasons: 32,
      label: 'Tuscan Founders Loan',
      description: 'Local cooperative bank financing to secure equipment and initial cellar upgrades.',
      skipAdministrationPenalty: true,
      interestRate: 0.018
    },
    startingPrestige: {
      amount: 2,
      type: 'company_story',
      decayRate: 0.999,
      description: 'Heritage Estate Recognition',
      payload: { origin: 'starting_conditions', family: 'De Luca' }
    }
  },
  
  'Germany': {
    id: 'Germany',
    name: 'Germany',
    description: 'Establish your vineyard along the Mosel River. The Weissburg family has been making wine here for generations, and all four members will help turn the winery into a success.',
    startingMoney: 74000, //lowerd by 1k because of the prestige
    flagCode: 'de',
    familyPicture: 'weissburg.webp',
    mentorName: 'Johann Weissburg',
    mentorImage: 'johann.webp',
    staff: [
      {
        firstName: 'Johann',
        lastName: 'Weissburg',
        nationality: 'Germany',
        skillLevel: 0.5,
        specializations: ['winery']
      },
      {
        firstName: 'Lukas',
        lastName: 'Weissburg',
        nationality: 'Germany',
        skillLevel: 0.5,
        specializations: ['maintenance']
      },
      {
        firstName: 'Elsa',
        lastName: 'Weissburg',
        nationality: 'Germany',
        skillLevel: 0.7,
        specializations: ['sales']
      },
      {
        firstName: 'Klara',
        lastName: 'Weissburg',
        nationality: 'Germany',
        skillLevel: 0.2,
        specializations: ['administration']
      }
    ],
    startingVineyard: {
      country: 'Germany',
      region: 'Mosel',
      minHectares: 0.18,
      maxHectares: 0.22,
      minAltitude: 260,
      maxAltitude: 320,
      preferredAspects: ['Southeast', 'South'] as Aspect[]
    }
    , startingPrestige: {
      amount: 1,
      type: 'company_story',
      decayRate: 0.999,
      description: 'German Wine Heritage Recognition',
      payload: { origin: 'starting_conditions', family: 'Weissburg' }
    }
  },
  
  'Spain': {
    id: 'Spain',
    name: 'Spain',
    description: 'Create your bodega in the Spanish wine country of Rioja. The Torres family brings passion and expertise to Spanish winemaking.',
    startingMoney: 100000,
    flagCode: 'es',
    familyPicture: null,
    mentorName: 'Miguel Torres',
    mentorImage: null,
    staff: [
      {
        firstName: 'Miguel',
        lastName: 'Torres',
        nationality: 'Spain',
        skillLevel: 0.5,
        specializations: ['winery']
      }
    ],
    startingVineyard: {
      country: 'Spain',
      region: 'Ribera del Duero',
      minHectares: 0.20,
      maxHectares: 0.24,
      minAltitude: 720,
      maxAltitude: 860,
      preferredAspects: ['South', 'Southeast'] as Aspect[]
    },
    startingLoan: {
      lenderType: 'Bank',
      principal: 5000,
      durationSeasons: 28,
      label: 'Ribera Working Capital Note',
      description: 'Short-term cooperative credit to bridge early operational costs.',
      skipAdministrationPenalty: true,
      interestRate: 0.017
    }
  },
  
  'United States': {
    id: 'United States',
    name: 'United States',
    description: 'Build your winery in Napa Valley, California. The Mondavi family represents the New World approach to winemaking.',
    startingMoney: 65000,
    flagCode: 'us',
    familyPicture: null,
    mentorName: 'Sarah Mondavi',
    mentorImage: null,
    staff: [
      {
        firstName: 'Sarah',
        lastName: 'Mondavi',
        nationality: 'United States',
        skillLevel: 0.5,
        specializations: ['winery']
      },
      {
        firstName: 'Robert',
        lastName: 'Mondavi',
        nationality: 'United States',
        skillLevel: 0.5,
        specializations: ['administration']
      }
    ],
    startingVineyard: {
      country: 'United States',
      region: 'Napa Valley',
      minHectares: 0.05,
      maxHectares: 0.06,
      minAltitude: 160,
      maxAltitude: 220,
      preferredAspects: ['South', 'Southeast'] as Aspect[]
    }
  }
};

// Helper to get available starting countries
export function getStartingCountries(): StartingCountry[] {
  return Object.keys(STARTING_CONDITIONS) as StartingCountry[];
}

// Helper to get starting condition by country
export function getStartingCondition(country: StartingCountry): StartingCondition | undefined {
  return STARTING_CONDITIONS[country];
}

