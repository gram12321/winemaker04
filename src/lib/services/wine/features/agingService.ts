// Wine Aging Service
// Dedicated service for all bottle aging calculations and progression
// Handles aging progress, peak status, weekly updates, and UI display data

import { WineBatch, GrapeVariety, GameDate } from '../../../types/types';
import { GRAPE_CONST } from '../../../constants/grapeConstants';
import { squashNormalizeTail } from '../../../utils/calculator';
import { getGameState } from '../../core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils';

// ===== AGING STATUS INTERFACE =====

export interface AgingStatus {
  ageInYears: number;
  ageInWeeks: number;
  agingStage: string;
  peakStatus: 'developing' | 'early-peak' | 'peak' | 'mature' | 'past-peak';
  progressPercent: number;
  progressColor: string;
  agingProgress: number; // 0-1 scale for feature severity
}

// ===== AGE CALCULATION HELPERS =====

/**
 * Calculate wine age in weeks from harvest date to current game date
 * Used for display purposes (total wine age)
 * 
 * @param harvestDate - Harvest start date
 * @returns Age in weeks
 */
export function getWineAgeFromHarvest(harvestDate: GameDate): number {
  const gameState = getGameState();
  const currentWeek = gameState.week || 1;
  const currentSeason = gameState.season || 'Spring';
  const currentYear = gameState.currentYear || 2024;
  
  // Use existing calculateAbsoluteWeeks utility which calculates the difference between two dates
  const weeksElapsed = calculateAbsoluteWeeks(
    currentWeek,
    currentSeason,
    currentYear,
    harvestDate.week,
    harvestDate.season,
    harvestDate.year
  );
  
  return Math.max(0, weeksElapsed - 1); // Subtract 1 because calculateAbsoluteWeeks returns minimum 1
}

/**
 * Calculate wine age in weeks from bottling date to current game date
 * Returns 0 if wine is not bottled yet
 * 
 * @param wine - Wine batch
 * @returns Age in weeks since bottling
 */
export function getWineAgeFromBottling(wine: WineBatch): number {
  if (wine.state !== 'bottled' || !wine.bottledDate) return 0;
  return wine.agingProgress || 0;
}

// ===== AGING PROGRESS CALCULATIONS =====

/**
 * Calculate comprehensive aging status for a wine batch
 * Used by UI components for displaying aging information
 * 
 * @param wine - Wine batch to calculate aging status for
 * @returns Comprehensive aging status with progress, peak status, and display data
 */
export function calculateAgingStatus(wine: WineBatch): AgingStatus {
  const ageInWeeks = wine.agingProgress || 0;
  const ageInYears = ageInWeeks / 52;
  
  // Get grape-specific aging profile
  const grapeData = GRAPE_CONST[wine.grape as GrapeVariety];
  const profile = grapeData?.agingProfile || { earlyPeak: 2, latePeak: 5, ageWorthiness: 'medium' };
  
  // Determine aging stage (human-readable)
  let agingStage = 'Fresh';
  if (ageInYears >= 0.5) agingStage = 'Developing';
  if (ageInYears >= 2) agingStage = 'Maturing';
  if (ageInYears >= 5) agingStage = 'Mature';
  if (ageInYears >= 10) agingStage = 'Aged';
  if (ageInYears >= 20) agingStage = 'Vintage';
  
  // Calculate aging progress using squashNormalizeTail for diminishing returns
  // Normalize age: 1.0 = latePeak years (100% target, but never reachable)
  // Allow values > 1.0 to represent aging beyond latePeak (diminishing returns)
  const normalizedAge = ageInYears / profile.latePeak;
  
  // Use squashNormalizeTail with maxTarget 0.9999 to create diminishing returns
  // threshold 0.9 means: values from 0.9-1.0+ get squashed toward 0.9999 (never quite 1.0)
  // This ensures 100% is the theoretical max (latePeak years) but is never actually reached
  const agingProgress = squashNormalizeTail(
    normalizedAge,
    0.9,       // threshold: start squashing at 90% (just before late peak)
    0.9999,    // maxTarget: approach but never reach 100% (1.0)
    8          // alpha: steepness of the tail squashing
  );
  
  // Convert to percentage for display
  const progressPercent = agingProgress * 100;
  
  // Determine peak status and color based on normalized age
  let peakStatus: 'developing' | 'early-peak' | 'peak' | 'mature' | 'past-peak';
  let progressColor: string;
  
  const earlyPeakNormalized = profile.earlyPeak / profile.latePeak;
  
  if (normalizedAge < earlyPeakNormalized * 0.5) {
    peakStatus = 'developing';
    progressColor = 'bg-yellow-400'; // 🟡 Developing
  } else if (normalizedAge < earlyPeakNormalized) {
    peakStatus = 'early-peak';
    progressColor = 'bg-green-400'; // 🟢 Early Peak
  } else if (normalizedAge < 1.0) {
    peakStatus = 'peak';
    progressColor = 'bg-green-500'; // 🟢 Peak Window
  } else if (normalizedAge < 1.5) {
    peakStatus = 'mature';
    progressColor = 'bg-blue-500'; // 🔵 Mature (plateau)
  } else {
    peakStatus = 'past-peak';
    progressColor = 'bg-orange-400'; // 🟠 Past Peak (diminishing returns)
  }
  
  return {
    ageInYears,
    ageInWeeks,
    agingStage,
    peakStatus,
    progressPercent,
    progressColor,
    agingProgress
  };
}

/**
 * Get peak status labels for UI display
 */
export const AGING_PEAK_STATUS_LABELS = {
  'developing': '🟡 Developing',
  'early-peak': '🟢 Early Peak',
  'peak': '🟢 Peak Window',
  'mature': '🔵 Mature',
  'past-peak': '🟠 Past Peak'
} as const;

/**
 * Get aging progress for bottle aging feature
 * This is the severity value used by the bottle_aging feature
 * 
 * @param wine - Wine batch
 * @returns Aging progress (0-1 scale)
 */
export function getBottleAgingSeverity(wine: WineBatch): number {
  if (wine.state !== 'bottled') return 0;
  return calculateAgingStatus(wine).agingProgress;
}

// ===== WEEKLY AGING PROGRESSION =====

/**
 * Process weekly aging for all bottled wines
 * Called by game tick system to increment agingProgress
 * 
 * @param batches - All wine batches to process
 * @returns Updated batches with incremented agingProgress
 */
export function processWeeklyAging(batches: WineBatch[]): WineBatch[] {
  return batches.map(batch => {
    // Only age bottled wines
    if (batch.state !== 'bottled') return batch;
    
    // Increment aging progress by 1 week
    const newAgingProgress = (batch.agingProgress || 0) + 1;
    
    return {
      ...batch,
      agingProgress: newAgingProgress
    };
  });
}

