import type { Nationality } from '@/lib/types/types';

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
}

// Starting conditions configuration
export const STARTING_CONDITIONS: Record<StartingCountry, StartingCondition> = {
  'France': {
    id: 'France',
    name: 'France',
    description: 'Start your winery in the beautiful French countryside. You will begin with a small vineyard in Burgundy, guided by the Latosha family tradition.',
    startingMoney: 7000000, // €7M
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
      minHectares: 0.1,
      maxHectares: 0.5
    }
  },
  
  'Italy': {
    id: 'Italy',
    name: 'Italy',
    description: 'Begin your journey in the rolling hills of Tuscany. The De Luca family will guide you through the Italian winemaking tradition.',
    startingMoney: 5000000, // €5M
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
      minHectares: 0.1,
      maxHectares: 0.5
    }
  },
  
  'Germany': {
    id: 'Germany',
    name: 'Germany',
    description: 'Establish your vineyard along the Mosel River. The Weissburg family has been making wine here for generations, and all four members will help turn the winery into a success.',
    startingMoney: 3000000, // €3M
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
        skillLevel: 0.5,
        specializations: ['sales']
      },
      {
        firstName: 'Klara',
        lastName: 'Weissburg',
        nationality: 'Germany',
        skillLevel: 0.5,
        specializations: ['administration']
      }
    ],
    startingVineyard: {
      country: 'Germany',
      region: 'Mosel',
      minHectares: 0.1,
      maxHectares: 0.5
    }
  },
  
  'Spain': {
    id: 'Spain',
    name: 'Spain',
    description: 'Create your bodega in the Spanish wine country of Rioja. The Torres family brings passion and expertise to Spanish winemaking.',
    startingMoney: 2000000, // €2M
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
      },
      {
        firstName: 'Isabella',
        lastName: 'Torres',
        nationality: 'Spain',
        skillLevel: 0.5,
        specializations: ['administration']
      }
    ],
    startingVineyard: {
      country: 'Spain',
      region: 'Rioja',
      minHectares: 0.1,
      maxHectares: 0.5
    }
  },
  
  'United States': {
    id: 'United States',
    name: 'United States',
    description: 'Build your winery in Napa Valley, California. The Mondavi family represents the New World approach to winemaking.',
    startingMoney: 7000000, // €7M
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
      minHectares: 0.1,
      maxHectares: 0.5
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

