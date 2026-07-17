import { v4 as uuidv4 } from 'uuid';
import { Staff, StaffSkills, Nationality, SpecializedRole } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { saveStaffToDb, loadStaffFromDb, deleteStaffFromDb, getStaffByIdFromDb } from '@/lib/database/core/staffDB';
import {
  getMaleNamesForNationality,
  getFemaleNamesForNationality,
  getLastNamesForNationality,
  NATIONALITIES,
  isSpecializedRole
} from '@/lib/constants/staffConstants';
import { calculateWage } from '../finance/wageService';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { getRandomFromArray } from '@/lib/utils';
import { calculateCompanyValue } from '../finance/financeService';
import { FOUNDER_BUYOUT_PERCENT_OF_ASSETS } from '@/lib/constants/staffConstants';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { addTransaction } from '../finance/financeService';

/**
 * Generate random skills based on skill level and broad specialized roles.
 * Based on v3's skill generation logic
 */
export function generateRandomSkills(
  skillModifier: number = 0.5,
  specializedRoles: SpecializedRole[] = [],
): StaffSkills {
  const specializedSkills = new Set(specializedRoles);
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
    field: getSkillValue(specializedSkills.has('field')),
    winery: getSkillValue(specializedSkills.has('winery')),
    maintenance: getSkillValue(specializedSkills.has('maintenance')),
    financeAndStaff: getSkillValue(specializedSkills.has('financeAndStaff')),
    sales: getSkillValue(false),
    administrationAndResearch: getSkillValue(specializedSkills.has('administrationAndResearch'))
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

  return getRandomFromArray(nameList);
}

/**
 * Generate a random last name for a nationality
 */
export function getRandomLastName(nationality: Nationality): string {
  const lastNames = getLastNamesForNationality(nationality);
  return getRandomFromArray(lastNames);
}

/**
 * Generate a random nationality
 */
export function getRandomNationality(): Nationality {
  return getRandomFromArray(NATIONALITIES);
}

/**
 * Create a new staff member
 */
export function createStaff(
  firstName: string,
  lastName: string,
  skillLevel: number = 0.3,
  nationality: Nationality = 'United States',
  skills?: StaffSkills,
  isFounder: boolean = false,
  specializedRoles: SpecializedRole[] = [],
): Staff {
  const gameState = getGameState();
  if (!specializedRoles.every(isSpecializedRole)) {
    throw new Error('Staff specialized roles must be valid roles.');
  }

  const calculatedSkills = skills || generateRandomSkills(skillLevel, specializedRoles);

  return {
    id: uuidv4(),
    name: `${firstName} ${lastName}`,
    nationality,
    skillLevel,
    specializedRoles,
    skills: calculatedSkills,
    // Founders earn profit share instead of wages; wage is set to 0
    wage: isFounder ? 0 : calculateWage(calculatedSkills, specializedRoles, {}),
    isFounder,
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
  return (await getStaffByIdFromDb(staffId)) ?? undefined;
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
 * Buy out a founder: converts them to a salaried employee.
 * Cost = FOUNDER_BUYOUT_PERCENT_OF_ASSETS * total company asset value.
 * Returns an error string on failure, or null on success.
 */
export async function buyoutFounder(staffId: string): Promise<string | null> {
  try {
    const staff = await getStaffById(staffId);
    if (!staff) return 'Staff member not found.';
    if (!staff.isFounder) return 'This staff member is not a founder.';

    const companyValue = await calculateCompanyValue();
    const buyoutCost = Math.round(companyValue * FOUNDER_BUYOUT_PERCENT_OF_ASSETS);

    const gameState = getGameState();
    if ((gameState.money ?? 0) < buyoutCost) {
      return `Insufficient funds. Buyout costs ${buyoutCost.toLocaleString('en-EU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} but you only have ${(gameState.money ?? 0).toLocaleString('en-EU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}.`;
    }

    // Recalculate a proper salaried wage for the now-converted employee
    const newWage = calculateWage(staff.skills, staff.specializedRoles, staff.experience);

    const updatedStaff: Staff = { ...staff, isFounder: false, wage: newWage };

    // Persist the buyout cost as a capital-flow transaction
    await addTransaction(
      -buyoutCost,
      `Founder buyout: ${staff.name}`,
      TRANSACTION_CATEGORIES.FOUNDER_BUYOUT,
      false
    );

    // Update DB + game state
    await saveStaffToDb(updatedStaff);
    const currentStaffList = getGameState().staff || [];
    updateGameState({ staff: currentStaffList.map(s => s.id === staffId ? updatedStaff : s) });

    await notificationService.addMessage(
      `${staff.name} has been bought out for €${buyoutCost.toLocaleString()}. They are now a salaried employee earning €${newWage.toLocaleString()}/week.`,
      'staffService.buyoutFounder',
      'Founder Buyout',
      NotificationCategory.FINANCE_AND_STAFF
    );

    return null; // success
  } catch (error) {
    console.error('Error buying out founder:', error);
    return 'An unexpected error occurred during buyout.';
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

  const updatedStaff: Staff = {
    ...staff,
    experience: newExperience,
    wage: staff.isFounder
      ? 0
      : calculateWage(staff.skills, staff.specializedRoles, newExperience),
  };

  // Update game state
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  const updatedStaffList = currentStaff.map(s => s.id === staffId ? updatedStaff : s);
  updateGameState({ staff: updatedStaffList });

  // Save to database
  await saveStaffToDb(updatedStaff);
}
