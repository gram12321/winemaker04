// Staff Service
// Business logic for staff management

import { v4 as uuidv4 } from 'uuid';
import { Staff, StaffSkills, Nationality } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { saveStaffToDb, loadStaffFromDb, deleteStaffFromDb } from '@/lib/database/core/staffDB';
import { 
  BASE_WEEKLY_WAGE, 
  SKILL_WAGE_MULTIPLIER,
  getMaleNamesForNationality,
  getFemaleNamesForNationality,
  getLastNamesForNationality,
  NATIONALITIES
} from '@/lib/constants/staffConstants';
import { notificationService } from '@/components/layout/NotificationCenter';
import { addTransaction } from './financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';

/**
 * Generate random skills based on skill level and specializations
 * Based on v3's skill generation logic
 */
export function generateRandomSkills(skillModifier: number = 0.5, specializations: string[] = []): StaffSkills {
  const getSkillValue = (isSpecialized: boolean): number => {
    // Calculate base skill value - exactly like old system
    const baseValue = (Math.random() * 0.6) + (skillModifier * 0.4);
    
    // For specialized roles, add a percentage-based bonus that scales with skill
    if (isSpecialized) {
      const remainingPotential = 1.0 - baseValue;
      const bonusPercentage = 0.2 + (skillModifier * 0.2); // 20-40%
      const bonus = remainingPotential * bonusPercentage;
      return Math.min(1.0, baseValue + bonus);
    }
    
    return baseValue;
  };
  
  return {
    field: getSkillValue(specializations.includes('field')),
    winery: getSkillValue(specializations.includes('winery')),
    administration: getSkillValue(specializations.includes('administration')),
    sales: getSkillValue(specializations.includes('sales')),
    maintenance: getSkillValue(specializations.includes('maintenance'))
  };
}

/**
 * Calculate weekly wage based on skills and specializations
 */
export function calculateWage(skills: StaffSkills, specializations: string[] = []): number {
  // Calculate average skill
  const avgSkill = (
    skills.field +
    skills.winery +
    skills.administration +
    skills.sales +
    skills.maintenance
  ) / 5;
  
  // Add bonus for specialized roles (30% per specialization, multiplicative)
  const specializationBonus = specializations.length > 0 ? 
    Math.pow(1.3, specializations.length) : 1;
  
  // Calculate weekly wage
  const weeklyWage = (BASE_WEEKLY_WAGE + (avgSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  
  return Math.round(weeklyWage);
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
    teamId: null
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
    notificationService.error('Failed to hire staff member');
    return null;
  }
  
  // Update game state
  updateGameState({ staff: [...currentStaff, staff] });
  
  notificationService.success(`${staff.name} has been hired!`);
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
    notificationService.error('Staff member not found');
    return false;
  }
  
  const success = await deleteStaffFromDb(staffId);
  if (!success) {
    notificationService.error('Failed to remove staff member');
    return false;
  }
  
  updateGameState({ staff: currentStaff.filter(s => s.id !== staffId) });
  
  notificationService.info(`${staff.name} has left the company`);
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

/**
 * Create starting staff for new companies
 * Creates 2 basic staff members with random nationalities
 */
export async function createStartingStaff(): Promise<void> {
  try {
    // Generate 2 staff with random nationalities
    const nationality1 = getRandomNationality();
    const nationality2 = getRandomNationality();
    
    const firstName1 = getRandomFirstName(nationality1);
    const lastName1 = getRandomLastName(nationality1);
    const staff1 = createStaff(firstName1, lastName1, 0.3, [], nationality1);
    
    const firstName2 = getRandomFirstName(nationality2);
    const lastName2 = getRandomLastName(nationality2);
    const staff2 = createStaff(firstName2, lastName2, 0.3, [], nationality2);
    
    await addStaff(staff1);
    await addStaff(staff2);
    
    notificationService.info('Starting staff have joined your company!');
  } catch (error) {
    console.error('Error creating starting staff:', error);
  }
}

/**
 * Process seasonal wage payments for all staff
 * Called at the start of each season (week 1) from the game tick system
 */
export async function processSeasonalWages(): Promise<void> {
  try {
    const staff = getAllStaff();
    
    if (staff.length === 0) {
      return; // No staff to pay
    }
    
    // Calculate total seasonal wages (12 weeks per season)
    const totalWages = staff.reduce((sum, member) => sum + (member.wage * 12), 0);
    
    if (totalWages === 0) {
      return; // No wages to pay
    }
    
    // Check if we have enough money
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    const season = gameState.season || 'Spring';
    
    if (currentMoney < totalWages) {
      notificationService.warning(
        `Insufficient funds for staff wages! Need €${totalWages.toFixed(2)}, have €${currentMoney.toFixed(2)}`
      );
      // Still process the transaction to show negative balance
    }
    
    // Create transaction for wage payment (negative amount = expense)
    await addTransaction(
      -totalWages,
      `${season} wages for ${staff.length} staff member${staff.length > 1 ? 's' : ''}`,
      TRANSACTION_CATEGORIES.STAFF_WAGES,
      true // recurring transaction
    );
    
    console.log(`[Staff Wages] Paid €${totalWages.toFixed(2)} to ${staff.length} staff members for ${season}`);
    
  } catch (error) {
    console.error('Error processing seasonal wages:', error);
    notificationService.error('Failed to process staff wage payments');
  }
}

/**
 * Calculate total weekly wage expense
 */
export function getTotalWeeklyWages(): number {
  const staff = getAllStaff();
  return staff.reduce((sum, member) => sum + member.wage, 0);
}

/**
 * Calculate total seasonal wage expense (12 weeks per season)
 */
export function getTotalSeasonalWages(): number {
  return getTotalWeeklyWages() * 12;
}

/**
 * Calculate total yearly wage expense (4 seasons)
 */
export function getTotalYearlyWages(): number {
  return getTotalSeasonalWages() * 4;
}

