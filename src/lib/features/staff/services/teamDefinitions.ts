import { v4 as uuidv4 } from 'uuid';
import type { StaffTeam, WorkCategory } from '@/lib/types/types';

export function createTeam(name: string, description: string, defaultTaskTypes: string[] = [], icon = '👥'): StaffTeam {
  return { id: uuidv4(), name, description, memberIds: [], icon, defaultTaskTypes };
}

export function getTeamForCategory(teams: StaffTeam[], category: WorkCategory): StaffTeam | null {
  return teams.find(team => team.defaultTaskTypes.includes(category.toLowerCase())) ?? null;
}
