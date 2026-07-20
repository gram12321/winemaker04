import type { Staff } from '@/lib/types/types';
import { NotificationCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '@/lib/services/core/gameState';
import { notificationService } from '@/lib/services/core/notificationService';
import { deleteStaffFromDb, getStaffByIdFromDb, loadStaffFromDb, saveStaffToDb } from '@/lib/database/core/staffDB';
import { FOUNDER_BUYOUT_PERCENT_OF_ASSETS } from '@/lib/constants/staffConstants';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateWage } from './wageCalculations';

export async function addStaff(staff: Staff): Promise<Staff | null> {
  if (!await saveStaffToDb(staff)) {
    console.error('Failed to hire staff member');
    return null;
  }
  const gameState = getGameState();
  updateGameState({ staff: [...(gameState.staff || []), staff] });
  await notificationService.addMessage(`${staff.name} has been hired!`, 'staff.records.add', 'Staff Hiring', NotificationCategory.STAFF_MANAGEMENT);
  return staff;
}

export async function removeStaff(staffId: string): Promise<boolean> {
  const gameState = getGameState();
  const currentStaff = gameState.staff || [];
  const staff = currentStaff.find(member => member.id === staffId);
  if (!staff || !await deleteStaffFromDb(staffId)) return false;
  updateGameState({ staff: currentStaff.filter(member => member.id !== staffId) });
  return true;
}

export const getAllStaff = (): Promise<Staff[]> => loadStaffFromDb();
export async function getStaffById(staffId: string): Promise<Staff | undefined> {
  return (await getStaffByIdFromDb(staffId)) ?? undefined;
}

export async function initializeStaffSystem(): Promise<void> {
  try {
    updateGameState({ staff: await loadStaffFromDb() });
  } catch (error) {
    console.error('Error initializing staff system:', error);
    updateGameState({ staff: [] });
  }
}

export async function buyoutFounder(staffId: string): Promise<string | null> {
  try {
    const staff = await getStaffById(staffId);
    if (!staff) return 'Staff member not found.';
    if (!staff.isFounder) return 'This staff member is not a founder.';
    const { addTransaction, calculateCompanyValue } = await import('@/lib/services/finance/financeService');
    const buyoutCost = Math.round((await calculateCompanyValue()) * FOUNDER_BUYOUT_PERCENT_OF_ASSETS);
    if ((getGameState().money ?? 0) < buyoutCost) return `Insufficient funds. Buyout costs ${buyoutCost.toLocaleString('en-EU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}.`;

    const updatedStaff: Staff = { ...staff, isFounder: false, wage: calculateWage(staff.skills, staff.specializedRoles, staff.experience) };
    await addTransaction(-buyoutCost, `Founder buyout: ${staff.name}`, TRANSACTION_CATEGORIES.FOUNDER_BUYOUT, false);
    await saveStaffToDb(updatedStaff);
    updateGameState({ staff: (getGameState().staff || []).map(member => member.id === staffId ? updatedStaff : member) });
    await notificationService.addMessage(`${staff.name} has been bought out for €${buyoutCost.toLocaleString()}.`, 'staff.founders.buyout', 'Founder Buyout', NotificationCategory.FINANCE_AND_STAFF);
    return null;
  } catch (error) {
    console.error('Error buying out founder:', error);
    return 'An unexpected error occurred during buyout.';
  }
}

export async function awardExperience(staffId: string, amount: number, categories: string[]): Promise<void> {
  const staff = await getStaffById(staffId);
  if (!staff) return;
  const experience = { ...staff.experience };
  for (const category of categories) experience[category] = (experience[category] || 0) + amount;
  const updatedStaff: Staff = { ...staff, experience, wage: staff.isFounder ? 0 : calculateWage(staff.skills, staff.specializedRoles, experience) };
  updateGameState({ staff: (getGameState().staff || []).map(member => member.id === staffId ? updatedStaff : member) });
  await saveStaffToDb(updatedStaff);
}
