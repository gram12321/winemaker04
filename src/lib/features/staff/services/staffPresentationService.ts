import { WorkCategory } from '@/lib/types/types';
import type { StaffExperienceDisplayItem, StaffExperiencePresentation, StaffRecord } from '../featureTypes';
import { normalizeXP } from '@/lib/utils/calculator';

function formatExperienceLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

function formatTaskMasteryLabel(value: string): string {
  if (!Object.values(WorkCategory).includes(value as WorkCategory)) {
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
  }

  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase())
    .replace('And', '&');
}

/** Converts namespaced persisted XP into display-ready, normalized models. */
export function getStaffExperiencePresentation(staff: StaffRecord): StaffExperiencePresentation {
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
