import type { ComponentProps, ReactNode } from 'react';
import type { GameDate, Nationality, SpecializedRole, Staff, StaffSkills, StaffTeam, WorkCategory } from '@/lib/types/types';
import type StaffModal from './ui/StaffModal';
import type { StaffSkillBarsList } from './ui/StaffSkillBar';

export type StaffActivityAdapter = Pick<import('@/lib/features/activities').ActivitiesFeature, 'catalog' | 'reads' | 'work' | 'ui'>;

export interface StaffFeature {
  records: {
    create(firstName: string, lastName: string, skillLevel: number, nationality: Nationality, hireDate: GameDate, skills?: StaffSkills, isFounder?: boolean, specializedRoles?: SpecializedRole[]): Staff;
    add(staff: Staff): Promise<Staff | null>;
    remove(staffId: string): Promise<boolean>;
    getAll(): Promise<Staff[]>;
    getById(staffId: string): Promise<Staff | undefined>;
  };
  recruitment: {
    generateSkills(skillModifier?: number, specializedRoles?: SpecializedRole[]): StaffSkills;
    getRandomFirstName(nationality: Nationality): string;
    getRandomLastName(nationality: Nationality): string;
    getRandomNationality(): Nationality;
  };
  competency: {
    calculateEffectiveSkill(baseSkill: number, rawExperience: number): number;
    awardExperience(staffId: string, amount: number, categories: string[]): Promise<void>;
  };
  teams: {
    create(name: string, description: string, defaultTaskTypes?: string[], icon?: string): StaffTeam;
    getForCategory(teams: StaffTeam[], category: WorkCategory): StaffTeam | null;
    getDefault(): Promise<StaffTeam[]>;
    add(team: StaffTeam): Promise<StaffTeam>;
    update(team: StaffTeam): Promise<StaffTeam>;
    remove(teamId: string): Promise<boolean>;
    assign(staffId: string, teamId: string): Promise<boolean>;
    removeMember(staffId: string, teamId: string): Promise<boolean>;
  };
  wages: {
    calculate: typeof import('./services/wageCalculations').calculateWage;
    getDistinctRoleSkillGroupCount: typeof import('./services/wageCalculations').getDistinctSpecializationSkillGroupCount;
    getColorClass: typeof import('./services/wageCalculations').getWageColorClass;
    calculateTotalWeekly: typeof import('./services/wageCalculations').calculateTotalWeeklyWages;
    calculateTotalSeasonal: typeof import('./services/wageCalculations').calculateTotalSeasonalWages;
    calculateTotalYearly: typeof import('./services/wageCalculations').calculateTotalYearlyWages;
    processSeasonal(staff: Staff[], skipNotification?: boolean): Promise<string | null>;
    processFounderDistributions(staff: Staff[], previousYear: number): Promise<void>;
  };
  founders: { buyout(staffId: string): Promise<string | null> };
  presentation: { getExperience: typeof import('./services/staffPresentationService').getStaffExperiencePresentation };
  setup: { initialize(): Promise<void> };
  ui: {
    renderWorkspace(props: { title: string; activity: StaffActivityAdapter }): ReactNode;
    renderStaffModal(props: ComponentProps<typeof StaffModal>): ReactNode;
    renderSkillBars(props: ComponentProps<typeof StaffSkillBarsList>): ReactNode;
  };
}
