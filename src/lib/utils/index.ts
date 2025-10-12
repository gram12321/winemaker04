// Core utilities, formatting, and game calculations
export { cn, formatNumber, formatCurrency, formatDate, formatGameDate, formatGameDateFromObject, formatPercent, formatTime, formatCompact, getColorClass, getColorCategory, getWineQualityCategory, getWineQualityDescription, getWineQualityInfo, calculateCompanyWeeks, calculateAbsoluteWeeks, getRandomFromArray, getBadgeColorClasses, getCharacteristicDisplayName, loadFormattedRelationshipBreakdown, getFlagIcon, RESET_BUTTON_CLASSES, clamp01, calculateMidpointCharacteristics, createAdjustedRangesRecord } from './utils';

// Icons and UI elements
export { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ChevronLeftIcon, getChevronIcon, getChevronIconComponent, ICON_SIZES, type IconSize, getSpecializationIcon, EMOJI_OPTIONS, NAVIGATION_EMOJIS, STATUS_EMOJIS, QUALITY_EMOJIS, SEASON_EMOJIS, QUALITY_FACTOR_EMOJIS } from './icons';

// Calculators and game formulas
export { calculateSkewedMultiplier, calculateInvertedSkewedMultiplier, calculateAsymmetricalMultiplier, calculateAsymmetricalScaler01, getRandomHectares, vineyardAgePrestigeModifier, calculateBaseWinePrice, calculateSymmetricalMultiplier, calculateOrderAmount } from './calculator';

// Company and database utilities
export { getCurrentCompanyId, getCompanyQuery } from './companyUtils';

// Color mapping utilities
export { COLOR_MAPPING, SKILL_COLORS, getSkillColor, getTailwindClasses } from '@/lib/utils/colorMapping';
export type { ColorScheme } from '@/lib/utils/colorMapping';

// Types
export { NotificationCategory } from '@/lib/types/types';
