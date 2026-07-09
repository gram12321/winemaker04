import { describe, expect, it } from 'vitest';
import { GRAPE_VARIETIES } from '@/lib/types/types';
import { calculateGrapeDifficulty } from '@/lib/services/wine/features/grapeDifficulty';
import { getResearchProject } from '@/lib/constants/researchConstants';
import {
  calculateResearchCost,
  calculateResearchWork,
} from '@/lib/services/activity/workcalculators/researchWorkCalculator';

describe('grape research economics', () => {
  it('keeps higher grape difficulty aligned with higher research demands', () => {
    const rows = GRAPE_VARIETIES.map(grape => {
      const difficulty = calculateGrapeDifficulty(grape);
      const project = getResearchProject(`agri_${grape.toLowerCase().replace(/\s+/g, '_')}`);

      if (!project) {
        throw new Error(`Missing grape research project for ${grape}`);
      }

      return {
        grape,
        score: Number(difficulty.score.toFixed(3)),
        complexity: project.complexity,
        work: calculateResearchWork(project.id).totalWork,
        cost: calculateResearchCost(project.id),
      };
    }).sort((left, right) => left.score - right.score);

    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];

      expect(current.complexity).toBeGreaterThanOrEqual(previous.complexity);
      expect(current.work).toBeGreaterThanOrEqual(previous.work);
      expect(current.cost).toBeGreaterThanOrEqual(previous.cost);
    }
  });
});
