import type { Staff, StaffTeam } from '@/lib/types/types';
import type { StaffRecord, StaffTeamRecord } from '../featureTypes';

export const toStaffRecord = (staff: Staff): StaffRecord => ({ ...staff, skills: { ...staff.skills }, specializedRoles: [...staff.specializedRoles], teamIds: [...staff.teamIds], experience: { ...staff.experience }, hireDate: { ...staff.hireDate } });
export const toStaff = (staff: StaffRecord): Staff => ({ ...staff, skills: { ...staff.skills }, specializedRoles: [...staff.specializedRoles], teamIds: [...staff.teamIds], experience: { ...staff.experience }, hireDate: { ...staff.hireDate } });
export const toStaffTeamRecord = (team: StaffTeam): StaffTeamRecord => ({ ...team, memberIds: [...team.memberIds], defaultTaskTypes: [...team.defaultTaskTypes] });
export const toStaffTeam = (team: StaffTeamRecord): StaffTeam => ({ ...team, memberIds: [...team.memberIds], defaultTaskTypes: [...team.defaultTaskTypes] });
