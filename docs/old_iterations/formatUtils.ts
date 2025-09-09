import { SkillLevels } from "../constants/staffConstants";


export function formatCurrency(value: number, decimals = 0): string {
  return `€${formatNumber(value, decimals)}`;
}


export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}


export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
}

export const formatPercentage = formatPercent;


export function getCountryCodeForFlag(countryName: string | undefined | null): string {
  if (!countryName) return ''; // Handle undefined or null input

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
  return colorMap[level] || 'text-gray-500'; // Default to gray if level is unexpected
}

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

export function getSkillLevelInfo(level: number): {
  name: string;
  modifier: number;
  costMultiplier: number;
  levelKey: number;
  colorClass: string;
} {
  const levelKeys = Object.keys(SkillLevels).map(Number).sort((a, b) => a - b);

  const closestKey = levelKeys.reduce((prev, curr) => {
    return Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev;
  });

  const skillData = SkillLevels[closestKey as keyof typeof SkillLevels];
  const colorClass = getColorClass(closestKey);
  return {
    name: skillData?.name || 'Unknown',
    modifier: skillData?.modifier || 0,
    costMultiplier: skillData?.costMultiplier || 1,
    levelKey: closestKey,
    colorClass,
  };
}
