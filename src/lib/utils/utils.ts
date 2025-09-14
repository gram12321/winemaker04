import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format timestamp as HH:MM:SS
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ===== NUMBER FORMATTING UTILITIES =====

/**
 * Format a number with specified decimal places
 * @param value The number to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
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
 * Format a number as currency (Euros)
 * @param value The amount to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || isNaN(value)) return '€0';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
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
 * Get wine quality category description
 * @param quality Quality value between 0 and 1
 * @returns Quality category description
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
