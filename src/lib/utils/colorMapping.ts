// ===== CONSOLIDATED COLOR MAPPING SYSTEM =====
// Foundation: 5 core skill colors + system + sub-categories for finer distinctions

/**
 * Color scheme interface for consistent styling across the application
 */
export interface ColorScheme {
  primary: string;      // Hex color code
  background: string;   // Tailwind background class
  border: string;       // Tailwind border class  
  text: string;         // Tailwind text class
  icon: string;         // Tailwind icon color class
  badge: string;        // Tailwind badge classes
  ring: string;         // Tailwind ring color class
  parent?: string;      // Optional: parent category for hierarchical organization
}

/**
 * PRIMARY COLOR MAPPING - Foundation of all colors in the game
 * 
 * Hierarchy:
 * - 5 Core Skills (field, winery, administration, sales, maintenance)
 * - System category (for generic system messages)
 * - Sub-categories (variants of main categories for finer distinctions)
 */
export const COLOR_MAPPING: Record<string, ColorScheme> = {
  // ===== CORE SKILLS (5) =====
  
  // Field Work / Vineyard Operations - Green
  'field': {
    primary: '#10b981',      // green-500
    background: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-500',
    badge: 'bg-green-100 text-green-700 border-green-200',
    ring: 'ring-green-200'
  },
  
  // Winery Work / Winemaking Process - Purple
  'winery': {
    primary: '#8b5cf6',      // purple-500
    background: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: 'text-purple-500',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    ring: 'ring-purple-200'
  },
  
  // Administration - Blue
  'administration': {
    primary: '#2563eb',      // blue-600
    background: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    ring: 'ring-blue-200'
  },
  
  // Sales & Orders - Orange/Amber
  'sales': {
    primary: '#f59e0b',      // amber-500
    background: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: 'text-orange-500',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    ring: 'ring-orange-200'
  },
  
  // Maintenance - Red
  'maintenance': {
    primary: '#ef4444',      // red-500
    background: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    ring: 'ring-red-200'
  },
  
  // ===== SYSTEM CATEGORY =====
  
  // System (UI-only, not a game skill) - Gray
  'system': {
    primary: '#6b7280',      // gray-500
    background: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    icon: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    ring: 'ring-gray-200'
  },
  
  // ===== SUB-CATEGORIES =====
  
  // Time & Calendar - Cyan (variant of administration)
  'time': {
    primary: '#0ea5e9',      // cyan-500
    background: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    icon: 'text-cyan-500',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    ring: 'ring-cyan-200',
    parent: 'administration'
  },
  
  // Staff Management - Amber (variant of administration, people-focused, sibling to finance)
  'staff': {
    primary: '#f59e0b',      // amber-500
    background: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    ring: 'ring-amber-200',
    parent: 'administration'
  },
  
  // Finance - Yellow/Gold (variant of administration, money-focused)
  'finance': {
    primary: '#eab308',      // yellow-500
    background: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    ring: 'ring-yellow-200',
    parent: 'administration'
  },
  
  // Activities & Tasks - Indigo (variant of administration, task-focused)
  'tasks': {
    primary: '#6366f1',      // indigo-500
    background: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    icon: 'text-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    ring: 'ring-indigo-200',
    parent: 'administration'
  }
};

/**
 * SKILL_COLORS - Convenience constant for the 5 core skill colors
 * Extracted from COLOR_MAPPING for easy access to just the skill colors
 */
export const SKILL_COLORS = {
  field: COLOR_MAPPING['field'].primary,
  winery: COLOR_MAPPING['winery'].primary,
  administration: COLOR_MAPPING['administration'].primary,
  sales: COLOR_MAPPING['sales'].primary,
  maintenance: COLOR_MAPPING['maintenance'].primary
} as const;

/**
 * Get primary hex color for a skill key
 * Used for coloring skill-related UI elements (activity cards, staff bars, etc.)
 */
export function getSkillColor(skillKey: string): string {
  return COLOR_MAPPING[skillKey]?.primary || COLOR_MAPPING['system'].primary;
}

/**
 * Get Tailwind classes for any color key
 * Used for coloring notifications, toasts, and other UI elements
 */
export function getTailwindClasses(colorKey: string): {
  background: string;
  border: string;
  text: string;
  icon: string;
  badge: string;
  ring: string;
} {
  const scheme = COLOR_MAPPING[colorKey] || COLOR_MAPPING['system'];
  return {
    background: scheme.background,
    border: scheme.border,
    text: scheme.text,
    icon: scheme.icon,
    badge: scheme.badge,
    ring: scheme.ring
  };
}
