// Staff System Constants
// Centralized configuration for staff-related constants

import { Nationality, StaffSkills } from '@/lib/types/types';
import { NAMES } from './namesConstants';

// ===== WAGE CALCULATION CONSTANTS =====

// Base weekly wage (from v3)
export const BASE_WEEKLY_WAGE = 500;

// Skill wage multiplier - how much extra wage per skill point
export const SKILL_WAGE_MULTIPLIER = 1000;

// ===== NATIONALITY CONSTANTS =====

export const NATIONALITIES: Nationality[] = ['Italy', 'Germany', 'France', 'Spain', 'United States'];

// Helper function to get male names for a nationality
export function getMaleNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.firstNames.male);
}

// Helper function to get female names for a nationality
export function getFemaleNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.firstNames.female);
}

// Helper function to get last names for a nationality
export function getLastNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.lastNames);
}

// ===== SKILL LEVEL DEFINITIONS =====

export const SKILL_LEVELS: Record<number, { name: string; description: string }> = {
  0.1: { name: 'Novice', description: 'Just starting out' },
  0.2: { name: 'Beginner', description: 'Learning the ropes' },
  0.3: { name: 'Apprentice', description: 'Learning the basics' },
  0.4: { name: 'Intermediate', description: 'Developing skills' },
  0.5: { name: 'Competent', description: 'Solid foundation' },
  0.6: { name: 'Skilled', description: 'Experienced worker' },
  0.7: { name: 'Proficient', description: 'Experienced professional' },
  0.8: { name: 'Advanced', description: 'Highly skilled' },
  0.9: { name: 'Expert', description: 'Master of the craft' },
  1.0: { name: 'Master', description: 'Best in the business' }
};

// Helper to get skill level info for a given skill value
export function getSkillLevelInfo(skillLevel: number): { name: string; description: string } {
  // Round to nearest 0.1
  const rounded = Math.round(skillLevel * 10) / 10;
  return SKILL_LEVELS[rounded] || SKILL_LEVELS[0.5];
}

// ===== SPECIALIZATION DEFINITIONS =====

// Specialization roles (reserved for future implementation)
export const SPECIALIZED_ROLES: Record<string, { 
  title: string; 
  description: string; 
  skillBonus: keyof StaffSkills;
  bonusAmount: number;
}> = {
  field: { 
    title: 'Vineyard Manager', 
    description: 'Expert in vineyard operations', 
    skillBonus: 'field',
    bonusAmount: 0.2
  },
  winery: { 
    title: 'Master Winemaker', 
    description: 'Specialist in wine production', 
    skillBonus: 'winery',
    bonusAmount: 0.2
  },
  administration: { 
    title: 'Estate Administrator', 
    description: 'Expert in business operations', 
    skillBonus: 'administration',
    bonusAmount: 0.2
  },
  sales: { 
    title: 'Sales Director', 
    description: 'Specialist in wine marketing and sales', 
    skillBonus: 'sales',
    bonusAmount: 0.2
  },
  maintenance: { 
    title: 'Technical Director', 
    description: 'Expert in facility maintenance', 
    skillBonus: 'maintenance',
    bonusAmount: 0.2
  }
};

