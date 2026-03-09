import type { GameDate } from '../shared/coreTypes';

export type Nationality = 'Italy' | 'Germany' | 'France' | 'Spain' | 'United States';

export type SkillKey = 'field' | 'winery' | 'financeAndStaff' | 'sales' | 'administrationAndResearch';

export interface StaffSkills {
  field: number;
  winery: number;
  financeAndStaff: number;
  sales: number;
  administrationAndResearch: number;
}

export interface Staff {
  id: string;
  name: string;
  nationality: Nationality;
  skillLevel: number;
  specializations: string[];
  wage: number;
  teamIds: string[];
  skills: StaffSkills;
  experience: Record<string, number>;
  workforce: number;
  hireDate: GameDate;
}

export interface StaffTeam {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  icon?: string;
  defaultTaskTypes: string[];
}
