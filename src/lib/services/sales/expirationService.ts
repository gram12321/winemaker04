// Shared expiration calculation service for contracts and orders
// Unified logic that considers customer type and relationship

import { CustomerType, GameDate } from '../../types/types';

/**
 * Expiration configuration by customer type
 * Used for both contracts and orders
 */
interface ExpirationConfig {
  baseWeeks: number; // Base expiration time in weeks
  relationshipBonus: number; // Weeks added per relationship point (0-100 scale)
}

/**
 * Customer type expiration configurations
 * Higher-tier customers get longer expiration times
 */
export const EXPIRATION_CONFIG: Record<CustomerType, ExpirationConfig> = {
  Restaurant: {
    baseWeeks: 6, // 1.5 months base
    relationshipBonus: 0.4 // +4 weeks at 100 relationship (total: 10 weeks)
  },
  'Wine Shop': {
    baseWeeks: 8, // 2 months base
    relationshipBonus: 0.05 // +5 weeks at 100 relationship (total: 13 weeks)
  },
  'Chain Store': {
    baseWeeks: 10, // 2.5 months base
    relationshipBonus: 0.06 // +6 weeks at 100 relationship (total: 16 weeks)
  },
  'Private Collector': {
    baseWeeks: 12, // 3 months base
    relationshipBonus: 0.08 // +8 weeks at 100 relationship (total: 20 weeks)
  }
};

/**
 * Calculate expiration date for contracts and orders
 * Unified calculation that considers customer type and relationship
 * 
 * @param currentDate - Current game date
 * @param customerType - Type of customer
 * @param relationship - Current relationship strength (0-100)
 * @returns GameDate representing when the contract/order expires
 * 
 * @example
 * // Restaurant with 50 relationship: 6 + (50 * 0.04) = 8 weeks
 * calculateExpiration(currentDate, 'Restaurant', 50)
 * 
 * // Private Collector with 80 relationship: 12 + (80 * 0.08) = 18.4 weeks
 * calculateExpiration(currentDate, 'Private Collector', 80)
 */
export function calculateExpiration(
  currentDate: GameDate,
  customerType: CustomerType,
  relationship: number
): GameDate {
  const config = EXPIRATION_CONFIG[customerType];
  
  // Calculate total weeks: base + relationship bonus
  const relationshipWeeks = Math.floor(relationship * config.relationshipBonus);
  const totalWeeks = config.baseWeeks + relationshipWeeks;
  
  // Advance the date by totalWeeks
  let { week, season, year } = currentDate;
  
  for (let i = 0; i < totalWeeks; i++) {
    week++;
    if (week > 12) { // 12 weeks per season
      week = 1;
      // Advance season
      const seasons: Array<'Spring' | 'Summer' | 'Fall' | 'Winter'> = ['Spring', 'Summer', 'Fall', 'Winter'];
      const currentSeasonIndex = seasons.indexOf(season);
      const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
      season = seasons[nextSeasonIndex];
      
      if (season === 'Spring') {
        year++;
      }
    }
  }
  
  return { week, season, year };
}

/**
 * Get expiration info for display/tooltips
 * Shows base weeks and relationship bonus
 */
export function getExpirationInfo(customerType: CustomerType, relationship: number): {
  baseWeeks: number;
  relationshipBonus: number;
  totalWeeks: number;
} {
  const config = EXPIRATION_CONFIG[customerType];
  const relationshipWeeks = Math.floor(relationship * config.relationshipBonus);
  
  return {
    baseWeeks: config.baseWeeks,
    relationshipBonus: relationshipWeeks,
    totalWeeks: config.baseWeeks + relationshipWeeks
  };
}
