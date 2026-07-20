import type { ComponentProps, ReactNode } from 'react';
import type { GameDate, Nationality, SpecializedRole, WorkCategory } from '@/lib/types/types';
import type StaffModal from './ui/StaffModal';
import type { StaffSkillBarsList } from './ui/StaffSkillBar';

export type StaffActivityAdapter = Pick<import('@/lib/features/activities').ActivitiesFeature, 'catalog' | 'reads' | 'work' | 'ui'>;

/** Feature-owned staff read model. Persistence rows and the global game-state model stay internal. */
export interface StaffRecord {
  id: string; name: string; nationality: Nationality; skillLevel: number; specializedRoles: SpecializedRole[];
  wage: number; isFounder?: boolean; teamIds: string[]; skills: StaffSkillSet;
  experience: Record<string, number>; workforce: number; hireDate: GameDate;
}
export interface StaffSkillSet { field: number; winery: number; maintenance: number; financeAndStaff: number; sales: number; administrationAndResearch: number; }
export interface StaffTeamRecord { id: string; name: string; description: string; memberIds: string[]; icon?: string; defaultTaskTypes: string[]; }
export interface StaffCreateInput { firstName: string; lastName: string; skillLevel: number; nationality: Nationality; hireDate: GameDate; skills?: StaffSkillSet; isFounder?: boolean; specializedRoles?: SpecializedRole[]; }
export interface StaffTeamCreateInput { name: string; description: string; defaultTaskTypes?: string[]; icon?: string; }

export interface StaffFeature {
  records: {
    create(input: StaffCreateInput): StaffRecord;
    add(staff: StaffRecord): Promise<StaffRecord | null>;
    remove(staffId: string): Promise<boolean>;
    getAll(): Promise<StaffRecord[]>;
    getById(staffId: string): Promise<StaffRecord | undefined>;
  };
  recruitment: {
    generateSkills(skillModifier?: number, specializedRoles?: SpecializedRole[]): StaffSkillSet;
    getRandomFirstName(nationality: Nationality): string;
    getRandomLastName(nationality: Nationality): string;
    getRandomNationality(): Nationality;
  };
  competency: {
    calculateEffectiveSkill(baseSkill: number, rawExperience: number): number;
    awardExperience(staffId: string, amount: number, categories: string[]): Promise<void>;
  };
  teams: {
    create(input: StaffTeamCreateInput): StaffTeamRecord;
    getForCategory(teams: StaffTeamRecord[], category: WorkCategory): StaffTeamRecord | null;
    getDefault(): Promise<StaffTeamRecord[]>;
    add(team: StaffTeamRecord): Promise<StaffTeamRecord>;
    update(team: StaffTeamRecord): Promise<StaffTeamRecord>;
    remove(teamId: string): Promise<boolean>;
    assign(staffId: string, teamId: string): Promise<boolean>;
    removeMember(staffId: string, teamId: string): Promise<boolean>;
  };
  wages: {
    calculate(skills: StaffSkillSet, specializedRoles?: SpecializedRole[], experience?: Record<string, number>): number;
    getDistinctRoleSkillGroupCount(specializedRoles?: SpecializedRole[]): number;
    getColorClass(wage: number, period?: 'weekly' | 'seasonal' | 'annual'): string;
    calculateTotalWeekly(staff: Pick<StaffRecord, 'wage'>[]): number;
    calculateTotalSeasonal(staff: Pick<StaffRecord, 'wage'>[]): number;
    calculateTotalYearly(staff: Pick<StaffRecord, 'wage'>[]): number;
    processSeasonal(staff: StaffRecord[], skipNotification?: boolean): Promise<string | null>;
    processFounderDistributions(staff: StaffRecord[], previousYear: number): Promise<void>;
  };
  founders: { buyout(staffId: string): Promise<string | null> };
  presentation: { getExperience(staff: StaffRecord): { skillExperience: StaffExperienceDisplayItem[]; taskMastery: StaffExperienceDisplayItem[]; grapeMastery: StaffExperienceDisplayItem[]; totalXP: number } };
  setup: { initialize(): Promise<void> };
  ui: {
    renderWorkspace(props: { title: string; activity: StaffActivityAdapter }): ReactNode;
    renderStaffModal(props: ComponentProps<typeof StaffModal>): ReactNode;
    renderSkillBars(props: ComponentProps<typeof StaffSkillBarsList>): ReactNode;
  };
}

export interface StaffExperienceDisplayItem { key: string; label: string; xp: number; progressPercent: number; }
