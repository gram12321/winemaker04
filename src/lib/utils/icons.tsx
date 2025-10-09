// Icon components for consistent UI across the application

/**
 * Common icon components for consistent UI across the application
 * These replace inline SVG definitions and provide consistent styling
 */

// Chevron Icons for expandable/collapsible UI elements
export const ChevronDownIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export const ChevronRightIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const ChevronUpIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

export const ChevronLeftIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

// Utility function to get the appropriate chevron icon based on expanded state
export const getChevronIcon = (isExpanded: boolean, className?: string) => {
  return isExpanded ? 
    <ChevronDownIcon className={className} /> : 
    <ChevronRightIcon className={className} />;
};

// Alternative function that returns just the icon component
export const getChevronIconComponent = (isExpanded: boolean) => {
  return isExpanded ? ChevronDownIcon : ChevronRightIcon;
};

// Common icon sizes for consistency
export const ICON_SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4', 
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
} as const;

export type IconSize = keyof typeof ICON_SIZES;

// Specialization Icons - Emoji-based icons for staff specializations
export const SPECIALIZATION_ICONS = {
  field: '🌱',        // Vineyard Manager - Growing/planting
  winery: '🍷',       // Master Winemaker - Wine production
  administration: '📊', // Estate Administrator - Business/management
  sales: '💼',        // Sales Director - Business/sales
  maintenance: '🔧'   // Technical Director - Technical/maintenance
} as const;

// Helper function to get specialization icon
export const getSpecializationIcon = (specialization: string): string => {
  return SPECIALIZATION_ICONS[specialization as keyof typeof SPECIALIZATION_ICONS] || '⭐';
};
