import { WineCharacteristics, GrapeVariety } from '@/lib/types/types';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';

/**
 * Generate default wine characteristics for a grape variety
 * @param grape - Grape variety
 * @returns WineCharacteristics with grape-specific values
 */
export function generateDefaultCharacteristics(grape: GrapeVariety): WineCharacteristics {
  // Get grape-specific characteristics
  const grapeMetadata = GRAPE_CONST[grape];
  
  if (grapeMetadata) {
    return { ...grapeMetadata.baseCharacteristics };
  }
  
  // Throw error if grape not found (no fallback)
  throw new Error(`Grape variety '${grape}' not found in GRAPE_CONST`);
}
