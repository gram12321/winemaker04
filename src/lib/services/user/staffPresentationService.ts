import type { Staff } from '@/lib/types/types';
import { getStaffSpecializationDisplayName, isStaffSpecializationCategory } from '@/lib/features/activities/constants/activityConstants';
import { normalizeXP } from '@/lib/utils/calculator';

export interface StaffExperienceDisplayItem {
  key: string;
  label: string;
  xp: number;
  progressPercent: number;
}

export interface StaffExperiencePresentation {
  skillExperience: StaffExperienceDisplayItem[];
  taskMastery: StaffExperienceDisplayItem[];
  grapeMastery: StaffExperienceDisplayItem[];
  totalXP: number;
}

function formatExperienceLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

function formatTaskMasteryLabel(value: string): string {
  return isStaffSpecializationCategory(value)
    ? getStaffSpecializationDisplayName(value)
    : value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

/** Converts namespaced persisted XP into display-ready, normalized models. */
export function getStaffExperiencePresentation(staff: Staff): StaffExperiencePresentation {
  const entries = Object.entries(staff.experience || {});
  const toItem = (key: string, xp: number, prefix: string, label = formatExperienceLabel(key.slice(prefix.length))): StaffExperienceDisplayItem => ({
    key,
    label,
    xp,
    progressPercent: normalizeXP(xp) * 100,
  });

  return {
    skillExperience: entries
      .filter(([key]) => key.startsWith('skill:'))
      .map(([key, xp]) => toItem(key, xp, 'skill:')),
    taskMastery: entries
      .filter(([key]) => key.startsWith('task:'))
      .map(([key, xp]) => toItem(key, xp, 'task:', formatTaskMasteryLabel(key.slice('task:'.length)))),
    grapeMastery: entries
      .filter(([key]) => key.startsWith('grape:'))
      .map(([key, xp]) => toItem(key, xp, 'grape:')),
    totalXP: entries.reduce((total, [, xp]) => total + xp, 0),
  };
}
