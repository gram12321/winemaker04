import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { WineBatch, Customer } from '../types/types';
import { calculateRelationshipBreakdown, formatRelationshipBreakdown } from '../services/sales/relationshipService';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// ===== GENERIC HELPERS =====

export function getRandomFromArray<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}


// Format timestamp as HH:MM:SS
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ===== NUMBER FORMATTING UTILITIES =====

/**
 * Format a number with appropriate thousand separators and decimal places
 * More flexible version that handles different number sizes intelligently
 * @param value The number to format
 * @param options Formatting options
 * @returns Formatted number string
 */
export function formatNumber(value: number, options?: {
  decimals?: number;
  forceDecimals?: boolean;
  smartDecimals?: boolean;
  adaptiveNearOne?: boolean; // when true, increase decimals near 1.0 (e.g., 0.95-1.0)
}): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  const { decimals = 2, forceDecimals = false, smartDecimals = false, adaptiveNearOne = true } = options || {};

  // Dynamically increase precision when approaching 1.0 to better show differences (e.g., 0.987 → 0.9870)
  let effectiveDecimals = decimals;
  if (adaptiveNearOne && value < 1 && value >= 0.95) {
    effectiveDecimals = Math.max(decimals, 4);
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
 * @param value The amount to format
 * @param decimals Number of decimal places (default: 0 for regular, 1 for compact)
 * @param compact Whether to use compact notation (K, M, B, T) (default: false)
 * @returns Formatted currency string
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
 * @param value The number to format
 * @param decimals Number of decimal places (default: 1)
 * @returns Compact formatted number string
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
 * @param value The number to format (0-1 range or 0-100 range)
 * @param decimals Number of decimal places (default: 1)
 * @param isDecimal Whether the input is in decimal form (0-1) or percentage form (0-100)
 * @returns Formatted percentage string
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

// ===== DATE & TIME UTILITIES =====

/**
 * Format a date as a readable string
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
 * @param week The week number
 * @param season The season name
 * @param year The year
 * @returns Formatted game date string
 */
export function formatGameDate(week?: number, season?: string, year?: number): string {
  const weekNum = week || 1;
  const seasonName = season || 'Spring';
  const yearNum = year || 2024;
  
  return `Week ${weekNum}, ${seasonName} ${yearNum}`;
}

/**
 * Format game date object as a readable string
 * @param gameDate Object with week, season, and year properties
 * @returns Formatted game date string
 */
export function formatGameDateFromObject(gameDate: { week: number; season: string; year: number }): string {
  return formatGameDate(gameDate.week, gameDate.season, gameDate.year);
}

// ===== GAME CALCULATION UTILITIES =====

/**
 * Calculate absolute weeks from game start (2024, Week 1)
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
 * Calculate weeks elapsed for a company
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

// ===== GAME-SPECIFIC UTILITIES =====

/**
 * Get country code for flag display
 * @param countryName The country name
 * @returns Country code for flag
 */
export function getCountryCodeForFlag(countryName: string | undefined | null): string {
  if (!countryName) return '';

  const countryToCodeMap: Record<string, string> = {
    "Italy": "it",
    "France": "fr", 
    "Spain": "es",
    "US": "us",
    "United States": "us",
    "Germany": "de",
  };

  return countryToCodeMap[countryName] || '';
}

/**
 * Get wine quality category based on quality value (0-1)
 * @param quality Quality value between 0 and 1
 * @returns Quality category string
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
 * @param quality Quality value between 0 and 1
 * @returns Quality description string
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
 * @param quality Quality value between 0 and 1
 * @returns Object with category and description
 */
export function getWineQualityInfo(quality: number): { category: string; description: string } {
  return {
    category: getWineQualityCategory(quality),
    description: getWineQualityDescription(quality)
  };
}

/**
 * Get color category based on quality value (0-1)
 * @param value Quality value between 0 and 1
 * @returns Color category string
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
 * Get color class based on quality value (0-1)
 * @param value Quality value between 0 and 1
 * @returns CSS color class
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
 * @param value Rating value between 0 and 1
 * @returns Object with text and background color classes
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


// ===== WINE FILTERING UTILITIES =====

/**
 * Filter wine batches to only bottled wines with quantity > 0
 * This is a common operation used across order generation and customer acquisition
 * 
 * @param batches - Array of wine batches to filter
 * @returns Array of bottled wines with inventory
 */
export function getAvailableBottledWines(batches: WineBatch[]): WineBatch[] {
  return batches.filter(batch => 
    batch.state === 'bottled' && 
    batch.quantity > 0
  );
}

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

// ===== FLAG UTILITIES =====

/**
 * Get flag icon CSS class for country flags using flag-icon-css
 * Note: This requires flag-icon-css library to be loaded
 */
export function getFlagIcon(countryName: string): string {
  const countryToFlagCode: { [key: string]: string } = {
    "Italy": "it",
    "France": "fr", 
    "Spain": "es",
    "United States": "us",
    "US": "us", // Alternative US format
    "Germany": "de",
  };
  
  const flagCode = countryToFlagCode[countryName] || "xx"; // Default to unknown flag
  return `flag-icon flag-icon-${flagCode}`;
}

/**
 * Get flag code for country flags
 */
export function getCountryFlag(countryName: string): string {
  const countryToFlagCode: { [key: string]: string } = {
    "Italy": "it",
    "France": "fr", 
    "Spain": "es",
    "United States": "us",
    "US": "us", // Alternative US format
    "Germany": "de",
  };
  
  const flagCode = countryToFlagCode[countryName] || "xx";
  return flagCode;
}

/**
 * Get flag emoji for nationality
 */
export function getNationalityFlag(nationality: string): string {
  const flagMap: Record<string, string> = {
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'United States': '🇺🇸',
    'US': '🇺🇸' // Alternative US format
  };
  return flagMap[nationality] || '🌍';
}

// ===== WINE CHARACTERISTIC UTILITIES =====

/**
 * Get display name for wine characteristic keys
 * @param characteristic The characteristic key (e.g., 'aroma', 'body')
 * @returns Display name (e.g., 'Aroma', 'Body')
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

// ===== EMOJI MAPPINGS =====

export const NAVIGATION_EMOJIS = {
  dashboard: '🏠',
  vineyard: '🍇',
  winery: '🏭',
  sales: '🍷',
  finance: '💰'
} as const;

export const STATUS_EMOJIS = {
  time: '📅',
  money: '💰',
  prestige: '⭐',
  wine: '🍷',
  grape: '🍇',
  building: '🏭',
  field: '🌾',
  season: {
    Spring: '🌸',
    Summer: '☀️',
    Fall: '🍂',
    Winter: '❄️'
  }
} as const;

export const QUALITY_EMOJIS = {
  poor: '😞',
  fair: '😐',
  good: '😊',
  excellent: '🤩',
  perfect: '👑'
} as const;

export const SEASON_EMOJIS = {
  Spring: '🌸',
  Summer: '☀️',
  Fall: '🍂',
  Winter: '❄️'
} as const;

export const QUALITY_FACTOR_EMOJIS = {
  landValue: '💰',
  vineyardPrestige: '🌟',
  regionalPrestige: '🏛️',
  altitudeRating: '⛰️',
  aspectRating: '🧭',
  grapeSuitability: '🍇'
} as const;

// ===== SKILL COLOR UTILITIES =====

/**
 * Skill color mapping - matches activity category colors for consistency
 * Field → Green (planting, harvesting)
 * Winery → Purple (crushing, fermentation)
 * Administration → Blue (administration tasks)
 * Sales → Amber (sales activities)
 * Maintenance → Red (building, maintenance tasks)
 */
export const SKILL_COLORS = {
  field: '#10b981',        // green-500
  winery: '#8b5cf6',       // purple-500/wine
  administration: '#3b82f6', // blue-500
  sales: '#f59e0b',        // amber-500
  maintenance: '#ef4444'   // red-500
} as const;

/**
 * Get color for a skill key
 * @param skillKey The skill key (field, winery, administration, sales, maintenance)
 * @returns Hex color code
 */
export function getSkillColor(skillKey: 'field' | 'winery' | 'administration' | 'sales' | 'maintenance'): string {
  return SKILL_COLORS[skillKey];
}

/**
 * Get skill letter abbreviation for compact display
 * @param skillKey The skill key
 * @returns Single letter abbreviation
 */
export function getSkillLetter(skillKey: 'field' | 'winery' | 'administration' | 'sales' | 'maintenance'): string {
  const letters = {
    field: 'F',
    winery: 'W',
    administration: 'A',
    sales: 'S',
    maintenance: 'M'
  };
  return letters[skillKey];
}

/**
 * Get skill display name
 * @param skillKey The skill key
 * @returns Full skill name
 */
export function getSkillDisplayName(skillKey: 'field' | 'winery' | 'administration' | 'sales' | 'maintenance'): string {
  const names = {
    field: 'Field Work',
    winery: 'Winery Work',
    administration: 'Administration',
    sales: 'Sales',
    maintenance: 'Maintenance'
  };
  return names[skillKey];
}


