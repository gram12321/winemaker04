import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Customer, WineCharacteristics } from '../types/types';
import { calculateRelationshipBreakdown, formatRelationshipBreakdown } from '../services/sales/relationshipService';
import { BASE_BALANCED_RANGES } from '../constants/grapeConstants';
import { Normalize1000To01WithTail } from './calculator';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
export function getRandomFromArray<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ========================================
// SECTION 2: NUMBER & CURRENCY FORMATTING
// ========================================

/**
 * Unified number formatting function that handles regular numbers, currency, and compact notation
 * Replaces formatCurrency and formatCompact functions
 * 
 * @param value The number to format
 * @param options Formatting options
 * @returns Formatted number string
 * 
 * @example
 * // Regular number formatting
 * formatNumber(1234.5) // "1.234,50" (German locale)
 * formatNumber(0.987, { adaptiveNearOne: true }) // "0.98700" (extra precision near 1.0)
 * formatNumber(0.01, { smartMaxDecimals: true }) // "0.01" (2 decimals for small numbers)
 * formatNumber(5.2, { smartMaxDecimals: true }) // "5.2" (1 decimal for medium numbers)
 * formatNumber(15, { smartMaxDecimals: true }) // "15" (0 decimals for large numbers)
 * 
 * // Currency formatting
 * formatNumber(1234.56, { currency: true }) // "€1,235"
 * formatNumber(1234567, { currency: true, compact: true }) // "€1.2M"
 * 
 * // Compact notation
 * formatNumber(1234567, { compact: true }) // "1.2M"
 * formatNumber(1234567, { compact: true, decimals: 2 }) // "1.23M"
 */
export function formatNumber(value: number, options?: {
  decimals?: number;
  forceDecimals?: boolean;
  smartDecimals?: boolean;
  smartMaxDecimals?: boolean; // when true, reduce decimals for larger numbers (0-1%: 2-3 decimals, 1-10%: 1 decimal, 10%+: 0 decimals)
  adaptiveNearOne?: boolean; // when true, increase decimals near 1.0 (e.g., 0.95-1.0)
  currency?: boolean; // when true, formats as currency with € symbol
  compact?: boolean; // when true, uses compact notation (K, M, B, T)
}): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return options?.currency ? '€0' : '0';
  }
  
  const { 
    decimals, 
    forceDecimals = false, 
    smartDecimals = false, 
    smartMaxDecimals = false, 
    adaptiveNearOne = true,
    currency = false,
    compact = false
  } = options || {};

  // Handle compact notation (with or without currency)
  if (compact) {
    const absValue = Math.abs(value);
    // Default decimals for compact: 1 for currency, 1 for regular
    const compactDecimals = decimals !== undefined ? decimals : 1;
    
    let compactValue: string;
    if (absValue >= 1e12) {
      compactValue = (value / 1e12).toFixed(compactDecimals) + 'T';
    } else if (absValue >= 1e9) {
      compactValue = (value / 1e9).toFixed(compactDecimals) + 'B';
    } else if (absValue >= 1e6) {
      compactValue = (value / 1e6).toFixed(compactDecimals) + 'M';
    } else if (absValue >= 1e3) {
      compactValue = (value / 1e3).toFixed(compactDecimals) + 'K';
    } else {
      compactValue = value.toFixed(compactDecimals);
    }
    
    return currency ? '€' + compactValue : compactValue;
  }
  
  // Handle currency formatting (non-compact)
  if (currency) {
    const finalDecimals = decimals !== undefined ? decimals : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: finalDecimals,
      maximumFractionDigits: finalDecimals
    }).format(value);
  }
  
  // Regular number formatting (original logic)
  const effectiveDecimals = decimals ?? 2;

  // Smart max decimals: reduce decimals for larger numbers
  let calculatedDecimals = effectiveDecimals;
  if (smartMaxDecimals) {
    const absValue = Math.abs(value);
    if (absValue >= 10) {
      calculatedDecimals = 0; // 10%+: 0 decimals (15%, 100%)
    } else if (absValue >= 1) {
      calculatedDecimals = 1; // 1-10%: 1 decimal (1.2%, 8.5%)
    } else {
      calculatedDecimals = 2; // 0-1%: 2 decimals (0.01%, 0.15%)
    }
  }
  
  // Dynamically increase precision when approaching 1.0 to better show differences (e.g., 0.987 → 0.9870)
  // This ALWAYS takes precedence over smart options when near 1.0
  if (adaptiveNearOne && value < 1 && value >= 0.95) {
    calculatedDecimals = Math.max(calculatedDecimals, 4);
    if (value >= 0.98) {
      calculatedDecimals = Math.max(calculatedDecimals, 5);
    }
  }
  
  // For large numbers (>1000), don't show decimals unless forced
  if (Math.abs(value) >= 1000 && !forceDecimals && !smartDecimals) {
    return value.toLocaleString('de-DE', {
      maximumFractionDigits: 0
    });
  }
  
  // For small whole numbers, don't show decimals unless forced
  if (Number.isInteger(value) && !forceDecimals && !smartDecimals) {
    return value.toLocaleString('de-DE', {
      maximumFractionDigits: 0
    });
  }
  
  // Smart decimals mode: intelligent decimal display based on value magnitude
  // Always uses calculatedDecimals as base (includes smartMaxDecimals and adaptiveNearOne logic)
  // If decimals is specified: uses calculatedDecimals (preserves original behavior)
  // If decimals is NOT specified: uses calculatedDecimals for >=1, new intelligent logic for <1
  // NOTE: Uses minimumFractionDigits: 0 (when forceDecimals is false) to remove trailing zeros
  //       So whole numbers show as "6" not "6,0", but decimals show as "6,1"
  if (smartDecimals) {
    // Handle zero case: show "0" with no decimals
    if (value === 0) {
      return '0';
    }
    
    // If decimals is specified with smartDecimals, use calculatedDecimals (includes smartMaxDecimals and adaptiveNearOne)
    // This preserves the original behavior completely
    if (decimals !== undefined) {
      const maxDecimals = Math.min(calculatedDecimals, 6); // Cap for readability
      const formatted = value.toLocaleString('de-DE', {
        minimumFractionDigits: forceDecimals ? maxDecimals : 0,
        maximumFractionDigits: maxDecimals
      });
      return formatted;
    }
    
    // New intelligent behavior: no decimals specified
    // For values >= 1: use calculatedDecimals (which includes smartMaxDecimals: >=10: 0, >=1: 1, default: 2)
    if (Math.abs(value) >= 1) {
      const maxDecimals = Math.min(calculatedDecimals, 6);
      return value.toLocaleString('de-DE', {
        minimumFractionDigits: forceDecimals ? maxDecimals : 0,
        maximumFractionDigits: maxDecimals
      });
    }
    
    // Handle values > 0 and < 1: show 2 decimals after first non-zero digit
    // BUT respect adaptiveNearOne first (takes precedence)
    // Example: 0.999999 → 0.99999 (adaptiveNearOne: 5 decimals)
    // Example: 0.00044 → 0.00044 (first non-zero at pos 4, show positions 4-5, need 5 total decimals)
    // Example: 0.123 → 0.12 (first non-zero at pos 1, show positions 1-2, need 2 total decimals)
    
    // Check adaptiveNearOne first (takes precedence over new logic)
    if (adaptiveNearOne && value >= 0.95) {
      let adaptiveDecimals = 4;
      if (value >= 0.98) {
        adaptiveDecimals = 5;
      }
      return value.toLocaleString('de-DE', {
        minimumFractionDigits: forceDecimals ? adaptiveDecimals : 0,
        maximumFractionDigits: adaptiveDecimals
      });
    }
    
    // New intelligent logic: show 2 decimals after first non-zero digit
    const absValue = Math.abs(value);
    
    // Use logarithmic approach to find the order of magnitude
    // This handles floating point precision better than string conversion
    // log10(0.00044) ≈ -3.357, so first non-zero is at position ceil(3.357) = 4
    const log10 = Math.log10(absValue);
    const firstNonZeroPosition = Math.ceil(-log10);
    
    // Calculate total decimal places to show: include first non-zero position + 1 more decimal
    // (to show 2 digits total: first non-zero + 1 more)
    // Cap at 6 decimals total for readability
    const totalDecimals = Math.min(firstNonZeroPosition + 1, 6);
    
    // Ensure at least 2 decimals for values < 1 (for values like 0.123)
    const finalDecimals = Math.max(totalDecimals, 2);
    
    return value.toLocaleString('de-DE', {
      minimumFractionDigits: forceDecimals ? finalDecimals : 0,
      maximumFractionDigits: finalDecimals
    });
  }
  
  // For decimals or when forced, show specified decimal places
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: calculatedDecimals,
    maximumFractionDigits: calculatedDecimals
  });
}

/**
 * Format a number as percentage
 * 
 * @param value The number to format (0-1 range or 0-100 range)
 * @param decimals Number of decimal places (default: 1)
 * @param isDecimal Whether the input is in decimal form (0-1) or percentage form (0-100)
 * @returns Formatted percentage string
 * 
 * @example
 * formatPercent(0.873, 1) // "87.3%"
 */
export function formatPercent(value: number, decimals: number = 1, isDecimal: boolean = true): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  
  const percentage = isDecimal ? value * 100 : value;
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(percentage / 100);
}

// ========================================
// SECTION 3: DATE & TIME FORMATTING
// ========================================

/**
 * Format timestamp as HH:MM:SS
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Format a date as a readable string
 * 
 * @param date The date to format
 * @param includeTime Whether to include time (default: false)
 * @returns Formatted date string
 */
export function formatDate(date: Date, includeTime: boolean = false): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format game date components as a readable string
 * 
 * @example formatGameDate(3, 'Summer', 2024) // "Week 3, Summer 2024"
 */
export function formatGameDate(week?: number, season?: string, year?: number): string {
  const weekNum = week || 1;
  const seasonName = season || 'Spring';
  const yearNum = year || 2024;
  
  return `Week ${weekNum}, ${seasonName} ${yearNum}`;
}

/**
 * Format game date object as a readable string
 */
export function formatGameDateFromObject(gameDate: { week: number; season: string; year: number }): string {
  return formatGameDate(gameDate.week, gameDate.season, gameDate.year);
}

// ========================================
// SECTION 4: GAME TIME CALCULATIONS
// ========================================

/**
 * Calculate absolute weeks from game start (2024, Week 1)
 * Used for calculating game progression and time-based effects
 * 
 * @param currentWeek Current week number
 * @param currentSeason Current season
 * @param currentYear Current year
 * @param startWeek Starting week (default: 1)
 * @param startSeason Starting season (default: 'Spring')
 * @param startYear Starting year (default: 2024)
 * @returns Total weeks elapsed
 */
export function calculateAbsoluteWeeks(
  currentWeek: number,
  currentSeason: string,
  currentYear: number,
  startWeek: number = 1,
  startSeason: string = 'Spring',
  startYear: number = 2024
): number {
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  
  // Convert start date to absolute weeks
  const startSeasonIndex = seasons.indexOf(startSeason);
  const startAbsoluteWeeks = (startYear - 2024) * 52 + startSeasonIndex * 13 + (startWeek - 1);
  
  // Convert current date to absolute weeks
  const currentSeasonIndex = seasons.indexOf(currentSeason);
  const currentAbsoluteWeeks = (currentYear - 2024) * 52 + currentSeasonIndex * 13 + (currentWeek - 1);
  
  return Math.max(1, currentAbsoluteWeeks - startAbsoluteWeeks + 1);
}

/**
 * Calculate weeks elapsed for a company since founding
 * 
 * @param foundedYear Year the company was founded
 * @param currentWeek Current week number
 * @param currentSeason Current season
 * @param currentYear Current year
 * @returns Weeks elapsed since founding
 */
export function calculateCompanyWeeks(
  foundedYear: number,
  currentWeek: number,
  currentSeason: string,
  currentYear: number
): number {
  return calculateAbsoluteWeeks(currentWeek, currentSeason, currentYear, 1, 'Spring', foundedYear);
}

// ========================================
// SECTION 5: WINE QUALITY & SCORING
// ========================================

/**
 * Get grape quality category based on quality value (0-1)
 * Maps quality scores to readable tier names
 */
export function getGrapeQualityCategory(quality: number): string {
  if (quality < 0.1) return "Undrinkable";
  if (quality < 0.2) return "Vinegar Surprise";
  if (quality < 0.3) return "House Pour";
  if (quality < 0.4) return "Everyday Sipper";
  if (quality < 0.5) return "Solid Bottle";
  if (quality < 0.6) return "Well-Balanced";
  if (quality < 0.7) return "Sommelier's Choice";
  if (quality < 0.8) return "Cellar Reserve";
  if (quality < 0.9) return "Connoisseur's Pick";
  return "Vintage Perfection";
}

/**
 * Get grape quality description based on quality value (0-1)
 * Provides detailed description of quality tier
 */
export function getGrapeQualityDescription(quality: number): string {
  if (quality < 0.1) return "Wines that are not suitable for consumption";
  if (quality < 0.2) return "Poor quality wines with significant flaws";
  if (quality < 0.3) return "Simple wines typically served in restaurants";
  if (quality < 0.4) return "Basic wines for casual drinking";
  if (quality < 0.5) return "Decent wines suitable for everyday consumption";
  if (quality < 0.6) return "Good quality wines with harmonious characteristics";
  if (quality < 0.7) return "Well-crafted wines that professionals recommend";
  if (quality < 0.8) return "Premium wines suitable for aging and special occasions";
  if (quality < 0.9) return "High-quality wines that appeal to wine enthusiasts and collectors";
  return "Exceptional wines that represent the pinnacle of winemaking artistry";
}

/**
 * Get grape quality info (category and description) based on quality value (0-1)
 * Convenience function combining both category and description
 */
export function getGrapeQualityInfo(quality: number): { category: string; description: string } {
  return {
    category: getGrapeQualityCategory(quality),
    description: getGrapeQualityDescription(quality)
  };
}

/**
 * Get wine balance category based on balance value (0-1)
 * Maps balance scores to humorous tier names
 */
export function getWineBalanceCategory(balance: number): string {
  if (balance < 0.1) return "Train Wreck";
  if (balance < 0.2) return "Crashed";
  if (balance < 0.3) return "Chaotic";
  if (balance < 0.4) return "Confused Identity";
  if (balance < 0.5) return "Finding Harmony";
  if (balance < 0.6) return "Well-Composed";
  if (balance < 0.7) return "Elegantly Balanced";
  if (balance < 0.8) return "B-E-Autiful!";
  if (balance < 0.9) return "Symphony in a Glass";
  return "Perfection Achieved";
}

/**
 * Get wine balance description based on balance value (0-1)
 * Provides detailed description of balance tier
 */
export function getWineBalanceDescription(balance: number): string {
  if (balance < 0.1) return "A catastrophic clash of flavors that should never have met";
  if (balance < 0.2) return "Characteristics fighting each other for dominance";
  if (balance < 0.3) return "Unbalanced with one or more elements overpowering the rest";
  if (balance < 0.4) return "Lacking cohesion, though individual elements show promise";
  if (balance < 0.5) return "Approaching balance but still noticeably rough around the edges";
  if (balance < 0.6) return "Pleasant harmony emerging with good integration of characteristics";
  if (balance < 0.7) return "Well-balanced with all elements working together nicely";
  if (balance < 0.8) return "Beautifully integrated characteristics creating a refined experience";
  if (balance < 0.9) return "Exceptional balance where every element enhances the whole";
  return "A masterpiece of balance representing the pinnacle of winemaking harmony";
}

// ========================================
// SECTION 6: COLOR & BADGE UTILITIES
// ========================================

/**
 * Get color category name based on value (0-1)
 * Used for displaying quality level labels
 */
export function getColorCategory(value: number): string {
  if (value < 0.1) return "Awful";
  if (value < 0.2) return "Terrible";
  if (value < 0.3) return "Poor";
  if (value < 0.4) return "Below Average";
  if (value < 0.5) return "Average";
  if (value < 0.6) return "Above Average";
  if (value < 0.7) return "Good";
  if (value < 0.8) return "Very Good";
  if (value < 0.9) return "Excellent";
  return "Perfect";
}

/**
 * Get Tailwind color class based on quality value (0-1)
 * Returns text color class from red (poor) to green (excellent)
 * 
 * @example getColorClass(0.85) // "text-green-700"
 */
export function getColorClass(value: number): string {
  const level = Math.max(0, Math.min(9, Math.floor(value * 10)));
  const colorMap: Record<number, string> = {
    0: 'text-red-600',
    1: 'text-red-500', 
    2: 'text-orange-500',
    3: 'text-amber-500',
    4: 'text-yellow-500',
    5: 'text-lime-500',
    6: 'text-lime-600',
    7: 'text-green-600',
    8: 'text-green-700',
    9: 'text-green-800',
  };
  return colorMap[level] || 'text-gray-500';
}

/**
 * Get badge color classes based on rating value (0-1)
 * Returns both text and background colors for badge components
 * 
 * @example getBadgeColorClasses(0.85) // { text: 'text-green-700', bg: 'bg-green-100' }
 */
export function getBadgeColorClasses(value: number): { text: string; bg: string } {
  const level = Math.max(0, Math.min(9, Math.floor(value * 10)));
  const colorMap: Record<number, { text: string; bg: string }> = {
    0: { text: 'text-red-600', bg: 'bg-red-100' },
    1: { text: 'text-red-500', bg: 'bg-red-100' },
    2: { text: 'text-orange-500', bg: 'bg-orange-100' },
    3: { text: 'text-amber-500', bg: 'bg-amber-100' },
    4: { text: 'text-yellow-500', bg: 'bg-yellow-100' },
    5: { text: 'text-lime-500', bg: 'bg-lime-100' },
    6: { text: 'text-lime-600', bg: 'bg-lime-100' },
    7: { text: 'text-green-600', bg: 'bg-green-100' },
    8: { text: 'text-green-700', bg: 'bg-green-100' },
    9: { text: 'text-green-800', bg: 'bg-green-100' },
  };
  return colorMap[level] || { text: 'text-gray-500', bg: 'bg-gray-100' };
}

/**
 * Compute rating and color classes for a range-based value.
 * @param value The value to rate and color-code
 * @param normalizeMin Minimum value of the range
 * @param normalizeMax Maximum value of the range
 * @param strategy 'higher_better' | 'lower_better' | 'balanced' | 'exponential'
 * @param balanceMin Optional: minimum of ideal range for 'balanced' strategy
 * @param balanceMax Optional: maximum of ideal range for 'balanced' strategy
 * @returns Object with rating, text, bg, and badge color classes
 * 
 * @example
 * const { text, bg } = getRangeColor(7500, 0, 10000, 'higher_better');
 */
export function getRangeColor(
  value: number,
  normalizeMin: number,
  normalizeMax: number,
  strategy: 'higher_better' | 'lower_better' | 'balanced' | 'exponential',
  balanceMin?: number,
  balanceMax?: number
): { 
  rating: number;
  text: string;
  bg: string;
  badge: { text: string; bg: string };
} {
  const rating = getRatingForRange(value, normalizeMin, normalizeMax, strategy, balanceMin, balanceMax);
  const text = getColorClass(rating);
  const bg = text.replace('text-', 'bg-');
  const badge = getBadgeColorClasses(rating);
  return { rating, text, bg, badge };
}

/**
 * Get rating (0-1) for values with flexible range normalization and interpretation strategies
 * This is the internal calculation used by getRangeColor, but can be used directly
 * when you need the rating value instead of the color classes
 * 
 * @param value The actual value to rate
 * @param normalizeMin Minimum value of the actual range (e.g., 0, 1500, 0)
 * @param normalizeMax Maximum value of the actual range (e.g., 10000, 15000, 1)
 * @param strategy How to interpret the normalized value: 'higher_better', 'lower_better', 'balanced', or 'exponential'
 * @param balanceMin Optional: minimum of ideal range for 'balanced' strategy (e.g., 0.5)
 * @param balanceMax Optional: maximum of ideal range for 'balanced' strategy (e.g., 0.7)
 * @returns Rating value (0-1) where higher values are better
 * 
 * @example
 * // Company Value: 0-10000 range, higher is better
 * getRatingForRange(7500, 0, 10000, 'higher_better') // 0.75
 * 
 * // Density: 1500-15000 range, lower is better  
 * getRatingForRange(8000, 1500, 15000, 'lower_better') // 0.52
 * 
 * // Wine Body: 0-1 range, balanced at 0.5-0.7
 * getRatingForRange(0.3, 0, 1, 'balanced', 0.5, 0.7) // 0.33
 * 
 * // Wine Tannins: 0-1 range, balanced at 0.4-0.6
 * getRatingForRange(0.5, 0, 1, 'balanced', 0.4, 0.6) // 1.0
 * 
 * // Prestige: 0-1000 range, exponential scaling (quick out of red, slow to deep green)
 * getRatingForRange(50, 0, 1000, 'exponential') // ~0.7 (out of red quickly)
 * getRatingForRange(500, 0, 1000, 'exponential') // ~0.95 (takes long to reach deep green)
 */
export function getRatingForRange(
  value: number,
  normalizeMin: number,
  normalizeMax: number,
  strategy: 'higher_better' | 'lower_better' | 'balanced' | 'exponential',
  balanceMin?: number,
  balanceMax?: number
): number {
  let rating: number;
  
  switch (strategy) {
    case 'higher_better':
      // Normalize value to 0-1 range
      const normalized = Math.max(0, Math.min(1, (value - normalizeMin) / (normalizeMax - normalizeMin)));
      // Higher normalized value = better rating
      rating = normalized;
      break;
      
    case 'lower_better':
      // Normalize value to 0-1 range
      const normalizedLower = Math.max(0, Math.min(1, (value - normalizeMin) / (normalizeMax - normalizeMin)));
      // Lower normalized value = better rating
      rating = 1 - normalizedLower;
      break;
      
    case 'balanced':
      if (balanceMin === undefined || balanceMax === undefined) {
        throw new Error('balanceMin and balanceMax are required for balanced strategy');
      }
      
      // Normalize value to 0-1 range
      const normalizedBalanced = Math.max(0, Math.min(1, (value - normalizeMin) / (normalizeMax - normalizeMin)));
      
      // Calculate distance from ideal range
      const idealCenter = (balanceMin + balanceMax) / 2;
      const idealRange = balanceMax - balanceMin;
      
      // Check if value is within the balanced range
      const isWithinRange = normalizedBalanced >= balanceMin && normalizedBalanced <= balanceMax;
      
      if (isWithinRange) {
        // Value is within range: use smooth curve from center (1.0) to edge (0.5)
        // Uses quadratic curve for smoother color transitions across full spectrum
        const distanceFromCenter = Math.abs(normalizedBalanced - idealCenter) / (idealRange / 2);
        // Map distance 0-1 to rating 1.0-0.5 using quadratic curve
        // This ensures smooth transitions through all color levels (5-9)
        rating = 1.0 - (distanceFromCenter * distanceFromCenter * 0.5);
      } else {
        // Value is outside range: apply penalty that scales with distance
        const distanceOutside = normalizedBalanced < balanceMin 
          ? (balanceMin - normalizedBalanced) 
          : (normalizedBalanced - balanceMax);
        // Normalize outside distance relative to range width for consistent scaling
        const normalizedDistanceOutside = distanceOutside / idealRange;
        // Use exponential decay for harsh penalty outside range
        // Maps smoothly from 0.5 (at edge) down to 0.0 (far outside)
        // This utilizes color levels 0-4 (red to yellow)
        rating = Math.max(0, 0.5 * Math.exp(-normalizedDistanceOutside * 2));
      }
      break;
      
    case 'exponential':
      // Use the existing exponential normalization function
      // Map the value from normalizeMin-normalizeMax range to 0-1000 range for the function
      const mappedValue = Math.max(0, (value - normalizeMin) / (normalizeMax - normalizeMin)) * 1000;
      rating = Normalize1000To01WithTail (mappedValue);
      break;
      
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
  
  return rating;
}

// ========================================
// SECTION 9: CREDIT RATING SYSTEM
// ========================================

/**
 * Credit rating categories based on 0-1 scale
 * Maps credit rating values to standard credit rating categories
 */
export function getCreditRatingCategory(creditRating: number): string {
  if (creditRating >= 0.95) return "AAA";
  if (creditRating >= 0.90) return "AA+";
  if (creditRating >= 0.85) return "AA";
  if (creditRating >= 0.80) return "AA-";
  if (creditRating >= 0.75) return "A+";
  if (creditRating >= 0.70) return "A";
  if (creditRating >= 0.65) return "A-";
  if (creditRating >= 0.60) return "BBB+";
  if (creditRating >= 0.55) return "BBB";
  if (creditRating >= 0.50) return "BBB-";
  if (creditRating >= 0.45) return "BB+";
  if (creditRating >= 0.40) return "BB";
  if (creditRating >= 0.35) return "BB-";
  if (creditRating >= 0.30) return "B+";
  if (creditRating >= 0.25) return "B";
  if (creditRating >= 0.20) return "B-";
  if (creditRating >= 0.15) return "CCC+";
  if (creditRating >= 0.10) return "CCC";
  if (creditRating >= 0.05) return "CC";
  return "C";
}

/**
 * Get credit rating description based on credit rating value (0-1)
 * Provides detailed description of creditworthiness level
 */
export function getCreditRatingDescription(creditRating: number): string {
  if (creditRating >= 0.95) return "Exceptional creditworthiness - AAA rating";
  if (creditRating >= 0.90) return "Excellent creditworthiness - AA+ rating";
  if (creditRating >= 0.85) return "Very good creditworthiness - AA rating";
  if (creditRating >= 0.80) return "Good creditworthiness - AA- rating";
  if (creditRating >= 0.75) return "Strong creditworthiness - A+ rating";
  if (creditRating >= 0.70) return "Solid creditworthiness - A rating";
  if (creditRating >= 0.65) return "Adequate creditworthiness - A- rating";
  if (creditRating >= 0.60) return "Acceptable creditworthiness - BBB+ rating";
  if (creditRating >= 0.55) return "Fair creditworthiness - BBB rating";
  if (creditRating >= 0.50) return "Average creditworthiness - BBB- rating";
  if (creditRating >= 0.45) return "Below average creditworthiness - BB+ rating";
  if (creditRating >= 0.40) return "Poor creditworthiness - BB rating";
  if (creditRating >= 0.35) return "Very poor creditworthiness - BB- rating";
  if (creditRating >= 0.30) return "High risk creditworthiness - B+ rating";
  if (creditRating >= 0.25) return "Very high risk creditworthiness - B rating";
  if (creditRating >= 0.20) return "Extremely high risk creditworthiness - B- rating";
  if (creditRating >= 0.15) return "Speculative creditworthiness - CCC+ rating";
  if (creditRating >= 0.10) return "Highly speculative creditworthiness - CCC rating";
  if (creditRating >= 0.05) return "Very highly speculative creditworthiness - CC rating";
  return "Default risk creditworthiness - C rating";
}

/**
 * Get economy phase abbreviation for compact display
 */
export function getEconomyPhaseAbbreviation(phase: string): string {
  switch (phase) {
    case 'Crash': return 'CR';
    case 'Recession': return 'RE';
    case 'Recovery': return 'RV';
    case 'Expansion': return 'EX';
    case 'Boom': return 'BM';
    default: return 'RV';
  }
}

/**
 * Get color class for lender type
 */
export function getLenderTypeColorClass(type: string): string {
  switch (type) {
    case 'Bank': return 'bg-blue-100 text-blue-800';
    case 'Investment Fund': return 'bg-green-100 text-green-800';
    case 'Private Lender': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get color class for economy phase
 */
export function getEconomyPhaseColorClass(phase: string): string {
  switch (phase) {
    case 'Crash': return 'bg-red-100 text-red-800';
    case 'Recession': return 'bg-orange-100 text-orange-800';
    case 'Recovery': return 'bg-yellow-100 text-yellow-800';
    case 'Expansion': return 'bg-green-100 text-green-800';
    case 'Boom': return 'bg-emerald-100 text-emerald-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// ========================================
// SECTION 7: UI & DISPLAY UTILITIES
// ========================================

/**
 * Get flag icon CSS class for country flags using flag-icon-css
 * Returns the complete CSS class string for use with flag-icon-css library
 * Loaded via: https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/3.5.0/css/flag-icon.min.css
 * 
 * @param countryName - Name of the country (e.g., "Italy", "France", "US")
 * @returns Complete CSS class string (e.g., "flag-icon flag-icon-it")
 * 
 * @example
 * <span className={getFlagIcon("Italy")}></span>
 * // Returns: <span class="flag-icon flag-icon-it"></span>
 */
export function getFlagIcon(countryName: string | undefined | null): string {
  if (!countryName) return "flag-icon flag-icon-xx";
  
  const countryToFlagCode: { [key: string]: string } = {
    "Italy": "it",
    "France": "fr", 
    "Spain": "es",
    "United States": "us",
    "US": "us",
    "Germany": "de",
  };
  
  const flagCode = countryToFlagCode[countryName] || "xx";
  return `flag-icon flag-icon-${flagCode}`;
}

/**
 * Common class names for reset buttons (used in Winepedia)
 */
export const RESET_BUTTON_CLASSES = "px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors";

/**
 * Load and format relationship breakdown for UI display
 * Handles the common pattern used in Sales.tsx and Winepedia.tsx
 */
export async function loadFormattedRelationshipBreakdown(customer: Customer): Promise<string> {
  try {
    const breakdown = await calculateRelationshipBreakdown(customer);
    return formatRelationshipBreakdown(breakdown);
  } catch (error) {
    console.error('Error loading relationship breakdown:', error);
    return 'Failed to load relationship breakdown';
  }
}

// ========================================
// SECTION 8: WINE CHARACTERISTICS & BALANCE
// ========================================

/**
 * Get display name for wine characteristic keys
 * Converts snake_case or camelCase to Title Case
 * 
 * @example getCharacteristicDisplayName('aroma') // "Aroma"
 */
export function getCharacteristicDisplayName(characteristic: string): string {
  const names: Record<string, string> = {
    'acidity': 'Acidity',
    'aroma': 'Aroma', 
    'body': 'Body',
    'spice': 'Spice',
    'sweetness': 'Sweetness',
    'tannins': 'Tannins'
  };
  return names[characteristic] || characteristic;
}

/**
 * Calculate midpoint characteristics from balanced ranges
 * Used as default values in Winepedia filters and UI
 */
export function calculateMidpointCharacteristics(): WineCharacteristics {
  return {
    acidity: (BASE_BALANCED_RANGES.acidity[0] + BASE_BALANCED_RANGES.acidity[1]) / 2,
    aroma: (BASE_BALANCED_RANGES.aroma[0] + BASE_BALANCED_RANGES.aroma[1]) / 2,
    body: (BASE_BALANCED_RANGES.body[0] + BASE_BALANCED_RANGES.body[1]) / 2,
    spice: (BASE_BALANCED_RANGES.spice[0] + BASE_BALANCED_RANGES.spice[1]) / 2,
    sweetness: (BASE_BALANCED_RANGES.sweetness[0] + BASE_BALANCED_RANGES.sweetness[1]) / 2,
    tannins: (BASE_BALANCED_RANGES.tannins[0] + BASE_BALANCED_RANGES.tannins[1]) / 2
  };
}

/**
 * Create adjusted ranges record from base balanced ranges
 * Returns a mutable copy for dynamic range adjustments in Winepedia
 */
export function createAdjustedRangesRecord(): Record<keyof WineCharacteristics, [number, number]> {
  return {
    acidity: [...BASE_BALANCED_RANGES.acidity] as [number, number],
    aroma: [...BASE_BALANCED_RANGES.aroma] as [number, number],
    body: [...BASE_BALANCED_RANGES.body] as [number, number],
    spice: [...BASE_BALANCED_RANGES.spice] as [number, number],
    sweetness: [...BASE_BALANCED_RANGES.sweetness] as [number, number],
    tannins: [...BASE_BALANCED_RANGES.tannins] as [number, number]
  };
}

/**
 * ===== COLOR CODING FOR CHARACTERISTICS =====
 * 
 * Use getRangeColor(value, 0, 1, 'balanced', min, max) for:
 * - Static characteristic VALUES (e.g., "Body: 0.7")
 * - Current state display (bars, sliders, tooltips)
 * - Rating how good a value is relative to balanced range
 * 
 * Use getCharacteristicEffectColorClass(currentValue, modifier, balancedRange) for:
 * - EFFECTS/MODIFIERS (e.g., "+5% body", "-10% acidity")
 * - Changes/changes (weekly effects, feature impacts, processing options)
 * - Determining if a change moves towards balance (green) or away (red)
 * 
 * Examples:
 * - CharacteristicBar: Use 'balanced' strategy (displaying current value)
 * - FeatureDisplay effects: Use getCharacteristicEffectColorClass (displaying modifiers)
 * - Fermentation preview: Use getCharacteristicEffectColorClass (displaying expected changes)
 */

/**
 * Determine if a characteristic effect modifier is moving towards balance
 * Returns information for color coding: isGood (true = green, false = red) and intensity rating
 * @param currentValue Current characteristic value (0-1)
 * @param modifier Effect modifier (can be positive or negative)
 * @param balancedRange Balanced range [min, max] for this characteristic
 * @returns Object with isGood (moving towards balance) and intensity (0-1, higher = stronger effect)
 */
export function getCharacteristicEffectColorInfo(
  currentValue: number,
  modifier: number,
  balancedRange: readonly [number, number] | [number, number]
): { isGood: boolean; intensity: number } {
  const [min, max] = balancedRange;
  const midpoint = (min + max) / 2;
  
  // Calculate distance from midpoint before and after applying modifier
  const distanceBefore = Math.abs(currentValue - midpoint);
  const newValue = Math.max(0, Math.min(1, currentValue + modifier));
  const distanceAfter = Math.abs(newValue - midpoint);
  
  // If distance decreases, we're moving towards balance (good = green)
  // If distance increases, we're moving away from balance (bad = red)
  // Use small epsilon (1e-9) to handle floating point precision issues
  const epsilon = 1e-9;
  const isGood = distanceAfter < (distanceBefore - epsilon);
  
  // Calculate intensity based on how much the distance changes
  // For bad effects (moving away): use absolute distance change as intensity
  // For good effects (moving towards): use relative improvement (distance change / distance before)
  // Special case: if starting from perfect balance (distanceBefore = 0), any movement away should be high intensity
  const distanceChange = Math.abs(distanceBefore - distanceAfter);
  
  let intensity: number;
  if (isGood) {
    // Moving towards balance: intensity based on relative improvement
    // If distanceBefore is 0, we can't divide, so use distanceChange directly
    if (distanceBefore === 0) {
      intensity = Math.min(1, distanceChange / 0.1); // Normalize assuming 0.1 is max typical modifier
    } else {
      // Relative improvement: how much of the imbalance we're fixing
      const relativeImprovement = distanceChange / distanceBefore;
      // Use absolute change for minimum intensity, relative improvement for scaling
      // This ensures that large absolute changes (like tannins) get proper intensity even if relative improvement is small
      const absoluteIntensity = Math.min(1, distanceChange / 0.1);
      const relativeIntensity = Math.min(1, relativeImprovement * 0.7); // Scale relative improvement
      // Take the maximum to ensure good effects always show as green
      intensity = Math.max(absoluteIntensity, relativeIntensity, 0.6); // Minimum 0.6 for any good effect
    }
  } else {
    // Moving away from balance: intensity based on absolute change
    // If starting from perfect balance (distanceBefore = 0), use high intensity
    if (distanceBefore === 0) {
      // Starting from perfect balance - any movement away should be strong red
      intensity = Math.min(1, Math.max(0.8, distanceChange / 0.1)); // At least 0.8 intensity for moving away from perfect balance
    } else {
      // Already unbalanced - intensity based on how much worse we're getting
      intensity = Math.min(1, distanceChange / 0.1);
    }
  }
  
  return { isGood, intensity };
}

/**
 * Get color class for characteristic effect modifier
 * Uses balance-aware logic: green if moving towards balance, red if moving away
 * Intensity increases with stronger effects
 * @param currentValue Current characteristic value (0-1)
 * @param modifier Effect modifier (can be positive or negative)
 * @param balancedRange Balanced range [min, max] for this characteristic
 * @returns Color class string for text color
 */
export function getCharacteristicEffectColorClass(
  currentValue: number,
  modifier: number,
  balancedRange: readonly [number, number] | [number, number]
): string {
  const { isGood, intensity } = getCharacteristicEffectColorInfo(currentValue, modifier, balancedRange);
  
  // getColorClass maps ratings to colors:
  // 0-0.4 = red/orange/yellow, 0.5-0.6 = lime, 0.7+ = green
  // For good effects: higher intensity = deeper green (needs rating >= 0.7)
  // For bad effects: higher intensity = deeper red (needs rating <= 0.4)
  if (isGood) {
    // Good effects: map intensity to green range (0.7-1.0)
    // Minimum 0.7 to ensure green, scale intensity (0.6-1.0) to (0.7-1.0)
    const rating = Math.max(0.7, Math.min(1.0, 0.7 + (intensity - 0.6) * 0.3 / 0.4)); // Map [0.6,1.0] to [0.7,1.0]
    return getColorClass(rating);
  } else {
    // Bad effects: map intensity to red range (0.0-0.4)
    // Higher intensity = deeper red (lower rating)
    // Map intensity (0.2-1.0) to rating (0.4-0.0)
    // If intensity < 0.2, clamp to 0.4 (light red)
    const rating = intensity < 0.2 
      ? 0.4 
      : Math.max(0.0, 0.4 - (intensity - 0.2) * 0.4 / 0.8); // Map [0.2,1.0] to [0.4,0.0]
    return getColorClass(rating);
  }
}
