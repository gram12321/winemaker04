import { v4 as uuidv4 } from 'uuid';
import { Staff, StaffSkills, Nationality } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { saveStaffToDb, loadStaffFromDb, deleteStaffFromDb } from '@/lib/database/core/staffDB';
import {
  getMaleNamesForNationality,
  getFemaleNamesForNationality,
  getLastNamesForNationality,
  NATIONALITIES
} from '@/lib/constants/staffConstants';
import { calculateWage } from '../finance/wageService';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { normalizeXP } from '@/lib/utils/calculator';

/**
 * Calculate effective skill level combining base skill and experience.
 * Formula: Effective = Base + (XP_Normalized * (1 - Base))
 * This ensures that as XP approaches max (1.0), the effective skill approaches 1.0,
 * filling the gap in the base skill.
 * 
 * @param baseSkill The base skill level (0-1)
 * @param rawXP The raw experience points
 * @returns Effective skill level (0-1)
 */
export function calculateEffectiveSkill(baseSkill: number, rawXP: number): number {
  const xpNormalized = normalizeXP(rawXP);
  // Ensure baseSkill is within 0-1 for the calculation (though it should be already)
  const safeBase = Math.max(0, Math.min(1, baseSkill));

  // XP fills the remaining gap to 1.0
  return safeBase + (xpNormalized * (1 - safeBase));
}

/**
 * Generate random skills based on skill level and specializations
 * Based on v3's skill generation logic
 */
export function generateRandomSkills(skillModifier: number = 0.5, specializations: string[] = []): StaffSkills {
  const getSkillValue = (isSpecialized: boolean): number => {
    // Base skill draws from range influenced by overall desired skill level
    const baseValue = (Math.random() * 0.6) + (skillModifier * 0.4);

    if (isSpecialized) {
      // v3-like behaviour: specialized roles gain a multiplicative bump
      const remainingPotential = 1.0 - baseValue;
      const bonusPercentage = 0.2 + (skillModifier * 0.2); // 20-40%
      const bumped = Math.min(1.0, baseValue + remainingPotential * bonusPercentage);

      // Ensure a minimum floor for specialized skills so they don't roll too low
      // Floor scales with overall skill level: base 35% + 15% of slider
      // Example: Apprentice (0.3) → ~0.45 min, Expert (0.9) → ~0.65 min
      const specializationFloor = Math.min(1, 0.35 + (skillModifier * 0.15) + (skillModifier * 0.15));
      return Math.max(bumped, specializationFloor);
    }

    return baseValue;
  };

  return {
    field: getSkillValue(specializations.includes('field')),
    winery: getSkillValue(specializations.includes('winery')),
    financeAndStaff: getSkillValue(specializations.includes('financeAndStaff')),
    sales: getSkillValue(specializations.includes('sales')),
    administrationAndResearch: getSkillValue(specializations.includes('administrationAndResearch'))
  };
}


/**
 * Generate a random first name for a nationality
 */
export function getRandomFirstName(nationality: Nationality): string {
  const isMale = Math.random() > 0.5;
  const nameList = isMale
    ? getMaleNamesForNationality(nationality)
    : getFemaleNamesForNationality(nationality);

  return nameList[Math.floor(Math.random() * nameList.length)];
}

/**
 * Generate a random last name for a nationality
 */
export function getRandomLastName(nationality: Nationality): string {
  const lastNames = getLastNamesForNationality(nationality);
  return lastNames[Math.floor(Math.random() * lastNames.length)];
}

/**
 * Generate a random nationality
 */
export function getRandomNationality(): Nationality {
  return NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
}

/**
 * Create a new staff member
 */
export function createStaff(
  firstName: string,
  lastName: string,
  skillLevel: number = 0.3,
  specializations: string[] = [],
  nationality: Nationality = 'United States',
  skills?: StaffSkills
): Staff {
  const gameState = getGameState();
  const calculatedSkills = skills || generateRandomSkills(skillLevel, specializations);

  return {
    id: uuidv4(),
    name: `${firstName} ${lastName}`,
    nationality,
    skillLevel,
    specializations,
    skills: calculatedSkills,
    wage: calculateWage(calculatedSkills, specializations),
    workforce: 50,
    hireDate: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2025
    },
    teamIds: [],
    experience: {}
  };
}

/**
 * Add a staff member (Business Logic: orchestrates DB save + game state + notification)
 */
export async function addStaff(staff: Staff): Promise<Staff | null> {
  // Save to database
  const success = await saveStaffToDb(staff);
  if (!success) {
    console.error('Failed to hire staff member');
    return null;
  }

  // Update game state
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  updateGameState({ staff: [...currentStaff, staff] });

  // Send notification
  await notificationService.addMessage(
    `${staff.name} has been hired!`,
    'staffService.hireStaff',
    'Staff Hiring',
    NotificationCategory.STAFF_MANAGEMENT
  );

  return staff;
}

/**
 * Remove a staff member (Business Logic: orchestrates DB delete + game state)
 */
export async function removeStaff(staffId: string): Promise<boolean> {
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  const staff = currentStaff.find(s => s.id === staffId);

  if (!staff) {
    console.error('Staff member not found');
    return false;
  }

  // Delete from database
  const success = await deleteStaffFromDb(staffId);
  if (!success) {
    console.error('Failed to remove staff member');
    return false;
  }

  // Update game state
  updateGameState({ staff: currentStaff.filter(s => s.id !== staffId) });

  console.log(`${staff.name} has left the company`);
  return true;
}

/**
 * Get all staff members (from database)
 * Follows vineyard pattern: reads from DB, not game state
 */
export async function getAllStaff(): Promise<Staff[]> {
  return await loadStaffFromDb();
}

/**
 * Get a staff member by ID (from database)
 * Follows vineyard pattern: reads from DB, not game state
 */
export async function getStaffById(staffId: string): Promise<Staff | undefined> {
  const staff = await loadStaffFromDb();
  return staff.find(s => s.id === staffId);
}

/**
 * Initialize staff system (Business Logic: load from DB + update game state)
 */
export async function initializeStaffSystem(): Promise<void> {
  try {
    const staff = await loadStaffFromDb();
    updateGameState({ staff });
  } catch (error) {
    console.error('Error initializing staff system:', error);
    updateGameState({ staff: [] });
  }
}

/**
 * Award experience to a staff member (Business Logic: calculate XP + update + save)
 */
export async function awardExperience(staffId: string, amount: number, categories: string[]): Promise<void> {
  const staff = await getStaffById(staffId);
  if (!staff) return;

  // Calculate new experience
  const newExperience = { ...staff.experience };
  for (const category of categories) {
    newExperience[category] = (newExperience[category] || 0) + amount;
  }

  const updatedStaff = { ...staff, experience: newExperience };

  // Update game state
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  const updatedStaffList = currentStaff.map(s => s.id === staffId ? updatedStaff : s);
  updateGameState({ staff: updatedStaffList });

  // Save to database
  await saveStaffToDb(updatedStaff);
}
