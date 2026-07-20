import { v4 as uuidv4 } from 'uuid';
import type { GameDate, Nationality, SpecializedRole, Staff, StaffSkills } from '@/lib/types/types';
import {
  getFemaleNamesForNationality,
  getLastNamesForNationality,
  getMaleNamesForNationality,
  isSpecializedRole,
  NATIONALITIES,
  STAFF_DEFAULT_WORKFORCE,
  STAFF_RANDOM_SKILL_RANGE,
  STAFF_SKILL_LEVEL_WEIGHT,
  STAFF_SPECIALIZED_SKILL_BONUS_BASE,
  STAFF_SPECIALIZED_SKILL_BONUS_SCALE,
  STAFF_SPECIALIZED_SKILL_FLOOR_BASE,
  STAFF_SPECIALIZED_SKILL_FLOOR_SCALE,
} from '@/lib/constants/staffConstants';
import { getRandomFromArray } from '@/lib/utils/utils';
import { calculateWage } from './wageCalculations';

export function generateRandomSkills(skillModifier = 0.5, specializedRoles: SpecializedRole[] = []): StaffSkills {
  const specializedSkills = new Set(specializedRoles);
  const getSkillValue = (isSpecialized: boolean): number => {
    const baseValue = (Math.random() * STAFF_RANDOM_SKILL_RANGE) + (skillModifier * STAFF_SKILL_LEVEL_WEIGHT);
    if (!isSpecialized) return baseValue;

    const bumped = Math.min(1, baseValue + ((1 - baseValue) * (STAFF_SPECIALIZED_SKILL_BONUS_BASE + (skillModifier * STAFF_SPECIALIZED_SKILL_BONUS_SCALE))));
    const specializationFloor = Math.min(1, STAFF_SPECIALIZED_SKILL_FLOOR_BASE + (skillModifier * STAFF_SPECIALIZED_SKILL_FLOOR_SCALE));
    return Math.max(bumped, specializationFloor);
  };

  return {
    field: getSkillValue(specializedSkills.has('field')),
    winery: getSkillValue(specializedSkills.has('winery')),
    maintenance: getSkillValue(specializedSkills.has('maintenance')),
    financeAndStaff: getSkillValue(specializedSkills.has('financeAndStaff')),
    sales: getSkillValue(false),
    administrationAndResearch: getSkillValue(specializedSkills.has('administrationAndResearch')),
  };
}

export function getRandomFirstName(nationality: Nationality): string {
  return getRandomFromArray(Math.random() > 0.5
    ? getMaleNamesForNationality(nationality)
    : getFemaleNamesForNationality(nationality));
}

export function getRandomLastName(nationality: Nationality): string {
  return getRandomFromArray(getLastNamesForNationality(nationality));
}

export function getRandomNationality(): Nationality {
  return getRandomFromArray(NATIONALITIES);
}

export function createStaff(
  firstName: string,
  lastName: string,
  skillLevel: number,
  nationality: Nationality,
  hireDate: GameDate,
  skills?: StaffSkills,
  isFounder = false,
  specializedRoles: SpecializedRole[] = [],
): Staff {
  if (!specializedRoles.every(isSpecializedRole)) {
    throw new Error('Staff specialized roles must be valid roles.');
  }

  const calculatedSkills = skills ?? generateRandomSkills(skillLevel, specializedRoles);
  return {
    id: uuidv4(),
    name: `${firstName} ${lastName}`,
    nationality,
    skillLevel,
    specializedRoles,
    skills: calculatedSkills,
    wage: isFounder ? 0 : calculateWage(calculatedSkills, specializedRoles),
    isFounder,
    workforce: STAFF_DEFAULT_WORKFORCE,
    hireDate,
    teamIds: [],
    experience: {},
  };
}
