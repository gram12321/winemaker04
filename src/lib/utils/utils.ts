import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Customer, WineCharacteristics } from '../types/types';
import { calculateRelationshipBreakdown, formatRelationshipBreakdown } from '../services/sales/relationshipService';
import { BASE_BALANCED_RANGES } from '../constants/grapeConstants';

// ========================================
// SECTION 1: CORE UTILITIES
// ========================================

/**
 * Merge Tailwind CSS classes with proper conflict resolution
 * Used throughout the app for dynamic className composition
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get random element from array
 * @example getRandomFromArray(['red', 'blue', 'green']) // Returns random color
 */
export function getRandomFromArray<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Clamp value to 0-1 range (used in wine characteristics and balance calculations)
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ========================================
// SECTION 2: NUMBER & CURRENCY FORMATTING
// ========================================

/**
 * Format a number with appropriate thousand separators and decimal places
 * More flexible version that handles different number sizes intelligently
 * 
 * @param value The number to format
 * @param options Formatting options
 * @returns Formatted number string
 * 
 * @example
 * formatNumber(1234.5) // "1.234,50" (German locale)
 * formatNumber(0.987, { adaptiveNearOne: true }) // "0.98700" (extra precision near 1.0)
 * formatNumber(0.01, { smartMaxDecimals: true }) // "0.01" (2 decimals for small numbers)
 * formatNumber(5.2, { smartMaxDecimals: true }) // "5.2" (1 decimal for medium numbers)
 * formatNumber(15, { smartMaxDecimals: true }) // "15" (0 decimals for large numbers)
 */
export function formatNumber(value: number, options?: {
  decimals?: number;
  forceDecimals?: boolean;
  smartDecimals?: boolean;
  smartMaxDecimals?: boolean; // when true, reduce decimals for larger numbers (0-1%: 2-3 decimals, 1-10%: 1 decimal, 10%+: 0 decimals)
  adaptiveNearOne?: boolean; // when true, increase decimals near 1.0 (e.g., 0.95-1.0)
}): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  const { decimals = 2, forceDecimals = false, smartDecimals = false, smartMaxDecimals = false, adaptiveNearOne = true } = options || {};

  // Smart max decimals: reduce decimals for larger numbers
  let effectiveDecimals = decimals;
  if (smartMaxDecimals) {
    const absValue = Math.abs(value);
    if (absValue >= 10) {
      effectiveDecimals = 0; // 10%+: 0 decimals (15%, 100%)
    } else if (absValue >= 1) {
      effectiveDecimals = 1; // 1-10%: 1 decimal (1.2%, 8.5%)
    } else {
      effectiveDecimals = 2; // 0-1%: 2 decimals (0.01%, 0.15%)
    }
  }
  
  // Dynamically increase precision when approaching 1.0 to better show differences (e.g., 0.987 → 0.9870)
  // This ALWAYS takes precedence over smart options when near 1.0
  if (adaptiveNearOne && value < 1 && value >= 0.95) {
    effectiveDecimals = Math.max(effectiveDecimals, 4);
    if (value >= 0.98) {
      effectiveDecimals = Math.max(effectiveDecimals, 5);
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
  
  // Smart decimals mode: show up to specified decimals but remove trailing zeros
  if (smartDecimals) {
    const maxDecimals = Math.min(effectiveDecimals, 6); // Cap for readability
    const formatted = value.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals
    });
    return formatted;
  }
  
  // For decimals or when forced, show specified decimal places
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: effectiveDecimals,
    maximumFractionDigits: effectiveDecimals
  });
}

/**
 * Format a number as currency (Euros) with optional compact notation
 * 
 * @param value The amount to format
 * @param decimals Number of decimal places (default: 0 for regular, 1 for compact)
 * @param compact Whether to use compact notation (K, M, B, T) (default: false)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1234.56) // "€1,235"
 * formatCurrency(1234567, undefined, true) // "€1.2M"
 */
export function formatCurrency(value: number, decimals?: number, compact: boolean = false): string {
  if (typeof value !== 'number' || isNaN(value)) return '€0';
  
  // Set default decimals based on compact mode
  const defaultDecimals = compact ? 1 : 0;
  const finalDecimals = decimals !== undefined ? decimals : defaultDecimals;
  
  if (compact) {
    const absValue = Math.abs(value);
    
    if (absValue >= 1e12) {
      return '€' + (value / 1e12).toFixed(finalDecimals) + 'T';
    } else if (absValue >= 1e9) {
      return '€' + (value / 1e9).toFixed(finalDecimals) + 'B';
    } else if (absValue >= 1e6) {
      return '€' + (value / 1e6).toFixed(finalDecimals) + 'M';
    } else if (absValue >= 1e3) {
      return '€' + (value / 1e3).toFixed(finalDecimals) + 'K';
    } else {
      return '€' + value.toFixed(finalDecimals);
    }
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: finalDecimals,
    maximumFractionDigits: finalDecimals
  }).format(value);
}

/**
 * Format a number in compact notation (K, M, B, T)
 * 
 * @param value The number to format
 * @param decimals Number of decimal places (default: 1)
 * @returns Compact formatted number string
 * 
 * @example
 * formatCompact(1234567) // "1.2M"
 */
export function formatCompact(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1e12) {
    return (value / 1e12).toFixed(decimals) + 'T';
  } else if (absValue >= 1e9) {
    return (value / 1e9).toFixed(decimals) + 'B';
  } else if (absValue >= 1e6) {
    return (value / 1e6).toFixed(decimals) + 'M';
  } else if (absValue >= 1e3) {
    return (value / 1e3).toFixed(decimals) + 'K';
  } else {
    return value.toFixed(decimals);
  }
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
 * Get wine quality category based on quality value (0-1)
 * Maps quality scores to readable tier names
 */
export function getWineQualityCategory(quality: number): string {
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
 * Get wine quality description based on quality value (0-1)
 * Provides detailed description of quality tier
 */
export function getWineQualityDescription(quality: number): string {
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
 * Get wine quality info (category and description) based on quality value (0-1)
 * Convenience function combining both category and description
 */
export function getWineQualityInfo(quality: number): { category: string; description: string } {
  return {
    category: getWineQualityCategory(quality),
    description: getWineQualityDescription(quality)
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
