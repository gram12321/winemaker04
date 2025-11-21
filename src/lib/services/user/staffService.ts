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
    teamIds: []
  };
}

/**
 * Add a staff member to the game state and database
 */
export async function addStaff(staff: Staff): Promise<Staff | null> {
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];

  // Save to database
  const success = await saveStaffToDb(staff);
  if (!success) {
    console.error('Failed to hire staff member');
    return null;
  }

  // Update game state
  updateGameState({ staff: [...currentStaff, staff] });

  await notificationService.addMessage(`${staff.name} has been hired!`, 'staffService.hireStaff', 'Staff Hiring', NotificationCategory.STAFF_MANAGEMENT);
  return staff;
}

/**
 * Remove a staff member from the game state and database
 */
export async function removeStaff(staffId: string): Promise<boolean> {
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  const staff = currentStaff.find(s => s.id === staffId);

  if (!staff) {
    console.error('Staff member not found');
    return false;
  }

  const success = await deleteStaffFromDb(staffId);
  if (!success) {
    console.error('Failed to remove staff member');
    return false;
  }

  updateGameState({ staff: currentStaff.filter(s => s.id !== staffId) });

  console.log(`${staff.name} has left the company`);
  return true;
}

/**
 * Get all staff members
 */
export function getAllStaff(): Staff[] {
  return getGameState().staff || [];
}

/**
 * Get a staff member by ID
 */
export function getStaffById(staffId: string): Staff | undefined {
  const staff = getAllStaff();
  return staff.find(s => s.id === staffId);
}

/**
 * Initialize staff system (load from database)
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


